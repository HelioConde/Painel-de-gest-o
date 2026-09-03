from src.app.controller import initialize
from src.config.settings import Settings


def test_settings_load_without_secret() -> None:
    settings = Settings.from_environment()
    assert settings.application_name == 'Painel de Gestão'


def test_controller_initializes() -> None:
    assert initialize().application_name == 'Painel de Gestão'
