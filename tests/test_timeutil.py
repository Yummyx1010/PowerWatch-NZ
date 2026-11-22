from datetime import date

import pytest

from pipeline.timeutil import (
    dst_end,
    dst_start,
    is_dst_day,
    period_count,
    period_info,
)


def test_transition_dates_follow_nz_rules() -> None:
    assert dst_start(2024) == date(2024, 9, 29)
    assert dst_end(2024) == date(2024, 4, 7)
    assert dst_start(2025) == date(2025, 9, 28)
    assert dst_end(2025) == date(2025, 4, 6)


def test_period_counts_match_official_dst_days() -> None:
    assert period_count(date(2024, 4, 7)) == 50
    assert period_count(date(2024, 9, 29)) == 46
    assert period_count(date(2024, 4, 8)) == 48
    assert period_count(date(2024, 6, 1)) == 48


def test_dst_start_utc_mapping_matches_official_example() -> None:
    day = date(2024, 9, 29)
    before = period_info(day, 4)
    after = period_info(day, 5)
    assert before.utc_start.isoformat() == "2024-09-28T13:30:00+00:00"
    assert before.local_start_label == "2024-09-29 01:30"
    assert before.utc_offset_hours == 12
    assert after.utc_start.isoformat() == "2024-09-28T14:00:00+00:00"
    assert after.local_start_label == "2024-09-29 03:00"
    assert after.utc_offset_hours == 13


def test_dst_end_utc_mapping_matches_official_example() -> None:
    day = date(2024, 4, 7)
    first = period_info(day, 6)
    second = period_info(day, 7)
    third = period_info(day, 8)
    after = period_info(day, 9)
    last = period_info(day, 50)
    assert first.utc_start.isoformat() == "2024-04-06T13:30:00+00:00"
    assert second.utc_start.isoformat() == "2024-04-06T14:00:00+00:00"
    assert second.local_start_label == "2024-04-07 02:00"
    assert second.utc_offset_hours == 12
    assert third.utc_start.isoformat() == "2024-04-06T14:30:00+00:00"
    assert after.utc_start.isoformat() == "2024-04-06T15:00:00+00:00"
    assert after.local_start_label == "2024-04-07 03:00"
    assert last.utc_start.isoformat() == "2024-04-07T11:30:00+00:00"


def test_normal_days_use_correct_offset() -> None:
    summer = period_info(date(2026, 11, 19), 1)
    winter = period_info(date(2026, 6, 15), 1)
    assert summer.utc_offset_hours == 13
    assert summer.utc_start.isoformat() == "2026-11-18T11:00:00+00:00"
    assert winter.utc_offset_hours == 12
    assert winter.utc_start.isoformat() == "2026-06-14T12:00:00+00:00"
    assert is_dst_day(date(2026, 11, 19)) is True
    assert is_dst_day(date(2026, 6, 15)) is False


def test_invalid_period_is_rejected() -> None:
    with pytest.raises(ValueError):
        period_info(date(2024, 9, 29), 47)
