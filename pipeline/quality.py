"""Data-quality checks applied to every standardised source."""

from __future__ import annotations

import pandas as pd

from .sources import SourceSpec

CORE_COLUMNS = [
    "trading_date",
    "trading_period",
    "node",
    "price_nzd_per_mwh",
    "price_status",
    "period_start_utc",
]


def validate_source(frame: pd.DataFrame, source: SourceSpec) -> dict[str, object]:
    """Return a deterministic per-source validation result."""
    price = frame["price_nzd_per_mwh"]
    valid = price.dropna()
    grouped = frame.groupby(["trading_date", "node"], sort=False).agg(
        periods=("trading_period", "nunique"),
        expected=("expected_periods", "first"),
    )
    period_counts = frame.groupby("trading_date", sort=False)["expected_periods"].first()

    return {
        "sourceKey": source.key,
        "status": source.price_status or "Unknown",
        "issue": source.issue,
        "rows": int(len(frame)),
        "nodeCount": int(frame["node"].nunique()),
        "dateStart": str(min(frame["trading_date"])),
        "dateEnd": str(max(frame["trading_date"])),
        "duplicateKeys": int(frame.duplicated(subset=["trading_date", "trading_period", "node"]).sum()),
        "missingByColumn": {column: int(frame[column].isna().sum()) for column in CORE_COLUMNS},
        "incompleteNodeDays": int((grouped["periods"] != grouped["expected"]).sum()),
        "periodCountDistribution": {
            str(int(key)): int(value) for key, value in period_counts.value_counts().sort_index().items()
        },
        "timeTagDistribution": {
            str(key): int(value)
            for key, value in frame["time_tag"].value_counts().sort_index().items()
        },
        "priceStatusCounts": {
            str(key): int(value)
            for key, value in frame["price_status"].value_counts().sort_index().items()
        },
        "mappingStatusCounts": {
            str(key): int(value)
            for key, value in frame["mapping_status"].value_counts().sort_index().items()
        },
        "priceMin": float(valid.min()) if not valid.empty else None,
        "priceMax": float(valid.max()) if not valid.empty else None,
        "negativePrices": int((valid < 0).sum()),
        "zeroPrices": int((valid == 0).sum()),
    }


def aggregate_quality(reports: list[dict[str, object]]) -> dict[str, object]:
    """Combine per-source results into one portfolio-level report."""
    totals: dict[str, int] = {
        "rows": 0,
        "duplicateKeys": 0,
        "incompleteNodeDays": 0,
        "negativePrices": 0,
        "zeroPrices": 0,
    }
    statuses: dict[str, int] = {}
    tags: dict[str, int] = {}
    period_days: dict[str, int] = {}
    price_min = None
    price_max = None
    missing_by_column: dict[str, int] = {}

    for report in reports:
        for key in totals:
            totals[key] += int(report[key])
        for key, value in report["priceStatusCounts"].items():
            statuses[key] = statuses.get(key, 0) + int(value)
        for key, value in report["timeTagDistribution"].items():
            tags[key] = tags.get(key, 0) + int(value)
        for key, value in report["periodCountDistribution"].items():
            period_days[key] = period_days.get(key, 0) + int(value)
        for key, value in report["missingByColumn"].items():
            missing_by_column[key] = missing_by_column.get(key, 0) + int(value)
        low, high = report["priceMin"], report["priceMax"]
        if low is not None:
            price_min = low if price_min is None else min(price_min, low)
        if high is not None:
            price_max = high if price_max is None else max(price_max, high)

    return {
        "schemaVersion": "1.0",
        "sourceCount": len(reports),
        "totals": totals,
        "missingByColumn": missing_by_column,
        "priceStatusCounts": dict(sorted(statuses.items())),
        "timeTagDistribution": dict(sorted(tags.items())),
        "periodCountDays": dict(sorted(period_days.items())),
        "priceMin": price_min,
        "priceMax": price_max,
    }
