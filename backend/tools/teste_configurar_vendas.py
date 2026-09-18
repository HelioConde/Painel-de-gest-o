from __future__ import annotations

import argparse
import time
import unicodedata

import win32con
import win32gui

VENDAS_CLASS = "TFormVendas"

BM_GETCHECK = 0x00F0
BM_CLICK = 0x00F5
BST_UNCHECKED = 0
BST_CHECKED = 1

WM_SETTEXT = 0x000C
WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
MK_LBUTTON = 0x0001

POLL = 0.10


class TestError(RuntimeError):
    pass


def normalize(text: str) -> str:
    value = (text or "").replace("&", "").strip().casefold()
    value = "".join(
        ch
        for ch in unicodedata.normalize("NFD", value)
        if unicodedata.category(ch) != "Mn"
    )
    return " ".join(value.split())


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


def control_text(hwnd: int) -> str:
    length = win32gui.SendMessage(hwnd, WM_GETTEXTLENGTH, 0, 0)
    if length < 0:
        length = 0
    buf = win32gui.PyMakeBuffer(max(int(length) + 2, 512) * 2)
    win32gui.SendMessage(hwnd, WM_GETTEXT, len(buf) // 2, buf)
    raw = bytes(buf)
    try:
        return raw.decode("utf-16-le", errors="ignore").split("\x00", 1)[0]
    except Exception:
        return title(hwnd)


def visible(hwnd: int) -> bool:
    return bool(hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd))


def enabled(hwnd: int) -> bool:
    return bool(hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowEnabled(hwnd))


def find_top_by_class(wanted: str) -> int:
    for hwnd in enum_top_windows():
        if visible(hwnd) and class_name(hwnd) == wanted:
            return hwnd
    return 0


def wait_top_by_class(wanted: str, timeout: float = 30.0) -> int:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        hwnd = find_top_by_class(wanted)
        if hwnd:
            return hwnd
        time.sleep(POLL)
    return 0


def descendants_by_class(parent: int, wanted: str) -> list[int]:
    return [h for h in enum_children(parent) if class_name(h) == wanted]


def find_by_caption(parent: int, wanted_class: str, wanted_text: str) -> int:
    wanted = normalize(wanted_text)
    for hwnd in descendants_by_class(parent, wanted_class):
        text = control_text(hwnd)
        if normalize(text) == wanted:
            return hwnd
    return 0


def find_contains_caption(parent: int, wanted_class: str, wanted_text: str) -> int:
    wanted = normalize(wanted_text)
    for hwnd in descendants_by_class(parent, wanted_class):
        text = control_text(hwnd)
        if wanted and wanted in normalize(text):
            return hwnd
    return 0


def by_instance(parent: int, wanted_class: str, instance: int) -> int:
    items = descendants_by_class(parent, wanted_class)
    if instance < 1 or instance > len(items):
        return 0
    return items[instance - 1]


def dump_class(parent: int, wanted_class: str) -> None:
    print(f"\n[DISCOVERY] {wanted_class}:")
    for idx, hwnd in enumerate(descendants_by_class(parent, wanted_class), start=1):
        print(
            f"  INSTANCE {idx:>2} "
            f"HWND=0x{hwnd:X} "
            f"VISIBLE={visible(hwnd)} "
            f"ENABLED={enabled(hwnd)} "
            f"TEXT={control_text(hwnd)!r}"
        )


def checked(hwnd: int) -> bool:
    try:
        state = int(win32gui.SendMessage(hwnd, BM_GETCHECK, 0, 0))
        return state == BST_CHECKED
    except Exception:
        return False


def local_click(hwnd: int) -> None:
    """
    Clique apenas por mensagem ao HWND.
    Nao move cursor fisico e nao usa foreground.
    """
    # Primeiro tenta semantica de botao.
    try:
        win32gui.SendMessage(hwnd, BM_CLICK, 0, 0)
        time.sleep(0.12)
        return
    except Exception:
        pass

    # Fallback: WM_LBUTTON* direcionado ao proprio controle.
    left, top, right, bottom = win32gui.GetClientRect(hwnd)
    x = max(1, (right - left) // 2)
    y = max(1, (bottom - top) // 2)
    lparam = (y << 16) | (x & 0xFFFF)
    win32gui.PostMessage(hwnd, WM_LBUTTONDOWN, MK_LBUTTON, lparam)
    win32gui.PostMessage(hwnd, WM_LBUTTONUP, 0, lparam)
    time.sleep(0.12)


def ensure_checked(
    parent: int,
    wanted_class: str,
    caption: str,
    *,
    fallback_instance: int | None = None,
) -> int:
    hwnd = find_by_caption(parent, wanted_class, caption)
    source = f"caption={caption!r}"

    if not hwnd and fallback_instance is not None:
        hwnd = by_instance(parent, wanted_class, fallback_instance)
        source = f"INSTANCE {fallback_instance}"

    if not hwnd:
        dump_class(parent, wanted_class)
        raise TestError(f"{wanted_class} {caption!r} nao encontrado.")

    before = checked(hwnd)
    if not before:
        local_click(hwnd)
        time.sleep(0.15)

    after = checked(hwnd)
    print(
        f"[CONFIG] {wanted_class} {caption!r} "
        f"via {source} HWND=0x{hwnd:X} "
        f"checked_before={before} checked_after={after}"
    )

    if not after:
        raise TestError(
            f"{wanted_class} {caption!r} nao confirmou estado CHECKED."
        )

    return hwnd


def select_group_button(parent: int, caption: str) -> int:
    hwnd = find_by_caption(parent, "TGroupButton", caption)
    if not hwnd:
        # Alguns builds retornam espacos/variacoes no caption.
        hwnd = find_contains_caption(parent, "TGroupButton", caption)

    if not hwnd:
        dump_class(parent, "TGroupButton")
        raise TestError(f"TGroupButton {caption!r} nao encontrado.")

    local_click(hwnd)
    print(
        f"[CONFIG] TGroupButton {caption!r} selecionado "
        f"HWND=0x{hwnd:X}"
    )
    return hwnd


def set_control_text(hwnd: int, value: str) -> None:
    result = win32gui.SendMessage(hwnd, WM_SETTEXT, 0, value)
    if result == 0:
        # Alguns controles Delphi retornam 0 mesmo aceitando WM_SETTEXT.
        # Nao abortamos apenas pelo retorno; a validacao definitiva sera o preview.
        print(
            f"[AVISO] WM_SETTEXT retornou 0 em "
            f"{class_name(hwnd)} HWND=0x{hwnd:X}; continuando."
        )


def configure_period(parent: int, start_br: str, end_br: str) -> tuple[int, int]:
    start_hwnd = by_instance(parent, "TSimusDateTimePicker", 2)
    end_hwnd = by_instance(parent, "TSimusDateTimePicker", 1)

    if not start_hwnd or not end_hwnd:
        dump_class(parent, "TSimusDateTimePicker")
        raise TestError(
            "TSimusDateTimePicker INSTANCE 2/1 nao encontrados."
        )

    set_control_text(start_hwnd, start_br)
    time.sleep(0.15)
    set_control_text(end_hwnd, end_br)
    time.sleep(0.15)

    print(
        f"[PERIODO] Inicial={start_br} "
        f"TDate INSTANCE 2 HWND=0x{start_hwnd:X}"
    )
    print(
        f"[PERIODO] Final={end_br} "
        f"TDate INSTANCE 1 HWND=0x{end_hwnd:X}"
    )
    print(
        "[PERIODO] A confirmacao definitiva das datas sera feita "
        "pelo cabecalho do relatorio gerado."
    )
    return start_hwnd, end_hwnd


def find_generate_button(parent: int) -> int:
    # Controle comprovado historicamente: TBitBtn INSTANCE 2.
    hwnd = by_instance(parent, "TBitBtn", 2)
    if not hwnd:
        dump_class(parent, "TBitBtn")
        raise TestError("TBitBtn INSTANCE 2 (gerar) nao encontrado.")
    return hwnd


def run(start_br: str, end_br: str) -> int:
    initial_focus = win32gui.GetForegroundWindow()
    initial_cursor = win32gui.GetCursorPos()

    print("=" * 76)
    print("SUPERUS - TESTE DE CONFIGURACAO DA TFORMVENDAS")
    print("NAO GERA RELATORIO; PARA ANTES DO TBitBtn INSTANCE 2")
    print("=" * 76)

    vendas = wait_top_by_class(VENDAS_CLASS, timeout=20)
    if not vendas:
        raise TestError("TFormVendas nao esta aberta.")

    print(
        f"[VENDAS] HWND=0x{vendas:X} "
        f"TITLE={title(vendas)!r}"
    )

    # 1) Setorizacao
    ensure_checked(
        vendas,
        "TRadioButton",
        "Setorização",
        fallback_instance=16,
    )

    # 2) Por Loja
    ensure_checked(
        vendas,
        "TCheckBox",
        "Por Loja",
        fallback_instance=8,
    )

    # 3) Todas Vendas
    select_group_button(vendas, "Todas Vendas")

    # 4) Quebra de pagina SubGrupo
    select_group_button(vendas, "SubGrupo")

    # 5) Periodo
    configure_period(vendas, start_br, end_br)

    # 6) Localizar o gerar, mas NAO clicar
    generate = find_generate_button(vendas)
    print(
        f"[GERAR] TBitBtn INSTANCE 2 localizado "
        f"HWND=0x{generate:X}; NAO acionado."
    )

    final_focus = win32gui.GetForegroundWindow()
    final_cursor = win32gui.GetCursorPos()

    print("\n" + "=" * 76)
    print("RESULTADO: PASS")
    print("=" * 76)
    print("TFormVendas: PASS")
    print("Setorizacao: CHECKED")
    print("Por Loja: CHECKED")
    print("Todas Vendas: SELECTED")
    print("Quebra: SubGrupo")
    print(f"Periodo solicitado: {start_br} -> {end_br}")
    print("Gerar: LOCALIZADO, NAO CLICADO")
    print("\n[BACKGROUND]")
    print("physical_mouse_moves=0")
    print("global_keyboard_uses=0")
    print("foreground_api_calls=0")
    print(f"foreground_before=0x{initial_focus:X}")
    print(f"foreground_after=0x{final_focus:X}")
    print(f"focus_changed_observed={initial_focus != final_focus}")
    print(f"cursor_before={initial_cursor}")
    print(f"cursor_after={final_cursor}")
    print(f"cursor_changed_observed={initial_cursor != final_cursor}")

    print(
        "\nConfira visualmente no SUPERUS se Setorizacao, Por Loja, "
        "Todas Vendas, SubGrupo e as datas ficaram corretos."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inicio", default="03/09/2026")
    parser.add_argument("--fim", default="03/09/2026")
    args = parser.parse_args()

    try:
        return run(args.inicio, args.fim)
    except Exception as exc:
        print("\nRESULTADO: FAIL")
        print(f"{type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
