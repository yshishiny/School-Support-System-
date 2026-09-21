import { describe, expect, it } from "vitest";
import { band, linePath, niceMax, plotHeight, plotWidth, segments, ticks, y, type Box } from "./plot";

const b: Box = { w: 320, h: 140, top: 10, right: 10, bottom: 24, left: 34 };

describe("the plot area", () => {
  it("is what the margins leave", () => {
    expect(plotWidth(b)).toBe(276);
    expect(plotHeight(b)).toBe(106);
  });
});

describe("band", () => {
  it("centres each slot and never fills it", () => {
    const first = band(0, 4, b);
    const second = band(1, 4, b);
    expect(second.centre - first.centre).toBeCloseTo(69); // 276 / 4
    expect(first.w).toBeLessThan(69); // the leftover is air
    expect(first.x).toBeCloseTo(first.centre - first.w / 2);
  });
  it("caps thickness so a lone bar is not a slab", () => {
    expect(band(0, 1, b).w).toBe(24);
  });
  it("keeps a sliver visible when there are many", () => {
    expect(band(0, 200, b).w).toBeGreaterThanOrEqual(2);
  });
});

describe("y", () => {
  it("puts zero on the baseline and max at the top", () => {
    expect(y(0, 100, b)).toBe(b.top + plotHeight(b));
    expect(y(100, 100, b)).toBe(b.top);
    expect(y(50, 100, b)).toBeCloseTo(b.top + plotHeight(b) / 2);
  });
  it("clamps rather than drawing outside the plot", () => {
    expect(y(140, 100, b)).toBe(b.top);
    expect(y(-5, 100, b)).toBe(b.top + plotHeight(b));
  });
  it("does not divide by a zero axis", () => {
    expect(y(0, 0, b)).toBe(b.top + plotHeight(b));
  });
});

describe("niceMax", () => {
  it("rounds up to something an axis can print", () => {
    expect(niceMax([37, 51, 12])).toBe(75);
    expect(niceMax([101])).toBe(125);
    expect(niceMax([3, 1])).toBe(3);
  });
  it("ignores the gaps", () => {
    expect(niceMax([null, 40, null])).toBe(40); // 40 is already a round top; it does not need padding to 50
    expect(niceMax([null, 41, null])).toBe(50);
  });
  it("never collapses to zero on an empty series", () => {
    expect(niceMax([])).toBe(1);
    expect(niceMax([null, null], 100)).toBe(100);
  });
});

describe("segments — a gap in the data is a gap in the line", () => {
  it("splits a series at every missing point", () => {
    expect(segments([1, 2, null, 4, 5])).toEqual([[0, 1], [3, 4]]);
  });
  it("treats zero as a value, never as a gap", () => {
    // The whole point: a week he scored 0 is not a week with no data.
    expect(segments([0, 0, null, 0])).toEqual([[0, 1], [3]]);
  });
  it("handles the ends", () => {
    expect(segments([null, 1, 2])).toEqual([[1, 2]]);
    expect(segments([1, 2, null])).toEqual([[0, 1]]);
    expect(segments([null, null])).toEqual([]);
    expect(segments([])).toEqual([]);
  });
});

describe("linePath", () => {
  it("draws through a run", () => {
    const d = linePath([0, 1], [10, 20], 100, 2, b);
    expect(d.startsWith("M")).toBe(true);
    expect(d.split("L")).toHaveLength(2);
  });
  it("draws nothing for a lone point, which is shown as its marker", () => {
    expect(linePath([2], [null, null, 5], 100, 3, b)).toBe("");
  });
});

describe("ticks", () => {
  it("runs from zero to the top inclusive", () => {
    expect(ticks(100, 4)).toEqual([0, 25, 50, 75, 100]);
  });
  it("prefers a count that leaves whole numbers on the axis", () => {
    // Four over 250 gives 62.5 and 187.5; five gives an axis a person can read.
    expect(ticks(250, 4)).toEqual([0, 50, 100, 150, 200, 250]);
    expect(ticks(7, 7)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it("falls back rather than refusing when nothing divides cleanly", () => {
    expect(ticks(3.5, 4)).toHaveLength(5);
  });
  it("copes with a flat axis", () => {
    expect(ticks(0)).toEqual([0]);
  });
});
