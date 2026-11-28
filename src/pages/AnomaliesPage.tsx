import { useMemo, useState } from "react";
import { AnomalyPriceContext } from "../components/AnomalyPriceContext";
import { AnomalyTimeline } from "../components/AnomalyTimeline";
import { usePowerWatchData } from "../components/DataProvider";
import { Panel, StatePanel } from "../components/ui";
import { formatCount, formatNzdPerMwh, formatShortDate } from "../lib/format";
import { colorForAnomalyType, colorForSeverity } from "../lib/nodeColors";
import type { AnomalyCluster, AnomalyEvent } from "../lib/data";

type RangeId = "7D" | "30D" | "90D" | "ALL";
const RANGES: Array<{ id: RangeId; label: string; days: number | null }> = [
  { id: "7D", label: "7 days", days: 7 },
  { id: "30D", label: "30 days", days: 30 },
  { id: "90D", label: "90 days", days: 90 },
  { id: "ALL", label: "All", days: null },
];
const TIERS = ["critical", "high", "medium", "low"];

function shiftDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function typeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function classLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function durationLabel(days: number): string {
  return `${days} published day${days === 1 ? "" : "s"}`;
}

function clusterClassLabel(cluster: AnomalyCluster): string {
  if (cluster.classification === "market_event_only") return "Market events only";
  if (cluster.classification === "mixed") return "Mixed";
  return "Statistical";
}

function islandLabel(value: string): string {
  if (value === "NI") return "North Island";
  if (value === "SI") return "South Island";
  return value;
}

export function AnomaliesPage() {
  const { data, loading, freshness, reload } = usePowerWatchData();
  const anomalies = data.anomalies;
  const [range, setRange] = useState<RangeId>("90D");
  const [type, setType] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [island, setIsland] = useState("ALL");
  const [query, setQuery] = useState("");
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!anomalies) return [];
    const latest = anomalies.coverage.end ?? "";
    const config = RANGES.find((item) => item.id === range)!;
    const cutoff = config.days ? shiftDays(latest, config.days - 1) : "0000-00-00";
    const needle = query.trim().toLowerCase();
    return anomalies.events
      .filter((event) => event.peakDate >= cutoff)
      .filter((event) => type === "ALL" || event.type === type)
      .filter((event) => severity === "ALL" || event.tier === severity)
      .filter((event) => island === "ALL" || event.island === island)
      .filter((event) => !focusDate || (event.start <= focusDate && event.end >= focusDate))
      .filter((event) =>
        !needle ||
        event.label.toLowerCase().includes(needle) ||
        event.node.toLowerCase().includes(needle) ||
        event.region.toLowerCase().includes(needle) ||
        event.id.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.peakDate.localeCompare(a.peakDate) || b.severity - a.severity);
  }, [anomalies, range, type, severity, island, query, focusDate]);

  const topEvents = useMemo(() => {
    if (!anomalies) return [];
    return [...anomalies.events]
      .filter((event) => event.classification === "statistical_anomaly")
      .sort(
        (a, b) =>
          b.severity - a.severity ||
          b.duration - a.duration ||
          b.peakDate.localeCompare(a.peakDate),
      )
      .slice(0, 6);
  }, [anomalies]);

  if (!anomalies) {
    return (
      <div className="shell">
        <StatePanel
          tone={loading ? "loading" : "error"}
          title={loading ? "Reading anomaly dataset" : "Anomaly dataset unavailable"}
          message={
            loading
              ? "Detecting events across the full nodal price history…"
              : data.errors.join(" · ") || "anomalies.json could not be loaded."
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

  const displayed = filtered.slice(0, 100);
  const selected: AnomalyEvent | undefined =
    filtered.find((event) => event.id === selectedId) ?? filtered[0];
  const relatedCluster = selected
    ? anomalies.clusters.find((cluster) => cluster.eventIds.includes(selected.id))
    : undefined;
  const highCount = (anomalies.summary.byTier.high ?? 0) + (anomalies.summary.byTier.critical ?? 0);
  const coverageLabel = `${formatShortDate(anomalies.coverage.start)} – ${formatShortDate(anomalies.coverage.end)}`;
  const rangeLabel = RANGES.find((item) => item.id === range)!.label;
  const hasActiveFilters =
    range !== "90D" ||
    type !== "ALL" ||
    severity !== "ALL" ||
    island !== "ALL" ||
    query.trim() !== "" ||
    focusDate !== null;

  function resetView() {
    setRange("90D");
    setType("ALL");
    setSeverity("ALL");
    setIsland("ALL");
    setQuery("");
    setFocusDate(null);
    setSelectedId(null);
  }

  function focusEvent(event: AnomalyEvent) {
    setRange("ALL");
    setType("ALL");
    setSeverity("ALL");
    setIsland("ALL");
    setQuery("");
    setFocusDate(null);
    setSelectedId(event.id);
  }

  function focusCluster(cluster: AnomalyCluster) {
    setRange("ALL");
    setType("ALL");
    setSeverity("ALL");
    setIsland("ALL");
    setQuery("");
    setFocusDate(cluster.date);
    setSelectedId(cluster.eventIds[0] ?? null);
  }

  function focusPattern(node: string, patternType: string) {
    setRange("ALL");
    setType(patternType);
    setSeverity("ALL");
    setIsland("ALL");
    setQuery(node);
    setFocusDate(null);
    setSelectedId(null);
  }

  const typeEntries = Object.entries(anomalies.summary.byType).sort((a, b) => b[1] - a[1]);
  const maxTypeCount = Math.max(1, ...typeEntries.map((entry) => entry[1]));
  const tierEntries = TIERS.map((tier) => [tier, anomalies.summary.byTier[tier] ?? 0] as const).filter(
    (entry) => entry[1] > 0,
  );
  const monthEntries = Object.entries(anomalies.summary.byMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-24);
  const maxMonthCount = Math.max(1, ...monthEntries.map((entry) => entry[1]));
  const maxPatternCount = Math.max(1, ...anomalies.patterns.map((pattern) => pattern.count));
  const rankedClusters = [...anomalies.clusters]
    .sort(
      (a, b) =>
        b.maxSeverity - a.maxSeverity ||
        b.nodeCount - a.nodeCount ||
        b.date.localeCompare(a.date),
    )
    .slice(0, 8);

  return (
    <div className="page page--anomalies-full">
      <header className="module-header">
        <div className="shell module-header__inner">
          <div>
            <p className="eyebrow">Price anomaly intelligence</p>
            <h1>
              Strange days, <em>carefully explained.</em>
            </h1>
            <p>Statistical flags and market events are separated. No cause is inferred.</p>
          </div>
          <span className="module-header__badge">
            {formatCount(anomalies.summary.eventCount)} events · {formatCount(anomalies.nodeCount)} nodes
          </span>
        </div>
      </header>

      <div className="shell page__body">
        {freshness === "stale" ? (
          <StatePanel tone="stale" title="Static snapshot" message="Check Data & Methodology for the current data version." />
        ) : null}

        <div className="anomaly-section-label">
          <span>Full-history summary</span>
          <small>{coverageLabel} · these totals do not change with the filters below</small>
        </div>
        <div className="module-ribbon anomaly-ribbon" aria-label="Anomaly summary">
          <div><span>Statistical flags</span><strong>{formatCount(anomalies.summary.statisticalCount)}</strong><small>Robust z-score / volatility / divergence</small></div>
          <div><span>Market events</span><strong>{formatCount(anomalies.summary.marketEventCount)}</strong><small>Negative prices, not automatic anomalies</small></div>
          <div><span>High / critical</span><strong>{formatCount(highCount)}</strong><small>Severity 65 and above</small></div>
          <div><span>Simultaneous clusters</span><strong>{formatCount(anomalies.summary.simultaneousClusters)}</strong><small>Across multiple nodes or types</small></div>
        </div>

        <section className="anomaly-highlights" aria-label="Most significant historical anomalies">
          <div className="anomaly-highlights__head">
            <strong>Most significant</strong>
            <span>All history · highest severity, then duration</span>
          </div>
          <div className="anomaly-highlights__items">
            {topEvents.map((event) => (
              <button key={event.id} type="button" onClick={() => focusEvent(event)}>
                <span className="anomaly-highlights__score" style={{ background: colorForSeverity(event.tier) }}>
                  {event.severity}
                </span>
                <span className="anomaly-highlights__copy">
                  <strong>{event.label}</strong>
                  <small>{event.node} · {formatShortDate(event.peakDate)} · {durationLabel(event.duration)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <Panel title="Event timeline" note="Every matching event is plotted. Select a marker or list row to inspect it." flush>
          <div className="anomaly-filters">
            <input
              type="search"
              value={query}
              placeholder="Search label, node, ID or region…"
              aria-label="Search anomaly events"
              onChange={(event) => setQuery(event.target.value)}
            />
            <select value={type} aria-label="Filter anomaly type" onChange={(event) => setType(event.target.value)}>
              <option value="ALL">All types</option>
              {Object.keys(anomalies.summary.byType).map((item) => <option key={item} value={item}>{typeLabel(item)}</option>)}
            </select>
            <select value={severity} aria-label="Filter severity" onChange={(event) => setSeverity(event.target.value)}>
              <option value="ALL">All severities</option>
              {TIERS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={island} aria-label="Filter island" onChange={(event) => setIsland(event.target.value)}>
              <option value="ALL">All islands</option>
              <option value="NI">North Island</option>
              <option value="SI">South Island</option>
            </select>
            <div className="anomaly-filters__ranges" role="group" aria-label="Anomaly date range">
              {RANGES.map((item) => (
                <button key={item.id} type="button" aria-pressed={range === item.id} onClick={() => setRange(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="anomaly-view-status">
            <span>Currently filtered</span>
            <strong>{formatCount(filtered.length)}</strong>
            <small>
              {rangeLabel} · {type === "ALL" ? "all types" : typeLabel(type)} · {severity === "ALL" ? "all severities" : severity} · {island === "ALL" ? "all islands" : islandLabel(island)}
              {focusDate ? ` · cluster ${formatShortDate(focusDate)}` : ""}
            </small>
            {hasActiveFilters ? <button type="button" onClick={resetView}>Clear filters</button> : null}
          </div>

          <AnomalyTimeline events={filtered} selectedId={selected?.id ?? null} onSelect={(event) => setSelectedId(event.id)} />

          <div className="anomaly-legend">
            {Object.keys(anomalies.summary.byType).map((item) => (
              <span key={item}><i style={{ background: colorForAnomalyType(item) }} />{typeLabel(item)}</span>
            ))}
          </div>
        </Panel>

        <section className="anomaly-workspace">
          <Panel title="Detected events" note={`Currently filtered · ${formatCount(filtered.length)} matching · showing first ${formatCount(displayed.length)}`}>
            <div className="anomaly-list" role="list">
              {displayed.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  role="listitem"
                  className={`anomaly-row${selected?.id === event.id ? " anomaly-row--selected" : ""}`}
                  onClick={() => setSelectedId(event.id)}
                >
                  <span className="anomaly-row__bar" style={{ background: colorForSeverity(event.tier) }} />
                  <span className="anomaly-row__main">
                    <strong>{event.label} <em>{event.node}</em></strong>
                    <small>
                      {typeLabel(event.type)} · {formatShortDate(event.peakDate)} · {durationLabel(event.duration)} · {event.status}
                      {event.classification === "market_event" ? " · market" : ""}
                    </small>
                  </span>
                  <span className="anomaly-row__score">
                    <strong>{event.severity}</strong>
                    <small style={{ color: colorForSeverity(event.tier) }}>{event.tier}</small>
                  </span>
                </button>
              ))}
              {displayed.length === 0 ? <p className="anomaly-empty">No events match these filters.</p> : null}
            </div>
          </Panel>

          <Panel title="Event detail" note="Flags describe observed behaviour, not causes.">
            {selected ? (
              <div className="anomaly-detail">
                <div className="anomaly-detail__head">
                  <span className="anomaly-detail__badge" style={{ background: colorForAnomalyType(selected.type) }}>
                    {typeLabel(selected.type)}
                  </span>
                  <span
                    className={`anomaly-detail__tier anomaly-detail__tier--${selected.tier}`}
                    style={{ background: colorForSeverity(selected.tier), color: selected.tier === "low" || selected.tier === "medium" ? "#17202b" : "#fff" }}
                  >
                    {selected.tier} · {selected.severity}/100
                  </span>
                  <span className="anomaly-detail__class">{classLabel(selected.classification)}</span>
                </div>
                <h3>{selected.label} <small>{selected.node}</small></h3>
                <p className="anomaly-detail__meta">
                  {selected.region} · {islandLabel(selected.island)} · {selected.status} source price
                </p>
                <p className="anomaly-detail__period">
                  {formatShortDate(selected.start)}
                  {selected.start !== selected.end ? ` → ${formatShortDate(selected.end)}` : ""} · {durationLabel(selected.duration)} · peak {formatShortDate(selected.peakDate)}
                </p>
                <ul className="anomaly-reasons">
                  {selected.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                </ul>
                <div className="anomaly-stats">
                  <div><span>Peak daily mean</span><strong>{formatNzdPerMwh(selected.stats.price)}</strong></div>
                  <div><span>Daily minimum</span><strong>{formatNzdPerMwh(selected.stats.dailyMin)}</strong></div>
                  <div><span>Prior 30-day median</span><strong>{formatNzdPerMwh(selected.stats.rollingMedian)}</strong></div>
                  <div><span>Historic same-month median</span><strong>{formatNzdPerMwh(selected.stats.seasonalMedian)}</strong></div>
                  <div><span>Same-day all-node median</span><strong>{formatNzdPerMwh(selected.stats.crossMedian)}</strong></div>
                  <div><span>Local z</span><strong>{selected.stats.localZ}</strong></div>
                  <div><span>Seasonal z</span><strong>{selected.stats.seasonalZ}</strong></div>
                  <div><span>Volatility ratio</span><strong>{selected.stats.volatilityRatio}×</strong></div>
                </div>
                <AnomalyPriceContext event={selected} regional={data.regional} />
                {relatedCluster ? (
                  <div className="anomaly-detail__cluster">
                    <div className="anomaly-detail__cluster-head">
                      <strong>Simultaneous cluster · {clusterClassLabel(relatedCluster)}</strong>
                      <button type="button" onClick={() => focusCluster(relatedCluster)}>View cluster</button>
                    </div>
                    <small>
                      {formatShortDate(relatedCluster.date)} · {formatCount(relatedCluster.nodeCount)} nodes · {formatCount(relatedCluster.typeCount)} types · max {relatedCluster.maxSeverity}/100
                    </small>
                    <p>
                      {relatedCluster.nodes.slice(0, 10).join(", ")}
                      {relatedCluster.nodes.length > 10 ? "…" : ""}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <StatePanel tone="empty" title="No event selected" message="Select an event from the timeline or list." />
            )}
          </Panel>
        </section>

        <section className="anomaly-context">
          <Panel title="Distribution" note="All history · unaffected by current filters">
            <div className="anomaly-distribution">
              <div className="anomaly-distribution__group">
                <span className="anomaly-distribution__label">By type</span>
                {typeEntries.map(([item, count]) => (
                  <div key={item} className="anomaly-distribution__bar-row">
                    <span>{typeLabel(item)}</span>
                    <i><b style={{ width: `${(count / maxTypeCount) * 100}%`, background: colorForAnomalyType(item) }} /></i>
                    <strong>{formatCount(count)}</strong>
                  </div>
                ))}
              </div>
              <div className="anomaly-distribution__group">
                <span className="anomaly-distribution__label">Severity mix</span>
                <div className="anomaly-distribution__stack">
                  {tierEntries.map(([tier, count]) => (
                    <i
                      key={tier}
                      title={`${tier}: ${count}`}
                      style={{ width: `${(count / anomalies.summary.eventCount) * 100}%`, background: colorForSeverity(tier) }}
                    />
                  ))}
                </div>
                <div className="anomaly-distribution__tiers">
                  {tierEntries.map(([tier, count]) => <span key={tier}><i style={{ background: colorForSeverity(tier) }} />{tier} {formatCount(count)}</span>)}
                </div>
              </div>
              <div className="anomaly-distribution__group">
                <span className="anomaly-distribution__label">Last 24 event months</span>
                <div className="anomaly-distribution__months">
                  {monthEntries.map(([month, count]) => (
                    <i key={month} title={`${month}: ${count}`} style={{ height: `${Math.max(6, (count / maxMonthCount) * 100)}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Recurring patterns" note="All history · node/type pairs with the most events">
            <ul className="data-list anomaly-pattern-list">
              {anomalies.patterns.slice(0, 8).map((pattern) => (
                <li key={`${pattern.node}-${pattern.type}`}>
                  <button type="button" onClick={() => focusPattern(pattern.node, pattern.type)}>
                    <span>
                      <i style={{ background: colorForAnomalyType(pattern.type) }} />
                      {pattern.node} · {typeLabel(pattern.type)}
                    </span>
                    <strong>{formatCount(pattern.count)}<small>events</small></strong>
                    <i className="anomaly-pattern-list__track"><b style={{ width: `${(pattern.count / maxPatternCount) * 100}%` }} /></i>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Simultaneous clusters" note="All history · click a cluster to focus its events">
            <ul className="data-list anomaly-cluster-list">
              {rankedClusters.map((cluster) => (
                <li key={cluster.date}>
                  <button type="button" onClick={() => focusCluster(cluster)}>
                    <span>
                      <strong>{formatShortDate(cluster.date)} · {clusterClassLabel(cluster)}</strong>
                      <small>{cluster.types.map(typeLabel).join(", ")}</small>
                    </span>
                    <span className="anomaly-cluster-list__stats">
                      <strong>{formatCount(cluster.nodeCount)} nodes</strong>
                      <small>max {cluster.maxSeverity}/100</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Method & limits" note="Thresholds and calculation rules are versioned with the data.">
            <details className="anomaly-method">
              <summary>Show detection rules</summary>
              <dl>
                {Object.entries(anomalies.methods).map(([key, text]) => (
                  <div key={key}><dt>{key}</dt><dd>{text}</dd></div>
                ))}
              </dl>
            </details>
            <p className="anomaly-method__note">
              Full-history totals, distributions, patterns and clusters are descriptive.
              Filters change only the timeline and event list. Cluster labels separate
              market-event-only dates from statistical clusters.
            </p>
          </Panel>
        </section>
      </div>
    </div>
  );
}
