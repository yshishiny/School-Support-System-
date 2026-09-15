import { describe, it, expect } from "vitest";
import { prayerWindows, prayerState, prayerLogDate, prayerPoints } from "./prayers";

const CAIRO = { lat: 30.0444, lng: 31.2357, tz: "Africa/Cairo" };

describe("prayerWindows", () => {
  it("computes Cairo times in order with isha ending at next fajr", () => {
    const w = prayerWindows("2026-09-15", CAIRO.lat, CAIRO.lng);
    expect(w.map((x) => x.prayer)).toEqual(["fajr", "dhuhr", "asr", "maghrib", "isha"]);
    for (let i = 1; i < w.length; i++) expect(w[i].start.getTime()).toBeGreaterThan(w[i - 1].start.getTime());
    expect(w[4].end.getTime()).toBeGreaterThan(w[4].start.getTime());
    expect(w[0].start.toISOString()).toBe("2026-09-15T02:12:00.000Z"); // 05:12 Cairo
  });
});

describe("prayerState", () => {
  const w = prayerWindows("2026-09-15", CAIRO.lat, CAIRO.lng);
  it("is not_yet before the time, open in the window, late_only after", () => {
    expect(prayerState(w[1], new Date("2026-09-15T08:00:00Z"))).toBe("not_yet");
    expect(prayerState(w[1], new Date("2026-09-15T10:30:00Z"))).toBe("open");
    expect(prayerState(w[1], new Date("2026-09-15T14:00:00Z"))).toBe("late_only");
  });
});

describe("prayerLogDate", () => {
  it("assigns isha after midnight to the previous day", () => {
    expect(prayerLogDate("isha", new Date("2026-09-15T22:30:00Z"), CAIRO.tz, CAIRO.lat, CAIRO.lng)).toBe("2026-09-15"); // 01:30 Cairo on the 16th
    expect(prayerLogDate("isha", new Date("2026-09-15T18:00:00Z"), CAIRO.tz, CAIRO.lat, CAIRO.lng)).toBe("2026-09-15");
    expect(prayerLogDate("dhuhr", new Date("2026-09-15T22:30:00Z"), CAIRO.tz, CAIRO.lat, CAIRO.lng)).toBe("2026-09-16");
  });
});

describe("prayerPoints", () => {
  it("pays more for on time", () => {
    expect(prayerPoints("on_time")).toBe(3);
    expect(prayerPoints("late")).toBe(1);
  });
});
