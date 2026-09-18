from __future__ import annotations

import argparse
import time

import win32gui

PREVIEW_CLASS = "TFormPreview"
SAVE_DIALOG_CLASS = "#32770"

WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
MK_LBUTTON = 0x0001

# TPanel INSTANCE 1 no Preview.
# Coordenadas locais baseadas no toolbar real:
# TXT ~ 382
# XLS = 409 (comprovado)
# HTM ~ 437
# PDF ~ 465
DEFAULT_HTM_X = 437
DEFAULT_HTM_Y = 16


def enum_top_windows() -> list[int]:
    items: list[int] = []
    win32gui.EnumWindows(lambda hwnd, _: items.append(hwnd), None)
    return items


def enum_children(parent: int) -> list[int]:
    items: list[int] = []
    win32gui.EnumChildWindows(parent, lambda hwnd, _: items.append(hwnd), None)
    return items


def class_name(hwnd: int) -> str:
    try:
        return win32gui.GetClassName(hwnd)
    except win32gui.error:
        return ""


def visible(hwnd: int) -> bool:
    return bool(hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd))


def find_top_by_class(wanted: str) -> int:
    for hwnd in enum_top_windows():
        if visible(hwnd) and class_name(hwnd) == wanted:
            return hwnd
    return 0


def children_by_class(parent: int, wanted: str) -> list[int]:
    return [h for h in enum_children(parent) if class_name(h) == wanted]


def by_instance(parent: int, wanted: str, instance: int) -> int:
    items = children_by_class(parent, wanted)
    if 1 <= instance <= len(items):
        return items[instance - 1]
    return 0


def local_click(hwnd: int, x: int, y: int) -> None:
    left, top, right, bottom = win32gui.GetClientRect(hwnd)
    width, height = right - left, bottom - top

    if not (0 <= x < width and 0 <= y < height):
        raise RuntimeError(
            f"Coordenada ({x},{y}) fora do controle {width}x{height}"
        )

    lparam = ((y & 0xFFFF) << 16) | (x & 0xFFFF)
    win32gui.PostMessage(hwnd, WM_LBUTTONDOWN, MK_LBUTTON, lparam)
    win32gui.PostMessage(hwnd, WM_LBUTTONUP, 0, lparam)


def wait_new_dialog(existing: set[int], timeout: float = 10.0) -> int:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        for hwnd in enum_top_windows():
            if (
                hwnd not in existing
                and visible(hwnd)
                and class_name(hwnd) == SAVE_DIALOG_CLASS
            ):
                return hwnd
        time.sleep(0.1)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--x", type=int, default=DEFAULT_HTM_X)
    parser.add_argument("--y", type=int, default=DEFAULT_HTM_Y)
    parser.add_argument("--timeout", type=float, default=10.0)
    args = parser.parse_args()

    preview = find_top_by_class(PREVIEW_CLASS)
    if not preview:
        print("FAIL: TFormPreview nao encontrado.")
        return 1

    panel = by_instance(preview, "TPanel", 1)
    if not panel:
        print("FAIL: TPanel INSTANCE 1 nao encontrado.")
        return 1

    print(f"TFormPreview HWND=0x{preview:X}")
    print(f"TPanel INSTANCE 1 HWND=0x{panel:X}")
    print(f"Testando HTM em coordenada LOCAL x={args.x}, y={args.y}")
    print("Nenhum cursor fisico sera movido.")

    dialogs_before = {
        hwnd
        for hwnd in enum_top_windows()
        if visible(hwnd) and class_name(hwnd) == SAVE_DIALOG_CLASS
    }

    local_click(panel, args.x, args.y)

    dialog = wait_new_dialog(dialogs_before, timeout=args.timeout)
    if not dialog:
        print(
            "FAIL: Salvar Como nao abriu. "
            "Ajuste apenas --x (ex.: 436, 437, 438, 439)."
        )
        return 1

    print(
        f"PASS: Salvar Como abriu HWND=0x{dialog:X} "
        f"TITLE={win32gui.GetWindowText(dialog)!r}"
    )
    print("O botao HTM foi localizado pela coordenada local do TPanel.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
