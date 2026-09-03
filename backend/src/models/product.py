from dataclasses import dataclass


@dataclass(frozen=True)
class Product:
    code: str
    name: str
