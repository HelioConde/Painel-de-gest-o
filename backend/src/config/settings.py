import os
from dataclasses import dataclass
from pathlib import Path


class ConfigurationError(RuntimeError):
    """A configuração local necessária para a execução não está disponível."""


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        key, separator, value = line.partition('=')
        if separator and key and not key.lstrip().startswith('#'):
            os.environ.setdefault(key.strip(), value.strip())


@dataclass(frozen=True)
class Settings:
    application_name: str = 'Painel de Gestão'
    superus_username: str | None = None
    superus_password: str | None = None
    superus_launcher_path: Path | None = None
    superus_executable_path: Path | None = None

    @classmethod
    def from_environment(cls) -> 'Settings':
        _load_dotenv(Path(__file__).resolve().parents[2] / '.env')
        return cls(
            superus_username=os.getenv('SUPERUS_USERNAME') or None,
            superus_password=os.getenv('SUPERUS_PASSWORD') or None,
            superus_launcher_path=_optional_path(os.getenv('SUPERUS_LAUNCHER_PATH')),
            superus_executable_path=_optional_path(os.getenv('SUPERUS_EXECUTABLE_PATH')),
        )

    def require_credentials(self) -> tuple[str, str]:
        if not self.superus_username or not self.superus_password:
            raise ConfigurationError('SUPERUS_USERNAME e SUPERUS_PASSWORD são obrigatórios em backend/.env.')
        return self.superus_username, self.superus_password


def _optional_path(value: str | None) -> Path | None:
    return Path(value) if value and value.strip() else None
