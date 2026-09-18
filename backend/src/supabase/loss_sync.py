from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from src.config.settings import Settings
from src.supabase.loss_payload import build_loss_rows, write_loss_payload_preview
from src.supabase.loss_repository import LossSnapshotRepository


def sync_loss_run(run_dir: Path, settings: Settings) -> dict[str, Any]:
    run_dir = Path(run_dir)
    rows, preview = build_loss_rows(run_dir)
    preview_path = write_loss_payload_preview(run_dir)

    repository = LossSnapshotRepository(settings)
    saved_rows = repository.upsert_rows(rows)
    read_back = [repository.read_back(row) for row in rows]

    result = {
        'status': 'PASS',
        'run_id': preview['run_id'],
        'table': settings.supabase_loss_table,
        'store_count': len(rows),
        'payload_preview': str(preview_path),
        'upsert_returned_rows': len(saved_rows),
        'read_back': read_back,
        'synced_at': datetime.now(UTC).isoformat(),
    }
    destination = run_dir / 'supabase_sync.json'
    destination.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    result['sync_file'] = str(destination)
    return result
