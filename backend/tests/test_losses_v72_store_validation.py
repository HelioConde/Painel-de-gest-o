from pathlib import Path


def _source() -> str:
    return Path('src/superus/reports.py').read_text(encoding='utf-8')


def test_store_validation_does_not_gate_on_visible_name_count():
    source = _source()
    start = source.index('def validate_loss_store_state')
    end = source.index('\ndef _commit_combo_exit', start)
    block = source[start:end]
    condition = block[block.index('if ('):block.index('):', block.index('if (')) + 2]
    assert 'last_names' not in condition
    assert 'last_origin == store.superus_code' in condition
    assert 'last_destination == store.superus_code' in condition


def test_no_special_case_for_033():
    source = _source()
    assert "if store.code == '033'" not in source
    assert '_fallback_commit_store_033' not in source
