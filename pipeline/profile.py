"""Normalise and profile official wholesale price CSV files."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from .config import PRICE_COLUMNS, REPORT_COLUMNS

CANONICAL_COLUMNS = [
    "trading_date",
    "trading_period",
    "node",
    "price_nzd_per_mwh",
    "price_status",
]


def _find_report_header(path: Path) -> int | None:
    """Return the preamble line index of a single-node report, if present."""
    with Path(path).open("r", encoding="utf-8-sig", errors="replace") as handle:
        for index, line in enumerate(handle):
            if line.strip().startswith("Point of connection,"):
                return index
    return None


def read_price_csv(path: Path, *, include_raw: bool = False) -> pd.DataFrame:
    """Read either official price format into one canonical schema.

    Supports the daily all-node export (no preamble) and the single-node
    report (title/parameter preamble followed by a different header).
    """
    path = Path(path)
    header = _find_report_header(path)
    raw_price_column = "$/MWh" if header is not None else "DollarsPerMegawattHour"
    if header is not None:
        raw = pd.read_csv(path, skiprows=header, dtype=str)
    else:
        raw = pd.read_csv(path, dtype=str)
    raw_price = raw.get(raw_price_column)
    raw = raw.rename(columns=REPORT_COLUMNS if header is not None else PRICE_COLUMNS)

    missing = set(PRICE_COLUMNS.values()) - set(raw.columns)
    if missing:
        raise ValueError(f"Missing expected columns in {path.name}: {sorted(missing)}")

    frame = raw[list(PRICE_COLUMNS.values())].copy()
    date_format = "%d/%m/%Y" if header is not None else "%Y-%m-%d"
    frame["trading_date"] = pd.to_datetime(
        frame["trading_date"], format=date_format, errors="coerce"
    ).dt.date
    frame["trading_period"] = pd.to_numeric(frame["trading_period"], errors="coerce").astype("Int64")
    frame["node"] = frame["node"].astype("string").str.strip()
    frame["price_nzd_per_mwh"] = pd.to_numeric(frame["price_nzd_per_mwh"], errors="coerce")
    if header is not None:
        status = raw.get("price_status")
        frame["price_status"] = status.astype("string").str.strip() if status is not None else pd.NA
    else:
        frame["price_status"] = pd.NA
    columns = CANONICAL_COLUMNS + (["raw_price"] if include_raw else [])
    if include_raw:
        frame["raw_price"] = raw_price.astype("string") if raw_price is not None else pd.NA
    return frame[columns]


def profile_price_frame(frame: pd.DataFrame) -> dict[str, object]:
    """Return deterministic quality metrics for a canonical price frame."""
    key_columns = ["trading_date", "trading_period", "node"]
    price = frame["price_nzd_per_mwh"]
    valid = price.dropna()
    return {
        "rows": int(len(frame)),
        "columns": list(frame.columns),
        "dates": sorted(str(value) for value in frame["trading_date"].dropna().unique()),
        "node_count": int(frame["node"].nunique(dropna=True)),
        "period_min": int(frame["trading_period"].min()),
        "period_max": int(frame["trading_period"].max()),
        "duplicate_keys": int(frame.duplicated(subset=key_columns).sum()),
        "missing_by_column": {
            column: int(frame[column].isna().sum()) for column in frame.columns
        },
        "price_min": float(valid.min()) if not valid.empty else None,
        "price_max": float(valid.max()) if not valid.empty else None,
        "price_mean": round(float(valid.mean()), 4) if not valid.empty else None,
        "negative_prices": int((valid < 0).sum()),
        "zero_prices": int((valid == 0).sum()),
        "price_status_values": sorted(
            str(value) for value in frame["price_status"].dropna().unique()
        ),
    }


def profile_price_csv(path: Path) -> dict[str, object]:
    return profile_price_frame(read_price_csv(path))
