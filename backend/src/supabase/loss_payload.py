from __future__ import annotations

import json
import logging
import re
import unicodedata
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from src.business.loss_products import filter_loss_indicator_products
from src.config.stores import STORES, get_store
from src.parsers.loss_html import parse_loss_html
from src.parsers.sales_html import (
    loss_sales_percent,
    parse_sales_html,
    sales_sector_map,
    sales_store_map,
)
from src.superus.errors import ReportValidationError

PAIR_RE = re.compile(r'^loss_(\d{3})_(current|previous)\.htm$', re.IGNORECASE)


def _previous_year(value: date) -> date:
    try:
        return value.replace(year=value.year - 1)
    except ValueError:
        return value.replace(year=value.year - 1, day=28)


def _name_key(value: str | None) -> str:
    text = unicodedata.normalize('NFD', str(value or '').strip())
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '_', text.casefold()).strip('_') or 'sem_nome'


def _variation(current: float | None, previous: float | None) -> float | None:
    cur = float(current or 0)
    prev = float(previous or 0)
    if prev == 0:
        return None
    return round(((cur - prev) / prev) * 100, 6)


def discover_loss_pairs(raw_dir: Path) -> dict[str, dict[str, Path]]:
    raw_dir = Path(raw_dir)
    pairs: dict[str, dict[str, Path]] = {}
    for path in sorted(raw_dir.glob('loss_*_*.htm')):
        match = PAIR_RE.fullmatch(path.name)
        if not match:
            continue
        store, side = match.groups()
        store = store.zfill(3)
        if store not in STORES:
            raise ReportValidationError(f'Loja inesperada no nome do arquivo: {path.name}')
        pairs.setdefault(store, {})[side.casefold()] = path

    if not pairs:
        raise ReportValidationError(f'Nenhum loss_<loja>_<side>.htm encontrado em {raw_dir}.')

    incomplete = {
        store: sorted({'current', 'previous'} - set(sides))
        for store, sides in pairs.items()
        if set(sides) != {'current', 'previous'}
    }
    if incomplete:
        raise ReportValidationError(f'Pares current/previous incompletos: {incomplete}')
    return pairs


def discover_sales_pair(raw_dir: Path) -> tuple[Path, Path]:
    current = Path(raw_dir) / 'sales_current.htm'
    previous = Path(raw_dir) / 'sales_previous.htm'
    missing = [path.name for path in (current, previous) if not path.exists()]
    if missing:
        raise ReportValidationError(
            'Contexto de vendas obrigatório da V8.2 não encontrado. '
            f'Faltando: {missing}. Rode --collect-loss-sales <RUN_ID> para um run antigo.'
        )
    return current, previous


def _load_manifest(run_dir: Path) -> dict[str, Any] | None:
    manifest_path = run_dir / 'manifest.json'
    if not manifest_path.exists():
        return None
    payload = json.loads(manifest_path.read_text(encoding='utf-8'))
    if payload.get('status') != 'PASS':
        raise ReportValidationError(
            f'Run {run_dir.name} não pode ser sincronizado porque status={payload.get("status")!r}.'
        )
    return payload


def _augment_loss_sectors(
    loss_sectors: list[dict[str, Any]],
    sales_store: dict[str, Any],
) -> list[dict[str, Any]]:
    sales_by_sector = sales_sector_map(sales_store)
    result: list[dict[str, Any]] = []
    for sector in loss_sectors:
        item = dict(sector)
        key = _name_key(str(item.get('name') or ''))
        sales_sector = sales_by_sector.get(key)
        reported = item.get('reported_totals') or {}
        calculated = item.get('calculated_monetary_totals') or {}
        loss_value = reported.get('total_value')
        if loss_value is None:
            loss_value = calculated.get('total_value')
        sales_value = float((sales_sector or {}).get('sales_value') or 0)
        item['sales_context'] = {
            'sector_key': key,
            'sales_value': round(sales_value, 4),
            'loss_value': loss_value,
            'loss_sales_percent': loss_sales_percent(loss_value, sales_value),
            'sales_record_count': int((sales_sector or {}).get('record_count') or 0),
            'matched_sales_sector': (sales_sector or {}).get('name'),
        }
        result.append(item)
    return result


def build_loss_rows(
    run_dir: Path,
    *,
    logger: logging.Logger | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Monta uma linha Supabase por loja, juntando perdas + vendas current/previous."""
    run_dir = Path(run_dir)
    raw_dir = run_dir / 'raw'
    if not raw_dir.is_dir():
        raise ReportValidationError(f'Pasta raw não encontrada: {raw_dir}')

    manifest = _load_manifest(run_dir)
    run_id = str((manifest or {}).get('run_id') or run_dir.name)
    pairs = discover_loss_pairs(raw_dir)

    sales_current_path, sales_previous_path = discover_sales_pair(raw_dir)

    # O período comum é conhecido pelo primeiro par de perdas e depois validado em cada loja.
    first_store = min(pairs, key=lambda code: get_store(code).sequence)
    first_current = filter_loss_indicator_products(
        parse_loss_html(pairs[first_store]['current'], expected_store=first_store, logger=logger)
    )
    first_previous = filter_loss_indicator_products(
        parse_loss_html(pairs[first_store]['previous'], expected_store=first_store, logger=logger)
    )
    sales_current = parse_sales_html(
        sales_current_path,
        expected_start=date.fromisoformat(first_current['report']['period_start']),
        expected_end=date.fromisoformat(first_current['report']['period_end']),
    )
    sales_previous = parse_sales_html(
        sales_previous_path,
        expected_start=date.fromisoformat(first_previous['report']['period_start']),
        expected_end=date.fromisoformat(first_previous['report']['period_end']),
    )
    sales_current_by_store = sales_store_map(sales_current)
    sales_previous_by_store = sales_store_map(sales_previous)

    rows: list[dict[str, Any]] = []
    preview_stores: list[dict[str, Any]] = []
    common_current_period: tuple[str, str] | None = None
    common_previous_period: tuple[str, str] | None = None

    for store_code in sorted(pairs, key=lambda code: get_store(code).sequence):
        current = first_current if store_code == first_store else filter_loss_indicator_products(
            parse_loss_html(
                pairs[store_code]['current'],
                expected_store=store_code,
                logger=logger,
            )
        )
        previous = first_previous if store_code == first_store else filter_loss_indicator_products(
            parse_loss_html(
                pairs[store_code]['previous'],
                expected_store=store_code,
                logger=logger,
            )
        )

        current_start = date.fromisoformat(current['report']['period_start'])
        current_end = date.fromisoformat(current['report']['period_end'])
        previous_start = date.fromisoformat(previous['report']['period_start'])
        previous_end = date.fromisoformat(previous['report']['period_end'])

        if previous_start != _previous_year(current_start) or previous_end != _previous_year(current_end):
            raise ReportValidationError(
                f'Período previous não corresponde ao ano anterior da loja {store_code}: '
                f'current={current_start}->{current_end} '
                f'previous={previous_start}->{previous_end}'
            )

        current_period = (current_start.isoformat(), current_end.isoformat())
        previous_period = (previous_start.isoformat(), previous_end.isoformat())
        if common_current_period is None:
            common_current_period = current_period
            common_previous_period = previous_period
        elif common_current_period != current_period or common_previous_period != previous_period:
            raise ReportValidationError(
                'As lojas do mesmo run não têm o mesmo período current/previous.'
            )

        current_sales_store = sales_current_by_store.get(store_code)
        previous_sales_store = sales_previous_by_store.get(store_code)
        if not current_sales_store or not previous_sales_store:
            raise ReportValidationError(
                f'Loja {store_code} não encontrada no par HTM de vendas.'
            )

        current_totals = current['grand_totals']
        previous_totals = previous['grand_totals']
        current_loss_value = float(current_totals['total_value'] or 0)
        previous_loss_value = float(previous_totals['total_value'] or 0)
        current_sales_value = float(current_sales_store['sales_value'] or 0)
        previous_sales_value = float(previous_sales_store['sales_value'] or 0)
        now = datetime.now(UTC).isoformat()

        current_sectors = _augment_loss_sectors(current['sectors'], current_sales_store)
        previous_sectors = _augment_loss_sectors(previous['sectors'], previous_sales_store)

        row = {
            'store_code': store_code,
            'store_name': get_store(store_code).name,
            'current_start': current_start.isoformat(),
            'current_end': current_end.isoformat(),
            'previous_start': previous_start.isoformat(),
            'previous_end': previous_end.isoformat(),
            'current_record_count': current_totals['record_count'],
            'previous_record_count': previous_totals['record_count'],
            'current_loss_quantity': current_totals['loss_quantity'],
            'previous_loss_quantity': previous_totals['loss_quantity'],
            'current_gross_cost_total': current_totals['gross_cost_total'],
            'previous_gross_cost_total': previous_totals['gross_cost_total'],
            # Mantidos por compatibilidade: referem-se ao relatório Pedidos por MIP.
            'current_sale_price_total': current_totals['sale_price_total'],
            'previous_sale_price_total': previous_totals['sale_price_total'],
            # Valor monetário da perda.
            'current_total_value': current_totals['total_value'],
            'previous_total_value': previous_totals['total_value'],
            # V8.2: faturamento real do Sintético por SubGrupo para o mesmo período.
            'current_sales_value': round(current_sales_value, 4),
            'previous_sales_value': round(previous_sales_value, 4),
            'current_loss_sales_percent': loss_sales_percent(current_loss_value, current_sales_value),
            'previous_loss_sales_percent': loss_sales_percent(previous_loss_value, previous_sales_value),
            'sales_difference': round(current_sales_value - previous_sales_value, 4),
            'sales_variation_percent': _variation(current_sales_value, previous_sales_value),
            'loss_difference': round(current_loss_value - previous_loss_value, 4),
            'loss_variation_percent': _variation(current_loss_value, previous_loss_value),
            'current_sha256': current['source']['sha256'],
            'previous_sha256': previous['source']['sha256'],
            'current_sales_sha256': sales_current['source']['sha256'],
            'previous_sales_sha256': sales_previous['source']['sha256'],
            'run_id': run_id,
            'source_format': 'htm',
            'source_files': {
                'loss_current': current['source'],
                'loss_previous': previous['source'],
                'sales_current': sales_current['source'],
                'sales_previous': sales_previous['source'],
            },
            'details': {
                'schema_version': 2,
                'current': {
                    'report': current['report'],
                    'grand_totals': current_totals,
                    'sales': {
                        'store_total': current_sales_value,
                        'record_count': current_sales_store['record_count'],
                        'sector_count': current_sales_store['sector_count'],
                    },
                    'sectors': current_sectors,
                },
                'previous': {
                    'report': previous['report'],
                    'grand_totals': previous_totals,
                    'sales': {
                        'store_total': previous_sales_value,
                        'record_count': previous_sales_store['record_count'],
                        'sector_count': previous_sales_store['sector_count'],
                    },
                    'sectors': previous_sectors,
                },
            },
            'quality': {
                'status': 'PASS',
                'current': current['quality'],
                'previous': previous['quality'],
                'sales_current': sales_current['quality'],
                'sales_previous': sales_previous['quality'],
                'checks': {
                    'current_previous_pair': True,
                    'previous_year_period': True,
                    'store_match': True,
                    'sales_context_pair': True,
                    'sales_period_match': True,
                    'sales_store_present': True,
                    'fresh_run_status': (manifest or {}).get('status') == 'PASS' if manifest else None,
                },
            },
            'updated_at': now,
        }
        rows.append(row)
        preview_stores.append(
            {
                'store_code': store_code,
                'store_name': row['store_name'],
                'current_record_count': row['current_record_count'],
                'previous_record_count': row['previous_record_count'],
                'current_loss_quantity': row['current_loss_quantity'],
                'previous_loss_quantity': row['previous_loss_quantity'],
                'current_total_value': row['current_total_value'],
                'previous_total_value': row['previous_total_value'],
                'current_sales_value': row['current_sales_value'],
                'previous_sales_value': row['previous_sales_value'],
                'current_loss_sales_percent': row['current_loss_sales_percent'],
                'previous_loss_sales_percent': row['previous_loss_sales_percent'],
                'current_sha256': row['current_sha256'],
                'previous_sha256': row['previous_sha256'],
                'current_sales_sha256': row['current_sales_sha256'],
                'previous_sales_sha256': row['previous_sales_sha256'],
                'current_sector_count': len(current_sectors),
                'previous_sector_count': len(previous_sectors),
            }
        )

    current_loss_total = round(sum(float(row['current_total_value'] or 0) for row in rows), 4)
    previous_loss_total = round(sum(float(row['previous_total_value'] or 0) for row in rows), 4)
    current_sales_total = round(sum(float(row['current_sales_value'] or 0) for row in rows), 4)
    previous_sales_total = round(sum(float(row['previous_sales_value'] or 0) for row in rows), 4)

    preview = {
        'schema_version': 2,
        'run_id': run_id,
        'status': 'PASS',
        'store_count': len(rows),
        'stores': preview_stores,
        'current_period': {
            'start': common_current_period[0],
            'end': common_current_period[1],
        } if common_current_period else None,
        'previous_period': {
            'start': common_previous_period[0],
            'end': common_previous_period[1],
        } if common_previous_period else None,
        'sales_sources': {
            'current': sales_current['source'],
            'previous': sales_previous['source'],
        },
        'totals': {
            'current_record_count': sum(row['current_record_count'] for row in rows),
            'previous_record_count': sum(row['previous_record_count'] for row in rows),
            'current_loss_quantity': round(sum(row['current_loss_quantity'] or 0 for row in rows), 4),
            'previous_loss_quantity': round(sum(row['previous_loss_quantity'] or 0 for row in rows), 4),
            'current_total_value': current_loss_total,
            'previous_total_value': previous_loss_total,
            'current_sales_value': current_sales_total,
            'previous_sales_value': previous_sales_total,
            'current_loss_sales_percent': loss_sales_percent(current_loss_total, current_sales_total),
            'previous_loss_sales_percent': loss_sales_percent(previous_loss_total, previous_sales_total),
        },
    }
    return rows, preview


def write_loss_payload_preview(run_dir: Path) -> Path:
    run_dir = Path(run_dir)
    logger = logging.getLogger(f'loss-payload.{run_dir.name}')
    logger.setLevel(logging.INFO)
    handler = logging.FileHandler(run_dir / 'reconciliation.log', encoding='utf-8')
    handler.setFormatter(logging.Formatter('%(asctime)s | %(levelname)s | %(message)s'))
    logger.addHandler(handler)
    try:
        rows, preview = build_loss_rows(run_dir, logger=logger)
    finally:
        logger.removeHandler(handler)
        handler.close()
    destination = Path(run_dir) / 'payload_preview.json'
    destination.write_text(
        json.dumps(
            {
                'summary': preview,
                'rows': rows,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding='utf-8',
    )
    return destination
