from __future__ import annotations

import json
from pathlib import Path

from src.parsers.sales_html import parse_sales_html
from src.supabase.loss_payload import build_loss_rows
from tests.test_loss_supabase_pipeline import _html as loss_html


def sales_html(start: str, end: str) -> str:
    stores = [
        ('SUPERMERCADO PRIMOR 01 307', '100,00'),
        ('SUPERMERCADO PRIMOR 02 212', '200,00'),
        ('SUPERMERCADO PRIMOR 03 600', '300,00'),
        ('SUPERMERCADO PRIMOR 04 120', '400,00'),
        ('SUPERMERCADO PRIMOR 05 033', '500,00'),
        ('SUPERMERCADO PRIMOR 06 018', '600,00'),
    ]
    parts = [
        '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" '
        'content="text/html; charset=iso-8859-1" /></head><body>',
        f'<div ID="Periodo" style="position:absolute;top:80px;left:700px">{start}&nbsp;a&nbsp;{end}</div>',
        '<div style="position:absolute;top:40px;left:400px">Sintético por SubGrupo</div>',
        '<div style="position:absolute;top:210px;left:20px">Código</div>',
        '<div style="position:absolute;top:210px;left:100px">Nome</div>',
        '<div style="position:absolute;top:210px;left:400px">Quantidade</div>',
        '<div style="position:absolute;top:210px;left:500px">Custo</div>',
        '<div style="position:absolute;top:210px;left:600px">Venda</div>',
    ]
    top = 250
    for store_name, sale in stores:
        parts.extend(
            [
                f'<div style="position:absolute;top:{top}px;left:40px">{store_name}</div>',
                f'<div style="position:absolute;top:{top+20}px;left:40px">Setor: ACOUGUE</div>',
                f'<div style="position:absolute;top:{top+20}px;left:250px">Grupo: AVE</div>',
                f'<div style="position:absolute;top:{top+40}px;left:20px">3289</div>',
                f'<div style="position:absolute;top:{top+40}px;left:100px">FILE</div>',
                f'<div style="position:absolute;top:{top+40}px;left:400px">10,000</div>',
                f'<div style="position:absolute;top:{top+40}px;left:500px">50,0000</div>',
                f'<div style="position:absolute;top:{top+40}px;left:600px">{sale}</div>',
            ]
        )
        top += 100
    parts.append('</body></html>')
    return ''.join(parts)


def test_parse_sales_html_six_stores(tmp_path: Path):
    path = tmp_path / 'sales_current.htm'
    path.write_text(sales_html('01/09/2026', '05/09/2026'), encoding='iso-8859-1')
    parsed = parse_sales_html(path)
    assert parsed['network']['store_count'] == 6
    assert parsed['network']['sales_value'] == 2100.0
    assert parsed['stores'][0]['store_code'] == '307'
    assert parsed['stores'][0]['sales_value'] == 100.0
    assert parsed['stores'][0]['sectors'][0]['name'] == 'ACOUGUE'


def test_loss_payload_adds_sales_context(tmp_path: Path):
    run_dir = tmp_path / 'run_1'
    raw = run_dir / 'raw'
    raw.mkdir(parents=True)
    (raw / 'loss_307_current.htm').write_text(
        loss_html('SUPERMERCADO PRIMOR 01 307', '01/09/2026', '05/09/2026'),
        encoding='iso-8859-1',
    )
    (raw / 'loss_307_previous.htm').write_text(
        loss_html('SUPERMERCADO PRIMOR 01 307', '01/09/2025', '05/09/2025'),
        encoding='iso-8859-1',
    )
    (raw / 'sales_current.htm').write_text(
        sales_html('01/09/2026', '05/09/2026'), encoding='iso-8859-1'
    )
    (raw / 'sales_previous.htm').write_text(
        sales_html('01/09/2025', '05/09/2025'), encoding='iso-8859-1'
    )
    (run_dir / 'manifest.json').write_text(
        json.dumps({'run_id': 'run_1', 'status': 'PASS', 'sales_context_required': True}),
        encoding='utf-8',
    )

    rows, preview = build_loss_rows(run_dir)
    row = rows[0]
    assert row['current_sales_value'] == 100.0
    assert row['previous_sales_value'] == 100.0
    assert row['current_loss_sales_percent'] == 6.0
    assert row['current_sales_sha256']
    assert row['details']['schema_version'] == 2
    assert row['details']['current']['sectors'][0]['sales_context']['sales_value'] == 100.0
    assert preview['schema_version'] == 2
    assert preview['totals']['current_sales_value'] == 100.0


def sales_html_with_excluded_pmb(start: str, end: str) -> str:
    """QuickReport mínimo com PMB + 6 Primor + subtotais + total geral."""
    stores = [
        ('PMB COMERCIO E ATACADO', '50,00'),
        ('SUPERMERCADO PRIMOR 01 307', '100,00'),
        ('SUPERMERCADO PRIMOR 02 212', '200,00'),
        ('SUPERMERCADO PRIMOR 03 600', '300,00'),
        ('SUPERMERCADO PRIMOR 04 120', '400,00'),
        ('SUPERMERCADO PRIMOR 05 033', '500,00'),
        ('SUPERMERCADO PRIMOR 06 018', '600,00'),
    ]
    parts = [
        '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" '
        'content="text/html; charset=iso-8859-1" /></head><body>',
        f'<div ID="Periodo" style="position:absolute;top:80px;left:700px">'
        f'{start}&nbsp;a&nbsp;{end}</div>',
        '<div style="position:absolute;top:40px;left:400px">Sintético por SubGrupo</div>',
        '<div style="position:absolute;top:210px;left:20px">Código</div>',
        '<div style="position:absolute;top:210px;left:100px">Nome</div>',
        '<div style="position:absolute;top:210px;left:400px">Quantidade</div>',
        '<div style="position:absolute;top:210px;left:500px">Custo</div>',
        '<div style="position:absolute;top:210px;left:600px">Venda</div>',
    ]
    top = 250
    for store_name, sale in stores:
        parts.extend(
            [
                f'<div style="position:absolute;top:{top}px;left:40px">{store_name}</div>',
                f'<div style="position:absolute;top:{top+20}px;left:40px">Setor: ACOUGUE</div>',
                f'<div style="position:absolute;top:{top+20}px;left:250px">Grupo: AVE</div>',
                f'<div style="position:absolute;top:{top+40}px;left:20px">3289</div>',
                f'<div style="position:absolute;top:{top+40}px;left:100px">FILE</div>',
                f'<div style="position:absolute;top:{top+40}px;left:400px">10,000</div>',
                f'<div style="position:absolute;top:{top+40}px;left:500px">50,0000</div>',
                f'<div style="position:absolute;top:{top+40}px;left:600px">{sale}</div>',
                # Group Footer da loja.
                f'<div style="position:absolute;top:{top+70}px;left:600px">{sale}</div>',
            ]
        )
        top += 100
    # Total geral inclui a PMB: 50 + 100 + 200 + ... + 600 = 2.150.
    parts.append(f'<div style="position:absolute;top:{top}px;left:600px">2.150,00</div>')
    parts.append('</body></html>')
    return ''.join(parts)


def test_sales_network_reconciliation_excludes_pmb_from_primor_total(tmp_path: Path):
    path = tmp_path / 'sales_current.htm'
    path.write_text(
        sales_html_with_excluded_pmb('01/09/2026', '04/09/2026'),
        encoding='iso-8859-1',
    )
    parsed = parse_sales_html(path)
    assert parsed['network']['sales_value'] == 2100.0
    assert parsed['network']['reported_primor_sales_value'] == 2100.0
    assert parsed['network']['raw_reported_sales_value'] == 2150.0
    assert parsed['network']['excluded_sales_from_grand_total'] == 50.0
    assert parsed['network']['reconciliation_delta'] == 0.0
    assert parsed['network']['raw_total_accounting_delta'] == 0.0
    assert parsed['network']['excluded_stores'][0]['name'] == 'PMB COMERCIO E ATACADO'
    assert parsed['quality']['checks']['network_total_reconciled'] is True
    assert parsed['quality']['checks']['raw_total_accounting_reconciled'] is True
