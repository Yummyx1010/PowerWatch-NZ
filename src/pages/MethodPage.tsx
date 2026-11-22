import { usePowerWatchData } from "../components/DataProvider";
import { PageIntro, SectionHeading, StatePanel } from "../components/ui";
import { formatCompact, formatCount, formatNzd, formatShortDate } from "../lib/format";

const SOURCES = [
  {
    name: "Final energy prices · monthly archive",
    detail: "Complete published months, 2002 → 2026. Used for the three-year backfill.",
    url: "https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/DispatchAndPricing/FinalEnergyPrices/ByMonth/",
  },
  {
    name: "Final energy prices · daily files",
    detail: "Most recent days after interim prices are declared final.",
    url: "https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/DispatchAndPricing/FinalEnergyPrices/",
  },
  {
    name: "Interim energy prices · daily",
    detail: "Unstable newest days, kept separate and clearly labelled.",
    url: "https://emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/",
  },
  {
    name: "Network Supply Points table",
    detail: "POC-to-region / island mapping, with manual overrides for three GXP nodes.",
    url: "https://emidatasets.blob.core.windows.net/publicdata/Datasets/Wholesale/MappingsAndGeospatial/NetworkSupplyPointsTable/",
  },
];

export function MethodPage() {
  const { data, loading, freshness, reload } = usePowerWatchData();
  const manifest = data.manifest;
  const quality = data.quality;

  if (loading && !manifest) {
    return <StatePanel tone="loading" title="Reading methodology" message="Loading manifest and quality report…" />;
  }

  if (freshness === "error" || !manifest || !quality) {
    return (
      <StatePanel
        tone="error"
        title="Methodology data unavailable"
        message={data.errors.join(" · ") || "Manifest or quality report is missing."}
        action={<button className="button button--ghost" type="button" onClick={reload}>Retry</button>}
      />
    );
  }

  const checks = [
    { label: "Duplicate natural keys", value: formatCount(quality.totals.duplicateKeys) },
    { label: "Missing core fields", value: formatCount(Object.values(quality.missingByColumn).reduce((a, b) => a + b, 0)) },
    { label: "Incomplete node-days", value: formatCount(quality.totals.incompleteNodeDays) },
    { label: "Negative price rows", value: formatCount(quality.totals.negativePrices) },
    { label: "Zero price rows", value: formatCount(quality.totals.zeroPrices) },
    { label: "Final / interim rows", value: `${formatCompact(quality.priceStatusCounts.Final)} / ${formatCompact(quality.priceStatusCounts.Interim)}` },
  ];

  return (
    <div className="page page--method">
      <div className="shell">
        <PageIntro
          eyebrow="Data & methodology"
          title="Receipts, not"
          accent="vibes."
          lede="A portfolio product should be able to show its work. This page documents where the data comes from, how it is versioned and what the current snapshot does — and does not — prove."
          badge={`Snapshot ${manifest.dataVersion}`}
        />

        <section className="section method-source-grid">
          <div>
            <SectionHeading index="01" title="Sources" note="Public, official and free. No paid APIs." />
            <div className="source-list">
              {SOURCES.map((source) => (
                <a key={source.name} href={source.url} target="_blank" rel="noreferrer" className="source-item">
                  <span className="source-item__arrow" aria-hidden="true">↗</span>
                  <div>
                    <strong>{source.name}</strong>
                    <p>{source.detail}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
          <aside className="method-facts">
            <span className="method-facts__label">SNAPSHOT FACTS</span>
            <dl>
              <div><dt>Source files</dt><dd>{formatCount(manifest.sourceCount)}</dd></div>
              <div><dt>Requested range</dt><dd>{formatShortDate(manifest.coverage.requestedStart)} → {formatShortDate(manifest.coverage.requestedEnd)}</dd></div>
              <div><dt>Final coverage</dt><dd>{formatShortDate(manifest.coverage.firstFinalDate)} → {formatShortDate(manifest.coverage.lastFinalDate)}</dd></div>
              <div><dt>Documented gap</dt><dd>{formatCount(manifest.coverage.gapDays)} days</dd></div>
              <div><dt>Observed range</dt><dd>{formatNzd(quality.priceMin)} → {formatNzd(quality.priceMax)}</dd></div>
            </dl>
          </aside>
        </section>

        <section className="section">
          <SectionHeading index="02" title="Quality checks actually run" note="Results from the committed M1 quality report." />
          <div className="quality-table">
            {checks.map((check) => (
              <div key={check.label}>
                <span>{check.label}</span>
                <strong>{check.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="section method-time-grid">
          <div>
            <SectionHeading index="03" title="Time, properly handled" note="Official NZST / NZDT trading-period rule." />
            <div className="time-table">
              <div><span>Normal standard day</span><strong>48 periods · UTC+12</strong></div>
              <div><span>Normal daylight day</span><strong>48 periods · UTC+13</strong></div>
              <div><span>Last Sunday in September</span><strong>46 periods · skipped hour</strong></div>
              <div><span>First Sunday in April</span><strong>50 periods · repeated hour</strong></div>
            </div>
          </div>
          <div className="attribution-block">
            <span>ATTRIBUTION</span>
            <p>{data.sample?.attribution ?? "www.emi.ea.govt.nz provided by the Electricity Authority (New Zealand)"}</p>
            <small>{data.sample?.licence ?? "CC BY 4.0 International"} · Independent portfolio project, not affiliated with the Electricity Authority.</small>
          </div>
        </section>
      </div>
    </div>
  );
}
