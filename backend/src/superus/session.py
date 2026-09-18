from __future__ import annotations

import logging
from dataclasses import dataclass

from src.config.settings import Settings
from src.superus.launcher import ensure_running, select_startup
from src.superus.login import cancel_stock_dialog_if_present, ensure_menu, find_login, login_if_present
from src.superus.windows import Win32


@dataclass(frozen=True)
class SessionReady:
    menu_hwnd: int
    startup: str
    existing_session: bool
    login: str


def prepare_superus(win32: Win32, settings: Settings, logger: logging.Logger | None = None) -> SessionReady:
    selection = select_startup(win32, settings)
    existing = selection.method == 'existing_session'
    _, startup = ensure_running(win32, settings)
    login_state = 'NOT_NEEDED'
    if find_login(win32):
        if login_if_present(win32, settings):
            login_state = 'PERFORMED'
    cancel_stock_dialog_if_present(win32)
    # Sempre aguarda o menu ficar estável. Isso preserva o comportamento da
    # automação antiga e evita ler o TMainMenu antes de ele ser populado.
    menu = ensure_menu(win32, timeout=60)
    try:
        win32.send_to_back_no_activate(menu)
    except OSError:
        pass
    if logger:
        logger.info(
            '[SUPERUS] session ready startup=%s existing=%s login=%s menu=0x%X',
            startup,
            existing,
            login_state,
            menu,
        )
    return SessionReady(menu, startup, existing, login_state)
