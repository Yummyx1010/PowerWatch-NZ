import { useMemo, useState } from "react";
import { RegionalCompare } from "../components/RegionalCompare";
import { usePowerWatchData } from "../components/DataProvider";
import { Panel, StatePanel } from "../components/ui";
import { formatCount, formatNzd, formatShortDate } from "../lib/format";
import { colorForNode } from "../lib/nodeColors";
import { ROUTES, type RouteId } from "../lib/router";
import type { RegionalNode } from "../lib/data";

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function OverviewPage({ navigate }: { navigate: (route: RouteId) => void }) {
  const { data, loading, freshness, reload } = usePowerWatchData();
  const regional = data.regional;
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    regional?.representativeNodes ?? [],
  );
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    if (!regional) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return regional.nodes
      .filter((node) =>
        node.label.toLowerCase().includes(needle) ||
        node.code.toLowerCase().includes(needle) ||
        node.region.toLowerCase().includes(needle),
      )
      .slice(0, 8);
  }, [regional, query]);

  if (!regional) {
    return (
      <div className="shell">
        <StatePanel
          tone={loading ? "loading" : "error"}
          title={loading ? "Reading market snapshot" : "Market snapshot unavailable"}
          message={
            loading
              ? "Loading all-node wholesale prices…"
              : data.errors.join(" · ") || "regional.json could not be loaded."
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

  const latestIndex = regional.dates.length - 1;
  const latestDate = regional.dates[latestIndex] ?? "—";
  const latestStatus = regional.dateStatus[latestIndex] ?? "—";
  const withLatest = regional.nodes.filter((node) => node.latest !== null);
  const marketValues = withLatest.map((node) => node.latest as number);
  const marketMean = mean(marketValues);
  const marketMedian = median(marketValues);
  const marketHigh = withLatest.reduce<RegionalNode | null>(
    (best, node) => (!best || (node.latest ?? 0) > (best.latest ?? 0) ? node : best),
    null,
  );
  const marketLow = withLatest.reduce<RegionalNode | null>(
    (best, node) => (!best || (node.latest ?? 0) < (best.latest ?? 0) ? node : best),
    null,
  );
  const marketSpread = marketHigh && marketLow ? (marketHigh.latest ?? 0) - (marketLow.latest ?? 0) : 0;
  const negativeNodes = withLatest.filter((node) => (node.latest ?? 0) < 0).length;

  const selectedNodes = regional.nodes.filter((node) => selectedCodes.includes(node.code));
  const selectedValues = selectedNodes
    .filter((node) => node.latest !== null)
    .map((node) => node.latest as number);
  const selectedMean = mean(selectedValues);
  const selectedSpread = selectedValues.length
    ? Math.max(...selectedValues) - Math.min(...selectedValues)
    : 0;
  const selectedVolatility = mean(
    selectedNodes
      .map((node) => node.volatility7d)
      .filter((value): value is number => value !== null),
  );
  const selectedHigh = selectedNodes.reduce<RegionalNode | null>(
    (best, node) => (!best || (node.latest ?? 0) > (best.latest ?? 0) ? node : best),
    null,
  );

  const toggleNode = (code: string) => {
    setSelectedCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

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
              Market-wide signals first. Select any pricing node to compare it with the market.
            </p>
          </div>
          <div className="page-header__side">
            <aside className="hero-tick hero-tick--compact" aria-label="Market-wide snapshot">
              <p className="hero-tick__label">
                Market snapshot · {formatShortDate(latestDate)} · {latestStatus}
              </p>
              <div className="hero-tick__prices">
                <div className="hero-tick__row">
                  <i style={{ background: "var(--violet)" }} aria-hidden="true" />
                  <span>Nodes priced</span>
                  <strong>{formatCount(withLatest.length)}</strong>
                  <small>/{formatCount(regional.nodeCount)}</small>
                </div>
                <div className="hero-tick__row">
                  <i style={{ background: "var(--coral)" }} aria-hidden="true" />
                  <span>Market spread</span>
                  <strong>{formatNzd(marketSpread)}</strong>
                  <small>NZ$/MWh</small>
                </div>
              </div>
            </aside>
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
          <StatePanel tone="stale" title="Static snapshot" message="Check Data & Methodology for the current data version." />
        ) : null}

        <div className="market-ribbon" aria-label="Market-wide and selected-node metrics">
          <div>
            <span className="market-ribbon__label"><i aria-hidden="true" /> Market mean</span>
            <strong className="market-ribbon__value">{formatNzd(marketMean)}</strong>
            <span className="market-ribbon__hint">All {formatCount(withLatest.length)} priced nodes · NZ$/MWh</span>
          </div>
          <div>
            <span className="market-ribbon__label"><i aria-hidden="true" /> Market median</span>
            <strong className="market-ribbon__value">{formatNzd(marketMedian)}</strong>
            <span className="market-ribbon__hint">Robust centre of today's node distribution</span>
          </div>
          <div>
            <span className="market-ribbon__label"><i className="interim" aria-hidden="true" /> Selected mean</span>
            <strong className="market-ribbon__value">{formatNzd(selectedMean)}</strong>
            <span className="market-ribbon__hint">{formatCount(selectedCodes.length)} selected nodes · NZ$/MWh</span>
          </div>
          <div>
            <span className="market-ribbon__label"><i aria-hidden="true" /> Selected spread</span>
            <strong className="market-ribbon__value">{formatNzd(selectedSpread)}</strong>
            <span className="market-ribbon__hint">Within current selection · NZ$/MWh</span>
          </div>
        </div>

        <section className="dashboard" id="price-explorer" aria-label="Primary market view">
          <Panel
            title="Price explorer"
            note="Daily mean prices in NZ$/MWh. Default nodes are Otahuhu, Haywards and Islington; choose any node from the full dataset."
            flush
          >
            {selectedNodes.length ? (
              <RegionalCompare regional={regional} selectedNodes={selectedNodes} />
            ) : (
              <StatePanel tone="empty" title="No nodes selected" message="Search and select nodes to compare prices." />
            )}
          </Panel>

          <aside className="panel panel--story">
            <div className="panel__head">
              <h2>Compare nodes</h2>
              <p>Search by name, ID or region. Selections drive the chart and selected-node metrics.</p>
            </div>
            <div className="panel__body">
              <input
                type="search"
                value={query}
                placeholder="Search all 249 nodes…"
                aria-label="Search market nodes"
                className="overview-node-search"
                onChange={(event) => setQuery(event.target.value)}
              />
              {matches.length ? (
                <div className="overview-node-results">
                  {matches.map((node) => (
                    <button key={node.code} type="button" onClick={() => toggleNode(node.code)}>
                      <i style={{ background: colorForNode(node.code) }} />
                      <span>{node.label}</span>
                      <small>{node.code}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="selected-chips">
                {selectedNodes.map((node) => (
                  <button key={node.code} type="button" onClick={() => toggleNode(node.code)} aria-label={`Remove ${node.label}`}>
                    <i style={{ background: colorForNode(node.code) }} />
                    {node.label}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
              <p className="selected-note">
                Selected: {formatCount(selectedCodes.length)} nodes · mean {formatNzd(selectedMean)} · spread {formatNzd(selectedSpread)} · average 7d σ {formatNzd(selectedVolatility)}
              </p>
            </div>
          </aside>
        </section>

        <section className="section">
          <Panel title="Market story" note="Market-wide facts and selected-node facts are labelled separately. No cause is inferred.">
            <div className="market-story__columns">
              <ul className="insight-list">
                <li><strong>Market-wide</strong><span>{formatCount(withLatest.length)} priced nodes on {formatShortDate(latestDate)}; {latestStatus} data.</span></li>
                <li><strong>Market distribution</strong><span>Mean {formatNzd(marketMean)}, median {formatNzd(marketMedian)} · NZ$/MWh.</span></li>
                <li><strong>Market extremes</strong><span>{marketHigh?.label ?? "—"} {formatNzd(marketHigh?.latest)} vs {marketLow?.label ?? "—"} {formatNzd(marketLow?.latest)}.</span></li>
                <li><strong>Negative prices</strong><span>{formatCount(negativeNodes)} nodes below $0 in the latest observation.</span></li>
              </ul>
              <ul className="insight-list">
                <li><strong>Selected nodes</strong><span>{formatCount(selectedCodes.length)} nodes · mean {formatNzd(selectedMean)} NZ$/MWh.</span></li>
                <li><strong>Selected spread</strong><span>{formatNzd(selectedSpread)} NZ$/MWh within the current selection.</span></li>
                <li><strong>Highest selected</strong><span>{selectedHigh?.label ?? "—"} at {formatNzd(selectedHigh?.latest)} NZ$/MWh.</span></li>
                <li><strong>Comparable window</strong><span>Volatility uses the last 7 published trading dates per node.</span></li>
              </ul>
            </div>
          </Panel>
        </section>

        <section className="supporting" aria-label="Supporting context">
          <Panel title="Recent extremes" note="Market-wide extremes from the latest available trading day.">
            <ul className="data-list">
              <li><span>Highest node</span><strong>{formatNzd(marketHigh?.latest)}<small>{marketHigh?.label ?? "—"}</small></strong></li>
              <li><span>Lowest node</span><strong>{formatNzd(marketLow?.latest)}<small>{marketLow?.label ?? "—"}</small></strong></li>
              <li><span>Market spread</span><strong>{formatNzd(marketSpread)}<small>NZ$/MWh</small></strong></li>
            </ul>
          </Panel>
          <Panel title="Data freshness" note="Snapshot boundary and status.">
            <ul className="data-list">
              <li><span>Latest data</span><strong>{formatShortDate(latestDate)}</strong></li>
              <li><span>Price status</span><strong>{latestStatus}</strong></li>
              <li><span>Source files</span><strong>{formatCount(data.manifest?.sourceCount)}</strong></li>
              <li><span>Known gap</span><strong>{formatCount(data.manifest?.coverage.gapDays)} days</strong></li>
            </ul>
          </Panel>
        </section>
      </div>
    </div>
  );
}
