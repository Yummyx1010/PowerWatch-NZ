# Anomaly detection methodology (M5)

## Scope

Detection uses the full M1 standardised history: 12,646,250 half-hourly rows aggregated to
one daily mean and one daily minimum per node. All 249 priced nodes are included. Missing
node-days remain null; the December 2025 gap and seven incomplete node-days are never filled.
Final and Interim rows retain their source status.

## Event types

| Type | Classification | Rule |
|---|---|---|
| `price_spike` | statistical anomaly | Local robust z-score ≥ 5 against a trailing 30-day median/MAD, seasonal z-score ≥ 3.5 against the node's strictly historical same-month median/MAD, and an absolute move ≥ max($20/MWh, 50% of trailing median). |
| `price_drop` | statistical anomaly | Mirror of the spike rule in the negative direction. Four events met the combined criteria in the current snapshot. |
| `volatility` | statistical anomaly | 14-day rolling standard deviation ≥ $25/MWh and ≥ 4× that node's median 14-day dispersion. |
| `node_divergence` | statistical anomaly | Cross-sectional robust z-score ≥ 4.5 against the same-day all-node median/MAD, absolute difference ≥ $25/MWh, and local z-score ≥ 2. |
| `negative_price` | market event | Daily minimum < $0/MWh. Recorded for visibility but explicitly **not** treated as an automatic statistical anomaly. |

MAD is scaled by 1.4826 and given a $5/MWh floor to avoid unstable ratios on very low-dispersion
nodes. Consecutive flagged days for the same node and type are clustered into one event.

## Baseline timing and look-ahead control

- The **local z-score** uses a rolling median/MAD over the current and previous 29 observed
  days. This is a contemporaneous description of the day being tested, not a forecast.
- The **seasonal z-score** uses a same-month median/MAD built only from observations with
  strictly earlier dates. Earlier years in the same month are included, but the current date
  and later dates are not. If fewer than three prior same-month observations exist, the
  prior-only trailing 30-day median/MAD is used instead.
- The **cross-node z-score** uses the same-day all-node median/MAD. It is contemporaneous and
  does not use future observations.
- The event-detail price chart computes its trailing and same-month baselines from
  `regional.json` with the same prior-only rule. No future price enters a displayed baseline.

The original implementation used a full-sample month-of-year median, which could include
future years for a historical event. That was replaced before this snapshot was generated.

## Severity

Severity is a 0–100 score with capped signal contributions and capped duration contribution:

- spike/drop: `min(50, 15·ln(1+|local z|)) + 3·min(duration,7)` plus 8 when seasonal z ≥ 4
- divergence: `min(65, 10·|divergence z|) + 2·min(duration,7)` plus 8 when local z ≥ 4
- volatility: `min(55, 12·ratio) + 2·min(duration,7)`
- negative price: `15 + 8·|minimum| + 2·min(duration,5)`

Tiers: low `<40`, medium `40–64`, high `65–84`, critical `≥85`.

## Validation and tuning

Initial loose thresholds produced 2,615 events, 2,051 of them critical, dominated by
low-dispersion volatility noise. Thresholds were tightened and severity contributions capped.

Replacing the look-ahead-prone seasonal baseline initially raised spike/drop flags to 1,319
because same-month confirmation became available earlier in the history. A single-signal
comparison showed that raising local confirmation from 4 to 5 and seasonal confirmation from
2.5 to 3.5 reduced spike/drop flags to roughly 600 while preserving 129 high/critical events,
so those tighter confirmation thresholds were adopted. The exported relative-move threshold is
now read directly by the detector rather than being a hard-coded value.

Final snapshot:

- 1,514 total events
- 1,448 statistical anomalies, 66 negative-price market events
- severity: 1 critical, 128 high, 1,097 medium, 288 low (observed range 17–87)
- by type: 718 price spikes, 4 price drops, 552 volatility flags, 174 divergences, 66 negative-price market events
- 36 simultaneous clusters (≥5 nodes or ≥3 types on one date): 30 statistical, 5 market-event-only, 1 mixed
- largest clusters: 240 nodes on 2024-05-08 and 2024-05-09, with 2–3 types and maximum severity 69–77
- 268 low-severity flags last one published day; they remain visible but are not promoted by severity
- no detected events inside the documented December 2025 gap

Large clusters are shown as market-wide co-occurrence, not as evidence of a shared cause.
Cluster event-ID lists are capped at 40 entries in the payload to keep it compact.

Threshold tuning is recorded in `pipeline/anomalies.py`; all thresholds are exported in
`public/data/v1/anomalies.json` for transparency.

## Assumptions and limitations

- Daily means smooth within-day spikes; an extreme half-hour that does not move the daily mean
  may not be detected. Half-hour event detail is deferred.
- A prior-only seasonal baseline needs at least three same-month observations. Early months rely
  on the prior-only trailing baseline, which is less seasonal but still free of future data.
- Detection is descriptive. It does not infer weather, fuel, outages, market power or causation.
- Interim prices may be revised; their events are labelled with the source status.
- Negative prices are legitimate wholesale outcomes and are separated from statistical flags.
- Thresholds are calibrated to this three-year snapshot and should be reviewed after data updates.
