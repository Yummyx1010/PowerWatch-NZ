# M0 data schema and quality findings

## Canonical schema

`pipeline.profile.read_price_csv()` converts both official CSV layouts into this schema:

| Column | Type | Meaning |
|---|---|---|
| `trading_date` | date | Trading day as published (local NZ date, no timezone field) |
| `trading_period` | integer 1–48 | 30-minute interval within the trading day |
| `node` | string | Point of connection code |
| `price_nzd_per_mwh` | float | Wholesale energy price in NZD/MWh |
| `price_status` | string or null | `Final` in the single-node report; null in the all-node export |

The natural key is `(trading_date, trading_period, node)`.

## Findings from real files

Inspected on 2026-11-23 with `python -m pipeline.cli profile <path>`.

### `20261119_FinalEnergyPrices.csv` (final, all nodes)

- 11,808 rows = 246 nodes × 48 trading periods on 2026-11-19.
- 0 duplicate natural keys; 0 missing values in any column.
- Price range **$2.55 – $188.73/MWh**; 0 negative prices and 0 zero prices on this day.
- Columns exactly `TradingDate,TradingPeriod,PointOfConnection,DollarsPerMegawattHour`.

### `20261122_FinalEnergyPrices_I.csv` (interim, all nodes)

- 11,808 rows, 246 nodes, 48 periods, 0 duplicate keys.
- Same schema; file name suffix `_I` is the only signal that prices are not yet final.
- This file will disappear once the day's prices become final — do not hard-code its URL in
  production ingestion.

### `single_node_OTA2201_20260328.csv` (single-node report)

- 9-line text preamble, then a differently named header; dates use `DD/MM/YYYY`.
- 48 rows for `OTA2201` on 2026-03-28, all `Final`.
- Price range **$100.58 – $239.57/MWh**, mean **$157.6087/MWh** (rounded to 4 dp).
- Demonstrates that the same underlying price can be fetched with an explicit status column.

### `20261121_NetworkSupplyPointsTable.csv` (node mapping)

- 2,672 rows: 790 marked current, 1,882 historical.
- 228 of the 246 priced nodes in the daily file can be matched to a POC code here.
- The 18 unmatched codes include `OTA2201`, `HAY2201` and `ISL2201`: these high-voltage GXP
  codes are not present as POC codes in this mapping snapshot. **Do not silently drop them** —
  keep an explicit manual override for the representative nodes (done in `pipeline/config.py`).

## Timezone and DST

There is no timezone column. `TradingPeriod` 1–48 is interpreted as local New Zealand time.
Daylight saving shifts clocks by one hour; the Authority still publishes 48 rows per node per
calendar day in the sampled file, but M1 must verify transition days (early April and late
September) before computing cross-day aggregations or joining weather data. UTC conversion must
be derived from an authoritative NZ timezone rule set, not guessed.

## Reproducible sample committed to the repository

| File | Bytes | SHA-256 |
|---|---:|---|
| `data/samples/final_prices_sample.csv` | 4,364 | `681856bc49a4f588fd2f5bacb9b8e871576f8ec13f1f9f78bdf6f99f208451f5` |
| `data/samples/final_prices_sample.parquet` | 5,061 | `48bd24d57df93f467691fd90e95d0508e1b48b74d38df6df5110ea98e4686a2b` |
| `data/samples/single_node_OTA2201_20260328.csv` | 2,002 | `b44f92104dd559549f5d2aab53fe6e7db57b1be67154fdee514cafdd0ce20503` |

The sample contains 144 rows: 3 representative nodes × 48 periods on 2026-11-19.
Regenerate with `python -m pipeline.cli export`; re-download raw source files with
`python -m pipeline.cli download`. Raw downloads live in `data/raw/` and are gitignored.
`public/data/sample-summary.json` is the tiny payload consumed by the React page; its 24-bar
sparkline uses every second real `OTA2201` price from the sample.

## Known limitations carried into M1

- Final prices can be revised before finalisation; historical datasets should prefer final files.
- `202512_FinalEnergyPrices_incomplete.csv` must be quarantined.
- Interim and final files must never be mixed in one series without a status flag.
- Nodal prices are not regional averages; the island labels used in the UI are proxies.
- The single-node report depends on an EMI endpoint that is scheduled for retirement.
