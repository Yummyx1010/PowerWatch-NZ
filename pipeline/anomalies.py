"""Explainable anomaly detection across the full nodal price dataset."""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date
from pathlib import Path

import pandas as pd

from .nodes import load_node_mapping
from .regional import write_compact_json

COLUMNS = ["trading_date", "node", "price_nzd_per_mwh", "price_status", "price_type"]

THRESHOLDS = {
    "spikeDropLocalZ": 5.0,
    "spikeDropSeasonalZ": 3.5,
    "spikeDropMinAbsMove": 20.0,
    "spikeDropMinRelativeMove": 0.5,
    "volatilityRatio": 4.0,
    "volatilityMinStd": 25.0,
    "divergenceZ": 4.5,
    "divergenceAbs": 25.0,
    "divergenceLocalZ": 2.0,
    "negativePrice": -0.01,
    "rollingWindowDays": 30,
    "volatilityWindowDays": 14,
    "minimumRollingDays": 10,
    "minimumSeasonalHistory": 3,
}

METHODS = {
    "scope": "Daily nodal mean and daily nodal minimum prices from the full M1 standardised dataset; missing node-days remain null and are never filled.",
    "spikeDrop": "Robust local z-score against a trailing 30-day median/MAD, confirmed by a same-month median/MAD built only from strictly earlier dates (previous years included); with fewer than three prior same-month observations, the prior-only trailing baseline is used. A minimum absolute/relative price move is also required. No future observation enters a baseline.",
    "volatility": "14-day rolling standard deviation divided by that node's median 14-day standard deviation, requiring a minimum absolute dispersion.",
    "divergence": "Cross-sectional robust z-score against the same-day all-node median/MAD, confirmed by the node's own local z-score and an absolute difference.",
    "negativePrice": "Daily minimum below zero is recorded as a market event, not automatically as a statistical anomaly.",
    "severity": "Type-specific 0-100 score from signal strength and event duration. Tiers: low <40, medium 40-64, high 65-84, critical >=85.",
    "caveats": "No causal explanation is inferred. Interim prices are labelled and may be revised. Detection is descriptive, not a market-power or forecasting claim.",
}


def _daily_frame(processed_dir: Path) -> pd.DataFrame:
    frames = []
    for path in sorted(Path(processed_dir).glob("prices_*.parquet")):
        frame = pd.read_parquet(path, columns=COLUMNS)
        grouped = (
            frame.groupby(["trading_date", "node"], as_index=False)
            .agg(
                mean=("price_nzd_per_mwh", "mean"),
                minimum=("price_nzd_per_mwh", "min"),
                rows=("price_nzd_per_mwh", "size"),
                status=("price_status", "first"),
            )
        )
        frames.append(grouped)
    if not frames:
        raise ValueError("No processed price records found")
    return pd.concat(frames, ignore_index=True)


def _tier(score: float) -> str:
    if score >= 85:
        return "critical"
    if score >= 65:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _clusters(flags: pd.Series) -> list[tuple[int, int]]:
    positions = [index for index, value in enumerate(flags.to_numpy()) if bool(value)]
    if not positions:
        return []
    clusters = []
    start = previous = positions[0]
    for position in positions[1:]:
        if position - previous > 1:
            clusters.append((start, previous))
            start = position
        previous = position
    clusters.append((start, previous))
    return clusters


def _historical_month_stats(
    series: pd.Series,
    months: pd.Series,
    minimum_history: int = 3,
) -> tuple[pd.Series, pd.Series]:
    """Month-of-year median/MAD using only strictly earlier observations.

    Grouping by calendar month across the whole timeline lets earlier years in the
    same month contribute to a date's baseline, while ``shift(1)`` and the
    expanding window prevent the current or any later date from leaking in.
    """
    medians = pd.Series(float("nan"), index=series.index, dtype=float)
    mads = pd.Series(float("nan"), index=series.index, dtype=float)
    for month in sorted(set(months.dropna().tolist())):
        index = months.index[months == month]
        previous = series.loc[index].shift(1)
        enough_history = previous.expanding(min_periods=minimum_history).count() >= minimum_history
        median = previous.expanding(min_periods=minimum_history).median()
        deviations = (previous - median).abs()
        mad = deviations.expanding(min_periods=minimum_history).median()
        medians.loc[index] = median.where(enough_history)
        mads.loc[index] = mad.where(enough_history)
    return medians, mads


def _severity(event_type: str, duration: int, **signals: float) -> int:
    capped_duration = min(duration, 7)
    if event_type in {"price_spike", "price_drop"}:
        score = min(50, 15 * math.log1p(abs(signals.get("local_z", 0)))) + 3 * capped_duration
        if abs(signals.get("seasonal_z", 0)) >= 4:
            score += 8
    elif event_type == "node_divergence":
        score = min(65, 10 * abs(signals.get("divergence_z", 0))) + 2 * capped_duration
        if abs(signals.get("local_z", 0)) >= 4:
            score += 8
    elif event_type == "volatility":
        score = min(55, 12 * signals.get("volatility_ratio", 0)) + 2 * capped_duration
    else:
        score = 15 + 8 * abs(signals.get("daily_min", 0)) + 2 * min(duration, 5)
    return int(min(100, max(0, round(score))))


def build_anomaly_payload(processed_dir: Path, mapping_path: Path) -> dict[str, object]:
    daily = _daily_frame(processed_dir)
    meta = load_node_mapping(mapping_path)
    mean_df = daily.pivot(index="trading_date", columns="node", values="mean").sort_index()
    min_df = daily.pivot(index="trading_date", columns="node", values="minimum").reindex_like(mean_df)
    status_df = daily.pivot(index="trading_date", columns="node", values="status").reindex_like(mean_df)
    dates = [pd.Timestamp(value).date().isoformat() for value in mean_df.index]
    nodes = [str(value) for value in mean_df.columns]

    cross_median = mean_df.median(axis=1)
    cross_mad = mean_df.sub(cross_median, axis=0).abs().median(axis=1)
    index_dates = pd.to_datetime(mean_df.index)
    months = pd.Series(index_dates.month, index=mean_df.index)

    events: list[dict[str, object]] = []
    signals_by_node: dict[str, dict[str, pd.Series]] = {}
    flags_by_node: dict[str, dict[str, pd.Series]] = {}

    for node in nodes:
        series = mean_df[node]
        minimums = min_df[node]
        rolling_median = series.rolling(30, min_periods=10).median()
        rolling_mad = series.rolling(30, min_periods=10).apply(
            lambda values: (pd.Series(values) - pd.Series(values).median()).abs().median(),
            raw=True,
        )
        local_scale = 1.4826 * rolling_mad.fillna(0) + 5
        local_z = (series - rolling_median) / local_scale

        historical_median, historical_mad = _historical_month_stats(
            series, months, THRESHOLDS["minimumSeasonalHistory"]
        )
        prior_median = rolling_median.shift(1)
        prior_mad = rolling_mad.shift(1)
        seasonal_median = historical_median.where(historical_median.notna(), prior_median)
        seasonal_mad = historical_mad.where(historical_mad.notna(), prior_mad)
        seasonal_scale = 1.4826 * seasonal_mad.fillna(0) + 5
        seasonal_z = (series - seasonal_median) / seasonal_scale

        rolling_std = series.rolling(14, min_periods=10).std()
        baseline_std = rolling_std.rolling(90, min_periods=30).median()
        volatility_ratio = rolling_std / (baseline_std.fillna(0) + 1)

        divergence_z = (series - cross_median) / (1.4826 * cross_mad.fillna(0) + 5)

        move = series - rolling_median
        min_move = pd.Series(
            [
                max(
                    THRESHOLDS["spikeDropMinAbsMove"],
                    THRESHOLDS["spikeDropMinRelativeMove"] * float(value),
                )
                if pd.notna(value)
                else THRESHOLDS["spikeDropMinAbsMove"]
                for value in rolling_median
            ],
            index=series.index,
        )
        spike = (local_z >= THRESHOLDS["spikeDropLocalZ"]) & (seasonal_z >= THRESHOLDS["spikeDropSeasonalZ"]) & (move >= min_move)
        drop = (local_z <= -THRESHOLDS["spikeDropLocalZ"]) & (seasonal_z <= -THRESHOLDS["spikeDropSeasonalZ"]) & (move <= -min_move)
        volatility = (volatility_ratio >= THRESHOLDS["volatilityRatio"]) & (rolling_std >= THRESHOLDS["volatilityMinStd"])
        divergence = (
            (divergence_z.abs() >= THRESHOLDS["divergenceZ"])
            & ((series - cross_median).abs() >= THRESHOLDS["divergenceAbs"])
            & (local_z.abs() >= THRESHOLDS["divergenceLocalZ"])
        )
        negative = minimums < THRESHOLDS["negativePrice"]

        signals = {
            "price": series,
            "minimum": minimums,
            "local_z": local_z,
            "seasonal_z": seasonal_z,
            "rolling_median": rolling_median,
            "seasonal_median": seasonal_median,
            "cross_median": cross_median,
            "divergence_z": divergence_z,
            "volatility_ratio": volatility_ratio,
            "rolling_std": rolling_std,
            "status": status_df[node],
        }
        flags = {
            "price_spike": spike,
            "price_drop": drop,
            "volatility": volatility,
            "node_divergence": divergence,
            "negative_price": negative,
        }
        signals_by_node[node] = signals
        flags_by_node[node] = flags

        info = meta.get(node)
        for event_type, flag in flags.items():
            for start, end in _clusters(flag):
                subset = signals["price"].iloc[start : end + 1]
                if event_type == "price_drop":
                    peak = start + int(subset.values.argmin())
                elif event_type == "volatility":
                    ratio_values = signals["volatility_ratio"].iloc[start : end + 1]
                    peak = start + int(ratio_values.fillna(0).values.argmax())
                elif event_type == "negative_price":
                    min_values = signals["minimum"].iloc[start : end + 1]
                    peak = start + int(min_values.fillna(0).values.argmin())
                else:
                    metric = signals["divergence_z"] if event_type == "node_divergence" else signals["local_z"]
                    values = metric.iloc[start : end + 1]
                    peak = start + int(values.abs().fillna(0).values.argmax())

                signal_values = {
                    key: float(value.iloc[peak]) if pd.notna(value.iloc[peak]) else 0.0
                    for key, value in signals.items()
                    if key not in {"status"}
                }
                duration = end - start + 1
                severity = _severity(event_type, duration, **signal_values)
                reasons = []
                if event_type in {"price_spike", "price_drop"}:
                    reasons.append(f"Local robust z-score {signal_values['local_z']:.1f} vs trailing 30-day median ${signal_values['rolling_median']:.2f}/MWh")
                    reasons.append(f"Seasonal robust z-score {signal_values['seasonal_z']:.1f} vs monthly median ${signal_values['seasonal_median']:.2f}/MWh")
                elif event_type == "volatility":
                    reasons.append(f"14-day volatility ratio {signal_values['volatility_ratio']:.1f}× this node's typical dispersion")
                elif event_type == "node_divergence":
                    reasons.append(f"Cross-node robust z-score {signal_values['divergence_z']:.1f} vs same-day all-node median ${signal_values['cross_median']:.2f}/MWh")
                else:
                    reasons.append(f"Daily minimum ${signal_values['minimum']:.2f}/MWh below zero; recorded as a market event, not an automatic anomaly")
                reasons.append(f"Duration {duration} published day{'s' if duration != 1 else ''}")

                events.append(
                    {
                        "id": f"{event_type}:{node}:{dates[start]}:{dates[end]}",
                        "type": event_type,
                        "classification": "market_event" if event_type == "negative_price" else "statistical_anomaly",
                        "node": node,
                        "label": info.label if info else node,
                        "region": info.region if info else "Unmapped",
                        "island": info.island if info else "Unknown",
                        "start": dates[start],
                        "end": dates[end],
                        "duration": duration,
                        "peakDate": dates[peak],
                        "severity": severity,
                        "tier": _tier(severity),
                        "score": round(signal_values.get("local_z", signal_values.get("volatility_ratio", 0)), 2),
                        "price": round(signal_values["price"], 2),
                        "dailyMin": round(signal_values["minimum"], 2),
                        "status": str(signals["status"].iloc[peak]),
                        "stats": {
                            "price": round(signal_values["price"], 2),
                            "dailyMin": round(signal_values["minimum"], 2),
                            "rollingMedian": round(signal_values["rolling_median"], 2),
                            "seasonalMedian": round(signal_values["seasonal_median"], 2),
                            "crossMedian": round(signal_values["cross_median"], 2),
                            "localZ": round(signal_values["local_z"], 2),
                            "seasonalZ": round(signal_values["seasonal_z"], 2),
                            "divergenceZ": round(signal_values["divergence_z"], 2),
                            "volatilityRatio": round(signal_values["volatility_ratio"], 2),
                        },
                        "reasons": reasons,
                    }
                )

    events.sort(key=lambda event: (event["peakDate"], event["severity"]), reverse=True)

    events_by_date: dict[str, list[dict[str, object]]] = defaultdict(list)
    for event in events:
        for day in sorted({event["start"], event["end"], event["peakDate"]}):
            events_by_date[str(day)].append(event)

    clusters = []
    for day, day_events in sorted(events_by_date.items(), reverse=True):
        node_count = len({event["node"] for event in day_events})
        type_count = len({event["type"] for event in day_events})
        if node_count >= 5 or type_count >= 3:
            statistical_count = sum(
                1 for event in day_events if event["classification"] == "statistical_anomaly"
            )
            market_event_count = len(day_events) - statistical_count
            classification = (
                "market_event_only"
                if statistical_count == 0
                else "statistical"
                if market_event_count == 0
                else "mixed"
            )
            type_counts: dict[str, int] = defaultdict(int)
            for event in day_events:
                type_counts[str(event["type"])] += 1
            clusters.append(
                {
                    "date": day,
                    "nodeCount": node_count,
                    "typeCount": type_count,
                    "eventCount": len(day_events),
                    "maxSeverity": max(int(event["severity"]) for event in day_events),
                    "statisticalCount": statistical_count,
                    "marketEventCount": market_event_count,
                    "classification": classification,
                    "dominantType": max(type_counts, key=lambda item: type_counts[item]),
                    "nodes": sorted({str(event["node"]) for event in day_events}),
                    "types": sorted({str(event["type"]) for event in day_events}),
                    "eventIds": [str(event["id"]) for event in day_events[:40]],
                }
            )

    clusters_by_class: dict[str, int] = defaultdict(int)
    for cluster in clusters:
        clusters_by_class[str(cluster["classification"])] += 1

    pattern_counts: dict[tuple[str, str], int] = defaultdict(int)
    for event in events:
        pattern_counts[(str(event["node"]), str(event["type"]))] += 1
    patterns = [
        {"node": node, "type": event_type, "count": count}
        for (node, event_type), count in sorted(pattern_counts.items(), key=lambda item: item[1], reverse=True)[:15]
    ]

    by_type: dict[str, int] = defaultdict(int)
    by_tier: dict[str, int] = defaultdict(int)
    by_month: dict[str, int] = defaultdict(int)
    for event in events:
        by_type[str(event["type"])] += 1
        by_tier[str(event["tier"])] += 1
        by_month[str(event["peakDate"])[:7]] += 1

    return {
        "schemaVersion": "1.0",
        "nodeCount": len(nodes),
        "dateCount": len(dates),
        "coverage": {
            "start": dates[0] if dates else None,
            "end": dates[-1] if dates else None,
            "dateStatus": sorted(set(str(value) for value in status_df.stack().dropna().unique())),
        },
        "thresholds": THRESHOLDS,
        "methods": METHODS,
        "summary": {
            "eventCount": len(events),
            "statisticalCount": sum(1 for event in events if event["classification"] == "statistical_anomaly"),
            "marketEventCount": sum(1 for event in events if event["classification"] == "market_event"),
            "byType": dict(sorted(by_type.items())),
            "byTier": dict(sorted(by_tier.items())),
            "byMonth": dict(sorted(by_month.items())),
            "simultaneousClusters": len(clusters),
            "clustersByClass": dict(sorted(clusters_by_class.items())),
        },
        "events": events,
        "clusters": clusters[:60],
        "patterns": patterns,
    }


def write_anomaly_payload(processed_dir: Path, mapping_path: Path, output_path: Path) -> dict[str, object]:
    payload = build_anomaly_payload(Path(processed_dir), Path(mapping_path))
    write_compact_json(Path(output_path), payload)
    return payload
