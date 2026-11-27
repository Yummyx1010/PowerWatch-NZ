import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

const summary = {
  sampleDate: "2026-11-19",
  source: "Electricity Authority (New Zealand)",
  attribution: "www.emi.ea.govt.nz provided by the Electricity Authority (New Zealand)",
  licence: "CC BY 4.0 International",
  rows: 144,
  nodes: [
    { code: "OTA2201", label: "Otahuhu", area: "Auckland", island: "NI" },
    { code: "HAY2201", label: "Haywards", area: "Wellington", island: "NI" },
    { code: "ISL2201", label: "Islington", area: "Christchurch", island: "SI" },
  ],
  priceMinNzdPerMwh: 2.83,
  priceMaxNzdPerMwh: 184.66,
  periodsPerDay: 48,
  series: Array.from({ length: 24 }, (_, index) => ({ period: index * 2 + 1, price: 20 + index })),
};

const manifest = {
  schemaVersion: "1.0",
  dataVersion: "2026-11-23",
  sourceCount: 58,
  coverage: {
    requestedStart: "2023-11-01",
    requestedEnd: "2026-11-22",
    firstFinalDate: "2023-11-01",
    lastFinalDate: "2026-11-19",
    lastInterimDate: "2026-11-22",
    finalDays: 1084,
    interimDays: 3,
    gapDays: 31,
    gaps: [{ start: "2025-12-01", end: "2025-12-31" }],
  },
};

const coverage = {
  months: [
    {
      key: "monthly:202311",
      kind: "monthly_final",
      status: "ok",
      start: "2023-11-01",
      end: "2023-11-30",
      rows: 347040,
      priceStatus: "Final",
    },
  ],
  gaps: [
    {
      start: "2025-12-01",
      end: "2025-12-31",
      days: 31,
      reason: "The official monthly file is published as incomplete, so it is excluded to avoid fabricating data.",
    },
  ],
};

const quality = {
  schemaVersion: "1.0",
  sourceCount: 57,
  totals: {
    rows: 12646250,
    duplicateKeys: 0,
    incompleteNodeDays: 7,
    negativePrices: 272,
    zeroPrices: 2982,
  },
  missingByColumn: { node: 0, trading_date: 0, trading_period: 0, price_nzd_per_mwh: 0 },
  priceStatusCounts: { Final: 12610826, Interim: 35424 },
  timeTagDistribution: { normal_nzst: 6080097, normal_nzdt: 6496323 },
  periodCountDays: { "46": 3, "48": 1081, "50": 3 },
  priceMin: -144.93,
  priceMax: 10425.32,
};

const priceSummary = {
  nodes: ["OTA2201", "HAY2201", "ISL2201"],
  points: [
    { month: "2026-09", node: "OTA2201", priceType: "final", meanPrice: 180.2 },
    { month: "2026-10", node: "OTA2201", priceType: "final", meanPrice: 165.4 },
    { month: "2026-10", node: "HAY2201", priceType: "final", meanPrice: 158.1 },
    { month: "2026-10", node: "ISL2201", priceType: "final", meanPrice: 149.7 },
  ],
};

const overviewNodes = [
  { code: "OTA2201", label: "Otahuhu" },
  { code: "HAY2201", label: "Haywards" },
  { code: "ISL2201", label: "Islington" },
];

const overviewRecent = ["2026-11-21", "2026-11-22"].flatMap((date, dayIndex) =>
  overviewNodes.flatMap((node, nodeIndex) =>
    Array.from({ length: 48 }, (_, periodIndex) => {
      const period = periodIndex + 1;
      const hour = String(Math.floor(periodIndex / 2)).padStart(2, "0");
      const minute = periodIndex % 2 === 0 ? "00" : "30";
      return {
        date,
        period,
        local: `${date} ${hour}:${minute}`,
        utc: `${date}T00:00:00Z`,
        node: node.code,
        label: node.label,
        price: 40 + dayIndex * 12 + nodeIndex * 7 + periodIndex * 0.5,
        status: dayIndex === 0 ? "Final" : "Interim",
        type: dayIndex === 0 ? "final" : "interim",
      };
    }),
  ),
);

const overviewDaily = ["2026-11-21", "2026-11-22"].flatMap((date, dayIndex) =>
  overviewNodes.map((node, nodeIndex) => {
    const mean = 60 + dayIndex * 12 + nodeIndex * 7;
    return {
      date,
      node: node.code,
      label: node.label,
      mean,
      min: mean - 10,
      max: mean + 10,
      periods: 48,
      status: dayIndex === 0 ? "Final" : "Interim",
      type: dayIndex === 0 ? "final" : "interim",
    };
  }),
);

const overview = {
  schemaVersion: "1.0",
  generatedFor: "2026-11-22",
  nodes: overviewNodes,
  recent: overviewRecent,
  daily: overviewDaily,
  metrics: {
    latestDate: "2026-11-22",
    latestFinalDate: "2026-11-19",
    latestPrices: overviewNodes.map((node, index) => ({
      node: node.code,
      label: node.label,
      price: 52 + index * 7 + 23.5,
      status: "Interim",
      local: "2026-11-22 23:30",
    })),
    latestDaily: overviewDaily.filter((row) => row.date === "2026-11-22"),
    regionalSpread: {
      date: "2026-11-22",
      highNode: "OTA2201",
      highLabel: "Otahuhu",
      high: 84.5,
      lowNode: "ISL2201",
      lowLabel: "Islington",
      low: 70.5,
      difference: 14,
      status: "Interim",
    },
    volatility7d: { OTA2201: 38.47, HAY2201: 31.65, ISL2201: 10.56 },
    largestMove: {
      node: "OTA2201",
      label: "Otahuhu",
      date: "2026-11-22",
      from: 78.87,
      to: 84.5,
      change: 5.63,
    },
    negativeRecentPrices: 0,
    notable: [],
  },
  definitions: {
    volatility: "Sample standard deviation of half-hourly nodal prices.",
    regionalSpread: "Difference between highest and lowest node daily mean.",
    largestMove: "Largest daily-mean change between consecutive published days.",
    notable: "Transparent 30-day ratio flag.",
    status: "Final vs Interim price status.",
  },
};

const regionalDates = [
  "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19",
  "2026-11-20", "2026-11-21", "2026-11-22",
];

const regionalSeeds = [
  { code: "OTA2201", label: "Otahuhu", region: "Auckland", island: "NI", lat: null, lon: null, mapped: false, base: 70 },
  { code: "HAY2201", label: "Haywards", region: "Wellington", island: "NI", lat: null, lon: null, mapped: false, base: 62 },
  { code: "ISL2201", label: "Islington", region: "Christchurch", island: "SI", lat: null, lon: null, mapped: false, base: 48 },
  { code: "MNG1101", label: "Mangere", region: "Auckland", island: "NI", lat: -36.96, lon: 174.83, mapped: true, base: 74 },
  { code: "ISL0331", label: "Islington 33kV", region: "Christchurch", island: "SI", lat: -43.53, lon: 172.60, mapped: true, base: 52 },
];

const regional = {
  schemaVersion: "1.0",
  dateCount: regionalDates.length,
  dates: regionalDates,
  dateStatus: ["Final", "Final", "Final", "Final", "Interim", "Interim", "Interim"],
  nodeCount: regionalSeeds.length,
  mappedNodeCount: regionalSeeds.filter((seed) => seed.mapped).length,
  representativeNodes: ["OTA2201", "HAY2201", "ISL2201"],
  nodes: regionalSeeds.map((seed) => {
    const means = regionalDates.map((_, index) => seed.base + index * 2);
    return {
      code: seed.code,
      label: seed.label,
      region: seed.region,
      island: seed.island,
      zone: "TEST",
      lat: seed.lat,
      lon: seed.lon,
      easting: null,
      northing: null,
      mappingStatus: seed.mapped ? "nsp_table" : "manual_override",
      hasMapPosition: seed.mapped,
      means,
      latestIndex: means.length - 1,
      latest: means[means.length - 1],
      mean7d: means[means.length - 1] - 6,
      volatility7d: 4.2,
      min30d: seed.base,
      max30d: means[means.length - 1],
      negativeDays30d: 0,
      coverageDays: means.length,
      finalDays: 4,
      interimDays: 3,
      observedPeriods: means.length * 48,
    };
  }),
  notes: {},
};

const coastline = {
  source: "Natural Earth 110m admin-0 countries (public domain)",
  polygons: [
    [[172.7, -40.5], [174.3, -41.2], [172.0, -41.0]],
    [[172.7, -34.4], [174.3, -35.8], [172.1, -35.8]],
  ],
};

const payloads: Record<string, unknown> = {
  "data/sample-summary.json": summary,
  "data/v1/manifest.json": manifest,
  "data/v1/coverage.json": coverage,
  "data/v1/quality.json": quality,
  "data/v1/price-summary.json": priceSummary,
  "data/v1/overview.json": overview,
  "data/v1/regional.json": regional,
  "data/geo/nz-coastline.json": coastline,
};

function clickNav(name: string) {
  const links = screen.getAllByRole("link", { name });
  fireEvent.click(links[0]);
}

function mockFetch(url: string) {
  const path = String(url).replace(/^\.\//, "");
  const value = payloads[path] ?? payloads[path.replace(/^\//, "")];
  if (value === undefined) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  return Promise.resolve({ ok: true, status: 200, json: async () => value });
}

describe("PowerWatch frontend foundation", () => {
  beforeEach(() => {
    window.location.hash = "";
    vi.stubGlobal("fetch", vi.fn(mockFetch));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the overview with real sample and manifest data", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /market has a pulse/i })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Regions" }).length).toBeGreaterThan(0);
    expect(await screen.findByText("Price explorer")).toBeTruthy();
    expect(screen.getByText("Market story")).toBeTruthy();
    expect(screen.getByText("Recent extremes")).toBeTruthy();
    expect(screen.getByText("Data freshness")).toBeTruthy();
    expect(screen.getAllByText(/19 Nov 2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CC BY 4.0/).length).toBeGreaterThan(0);
  });

  it("supports price explorer range and all-node selection", async () => {
    render(<App />);
    await screen.findByText("Price explorer");

    const monthRange = screen.getByRole("button", { name: "30 days" });
    fireEvent.click(monthRange);
    expect(monthRange.getAttribute("aria-pressed")).toBe("true");

    fireEvent.change(screen.getByLabelText("Search market nodes"), { target: { value: "Mangere" } });
    fireEvent.click(document.querySelector(".overview-node-results button") as HTMLButtonElement);
    expect(screen.getByRole("button", { name: "Remove Mangere" })).toBeTruthy();
  });

  it("navigates to all five page foundations", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: /market has a pulse/i });

    clickNav("Regions");
    expect(await screen.findByText("Pricing node map")).toBeTruthy();
    expect(screen.getByText("Node explorer")).toBeTruthy();
    expect(screen.getByText("Selected node comparison")).toBeTruthy();
    expect(screen.getByText("Price ranking")).toBeTruthy();
    expect(screen.getByText("Spread & volatility")).toBeTruthy();
    expect(document.querySelectorAll(".nz-map__land").length).toBe(2);

    fireEvent.change(screen.getByLabelText("Search nodes"), { target: { value: "Mangere" } });
    expect(screen.getAllByText("Mangere").length).toBeGreaterThan(0);

    const mangereMarker = screen.getByRole("button", { name: /Mangere, MNG1101/ });
    expect(mangereMarker.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(mangereMarker);
    expect(mangereMarker.getAttribute("aria-pressed")).toBe("true");

    clickNav("Anomalies");
    expect(await screen.findByText(/Strange days deserve/)).toBeTruthy();
    expect(screen.getByText("Evidence already in the data")).toBeTruthy();

    clickNav("History");
    expect(await screen.findByText(/Three years/)).toBeTruthy();
    expect(screen.getByText("Coverage spine")).toBeTruthy();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Data gap: Dec 25" }));
    expect(await screen.findByText(/31 missing days/)).toBeTruthy();
    expect(screen.getByText(/published as incomplete/)).toBeTruthy();

    clickNav("Method");
    expect(await screen.findByText(/Receipts, not/)).toBeTruthy();
    expect(screen.getByText("Quality checks actually run")).toBeTruthy();
  });
});
