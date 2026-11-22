"""Command line entry point: python -m pipeline.cli <command>."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .config import SAMPLE_DOWNLOADS
from .download import describe_sample, download_samples
from .export import write_frontend_summary, write_price_sample
from .profile import profile_price_csv, read_price_csv

DEFAULT_RAW_DIR = Path("data/raw")
DEFAULT_SAMPLE_DIR = Path("data/samples")
DEFAULT_SUMMARY = Path("public/data/sample-summary.json")


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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="NZ PowerWatch data pipeline (M0)")
    subparsers = parser.add_subparsers(dest="command", required=True)

    download_parser = subparsers.add_parser("download", help="Download the fixed real-data samples")
    download_parser.add_argument("--output", default=str(DEFAULT_RAW_DIR))
    download_parser.add_argument("--overwrite", action="store_true")
    download_parser.set_defaults(handler=_download)

    profile_parser = subparsers.add_parser("profile", help="Profile one official price CSV")
    profile_parser.add_argument("path")
    profile_parser.set_defaults(handler=_profile)

    export_parser = subparsers.add_parser("export", help="Write committed sample and JSON summary")
    export_parser.add_argument("--input", default=str(DEFAULT_RAW_DIR / "20261119_FinalEnergyPrices.csv"))
    export_parser.add_argument("--sample-dir", default=str(DEFAULT_SAMPLE_DIR))
    export_parser.add_argument("--summary", default=str(DEFAULT_SUMMARY))
    export_parser.set_defaults(handler=_export)

    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
