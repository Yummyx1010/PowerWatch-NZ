import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { OverviewV1 } from "../lib/data";
import { formatNzd, formatShortDate } from "../lib/format";

const VIEW_W = 900;
const VIEW_H = 340;
const PAD_L = 54;
const PAD_R = 18;
const PAD_T = 18;
const PAD_B = 42;

const NODE_COLORS: Record<string, string> = {
  OTA2201: "#6b4cf1",
  HAY2201: "#ff7a63",
  ISL2201: "#179c8a",
};

type RangeId = "7D" | "30D" | "90D" | "1Y" | "ALL";

const RANGES: Array<{ id: RangeId; label: string; days: number | null }> = [
  { id: "7D", label: "7 days", days: 7 },
  { id: "30D", label: "30 days", days: 30 },
  { id: "90D", label: "90 days", days: 90 },
  { id: "1Y", label: "1 year", days: 365 },
  { id: "ALL", label: "All", days: null },
];

interface Segment {
  path: string;
  status: string;
}

function shiftDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

interface PriceExplorerProps {
  overview: OverviewV1;
  activeNodes?: string[];
  onNodesChange?: (nodes: string[]) => void;
}

export function PriceExplorer({ overview, activeNodes: controlledNodes, onNodesChange }: PriceExplorerProps) {
  const [range, setRange] = useState<RangeId>("7D");
  const [internalNodes, setInternalNodes] = useState<string[]>(
    overview.nodes.map((node) => node.code),
  );
  const activeNodes = controlledNodes ?? internalNodes;
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ start: number; end: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const latest = overview.metrics.latestDate;

  const fullDomain = useMemo(() => {
    if (range === "7D") {
      const cutoff = shiftDays(latest, 6);
      const keys = overview.recent
        .filter((point) => point.date >= cutoff)
        .map((point) => `${point.date}#${point.period}`)
        .filter((key, index, all) => all.indexOf(key) === index)
        .sort();
      return keys;
    }
    const config = RANGES.find((item) => item.id === range)!;
    const cutoff = config.days ? shiftDays(latest, config.days - 1) : "0000-00-00";
      const keys = overview.daily
        .filter((point) => point.date >= cutoff)
        .map((point) => point.date)
        .filter((key, index, all) => all.indexOf(key) === index)
        .sort();
      return keys;
  }, [overview, range, latest]);

  const domain = zoom ? fullDomain.slice(zoom[0], zoom[1] + 1) : fullDomain;

  const { values, statuses, labels } = useMemo(() => {
    const valueMap: Record<string, Record<string, number>> = {};
    const statusMap: Record<string, Record<string, string>> = {};
    const labelMap: Record<string, string> = {};
    const domainSet = new Set(domain);
    for (const node of overview.nodes.map((item) => item.code)) {
      valueMap[node] = {};
      statusMap[node] = {};
    }
    if (range === "7D") {
      for (const point of overview.recent) {
        const key = `${point.date}#${point.period}`;
        if (!domainSet.has(key)) continue;
        valueMap[point.node][key] = point.price;
        statusMap[point.node][key] = point.status;
        labelMap[key] = `${formatShortDate(point.date)} · ${point.local.slice(11)}`;
      }
    } else {
      for (const point of overview.daily) {
        if (!domainSet.has(point.date)) continue;
        valueMap[point.node][point.date] = point.mean;
        statusMap[point.node][point.date] = point.status;
        labelMap[point.date] = formatShortDate(point.date);
      }
    }
    return { values: valueMap, statuses: statusMap, labels: labelMap };
  }, [overview, range, domain]);

  const visibleValues = activeNodes.flatMap((node) =>
    domain.map((key) => values[node]?.[key]).filter((value): value is number => value !== undefined),
  );
  const dataMin = visibleValues.length ? Math.min(...visibleValues) : 0;
  const dataMax = visibleValues.length ? Math.max(...visibleValues) : 100;
  const span = dataMax - dataMin || 1;
  const min = Math.min(0, dataMin - span * 0.08);
  const max = dataMax + span * 0.08;

  const xFor = (index: number) =>
    domain.length <= 1
      ? (PAD_L + VIEW_W - PAD_R) / 2
      : PAD_L + (index / (domain.length - 1)) * (VIEW_W - PAD_L - PAD_R);
  const yFor = (value: number) =>
    PAD_T + (1 - (value - min) / (max - min)) * (VIEW_H - PAD_T - PAD_B);

  const segmentsFor = (node: string): Segment[] => {
    const segments: Segment[] = [];
    let current = "";
    let currentStatus = "";
    domain.forEach((key, index) => {
      const value = values[node]?.[key];
      const status = statuses[node]?.[key] ?? "";
      if (value === undefined) {
        if (current) segments.push({ path: current, status: currentStatus });
        current = "";
        currentStatus = "";
        return;
      }
      const command = `${current ? "L" : "M"}${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`;
      if (current && status !== currentStatus) {
        segments.push({ path: current, status: currentStatus });
        current = `M${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`;
      } else {
        current += command;
      }
      currentStatus = status;
    });
    if (current) segments.push({ path: current, status: currentStatus });
    return segments;
  };

  const toggleNode = (node: string) => {
    const next = activeNodes.includes(node)
      ? activeNodes.length === 1
        ? activeNodes
        : activeNodes.filter((item) => item !== node)
      : [...activeNodes, node].sort();
    if (controlledNodes) onNodesChange?.(next);
    else setInternalNodes(next);
  };

  const changeRange = (next: RangeId) => {
    setRange(next);
    setZoom(null);
    setHoverIndex(null);
  };

  const indexFromPointer = (event: ReactPointerEvent<SVGRectElement>) => {
    if (!svgRef.current || domain.length === 0) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const ratio = (x - PAD_L) / (VIEW_W - PAD_L - PAD_R);
    return Math.max(0, Math.min(domain.length - 1, Math.round(ratio * (domain.length - 1))));
  };

  const onPointerDown = (event: ReactPointerEvent<SVGRectElement>) => {
    const index = indexFromPointer(event);
    setDrag({ start: index, end: index });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const index = indexFromPointer(event);
    if (drag) setDrag({ ...drag, end: index });
    else setHoverIndex(index);
  };

  const onPointerUp = (event: ReactPointerEvent<SVGRectElement>) => {
    if (!drag) return;
    const start = Math.min(drag.start, drag.end);
    const end = Math.max(drag.start, drag.end);
    const fullStart = zoom ? zoom[0] : 0;
    if (end - start >= 2) setZoom([fullStart + start, fullStart + end]);
    setDrag(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const hoverKey = hoverIndex !== null ? domain[hoverIndex] : undefined;
  const xTicks = Array.from({ length: Math.min(6, domain.length) }, (_, index) => {
    const ratio = index / Math.max(1, Math.min(6, domain.length) - 1);
    return Math.round(ratio * (domain.length - 1));
  });

  return (
    <section className="price-explorer" aria-label="Interactive wholesale price explorer">
      <div className="price-explorer__toolbar">
        <div className="price-explorer__ranges" role="group" aria-label="Time range">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={range === item.id}
              onClick={() => changeRange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="price-explorer__nodes" role="group" aria-label="Representative nodes">
          {overview.nodes.map((node) => (
            <button
              key={node.code}
              type="button"
              aria-pressed={activeNodes.includes(node.code)}
              onClick={() => toggleNode(node.code)}
            >
              <i style={{ background: NODE_COLORS[node.code] }} aria-hidden="true" />
              {node.label}
            </button>
          ))}
        </div>
        {zoom ? (
          <button className="price-explorer__reset" type="button" onClick={() => setZoom(null)}>
            Reset zoom
          </button>
        ) : null}
      </div>

      <div className="price-explorer__canvas">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={`Wholesale price trend for ${activeNodes.length} representative nodes over ${range}. Drag to zoom, double-click to reset.`}
          onDoubleClick={() => setZoom(null)}
        >
          {[0, 1, 2, 3, 4].map((line) => {
            const value = min + ((max - min) * line) / 4;
            const y = yFor(value);
            return (
              <g key={line}>
                <line x1={PAD_L} x2={VIEW_W - PAD_R} y1={y} y2={y} className="price-explorer__grid" />
                <text x={PAD_L - 10} y={y + 4} textAnchor="end" className="price-explorer__axis">
                  ${value.toFixed(0)}
                </text>
              </g>
            );
          })}

          {xTicks.map((index) => (
            <text
              key={index}
              x={xFor(index)}
              y={VIEW_H - 12}
              textAnchor="middle"
              className="price-explorer__axis"
            >
              {labels[domain[index]] ?? ""}
            </text>
          ))}

          {activeNodes.map((node) =>
            segmentsFor(node).map((segment, index) => (
              <path
                key={`${node}-${index}`}
                d={segment.path}
                fill="none"
                stroke={NODE_COLORS[node]}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={segment.status === "Interim" ? "7 5" : undefined}
                opacity={segment.status === "Interim" ? 0.78 : 1}
              />
            )),
          )}

          {hoverIndex !== null && hoverKey ? (
            <g>
              <line
                x1={xFor(hoverIndex)}
                x2={xFor(hoverIndex)}
                y1={PAD_T}
                y2={VIEW_H - PAD_B}
                className="price-explorer__crosshair"
              />
              {activeNodes.map((node) => {
                const value = values[node]?.[hoverKey];
                return value === undefined ? null : (
                  <circle
                    key={node}
                    cx={xFor(hoverIndex)}
                    cy={yFor(value)}
                    r={4}
                    fill="#fff"
                    stroke={NODE_COLORS[node]}
                    strokeWidth={2.5}
                  />
                );
              })}
            </g>
          ) : null}

          {drag ? (
            <rect
              x={xFor(Math.min(drag.start, drag.end))}
              y={PAD_T}
              width={Math.abs(xFor(drag.end) - xFor(drag.start))}
              height={VIEW_H - PAD_T - PAD_B}
              className="price-explorer__brush"
            />
          ) : null}

          <rect
            x={PAD_L}
            y={PAD_T}
            width={VIEW_W - PAD_L - PAD_R}
            height={VIEW_H - PAD_T - PAD_B}
            fill="transparent"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => !drag && setHoverIndex(null)}
          />
        </svg>

        {hoverKey ? (
          <div className="price-explorer__tooltip" role="status">
            <strong>{labels[hoverKey]}</strong>
            {activeNodes.map((node) => {
              const value = values[node]?.[hoverKey];
              return value === undefined ? null : (
                <span key={node}>
                  <i style={{ background: NODE_COLORS[node] }} aria-hidden="true" />
                  {overview.nodes.find((item) => item.code === node)?.label}
                  <b>{formatNzd(value)}</b>
                  {statuses[node]?.[hoverKey] === "Interim" ? <small>interim</small> : null}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="price-explorer__foot">
        <span>Drag across the chart to zoom · double-click to reset</span>
        <span>Dashed line = Interim prices</span>
      </div>
    </section>
  );
}
