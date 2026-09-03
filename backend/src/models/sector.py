from dataclasses import dataclass


@dataclass(frozen=True)
class Sector:
    name: str
