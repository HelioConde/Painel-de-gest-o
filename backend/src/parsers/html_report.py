from __future__ import annotations

import html
import re
import unicodedata
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path

from src.superus.errors import ReportValidationError


@dataclass(frozen=True)
class HtmlValidation:
    encoding: str
    title_found: bool
    period_found: bool
    store_found: bool
    sector_found: bool
    group_found: bool
    detail_markers_found: int
    detected_period_start: str | None = None
    detected_period_end: str | None = None

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def read_html(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    declared = re.search(br'charset\s*=\s*["\']?([\w.-]+)', raw[:4096], re.IGNORECASE)
    candidates = [declared.group(1).decode('ascii').lower()] if declared else []
    candidates.extend(['iso-8859-1', 'windows-1252', 'utf-8', 'latin-1'])
    for encoding in dict.fromkeys(candidates):
        try:
            return raw.decode(encoding), encoding
        except (LookupError, UnicodeDecodeError):
            continue
    raise ReportValidationError('Não foi possível decodificar o HTM exportado.')


def visible_text(content: str) -> str:
    """Converte o HTML absoluto do QuickReport em texto comparável.

    O SUPERUS separa rótulo e valor em DIVs distintos e usa ``&nbsp;`` em
    praticamente todo o cabeçalho. Fazer busca diretamente no HTML bruto gera
    falsos negativos (foi exatamente o que ocorreu na validação do primeiro
    HTM real). Por isso os quality gates trabalham com o texto visível.
    """
    without_script = re.sub(
        r'<(?:script|style)\b.*?</(?:script|style)>',
        ' ',
        content,
        flags=re.IGNORECASE | re.DOTALL,
    )
    plain = re.sub(r'<[^>]+>', ' ', without_script)
    plain = html.unescape(plain).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', plain).strip()


def comparable_text(value: str) -> str:
    value = unicodedata.normalize('NFD', value or '')
    value = ''.join(ch for ch in value if unicodedata.category(ch) != 'Mn')
    return re.sub(r'\s+', ' ', value.casefold()).strip()


def extract_report_period(content: str) -> tuple[date | None, date | None, str | None]:
    """Extrai o período declarado pelo próprio relatório.

    Há duas estratégias, na ordem:
      1) elemento ``ID=Periodo`` do HTML do QuickReport;
      2) texto visível logo após o rótulo ``Periodo:``.

    Isso evita validar uma data que apareceu apenas em ``Emissão`` ou em outro
    ponto do documento.
    """
    # QuickReport real: <div ID="Periodo" ...>03/09/2026&nbsp;a&nbsp;03/09/2026</DIV>
    match = re.search(
        r'<(?:div|span)\b[^>]*\bid\s*=\s*["\']?periodo["\']?[^>]*>(.*?)</(?:div|span)>',
        content,
        flags=re.IGNORECASE | re.DOTALL,
    )
    candidates: list[str] = []
    if match:
        candidates.append(visible_text(match.group(1)))

    plain = visible_text(content)
    comparable = comparable_text(plain)
    label = re.search(
        r'periodo\s*:?\s*(\d{2}/\d{2}/\d{4})\s*(?:a|ate|-)\s*(\d{2}/\d{2}/\d{4})',
        comparable,
        flags=re.IGNORECASE,
    )
    if label:
        candidates.append(label.group(0))

    for candidate in candidates:
        dates = re.findall(r'\d{2}/\d{2}/\d{4}', candidate)
        if len(dates) < 2:
            continue
        try:
            start = __import__('datetime').datetime.strptime(dates[0], '%d/%m/%Y').date()
            end = __import__('datetime').datetime.strptime(dates[1], '%d/%m/%Y').date()
        except ValueError:
            continue
        return start, end, candidate

    return None, None, None


def validate_html(path: Path, store_code: str, start: str, end: str) -> HtmlValidation:
    content, encoding = read_html(path)
    plain = visible_text(content)
    normalized = comparable_text(plain)

    try:
        expected_start = __import__('datetime').datetime.strptime(start, '%d/%m/%Y').date()
        expected_end = __import__('datetime').datetime.strptime(end, '%d/%m/%Y').date()
    except ValueError as error:
        raise ReportValidationError('Datas esperadas devem estar em DD/MM/YYYY.') from error

    actual_start, actual_end, _ = extract_report_period(content)
    period_found = actual_start == expected_start and actual_end == expected_end

    validation = HtmlValidation(
        encoding=encoding,
        title_found=('sintetico por subgrupo' in normalized or 'relatorio' in normalized),
        period_found=period_found,
        store_found=store_code.casefold() in normalized,
        sector_found=(re.search(r'\bsetor\b', normalized) is not None or 'nivel1' in normalized),
        group_found=(re.search(r'\bgrupo\b', normalized) is not None or 'nivel2' in normalized),
        detail_markers_found=sum(
            marker in content.casefold() for marker in ('qrdbtext1', 'produto', 'codigo')
        ),
        detected_period_start=actual_start.isoformat() if actual_start else None,
        detected_period_end=actual_end.isoformat() if actual_end else None,
    )
    if not all((validation.title_found, validation.period_found, validation.store_found)):
        raise ReportValidationError(f'HTM não passou na validação mínima: {validation.as_dict()}')
    return validation
