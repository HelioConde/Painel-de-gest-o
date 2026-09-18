from __future__ import annotations

from src.config.settings import Settings


def main() -> int:
    settings = Settings.from_environment()
    print(f"SUPERUS_USERNAME carregado: {settings.superus_username!r}")
    print(f"SUPERUS_PASSWORD configurado: {bool(settings.superus_password)}")
    print(f"SUPERUS_PASSWORD tamanho: {len(settings.superus_password or '')}")
    print(f"SUPERUS_LAUNCHER_PATH: {settings.superus_launcher_path!r}")
    print(f"SUPERUS_EXECUTABLE_PATH: {settings.superus_executable_path!r}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
