import type { SampleNode } from "../lib/sample";

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  OTA2201: { x: 174, y: 108 },
  HAY2201: { x: 204, y: 208 },
  ISL2201: { x: 142, y: 302 },
};

const NODE_COLORS: Record<string, string> = {
  OTA2201: "#6b4cf1",
  HAY2201: "#ff7a63",
  ISL2201: "#179c8a",
};

interface RegionalMapProps {
  nodes: SampleNode[];
  activeNodes: string[];
  onToggleNode: (code: string) => void;
}

export function RegionalMap({ nodes, activeNodes, onToggleNode }: RegionalMapProps) {
  return (
    <section className="regional-map" aria-labelledby="regional-map-title">
      <div className="regional-map__head">
        <div>
          <h2 id="regional-map-title">Node map</h2>
          <p>Schematic only · not a geographic or price map</p>
        </div>
        <span>NZ / 3 NODES</span>
      </div>
      <svg viewBox="0 0 320 420" role="img" aria-label="Schematic map of New Zealand with three representative pricing nodes">
        <path
          d="M118 36 C150 22 194 38 205 70 C215 98 196 122 210 148 C224 174 235 194 218 221 C205 242 176 235 162 214 C148 193 156 170 142 150 C126 128 104 112 108 84 C111 60 103 45 118 36 Z"
          className="regional-map__land"
        />
        <path
          d="M214 232 C236 226 258 240 262 264 C268 296 246 318 226 342 C207 365 188 390 165 392 C143 394 136 375 147 356 C160 334 176 315 184 291 C191 268 195 238 214 232 Z"
          className="regional-map__land"
        />
        <text x="150" y="150" className="regional-map__island">NI</text>
        <text x="205" y="290" className="regional-map__island">SI</text>

        {nodes.map((node) => {
          const position = NODE_POSITIONS[node.code];
          if (!position) return null;
          const active = activeNodes.includes(node.code);
          return (
            <g
              key={node.code}
              className={`regional-map__marker${active ? " regional-map__marker--active" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${node.label}, ${node.area}, ${node.code}`}
              aria-pressed={active}
              onClick={() => onToggleNode(node.code)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggleNode(node.code);
                }
              }}
            >
              <circle cx={position.x} cy={position.y} r={active ? 12 : 9} fill={NODE_COLORS[node.code]} />
              {active ? <circle cx={position.x} cy={position.y} r={20} className="regional-map__halo" /> : null}
              <text x={position.x + 18} y={position.y + 4} className="regional-map__label">
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="regional-map__foot">
        Tap a marker to include or exclude that node from the comparison.
      </p>
    </section>
  );
}
