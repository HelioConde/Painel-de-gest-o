from __future__ import annotations

import hashlib
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from src.config.stores import STORES, get_store
from src.parsers.html_report import extract_report_period
from src.superus.errors import ReportValidationError


@dataclass(frozen=True)
class _Cell:
    identifier: str
    top: int | None
    text: str


class _QuickReportParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[dict[str, Any]] = []
        self.cells: list[_Cell] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.casefold() != 'div':
            return
        data = {str(key).casefold(): value or '' for key, value in attrs}
        top = re.search(r'(?:^|;)\s*top\s*:\s*(-?\d+)px', data.get('style', ''), re.I)
        self.stack.append({'id': data.get('id', ''), 'top': int(top.group(1)) if top else None, 'parts': []})

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() == 'div' and self.stack:
            item = self.stack.pop()
            self.cells.append(_Cell(item['id'], item['top'], _clean(''.join(item['parts']))))

    def handle_data(self, data: str) -> None:
        if self.stack:
            self.stack[-1]['parts'].append(data)


def _clean(value: str | None) -> str:
    return re.sub(r'\s+', ' ', unescape(value or '').replace('\xa0', ' ')).strip()


def _decode(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    declared = re.search(br'charset\s*=\s*["\']?([\w.-]+)', raw[:4096], re.I)
    encodings = ([declared.group(1).decode('ascii', errors='ignore')] if declared else []) + ['iso-8859-1', 'windows-1252', 'utf-8']
    for encoding in dict.fromkeys(encodings):
        try:
            return raw.decode(encoding), encoding
        except (LookupError, UnicodeDecodeError):
            continue
    raise ReportValidationError(f'Não foi possível decodificar HTM de tabloide: {path}')


def parse_brazilian_number(value: str | None) -> float:
    text = _clean(value).replace('R$', '').replace('%', '').strip()
    if not re.fullmatch(r'-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d+)?', text):
        raise ValueError(f'Número brasileiro inválido: {value!r}')
    try:
        return float(Decimal(text.replace('.', '').replace(',', '.')))
    except InvalidOperation as error:
        raise ValueError(f'Número brasileiro inválido: {value!r}') from error


def _store_from_text(value: str) -> str | None:
    normalized = unicodedata.normalize('NFD', _clean(value)).encode('ascii', 'ignore').decode().upper()
    if not normalized.startswith('LOJA:'):
        return None
    match = re.search(r'\b(307|212|600|120|033|018)\b', normalized)
    return match.group(1) if match else None


_SIZE = re.compile(r'\b(\d+(?:[.,]\d+)?\s*(?:KG|G|ML|L))\b', re.I)


def _key(value: str) -> str:
    normalized = unicodedata.normalize('NFD', value).encode('ascii', 'ignore').decode().upper()
    return re.sub(r'[^A-Z0-9]+', '_', normalized).strip('_')


def product_family(name: str, overrides: dict[str, str] | None = None) -> tuple[str, str, str | None, str]:
    """Retorna chave, título, gramatura e variante de forma conservadora."""
    source = _clean(name).upper()
    if overrides and source in overrides:
        family = _clean(overrides[source]).upper()
        return _key(family), family, None, source
    match = _SIZE.search(source)
    if not match:
        return _key(source), source, None, ''
    prefix = source[:match.start()].strip()
    package = re.sub(r'\s+', '', match.group(1).upper()).replace(',', '.')
    variant = source[match.end():].strip()
    family = f'{prefix} {package}'.strip()
    # A chave deliberadamente não contém a gramatura: a família Friskies,
    # por exemplo, pode reunir sachês de 80G e 85G sem misturar o detalhe.
    return _key(prefix), family, package, variant


def _fixed_number(line: str, start: int, end: int) -> float | None:
    # Campos adjacentes podem encostar quando um valor excede sua coluna.
    # Lemos o primeiro número brasileiro completo a partir do início da coluna.
    match = re.match(r'\s*(-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,3})?)', line[start:end])
    if not match:
        return None
    try:
        return parse_brazilian_number(match.group(1))
    except ValueError:
        return None


_TEXT_NUMBER = re.compile(r'-?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2,4}')
_TEXT_VALUE = r'-?(?:\d{1,3}(?:\.\d{3})*|\d+)'
_TEXT_STANDARD_ROW = re.compile(
    rf'^\s*(?:{_TEXT_VALUE},\d{{2}})\s+(?:{_TEXT_VALUE},\d{{2}})\s*'
    rf'(?P<quantity>{_TEXT_VALUE},\d{{3}})\s*(?:{_TEXT_VALUE},\d{{4}})\s+'
    rf'(?P<sales>{_TEXT_VALUE},\d{{2}})(?=\s)'
)
_TEXT_DENSE_ROW = re.compile(
    rf'^\s*(?:{_TEXT_VALUE},\d{{2}})\s+(?:{_TEXT_VALUE},\d{{2}})\s*'
    rf'(?P<quantity>{_TEXT_VALUE},\d{{3}})(?:{_TEXT_VALUE},\d{{3,4}}?)'
    rf'(?P<sales>{_TEXT_VALUE},\d{{2}})(?=\s|-)'
)
_TEXT_QTY_COST = re.compile(
    rf'^\s*(?P<quantity>{_TEXT_VALUE},\d{{3}})\s*(?:{_TEXT_VALUE},\d{{3,4}}?)'
)


def _text_numbers(value: str) -> list[float]:
    values: list[float] = []
    for match in _TEXT_NUMBER.finditer(value):
        if value[match.end():match.end() + 1] == '%':
            continue
        try:
            values.append(parse_brazilian_number(match.group()))
        except ValueError:
            continue
    return values


def _text_row_values(value: str) -> tuple[float | None, float | None]:
    """Extrai quantidade e venda mesmo quando colunas contíguas se unem."""
    complete = _TEXT_DENSE_ROW.match(value) or _TEXT_STANDARD_ROW.match(value)
    if complete:
        return (
            parse_brazilian_number(complete.group('quantity')),
            parse_brazilian_number(complete.group('sales')),
        )
    partial = _TEXT_QTY_COST.search(value)
    if partial:
        return parse_brazilian_number(partial.group('quantity')), None
    return None, None


def _parse_text_report(content: str, overrides: dict[str, str] | None) -> list[dict[str, Any]]:
    """Lê a variante textual que o botão HTM do SUPERUS também produz.

    Embora tenha extensão .htm, algumas versões do preview salvam texto
    monoespaçado. As colunas permanecem fixas e produtos sem preço unitário
    aparecem em uma linha complementar; ambas as formas são suportadas aqui.
    """
    current_store: str | None = None
    records: list[dict[str, Any]] = []
    pending: dict[str, Any] | None = None

    def flush() -> None:
        nonlocal pending
        if not pending:
            return
        if pending['quantity'] is not None and pending['sales_value'] is not None:
            family_key, family_name, package_size, variant_name = product_family(pending['product_name'], overrides)
            records.append({
                'store_code': pending['store_code'],
                'store_name': get_store(pending['store_code']).name,
                'product_code': pending['product_code'],
                'product_name': pending['product_name'],
                'family_key': family_key,
                'family_name': family_name,
                'package_size': package_size,
                'variant_name': variant_name,
                'quantity': pending['quantity'],
                'sales_value': pending['sales_value'],
            })
        pending = None

    for line in content.splitlines():
        store = _store_from_text(line)
        if store:
            flush()
            current_store = store
            continue

        product = re.match(r'^\s*(\d{1,8})\s+(.{1,50}?)(?=\s{2,}\S|\s*$)', line)
        if product and current_store:
            flush()
            numeric_values = _text_numbers(line[61:])
            quantity, sales_value = _text_row_values(line[61:])
            first_value_at = next((match.start() for match in _TEXT_NUMBER.finditer(line[61:])), 99) + 61
            # Linha regular: custo médio, preço, quantidade, custo e venda.
            # Linha quebrada: começa diretamente pela quantidade; preço/venda
            # chegam na continuação abaixo do nome do produto.
            is_wrapped = first_value_at >= 80
            pending = {
                'store_code': current_store,
                'product_code': product.group(1),
                'product_name': _clean(product.group(2)).upper(),
                'quantity': quantity if quantity is not None else (numeric_values[0] if is_wrapped and numeric_values else (numeric_values[2] if len(numeric_values) >= 3 else None)),
                'sales_value': None if is_wrapped else (
                    sales_value if sales_value is not None else (numeric_values[4] if len(numeric_values) >= 5 else None)
                ),
            }
            continue

        # Complemento de uma linha anterior sem preço unitário no relatório.
        if pending and not re.match(r'^\s{0,4}\d{1,8}\s', line):
            numeric_values = _text_numbers(line[61:])
            if pending['sales_value'] is None and len(numeric_values) >= 3:
                pending['sales_value'] = numeric_values[2]

    flush()
    return records


def parse_tabloid_html(path: Path, *, expected_start: date | None = None, expected_end: date | None = None, overrides: dict[str, str] | None = None) -> dict[str, Any]:
    path = Path(path)
    content, encoding = _decode(path)
    start, end, _ = extract_report_period(content)
    if not start or not end:
        raise ReportValidationError('Período não encontrado no relatório de tabloide.')
    if expected_start and start != expected_start:
        raise ReportValidationError(f'Início divergente: {start} != {expected_start}')
    if expected_end and end != expected_end:
        raise ReportValidationError(f'Fim divergente: {end} != {expected_end}')
    normalized_content = unicodedata.normalize('NFD', content).encode('ascii', 'ignore').decode().casefold()
    if 'vendas' not in normalized_content or 'promo' not in normalized_content:
        raise ReportValidationError('O arquivo não é um relatório Vendas Promoção.')

    parser = _QuickReportParser()
    parser.feed(content)
    current_store: str | None = None
    records: list[dict[str, Any]] = []
    cells = parser.cells
    for index, cell in enumerate(cells):
        store = _store_from_text(cell.text)
        if store:
            current_store = store
            continue
        if cell.identifier != 'QRDBText1' or not current_store or not re.fullmatch(r'\d+', cell.text):
            continue
        window = cells[index + 1:index + 16]
        same_line = [candidate for candidate in window if cell.top is not None and candidate.top is not None and abs(candidate.top - cell.top) <= 3]
        fields = {candidate.identifier: candidate.text for candidate in same_line}
        name = _clean(fields.get('QRDBText2'))
        if not name or not fields.get('QRDBText7') or not fields.get('QRDBText3'):
            continue
        try:
            quantity = parse_brazilian_number(fields['QRDBText7'])
            sales_value = parse_brazilian_number(fields['QRDBText3'])
        except ValueError:
            continue
        family_key, family_name, package_size, variant_name = product_family(name, overrides)
        records.append({
            'store_code': current_store,
            'store_name': get_store(current_store).name,
            'product_code': cell.text,
            'product_name': name.upper(),
            'family_key': family_key,
            'family_name': family_name,
            'package_size': package_size,
            'variant_name': variant_name,
            'quantity': quantity,
            'sales_value': sales_value,
        })
    if not records:
        records = _parse_text_report(content, overrides)
    if not records:
        raise ReportValidationError('Nenhum produto de tabloide foi encontrado.')
    stores = sorted({record['store_code'] for record in records})
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return {
        'period_start': start.isoformat(), 'period_end': end.isoformat(), 'encoding': encoding,
        'source_file_hash': digest, 'stores': stores, 'records': records,
        'summary': {'store_count': len(stores), 'product_count': len(records), 'family_count': len({record['family_key'] for record in records}), 'quantity': round(sum(row['quantity'] for row in records), 3), 'sales_value': round(sum(row['sales_value'] for row in records), 2)},
    }


def group_tabloid_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[record['family_key']].append(record)
    result = []
    for key, items in grouped.items():
        by_size = sorted({item['package_size'] for item in items if item['package_size']})
        family_name = items[0]['family_name']
        prefix = re.sub(r'\s+\d+(?:\.\d+)?(?:KG|G|ML|L)$', '', family_name)
        display = f"{prefix} {'/'.join(by_size)}" if len(by_size) > 1 else family_name
        result.append({'family_key': key, 'family_name': display, 'quantity': round(sum(item['quantity'] for item in items), 3), 'sales_value': round(sum(item['sales_value'] for item in items), 2), 'variants': items})
    return sorted(result, key=lambda item: item['sales_value'], reverse=True)
