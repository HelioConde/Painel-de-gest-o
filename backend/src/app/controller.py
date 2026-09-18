from __future__ import annotations

import argparse
import json
import logging
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

from src.business.planner import DailyPlan, DateSource, build_daily_plan
from src.config.settings import Settings
from src.config.stores import STORES
from src.superus.errors import SuperusError
from src.superus.executor import DailyAutoResult, RealSalesReportClient, execute_daily_auto
from src.superus.launcher import executable_candidates, select_startup
from src.superus.lifecycle import managed_superus_processes
from src.superus.losses_executor import (
    collect_loss_sales_for_run,
    default_stores,
    execute_losses,
    prepare_loss_collection_screen,
)
from src.supabase.loss_payload import write_loss_payload_preview
from src.supabase.loss_sync import sync_loss_run
from src.supabase.payload import write_sales_payload_preview
from src.supabase.sales_sync import sync_sales_run
from src.supabase.client import SupabaseRestClient, classify_supabase_key
from src.superus.sales_report import inspect_sales_report as dump_sales_report
from src.superus.windows import Win32


def parse_date(value: str) -> str:
    try:
        return datetime.strptime(value, '%d/%m/%Y').strftime('%d/%m/%Y')
    except ValueError as error:
        raise argparse.ArgumentTypeError('Use data no formato DD/MM/AAAA.') from error


def parse_date_obj(value: str) -> date:
    return datetime.strptime(parse_date(value), '%d/%m/%Y').date()


def parse_iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError('Use data no formato YYYY-MM-DD.') from error


def _diagnostic_directory() -> tuple[str, Path]:
    run_id = f'{datetime.now(UTC):%Y%m%dT%H%M%S}_{uuid4().hex[:8]}'
    directory = Path(__file__).resolve().parents[2] / 'data' / 'diagnostics' / run_id
    directory.mkdir(parents=True, exist_ok=False)
    return run_id, directory


def _logger(destination: Path) -> logging.Logger:
    destination.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(f'superus.{destination.name}')
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    formatter = logging.Formatter('%(asctime)s.%(msecs)03d | %(levelname)s | %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
    file_handler = logging.FileHandler(destination / 'automation.log', encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    return logger


def inspect_superus() -> int:
    run_id, directory = _diagnostic_directory()
    win32 = Win32()
    classes = (
        'TFormMenuPrincipal',
        'TFormVendas',
        'TFormPedidos',
        'TFormRelPedidos',
        'TFormPreview',
        'TFormMensagem',
        'TFormRelEstMin_ProdEstrategico',
    )
    payload: dict[str, object] = {
        'run_id': run_id,
        'windows': [],
        'background': win32.audit.as_dict(),
    }
    for class_name in classes:
        hwnd = win32.find_window(class_name)
        if hwnd:
            payload['windows'].append({'class': class_name, 'hwnd': hwnd, 'title': win32.text(hwnd)})  # type: ignore[union-attr]
            win32.dump_controls(hwnd, directory / f'{class_name}_controls.json')
    (directory / 'run.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def inspect_sales_report() -> int:
    _, directory = _diagnostic_directory()
    win32 = Win32()
    try:
        dump_sales_report(win32, directory / 'sales_controls.json')
    except SuperusError as error:
        print(str(error))
        return 2
    print(f'Diagnóstico de vendas criado em {directory}')
    return 0


def inspect_environment() -> int:
    settings = Settings.from_environment()
    win32 = Win32()
    selection = select_startup(win32, settings)
    payload = {
        'superus_session': selection.method == 'existing_session',
        'windows': [
            {'class': class_name, 'hwnd': hwnd}
            for class_name in (
                'TFormMenuPrincipal',
                'TFormVendas',
                'TFormPedidos',
                'TFormRelPedidos',
                'TFormPreview',
            )
            if (hwnd := win32.find_window(class_name))
        ],
        'candidates': [
            {'method': method, 'path': str(path), 'exists': path.exists()}
            for method, path in executable_candidates(settings)
        ],
        'selected_startup_method': selection.method,
        'store_mapping': {code: store.superus_code for code, store in STORES.items()},
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def _print_plan(plan: DailyPlan) -> None:
    print(f'reference_date: {plan.reference_date.isoformat()}')
    print(f'date_source: {plan.date_source.value}')
    for index, job in enumerate(plan.jobs, start=1):
        print()
        print(f'{index}. {job.kind.value} ({job.slug})')
        print(f'   current: {job.current_period.start.isoformat()} -> {job.current_period.end.isoformat()}')
        print(f'   previous: {job.previous_period.start.isoformat()} -> {job.previous_period.end.isoformat()}')
        if mode := job.metadata.get('mode'):
            print(f'   mode: {mode}')
        if name := job.metadata.get('name'):
            print(f'   name: {name}')
        print(f'   metric: {job.metric}')
        print(f'   unit: {job.unit or "-"}')


def plan_daily(today: date | None) -> int:
    reference_date = today or datetime.now(UTC).astimezone().date()
    date_source = DateSource.CLI_OVERRIDE if today else DateSource.AUTO_SYSTEM_DATE
    _print_plan(build_daily_plan(reference_date, date_source))
    return 0


def _print_daily_auto_result(result: DailyAutoResult) -> None:
    print(f'run_id: {result.run_id}')
    print(f'run_dir: {result.run_dir}')
    print(f'status: {result.status}')
    print(f'reference_date: {result.plan.reference_date.isoformat()}')
    print(f'date_source: {result.plan.date_source.value}')
    print(f'session: {result.session}')
    print(f'startup: {result.startup}')
    print(f'login: {result.login}')
    print(f'report_window: {result.report_window}')
    print(f'background: {result.background}')
    for collection in result.collections:
        print()
        print(f'{collection.job_id} {collection.side}: {collection.status}')
        print(f'  file: {collection.file}')
        print(
            f'  requested: {collection.requested_period.start.isoformat()} -> '
            f'{collection.requested_period.end.isoformat()}'
        )
        if collection.size is not None:
            print(f'  size: {collection.size}')
        if collection.sha256:
            print(f'  sha256: {collection.sha256}')
        if collection.validation:
            print(f'  validation: {collection.validation}')
        if collection.error:
            print(f'  error: {collection.error}')


@managed_superus_processes
def run_daily_auto(
    today: date | None,
    dry_run: bool,
    only_job: str | None,
    *,
    sync: bool = False,
) -> int:
    reference_date = today or datetime.now(UTC).astimezone().date()
    date_source = DateSource.CLI_OVERRIDE if today else DateSource.AUTO_SYSTEM_DATE
    settings = Settings.from_environment()
    client = None if dry_run else RealSalesReportClient(settings)
    result = execute_daily_auto(
        reference_date=reference_date,
        date_source=date_source,
        data_root=Path(__file__).resolve().parents[2] / 'data',
        client=client,
        dry_run=dry_run,
        only_job=only_job,
    )
    _print_daily_auto_result(result)
    if result.status == 'DRY_RUN':
        return 0
    if result.status != 'PASS':
        return 2

    try:
        preview_path = write_sales_payload_preview(result.run_dir)
    except Exception as error:
        print('SALES PAYLOAD: FAIL')
        print(f'error: {type(error).__name__}: {error}')
        return 3

    print()
    print('SALES PAYLOAD: PASS')
    print(f'payload_preview: {preview_path}')
    if not sync:
        print('supabase: SKIPPED (use --sync para enviar)')
        return 0

    try:
        sync_result = sync_sales_run(result.run_dir, settings)
    except Exception as error:
        print('SALES SUPABASE SYNC: FAIL')
        print(f'error: {type(error).__name__}: {error}')
        return 4

    print('SALES SUPABASE SYNC: PASS')
    print(f"table: {sync_result['table']}")
    print(f"snapshots: {sync_result['snapshot_count']}")
    print(
        f"read_back: {len(sync_result['read_back'])}/"
        f"{sync_result['snapshot_count']} PASS"
    )
    print(f"sync_file: {sync_result['sync_file']}")
    return 0


def _parse_stores(value: str | None) -> list[str]:
    if not value:
        return default_stores()
    stores = [item.strip().zfill(3) for item in value.split(',') if item.strip()]
    invalid = [item for item in stores if item not in STORES]
    if invalid:
        raise argparse.ArgumentTypeError(f'Lojas inválidas: {invalid}')
    return stores


@managed_superus_processes
def run_losses_auto(
    start: str,
    end: str,
    stores_text: str | None,
    *,
    sync: bool = False,
) -> int:
    start_date = parse_date_obj(start)
    end_date = parse_date_obj(end)
    stores = _parse_stores(stores_text)
    data_root = Path(__file__).resolve().parents[2] / 'data'
    provisional = data_root / 'logs'
    logger = _logger(provisional)
    settings = Settings.from_environment()
    result = execute_losses(
        start=start_date,
        end=end_date,
        stores=stores,
        data_root=data_root,
        settings=settings,
        logger=logger,
        collect_sales=True,
    )
    print(f'run_id: {result.run_id}')
    print(f'run_dir: {result.run_dir}')
    print(f'status: {result.status}')
    print(f'background: {result.background}')
    for item in result.collections:
        print(f'{item.store} {item.side}: {item.status} file={item.file or "-"}')
    if result.sales_collections:
        for item in result.sales_collections:
            print(
                f'sales {item.side}: {item.status} file={item.file} '
                f'period={item.start.isoformat()}->{item.end.isoformat()}'
            )
    if result.error:
        print(f'error: {result.error}')
    if result.diagnostic_files:
        print('diagnostics:')
        for name, path in result.diagnostic_files.items():
            print(f'  {name}: {path}')

    if result.status != 'PASS':
        return 2

    preview_path = write_loss_payload_preview(result.run_dir)
    print(f'payload_preview: {preview_path}')

    if not sync:
        print('supabase: SKIPPED (use --sync para enviar)')
        return 0

    try:
        sync_result = sync_loss_run(result.run_dir, settings)
    except Exception as error:
        print('supabase: FAIL')
        print(f'supabase_error: {type(error).__name__}: {error}')
        return 3

    print('supabase: PASS')
    print(f"supabase_table: {sync_result['table']}")
    print(f"supabase_store_count: {sync_result['store_count']}")
    print(f"supabase_read_back: {len(sync_result['read_back'])}/{sync_result['store_count']} PASS")
    print(f"supabase_sync_file: {sync_result['sync_file']}")
    return 0


def collect_one(store_code: str, start: str, end: str, stop_before_generate: bool) -> int:
    if stop_before_generate:
        start_date = parse_date_obj(start)
        end_date = parse_date_obj(end)
        logger = _logger(Path(__file__).resolve().parents[2] / 'data' / 'logs')
        result = prepare_loss_collection_screen(
            start=start_date,
            end=end_date,
            store=store_code,
            settings=Settings.from_environment(),
            logger=logger,
        )
        print('STOPPED_BEFORE_GENERATE: PASS')
        print(f"report_hwnd: {result['report_hwnd']}")
        print(f"store: {result['store']}")
        print(f"period: {result['start']} -> {result['end']}")
        print(f"background: {result['background']}")
        print('A TFormRelPedidos foi configurada e deixada aberta antes de gerar o relatório.')
        return 0
    return run_losses_auto(start, end, store_code, sync=False)



def _sales_run_dir(value: str, *, latest: bool = False) -> Path:
    root = Path(__file__).resolve().parents[2] / 'data' / 'runs'
    if latest:
        candidates = [path for path in root.iterdir() if path.is_dir()] if root.exists() else []
        if not candidates:
            raise FileNotFoundError(f'Nenhum run de vendas encontrado em {root}.')
        return max(candidates, key=lambda path: path.stat().st_mtime)

    candidate = Path(value)
    if candidate.is_dir():
        return candidate
    candidate = root / value
    if not candidate.is_dir():
        raise FileNotFoundError(f'Run de vendas não encontrado: {value}')
    return candidate


def build_sales_payload_command(run_id: str) -> int:
    try:
        run_dir = _sales_run_dir(run_id)
        path = write_sales_payload_preview(run_dir)
    except Exception as error:
        print('SALES PAYLOAD: FAIL')
        print(f'error: {type(error).__name__}: {error}')
        return 3
    print('SALES PAYLOAD: PASS')
    print(f'run_dir: {run_dir}')
    print(f'payload_preview: {path}')
    return 0


def sync_sales_run_command(run_id: str | None = None, *, latest: bool = False) -> int:
    try:
        run_dir = _sales_run_dir(run_id or '', latest=latest)
        result = sync_sales_run(run_dir, Settings.from_environment())
    except Exception as error:
        print('SALES SUPABASE SYNC: FAIL')
        print(f'error: {type(error).__name__}: {error}')
        return 3

    print('SALES SUPABASE SYNC: PASS')
    print(f'run_id: {result["run_id"]}')
    print(f'reference_date: {result["reference_date"]}')
    print(f'table: {result["table"]}')
    print(f'snapshots: {result["snapshot_count"]}')
    print(f'read_back: {len(result["read_back"])}/{result["snapshot_count"]} PASS')
    print(f'payload_preview: {result["payload_preview"]}')
    print(f'sync_file: {result["sync_file"]}')
    return 0


def check_sales_supabase_command() -> int:
    settings = Settings.from_environment()
    try:
        url, key = settings.require_supabase()
        info = classify_supabase_key(key)
        print('SALES SUPABASE CHECK')
        print(f'url: {url}')
        print(f'table: {settings.supabase_sales_table}')
        print(f'key_type: {info["label"]}')
        print(f'postgres_role_expected: {info["postgres_role"] or "-"}')
        print(f'rls_bypass_expected: {"YES" if info["privileged"] else "NO"}')
        client = SupabaseRestClient(url=url, key=key, timeout=settings.supabase_timeout)
        rows = client.select(settings.supabase_sales_table, select='snapshot_key', filters={}, limit=1)
        print(f'connection_select: PASS rows={len(rows)}')
        print('SALES SUPABASE CHECK: PASS')
        return 0
    except Exception as error:
        print('SALES SUPABASE CHECK: FAIL')
        print(f'error: {type(error).__name__}: {error}')
        return 3


def _loss_run_dir(value: str, *, latest: bool = False) -> Path:
    root = Path(__file__).resolve().parents[2] / 'data' / 'loss_runs'
    if latest:
        candidates = [path for path in root.iterdir() if path.is_dir()] if root.exists() else []
        if not candidates:
            raise FileNotFoundError(f'Nenhum run de perdas encontrado em {root}.')
        return max(candidates, key=lambda path: path.stat().st_mtime)

    candidate = Path(value)
    if candidate.is_dir():
        return candidate
    candidate = root / value
    if not candidate.is_dir():
        raise FileNotFoundError(f'Run de perdas não encontrado: {value}')
    return candidate


@managed_superus_processes
def collect_loss_sales_command(run_id: str, *, sync: bool = False) -> int:
    try:
        run_dir = _loss_run_dir(run_id)
        settings = Settings.from_environment()
        items = collect_loss_sales_for_run(
            run_dir=run_dir,
            settings=settings,
            logger=None,
        )
        preview_path = write_loss_payload_preview(run_dir)
    except Exception as error:
        print('LOSS SALES CONTEXT: FAIL')
        print(f'error: {type(error).__name__}: {error}')
        return 2

    print('LOSS SALES CONTEXT: PASS')
    print(f'run_dir: {run_dir}')
    for item in items:
        print(
            f'{item.side}: PASS period={item.start.isoformat()}->{item.end.isoformat()} '
            f'file={item.file}'
        )
    print(f'payload_preview: {preview_path}')

    if not sync:
        print('supabase: SKIPPED (use --sync para atualizar o snapshot)')
        return 0

    try:
        result = sync_loss_run(run_dir, settings)
    except Exception as error:
        print('supabase: FAIL')
        print(f'supabase_error: {type(error).__name__}: {error}')
        return 3

    print('supabase: PASS')
    print(f"read_back: {len(result['read_back'])}/{result['store_count']} PASS")
    print(f"sync_file: {result['sync_file']}")
    return 0


def build_loss_payload_command(run_id: str) -> int:
    run_dir = _loss_run_dir(run_id)
    path = write_loss_payload_preview(run_dir)
    print('LOSS PAYLOAD: PASS')
    print(f'run_dir: {run_dir}')
    print(f'payload_preview: {path}')
    return 0


def sync_loss_run_command(run_id: str | None = None, *, latest: bool = False) -> int:
    try:
        run_dir = _loss_run_dir(run_id or '', latest=latest)
        result = sync_loss_run(run_dir, Settings.from_environment())
    except Exception as error:
        print('LOSS SUPABASE SYNC: FAIL')
        print(f'error: {type(error).__name__}: {error}')
        return 3

    print('LOSS SUPABASE SYNC: PASS')
    print(f'run_id: {result["run_id"]}')
    print(f'table: {result["table"]}')
    print(f'stores: {result["store_count"]}')
    print(f'read_back: {len(result["read_back"])}/{result["store_count"]} PASS')
    print(f'payload_preview: {result["payload_preview"]}')
    print(f'sync_file: {result["sync_file"]}')
    return 0


def check_supabase_command() -> int:
    """Diagnóstico seguro: nunca imprime a chave completa."""
    settings = Settings.from_environment()
    try:
        url, key = settings.require_supabase()
        info = classify_supabase_key(key)
        print('SUPABASE CHECK')
        print(f'url: {url}')
        print(f'table: {settings.supabase_loss_table}')
        print(f'key_type: {info["label"]}')
        print(f'postgres_role_expected: {info["postgres_role"] or "-"}')
        print(f'rls_bypass_expected: {"YES" if info["privileged"] else "NO"}')

        client = SupabaseRestClient(
            url=url,
            key=key,
            timeout=settings.supabase_timeout,
        )
        # SELECT sem mutação só para confirmar URL/chave/tabela.
        rows = client.select(
            settings.supabase_loss_table,
            select='id',
            filters={},
            limit=1,
        )
        print(f'connection_select: PASS rows={len(rows)}')
        print('SUPABASE CHECK: PASS')
        return 0
    except Exception as error:
        print('SUPABASE CHECK: FAIL')
        print(f'error: {type(error).__name__}: {error}')
        return 3


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Painel de Gestão — automação background do SUPERUS.')
    parser.add_argument('--inspect-superus', action='store_true')
    parser.add_argument('--inspect-environment', action='store_true')
    parser.add_argument('--inspect-sales-report', action='store_true')
    parser.add_argument('--plan', action='store_true')
    parser.add_argument('--today', type=parse_iso_date)
    parser.add_argument('--daily-auto', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--only-job', choices=('daily', 'monthly', 'event', 'monthly_close'))
    parser.add_argument('--losses-auto', action='store_true')
    parser.add_argument('--losses-gui', action='store_true')
    parser.add_argument('--sync', action='store_true', help='Sincroniza no Supabase após coleta/payload PASS.')
    parser.add_argument('--build-sales-payload', metavar='RUN_ID')
    parser.add_argument('--sync-sales-run', metavar='RUN_ID')
    parser.add_argument('--sync-latest-sales-run', action='store_true')
    parser.add_argument('--check-sales-supabase', action='store_true', help='Valida a tabela de vendas no Supabase sem gravar dados.')
    parser.add_argument('--collect-loss-sales', metavar='RUN_ID', help='Coleta vendas current/previous para enriquecer um run de Perdas existente.')
    parser.add_argument('--build-loss-payload', metavar='RUN_ID')
    parser.add_argument('--sync-loss-run', metavar='RUN_ID')
    parser.add_argument('--sync-latest-loss-run', action='store_true')
    parser.add_argument('--check-supabase', action='store_true', help='Valida URL/tabela/tipo da chave sem gravar dados.')
    parser.add_argument('--collect-one', action='store_true')
    parser.add_argument('--loja')
    parser.add_argument('--lojas')
    parser.add_argument('--inicio', type=parse_date)
    parser.add_argument('--fim', type=parse_date)
    parser.add_argument('--stop-before-generate', action='store_true')
    args = parser.parse_args(argv)

    if args.inspect_superus:
        return inspect_superus()
    if args.inspect_environment:
        return inspect_environment()
    if args.inspect_sales_report:
        return inspect_sales_report()
    if args.plan:
        return plan_daily(args.today)
    if args.daily_auto:
        return run_daily_auto(args.today, args.dry_run, args.only_job, sync=args.sync)
    if args.build_sales_payload:
        return build_sales_payload_command(args.build_sales_payload)
    if args.sync_sales_run:
        return sync_sales_run_command(args.sync_sales_run)
    if args.sync_latest_sales_run:
        return sync_sales_run_command(latest=True)
    if args.check_sales_supabase:
        return check_sales_supabase_command()
    if args.collect_loss_sales:
        return collect_loss_sales_command(args.collect_loss_sales, sync=args.sync)
    if args.build_loss_payload:
        return build_loss_payload_command(args.build_loss_payload)
    if args.sync_loss_run:
        return sync_loss_run_command(args.sync_loss_run)
    if args.sync_latest_loss_run:
        return sync_loss_run_command(latest=True)
    if args.check_supabase:
        return check_supabase_command()
    if args.losses_gui:
        from src.app.gui import open_losses_window

        open_losses_window(sync=args.sync)
        return 0
    if args.losses_auto:
        if not args.inicio or not args.fim:
            parser.error('--losses-auto exige --inicio e --fim.')
        return run_losses_auto(args.inicio, args.fim, args.lojas, sync=args.sync)
    if args.collect_one:
        if not all((args.loja, args.inicio, args.fim)):
            parser.error('--collect-one exige --loja, --inicio e --fim.')
        return collect_one(args.loja, args.inicio, args.fim, args.stop_before_generate)
    parser.print_help()
    return 0


def initialize() -> Settings:
    return Settings.from_environment()
