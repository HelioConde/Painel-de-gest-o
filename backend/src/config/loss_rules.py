from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal
from html import unescape
from typing import Literal


MoneyReconciliationStatus = Literal['OK', 'WARNING', 'ERROR']
MipClassification = Literal['LOSS', 'NON_LOSS', 'AMBIGUOUS']

MONEY_RECONCILIATION_TOLERANCE = Decimal('0.02')
MONEY_RECONCILIATION_WARNING_TOLERANCE = Decimal('0.10')


@dataclass(frozen=True)
class LossProductExclusion:
    product_name: str | None
    product_code: str | None
    reason: str
    active: bool = True


# Cadastro gerencial: novos produtos entram aqui, sem tocar no algoritmo.
LOSS_PRODUCT_EXCLUSIONS = (
    LossProductExclusion(
        product_name='MUCHIBA/OSSO',
        product_code='410364',
        reason='Não contabilizar no indicador gerencial de perda.',
    ),
)


def normalize_loss_text(value: object) -> str:
    text = unicodedata.normalize('NFD', unescape(str(value or '')).strip())
    text = ''.join(char for char in text if unicodedata.category(char) != 'Mn')
    return re.sub(r'[^A-Z0-9]+', ' ', text.upper()).strip()


# Resultado da auditoria dos HTMs de 01/09/2025 a 17/09/2026. A lista é
# explicitamente permitida: MIP novo não é contado até receber classificação.
LOSS_MIP_RULES: dict[str, MipClassification] = {
    'PERDA ACOUGUE': 'LOSS',
    'PERDA EMPORIO': 'LOSS',
    'PERDA FAST FOOD': 'LOSS',
    'PERDA FLORES': 'LOSS',
    'PERDA FRIOS': 'LOSS',
    'PERDA HORTIFRUTI': 'LOSS',
    'PERDA PADARIA': 'LOSS',
    'PERDA PIZZARIA': 'LOSS',
    'PERDA PRODUTOS NATURAIS': 'LOSS',
    'PERDA ROTISSERIA': 'LOSS',
    'PERDA SUSHI': 'LOSS',
    # O nome não identifica uma causa de perda com segurança. Fica fora do
    # indicador até a área comercial classificá-lo.
    'PERDA LOJA': 'AMBIGUOUS',
    'CONSUMO MANUTENCAO LOJA': 'NON_LOSS',
    'DEGUSTACAO OUTROS': 'NON_LOSS',
    'DOACAO': 'NON_LOSS',
    'LANCHE FUNCIONARIOS': 'NON_LOSS',
    'LIMPEZA ACOUGUE': 'NON_LOSS',
    'LIMPEZA COZINHA': 'NON_LOSS',
    'LIMPEZA PADARIA': 'NON_LOSS',
    'LIMPEZA ROTISSERIA': 'NON_LOSS',
    'PRODUCAO ACOUGUE': 'NON_LOSS',
    'PRODUCAO FAST FOOD': 'NON_LOSS',
    'PRODUCAO FATIADOS': 'NON_LOSS',
    'PRODUCAO HORTIFRUTI': 'NON_LOSS',
    'PRODUCAO PADARIA': 'NON_LOSS',
    'PRODUCAO PIZZARIA': 'NON_LOSS',
    'PRODUCAO PRODUTOS NATURAIS': 'NON_LOSS',
    'PRODUCAO ROTISSERIA': 'NON_LOSS',
    'PRODUCAO SUSHI': 'NON_LOSS',
    'TROCA': 'NON_LOSS',
}


def classify_loss_mip(value: object) -> MipClassification:
    return LOSS_MIP_RULES.get(normalize_loss_text(value), 'AMBIGUOUS')


def classify_money_reconciliation(delta: Decimal) -> MoneyReconciliationStatus:
    absolute_delta = abs(delta)
    if absolute_delta <= MONEY_RECONCILIATION_TOLERANCE:
        return 'OK'
    if absolute_delta <= MONEY_RECONCILIATION_WARNING_TOLERANCE:
        return 'WARNING'
    return 'ERROR'
