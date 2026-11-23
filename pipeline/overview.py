"""Compact, real-data payload for the Market Overview page."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from .config import UNIQUE_REPRESENTATIVE_NODES
from .history import write_json

NODES = [node.code for node in UNIQUE_REPRESENTATIVE_NODES]
NODE_LABELS = {node.code: node.label for node in UNIQUE_REPRESENTATIVE_NODES}

DAILY_COLUMNS = [
    "trading_date",
    "node",
    "price_nzd_per_mwh",
    "price_type",
    "price_status",
]
RECENT_COLUMNS = [
    "trading_date",
    "trading_period",
    "period_start_local",
    "period_start_utc",
    "node",
    "price_nzd_per_mwh",
    "price_status",
    "price_type",
]

DEFINITIONS = {
    "volatility": "Sample standard deviation of half-hourly nodal prices within the last 7 calendar days ($/MWh).",
    "regionalSpread": "Difference between the highest and lowest representative-node daily mean prices on the latest available trading day. Nodal prices, not city-wide averages.",
    "largestMove": "Largest absolute change in daily mean price between consecutive published days for the same node within the last 7 days.",
    "notable": "Latest daily mean is at least 1.5x or at most 0.5x of that node's median daily mean over the last 30 published days. A flag, not an anomaly conclusion.",
    "status": "Final prices are declared after the pricing-error window. Interim prices are provisional and may change.",
}


def _read_filtered(paths: list[Path], columns: list[str]) -> pd.DataFrame:
    frames = []
    for path in paths:
        if not path.exists():
            continue
        frames.append(
            pd.read_parquet(
                path,
                columns=columns,
                filters=[("node", "in", NODES)],
            )
        )
    if not frames:
        return pd.DataFrame(columns=columns)
    return pd.concat(frames, ignore_index=True)


def _daily_frame(processed_dir: Path) -> pd.DataFrame:
    paths = sorted(Path(processed_dir).glob("prices_*.parquet"))
    frame = _read_filtered(paths, DAILY_COLUMNS)
    if frame.empty:
        return frame
    grouped = (
        frame.groupby(["trading_date", "node", "price_type"], as_index=False)
        .agg(
            mean=("price_nzd_per_mwh", "mean"),
            min=("price_nzd_per_mwh", "min"),
            max=("price_nzd_per_mwh", "max"),
            periods=("price_nzd_per_mwh", "size"),
            status=("price_status", "first"),
        )
        .sort_values(["trading_date", "node"])
    )
    return grouped


def _recent_frame(processed_dir: Path, latest: date, days: int = 10) -> pd.DataFrame:
    start = latest - timedelta(days=days - 1)
    paths = [
        Path(processed_dir) / "prices_202611_final.parquet",
        Path(processed_dir) / "prices_202611_interim.parquet",
    ]
    frame = _read_filtered(paths, RECENT_COLUMNS)
    if frame.empty:
        return frame
    frame = frame[frame["trading_date"] >= start].sort_values(
        ["trading_date", "trading_period", "node"]
    )
    return frame


def _round(value, digits: int = 2):
    return None if pd.isna(value) else round(float(value), digits)


def build_overview_payload(processed_dir: Path) -> dict[str, object]:
    """Build the market-summary JSON from processed real price files."""
    daily = _daily_frame(processed_dir)
    if daily.empty:
        raise ValueError("No processed representative-node prices found")
    latest = max(daily["trading_date"])
    recent = _recent_frame(processed_dir, latest)

    daily_rows = [
        {
            "date": str(row.trading_date),
            "node": row.node,
            "label": NODE_LABELS[row.node],
            "mean": _round(row.mean),
            "min": _round(row.min),
            "max": _round(row.max),
            "periods": int(row.periods),
            "status": row.status,
            "type": row.price_type,
        }
        for row in daily.itertuples(index=False)
    ]

    recent_rows: list[dict[str, object]] = []
    for row in recent.itertuples(index=False):
        utc = pd.Timestamp(row.period_start_utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        recent_rows.append(
            {
                "date": str(row.trading_date),
                "period": int(row.trading_period),
                "local": row.period_start_local,
                "utc": utc,
                "node": row.node,
                "label": NODE_LABELS[row.node],
                "price": _round(row.price_nzd_per_mwh),
                "status": row.price_status,
                "type": row.price_type,
            }
        )

    latest_final = max(
        row["date"] for row in daily_rows if row["type"] == "final"
    )
    last_timestamp = (
        (recent_rows[-1]["date"], recent_rows[-1]["period"]) if recent_rows else None
    )
    latest_prices = (
        [
            {
                "node": row["node"],
                "label": row["label"],
                "price": row["price"],
                "status": row["status"],
                "local": row["local"],
            }
            for row in recent_rows
            if last_timestamp and (row["date"], row["period"]) == last_timestamp
        ]
        if last_timestamp
        else []
    )

    latest_daily = [row for row in daily_rows if row["date"] == str(latest)]
    spread_high = max(
        latest_daily,
        key=lambda row: row["mean"] if row["mean"] is not None else float("-inf"),
    )
    spread_low = min(
        latest_daily,
        key=lambda row: row["mean"] if row["mean"] is not None else float("inf"),
    )

    start_7 = latest - timedelta(days=6)
    recent_7 = [row for row in recent_rows if date.fromisoformat(row["date"]) >= start_7]
    volatility: dict[str, float | None] = {}
    for node in NODES:
        values = [row["price"] for row in recent_7 if row["node"] == node and row["price"] is not None]
        volatility[node] = _round(pd.Series(values, dtype="float64").std(ddof=1)) if len(values) > 1 else None

    daily_7 = [row for row in daily_rows if date.fromisoformat(row["date"]) >= start_7]
    moves: list[dict[str, object]] = []
    for node in NODES:
        rows = sorted([row for row in daily_7 if row["node"] == node], key=lambda row: row["date"])
        for previous, current in zip(rows, rows[1:]):
            moves.append(
                {
                    "node": node,
                    "label": NODE_LABELS[node],
                    "date": current["date"],
                    "from": previous["mean"],
                    "to": current["mean"],
                    "change": _round((current["mean"] or 0) - (previous["mean"] or 0)),
                }
            )
    largest_move = max(moves, key=lambda row: abs(row["change"] or 0)) if moves else None

    start_30 = latest - timedelta(days=29)
    notable: list[dict[str, object]] = []
    for node in NODES:
        window = [
            row["mean"]
            for row in daily_rows
            if row["node"] == node
            and date.fromisoformat(row["date"]) >= start_30
            and row["mean"] is not None
        ]
        if not window:
            continue
        median = float(pd.Series(window, dtype="float64").median())
        current = next((row["mean"] for row in latest_daily if row["node"] == node), None)
        if current is None or median == 0:
            continue
        ratio = current / median
        if ratio >= 1.5 or ratio <= 0.5:
            notable.append(
                {
                    "node": node,
                    "label": NODE_LABELS[node],
                    "mean": current,
                    "median30d": _round(median),
                    "ratio": _round(ratio),
                    "direction": "above" if ratio > 1 else "below",
                }
            )

    return {
        "schemaVersion": "1.0",
        "generatedFor": str(latest),
        "nodes": [{"code": code, "label": NODE_LABELS[code]} for code in NODES],
        "recent": recent_rows,
        "daily": daily_rows,
        "metrics": {
            "latestDate": str(latest),
            "latestFinalDate": str(latest_final),
            "latestPrices": latest_prices,
            "latestDaily": latest_daily,
            "regionalSpread": {
                "date": str(latest),
                "highNode": spread_high["node"],
                "highLabel": spread_high["label"],
                "high": spread_high["mean"],
                "lowNode": spread_low["node"],
                "lowLabel": spread_low["label"],
                "low": spread_low["mean"],
                "difference": _round((spread_high["mean"] or 0) - (spread_low["mean"] or 0)),
                "status": spread_high["status"],
            },
            "volatility7d": volatility,
            "largestMove": largest_move,
            "negativeRecentPrices": sum(
                1 for row in recent_rows if row["price"] is not None and row["price"] < 0
            ),
            "notable": notable,
        },
        "definitions": DEFINITIONS,
    }


def write_overview_payload(processed_dir: Path, public_dir: Path) -> dict[str, object]:
    payload = build_overview_payload(processed_dir)
    write_json(Path(public_dir) / "overview.json", payload)
    return payload
