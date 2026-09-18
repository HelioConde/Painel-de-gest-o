from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

from src.business.periods import ReportPeriod
from src.config.stores import STORES, get_store
from src.parsers.html_report import comparable_text, extract_report_period, read_html, visible_text
from src.superus.errors import ReportValidationError

EXPECTED_STORES = tuple(STORES)


@dataclass(frozen=True)
class RawReportValidation:
    title_found: bool
    period_found: bool
    period_start: str | None
    period_end: str | None
    stores: tuple[str, ...]
    sectors_found: bool
    groups_found: bool
    details_found: bool

    @property
    def passed(self) -> bool:
        # O SUPERUS omite uma loja do Sintético por SubGrupo quando ela não
        # possui movimento no período. Portanto, a validação estrutural do HTM
        # não pode exigir que os seis cabeçalhos apareçam no arquivo bruto.
        #
        # A prova de que uma loja ausente vale realmente zero é feita depois,
        # no parser de vendas, reconciliando a soma das lojas visíveis com o
        # total geral oficial do próprio relatório. Assim não mascaramos um
        # arquivo truncado e, ao mesmo tempo, não interrompemos a coleta antes
        # de gerar o comparativo do ano anterior.
        return all(
            (
                self.title_found,
                self.period_found,
                bool(self.stores),
                self.sectors_found,
                self.groups_found,
                self.details_found,
            )
        )

    def as_dict(self) -> dict[str, object]:
        return {
            'title_found': self.title_found,
            'period_found': self.period_found,
            'period_start': self.period_start,
            'period_end': self.period_end,
            'stores': list(self.stores),
            'missing_stores': [code for code in EXPECTED_STORES if code not in self.stores],
            'stores_complete_in_source': set(self.stores) == set(EXPECTED_STORES),
            'sectors_found': self.sectors_found,
            'groups_found': self.groups_found,
            'details_found': self.details_found,
            'status': 'PASS' if self.passed else 'FAIL',
        }


def file_fingerprint(path: Path) -> dict[str, object]:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return {'size': path.stat().st_size, 'sha256': digest.hexdigest()}


def _stores_found(plain: str) -> tuple[str, ...]:
    comparable = comparable_text(plain)
    found: list[str] = []
    for code in EXPECTED_STORES:
        if comparable_text(get_store(code).name) in comparable:
            found.append(code)
    return tuple(found)


def validate_raw_sales_report(path: Path, requested_period: ReportPeriod) -> RawReportValidation:
    content, _ = read_html(path)
    plain = visible_text(content)
    normalized = comparable_text(plain)
    raw_normalized = content.casefold()

    actual_start, actual_end, _ = extract_report_period(content)
    period_found = actual_start == requested_period.start and actual_end == requested_period.end

    validation = RawReportValidation(
        title_found='sintetico por subgrupo' in normalized,
        period_found=period_found,
        period_start=actual_start.isoformat() if actual_start else None,
        period_end=actual_end.isoformat() if actual_end else None,
        stores=_stores_found(plain),
        sectors_found=re.search(r'\bsetor\b', normalized) is not None,
        groups_found=(
            re.search(r'\bgrupo\b', normalized) is not None
            and re.search(r'\bsubgrupo\b', normalized) is not None
        ),
        details_found='qrdbtext' in raw_normalized or '<tr' in raw_normalized,
    )
    if not validation.passed:
        raise ReportValidationError(
            f'HTM bruto inválido: {path} validation={validation.as_dict()}'
        )
    return validation
