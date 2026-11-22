"""Discovery of official wholesale price source files.

The pipeline separates *discovery* from *download* so manifests are explicit:
every row of data can be traced back to one public URL, one reporting period
and one declared price status.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta
from urllib.parse import urlparse

import requests

from .config import final_daily_url, interim_daily_url

BLOB_BASE = "https://emidatasets.blob.core.windows.net/publicdata"
BLOB_LIST_PREFIX = "Datasets/Wholesale/DispatchAndPricing/FinalEnergyPrices/ByMonth/"
MONTHLY_ARCHIVE_THROUGH = date(2026, 10, 31)
KNOWN_INCOMPLETE_MONTH = "202512"
MONTHLY_NAME_RE = re.compile(
    r"/(?P<month>\d{6})_FinalEnergyPrices(?P<suffix>_incomplete)?\.csv$"
)


@dataclass(frozen=True)
class SourceSpec:
    key: str
    kind: str
    coverage_start: date
    coverage_end: date
    url: str
    filename: str
    price_status: str
    issue: str | None = None
    note: str | None = None

    @property
    def is_incomplete(self) -> bool:
        return self.issue is not None


def month_bounds(year: int, month: int) -> tuple[date, date]:
    if month == 12:
        return date(year, 12, 1), date(year, 12, 31)
    return date(year, month, 1), date(year, month + 1, 1) - timedelta(days=1)


def month_keys(start: date, end: date) -> list[tuple[int, int]]:
    keys: list[tuple[int, int]] = []
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        keys.append((year, month))
        month += 1
        if month == 13:
            year, month = year + 1, 1
    return keys


def list_blob_names(prefix: str = BLOB_LIST_PREFIX, timeout: int = 60) -> list[str]:
    """List blob names in the public Azure container (no credentials needed)."""
    from urllib.request import urlopen

    base = "https://emidatasets.blob.core.windows.net/publicdata"
    xml = urlopen(f"{base}?restype=container&comp=list&prefix={prefix}", timeout=timeout)
    text = xml.read().decode("utf-8-sig", "replace")
    return re.findall(r"<Name>(.*?)</Name>", text)


def monthly_specs(
    start: date,
    end: date,
    names: list[str] | None = None,
) -> list[SourceSpec]:
    """Build monthly final-price specs for all months fully in the archive."""
    names = list_blob_names() if names is None else names
    by_month: dict[str, str] = {}
    for name in names:
        match = MONTHLY_NAME_RE.search(name)
        if match:
            by_month[match.group("month")] = name

    specs: list[SourceSpec] = []
    for year, month in month_keys(start, end):
        first, last = month_bounds(year, month)
        if first > MONTHLY_ARCHIVE_THROUGH or last > end:
            continue
        token = f"{year:04d}{month:02d}"
        if token not in by_month:
            specs.append(
                SourceSpec(
                    key=f"monthly:{token}",
                    kind="monthly_final",
                    coverage_start=first,
                    coverage_end=last,
                    url="",
                    filename="",
                    price_status="Final",
                    issue="monthly_file_not_found",
                )
            )
            continue
        name = by_month[token]
        incomplete = "_incomplete" in name or token == KNOWN_INCOMPLETE_MONTH
        specs.append(
            SourceSpec(
                key=f"monthly:{token}",
                kind="monthly_final",
                coverage_start=first,
                coverage_end=last,
                url=f"{BLOB_BASE}/{name}",
                filename=name.rsplit("/", 1)[-1],
                price_status="Final",
                issue="incomplete_monthly_file" if incomplete else None,
            )
        )
    return specs


def daily_specs(
    start: date,
    end: date,
    after: date = MONTHLY_ARCHIVE_THROUGH,
    probe=requests.head,
) -> list[SourceSpec]:
    """Probe dates after the monthly archive for daily final or interim files."""
    specs: list[SourceSpec] = []
    day = max(start, after + timedelta(days=1))
    while day <= end:
        final_url = final_daily_url(day)
        interim_url = interim_daily_url(day)
        if _exists(final_url, probe):
            url, status, kind, issue, note = final_url, "Final", "daily_final", None, None
        elif _exists(interim_url, probe):
            url, status, kind, issue, note = interim_url, "Interim", "daily_interim", None, "interim_prices"
        else:
            url, status, kind, issue, note = "", "", "missing", "no_published_file", None
        specs.append(
            SourceSpec(
                key=f"daily:{day:%Y%m%d}",
                kind=kind,
                coverage_start=day,
                coverage_end=day,
                url=url,
                filename=urlparse(url).path.rsplit("/", 1)[-1] if url else "",
                price_status=status,
                issue=issue,
                note=note,
            )
        )
        day += timedelta(days=1)
    return specs


def discover_sources(
    start: date,
    end: date,
    *,
    names: list[str] | None = None,
    probe=requests.head,
) -> list[SourceSpec]:
    return monthly_specs(start, end, names=names) + daily_specs(start, end, probe=probe)


def _exists(url: str, probe) -> bool:
    if not url:
        return False
    try:
        response = probe(url, timeout=30, allow_redirects=True)
        return int(response.status_code) == 200
    except requests.RequestException:
        return False


def coverage_gaps(specs: list[SourceSpec], start: date, end: date) -> list[tuple[date, date]]:
    """Return contiguous date ranges with no usable published file."""
    covered: set[date] = set()
    for spec in specs:
        if spec.issue:
            continue
        day = spec.coverage_start
        while day <= spec.coverage_end:
            covered.add(day)
            day += timedelta(days=1)

    gaps: list[tuple[date, date]] = []
    cursor: date | None = None
    day = start
    while day <= end:
        if day not in covered and cursor is None:
            cursor = day
        elif day in covered and cursor is not None:
            gaps.append((cursor, day - timedelta(days=1)))
            cursor = None
        day += timedelta(days=1)
    if cursor is not None:
        gaps.append((cursor, end))
    return gaps
