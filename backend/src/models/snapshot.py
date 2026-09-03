from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Snapshot:
    reference_date: date
