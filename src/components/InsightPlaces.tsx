import type { CSSProperties } from "react";

interface InsightPlace {
  id: string;
  index: string;
  title: string;
  description: string;
  milestone: string;
  accent: string;
}

const PLACES: InsightPlace[] = [
  {
    id: "overview",
    index: "01",
    title: "Market Overview",
    description: "A daily read on price level, direction and the signals that matter right now.",
    milestone: "Milestone 03",
    accent: "var(--violet)",
  },
  {
    id: "regions",
    index: "02",
    title: "Regional Intelligence",
    description: "See how Auckland, Wellington and Christchurch diverge — and why.",
    milestone: "Milestone 04",
    accent: "var(--lime)",
  },
  {
    id: "anomalies",
    index: "03",
    title: "Anomaly Intelligence",
    description: "Spot spikes, drops and volatility bursts with an explanation attached.",
    milestone: "Milestone 05",
    accent: "var(--coral)",
  },
  {
    id: "history",
    index: "04",
    title: "Historical Analytics",
    description: "Trends, seasonality and price distributions across the wholesale market.",
    milestone: "Milestone 06",
    accent: "var(--sky)",
  },
  {
    id: "method",
    index: "05",
    title: "Data & Methodology",
    description: "Sources, definitions, update times and honest limitations, in plain language.",
    milestone: "Milestone 07",
    accent: "var(--paper-deep)",
  },
];

export function InsightPlaces() {
  return (
    <section className="section" aria-labelledby="places-title">
      <div className="section__head">
        <h2 id="places-title">Five ways to read the market.</h2>
        <p>
          The visual language and navigation are in place. Each insight area gets built
          in its own milestone — no placeholder charts pretending to be analysis.
        </p>
      </div>
      <div className="insight-grid">
        {PLACES.map((place) => (
          <article
            key={place.id}
            id={place.id}
            className="insight-card"
            style={{ "--accent": place.accent } as CSSProperties}
          >
            <span className="insight-card__index">{place.index} / 05</span>
            <h3>{place.title}</h3>
            <p>{place.description}</p>
            <span className="insight-card__tag">{place.milestone}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
