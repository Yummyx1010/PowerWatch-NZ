"""Deterministic download helpers for public Electricity Authority files."""

from __future__ import annotations

import hashlib
from pathlib import Path

import requests

from .config import SAMPLE_DOWNLOADS, SampleDownload

USER_AGENT = "NZPowerWatch/0.1 (public data research; contact: local developer)"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, destination: Path, *, overwrite: bool = False, timeout: int = 60) -> Path:
    """Download one public file to ``destination`` and return its path."""
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and not overwrite:
        return destination

    response = requests.get(
        url,
        timeout=timeout,
        headers={"User-Agent": USER_AGENT},
    )
    response.raise_for_status()
    destination.write_bytes(response.content)
    return destination


def download_samples(output_dir: Path, *, overwrite: bool = False) -> list[Path]:
    """Download the small, fixed set of real samples used by M0."""
    paths: list[Path] = []
    for sample in SAMPLE_DOWNLOADS:
        path = download(sample.url, Path(output_dir) / sample.filename, overwrite=overwrite)
        paths.append(path)
    return paths


def describe_sample(sample: SampleDownload, path: Path) -> dict[str, object]:
    return {
        "name": sample.name,
        "filename": path.name,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "url": sample.url,
        "description": sample.description,
    }
