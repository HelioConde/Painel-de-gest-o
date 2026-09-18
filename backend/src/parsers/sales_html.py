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


# O relatório 'Loja: Todas' do SUPERUS pode incluir esta empresa fora das
# seis lojas Primor usadas no painel. Ela deve participar apenas da auditoria
# do total bruto do relatório e nunca do denominador Perda/Venda das lojas.
_EXCLUDED_SALES_STORES = {'pmb comercio e atacado'}


@dataclass(frozen=True)
class _Cell:
    top: int | None
    left: int | None
    text: str


class _DivParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._stack: list[dict[str, Any]] = []
        self.cells: list[_Cell] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.casefold() == 'div':
            data = {str(key).casefold(): value or '' for key, value in attrs}
            style = data.get('style', '')
            top_match = re.search(r'(?:^|;)\s*top\s*:\s*(-?\d+)px', style, re.IGNORECASE)
            left_match = re.search(r'(?:^|;)\s*left\s*:\s*(-?\d+)px', style, re.IGNORECASE)
            self._stack.append(
                {
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
            self.cells.append(
                _Cell(
                    top=item['top'],
                    left=item['left'],
                    text=_clean(''.join(item['parts'])),
                )
            )

    def handle_data(self, data: str) -> None:
        if self._stack:
            self._stack[-1]['parts'].append(data)


def _clean(value: str | None) -> str:
    return re.sub(r'\s+', ' ', unescape(value or '').replace('\xa0', ' ')).strip()


def _key(value: str | None) -> str:
    normalized = unicodedata.normalize('NFD', _clean(value))
    normalized = ''.join(ch for ch in normalized if unicodedata.category(ch) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '_', normalized.casefold()).strip('_') or 'sem_nome'


def _comparable(value: str | None) -> str:
    normalized = unicodedata.normalize('NFD', _clean(value))
    normalized = ''.join(ch for ch in normalized if unicodedata.category(ch) != 'Mn')
    return re.sub(r'\s+', ' ', normalized.casefold()).strip()


def _decode(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    declared = re.search(br'charset\s*=\s*["\']?([\w.-]+)', raw[:4096], re.IGNORECASE)
    encodings: list[str] = []
    if declared:
        encodings.append(declared.group(1).decode('ascii', errors='ignore'))
    encodings.extend(('iso-8859-1', 'windows-1252', 'utf-8', 'latin-1'))
    for encoding in dict.fromkeys(encodings):
        try:
            return raw.decode(encoding), encoding
        except (LookupError, UnicodeDecodeError):
            continue
    raise ReportValidationError(f'Não foi possível decodificar HTM de vendas: {path}')


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _decimal_br_exact(value: str | None) -> Decimal | None:
    text = _clean(value)
    if not text:
        return None
    # Aceita apenas uma célula que seja de fato numérica; não interpreta 500ML/220V.
    if not re.fullmatch(r'-?(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d+)?(?:\s*%)?', text):
        return None
    text = text.replace('%', '').strip()
    if ',' in text:
        text = text.replace('.', '').replace(',', '.')
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def _json_number(value: Decimal | None) -> float | None:
    return None if value is None else float(value)


def _group_rows(cells: list[_Cell]) -> list[tuple[int, list[_Cell]]]:
    grouped: dict[int, list[_Cell]] = defaultdict(list)
    for cell in cells:
        if cell.top is None or cell.left is None or not cell.text:
            continue
        grouped[cell.top].append(cell)
    return [
        (top, sorted(items, key=lambda item: item.left or 0))
        for top, items in sorted(grouped.items())
    ]


def _header_anchors(rows: list[tuple[int, list[_Cell]]]) -> dict[str, int]:
    aliases = {
        'code': {'codigo'},
        'name': {'nome'},
        'quantity': {'quantidade'},
        'cost': {'custo'},
        'sale': {'venda'},
    }
    anchors: dict[str, int] = {}
    # No QuickReport real, "Nome" fica 1 px abaixo da linha com Código/Quantidade.
    # Por isso procuramos os rótulos globalmente, não exigindo o mesmo top.
    for _, cells in rows[:400]:
        for cell in cells:
            normalized = _comparable(cell.text)
            for field, names in aliases.items():
                if field not in anchors and normalized in names and cell.left is not None:
                    anchors[field] = int(cell.left)
        if {'name', 'quantity', 'cost', 'sale'} <= set(anchors):
            return anchors
    raise ReportValidationError('Cabeçalho Código/Nome/Quantidade/Custo/Venda não encontrado no HTM de vendas.')


def _cell_near(cells: list[_Cell], left: int, tolerance: int = 38) -> _Cell | None:
    candidates = [cell for cell in cells if cell.left is not None and abs(cell.left - left) <= tolerance]
    if not candidates:
        return None
    return min(candidates, key=lambda cell: abs((cell.left or 0) - left))


def _extract_sector_group(cells: list[_Cell]) -> tuple[str | None, str | None]:
    joined = ' '.join(cell.text for cell in cells)
    sector = group = None
    match = re.search(r'\bSetor\s*:\s*(.*?)(?=\s+Grupo\s*:|$)', joined, flags=re.IGNORECASE)
    if match:
        sector = _clean(match.group(1)).upper()
    match = re.search(r'\bGrupo\s*:\s*(.*?)(?=\s+(?:SubGrupo|Categoria|Fornecedor|Comprador|Tipologia|Marca|Vendedor)\s*:|$)', joined, flags=re.IGNORECASE)
    if match:
        group = _clean(match.group(1)).upper()
    return sector or None, group or None


def _report_store_marker(text: str, expected: dict[str, str]) -> tuple[str | None, str] | None:
    """Identifica cabeçalhos de loja do relatório.

    Retorna (store_code, normalized_name). store_code=None significa uma loja
    deliberadamente excluída da rede Primor (ex.: PMB COMERCIO E ATACADO).
    """
    normalized = _comparable(text)
    code = expected.get(normalized)
    if code:
        return code, normalized
    if normalized in _EXCLUDED_SALES_STORES:
        return None, normalized
    return None


def _reported_sales_totals(
    rows: list[tuple[int, list[_Cell]]],
    anchors: dict[str, int],
    expected_store_names: dict[str, str],
) -> tuple[dict[str, float], list[dict[str, Any]], float | None]:
    """Lê subtotais por loja e o total geral sem misturar lojas excluídas.

    O QuickReport imprime um Group Footer por loja e, depois da última loja,
    um total geral. Usar todas as posições de loja (inclusive PMB) para
    delimitar os blocos evita atribuir registros/subtotais de uma empresa
    excluída à loja Primor anterior.
    """
    positions: list[tuple[int, str | None, str]] = []
    for top, cells in rows:
        for cell in cells:
            marker = _report_store_marker(cell.text, expected_store_names)
            if marker is not None:
                code, normalized_name = marker
                positions.append((top, code, normalized_name))
                break

    reported_primor: dict[str, float] = {}
    excluded: list[dict[str, Any]] = []
    raw_network_total: float | None = None

    for index, (store_top, store_code, normalized_name) in enumerate(positions):
        next_top = positions[index + 1][0] if index + 1 < len(positions) else 10**12
        candidates: list[tuple[int, float]] = []
        for row_top, row_cells in rows:
            if not (store_top < row_top < next_top):
                continue
            name_cell = _cell_near(row_cells, anchors['name'])
            if name_cell and name_cell.text:
                continue
            sale_cell = _cell_near(row_cells, anchors['sale'])
            sale_value = _decimal_br_exact(sale_cell.text if sale_cell else None)
            if sale_value is not None:
                candidates.append((row_top, float(sale_value)))

        # No último bloco: penúltimo candidato = subtotal da última loja;
        # último candidato = total geral. Se existir só um, tratamos como
        # subtotal e deixamos o total geral ausente em vez de adivinhar.
        if index == len(positions) - 1:
            if len(candidates) >= 2:
                store_total = candidates[-2][1]
                raw_network_total = candidates[-1][1]
            elif candidates:
                store_total = candidates[-1][1]
            else:
                store_total = None
        else:
            store_total = candidates[-1][1] if candidates else None

        if store_code is not None:
            if store_total is not None:
                reported_primor[store_code] = store_total
        else:
            excluded.append(
                {
                    'name': normalized_name.upper(),
                    'reported_sales_value': store_total,
                }
            )

    return reported_primor, excluded, raw_network_total


def _pct(numerator: float, denominator: float) -> float | None:
    if not denominator:
        return None
    return round((numerator / denominator) * 100, 6)


def parse_sales_html(
    path: Path,
    *,
    expected_start: date | None = None,
    expected_end: date | None = None,
) -> dict[str, Any]:
    """Parseia Sintético por SubGrupo em HTM para loja -> setor -> grupo -> subgrupo.

    O parser usa as posições das colunas descobertas pelo próprio cabeçalho do
    QuickReport. Assim ele não depende de IDs Delphi específicos do HTML.
    """
    path = Path(path)
    content, encoding = _decode(path)
    actual_start, actual_end, _ = extract_report_period(content)
    if actual_start is None or actual_end is None:
        raise ReportValidationError(f'Período não encontrado em {path.name}.')
    if expected_start is not None and actual_start != expected_start:
        raise ReportValidationError(
            f'Período inicial divergente em {path.name}: {actual_start} != {expected_start}'
        )
    if expected_end is not None and actual_end != expected_end:
        raise ReportValidationError(
            f'Período final divergente em {path.name}: {actual_end} != {expected_end}'
        )

    parser = _DivParser()
    parser.feed(content)
    rows = _group_rows(parser.cells)
    anchors = _header_anchors(rows)

    store_names = {_comparable(store.name): code for code, store in STORES.items()}
    current_store: str | None = None
    current_sector: str | None = None
    current_group: str | None = None
    records: list[dict[str, Any]] = []
    stores_seen: list[str] = []
    excluded_stores_seen: list[str] = []

    for _, cells in rows:
        store_marker: tuple[str | None, str] | None = None
        for cell in cells:
            marker = _report_store_marker(cell.text, store_names)
            if marker is not None:
                store_marker = marker
                break
        if store_marker is not None:
            matched_store, normalized_name = store_marker
            current_store = matched_store
            current_sector = None
            current_group = None
            if matched_store is not None:
                if matched_store not in stores_seen:
                    stores_seen.append(matched_store)
            elif normalized_name not in excluded_stores_seen:
                excluded_stores_seen.append(normalized_name)
            continue

        sector, group = _extract_sector_group(cells)
        if sector:
            # Cabeçalho global "Setor: Todos" não deve virar setor de dados.
            if _comparable(sector) != 'todos':
                current_sector = sector
            if group and _comparable(group) != 'todos':
                current_group = group
            continue

        if not current_store or not current_sector:
            continue

        name_cell = _cell_near(cells, anchors['name'])
        quantity_cell = _cell_near(cells, anchors['quantity'])
        cost_cell = _cell_near(cells, anchors['cost'])
        sale_cell = _cell_near(cells, anchors['sale'])
        if not name_cell or not sale_cell:
            continue

        name = _clean(name_cell.text).upper()
        if not name or _comparable(name) in {
            'nome', 'todos', 'loja padrao', 'usuario',
        }:
            continue

        sale = _decimal_br_exact(sale_cell.text)
        quantity = _decimal_br_exact(quantity_cell.text if quantity_cell else None)
        cost = _decimal_br_exact(cost_cell.text if cost_cell else None)
        if sale is None or quantity is None:
            continue

        code = None
        if 'code' in anchors:
            code_cell = _cell_near(cells, anchors['code'], tolerance=28)
            if code_cell and re.fullmatch(r'\d+', _clean(code_cell.text)):
                code = _clean(code_cell.text)

        # Evita linhas de totais: em subtotal o campo Nome normalmente fica vazio.
        # Quando houver SEM SUBGRUPO sem código, ele é preservado pelo nome.
        records.append(
            {
                'store_code': current_store,
                'store_name': get_store(current_store).name,
                'sector': current_sector,
                'sector_key': _key(current_sector),
                'group': current_group or 'SEM GRUPO',
                'group_key': _key(current_group or 'SEM GRUPO'),
                'subgroup_code': code,
                'subgroup_name': name,
                'subgroup_key': _key(name),
                'quantity': _json_number(quantity),
                'cost': _json_number(cost),
                'sales_value': _json_number(sale),
            }
        )

    if not records:
        raise ReportValidationError(f'Nenhuma linha de venda foi parseada em {path.name}.')

    # Reconciliação independente pelos Group Footers do QuickReport.
    # IMPORTANTE: o total geral bruto pode incluir PMB COMERCIO E ATACADO.
    # O painel usa apenas as seis lojas Primor, então a autoridade para a rede
    # Primor é a soma dos seis subtotais reportados, não o grand total bruto.
    reported_store_sales, excluded_reported_stores, reported_network_sales = (
        _reported_sales_totals(rows, anchors, store_names)
    )

    missing_stores = sorted(set(STORES) - set(stores_seen))

    # O QuickReport do SUPERUS pode simplesmente não imprimir uma loja quando
    # ela teve movimento zero no período. Não podemos tratar isso como arquivo
    # inválido automaticamente. A loja ausente será materializada abaixo com
    # venda zero, mas somente depois de provarmos pelo total geral oficial que
    # a soma das lojas ausentes é de fato zero.
    result_stores: list[dict[str, Any]] = []
    for store_code in STORES:
        store_records = [item for item in records if item['store_code'] == store_code]
        sector_order: list[str] = []
        sector_map: dict[str, list[dict[str, Any]]] = {}
        for item in store_records:
            sector_key = item['sector_key']
            if sector_key not in sector_map:
                sector_map[sector_key] = []
                sector_order.append(sector_key)
            sector_map[sector_key].append(item)

        sectors: list[dict[str, Any]] = []
        for sector_key in sector_order:
            sector_records = sector_map[sector_key]
            group_order: list[str] = []
            group_map: dict[str, list[dict[str, Any]]] = {}
            for item in sector_records:
                group_key = item['group_key']
                if group_key not in group_map:
                    group_map[group_key] = []
                    group_order.append(group_key)
                group_map[group_key].append(item)

            sectors.append(
                {
                    'key': sector_key,
                    'name': sector_records[0]['sector'],
                    'sales_value': round(sum(float(item['sales_value'] or 0) for item in sector_records), 4),
                    'record_count': len(sector_records),
                    'groups': [
                        {
                            'key': group_key,
                            'name': group_map[group_key][0]['group'],
                            'sales_value': round(
                                sum(float(item['sales_value'] or 0) for item in group_map[group_key]),
                                4,
                            ),
                            'subgroups': [
                                {
                                    'code': item['subgroup_code'],
                                    'key': item['subgroup_key'],
                                    'name': item['subgroup_name'],
                                    'quantity': item['quantity'],
                                    'cost': item['cost'],
                                    'sales_value': item['sales_value'],
                                }
                                for item in group_map[group_key]
                            ],
                        }
                        for group_key in group_order
                    ],
                }
            )

        parsed_store_sales = round(
            sum(float(item['sales_value'] or 0) for item in store_records), 4
        )
        reported_store = reported_store_sales.get(store_code)
        store_delta = (
            None
            if reported_store is None
            else round(parsed_store_sales - reported_store, 4)
        )
        if store_delta is not None and abs(store_delta) > 0.01:
            raise ReportValidationError(
                f'Reconciliação de vendas falhou loja {store_code}: '
                f'parseado={parsed_store_sales} reportado={reported_store} delta={store_delta}'
            )
        result_stores.append(
            {
                'store_code': store_code,
                'store_name': get_store(store_code).name,
                'sales_value': parsed_store_sales,
                'reported_sales_value': reported_store,
                'reconciliation_delta': store_delta,
                'record_count': len(store_records),
                'sector_count': len(sectors),
                'sectors': sectors,
            }
        )

    parsed_network = round(sum(store['sales_value'] for store in result_stores), 4)

    reported_primor_network = (
        round(sum(reported_store_sales[code] for code in STORES), 4)
        if all(code in reported_store_sales for code in STORES)
        else None
    )

    # Evidência fail-closed para loja(s) ausente(s) no HTML.
    # Se o relatório pulou, por exemplo, a loja 120, aceitamos zero somente
    # quando o total geral menos os subtotais visíveis (e menos lojas externas
    # conhecidas, se houver) fecha em 0,00. Se não houver total suficiente para
    # provar isso, ou se sobrar valor, o parser falha.
    missing_store_zero_residual: float | None = None
    if missing_stores:
        present_primor_sum = round(sum(reported_store_sales.values()), 4)
        excluded_values = [item.get('reported_sales_value') for item in excluded_reported_stores]
        excluded_known = all(value is not None for value in excluded_values)
        if reported_network_sales is not None and excluded_known:
            excluded_sum_for_missing = round(sum(float(value or 0) for value in excluded_values), 4)
            missing_store_zero_residual = round(
                reported_network_sales - present_primor_sum - excluded_sum_for_missing,
                4,
            )
        if missing_store_zero_residual is None:
            raise ReportValidationError(
                'HTM de vendas omitiu loja(s) e não há total geral suficiente para '
                f'provar movimento zero. Ausentes: {missing_stores}'
            )
        if abs(missing_store_zero_residual) > 0.01:
            raise ReportValidationError(
                'HTM de vendas omitiu loja(s), mas o total geral indica valor não '
                f'explicado de {missing_store_zero_residual:.4f}. Ausentes: {missing_stores}'
            )

    # Se temos os seis subtotais oficiais, eles são a reconciliação canônica
    # da rede Primor. O total geral bruto é apenas auditoria, pois pode conter
    # empresa(s) fora do painel, como PMB COMERCIO E ATACADO.
    canonical_reported_network = reported_primor_network
    if canonical_reported_network is None and not excluded_stores_seen:
        canonical_reported_network = reported_network_sales

    network_delta = (
        None
        if canonical_reported_network is None
        else round(parsed_network - canonical_reported_network, 4)
    )
    if network_delta is not None and abs(network_delta) > 0.01:
        raise ReportValidationError(
            f'Reconciliação geral de vendas falhou: parseado={parsed_network} '
            f'reportado_primor={canonical_reported_network} delta={network_delta}'
        )

    excluded_sales_from_grand_total = (
        None
        if reported_network_sales is None or reported_primor_network is None
        else round(reported_network_sales - reported_primor_network, 4)
    )
    excluded_reported_sum = round(
        sum(float(item['reported_sales_value'] or 0) for item in excluded_reported_stores), 4
    )
    raw_total_accounting_delta = (
        None
        if reported_network_sales is None
        or reported_primor_network is None
        or not excluded_reported_stores
        or any(item['reported_sales_value'] is None for item in excluded_reported_stores)
        else round(
            reported_primor_network + excluded_reported_sum - reported_network_sales,
            4,
        )
    )
    return {
        'report': {
            'title': 'Sintético por SubGrupo',
            'period_start': actual_start.isoformat(),
            'period_end': actual_end.isoformat(),
        },
        'source': {
            'file_name': path.name,
            'size': path.stat().st_size,
            'sha256': _sha256(path),
            'encoding': encoding,
            'format': 'htm',
        },
        'stores': result_stores,
        'network': {
            # Rede Primor: somente as seis lojas usadas no painel.
            'sales_value': parsed_network,
            'reported_primor_sales_value': reported_primor_network,
            'reconciliation_delta': network_delta,
            # Auditoria do relatório bruto. Pode incluir PMB.
            'raw_reported_sales_value': reported_network_sales,
            'excluded_sales_from_grand_total': excluded_sales_from_grand_total,
            'excluded_stores': excluded_reported_stores,
            'raw_total_accounting_delta': raw_total_accounting_delta,
            'source_stores_seen': stores_seen,
            'missing_stores_assumed_zero': missing_stores,
            'missing_store_zero_residual': missing_store_zero_residual,
            'record_count': len(records),
            'store_count': len(result_stores),
        },
        'quality': {
            'status': 'PASS',
            'checks': {
                'period': True,
                'six_stores': len(result_stores) == 6,
                'records_present': len(records) > 0,
                'sectors_present': all(
                    store['sector_count'] > 0 or store['store_code'] in missing_stores
                    for store in result_stores
                ),
                'missing_source_stores_proven_zero': (
                    not missing_stores
                    or (missing_store_zero_residual is not None and abs(missing_store_zero_residual) <= 0.01)
                ),
                'store_totals_reconciled': all(
                    store['reconciliation_delta'] is None
                    or abs(store['reconciliation_delta']) <= 0.01
                    for store in result_stores
                ),
                'network_total_reconciled': network_delta is None or abs(network_delta) <= 0.01,
                'excluded_store_context_detected': bool(excluded_stores_seen),
                'raw_total_accounting_reconciled': (
                    raw_total_accounting_delta is None or abs(raw_total_accounting_delta) <= 0.01
                ),
            },
        },
    }


def sales_store_map(parsed: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(item['store_code']): item for item in parsed['stores']}


def sales_sector_map(store: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(item['key']): item for item in store['sectors']}


def loss_sales_percent(loss_value: float | None, sales_value: float | None) -> float | None:
    return _pct(float(loss_value or 0), float(sales_value or 0))
