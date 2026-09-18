from src.business.loss_products import (
    filter_excluded_loss_products,
    is_excluded_loss_product,
)


def _product(code, name, quantity, total):
    return {
        'product_code': code,
        'product_name': name,
        'mip': 'MIP',
        'unit': 'KG',
        'loss_quantity': quantity,
        'quantity_sold': 100,
        'loss_quantity_sales_percent': 1,
        'gross_cost_total': total / 2,
        'sale_price_total': total,
        'total_value': total,
    }


def test_excluded_product_prefers_code_and_uses_normalized_name_fallback():
    assert is_excluded_loss_product({'product_code': '410364', 'product_name': 'Outro'})
    assert is_excluded_loss_product({'product_code': '', 'product_name': 'Muchiba/Osso'})
    assert not is_excluded_loss_product({'product_code': '123', 'product_name': 'Coxinha'})


def test_filter_removes_muchiba_before_totals_and_ranking():
    muchiba = _product('410364', 'MUCHIBA/OSSO', 1210, 500)
    coxinha = _product('200', 'COXINHA', 24.98, 80)
    report = {
        'sectors': [{
            'name': 'ACOUGUE',
            'mips': [{'name': 'MIP', 'products': [muchiba, coxinha]}],
            'top_losses': [muchiba, coxinha],
            'reported_totals': {'total_value': 580},
            'calculated_monetary_totals': {'total_value': 580},
        }],
        'grand_totals': {'record_count': 2, 'loss_quantity': 1234.98, 'total_value': 580},
        'quality': {'status': 'PASS', 'checks': {}},
    }

    filtered = filter_excluded_loss_products(report)

    products = filtered['sectors'][0]['mips'][0]['products']
    assert [item['product_name'] for item in products] == ['COXINHA']
    assert filtered['sectors'][0]['top_losses'][0]['product_name'] == 'COXINHA'
    assert filtered['grand_totals']['record_count'] == 1
    assert filtered['grand_totals']['loss_quantity'] == 24.98
    assert filtered['grand_totals']['total_value'] == 80
    assert filtered['quality']['excluded_product_count'] == 1
