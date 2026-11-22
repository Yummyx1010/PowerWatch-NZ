from datetime import date
from pathlib import Path

import pandas as pd

from pipeline.clean import add_time_columns, clean_source
from pipeline.nodes import load_node_mapping
from pipeline.sources import SourceSpec

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "data" / "samples"


def test_daily_source_is_standardised_and_preserves_originals() -> None:
    mapping = load_node_mapping(ROOT / "data" / "raw" / "20261121_NetworkSupplyPointsTable.csv")
    source = SourceSpec(
        key="daily:20261119",
        kind="daily_final",
        coverage_start=date(2026, 11, 19),
        coverage_end=date(2026, 11, 19),
        url="https://example.invalid/final.csv",
        filename="20261119_FinalEnergyPrices.csv",
        price_status="Final",
    )
    frame = clean_source(ROOT / "data" / "raw" / source.filename, source, mapping)
    assert len(frame) == 11808
    assert frame["price_status"].eq("Final").all()
    assert frame["price_type"].eq("final").all()
    assert frame["raw_price"].notna().all()
    assert (frame["utc_offset_hours"] == 13).all()
    assert set(frame["time_tag"]) == {"normal_nzdt"}
    otahuhu = frame[frame["node"] == "OTA2201"].iloc[0]
    assert otahuhu["region"] == "Auckland"
    assert otahuhu["mapping_status"] == "manual_override"
    assert frame[frame["mapping_status"] == "unmatched"].shape[0] > 0


def test_interim_status_is_not_silently_treated_as_final() -> None:
    mapping = load_node_mapping(ROOT / "data" / "raw" / "20261121_NetworkSupplyPointsTable.csv")
    source = SourceSpec(
        key="daily:20261122",
        kind="daily_interim",
        coverage_start=date(2026, 11, 22),
        coverage_end=date(2026, 11, 22),
        url="https://example.invalid/interim.csv",
        filename="20261122_FinalEnergyPrices_I.csv",
        price_status="Interim",
        note="interim_prices",
    )
    frame = clean_source(ROOT / "data" / "raw" / source.filename, source, mapping)
    assert frame["price_status"].eq("Interim").all()
    assert frame["price_type"].eq("interim").all()


def test_vectorised_time_columns_match_rowwise_dst_mapping() -> None:
    from pipeline.timeutil import period_info

    frame = pd.DataFrame(
        {
            "trading_date": [date(2024, 4, 7)] * 50 + [date(2024, 9, 29)] * 46,
            "trading_period": list(range(1, 51)) + list(range(1, 47)),
        }
    )
    result = add_time_columns(frame)
    for row in result.itertuples(index=False):
        expected = period_info(row.trading_date, row.trading_period)
        assert row.period_start_utc == expected.utc_start.replace(tzinfo=None)
        assert row.period_start_local == expected.local_start_label
        assert row.utc_offset_hours == expected.utc_offset_hours
        assert row.time_tag == expected.tag
