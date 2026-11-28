import { useMemo, useState } from "react";
import type { AnomalyEvent, RegionalV1 } from "../lib/data";
import { formatNzdPerMwh, formatShortDate } from "../lib/format";
import { colorForAnomalyType } from "../lib/nodeColors";

const W = 760;
const H = 220;
const PAD_L = 58;
const PAD_R = 18;
const PAD_T = 18;
const PAD_B = 32;
const WINDOWS = [30, 90, 180];

interface ContextPoint {
  date: string;
  price: number;
  trailing: number;
  seasonal: number;
  x: number;
  y: number;
  trailingY: number;
  seasonalY: number;
}

interface PriceContext {
  points: ContextPoint[];
  peak: ContextPoint | null;
  shadeStart: number;
  shadeEnd: number;
  yTicks: number[];
  xTicks: Array<{ date: string; x: number }>;
}

function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function priorValues(values: Array<number | null>, index: number, window: number): number[] {
  const result: number[] = [];
  for (let position = Math.max(0, index - window); position < index; position += 1) {
    const value = values[position];
    if (value !== null && Number.isFinite(value)) result.push(value);
  }
  return result;
}

function sameMonthPriorValues(
  values: Array<number | null>,
  dates: string[],
  index: number,
): number[] {
  const month = dates[index].slice(5, 7);
  const result: number[] = [];
  for (let position = 0; position < index; position += 1) {
    if (dates[position].slice(5, 7) !== month) continue;
    const value = values[position];
    if (value !== null && Number.isFinite(value)) result.push(value);
  }
  return result;
}

function linePath(points: ContextPoint[], key: "y" | "trailingY" | "seasonalY"): string {
  let path = "";
  let open = false;
  for (const point of points) {
    const value = point[key];
    if (!Number.isFinite(value)) {
      open = false;
      continue;
    }
    path += `${open ? "L" : "M"}${point.x.toFixed(1)},${value.toFixed(1)} `;
    open = true;
  }
  return path.trim();
}

function buildContext(
  event: AnomalyEvent,
  regional: RegionalV1 | null,
  windowDays: number,
): PriceContext | null {
  if (!regional) return null;
  const node = regional.nodes.find((item) => item.code === event.node);
  if (!node) return null;

  const dateIndex = new Map(regional.dates.map((date, index) => [date, index] as const));
  const eventStart = dateIndex.get(event.start);
  const eventEnd = dateIndex.get(event.end);
  if (eventStart === undefined || eventEnd === undefined) return null;

  const first = Math.min(eventStart, eventEnd);
  const last = Math.max(eventStart, eventEnd);
  const fromIndex = Math.max(0, first - Math.floor(windowDays / 2));
  const toIndex = Math.min(regional.dates.length - 1, last + Math.ceil(windowDays / 2));
  const values = node.means;
  const raw: Array<{ date: string; price: number; trailing: number; seasonal: number }> = [];
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;

  for (let index = fromIndex; index <= toIndex; index += 1) {
    const price = values[index];
    if (price === null || !Number.isFinite(price)) continue;
    const trailing = median(priorValues(values, index, 30));
    const historic = median(sameMonthPriorValues(values, regional.dates, index));
    const seasonal = Number.isFinite(historic) ? historic : trailing;
    raw.push({ date: regional.dates[index], price, trailing, seasonal });
    for (const value of [price, trailing, seasonal]) {
      if (!Number.isFinite(value)) continue;
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  }
  if (!raw.length) return null;

  const rawSpan = high - low;
  const pad = rawSpan === 0 ? Math.max(10, Math.abs(low) * 0.1) : rawSpan * 0.12;
  low -= pad;
  high += pad;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const xForIndex = (index: number) =>
    PAD_L + ((index - fromIndex) / Math.max(1, toIndex - fromIndex)) * innerW;
  const yFor = (value: number) => PAD_T + (1 - (value - low) / Math.max(1e-6, high - low)) * innerH;

  const points: ContextPoint[] = raw.map((item) => ({
    ...item,
    x: xForIndex(dateIndex.get(item.date) ?? fromIndex),
    y: yFor(item.price),
    trailingY: yFor(item.trailing),
    seasonalY: yFor(item.seasonal),
  }));

  return {
    points,
    peak: points.find((point) => point.date === event.peakDate) ?? null,
    shadeStart: xForIndex(eventStart),
    shadeEnd: Math.max(xForIndex(eventEnd) + 6, xForIndex(eventStart)),
    yTicks: [1, 0.5, 0].map((ratio) => low + (high - low) * ratio),
    xTicks: [0, 0.5, 1].map((ratio) => {
      const index = Math.round(fromIndex + (toIndex - fromIndex) * ratio);
      return { date: regional.dates[index], x: xForIndex(index) };
    }),
  };
}

export function AnomalyPriceContext({
  event,
  regional,
}: {
  event: AnomalyEvent;
  regional: RegionalV1 | null;
}) {
  const [windowDays, setWindowDays] = useState(90);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const context = useMemo(() => buildContext(event, regional, windowDays), [event, regional, windowDays]);

  if (!context) {
    return (
      <div className="anomaly-price anomaly-price--empty">
        <strong>Price context unavailable</strong>
        <p>No daily series was found for {event.node} in the regional dataset.</p>
      </div>
    );
  }

  const hovered = context.points.find((point) => point.date === hoveredDate) ?? null;
  const color = colorForAnomalyType(event.type);

  return (
    <div className="anomaly-price">
      <div className="anomaly-price__head">
        <div>
          <strong>Price context</strong>
          <p>Daily nodal mean · baselines use prior observations only · NZ$/MWh</p>
        </div>
        <div className="anomaly-price__windows" role="group" aria-label="Price context window">
          {WINDOWS.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={windowDays === days}
              onClick={() => setWindowDays(days)}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      <p className="anomaly-price__readout" aria-live="polite">
        {hovered
          ? `${formatShortDate(hovered.date)} · actual ${formatNzdPerMwh(hovered.price)} · trailing ${formatNzdPerMwh(hovered.trailing)} · seasonal ${formatNzdPerMwh(hovered.seasonal)}`
          : `Hover a point for values · shaded band marks ${formatShortDate(event.start)}${event.start !== event.end ? ` → ${formatShortDate(event.end)}` : ""}`}
      </p>

      <svg
        className="anomaly-price__chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Price context for ${event.label} at ${event.node}, ${formatShortDate(event.start)} to ${formatShortDate(event.end)}, NZ dollars per megawatt hour`}
        onMouseLeave={() => setHoveredDate(null)}
      >
        <rect
          x={context.shadeStart}
          y={PAD_T}
          width={context.shadeEnd - context.shadeStart}
          height={H - PAD_T - PAD_B}
          className="anomaly-price__shade"
        />
        {context.yTicks.map((value, index) => (
          <g key={index}>
            <line x1={PAD_L} x2={W - PAD_R} y1={context.yTicks.length > 1 ? PAD_T + (index / (context.yTicks.length - 1)) * (H - PAD_T - PAD_B) : PAD_T} y2={context.yTicks.length > 1 ? PAD_T + (index / (context.yTicks.length - 1)) * (H - PAD_T - PAD_B) : PAD_T} className="anomaly-price__grid" />
            <text x={PAD_L - 8} y={(context.yTicks.length > 1 ? PAD_T + (index / (context.yTicks.length - 1)) * (H - PAD_T - PAD_B) : PAD_T) + 4} textAnchor="end" className="anomaly-price__axis">{Math.round(value)}</text>
          </g>
        ))}
        {context.xTicks.map((tick, index) => (
          <text
            key={`${index}-${tick.date}`}
            x={tick.x}
            y={H - 10}
            textAnchor={index === 0 ? "start" : index === context.xTicks.length - 1 ? "end" : "middle"}
            className="anomaly-price__axis"
          >
            {formatShortDate(tick.date)}
          </text>
        ))}
        <path d={linePath(context.points, "seasonalY")} className="anomaly-price__line anomaly-price__line--seasonal" />
        <path d={linePath(context.points, "trailingY")} className="anomaly-price__line anomaly-price__line--trailing" />
        <path d={linePath(context.points, "y")} className="anomaly-price__line anomaly-price__line--actual" style={{ stroke: color }} />
        {context.points.map((point) => (
          <g key={point.date} onMouseEnter={() => setHoveredDate(point.date)}>
            <circle
              cx={point.x}
              cy={point.y}
              r={hoveredDate === point.date ? 4 : 2.4}
              fill={color}
              stroke="#fff"
              strokeWidth={1}
            />
            <title>{`${formatShortDate(point.date)} · actual ${formatNzdPerMwh(point.price)} · trailing ${formatNzdPerMwh(point.trailing)} · seasonal ${formatNzdPerMwh(point.seasonal)}`}</title>
          </g>
        ))}
        {context.peak ? (
          <g className="anomaly-price__peak">
            <circle cx={context.peak.x} cy={context.peak.y} r={8} />
            <circle cx={context.peak.x} cy={context.peak.y} r={4} fill={color} />
          </g>
        ) : null}
      </svg>

      <div className="anomaly-price__legend">
        <span><i className="anomaly-price__swatch anomaly-price__swatch--actual" style={{ background: color }} />Actual daily mean</span>
        <span><i className="anomaly-price__swatch anomaly-price__swatch--trailing" />Prior 30-day median</span>
        <span><i className="anomaly-price__swatch anomaly-price__swatch--seasonal" />Historic same-month median</span>
        <span><i className="anomaly-price__swatch anomaly-price__swatch--shade" />Detected period</span>
      </div>
    </div>
  );
}
