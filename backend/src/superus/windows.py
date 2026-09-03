"""Camada Win32 restrita a mensagens diretas de HWND; sem foco ou entrada global."""
from __future__ import annotations

import ctypes
import json
import time
from collections.abc import Callable
from ctypes import wintypes
from dataclasses import asdict, dataclass
from pathlib import Path

from src.superus.errors import ControlNotFoundError, ControlStateError, WindowNotFoundError

WM_COMMAND = 0x0111
WM_SETTEXT = 0x000C
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
BM_GETCHECK = 0x00F0
BM_SETCHECK = 0x00F1
BM_CLICK = 0x00F5
BST_UNCHECKED = 0
BST_CHECKED = 1
VK_F11 = 0x7A


@dataclass(frozen=True)
class BackgroundAudit:
    physical_mouse_moves: int = 0
    global_keyboard_uses: int = 0
    foreground_calls: int = 0

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


@dataclass(frozen=True)
class ControlInfo:
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


class Win32:
    def __init__(self) -> None:
        self.audit = BackgroundAudit()
        self.user32 = ctypes.windll.user32
        self._enum_proc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _text(self, hwnd: int) -> str:
        length = self.user32.GetWindowTextLengthW(hwnd)
        buffer = ctypes.create_unicode_buffer(length + 1)
        self.user32.GetWindowTextW(hwnd, buffer, len(buffer))
        return buffer.value

    def _class(self, hwnd: int) -> str:
        buffer = ctypes.create_unicode_buffer(256)
        self.user32.GetClassNameW(hwnd, buffer, len(buffer))
        return buffer.value

    def _info(self, hwnd: int, instance: int) -> ControlInfo:
        rect = wintypes.RECT()
        self.user32.GetWindowRect(hwnd, ctypes.byref(rect))
        class_name = self._class(hwnd)
        check_state = self.user32.SendMessageW(hwnd, BM_GETCHECK, 0, 0)
        return ControlInfo(
            hwnd=hwnd, class_name=class_name, text=self._text(hwnd),
            visible=bool(self.user32.IsWindowVisible(hwnd)), enabled=bool(self.user32.IsWindowEnabled(hwnd)),
            left=rect.left, top=rect.top, width=rect.right - rect.left, height=rect.bottom - rect.top,
            instance=instance, check_state=check_state if class_name in {'TCheckBox', 'TRadioButton', 'TGroupButton'} else None,
        )

    def find_window(self, class_name: str, title: str | None = None) -> int | None:
        hwnd = self.user32.FindWindowW(class_name, title)
        return int(hwnd) if hwnd else None

    def children(self, parent: int) -> list[ControlInfo]:
        result: list[ControlInfo] = []
        counts: dict[str, int] = {}

        @self._enum_proc
        def callback(hwnd: int, _: int) -> bool:
            name = self._class(hwnd)
            counts[name] = counts.get(name, 0) + 1
            result.append(self._info(hwnd, counts[name]))
            return True

        self.user32.EnumChildWindows(parent, callback, 0)
        return result

    def control_by_instance(self, parent: int, class_name: str, instance: int) -> ControlInfo:
        for control in self.children(parent):
            if control.class_name == class_name and control.instance == instance:
                return control
        raise ControlNotFoundError(f'{class_name} INSTANCE {instance} não encontrado em hwnd={parent}.')

    def send(self, hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> int:
        return int(self.user32.SendMessageW(hwnd, message, wparam, lparam))

    def post(self, hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> None:
        if not self.user32.PostMessageW(hwnd, message, wparam, lparam):
            raise OSError(f'PostMessage falhou: hwnd={hwnd}, message={message}.')

    def set_text(self, hwnd: int, value: str) -> None:
        self.send(hwnd, WM_SETTEXT, 0, ctypes.cast(ctypes.c_wchar_p(value), ctypes.c_void_p).value or 0)
        if self._text(hwnd) != value:
            raise ControlStateError(f'WM_SETTEXT não confirmou o valor em hwnd={hwnd}.')

    def set_checked(self, control: ControlInfo, desired: bool) -> None:
        actual = self.send(control.hwnd, BM_GETCHECK) == BST_CHECKED
        if actual != desired:
            self.send(control.hwnd, BM_CLICK)
        confirmed = self.send(control.hwnd, BM_GETCHECK) == BST_CHECKED
        if confirmed != desired:
            raise ControlStateError(f'{control.class_name} {control.instance} não confirmou estado {desired}.')

    def click(self, hwnd: int) -> None:
        self.send(hwnd, BM_CLICK)

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

    def dump_controls(self, parent: int, destination: Path) -> list[ControlInfo]:
        controls = self.children(parent)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps([asdict(item) for item in controls], ensure_ascii=False, indent=2), encoding='utf-8')
        return controls
