from __future__ import annotations

import hashlib
import json
import logging
import time
import traceback
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

from src.business.periods import ReportPeriod
from src.config.settings import Settings
from src.config.stores import STORES, get_store
from src.parsers.html_report import comparable_text, extract_report_period, read_html, visible_text
from src.quality.raw_report import file_fingerprint, validate_raw_sales_report
from src.superus.errors import ReportValidationError, SuperusError
from src.superus.pedidos import open_pedidos
from src.superus.reports import _safe_control_snapshot, collect_loss_htm, configure_products, open_reports
from src.superus.sales_report import collect_sales_htm, open_sales_report
from src.superus.session import prepare_superus
from src.superus.windows import WM_CLOSE, Win32


@dataclass(frozen=True)
class LossCollection:
    store: str
    side: str
    start: date
    end: date
    file: str | None
    status: str
    size: int | None = None
    sha256: str | None = None
    message: str | None = None


@dataclass(frozen=True)
class LossSalesCollection:
    side: str
    start: date
    end: date
    file: str
    status: str
    size: int
    sha256: str
    validation: dict[str, object]


@dataclass(frozen=True)
class LossRunResult:
    run_id: str
    run_dir: Path
    status: str
    collections: list[LossCollection]
    background: dict[str, int]
    error: str | None = None
    diagnostic_files: dict[str, str] | None = None
    sales_collections: list[LossSalesCollection] | None = None


def previous_year_date(value: date) -> date:
    try:
        return value.replace(year=value.year - 1)
    except ValueError:  # 29/02 -> 28/02
        return value.replace(year=value.year - 1, day=28)


def _fingerprint(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return path.stat().st_size, digest


def validate_loss_html(path: Path, store_code: str, start: date, end: date) -> None:
    content, _ = read_html(path)
    plain = visible_text(content)
    normalized = comparable_text(plain)
    actual_start, actual_end, _ = extract_report_period(content)
    dates_ok = actual_start == start and actual_end == end
    store = get_store(store_code)
    store_ok = (
        comparable_text(store.name) in normalized
        or f' {store.code} ' in f' {normalized} '
    )
    report_ok = any(
        token in normalized
        for token in ('pedidos por mip', 'quantidade/vendas', 'qtd. vendida', 'mip')
    )
    if not (dates_ok and store_ok and report_ok):
        raise ReportValidationError(
            'HTM de perdas inválido '
            f'loja={store_code} datas_ok={dates_ok} '
            f'periodo_detectado={actual_start}->{actual_end} '
            f'loja_ok={store_ok} relatorio_ok={report_ok}'
        )


def _run_id() -> str:
    return f'{datetime.now(UTC):%Y%m%dT%H%M%S}_{uuid4().hex}'



def _attach_run_log(logger: logging.Logger | None, run_dir: Path) -> tuple[logging.Logger, logging.Handler]:
    """Adiciona automation.log dentro do próprio run sem mudar a automação."""
    active = logger or logging.getLogger(f'superus.losses.{run_dir.name}')
    active.setLevel(logging.INFO)
    handler = logging.FileHandler(run_dir / 'automation.log', encoding='utf-8')
    handler.setFormatter(
        logging.Formatter('%(asctime)s.%(msecs)03d | %(levelname)s | %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
    )
    active.addHandler(handler)
    return active, handler


def _failure_diagnostics(
    *,
    win32: Win32,
    run_dir: Path,
    report: int | None,
    error: Exception,
    store: str | None,
    side: str | None,
    period_start: date | None,
    period_end: date | None,
) -> dict[str, str]:
    files: dict[str, str] = {}
    failure = {
        'exception_type': type(error).__name__,
        'error': str(error),
        'traceback': traceback.format_exc(),
        'store': store,
        'side': side,
        'period_start': period_start.isoformat() if period_start else None,
        'period_end': period_end.isoformat() if period_end else None,
        'background': win32.audit.as_dict(),
        'timestamp_utc': datetime.now(UTC).isoformat(),
    }

    windows = []
    for class_name in (
        'TFormMenuPrincipal', 'TFormPedidos', 'TFormRelPedidos',
        'TFormPreview', 'TFormMensagem', 'TFormRelEstMin_ProdEstrategico',
    ):
        try:
            hwnd = win32.find_window(class_name, visible_only=False)
            if hwnd:
                windows.append({
                    'class': class_name,
                    'hwnd': hwnd,
                    'title': win32.text(hwnd),
                })
        except Exception as exc:
            windows.append({'class': class_name, 'probe_error': f'{type(exc).__name__}: {exc}'})
    failure['windows'] = windows

    if report:
        try:
            failure['critical_controls'] = _safe_control_snapshot(win32, report)
        except Exception as exc:
            failure['critical_controls_error'] = f'{type(exc).__name__}: {exc}'
        try:
            controls_path = run_dir / 'controls_failure.json'
            win32.dump_controls(report, controls_path)
            files['controls_failure'] = str(controls_path)
        except Exception as exc:
            failure['controls_dump_error'] = f'{type(exc).__name__}: {exc}'

    failure_path = run_dir / 'failure_state.json'
    failure_path.write_text(json.dumps(failure, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    files['failure_state'] = str(failure_path)

    traceback_path = run_dir / 'traceback.txt'
    traceback_path.write_text(failure['traceback'], encoding='utf-8')
    files['traceback'] = str(traceback_path)
    return files


def _close_loss_windows_for_sales(
    win32: Win32,
    logger: logging.Logger | None = None,
) -> None:
    """Fecha somente as telas de Pedidos para liberar Vendas > Vendas."""
    for class_name in ('TFormRelPedidos', 'TFormPedidos'):
        hwnd = win32.find_window(class_name, visible_only=False)
        if not hwnd:
            continue
        if logger:
            logger.info(
                '[PERDAS VENDAS] fechando %s hwnd=0x%X via WM_CLOSE local',
                class_name,
                hwnd,
            )
        win32.post_if_present(hwnd, WM_CLOSE, 0, 0)
        win32.wait(
            lambda class_name=class_name: not win32.find_window(
                class_name, visible_only=False
            ),
            15,
            f'fechamento {class_name}',
        )


def _collect_loss_sales_in_session(
    *,
    win32: Win32,
    menu_hwnd: int,
    start: date,
    end: date,
    raw_dir: Path,
    settings: Settings,
    logger: logging.Logger | None = None,
) -> list[LossSalesCollection]:
    """Coleta vendas do mesmo período das perdas e do ano anterior."""
    _close_loss_windows_for_sales(win32, logger)
    if logger:
        logger.info('[PERDAS VENDAS] STEP open_sales_report START')
    report = open_sales_report(win32, menu_hwnd, logger)
    if logger:
        logger.info('[PERDAS VENDAS] STEP open_sales_report PASS hwnd=0x%X', report)

    result: list[LossSalesCollection] = []
    periods = (
        ('current', ReportPeriod(start, end)),
        ('previous', ReportPeriod(previous_year_date(start), previous_year_date(end))),
    )
    for side, period in periods:
        destination = raw_dir / f'sales_{side}.htm'
        if destination.exists():
            raise SuperusError(
                f'Fresh collection recusou vendas já existentes: {destination}'
            )
        started = time.monotonic()
        if logger:
            logger.info(
                '[PERDAS VENDAS] START side=%s period=%s->%s file=%s',
                side,
                period.start,
                period.end,
                destination,
            )
        path = collect_sales_htm(
            win32,
            report,
            period,
            destination,
            settings,
            logger,
        )
        validation = validate_raw_sales_report(path, period)
        fingerprint = file_fingerprint(path)
        item = LossSalesCollection(
            side=side,
            start=period.start,
            end=period.end,
            file=str(path),
            status='PASS',
            size=int(fingerprint['size']),
            sha256=str(fingerprint['sha256']),
            validation=validation.as_dict(),
        )
        result.append(item)
        if logger:
            logger.info(
                '[PERDAS VENDAS] END side=%s PASS duration_ms=%.1f size=%s sha256=%s',
                side,
                (time.monotonic() - started) * 1000,
                item.size,
                item.sha256,
            )
    return result


def collect_loss_sales_for_run(
    *,
    run_dir: Path,
    settings: Settings,
    logger: logging.Logger | None = None,
) -> list[LossSalesCollection]:
    """Coleta apenas vendas para enriquecer um run de perdas já PASS."""
    run_dir = Path(run_dir)
    manifest_path = run_dir / 'manifest.json'
    if not manifest_path.exists():
        raise FileNotFoundError(f'manifest.json não encontrado em {run_dir}')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest.get('status') != 'PASS':
        raise SuperusError(
            f'Run não está PASS: status={manifest.get("status")!r}'
        )
    start = date.fromisoformat(str(manifest['start']))
    end = date.fromisoformat(str(manifest['end']))
    raw_dir = run_dir / 'raw'
    if not raw_dir.is_dir():
        raise FileNotFoundError(f'Pasta raw não encontrada: {raw_dir}')

    sales_files = [raw_dir / 'sales_current.htm', raw_dir / 'sales_previous.htm']
    if all(path.exists() for path in sales_files):
        raise SuperusError(
            'sales_current.htm e sales_previous.htm já existem. '
            'Use --build-loss-payload / --sync-loss-run.'
        )
    if any(path.exists() for path in sales_files):
        raise SuperusError(
            'Par de vendas incompleto. Confira automation.log antes de remover '
            'somente o arquivo parcial.'
        )

    active_logger, handler = _attach_run_log(logger, run_dir)
    win32 = Win32()
    try:
        ready = prepare_superus(win32, settings, active_logger)
        items = _collect_loss_sales_in_session(
            win32=win32,
            menu_hwnd=ready.menu_hwnd,
            start=start,
            end=end,
            raw_dir=raw_dir,
            settings=settings,
            logger=active_logger,
        )
        manifest['sales_collections'] = [asdict(item) for item in items]
        manifest['sales_context_status'] = 'PASS'
        manifest['sales_context_required'] = True
        manifest['diagnostics_version'] = 'V8.2_LOSS_PLUS_SALES'
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, default=str),
            encoding='utf-8',
        )
        return items
    finally:
        active_logger.removeHandler(handler)
        handler.close()


def execute_losses(
    *,
    start: date,
    end: date,
    stores: list[str],
    data_root: Path,
    settings: Settings,
    logger: logging.Logger | None = None,
    collect_sales: bool = False,
) -> LossRunResult:
    if start > end:
        raise ValueError('Data inicial não pode ser maior que data final.')
    normalized_stores = [get_store(code).code for code in stores]
    if not normalized_stores:
        raise ValueError('Selecione pelo menos uma loja.')
    run_id = _run_id()
    run_dir = data_root / 'loss_runs' / run_id
    raw = run_dir / 'raw'
    raw.mkdir(parents=True, exist_ok=False)
    manifest_path = run_dir / 'manifest.json'
    run_path = run_dir / 'run.json'
    logger, run_handler = _attach_run_log(logger, run_dir)
    run_started = time.monotonic()
    payload = {
        'run_id': run_id,
        'fresh_collection_required': True,
        'start': start.isoformat(),
        'end': end.isoformat(),
        'previous_start': previous_year_date(start).isoformat(),
        'previous_end': previous_year_date(end).isoformat(),
        'stores': normalized_stores,
        'collections': [],
        'diagnostics_version': 'V8.2_LOSS_PLUS_SALES',
        'sales_context_required': bool(collect_sales),
        'sales_collections': [],
    }
    win32 = Win32()
    collections: list[LossCollection] = []
    sales_collections: list[LossSalesCollection] = []
    status = 'PASS'
    error_text: str | None = None
    diagnostic_files: dict[str, str] = {'automation_log': str(run_dir / 'automation.log')}
    report: int | None = None
    current_store: str | None = None
    current_side: str | None = None
    current_period_start: date | None = None
    current_period_end: date | None = None

    logger.info(
        '[PERDAS RUN] START run_id=%s stores=%s current=%s->%s previous=%s->%s',
        run_id, normalized_stores, start, end, previous_year_date(start), previous_year_date(end),
    )
    try:
        step = time.monotonic()
        logger.info('[PERDAS RUN] STEP prepare_superus START')
        ready = prepare_superus(win32, settings, logger)
        logger.info(
            '[PERDAS RUN] STEP prepare_superus PASS duration_ms=%.1f menu_hwnd=0x%X',
            (time.monotonic() - step) * 1000, ready.menu_hwnd,
        )

        step = time.monotonic()
        logger.info('[PERDAS RUN] STEP open_pedidos START')
        pedidos = open_pedidos(win32, ready.menu_hwnd, logger)
        logger.info(
            '[PERDAS RUN] STEP open_pedidos PASS duration_ms=%.1f hwnd=0x%X',
            (time.monotonic() - step) * 1000, pedidos,
        )

        step = time.monotonic()
        logger.info('[PERDAS RUN] STEP open_reports START')
        report = open_reports(win32, pedidos, logger)
        try:
            report_title = win32.text(report)
        except Exception:
            report_title = ''
        logger.info(
            '[PERDAS RUN] STEP open_reports PASS duration_ms=%.1f hwnd=0x%X title=%r',
            (time.monotonic() - step) * 1000, report, report_title,
        )

        for store in normalized_stores:
            periods = (
                ('current', start, end),
                ('previous', previous_year_date(start), previous_year_date(end)),
            )
            for side, period_start, period_end in periods:
                current_store = store
                current_side = side
                current_period_start = period_start
                current_period_end = period_end
                destination = raw / f'loss_{store}_{side}.htm'
                item_started = time.monotonic()
                logger.info(
                    '[PERDAS ITEM] START store=%s side=%s period=%s->%s configure_store=%s file=%s',
                    store, side, period_start, period_end, side == 'current', destination,
                )
                path, result_status = collect_loss_htm(
                    win32,
                    report,
                    store,
                    period_start,
                    period_end,
                    destination,
                    settings,
                    logger,
                    configure_store=(side == 'current'),
                )
                if path is None:
                    item = LossCollection(store, side, period_start, period_end, None, 'NO_DATA', message=result_status)
                else:
                    validate_started = time.monotonic()
                    validate_loss_html(path, store, period_start, period_end)
                    logger.info(
                        '[PERDAS ITEM] validate_loss_html PASS store=%s side=%s duration_ms=%.1f',
                        store, side, (time.monotonic() - validate_started) * 1000,
                    )
                    size, sha = _fingerprint(path)
                    item = LossCollection(store, side, period_start, period_end, str(path), 'PASS', size=size, sha256=sha)
                collections.append(item)
                row = asdict(item)
                row['duration_seconds'] = round(time.monotonic() - item_started, 3)
                payload['collections'].append(row)
                logger.info(
                    '[PERDAS ITEM] END store=%s side=%s status=%s duration_ms=%.1f file=%s',
                    store, side, item.status, (time.monotonic() - item_started) * 1000, item.file,
                )

        if collect_sales:
            current_store = 'SALES'
            current_side = 'current'
            current_period_start = start
            current_period_end = end
            report = None
            logger.info(
                '[PERDAS VENDAS] Iniciando contexto de vendas do período selecionado.'
            )
            sales_collections = _collect_loss_sales_in_session(
                win32=win32,
                menu_hwnd=ready.menu_hwnd,
                start=start,
                end=end,
                raw_dir=raw,
                settings=settings,
                logger=logger,
            )
            payload['sales_collections'] = [asdict(item) for item in sales_collections]
            payload['sales_context_status'] = 'PASS'
            logger.info(
                '[PERDAS VENDAS] Contexto de vendas PASS current+previous.'
            )

        forbidden = any(
            win32.audit.as_dict().get(key, 0)
            for key in ('physical_mouse_moves', 'global_keyboard_uses', 'foreground_calls')
        )
        if forbidden:
            raise SuperusError(f'Automação de perdas violou background: {win32.audit.as_dict()}')
    except Exception as error:
        status = 'FAIL'
        error_text = str(error)
        payload['error'] = error_text
        payload['error_type'] = type(error).__name__
        payload['failure_context'] = {
            'store': current_store,
            'side': current_side,
            'period_start': current_period_start.isoformat() if current_period_start else None,
            'period_end': current_period_end.isoformat() if current_period_end else None,
        }
        logger.exception(
            '[PERDAS RUN] FAIL store=%s side=%s period=%s->%s',
            current_store, current_side, current_period_start, current_period_end,
        )
        try:
            diagnostic_files.update(
                _failure_diagnostics(
                    win32=win32,
                    run_dir=run_dir,
                    report=report,
                    error=error,
                    store=current_store,
                    side=current_side,
                    period_start=current_period_start,
                    period_end=current_period_end,
                )
            )
        except Exception as diag_error:
            logger.exception('[PERDAS DIAG] Falha ao criar diagnóstico: %s', diag_error)
            payload['diagnostic_error'] = f'{type(diag_error).__name__}: {diag_error}'
    finally:
        payload['status'] = status
        payload['background'] = win32.audit.as_dict()
        payload['duration_seconds'] = round(time.monotonic() - run_started, 3)
        payload['diagnostic_files'] = diagnostic_files
        manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
        run_path.write_text(
            json.dumps(
                {
                    'run_id': run_id,
                    'status': status,
                    'error': error_text,
                    'failure_context': payload.get('failure_context'),
                    'duration_seconds': payload['duration_seconds'],
                    'background': win32.audit.as_dict(),
                    'diagnostic_files': diagnostic_files,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding='utf-8',
        )
        logger.info(
            '[PERDAS RUN] END status=%s duration_ms=%.1f background=%s',
            status, (time.monotonic() - run_started) * 1000, win32.audit.as_dict(),
        )
        logger.removeHandler(run_handler)
        run_handler.close()

    return LossRunResult(
        run_id,
        run_dir,
        status,
        collections,
        win32.audit.as_dict(),
        error_text,
        diagnostic_files,
        sales_collections,
    )

def prepare_loss_collection_screen(
    *,
    start: date,
    end: date,
    store: str,
    settings: Settings,
    logger: logging.Logger | None = None,
) -> dict[str, object]:
    """Prepara TFormRelPedidos exatamente até a tela Produtos configurada.

    Modo de teste seguro: abre/reutiliza SUPERUS, entra em Faturamento > Pedidos,
    abre Relatórios de pedidos, seleciona a aba Produtos, configura Produtos por
    MIP/checkboxes/loja/período e PARA antes de gerar o preview.
    """
    win32 = Win32()
    ready = prepare_superus(win32, settings, logger)
    pedidos = open_pedidos(win32, ready.menu_hwnd, logger)
    report = open_reports(win32, pedidos, logger)
    configuration = configure_products(
        win32,
        report,
        get_store(store).code,
        start.isoformat(),
        end.isoformat(),
        logger,
    )
    return {
        'status': 'PASS',
        'report_hwnd': report,
        'store': get_store(store).code,
        'start': start.isoformat(),
        'end': end.isoformat(),
        'configuration': configuration.as_dict(),
        'background': win32.audit.as_dict(),
    }

def default_stores() -> list[str]:
    return list(STORES)
