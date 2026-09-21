import { describe, expect, it } from "vitest";
import { hasData, weekLabel, weeklyAccuracy, weeklyPoints, weeklyPrayers, weeklyScore, weeksBack } from "./progress";

const STARTS = weeksBack("2026-09-19", 4); // 2026-08-29, 09-05, 09-12, 09-19
const TODAY = "2026-09-21";

describe("the shared x-axis", () => {
  it("counts back in sevens, oldest first, ending on the week running now", () => {
    expect(STARTS).toEqual(["2026-08-29", "2026-09-05", "2026-09-12", "2026-09-19"]);
  });
  it("labels a week by the day it starts", () => {
    expect(weekLabel("2026-09-12")).toBe("12 Sep");
  });
});

describe("weeklyScore", () => {
  it("places each closed week on its own start", () => {
    const s = weeklyScore([{ week_start: "2026-09-12", score: 51 }], STARTS);
    expect(s.map((p) => p.value)).toEqual([null, null, 51, null]);
  });
  it("leaves a week that never closed as a gap, not a nought", () => {
    // A week with no row is a week the app did not score — drawing 0 would accuse him of failing it.
    expect(weeklyScore([], STARTS).every((p) => p.value === null)).toBe(true);
  });
  it("ignores a week outside the window", () => {
    expect(weeklyScore([{ week_start: "2026-06-06", score: 90 }], STARTS).every((p) => p.value === null)).toBe(true);
  });
});

describe("weeklyPoints", () => {
  const ledger = [
    { created_at: "2026-09-14T19:00:00Z", delta: 10 },
    { created_at: "2026-09-15T08:00:00Z", delta: 5 },
    { created_at: "2026-09-20T08:00:00Z", delta: 7 },
    { created_at: "2026-09-20T09:00:00Z", delta: -200 }, // a redemption is not something earned
  ];
  it("sums what was earned in each week", () => {
    expect(weeklyPoints(ledger, STARTS, TODAY).map((p) => p.value)).toEqual([0, 0, 15, 7]);
  });
  it("counts a week he earned nothing as zero, because the week still happened", () => {
    expect(weeklyPoints([], STARTS, TODAY).map((p) => p.value)).toEqual([0, 0, 0, 0]);
  });
  it("leaves weeks in the future as gaps", () => {
    const future = weeksBack("2026-10-10", 3); // 09-26, 10-03, 10-10 — all after TODAY
    expect(weeklyPoints([], future, TODAY).map((p) => p.value)).toEqual([null, null, null]);
  });
});

describe("weeklyAccuracy", () => {
  it("pools the questions in a week rather than averaging the percentages", () => {
    const a = weeklyAccuracy(
      [
        { submitted_at: "2026-09-14T10:00:00Z", score: 1, total: 10 },
        { submitted_at: "2026-09-15T10:00:00Z", score: 9, total: 10 },
      ],
      STARTS,
    );
    expect(a[2].value).toBe(50); // 10 of 20, not (10% + 90%) / 2
  });
  it("leaves a week with no attempt as a gap — there is nothing to be right about", () => {
    expect(weeklyAccuracy([], STARTS).every((p) => p.value === null)).toBe(true);
  });
  it("skips an attempt that was never submitted or has no total", () => {
    const a = weeklyAccuracy(
      [
        { submitted_at: null, score: 5, total: 5 },
        { submitted_at: "2026-09-14T10:00:00Z", score: 3, total: 0 },
      ],
      STARTS,
    );
    expect(a.every((p) => p.value === null)).toBe(true);
  });
});

describe("weeklyPrayers", () => {
  const day = (d: string, n: number) => Array.from({ length: n }, () => ({ log_date: d, status: "on_time" }));
  it("counts the days with four or more kept", () => {
    const logs = [...day("2026-09-14", 5), ...day("2026-09-15", 4), ...day("2026-09-16", 3)];
    expect(weeklyPrayers(logs, STARTS, TODAY)[2].value).toBe(2);
  });
  it("counts a late prayer as kept but an owned miss as not", () => {
    const logs = [
      ...Array.from({ length: 4 }, () => ({ log_date: "2026-09-14", status: "late" })),
      ...Array.from({ length: 5 }, () => ({ log_date: "2026-09-15", status: "missed" })),
    ];
    expect(weeklyPrayers(logs, STARTS, TODAY)[2].value).toBe(1);
  });
  it("counts a week he logged nothing as zero, because the days passed", () => {
    expect(weeklyPrayers([], STARTS, TODAY).map((p) => p.value)).toEqual([0, 0, 0, 0]);
  });
  it("does not count days that have not happened yet", () => {
    // The week of the 19th has only three days behind it on the 21st.
    const logs = ["2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"].flatMap((d) => day(d, 5));
    expect(weeklyPrayers(logs, STARTS, TODAY)[3].value).toBe(3);
  });
});

describe("hasData", () => {
  it("knows an empty series from one with a zero in it", () => {
    expect(hasData(weeklyScore([], STARTS))).toBe(false);
    expect(hasData(weeklyPoints([], STARTS, TODAY))).toBe(true);
  });
});
