from __future__ import annotations

import time
from datetime import date
from pathlib import Path

from src.config.settings import Settings
from src.superus.errors import ControlStateError
from src.superus.export_html import export_preview_as_htm
from src.superus.preview import cleanup_export_state, close_preview, preview_hwnds, wait_preview_or_no_data
from src.superus.windows import BM_GETCHECK, BST_CHECKED, VK_RETURN, WM_KEYDOWN, WM_KEYUP, Win32, comparable_text

WM_SETFOCUS = 0x0007
WM_KILLFOCUS = 0x0008


def _control(win32: Win32, report: int, class_name: str, text: str):
    return win32.control_by_text(report, class_name, text)


def _select_group(win32: Win32, report: int, text: str) -> None:
    deadline = time.monotonic() + 2.0
    while time.monotonic() < deadline:
        control = _control(win32, report, 'TGroupButton', text)
        win32.virtual_click(control.hwnd)
        if win32.send(control.hwnd, BM_GETCHECK) == BST_CHECKED:
            return
        time.sleep(0.12)
    raise ControlStateError(f'Opção {text!r} não ficou selecionada no relatório de Tabloide.')


def _set_checked(win32: Win32, report: int, text: str, desired: bool) -> None:
    control = _control(win32, report, 'TCheckBox', text)
    win32.set_checked(control, desired)


def _select_radio(win32: Win32, report: int, text: str) -> None:
    deadline = time.monotonic() + 2.0
    while time.monotonic() < deadline:
        control = _control(win32, report, 'TRadioButton', text)
        if win32.send(control.hwnd, BM_GETCHECK) == BST_CHECKED:
            return
        win32.virtual_click(control.hwnd)
        if win32.send(control.hwnd, BM_GETCHECK) == BST_CHECKED:
            return
        time.sleep(0.12)
    raise ControlStateError(f'Modo {text!r} não ficou selecionado no relatório de Tabloide.')


def _set_promotion_type(win32: Win32, report: int, promotion_type: int, promotion_name: str) -> None:
    """Preenche o tipo e confirma a resolução do lookup da promoção."""
    code = win32.control_by_instance(report, 'TComboEdit', 5)
    name = win32.control_by_instance(report, 'TRxDBLookupCombo', 13)
    value = str(promotion_type)
    win32.send(code.hwnd, WM_SETFOCUS, 0, 0)
    win32.set_text(code.hwnd, value, verify=False)
    win32.send(code.hwnd, WM_KEYDOWN, VK_RETURN, 0)
    win32.send(code.hwnd, WM_KEYUP, VK_RETURN, 0)
    win32.send(code.hwnd, WM_KILLFOCUS, name.hwnd, 0)
    win32.send(name.hwnd, WM_SETFOCUS, code.hwnd, 0)

    deadline = time.monotonic() + 3.0
    expected = comparable_text(promotion_name)
    while time.monotonic() < deadline:
        if win32.text(code.hwnd).strip() == value and expected in comparable_text(win32.text(name.hwnd)):
            return
        time.sleep(0.1)
    raise ControlStateError(
        'Tipo de promoção não foi confirmado: '
        f'tipo={value!r}, nome_esperado={promotion_name!r}, nome_lido={win32.text(name.hwnd)!r}.'
    )


def configure_tabloid_report(
    win32: Win32,
    report: int,
    *,
    start: date,
    end: date,
    promotion_type: int,
    promotion_name: str,
) -> None:
    """Configuração confirmada no SUPERUS para Vendas por Produtos / TABLOIDE."""
    _select_radio(win32, report, 'Geral')
    # A tela Delphi recria os grupos dependentes do modo após o BM_CLICK.
    time.sleep(0.35)
    _select_group(win32, report, 'Nome')
    _select_group(win32, report, 'Loja')
    _select_group(win32, report, 'Vendas Promoção')
    _set_checked(win32, report, 'Todas Lojas', True)
    _set_promotion_type(win32, report, promotion_type, promotion_name)

    initial = win32.control_by_instance(report, 'TSimusDateTimePicker', 2)
    final = win32.control_by_instance(report, 'TSimusDateTimePicker', 1)
    win32.set_text(initial.hwnd, start.strftime('%d/%m/%Y'), verify=False)
    win32.set_text(final.hwnd, end.strftime('%d/%m/%Y'), verify=False)


def collect_tabloid_htm(
    win32: Win32,
    report: int,
    *,
    start: date,
    end: date,
    promotion_type: int,
    promotion_name: str,
    destination: Path,
    settings: Settings,
) -> Path:
    if destination.exists():
        raise ControlStateError(f'Coleta nova recusou arquivo existente: {destination}')
    cleanup_export_state(win32)
    configure_tabloid_report(
        win32,
        report,
        start=start,
        end=end,
        promotion_type=promotion_type,
        promotion_name=promotion_name,
    )
    existing = preview_hwnds(win32)
    ok = win32.control_by_instance(report, 'TBitBtn', 2)
    win32.click(ok.hwnd)
    result = wait_preview_or_no_data(win32, existing_hwnds=existing, timeout=settings.superus_preview_timeout)
    if result.no_data or not result.hwnd:
        raise ControlStateError(f'Relatório Tabloide sem dados: {result.message or "sem preview"}')
    try:
        return export_preview_as_htm(
            win32,
            result.hwnd,
            destination,
            settings,
            html_x=settings.superus_tabloid_export_html_x,
            html_y=settings.superus_tabloid_export_html_y,
        )
    finally:
        close_preview(win32)
