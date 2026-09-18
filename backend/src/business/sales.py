from __future__ import annotations

from collections import OrderedDict
from typing import Any, Iterable

from src.business.sectors import (
    SALES_SECTOR_ORDER,
    canonical_sector_key,
    canonical_sector_name,
    normalize_sector_key,
    unknown_sector_names,
)
from src.config.stores import STORES
from src.superus.errors import ReportValidationError


def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _round4(value: Any) -> float:
    return round(_number(value), 4)


def _pct(current: Any, previous: Any) -> float | None:
    cur = _number(current)
    prev = _number(previous)
    if prev == 0:
        return None if cur != 0 else 0.0
    return round((cur - prev) / prev * 100.0, 6)


def _ordered_union(*sequences: Iterable[Any]) -> list[Any]:
    result: list[Any] = []
    seen: set[Any] = set()
    for sequence in sequences:
        for item in sequence:
            if item in seen:
                continue
            seen.add(item)
            result.append(item)
    return result


def _store_map(parsed: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(store['store_code']).zfill(3): store for store in parsed.get('stores', [])}


def _raw_sector_map(store: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for sector in store.get('sectors', []):
        canonical = canonical_sector_key(str(sector.get('name') or sector.get('key') or ''))
        if canonical:
            result[canonical] = sector
    return result


def _all_raw_sector_names(parsed: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for store in parsed.get('stores', []):
        for sector in store.get('sectors', []):
            result.append(str(sector.get('name') or sector.get('key') or ''))
    return result


def _group_identity(group: dict[str, Any]) -> str:
    return str(group.get('key') or normalize_sector_key(group.get('name')) or 'sem_grupo')


def _subgroup_identity(item: dict[str, Any]) -> str:
    code = str(item.get('code') or '')
    key = str(item.get('key') or normalize_sector_key(item.get('name')) or 'sem_subgrupo')
    return f'{code}|{key}'


def _subgroup_pair(
    current: dict[str, Any] | None,
    previous: dict[str, Any] | None,
    order: int,
) -> dict[str, Any]:
    source = current or previous or {}
    cur_value = _round4((current or {}).get('sales_value'))
    prev_value = _round4((previous or {}).get('sales_value'))
    cur_qty = _round4((current or {}).get('quantity'))
    prev_qty = _round4((previous or {}).get('quantity'))
    cur_cost = _round4((current or {}).get('cost'))
    prev_cost = _round4((previous or {}).get('cost'))
    return {
        'order': order,
        'code': source.get('code'),
        'key': str(source.get('key') or normalize_sector_key(source.get('name')) or 'sem_subgrupo'),
        'name': str(source.get('name') or 'SEM SUBGRUPO'),
        'current_value': cur_value,
        'previous_value': prev_value,
        'difference_value': round(cur_value - prev_value, 4),
        'variation_percent': _pct(cur_value, prev_value),
        'current_quantity': cur_qty,
        'previous_quantity': prev_qty,
        'quantity_difference': round(cur_qty - prev_qty, 4),
        'quantity_variation_percent': _pct(cur_qty, prev_qty),
        'current_cost': cur_cost,
        'previous_cost': prev_cost,
    }


def _group_pair(
    current: dict[str, Any] | None,
    previous: dict[str, Any] | None,
    order: int,
) -> dict[str, Any]:
    source = current or previous or {}
    cur_subgroups = {_subgroup_identity(item): item for item in (current or {}).get('subgroups', [])}
    prev_subgroups = {_subgroup_identity(item): item for item in (previous or {}).get('subgroups', [])}
    identities = _ordered_union(cur_subgroups.keys(), prev_subgroups.keys())
    subgroups = [
        _subgroup_pair(cur_subgroups.get(identity), prev_subgroups.get(identity), index)
        for index, identity in enumerate(identities, start=1)
    ]
    cur_value = _round4((current or {}).get('sales_value'))
    prev_value = _round4((previous or {}).get('sales_value'))
    cur_qty = round(sum(item['current_quantity'] for item in subgroups), 4)
    prev_qty = round(sum(item['previous_quantity'] for item in subgroups), 4)
    cur_cost = round(sum(item['current_cost'] for item in subgroups), 4)
    prev_cost = round(sum(item['previous_cost'] for item in subgroups), 4)
    return {
        'order': order,
        'key': str(source.get('key') or normalize_sector_key(source.get('name')) or 'sem_grupo'),
        'name': str(source.get('name') or 'SEM GRUPO'),
        'current_value': cur_value,
        'previous_value': prev_value,
        'difference_value': round(cur_value - prev_value, 4),
        'variation_percent': _pct(cur_value, prev_value),
        'current_quantity': cur_qty,
        'previous_quantity': prev_qty,
        'quantity_difference': round(cur_qty - prev_qty, 4),
        'quantity_variation_percent': _pct(cur_qty, prev_qty),
        'current_cost': cur_cost,
        'previous_cost': prev_cost,
        'subgroups': subgroups,
    }


def _sector_pair(
    sector_name: str,
    current: dict[str, Any] | None,
    previous: dict[str, Any] | None,
    order: int,
) -> dict[str, Any]:
    cur_groups = {_group_identity(item): item for item in (current or {}).get('groups', [])}
    prev_groups = {_group_identity(item): item for item in (previous or {}).get('groups', [])}
    identities = _ordered_union(cur_groups.keys(), prev_groups.keys())
    groups = [
        _group_pair(cur_groups.get(identity), prev_groups.get(identity), index)
        for index, identity in enumerate(identities, start=1)
    ]
    cur_value = _round4((current or {}).get('sales_value'))
    prev_value = _round4((previous or {}).get('sales_value'))
    cur_qty = round(sum(item['current_quantity'] for item in groups), 4)
    prev_qty = round(sum(item['previous_quantity'] for item in groups), 4)
    cur_cost = round(sum(item['current_cost'] for item in groups), 4)
    prev_cost = round(sum(item['previous_cost'] for item in groups), 4)
    return {
        'order': order,
        'key': normalize_sector_key(sector_name),
        'name': sector_name,
        'current_value': cur_value,
        'previous_value': prev_value,
        'difference_value': round(cur_value - prev_value, 4),
        'variation_percent': _pct(cur_value, prev_value),
        'current_quantity': cur_qty,
        'previous_quantity': prev_qty,
        'quantity_difference': round(cur_qty - prev_qty, 4),
        'quantity_variation_percent': _pct(cur_qty, prev_qty),
        'current_cost': cur_cost,
        'previous_cost': prev_cost,
        'groups': groups,
    }


def _aggregate_network_sectors(stores: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Agrega a hierarquia das seis lojas preservando a ordem canônica e dos subsetores."""
    network: list[dict[str, Any]] = []
    for sector_index, sector_name in enumerate(SALES_SECTOR_ORDER, start=1):
        store_sectors = [
            next(item for item in store['sectors'] if item['name'] == sector_name)
            for store in stores
        ]
        group_order = _ordered_union(
            *( [group['key'] for group in sector['groups']] for sector in store_sectors )
        )
        groups: list[dict[str, Any]] = []
        for group_index, group_key in enumerate(group_order, start=1):
            candidates = [
                next((g for g in sector['groups'] if g['key'] == group_key), None)
                for sector in store_sectors
            ]
            source = next((item for item in candidates if item), {})
            subgroup_order = _ordered_union(
                *( [f"{sub.get('code') or ''}|{sub['key']}" for sub in (group or {}).get('subgroups', [])]
                   for group in candidates )
            )
            subgroups: list[dict[str, Any]] = []
            for subgroup_index, identity in enumerate(subgroup_order, start=1):
                subs = []
                for group in candidates:
                    found = next(
                        (
                            sub for sub in (group or {}).get('subgroups', [])
                            if f"{sub.get('code') or ''}|{sub['key']}" == identity
                        ),
                        None,
                    )
                    subs.append(found)
                sub_source = next((item for item in subs if item), {})
                cur = round(sum(_number((item or {}).get('current_value')) for item in subs), 4)
                prev = round(sum(_number((item or {}).get('previous_value')) for item in subs), 4)
                cur_qty = round(sum(_number((item or {}).get('current_quantity')) for item in subs), 4)
                prev_qty = round(sum(_number((item or {}).get('previous_quantity')) for item in subs), 4)
                cur_cost = round(sum(_number((item or {}).get('current_cost')) for item in subs), 4)
                prev_cost = round(sum(_number((item or {}).get('previous_cost')) for item in subs), 4)
                subgroups.append(
                    {
                        'order': subgroup_index,
                        'code': sub_source.get('code'),
                        'key': str(sub_source.get('key') or identity.split('|', 1)[-1]),
                        'name': str(sub_source.get('name') or 'SEM SUBGRUPO'),
                        'current_value': cur,
                        'previous_value': prev,
                        'difference_value': round(cur - prev, 4),
                        'variation_percent': _pct(cur, prev),
                        'current_quantity': cur_qty,
                        'previous_quantity': prev_qty,
                        'quantity_difference': round(cur_qty - prev_qty, 4),
                        'quantity_variation_percent': _pct(cur_qty, prev_qty),
                        'current_cost': cur_cost,
                        'previous_cost': prev_cost,
                    }
                )
            cur = round(sum(_number((item or {}).get('current_value')) for item in candidates), 4)
            prev = round(sum(_number((item or {}).get('previous_value')) for item in candidates), 4)
            cur_qty = round(sum(_number((item or {}).get('current_quantity')) for item in candidates), 4)
            prev_qty = round(sum(_number((item or {}).get('previous_quantity')) for item in candidates), 4)
            cur_cost = round(sum(_number((item or {}).get('current_cost')) for item in candidates), 4)
            prev_cost = round(sum(_number((item or {}).get('previous_cost')) for item in candidates), 4)
            groups.append(
                {
                    'order': group_index,
                    'key': group_key,
                    'name': str(source.get('name') or 'SEM GRUPO'),
                    'current_value': cur,
                    'previous_value': prev,
                    'difference_value': round(cur - prev, 4),
                    'variation_percent': _pct(cur, prev),
                    'current_quantity': cur_qty,
                    'previous_quantity': prev_qty,
                    'quantity_difference': round(cur_qty - prev_qty, 4),
                    'quantity_variation_percent': _pct(cur_qty, prev_qty),
                    'current_cost': cur_cost,
                    'previous_cost': prev_cost,
                    'subgroups': subgroups,
                }
            )
        cur = round(sum(item['current_value'] for item in store_sectors), 4)
        prev = round(sum(item['previous_value'] for item in store_sectors), 4)
        cur_qty = round(sum(item['current_quantity'] for item in store_sectors), 4)
        prev_qty = round(sum(item['previous_quantity'] for item in store_sectors), 4)
        cur_cost = round(sum(item['current_cost'] for item in store_sectors), 4)
        prev_cost = round(sum(item['previous_cost'] for item in store_sectors), 4)
        network.append(
            {
                'order': sector_index,
                'key': normalize_sector_key(sector_name),
                'name': sector_name,
                'current_value': cur,
                'previous_value': prev,
                'difference_value': round(cur - prev, 4),
                'variation_percent': _pct(cur, prev),
                'current_quantity': cur_qty,
                'previous_quantity': prev_qty,
                'quantity_difference': round(cur_qty - prev_qty, 4),
                'quantity_variation_percent': _pct(cur_qty, prev_qty),
                'current_cost': cur_cost,
                'previous_cost': prev_cost,
                'groups': groups,
            }
        )
    return network


def build_sales_hierarchy_pair(
    current: dict[str, Any],
    previous: dict[str, Any],
) -> dict[str, Any]:
    unknown = unknown_sector_names(
        [*_all_raw_sector_names(current), *_all_raw_sector_names(previous)]
    )
    if unknown:
        raise ReportValidationError(
            'Setor(es) de vendas fora da lista canônica de 17 setores: '
            + ', '.join(unknown)
        )

    cur_stores = _store_map(current)
    prev_stores = _store_map(previous)
    missing = sorted((set(STORES) - set(cur_stores)) | (set(STORES) - set(prev_stores)))
    if missing:
        raise ReportValidationError(f'Par de vendas sem as seis lojas: {missing}')

    stores: list[dict[str, Any]] = []
    for store_code in STORES:
        cur_store = cur_stores[store_code]
        prev_store = prev_stores[store_code]
        cur_sector_map = _raw_sector_map(cur_store)
        prev_sector_map = _raw_sector_map(prev_store)
        sectors = [
            _sector_pair(
                sector_name,
                cur_sector_map.get(normalize_sector_key(sector_name)),
                prev_sector_map.get(normalize_sector_key(sector_name)),
                index,
            )
            for index, sector_name in enumerate(SALES_SECTOR_ORDER, start=1)
        ]
        cur_total = round(sum(item['current_value'] for item in sectors), 4)
        prev_total = round(sum(item['previous_value'] for item in sectors), 4)
        expected_cur = _round4(cur_store.get('sales_value'))
        expected_prev = _round4(prev_store.get('sales_value'))
        if abs(cur_total - expected_cur) > 0.01 or abs(prev_total - expected_prev) > 0.01:
            raise ReportValidationError(
                f'Reconciliação canônica de 17 setores falhou loja {store_code}: '
                f'current={cur_total}/{expected_cur} previous={prev_total}/{expected_prev}'
            )
        cur_qty = round(sum(item['current_quantity'] for item in sectors), 4)
        prev_qty = round(sum(item['previous_quantity'] for item in sectors), 4)
        stores.append(
            {
                'store_code': store_code,
                'store_name': str(cur_store.get('store_name') or prev_store.get('store_name') or ''),
                'current_value': cur_total,
                'previous_value': prev_total,
                'difference_value': round(cur_total - prev_total, 4),
                'variation_percent': _pct(cur_total, prev_total),
                'current_quantity': cur_qty,
                'previous_quantity': prev_qty,
                'quantity_difference': round(cur_qty - prev_qty, 4),
                'quantity_variation_percent': _pct(cur_qty, prev_qty),
                'sectors': sectors,
            }
        )

    network_sectors = _aggregate_network_sectors(stores)
    current_value = round(sum(item['current_value'] for item in stores), 4)
    previous_value = round(sum(item['previous_value'] for item in stores), 4)
    current_quantity = round(sum(item['current_quantity'] for item in stores), 4)
    previous_quantity = round(sum(item['previous_quantity'] for item in stores), 4)
    subgroup_count = sum(
        len(group['subgroups'])
        for sector in network_sectors
        for group in sector['groups']
    )

    return {
        'schema_version': 3,
        'sector_order': list(SALES_SECTOR_ORDER),
        'network': {
            'current_value': current_value,
            'previous_value': previous_value,
            'difference_value': round(current_value - previous_value, 4),
            'variation_percent': _pct(current_value, previous_value),
            'current_quantity': current_quantity,
            'previous_quantity': previous_quantity,
            'quantity_difference': round(current_quantity - previous_quantity, 4),
            'quantity_variation_percent': _pct(current_quantity, previous_quantity),
            'sectors': network_sectors,
        },
        'stores': stores,
        'counts': {
            'sector_count': len(SALES_SECTOR_ORDER),
            'store_count': len(stores),
            'subgroup_count': subgroup_count,
        },
    }


def sector_metric_value(
    hierarchy: dict[str, Any],
    sector_name: str,
    side: str,
    metric: str,
) -> float:
    canonical = canonical_sector_name(sector_name)
    if not canonical:
        raise ReportValidationError(f'Setor de evento desconhecido: {sector_name}')
    sector = next(item for item in hierarchy['network']['sectors'] if item['name'] == canonical)
    field = f'{side}_quantity' if metric == 'quantity' else f'{side}_value'
    return _round4(sector.get(field))


def network_metric_value(hierarchy: dict[str, Any], side: str, metric: str) -> float:
    field = f'{side}_quantity' if metric == 'quantity' else f'{side}_value'
    return _round4(hierarchy['network'].get(field))


def apply_event_metric_to_hierarchy(
    hierarchy: dict[str, Any],
    *,
    metric: str,
    post_filter_sector: str | None,
) -> dict[str, Any]:
    """Adiciona event_* sem remover os 17 setores de auditoria/drill-down."""
    for scope in [hierarchy['network'], *hierarchy['stores']]:
        sectors = scope['sectors']
        for sector in sectors:
            selected = (
                post_filter_sector is None
                or canonical_sector_name(sector['name']) == canonical_sector_name(post_filter_sector)
            )
            if not selected:
                sector['event_current_value'] = 0.0
                sector['event_previous_value'] = 0.0
                continue
            if metric == 'quantity':
                sector['event_current_value'] = sector['current_quantity']
                sector['event_previous_value'] = sector['previous_quantity']
            else:
                sector['event_current_value'] = sector['current_value']
                sector['event_previous_value'] = sector['previous_value']
            sector['event_difference_value'] = round(
                sector['event_current_value'] - sector['event_previous_value'], 4
            )
            sector['event_variation_percent'] = _pct(
                sector['event_current_value'], sector['event_previous_value']
            )
    return hierarchy
