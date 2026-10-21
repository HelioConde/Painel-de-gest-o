from __future__ import annotations

import os
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from src.config.settings import Settings
from src.superus.errors import SuperusError
from src.superus.lifecycle import current_process_owner
from src.superus.windows import SW_SHOWNOACTIVATE, WM_CLOSE, Win32

SESSION_CLASSES = (
    'TFormMenuPrincipal',
    'TFormVendas',
    'TFormPedidos',
    'TFormRelPedidos',
    'TFormPreview',
)
DEFAULT_LAUNCHER = Path(r'C:\Superus\Launcher.exe')
DEFAULT_EXECUTABLE = Path(r'C:\Superus\Superus.exe')
SUPERUS_PROCESS_NAMES = ('Superus.exe', 'Launcher.exe')


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


def _session_windows(win32: Win32) -> list[int]:
    windows: list[int] = []
    for class_name in SESSION_CLASSES:
        if hwnd := win32.find_window(class_name):
            windows.append(hwnd)
    try:
        if hwnd := win32.find_window(title_contains='Logon de Usu'):
            windows.append(hwnd)
    except TypeError:  # fakes unitários antigos sem o argumento title_contains
        pass
    return list(dict.fromkeys(windows))


def _running_superus_processes(runner: object = subprocess.run) -> set[str]:
    """Retorna apenas processos conhecidos do SUPERUS ainda ativos."""
    completed = runner(  # type: ignore[operator]
        ['tasklist', '/FO', 'CSV', '/NH'],
        capture_output=True,
        text=True,
        check=False,
    )
    listing = str(getattr(completed, 'stdout', '')).casefold()
    return {
        name for name in SUPERUS_PROCESS_NAMES
        if f'"{name.casefold()}"' in listing
    }


def close_preexisting_superus(
    win32: Win32,
    *,
    timeout: float = 12.0,
    sleep: object = time.sleep,
    runner: object = subprocess.run,
) -> bool:
    """Fecha qualquer sessão anterior antes de iniciar uma coleta nova.

    O agendador não deve reutilizar uma tela deixada aberta manualmente: os
    controles e filtros podem estar em um estado diferente do esperado. Tenta
    primeiro o fechamento normal das janelas e só força os executáveis oficiais
    que continuarem vivos. A rotina é idempotente quando o SUPERUS não está em
    execução.
    """
    windows = _session_windows(win32)
    processes = _running_superus_processes(runner)
    if not windows and not processes:
        return False

    for hwnd in windows:
        try:
            win32.post_if_present(hwnd, WM_CLOSE)
        except OSError:
            pass

    deadline = time.monotonic() + timeout / 2
    while time.monotonic() < deadline:
        if not _session_windows(win32) and not _running_superus_processes(runner):
            return True
        sleep(0.2)  # type: ignore[operator]

    # Uma sessão modal pode impedir o WM_CLOSE. Neste caso encerramos somente
    # os binários oficiais do SUPERUS antes de uma nova coleta limpa.
    for name in _running_superus_processes(runner):
        runner(  # type: ignore[operator]
            ['taskkill', '/IM', name, '/T', '/F'],
            capture_output=True,
            text=True,
            check=False,
        )

    deadline = time.monotonic() + timeout / 2
    while time.monotonic() < deadline:
        if not _session_windows(win32) and not _running_superus_processes(runner):
            return True
        sleep(0.2)  # type: ignore[operator]

    raise SuperusError('Não foi possível fechar a sessão anterior do SUPERUS antes da coleta.')


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
