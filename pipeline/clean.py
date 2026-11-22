"""Standardise source files into the M1 canonical wholesale price schema."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .nodes import NodeMeta, annotate_nodes
from .profile import read_price_csv
from .sources import SourceSpec
from .timeutil import dst_end, dst_start, is_dst_day, period_count

CANONICAL_COLUMNS = [
    "trading_date",
    "trading_period",
    "expected_periods",
    "period_start_local",
    "period_start_utc",
    "utc_offset_hours",
    "time_tag",
    "node",
    "node_label",
    "region",
    "island",
    "mapping_status",
    "price_nzd_per_mwh",
    "raw_price",
    "price_status",
    "price_type",
    "source_kind",
    "source_file",
    "source_url",
]


def add_time_columns(frame: pd.DataFrame) -> pd.DataFrame:
    """Vectorised, DST-exact mapping from trading period to UTC and local time."""
    result = frame.copy()
    dates = result["trading_date"]
    periods = result["trading_period"].astype("int64")

    def day_flag(fn):
        return dates.map(fn).astype(bool).to_numpy()

    expected = dates.map(period_count).astype("int64")
    is_dst = day_flag(is_dst_day)
    is_start = day_flag(lambda day: day == dst_start(day.year))
    is_end = day_flag(lambda day: day == dst_end(day.year))

    second_pass = is_end & periods.between(7, 8).to_numpy()
    after_gap = is_start & (periods >= 5).to_numpy()
    after_repeat = is_end & (periods >= 9).to_numpy()

    base_hours = np.where(is_start, 12, np.where(is_end, 13, np.where(is_dst, 13, 12)))
    base_hours = np.where(second_pass, 10, base_hours)
    step = np.where(second_pass, periods - 7, periods - 1).astype("int64")

    day_dt = pd.to_datetime(dates)
    utc = day_dt - pd.to_timedelta(base_hours, unit="h") + pd.to_timedelta(step * 30, unit="m")
    local = day_dt + pd.to_timedelta((periods - 1) * 30, unit="m")
    local = local + pd.to_timedelta(after_gap.astype("int64"), unit="h")
    local = local - pd.to_timedelta((second_pass | after_repeat).astype("int64"), unit="h")

    offset = np.where(
        is_start,
        np.where(after_gap, 13, 12),
        np.where(is_end, np.where(second_pass | after_repeat, 12, 13), np.where(is_dst, 13, 12)),
    )

    tags = np.where(
        is_start,
        np.where(after_gap, "dst_start_after_gap", "dst_start_before_gap"),
        np.where(
            is_end,
            np.where(
                second_pass,
                "dst_end_second_pass",
                np.where(after_repeat, "dst_end_after_repeat", "dst_end_first_pass"),
            ),
            np.where(is_dst, "normal_nzdt", "normal_nzst"),
        ),
    )

    result["expected_periods"] = expected
    result["period_start_utc"] = utc
    result["period_start_local"] = local.dt.strftime("%Y-%m-%d %H:%M")
    result["utc_offset_hours"] = offset
    result["time_tag"] = tags
    return result


def clean_source(
    path: Path,
    source: SourceSpec,
    node_mapping: dict[str, NodeMeta],
) -> pd.DataFrame:
    """Load one source file, preserve originals and apply M1 standardisation."""
    frame = read_price_csv(path, include_raw=True)
    frame["price_status"] = frame["price_status"].fillna(source.price_status)
    frame["price_type"] = frame["price_status"].str.lower()

    result = annotate_nodes(frame, node_mapping)
    result = add_time_columns(result)
    result["source_kind"] = source.kind
    result["source_file"] = source.filename or Path(path).name
    result["source_url"] = source.url
    return result[CANONICAL_COLUMNS]
