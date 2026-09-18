from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from src.config.settings import Settings
from src.supabase.client import SupabaseHttpError, SupabaseRestClient


CONFLICT_COLUMNS = 'snapshot_key'


def _same_number(left: Any, right: Any, tolerance: Decimal = Decimal('0.0001')) -> bool:
    try:
        return abs(Decimal(str(left)) - Decimal(str(right))) <= tolerance
    except (InvalidOperation, TypeError, ValueError):
        return left == right


class SalesSnapshotRepository:
    def __init__(self, settings: Settings) -> None:
        url, key = settings.require_supabase()
        self.table = settings.supabase_sales_table
        self.client = SupabaseRestClient(url=url, key=key, timeout=settings.supabase_timeout)

    def upsert_rows(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        saved: list[dict[str, Any]] = []
        for row in rows:
            result = self.client.upsert(self.table, [row], on_conflict=CONFLICT_COLUMNS)
            saved.extend(result)
        return saved

    def read_back(self, row: dict[str, Any]) -> dict[str, Any]:
        selected = self.client.select(
            self.table,
            select=(
                'snapshot_key,reference_date,snapshot_type,slug,metric,unit,'
                'current_start,current_end,previous_start,previous_end,current_value,'
                'previous_value,difference_value,variation_percent,sector_count,'
                'store_count,subgroup_count,current_sha256,previous_sha256,run_id,'
                'details,updated_at'
            ),
            filters={'snapshot_key': f'eq.{row["snapshot_key"]}'},
            limit=2,
        )
        if len(selected) != 1:
            raise SupabaseHttpError(
                f'Read-back esperava 1 snapshot {row["snapshot_key"]!r}, recebeu {len(selected)}.'
            )
        saved = selected[0]
        details = saved.get('details') or {}
        sector_order = details.get('sector_order') or []
        stores = details.get('stores') or []
        checks = {
            'run_id': saved.get('run_id') == row['run_id'],
            'current_sha256': saved.get('current_sha256') == row['current_sha256'],
            'previous_sha256': saved.get('previous_sha256') == row['previous_sha256'],
            'metric': saved.get('metric') == row['metric'],
            'unit': saved.get('unit') == row['unit'],
            'current_value': _same_number(saved.get('current_value'), row['current_value']),
            'previous_value': _same_number(saved.get('previous_value'), row['previous_value']),
            'sector_count': saved.get('sector_count') == 17,
            'store_count': saved.get('store_count') == 6,
            'sector_order_17': sector_order == row['details']['sector_order'],
            'stores_6': len(stores) == 6,
        }
        if not all(checks.values()):
            raise SupabaseHttpError(
                f'Read-back divergente para {row["snapshot_key"]}: {checks}'
            )
        saved['checks'] = checks
        return saved
