from __future__ import annotations

from datetime import date
from pathlib import Path

from src.business.periods import ReportPeriod
from src.business.planner import ReportJob, ReportKind
from src.business.sales import build_sales_hierarchy_pair
from src.business.sectors import SALES_SECTOR_ORDER
from src.business.snapshots import build_sales_snapshot
from src.config.stores import STORES


def _sector(name: str, sale: float, quantity: float, *, extra_previous: bool = False):
    groups = [
        {
            'key': 'grupo_a',
            'name': 'GRUPO A',
            'sales_value': sale,
            'subgroups': [
                {
                    'code': '10',
                    'key': 'sub_a',
                    'name': 'SUB A',
                    'quantity': quantity,
                    'cost': sale / 2,
                    'sales_value': sale,
                }
            ],
        }
    ]
    if extra_previous:
        groups.append(
            {
                'key': 'grupo_b',
                'name': 'GRUPO B',
                'sales_value': 3.0,
                'subgroups': [
                    {
                        'code': '20',
                        'key': 'sub_b',
                        'name': 'SUB B',
                        'quantity': 2.0,
                        'cost': 1.0,
                        'sales_value': 3.0,
                    }
                ],
            }
        )
    return {
        'key': name.lower().replace(' ', '_'),
        'name': name,
        'sales_value': sale + (3.0 if extra_previous else 0.0),
        'record_count': 1 + int(extra_previous),
        'groups': groups,
    }


def _parsed(*, acougue: float, pizza: float, pizza_qty: float, previous_extra=False):
    stores = []
    for code, store in STORES.items():
        sectors = [
            _sector('ACOUGUE', acougue, 1.0),
            _sector('PIZZARIA', pizza, pizza_qty, extra_previous=previous_extra),
        ]
        total = round(sum(item['sales_value'] for item in sectors), 4)
        stores.append(
            {
                'store_code': code,
                'store_name': store.name,
                'sales_value': total,
                'reported_sales_value': total,
                'reconciliation_delta': 0.0,
                'record_count': 2,
                'sector_count': 2,
                'sectors': sectors,
            }
        )
    network = round(sum(item['sales_value'] for item in stores), 4)
    return {
        'report': {'title': 'Sintético por SubGrupo'},
        'source': {
            'file_name': 'x.htm',
            'size': 123,
            'sha256': ('a' if acougue == 100 else 'b') * 64,
            'encoding': 'iso-8859-1',
            'format': 'htm',
        },
        'stores': stores,
        'network': {'sales_value': network, 'store_count': 6},
        'quality': {'status': 'PASS', 'checks': {'six_stores': True}},
    }


def test_fixed_17_sector_order_and_missing_sector_zero():
    hierarchy = build_sales_hierarchy_pair(
        _parsed(acougue=100, pizza=50, pizza_qty=5),
        _parsed(acougue=90, pizza=40, pizza_qty=4),
    )
    assert hierarchy['sector_order'] == list(SALES_SECTOR_ORDER)
    assert hierarchy['counts']['sector_count'] == 17
    assert hierarchy['counts']['store_count'] == 6
    for store in hierarchy['stores']:
        assert [sector['name'] for sector in store['sectors']] == list(SALES_SECTOR_ORDER)
        peixaria = next(sector for sector in store['sectors'] if sector['name'] == 'PEIXARIA')
        assert peixaria['current_value'] == 0.0
        assert peixaria['previous_value'] == 0.0


def test_subsetor_order_current_first_then_previous_only():
    current = _parsed(acougue=100, pizza=50, pizza_qty=5, previous_extra=False)
    previous = _parsed(acougue=90, pizza=40, pizza_qty=4, previous_extra=True)
    hierarchy = build_sales_hierarchy_pair(current, previous)
    pizza = next(s for s in hierarchy['stores'][0]['sectors'] if s['name'] == 'PIZZARIA')
    assert [g['name'] for g in pizza['groups']] == ['GRUPO A', 'GRUPO B']
    assert [g['order'] for g in pizza['groups']] == [1, 2]
    assert pizza['groups'][1]['current_value'] == 0.0
    assert pizza['groups'][1]['previous_value'] == 3.0


def test_daily_snapshot_uses_monetary_network_total():
    current = _parsed(acougue=100, pizza=50, pizza_qty=5)
    previous = _parsed(acougue=90, pizza=40, pizza_qty=4)
    job = ReportJob(
        ReportKind.DAILY,
        'daily',
        ReportPeriod(date(2026, 9, 3), date(2026, 9, 3)),
        ReportPeriod(date(2025, 9, 4), date(2025, 9, 4)),
        'monetary',
    )
    row = build_sales_snapshot(
        run_id='run', reference_date='2026-09-04', job=job,
        current=current, previous=previous,
    )
    assert row['metric'] == 'monetary'
    assert row['current_value'] == 900.0  # (100 + 50) * 6
    assert row['previous_value'] == 780.0
    assert row['sector_count'] == 17
    assert row['store_count'] == 6


def test_segunda_pizza_snapshot_uses_pizzaria_quantity_not_money():
    current = _parsed(acougue=100, pizza=9999, pizza_qty=7)
    previous = _parsed(acougue=90, pizza=8888, pizza_qty=5)
    job = ReportJob(
        ReportKind.EVENT,
        'segunda_pizza',
        ReportPeriod(date(2026, 9, 7), date(2026, 9, 7)),
        ReportPeriod(date(2025, 9, 8), date(2025, 9, 8)),
        'quantity',
        'QTD',
        {'mode': 'SINGLE_DAY', 'name': 'Segunda da Pizza'},
    )
    row = build_sales_snapshot(
        run_id='run', reference_date='2026-09-08', job=job,
        current=current, previous=previous,
    )
    assert row['metric'] == 'quantity'
    assert row['unit'] == 'QTD'
    assert row['current_value'] == 42.0  # 7 pizzas * 6 lojas
    assert row['previous_value'] == 30.0
    assert row['details']['event_filter_sector'] == 'PIZZARIA'
    assert row['details']['sector_order'] == list(SALES_SECTOR_ORDER)


def test_terca_carne_snapshot_uses_acougue_money_only():
    current = _parsed(acougue=100, pizza=9999, pizza_qty=7)
    previous = _parsed(acougue=90, pizza=8888, pizza_qty=5)
    job = ReportJob(
        ReportKind.EVENT,
        'terca_carne',
        ReportPeriod(date(2026, 9, 15), date(2026, 9, 15)),
        ReportPeriod(date(2025, 9, 16), date(2025, 9, 16)),
        'monetary',
        metadata={'mode': 'SINGLE_DAY', 'name': 'Terça da Carne'},
    )
    row = build_sales_snapshot(
        run_id='run', reference_date='2026-09-16', job=job,
        current=current, previous=previous,
    )
    assert row['metric'] == 'monetary'
    assert row['current_value'] == 600.0  # 100 em açougue x 6 lojas
    assert row['previous_value'] == 540.0
    assert row['details']['event_filter_sector'] == 'ACOUGUE'


def test_monthly_close_snapshot_contract():
    current = _parsed(acougue=100, pizza=50, pizza_qty=5)
    previous = _parsed(acougue=90, pizza=40, pizza_qty=4)
    job = ReportJob(
        ReportKind.MONTHLY_CLOSE,
        'monthly_close',
        ReportPeriod(date(2026, 8, 1), date(2026, 8, 31)),
        ReportPeriod(date(2025, 8, 1), date(2025, 8, 31)),
        'monetary',
        metadata={'mode': 'PREVIOUS_MONTH_CLOSE'},
    )
    row = build_sales_snapshot(
        run_id='run', reference_date='2026-09-01', job=job,
        current=current, previous=previous,
    )
    assert row['snapshot_type'] == 'MONTHLY_CLOSE'
    assert row['name'] == 'Fechamento Mensal'
    assert row['current_start'] == '2026-08-01'
    assert row['current_end'] == '2026-08-31'


def test_vendas_bat_syncs_automatically():
    text = (Path(__file__).resolve().parents[1] / 'rodar_vendas.bat').read_text(encoding='utf-8')
    assert 'main.py --daily-auto --sync' in text


def test_sales_sql_and_env_contract():
    root = Path(__file__).resolve().parents[1]
    sql = (root / 'sql' / 'superus_period_snapshots_v8_3.sql').read_text(encoding='utf-8')
    env = (root / '.env.example').read_text(encoding='utf-8')
    assert 'superus_period_snapshots' in sql
    assert 'snapshot_key' in sql
    assert 'details jsonb' in sql
    assert 'alter column run_id type text using run_id::text' in sql
    assert 'alter column event_slug drop not null' in sql
    assert 'alter column event_name drop not null' in sql
    assert 'alter column mode drop not null' in sql
    assert 'alter column unit drop not null' in sql
    assert 'alter column variation_percent drop not null' in sql
    assert 'SUPABASE_SALES_TABLE=superus_period_snapshots' in env
