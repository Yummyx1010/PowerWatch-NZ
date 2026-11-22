import { useEffect, useState } from "react";
import { InsightPlaces } from "./components/InsightPlaces";
import { MethodStrip } from "./components/MethodStrip";
import { SignalCard } from "./components/SignalCard";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { loadSampleSummary, type SampleSummary } from "./lib/sample";

export default function App() {
  const [summary, setSummary] = useState<SampleSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadSampleSummary()
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch(() => {
        if (active) setSummary(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div id="top">
      <SiteHeader statusLabel={loading ? "LOADING SAMPLE" : "M0 · REAL SAMPLE"} />
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="shell hero__grid">
            <div>
              <p className="eyebrow">Wholesale electricity intelligence · Aotearoa NZ</p>
              <h1 id="hero-title">
                The market has a <em>pulse.</em>
              </h1>
              <p className="hero__lede">
                NZ PowerWatch turns public Electricity Authority data into clear stories about
                price movement, regional difference and strange market days. This is the
                foundation release: verified data, a distinct visual language, and a roadmap
                you can follow.
              </p>
              <div className="hero__actions">
                <a className="button button--primary" href="#overview">
                  Explore the shape of it <span aria-hidden="true">→</span>
                </a>
                <a className="button button--ghost" href="#method-strip-title">
                  See where data comes from
                </a>
              </div>
            </div>
            <SignalCard summary={summary} loading={loading} />
          </div>
        </section>
        <div className="shell">
          <InsightPlaces />
          <MethodStrip summary={summary} />
        </div>
      </main>
      <SiteFooter summary={summary} />
    </div>
  );
}
