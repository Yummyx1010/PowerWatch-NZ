import { useMemo, useState } from "react";
import { NZNodeMap } from "../components/NZNodeMap";
import { RegionalCompare } from "../components/RegionalCompare";
import { SpreadExplorer } from "../components/SpreadExplorer";
import { usePowerWatchData } from "../components/DataProvider";
import { Panel, StatePanel } from "../components/ui";
import { formatCount, formatNzd, formatShortDate } from "../lib/format";
import { colorForNode } from "../lib/nodeColors";
import type { RegionalNode } from "../lib/data";

type IslandFilter = "ALL" | "NI" | "SI";
type SortKey = "price" | "volatility" | "name";

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function latestRank(nodes: RegionalNode[]): RegionalNode[] {
  return nodes
    .filter((node) => node.latest !== null)
    .sort((a, b) => (b.latest ?? 0) - (a.latest ?? 0));
}

export function RegionsPage() {
  const { data, loading, freshness, reload } = usePowerWatchData();
  const regional = data.regional;
  const [query, setQuery] = useState("");
  const [island, setIsland] = useState<IslandFilter>("ALL");
  const [region, setRegion] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("price");
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    regional?.representativeNodes ?? [],
  );

  const regions = useMemo(() => {
    if (!regional) return [];
    return Array.from(new Set(regional.nodes.map((node) => node.region))).sort();
  }, [regional]);

  const filteredNodes = useMemo(() => {
    if (!regional) return [];
    const needle = query.trim().toLowerCase();
    const result = regional.nodes.filter((node) => {
      if (island !== "ALL" && node.island !== island) return false;
      if (region !== "ALL" && node.region !== region) return false;
      if (!needle) return true;
      return (
        node.label.toLowerCase().includes(needle) ||
        node.code.toLowerCase().includes(needle) ||
        node.region.toLowerCase().includes(needle)
      );
    });
    return [...result].sort((a, b) => {
      if (sort === "name") return a.label.localeCompare(b.label);
      if (sort === "volatility") return (b.volatility7d ?? 0) - (a.volatility7d ?? 0);
      return (b.latest ?? -Infinity) - (a.latest ?? -Infinity);
    });
  }, [regional, query, island, region, sort]);

  if (!regional) {
    return (
      <div className="shell">
        <StatePanel
          tone={loading ? "loading" : "error"}
          title={loading ? "Reading regional dataset" : "Regional dataset unavailable"}
          message={
            loading
              ? "Loading all-node prices and official node coordinates…"
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

  const mappedNodes = filteredNodes.filter((node) => node.hasMapPosition);
  const selectedNodes = regional.nodes.filter((node) => selectedCodes.includes(node.code));
  const ranked = latestRank(filteredNodes);
  const high = ranked[0];
  const low = ranked[ranked.length - 1];
  const spread = high && low ? (high.latest ?? 0) - (low.latest ?? 0) : 0;
  const lastIndex = regional.dates.length - 1;
  const latestDate = regional.dates[lastIndex] ?? "—";
  const latestStatus = regional.dateStatus[lastIndex] ?? "—";
  const volatilityLeaders = [...filteredNodes]
    .filter((node) => node.volatility7d !== null)
    .sort((a, b) => (b.volatility7d ?? 0) - (a.volatility7d ?? 0))
    .slice(0, 5);
  const islandStats = (code: "NI" | "SI") => {
    const values = filteredNodes
      .filter((node) => node.island === code && node.latest !== null)
      .map((node) => node.latest as number);
    return { count: values.length, mean: average(values) };
  };
  const north = islandStats("NI");
  const south = islandStats("SI");

  const toggleNode = (code: string) => {
    setSelectedCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    );
  };

  return (
    <div className="page page--regions-full">
      <header className="module-header">
        <div className="shell module-header__inner">
          <div>
            <p className="eyebrow">Regional intelligence</p>
            <h1>
              Every node. <em>One map.</em>
            </h1>
            <p>Search, select and compare real pricing nodes across New Zealand.</p>
          </div>
          <span className="module-header__badge">
            {formatCount(regional.nodeCount)} nodes · {formatCount(regional.mappedNodeCount)} mapped
          </span>
        </div>
      </header>

      <div className="shell page__body">
        <div className="module-ribbon" aria-label="Regional dataset summary">
          <div>
            <span>Latest spread</span>
            <strong>{formatNzd(spread)}</strong>
            <small>{high?.label ?? "—"} vs {low?.label ?? "—"}</small>
          </div>
          <div>
            <span>Nodes in view</span>
            <strong>{formatCount(filteredNodes.length)}</strong>
            <small>{formatCount(mappedNodes.length)} with verified coordinates</small>
          </div>
          <div>
            <span>Nodes selected</span>
            <strong>{formatCount(selectedCodes.length)}</strong>
            <small>Map, explorer and chart are linked</small>
          </div>
          <div>
            <span>Latest data</span>
            <strong>{latestStatus}</strong>
            <small>{formatShortDate(latestDate)}</small>
          </div>
        </div>

        <section className="regions-workspace" aria-label="Map and node explorer">
          <NZNodeMap
            regional={regional}
            coastline={data.coastline}
            nodes={mappedNodes}
            selectedCodes={selectedCodes}
            onToggleNode={toggleNode}
          />

          <Panel
            title="Node explorer"
            note="Search by node name, ID or reporting region. Select nodes to compare."
          >
            <div className="node-controls">
              <input
                type="search"
                value={query}
                placeholder="Search nodes…"
                aria-label="Search nodes"
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="node-controls__buttons" role="group" aria-label="Island filter">
                {(["ALL", "NI", "SI"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={island === value}
                    onClick={() => setIsland(value)}
                  >
                    {value === "ALL" ? "All islands" : value === "NI" ? "North" : "South"}
                  </button>
                ))}
              </div>
              <div className="node-controls__row">
                <select
                  value={region}
                  aria-label="Filter by reporting region"
                  onChange={(event) => setRegion(event.target.value)}
                >
                  <option value="ALL">All regions</option>
                  {regions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <select
                  value={sort}
                  aria-label="Sort nodes"
                  onChange={(event) => setSort(event.target.value as SortKey)}
                >
                  <option value="price">Sort: latest price</option>
                  <option value="volatility">Sort: volatility</option>
                  <option value="name">Sort: name</option>
                </select>
              </div>
              <div className="node-controls__row">
                <button
                  type="button"
                  onClick={() => setSelectedCodes(ranked.slice(0, 5).map((node) => node.code))}
                >
                  Select top 5
                </button>
                <button type="button" onClick={() => setSelectedCodes([])}>Clear selection</button>
              </div>
            </div>

            <div className="node-list" role="list">
              {filteredNodes.map((node) => {
                const selected = selectedCodes.includes(node.code);
                return (
                  <button
                    key={node.code}
                    type="button"
                    role="listitem"
                    className={`node-list__row${selected ? " node-list__row--selected" : ""}`}
                    aria-pressed={selected}
                    onClick={() => toggleNode(node.code)}
                  >
                    <span className="node-list__dot" style={{ background: colorForNode(node.code) }} />
                    <span className="node-list__identity">
                      <strong>{node.label}</strong>
                      <small>{node.code} · {node.region} · {node.island}</small>
                    </span>
                    <span className="node-list__price">
                      {formatNzd(node.latest)}
                      <small>{node.hasMapPosition ? "mapped" : "no map position"}</small>
                    </span>
                  </button>
                );
              })}
              {filteredNodes.length === 0 ? (
                <p className="node-list__empty">No nodes match these filters.</p>
              ) : null}
            </div>
          </Panel>
        </section>

        <section className="regions-analytics" aria-label="Regional analytics">
          <Panel
            title="Selected node comparison"
            note="Daily mean prices. Missing node-days remain gaps, not zero values."
            className="regions-analytics__chart"
            flush
          >
            {selectedNodes.length ? (
              <RegionalCompare regional={regional} selectedNodes={selectedNodes} />
            ) : (
              <StatePanel tone="empty" title="No nodes selected" message="Select nodes from the map or explorer to compare prices." />
            )}
          </Panel>

          <Panel
            title="Spread analysis"
            note="Historical difference between two selected nodes in NZ$/MWh."
            className="regions-analytics__spread"
            flush
          >
            {selectedNodes.length >= 2 ? (
              <SpreadExplorer regional={regional} selectedNodes={selectedNodes} />
            ) : (
              <StatePanel tone="empty" title="Select two nodes" message="Choose at least two nodes to analyse their price spread." />
            )}
          </Panel>

          <div className="regions-analytics__side">
            <Panel title="Price ranking" note="Highest and lowest latest daily means in the current filter.">
              <div className="ranking">
                {ranked.slice(0, 5).map((node, index) => (
                  <div key={node.code} className="ranking__row">
                    <span className="ranking__index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="ranking__label">{node.label}</span>
                    <span className="ranking__bar">
                      <i style={{ width: `${Math.max(4, ((node.latest ?? 0) / (high?.latest || 1)) * 100)}%`, background: colorForNode(node.code) }} />
                    </span>
                    <strong>{formatNzd(node.latest)}</strong>
                  </div>
                ))}
                {ranked.length > 5 ? <div className="ranking__divider">lowest</div> : null}
                {ranked.slice(-3).reverse().map((node) => (
                  <div key={`low-${node.code}`} className="ranking__row ranking__row--low">
                    <span className="ranking__label">{node.label}</span>
                    <span className="ranking__bar">
                      <i style={{ width: `${Math.max(4, ((node.latest ?? 0) / (high?.latest || 1)) * 100)}%`, background: colorForNode(node.code) }} />
                    </span>
                    <strong>{formatNzd(node.latest)}</strong>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Spread & volatility" note="Transparent calculations from daily mean prices.">
              <div className="island-compare">
                <div>
                  <span>North Island</span>
                  <strong>{formatNzd(north.mean)}</strong>
                  <small>{formatCount(north.count)} filtered nodes</small>
                  <i style={{ width: `${Math.min(100, ((north.mean ?? 0) / Math.max(north.mean ?? 0, south.mean ?? 0, 1)) * 100)}%` }} />
                </div>
                <div>
                  <span>South Island</span>
                  <strong>{formatNzd(south.mean)}</strong>
                  <small>{formatCount(south.count)} filtered nodes</small>
                  <i style={{ width: `${Math.min(100, ((south.mean ?? 0) / Math.max(north.mean ?? 0, south.mean ?? 0, 1)) * 100)}%` }} />
                </div>
              </div>
              <ul className="data-list">
                <li><span>Latest node spread</span><strong>{formatNzd(spread)}</strong></li>
                <li>
                  <span>Island difference</span>
                  <strong>
                    {north.mean !== null && south.mean !== null ? formatNzd(Math.abs(north.mean - south.mean)) : "—"}
                    <small>Not an official island price</small>
                  </strong>
                </li>
              </ul>
              <div className="volatility-leaders">
                <span>Volatility leaders · 7d σ</span>
                <div>
                  {volatilityLeaders.map((node) => (
                    <span key={node.code} title={`${node.label}: ${formatNzd(node.volatility7d)}`}>
                      {node.label} <b>{formatNzd(node.volatility7d)}</b>
                    </span>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </section>

        <section className="supporting" aria-label="Regional data notes">
          <Panel title="Coverage" note="What this dataset can and cannot support.">
            <ul className="data-list">
              <li><span>Trading dates</span><strong>{formatCount(regional.dateCount)}</strong></li>
              <li><span>Priced nodes</span><strong>{formatCount(regional.nodeCount)}</strong></li>
              <li><span>Nodes with verified coordinates</span><strong>{formatCount(regional.mappedNodeCount)}</strong></li>
              <li><span>Representative GXP nodes</span><strong>{formatCount(regional.representativeNodes.length)} same-substation coordinate proxies</strong></li>
              <li><span>Negative prices</span><strong>{formatCount(regional.nodes.reduce((total, node) => total + node.negativeDays30d, 0))} node-days in last 30</strong></li>
            </ul>
          </Panel>
          <Panel title="How to read this" note="Concise rules. No inferred causes.">
            <ul className="insight-list">
              <li><strong>Nodal, not city-wide</strong><span>Prices belong to individual POC nodes, not suburbs or cities.</span></li>
              <li><strong>Coordinates</strong><span>Map positions come from official NZTM values in the EA Network Supply Points table. Representative GXPs use clearly labelled same-substation proxies.</span></li>
              <li><strong>Unmapped nodes</strong><span>Nodes without verified coordinates stay in the explorer and ranking but are not plotted.</span></li>
              <li><strong>Status preserved</strong><span>Interim dates remain labelled; negative values and gaps are not removed.</span></li>
              {freshness === "stale" ? <li><strong>Stale snapshot</strong><span>Check Data & Methodology for the data version.</span></li> : null}
            </ul>
          </Panel>
        </section>
      </div>
    </div>
  );
}
