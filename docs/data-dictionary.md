# NZ PowerWatch data dictionary (M1)

## Canonical price record

One row = one pricing node × one 30-minute trading period × one published source file.
Raw files remain untouched in `data/raw/`; standardised records live in
`data/processed/prices_YYYYMM_{final|interim}.parquet` and `.csv.gz`.

| Field | Type | Meaning |
|---|---|---|
| `trading_date` | date | Trading day as published in local NZ calendar time |
| `trading_period` | int | 30-minute period number, 1–46/48/50 depending on DST day |
| `expected_periods` | int | Official period count for that date (46, 48 or 50) |
| `period_start_local` | string | Resolved local wall-clock start, `YYYY-MM-DD HH:MM` |
| `period_start_utc` | datetime | UTC start derived from the official DST rule |
| `utc_offset_hours` | int | 12 (NZST) or 13 (NZDT) for this period |
| `time_tag` | enum | `normal_nzst`, `normal_nzdt`, `dst_start_before_gap`, `dst_start_after_gap`, `dst_end_first_pass`, `dst_end_second_pass`, `dst_end_after_repeat` |
| `node` | string | Official POC code, unchanged |
| `node_label` | string | Human-readable name from NSP table or manual override |
| `region` | string | Network reporting region, `Unmapped` when no mapping exists |
| `island` | string | `NI`, `SI` or `Unknown` |
| `mapping_status` | enum | `nsp_table`, `manual_override`, `unmatched` |
| `price_nzd_per_mwh` | float | Parsed wholesale price |
| `raw_price` | string | Original numeric string from the source CSV, preserved |
| `price_status` | enum | `Final` or `Interim` |
| `price_type` | enum | Lowercase `final` or `interim` |
| `source_kind` | enum | `monthly_final`, `daily_final`, `daily_interim` |
| `source_file` | string | Original source filename |
| `source_url` | string | Exact public URL used to download the source |

## DST tags

| Tag | Meaning |
|---|---|
| `normal_nzst` | Standard-time day, 48 periods, UTC+12 |
| `normal_nzdt` | Daylight-time day, 48 periods, UTC+13 |
| `dst_start_before_gap` | DST start day, periods 1–4, still UTC+12 |
| `dst_start_after_gap` | DST start day, periods 5–46, UTC+13 after 02:00→03:00 jump |
| `dst_end_first_pass` | DST end day, periods 1–6, first 02:00–03:00 hour (UTC+13) |
| `dst_end_second_pass` | DST end day, periods 7–8, repeated hour (UTC+12) |
| `dst_end_after_repeat` | DST end day, periods 9–50, UTC+12 |

## Manifest and reports

- `data/manifest.json`: requested range, per-source URL/status/checksum/coverage/processing state,
  and derived coverage summary.
- `data/quality-report.json`: aggregate duplicates, missing values, incomplete node-days, price
  extremes, price-status counts, period-count distribution and DST-tag distribution.
- `data/quality-by-source.json`: the same checks per source, used to keep rebuilds incremental.
- `public/data/v1/*.json`: compact, versioned payloads for React (`manifest`, `coverage`,
  `quality`, `price-summary`, `overview`).
- `public/data/v1/regional.json` (M4): compact all-node dataset generated from the full 12.65M-row
  standardised history. It contains one shared `dates` array, a global `dateStatus` array, and for
  each priced node a parallel `means` array of daily mean prices (null for missing node-days),
  latest/7-day/30-day statistics, coverage counts, negative-price counts, and official NZTM-derived
  coordinates when present. `OTA2201`, `HAY2201` and `ISL2201` are absent from the NSP POC table, so
  they use clearly labelled same-substation coordinate proxies (`OTA0221`, `HAY0331`, `ISL0331`)
  with `coordinateSource = official_nsp_substation_proxy`. Nodes without verified coordinates remain
  in the dataset with `hasMapPosition = false` and are never given invented positions.
- `public/data/v1/anomalies.json` (M5): compact event records with type, classification, node,
  region, island, start/end/peak date, duration, severity/tier, Final/Interim status, explanation
  reasons, and statistics (local/seasonal/cross-node z-scores, medians, volatility ratio). Also
  includes thresholds, methods, summary counts, simultaneous clusters and recurring patterns.
  Clusters carry statistical/market-event counts, a `classification` label (`statistical`,
  `market_event_only` or `mixed`), a `dominantType`, and event IDs capped at 40 entries. The
  frontend draws event price context from the existing full-history `regional.json` series; no
  duplicate price arrays are added to this payload.
- `public/data/geo/nz-coastline.json`: simplified Natural Earth 110m New Zealand coastline
  (public domain), used as the geographically accurate base map for the interactive Regions map.
- `public/data/v1/overview.json` (M3): recent half-hour rows for the three representative nodes
  (date, period, local/UTC start, node, price, Final/Interim status), one daily aggregate row per
  node/day (mean/min/max/period count/status), derived metrics (latest prices, regional spread,
  7-day half-hour price standard deviation, largest daily-mean move, 30-day ratio flags, negative
  price count) and a `definitions` object stating each calculation rule.
