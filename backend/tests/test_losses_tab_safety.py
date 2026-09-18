from pathlib import Path


def test_products_tab_selection_does_not_call_tcm_helper() -> None:
    source = Path('src/superus/reports.py').read_text(encoding='utf-8')
    block = source.split('def select_products_tab', 1)[1].split('def _set_required_states', 1)[0]
    assert 'win32.select_tab_by_text(' not in block
