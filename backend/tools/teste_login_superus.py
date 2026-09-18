from __future__ import annotations

import argparse
import ctypes
import getpass
import os
import subprocess
import sys
import time
from ctypes import wintypes

if os.name != "nt":
    raise SystemExit("Este teste deve ser executado no Windows.")

# ============================================================
# CONFIGURACAO
# ============================================================

DEFAULT_LAUNCHER = r"C:\Superus\Launcher.exe"

LOGIN_CLASS = "TFormLogonUsuario"
LOGIN_TITLE_PART = "Logon de Usuário"

MENU_CLASS = "TFormMenuPrincipal"

STOCK_CLASS = "TFormRelEstMin_ProdEstrategico"
STOCK_TITLE_PART = "Estoque Mínimo de Produtos Estratégicos"

# Confirmado pelo Spy++ / AutoIt:
# TEdit INSTANCE 1 = senha
# TEdit INSTANCE 2 = usuario
USER_EDIT_INSTANCE = 2
PASSWORD_EDIT_INSTANCE = 1

# Preferimos caption "&OK"; INSTANCE 2 fica como fallback conhecido.
OK_BUTTON_INSTANCE = 2

# Popup de estoque minimo: TBitBtn INSTANCE 1
STOCK_CANCEL_INSTANCE = 1

# ============================================================
# WIN32
# ============================================================

user32 = ctypes.WinDLL("user32", use_last_error=True)

WNDENUMPROC = ctypes.WINFUNCTYPE(
    wintypes.BOOL,
    wintypes.HWND,
    wintypes.LPARAM,
)

EnumWindows = user32.EnumWindows
EnumWindows.argtypes = [WNDENUMPROC, wintypes.LPARAM]
EnumWindows.restype = wintypes.BOOL

EnumChildWindows = user32.EnumChildWindows
EnumChildWindows.argtypes = [wintypes.HWND, WNDENUMPROC, wintypes.LPARAM]
EnumChildWindows.restype = wintypes.BOOL

GetClassNameW = user32.GetClassNameW
GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
GetClassNameW.restype = ctypes.c_int

GetWindowTextLengthW = user32.GetWindowTextLengthW
GetWindowTextLengthW.argtypes = [wintypes.HWND]
GetWindowTextLengthW.restype = ctypes.c_int

GetWindowTextW = user32.GetWindowTextW
GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
GetWindowTextW.restype = ctypes.c_int

IsWindow = user32.IsWindow
IsWindow.argtypes = [wintypes.HWND]
IsWindow.restype = wintypes.BOOL

IsWindowVisible = user32.IsWindowVisible
IsWindowVisible.argtypes = [wintypes.HWND]
IsWindowVisible.restype = wintypes.BOOL

IsWindowEnabled = user32.IsWindowEnabled
IsWindowEnabled.argtypes = [wintypes.HWND]
IsWindowEnabled.restype = wintypes.BOOL

SendMessageW = user32.SendMessageW
SendMessageW.argtypes = [
    wintypes.HWND,
    wintypes.UINT,
    wintypes.WPARAM,
    wintypes.LPARAM,
]
LRESULT = ctypes.c_ssize_t
SendMessageW.restype = LRESULT

GetWindowThreadProcessId = user32.GetWindowThreadProcessId
GetWindowThreadProcessId.argtypes = [
    wintypes.HWND,
    ctypes.POINTER(wintypes.DWORD),
]
GetWindowThreadProcessId.restype = wintypes.DWORD

WM_SETTEXT = 0x000C
WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E
BM_CLICK = 0x00F5


def hwnd_hex(hwnd: int) -> str:
    return f"0x{int(hwnd):08X}" if hwnd else "0x00000000"


def get_pid(hwnd: int) -> int:
    pid = wintypes.DWORD()
    GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return int(pid.value)


def get_class_name(hwnd: int) -> str:
    buf = ctypes.create_unicode_buffer(256)
    n = GetClassNameW(hwnd, buf, len(buf))
    return buf.value[:n] if n else ""


def get_window_text(hwnd: int) -> str:
    length = GetWindowTextLengthW(hwnd)
    buf = ctypes.create_unicode_buffer(max(length + 1, 512))
    GetWindowTextW(hwnd, buf, len(buf))
    return buf.value


def get_control_text(hwnd: int) -> str:
    """
    Para controles filhos de outro processo, usa WM_GETTEXT.
    Isso e mais confiavel que GetWindowTextW para TEdit/TBitBtn do SUPERUS.
    """
    length = int(SendMessageW(hwnd, WM_GETTEXTLENGTH, 0, 0))
    size = max(length + 1, 512)
    buf = ctypes.create_unicode_buffer(size)
    SendMessageW(
        hwnd,
        WM_GETTEXT,
        size,
        ctypes.cast(buf, ctypes.c_void_p).value,
    )
    return buf.value


def enum_top_windows() -> list[int]:
    result: list[int] = []

    @WNDENUMPROC
    def callback(hwnd, _lparam):
        result.append(int(hwnd))
        return True

    if not EnumWindows(callback, 0):
        err = ctypes.get_last_error()
        if err:
            raise ctypes.WinError(err)

    return result


def enum_children(parent: int) -> list[int]:
    result: list[int] = []

    @WNDENUMPROC
    def callback(hwnd, _lparam):
        result.append(int(hwnd))
        return True

    if not EnumChildWindows(parent, callback, 0):
        err = ctypes.get_last_error()
        if err:
            raise ctypes.WinError(err)

    return result


def find_top_window(
    *,
    cls: str | None = None,
    title_contains: str | None = None,
) -> int:
    title_cf = title_contains.casefold() if title_contains else None

    for hwnd in enum_top_windows():
        if not IsWindowVisible(hwnd):
            continue

        if cls and get_class_name(hwnd) != cls:
            continue

        if title_cf:
            title = get_window_text(hwnd)
            if title_cf not in title.casefold():
                continue

        return hwnd

    return 0


def wait_top_window(
    *,
    cls: str | None = None,
    title_contains: str | None = None,
    timeout: float = 60.0,
) -> int:
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        hwnd = find_top_window(cls=cls, title_contains=title_contains)
        if hwnd:
            return hwnd
        time.sleep(0.1)

    return 0


def controls_by_class(parent: int, class_name: str) -> list[int]:
    return [
        hwnd
        for hwnd in enum_children(parent)
        if get_class_name(hwnd) == class_name
    ]


def control_by_instance(parent: int, class_name: str, instance: int) -> int:
    """
    INSTANCE no estilo AutoIt: 1-based entre controles da mesma classe.

    No formulario atual:
      TEdit #1 = password
      TEdit #2 = usuario
    """
    controls = controls_by_class(parent, class_name)
    if instance < 1 or instance > len(controls):
        return 0
    return controls[instance - 1]


def find_child_by_caption(parent: int, class_name: str, wanted: str) -> int:
    wanted_norm = wanted.replace("&", "").strip().casefold()

    for hwnd in controls_by_class(parent, class_name):
        text = get_control_text(hwnd)
        norm = text.replace("&", "").strip().casefold()
        if norm == wanted_norm:
            return hwnd

    return 0


def set_text(hwnd: int, value: str) -> bool:
    buf = ctypes.create_unicode_buffer(value)
    result = SendMessageW(
        hwnd,
        WM_SETTEXT,
        0,
        ctypes.cast(buf, ctypes.c_void_p).value,
    )
    return bool(result)


def click(hwnd: int) -> None:
    SendMessageW(hwnd, BM_CLICK, 0, 0)


def wait_gone(hwnd: int, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not IsWindow(hwnd) or not IsWindowVisible(hwnd):
            return True
        time.sleep(0.1)
    return False


def print_window(label: str, hwnd: int) -> None:
    if not hwnd:
        print(f"{label}: NOT_FOUND")
        return
    print(
        f"{label}: "
        f"HWND={hwnd_hex(hwnd)} "
        f"PID={get_pid(hwnd)} "
        f"CLASS={get_class_name(hwnd)!r} "
        f"TITLE={get_window_text(hwnd)!r}"
    )


def dump_login_controls(login_hwnd: int) -> None:
    print("\n[DISCOVERY] Controles descendentes do login:")
    counts: dict[str, int] = {}

    for hwnd in enum_children(login_hwnd):
        cls = get_class_name(hwnd)
        counts[cls] = counts.get(cls, 0) + 1
        instance = counts[cls]

        try:
            text = get_control_text(hwnd)
        except Exception:
            text = ""

        if "senha" in text.casefold():
            safe_text = "<redacted>"
        else:
            safe_text = text

        print(
            f"  {cls} INSTANCE {instance:<2} "
            f"HWND={hwnd_hex(hwnd)} "
            f"VISIBLE={bool(IsWindowVisible(hwnd))} "
            f"ENABLED={bool(IsWindowEnabled(hwnd))} "
            f"TEXT={safe_text!r}"
        )


# ============================================================
# SUPERUS LOGIN
# ============================================================

def cancel_stock_dialog_if_present() -> bool:
    hwnd = find_top_window(cls=STOCK_CLASS)
    if not hwnd:
        hwnd = find_top_window(title_contains=STOCK_TITLE_PART)

    if not hwnd:
        return False

    print_window("[STOCK] Popup encontrado", hwnd)

    btn = find_child_by_caption(hwnd, "TBitBtn", "Cancela")
    if not btn:
        btn = control_by_instance(hwnd, "TBitBtn", STOCK_CANCEL_INSTANCE)

    if not btn:
        raise RuntimeError(
            "Popup de estoque minimo encontrado, mas botao de cancelamento nao foi localizado."
        )

    print(f"[STOCK] Fechando via HWND {hwnd_hex(btn)}")
    click(btn)

    if not wait_gone(hwnd, 10):
        raise RuntimeError("Popup de estoque minimo nao fechou.")

    print("[STOCK] Popup fechado.")
    return True


def launch_if_needed(launcher: str) -> subprocess.Popen | None:
    if find_top_window(cls=MENU_CLASS):
        print("[STARTUP] TFormMenuPrincipal ja existe.")
        return None

    if find_top_window(cls=LOGIN_CLASS):
        print("[STARTUP] TFormLogonUsuario ja existe.")
        return None

    if not os.path.isfile(launcher):
        raise FileNotFoundError(f"Launcher nao encontrado: {launcher}")

    print(f"[STARTUP] Iniciando {launcher}")

    proc = subprocess.Popen(
        [launcher],
        cwd=os.path.dirname(launcher) or None,
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )
    print(f"[STARTUP] Launcher PID={proc.pid}")
    return proc


def wait_login_or_menu(timeout: float = 60.0) -> tuple[str, int]:
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        # Pode aparecer automaticamente depois do login.
        cancel_stock_dialog_if_present()

        menu = find_top_window(cls=MENU_CLASS)
        if menu:
            return "menu", menu

        login = find_top_window(cls=LOGIN_CLASS)
        if login:
            return "login", login

        # Fallback apenas de descoberta.
        login = find_top_window(title_contains=LOGIN_TITLE_PART)
        if login:
            return "login", login

        time.sleep(0.1)

    return "timeout", 0


def login_superus(login_hwnd: int, username: str, password: str) -> int:
    print_window("[LOGIN] Janela confirmada", login_hwnd)
    dump_login_controls(login_hwnd)

    user_edit = control_by_instance(
        login_hwnd, "TEdit", USER_EDIT_INSTANCE
    )
    pass_edit = control_by_instance(
        login_hwnd, "TEdit", PASSWORD_EDIT_INSTANCE
    )

    # Melhor estrategia para o OK:
    # 1) caption real vista no Spy++: "&OK"
    # 2) fallback INSTANCE 2
    ok_button = find_child_by_caption(login_hwnd, "TBitBtn", "OK")
    if not ok_button:
        ok_button = control_by_instance(
            login_hwnd, "TBitBtn", OK_BUTTON_INSTANCE
        )

    if not user_edit:
        raise RuntimeError("TEdit INSTANCE 2 (usuario) nao encontrado.")
    if not pass_edit:
        raise RuntimeError("TEdit INSTANCE 1 (senha) nao encontrado.")
    if not ok_button:
        raise RuntimeError("TBitBtn '&OK' / INSTANCE 2 nao encontrado.")

    print(
        f"\n[LOGIN] USER  = TEdit INSTANCE 2 "
        f"HWND={hwnd_hex(user_edit)}"
    )
    print(
        f"[LOGIN] PASS  = TEdit INSTANCE 1 "
        f"HWND={hwnd_hex(pass_edit)}"
    )
    print(
        f"[LOGIN] OK    = TBitBtn caption={get_control_text(ok_button)!r} "
        f"HWND={hwnd_hex(ok_button)}"
    )

    # Usuario: escreve e faz apenas diagnostico de readback.
    if not set_text(user_edit, username):
        raise RuntimeError("WM_SETTEXT retornou falha no campo Usuario.")

    read_user = get_control_text(user_edit)
    print(f"[LOGIN] Usuario apos WM_SETTEXT: {read_user!r}")

    # Nao abortar se readback divergir: validacao final e o menu principal.
    if read_user != username:
        print(
            "[AVISO] Readback do usuario divergiu, mas o teste continuara. "
            "A validacao definitiva sera a abertura do TFormMenuPrincipal."
        )

    # Senha: escreve sem nunca reler ou imprimir.
    if not set_text(pass_edit, password):
        raise RuntimeError("WM_SETTEXT retornou falha no campo Senha.")

    print("[LOGIN] Senha enviada ao TEdit INSTANCE 1 (conteudo nao lido/logado).")
    print("[LOGIN] Acionando &OK por BM_CLICK...")
    click(ok_button)

    # Espera menu e trata popup conhecido.
    deadline = time.monotonic() + 60

    while time.monotonic() < deadline:
        cancel_stock_dialog_if_present()

        menu = find_top_window(cls=MENU_CLASS)
        if menu:
            return menu

        time.sleep(0.1)

    if IsWindow(login_hwnd) and IsWindowVisible(login_hwnd):
        raise RuntimeError(
            "A tela TFormLogonUsuario continua aberta. "
            "Verifique usuario/senha ou alguma mensagem apresentada pelo SUPERUS."
        )

    raise RuntimeError(
        "O login desapareceu, mas TFormMenuPrincipal nao apareceu em 60s."
    )


def run(args: argparse.Namespace) -> int:
    print("=" * 72)
    print("SUPERUS - TESTE DE LOGIN HWND / BACKGROUND")
    print("=" * 72)
    print(f"Launcher: {args.launcher}")
    print(f"Login class: {LOGIN_CLASS}")
    print(f"Usuario: {args.user}")
    print("Senha: <redacted>")
    print()
    print("Este script NAO usa:")
    print("  - pyautogui")
    print("  - mouse fisico")
    print("  - teclado global")
    print("  - SetForegroundWindow")
    print("  - SetFocus")
    print("  - BringWindowToTop")
    print()

    launch_if_needed(args.launcher)

    state, hwnd = wait_login_or_menu(timeout=args.timeout)

    if state == "menu":
        print_window("[PASS] Menu ja estava aberto", hwnd)
        cancel_stock_dialog_if_present()
        print("\nRESULTADO: PASS")
        return 0

    if state != "login":
        raise RuntimeError(
            f"Nao apareceu {LOGIN_CLASS} nem {MENU_CLASS} "
            f"em {args.timeout:.0f}s."
        )

    menu = login_superus(hwnd, args.user, args.password)

    # O popup pode surgir alguns instantes depois do menu.
    grace_end = time.monotonic() + 5
    while time.monotonic() < grace_end:
        cancel_stock_dialog_if_present()
        time.sleep(0.1)

    print_window("\n[PASS] TFormMenuPrincipal", menu)

    print("\n" + "=" * 72)
    print("RESULTADO: PASS")
    print("=" * 72)
    print("LOGIN: PASS")
    print("TFormLogonUsuario: CONFIRMADO")
    print("TEdit INSTANCE 2 (usuario): PASS")
    print("TEdit INSTANCE 1 (senha): PASS")
    print("TBitBtn &OK: PASS")
    print("TFormMenuPrincipal: PASS")
    print("physical_mouse_moves: 0")
    print("global_keyboard_uses: 0")
    print("foreground_calls: 0")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Teste isolado de login do SUPERUS usando somente HWND/Win32."
    )
    parser.add_argument(
        "--launcher",
        default=os.getenv("SUPERUS_LAUNCHER_PATH", DEFAULT_LAUNCHER),
    )
    parser.add_argument(
        "--user",
        default=(
            os.getenv("SUPERUS_USER")
            or os.getenv("SUPERUS_USERNAME")
        ),
    )
    parser.add_argument(
        "--password",
        default=(
            os.getenv("SUPERUS_PASSWORD")
            or os.getenv("SUPERUS_PASS")
        ),
    )
    parser.add_argument("--timeout", type=float, default=60.0)

    args = parser.parse_args()

    if not args.user:
        args.user = input("Usuario SUPERUS: ").strip()

    if not args.password:
        args.password = getpass.getpass("Senha SUPERUS: ")

    return args


if __name__ == "__main__":
    try:
        raise SystemExit(run(parse_args()))
    except KeyboardInterrupt:
        print("\nCancelado pelo usuario.")
        raise SystemExit(130)
    except Exception as exc:
        print("\n" + "=" * 72)
        print("RESULTADO: FAIL")
        print("=" * 72)
        print(f"{type(exc).__name__}: {exc}")
        raise SystemExit(1)
