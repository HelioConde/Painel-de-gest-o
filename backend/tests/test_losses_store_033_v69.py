from pathlib import Path


def _block():
    s=Path("src/superus/reports.py").read_text(encoding="utf-8")
    a=s.index("def _fallback_commit_store_033_by_real_local_click")
    b=s.index("\ndef set_loss_store", a)
    return s[a:b]


def test_033_fallback_scoped_only_to_033():
    s=Path("src/superus/reports.py").read_text(encoding="utf-8")
    assert "if store.code == '033':" in s
    assert "_fallback_commit_store_033_by_real_local_click" in s


def test_033_fallback_uses_local_click_sequence():
    block=_block()
    assert "win32.virtual_click(origin_hwnd)" in block
    assert "win32.virtual_click(destination_hwnd)" in block
    assert "win32.virtual_click(initial_date_hwnd, x=8, y=8)" in block
    assert "win32.set_text(origin_hwnd, expected_code" in block
    assert "win32.set_text(destination_hwnd, expected_code" in block
