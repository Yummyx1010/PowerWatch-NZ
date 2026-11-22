import { formatCount, formatNzd, formatSampleDate, seriesToBarHeights } from "../lib/format";
import type { PowerWatchData } from "../lib/data";

export function SignalCard({ data, loading }: { data: PowerWatchData; loading: boolean }) {
  const summary = data.sample;
  const heights = summary ? seriesToBarHeights(summary.series.map((point) => point.price)) : [];

  return (
    <aside className="signal-card" aria-label="Verified real-data sample">
      <p className="signal-card__label">Verified sample // not live</p>
      <p className="signal-card__date">{formatSampleDate(summary?.sampleDate)}</p>
      <div
        className="signal-card__bars"
        role="img"
        aria-label={
          summary
            ? `Otahuhu half-hourly prices from ${summary.sampleDate}, 24 sampled trading periods`
            : "Price signal unavailable"
        }
      >
        {(heights.length ? heights : Array<number>(24).fill(20)).map((height, index) => (
          <span
            key={index}
            style={{ height: `${height}%`, animationDelay: `${index * 18}ms` }}
          />
        ))}
      </div>
      <dl className="signal-card__stats">
        <div className="signal-card__stat">
          <dt>Representative nodes</dt>
          <dd>{formatCount(summary?.nodes.length)}</dd>
        </div>
        <div className="signal-card__stat">
          <dt>Periods per day</dt>
          <dd>{formatCount(summary?.periodsPerDay)}</dd>
        </div>
        <div className="signal-card__stat">
          <dt>Sample low</dt>
          <dd>{formatNzd(summary?.priceMinNzdPerMwh)}</dd>
        </div>
        <div className="signal-card__stat">
          <dt>Sample high</dt>
          <dd>{formatNzd(summary?.priceMaxNzdPerMwh)}</dd>
        </div>
      </dl>
      <p className="signal-card__foot">
        {loading
          ? "Loading verified sample…"
          : summary
            ? `${summary.attribution}. ${summary.series.length} real Otahuhu prices shown above.`
            : "Sample data could not be loaded. Run the Python export step."}
      </p>
    </aside>
  );
}
