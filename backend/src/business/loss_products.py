from __future__ import annotations

import re
import unicodedata
from copy import deepcopy
from typing import Any

EXCLUDED_LOSS_PRODUCT_CODES = {'410364'}
EXCLUDED_LOSS_PRODUCT_NAMES = {'MUCHIBA OSSO'}
MONETARY_FIELDS = ('gross_cost_total', 'sale_price_total', 'total_value')


def _normalized_name(value: Any) -> str:
    text = unicodedata.normalize('NFD', str(value or '').strip())
    text = ''.join(char for char in text if unicodedata.category(char) != 'Mn')
    return re.sub(r'[^A-Z0-9]+', ' ', text.upper()).strip()


def is_excluded_loss_product(product: dict[str, Any] | None) -> bool:
    product = product or {}
    code = re.sub(r'\D+', '', str(product.get('product_code') or ''))
    if code in EXCLUDED_LOSS_PRODUCT_CODES:
        return True
    return _normalized_name(product.get('product_name')) in EXCLUDED_LOSS_PRODUCT_NAMES


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _totals(products: list[dict[str, Any]]) -> dict[str, float]:
    return {
        'loss_quantity': round(sum(_number(item.get('loss_quantity')) for item in products), 4),
        **{
            field: round(sum(_number(item.get(field)) for item in products), 4)
            for field in MONETARY_FIELDS
        },
    }


def _top_losses(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered = sorted(
        products,
        key=lambda product: (
            _number(product.get('loss_quantity')),
            _number(product.get('total_value')),
        ),
        reverse=True,
    )[:10]
    fields = (
        'product_code', 'product_name', 'mip', 'unit', 'loss_quantity',
        'quantity_sold', 'loss_quantity_sales_percent', 'total_value',
    )
    return [
        {'rank': index + 1, **{field: product.get(field) for field in fields}}
        for index, product in enumerate(ordered)
    ]


def filter_excluded_loss_products(report: dict[str, Any]) -> dict[str, Any]:
    """Remove produtos ignorados e refaz todas as agregações do relatório."""
    filtered = deepcopy(report)
    excluded_count = 0
    all_products: list[dict[str, Any]] = []

    for sector in filtered.get('sectors') or []:
        sector_products: list[dict[str, Any]] = []
        filtered_mips: list[dict[str, Any]] = []
        for mip in sector.get('mips') or []:
            products = []
            for product in mip.get('products') or []:
                if is_excluded_loss_product(product):
                    excluded_count += 1
                    continue
                products.append(product)
            if products:
                filtered_mips.append({**mip, 'products': products})
                sector_products.extend(products)

        totals = _totals(sector_products)
        sector['mips'] = filtered_mips
        sector['product_count'] = len(sector_products)
        sector['top_losses'] = _top_losses(sector_products)
        sector['reported_totals'] = totals
        sector['calculated_monetary_totals'] = {
            field: totals[field] for field in MONETARY_FIELDS
        }
        all_products.extend(sector_products)

    totals = _totals(all_products)
    filtered['grand_totals'] = {
        'record_count': len(all_products),
        **totals,
    }
    quality = filtered.setdefault('quality', {})
    quality['product_count'] = len(all_products)
    quality['excluded_product_count'] = excluded_count
    quality.setdefault('checks', {})['excluded_products_removed'] = True
    return filtered
