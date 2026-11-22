import { ROUTES, type RouteId } from "../lib/router";
import type { PowerWatchData } from "../lib/data";

export function SiteFooter({
  data,
  navigate,
}: {
  data: PowerWatchData;
  navigate: (route: RouteId) => void;
}) {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="site-footer__top">
          <div>
            <p className="site-footer__kicker">NZ PowerWatch</p>
            <p className="site-footer__line">Public electricity market data, made legible.</p>
          </div>
          <nav className="site-footer__nav" aria-label="Footer navigation">
            {ROUTES.map((item) => (
              <a
                key={item.id}
                href={item.path}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(item.id);
                }}
              >
                {item.short}
              </a>
            ))}
          </nav>
        </div>
        <div className="site-footer__bottom">
          <span>Independent Computer Science portfolio project</span>
          <span>
            {data.sample?.attribution ?? "Electricity Authority (New Zealand)"} ·{" "}
            {data.sample?.licence ?? "CC BY 4.0"}
          </span>
          <span>Not affiliated with or endorsed by the Electricity Authority</span>
        </div>
      </div>
    </footer>
  );
}
