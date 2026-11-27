# NZ PowerWatch pipeline (M1)

## Design

The pipeline is deliberately file-based and database-free:

1. **Discover** official monthly/daily files and classify each as `ok`, `interim`, `incomplete`
   or `missing`.
2. **Sync** incrementally into `data/raw/`, recording URL, period, price status, byte size,
   SHA-256 and source `Last-Modified` in `data/manifest.json`. Unchanged local files are reused;
   revised upstream files are recorded with `revisedFrom` and rebuilt.
3. **Clean** each source into the canonical schema in `docs/data-dictionary.md`, preserving
   `raw_price`, source filename/URL, node mapping status and DST-resolved timestamps.
4. **Validate** every source for duplicates, missing values, incomplete node-days, inconsistent
   period counts and price-status distribution.
5. **Export** Parquet + gzip CSV per month/status into gitignored `data/processed/`, plus compact
   versioned JSON into `public/data/v1/` for React. M4 adds `regional.json`, an all-node daily-mean
   matrix with official NZTM-derived coordinates, written as minified JSON to keep static payloads
   small (about 1.8 MB raw / 0.7 MB gzipped for 249 nodes × 1,087 dates). 217 nodes are map-eligible:
   214 direct NSP coordinates plus three labelled same-substation proxies for the representative
   GXP price codes. The browser map uses a compact public-domain Natural Earth coastline.

No local timestamp is written into outputs, so repeated runs are byte-identical.

## Commands

```bash
python -m pipeline.cli sync    # discover + incremental download + manifest
python -m pipeline.cli build   # clean + validate + export
python -m pipeline.cli run     # sync then build
python -m pipeline.cli status  # print coverage and source status
python -m pipeline.cli --help
```

Useful options:

- `sync --start YYYY-MM-DD --end YYYY-MM-DD --force`
- `build --force` to rebuild every source even when checksums are unchanged.

## DST policy

Implemented in `pipeline/timeutil.py` and vectorised in `pipeline/clean.py`, following the
Electricity Authority's published rule:

- normal NZST day: 48 periods, UTC = local midnight − 12h + `(p−1)×30m`
- normal NZDT day: 48 periods, UTC = local midnight − 13h + `(p−1)×30m`
- DST start (last Sunday in September): 46 periods, UTC = midnight − 12h + `(p−1)×30m`
- DST end (first Sunday in April): 50 periods; periods 7–8 use midnight − 10h + `(p−7)×30m`,
  all others midnight − 13h + `(p−1)×30m`

No records are dropped on transition days.

## Node mapping policy

`OTA2201`, `HAY2201` and `ISL2201` are not present as POC codes in the pinned
`NetworkSupplyPointsTable` snapshot. `pipeline/nodes.py` applies explicit manual overrides and
sets `mapping_status = manual_override`. Other unmatched codes keep their original node value and
are labelled `region = Unmapped`, `island = Unknown`, `mapping_status = unmatched`. No pricing
records are discarded.

## Incremental and revised sources

`sync` compares the local SHA-256 with the manifest. If the upstream file changes, the new hash
is stored together with `revisedFrom`, and `build` reprocesses that source. Missing or incomplete
files never produce fabricated rows; they become explicit gaps in coverage.
