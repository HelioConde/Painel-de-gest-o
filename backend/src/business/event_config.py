from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class EvidenceStatus(StrEnum):
    CONFIRMED = 'CONFIRMED'
    DISCOVERY_REQUIRED = 'DISCOVERY_REQUIRED'


@dataclass(frozen=True)
class EventConfig:
    slug: str
    selector_type: str
    selector_value: str
    metric: str
    unit: str | None
    evidence_status: EvidenceStatus
    automation_strategy: str
    post_filter_sector: str | None = None


# A automação sempre coleta um Sintético por SubGrupo completo e novo.
# Isso reproduz o fluxo que já estava estável e elimina filtros frágeis na UI.
# A semântica do evento é aplicada depois no parser/regra de negócio.
EVENT_CONFIGS: dict[str, EventConfig] = {
    'fim_semana': EventConfig(
        'fim_semana', 'ALL_SALES', 'ALL', 'monetary', None,
        EvidenceStatus.CONFIRMED, 'base_sales_report', None,
    ),
    'segunda_pizza': EventConfig(
        'segunda_pizza', 'ALL_SALES', 'ALL', 'quantity', 'QTD',
        EvidenceStatus.CONFIRMED, 'base_sales_report_post_filter', 'PIZZARIA',
    ),
    'terca_carne': EventConfig(
        'terca_carne', 'ALL_SALES', 'ALL', 'monetary', None,
        EvidenceStatus.CONFIRMED, 'base_sales_report_post_filter', 'ACOUGUE',
    ),
    'quarta_quinta_verde': EventConfig(
        'quarta_quinta_verde', 'ALL_SALES', 'ALL', 'monetary', None,
        EvidenceStatus.CONFIRMED, 'base_sales_report', None,
    ),
    'sexta_pao': EventConfig(
        'sexta_pao', 'ALL_SALES', 'ALL', 'monetary', None,
        EvidenceStatus.CONFIRMED, 'base_sales_report_post_filter', 'PADARIA',
    ),
}


def event_config_for(slug: str) -> EventConfig:
    return EVENT_CONFIGS[slug]
