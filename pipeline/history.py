"""Manifest, coverage and incremental synchronisation for historical data."""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import requests

from .download import DownloadResult, fetch_file
from .sources import SourceSpec, coverage_gaps, discover_sources

MANIFEST_VERSION = "1.0"
DEFAULT_MANIFEST = Path("data/manifest.json")


def _write_json(path: Path, payload: dict[str, object]) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def load_manifest(path: Path) -> dict[str, object]:
    path = Path(path)
    if not path.exists():
        return {"schemaVersion": MANIFEST_VERSION, "sources": []}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schemaVersion") != MANIFEST_VERSION:
        raise ValueError(f"Unsupported manifest version at {path}")
    return payload


def spec_from_entry(entry: dict[str, object]) -> SourceSpec:
    return SourceSpec(
        key=str(entry["key"]),
        kind=str(entry["kind"]),
        coverage_start=date.fromisoformat(str(entry["coverageStart"])),
        coverage_end=date.fromisoformat(str(entry["coverageEnd"])),
        url=str(entry.get("url") or ""),
        filename=str(entry.get("filename") or ""),
        price_status=str(entry.get("priceStatus") or ""),
        issue=entry.get("issue"),
        note=entry.get("note"),
    )


def entry_from_spec(spec: SourceSpec) -> dict[str, object]:
    return {
        "key": spec.key,
        "kind": spec.kind,
        "coverageStart": spec.coverage_start.isoformat(),
        "coverageEnd": spec.coverage_end.isoformat(),
        "url": spec.url,
        "filename": spec.filename,
        "priceStatus": spec.price_status,
        "issue": spec.issue,
        "note": spec.note,
        "status": "unavailable",
        "bytes": 0,
        "sha256": "",
        "lastModified": None,
        "etag": None,
        "processed": False,
        "processedSha256": "",
        "outputs": [],
    }


def coverage_summary(
    manifest: dict[str, object],
    start: date,
    end: date,
) -> dict[str, object]:
    entries = [dict(entry) for entry in manifest.get("sources", [])]
    specs = [spec_from_entry(entry) for entry in entries]
    gaps = coverage_gaps(specs, start, end)

    covered_final: set[date] = set()
    covered_interim: set[date] = set()
    for entry in entries:
        if entry["status"] not in {"ok", "interim"}:
            continue
        target = covered_interim if entry["status"] == "interim" else covered_final
        day = date.fromisoformat(str(entry["coverageStart"]))
        last = date.fromisoformat(str(entry["coverageEnd"]))
        while day <= last:
            target.add(day)
            day += timedelta(days=1)

    final_dates = sorted(covered_final)
    interim_dates = sorted(covered_interim)
    return {
        "requestedStart": start.isoformat(),
        "requestedEnd": end.isoformat(),
        "firstFinalDate": final_dates[0].isoformat() if final_dates else None,
        "lastFinalDate": final_dates[-1].isoformat() if final_dates else None,
        "lastInterimDate": interim_dates[-1].isoformat() if interim_dates else None,
        "finalDays": len(final_dates),
        "interimDays": len(interim_dates),
        "gapDays": sum((last - first).days + 1 for first, last in gaps),
        "gaps": [{"start": first.isoformat(), "end": last.isoformat()} for first, last in gaps],
    }


def sync_sources(
    start: date,
    end: date,
    *,
    raw_dir: Path,
    manifest_path: Path,
    probe=requests.head,
    force: bool = False,
) -> dict[str, object]:
    """Discover, download and record sources; reuse unchanged local files."""
    existing = load_manifest(manifest_path)
    previous = {str(entry["key"]): dict(entry) for entry in existing.get("sources", [])}
    specs = discover_sources(start, end, probe=probe)
    entries: list[dict[str, object]] = []

    for spec in specs:
        entry = entry_from_spec(spec)
        old = previous.get(spec.key, {})
        if spec.issue or not spec.url:
            entry["status"] = spec.issue or "missing"
            entries.append(entry)
            continue

        result: DownloadResult = fetch_file(
            spec.url,
            Path(raw_dir) / spec.filename,
            expected_sha256=str(old.get("sha256") or "") or None,
            overwrite=force,
        )
        entry.update(
            {
                "status": "interim" if spec.price_status == "Interim" else "ok",
                "bytes": result.bytes,
                "sha256": result.sha256,
                "lastModified": result.last_modified,
                "etag": result.etag,
            }
        )
        if old.get("sha256") and old["sha256"] != result.sha256:
            entry["revisedFrom"] = old["sha256"]
            entry["processed"] = False
            entry["processedSha256"] = ""
        elif result.reused:
            entry["lastModified"] = old.get("lastModified")
            entry["etag"] = old.get("etag")
            if old.get("processedSha256") == result.sha256:
                entry["processed"] = bool(old.get("processed", False))
                entry["processedSha256"] = str(old.get("processedSha256") or "")
                entry["outputs"] = old.get("outputs", [])
        entries.append(entry)

    manifest: dict[str, object] = {
        "schemaVersion": MANIFEST_VERSION,
        "requestedStart": start.isoformat(),
        "requestedEnd": end.isoformat(),
        "sources": entries,
        "coverage": coverage_summary({"sources": entries}, start, end),
    }
    _write_json(manifest_path, manifest)
    return manifest


def mark_processed(
    manifest_path: Path,
    key: str,
    *,
    outputs: list[str],
    source_sha256: str,
) -> dict[str, object]:
    manifest = load_manifest(manifest_path)
    for entry in manifest.get("sources", []):
        if entry["key"] == key:
            entry["processed"] = True
            entry["processedSha256"] = source_sha256
            entry["outputs"] = outputs
    manifest["coverage"] = coverage_summary(
        manifest,
        date.fromisoformat(str(manifest.get("requestedStart", "2023-11-01"))),
        date.fromisoformat(str(manifest.get("requestedEnd", "2026-11-22"))),
    )
    _write_json(manifest_path, manifest)
    return manifest


def write_json(path: Path, payload: dict[str, object]) -> None:
    _write_json(path, payload)
