import { useCallback, useEffect, useState } from "react";

export const ROUTES = [
  { id: "overview", path: "#/overview", label: "Market Overview", short: "Overview" },
  { id: "regions", path: "#/regions", label: "Regional Intelligence", short: "Regions" },
  { id: "anomalies", path: "#/anomalies", label: "Price Anomalies", short: "Anomalies" },
  { id: "history", path: "#/history", label: "Historical Analytics", short: "History" },
  { id: "method", path: "#/method", label: "Data & Methodology", short: "Method" },
] as const;

export type RouteId = (typeof ROUTES)[number]["id"];

const VALID_ROUTES = new Set<string>(ROUTES.map((route) => route.id));

export function currentRouteId(): RouteId {
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  return VALID_ROUTES.has(hash) ? (hash as RouteId) : "overview";
}

export function useHashRoute(): { route: RouteId; navigate: (route: RouteId) => void } {
  const [route, setRoute] = useState<RouteId>(() => currentRouteId());

  useEffect(() => {
    const onChange = () => setRoute(currentRouteId());
    window.addEventListener("hashchange", onChange);
    if (!window.location.hash) window.history.replaceState(null, "", ROUTES[0].path);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((next: RouteId) => {
    const path = ROUTES.find((item) => item.id === next)?.path ?? ROUTES[0].path;
    if (window.location.hash !== path) window.location.hash = path;
    setRoute(next);
  }, []);

  return { route, navigate };
}
