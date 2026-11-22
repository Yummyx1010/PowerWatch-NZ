# NZ PowerWatch — official data sources (M0 discovery)

All endpoints below were checked with live HTTP requests on **2026-11-23**. No API key,
account, paid plan or unofficial mirror is used. Prices are published by the Electricity
Authority (Te Mana Hiko) of New Zealand.

## 1. Source inventory

| Dataset | Verified access | Format & schema | Cadence / timing |
|---|---|---|---|
| **Final energy prices (daily, all nodes)** | `https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/DispatchAndPricing/FinalEnergyPrices/{YYYYMMDD}_FinalEnergyPrices.csv` (also mirrored at `https://emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/{YYYYMMDD}_FinalEnergyPrices.csv`) | CSV. Headers: `TradingDate,TradingPeriod,PointOfConnection,DollarsPerMegawattHour`. One row per node × 30-minute trading period. | One file per trading day. Interim prices become final by 2pm the next business day if no pricing error claim is lodged; the interim file is then removed. |
| **Final energy prices (monthly archive)** | `https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/DispatchAndPricing/FinalEnergyPrices/ByMonth/{YYYYMM}_FinalEnergyPrices.csv` | Same CSV schema, whole month. | Created after a calendar year is final. Files visible from `200212` to `202610`. `202512_FinalEnergyPrices_incomplete.csv` is explicitly marked incomplete — exclude it from analysis. |
| **Interim energy prices (daily)** | `https://emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/{YYYYMMDD}_FinalEnergyPrices_I.csv` | Same CSV schema; `_I` suffix marks interim values (time-weighted average of dispatch prices). | Daily while prices are provisional. Treat as unstable: re-fetch final files when building historical series. |
| **Wholesale data for a single node** | `https://www.emi.ea.govt.nz/Wholesale/Download/DataReport/CSV/CLA3WR?DateFrom={YYYYMMDD}&DateTo={YYYYMMDD}&POC={node}&_si=f%7C0-5-1-2%2Cs%7Cdd%2Cv%7C5` | CSV with a text preamble, then `Point of connection,Trading date,Trading period,$/MWh,Price status`. Dates are `DD/MM/YYYY`. Status values include `Final`. | Custom date range; data back to market start on **1 October 1996**. |
| **Network Supply Points table** | `https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/MappingsAndGeospatial/NetworkSupplyPointsTable/{YYYYMMDD}_NetworkSupplyPointsTable.csv` | CSV mapping `POC code` to `Description`, `Network reporting region`, `Zone`, `Island`, NZTM coordinates and effective dates. | Dated snapshots (multiple per month). Use the snapshot closest to the price date. |
| **EA Data & insights hub** | `https://www.ea.govt.nz/data-and-insights/` and `https://www.ea.govt.nz/data-and-insights/datasets/` | Catalogues for the same public datasets. `https://www.ea.govt.nz/data-and-insights/how-to-access-our-downloadable-datasets/` documents programmatic access to the underlying Azure Blob container via REST listing (`?restype=container&comp=list&prefix=...`) or AzCopy. | Hub is replacing EMI. |

Verified live file sizes: one daily final price file ≈ 330 KB; one monthly final price file ≈
10.1 MB; one single-node report day ≈ 2 KB; the node mapping snapshot ≈ 449 KB.

## 2. Price semantics

- **Unit:** NZ dollars per megawatt-hour (`$/MWh`), from the `DollarsPerMegawattHour` column and
  the `$/MWh` column in the single-node report.
- **Time base:** `TradingDate` plus a 30-minute `TradingPeriod`. The daily export has no explicit
  timestamp or timezone column. **M1 verified the official DST rule**: normal days have 48
  periods, the last Sunday of September has **46** periods (02:00–03:00 skipped), and the first
  Sunday of April has **50** periods (02:00–03:00 repeated). See
  `https://forum.emi.ea.govt.nz/thread/daylight-saving-time-and-trading-periods/`. M1 verified the
  counts against real EMI single-node reports for 2024 and 2025 transition days.
- **Price types:** `interim` (time-weighted average of dispatch prices during a period),
  `final` (declared after the pricing-error window), and `provisional` in older archives. M1 keeps
  both Final and Interim rows, labelled in `price_status` / `price_type`, and never mixes them
  silently.
- **Nodes:** `PointOfConnection` / POC codes (e.g. `OTA2201`). A price is nodal, not a national
  average. There is no official "North Island price" or "South Island price" in this dataset.

### Representative nodes chosen for M0

Names confirmed by querying the official single-node report for 2026-11-19.

| Code | Name | Area | Island | Role in v1 |
|---|---|---|---|---|
| `OTA2201` | Otahuhu | Auckland | North Island | Auckland node; North Island reference proxy |
| `HAY2201` | Haywards | Wellington | North Island | Wellington node |
| `ISL2201` | Islington | Christchurch | South Island | Christchurch node; South Island reference proxy |

The island-level labels are **explicitly labelled as proxies** in the product; later milestones
must not present them as official island aggregates.

## 3. Historical scope (~3 years)

M1 downloaded 36 monthly files (`202311`–`202610`), 19 final daily files (`20261101`–`20261119`)
and 3 interim daily files (`20261120`–`20261122`). `data/manifest.json` records the exact URL,
coverage period, price status, byte size, SHA-256, source `Last-Modified` header and processing
status of every file. `202512_FinalEnergyPrices_incomplete.csv` is recorded with issue
`incomplete_monthly_file` and is excluded from processing, leaving a documented 31-day gap.

## 4. Licensing and attribution

Electricity Authority legal pages state:

> Copyright material is licensed for re-use under the Creative Commons Attribution (CC-BY) 4.0
> International licence… you are free to copy, store, distribute and adapt the material, as long
> as you attribute it to the Electricity Authority "www.emi.ea.govt.nz provided by the
> Electricity Authority (New Zealand)" or the relevant licensor.

Sources: `https://www.ea.govt.nz/copyright-disclaimer-transparency/` and
`https://emi.ea.govt.nz/LegalInformation`. NZ PowerWatch must display that attribution (it does,
in the footer and data documentation). Restricted material — logos, site design, EMI tools/models,
third-party works and information-request responses — is **not** covered and is not used here.
The Authority also disclaims liability for accuracy and may change information without notice.

## 5. Platform risk to track

EMI is being decommissioned and replaced by the Electricity Authority's **Data & insights** hub
(announced 2025-09-29; updates 2025-10-13 and 2025-11-05). The Azure Blob dataset container
`https://emidatasets.blob.core.windows.net/publicdata` is the stable long-term location for bulk
CSV files. EMI-hosted pages and the `CLA3WR` report endpoint are transition-era services: keep
them isolated behind `pipeline/config.py` so they can be swapped without touching analysis code.
The API-key-based real-time dispatch API is **not** used in M0.

## 6. What is deliberately out of scope for M0

- No paid API, no scraping of authenticated pages, no forecasting.
- No full three-year download; no daily automation; no database or backend server.
- No claims about causality, market power or "why" a price moved — that comes in later milestones.
