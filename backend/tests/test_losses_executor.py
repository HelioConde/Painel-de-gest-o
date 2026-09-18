from contextlib import contextmanager
from datetime import date

from src.business.event_config import EvidenceStatus, event_config_for
from src.superus.losses_executor import previous_year_date
from src.superus.reports import _products_tab_is_active, select_products_tab


def test_losses_previous_year_uses_calendar_year() -> None:
    assert previous_year_date(date(2026, 9, 4)) == date(2025, 9, 4)
    assert previous_year_date(date(2024, 2, 29)) == date(2023, 2, 28)


def test_events_use_one_proven_base_sales_automation() -> None:
    assert event_config_for('fim_semana').evidence_status == EvidenceStatus.CONFIRMED
    meat = event_config_for('terca_carne')
    assert meat.selector_type == 'ALL_SALES'
    assert meat.post_filter_sector == 'ACOUGUE'
    assert meat.automation_strategy == 'base_sales_report_post_filter'
    assert event_config_for('quarta_quinta_verde').selector_type == 'ALL_SALES'
    pizza = event_config_for('segunda_pizza')
    assert pizza.selector_type == 'ALL_SALES'
    assert pizza.post_filter_sector == 'PIZZARIA'
    assert pizza.metric == 'quantity'
    assert pizza.unit == 'QTD'
    bread = event_config_for('sexta_pao')
    assert bread.post_filter_sector == 'PADARIA'


class _Control:
    def __init__(self, hwnd: int, text: str, visible: bool = True, width: int = 100, height: int = 20):
        self.hwnd = hwnd
        self.text = text
        self.visible = visible
        self.width = width
        self.height = height


class _FakeTabWin32:
    def __init__(self) -> None:
        self.active = False
        self.clicked: list[tuple[int, int, int]] = []
        self.tcm_called = False
        self.page = _Control(99, '', True, 1200, 700)

    def control_by_instance(self, _parent, class_name, instance):
        if class_name == 'TPageControl' and instance == 1:
            return self.page
        if class_name == 'TRadioButton' and instance == 3:
            return _Control(3, 'Produtos por MIP' if self.active else 'Notas Emitidas', True)
        if class_name == 'TCheckBox' and instance == 5:
            return _Control(5, 'Agrupa Itens' if self.active else 'Outra opção', True)
        raise RuntimeError((class_name, instance))

    def select_tab_by_text(self, _hwnd, _wanted):
        self.tcm_called = True
        raise AssertionError('Perdas não deve usar TCM_* no TPageControl Delphi')

    @contextmanager
    def background_step(self, _name, _logger=None):
        yield

    def virtual_click(self, hwnd, x, y):
        self.clicked.append((hwnd, x, y))
        if hwnd == self.page.hwnd and 70 <= x <= 90 and 5 <= y <= 18:
            self.active = True

    def wait(self, predicate, _timeout, _description):
        value = predicate()
        if value:
            return value
        raise RuntimeError('timeout')

    def children(self, _parent):
        return []


def test_products_tab_does_not_confuse_visible_radio_from_pedidos() -> None:
    win32 = _FakeTabWin32()
    assert _products_tab_is_active(win32, 1) is False
    select_products_tab(win32, 1)
    assert win32.active is True
    assert win32.clicked
    assert win32.tcm_called is False


def test_products_tab_active_requires_expected_captions() -> None:
    win32 = _FakeTabWin32()
    win32.active = True
    assert _products_tab_is_active(win32, 1) is True
