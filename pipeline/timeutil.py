"""New Zealand daylight-saving aware trading-period time mapping.

Official rule (Electricity Authority, EMI forum, "Time (UTC, NZST, NZDT),
daylight saving, and trading periods"):

- NZST = UTC+12, NZDT = UTC+13.
- DST starts on the last Sunday of September: 02:00 becomes 03:00, so the day
  has 46 trading periods.
- DST ends on the first Sunday of April: 03:00 becomes 02:00, so the day has
  50 trading periods.
- Every other day has 48 trading periods.

The functions here are the single source of truth for both row-wise reasoning
and the vectorised fast path used when cleaning historical files.
"""

from __future__ import annotations

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone


def first_sunday(year: int, month: int) -> date:
    first = date(year, month, 1)
    return first + timedelta(days=(6 - first.weekday()) % 7)


def last_sunday(year: int, month: int) -> date:
    last = date(year, month, monthrange(year, month)[1])
    return last - timedelta(days=(last.weekday() - 6) % 7)


def dst_start(year: int) -> date:
    return last_sunday(year, 9)


def dst_end(year: int) -> date:
    return first_sunday(year, 4)


def period_count(day: date) -> int:
    if day == dst_start(day.year):
        return 46
    if day == dst_end(day.year):
        return 50
    return 48


def is_dst_day(day: date) -> bool:
    """Whether the day belongs to the NZDT season (transition days included)."""
    if day.month > 9 or day.month < 4:
        return True
    if day.month == 9:
        return day >= dst_start(day.year)
    if day.month == 4:
        return day < dst_end(day.year)
    return False


@dataclass(frozen=True)
class PeriodInfo:
    trading_date: date
    trading_period: int
    utc_start: datetime
    local_start_label: str
    utc_offset_hours: int
    tag: str


def period_info(day: date, period: int) -> PeriodInfo:
    """Return the authoritative UTC and local mapping for one trading period."""
    count = period_count(day)
    if not 1 <= period <= count:
        raise ValueError(f" trading period {period} out of range 1..{count} for {day}")

    naive = datetime.combine(day, time()) + timedelta(minutes=30 * (period - 1))

    if day == dst_start(day.year):
        if period <= 4:
            label = naive
            offset = 12
            base = datetime.combine(day, time()) - timedelta(hours=12)
            utc = base + timedelta(minutes=30 * (period - 1))
            tag = "dst_start_before_gap"
        else:
            label = naive + timedelta(hours=1)
            offset = 13
            base = datetime.combine(day, time()) - timedelta(hours=12)
            utc = base + timedelta(minutes=30 * (period - 1))
            tag = "dst_start_after_gap"
    elif day == dst_end(day.year):
        if period <= 6:
            label = naive
            offset = 13
            base = datetime.combine(day, time()) - timedelta(hours=13)
            utc = base + timedelta(minutes=30 * (period - 1))
            tag = "dst_end_first_pass"
        elif period <= 8:
            label = naive - timedelta(hours=1)
            offset = 12
            base = datetime.combine(day, time()) - timedelta(hours=10)
            utc = base + timedelta(minutes=30 * (period - 7))
            tag = "dst_end_second_pass"
        else:
            label = naive - timedelta(hours=1)
            offset = 12
            base = datetime.combine(day, time()) - timedelta(hours=13)
            utc = base + timedelta(minutes=30 * (period - 1))
            tag = "dst_end_after_repeat"
    elif is_dst_day(day):
        label = naive
        offset = 13
        base = datetime.combine(day, time()) - timedelta(hours=13)
        utc = base + timedelta(minutes=30 * (period - 1))
        tag = "normal_nzdt"
    else:
        label = naive
        offset = 12
        base = datetime.combine(day, time()) - timedelta(hours=12)
        utc = base + timedelta(minutes=30 * (period - 1))
        tag = "normal_nzst"

    return PeriodInfo(
        trading_date=day,
        trading_period=period,
        utc_start=utc.replace(tzinfo=timezone.utc),
        local_start_label=label.strftime("%Y-%m-%d %H:%M"),
        utc_offset_hours=offset,
        tag=tag,
    )
