import type { SampleSummary } from "../lib/sample";

export function MethodStrip({ summary }: { summary: SampleSummary | null }) {
  return (
    <section className="section" aria-labelledby="method-strip-title">
      <div className="method-strip">
        <h3 id="method-strip-title">Built on receipts, not vibes.</h3>
        <div className="method-strip__item">
          <span>Source</span>
          <strong>Electricity Authority / EMI public data</strong>
        </div>
        <div className="method-strip__item">
          <span>Licence</span>
          <strong>{summary?.licence ?? "CC BY 4.0 International"}</strong>
        </div>
        <div className="method-strip__item">
          <span>Frequency</span>
          <strong>48 half-hourly trading periods per node per day</strong>
        </div>
        <div className="method-strip__item">
          <span>Unit</span>
          <strong>New Zealand dollars per megawatt-hour</strong>
        </div>
      </div>
    </section>
  );
}
