import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { RegionalNode, RegionalV1 } from "../lib/data";
import { colorForNode } from "../lib/nodeColors";
import { formatNzd, formatShortDate } from "../lib/format";

const VIEW_W = 900;
const VIEW_H = 300;
const PAD_L = 52;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 34;
const MAX_LINES = 8;

type RangeId = "7D" | "30D" | "90D" | "1Y" | "ALL";

const RANGES: Array<{ id: RangeId; label: string; days: number | null }> = [
  { id: "7D", label: "7 days", days: 7 },
  { id: "30D", label: "30 days", days: 30 },
  { id: "90D", label: "90 days", days: 90 },
  { id: "1Y", label: "1 year", days: 365 },
  { id: "ALL", label: "All", days: null },
];

export function RegionalCompare({ regional, selectedNodes }: { regional: RegionalV1; selectedNodes: RegionalNode[] }) {
  const [range, setRange] = useState<RangeId>("30D");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const visibleNodes = selectedNodes.slice(0, MAX_LINES);

  const indices = useMemo(() => {
    const total = regional.dates.length;
    const config = RANGES.find((item) => item.id === range)!;
    const size = config.days ? Math.min(total, config.days) : total;
    return Array.from({ length: size }, (_, offset) => total - size + offset);
  }, [regional.dates.length, range]);

  const values = visibleNodes.flatMap((node) =>
    indices.map((index) => node.means[index]).filter((value): value is number => value !== null),
  );
  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 100;
  const span = dataMax - dataMin || 1;
  const min = Math.min(0, dataMin - span * 0.08);
  const max = dataMax + span * 0.08;

  const xFor = (index: number) =>
    indices.length <= 1
      ? (PAD_L + VIEW_W - PAD_R) / 2
      : PAD_L + (index / (indices.length - 1)) * (VIEW_W - PAD_L - PAD_R);
  const yFor = (value: number) => PAD_T + (1 - (value - min) / (max - min)) * (VIEW_H - PAD_T - PAD_B);

  const pathFor = (node: RegionalNode) => {
    let path = "";
    let penDown = false;
    indices.forEach((dateIndex, index) => {
      const value = node.means[dateIndex];
      if (value === null) {
        penDown = false;
        return;
      }
      const command = penDown ? "L" : "M";
      path += `${command}${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`;
      penDown = true;
    });
    return path;
  };

  const onPointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg || indices.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const ratio = (x - PAD_L) / (VIEW_W - PAD_L - PAD_R);
    setHoverIndex(Math.max(0, Math.min(indices.length - 1, Math.round(ratio * (indices.length - 1)))));
  };

  const hoverDate = hoverIndex !== null ? regional.dates[indices[hoverIndex]] : null;

  return (
    <section className="regional-compare" aria-label="Selected node price comparison">
      <div className="regional-compare__toolbar">
        <div className="regional-compare__ranges" role="group" aria-label="Comparison range">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={range === item.id}
              onClick={() => {
                setRange(item.id);
                setHoverIndex(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span>
          {visibleNodes.length} shown
          {selectedNodes.length > MAX_LINES ? ` of ${selectedNodes.length} selected` : ""}
        </span>
      </div>

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="Daily mean price comparison for selected nodes">
        {[0, 1, 2, 3].map((line) => {
          const value = min + ((max - min) * line) / 3;
          const y = yFor(value);
          return (
            <g key={line}>
              <line x1={PAD_L} x2={VIEW_W - PAD_R} y1={y} y2={y} className="regional-compare__grid" />
              <text x={PAD_L - 8} y={y + 4} textAnchor="end" className="regional-compare__axis">
                ${value.toFixed(0)}
              </text>
            </g>
          );
        })}

        {[0, 3, 6, 9].filter((index) => index < indices.length).map((index) => (
          <text key={index} x={xFor(index)} y={VIEW_H - 10} textAnchor="middle" className="regional-compare__axis">
            {formatShortDate(regional.dates[indices[index]])}
          </text>
        ))}

        {visibleNodes.map((node) => (
          <path
            key={node.code}
            d={pathFor(node)}
            fill="none"
            stroke={colorForNode(node.code)}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {hoverIndex !== null ? (
          <g>
            <line
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={PAD_T}
              y2={VIEW_H - PAD_B}
              className="regional-compare__crosshair"
            />
            {visibleNodes.map((node) => {
              const value = node.means[indices[hoverIndex]];
              return value === null ? null : (
                <circle
                  key={node.code}
                  cx={xFor(hoverIndex)}
                  cy={yFor(value)}
                  r={4}
                  fill="#fff"
                  stroke={colorForNode(node.code)}
                  strokeWidth={2}
                />
              );
            })}
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

      {hoverDate ? (
        <div className="regional-compare__tooltip" role="status">
          <strong>{formatShortDate(hoverDate)} · {regional.dateStatus[indices[hoverIndex!]]}</strong>
          <div>
            {visibleNodes.map((node) => (
              <span key={node.code}>
                <i style={{ background: colorForNode(node.code) }} />
                {node.label}
                <b>{formatNzd(node.means[indices[hoverIndex!]])}</b>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
