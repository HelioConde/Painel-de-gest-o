from datetime import date

from src.parsers.tabloid_html import group_tabloid_records, parse_brazilian_number, parse_tabloid_html


def _report(rows: str) -> str:
    return f'''<html><body><div id="Periodo">24/09/2026 a 01/10/2026</div><div id="lblTipo">Vendas Promoção</div><div id="Nivel1">Loja: SUPERMERCADO PRIMOR 01 307</div>{rows}<div id="Nivel1">Loja: SUPERMERCADO PRIMOR 02 212</div><div id="QRDBText1" style="top:400px">130095</div><div id="QRDBText2" style="top:400px">BISC NEGRESCO 90G RECHEADO TRADICIONAL</div><div id="QRDBText7" style="top:400px">315,000</div><div id="QRDBText3" style="top:401px">630,00</div></body></html>'''


def test_parse_and_group_real_report_shape(tmp_path):
    path = tmp_path / 'tabloide.htm'
    path.write_text(_report('''<div id="QRDBText1" style="top:300px">131677</div><div id="QRDBText2" style="top:300px">BISC NEGRESCO 90G LIMAO SICILIANO</div><div id="QRDBText7" style="top:300px">43,000</div><div id="QRDBText3" style="top:301px">86,00</div><div id="QRDBText1" style="top:320px">130097</div><div id="QRDBText2" style="top:320px">BISC NEGRESCO 90G RECH CHOCOLATE</div><div id="QRDBText7" style="top:320px">121,000</div><div id="QRDBText3" style="top:321px">242,00</div>'''), encoding='iso-8859-1')
    parsed = parse_tabloid_html(path, expected_start=date(2026, 9, 24), expected_end=date(2026, 10, 1))
    grouped = group_tabloid_records(parsed['records'])
    assert parsed['stores'] == ['212', '307']
    assert parsed['summary']['product_count'] == 3
    assert grouped[0]['family_name'] == 'BISC NEGRESCO 90G'
    assert grouped[0]['quantity'] == 479
    assert grouped[0]['sales_value'] == 958


def test_multiple_package_sizes_are_grouped_conservatively(tmp_path):
    path = tmp_path / 'tabloide.htm'
    path.write_text(_report('''<div id="QRDBText1" style="top:300px">1</div><div id="QRDBText2" style="top:300px">ALIM FRISKIES 80G MAR SABORES SACHE</div><div id="QRDBText7" style="top:300px">1.486,000</div><div id="QRDBText3" style="top:301px">2.214,14</div><div id="QRDBText1" style="top:320px">2</div><div id="QRDBText2" style="top:320px">ALIM FRISKIES 85G PURINA SACHE ATUM</div><div id="QRDBText7" style="top:320px">43,000</div><div id="QRDBText3" style="top:321px">298,09</div>'''), encoding='iso-8859-1')
    grouped = group_tabloid_records(parse_tabloid_html(path)['records'])
    assert grouped[0]['family_name'] == 'ALIM FRISKIES 80G/85G'
    assert grouped[0]['quantity'] == 1529
    assert grouped[0]['sales_value'] == 2512.23


def test_brazilian_numbers():
    assert parse_brazilian_number('1.486,000') == 1486
    assert parse_brazilian_number('2.214,14') == 2214.14


def test_parse_textual_htm_export_from_superus(tmp_path):
    path = tmp_path / 'tabloide.htm'
    path.write_text(
        'Periodo:24/09/2026 a  01/10/2026\n'
        'Tipo RelatVendas Promoção Tipo Prom.TABLOIDE\n'
        '   Loja: SUPERMERCADO PRIMOR 01 307\n'
        '    414350 ABS INTIMUS GEL LV16PG14 C/ ABAS SECA               5,18      6,44    21,000  108,8270   135,29\n'
        '    110448 ALIM FRISKIES 85G PURINA SACHE CARNE MOLHO                            12,000   26,7000\n'
        '                                                               2,22      2,89                        34,68\n',
        encoding='cp1252',
    )
    parsed = parse_tabloid_html(path, expected_start=date(2026, 9, 24), expected_end=date(2026, 10, 1))
    assert parsed['summary']['product_count'] == 2
    assert parsed['summary']['quantity'] == 33
    assert parsed['summary']['sales_value'] == 169.97
