from __future__ import annotations

import argparse
import time
import unicodedata

import win32con
import win32gui

MENU_CLASS = "TFormMenuPrincipal"
VENDAS_CLASS = "TFormVendas"
STOCK_CLASS = "TFormRelEstMin_ProdEstrategico"

POLL = 0.10


class TestError(RuntimeError):
    pass


def normalize(text: str) -> str:
    value = (text or "").replace("&", "").strip().lower()
    return "".join(
        ch for ch in unicodedata.normalize("NFD", value)
        if unicodedata.category(ch) != "Mn"
    )


def enum_top_windows() -> list[int]:
    result: list[int] = []
    win32gui.EnumWindows(lambda hwnd, _: result.append(hwnd), None)
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


def find_top_by_class(wanted: str) -> int:
    for hwnd in enum_top_windows():
        if visible(hwnd) and class_name(hwnd) == wanted:
            return hwnd
    return 0


def child_windows(parent: int) -> list[int]:
    result: list[int] = []
    win32gui.EnumChildWindows(parent, lambda hwnd, _: result.append(hwnd), None)
    return result


def controls_by_class(parent: int, wanted: str) -> list[int]:
    return [hwnd for hwnd in child_windows(parent) if class_name(hwnd) == wanted]


def wait_window_by_class(wanted: str, timeout: float) -> int:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        hwnd = find_top_by_class(wanted)
        if hwnd:
            return hwnd
        time.sleep(POLL)
    return 0


def cancel_stock_if_present() -> bool:
    hwnd = find_top_by_class(STOCK_CLASS)
    if not hwnd:
        return False

    buttons = controls_by_class(hwnd, "TBitBtn")
    if not buttons:
        raise TestError("Popup de estoque encontrado sem TBitBtn.")

    # Fluxo comprovado anteriormente: INSTANCE 1
    button = buttons[0]
    win32gui.PostMessage(button, win32con.BM_CLICK, 0, 0)

    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if not visible(hwnd):
            print("[STOCK] Popup fechado.")
            return True
        time.sleep(POLL)

    raise TestError("Popup de estoque nao fechou.")


def menu_label(menu: int, index: int) -> str:
    try:
        return win32gui.GetMenuString(menu, index, win32con.MF_BYPOSITION)
    except Exception:
        # Fallback compatível entre builds de pywin32.
        import ctypes
        buf = ctypes.create_unicode_buffer(512)
        ctypes.windll.user32.GetMenuStringW(
            menu,
            index,
            buf,
            len(buf),
            win32con.MF_BYPOSITION,
        )
        return buf.value


def print_menu_tree(menu: int, indent: int = 0, path: tuple[str, ...] = ()) -> None:
    count = win32gui.GetMenuItemCount(menu)
    for index in range(count):
        label = menu_label(menu, index)
        submenu = win32gui.GetSubMenu(menu, index)
        command = win32gui.GetMenuItemID(menu, index)
        current_path = path + (label,)
        print(
            "  " * indent
            + f"- {label!r} index={index} command_id={command} submenu={bool(submenu)}"
        )
        if submenu:
            print_menu_tree(submenu, indent + 1, current_path)


def find_menu_command(menu: int, labels: list[str]) -> int:
    if not labels:
        return -1

    wanted = normalize(labels[0])
    count = win32gui.GetMenuItemCount(menu)

    for index in range(count):
        label = menu_label(menu, index)
        if normalize(label) != wanted:
            continue

        submenu = win32gui.GetSubMenu(menu, index)

        if len(labels) == 1:
            command = win32gui.GetMenuItemID(menu, index)
            return int(command)

        if submenu:
            return find_menu_command(submenu, labels[1:])

    return -1


def wait_menu_ready(hwnd: int, timeout: float) -> int:
    """
    O TFormMenuPrincipal pode existir antes de o menu nativo estar populado.
    Por isso nao basta encontrar a janela: aguardamos GetMenu + item count > 0
    e exigimos estabilidade por algumas leituras.
    """
    deadline = time.monotonic() + timeout
    stable = 0
    previous_count = None

    while time.monotonic() < deadline:
        cancel_stock_if_present()

        menu = win32gui.GetMenu(hwnd)
        if menu:
            count = win32gui.GetMenuItemCount(menu)
            if count > 0:
                if count == previous_count:
                    stable += 1
                else:
                    stable = 1
                    previous_count = count

                if stable >= 4:
                    return menu
            else:
                stable = 0
                previous_count = count

        time.sleep(0.25)

    return 0


def run(timeout: float) -> int:
    initial_focus = win32gui.GetForegroundWindow()
    initial_cursor = win32gui.GetCursorPos()

    print("=" * 72)
    print("TESTE SUPERUS: TFormMenuPrincipal -> Vendas > Vendas -> TFormVendas")
    print("=" * 72)
    print(f"Foreground inicial: 0x{initial_focus:X}")
    print(f"Cursor inicial: {initial_cursor}")

    menu_hwnd = wait_window_by_class(MENU_CLASS, timeout=timeout)
    if not menu_hwnd:
        raise TestError(f"{MENU_CLASS} nao encontrado.")

    print(
        f"[MENU] HWND=0x{menu_hwnd:X} "
        f"TITLE={title(menu_hwnd)!r}"
    )

    native_menu = wait_menu_ready(menu_hwnd, timeout=timeout)
    if not native_menu:
        raw_menu = win32gui.GetMenu(menu_hwnd)
        raw_count = win32gui.GetMenuItemCount(raw_menu) if raw_menu else -1
        raise TestError(
            "Menu nativo nao ficou pronto. "
            f"GetMenu={raw_menu!r} item_count={raw_count}"
        )

    count = win32gui.GetMenuItemCount(native_menu)
    print(f"[MENU] GetMenu PASS handle={native_menu} item_count={count}")

    print("\n[MENU TREE]")
    print_menu_tree(native_menu)

    command = find_menu_command(native_menu, ["Vendas", "Vendas"])
    if command < 0:
        command = find_menu_command(native_menu, ["&Vendas", "Vendas"])

    if command < 0:
        raise TestError("Comando Vendas > Vendas nao localizado.")

    print(f"\n[NAV] Vendas > Vendas command_id={command}")
    print("[NAV] Enviando WM_COMMAND diretamente ao TFormMenuPrincipal...")

    # Exatamente a estrategia comprovada no backend antigo.
    win32gui.PostMessage(menu_hwnd, win32con.WM_COMMAND, command, 0)

    vendas = wait_window_by_class(VENDAS_CLASS, timeout=30)
    if not vendas:
        raise TestError("TFormVendas nao abriu em 30s.")

    print(
        f"[PASS] TFormVendas HWND=0x{vendas:X} "
        f"TITLE={title(vendas)!r}"
    )

    final_focus = win32gui.GetForegroundWindow()
    final_cursor = win32gui.GetCursorPos()

    print("\n[BACKGROUND AUDIT]")
    print(f"Foreground final: 0x{final_focus:X}")
    print(f"Cursor final: {final_cursor}")
    print(f"focus_changed={initial_focus != final_focus}")
    print(f"cursor_changed={initial_cursor != final_cursor}")
    print("physical_mouse_moves=0")
    print("global_keyboard_uses=0")
    print("foreground_api_calls=0")

    print("\nRESULTADO: PASS")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=float, default=60.0)
    args = parser.parse_args()

    try:
        return run(args.timeout)
    except Exception as exc:
        print("\nRESULTADO: FAIL")
        print(f"{type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
