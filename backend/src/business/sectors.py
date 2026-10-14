from __future__ import annotations

import re
import unicodedata
from typing import Iterable

# Ordem canônica exigida pelo painel. A lista é deliberadamente fixa:
# um setor sem movimento continua presente no payload com valores zerados.
SALES_SECTOR_ORDER: tuple[str, ...] = (
    'ACOUGUE',
    'BAZAR',
    'BEBIDA',
    'EMPORIO',
    'FAST FOOD',
    'FLORICULTURA',
    'FLV MANIPULADOS',
    'HIGIENE BELEZA',
    'HORTIFRUTI',
    'LIMPEZA',
    'MERCEARIA',
    'PADARIA',
    'PEIXARIA',
    'PERECIVEIS',
    'PIZZARIA',
    'ROTISSERIA',
    'SUSHI',
)


def normalize_sector_key(value: str | None) -> str:
    text = unicodedata.normalize('NFD', str(value or '').strip())
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '_', text.casefold()).strip('_')


SALES_SECTOR_BY_KEY: dict[str, str] = {
    normalize_sector_key(name): name for name in SALES_SECTOR_ORDER
}

# Aliases apenas para diferenças ortográficas/acentuação já conhecidas.
# Não agrupamos setores de negócio diferentes silenciosamente.
SALES_SECTOR_ALIASES: dict[str, str] = {
    normalize_sector_key('AÇOUGUE'): 'ACOUGUE',
    normalize_sector_key('EMPÓRIO'): 'EMPORIO',
    normalize_sector_key('PERECÍVEIS'): 'PERECIVEIS',
}

# Setores administrativos/técnicos aparecem eventualmente no SUPERUS junto ao
# relatório comercial. Eles não representam venda de loja e, portanto, não
# devem compor os 17 setores nem o total exibido pelo painel.
EXCLUDED_SALES_SECTOR_KEYS: frozenset[str] = frozenset({
    normalize_sector_key('ADM PATRIMONIAL'),
    normalize_sector_key('SERVICO'),
})


def is_excluded_sales_sector(value: str | None) -> bool:
    return normalize_sector_key(value) in EXCLUDED_SALES_SECTOR_KEYS


def canonical_sector_name(value: str | None) -> str | None:
    key = normalize_sector_key(value)
    if not key:
        return None
    if key in SALES_SECTOR_ALIASES:
        return SALES_SECTOR_ALIASES[key]
    return SALES_SECTOR_BY_KEY.get(key)


def canonical_sector_key(value: str | None) -> str | None:
    name = canonical_sector_name(value)
    return normalize_sector_key(name) if name else None


def unknown_sector_names(values: Iterable[str | None]) -> list[str]:
    unknown: list[str] = []
    seen: set[str] = set()
    for value in values:
        raw = str(value or '').strip()
        if not raw or canonical_sector_name(raw) or is_excluded_sales_sector(raw):
            continue
        key = normalize_sector_key(raw)
        if key and key not in seen:
            seen.add(key)
            unknown.append(raw)
    return unknown
