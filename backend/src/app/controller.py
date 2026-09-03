from __future__ import annotations

import argparse
import json
import logging
import time
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

from src.config.settings import Settings
from src.config.stores import STORES, get_store
from src.superus.launcher import ensure_running, executable_candidates, select_startup
from src.superus.pedidos import cancel_stock_dialog_if_present, open_pedidos
from src.superus.reports import configure_products, open_reports
from src.superus.windows import Win32


def parse_date(value: str) -> str:
    try:
        return date.strptime(value, '%d/%m/%Y').strftime('%d/%m/%Y')
    except ValueError as error:
        raise argparse.ArgumentTypeError('Use data no formato DD/MM/AAAA.') from error


def _run_directory() -> tuple[str, Path]:
    run_id = f'{datetime.now(UTC):%Y%m%dT%H%M%S}_{uuid4().hex[:8]}'
    directory = Path(__file__).resolve().parents[2] / 'data' / 'diagnostics' / run_id
    directory.mkdir(parents=True, exist_ok=False)
    return run_id, directory


def _logger(destination: Path) -> logging.Logger:
    logger = logging.getLogger(f'superus.{destination.name}')
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.addHandler(logging.FileHandler(destination / 'automation.log', encoding='utf-8'))
    return logger


def inspect_superus() -> int:
    run_id, directory = _run_directory()
    win32 = Win32()
    report = win32.find_window('TFormRelPedidos')
    payload = {'run_id': run_id, 'window_found': bool(report), 'background': win32.audit.as_dict()}
    if report:
        win32.dump_controls(report, directory / 'controls.json')
    (directory / 'run.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Diagnóstico criado em {directory}')
    return 0 if report else 2


def inspect_environment() -> int:
    settings = Settings.from_environment()
    win32 = Win32()
    selection = select_startup(win32, settings)
    windows = [
        {'class': class_name, 'hwnd': win32.find_window(class_name)}
        for class_name in ('TFormMenuPrincipal', 'TFormPedidos', 'TFormRelPedidos', 'TFormLogin')
    ]
    payload = {
        'superus_session': selection.method == 'existing_session',
        'windows': [item for item in windows if item['hwnd']],
        'candidates': [
            {'method': method, 'path': str(path), 'exists': path.exists()}
            for method, path in executable_candidates(settings)
        ],
        'selected_startup_method': selection.method,
        'store_mapping': {code: store.superus_code for code, store in STORES.items()},
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def collect_one(store_code: str, start: str, end: str, stop_before_generate: bool) -> int:
    run_id, directory = _run_directory()
    logger = _logger(directory)
    started = time.monotonic()
    win32 = Win32()
    store = get_store(store_code)
    settings = Settings.from_environment()
    payload: dict[str, object] = {
        'run_id': run_id, 'command': 'collect-one', 'store': store.public_code,
        'period_start': start, 'period_end': end, 'superus_used': False,
        'background': win32.audit.as_dict(), 'status': 'FAIL', 'timings': {},
    }
    try:
        internal_store_code = store.superus_code()
        menu, startup_method = ensure_running(win32, settings)
        payload['superus_used'] = True
        payload['startup_source'] = startup_method
        cancel_stock_dialog_if_present(win32)
        pedidos = open_pedidos(win32, menu)
        report = open_reports(win32, pedidos)
        win32.dump_controls(report, directory / 'controls.json')
        configuration = configure_products(win32, report, internal_store_code, start, end)
        (directory / 'pre_generate_state.json').write_text(
            json.dumps(configuration.as_dict(), ensure_ascii=False, indent=2), encoding='utf-8'
        )
        if stop_before_generate:
            payload['status'] = 'STOPPED_BEFORE_GENERATE'
            return 0
        raise RuntimeError('Geração/exportação permanece bloqueada até o inspect comprovar seus controles.')
    except Exception as error:
        logger.exception('Falha sem geração.')
        payload['error'] = str(error)
        return 2
    finally:
        payload['background'] = win32.audit.as_dict()
        payload['timings'] = {'total': round(time.monotonic() - started, 3)}
        (directory / 'run.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Automação background do SUPERUS.')
    parser.add_argument('--inspect-superus', action='store_true')
    parser.add_argument('--inspect-environment', action='store_true')
    parser.add_argument('--collect-one', action='store_true')
    parser.add_argument('--loja')
    parser.add_argument('--inicio', type=parse_date)
    parser.add_argument('--fim', type=parse_date)
    parser.add_argument('--stop-before-generate', action='store_true')
    args = parser.parse_args(argv)
    if args.inspect_superus:
        return inspect_superus()
    if args.inspect_environment:
        return inspect_environment()
    if args.collect_one:
        if not all((args.loja, args.inicio, args.fim)):
            parser.error('--collect-one exige --loja, --inicio e --fim.')
        return collect_one(args.loja, args.inicio, args.fim, args.stop_before_generate)
    parser.print_help()
    return 0


def initialize() -> Settings:
    """Compatibilidade com o smoke test da fundação; não inicia automação."""
    return Settings.from_environment()
