"""Primitivas Win32 usadas pela automação do SUPERUS.

A camada foi consolidada a partir da automação que já havia sido validada no
SuperusSupabaseSync. O fluxo de produção usa somente HWND/mensagens locais:
não move o cursor físico, não injeta teclado global e nunca chama
SetForegroundWindow/BringWindowToTop/SetFocus.
"""
from __future__ import annotations

import ctypes
import json
import os
import time
import unicodedata
from collections.abc import Callable
from contextlib import contextmanager
from ctypes import wintypes
from dataclasses import asdict, dataclass
from pathlib import Path

from src.superus.errors import ControlNotFoundError, ControlStateError, WindowNotFoundError

WM_COMMAND = 0x0111
WM_SETTEXT = 0x000C
WM_GETTEXT = 0x000D
WM_GETTEXTLENGTH = 0x000E
WM_CLOSE = 0x0010
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_MOUSEMOVE = 0x0200
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
BM_GETCHECK = 0x00F0
BM_SETCHECK = 0x00F1
BM_CLICK = 0x00F5
BST_UNCHECKED = 0
BST_CHECKED = 1
MK_LBUTTON = 0x0001
VK_F11 = 0x7A
VK_RETURN = 0x0D
VK_TAB = 0x09
IDOK = 1
MF_BYPOSITION = 0x0400
NO_MENU_ID = 0xFFFFFFFF
SW_SHOWNOACTIVATE = 4
HWND_BOTTOM = 1
SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002
SWP_NOACTIVATE = 0x0010

# TPageControl/TabControl messages used by the Perdas flow.
TCM_FIRST = 0x1300
TCM_GETITEMCOUNT = TCM_FIRST + 4
TCM_GETITEMW = TCM_FIRST + 60
TCM_GETITEMRECT = TCM_FIRST + 10
TCM_SETCURSEL = TCM_FIRST + 12
TCIF_TEXT = 0x0001


@dataclass
class BackgroundAudit:
    physical_mouse_moves: int = 0
    global_keyboard_uses: int = 0
    foreground_calls: int = 0
    observed_focus_changes: int = 0
    observed_cursor_changes: int = 0

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


@dataclass(frozen=True)
class ControlInfo:
    parent_hwnd: int
    hwnd: int
    class_name: str
    text: str
    visible: bool
    enabled: bool
    left: int
    top: int
    width: int
    height: int
    instance: int
    check_state: int | None


class _TCITEMW(ctypes.Structure):
    _fields_ = [
        ('mask', ctypes.c_uint),
        ('dwState', ctypes.c_uint),
        ('dwStateMask', ctypes.c_uint),
        ('pszText', ctypes.c_wchar_p),
        ('cchTextMax', ctypes.c_int),
        ('iImage', ctypes.c_int),
        ('lParam', wintypes.LPARAM),
    ]


def comparable_text(value: str) -> str:
    cleaned = (value or '').replace('&', '').strip().casefold()
    normalized = unicodedata.normalize('NFD', cleaned)
    return ''.join(ch for ch in normalized if unicodedata.category(ch) != 'Mn')


class Win32:
    def __init__(self) -> None:
        if os.name != 'nt':
            raise OSError('A automação Win32 do SUPERUS só pode ser executada no Windows.')
        self.audit = BackgroundAudit()
        self.user32 = ctypes.windll.user32
        self._enum_proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        self._configure_api()
        try:
            import win32con  # type: ignore
            import win32gui  # type: ignore
        except ImportError:
            self.win32gui = None
            self.win32con = None
        else:
            self.win32gui = win32gui
            self.win32con = win32con

    def _configure_api(self) -> None:
        u = self.user32
        u.GetWindowTextLengthW.argtypes = [wintypes.HWND]
        u.GetWindowTextLengthW.restype = ctypes.c_int
        u.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        u.GetWindowTextW.restype = ctypes.c_int
        u.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        u.GetClassNameW.restype = ctypes.c_int
        u.IsWindow.argtypes = [wintypes.HWND]
        u.IsWindow.restype = wintypes.BOOL
        u.IsWindowVisible.argtypes = [wintypes.HWND]
        u.IsWindowVisible.restype = wintypes.BOOL
        u.IsWindowEnabled.argtypes = [wintypes.HWND]
        u.IsWindowEnabled.restype = wintypes.BOOL
        u.SendMessageW.argtypes = [wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM]
        u.SendMessageW.restype = ctypes.c_ssize_t
        u.SendMessageA.argtypes = [wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM]
        u.SendMessageA.restype = ctypes.c_ssize_t
        u.IsWindowUnicode.argtypes = [wintypes.HWND]
        u.IsWindowUnicode.restype = wintypes.BOOL
        u.PostMessageW.argtypes = [wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM]
        u.PostMessageW.restype = wintypes.BOOL
        u.EnumWindows.argtypes = [self._enum_proc, wintypes.LPARAM]
        u.EnumWindows.restype = wintypes.BOOL
        u.EnumChildWindows.argtypes = [wintypes.HWND, self._enum_proc, wintypes.LPARAM]
        u.EnumChildWindows.restype = wintypes.BOOL
        u.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
        u.GetWindowRect.restype = wintypes.BOOL
        u.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
        u.GetClientRect.restype = wintypes.BOOL
        u.GetForegroundWindow.restype = wintypes.HWND
        u.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
        u.GetCursorPos.restype = wintypes.BOOL
        u.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_uint]
        u.SetWindowPos.restype = wintypes.BOOL
        u.GetMenu.argtypes = [wintypes.HWND]
        u.GetMenu.restype = wintypes.HMENU
        u.GetMenuItemCount.argtypes = [wintypes.HMENU]
        u.GetMenuItemCount.restype = ctypes.c_int
        u.GetMenuStringW.argtypes = [wintypes.HMENU, ctypes.c_uint, wintypes.LPWSTR, ctypes.c_int, ctypes.c_uint]
        u.GetMenuStringW.restype = ctypes.c_int
        u.GetSubMenu.argtypes = [wintypes.HMENU, ctypes.c_int]
        u.GetSubMenu.restype = wintypes.HMENU
        u.GetMenuItemID.argtypes = [wintypes.HMENU, ctypes.c_int]
        u.GetMenuItemID.restype = ctypes.c_uint

    def is_unicode_window(self, hwnd: int) -> bool:
        """Retorna True quando o HWND usa uma WindowProc Unicode.

        O SUPERUS desta instalação foi construído com VCL ANSI em vários
        controles (por exemplo TEdit do logon). Enviar WM_SETTEXT com
        SendMessageW para um HWND ANSI faz o controle interpretar bytes UTF-16
        como texto ANSI, produzindo caracteres corrompidos. Por isso toda
        leitura/escrita textual precisa respeitar IsWindowUnicode(hwnd).
        """
        return bool(self.user32.IsWindowUnicode(hwnd))

    def text(self, hwnd: int) -> str:
        """Lê texto de janelas/controles respeitando HWND ANSI ou Unicode."""
        # Para captions de top-level, GetWindowTextW continua sendo o caminho
        # mais simples e o Windows faz a conversão quando necessário.
        length = self.user32.GetWindowTextLengthW(hwnd)
        if length > 0:
            buffer = ctypes.create_unicode_buffer(length + 1)
            copied = self.user32.GetWindowTextW(hwnd, buffer, len(buffer))
            if copied > 0:
                return buffer.value

        try:
            if self.is_unicode_window(hwnd):
                msg_length = int(self.user32.SendMessageW(hwnd, WM_GETTEXTLENGTH, 0, 0))
                capacity = max(256, msg_length + 1)
                buffer_w = ctypes.create_unicode_buffer(capacity)
                self.user32.SendMessageW(
                    hwnd,
                    WM_GETTEXT,
                    capacity,
                    ctypes.cast(buffer_w, ctypes.c_void_p).value or 0,
                )
                return buffer_w.value

            msg_length = int(self.user32.SendMessageA(hwnd, WM_GETTEXTLENGTH, 0, 0))
            capacity = max(256, msg_length + 1)
            buffer_a = ctypes.create_string_buffer(capacity)
            self.user32.SendMessageA(
                hwnd,
                WM_GETTEXT,
                capacity,
                ctypes.cast(buffer_a, ctypes.c_void_p).value or 0,
            )
            return buffer_a.value.decode('mbcs', errors='replace')
        except (OSError, ValueError, UnicodeError):
            return ''

    def class_name(self, hwnd: int) -> str:
        buffer = ctypes.create_unicode_buffer(256)
        self.user32.GetClassNameW(hwnd, buffer, len(buffer))
        return buffer.value

    def is_visible(self, hwnd: int) -> bool:
        return bool(hwnd and self.user32.IsWindow(hwnd) and self.user32.IsWindowVisible(hwnd))

    def enum_top_windows(self, *, visible_only: bool = True) -> list[int]:
        result: list[int] = []

        @self._enum_proc
        def callback(hwnd: int, _: int) -> bool:
            if not visible_only or self.is_visible(hwnd):
                result.append(int(hwnd))
            return True

        self.user32.EnumWindows(callback, 0)
        return result

    def find_window(
        self,
        class_name: str | None = None,
        title: str | None = None,
        *,
        title_contains: str | None = None,
        visible_only: bool = True,
    ) -> int | None:
        wanted_class = class_name or ''
        wanted_title = comparable_text(title or '')
        wanted_contains = comparable_text(title_contains or '')
        for hwnd in self.enum_top_windows(visible_only=visible_only):
            if wanted_class and self.class_name(hwnd) != wanted_class:
                continue
            current_title = self.text(hwnd)
            if title is not None and comparable_text(current_title) != wanted_title:
                continue
            if title_contains and wanted_contains not in comparable_text(current_title):
                continue
            return hwnd
        return None

    def child_hwnds(self, parent: int) -> list[int]:
        result: list[int] = []

        @self._enum_proc
        def callback(hwnd: int, _: int) -> bool:
            result.append(int(hwnd))
            return True

        self.user32.EnumChildWindows(parent, callback, 0)
        return result

    def children(self, parent: int) -> list[ControlInfo]:
        result: list[ControlInfo] = []
        counts: dict[str, int] = {}
        for hwnd in self.child_hwnds(parent):
            name = self.class_name(hwnd)
            counts[name] = counts.get(name, 0) + 1
            result.append(self._info(parent, hwnd, counts[name]))
        return result

    def _info(self, parent: int, hwnd: int, instance: int) -> ControlInfo:
        rect = wintypes.RECT()
        self.user32.GetWindowRect(hwnd, ctypes.byref(rect))
        class_name = self.class_name(hwnd)
        check_state = self.send(hwnd, BM_GETCHECK)
        return ControlInfo(
            parent_hwnd=parent,
            hwnd=hwnd,
            class_name=class_name,
            text=self.text(hwnd),
            visible=bool(self.user32.IsWindowVisible(hwnd)),
            enabled=bool(self.user32.IsWindowEnabled(hwnd)),
            left=rect.left,
            top=rect.top,
            width=rect.right - rect.left,
            height=rect.bottom - rect.top,
            instance=instance,
            check_state=check_state if class_name in {'TCheckBox', 'TRadioButton', 'TGroupButton'} else None,
        )

    def control_by_instance(self, parent: int, class_name: str, instance: int) -> ControlInfo:
        for control in self.children(parent):
            if control.class_name == class_name and control.instance == instance:
                return control
        raise ControlNotFoundError(f'{class_name} INSTANCE {instance} não encontrado em hwnd={parent}.')

    def control_by_text(self, parent: int, class_name: str, expected: str) -> ControlInfo:
        wanted = comparable_text(expected)
        for control in self.children(parent):
            if control.class_name == class_name and comparable_text(control.text) == wanted:
                return control
        raise ControlNotFoundError(f'{class_name} com texto {expected!r} não encontrado em hwnd={parent}.')

    def control_by_instance_or_text(
        self, parent: int, class_name: str, instance: int, expected: str | None = None
    ) -> ControlInfo:
        try:
            control = self.control_by_instance(parent, class_name, instance)
        except ControlNotFoundError:
            if expected:
                return self.control_by_text(parent, class_name, expected)
            raise
        if expected and comparable_text(control.text) != comparable_text(expected):
            return self.control_by_text(parent, class_name, expected)
        return control

    def send(self, hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> int:
        return int(self.user32.SendMessageW(hwnd, message, wparam, lparam))

    def post(self, hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> None:
        if not self.user32.PostMessageW(hwnd, message, wparam, lparam):
            raise OSError(f'PostMessage falhou: hwnd={hwnd}, message={message}.')

    def post_if_present(self, hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> bool:
        """Envia PostMessage apenas se o HWND ainda existir.

        Usado em rotinas de limpeza idempotentes. Entre enumerar uma janela e
        tentar fechá-la, o VCL pode destruí-la por conta própria; nesse race o
        PostMessage retorna FALSE/ERROR_INVALID_WINDOW_HANDLE e isso não deve
        abortar uma nova coleta. Se o HWND continuar válido e o PostMessage
        falhar, o erro permanece fatal.
        """
        if not hwnd or not self.user32.IsWindow(hwnd):
            return False
        if self.user32.PostMessageW(hwnd, message, wparam, lparam):
            return True
        if not self.user32.IsWindow(hwnd):
            return False
        raise OSError(f'PostMessage falhou: hwnd={hwnd}, message={message}.')

    def set_text(self, hwnd: int, value: str, *, verify: bool = True) -> None:
        """Define texto em HWND ANSI/Unicode sem usar teclado global.

        Controles Delphi antigos do SUPERUS são ANSI. Neles usamos
        SendMessageA + encoding "mbcs" (ANSI code page atual do Windows).
        Controles Unicode continuam usando SendMessageW.
        """
        if self.is_unicode_window(hwnd):
            buffer_w = ctypes.create_unicode_buffer(value)
            result = int(
                self.user32.SendMessageW(
                    hwnd,
                    WM_SETTEXT,
                    0,
                    ctypes.cast(buffer_w, ctypes.c_void_p).value or 0,
                )
            )
        else:
            encoded = value.encode('mbcs', errors='strict')
            buffer_a = ctypes.create_string_buffer(encoded)
            result = int(
                self.user32.SendMessageA(
                    hwnd,
                    WM_SETTEXT,
                    0,
                    ctypes.cast(buffer_a, ctypes.c_void_p).value or 0,
                )
            )

        # Alguns controles VCL retornam 0 apesar de aceitarem WM_SETTEXT.
        # A validação por readback é opcional; login/datas ainda têm quality
        # gates próprios depois da ação.
        if verify:
            read_back = self.text(hwnd).strip()
            if read_back != value.strip():
                raise ControlStateError(
                    f'WM_SETTEXT não confirmou o valor em {self.class_name(hwnd)} hwnd={hwnd}: '
                    f'esperado={value!r}, lido={read_back!r}, result={result}, '
                    f'unicode={self.is_unicode_window(hwnd)}.'
                )

    def set_checked(self, control: ControlInfo, desired: bool) -> None:
        actual = self.send(control.hwnd, BM_GETCHECK) == BST_CHECKED
        if actual != desired:
            self.post(control.hwnd, BM_CLICK)
            actual = self.wait(
                lambda: self.send(control.hwnd, BM_GETCHECK) == (BST_CHECKED if desired else BST_UNCHECKED),
                1.5,
                f'estado de {control.class_name} {control.instance}',
            )
            del actual
        confirmed = self.send(control.hwnd, BM_GETCHECK) == BST_CHECKED
        if confirmed != desired:
            # Alguns VCL precisam da sequência local de mouse para disparar o handler.
            self.virtual_click(control.hwnd)
            time.sleep(0.15)
            confirmed = self.send(control.hwnd, BM_GETCHECK) == BST_CHECKED
        if confirmed != desired:
            raise ControlStateError(f'{control.class_name} {control.instance} não confirmou estado {desired}.')

    def click(self, hwnd: int) -> None:
        self.post(hwnd, BM_CLICK)

    def virtual_click(self, hwnd: int, x: int | None = None, y: int | None = None) -> None:
        rect = wintypes.RECT()
        if not self.user32.GetClientRect(hwnd, ctypes.byref(rect)):
            raise OSError(f'GetClientRect falhou para hwnd={hwnd}.')
        width = rect.right - rect.left
        height = rect.bottom - rect.top
        x = max(1, width // 2) if x is None else x
        y = max(1, height // 2) if y is None else y
        if not (0 <= x < max(1, width) and 0 <= y < max(1, height)):
            raise ControlStateError(f'Clique local fora do controle hwnd={hwnd}: ({x},{y}) em {width}x{height}.')
        lparam = ((y & 0xFFFF) << 16) | (x & 0xFFFF)
        self.post(hwnd, WM_LBUTTONDOWN, MK_LBUTTON, lparam)
        self.post(hwnd, WM_LBUTTONUP, 0, lparam)
        # Não altera o cursor físico; por isso physical_mouse_moves permanece zero.

    def send_key(self, hwnd: int, vk: int) -> None:
        # Tecla direcionada ao HWND, nunca global.
        self.post(hwnd, WM_KEYDOWN, vk)
        self.post(hwnd, WM_KEYUP, vk)

    def wait_window(self, class_name: str, timeout: float, title: str | None = None) -> int:
        return self.wait(lambda: self.find_window(class_name, title), timeout, f'Janela {class_name}')

    def wait(self, predicate: Callable[[], int | bool | None], timeout: float, description: str) -> int:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            value = predicate()
            if value:
                return int(value)
            time.sleep(0.1)
        raise WindowNotFoundError(f'{description} não apareceu em {timeout:.1f}s.')

    def wait_hidden(self, hwnd: int, timeout: float = 10.0) -> bool:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if not self.user32.IsWindow(hwnd) or not self.user32.IsWindowVisible(hwnd):
                return True
            time.sleep(0.1)
        return False

    def dump_controls(self, parent: int, destination: Path) -> list[ControlInfo]:
        controls = self.children(parent)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(
            json.dumps([asdict(item) for item in controls], ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
        return controls

    def get_foreground(self) -> int:
        return int(self.user32.GetForegroundWindow() or 0)

    def get_cursor(self) -> tuple[int, int]:
        point = wintypes.POINT()
        self.user32.GetCursorPos(ctypes.byref(point))
        return int(point.x), int(point.y)

    def send_to_back_no_activate(self, hwnd: int) -> None:
        self.user32.SetWindowPos(
            hwnd,
            HWND_BOTTOM,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        )

    @contextmanager
    def background_step(self, label: str, logger=None):
        before_focus = self.get_foreground()
        before_cursor = self.get_cursor()
        try:
            yield
        finally:
            after_focus = self.get_foreground()
            after_cursor = self.get_cursor()
            if before_focus != after_focus:
                self.audit.observed_focus_changes += 1
            if before_cursor != after_cursor:
                self.audit.observed_cursor_changes += 1
            if logger:
                logger.info(
                    '[BACKGROUND] step=%s focus_before=0x%X focus_after=0x%X cursor_before=%s cursor_after=%s',
                    label,
                    before_focus,
                    after_focus,
                    before_cursor,
                    after_cursor,
                )

    def _menu_count(self, menu: int) -> int:
        if self.win32gui is not None:
            try:
                return int(self.win32gui.GetMenuItemCount(menu))
            except Exception:
                pass
        return int(self.user32.GetMenuItemCount(menu))

    def menu_item_count(self, hwnd: int) -> int:
        """Retorna a quantidade de itens do menu nativo da janela.

        O TFormMenuPrincipal pode existir alguns instantes antes de o TMainMenu
        ser preenchido. Expor esta leitura permite aguardar o menu REALmente
        pronto antes de tentar Vendas > Vendas ou Faturamento > Pedidos.
        """
        menu = self._menu_handle(hwnd)
        return self._menu_count(menu) if menu else 0

    def _menu_handle(self, hwnd: int) -> int:
        if self.win32gui is not None:
            try:
                return int(self.win32gui.GetMenu(hwnd) or 0)
            except Exception:
                pass
        return int(self.user32.GetMenu(hwnd) or 0)

    def _menu_label(self, menu: int, index: int) -> str:
        if self.win32gui is not None:
            try:
                return str(self.win32gui.GetMenuString(menu, index, MF_BYPOSITION))
            except Exception:
                pass
        buffer = ctypes.create_unicode_buffer(512)
        self.user32.GetMenuStringW(menu, index, buffer, len(buffer), MF_BYPOSITION)
        return buffer.value

    def _submenu(self, menu: int, index: int) -> int:
        if self.win32gui is not None:
            try:
                return int(self.win32gui.GetSubMenu(menu, index) or 0)
            except Exception:
                pass
        return int(self.user32.GetSubMenu(menu, index) or 0)

    def _menu_item_id(self, menu: int, index: int) -> int:
        if self.win32gui is not None:
            try:
                return int(self.win32gui.GetMenuItemID(menu, index))
            except Exception:
                pass
        return int(self.user32.GetMenuItemID(menu, index))

    def _find_menu_command(self, menu: int, labels: tuple[str, ...]) -> int | None:
        if not labels:
            return None
        target = comparable_text(labels[0].split('\t', 1)[0])
        count = self._menu_count(menu)
        if count <= 0:
            return None
        for index in range(count):
            current = comparable_text(self._menu_label(menu, index).split('\t', 1)[0])
            if current != target:
                continue
            submenu = self._submenu(menu, index)
            if len(labels) == 1:
                command = self._menu_item_id(menu, index)
                return None if command in (-1, NO_MENU_ID) else command
            if submenu:
                return self._find_menu_command(submenu, labels[1:])
        return None

    def select_menu_path(self, hwnd: int, *labels: str, timeout: float = 12.0) -> int:
        """Aciona um item do menu nativo por WM_COMMAND, sem ativar a janela.

        A automação antiga validada usava exatamente essa estratégia via
        pywin32. Aqui preservamos pywin32 quando disponível e mantemos fallback
        ctypes com tipos pointer-safe.
        """
        deadline = time.monotonic() + timeout
        last_count = -1
        while time.monotonic() < deadline:
            menu = self._menu_handle(hwnd)
            if menu:
                last_count = self._menu_count(menu)
                command = self._find_menu_command(menu, tuple(labels))
                if command is not None:
                    self.post(hwnd, WM_COMMAND, command, 0)
                    return command
            time.sleep(0.15)
        raise ControlNotFoundError(
            f'Comando de menu não localizado: {" > ".join(labels)} (menu_items={last_count}).'
        )

    def select_tab_by_text(self, page_hwnd: int, wanted: str) -> int:
        count = self.send(page_hwnd, TCM_GETITEMCOUNT)
        labels: list[str] = []
        target = -1
        for index in range(max(0, count)):
            buffer = ctypes.create_unicode_buffer(256)
            item = _TCITEMW(mask=TCIF_TEXT, pszText=ctypes.cast(buffer, ctypes.c_wchar_p), cchTextMax=len(buffer))
            ok = self.send(page_hwnd, TCM_GETITEMW, index, ctypes.addressof(item))
            label = buffer.value if ok else ''
            labels.append(label)
            if comparable_text(wanted) in comparable_text(label):
                target = index
                break
        # No relatório conhecido as abas são Pedidos / Produtos / Análises.
        if target < 0 and count >= 2:
            target = 1
        if target < 0:
            raise ControlNotFoundError(f'Aba {wanted!r} não localizada. tabs={labels!r}')
        rect = wintypes.RECT()
        if self.send(page_hwnd, TCM_GETITEMRECT, target, ctypes.addressof(rect)):
            self.virtual_click(page_hwnd, (rect.left + rect.right) // 2, (rect.top + rect.bottom) // 2)
        else:
            self.send(page_hwnd, TCM_SETCURSEL, target, 0)
        time.sleep(0.25)
        return target
