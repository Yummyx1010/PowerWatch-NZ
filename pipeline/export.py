"""Create the small, committed sample and the frontend summary JSON."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from .config import ATTRIBUTION, LICENCE, UNIQUE_REPRESENTATIVE_NODES
from .profile import profile_price_frame


def sample_price_rows(frame: pd.DataFrame) -> pd.DataFrame:
    """Keep the representative nodes, sorted by time then node."""
    nodes = [node.code for node in UNIQUE_REPRESENTATIVE_NODES]
    subset = frame[frame["node"].isin(nodes)].copy()
    return subset.sort_values(["trading_date", "trading_period", "node"]).reset_index(drop=True)


def write_price_sample(frame: pd.DataFrame, output_dir: Path) -> dict[str, Path]:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    subset = sample_price_rows(frame)
    csv_path = output_dir / "final_prices_sample.csv"
    parquet_path = output_dir / "final_prices_sample.parquet"
    subset.to_csv(csv_path, index=False)
    subset.to_parquet(parquet_path, index=False)
    return {"csv": csv_path, "parquet": parquet_path}


def write_frontend_summary(frame: pd.DataFrame, output_path: Path) -> dict[str, object]:
    """Write a tiny deterministic JSON payload consumed by the React app."""
    profile = profile_price_frame(frame)
    subset = sample_price_rows(frame)
    anchor = subset[subset["node"] == "OTA2201"].sort_values("trading_period")
    series = anchor.iloc[::2]
    summary: dict[str, object] = {
        "sampleDate": profile["dates"][0] if profile["dates"] else None,
        "source": "Electricity Authority (New Zealand)",
        "attribution": ATTRIBUTION,
        "licence": LICENCE,
        "rows": int(len(subset)),
        "nodes": [
            {"code": node.code, "label": node.label, "area": node.area, "island": node.island}
            for node in UNIQUE_REPRESENTATIVE_NODES
        ],
        "priceMinNzdPerMwh": float(subset["price_nzd_per_mwh"].min()),
        "priceMaxNzdPerMwh": float(subset["price_nzd_per_mwh"].max()),
        "periodsPerDay": int(
            subset.groupby("trading_date")["trading_period"].nunique().max()
        ),
        "series": [
            {
                "period": int(row.trading_period),
                "price": float(row.price_nzd_per_mwh),
            }
            for row in series.itertuples()
        ],
    }
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return summary
