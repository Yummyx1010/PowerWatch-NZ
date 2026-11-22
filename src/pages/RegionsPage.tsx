import { useMemo, useState } from "react";
import { usePowerWatchData } from "../components/DataProvider";
import { ChartFrame, DataCard, PageIntro, PlannedPanel, SectionHeading, StatePanel } from "../components/ui";
import { formatNzd } from "../lib/format";

export function RegionsPage() {
  const { data, loading, freshness, reload } = usePowerWatchData();
  const [selected, setSelected] = useState<string>("OTA2201");

  const nodes = data.sample?.nodes ?? [];
  const points = data.priceSummary?.points ?? [];

  const latestByNode = useMemo(() => {
    const result = new Map<string, { month: string; price: number }>();
    for (const point of points) {
      if (point.priceType !== "final") continue;
      const current = result.get(point.node);
      if (!current || point.month > current.month) {
        result.set(point.node, { month: point.month, price: point.meanPrice });
      }
    }
    return result;
  }, [points]);

  if (loading && !data.sample) {
    return <StatePanel tone="loading" title="Reading regional data" message="Loading verified node metadata…" />;
  }

  if (freshness === "error") {
    return (
      <StatePanel
        tone="error"
        title="Regional data unavailable"
        message={data.errors.join(" · ")}
        action={<button className="button button--ghost" type="button" onClick={reload}>Retry</button>}
      />
    );
  }

  const selectedMeta = nodes.find((node) => node.code === selected);
  const selectedLatest = latestByNode.get(selected);

  return (
    <div className="page page--regions">
      <div className="shell">
        <PageIntro
          eyebrow="Regional intelligence"
          title="Three nodes."
          accent="One country."
          lede="Prices in New Zealand are nodal, not national. This page establishes the node roster and the comparison surface; full regional analytics arrive in M4."
          badge={nodes.length ? `${nodes.length} representative nodes` : undefined}
        />

        <section className="section">
          <SectionHeading
            index="01"
            title="Representative node roster"
            note="Latest available real monthly mean from the M1 price summary. Not a regional average."
          />
          <div className="node-roster">
            {nodes.map((node) => {
              const latest = latestByNode.get(node.code);
              const active = node.code === selected;
              return (
                <button
                  key={node.code}
                  type="button"
                  className={`node-card${active ? " node-card--active" : ""}`}
                  aria-pressed={active}
                  onClick={() => setSelected(node.code)}
                >
                  <span className="node-card__code">{node.code}</span>
                  <strong>{node.label}</strong>
                  <span className="node-card__area">{node.area} · {node.island}</span>
                  <span className="node-card__price">
                    {latest ? formatNzd(latest.price) : "—"}
                    <small>{latest ? `mean · ${latest.month}` : "no data"}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="section regions-split">
          <div className="island-rail" aria-label="Schematic island placement">
            <div className="island-rail__head">
              <span>ISLAND PLACEMENT</span>
              <small>schematic only · not a map</small>
            </div>
            {(["NI", "SI"] as const).map((island) => (
              <div key={island} className="island-rail__lane">
                <span className="island-rail__label">{island === "NI" ? "North Island" : "South Island"}</span>
                <div className="island-rail__track">
                  {nodes
                    .filter((node) => node.island === island)
                    .map((node) => (
                      <button
                        key={node.code}
                        type="button"
                        className={`island-rail__node${node.code === selected ? " island-rail__node--active" : ""}`}
                        onClick={() => setSelected(node.code)}
                        aria-label={`Select ${node.label}`}
                      >
                        {node.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
            {selectedMeta ? (
              <p className="island-rail__caption">
                Selected: <strong>{selectedMeta.label}</strong> · {selectedMeta.area} ·{" "}
                {selectedLatest ? `${formatNzd(selectedLatest.price)} mean in ${selectedLatest.month}` : "no summary yet"}
              </p>
            ) : null}
          </div>

          <ChartFrame
            title="Regional spread over time"
            subtitle="A real node-by-node spread chart belongs here."
            status="planned"
          >
            <div className="chart-placeholder">
              <span className="chart-placeholder__axis">$/MWh</span>
              <div className="chart-placeholder__lines" aria-hidden="true">
                <i /><i /><i /><i />
              </div>
              <p>Spread analytics land in Milestone 4.</p>
            </div>
          </ChartFrame>
        </section>

        <section className="section">
          <div className="stat-rail stat-rail--tight">
            <DataCard label="Selected node" value={selectedMeta?.code ?? "—"} hint={selectedMeta?.label ?? "—"} />
            <DataCard label="Island" value={selectedMeta?.island ?? "—"} hint="Explicit proxy label" tone="lime" />
            <DataCard label="Price type" value="Final" hint="Interim rows kept separate" tone="sky" />
          </div>
          <PlannedPanel
            title="Regional anomaly context"
            milestone="M4 + M5"
            description="Node rankings, spread bands and event context are intentionally not previewed as finished analysis."
          />
        </section>
      </div>
    </div>
  );
}
