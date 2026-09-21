from decimal import Decimal

import pytest

from src.config.loss_rules import classify_money_reconciliation


@pytest.mark.parametrize(
    ('reported', 'calculated', 'expected'),
    [
        ('23095.8039', '23095.7931', 'OK'),
        ('1000.00', '1000.01', 'OK'),
        ('1000.00', '1000.02', 'OK'),
        ('1000.00', '1000.03', 'WARNING'),
        ('1000.00', '1010.00', 'ERROR'),
    ],
)
def test_money_reconciliation_statuses(reported: str, calculated: str, expected: str):
    delta = Decimal(calculated) - Decimal(reported)
    assert classify_money_reconciliation(delta) == expected
