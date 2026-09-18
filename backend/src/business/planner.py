from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum
from pathlib import Path

from src.business.event_calendar import EventMode, event_for
from src.business.periods import (
    ReportPeriod,
    daily_periods,
    previous_month_close_periods,
    running_month_periods,
)


class ReportKind(StrEnum):
    DAILY = 'DAILY'
    MONTHLY = 'MONTHLY'
    EVENT = 'EVENT'
    MONTHLY_CLOSE = 'MONTHLY_CLOSE'


class MonthlyMode(StrEnum):
    RUNNING_MONTH = 'RUNNING_MONTH'
    PREVIOUS_MONTH_CLOSE = 'PREVIOUS_MONTH_CLOSE'


class DateSource(StrEnum):
    AUTO_SYSTEM_DATE = 'AUTO_SYSTEM_DATE'
    CLI_OVERRIDE = 'CLI_OVERRIDE'


@dataclass(frozen=True)
class ReportJob:
    kind: ReportKind
    slug: str
    current_period: ReportPeriod
    previous_period: ReportPeriod
    metric: str
    unit: str | None = None
    metadata: dict[str, str] = field(default_factory=dict)

    def as_dict(self) -> dict[str, object]:
        return {
            'kind': self.kind.value,
            'slug': self.slug,
            'current_period': self.current_period.as_dict(),
            'previous_period': self.previous_period.as_dict(),
            'metric': self.metric,
            'unit': self.unit,
            'metadata': self.metadata,
        }


@dataclass(frozen=True)
class DailyPlan:
    reference_date: date
    date_source: DateSource
    jobs: list[ReportJob]

    def as_dict(self) -> dict[str, object]:
        return {
            'reference_date': self.reference_date.isoformat(),
            'date_source': self.date_source.value,
            'jobs': [job.as_dict() for job in self.jobs],
        }

    def to_json(self) -> str:
        return json.dumps(self.as_dict(), ensure_ascii=False, indent=2)

    def write_json(self, path: Path) -> None:
        path.write_text(f'{self.to_json()}\n', encoding='utf-8')


@dataclass(frozen=True)
class FreshRunPaths:
    root: Path
    raw: Path
    plan: Path
    manifest: Path
    quality: Path
    run: Path

    def create(self) -> None:
        self.raw.mkdir(parents=True, exist_ok=False)


def fresh_run_paths(data_root: Path, run_id: str) -> FreshRunPaths:
    root = data_root / 'runs' / run_id
    return FreshRunPaths(
        root=root,
        raw=root / 'raw',
        plan=root / 'plan.json',
        manifest=root / 'manifest.json',
        quality=root / 'quality.json',
        run=root / 'run.json',
    )


def build_daily_plan(reference_date: date, date_source: DateSource) -> DailyPlan:
    jobs: list[ReportJob] = []
    daily_current, daily_previous = daily_periods(reference_date)
    jobs.append(
        ReportJob(
            kind=ReportKind.DAILY,
            slug='daily',
            current_period=daily_current,
            previous_period=daily_previous,
            metric='monetary',
        )
    )

    if reference_date.day == 1:
        monthly_mode = MonthlyMode.PREVIOUS_MONTH_CLOSE
        monthly_current, monthly_previous = previous_month_close_periods(reference_date)
    else:
        monthly_mode = MonthlyMode.RUNNING_MONTH
        monthly_current, monthly_previous = running_month_periods(reference_date)
    jobs.append(
        ReportJob(
            kind=ReportKind.MONTHLY,
            slug='monthly',
            current_period=monthly_current,
            previous_period=monthly_previous,
            metric='monetary',
            metadata={'mode': monthly_mode.value},
        )
    )

    event = event_for(reference_date)
    if event:
        jobs.append(
            ReportJob(
                kind=ReportKind.EVENT,
                slug=event.slug,
                current_period=event.current_period,
                previous_period=event.previous_period,
                metric=event.metric,
                unit=event.unit,
                metadata={'mode': event.mode.value, 'name': event.name},
            )
        )

    if reference_date.day == 1:
        close_current, close_previous = previous_month_close_periods(reference_date)
        jobs.append(
            ReportJob(
                kind=ReportKind.MONTHLY_CLOSE,
                slug='monthly_close',
                current_period=close_current,
                previous_period=close_previous,
                metric='monetary',
                metadata={'mode': MonthlyMode.PREVIOUS_MONTH_CLOSE.value},
            )
        )

    return DailyPlan(reference_date=reference_date, date_source=date_source, jobs=jobs)


def event_mode_for_no_event() -> EventMode:
    return EventMode.NO_EVENT
