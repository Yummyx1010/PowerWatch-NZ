"""Command line entry point: python -m pipeline.cli <command>."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

from .build import build_history
from .config import HISTORY_END, HISTORY_START, SAMPLE_DOWNLOADS
from .download import describe_sample, download_samples
from .export import write_frontend_summary, write_price_sample
from .history import DEFAULT_MANIFEST, load_manifest, sync_sources
from .profile import profile_price_csv, read_price_csv

DEFAULT_RAW_DIR = Path("data/raw")
DEFAULT_SAMPLE_DIR = Path("data/samples")
DEFAULT_SUMMARY = Path("public/data/sample-summary.json")
DEFAULT_PROCESSED = Path("data/processed")
DEFAULT_PUBLIC_V1 = Path("public/data/v1")
DEFAULT_QUALITY = Path("data/quality-report.json")
DEFAULT_SOURCES_QUALITY = Path("data/quality-by-source.json")


def _download(args: argparse.Namespace) -> None:
    paths = download_samples(Path(args.output), overwrite=args.overwrite)
    for sample, path in zip(SAMPLE_DOWNLOADS, paths):
        info = describe_sample(sample, path)
        print(f"{sample.name}: {path.name} ({info['bytes']} bytes) sha256={info['sha256'][:12]}...")


def _profile(args: argparse.Namespace) -> None:
    result = profile_price_csv(Path(args.path))
    print(json.dumps(result, indent=2, ensure_ascii=False, default=str))


def _export(args: argparse.Namespace) -> None:
    frame = read_price_csv(Path(args.input))
    paths = write_price_sample(frame, Path(args.sample_dir))
    summary = write_frontend_summary(frame, Path(args.summary))
    print(f"sample csv: {paths['csv']}")
    print(f"sample parquet: {paths['parquet']}")
    print(f"summary: {args.summary}")
    print(json.dumps(summary, indent=2, ensure_ascii=False))


def _sync(args: argparse.Namespace) -> None:
    manifest = sync_sources(
        date.fromisoformat(args.start),
        date.fromisoformat(args.end),
        raw_dir=Path(args.raw_dir),
        manifest_path=Path(args.manifest),
        force=args.force,
    )
    coverage = manifest["coverage"]
    print(
        f"sources={len(manifest['sources'])} finalDays={coverage['finalDays']} "
        f"interimDays={coverage['interimDays']} gapDays={coverage['gapDays']}"
    )
    print(f"manifest: {args.manifest}")


def _build(args: argparse.Namespace) -> None:
    result = build_history(
        manifest_path=Path(args.manifest),
        raw_dir=Path(args.raw_dir),
        processed_dir=Path(args.processed_dir),
        public_dir=Path(args.public_dir),
        quality_path=Path(args.quality),
        sources_quality_path=Path(args.sources_quality),
        force=args.force,
    )
    print(
        f"processedSources={result['processedSources']} totalSources={result['totalSources']} "
        f"rows={result['aggregate']['totals']['rows']}"
    )
    print(f"public JSON: {args.public_dir}")


def _run(args: argparse.Namespace) -> None:
    sync_args = argparse.Namespace(
        start=args.start,
        end=args.end,
        raw_dir=args.raw_dir,
        manifest=args.manifest,
        force=args.force,
    )
    _sync(sync_args)
    build_args = argparse.Namespace(
        manifest=args.manifest,
        raw_dir=args.raw_dir,
        processed_dir=args.processed_dir,
        public_dir=args.public_dir,
        quality=args.quality,
        sources_quality=args.sources_quality,
        force=args.force,
    )
    _build(build_args)


def _status(args: argparse.Namespace) -> None:
    manifest = load_manifest(Path(args.manifest))
    payload = {
        "schemaVersion": manifest.get("schemaVersion"),
        "requestedStart": manifest.get("requestedStart"),
        "requestedEnd": manifest.get("requestedEnd"),
        "coverage": manifest.get("coverage", {}),
        "sources": [
            {
                "key": entry["key"],
                "status": entry["status"],
                "issue": entry.get("issue"),
                "processed": entry.get("processed", False),
            }
            for entry in manifest.get("sources", [])
        ],
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def _add_sync_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--start", default=HISTORY_START.isoformat())
    parser.add_argument("--end", default=HISTORY_END.isoformat())
    parser.add_argument("--raw-dir", default=str(DEFAULT_RAW_DIR))
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--force", action="store_true")


def _add_build_arguments(
    parser: argparse.ArgumentParser,
    *,
    include_common: bool = True,
) -> None:
    if include_common:
        parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
        parser.add_argument("--raw-dir", default=str(DEFAULT_RAW_DIR))
    parser.add_argument("--processed-dir", default=str(DEFAULT_PROCESSED))
    parser.add_argument("--public-dir", default=str(DEFAULT_PUBLIC_V1))
    parser.add_argument("--quality", default=str(DEFAULT_QUALITY))
    parser.add_argument("--sources-quality", default=str(DEFAULT_SOURCES_QUALITY))
    if include_common:
        parser.add_argument("--force", action="store_true")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NZ PowerWatch data pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    download_parser = subparsers.add_parser("download", help="Download the fixed real-data samples")
    download_parser.add_argument("--output", default=str(DEFAULT_RAW_DIR))
    download_parser.add_argument("--overwrite", action="store_true")
    download_parser.set_defaults(handler=_download)

    profile_parser = subparsers.add_parser("profile", help="Profile one official price CSV")
    profile_parser.add_argument("path")
    profile_parser.set_defaults(handler=_profile)

    export_parser = subparsers.add_parser("export", help="Write the M0 committed sample and JSON")
    export_parser.add_argument("--input", default=str(DEFAULT_RAW_DIR / "20261119_FinalEnergyPrices.csv"))
    export_parser.add_argument("--sample-dir", default=str(DEFAULT_SAMPLE_DIR))
    export_parser.add_argument("--summary", default=str(DEFAULT_SUMMARY))
    export_parser.set_defaults(handler=_export)

    sync_parser = subparsers.add_parser("sync", help="Incrementally discover and download history")
    _add_sync_arguments(sync_parser)
    sync_parser.set_defaults(handler=_sync)

    build_parser_command = subparsers.add_parser("build", help="Clean, validate and export history")
    _add_build_arguments(build_parser_command)
    build_parser_command.set_defaults(handler=_build)

    run_parser = subparsers.add_parser("run", help="Run sync then build")
    _add_sync_arguments(run_parser)
    _add_build_arguments(run_parser, include_common=False)
    run_parser.set_defaults(handler=_run)

    status_parser = subparsers.add_parser("status", help="Print manifest coverage and source status")
    status_parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    status_parser.set_defaults(handler=_status)

    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
