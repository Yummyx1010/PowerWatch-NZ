export interface SampleNode {
  code: string;
  label: string;
  area: string;
  island: string;
}

export interface SampleSeriesPoint {
  period: number;
  price: number;
}

export interface SampleSummary {
  sampleDate: string | null;
  source: string;
  attribution: string;
  licence: string;
  rows: number;
  nodes: SampleNode[];
  priceMinNzdPerMwh: number;
  priceMaxNzdPerMwh: number;
  periodsPerDay: number;
  series: SampleSeriesPoint[];
}

export async function loadSampleSummary(): Promise<SampleSummary> {
  const url = `${import.meta.env.BASE_URL}data/sample-summary.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load sample summary: ${response.status}`);
  }
  return (await response.json()) as SampleSummary;
}
