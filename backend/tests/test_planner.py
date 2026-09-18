from datetime import date
from pathlib import Path

from src.business.event_calendar import EventMode
from src.business.planner import (
    DateSource,
    MonthlyMode,
    ReportKind,
    build_daily_plan,
    event_mode_for_no_event,
    fresh_run_paths,
)


def _job(plan, kind: ReportKind):
    return next(job for job in plan.jobs if job.kind == kind)


def _period(job):
    return job.current_period.start, job.current_period.end


def _previous(job):
    return job.previous_period.start, job.previous_period.end


def test_monday_plans_weekend_event() -> None:
    plan = build_daily_plan(date(2026, 9, 7), DateSource.CLI_OVERRIDE)

    assert [job.kind for job in plan.jobs] == [ReportKind.DAILY, ReportKind.MONTHLY, ReportKind.EVENT]
    assert _period(_job(plan, ReportKind.DAILY)) == (date(2026, 9, 6), date(2026, 9, 6))
    assert _previous(_job(plan, ReportKind.DAILY)) == (date(2025, 9, 7), date(2025, 9, 7))
    event = _job(plan, ReportKind.EVENT)
    assert event.slug == 'fim_semana'
    assert event.metadata['mode'] == EventMode.WEEKEND
    assert _period(event) == (date(2026, 9, 5), date(2026, 9, 6))
    assert _previous(event) == (date(2025, 9, 6), date(2025, 9, 7))


def test_tuesday_plans_pizza_quantity_event() -> None:
    plan = build_daily_plan(date(2026, 9, 8), DateSource.CLI_OVERRIDE)

    event = _job(plan, ReportKind.EVENT)
    assert event.slug == 'segunda_pizza'
    assert event.metadata['mode'] == EventMode.SINGLE_DAY
    assert event.metric == 'quantity'
    assert event.unit == 'QTD'
    assert _period(event) == (date(2026, 9, 7), date(2026, 9, 7))


def test_wednesday_plans_meat_event() -> None:
    plan = build_daily_plan(date(2026, 9, 9), DateSource.CLI_OVERRIDE)

    event = _job(plan, ReportKind.EVENT)
    assert event.slug == 'terca_carne'
    assert event.metadata['mode'] == EventMode.SINGLE_DAY
    assert _period(event) == (date(2026, 9, 8), date(2026, 9, 8))


def test_thursday_plans_green_partial_event() -> None:
    plan = build_daily_plan(date(2026, 9, 10), DateSource.CLI_OVERRIDE)

    event = _job(plan, ReportKind.EVENT)
    assert event.slug == 'quarta_quinta_verde'
    assert event.metadata['mode'] == EventMode.PARTIAL
    assert _period(event) == (date(2026, 9, 9), date(2026, 9, 9))


def test_friday_plans_green_complete_event() -> None:
    plan = build_daily_plan(date(2026, 9, 4), DateSource.CLI_OVERRIDE)

    event = _job(plan, ReportKind.EVENT)
    assert event.slug == 'quarta_quinta_verde'
    assert event.metadata['mode'] == EventMode.COMPLETE
    assert _period(event) == (date(2026, 9, 2), date(2026, 9, 3))
    assert _previous(event) == (date(2025, 9, 3), date(2025, 9, 4))


def test_saturday_plans_bread_event() -> None:
    plan = build_daily_plan(date(2026, 9, 5), DateSource.CLI_OVERRIDE)

    event = _job(plan, ReportKind.EVENT)
    assert event.slug == 'sexta_pao'
    assert event.metadata['mode'] == EventMode.SINGLE_DAY
    assert _period(event) == (date(2026, 9, 4), date(2026, 9, 4))


def test_sunday_has_no_event_job() -> None:
    plan = build_daily_plan(date(2026, 9, 6), DateSource.CLI_OVERRIDE)

    assert [job.kind for job in plan.jobs] == [ReportKind.DAILY, ReportKind.MONTHLY]
    assert event_mode_for_no_event() == EventMode.NO_EVENT


def test_day_one_creates_monthly_and_monthly_close_for_previous_month() -> None:
    plan = build_daily_plan(date(2026, 9, 1), DateSource.CLI_OVERRIDE)

    assert [job.kind for job in plan.jobs] == [
        ReportKind.DAILY,
        ReportKind.MONTHLY,
        ReportKind.EVENT,
        ReportKind.MONTHLY_CLOSE,
    ]
    monthly = _job(plan, ReportKind.MONTHLY)
    close = _job(plan, ReportKind.MONTHLY_CLOSE)
    assert monthly.metadata['mode'] == MonthlyMode.PREVIOUS_MONTH_CLOSE
    assert close.metadata['mode'] == MonthlyMode.PREVIOUS_MONTH_CLOSE
    assert _period(monthly) == (date(2026, 8, 1), date(2026, 8, 31))
    assert _previous(monthly) == (date(2025, 8, 1), date(2025, 8, 31))
    assert _period(close) == _period(monthly)
    assert close is not monthly


def test_day_one_handles_year_change() -> None:
    plan = build_daily_plan(date(2027, 1, 1), DateSource.CLI_OVERRIDE)

    monthly = _job(plan, ReportKind.MONTHLY)
    close = _job(plan, ReportKind.MONTHLY_CLOSE)
    assert _period(monthly) == (date(2026, 12, 1), date(2026, 12, 31))
    assert _previous(monthly) == (date(2025, 12, 1), date(2025, 12, 31))
    assert _period(close) == _period(monthly)


def test_day_two_uses_running_month() -> None:
    plan = build_daily_plan(date(2026, 9, 2), DateSource.CLI_OVERRIDE)

    monthly = _job(plan, ReportKind.MONTHLY)
    assert monthly.metadata['mode'] == MonthlyMode.RUNNING_MONTH
    assert _period(monthly) == (date(2026, 9, 1), date(2026, 9, 1))
    assert _previous(monthly) == (date(2025, 9, 1), date(2025, 9, 1))


def test_leap_year_monthly_periods_use_calendar_months() -> None:
    plan = build_daily_plan(date(2024, 3, 1), DateSource.CLI_OVERRIDE)

    monthly = _job(plan, ReportKind.MONTHLY)
    close = _job(plan, ReportKind.MONTHLY_CLOSE)
    assert _period(monthly) == (date(2024, 2, 1), date(2024, 2, 29))
    assert _previous(monthly) == (date(2023, 2, 1), date(2023, 2, 28))
    assert _period(close) == _period(monthly)


def test_plan_serializes_to_json() -> None:
    plan = build_daily_plan(date(2026, 9, 4), DateSource.CLI_OVERRIDE)
    payload = plan.as_dict()

    assert payload['reference_date'] == '2026-09-04'
    assert payload['date_source'] == 'CLI_OVERRIDE'
    assert payload['jobs'][0]['current_period'] == {'start': '2026-09-03', 'end': '2026-09-03'}


def test_fresh_run_paths_never_point_to_previous_run() -> None:
    data_root = Path('data')
    root = fresh_run_paths(data_root, 'run_a')
    other = fresh_run_paths(data_root, 'run_b')

    assert root.root.as_posix() == 'data/runs/run_a'
    assert root.raw.as_posix() == 'data/runs/run_a/raw'
    assert root.plan.as_posix() == 'data/runs/run_a/plan.json'
    assert root.manifest.as_posix() == 'data/runs/run_a/manifest.json'
    assert root.quality.as_posix() == 'data/runs/run_a/quality.json'
    assert root.run.as_posix() == 'data/runs/run_a/run.json'
    assert root.root != other.root
