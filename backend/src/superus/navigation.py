from __future__ import annotations

import ctypes
import json
import logging
import subprocess
import time
from ctypes import wintypes
from dataclasses import asdict, dataclass
from pathlib import Path

from src.config.settings import Settings
from src.superus.errors import SuperusError, WindowNotFoundError
from src.superus.launcher import executable_candidates, select_startup
from src.superus.pedidos import cancel_stock_dialog_if_present
from src.superus.sales_report import SALES_WINDOW_CLASS, find_sales_report
from src.superus.windows import WM_COMMAND, Win32

MENU_CLASS = 'TFormMenuPrincipal'
LOGIN_CLASS = 'TFormLogonUsuario'
BLOCKING_DIALOG_CLASS = 'TFormRelEstMin_ProdEstrategico'
RELEVANT_CLASSES = (
    MENU_CLASS,
    SALES_WINDOW_CLASS,
    'TFormPreview',
    LOGIN_CLASS,
    'TFormMensagem',
    BLOCKING_DIALOG_CLASS,
)

MF_BYCOMMAND = 0x0000
MF_BYPOSITION = 0x0400
MF_CHECKED = 0x0008
MF_DISABLED = 0x0002
MF_GRAYED = 0x0001
MF_SEPARATOR = 0x0800
NO_MENU_ID = 0xFFFFFFFF


@dataclass(frozen=True)
class MenuItem:
    level: int
    path: tuple[str, ...]
    text_raw: str
    text_normalized: str
    command_id: int | None
    enabled: bool
    checked: bool
    separator: bool
    submenu_handle: int | None

    def as_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload['path'] = list(self.path)
        return payload


@dataclass(frozen=True)
class WindowSnapshot:
    hwnd: int
    class_name: str
    title: str
    pid: int
    visible: bool
    enabled: bool


@dataclass(frozen=True)
class StartupState:
    launcher_pid: int | None
    menu_hwnd: int | None
    menu_pid: int | None
    superus_pid: int | None
    state: str
    menu_ready: bool
    menu_ready_time: float | None
    stock_dialog: str


@dataclass(frozen=True)
class SalesNavigationResult:
    status: str
    startup: StartupState
    getmenu: bool
    menu_item_count: int
    vendas_top_level: str | None
    vendas_child: str | None
    command_id: int | None
    wm_command_sent: bool
    tformvendas_hwnd: int | None
    tformvendas_pid: int | None
    open_time: float | None
    background: dict[str, int]
    error: str | None = None


def normalize_menu_text(value: str) -> str:
    caption = value.split('\t', 1)[0]
    return caption.replace('&', '').strip()


def find_menu_path(items: list[MenuItem], expected_path: tuple[str, ...]) -> MenuItem | None:
    normalized_expected = tuple(part.casefold() for part in expected_path)
    for item in items:
        if tuple(part.casefold() for part in item.path) == normalized_expected:
            return item
    return None


class NativeWindowInspector:
    def __init__(self) -> None:
        self.user32 = ctypes.windll.user32
        self.user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
        self.user32.GetWindowThreadProcessId.restype = wintypes.DWORD
        self._enum_proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def pid(self, hwnd: int) -> int:
        process_id = wintypes.DWORD()
        self.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process_id))
        return int(process_id.value)

    def class_name(self, hwnd: int) -> str:
        buffer = ctypes.create_unicode_buffer(256)
        self.user32.GetClassNameW(hwnd, buffer, len(buffer))
        return buffer.value

    def title(self, hwnd: int) -> str:
        length = self.user32.GetWindowTextLengthW(hwnd)
        buffer = ctypes.create_unicode_buffer(length + 1)
        self.user32.GetWindowTextW(hwnd, buffer, len(buffer))
        return buffer.value

    def top_level_windows(self) -> list[WindowSnapshot]:
        windows: list[WindowSnapshot] = []

        @self._enum_proc
        def callback(hwnd: int, _: int) -> bool:
            class_name = self.class_name(hwnd)
            if class_name in RELEVANT_CLASSES:
                windows.append(
                    WindowSnapshot(
                        hwnd=int(hwnd),
                        class_name=class_name,
                        title=self.title(hwnd),
                        pid=self.pid(hwnd),
                        visible=bool(self.user32.IsWindowVisible(hwnd)),
                        enabled=bool(self.user32.IsWindowEnabled(hwnd)),
                    )
                )
            return True

        self.user32.EnumWindows(callback, 0)
        return windows

    def write_windows(self, destination: Path) -> list[WindowSnapshot]:
        windows = self.top_level_windows()
        destination.write_text(
            json.dumps([asdict(item) for item in windows], ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
        return windows


class NativeMenuReader:
    def __init__(self) -> None:
        self.user32 = ctypes.windll.user32
        self.user32.GetMenu.argtypes = [wintypes.HWND]
        self.user32.GetMenu.restype = wintypes.HMENU
        self.user32.GetMenuItemCount.argtypes = [wintypes.HMENU]
        self.user32.GetMenuItemCount.restype = ctypes.c_int
        self.user32.GetMenuStringW.argtypes = [
            wintypes.HMENU,
            ctypes.c_uint,
            wintypes.LPWSTR,
            ctypes.c_int,
            ctypes.c_uint,
        ]
        self.user32.GetMenuStringW.restype = ctypes.c_int
        self.user32.GetMenuItemID.argtypes = [wintypes.HMENU, ctypes.c_int]
        self.user32.GetMenuItemID.restype = ctypes.c_uint
        self.user32.GetSubMenu.argtypes = [wintypes.HMENU, ctypes.c_int]
        self.user32.GetSubMenu.restype = wintypes.HMENU
        self.user32.GetMenuState.argtypes = [wintypes.HMENU, ctypes.c_uint, ctypes.c_uint]
        self.user32.GetMenuState.restype = ctypes.c_uint

    def menu_handle(self, hwnd: int) -> int:
        return int(self.user32.GetMenu(hwnd) or 0)

    def read_tree(self, hwnd: int) -> list[MenuItem]:
        root = self.menu_handle(hwnd)
        if not root:
            raise SuperusError('NATIVE_MENU_NOT_AVAILABLE')
        return self._read_menu(root, level=0, parent_path=())

    def _read_menu(self, menu: int, level: int, parent_path: tuple[str, ...]) -> list[MenuItem]:
        count = self.user32.GetMenuItemCount(menu)
        items: list[MenuItem] = []
        for index in range(count):
            buffer = ctypes.create_unicode_buffer(512)
            self.user32.GetMenuStringW(menu, index, buffer, len(buffer), MF_BYPOSITION)
            raw = buffer.value
            normalized = normalize_menu_text(raw)
            submenu = int(self.user32.GetSubMenu(menu, index) or 0)
            command_id_raw = int(self.user32.GetMenuItemID(menu, index))
            state = int(self.user32.GetMenuState(menu, index, MF_BYPOSITION))
            path = (*parent_path, normalized) if normalized else parent_path
            command_id = None if submenu or command_id_raw == NO_MENU_ID else command_id_raw
            item = MenuItem(
                level=level,
                path=path,
                text_raw=raw,
                text_normalized=normalized,
                command_id=command_id,
                enabled=not bool(state & (MF_DISABLED | MF_GRAYED)),
                checked=bool(state & MF_CHECKED),
                separator=bool(state & MF_SEPARATOR),
                submenu_handle=submenu or None,
            )
            items.append(item)
            if submenu:
                items.extend(self._read_menu(submenu, level + 1, path))
        return items


def write_menu_tree(items: list[MenuItem], destination: Path) -> None:
    destination.write_text(
        json.dumps([item.as_dict() for item in items], ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


def send_sales_menu_command(win32: Win32, menu_hwnd: int, command_id: int, timeout: float = 30) -> int:
    win32.send(menu_hwnd, WM_COMMAND, command_id, 0)
    return win32.wait(lambda: find_sales_report(win32), timeout, SALES_WINDOW_CLASS)


def wait_for_startup(
    win32: Win32,
    settings: Settings,
    inspector: NativeWindowInspector,
    logger: logging.Logger,
    timeout: float = 60,
) -> StartupState:
    started = time.monotonic()
    selection = select_startup(win32, settings)
    launcher_pid: int | None = None
    if selection.method == 'unavailable':
        candidates = [{'method': method, 'path': str(path), 'exists': path.exists()} for method, path in executable_candidates(settings)]
        raise SuperusError(f'SUPERUS não encontrado. Candidatos: {candidates}')
    if selection.method != 'existing_session' and selection.path:
        process = subprocess.Popen([str(selection.path)], close_fds=True)
        launcher_pid = process.pid
        logger.info('STARTUP_PROCESS_STARTED pid=%s path=%s', launcher_pid, selection.path)
    deadline = time.monotonic() + timeout
    last_state = 'STARTUP_TIMEOUT'
    while time.monotonic() < deadline:
        menu = win32.find_window(MENU_CLASS)
        if menu:
            elapsed = round(time.monotonic() - started, 3)
            stock_dialog = 'NOT_SEEN'
            if win32.find_window(BLOCKING_DIALOG_CLASS):
                stock_dialog = 'CLOSED' if cancel_stock_dialog_if_present(win32) else 'FAIL'
            pid = inspector.pid(menu)
            return StartupState(
                launcher_pid=launcher_pid,
                menu_hwnd=menu,
                menu_pid=pid,
                superus_pid=pid,
                state='MENU_READY',
                menu_ready=True,
                menu_ready_time=elapsed,
                stock_dialog=stock_dialog,
            )
        if win32.find_window(LOGIN_CLASS):
            last_state = 'LOGIN_REQUIRED'
        elif win32.find_window(BLOCKING_DIALOG_CLASS):
            last_state = 'BLOCKING_DIALOG'
        time.sleep(0.1)
    return StartupState(
        launcher_pid=launcher_pid,
        menu_hwnd=None,
        menu_pid=None,
        superus_pid=None,
        state=last_state,
        menu_ready=False,
        menu_ready_time=None,
        stock_dialog='NOT_SEEN',
    )


def discover_sales_navigation(
    *,
    win32: Win32,
    settings: Settings,
    directory: Path,
    open_screen: bool,
) -> SalesNavigationResult:
    directory.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(f'sales-navigation.{directory.name}')
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.addHandler(logging.FileHandler(directory / 'automation.log', encoding='utf-8'))
    inspector = NativeWindowInspector()
    reader = NativeMenuReader()
    startup = wait_for_startup(win32, settings, inspector, logger)
    inspector.write_windows(directory / 'windows.json')
    if not startup.menu_ready or not startup.menu_hwnd:
        payload = SalesNavigationResult(
            status='FAIL',
            startup=startup,
            getmenu=False,
            menu_item_count=0,
            vendas_top_level=None,
            vendas_child=None,
            command_id=None,
            wm_command_sent=False,
            tformvendas_hwnd=None,
            tformvendas_pid=None,
            open_time=None,
            background=win32.audit.as_dict(),
            error=startup.state,
        )
        _write_navigation(payload, directory / 'sales_navigation.json')
        return payload

    try:
        items = reader.read_tree(startup.menu_hwnd)
        write_menu_tree(items, directory / 'menu_tree.json')
    except SuperusError as error:
        win32.dump_controls(startup.menu_hwnd, directory / 'menu_fallback_controls.json')
        payload = SalesNavigationResult(
            status='FAIL',
            startup=startup,
            getmenu=False,
            menu_item_count=0,
            vendas_top_level=None,
            vendas_child=None,
            command_id=None,
            wm_command_sent=False,
            tformvendas_hwnd=None,
            tformvendas_pid=None,
            open_time=None,
            background=win32.audit.as_dict(),
            error=str(error),
        )
        _write_navigation(payload, directory / 'sales_navigation.json')
        return payload

    if not items:
        win32.dump_controls(startup.menu_hwnd, directory / 'menu_fallback_controls.json')
        payload = SalesNavigationResult(
            status='FAIL',
            startup=startup,
            getmenu=True,
            menu_item_count=0,
            vendas_top_level=None,
            vendas_child=None,
            command_id=None,
            wm_command_sent=False,
            tformvendas_hwnd=None,
            tformvendas_pid=None,
            open_time=None,
            background=win32.audit.as_dict(),
            error='NATIVE_MENU_EMPTY',
        )
        _write_navigation(payload, directory / 'sales_navigation.json')
        return payload

    top = find_menu_path(items, ('Vendas',))
    child = find_menu_path(items, ('Vendas', 'Vendas'))
    command_id = child.command_id if child else None
    if not top or not child or command_id is None:
        payload = SalesNavigationResult(
            status='FAIL',
            startup=startup,
            getmenu=True,
            menu_item_count=sum(1 for item in items if item.level == 0),
            vendas_top_level=top.text_raw if top else None,
            vendas_child=child.text_raw if child else None,
            command_id=command_id,
            wm_command_sent=False,
            tformvendas_hwnd=None,
            tformvendas_pid=None,
            open_time=None,
            background=win32.audit.as_dict(),
            error='Vendas > Vendas não encontrado com command_id válido.',
        )
        _write_navigation(payload, directory / 'sales_navigation.json')
        return payload

    if not open_screen:
        payload = SalesNavigationResult(
            status='PASS',
            startup=startup,
            getmenu=True,
            menu_item_count=sum(1 for item in items if item.level == 0),
            vendas_top_level=top.text_raw,
            vendas_child=child.text_raw,
            command_id=command_id,
            wm_command_sent=False,
            tformvendas_hwnd=None,
            tformvendas_pid=None,
            open_time=None,
            background=win32.audit.as_dict(),
        )
        _write_navigation(payload, directory / 'sales_navigation.json')
        return payload

    open_started = time.monotonic()
    try:
        sales_hwnd = send_sales_menu_command(win32, startup.menu_hwnd, command_id)
    except WindowNotFoundError as error:
        payload = SalesNavigationResult(
            status='FAIL',
            startup=startup,
            getmenu=True,
            menu_item_count=sum(1 for item in items if item.level == 0),
            vendas_top_level=top.text_raw,
            vendas_child=child.text_raw,
            command_id=command_id,
            wm_command_sent=True,
            tformvendas_hwnd=None,
            tformvendas_pid=None,
            open_time=round(time.monotonic() - open_started, 3),
            background=win32.audit.as_dict(),
            error=str(error),
        )
        _write_navigation(payload, directory / 'sales_navigation.json')
        return payload

    payload = SalesNavigationResult(
        status='PASS',
        startup=startup,
        getmenu=True,
        menu_item_count=sum(1 for item in items if item.level == 0),
        vendas_top_level=top.text_raw,
        vendas_child=child.text_raw,
        command_id=command_id,
        wm_command_sent=True,
        tformvendas_hwnd=sales_hwnd,
        tformvendas_pid=inspector.pid(sales_hwnd),
        open_time=round(time.monotonic() - open_started, 3),
        background=win32.audit.as_dict(),
    )
    _write_navigation(payload, directory / 'sales_navigation.json')
    return payload


def _write_navigation(result: SalesNavigationResult, destination: Path) -> None:
    payload = asdict(result)
    destination.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
