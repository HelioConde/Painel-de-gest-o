from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from src.config.settings import Settings
from src.supabase.client import SupabaseRestClient, SupabaseHttpError


CONFLICT_COLUMNS = 'store_code,current_start,current_end,previous_start,previous_end'


def _same_number(left: Any, right: Any, tolerance: Decimal = Decimal('0.0001')) -> bool:
    try:
        return abs(Decimal(str(left)) - Decimal(str(right))) <= tolerance
    except (InvalidOperation, TypeError, ValueError):
        return left == right


class LossSnapshotRepository:
    def __init__(self, settings: Settings) -> None:
        url, key = settings.require_supabase()
        self.table = settings.supabase_loss_table
        self.client = SupabaseRestClient(url=url, key=key, timeout=settings.supabase_timeout)

    def upsert_rows(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        saved: list[dict[str, Any]] = []
        for row in rows:
            result = self.client.upsert(
                self.table,
                [row],
                on_conflict=CONFLICT_COLUMNS,
            )
            saved.extend(result)
        return saved

    def read_back(self, row: dict[str, Any]) -> dict[str, Any]:
        selected = self.client.select(
            self.table,
            select=(
                'id,store_code,current_start,current_end,previous_start,previous_end,'
                'current_record_count,previous_record_count,current_total_value,'
                'previous_total_value,current_sales_value,previous_sales_value,'
                'current_loss_sales_percent,previous_loss_sales_percent,'
                'current_sha256,previous_sha256,current_sales_sha256,'
                'previous_sales_sha256,run_id,updated_at'
            ),
            filters={
                'store_code': f'eq.{row["store_code"]}',
                'current_start': f'eq.{row["current_start"]}',
                'current_end': f'eq.{row["current_end"]}',
                'previous_start': f'eq.{row["previous_start"]}',
                'previous_end': f'eq.{row["previous_end"]}',
            },
            limit=2,
        )
        if len(selected) != 1:
            raise SupabaseHttpError(
                f'Read-back esperava 1 linha para loja {row["store_code"]}, recebeu {len(selected)}.'
            )
        saved = selected[0]
        checks = {
            'run_id': saved.get('run_id') == row['run_id'],
            'current_sha256': saved.get('current_sha256') == row['current_sha256'],
            'previous_sha256': saved.get('previous_sha256') == row['previous_sha256'],
            'current_sales_sha256': saved.get('current_sales_sha256') == row['current_sales_sha256'],
            'previous_sales_sha256': saved.get('previous_sales_sha256') == row['previous_sales_sha256'],
            'current_record_count': saved.get('current_record_count') == row['current_record_count'],
            'previous_record_count': saved.get('previous_record_count') == row['previous_record_count'],
            'current_sales_value': _same_number(saved.get('current_sales_value'), row['current_sales_value']),
            'previous_sales_value': _same_number(saved.get('previous_sales_value'), row['previous_sales_value']),
        }
        if not all(checks.values()):
            raise SupabaseHttpError(
                f'Read-back divergente para loja {row["store_code"]}: {checks}'
            )
        saved['checks'] = checks
        return saved
