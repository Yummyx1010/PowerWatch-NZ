import { useMemo, useState } from "react";
import { usePowerWatchData } from "../components/DataProvider";
import { ChartFrame, DataCard, PageIntro, PlannedPanel, SectionHeading, StatePanel } from "../components/ui";
import { formatCompact, formatCount, formatMonth } from "../lib/format";

function monthKeys(start: string, end: string): string[] {
  const keys: string[] = [];
  const [year, month] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  let currentYear = year;
  let currentMonth = month;
  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    keys.push(`${currentYear}-${String(currentMonth).padStart(2, "0")}`);
    currentMonth += 1;
    if (currentMonth === 13) {
      currentYear += 1;
      currentMonth = 1;
    }
  }
  return keys;
}

function sparklinePath(values: number[], width = 560, height = 170): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function HistoryPage() {
  const { data, loading, freshness, reload } = usePowerWatchData();
  const [range, setRange] = useState<"12" | "all">("12");
  const [activeGapKey, setActiveGapKey] = useState<string | null>(null);

  const quality = data.quality;
  const coverage = data.manifest?.coverage;
  const months = data.coverage?.months ?? [];

  const otaSeries = useMemo(() => {
    return (data.priceSummary?.points ?? [])
      .filter((point) => point.node === "OTA2201" && point.priceType === "final")
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [data.priceSummary]);

  const visibleSeries = range === "12" ? otaSeries.slice(-12) : otaSeries;
  const path = sparklinePath(visibleSeries.map((point) => point.meanPrice));

  if (loading && !coverage) {
    return <StatePanel tone="loading" title="Reading history" message="Loading coverage and monthly summaries…" />;
  }

  if (freshness === "error" || !coverage || !quality) {
    return (
      <StatePanel
        tone="error"
        title="Historical data unavailable"
        message={data.errors.join(" · ") || "Coverage or quality payload is missing."}
        action={<button className="button button--ghost" type="button" onClick={reload}>Retry</button>}
      />
    );
  }

  const monthKeysAll = monthKeys(coverage.requestedStart.slice(0, 7), coverage.requestedEnd.slice(0, 7));
  const covered = new Set(months.filter((month) => month.status === "ok").map((month) => month.start.slice(0, 7)));
  const interim = new Set(months.filter((month) => month.status === "interim").map((month) => month.start.slice(0, 7)));
  const gapForMonth = (key: string) =>
    (data.coverage?.gaps ?? []).find(
      (gap) => key >= gap.start.slice(0, 7) && key <= gap.end.slice(0, 7),
    );
  const activeGap = activeGapKey ? gapForMonth(activeGapKey) : undefined;

  return (
    <div className="page page--history">
      <div className="shell">
        <PageIntro
          eyebrow="Historical analytics"
          title="Three years."
          accent="One clear spine."
          lede="This is the data spine, not the finished analysis lab. Real coverage, real monthly means and real DST counts are shown; seasonality and distributions come in M6."
          badge={`${formatCount(coverage.finalDays)} final days`}
        />

        <section className="section">
          <SectionHeading index="01" title="Coverage spine" note="Each tick is a requested month. Green means a complete published file; coral means a documented gap." />
          <div className="coverage-strip" role="img" aria-label={`Monthly coverage from ${coverage.requestedStart} to ${coverage.requestedEnd}`}>
            {monthKeysAll.map((key) => {
              const tone = covered.has(key) ? "ok" : interim.has(key) ? "interim" : "gap";
              const gap = tone === "gap" ? gapForMonth(key) : undefined;
              if (!gap) {
                return (
                  <span
                    key={key}
                    className={`coverage-strip__tick coverage-strip__tick--${tone}`}
                    title={`${formatMonth(key)} · ${tone}`}
                  />
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  className={`coverage-strip__tick coverage-strip__tick--${tone}`}
                  aria-label={`Data gap: ${formatMonth(key)}`}
                  onMouseEnter={() => setActiveGapKey(key)}
                  onMouseLeave={() => setActiveGapKey(null)}
                  onFocus={() => setActiveGapKey(key)}
                  onBlur={() => setActiveGapKey(null)}
                />
              );
            })}
          </div>
          {activeGap ? (
            <div className="coverage-tooltip" role="status" aria-live="polite">
              <strong>
                {formatMonth(activeGap.start)} → {formatMonth(activeGap.end)}
              </strong>
              <span>{formatCount(activeGap.days)} missing days</span>
              <p>{activeGap.reason}</p>
            </div>
          ) : null}
          <div className="coverage-legend">
            <span><i className="ok" /> complete month</span>
            <span><i className="interim" /> interim days</span>
            <span><i className="gap" /> documented gap</span>
          </div>
          <div className="stat-rail stat-rail--tight">
            <DataCard label="Rows processed" value={formatCompact(quality.totals.rows)} hint="Standardised nodal records" tone="violet" />
            <DataCard label="Gap days" value={formatCount(coverage.gapDays)} hint={coverage.gaps[0] ? `${formatMonth(coverage.gaps[0].start)} → ${formatMonth(coverage.gaps[0].end)}` : "—"} tone="coral" />
            <DataCard label="Last final day" value={formatMonth(coverage.lastFinalDate)} hint={`Interim through ${formatMonth(coverage.lastInterimDate)}`} tone="lime" />
          </div>
        </section>

        <section className="section history-split">
          <ChartFrame
            title="Otahuhu monthly mean"
            subtitle="Real monthly means from the M1 price summary — a preview, not the full analytics view."
            status="real"
          >
            <div className="sparkline-controls" role="group" aria-label="Chart range">
              <button type="button" aria-pressed={range === "12"} onClick={() => setRange("12")}>Last 12</button>
              <button type="button" aria-pressed={range === "all"} onClick={() => setRange("all")}>All months</button>
            </div>
            <svg className="sparkline" viewBox="0 0 560 170" role="img" aria-label="Otahuhu monthly mean price trend">
              <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6b4cf1" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#6b4cf1" stopOpacity="0" />
                </linearGradient>
              </defs>
              {path ? <path d={`${path} L560,170 L0,170 Z`} fill="url(#spark-fill)" /> : null}
              {path ? <path d={path} className="sparkline__line" /> : null}
            </svg>
            <p className="sparkline-caption">
              {visibleSeries.length} real monthly points · {visibleSeries[0] ? formatMonth(visibleSeries[0].month) : "—"} to{" "}
              {visibleSeries[visibleSeries.length - 1] ? formatMonth(visibleSeries[visibleSeries.length - 1].month) : "—"}
            </p>
          </ChartFrame>

          <div className="dst-panel">
            <SectionHeading index="02" title="Time behaves differently" />
            <p>
              Trading days are not always 48 periods. The pipeline resolves 46, 48 and 50-period
              days using the Electricity Authority's official DST rule.
            </p>
            <div className="dst-counts">
              {Object.entries(quality.periodCountDays).map(([count, days]) => (
                <div key={count}>
                  <strong>{count}</strong>
                  <span>periods</span>
                  <em>{formatCount(days)} days</em>
                </div>
              ))}
            </div>
            <p className="dst-panel__note">No records are dropped on transition days.</p>
          </div>
        </section>

        <section className="section">
          <PlannedPanel
            title="Seasonality & distribution lab"
            milestone="M6"
            description="Price duration curves, histograms and month-by-period heatmaps will live here."
          />
          <ChartFrame
            title="Price distribution"
            subtitle="Distribution analysis is not implemented in M2."
            status="planned"
          >
            <div className="chart-placeholder chart-placeholder--wide">
              <div className="chart-placeholder__bars" aria-hidden="true">
                {[38, 62, 80, 94, 72, 52, 34, 20].map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
              <p>Histogram and duration curve land in Milestone 6.</p>
            </div>
          </ChartFrame>
        </section>
      </div>
    </div>
  );
}
