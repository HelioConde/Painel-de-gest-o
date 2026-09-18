from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from src.config.settings import Settings
from src.supabase.payload import build_sales_rows, write_sales_payload_preview
from src.supabase.repository import SalesSnapshotRepository


def sync_sales_run(run_dir: Path, settings: Settings) -> dict[str, Any]:
    run_dir = Path(run_dir)
    rows, preview = build_sales_rows(run_dir)
    preview_path = write_sales_payload_preview(run_dir)

    repository = SalesSnapshotRepository(settings)
    saved_rows = repository.upsert_rows(rows)
    read_back = [repository.read_back(row) for row in rows]

    result = {
        'status': 'PASS',
        'run_id': preview['summary']['run_id'],
        'reference_date': preview['summary']['reference_date'],
        'table': settings.supabase_sales_table,
        'snapshot_count': len(rows),
        'payload_preview': str(preview_path),
        'upsert_returned_rows': len(saved_rows),
        'read_back': read_back,
        'synced_at': datetime.now(UTC).isoformat(),
    }
    destination = run_dir / 'sales_supabase_sync.json'
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    result['sync_file'] = str(destination)
    return result
