from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from src.config.settings import Settings
from src.parsers.tabloid_html import parse_tabloid_html
from src.supabase.client import SupabaseRestClient


def get_active_tabloid_campaign(
    settings: Settings | None = None,
    reference_date: date | None = None,
) -> dict[str, Any]:
    """Retorna somente a campanha cujo período contém a data consultada.

    Campanhas futuras permanecem na fila e não substituem a campanha vigente.
    No primeiro dia do período novo, o worker passa a escolhê-la
    automaticamente, mesmo que o campo legado active ainda esteja falso.
    """
    settings = settings or Settings.from_environment()
    target = reference_date or date.today()
    url, key = settings.require_supabase()
    client = SupabaseRestClient(url, key, timeout=settings.supabase_timeout)
    campaigns = client.select(
        'tabloid_campaigns',
        select='id,name,start_date,end_date,promotion_type,promotion_name,active,updated_at',
        filters={
            'start_date': f'lte.{target.isoformat()}',
            'end_date': f'gte.{target.isoformat()}',
        },
        limit=100,
    )
    if not campaigns:
        raise RuntimeError(
            f'Não existe campanha de tabloide em andamento em {target.isoformat()}.'
        )

    # Em caso de cadastro legado sobreposto, vence a campanha com início mais
    # recente; updated_at desempata edições do mesmo período.
    campaigns.sort(
        key=lambda item: (
            str(item.get('start_date') or ''),
            str(item.get('updated_at') or ''),
        ),
        reverse=True,
    )
    return dict(campaigns[0])


def import_tabloid(path: Path, *, reference_date: date, campaign_id: str | None = None, dry_run: bool = False) -> dict[str, Any]:
    parsed = parse_tabloid_html(path)
    result = {'campaign_id': campaign_id, **parsed['summary'], 'period_start': parsed['period_start'], 'period_end': parsed['period_end'], 'dry_run': dry_run}
    if dry_run:
        return result
    settings = Settings.from_environment()
    url, key = settings.require_supabase()
    client = SupabaseRestClient(url, key, timeout=settings.supabase_timeout)
    if not campaign_id:
        campaign_id = str(get_active_tabloid_campaign(settings)['id'])
    snapshots = client.upsert('tabloid_snapshots', [{
        'campaign_id': campaign_id, 'reference_date': reference_date.isoformat(),
        'period_start': parsed['period_start'], 'period_end': parsed['period_end'],
        'source_file_hash': parsed['source_file_hash'], 'metadata': parsed['summary'],
    }], on_conflict='campaign_id,reference_date')
    snapshot_id = snapshots[0]['id']
    rows = [{**record, 'snapshot_id': snapshot_id} for record in parsed['records']]
    for offset in range(0, len(rows), 500):
        client.upsert('tabloid_product_sales', rows[offset:offset + 500], on_conflict='snapshot_id,store_code,product_code,product_name')
    return {**result, 'campaign_id': campaign_id, 'snapshot_id': snapshot_id, 'imported_rows': len(rows)}
