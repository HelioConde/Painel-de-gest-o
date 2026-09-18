from __future__ import annotations

import argparse
import hashlib
import html as html_lib
import re
import time
import unicodedata
from datetime import datetime
from pathlib import Path

import win32con
import win32gui

SAVE_DIALOG_CLASS = "#32770"
SAVE_TITLE_HINTS = ("salva o relatório", "salvar", "save")
WM_SETTEXT = 0x000C
WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E
BM_CLICK = 0x00F5

POLL = 0.10


class TestError(RuntimeError):
    pass


def enum_top_windows() -> list[int]:
    result: list[int] = []
    win32gui.EnumWindows(lambda hwnd, _: result.append(hwnd), None)
    return result


def enum_children(parent: int) -> list[int]:
    result: list[int] = []
    win32gui.EnumChildWindows(parent, lambda hwnd, _: result.append(hwnd), None)
    return result


def class_name(hwnd: int) -> str:
    try:
        return win32gui.GetClassName(hwnd)
    except win32gui.error:
        return ""


def title(hwnd: int) -> str:
    try:
        return win32gui.GetWindowText(hwnd)
    except win32gui.error:
        return ""


def visible(hwnd: int) -> bool:
    return bool(hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd))


def enabled(hwnd: int) -> bool:
    return bool(hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowEnabled(hwnd))


def control_text(hwnd: int) -> str:
    try:
        length = int(win32gui.SendMessage(hwnd, WM_GETTEXTLENGTH, 0, 0))
        buf = win32gui.PyMakeBuffer(max(length + 2, 512) * 2)
        win32gui.SendMessage(hwnd, WM_GETTEXT, len(buf) // 2, buf)
        return bytes(buf).decode("utf-16-le", errors="ignore").split("\x00", 1)[0]
    except Exception:
        return title(hwnd)


def find_save_dialog(timeout: float = 10.0) -> int:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        candidates = [
            hwnd
            for hwnd in enum_top_windows()
            if visible(hwnd) and class_name(hwnd) == SAVE_DIALOG_CLASS
        ]

        for hwnd in candidates:
            text = title(hwnd).casefold()
            if any(hint in text for hint in SAVE_TITLE_HINTS):
                return hwnd

        if candidates:
            # Nesta etapa só esperamos o diálogo de exportação do SUPERUS.
            return candidates[0]

        time.sleep(POLL)

    return 0


def descendants_by_class(parent: int, wanted: str) -> list[int]:
    return [h for h in enum_children(parent) if class_name(h) == wanted]


def find_button_by_caption(parent: int, wanted: str) -> int:
    wanted_cf = wanted.replace("&", "").strip().casefold()

    for hwnd in descendants_by_class(parent, "Button"):
        text = control_text(hwnd).replace("&", "").strip().casefold()
        if text == wanted_cf:
            return hwnd

    return 0


def find_filename_edit(dialog: int) -> int:
    """
    Prioridade:
      1) edt1 padrão do Common Dialog (ID 0x0480 / 1152)
      2) Edit visível/habilitado mais baixo na janela, coerente com o campo Nome:
    """
    try:
        hwnd = win32gui.GetDlgItem(dialog, 0x0480)
        if hwnd and visible(hwnd) and enabled(hwnd):
            return hwnd
    except win32gui.error:
        pass

    edits = [
        hwnd
        for hwnd in descendants_by_class(dialog, "Edit")
        if visible(hwnd) and enabled(hwnd)
    ]
    if not edits:
        return 0

    # O campo "Nome:" fica na região inferior do diálogo.
    edits.sort(key=lambda h: win32gui.GetWindowRect(h)[1], reverse=True)
    return edits[0]


def set_text(hwnd: int, value: str) -> None:
    result = win32gui.SendMessage(hwnd, WM_SETTEXT, 0, value)
    if result == 0:
        print(
            f"[AVISO] WM_SETTEXT retornou 0 em HWND=0x{hwnd:X}. "
            "A confirmação definitiva será o arquivo criado."
        )


def click_save(dialog: int) -> None:
    save_btn = find_button_by_caption(dialog, "Salvar")

    if not save_btn:
        try:
            candidate = win32gui.GetDlgItem(dialog, win32con.IDOK)
            if candidate:
                save_btn = candidate
        except win32gui.error:
            pass

    if not save_btn:
        buttons = [
            h
            for h in descendants_by_class(dialog, "Button")
            if visible(h) and enabled(h)
        ]
        print("[DIAGNOSTICO] Buttons encontrados:")
        for index, hwnd in enumerate(buttons, start=1):
            print(
                f"  {index}: HWND=0x{hwnd:X} "
                f"TEXT={control_text(hwnd)!r}"
            )
        raise TestError("Botão Salvar não foi localizado.")

    print(
        f"[SAVE] Botão Salvar HWND=0x{save_btn:X} "
        f"TEXT={control_text(save_btn)!r}"
    )
    win32gui.SendMessage(save_btn, BM_CLICK, 0, 0)


def wait_dialog_gone(dialog: int, timeout: float = 10.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not visible(dialog):
            return
        time.sleep(POLL)
    raise TestError("O diálogo de salvamento não fechou.")


def wait_file_stable(
    path: Path,
    timeout: float = 30.0,
    stable_reads: int = 4,
    poll: float = 0.25,
) -> None:
    deadline = time.monotonic() + timeout
    last_size = None
    stable = 0

    while time.monotonic() < deadline:
        if path.exists():
            size = path.stat().st_size
            if size > 0:
                if size == last_size:
                    stable += 1
                else:
                    last_size = size
                    stable = 1

                if stable >= stable_reads:
                    try:
                        with path.open("rb") as handle:
                            handle.read(1)
                        print(f"[FILE] Estável size={size}")
                        return
                    except OSError:
                        pass
        time.sleep(poll)

    raise TestError(f"Arquivo não estabilizou em {timeout}s: {path}")


def read_html(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    head = raw[:4096].decode("ascii", errors="ignore")

    match = re.search(
        r"charset\s*=\s*[\"']?\s*([A-Za-z0-9._-]+)",
        head,
        flags=re.I,
    )

    candidates: list[str] = []
    if match:
        candidates.append(match.group(1))

    candidates += ["utf-8", "cp1252", "iso-8859-1", "latin-1"]

    seen: set[str] = set()
    for encoding in candidates:
        key = encoding.casefold()
        if key in seen:
            continue
        seen.add(key)
        try:
            return raw.decode(encoding), encoding
        except (LookupError, UnicodeDecodeError):
            continue

    return raw.decode("latin-1", errors="replace"), "latin-1"


def html_to_text(source: str) -> str:
    source = re.sub(
        r"<script\b.*?</script>|<style\b.*?</style>",
        " ",
        source,
        flags=re.I | re.S,
    )
    source = re.sub(r"<[^>]+>", " ", source)
    source = html_lib.unescape(source).replace("\xa0", " ")
    return " ".join(source.split())


def normalize_match(text: str) -> str:
    value = unicodedata.normalize("NFD", text)
    value = "".join(
        ch for ch in value
        if unicodedata.category(ch) != "Mn"
    )
    return " ".join(value.casefold().split())


def extract_report_period(plain_text: str) -> tuple[str | None, str | None, str | None]:
    """
    Extrai o período do relatório de forma tolerante ao HTML do SUPERUS.

    O SUPERUS pode introduzir:
    - espaços extras;
    - NBSP;
    - quebra de linha;
    - variação "Período"/"Periodo";
    - dois espaços antes/depois do "a".

    Retorna:
        (data_inicial, data_final, trecho_detectado)
    """
    normalized = normalize_match(plain_text)

    # Primeiro tentamos o formato semântico próximo da palavra "periodo".
    period_match = re.search(
        r"periodo\s*:?\s*"
        r"(\d{2}/\d{2}/\d{4})"
        r"\s*(?:a|ate|-)\s*"
        r"(\d{2}/\d{2}/\d{4})",
        normalized,
        flags=re.I,
    )
    if period_match:
        return period_match.group(1), period_match.group(2), period_match.group(0)

    # Fallback conservador:
    # procura "periodo" e lê as duas primeiras datas em uma janela curta.
    idx = normalized.find("periodo")
    if idx >= 0:
        snippet = normalized[idx: idx + 240]
        dates = re.findall(r"\d{2}/\d{2}/\d{4}", snippet)
        if len(dates) >= 2:
            return dates[0], dates[1], snippet

    return None, None, None


def validate_html(path: Path, inicio: str, fim: str) -> dict[str, object]:
    source, encoding = read_html(path)
    plain = html_to_text(source)
    normalized = normalize_match(plain)

    title_ok = "sintetico por subgrupo" in normalized

    detected_start, detected_end, detected_period_text = extract_report_period(plain)
    period_ok = detected_start == inicio and detected_end == fim

    setor_ok = "setor:" in normalized
    grupo_ok = "grupo:" in normalized
    loja_ok = (
        "loja:todas" in normalized
        or "loja: todas" in normalized
    )

    result = {
        "encoding": encoding,
        "title_ok": title_ok,
        "period_ok": period_ok,
        "expected_period": {
            "start": inicio,
            "end": fim,
        },
        "detected_period": {
            "start": detected_start,
            "end": detected_end,
        },
        "detected_period_text": detected_period_text,
        "setor_ok": setor_ok,
        "grupo_ok": grupo_ok,
        "loja_todas_ok": loja_ok,
    }

    print(f"[VALIDATE] encoding={encoding}")
    print(f"[VALIDATE] Sintético por SubGrupo={title_ok}")
    print(
        f"[VALIDATE] Período esperado={inicio} -> {fim} | "
        f"detectado={detected_start} -> {detected_end} | "
        f"PASS={period_ok}"
    )
    if detected_period_text:
        print(f"[VALIDATE] Trecho período={detected_period_text!r}")
    print(f"[VALIDATE] Setor={setor_ok}")
    print(f"[VALIDATE] Grupo={grupo_ok}")
    print(f"[VALIDATE] Loja:Todas={loja_ok} (informativo)")

    if not title_ok:
        raise TestError("HTM inválido: título 'Sintético por SubGrupo' não encontrado.")

    if not period_ok:
        raise TestError(
            "HTM inválido: período diferente do solicitado. "
            f"Esperado={inicio}->{fim}; "
            f"detectado={detected_start}->{detected_end}; "
            f"trecho={detected_period_text!r}"
        )

    if not setor_ok or not grupo_ok:
        raise TestError(
            "HTM inválido: hierarquia Setor/Grupo não foi encontrada."
        )

    return result


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_output(explicit: str | None) -> Path:
    if explicit:
        output = Path(explicit).resolve()
    else:
        stamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        folder = (
            Path(__file__).resolve().parent
            / "data"
            / "test_runs"
            / stamp
        )
        output = folder / "sales_subgrupo_03092026_03092026.htm"

    output.parent.mkdir(parents=True, exist_ok=True)

    if output.exists():
        raise TestError(
            f"Fresh collection: o arquivo já existe e não será sobrescrito: {output}"
        )

    return output


def run(args: argparse.Namespace) -> int:
    focus_before = win32gui.GetForegroundWindow()
    cursor_before = win32gui.GetCursorPos()

    output = build_output(args.saida)

    print("=" * 76)
    print("SUPERUS - TESTE SALVAR HTM JÁ ABERTO")
    print("=" * 76)
    print(f"Destino: {output}")

    dialog = find_save_dialog(timeout=args.timeout)
    if not dialog:
        raise TestError(
            "Diálogo #32770 'Salva o relatório' não encontrado."
        )

    print(
        f"[DIALOG] HWND=0x{dialog:X} "
        f"TITLE={title(dialog)!r}"
    )

    filename_edit = find_filename_edit(dialog)
    if not filename_edit:
        print("[DIAGNOSTICO] Edit controls:")
        for index, hwnd in enumerate(
            descendants_by_class(dialog, "Edit"),
            start=1,
        ):
            print(
                f"  {index}: HWND=0x{hwnd:X} "
                f"visible={visible(hwnd)} "
                f"enabled={enabled(hwnd)} "
                f"text={control_text(hwnd)!r}"
            )
        raise TestError("Campo Nome do arquivo não foi localizado.")

    print(
        f"[SAVE] Campo Nome HWND=0x{filename_edit:X} "
        f"class={class_name(filename_edit)!r}"
    )

    set_text(filename_edit, str(output))
    time.sleep(0.2)

    print(
        f"[SAVE] Read-back Nome={control_text(filename_edit)!r}"
    )

    click_save(dialog)
    wait_dialog_gone(dialog, timeout=10)

    wait_file_stable(
        output,
        timeout=args.file_timeout,
    )

    validation = validate_html(
        output,
        inicio=args.inicio,
        fim=args.fim,
    )

    digest = sha256_file(output)

    focus_after = win32gui.GetForegroundWindow()
    cursor_after = win32gui.GetCursorPos()

    print("\n" + "=" * 76)
    print("RESULTADO: PASS")
    print("=" * 76)
    print(f"FILE: {output}")
    print(f"SIZE: {output.stat().st_size}")
    print(f"SHA256: {digest}")
    print(f"VALIDATION: {validation}")
    print("\n[BACKGROUND]")
    print("physical_mouse_moves=0")
    print("global_keyboard_uses=0")
    print("foreground_api_calls=0")
    print(f"foreground_before=0x{focus_before:X}")
    print(f"foreground_after=0x{focus_after:X}")
    print(f"focus_changed_observed={focus_before != focus_after}")
    print(f"cursor_before={cursor_before}")
    print(f"cursor_after={cursor_after}")
    print(f"cursor_changed_observed={cursor_before != cursor_after}")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inicio", default="03/09/2026")
    parser.add_argument("--fim", default="03/09/2026")
    parser.add_argument("--saida")
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--file-timeout", type=float, default=30.0)
    args = parser.parse_args()

    try:
        return run(args)
    except Exception as exc:
        print("\n" + "=" * 76)
        print("RESULTADO: FAIL")
        print("=" * 76)
        print(f"{type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
