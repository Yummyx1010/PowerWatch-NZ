import { useState } from "react";
import type { DataFreshness } from "../lib/data";
import { ROUTES, type RouteId } from "../lib/router";

interface SiteHeaderProps {
  route: RouteId;
  navigate: (route: RouteId) => void;
  freshness: DataFreshness;
  statusLabel: string;
}

const FRESHNESS_LABEL: Record<DataFreshness, string> = {
  loading: "READING DATA",
  error: "DATA ERROR",
  empty: "NO DATA",
  fresh: "FRESH SNAPSHOT",
  stale: "STALE SNAPSHOT",
};

export function SiteHeader({ route, navigate, freshness, statusLabel }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (next: RouteId) => {
    navigate(next);
    setMenuOpen(false);
  };

  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <a
          className="brand"
          href={ROUTES[0].path}
          onClick={(event) => {
            event.preventDefault();
            go("overview");
          }}
          aria-label="NZ PowerWatch home"
        >
          <span className="brand__mark" aria-hidden="true" />
          <span>
            NZ Power<span className="brand__suffix">Watch</span>
          </span>
        </a>

        <nav className="site-nav" aria-label="Main navigation">
          {ROUTES.map((item) => (
            <a
              key={item.id}
              href={item.path}
              aria-current={item.id === route ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                go(item.id);
              }}
            >
              {item.short}
            </a>
          ))}
        </nav>

        <div className="site-header__right">
          <div
            className={`status-pill status-pill--${freshness}`}
            title={statusLabel}
            aria-label={`Data status: ${FRESHNESS_LABEL[freshness]}`}
          >
            <span className="status-pill__dot" aria-hidden="true" />
            {FRESHNESS_LABEL[freshness]}
          </div>
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      <nav
        id="mobile-nav"
        className={`mobile-nav${menuOpen ? " mobile-nav--open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        {ROUTES.map((item, index) => (
          <a
            key={item.id}
            href={item.path}
            aria-current={item.id === route ? "page" : undefined}
            tabIndex={menuOpen ? 0 : -1}
            onClick={(event) => {
              event.preventDefault();
              go(item.id);
            }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
