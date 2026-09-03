import subprocess
from dataclasses import dataclass
from pathlib import Path

from src.config.settings import Settings
from src.superus.errors import SuperusError
from src.superus.windows import Win32

SESSION_CLASSES = ('TFormMenuPrincipal', 'TFormPedidos', 'TFormRelPedidos', 'TFormLogin')
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
    return None


def executable_candidates(settings: Settings) -> list[tuple[str, Path]]:
    candidates: list[tuple[str, Path]] = []
    if settings.superus_launcher_path:
        candidates.append(('launcher', settings.superus_launcher_path))
    candidates.append(('launcher', DEFAULT_LAUNCHER))
    if settings.superus_executable_path:
        candidates.append(('superus_executable', settings.superus_executable_path))
    candidates.append(('superus_executable', DEFAULT_EXECUTABLE))
    return candidates


def select_startup(win32: Win32, settings: Settings) -> StartupSelection:
    if hwnd := existing_session(win32):
        return StartupSelection('existing_session', hwnd=hwnd)
    for method, path in executable_candidates(settings):
        if path.exists():
            return StartupSelection(method, path=path)
    return StartupSelection('unavailable')


def ensure_running(win32: Win32, settings: Settings) -> tuple[int, str]:
    selection = select_startup(win32, settings)
    if selection.hwnd:
        return selection.hwnd, selection.method
    if not selection.path:
        raise SuperusError('SUPERUS não encontrado: configure um caminho ou instale Launcher.exe/Superus.exe.')
    subprocess.Popen([str(selection.path)], close_fds=True)
    hwnd = win32.wait(lambda: existing_session(win32), timeout=30, description='Menu principal ou tela de login')
    return hwnd, selection.method
