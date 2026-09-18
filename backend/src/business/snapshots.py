from __future__ import annotations

from typing import Any

from src.business.event_config import event_config_for
from src.business.planner import ReportJob, ReportKind
from src.business.sales import (
    apply_event_metric_to_hierarchy,
    build_sales_hierarchy_pair,
    network_metric_value,
    sector_metric_value,
)


def _pct(current: float, previous: float) -> float | None:
    if previous == 0:
        return None if current != 0 else 0.0
    return round((current - previous) / previous * 100.0, 6)


def snapshot_name(job: ReportJob) -> str:
    if job.kind == ReportKind.DAILY:
        return 'Venda Diária'
    if job.kind == ReportKind.MONTHLY:
        return 'Venda Mensal'
    if job.kind == ReportKind.MONTHLY_CLOSE:
        return 'Fechamento Mensal'
    return job.metadata.get('name') or job.slug


def build_sales_snapshot(
    *,
    run_id: str,
    reference_date: str,
    job: ReportJob,
    current: dict[str, Any],
    previous: dict[str, Any],
) -> dict[str, Any]:
    hierarchy = build_sales_hierarchy_pair(current, previous)
    post_filter_sector: str | None = None
    metric = job.metric
    unit = job.unit
    if job.kind == ReportKind.EVENT:
        config = event_config_for(job.slug)
        metric = config.metric
        unit = config.unit
        post_filter_sector = config.post_filter_sector
        apply_event_metric_to_hierarchy(
            hierarchy,
            metric=metric,
            post_filter_sector=post_filter_sector,
        )

    if post_filter_sector:
        current_value = sector_metric_value(hierarchy, post_filter_sector, 'current', metric)
        previous_value = sector_metric_value(hierarchy, post_filter_sector, 'previous', metric)
    else:
        current_value = network_metric_value(hierarchy, 'current', metric)
        previous_value = network_metric_value(hierarchy, 'previous', metric)

    difference = round(current_value - previous_value, 4)
    variation = _pct(current_value, previous_value)
    snapshot_key = f'{reference_date}|{job.kind.value}|{job.slug}'
    quality = {
        'status': 'PASS',
        'checks': {
            'current_parser': current.get('quality', {}).get('status') == 'PASS',
            'previous_parser': previous.get('quality', {}).get('status') == 'PASS',
            'fixed_sector_count_17': hierarchy['counts']['sector_count'] == 17,
            'store_count_6': hierarchy['counts']['store_count'] == 6,
            'metric_semantics': metric in {'monetary', 'quantity'},
            'pizza_quantity_rule': (
                job.slug != 'segunda_pizza'
                or (metric == 'quantity' and post_filter_sector == 'PIZZARIA' and unit == 'QTD')
            ),
        },
        'current_source_quality': current.get('quality', {}),
        'previous_source_quality': previous.get('quality', {}),
    }
    if not all(quality['checks'].values()):
        raise RuntimeError(f'Quality gate de snapshot falhou: {quality["checks"]}')

    source_files = {
        'current': current['source'],
        'previous': previous['source'],
    }
    details = {
        **hierarchy,
        'snapshot_type': job.kind.value,
        'slug': job.slug,
        'name': snapshot_name(job),
        'metric': metric,
        'unit': unit,
        'event_filter_sector': post_filter_sector,
    }

    # Campos v8.3 + alguns aliases de compatibilidade com a tabela antiga.
    return {
        'snapshot_key': snapshot_key,
        'reference_date': reference_date,
        'snapshot_type': job.kind.value,
        'period_type': job.kind.value.lower(),
        'kind': job.kind.value,
        'slug': job.slug,
        'event_slug': job.slug if job.kind == ReportKind.EVENT else None,
        'event_name': snapshot_name(job) if job.kind == ReportKind.EVENT else None,
        'name': snapshot_name(job),
        'mode': job.metadata.get('mode'),
        'metric': metric,
        'unit': unit,
        'current_start': job.current_period.start.isoformat(),
        'current_end': job.current_period.end.isoformat(),
        'previous_start': job.previous_period.start.isoformat(),
        'previous_end': job.previous_period.end.isoformat(),
        'current_value': current_value,
        'previous_value': previous_value,
        'difference_value': difference,
        'variation_percent': variation,
        'sector_count': hierarchy['counts']['sector_count'],
        'store_count': hierarchy['counts']['store_count'],
        'subgroup_count': hierarchy['counts']['subgroup_count'],
        'current_sha256': current['source']['sha256'],
        'previous_sha256': previous['source']['sha256'],
        'run_id': run_id,
        'source_files': source_files,
        'details': details,
        'payload': details,
        'quality': quality,
    }
