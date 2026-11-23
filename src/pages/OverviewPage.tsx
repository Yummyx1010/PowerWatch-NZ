import type { ReactNode } from "react";
import { PriceExplorer } from "../components/PriceExplorer";
import { usePowerWatchData } from "../components/DataProvider";
import { StatePanel } from "../components/ui";
import { formatCount, formatNzd, formatShortDate } from "../lib/format";
import { ROUTES, type RouteId } from "../lib/router";
import type { OverviewV1 } from "../lib/data";

const NODE_ORDER = ["OTA2201", "HAY2201", "ISL2201"];
const NODE_COLORS: Record<string, string> = {
  OTA2201: "#6b4cf1",
  HAY2201: "#ff7a63",
  ISL2201: "#179c8a",
};

function LatestTick({ overview, compact = false }: { overview: OverviewV1; compact?: boolean }) {
  const tick = overview.recent[overview.recent.length - 1];
  const prices = [...overview.metrics.latestPrices].sort(
    (a, b) => NODE_ORDER.indexOf(a.node) - NODE_ORDER.indexOf(b.node),
  );
  return (
    <aside
      className={`hero-tick${compact ? " hero-tick--compact" : ""}`}
      aria-label="Latest available half-hour prices"
    >
      <p className="hero-tick__label">
        Latest half-hour · {tick ? formatShortDate(tick.date) : "—"} · period {tick?.period ?? "—"}
      </p>
      <div className="hero-tick__prices">
        {prices.map((price) => (
          <div key={price.node} className="hero-tick__row">
            <i style={{ background: NODE_COLORS[price.node] }} aria-hidden="true" />
            <span>{price.label}</span>
            <strong>{formatNzd(price.price)}</strong>
            <small>{price.status}</small>
          </div>
        ))}
      </div>
      {!compact ? (
        <p className="hero-tick__foot">
          Nodal spot prices · dashed chart lines mark Interim values.
        </p>
      ) : null}
    </aside>
  );
}

function Panel({
  title,
  note,
  children,
  className = "",
  flush = false,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      <div className="panel__head">
        <h2>{title}</h2>
        {note ? <p>{note}</p> : null}
      </div>
      <div className={`panel__body${flush ? " panel__body--flush" : ""}`}>{children}</div>
    </section>
  );
}

export function OverviewPage({ navigate }: { navigate: (route: RouteId) => void }) {
  const { data, loading, freshness, reload } = usePowerWatchData();
  const overview = data.overview;
  const metrics = overview?.metrics;

  if (!overview || !metrics) {
    return (
      <div className="shell">
        <StatePanel
          tone={loading ? "loading" : "error"}
          title={loading ? "Reading market snapshot" : "Market snapshot unavailable"}
          message={
            loading
              ? "Loading real half-hourly prices and daily summaries…"
              : data.errors.join(" · ") || "overview.json could not be loaded."
          }
          action={
            loading ? undefined : (
              <button className="button button--ghost" type="button" onClick={reload}>Retry</button>
            )
          }
        />
      </div>
    );
  }

  const spread = metrics.regionalSpread;
  const volatility = metrics.volatility7d.OTA2201;
  const latestPrice = [...metrics.latestPrices].sort(
    (a, b) => NODE_ORDER.indexOf(a.node) - NODE_ORDER.indexOf(b.node),
  )[0];
  const latestDaily = [...metrics.latestDaily].sort(
    (a, b) => NODE_ORDER.indexOf(a.node) - NODE_ORDER.indexOf(b.node),
  );
  const maxMean = Math.max(...latestDaily.map((row) => row.mean), 1);
  const lastTick = overview.recent[overview.recent.length - 1];

  const recentTicks = overview.recent.filter((point) => typeof point.price === "number");
  const recentHigh = recentTicks.length
    ? recentTicks.reduce((best, point) => (point.price > best.price ? point : best))
    : null;
  const recentLow = recentTicks.length
    ? recentTicks.reduce((best, point) => (point.price < best.price ? point : best))
    : null;
  const windowStart = overview.recent[0]?.date;
  const windowEnd = lastTick?.date;
  const coverage = data.manifest?.coverage;
  const knownGap = coverage?.gaps?.[0];

  return (
    <div className="page page--overview">
      <section className="page-header" aria-labelledby="hero-title">
        <div className="shell page-header__inner">
          <div className="page-header__copy">
            <p className="eyebrow">Wholesale electricity intelligence · Aotearoa NZ</p>
            <h1 id="hero-title">
              The market has a <em>pulse.</em>
            </h1>
            <p className="page-header__lede">
              Real nodal prices. One primary trend. Node-level comparison without city-average claims.
            </p>
          </div>
          <div className="page-header__side">
            <LatestTick overview={overview} compact />
            <a
              className="page-header__method"
              href={ROUTES[4].path}
              onClick={(event) => {
                event.preventDefault();
                navigate("method");
              }}
            >
              Data & method <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      <div className="shell page__body">
        {freshness === "stale" ? (
          <StatePanel
            tone="stale"
            title="Static snapshot"
            message="This deployment uses a generated data snapshot. Check Data & Methodology for the current data version."
          />
        ) : null}

        <div className="market-ribbon" aria-label="Market snapshot">
          <div className="market-ribbon__item">
            <span className="market-ribbon__label">
              <i className={latestPrice?.status === "Interim" ? "interim" : ""} aria-hidden="true" />
              Latest price
            </span>
            <strong className="market-ribbon__value">{formatNzd(latestPrice?.price)}</strong>
            <span className="market-ribbon__hint">
              {latestPrice?.label} · {latestPrice?.status} · {formatShortDate(metrics.latestDate)}
            </span>
          </div>
          <div className="market-ribbon__item">
            <span className="market-ribbon__label"><i aria-hidden="true" /> 7d volatility</span>
            <strong className="market-ribbon__value">{formatNzd(volatility)}</strong>
            <span className="market-ribbon__hint">Otahuhu half-hour price σ</span>
          </div>
          <div className="market-ribbon__item">
            <span className="market-ribbon__label"><i aria-hidden="true" /> Node spread</span>
            <strong className="market-ribbon__value">{formatNzd(spread.difference)}</strong>
            <span className="market-ribbon__hint">
              {spread.highLabel} above {spread.lowLabel} · {spread.status}
            </span>
          </div>
          <div className="market-ribbon__item">
            <span className="market-ribbon__label"><i aria-hidden="true" /> Data window</span>
            <strong className="market-ribbon__value">{formatShortDate(metrics.latestFinalDate)}</strong>
            <span className="market-ribbon__hint">
              Last final day · interim through {formatShortDate(metrics.latestDate)}
            </span>
          </div>
        </div>

        <section className="dashboard" id="price-explorer" aria-label="Primary market view">
          <Panel
            title="Price explorer"
            note="Switch range and nodes. Drag to zoom into a period; hover for exact values and price status."
            flush
          >
            <PriceExplorer overview={overview} />
          </Panel>

          <aside className="panel panel--story">
            <div className="panel__head">
              <h2>Market story</h2>
              <p>Short, data-grounded takeaways. No cause is inferred.</p>
            </div>
            <div className="panel__body">
              <ul className="insight-list">
                <li>
                  <strong>Latest half-hour</strong>
                  <span>{lastTick?.local ?? "—"} · {lastTick?.status ?? "—"} status</span>
                </li>
                <li>
                  <strong>Node spread</strong>
                  <span>
                    {spread.highLabel} {formatNzd(spread.high)} → {spread.lowLabel} {formatNzd(spread.low)}
                  </span>
                </li>
                <li>
                  <strong>7d volatility</strong>
                  <span>Otahuhu half-hour σ {formatNzd(volatility)}</span>
                </li>
                {metrics.largestMove ? (
                  <li>
                    <strong>Largest daily move</strong>
                    <span>
                      {metrics.largestMove.label} · {formatShortDate(metrics.largestMove.date)} ·{" "}
                      {formatNzd(metrics.largestMove.change)}
                    </span>
                  </li>
                ) : null}
                <li>
                  <strong>30-day ratio flags</strong>
                  <span>
                    {metrics.notable.length} node{metrics.notable.length === 1 ? "" : "s"} flagged ·{" "}
                    {metrics.negativeRecentPrices} negative half-hours
                  </span>
                </li>
              </ul>

              <details className="market-story__rules">
                <summary>Calculation rules</summary>
                <dl>
                  {Object.entries(overview.definitions).map(([key, text]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </div>
            <div className="panel__foot">
              <span>Electricity Authority public wholesale CSV</span>
              <span>
                {formatCount(overview.recent.length)} half-hour records ·{" "}
                {formatCount(overview.daily.length)} daily aggregates
              </span>
            </div>
          </aside>
        </section>

        <section className="supporting" aria-label="Supporting context">
          <Panel
            title="Regional snapshot"
            note="Representative node daily means on the latest trading day. Not official city-wide averages."
          >
            <div className="regional-snapshot">
              {latestDaily.map((row) => (
                <div key={row.node} className="regional-snapshot__row">
                  <span className="regional-snapshot__label">
                    <strong>{row.label}</strong>
                    <small>{row.node}</small>
                  </span>
                  <span className="regional-snapshot__bar">
                    <i
                      style={{
                        width: `${Math.max(4, (row.mean / maxMean) * 100)}%`,
                        background: NODE_COLORS[row.node],
                      }}
                    />
                  </span>
                  <span className="regional-snapshot__value">
                    {formatNzd(row.mean)}
                    <small>{row.status}</small>
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Recent extremes"
            note={`Half-hour extremes across the loaded window ${formatShortDate(windowStart)} → ${formatShortDate(windowEnd)}.`}
          >
            <ul className="data-list">
              <li>
                <span>Recent high</span>
                <strong>
                  {recentHigh ? formatNzd(recentHigh.price) : "—"}
                  <small>{recentHigh ? `${recentHigh.label} · ${recentHigh.local}` : "—"}</small>
                </strong>
              </li>
              <li>
                <span>Recent low</span>
                <strong>
                  {recentLow ? formatNzd(recentLow.price) : "—"}
                  <small>{recentLow ? `${recentLow.label} · ${recentLow.local}` : "—"}</small>
                </strong>
              </li>
              <li>
                <span>Largest daily move</span>
                <strong>
                  {metrics.largestMove ? formatNzd(metrics.largestMove.change) : "—"}
                  <small>{metrics.largestMove ? metrics.largestMove.label : "—"}</small>
                </strong>
              </li>
              <li>
                <span>Negative half-hours</span>
                <strong>
                  {formatCount(metrics.negativeRecentPrices)}
                  <small>Observed values only</small>
                </strong>
              </li>
            </ul>
          </Panel>

          <Panel title="Data freshness" note="Snapshot version, price-status boundary and known coverage gap.">
            <ul className="data-list">
              <li>
                <span>Snapshot version</span>
                <strong>{data.manifest?.dataVersion ?? "—"}</strong>
              </li>
              <li>
                <span>Final data through</span>
                <strong>{formatShortDate(metrics.latestFinalDate)}</strong>
              </li>
              <li>
                <span>Interim available through</span>
                <strong>{formatShortDate(metrics.latestDate)}</strong>
              </li>
              <li>
                <span>Source files</span>
                <strong>{formatCount(data.manifest?.sourceCount)}</strong>
              </li>
              <li>
                <span>Known gap</span>
                <strong>
                  {formatCount(coverage?.gapDays)} days
                  <small>
                    {knownGap
                      ? `${formatShortDate(knownGap.start)} → ${formatShortDate(knownGap.end)}`
                      : "None in requested range"}
                  </small>
                </strong>
              </li>
            </ul>
          </Panel>
        </section>
      </div>
    </div>
  );
}
