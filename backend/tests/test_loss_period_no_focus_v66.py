from pathlib import Path


def test_v66_loss_period_does_not_touch_focus_or_ok():
    source = Path('src/superus/reports.py').read_text(encoding='utf-8')
    block = source.split('def set_loss_period', 1)[1].split('def configure_products', 1)[0]
    executable = block.split('\"\"\"', 2)[-1] if block.count('\"\"\"') >= 2 else block
    assert 'win32.send(initial.hwnd, WM_SETFOCUS' not in executable
    assert 'win32.send(initial.hwnd, WM_KILLFOCUS' not in executable
    assert 'win32.send(final.hwnd, WM_SETFOCUS' not in executable
    assert 'win32.send(final.hwnd, WM_KILLFOCUS' not in executable
    assert "'TBitBtn'" not in block
    assert 'win32.set_text(initial.hwnd' in block
    assert 'win32.set_text(final.hwnd' in block


def test_v66_generate_loss_report_still_clicks_ok():
    source = Path('src/superus/reports.py').read_text(encoding='utf-8')
    block = source.split('def generate_loss_report', 1)[1].split('def collect_loss_htm', 1)[0]
    assert "control_by_instance(report, 'TBitBtn', 2)" in block
    assert 'win32.click(ok.hwnd)' in block
