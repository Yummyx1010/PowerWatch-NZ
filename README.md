# NZ PowerWatch

A modern, public-data product for exploring New Zealand's wholesale electricity market.
Current scope: **M0 foundation + M1 historical pipeline + M2 frontend foundation + M3 functional Market Overview**.

## What works

- React + TypeScript + Vite front end with a distinctive "Playful Tech" design system and five
  responsive page foundations using hash routing (M2).
- Functional Market Overview with a zoomable/filterable real price chart, node comparison,
  transparent Market Story and Final/Interim status handling (M3).
- Python pipeline with ~3 years of official Electricity Authority price data (M1).
- Incremental, checksummed downloads with an explicit manifest covering 58 source files.
- DST-exact trading-period timestamps (46/48/50 periods), Final vs Interim price status, and
  explicit handling of unmapped pricing nodes.
- CSV + Parquet historical datasets, quality reports and compact versioned JSON for React.
- Automated Python and frontend tests. No database, backend server, paid API or Astro.

## Run the project

### 1. Install dependencies

```bash
python -m pip install -r requirements.txt
npm install
```

### 2. Build the data (first time, or when sources change)

```bash
python -m pipeline.cli run
```

`run` performs `sync` (discover + incremental download + manifest) then `build`
(clean + validate + export). This downloads roughly 370 MB of official CSV files into
`data/raw/` and writes standardised Parquet/gzip-CSV files into `data/processed/`.
Both directories are gitignored. Re-running `run` reuses unchanged files and rebuilds
only revised sources.

Useful variants:

```bash
python -m pipeline.cli sync --start 2023-11-01 --end 2026-11-22
python -m pipeline.cli build --force
python -m pipeline.cli status
python -m pipeline.cli profile data/raw/20261119_FinalEnergyPrices.csv
python -m pipeline.cli download          # M0 small samples only
python -m pipeline.cli export            # M0 committed sample + summary JSON
```

### 3. Run the frontend

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Navigation uses hash routes such as
`#/overview`, `#/regions`, `#/anomalies`, `#/history` and `#/method`, which work on GitHub Pages
without server rewrites. All five pages read the committed M0/M1 JSON snapshots; no fabricated
prices or insights are rendered.

### 4. Build and test

```bash
pytest
npm test
npm run build
```

`npm run build` runs TypeScript checking and Vite, producing a fully static `dist/` directory
suitable for GitHub Pages. On Windows, Vitest 4 can fail when launched from a lower-case drive
path; run from an upper-case path, e.g. `cd /d D:\prog\github-files\PowerWatch`.

## Current data coverage

| Item | Value |
|---|---|
| Requested range | 2023-11-01 → 2026-11-22 |
| Final-price days | 1,084 (2023-11-01 → 2026-11-19) |
| Interim-price days | 3 (2026-11-20 → 2026-11-22) |
| Known gap | 2025-12-01 → 2025-12-31 (incomplete official monthly file) |
| Processed rows | 12,646,250 |
| Sources | 58 (35 complete monthly, 1 incomplete monthly, 19 daily final, 3 daily interim) |

See `data/manifest.json`, `data/quality-report.json` and `public/data/v1/` for the full detail.

## Project layout

```text
pipeline/                 Python ingestion, cleaning, validation and export
  config.py               Verified URLs, node definitions, default history range
  sources.py              Official file discovery and gap detection
  download.py             Incremental downloads with SHA-256 and source metadata
  history.py              Manifest, coverage and sync logic
  timeutil.py             Authoritative NZST/NZDT trading-period mapping
  nodes.py                Node-region mapping with explicit overrides
  clean.py                Canonical standardisation preserving originals
  quality.py              Per-source and aggregate validation
  build.py                Dataset and versioned JSON export
  cli.py                  python -m pipeline.cli <command>
data/raw/                 Full-size source downloads (gitignored)
data/processed/           Standardised Parquet + gzip CSV (gitignored)
data/manifest.json        Source and coverage manifest (committed)
data/quality-report.json  Aggregate quality report (committed)
data/samples/             Small committed real-data samples
public/data/              Static JSON consumed by React, including v1/
src/pages/                Five route-level page foundations
src/components/           Shared shell, data provider and UI components
src/lib/                  Data loading, formatting and hash routing helpers
src/styles/               Design tokens, global styles and page styles
tests/                    Python and Vitest test suites
docs/                     Data-source, data-dictionary and pipeline documentation
```

## Data attribution

Electricity Authority (New Zealand) —
`www.emi.ea.govt.nz provided by the Electricity Authority (New Zealand)`, CC BY 4.0.
See `docs/data-sources.md` for exact URLs, exclusions and platform risk.

## Scope discipline

No full dashboard, forecasting, daily automation, AWS resources or deployment yet.
No commit, push or deployment has been performed.
