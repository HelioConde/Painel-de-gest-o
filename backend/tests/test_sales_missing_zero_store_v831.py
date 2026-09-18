from __future__ import annotations

from datetime import date
from pathlib import Path

from src.business.periods import ReportPeriod
from src.quality.raw_report import RawReportValidation


def test_raw_sales_validation_allows_store_omitted_from_source_when_structure_is_valid():
    validation = RawReportValidation(
        title_found=True,
        period_found=True,
        period_start='2026-09-04',
        period_end='2026-09-04',
        stores=('307', '212', '600', '033', '018'),
        sectors_found=True,
        groups_found=True,
        details_found=True,
    )
    assert validation.passed is True
    data = validation.as_dict()
    assert data['missing_stores'] == ['120']
    assert data['stores_complete_in_source'] is False


def test_raw_sales_validation_still_rejects_report_without_any_primor_store():
    validation = RawReportValidation(
        title_found=True,
        period_found=True,
        period_start='2026-09-04',
        period_end='2026-09-04',
        stores=(),
        sectors_found=True,
        groups_found=True,
        details_found=True,
    )
    assert validation.passed is False
