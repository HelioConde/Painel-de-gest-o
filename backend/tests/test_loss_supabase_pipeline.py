from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.parsers.loss_html import parse_loss_html
from src.supabase.loss_payload import build_loss_rows, discover_loss_pairs
from src.superus.errors import ReportValidationError


def _html(store_name: str, start: str, end: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" /></head><body>
<div ID="QRSysData4" style="position:absolute;top:40px;left:400px">Pedidos&nbsp;por&nbsp;MIP</div>
<div ID="Datai" style="position:absolute;top:89px;left:800px">{start}</div>
<div ID="Dataf" style="position:absolute;top:89px;left:900px">{end}</div>
<div ID="qrlOrigem" style="position:absolute;top:120px;left:100px">Origem: {store_name}</div>
<div ID="qrlDestino" style="position:absolute;top:140px;left:100px">Destino: {store_name}</div>
<div ID="QRSysData6" style="position:absolute;top:66px;left:800px">Emissão: 05/09/2026 01:00:00</div>

<div ID="Nivel1" style="position:absolute;top:251px;left:43px">Setor: ACOUGUE</div>
<div ID="QRLabel17" style="position:absolute;top:314px;left:79px">MIP: PERDA ACOUGUE</div>

<div ID="QRDBText8" style="position:absolute;top:332px;left:116px">1</div>
<div ID="QRDBText9" style="position:absolute;top:332px;left:162px">ACEM BOVINO KG</div>
<div ID="QRDBTextTamanho" style="position:absolute;top:332px;left:354px"></div>
<div ID="QRLabel20" style="position:absolute;top:332px;left:401px">10,00</div>
<div ID="QRLabel21" style="position:absolute;top:333px;left:499px">20,00</div>
<div ID="QRLabel22" style="position:absolute;top:332px;left:573px">0,00</div>
<div ID="QRLabel23" style="position:absolute;top:332px;left:695px">0,00</div>
<div ID="QRDBText13" style="position:absolute;top:332px;left:813px">2,00</div>
<div ID="qrdbtCustoTotal" style="position:absolute;top:332px;left:797px">5,0000</div>
<div ID="qrdbtPrecoTotal" style="position:absolute;top:332px;left:868px">7,0000</div>
<div ID="lblQuantPorVendas" style="position:absolute;top:332px;left:922px">10,00</div>
<div ID="QRDBText5" style="position:absolute;top:332px;left:978px">6,0000</div>

<div ID="QRExpr4" style="position:absolute;top:400px;left:659px">2,000</div>
<div ID="QRExpr12" style="position:absolute;top:400px;left:792px">5,0000</div>
<div ID="QRExpr9" style="position:absolute;top:400px;left:861px">7,0000</div>
<div ID="QRExpr8" style="position:absolute;top:400px;left:972px">6,0000</div>

<div ID="QRExpr1" style="position:absolute;top:450px;left:177px">1</div>
<div ID="QRExpr2" style="position:absolute;top:450px;left:658px">2,000</div>
<div ID="QRExpr11" style="position:absolute;top:450px;left:787px">5,0000</div>
<div ID="QRExpr10" style="position:absolute;top:450px;left:865px">7,0000</div>
<div ID="QRExpr3" style="position:absolute;top:450px;left:968px">6,0000</div>
</body></html>"""


def test_parse_loss_html_real_shape(tmp_path: Path):
    path = tmp_path / 'loss_307_current.htm'
    path.write_text(_html('SUPERMERCADO PRIMOR 01 307', '01/09/2026', '05/09/2026'), encoding='iso-8859-1')

    parsed = parse_loss_html(path)

    assert parsed['report']['store_code'] == '307'
    assert parsed['grand_totals']['record_count'] == 1
    assert parsed['sectors'][0]['name'] == 'ACOUGUE'
    product = parsed['sectors'][0]['mips'][0]['products'][0]
    assert product['product_code'] == '1'
    assert product['quantity_sold'] == 20.0
    assert product['loss_quantity'] == 2.0
    assert product['unit'] == 'KG'


def test_build_loss_rows_pairs_current_previous(tmp_path: Path):
    run_dir = tmp_path / 'run_1'
    raw = run_dir / 'raw'
    raw.mkdir(parents=True)
    (raw / 'loss_307_current.htm').write_text(
        _html('SUPERMERCADO PRIMOR 01 307', '01/09/2026', '05/09/2026'),
        encoding='iso-8859-1',
    )
    (raw / 'loss_307_previous.htm').write_text(
        _html('SUPERMERCADO PRIMOR 01 307', '01/09/2025', '05/09/2025'),
        encoding='iso-8859-1',
    )
    (run_dir / 'manifest.json').write_text(
        json.dumps({'run_id': 'run_1', 'status': 'PASS'}),
        encoding='utf-8',
    )

    with pytest.raises(ReportValidationError, match='Contexto de vendas obrigatório'):
        build_loss_rows(run_dir)


def test_discover_loss_pairs_rejects_incomplete_pair(tmp_path: Path):
    (tmp_path / 'loss_307_current.htm').write_text('x', encoding='utf-8')
    with pytest.raises(ReportValidationError):
        discover_loss_pairs(tmp_path)
