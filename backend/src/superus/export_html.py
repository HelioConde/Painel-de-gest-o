import time
from pathlib import Path

from src.superus.errors import ExportError


def wait_file_stable(path: Path, poll_seconds: float = 0.25, stable_reads: int = 4) -> Path:
    stable = 0
    previous_size = -1
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if path.exists():
            size = path.stat().st_size
            try:
                with path.open('rb'):
                    pass
            except OSError:
                stable = 0
            else:
                stable = stable + 1 if size > 0 and size == previous_size else 0
                if stable >= stable_reads:
                    return path
                previous_size = size
        time.sleep(poll_seconds)
    raise ExportError(f'Arquivo não ficou estável: {path}')


def export_preview_as_htm(*_: object, **__: object) -> Path:
    """Bloqueado até que --inspect-superus comprove o controle de exportação do preview."""
    raise ExportError('Exportação não configurada: execute --inspect-superus no TFormPreview primeiro.')
