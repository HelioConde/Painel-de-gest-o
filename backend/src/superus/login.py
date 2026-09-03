from src.config.settings import Settings
from src.superus.windows import Win32


def login_if_present(win32: Win32, settings: Settings) -> bool:
    """Login é discovery-driven: sem classe/controles comprovados, não adivinha campos."""
    login_window = win32.find_window('TFormLogin')
    if not login_window:
        return False
    settings.require_credentials()
    raise RuntimeError('Tela de login detectada, mas seus controles ainda exigem --inspect-superus.')
