import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import type { CoastlineV1, RegionalNode, RegionalV1 } from "../lib/data";
import { colorForPrice } from "../lib/nodeColors";
import { formatNzd } from "../lib/format";

const VIEW_W = 720;
const VIEW_H = 960;
const MIN_W = 180;

interface NZNodeMapProps {
  regional: RegionalV1;
  coastline: CoastlineV1 | null;
  nodes: RegionalNode[];
  selectedCodes: string[];
  onToggleNode: (code: string) => void;
}

type ViewBox = { x: number; y: number; w: number; h: number };

export function NZNodeMap({ regional, coastline, nodes, selectedCodes, onToggleNode }: NZNodeMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const [view, setView] = useState<ViewBox>({ x: 0, y: 0, w: VIEW_W, h: VIEW_H });
  const [hovered, setHovered] = useState<string | null>(null);

  const polygons = coastline?.polygons ?? [];
  const position = useMemo(() => {
    const points: Array<[number, number]> = [];
    polygons.forEach((polygon) => polygon.forEach(([lon, lat]) => points.push([lon, lat])));
    nodes.forEach((node) => {
      if (node.lon !== null && node.lat !== null) points.push([node.lon, node.lat]);
    });
    if (!points.length) points.push([174, -41]);
    const lons = points.map(([lon]) => lon);
    const lats = points.map(([, lat]) => lat);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos(centerLat * (Math.PI / 180));
    const lonSpan = (maxLon - minLon) * cosLat;
    const latSpan = maxLat - minLat;
    const span = Math.max(lonSpan, latSpan) || 1;
    return {
      project: (lon: number, lat: number): [number, number] => [
        VIEW_W / 2 + ((lon - centerLon) * cosLat / span) * (VIEW_W * 0.82),
        VIEW_H / 2 - ((lat - centerLat) / span) * (VIEW_H * 0.88),
      ],
      centroids: polygons.map((polygon) => {
        const meanLon = polygon.reduce((total, [lon]) => total + lon, 0) / polygon.length;
        const meanLat = polygon.reduce((total, [, lat]) => total + lat, 0) / polygon.length;
        return { point: positionProject(meanLon, meanLat), lat: meanLat };
      }),
    };
    function positionProject(lon: number, lat: number): [number, number] {
      return [
        VIEW_W / 2 + ((lon - centerLon) * cosLat / span) * (VIEW_W * 0.82),
        VIEW_H / 2 - ((lat - centerLat) / span) * (VIEW_H * 0.88),
      ];
    }
  }, [polygons, nodes]);

  const prices = nodes.map((node) => node.latest).filter((value): value is number => value !== null);
  const priceMin = prices.length ? Math.min(...prices) : 0;
  const priceMax = prices.length ? Math.max(...prices) : 1;

  const clampView = (next: ViewBox): ViewBox => ({
    x: Math.max(0, Math.min(VIEW_W - next.w, next.x)),
    y: Math.max(0, Math.min(VIEW_H - next.h, next.y)),
    w: next.w,
    h: next.h,
  });

  const zoomBy = (factor: number, cx = VIEW_W / 2, cy = VIEW_H / 2) => {
    setView((current) => {
      const w = Math.max(MIN_W, Math.min(VIEW_W, current.w * factor));
      const h = Math.min(VIEW_H, w * (VIEW_H / VIEW_W));
      const ratioX = (cx - current.x) / current.w;
      const ratioY = (cy - current.y) / current.h;
      return clampView({ x: cx - ratioX * w, y: cy - ratioY * h, w, h });
    });
  };

  const svgPoint = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return [VIEW_W / 2, VIEW_H / 2] as [number, number];
    return [
      view.x + ((event.clientX - rect.left) / rect.width) * view.w,
      view.y + ((event.clientY - rect.top) / rect.height) * view.h,
    ] as [number, number];
  };

  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const [cx, cy] = svgPoint(event);
    zoomBy(event.deltaY > 0 ? 1.15 : 0.87, cx, cy);
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = { clientX: event.clientX, clientY: event.clientY, x: view.x, y: view.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    setView((current) =>
      clampView({
        ...current,
        x: drag.x - ((event.clientX - drag.clientX) / rect.width) * current.w,
        y: drag.y - ((event.clientY - drag.clientY) / rect.height) * current.h,
      }),
    );
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const hoveredNode = nodes.find((node) => node.code === hovered);
  const hoveredStatus = hoveredNode?.latestIndex !== null && hoveredNode?.latestIndex !== undefined
    ? regional.dateStatus[hoveredNode.latestIndex]
    : "—";
  const proxyCount = nodes.filter((node) => node.coordinateSource === "official_nsp_substation_proxy").length;

  return (
    <section className="nz-map" aria-labelledby="nz-map-title">
      <div className="nz-map__head">
        <div>
          <h2 id="nz-map-title">Pricing node map</h2>
          <p>
            {nodes.length} nodes · Natural Earth coastline · {proxyCount} same-substation coordinate proxies
          </p>
        </div>
        <div className="nz-map__controls">
          <button type="button" onClick={() => zoomBy(0.82)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomBy(1.22)} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setView({ x: 0, y: 0, w: VIEW_W, h: VIEW_H })}>Reset</button>
        </div>
      </div>

      <div className="nz-map__canvas">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          role="img"
          aria-label="Interactive map of New Zealand pricing nodes"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {polygons.map((polygon, index) => (
            <polygon
              key={index}
              points={polygon.map(([lon, lat]) => position.project(lon, lat).join(",")).join(" ")}
              className="nz-map__land"
            />
          ))}
          {position.centroids.map((centroid, index) => (
            <text
              key={`label-${index}`}
              x={centroid.point[0]}
              y={centroid.point[1]}
              className="nz-map__region-label"
            >
              {centroid.lat > -41 ? "North Island" : "South Island"}
            </text>
          ))}
          {nodes.map((node) => {
            const [x, y] = position.project(node.lon as number, node.lat as number);
            const selected = selectedCodes.includes(node.code);
            const color = colorForPrice(node.latest, priceMin, priceMax);
            return (
              <g
                key={node.code}
                className={`nz-map__node${selected ? " nz-map__node--selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${node.label}, ${node.code}, ${node.latest === null ? "no price" : formatNzd(node.latest)}`}
                aria-pressed={selected}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleNode(node.code);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggleNode(node.code);
                  }
                }}
                onMouseEnter={() => setHovered(node.code)}
                onMouseLeave={() => setHovered(null)}
              >
                {selected ? <circle cx={x} cy={y} r={12} className="nz-map__ring" /> : null}
                {node.coordinateSource === "official_nsp_substation_proxy" ? (
                  <circle cx={x} cy={y} r={9} className="nz-map__proxy-ring" />
                ) : null}
                <circle cx={x} cy={y} r={selected ? 6.5 : 4.8} fill={color} stroke="#fff" strokeWidth={1.6} />
                {selected && nodes.filter((item) => selectedCodes.includes(item.code)).length <= 8 ? (
                  <text x={x + 9} y={y - 9} className="nz-map__node-label">{node.label}</text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {hoveredNode ? (
          <div className="nz-map__tooltip" role="status">
            <strong>{hoveredNode.label}</strong>
            <span>{hoveredNode.code} · {hoveredNode.region} · {hoveredNode.island}</span>
            <b>{formatNzd(hoveredNode.latest)} /MWh</b>
            <small>
              {hoveredStatus} · 7d σ {formatNzd(hoveredNode.volatility7d)}
            </small>
            {hoveredNode.coordinateSource === "official_nsp_substation_proxy" ? (
              <small>Site coordinate proxy · {hoveredNode.coordinateProxyCode}</small>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="nz-map__legend" aria-label="Price colour scale">
        <span><i style={{ background: "#6b4cf1" }} /> negative</span>
        <span><i style={{ background: "#8ed8f8" }} /> low</span>
        <span><i style={{ background: "#c9f05a" }} /> lower mid</span>
        <span><i style={{ background: "#ffbd6b" }} /> upper mid</span>
        <span><i style={{ background: "#ff7a63" }} /> high</span>
        <span className="nz-map__range">{formatNzd(priceMin)} – {formatNzd(priceMax)} /MWh</span>
      </div>
    </section>
  );
}
