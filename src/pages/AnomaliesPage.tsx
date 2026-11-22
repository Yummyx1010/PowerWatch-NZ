import { usePowerWatchData } from "../components/DataProvider";
import { ChartFrame, DataCard, PageIntro, PlannedPanel, SectionHeading, StatePanel } from "../components/ui";
import { formatCompact, formatCount, formatNzd } from "../lib/format";

export function AnomaliesPage() {
  const { data, loading, freshness, reload } = usePowerWatchData();
  const quality = data.quality;

  if (loading && !quality) {
    return <StatePanel tone="loading" title="Reading quality report" message="Loading data-quality evidence…" />;
  }

  if (freshness === "error" || !quality) {
    return (
      <StatePanel
        tone="error"
        title="Quality evidence unavailable"
        message={data.errors.join(" · ") || "No quality report found."}
        action={<button className="button button--ghost" type="button" onClick={reload}>Retry</button>}
      />
    );
  }

  return (
    <div className="page page--anomalies">
      <div className="shell">
        <PageIntro
          eyebrow="Price anomaly intelligence"
          title="Strange days deserve"
          accent="an explanation."
          lede="Detection is not implemented yet. What you see here is real data-quality evidence that M5 will investigate — clearly labelled, never presented as finished anomaly calls."
          badge="Detection planned · M5"
        />

        <section className="section">
          <SectionHeading
            index="01"
            title="Evidence already in the data"
            note="These are validated quality signals from 12.6 million real price rows."
          />
          <div className="evidence-grid">
            <DataCard
              label="Highest observed price"
              value={formatNzd(quality.priceMax)}
              hint="Real nodal maximum · not yet classified"
              tone="coral"
            />
            <DataCard
              label="Lowest observed price"
              value={formatNzd(quality.priceMin)}
              hint="Negative prices exist in the wholesale market"
              tone="violet"
            />
            <DataCard
              label="Negative price rows"
              value={formatCompact(quality.totals.negativePrices)}
              hint="Candidates for spike/drop review"
              tone="lime"
            />
            <DataCard
              label="Incomplete node-days"
              value={formatCount(quality.totals.incompleteNodeDays)}
              hint="Missing trading periods in source files"
              tone="sky"
            />
          </div>
        </section>

        <section className="section anomalies-split">
          <ChartFrame
            title="Event timeline"
            subtitle="Detected and explained events will appear here."
            status="planned"
          >
            <div className="event-lane" aria-label="Planned anomaly event lane">
              {["spike", "drop", "volatility", "gap"].map((label) => (
                <span key={label} className="event-lane__marker">{label}</span>
              ))}
              <p>No anomaly calls are fabricated at this stage.</p>
            </div>
          </ChartFrame>

          <div className="method-stack">
            <SectionHeading index="02" title="How detection will work" />
            <ol className="method-steps">
              <li><span>1</span><strong>Robust baseline</strong><p>Median and MAD by node and season, not a naive global mean.</p></li>
              <li><span>2</span><strong>Event clustering</strong><p>Adjacent half-hours grouped into one market event.</p></li>
              <li><span>3</span><strong>Context layer</strong><p>Demand, island and neighbouring-node behaviour added before explanation.</p></li>
              <li><span>4</span><strong>Honest language</strong><p>Correlation and context, never invented causality.</p></li>
            </ol>
          </div>
        </section>

        <section className="section">
          <PlannedPanel
            title="Anomaly detail view"
            milestone="M5"
            description="Severity, duration, node, comparison baseline and plain-language explanation on one screen."
          />
        </section>
      </div>
    </div>
  );
}
