# NZ PowerWatch

A modern, public-data product for exploring New Zealand's wholesale electricity market.
This repository currently contains **M0 — Data Discovery & Project Foundation** only.

## What works in M0

- React + TypeScript + Vite front end with a distinctive "Playful Tech" design foundation.
- Python pipeline that downloads real Electricity Authority CSV files and normalises two
  different official layouts into one canonical schema.
- A small, reproducible real-data sample (CSV + Parquet) and a JSON summary consumed by the app.
- Documentation of verified sources, licensing, schema, quality checks and data limitations.
- Automated tests for both the Python pipeline and the React foundation.
- No database, backend server, paid API, Astro, or deployment automation.

## Quick start

Frontend:

```bash
npm install
npm run dev
```

Python data pipeline:

```bash
python -m pip install -r requirements.txt
python -m pipeline.cli download          # real files -> data/raw/ (gitignored)
python -m pipeline.cli export            # sample -> data/samples/, summary -> public/data/
python -m pipeline.cli profile data/raw/20261119_FinalEnergyPrices.csv
```

Tests and typecheck:

```bash
pytest
npm test
npm run build
```

On Windows, Vitest 4 has a known issue when launched from a lower-case drive path
(`d:/...`): suites can fail before running with `Cannot read properties of undefined
(reading 'config')`. Run tests from an upper-case drive path (`cd /d D:\prog\github-files\PowerWatch`)
until the upstream fix lands. This is a test-runner quirk, not a product failure.

`npm run build` runs `tsc --noEmit` then Vite, producing a fully static `dist/` directory
that can be served from GitHub Pages with no server-side runtime.

## Project layout

```text
pipeline/                 Python ingestion, normalisation, profiling, export
  config.py               Verified URLs, node definitions, sample manifest
  download.py             Deterministic downloads and SHA-256 checks
  profile.py              Canonical schema and data-quality metrics
  export.py               Sample CSV/Parquet + frontend JSON summary
  cli.py                  python -m pipeline.cli ...
data/raw/                 Full-size source downloads (gitignored)
data/samples/             Small committed real-data samples
public/data/              Static JSON consumed by React
src/                      React app, components, styles and helpers
tests/                    Python and Vitest test suites
docs/                     Data-source and data-quality findings
```

## Data attribution

Price data: **Electricity Authority (New Zealand)** —
`www.emi.ea.govt.nz provided by the Electricity Authority (New Zealand)`.
Licensed under CC BY 4.0. See `docs/data-sources.md` for exact URLs, exclusions and platform risk.

## Scope discipline

M0 does **not** include a full dashboard, forecasting, daily automation, AWS resources or
deployment. Those are separate milestones. No commit, push or deployment has been performed.
