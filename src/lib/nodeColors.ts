const PALETTE = [
  "#6b4cf1",
  "#ff7a63",
  "#179c8a",
  "#d4941b",
  "#3b82f6",
  "#d946ef",
  "#0ea5a4",
  "#ef6c2f",
];

export function colorForNode(code: string): string {
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) {
    hash = (hash * 31 + code.charCodeAt(index)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function colorForPrice(value: number | null, min: number, max: number): string {
  if (value === null) return "#dfe2d6";
  if (value < 0) return "#6b4cf1";
  const span = max - min || 1;
  const ratio = (value - min) / span;
  if (ratio < 0.2) return "#8ed8f8";
  if (ratio < 0.4) return "#a9df7a";
  if (ratio < 0.6) return "#c9f05a";
  if (ratio < 0.8) return "#ffbd6b";
  return "#ff7a63";
}
