import type { SampleSummary } from "../lib/sample";

export function SiteFooter({ summary }: { summary: SampleSummary | null }) {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__inner">
        <span>NZ PowerWatch · Independent Computer Science portfolio project</span>
        <span>
          {summary?.attribution ?? "Electricity Authority (New Zealand)"} · {summary?.licence ?? "CC BY 4.0"}
        </span>
        <span>Not affiliated with or endorsed by the Electricity Authority</span>
      </div>
    </footer>
  );
}
