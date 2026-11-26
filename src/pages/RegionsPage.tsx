import { useMemo, useState } from "react";
import { PriceExplorer } from "../components/PriceExplorer";
import { RegionalMap } from "../components/RegionalMap";
import { usePowerWatchData } from "../components/DataProvider";
import { Panel, StatePanel } from "../components/ui";
import { formatCount, formatNzd, formatShortDate } from "../lib/format";
import type { DailyPricePoint } from "../lib/data";

const NODE_ORDER = ["OTA2201", "HAY2201", "ISL2201"];
const NODE_COLORS: Record<string, string> = {
  OTA2201: "#6b4cf1",
  HAY2201: "#ff7a63",
  ISL2201: "#179c8a",
};

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function nodeMean(rows: DailyPricePoint[], node: string, window: string[]): number | null {
  return mean(
    rows
      .filter((row) => row.node === node && window.includes(row.date))
      .map((row) => row.mean),
  );
}

function signed(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : "−"}${formatNzd(Math.abs(value))}`;
}

export function RegionsPage() {
  const { data, loading, freshness, reload } = usePowerWatchData();
  const overview = data.overview;
  const [activeNodes, setActiveNodes] = useState<string[]>(NODE_ORDER);

  const derived = useMemo(() => {
    if (!overview) return null;
    const rows = overview.daily;
    const dates = Array.from(new Set(rows.map((row) => row.date))).sort();
    const latestDay = dates[dates.length - 1] ?? "";
    const latestRows = rows.filter((row) => row.date === latestDay);
    const last7 = dates.slice(-7);
    const previous7 = dates.slice(-14, -7);

    const spreads = last7.map((date) => {
      const values = rows.filter((row) => row.date === date).map((row) => row.mean);
      return values.length >= 2 ? Math.max(...values) - Math.min(...values) : 0;
    });
    const latestValues = latestRows.map((row) => row.mean);
    return {
      dates,
      latestDay,
      latestRows,
      last7,
      previous7,
      latestSpread: latestValues.length >= 2 ? Math.max(...latestValues) - Math.min(...latestValues) : 0,
      averageSpread: mean(spreads) ?? 0,
    };
  }, [overview]);

  if (!overview || !derived) {
    return (
      <div className="shell">
        <StatePanel
          tone={loading ? "loading" : "error"}
          title={loading ? "Reading regional prices" : "Regional data unavailable"}
          message={
            loading
              ? "Loading real nodal prices and node metadata…"
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

  const nodeInfo = overview.nodes.map((node) => {
    const meta = data.sample?.nodes.find((item) => item.code === node.code);
    return {
      code: node.code,
      label: node.label,
      area: meta?.area ?? "Representative node",
      island: meta?.island ?? "—",
    };
  });

  const toggleNode = (code: string) => {
    setActiveNodes((current) => {
      if (current.includes(code) && current.length === 1) return current;
      return current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code].sort();
    });
  };

  const latestRows = [...derived.latestRows].sort(
    (a, b) => NODE_ORDER.indexOf(a.node) - NODE_ORDER.indexOf(b.node),
  );
  const maxMean = Math.max(...latestRows.map((row) => row.mean), 1);
  const movements = NODE_ORDER.map((node) => {
    const recent = nodeMean(overview.daily, node, derived.last7);
    const previous = nodeMean(overview.daily, node, derived.previous7);
    return {
      node,
      recent,
      change: recent !== null && previous !== null ? recent - previous : null,
    };
  });

  return (
    <div className="page page--regions">
      <header className="module-header">
        <div className="shell module-header__inner">
          <div>
            <p className="eyebrow">Regional intelligence</p>
            <h1>
              Three nodes. <em>One market.</em>
            </h1>
            <p>Select a node, compare real prices, and see where representative nodes diverge.</p>
          </div>
          <span className="module-header__badge">
            {formatShortDate(overview.metrics.latestDate)} · {freshness === "stale" ? "STALE" : "SNAPSHOT"}
          </span>
        </div>
      </header>

      <div className="shell page__body">
        <div className="module-ribbon" aria-label="Regional snapshot metrics">
          <div>
            <span>Latest node spread</span>
            <strong>{formatNzd(derived.latestSpread)}</strong>
            <small>{formatShortDate(derived.latestDay)} · nodal means</small>
          </div>
          <div>
            <span>7d average spread</span>
            <strong>{formatNzd(derived.averageSpread)}</strong>
            <small>Across representative nodes</small>
          </div>
          <div>
            <span>Nodes in view</span>
            <strong>{formatCount(activeNodes.length)} / 3</strong>
            <small>Map and chart stay in sync</small>
          </div>
          <div>
            <span>Price status</span>
            <strong>{latestRows[0]?.status ?? "—"}</strong>
            <small>Final through {formatShortDate(overview.metrics.latestFinalDate)}</small>
          </div>
        </div>

        <section className="regions-main" aria-label="Regional map and price comparison">
          <RegionalMap nodes={nodeInfo} activeNodes={activeNodes} onToggleNode={toggleNode} />

          <Panel
            title="Node comparison"
            note="Same real dataset as Market Overview. Drag to zoom; map markers and chart toggles are linked."
            flush
          >
            <PriceExplorer
              overview={overview}
              activeNodes={activeNodes}
              onNodesChange={setActiveNodes}
            />
          </Panel>
        </section>

        <section className="supporting" aria-label="Regional detail">
          <Panel title="Node roster" note="Latest daily mean per representative node.">
            <div className="region-roster">
              {nodeInfo.map((node) => {
                const row = latestRows.find((item) => item.node === node.code);
                const active = activeNodes.includes(node.code);
                return (
                  <button
                    key={node.code}
                    type="button"
                    className={`region-roster__row${active ? " region-roster__row--active" : ""}`}
                    aria-pressed={active}
                    onClick={() => toggleNode(node.code)}
                  >
                    <span className="region-roster__dot" style={{ background: NODE_COLORS[node.code] }} />
                    <span className="region-roster__name">
                      <strong>{node.label}</strong>
                      <small>{node.area} · {node.island} · {node.code}</small>
                    </span>
                    <span className="region-roster__value">
                      {formatNzd(row?.mean)}
                      <small>{row?.status ?? "—"}</small>
                    </span>
                    <span className="region-roster__bar">
                      <i style={{ width: `${row ? Math.max(4, (row.mean / maxMean) * 100) : 4}%`, background: NODE_COLORS[node.code] }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel title="Regional movement" note="Mean daily price over the last 7 published days vs the previous 7.">
            <ul className="data-list">
              {movements.map((item) => {
                const info = nodeInfo.find((node) => node.code === item.node)!;
                return (
                  <li key={item.node}>
                    <span>{info.label}</span>
                    <strong>
                      {formatNzd(item.recent)}
                      <small>
                        {signed(item.change)} vs prior 7d
                      </small>
                    </strong>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="How to read this" note="Transparent scope notes.">
            <ul className="insight-list">
              <li>
                <strong>Nodal prices</strong>
                <span>These are representative pricing nodes, not city-wide or regional averages.</span>
              </li>
              <li>
                <strong>Price status</strong>
                <span>Dashed chart lines mark Interim prices; solid lines are Final.</span>
              </li>
              <li>
                <strong>Map intent</strong>
                <span>The map is schematic and only shows node identity and island placement.</span>
              </li>
              <li>
                <strong>No inferred causes</strong>
                <span>Differences are observed values; no explanation is invented here.</span>
              </li>
            </ul>
          </Panel>
        </section>
      </div>
    </div>
  );
}
