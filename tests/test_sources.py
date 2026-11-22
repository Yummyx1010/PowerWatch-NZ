from datetime import date

from pipeline.sources import (
    BLOB_LIST_PREFIX,
    coverage_gaps,
    month_bounds,
    month_keys,
    monthly_specs,
)


def test_month_helpers() -> None:
    assert month_bounds(2024, 2) == (date(2024, 2, 1), date(2024, 2, 29))
    assert month_keys(date(2023, 11, 15), date(2024, 1, 3)) == [
        (2023, 11),
        (2023, 12),
        (2024, 1),
    ]


def test_monthly_specs_mark_incomplete_file_without_dropping_it() -> None:
    names = [
        BLOB_LIST_PREFIX + "202311_FinalEnergyPrices.csv",
        BLOB_LIST_PREFIX + "202512_FinalEnergyPrices_incomplete.csv",
        BLOB_LIST_PREFIX + "202601_FinalEnergyPrices.csv",
    ]
    specs = monthly_specs(date(2023, 11, 1), date(2026, 1, 31), names=names)
    by_key = {spec.key: spec for spec in specs}
    assert by_key["monthly:202311"].issue is None
    assert by_key["monthly:202512"].issue == "incomplete_monthly_file"
    assert by_key["monthly:202601"].issue is None
    assert by_key["monthly:202512"].url.endswith("202512_FinalEnergyPrices_incomplete.csv")


def test_coverage_gaps_reports_december_2025() -> None:
    specs = monthly_specs(
        date(2025, 11, 1),
        date(2026, 1, 31),
        names=[
            BLOB_LIST_PREFIX + "202511_FinalEnergyPrices.csv",
            BLOB_LIST_PREFIX + "202512_FinalEnergyPrices_incomplete.csv",
            BLOB_LIST_PREFIX + "202601_FinalEnergyPrices.csv",
        ],
    )
    gaps = coverage_gaps(specs, date(2025, 11, 1), date(2026, 1, 31))
    assert gaps == [(date(2025, 12, 1), date(2025, 12, 31))]
