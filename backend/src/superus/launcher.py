from __future__ import annotations

import os
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from src.config.settings import Settings
from src.superus.errors import SuperusError
from src.superus.lifecycle import current_process_owner
from src.superus.windows import SW_SHOWNOACTIVATE, Win32

SESSION_CLASSES = (
    'TFormMenuPrincipal',
    'TFormVendas',
    'TFormPedidos',
    'TFormRelPedidos',
    'TFormPreview',
)
DEFAULT_LAUNCHER = Path(r'C:\Superus\Launcher.exe')
DEFAULT_EXECUTABLE = Path(r'C:\Superus\Superus.exe')


@dataclass(frozen=True)
class StartupSelection:
    method: str
    path: Path | None = None
    hwnd: int | None = None


def existing_session(win32: Win32) -> int | None:
    for class_name in SESSION_CLASSES:
        if hwnd := win32.find_window(class_name):
            return hwnd
    # Algumas builds do SUPERUS usam outra classe no diálogo de logon, mas o
    # título continua contendo "Logon de Usu". Evita iniciar uma segunda sessão.
    try:
        return win32.find_window(title_contains='Logon de Usu')
    except TypeError:  # fakes unitários antigos sem o argumento title_contains
        return None


def executable_candidates(settings: Settings) -> list[tuple[str, Path]]:
    candidates: list[tuple[str, Path]] = []
    if settings.superus_launcher_path:
        candidates.append(('launcher', settings.superus_launcher_path))
    candidates.append(('launcher', DEFAULT_LAUNCHER))
    if settings.superus_executable_path:
        candidates.append(('superus_executable', settings.superus_executable_path))
    candidates.append(('superus_executable', DEFAULT_EXECUTABLE))
    # preserva ordem, remove duplicados
    unique: list[tuple[str, Path]] = []
    seen: set[str] = set()
    for method, path in candidates:
        key = os.path.normcase(str(path))
        if key not in seen:
            unique.append((method, path))
            seen.add(key)
    return unique


def select_startup(win32: Win32, settings: Settings) -> StartupSelection:
    if hwnd := existing_session(win32):
        return StartupSelection('existing_session', hwnd=hwnd)
    for method, path in executable_candidates(settings):
        if path.exists():
            return StartupSelection(method, path=path)
    return StartupSelection('unavailable')


def _launch_no_activate(path: Path) -> subprocess.Popen | int:
    if owner := current_process_owner():
        return owner.launch(path)
    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    startupinfo.wShowWindow = SW_SHOWNOACTIVATE
    return subprocess.Popen([str(path)], close_fds=True, startupinfo=startupinfo)


def ensure_running(win32: Win32, settings: Settings, timeout: float = 60.0) -> tuple[int, str]:
    selection = select_startup(win32, settings)
    if selection.hwnd:
        return selection.hwnd, selection.method
    if not selection.path:
        raise SuperusError('SUPERUS não encontrado: configure um caminho ou instale Launcher.exe/Superus.exe.')
    _launch_no_activate(selection.path)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if hwnd := existing_session(win32):
            # Mantém janelas do SUPERUS atrás sem ativá-las.
            try:
                win32.send_to_back_no_activate(hwnd)
            except OSError:
                pass
            return hwnd, selection.method
        time.sleep(0.1)
    raise SuperusError('SUPERUS foi iniciado, mas nenhuma janela conhecida apareceu dentro do timeout.')
