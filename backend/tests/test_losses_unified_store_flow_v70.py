from pathlib import Path


def _source() -> str:
    return Path('src/superus/reports.py').read_text(encoding='utf-8')


def test_no_special_case_for_store_033():
    source = _source()
    assert "if store.code == '033'" not in source
    assert "_fallback_commit_store_033" not in source


def test_store_flow_remains_common_for_all_stores():
    source = _source()
    start = source.index('def set_loss_store')
    end = source.index('\ndef set_loss_period', start)
    block = source[start:end]
    assert "_commit_combo_exit(" in block
    assert "validate_loss_store_state(" in block
    assert "timeout=8.0" in block


def test_period_flow_has_no_store_specific_branch():
    source = _source()
    start = source.index('def set_loss_period')
    end = source.index('\ndef configure_products', start)
    block = source[start:end]
    assert "store_code" not in block
    assert "033" not in block
