from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class ReportPeriod:
    start: date
    end: date

    def shifted_days(self, days: int) -> ReportPeriod:
        return ReportPeriod(self.start + timedelta(days=days), self.end + timedelta(days=days))

    def as_dict(self) -> dict[str, str]:
        return {'start': self.start.isoformat(), 'end': self.end.isoformat()}


def daily_periods(reference_date: date) -> tuple[ReportPeriod, ReportPeriod]:
    current_day = reference_date - timedelta(days=1)
    current = ReportPeriod(current_day, current_day)
    return current, current.shifted_days(-364)


def month_start(value: date) -> date:
    return value.replace(day=1)


def previous_month(value: date) -> date:
    if value.month == 1:
        return date(value.year - 1, 12, 1)
    return date(value.year, value.month - 1, 1)


def month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def same_month_previous_year(period: ReportPeriod) -> ReportPeriod:
    previous_end_year = period.end.year - 1
    previous_end_day = min(period.end.day, calendar.monthrange(previous_end_year, period.end.month)[1])
    return ReportPeriod(
        period.start.replace(year=period.start.year - 1),
        period.end.replace(year=previous_end_year, day=previous_end_day),
    )


def running_month_periods(reference_date: date) -> tuple[ReportPeriod, ReportPeriod]:
    yesterday = reference_date - timedelta(days=1)
    # At 00:00 on the first day, "ontem" belongs to the preceding month.
    # The period must never start after its own end date.
    current = ReportPeriod(month_start(yesterday), yesterday)
    return current, same_month_previous_year(current)


def previous_month_close_periods(reference_date: date) -> tuple[ReportPeriod, ReportPeriod]:
    start = previous_month(reference_date)
    current = ReportPeriod(start, month_end(start.year, start.month))
    return current, same_month_previous_year(current)
