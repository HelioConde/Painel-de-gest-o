from dataclasses import dataclass

from src.config.settings import ConfigurationError


@dataclass(frozen=True)
class Store:
    code: str
    sequence: str
    superus_code: str
    name: str


STORES = {
    '307': Store('307', '01', '17', 'SUPERMERCADO PRIMOR 01 307'),
    '212': Store('212', '02', '15608', 'SUPERMERCADO PRIMOR 02 212'),
    '600': Store('600', '03', '63395', 'SUPERMERCADO PRIMOR 03 600'),
    '120': Store('120', '04', '66471', 'SUPERMERCADO PRIMOR 04 120'),
    '033': Store('033', '05', '72731', 'SUPERMERCADO PRIMOR 05 033'),
    '018': Store('018', '06', '74964', 'SUPERMERCADO PRIMOR 06 018'),
}


def get_store(code: str) -> Store:
    try:
        return STORES[code.zfill(3)]
    except KeyError as error:
        raise ConfigurationError(f'Loja inválida: {code}.') from error
