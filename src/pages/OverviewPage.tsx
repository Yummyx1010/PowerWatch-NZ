import { SignalCard } from "../components/SignalCard";
import { DataCard, PlannedPanel, SectionHeading, StatePanel } from "../components/ui";
import { usePowerWatchData } from "../components/DataProvider";
import { formatCompact, formatCount, formatNzd, formatShortDate } from "../lib/format";
import { ROUTES, type RouteId } from "../lib/router";

export function OverviewPage({ navigate }: { navigate: (route: RouteId) => void }) {
  const { data, loading, freshness, reload } = usePowerWatchData();
  const quality = data.quality;
  const coverage = data.manifest?.coverage;

  return (
    <div className="page page--overview">
      <section className="hero" aria-labelledby="hero-title">
        <div className="shell hero__grid">
          <div>
            <p className="eyebrow">Wholesale electricity intelligence · Aotearoa NZ</p>
            <h1 id="hero-title">
              The market has a <em>pulse.</em>
            </h1>
            <p className="hero__lede">
              NZ PowerWatch turns public Electricity Authority data into clear stories about price
              movement, regional difference and strange market days. This is the foundation
              release: verified data, a distinct visual language, and a roadmap you can follow.
            </p>
            <div className="hero__actions">
              <a
                className="button button--primary"
                href={ROUTES[1].path}
                onClick={(event) => {
                  event.preventDefault();
                  navigate("regions");
                }}
              >
                Explore the shape of it <span aria-hidden="true">→</span>
              </a>
              <a
                className="button button--ghost"
                href={ROUTES[4].path}
                onClick={(event) => {
                  event.preventDefault();
                  navigate("method");
                }}
              >
                See where data comes from
              </a>
            </div>
          </div>
          <SignalCard data={data} loading={loading} />
        </div>
      </section>

      <div className="shell page__body">
        {freshness === "error" ? (
          <StatePanel
            tone="error"
            title="Data payloads did not load"
            message={data.errors.join(" · ") || "The static JSON files are unavailable."}
            action={
              <button className="button button--ghost" type="button" onClick={reload}>
                Retry loading
              </button>
            }
          />
        ) : null}

        <section className="section">
          <SectionHeading
            index="01"
            title="The foundation is real."
            note="Every number below comes from the committed M1 manifest and quality report."
          />
          <div className="stat-rail">
            <DataCard
              label="Standardised rows"
              value={formatCompact(quality?.totals.rows)}
              hint="3 years of half-hourly nodal prices"
              tone="violet"
            />
            <DataCard
              label="Final-price days"
              value={formatCount(coverage?.finalDays)}
              hint={coverage ? `${formatShortDate(coverage.firstFinalDate)} → ${formatShortDate(coverage.lastFinalDate)}` : "—"}
              tone="lime"
            />
            <DataCard
              label="Observed range"
              value={
                quality?.priceMin !== null && quality?.priceMax !== null
                  ? `${formatNzd(quality?.priceMin)} → ${formatNzd(quality?.priceMax)}`
                  : "—"
              }
              hint="Real nodal prices, including negative events"
              tone="coral"
            />
            <DataCard
              label="Known gap"
              value={formatCount(coverage?.gapDays)}
              hint={coverage?.gaps[0] ? `${formatShortDate(coverage.gaps[0].start)} → ${formatShortDate(coverage.gaps[0].end)}` : "—"}
              tone="sky"
            />
          </div>
        </section>

        <section className="section">
          <SectionHeading
            index="02"
            title="What lands next."
            note="The visual system and navigation are in place. Analysis arrives one milestone at a time."
          />
          <div className="planned-grid">
            <PlannedPanel
              title="Market pulse & movers"
              milestone="M3"
              description="Daily price level, direction and a plain-language market story."
            />
            <PlannedPanel
              title="Regional spread view"
              milestone="M4"
              description="Node comparison across Auckland, Wellington and Christchurch."
            />
            <PlannedPanel
              title="Explained anomalies"
              milestone="M5"
              description="Spikes, drops and volatility bursts with context attached."
            />
            <PlannedPanel
              title="Seasonality lab"
              milestone="M6"
              description="Trends, distributions and the shape of the price year."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
