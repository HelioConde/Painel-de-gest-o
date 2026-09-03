import re
from dataclasses import asdict, dataclass
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

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def read_html(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    declared = re.search(br'charset\s*=\s*["\']?([\w-]+)', raw[:4096], re.IGNORECASE)
    candidates = [declared.group(1).decode('ascii').lower()] if declared else []
    candidates.extend(['iso-8859-1', 'windows-1252', 'utf-8'])
    for encoding in dict.fromkeys(candidates):
        try:
            return raw.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    raise ReportValidationError('Não foi possível decodificar o HTM exportado.')


def validate_html(path: Path, store_code: str, start: str, end: str) -> HtmlValidation:
    content, encoding = read_html(path)
    normalized = re.sub(r'\s+', ' ', content).casefold()
    validation = HtmlValidation(
        encoding=encoding,
        title_found='sintético por subgrupo' in normalized or 'relatório' in normalized,
        period_found=start.casefold() in normalized and end.casefold() in normalized,
        store_found=store_code.casefold() in normalized,
        sector_found='setor' in normalized or 'nivel1' in normalized,
        group_found='grupo' in normalized or 'nivel2' in normalized,
        detail_markers_found=sum(marker in normalized for marker in ('qrdbtext1', 'produto', 'código')),
    )
    if not all((validation.title_found, validation.period_found, validation.store_found)):
        raise ReportValidationError(f'HTM não passou na validação mínima: {validation.as_dict()}')
    return validation
