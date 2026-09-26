from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from src.automation.daily_sync import (
    DailySyncAlreadyRunning,
    DailySyncLock,
    DailySyncLogger,
    DailySynchronizer,
    SyncCheck,
    SyncPeriod,
)
from src.config.settings import Settings


def _check(kind: str, period: SyncPeriod, exists: bool) -> SyncCheck:
    return SyncCheck(kind, period, exists, 6 if exists else 0, (), 'ok' if exists else 'pendente')


@pytest.mark.parametrize(
    ('reference', 'expected_start', 'expected_end'),
    [
        (date(2026, 9, 24), date(2026, 9, 1), date(2026, 9, 23)),
        (date(2026, 10, 1), date(2026, 9, 1), date(2026, 9, 30)),
    ],
)
def test_period_uses_the_month_of_yesterday(reference, expected_start, expected_end):
    period = SyncPeriod.for_reference_date(reference)
    assert (period.start, period.end) == (expected_start, expected_end)


@pytest.mark.parametrize(
    ('sales_present', 'losses_present', 'expected_sales', 'expected_losses'),
    [
        (True, True, 0, 0),
        (False, True, 1, 0),
        (True, False, 0, 1),
        (False, False, 1, 1),
    ],
)
def test_syncs_only_the_missing_source(tmp_path: Path, sales_present, losses_present, expected_sales, expected_losses):
    state = {'sales': sales_present, 'losses': losses_present, 'sales_calls': 0, 'loss_calls': 0}
    logger = DailySyncLogger(tmp_path, date(2026, 9, 24))

    def sales_check(_settings, period):
        return _check('VENDAS', period, state['sales'])

    def losses_check(_settings, period):
        return _check('PERDAS', period, state['losses'])

    def sync_sales(_reference):
        state['sales_calls'] += 1
        state['sales'] = True

    def sync_losses(_period):
        state['loss_calls'] += 1
        state['losses'] = True

    result = DailySynchronizer(
        Settings(), logger, sales_check=sales_check, losses_check=losses_check,
        sales_sync=sync_sales, losses_sync=sync_losses, sleep=lambda _: None,
    ).execute(date(2026, 9, 24))

    assert result.success
    assert state['sales_calls'] == expected_sales
    assert state['loss_calls'] == expected_losses


def test_retries_then_validates_upload(tmp_path: Path):
    state = {'sales': False, 'calls': 0}
    logger = DailySyncLogger(tmp_path, date(2026, 9, 24))

    def sales_check(_settings, period):
        return _check('VENDAS', period, state['sales'])

    def losses_check(_settings, period):
        return _check('PERDAS', period, True)

    def sync_sales(_reference):
        state['calls'] += 1
        if state['calls'] == 2:
            state['sales'] = True

    result = DailySynchronizer(
        Settings(), logger, sales_check=sales_check, losses_check=losses_check,
        sales_sync=sync_sales, losses_sync=lambda _: None, sleep=lambda _: None,
    ).execute(date(2026, 9, 24))

    assert result.sales_action == 'SYNCED'
    assert state['calls'] == 2
    assert 'tentativa 2/3' in logger.path.read_text(encoding='utf-8')


def test_lock_rejects_concurrent_execution_and_recovers_stale_file(tmp_path: Path):
    path = tmp_path / 'daily-sync.lock'
    first = DailySyncLock(path)
    first.acquire()
    with pytest.raises(DailySyncAlreadyRunning):
        DailySyncLock(path).acquire()
    first.release()

    path.write_text('{"pid": -1}', encoding='utf-8')
    with DailySyncLock(path):
        assert path.exists()
    assert not path.exists()
