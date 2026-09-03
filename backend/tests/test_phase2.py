import argparse
from pathlib import Path

import pytest

from src.app.controller import parse_date
from src.config.settings import Settings
from src.config.stores import STORES, get_store
from src.parsers.html_report import read_html, validate_html
from src.superus.export_html import wait_file_stable
from src.superus.launcher import select_startup


def test_canonical_store_codes() -> None:
    assert {code: store.superus_code for code, store in STORES.items()} == {
        '307': '17', '212': '15608', '600': '63395', '120': '66471', '033': '72731', '018': '74964',
    }
    assert get_store('307').superus_code == '17'


def test_settings_accepts_empty_optional_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('SUPERUS_LAUNCHER_PATH', '')
    monkeypatch.setenv('SUPERUS_EXECUTABLE_PATH', '')
    settings = Settings.from_environment()
    assert settings.superus_launcher_path is None
    assert settings.superus_executable_path is None


class FakeWin32:
    def __init__(self, windows: dict[str, int]) -> None:
        self.windows = windows

    def find_window(self, class_name: str) -> int | None:
        return self.windows.get(class_name)


def test_startup_prefers_existing_session(tmp_path: Path) -> None:
    launcher = tmp_path / 'Launcher.exe'
    launcher.touch()
    selection = select_startup(
        FakeWin32({'TFormPedidos': 99}),  # type: ignore[arg-type]
        Settings(superus_launcher_path=launcher),
    )
    assert selection.method == 'existing_session'
    assert selection.hwnd == 99


def test_startup_prefers_configured_launcher(tmp_path: Path) -> None:
    launcher = tmp_path / 'Launcher.exe'
    launcher.touch()
    selection = select_startup(FakeWin32({}), Settings(superus_launcher_path=launcher))  # type: ignore[arg-type]
    assert selection.method == 'launcher'
    assert selection.path == launcher


def test_startup_can_use_executable(tmp_path: Path) -> None:
    executable = tmp_path / 'Superus.exe'
    executable.touch()
    selection = select_startup(FakeWin32({}), Settings(superus_executable_path=executable))  # type: ignore[arg-type]
    assert selection.method == 'superus_executable'
    assert selection.path == executable


def test_startup_is_clear_when_no_executable() -> None:
    selection = select_startup(FakeWin32({}), Settings())  # type: ignore[arg-type]
    assert selection.method == 'unavailable'


def test_date_validation() -> None:
    assert parse_date('01/09/2026') == '01/09/2026'
    with pytest.raises(argparse.ArgumentTypeError):
        parse_date('2026-09-01')


def test_html_validation_and_encoding(tmp_path: Path) -> None:
    report = tmp_path / 'report.htm'
    report.write_bytes(
        b'<html><meta charset="iso-8859-1"><title>Relat\xf3rio Sint\xe9tico por SubGrupo</title>'
        b'<body>Loja 307 Per\xedodo 01/09/2026 a 01/09/2026 Setor Grupo QRDBText1</body></html>'
    )
    content, encoding = read_html(report)
    assert 'Relatório' in content
    assert encoding == 'iso-8859-1'
    assert validate_html(report, '307', '01/09/2026', '01/09/2026').sector_found


def test_wait_file_stable(tmp_path: Path) -> None:
    report = tmp_path / 'report.htm'
    report.write_text('<html>ok</html>', encoding='utf-8')
    assert wait_file_stable(report, poll_seconds=0.001, stable_reads=1) == report
