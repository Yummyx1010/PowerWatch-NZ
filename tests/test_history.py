import json
from datetime import date
from pathlib import Path

from pipeline.download import sha256
from pipeline.history import coverage_summary, entry_from_spec, load_manifest, spec_from_entry, write_json
from pipeline.sources import SourceSpec

ROOT = Path(__file__).resolve().parents[1]


def test_source_entry_roundtrip_keeps_informational_note() -> None:
    spec = SourceSpec(
        key="daily:20261122",
        kind="daily_interim",
        coverage_start=date(2026, 11, 22),
        coverage_end=date(2026, 11, 22),
        url="https://example.invalid/interim.csv",
        filename="interim.csv",
        price_status="Interim",
        note="interim_prices",
    )
    entry = entry_from_spec(spec)
    entry["status"] = "interim"
    assert spec_from_entry(entry) == spec


def test_coverage_summary_handles_final_interim_and_gaps() -> None:
    final = SourceSpec("m:202511", "monthly_final", date(2025, 11, 1), date(2025, 11, 30), "", "a", "Final")
    incomplete = SourceSpec(
        "m:202512",
        "monthly_final",
        date(2025, 12, 1),
        date(2025, 12, 31),
        "",
        "b",
        "Final",
        issue="incomplete_monthly_file",
    )
    interim = SourceSpec("d:20260101", "daily_interim", date(2026, 1, 1), date(2026, 1, 1), "", "c", "Interim")
    entries = []
    for spec in (final, incomplete, interim):
        entry = entry_from_spec(spec)
        entry["status"] = "interim" if spec.price_status == "Interim" else (
            spec.issue or "ok"
        )
        entries.append(entry)
    summary = coverage_summary({"sources": entries}, date(2025, 11, 1), date(2026, 1, 1))
    assert summary["finalDays"] == 30
    assert summary["interimDays"] == 1
    assert summary["gapDays"] == 31
    assert summary["lastInterimDate"] == "2026-01-01"


def test_write_json_is_deterministic(tmp_path: Path) -> None:
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"
    payload = {"z": 1, "a": [2, 3]}
    write_json(first, payload)
    write_json(second, payload)
    assert sha256(first) == sha256(second)


def test_committed_manifest_documents_real_three_year_coverage() -> None:
    manifest = load_manifest(ROOT / "data" / "manifest.json")
    coverage = manifest["coverage"]
    assert coverage["firstFinalDate"] == "2023-11-01"
    assert coverage["lastFinalDate"] == "2026-11-19"
    assert coverage["lastInterimDate"] == "2026-11-22"
    assert coverage["finalDays"] >= 1080
    assert coverage["gaps"] == [{"start": "2025-12-01", "end": "2025-12-31"}]
    assert all(
        entry["processed"] for entry in manifest["sources"] if entry["status"] in {"ok", "interim"}
    )


def test_versioned_frontend_json_is_committed() -> None:
    public = ROOT / "public" / "data" / "v1"
    for name in ("manifest.json", "coverage.json", "quality.json", "price-summary.json"):
        payload = json.loads((public / name).read_text(encoding="utf-8"))
        assert payload
