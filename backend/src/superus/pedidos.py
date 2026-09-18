from __future__ import annotations

import logging

from src.superus.errors import ControlNotFoundError
from src.superus.login import cancel_stock_dialog_if_present
from src.superus.windows import Win32


def open_pedidos(win32: Win32, menu: int, logger: logging.Logger | None = None) -> int:
    if hwnd := win32.find_window('TFormPedidos'):
        return hwnd
    cancel_stock_dialog_if_present(win32)
    with win32.background_step('abrir_pedidos_menu', logger):
        win32.select_menu_path(menu, 'Faturamento', 'Pedidos', timeout=15)
    return win32.wait(lambda: win32.find_window('TFormPedidos'), 30, 'TFormPedidos')


def ensure_stock_dialog_closed(win32: Win32) -> None:
    if win32.find_window('TFormRelEstMin_ProdEstrategico'):
        if not cancel_stock_dialog_if_present(win32):
            raise ControlNotFoundError('Não foi possível tratar o popup de estoque mínimo.')
