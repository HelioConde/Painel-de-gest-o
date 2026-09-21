from __future__ import annotations

from copy import deepcopy
from decimal import Decimal
from typing import Any

from src.config.loss_rules import (
    LOSS_PRODUCT_EXCLUSIONS,
    classify_loss_mip,
    normalize_loss_text,
)

MONETARY_FIELDS = ('gross_cost_total', 'sale_price_total', 'total_value')


def _product_code(value: Any) -> str:
    return ''.join(char for char in str(value or '') if char.isdigit())


def is_excluded_loss_product(product: dict[str, Any] | None) -> bool:
    product = product or {}
    code = _product_code(product.get('product_code'))
    name = normalize_loss_text(product.get('product_name'))
    return any(
        exclusion.active
        and (
            (exclusion.product_code and code == _product_code(exclusion.product_code))
            or (
                exclusion.product_name
                and name == normalize_loss_text(exclusion.product_name)
            )
        )
        for exclusion in LOSS_PRODUCT_EXCLUSIONS
    )


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal('0')


def _totals(products: list[dict[str, Any]]) -> dict[str, float]:
    return {
        'loss_quantity': round(sum(_number(item.get('loss_quantity')) for item in products), 4),
        **{
            field: float(sum((_money(item.get(field)) for item in products), Decimal('0')))
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


def filter_loss_indicator_products(report: dict[str, Any]) -> dict[str, Any]:
    """Mantém apenas perda real, aplica exclusões e refaz agregações por setor.

    A regra é fail-closed para MIPs novos/ambíguos: eles são auditados, mas não
    entram no indicador até receberem classificação explícita no cadastro.
    """
    filtered = deepcopy(report)
    excluded_count = 0
    mip_audit: dict[str, dict[str, Any]] = {}
    all_products: list[dict[str, Any]] = []

    for sector in filtered.get('sectors') or []:
        sector_products: list[dict[str, Any]] = []
        filtered_mips: list[dict[str, Any]] = []
        for mip in sector.get('mips') or []:
            classification = classify_loss_mip(mip.get('name'))
            mip_name = str(mip.get('name') or '')
            products = list(mip.get('products') or [])
            audit = mip_audit.setdefault(
                mip_name,
                {'classification': classification, 'product_count': 0, 'total_value': Decimal('0')},
            )
            audit['product_count'] += len(products)
            audit['total_value'] += sum(
                (_money(product.get('total_value')) for product in products),
                Decimal('0'),
            )
            if classification != 'LOSS':
                continue

            valid_products = []
            for product in products:
                if is_excluded_loss_product(product):
                    excluded_count += 1
                    continue
                valid_products.append(product)
            if valid_products:
                filtered_mips.append({**mip, 'products': valid_products})
                sector_products.extend(valid_products)

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
    filtered['grand_totals'] = {'record_count': len(all_products), **totals}
    quality = filtered.setdefault('quality', {})
    quality['product_count'] = len(all_products)
    quality['excluded_product_count'] = excluded_count
    audited_mips = [
        {
            'name': name,
            'classification': audit['classification'],
            'product_count': audit['product_count'],
            'total_value': float(audit['total_value']),
        }
        for name, audit in sorted(mip_audit.items())
    ]
    quality['loss_mip_audit'] = {
        'mips': audited_mips,
        'allowed_mips': [
            item['name'] for item in audited_mips if item['classification'] == 'LOSS'
        ],
        'skipped_mips': [
            item for item in audited_mips if item['classification'] != 'LOSS'
        ],
    }
    checks = quality.setdefault('checks', {})
    checks['loss_mips_filtered'] = True
    checks['excluded_products_removed'] = True
    checks['ambiguous_mips_excluded'] = True
    checks['ambiguous_mips_detected'] = any(
        item['classification'] == 'AMBIGUOUS'
        for item in audited_mips
    )
    return filtered
