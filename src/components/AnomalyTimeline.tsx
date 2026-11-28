import type { AnomalyEvent } from "../lib/data";
import { colorForAnomalyType } from "../lib/nodeColors";
import { formatCount, formatShortDate } from "../lib/format";

const W = 920;
const H = 176;
const PAD_L = 48;
const PAD_R = 18;
const PAD_T = 14;
const PAD_B = 30;

interface AnomalyTimelineProps {
  events: AnomalyEvent[];
  selectedId: string | null;
  onSelect: (event: AnomalyEvent) => void;
}

function timeOf(value: string): number {
  return new Date(`${value}T12:00:00Z`).getTime();
}

function dayAt(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function AnomalyTimeline({ events, selectedId, onSelect }: AnomalyTimelineProps) {
  if (!events.length) {
    return <p className="anomaly-empty">No events match the current filters.</p>;
  }

  const dates = events.map((event) => event.peakDate);
  const firstDate = dates.reduce((min, value) => (value < min ? value : min), dates[0]);
  const lastDate = dates.reduce((max, value) => (value > max ? value : max), dates[0]);
  let start = timeOf(firstDate);
  let end = timeOf(lastDate);
  if (end === start) end = start + 86_400_000;
  const span = end - start;

  const severities = events.map((event) => event.severity);
  const rawMin = severities.reduce((min, value) => Math.min(min, value), 100);
  const rawMax = severities.reduce((max, value) => Math.max(max, value), 0);
  let yMin = Math.max(0, Math.floor((rawMin - 5) / 10) * 10);
  let yMax = Math.min(100, Math.ceil((rawMax + 5) / 10) * 10);
  if (yMax - yMin < 20) {
    yMin = Math.max(0, yMin - 10);
    yMax = Math.min(100, yMax + 10);
  }
  const ySpan = Math.max(1, yMax - yMin);
  const step = ySpan <= 30 ? 10 : ySpan <= 60 ? 20 : 25;
  const ticks: number[] = [];
  for (let value = yMin; value <= yMax; value += step) ticks.push(value);
  if (ticks[ticks.length - 1] !== yMax) ticks.push(yMax);

  const xFor = (day: string) => PAD_L + ((timeOf(day) - start) / span) * (W - PAD_L - PAD_R);
  const yFor = (severity: number) => PAD_T + (1 - (severity - yMin) / ySpan) * (H - PAD_T - PAD_B);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const day = dayAt(start + span * ratio);
    return { day, x: xFor(day) };
  });
  const ordered = [...events].sort((a, b) => {
    if (a.id === selectedId) return 1;
    if (b.id === selectedId) return -1;
    return 0;
  });

  return (
    <div className="anomaly-timeline__wrap">
      <svg className="anomaly-timeline" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Anomaly severity timeline">
        {ticks.map((level) => (
          <g key={level}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yFor(level)} y2={yFor(level)} className="anomaly-timeline__grid" />
            <text x={PAD_L - 8} y={yFor(level) + 4} textAnchor="end" className="anomaly-timeline__axis">{level}</text>
          </g>
        ))}
        {xTicks.map((tick, index) => (
          <g key={`${index}-${tick.day}`}>
            <line x1={tick.x} x2={tick.x} y1={PAD_T} y2={H - PAD_B} className="anomaly-timeline__grid anomaly-timeline__grid--vertical" />
            <text
              x={tick.x}
              y={H - 9}
              textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"}
              className="anomaly-timeline__axis"
            >
              {formatShortDate(tick.day)}
            </text>
          </g>
        ))}
        {ordered.map((event) => {
          const selected = event.id === selectedId;
          const cx = xFor(event.peakDate);
          const cy = yFor(event.severity);
          return (
            <g
              key={event.id}
              className={`anomaly-timeline__point${selected ? " anomaly-timeline__point--selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${event.label}, ${event.node}, ${event.type.replace(/_/g, " ")}, ${formatShortDate(event.peakDate)}, severity ${event.severity}`}
              onClick={() => onSelect(event)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                  keyEvent.preventDefault();
                  onSelect(event);
                }
              }}
            >
              {selected ? <circle cx={cx} cy={cy} r={11} className="anomaly-timeline__ring" /> : null}
              <circle
                cx={cx}
                cy={cy}
                r={selected ? 7 : Math.min(6, 3 + event.severity / 35)}
                fill={colorForAnomalyType(event.type)}
                stroke="#fff"
                strokeWidth={selected ? 2 : 1.2}
                opacity={selected ? 1 : 0.82}
              />
              <title>{`${event.label} · ${event.node} · ${event.type.replace(/_/g, " ")} · ${formatShortDate(event.peakDate)} · ${event.severity}/100`}</title>
            </g>
          );
        })}
      </svg>
      <p className="anomaly-timeline__meta">
        {formatCount(events.length)} events across {formatCount(new Set(dates).size)} dates · severity {rawMin}–{rawMax} · every matching event is shown
      </p>
    </div>
  );
}
