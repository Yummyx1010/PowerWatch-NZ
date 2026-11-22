"""Build standardised datasets, quality reports and compact frontend JSON."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pandas as pd

from .clean import clean_source
from .config import NSP_TABLE_BLOB, UNIQUE_REPRESENTATIVE_NODES
from .download import fetch_file
from .history import coverage_summary, load_manifest, mark_processed, spec_from_entry, write_json
from .nodes import load_node_mapping
from .quality import aggregate_quality, validate_source

DEFAULT_MANIFEST = Path("data/manifest.json")
DEFAULT_RAW = Path("data/raw")
DEFAULT_PROCESSED = Path("data/processed")
DEFAULT_PUBLIC = Path("public/data/v1")
DEFAULT_QUALITY = Path("data/quality-report.json")
DEFAULT_SOURCES_QUALITY = Path("data/quality-by-source.json")


def ensure_node_mapping(raw_dir: Path) -> Path:
    """Fetch the pinned NSP snapshot if it is not already cached locally."""
    filename = "20261121_NetworkSupplyPointsTable.csv"
    destination = Path(raw_dir) / filename
    if not destination.exists():
        url = NSP_TABLE_BLOB.format(date=date(2026, 11, 21))
        fetch_file(url, destination)
    return destination


def build_history(
    *,
    manifest_path: Path = DEFAULT_MANIFEST,
    raw_dir: Path = DEFAULT_RAW,
    processed_dir: Path = DEFAULT_PROCESSED,
    public_dir: Path = DEFAULT_PUBLIC,
    quality_path: Path = DEFAULT_QUALITY,
    sources_quality_path: Path = DEFAULT_SOURCES_QUALITY,
    force: bool = False,
) -> dict[str, object]:
    """Process every new or revised source, then export deterministic artefacts."""
    manifest = load_manifest(manifest_path)
    mapping = load_node_mapping(ensure_node_mapping(raw_dir))
    Path(processed_dir).mkdir(parents=True, exist_ok=True)

    quality_by_source: dict[str, dict[str, object]] = {}
    if sources_quality_path.exists() and not force:
        quality_by_source = json.loads(sources_quality_path.read_text(encoding="utf-8"))

    processed_payloads: list[dict[str, object]] = []
    for entry in manifest.get("sources", []):
        if entry["status"] not in {"ok", "interim"}:
            continue
        key = str(entry["key"])
        current_sha = str(entry["sha256"])
        outputs = [str(path) for path in entry.get("outputs", [])]
        needs_build = (
            force
            or not entry.get("processed")
            or entry.get("processedSha256") != current_sha
            or any(not Path(path).exists() for path in outputs)
        )
        if not needs_build:
            continue

        spec = spec_from_entry(entry)
        path = Path(raw_dir) / spec.filename
        frame = clean_source(path, spec, mapping)
        quality = validate_source(frame, spec)
        quality_by_source[key] = quality

        month = str(entry["coverageStart"])[:7].replace("-", "")
        status = "interim" if entry["status"] == "interim" else "final"
        base = f"prices_{month}_{status}"
        parquet_path = Path(processed_dir) / f"{base}.parquet"
        csv_path = Path(processed_dir) / f"{base}.csv.gz"
        frame.to_parquet(parquet_path, index=False)
        frame.to_csv(csv_path, index=False, compression="gzip")

        outputs = [str(parquet_path).replace("\\", "/"), str(csv_path).replace("\\", "/")]
        mark_processed(
            manifest_path,
            key,
            outputs=outputs,
            source_sha256=current_sha,
        )
        entry_for_payload = next(
            item for item in load_manifest(manifest_path)["sources"] if item["key"] == key
        )
        processed_payloads.append({"entry": entry_for_payload, "quality": quality})

    manifest = load_manifest(manifest_path)
    reports = [
        quality_by_source[str(entry["key"])]
        for entry in manifest["sources"]
        if str(entry["key"]) in quality_by_source
    ]
    aggregate = aggregate_quality(reports)
    write_json(quality_path, aggregate)
    write_json(sources_quality_path, quality_by_source)

    start = date.fromisoformat(str(manifest.get("requestedStart", "2023-11-01")))
    end = date.fromisoformat(str(manifest.get("requestedEnd", "2026-11-22")))
    coverage = coverage_summary(manifest, start, end)

    coverage_rows: list[dict[str, object]] = []
    for entry in manifest["sources"]:
        if entry["status"] not in {"ok", "interim"}:
            continue
        key = str(entry["key"])
        quality = quality_by_source.get(key, {})
        coverage_rows.append(
            {
                "key": key,
                "kind": entry["kind"],
                "status": entry["status"],
                "start": entry["coverageStart"],
                "end": entry["coverageEnd"],
                "rows": quality.get("rows", 0),
                "priceStatus": entry["priceStatus"],
            }
        )

    node_summary = representative_node_summary(processed_dir)

    write_json(
        public_dir / "manifest.json",
        {
            "schemaVersion": "1.0",
            "dataVersion": "2026-11-23",
            "sourceCount": len(manifest.get("sources", [])),
            "coverage": coverage,
        },
    )
    write_json(public_dir / "coverage.json", {"months": coverage_rows})
    write_json(public_dir / "quality.json", aggregate)
    write_json(public_dir / "price-summary.json", node_summary)

    return {
        "processedSources": len(processed_payloads),
        "totalSources": len(manifest.get("sources", [])),
        "coverage": coverage,
        "aggregate": aggregate,
    }


def representative_node_summary(processed_dir: Path) -> dict[str, object]:
    wanted = {node.code for node in UNIQUE_REPRESENTATIVE_NODES}
    rows: list[dict[str, object]] = []
    parquet_files = sorted(Path(processed_dir).glob("prices_*.parquet"))
    for path in parquet_files:
        frame = pd.read_parquet(path, columns=["trading_date", "node", "price_nzd_per_mwh", "price_type"])
        subset = frame[frame["node"].isin(wanted)]
        if subset.empty:
            continue
        grouped = subset.assign(month=subset["trading_date"].astype(str).str.slice(0, 7))
        means = grouped.groupby(["month", "node", "price_type"])["price_nzd_per_mwh"].mean()
        for (month, node, price_type), value in means.items():
            rows.append(
                {
                    "month": month,
                    "node": node,
                    "priceType": price_type,
                    "meanPrice": round(float(value), 2),
                }
            )
    return {"nodes": [node.code for node in UNIQUE_REPRESENTATIVE_NODES], "points": rows}
