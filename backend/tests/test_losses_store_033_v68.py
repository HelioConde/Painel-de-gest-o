from pathlib import Path


def _reports_source() -> str:
    return Path('src/superus/reports.py').read_text(encoding='utf-8')


def test_033_fallback_is_scoped_only_to_store_033():
    source = _reports_source()
    assert "if store.code == '033':" in source
    assert '_fallback_commit_store_033(' in source


def test_033_fallback_uses_directed_enter_and_tab():
    source = _reports_source()
    start = source.index('def _fallback_commit_store_033')
    end = source.index('\ndef set_loss_store', start)
    block = source[start:end]
    assert 'VK_RETURN' in block
    assert 'VK_TAB' in block
    assert 'SetForegroundWindow' not in block
    assert 'SetFocus(' not in block
    assert 'pyautogui' not in block
