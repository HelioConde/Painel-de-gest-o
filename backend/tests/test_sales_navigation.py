from __future__ import annotations

import pytest

from src.superus.errors import WindowNotFoundError
from src.superus.navigation import (
    WM_COMMAND,
    MenuItem,
    find_menu_path,
    normalize_menu_text,
    send_sales_menu_command,
)


def _item(level: int, path: tuple[str, ...], command_id: int | None = None) -> MenuItem:
    return MenuItem(
        level=level,
        path=path,
        text_raw=path[-1] if path else '',
        text_normalized=path[-1] if path else '',
        command_id=command_id,
        enabled=True,
        checked=False,
        separator=False,
        submenu_handle=None,
    )


class FakeWin32:
    def __init__(self, sales_hwnd: int | None) -> None:
        self.sales_hwnd = sales_hwnd
        self.sent: list[tuple[int, int, int, int]] = []

    def send(self, hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> int:
        self.sent.append((hwnd, message, wparam, lparam))
        return 1

    def find_window(self, class_name: str, title: str | None = None) -> int | None:
        del title
        if class_name == 'TFormVendas':
            return self.sales_hwnd
        return None

    def wait(self, predicate, timeout: float, description: str) -> int:
        del timeout
        value = predicate()
        if value:
            return value
        raise WindowNotFoundError(f'{description} não apareceu.')


def test_menu_text_normalization() -> None:
    assert normalize_menu_text('&Vendas') == 'Vendas'
    assert normalize_menu_text(' Vendas\tF9 ') == 'Vendas'


def test_find_sales_menu_path_hierarchically() -> None:
    items = [
        _item(0, ('Cadastros',)),
        _item(1, ('Cadastros', 'Vendas'), 10),
        _item(0, ('Vendas',)),
        _item(1, ('Vendas', 'Vendas'), 35),
    ]

    match = find_menu_path(items, ('Vendas', 'Vendas'))

    assert match is not None
    assert match.command_id == 35


def test_does_not_confuse_child_from_other_submenu() -> None:
    items = [_item(0, ('Cadastros',)), _item(1, ('Cadastros', 'Vendas'), 10)]

    assert find_menu_path(items, ('Vendas', 'Vendas')) is None


def test_missing_menu_item_fails_closed() -> None:
    assert find_menu_path([], ('Vendas', 'Vendas')) is None


def test_getmenu_without_menu_is_fail_closed() -> None:
    assert find_menu_path([_item(0, ('Vendas',), None)], ('Vendas', 'Vendas')) is None


def test_wm_command_success_requires_tformvendas() -> None:
    win32 = FakeWin32(sales_hwnd=1234)

    hwnd = send_sales_menu_command(win32, menu_hwnd=99, command_id=35, timeout=0)

    assert hwnd == 1234
    assert win32.sent == [(99, WM_COMMAND, 35, 0)]


def test_wm_command_send_is_not_success_without_tformvendas() -> None:
    win32 = FakeWin32(sales_hwnd=None)

    with pytest.raises(WindowNotFoundError):
        send_sales_menu_command(win32, menu_hwnd=99, command_id=35, timeout=0)

    assert win32.sent == [(99, WM_COMMAND, 35, 0)]
