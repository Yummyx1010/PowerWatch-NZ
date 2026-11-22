import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("M0 design foundation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the identity, navigation and a real verified sample", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => summary,
      })),
    );

    render(<App />);

    expect(screen.getByRole("heading", { name: /market has a pulse/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Regions" })).toBeTruthy();
    expect(await screen.findByText("3")).toBeTruthy();
    expect(screen.getByText(/19 November 2026/)).toBeTruthy();
    expect(screen.getAllByText(/CC BY 4.0/).length).toBeGreaterThan(0);
  });
});
