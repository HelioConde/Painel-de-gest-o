from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from enum import StrEnum

from src.business.periods import ReportPeriod


class EventMode(StrEnum):
    SINGLE_DAY = 'SINGLE_DAY'
    PARTIAL = 'PARTIAL'
    COMPLETE = 'COMPLETE'
    WEEKEND = 'WEEKEND'
    NO_EVENT = 'NO_EVENT'


@dataclass(frozen=True)
class EventDefinition:
    slug: str
    name: str
    current_period: ReportPeriod
    previous_period: ReportPeriod
    mode: EventMode
    metric: str
    unit: str | None = None


def _single_day_event(
    slug: str,
    name: str,
    event_day: date,
    metric: str = 'monetary',
    unit: str | None = None,
) -> EventDefinition:
    current = ReportPeriod(event_day, event_day)
    return EventDefinition(
        slug=slug,
        name=name,
        current_period=current,
        previous_period=current.shifted_days(-364),
        mode=EventMode.SINGLE_DAY,
        metric=metric,
        unit=unit,
    )


def event_for(reference_date: date) -> EventDefinition | None:
    weekday = reference_date.weekday()
    if weekday == 0:
        saturday = reference_date - timedelta(days=2)
        sunday = reference_date - timedelta(days=1)
        current = ReportPeriod(saturday, sunday)
        return EventDefinition(
            slug='fim_semana',
            name='Fim de semana',
            current_period=current,
            previous_period=current.shifted_days(-364),
            mode=EventMode.WEEKEND,
            metric='monetary',
        )
    if weekday == 1:
        return _single_day_event(
            slug='segunda_pizza',
            name='Segunda da Pizza',
            event_day=reference_date - timedelta(days=1),
            metric='quantity',
            unit='QTD',
        )
    if weekday == 2:
        return _single_day_event(
            slug='terca_carne',
            name='Terça da Carne',
            event_day=reference_date - timedelta(days=1),
        )
    if weekday == 3:
        wednesday = reference_date - timedelta(days=1)
        current = ReportPeriod(wednesday, wednesday)
        return EventDefinition(
            slug='quarta_quinta_verde',
            name='Quarta e Quinta Verde',
            current_period=current,
            previous_period=current.shifted_days(-364),
            mode=EventMode.PARTIAL,
            metric='monetary',
        )
    if weekday == 4:
        wednesday = reference_date - timedelta(days=2)
        thursday = reference_date - timedelta(days=1)
        current = ReportPeriod(wednesday, thursday)
        return EventDefinition(
            slug='quarta_quinta_verde',
            name='Quarta e Quinta Verde',
            current_period=current,
            previous_period=current.shifted_days(-364),
            mode=EventMode.COMPLETE,
            metric='monetary',
        )
    if weekday == 5:
        return _single_day_event(
            slug='sexta_pao',
            name='Sexta do Pão',
            event_day=reference_date - timedelta(days=1),
        )
    return None
