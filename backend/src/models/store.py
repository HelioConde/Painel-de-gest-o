from dataclasses import dataclass


@dataclass(frozen=True)
class Store:
    code: str
    name: str
