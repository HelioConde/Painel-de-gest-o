from decimal import Decimal

from src.business import loss_products
from src.business.loss_products import filter_loss_indicator_products
from src.config.loss_rules import LOSS_PRODUCT_EXCLUSIONS, LossProductExclusion


def _product(code: str, name: str, value: str) -> dict:
    return {
        'product_code': code,
        'product_name': name,
        'mip': None,
        'loss_quantity': 1,
        'quantity_sold': 10,
        'loss_quantity_sales_percent': 10,
        'gross_cost_total': float(Decimal(value) / 2),
        'sale_price_total': float(value),
        'total_value': float(value),
    }


def _report() -> dict:
    muchiba = _product('410364', ' MUCHIBA / OSSO ', '100.00')
    valid = _product('200', 'Produto comum', '80.00')
    second_sector = _product('201', 'Produto de outro setor', '12.50')
    production = _product('300', 'Producao', '70.00')
    exchange = _product('301', 'Troca', '60.00')
    consumption = _product('302', 'Consumo', '50.00')
    return {
        'sectors': [
            {
                'name': 'ACOUGUE',
                'mips': [
                    {'name': 'PERDA ACOUGUE', 'products': [muchiba, valid]},
                    {'name': 'PRODUCAO ACOUGUE', 'products': [production]},
                    {'name': 'TROCA', 'products': [exchange]},
                    {'name': 'CONSUMO/MANUTENCAO LOJA', 'products': [consumption]},
                ],
            },
            {
                'name': 'FLV MANIPULADOS',
                'mips': [{'name': 'PERDA HORTIFRUTI', 'products': [second_sector]}],
            },
        ],
        'grand_totals': {},
        'quality': {'status': 'PASS', 'checks': {}},
    }


def test_indicator_accepts_only_loss_mips_and_respects_real_product_sector():
    filtered = filter_loss_indicator_products(_report())

    acougue, flv = filtered['sectors']
    assert acougue['reported_totals']['total_value'] == 80.0
    assert flv['reported_totals']['total_value'] == 12.5
    assert filtered['grand_totals']['total_value'] == 92.5
    assert filtered['grand_totals']['record_count'] == 2
    assert filtered['quality']['excluded_product_count'] == 1
    assert [item['name'] for item in acougue['mips']] == ['PERDA ACOUGUE']
    assert [item['name'] for item in flv['mips']] == ['PERDA HORTIFRUTI']
    assert {
        'name': 'PERDA ACOUGUE', 'classification': 'LOSS', 'product_count': 2, 'total_value': 180.0,
    } in filtered['quality']['loss_mip_audit']['mips']


def test_indicator_uses_same_rules_for_current_and_previous_reports():
    current = filter_loss_indicator_products(_report())
    previous = filter_loss_indicator_products(_report())

    assert current['grand_totals'] == previous['grand_totals']
    assert current['quality']['loss_mip_audit'] == previous['quality']['loss_mip_audit']


def test_unknown_mip_is_audited_and_fail_closed():
    report = _report()
    report['sectors'][0]['mips'].append(
        {'name': 'AJUSTE OPERACIONAL NOVO', 'products': [_product('900', 'Ajuste', '40.00')]}
    )

    filtered = filter_loss_indicator_products(report)

    assert filtered['grand_totals']['total_value'] == 92.5
    audit = filtered['quality']['loss_mip_audit']['skipped_mips']
    assert {'name': 'AJUSTE OPERACIONAL NOVO', 'classification': 'AMBIGUOUS', 'product_count': 1, 'total_value': 40.0} in audit
    assert filtered['quality']['checks']['ambiguous_mips_excluded'] is True
    assert filtered['quality']['checks']['ambiguous_mips_detected'] is True


def test_new_exclusion_can_be_registered_without_changing_algorithm(monkeypatch):
    monkeypatch.setattr(
        loss_products,
        'LOSS_PRODUCT_EXCLUSIONS',
        (*LOSS_PRODUCT_EXCLUSIONS,
            LossProductExclusion('Produto comum', None, 'Teste de cadastro'),
        ),
    )

    filtered = filter_loss_indicator_products(_report())

    assert filtered['grand_totals']['total_value'] == 12.5
    assert filtered['quality']['excluded_product_count'] == 2
