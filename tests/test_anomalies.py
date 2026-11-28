from pathlib import Path

import pandas as pd

from pipeline.anomalies import (
    _historical_month_stats,
    _severity,
    _tier,
    build_anomaly_payload,
)


def test_severity_tiers() -> None:
    assert _tier(20) == "low"
    assert _tier(50) == "medium"
    assert _tier(70) == "high"
    assert _tier(90) == "critical"
    assert _severity("price_spike", 1, local_z=6.0, seasonal_z=4.5) > 0


def test_historical_seasonal_baseline_excludes_current_and_future_dates() -> None:
    index = [pd.Timestamp("2024-01-01").date() + pd.Timedelta(days=offset) for offset in range(6)]
    series = pd.Series([10.0, 12.0, 11.0, 13.0, 12.0, 500.0], index=index)
    months = pd.Series([value.month for value in index], index=index)

    medians, _ = _historical_month_stats(series, months)

    assert pd.isna(medians.iloc[0])
    assert medians.iloc[-1] < 20
    assert medians.iloc[-1] < series.iloc[-1]


def test_anomaly_payload_flags_spike_and_records_negative_market_event(tmp_path: Path) -> None:
    rows = []
    for day in range(1, 41):
        current = pd.Timestamp("2026-01-01") + pd.Timedelta(days=day - 1)
        for node in ("AAA0001", "BBB0001"):
            price = 300.0 if node == "AAA0001" and day == 30 else 50.0
            rows.append(
                {
                    "trading_date": current.date(),
                    "node": node,
                    "price_nzd_per_mwh": price,
                    "price_status": "Final" if day < 38 else "Interim",
                    "price_type": "final" if day < 38 else "interim",
                }
            )
            if node == "BBB0001" and day == 20:
                rows.append(
                    {
                        "trading_date": current.date(),
                        "node": node,
                        "price_nzd_per_mwh": -5.0,
                        "price_status": "Final",
                        "price_type": "final",
                    }
                )
    pd.DataFrame(rows).to_parquet(tmp_path / "prices_202601_final.parquet", index=False)

    mapping = tmp_path / "mapping.csv"
    mapping.write_text(
        "Current flag,POC code,Description,Network reporting region,Island,Zone,NZTM easting,NZTM northing\n"
        "1,AAA0001,Alpha Node,Test North,NI,TEST,1762702,5907696\n"
        "1,BBB0001,Beta Node,Test South,SI,TEST,1567878,5179257\n",
        encoding="utf-8",
    )

    payload = build_anomaly_payload(tmp_path, mapping)
    events = payload["events"]
    assert payload["summary"]["eventCount"] > 0
    spike = next(
        event
        for event in events
        if event["type"] == "price_spike" and event["node"] == "AAA0001"
    )
    assert spike["stats"]["seasonalMedian"] < 300
    negative = [event for event in events if event["type"] == "negative_price"]
    assert negative
    assert all(event["classification"] == "market_event" for event in negative)
    assert all("stats" in event and "reasons" in event for event in events)
