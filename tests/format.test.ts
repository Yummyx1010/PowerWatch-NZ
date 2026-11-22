import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatNzd,
  formatSampleDate,
  seriesToBarHeights,
} from "../src/lib/format";

describe("formatting helpers", () => {
  it("formats NZD prices and handles missing values", () => {
    expect(formatNzd(12.5)).toBe("$12.50");
    expect(formatNzd(null)).toBe("—");
    expect(formatNzd(Number.NaN)).toBe("—");
  });

  it("formats counts with en-NZ grouping", () => {
    expect(formatCount(11808)).toBe("11,808");
  });

  it("formats the sample date without timezone drift", () => {
    expect(formatSampleDate("2026-11-19")).toBe("19 November 2026");
    expect(formatSampleDate(null)).toBe("Awaiting sample data");
  });

  it("turns real prices into bounded bar heights", () => {
    expect(seriesToBarHeights([10, 20, 30], 10)).toEqual([10, 55, 100]);
    expect(seriesToBarHeights([])).toEqual([]);
  });
});
