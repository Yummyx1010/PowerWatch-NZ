export function formatNzd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

export function formatNzdPerMwh(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `NZ$${value.toFixed(2)}/MWh`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-NZ").format(value);
}

export function formatSampleDate(value: string | null | undefined): string {
  if (!value) return "Awaiting sample data";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-NZ", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonth(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}-01T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NZ", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function seriesToBarHeights(prices: number[], floor = 12): number[] {
  if (prices.length === 0) return [];
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const span = max - min || 1;
  return prices.map((price) => floor + ((price - min) / span) * (100 - floor));
}
