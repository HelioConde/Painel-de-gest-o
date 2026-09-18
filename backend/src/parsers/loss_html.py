from __future__ import annotations

import hashlib
import re
from bisect import bisect_right
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from src.config.stores import get_store
from src.superus.errors import ReportValidationError


def _normalize_text(value: str | None) -> str:
    text = unescape(value or '').replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def _comparable(value: str | None) -> str:
    import unicodedata

    text = unicodedata.normalize('NFD', _normalize_text(value))
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    return re.sub(r'\s+', ' ', text.casefold()).strip()


def _decimal_br(value: str | None) -> Decimal | None:
    text = _normalize_text(value)
    if not text:
        return None
    text = text.replace('%', '').strip()
    text = re.sub(r'[^0-9,.\-]', '', text)
    if not text or text in {'-', '.', ','}:
        return None
    if ',' in text:
        text = text.replace('.', '').replace(',', '.')
    try:
        return Decimal(text)
    except InvalidOperation as error:
        raise ReportValidationError(f'Número inválido no HTM de perdas: {value!r}') from error


def _json_number(value: Decimal | None) -> float | None:
    return None if value is None else float(value)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class _DivElement:
    element_id: str | None
    top: int | None
    left: int | None
    text: str


class _QuickReportDivParser(HTMLParser):
    """Coleta os DIVs posicionados do HTML do QuickReport sem dependências externas."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._stack: list[dict[str, Any]] = []
        self.elements: list[_DivElement] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.casefold() == 'div':
            data = {str(key).casefold(): value or '' for key, value in attrs}
            style = data.get('style', '')
            top_match = re.search(r'(?:^|;)\s*top\s*:\s*(-?\d+)px', style, re.IGNORECASE)
            left_match = re.search(r'(?:^|;)\s*left\s*:\s*(-?\d+)px', style, re.IGNORECASE)
            self._stack.append(
                {
                    'id': data.get('id') or None,
                    'top': int(top_match.group(1)) if top_match else None,
                    'left': int(left_match.group(1)) if left_match else None,
                    'parts': [],
                }
            )
        elif self._stack:
            self._stack[-1]['parts'].append(' ')

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() == 'div' and self._stack:
            item = self._stack.pop()
            self.elements.append(
                _DivElement(
                    element_id=item['id'],
                    top=item['top'],
                    left=item['left'],
                    text=_normalize_text(''.join(item['parts'])),
                )
            )

    def handle_data(self, data: str) -> None:
        if self._stack:
            self._stack[-1]['parts'].append(data)


def _read_elements(path: Path) -> tuple[list[_DivElement], str]:
    raw = path.read_bytes()
    declared = re.search(br'charset\s*=\s*["\']?([\w.-]+)', raw[:4096], re.IGNORECASE)
    encodings: list[str] = []
    if declared:
        encodings.append(declared.group(1).decode('ascii', errors='ignore'))
    encodings.extend(('iso-8859-1', 'windows-1252', 'utf-8', 'latin-1'))

    content = None
    selected = None
    for encoding in dict.fromkeys(encodings):
        try:
            content = raw.decode(encoding)
            selected = encoding
            break
        except (LookupError, UnicodeDecodeError):
            continue
    if content is None or selected is None:
        raise ReportValidationError(f'Não foi possível decodificar {path}.')

    parser = _QuickReportDivParser()
    parser.feed(content)
    elements = sorted(
        parser.elements,
        key=lambda item: (
            item.top if item.top is not None else 10**12,
            item.left if item.left is not None else 0,
        ),
    )
    return elements, selected


def _strip_prefix(value: str) -> str:
    value = _normalize_text(value)
    return _normalize_text(value.split(':', 1)[1] if ':' in value else value)


def _infer_unit(product_name: str, size: str | None) -> str | None:
    source = f'{size or ""} {product_name}'.upper()
    patterns = (
        (r'(?:^|\s)KG(?:\s|$)', 'KG'),
        (r'(?:^|\s)UN(?:D|IDADE)?(?:\s|$)', 'UN'),
        (r'(?:^|\s)LT?S?(?:\s|$)', 'L'),
    )
    for pattern, unit in patterns:
        if re.search(pattern, source):
            return unit
    return None


def parse_loss_html(
    path: Path,
    *,
    expected_store: str | None = None,
    expected_start: date | None = None,
    expected_end: date | None = None,
) -> dict[str, Any]:
    """Converte um ``Pedidos por MIP`` HTM em JSON canônico.

    O parser usa IDs reais do QuickReport observados nos arquivos de produção.
    Ele não depende de ordem textual aproximada nem de OCR.
    """
    path = Path(path)
    elements, encoding = _read_elements(path)

    by_id: dict[str, list[_DivElement]] = defaultdict(list)
    by_top: dict[int, list[_DivElement]] = defaultdict(list)
    for element in elements:
        if element.element_id:
            by_id[element.element_id].append(element)
        if element.top is not None:
            by_top[element.top].append(element)

    def texts(element_id: str) -> list[str]:
        values: list[str] = []
        for element in by_id.get(element_id, []):
            if element.text and element.text not in values:
                values.append(element.text)
        return values

    def first_text(element_id: str) -> str:
        values = texts(element_id)
        return values[0] if values else ''

    def row_text(anchor_top: int, element_id: str) -> str:
        candidates: list[_DivElement] = []
        for top in (anchor_top - 1, anchor_top, anchor_top + 1):
            for element in by_top.get(top, []):
                if element.element_id == element_id:
                    candidates.append(element)
        candidates.sort(key=lambda item: (abs((item.top or anchor_top) - anchor_top), item.left or 0))
        return candidates[0].text if candidates else ''

    report_titles = texts('QRSysData4')
    period_starts = texts('Datai')
    period_ends = texts('Dataf')
    origins = texts('qrlOrigem')
    destinations = texts('qrlDestino')

    if report_titles != ['Pedidos por MIP']:
        raise ReportValidationError(f'Título inesperado em {path.name}: {report_titles!r}')
    if len(period_starts) != 1 or len(period_ends) != 1:
        raise ReportValidationError(
            f'Período inconsistente em {path.name}: inicio={period_starts!r} fim={period_ends!r}'
        )
    try:
        report_start = datetime.strptime(period_starts[0], '%d/%m/%Y').date()
        report_end = datetime.strptime(period_ends[0], '%d/%m/%Y').date()
    except ValueError as error:
        raise ReportValidationError(f'Período inválido em {path.name}.') from error

    origin_names = [_strip_prefix(value) for value in origins]
    destination_names = [_strip_prefix(value) for value in destinations]
    if len(set(map(_comparable, origin_names))) != 1:
        raise ReportValidationError(f'Origem varia entre páginas em {path.name}: {origin_names!r}')
    if len(set(map(_comparable, destination_names))) != 1:
        raise ReportValidationError(f'Destino varia entre páginas em {path.name}: {destination_names!r}')

    origin_name = origin_names[0] if origin_names else ''
    destination_name = destination_names[0] if destination_names else ''

    filename_match = re.fullmatch(r'loss_(\d{3})_(current|previous)\.htm', path.name, re.IGNORECASE)
    filename_store = filename_match.group(1) if filename_match else None
    side = filename_match.group(2).casefold() if filename_match else None
    store_code = expected_store.zfill(3) if expected_store else filename_store
    if not store_code:
        raise ReportValidationError(f'Não foi possível determinar a loja pelo arquivo {path.name}.')

    store = get_store(store_code)
    expected_store_name = _comparable(store.name)
    if expected_store_name not in _comparable(origin_name):
        raise ReportValidationError(
            f'Origem não corresponde à loja {store_code}: {origin_name!r}'
        )
    if expected_store_name not in _comparable(destination_name):
        raise ReportValidationError(
            f'Destino não corresponde à loja {store_code}: {destination_name!r}'
        )
    if expected_start and report_start != expected_start:
        raise ReportValidationError(
            f'Data inicial divergente em {path.name}: esperado={expected_start} obtido={report_start}'
        )
    if expected_end and report_end != expected_end:
        raise ReportValidationError(
            f'Data final divergente em {path.name}: esperado={expected_end} obtido={report_end}'
        )

    sector_events = sorted(
        (
            element.top,
            _strip_prefix(element.text),
        )
        for element in by_id.get('Nivel1', [])
        if element.top is not None and element.text
    )
    mip_events = sorted(
        (
            element.top,
            _strip_prefix(element.text),
        )
        for element in by_id.get('QRLabel17', [])
        if element.top is not None and element.text
    )
    if not sector_events:
        raise ReportValidationError(f'Nenhum setor encontrado em {path.name}.')

    sector_tops = [top for top, _ in sector_events]
    mip_tops = [top for top, _ in mip_events]

    products: list[dict[str, Any]] = []
    for code_element in by_id.get('QRDBText8', []):
        if code_element.top is None or not code_element.text:
            continue
        top = code_element.top
        sector_index = bisect_right(sector_tops, top) - 1
        mip_index = bisect_right(mip_tops, top) - 1
        if sector_index < 0:
            raise ReportValidationError(
                f'Produto {code_element.text!r} apareceu antes do primeiro setor em {path.name}.'
            )
        sector_name = sector_events[sector_index][1]
        mip_name = None
        if mip_index >= 0 and mip_events[mip_index][0] >= sector_events[sector_index][0]:
            mip_name = mip_events[mip_index][1]

        product_name = row_text(top, 'QRDBText9')
        size = row_text(top, 'QRDBTextTamanho') or None
        if not product_name:
            raise ReportValidationError(
                f'Produto sem descrição em {path.name}: codigo={code_element.text!r}.'
            )

        products.append(
            {
                'sector': sector_name,
                'mip': mip_name,
                'product_code': _normalize_text(code_element.text),
                'product_name': product_name,
                'size': size,
                'unit': _infer_unit(product_name, size),
                'quantity_purchased': _json_number(_decimal_br(row_text(top, 'QRLabel20'))),
                'quantity_sold': _json_number(_decimal_br(row_text(top, 'QRLabel21'))),
                'loss_purchase_percent': _json_number(_decimal_br(row_text(top, 'QRLabel22'))),
                'loss_sale_percent': _json_number(_decimal_br(row_text(top, 'QRLabel23'))),
                'loss_quantity': _json_number(_decimal_br(row_text(top, 'QRDBText13'))),
                'gross_cost_total': _json_number(_decimal_br(row_text(top, 'qrdbtCustoTotal'))),
                'sale_price_total': _json_number(_decimal_br(row_text(top, 'qrdbtPrecoTotal'))),
                'loss_quantity_sales_percent': _json_number(
                    _decimal_br(row_text(top, 'lblQuantPorVendas'))
                ),
                'total_value': _json_number(_decimal_br(row_text(top, 'QRDBText5'))),
            }
        )

    def last_number(element_id: str) -> Decimal | None:
        values = texts(element_id)
        return _decimal_br(values[-1]) if values else None

    record_count_decimal = last_number('QRExpr1')
    record_count = int(record_count_decimal) if record_count_decimal is not None else None
    if record_count != len(products):
        raise ReportValidationError(
            f'Quantidade de registros divergente em {path.name}: '
            f'reportado={record_count} parseado={len(products)}'
        )

    # Totais por setor: QRExpr4/12/9/8 aparecem na faixa final de cada setor.
    sector_reported_totals: dict[str, dict[str, float | None]] = {}
    for total_element in by_id.get('QRExpr4', []):
        if total_element.top is None:
            continue
        top = total_element.top
        sector_index = bisect_right(sector_tops, top) - 1
        if sector_index < 0:
            continue
        if sector_index + 1 < len(sector_tops) and top >= sector_tops[sector_index + 1]:
            continue
        sector_name = sector_events[sector_index][1]
        sector_reported_totals[sector_name] = {
            'loss_quantity': _json_number(_decimal_br(row_text(top, 'QRExpr4'))),
            'gross_cost_total': _json_number(_decimal_br(row_text(top, 'QRExpr12'))),
            'sale_price_total': _json_number(_decimal_br(row_text(top, 'QRExpr9'))),
            'total_value': _json_number(_decimal_br(row_text(top, 'QRExpr8'))),
        }

    sectors: list[dict[str, Any]] = []
    monetary_reconciliation: list[dict[str, Any]] = []
    for _, sector_name in sector_events:
        sector_products = [product for product in products if product['sector'] == sector_name]
        mip_map: dict[str, list[dict[str, Any]]] = {}
        mip_order: list[str] = []
        for product in sector_products:
            mip_name = product['mip'] or 'SEM MIP'
            if mip_name not in mip_map:
                mip_map[mip_name] = []
                mip_order.append(mip_name)
            mip_map[mip_name].append(product)

        top_losses = sorted(
            sector_products,
            key=lambda product: product['loss_quantity'] or 0,
            reverse=True,
        )[:10]

        reported = sector_reported_totals.get(sector_name, {})
        calculated = {}
        for key in ('gross_cost_total', 'sale_price_total', 'total_value'):
            calculated[key] = round(
                sum(float(product[key] or 0) for product in sector_products),
                4,
            )
            reported_value = reported.get(key)
            delta = None if reported_value is None else round(calculated[key] - reported_value, 4)
            monetary_reconciliation.append(
                {
                    'sector': sector_name,
                    'field': key,
                    'reported': reported_value,
                    'calculated': calculated[key],
                    'delta': delta,
                    'passed': delta is not None and abs(delta) <= 0.01,
                }
            )

        sectors.append(
            {
                'name': sector_name,
                'product_count': len(sector_products),
                'reported_totals': reported,
                'calculated_monetary_totals': calculated,
                'top_losses': [
                    {
                        'rank': index + 1,
                        'product_code': product['product_code'],
                        'product_name': product['product_name'],
                        'mip': product['mip'],
                        'unit': product['unit'],
                        'loss_quantity': product['loss_quantity'],
                        'quantity_sold': product['quantity_sold'],
                        'loss_quantity_sales_percent': product['loss_quantity_sales_percent'],
                        'total_value': product['total_value'],
                    }
                    for index, product in enumerate(top_losses)
                ],
                'mips': [
                    {
                        'name': mip_name,
                        'products': mip_map[mip_name],
                    }
                    for mip_name in mip_order
                ],
            }
        )

    failed_reconciliation = [
        item for item in monetary_reconciliation if not item['passed']
    ]
    if failed_reconciliation:
        raise ReportValidationError(
            f'Totais monetários não reconciliaram em {path.name}: '
            f'{failed_reconciliation[:5]!r}'
        )

    grand_totals = {
        'record_count': record_count,
        'loss_quantity': _json_number(last_number('QRExpr2')),
        'gross_cost_total': _json_number(last_number('QRExpr11')),
        'sale_price_total': _json_number(last_number('QRExpr10')),
        'total_value': _json_number(last_number('QRExpr3')),
    }

    quality = {
        'status': 'PASS',
        'checks': {
            'title': True,
            'single_period': True,
            'origin_destination_store': True,
            'record_count': True,
            'sectors_present': True,
            'monetary_sector_reconciliation': True,
        },
        'sector_count': len(sectors),
        'product_count': len(products),
        'monetary_reconciliation_rows': len(monetary_reconciliation),
    }

    emissions = texts('QRSysData6')
    return {
        'schema_version': 1,
        'source': {
            'file_name': path.name,
            'size': path.stat().st_size,
            'sha256': _sha256(path),
            'encoding': encoding,
            'format': 'htm',
        },
        'report': {
            'title': report_titles[0],
            'side': side,
            'store_code': store.code,
            'store_name': store.name,
            'origin': origin_name,
            'destination': destination_name,
            'period_start': report_start.isoformat(),
            'period_end': report_end.isoformat(),
            'emissions': emissions,
        },
        'grand_totals': grand_totals,
        'sectors': sectors,
        'quality': quality,
    }
