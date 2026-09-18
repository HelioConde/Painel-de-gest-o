from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pytest

from src.business.periods import ReportPeriod
from src.business.planner import DateSource, ReportJob
from src.superus.errors import SuperusError
from src.superus.executor import execute_daily_auto, planned_filename

HTML_TEMPLATE = """
<html>
<head><meta charset="utf-8"><title>Relatório Sintético por SubGrupo</title></head>
<body>
Período {start_br} a {end_br}
SUPERMERCADO PRIMOR 01 307 SUPERMERCADO PRIMOR 02 212 SUPERMERCADO PRIMOR 03 600 SUPERMERCADO PRIMOR 04 120 SUPERMERCADO PRIMOR 05 033 SUPERMERCADO PRIMOR 06 018
Setor Grupo SubGrupo
<table><tr><td>QRDBText1</td></tr></table>
</body>
</html>
"""


@dataclass
class FakeClient:
    calls: list[tuple[str, str, ReportPeriod, Path]]
    background: dict[str, int]
    session: str = 'YES'
    startup: str = 'existing_session'
    login: str = 'NOT_NEEDED'
    report_window: str = 'PASS'

    def collect(self, job: ReportJob, side: str, period: ReportPeriod, destination: Path) -> None:
        self.calls.append((job.slug, side, period, destination))
        destination.write_text(
            HTML_TEMPLATE.format(
                start_br=period.start.strftime('%d/%m/%Y'),
                end_br=period.end.strftime('%d/%m/%Y'),
            ),
            encoding='utf-8',
        )


def test_executor_respects_daily_order_and_independent_sides(tmp_path: Path) -> None:
    client = FakeClient([], {'physical_mouse_moves': 0, 'global_keyboard_uses': 0, 'foreground_calls': 0})

    result = execute_daily_auto(
        reference_date=date(2026, 9, 4),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=client,
        only_job='daily',
    )

    assert result.status == 'PASS'
    assert [(call[0], call[1]) for call in client.calls] == [('daily', 'current'), ('daily', 'previous')]
    assert client.calls[0][3].name == 'daily_current.htm'
    assert client.calls[1][3].name == 'daily_previous.htm'
    assert client.calls[0][3] != client.calls[1][3]


def test_monthly_and_monthly_close_never_share_artifacts_on_day_one(tmp_path: Path) -> None:
    client = FakeClient([], {'physical_mouse_moves': 0, 'global_keyboard_uses': 0, 'foreground_calls': 0})

    result = execute_daily_auto(
        reference_date=date(2026, 11, 1),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=client,
    )

    selected = [(call[0], call[1], call[2], call[3].name) for call in client.calls]
    assert result.status == 'PASS'
    assert selected == [
        ('daily', 'current', ReportPeriod(date(2026, 10, 31), date(2026, 10, 31)), 'daily_current.htm'),
        ('daily', 'previous', ReportPeriod(date(2025, 11, 1), date(2025, 11, 1)), 'daily_previous.htm'),
        ('monthly', 'current', ReportPeriod(date(2026, 10, 1), date(2026, 10, 31)), 'monthly_current.htm'),
        ('monthly', 'previous', ReportPeriod(date(2025, 10, 1), date(2025, 10, 31)), 'monthly_previous.htm'),
        (
            'monthly_close',
            'current',
            ReportPeriod(date(2026, 10, 1), date(2026, 10, 31)),
            'monthly_close_current.htm',
        ),
        (
            'monthly_close',
            'previous',
            ReportPeriod(date(2025, 10, 1), date(2025, 10, 31)),
            'monthly_close_previous.htm',
        ),
    ]
    assert len({call[3] for call in client.calls}) == len(client.calls)


def test_monthly_close_only_generates_two_independent_files(tmp_path: Path) -> None:
    client = FakeClient([], {'physical_mouse_moves': 0, 'global_keyboard_uses': 0, 'foreground_calls': 0})

    result = execute_daily_auto(
        reference_date=date(2026, 9, 1),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=client,
        only_job='monthly_close',
    )

    assert result.status == 'PASS'
    assert [(call[0], call[1], call[3].name) for call in client.calls] == [
        ('monthly_close', 'current', 'monthly_close_current.htm'),
        ('monthly_close', 'previous', 'monthly_close_previous.htm'),
    ]


def test_existing_file_in_current_run_fails(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from src.superus import executor

    class PreExistingPaths:
        root = tmp_path / 'runs' / 'known_run'
        raw = root / 'raw'
        plan = root / 'plan.json'
        manifest = root / 'manifest.json'
        quality = root / 'quality.json'
        run = root / 'run.json'

        def create(self) -> None:
            self.raw.mkdir(parents=True, exist_ok=False)
            (self.raw / 'daily_current.htm').write_text('old file', encoding='utf-8')

    monkeypatch.setattr(executor, '_new_run_id', lambda: 'known_run')
    monkeypatch.setattr(executor, 'fresh_run_paths', lambda *_: PreExistingPaths())
    client = FakeClient([], {'physical_mouse_moves': 0, 'global_keyboard_uses': 0, 'foreground_calls': 0})

    result = execute_daily_auto(
        reference_date=date(2026, 9, 4),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=client,
        only_job='daily',
    )

    assert result.status == 'FAIL'
    assert result.collections[-1].status == 'FAILED_COLLECTION'


def test_event_uses_fresh_base_report_without_ui_filter(tmp_path: Path) -> None:
    client = FakeClient([], {'physical_mouse_moves': 0, 'global_keyboard_uses': 0, 'foreground_calls': 0})

    result = execute_daily_auto(
        reference_date=date(2026, 9, 8),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=client,
        only_job='event',
    )

    assert result.status == 'PASS'
    assert [(call[0], call[1]) for call in client.calls] == [
        ('segunda_pizza', 'current'), ('segunda_pizza', 'previous')
    ]


def test_filenames_are_deterministic(tmp_path: Path) -> None:
    result = execute_daily_auto(
        reference_date=date(2026, 9, 4),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=None,
        dry_run=True,
    )

    names = [planned_filename(job, side) for job in result.plan.jobs for side in ('current', 'previous')]
    assert names == [
        'daily_current.htm',
        'daily_previous.htm',
        'monthly_current.htm',
        'monthly_previous.htm',
        'event_quarta_quinta_verde_current.htm',
        'event_quarta_quinta_verde_previous.htm',
    ]


def test_manifest_and_dry_run_are_written(tmp_path: Path) -> None:
    result = execute_daily_auto(
        reference_date=date(2026, 9, 4),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=None,
        dry_run=True,
        only_job='daily',
    )

    assert result.status == 'DRY_RUN'
    assert (result.run_dir / 'plan.json').exists()
    assert (result.run_dir / 'manifest.json').exists()
    assert (result.run_dir / 'quality.json').exists()
    assert (result.run_dir / 'run.json').exists()
    assert not list((result.run_dir / 'raw').glob('*.htm'))


def test_reruns_use_distinct_run_paths(tmp_path: Path) -> None:
    first = execute_daily_auto(
        reference_date=date(2026, 9, 4),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=None,
        dry_run=True,
    )
    second = execute_daily_auto(
        reference_date=date(2026, 9, 4),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=None,
        dry_run=True,
    )

    assert first.run_id != second.run_id
    assert first.run_dir != second.run_dir


def test_background_counter_failure_fails_run(tmp_path: Path) -> None:
    client = FakeClient([], {'physical_mouse_moves': 1, 'global_keyboard_uses': 0, 'foreground_calls': 0})

    result = execute_daily_auto(
        reference_date=date(2026, 9, 4),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=client,
        only_job='daily',
    )

    assert result.status == 'FAIL'
    assert 'background' in (result.collections[-1].error or '').lower()


def test_execute_requires_client_outside_dry_run(tmp_path: Path) -> None:
    with pytest.raises(SuperusError):
        execute_daily_auto(
            reference_date=date(2026, 9, 4),
            date_source=DateSource.CLI_OVERRIDE,
            data_root=tmp_path,
            client=None,
        )


def test_observed_user_focus_or_cursor_changes_do_not_violate_background(tmp_path: Path) -> None:
    client = FakeClient(
        [],
        {
            'physical_mouse_moves': 0,
            'global_keyboard_uses': 0,
            'foreground_calls': 0,
            'observed_focus_changes': 2,
            'observed_cursor_changes': 4,
        },
    )

    result = execute_daily_auto(
        reference_date=date(2026, 9, 4),
        date_source=DateSource.CLI_OVERRIDE,
        data_root=tmp_path,
        client=client,
        only_job='daily',
    )

    assert result.status == 'PASS'
    quality = (result.run_dir / 'quality.json').read_text(encoding='utf-8')
    assert '"background_pass": true' in quality.lower()
