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
            os.environ[key.strip()] = value.strip()


def _optional_path(value: str | None) -> Path | None:
    return Path(value) if value and value.strip() else None


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    return int(value) if value and value.strip() else default


def _float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    return float(value) if value and value.strip() else default


@dataclass(frozen=True)
class Settings:
    application_name: str = 'Painel de Gestão'
    superus_username: str | None = None
    superus_password: str | None = None
    superus_launcher_path: Path | None = None
    superus_executable_path: Path | None = None
    superus_export_html_x: int = 437
    superus_export_html_y: int = 16
    superus_preview_timeout: float = 90.0
    superus_save_timeout: float = 20.0
    superus_file_timeout: float = 60.0
    supabase_url: str | None = None
    supabase_secret_key: str | None = None
    supabase_loss_table: str = 'loss_period_snapshots'
    supabase_sales_table: str = 'superus_period_snapshots'
    supabase_timeout: float = 30.0
    gemini_api_key: str | None = None
    gemini_model: str = 'gemini-2.0-flash'
    gemini_timeout: float = 35.0

    @classmethod
    def from_environment(cls) -> 'Settings':
        _load_dotenv(Path(__file__).resolve().parents[2] / '.env')
        return cls(
            superus_username=(os.getenv('SUPERUS_USERNAME') or os.getenv('SUPERUS_USER') or None),
            superus_password=os.getenv('SUPERUS_PASSWORD') or None,
            superus_launcher_path=_optional_path(os.getenv('SUPERUS_LAUNCHER_PATH')),
            superus_executable_path=_optional_path(os.getenv('SUPERUS_EXECUTABLE_PATH')),
            superus_export_html_x=_int_env('SUPERUS_EXPORT_HTML_X', 437),
            superus_export_html_y=_int_env('SUPERUS_EXPORT_HTML_Y', 16),
            superus_preview_timeout=_float_env('SUPERUS_PREVIEW_TIMEOUT', 90.0),
            superus_save_timeout=_float_env('SUPERUS_SAVE_TIMEOUT', 20.0),
            superus_file_timeout=_float_env('SUPERUS_FILE_TIMEOUT', 60.0),
            supabase_url=os.getenv('SUPABASE_URL') or None,
            supabase_secret_key=(
                os.getenv('SUPABASE_SECRET_KEY')
                or os.getenv('SUPABASE_SERVICE_ROLE_KEY')
                or None
            ),
            supabase_loss_table=os.getenv('SUPABASE_LOSS_TABLE') or 'loss_period_snapshots',
            supabase_sales_table=os.getenv('SUPABASE_SALES_TABLE') or 'superus_period_snapshots',
            supabase_timeout=_float_env('SUPABASE_TIMEOUT', 30.0),
            gemini_api_key=os.getenv('GEMINI_API_KEY') or None,
            gemini_model=os.getenv('GEMINI_MODEL') or 'gemini-2.0-flash',
            gemini_timeout=_float_env('GEMINI_TIMEOUT', 35.0),
        )

    def require_credentials(self) -> tuple[str, str]:
        if not self.superus_username or not self.superus_password:
            raise ConfigurationError('SUPERUS_USERNAME e SUPERUS_PASSWORD são obrigatórios em backend/.env.')
        return self.superus_username, self.superus_password

    def require_supabase(self) -> tuple[str, str]:
        if not self.supabase_url:
            raise ConfigurationError('SUPABASE_URL é obrigatório em backend/.env para sincronizar.')
        if not self.supabase_secret_key:
            generic_key = os.getenv('SUPABASE_KEY')
            extra = (
                ' SUPABASE_KEY foi encontrado, mas não é aceito para escrita privilegiada '
                'porque normalmente é uma chave de frontend/anon.'
                if generic_key
                else ''
            )
            raise ConfigurationError(
                'SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) é obrigatório '
                f'em backend/.env para sincronizar.{extra}'
            )
        return self.supabase_url, self.supabase_secret_key.strip().strip('"').strip("'")
