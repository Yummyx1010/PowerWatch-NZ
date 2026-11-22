from pathlib import Path

from pipeline.config import (
    final_daily_url,
    final_monthly_url,
    interim_daily_url,
    nsp_table_url,
    single_node_url,
    UNIQUE_REPRESENTATIVE_NODES,
)
from pipeline.download import sha256
from pipeline.export import sample_price_rows
from pipeline.profile import profile_price_frame, read_price_csv
from datetime import date

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "data" / "samples"


def test_source_urls_are_real_public_endpoints() -> None:
    assert final_daily_url(date(2026, 11, 19)).endswith(
        "/FinalEnergyPrices/20261119_FinalEnergyPrices.csv"
    )
    assert final_monthly_url(date(2026, 10, 1)).endswith(
        "/ByMonth/202610_FinalEnergyPrices.csv"
    )
    assert interim_daily_url(date(2026, 11, 22)).endswith(
        "/20261122_FinalEnergyPrices_I.csv"
    )
    assert "CLA3WR" in single_node_url(date(2026, 3, 28), date(2026, 3, 28), "OTA2201")
    assert "OTA2201" in single_node_url(date(2026, 3, 28), date(2026, 3, 28), "OTA2201")
    assert nsp_table_url(date(2026, 11, 21)).endswith("20261121_NetworkSupplyPointsTable.csv")


def test_representative_nodes_cover_target_areas() -> None:
    areas = {node.area for node in UNIQUE_REPRESENTATIVE_NODES}
    assert areas == {"Auckland", "Wellington", "Christchurch"}
    assert {node.island for node in UNIQUE_REPRESENTATIVE_NODES} == {"NI", "SI"}


def test_daily_sample_reads_into_canonical_schema() -> None:
    frame = read_price_csv(SAMPLES / "final_prices_sample.csv")
    profile = profile_price_frame(frame)
    assert profile["rows"] == 144
    assert profile["node_count"] == 3
    assert profile["period_min"] == 1
    assert profile["period_max"] == 48
    assert profile["duplicate_keys"] == 0
    assert profile["missing_by_column"]["price_nzd_per_mwh"] == 0
    assert profile["negative_prices"] == 0


def test_single_node_report_preamble_is_parsed() -> None:
    frame = read_price_csv(SAMPLES / "single_node_OTA2201_20260328.csv")
    profile = profile_price_frame(frame)
    assert profile["rows"] == 48
    assert profile["dates"] == ["2026-03-28"]
    assert profile["price_status_values"] == ["Final"]
    assert profile["duplicate_keys"] == 0


def test_sample_node_filter_is_deterministic() -> None:
    raw = read_price_csv(ROOT / "data" / "raw" / "20261119_FinalEnergyPrices.csv")
    subset = sample_price_rows(raw)
    assert len(subset) == 144
    assert set(subset["node"].unique()) == {"OTA2201", "HAY2201", "ISL2201"}
    assert sorted(subset["trading_period"].unique().tolist()) == list(range(1, 49))
    assert subset["trading_period"].value_counts().eq(3).all()


def test_sha256_is_stable(tmp_path: Path) -> None:
    path = tmp_path / "sample.csv"
    path.write_text("a,b\n1,2\n", encoding="utf-8")
    assert sha256(path) == sha256(path)
    assert len(sha256(path)) == 64
