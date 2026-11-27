import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { RegionalNode, RegionalV1 } from "../lib/data";
import { colorForNode } from "../lib/nodeColors";
import { formatNzd, formatShortDate } from "../lib/format";

const VIEW_W = 720;
const VIEW_H = 180;
const PAD_L = 48;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 28;

type RangeId = "7D" | "30D" | "90D" | "ALL";
const RANGES: Array<{ id: RangeId; label: string; days: number | null }> = [
  { id: "7D", label: "7d", days: 7 },
  { id: "30D", label: "30d", days: 30 },
  { id: "90D", label: "90d", days: 90 },
  { id: "ALL", label: "All", days: null },
];

export function SpreadExplorer({ regional, selectedNodes }: { regional: RegionalV1; selectedNodes: RegionalNode[] }) {
  const [range, setRange] = useState<RangeId>("30D");
  const [primary, setPrimary] = useState(selectedNodes[0]?.code ?? "");
  const [secondary, setSecondary] = useState(selectedNodes[1]?.code ?? "");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const left = selectedNodes.find((node) => node.code === primary) ?? selectedNodes[0];
  const right = selectedNodes.find((node) => node.code === secondary) ?? selectedNodes[1];

  const points = useMemo(() => {
    if (!left || !right || left.code === right.code) return [];
    const total = regional.dates.length;
    const config = RANGES.find((item) => item.id === range)!;
    const size = config.days ? Math.min(total, config.days) : total;
    return Array.from({ length: size }, (_, offset) => {
      const index = total - size + offset;
      const a = left.means[index];
      const b = right.means[index];
      return a !== null && b !== null ? { index, date: regional.dates[index], value: a - b } : null;
    }).filter((point): point is { index: number; date: string; value: number } => point !== null);
  }, [left, right, regional.dates, range]);

  const values = points.map((point) => point.value);
  const maxAbs = values.length ? Math.max(...values.map(Math.abs), 1) : 1;
  const xFor = (index: number) =>
    points.length <= 1
      ? (PAD_L + VIEW_W - PAD_R) / 2
      : PAD_L + (index / (points.length - 1)) * (VIEW_W - PAD_L - PAD_R);
  const yFor = (value: number) => PAD_T + (1 - (value + maxAbs) / (2 * maxAbs)) * (VIEW_H - PAD_T - PAD_B);

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${xFor(index).toFixed(1)},${yFor(point.value).toFixed(1)}`)
    .join("");
  const average = values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  const current = values[values.length - 1] ?? null;
  const max = values.length ? Math.max(...values) : null;
  const min = values.length ? Math.min(...values) : null;

  const onPointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const ratio = (x - PAD_L) / (VIEW_W - PAD_L - PAD_R);
    setHoverIndex(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <section className="spread-explorer" aria-label="Historical price spread analysis">
      <div className="spread-explorer__head">
        <div className="spread-explorer__pair">
          <select value={primary} aria-label="First node for spread" onChange={(event) => setPrimary(event.target.value)}>
            {selectedNodes.map((node) => <option key={node.code} value={node.code}>{node.label}</option>)}
          </select>
          <span>−</span>
          <select value={secondary} aria-label="Second node for spread" onChange={(event) => setSecondary(event.target.value)}>
            {selectedNodes.map((node) => <option key={node.code} value={node.code}>{node.label}</option>)}
          </select>
        </div>
        <div className="spread-explorer__ranges" role="group" aria-label="Spread range">
          {RANGES.map((item) => (
            <button key={item.id} type="button" aria-pressed={range === item.id} onClick={() => { setRange(item.id); setHoverIndex(null); }}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="Price spread between selected nodes">
        <line x1={PAD_L} x2={VIEW_W - PAD_R} y1={yFor(0)} y2={yFor(0)} className="spread-explorer__zero" />
        <text x={PAD_L - 8} y={yFor(0) + 4} textAnchor="end" className="spread-explorer__axis">$0</text>
        <text x={PAD_L - 8} y={yFor(maxAbs) + 4} textAnchor="end" className="spread-explorer__axis">+{maxAbs.toFixed(0)}</text>
        <text x={PAD_L - 8} y={yFor(-maxAbs) + 4} textAnchor="end" className="spread-explorer__axis">−{maxAbs.toFixed(0)}</text>
        {path ? <path d={path} fill="none" stroke={colorForNode(primary)} strokeWidth={2.4} /> : null}
        {hoverIndex !== null && points[hoverIndex] ? (
          <g>
            <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={PAD_T} y2={VIEW_H - PAD_B} className="spread-explorer__crosshair" />
            <circle cx={xFor(hoverIndex)} cy={yFor(points[hoverIndex].value)} r={4} fill="#fff" stroke={colorForNode(primary)} strokeWidth={2} />
          </g>
        ) : null}
        <rect
          x={PAD_L}
          y={PAD_T}
          width={VIEW_W - PAD_L - PAD_R}
          height={VIEW_H - PAD_T - PAD_B}
          fill="transparent"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        />
      </svg>

      <div className="spread-explorer__stats">
        <span>Current <b>{formatNzd(current)}</b></span>
        <span>Average <b>{formatNzd(average)}</b></span>
        <span>Max <b>{formatNzd(max)}</b></span>
        <span>Min <b>{formatNzd(min)}</b></span>
      </div>
      {hoverIndex !== null && points[hoverIndex] ? (
        <p className="spread-explorer__hover" role="status">
          {formatShortDate(points[hoverIndex].date)} · {formatNzd(points[hoverIndex].value)} /MWh
        </p>
      ) : null}
    </section>
  );
}
