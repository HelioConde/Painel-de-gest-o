from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path, PureWindowsPath
from typing import Any

from src.business.periods import ReportPeriod
from src.business.planner import ReportJob, ReportKind
from src.business.snapshots import build_sales_snapshot
from src.parsers.sales_html import parse_sales_html
from src.superus.errors import ReportValidationError


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f'Arquivo obrigatório não encontrado: {path}')
    return json.loads(path.read_text(encoding='utf-8'))


def _period(value: dict[str, Any]) -> ReportPeriod:
    return ReportPeriod(date.fromisoformat(value['start']), date.fromisoformat(value['end']))


def _job(value: dict[str, Any]) -> ReportJob:
    return ReportJob(
        kind=ReportKind(value['kind']),
        slug=str(value['slug']),
        current_period=_period(value['current_period']),
        previous_period=_period(value['previous_period']),
        metric=str(value.get('metric') or 'monetary'),
        unit=value.get('unit'),
        metadata=dict(value.get('metadata') or {}),
    )


def _collection_map(manifest: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    result: dict[tuple[str, str], dict[str, Any]] = {}
    for item in manifest.get('collections', []):
        if item.get('status') != 'PASS':
            continue
        result[(str(item.get('job_id')), str(item.get('side')))] = item
    return result


def _resolve_file(run_dir: Path, record: dict[str, Any]) -> Path:
    raw_value = str(record.get('file') or '')
    if not raw_value:
        raise FileNotFoundError('Manifest de vendas sem caminho de arquivo.')
    direct = Path(raw_value)
    if direct.exists():
        return direct
    # Permite reprocessar um run copiado para outra máquina/sistema operacional.
    name = PureWindowsPath(raw_value).name
    candidate = run_dir / 'raw' / name
    if candidate.exists():
        return candidate
    raise FileNotFoundError(f'HTM do manifest não encontrado: {raw_value}')


def build_sales_rows(run_dir: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    run_dir = Path(run_dir)
    plan = _read_json(run_dir / 'plan.json')
    manifest = _read_json(run_dir / 'manifest.json')
    run_meta = _read_json(run_dir / 'run.json')

    if run_meta.get('status') != 'PASS':
        raise ReportValidationError(
            f'Run de vendas não está PASS: {run_meta.get("status")!r}'
        )
    if manifest.get('dry_run'):
        raise ReportValidationError('Run DRY_RUN não pode gerar snapshot para Supabase.')

    run_id = str(manifest.get('run_id') or run_meta.get('run_id') or run_dir.name)
    reference_date = str(plan['reference_date'])
    collections = _collection_map(manifest)
    rows: list[dict[str, Any]] = []
    jobs_summary: list[dict[str, Any]] = []

    for job_value in plan.get('jobs', []):
        job = _job(job_value)
        cur_record = collections.get((job.slug, 'current'))
        prev_record = collections.get((job.slug, 'previous'))
        # Suporta --only-job: jobs que não foram coletados neste run são ignorados,
        # mas nunca aceita um par incompleto.
        if cur_record is None and prev_record is None:
            continue
        if cur_record is None or prev_record is None:
            raise ReportValidationError(
                f'Par incompleto no run para {job.kind.value}/{job.slug}: '
                f'current={bool(cur_record)} previous={bool(prev_record)}'
            )

        current_path = _resolve_file(run_dir, cur_record)
        previous_path = _resolve_file(run_dir, prev_record)
        current = parse_sales_html(
            current_path,
            expected_start=job.current_period.start,
            expected_end=job.current_period.end,
        )
        previous = parse_sales_html(
            previous_path,
            expected_start=job.previous_period.start,
            expected_end=job.previous_period.end,
        )
        row = build_sales_snapshot(
            run_id=run_id,
            reference_date=reference_date,
            job=job,
            current=current,
            previous=previous,
        )
        row['updated_at'] = datetime.now(UTC).isoformat()
        # Compatibilidade leve: mantém payload sem duplicar toda a árvore JSONB.
        row['payload'] = {
            'schema_version': 3,
            'details_column': 'details',
            'sector_count': row['sector_count'],
            'store_count': row['store_count'],
            'metric': row['metric'],
            'unit': row['unit'],
        }
        rows.append(row)
        jobs_summary.append(
            {
                'snapshot_key': row['snapshot_key'],
                'snapshot_type': row['snapshot_type'],
                'slug': row['slug'],
                'metric': row['metric'],
                'unit': row['unit'],
                'current_value': row['current_value'],
                'previous_value': row['previous_value'],
                'sector_count': row['sector_count'],
                'store_count': row['store_count'],
                'subgroup_count': row['subgroup_count'],
            }
        )

    if not rows:
        raise ReportValidationError('Nenhum par current/previous PASS encontrado no run de vendas.')

    preview = {
        'summary': {
            'schema_version': 3,
            'status': 'PASS',
            'run_id': run_id,
            'reference_date': reference_date,
            'snapshot_count': len(rows),
            'fixed_sector_count': 17,
            'store_count': 6,
            'jobs': jobs_summary,
        },
        'rows': rows,
    }
    return rows, preview


def write_sales_payload_preview(run_dir: Path) -> Path:
    run_dir = Path(run_dir)
    _, preview = build_sales_rows(run_dir)
    destination = run_dir / 'sales_payload_preview.json'
    destination.write_text(
        json.dumps(preview, ensure_ascii=False, indent=2, allow_nan=False),
        encoding='utf-8',
    )
    return destination
