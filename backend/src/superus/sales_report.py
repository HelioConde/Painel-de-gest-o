from __future__ import annotations

import logging
from dataclasses import asdict
from pathlib import Path

from src.business.periods import ReportPeriod
from src.config.settings import Settings
from src.superus.errors import ControlStateError, WindowNotFoundError
from src.superus.export_html import export_preview_as_htm
from src.superus.preview import cleanup_export_state, close_preview, preview_hwnds, wait_preview_or_no_data
from src.superus.windows import BM_GETCHECK, BST_CHECKED, Win32

SALES_WINDOW_CLASS = 'TFormVendas'


def find_sales_report(win32: Win32) -> int | None:
    return win32.find_window(SALES_WINDOW_CLASS)


def inspect_sales_report(win32: Win32, destination: Path) -> int:
    report = find_sales_report(win32)
    if not report:
        raise WindowNotFoundError('Relatório de Vendas (TFormVendas) não encontrado.')
    controls = win32.dump_controls(report, destination)
    destination.write_text(
        __import__('json').dumps(
            {'window_hwnd': report, 'window_class': SALES_WINDOW_CLASS, 'controls': [asdict(item) for item in controls]},
            ensure_ascii=False,
            indent=2,
        ),
        encoding='utf-8',
    )
    return report


def open_sales_report(win32: Win32, menu: int, logger: logging.Logger | None = None) -> int:
    if report := find_sales_report(win32):
        return report
    with win32.background_step('abrir_vendas_menu', logger):
        win32.select_menu_path(menu, 'Vendas', 'Vendas', timeout=15)
    return win32.wait(lambda: find_sales_report(win32), 30, 'TFormVendas')


def _ensure_checked(
    win32: Win32,
    report: int,
    class_name: str,
    instance: int,
    expected_text: str,
) -> int:
    control = win32.control_by_instance_or_text(report, class_name, instance, expected_text)
    win32.set_checked(control, True)
    if win32.send(control.hwnd, BM_GETCHECK) != BST_CHECKED:
        raise ControlStateError(f'{expected_text} não ficou marcado.')
    return control.hwnd


def _select_group(win32: Win32, report: int, text: str) -> int:
    control = win32.control_by_text(report, 'TGroupButton', text)
    win32.virtual_click(control.hwnd)
    return control.hwnd


def configure_base_sales(win32: Win32, report: int, logger: logging.Logger | None = None) -> None:
    """Configuração comprovada para Sintético por SubGrupo / Todas Vendas.

    Os eventos também coletam este bruto completo. Filtros especiais como
    PIZZARIA/PADARIA são aplicados na camada de negócio, evitando redescobrir
    controles frágeis e mantendo uma única automação confiável.
    """
    with win32.background_step('configurar_vendas_subgrupo', logger):
        _ensure_checked(win32, report, 'TRadioButton', 16, 'Setorizacao')
        _ensure_checked(win32, report, 'TCheckBox', 8, 'Por Loja')
        _select_group(win32, report, 'Todas Vendas')
        _select_group(win32, report, 'SubGrupo')


def set_sales_period(win32: Win32, report: int, period: ReportPeriod) -> None:
    start = win32.control_by_instance(report, 'TSimusDateTimePicker', 2)
    end = win32.control_by_instance(report, 'TSimusDateTimePicker', 1)
    # O VCL pode manter readback visual antigo; o cabeçalho do HTM é o quality gate definitivo.
    win32.set_text(start.hwnd, period.start.strftime('%d/%m/%Y'), verify=False)
    win32.set_text(end.hwnd, period.end.strftime('%d/%m/%Y'), verify=False)


def generate_sales_report(win32: Win32, report: int) -> None:
    ok = win32.control_by_instance(report, 'TBitBtn', 2)
    win32.click(ok.hwnd)


def collect_sales_htm(
    win32: Win32,
    report: int,
    period: ReportPeriod,
    destination: Path,
    settings: Settings,
    logger: logging.Logger | None = None,
) -> Path:
    if destination.exists():
        raise ControlStateError(f'Fresh collection recusou arquivo já existente: {destination}')
    cleanup_export_state(win32)
    configure_base_sales(win32, report, logger)
    set_sales_period(win32, report, period)
    existing = preview_hwnds(win32)
    with win32.background_step(
        f'coletar_vendas_{period.start:%Y%m%d}_{period.end:%Y%m%d}', logger
    ):
        generate_sales_report(win32, report)
    result = wait_preview_or_no_data(
        win32,
        existing_hwnds=existing,
        timeout=settings.superus_preview_timeout,
    )
    if result.no_data or not result.hwnd:
        raise ControlStateError(f'Relatório de vendas sem dados: {result.message or "sem preview"}')
    try:
        with win32.background_step('exportar_preview_html', logger):
            return export_preview_as_htm(win32, result.hwnd, destination, settings)
    finally:
        close_preview(win32)
        win32.wait(lambda: find_sales_report(win32), 30, 'retorno ao TFormVendas')
