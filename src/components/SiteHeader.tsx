interface SiteHeaderProps {
  statusLabel: string;
  onNavigate?: (target: string) => void;
}

const LINKS = [
  { href: "#overview", label: "Overview" },
  { href: "#regions", label: "Regions" },
  { href: "#anomalies", label: "Anomalies" },
  { href: "#history", label: "History" },
  { href: "#method", label: "Method" },
];

export function SiteHeader({ statusLabel, onNavigate }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <a className="brand" href="#top" aria-label="NZ PowerWatch home">
          <span className="brand__mark" aria-hidden="true" />
          <span>
            NZ Power<span className="brand__suffix">Watch</span>
          </span>
        </a>
        <nav className="site-nav" aria-label="Insight sections">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => onNavigate?.(link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="status-pill" title="M0 uses a fixed real-data sample; daily automation is not enabled yet">
          <span className="status-pill__dot" aria-hidden="true" />
          {statusLabel}
        </div>
      </div>
    </header>
  );
}
