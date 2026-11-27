from pathlib import Path

import pandas as pd
import pytest

from pipeline.geo import nztm_to_latlon
from pipeline.regional import build_regional_payload


def test_nztm_conversion_uses_epsg2193_parameters() -> None:
    latitude, longitude = nztm_to_latlon(1_762_702, 5_907_696)
    assert latitude == pytest.approx(-36.96, abs=0.02)
    assert longitude == pytest.approx(174.83, abs=0.02)


def test_regional_payload_is_compact_and_preserves_status(tmp_path: Path) -> None:
    frame = pd.DataFrame(
        [
            {"trading_date": pd.Timestamp("2026-11-21"), "node": "AAA0001", "price_nzd_per_mwh": 50.0, "price_type": "final", "price_status": "Final"},
            {"trading_date": pd.Timestamp("2026-11-21"), "node": "BBB0001", "price_nzd_per_mwh": -5.0, "price_type": "final", "price_status": "Final"},
            {"trading_date": pd.Timestamp("2026-11-22"), "node": "AAA0001", "price_nzd_per_mwh": 70.0, "price_type": "interim", "price_status": "Interim"},
            {"trading_date": pd.Timestamp("2026-11-22"), "node": "BBB0001", "price_nzd_per_mwh": 40.0, "price_type": "interim", "price_status": "Interim"},
        ]
    )
    frame.to_parquet(tmp_path / "prices_202611_final.parquet", index=False)

    mapping = tmp_path / "mapping.csv"
    mapping.write_text(
        "Current flag,POC code,Description,Network reporting region,Island,Zone,NZTM easting,NZTM northing\n"
        "1,AAA0001,Alpha Node,Test North,NI,TEST,1762702,5907696\n"
        "1,BBB0001,Beta Node,Test South,SI,TEST,1567878,5179257\n",
        encoding="utf-8",
    )

    payload = build_regional_payload(tmp_path, mapping)
    assert payload["nodeCount"] == 2
    assert payload["mappedNodeCount"] == 2
    assert payload["dates"] == ["2026-11-21", "2026-11-22"]
    assert payload["dateStatus"] == ["Final", "Interim"]
    nodes = {node["code"]: node for node in payload["nodes"]}
    assert nodes["AAA0001"]["means"] == [50.0, 70.0]
    assert nodes["AAA0001"]["latest"] == 70.0
    assert nodes["AAA0001"]["lat"] == pytest.approx(-36.96, abs=0.02)
    assert nodes["BBB0001"]["min30d"] == -5.0
    assert nodes["BBB0001"]["negativeDays30d"] == 1
    assert nodes["AAA0001"]["interimDays"] == 1
