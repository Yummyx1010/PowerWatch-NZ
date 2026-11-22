import type { ReactNode } from "react";

export function PageIntro({
  eyebrow,
  title,
  accent,
  lede,
  badge,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  lede: string;
  badge?: string;
}) {
  return (
    <header className="page-intro">
      <div className="page-intro__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>
          {title}{" "}
          {accent ? <em>{accent}</em> : null}
        </h1>
        <p className="page-intro__lede">{lede}</p>
      </div>
      {badge ? <span className="page-intro__badge">{badge}</span> : null}
    </header>
  );
}

export function SectionHeading({
  index,
  title,
  note,
}: {
  index?: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="section-heading">
      {index ? <span className="section-heading__index">{index}</span> : null}
      <div>
        <h2>{title}</h2>
        {note ? <p>{note}</p> : null}
      </div>
    </div>
  );
}

export function StatePanel({
  tone = "empty",
  title,
  message,
  action,
}: {
  tone?: "loading" | "error" | "empty" | "stale";
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className={`state-panel state-panel--${tone}`} role="status">
      <span className="state-panel__mark" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
        {action}
      </div>
    </div>
  );
}

export function DataCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "violet" | "lime" | "coral" | "sky";
}) {
  return (
    <div className={`data-card${tone ? ` data-card--${tone}` : ""}`}>
      <span className="data-card__label">{label}</span>
      <strong className="data-card__value">{value}</strong>
      {hint ? <span className="data-card__hint">{hint}</span> : null}
    </div>
  );
}

export function ChartFrame({
  title,
  subtitle,
  status,
  children,
  minHeight = 260,
}: {
  title: string;
  subtitle: string;
  status: "real" | "planned";
  children: ReactNode;
  minHeight?: number;
}) {
  return (
    <section className="chart-frame" style={{ minHeight }}>
      <div className="chart-frame__head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span className={`chart-frame__badge chart-frame__badge--${status}`}>
          {status === "real" ? "REAL DATA" : "PLANNED"}
        </span>
      </div>
      <div className="chart-frame__body">{children}</div>
    </section>
  );
}

export function PlannedPanel({ title, milestone, description }: { title: string; milestone: string; description: string }) {
  return (
    <div className="planned-panel">
      <span className="planned-panel__spark" aria-hidden="true">✳</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <span className="planned-panel__milestone">{milestone}</span>
    </div>
  );
}
