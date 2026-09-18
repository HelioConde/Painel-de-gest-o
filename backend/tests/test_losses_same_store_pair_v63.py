from datetime import date
from types import SimpleNamespace

import src.superus.losses_executor as losses_executor


class _Audit:
    def as_dict(self):
        return {
            'physical_mouse_moves': 0,
            'global_keyboard_uses': 0,
            'foreground_calls': 0,
            'observed_focus_changes': 0,
            'observed_cursor_changes': 0,
        }


class _FakeWin32:
    def __init__(self):
        self.audit = _Audit()


def test_current_configures_store_previous_only_changes_period(monkeypatch, tmp_path):
    calls = []

    monkeypatch.setattr(losses_executor, 'Win32', _FakeWin32)
    monkeypatch.setattr(
        losses_executor,
        'prepare_superus',
        lambda win32, settings, logger=None: SimpleNamespace(menu_hwnd=111),
    )
    monkeypatch.setattr(
        losses_executor,
        'open_pedidos',
        lambda win32, menu_hwnd, logger=None: 222,
    )
    monkeypatch.setattr(
        losses_executor,
        'open_reports',
        lambda win32, pedidos, logger=None: 333,
    )

    def fake_collect(
        win32,
        report,
        store_code,
        start,
        end,
        destination,
        settings,
        logger=None,
        *,
        configure_store=True,
    ):
        calls.append((store_code, start, end, configure_store))
        return None, 'NO_DATA'

    monkeypatch.setattr(losses_executor, 'collect_loss_htm', fake_collect)

    result = losses_executor.execute_losses(
        start=date(2026, 9, 1),
        end=date(2026, 9, 3),
        stores=['307'],
        data_root=tmp_path,
        settings=object(),
    )

    assert result.status == 'PASS'
    assert calls == [
        ('307', date(2026, 9, 1), date(2026, 9, 3), True),
        ('307', date(2025, 9, 1), date(2025, 9, 3), False),
    ]
