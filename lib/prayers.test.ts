import { describe, it, expect } from "vitest";
import { PRAYERS, allAtMosque, countsAsCongregation, fajrMosqueStreak, fajrWeekEarned, prayerLogDate, prayerPoints, prayerState, prayerWindows } from "./prayers";

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

describe("praying in congregation", () => {
  const l = (log_date: string, prayer: string, at_mosque = true) => ({ log_date, prayer, at_mosque });

  it("counts a day only when all five were at the mosque", () => {
    const day = PRAYERS.map((p) => l("2026-09-19", p));
    expect(allAtMosque(day, "2026-09-19")).toBe(true);
    expect(allAtMosque(day.slice(0, 4), "2026-09-19")).toBe(false);
    expect(allAtMosque([...day.slice(0, 4), l("2026-09-19", "isha", false)], "2026-09-19")).toBe(false);
    expect(allAtMosque(day, "2026-09-18")).toBe(false);
  });

  it("counts the Fajr streak back from today and stops at the first gap", () => {
    const days = ["2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"];
    const logs = days.map((d) => l(d, "fajr"));
    expect(fajrMosqueStreak(logs, "2026-09-19")).toBe(7);
    expect(fajrMosqueStreak(logs.filter((x) => x.log_date !== "2026-09-16"), "2026-09-19")).toBe(3);
    expect(fajrMosqueStreak([], "2026-09-19")).toBe(0);
    // Fajr at home does not extend it.
    expect(fajrMosqueStreak([...logs.slice(0, 6), l("2026-09-19", "fajr", false)], "2026-09-19")).toBe(0);
  });

  it("pays the week bonus once a week, not every day after the first seven", () => {
    expect([0, 1, 6].map(fajrWeekEarned)).toEqual([false, false, false]);
    expect([7, 14, 21].map(fajrWeekEarned)).toEqual([true, true, true]);
    expect([8, 9, 13].map(fajrWeekEarned)).toEqual([false, false, false]);
  });
});

describe("congregation, whenever it is entered", () => {
  it("stands on a prayer that was on time", () => {
    expect(countsAsCongregation("on_time", true)).toBe(true);
  });

  it("never stands on one that was late or missed, however it is claimed", () => {
    expect(countsAsCongregation("late", true)).toBe(false);
    expect(countsAsCongregation("missed", true)).toBe(false);
  });

  it("is not assumed when he did not say so", () => {
    expect(countsAsCongregation("on_time", false)).toBe(false);
  });

  // The boys almost never open the app inside the window: Fajr is prayed at the mosque at five and logged at
  // noon. A bonus that only counted same-second taps would never be paid, so the day and the streak are worked
  // out from the flag alone, not from when the row was written.
  it("pays the day bonus for prayers filled in afterwards", () => {
    const day = "2026-09-20";
    const logs = ["fajr", "dhuhr", "asr", "maghrib", "isha"].map((prayer) => ({ log_date: day, prayer, at_mosque: true }));
    expect(allAtMosque(logs, day)).toBe(true);
  });

  it("counts a week of Fajr at the mosque regardless of when each was entered", () => {
    const days = ["09-14", "09-15", "09-16", "09-17", "09-18", "09-19", "09-20"].map((d) => ({ log_date: `2026-${d}`, prayer: "fajr", at_mosque: true }));
    const streak = fajrMosqueStreak(days, "2026-09-20");
    expect(streak).toBe(7);
    expect(fajrWeekEarned(streak)).toBe(true);
  });
});
