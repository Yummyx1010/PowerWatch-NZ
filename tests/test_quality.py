from datetime import date

import pandas as pd

from pipeline.quality import aggregate_quality, validate_source
from pipeline.sources import SourceSpec


def _frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "trading_date": [date(2026, 1, 1)] * 6,
            "trading_period": [1, 2, 3, 1, 2, 3],
            "node": ["A", "A", "A", "B", "B", "B"],
            "price_nzd_per_mwh": [10.0, 20.0, None, -5.0, 0.0, 30.0],
            "price_status": ["Final"] * 6,
            "period_start_utc": [pd.Timestamp("2025-12-31 12:00")] * 6,
            "expected_periods": [48] * 6,
            "time_tag": ["normal_nzst"] * 6,
            "mapping_status": ["nsp_table"] * 6,
        }
    )


def test_validate_source_detects_duplicates_missing_and_incomplete_days() -> None:
    source = SourceSpec(
        key="test",
        kind="daily_final",
        coverage_start=date(2026, 1, 1),
        coverage_end=date(2026, 1, 1),
        url="",
        filename="test.csv",
        price_status="Final",
    )
    report = validate_source(_frame(), source)
    assert report["rows"] == 6
    assert report["duplicateKeys"] == 0
    assert report["missingByColumn"]["price_nzd_per_mwh"] == 1
    assert report["incompleteNodeDays"] == 2
    assert report["negativePrices"] == 1
    assert report["zeroPrices"] == 1
    assert report["periodCountDistribution"] == {"48": 1}


def test_aggregate_quality_sums_sources() -> None:
    base = {
        "rows": 10,
        "duplicateKeys": 1,
        "incompleteNodeDays": 2,
        "negativePrices": 0,
        "zeroPrices": 1,
        "priceStatusCounts": {"Final": 10},
        "timeTagDistribution": {"normal_nzst": 10},
        "periodCountDistribution": {"48": 1},
        "missingByColumn": {"node": 0},
        "priceMin": 1.0,
        "priceMax": 9.0,
    }
    aggregate = aggregate_quality([base, dict(base)])
    assert aggregate["totals"]["rows"] == 20
    assert aggregate["totals"]["duplicateKeys"] == 2
    assert aggregate["priceStatusCounts"] == {"Final": 20}
    assert aggregate["priceMin"] == 1.0
    assert aggregate["priceMax"] == 9.0
