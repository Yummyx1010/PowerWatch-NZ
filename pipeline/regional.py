"""Compact all-node regional dataset for the Regions module."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pandas as pd

from .config import REPRESENTATIVE_COORDINATE_PROXIES, UNIQUE_REPRESENTATIVE_NODES
from .geo import nztm_to_latlon
from .nodes import MANUAL_NODE_OVERRIDES

CSV_COLUMNS = ["trading_date", "node", "price_nzd_per_mwh", "price_type", "price_status"]


def write_compact_json(path: Path, payload: dict[str, object]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )
    temporary.replace(path)


def load_coordinate_nodes(path: Path) -> dict[str, dict[str, object]]:
    """Load current POC nodes that have official NZTM coordinates."""
    result: dict[str, dict[str, object]] = {}
    with Path(path).open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("Current flag") != "1":
                continue
            code = (row.get("POC code") or "").strip()
            easting = (row.get("NZTM easting") or "").strip()
            northing = (row.get("NZTM northing") or "").strip()
            if not code or code in result or not easting or not northing:
                continue
            latitude, longitude = nztm_to_latlon(float(easting), float(northing))
            result[code] = {
                "label": (row.get("Description") or code).strip(),
                "region": (row.get("Network reporting region") or "Unmapped").strip(),
                "island": (row.get("Island") or "Unknown").strip(),
                "zone": (row.get("Zone") or "").strip(),
                "easting": float(easting),
                "northing": float(northing),
                "lat": latitude,
                "lon": longitude,
                "mappingStatus": "nsp_table",
            }
    return result


def _daily_frame(processed_dir: Path) -> pd.DataFrame:
    frames = [
        pd.read_parquet(path, columns=CSV_COLUMNS)
        for path in sorted(Path(processed_dir).glob("prices_*.parquet"))
    ]
    if not frames:
        return pd.DataFrame(columns=CSV_COLUMNS)
    frame = pd.concat(frames, ignore_index=True)
    return (
        frame.groupby(["trading_date", "node", "price_type"], as_index=False)
        .agg(
            mean=("price_nzd_per_mwh", "mean"),
            min=("price_nzd_per_mwh", "min"),
            max=("price_nzd_per_mwh", "max"),
            status=("price_status", "first"),
            rows=("price_nzd_per_mwh", "size"),
        )
        .sort_values(["trading_date", "node"])
    )


def _rounded(value, digits: int = 2):
    return None if pd.isna(value) else round(float(value), digits)


def _date_key(value) -> str:
    return pd.Timestamp(value).date().isoformat()


def build_regional_payload(
    processed_dir: Path,
    mapping_path: Path,
) -> dict[str, object]:
    """Build one compact payload with all priced nodes and daily means."""
    daily = _daily_frame(processed_dir)
    if daily.empty:
        raise ValueError("No processed price records found")

    dates = sorted({_date_key(value) for value in daily["trading_date"].unique()})
    codes = sorted(str(value) for value in daily["node"].unique())
    date_index = {value: index for index, value in enumerate(dates)}
    date_status = (
        daily.groupby("trading_date", sort=True)["price_type"]
        .first()
        .map(lambda value: "Interim" if value == "interim" else "Final")
        .tolist()
    )

    mean_pivot = daily.pivot_table(
        index="trading_date", columns="node", values="mean", aggfunc="first"
    ).reindex(index=[pd.Timestamp(date) for date in dates], columns=codes)
    min_pivot = daily.pivot_table(
        index="trading_date", columns="node", values="min", aggfunc="first"
    ).reindex(index=[pd.Timestamp(date) for date in dates], columns=codes)
    count_pivot = daily.pivot_table(
        index="trading_date", columns="node", values="rows", aggfunc="first"
    ).reindex(index=[pd.Timestamp(date) for date in dates], columns=codes)

    coordinates = load_coordinate_nodes(mapping_path)
    manual = MANUAL_NODE_OVERRIDES

    nodes: list[dict[str, object]] = []
    for code in codes:
        meta = coordinates.get(code)
        override = manual.get(code)
        coordinate_source = "official_nsp" if meta is not None else None
        coordinate_proxy = None
        if meta is None and code in REPRESENTATIVE_COORDINATE_PROXIES:
            proxy_code = REPRESENTATIVE_COORDINATE_PROXIES[code]
            proxy = coordinates.get(proxy_code)
            if proxy is not None:
                meta = {
                    "label": override["label"] if override else code,
                    "region": override["region"] if override else "Unmapped",
                    "island": override["island"] if override else "Unknown",
                    "zone": proxy["zone"],
                    "easting": proxy["easting"],
                    "northing": proxy["northing"],
                    "lat": proxy["lat"],
                    "lon": proxy["lon"],
                    "mappingStatus": "manual_override",
                }
                coordinate_source = "official_nsp_substation_proxy"
                coordinate_proxy = proxy_code
        if meta is None:
            meta = {
                "label": override["label"] if override else code,
                "region": override["region"] if override else "Unmapped",
                "island": override["island"] if override else "Unknown",
                "zone": "",
                "easting": None,
                "northing": None,
                "lat": None,
                "lon": None,
                "mappingStatus": "manual_override" if override else "unmatched",
            }
        means = [_rounded(value) for value in mean_pivot[code].tolist()]
        minimums = [_rounded(value) for value in min_pivot[code].tolist()]
        counts = [int(value) if not pd.isna(value) else 0 for value in count_pivot[code].tolist()]

        last_index = next(
            (index for index in range(len(means) - 1, -1, -1) if means[index] is not None),
            None,
        )
        recent = [value for value in means[-7:] if value is not None]
        window30 = [value for value in means[-30:] if value is not None]
        mins30 = [value for value in minimums[-30:] if value is not None]
        nodes.append(
            {
                "code": code,
                "label": str(meta["label"]),
                "region": str(meta["region"]),
                "island": str(meta["island"]),
                "zone": str(meta["zone"]),
                "lat": meta["lat"],
                "lon": meta["lon"],
                "easting": meta["easting"],
                "northing": meta["northing"],
                "mappingStatus": meta["mappingStatus"],
                "coordinateSource": coordinate_source,
                "coordinateProxyCode": coordinate_proxy,
                "hasMapPosition": meta["lat"] is not None and meta["lon"] is not None,
                "means": means,
                "latestIndex": last_index,
                "latest": means[last_index] if last_index is not None else None,
                "mean7d": _rounded(pd.Series(recent, dtype="float64").mean()) if recent else None,
                "volatility7d": _rounded(pd.Series(recent, dtype="float64").std(ddof=1)) if len(recent) > 1 else None,
                "min30d": _rounded(min(mins30)) if mins30 else None,
                "max30d": _rounded(max(window30)) if window30 else None,
                "negativeDays30d": sum(1 for value in mins30 if value < 0),
                "coverageDays": sum(1 for value in means if value is not None),
                "finalDays": sum(
                    1
                    for index, value in enumerate(means)
                    if value is not None and date_status[index] == "Final"
                ),
                "interimDays": sum(
                    1
                    for index, value in enumerate(means)
                    if value is not None and date_status[index] == "Interim"
                ),
                "observedPeriods": sum(counts),
            }
        )

    return {
        "schemaVersion": "1.0",
        "dateCount": len(dates),
        "dates": dates,
        "dateStatus": date_status,
        "nodeCount": len(nodes),
        "mappedNodeCount": sum(1 for node in nodes if node["hasMapPosition"]),
        "representativeNodes": [node.code for node in UNIQUE_REPRESENTATIVE_NODES],
        "nodes": nodes,
        "notes": {
            "means": "Daily mean nodal price in NZD/MWh; null means the node had no published price for that date.",
            "volatility7d": "Sample standard deviation of daily mean prices across the last 7 published dates.",
            "coordinates": "Latitude/longitude derived from official NZTM coordinates in the EA Network Supply Points table. Representative GXP codes use clearly labelled site-level proxies from the same named substation. Nodes without verified coordinates are not plotted on the map.",
            "status": "dateStatus is Final or Interim for each published trading day.",
        },
    }


def write_regional_payload(processed_dir: Path, mapping_path: Path, output_path: Path) -> dict[str, object]:
    payload = build_regional_payload(Path(processed_dir), Path(mapping_path))
    write_compact_json(Path(output_path), payload)
    return payload
