from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

from pipeline.overview import build_overview_payload

NODES = ["OTA2201", "HAY2201", "ISL2201"]


def _frame(day: date, status: str) -> pd.DataFrame:
    rows = []
    for node_index, node in enumerate(NODES):
        for period in range(1, 49):
            start = datetime.combine(day, datetime.min.time()) + timedelta(minutes=30 * (period - 1))
            rows.append(
                {
                    "trading_date": day,
                    "trading_period": period,
                    "period_start_local": f"{day.isoformat()} {start.strftime('%H:%M')}",
                    "period_start_utc": start,
                    "node": node,
                    "price_nzd_per_mwh": 50.0 + node_index * 10 + period * 0.25,
                    "price_status": status,
                    "price_type": status.lower(),
                }
            )
    return pd.DataFrame(rows)


def test_overview_payload_uses_real_standardised_rows(tmp_path: Path) -> None:
    _frame(date(2026, 11, 21), "Final").to_parquet(
        tmp_path / "prices_202611_final.parquet", index=False
    )
    _frame(date(2026, 11, 22), "Interim").to_parquet(
        tmp_path / "prices_202611_interim.parquet", index=False
    )

    payload = build_overview_payload(tmp_path)
    metrics = payload["metrics"]

    assert payload["schemaVersion"] == "1.0"
    assert len(payload["recent"]) == 288
    assert len(payload["daily"]) == 6
    assert metrics["latestDate"] == "2026-11-22"
    assert metrics["latestFinalDate"] == "2026-11-21"
    assert len(metrics["latestPrices"]) == 3
    assert all(price["status"] == "Interim" for price in metrics["latestPrices"])
    assert metrics["regionalSpread"]["difference"] == 20.0
    assert metrics["regionalSpread"]["status"] == "Interim"
    assert set(metrics["volatility7d"]) == set(NODES)
    assert metrics["largestMove"] is not None
    assert metrics["negativeRecentPrices"] == 0
    assert set(payload["definitions"]) >= {"volatility", "regionalSpread", "largestMove", "notable"}
