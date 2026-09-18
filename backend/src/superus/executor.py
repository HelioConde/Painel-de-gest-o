from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from src.business.event_config import EvidenceStatus, event_config_for
from src.business.periods import ReportPeriod
from src.business.planner import (
    DailyPlan,
    DateSource,
    ReportJob,
    ReportKind,
    build_daily_plan,
    fresh_run_paths,
)
from src.config.settings import Settings
from src.quality.raw_report import RawReportValidation, file_fingerprint, validate_raw_sales_report
from src.superus.errors import SuperusError
from src.superus.export_html import wait_file_stable
from src.superus.session import prepare_superus
from src.superus.sales_report import collect_sales_htm, open_sales_report
from src.superus.windows import Win32


class SalesReportClient(Protocol):
    background: dict[str, int]
    session: str
    startup: str
    login: str
    report_window: str

    def collect(self, job: ReportJob, side: str, period: ReportPeriod, destination: Path) -> None:
        ...


@dataclass(frozen=True)
class CollectionRecord:
    job_id: str
    side: str
    requested_period: ReportPeriod
    file: Path
    status: str
    actual_period: ReportPeriod | None = None
    sha256: str | None = None
    size: int | None = None
    validation: dict[str, object] | None = None
    error: str | None = None
    timings: dict[str, float] = field(default_factory=dict)

    def as_dict(self) -> dict[str, object]:
        return {
            'job_id': self.job_id,
            'side': self.side,
            'file': str(self.file),
            'requested_period': self.requested_period.as_dict(),
            'actual_period': self.actual_period.as_dict() if self.actual_period else None,
            'sha256': self.sha256,
            'size': self.size,
            'status': self.status,
            'validation': self.validation,
            'error': self.error,
            'timings': self.timings,
        }


@dataclass(frozen=True)
class DailyAutoResult:
    run_id: str
    run_dir: Path
    plan: DailyPlan
    collections: list[CollectionRecord]
    status: str
    background: dict[str, int]
    session: str
    startup: str
    login: str
    report_window: str
    timings: dict[str, float]


class RealSalesReportClient:
    def __init__(self, settings: Settings, timeout_seconds: float = 60) -> None:
        self.settings = settings
        self.timeout_seconds = timeout_seconds
        self.win32 = Win32()
        self.background = self.win32.audit.as_dict()
        self.session = 'NO'
        self.startup = 'NOT_STARTED'
        self.login = 'NOT_NEEDED'
        self.report_window = 'NOT_STARTED'
        self._menu: int | None = None
        self._report: int | None = None

    def _prepare(self) -> None:
        if self._report:
            return
        started = time.monotonic()
        ready = prepare_superus(self.win32, self.settings)
        self.session = 'YES' if ready.existing_session else 'NO'
        self.startup = ready.startup
        self.login = ready.login
        self._menu = ready.menu_hwnd
        self._report = open_sales_report(self.win32, ready.menu_hwnd)
        self.report_window = 'PASS'
        self.background = self.win32.audit.as_dict()
        if time.monotonic() - started > self.timeout_seconds:
            raise SuperusError('Startup/navegação excedeu timeout configurado.')

    def collect(self, job: ReportJob, side: str, period: ReportPeriod, destination: Path) -> None:
        del job, side
        self._prepare()
        if not self._report:
            raise SuperusError('Relatório de vendas não preparado.')
        collect_sales_htm(
            self.win32,
            self._report,
            period,
            destination,
            self.settings,
        )
        self.background = self.win32.audit.as_dict()


def job_matches(job: ReportJob, only_job: str | None) -> bool:
    if not only_job:
        return True
    expected = only_job.lower()
    if expected == 'event':
        return job.kind == ReportKind.EVENT
    return job.kind.value.lower() == expected


def planned_filename(job: ReportJob, side: str) -> str:
    if job.kind == ReportKind.EVENT:
        return f'event_{job.slug}_{side}.htm'
    if job.kind == ReportKind.MONTHLY_CLOSE:
        return f'monthly_close_{side}.htm'
    if job.kind == ReportKind.MONTHLY:
        return f'monthly_{side}.htm'
    return f'daily_{side}.htm'


def _validate_event(job: ReportJob) -> None:
    if job.kind != ReportKind.EVENT:
        return
    config = event_config_for(job.slug)
    if config.evidence_status != EvidenceStatus.CONFIRMED:
        raise SuperusError(f'Evento {job.slug} exige discovery confirmado: {config.evidence_status.value}.')


def _assert_background(background: dict[str, int]) -> None:
    if any(background.get(key, 0) for key in ('physical_mouse_moves', 'global_keyboard_uses', 'foreground_calls')):
        raise SuperusError(f'Automação violou execução em background: {background}')


def _new_run_id() -> str:
    return f'{datetime.now(UTC):%Y%m%dT%H%M%S}_{uuid4().hex}'


def execute_daily_auto(
    *,
    reference_date,
    date_source: DateSource,
    data_root: Path,
    client: SalesReportClient | None,
    dry_run: bool = False,
    only_job: str | None = None,
) -> DailyAutoResult:
    started = time.monotonic()
    plan = build_daily_plan(reference_date, date_source)
    run_id = _new_run_id()
    paths = fresh_run_paths(data_root, run_id)
    paths.create()
    plan.write_json(paths.plan)

    selected_jobs = [job for job in plan.jobs if job_matches(job, only_job)]
    collections: list[CollectionRecord] = []
    status = 'PASS'
    manifest = {
        'run_id': run_id,
        'reference_date': plan.reference_date.isoformat(),
        'date_source': plan.date_source.value,
        'fresh_collection_required': True,
        'dry_run': dry_run,
        'collections': [],
    }

    if dry_run:
        for job in selected_jobs:
            for side, period in (('current', job.current_period), ('previous', job.previous_period)):
                record = CollectionRecord(
                    job_id=job.slug,
                    side=side,
                    requested_period=period,
                    file=paths.raw / planned_filename(job, side),
                    status='WOULD_COLLECT',
                )
                collections.append(record)
                manifest['collections'].append(record.as_dict())
        paths.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
        paths.quality.write_text(json.dumps({'status': 'DRY_RUN'}, indent=2), encoding='utf-8')
        paths.run.write_text(json.dumps({'status': 'DRY_RUN', 'run_id': run_id}, indent=2), encoding='utf-8')
        return DailyAutoResult(
            run_id=run_id,
            run_dir=paths.root,
            plan=plan,
            collections=collections,
            status='DRY_RUN',
            background={'physical_mouse_moves': 0, 'global_keyboard_uses': 0, 'foreground_calls': 0},
            session='NOT_STARTED',
            startup='DRY_RUN',
            login='NOT_STARTED',
            report_window='NOT_STARTED',
            timings={'total': round(time.monotonic() - started, 3)},
        )

    if client is None:
        raise SuperusError('Cliente SUPERUS real não configurado.')

    try:
        for job in selected_jobs:
            _validate_event(job)
            for side, period in (('current', job.current_period), ('previous', job.previous_period)):
                destination = paths.raw / planned_filename(job, side)
                if destination.exists():
                    raise SuperusError(f'Arquivo alvo já existe no run atual: {destination}')
                item_started = time.monotonic()
                client.collect(job, side, period, destination)
                wait_file_stable(destination)
                fingerprint = file_fingerprint(destination)
                validation: RawReportValidation = validate_raw_sales_report(destination, period)
                record = CollectionRecord(
                    job_id=job.slug,
                    side=side,
                    requested_period=period,
                    actual_period=period,
                    file=destination,
                    sha256=str(fingerprint['sha256']),
                    size=int(fingerprint['size']),
                    validation=validation.as_dict(),
                    status='PASS',
                    timings={'total': round(time.monotonic() - item_started, 3)},
                )
                collections.append(record)
                manifest['collections'].append(record.as_dict())
        _assert_background(client.background)
    except (OSError, SuperusError) as error:
        status = 'FAIL'
        failed_job = selected_jobs[min(len(collections) // 2, len(selected_jobs) - 1)] if selected_jobs else None
        failed_side = 'current' if len(collections) % 2 == 0 else 'previous'
        failed = CollectionRecord(
            job_id=failed_job.slug if failed_job else 'none',
            side=failed_side,
            requested_period=getattr(failed_job, f'{failed_side}_period')
            if failed_job
            else ReportPeriod(reference_date, reference_date),
            file=paths.raw / 'failed.htm',
            status='FAILED_COLLECTION',
            error=str(error),
        )
        collections.append(failed)
        manifest['collections'].append(failed.as_dict())

    background = client.background
    run_payload = {
        'run_id': run_id,
        'status': status,
        'background': background,
        'session': client.session,
        'startup': client.startup,
        'login': client.login,
        'report_window': client.report_window,
        'timings': {'total': round(time.monotonic() - started, 3)},
    }
    paths.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    forbidden_background = any(
        background.get(key, 0)
        for key in ('physical_mouse_moves', 'global_keyboard_uses', 'foreground_calls')
    )
    paths.quality.write_text(
        json.dumps(
            {
                'status': status,
                'background_pass': not forbidden_background,
                'background': background,
            },
            indent=2,
        ),
        encoding='utf-8',
    )
    paths.run.write_text(json.dumps(run_payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return DailyAutoResult(
        run_id=run_id,
        run_dir=paths.root,
        plan=plan,
        collections=collections,
        status=status,
        background=background,
        session=client.session,
        startup=client.startup,
        login=client.login,
        report_window=client.report_window,
        timings=run_payload['timings'],
    )
