import { loadSampleSummary, type SampleSummary } from "./sample";

export interface CoverageSummary {
  requestedStart: string;
  requestedEnd: string;
  firstFinalDate: string | null;
  lastFinalDate: string | null;
  lastInterimDate: string | null;
  finalDays: number;
  interimDays: number;
  gapDays: number;
  gaps: Array<{ start: string; end: string }>;
}

export interface ManifestV1 {
  schemaVersion: string;
  dataVersion: string;
  sourceCount: number;
  coverage: CoverageSummary;
}

export interface CoverageMonth {
  key: string;
  kind: string;
  status: string;
  start: string;
  end: string;
  rows: number;
  priceStatus: string;
}

export interface CoverageGap {
  start: string;
  end: string;
  days: number;
  reason: string;
}

export interface CoverageV1 {
  months: CoverageMonth[];
  gaps: CoverageGap[];
}

export interface QualityV1 {
  schemaVersion: string;
  sourceCount: number;
  totals: {
    rows: number;
    duplicateKeys: number;
    incompleteNodeDays: number;
    negativePrices: number;
    zeroPrices: number;
  };
  missingByColumn: Record<string, number>;
  priceStatusCounts: Record<string, number>;
  timeTagDistribution: Record<string, number>;
  periodCountDays: Record<string, number>;
  priceMin: number | null;
  priceMax: number | null;
}

export interface PricePoint {
  month: string;
  node: string;
  priceType: string;
  meanPrice: number;
}

export interface PriceSummaryV1 {
  nodes: string[];
  points: PricePoint[];
}

export interface RecentPricePoint {
  date: string;
  period: number;
  local: string;
  utc: string;
  node: string;
  label: string;
  price: number;
  status: string;
  type: string;
}

export interface DailyPricePoint {
  date: string;
  node: string;
  label: string;
  mean: number;
  min: number;
  max: number;
  periods: number;
  status: string;
  type: string;
}

export interface OverviewMetrics {
  latestDate: string;
  latestFinalDate: string;
  latestPrices: Array<{
    node: string;
    label: string;
    price: number;
    status: string;
    local: string;
  }>;
  latestDaily: DailyPricePoint[];
  regionalSpread: {
    date: string;
    highNode: string;
    highLabel: string;
    high: number;
    lowNode: string;
    lowLabel: string;
    low: number;
    difference: number;
    status: string;
  };
  volatility7d: Record<string, number>;
  largestMove: {
    node: string;
    label: string;
    date: string;
    from: number;
    to: number;
    change: number;
  } | null;
  negativeRecentPrices: number;
  notable: Array<{
    node: string;
    label: string;
    mean: number;
    median30d: number;
    ratio: number;
    direction: string;
  }>;
}

export interface OverviewV1 {
  schemaVersion: string;
  generatedFor: string;
  nodes: Array<{ code: string; label: string }>;
  recent: RecentPricePoint[];
  daily: DailyPricePoint[];
  metrics: OverviewMetrics;
  definitions: Record<string, string>;
}

export interface RegionalNode {
  code: string;
  label: string;
  region: string;
  island: string;
  zone: string;
  lat: number | null;
  lon: number | null;
  easting: number | null;
  northing: number | null;
  mappingStatus: string;
  coordinateSource: string | null;
  coordinateProxyCode: string | null;
  hasMapPosition: boolean;
  means: Array<number | null>;
  latestIndex: number | null;
  latest: number | null;
  mean7d: number | null;
  volatility7d: number | null;
  min30d: number | null;
  max30d: number | null;
  negativeDays30d: number;
  coverageDays: number;
  finalDays: number;
  interimDays: number;
  observedPeriods: number;
}

export interface RegionalV1 {
  schemaVersion: string;
  dateCount: number;
  dates: string[];
  dateStatus: string[];
  nodeCount: number;
  mappedNodeCount: number;
  representativeNodes: string[];
  nodes: RegionalNode[];
  notes: Record<string, string>;
}

export interface CoastlineV1 {
  source: string;
  polygons: number[][][];
}

export interface PowerWatchData {
  sample: SampleSummary | null;
  manifest: ManifestV1 | null;
  coverage: CoverageV1 | null;
  quality: QualityV1 | null;
  priceSummary: PriceSummaryV1 | null;
  overview: OverviewV1 | null;
  regional: RegionalV1 | null;
  coastline: CoastlineV1 | null;
  errors: string[];
}

type JsonResult<T> = { value: T | null; error: string | null };

async function fetchJson<T>(path: string): Promise<JsonResult<T>> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
    if (!response.ok) return { value: null, error: `${path}: HTTP ${response.status}` };
    return { value: (await response.json()) as T, error: null };
  } catch (error) {
    return { value: null, error: `${path}: ${String(error)}` };
  }
}

export async function loadPowerWatchData(): Promise<PowerWatchData> {
  const [sample, manifest, coverage, quality, priceSummary, overview, regional, coastline] = await Promise.all([
    loadSampleSummary().then(
      (value): JsonResult<SampleSummary> => ({ value, error: null }),
      (error): JsonResult<SampleSummary> => ({ value: null, error: `sample-summary.json: ${String(error)}` }),
    ),
    fetchJson<ManifestV1>("data/v1/manifest.json"),
    fetchJson<CoverageV1>("data/v1/coverage.json"),
    fetchJson<QualityV1>("data/v1/quality.json"),
    fetchJson<PriceSummaryV1>("data/v1/price-summary.json"),
    fetchJson<OverviewV1>("data/v1/overview.json"),
    fetchJson<RegionalV1>("data/v1/regional.json"),
    fetchJson<CoastlineV1>("data/geo/nz-coastline.json"),
  ]);

  return {
    sample: sample.value,
    manifest: manifest.value,
    coverage: coverage.value,
    quality: quality.value,
    priceSummary: priceSummary.value,
    overview: overview.value,
    regional: regional.value,
    coastline: coastline.value,
    errors: [sample, manifest, coverage, quality, priceSummary, overview, regional, coastline]
      .map((result) => result.error)
      .filter((error): error is string => error !== null),
  };
}

export type DataFreshness = "loading" | "error" | "empty" | "fresh" | "stale";

export function dataFreshness(data: PowerWatchData, loading: boolean): DataFreshness {
  if (loading) return "loading";
  if (!data.sample && !data.manifest && !data.coverage && !data.quality) return "error";
  if (!data.sample && !data.manifest) return "empty";
  if (!data.manifest?.dataVersion) return "stale";
  const version = new Date(`${data.manifest.dataVersion}T00:00:00Z`);
  if (Number.isNaN(version.getTime())) return "stale";
  const ageDays = (Date.now() - version.getTime()) / 86_400_000;
  return ageDays <= 30 ? "fresh" : "stale";
}
