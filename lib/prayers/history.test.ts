import { describe, expect, it } from "vitest";
import { history, verdict, type PrayerLog } from "./history";

const l = (log_date: string, prayer: string, status: PrayerLog["status"], extra: Partial<PrayerLog> = {}): PrayerLog =>
  ({ log_date, prayer, status, ...extra });
const FIVE = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const fullDay = (d: string, status: PrayerLog["status"] = "on_time", extra: Partial<PrayerLog> = {}) => FIVE.map((p) => l(d, p, status, extra));

describe("silence is not a missed prayer", () => {
  it("counts an empty day as not logged, never as missed", () => {
    const h = history([], "2026-09-15", "2026-09-21");
    expect(h.totals.missed).toBe(0);
    expect(h.totals.notLogged).toBe(35);
    expect(h.totals.possible).toBe(35);
  });

  it("keeps an owned admission apart from silence", () => {
    const h = history([l("2026-09-15", "fajr", "missed")], "2026-09-15", "2026-09-15");
    expect(h.totals.missed).toBe(1);
    expect(h.totals.notLogged).toBe(4);
    expect(h.honesty.ownedMissed).toBe(1);
  });

  it("says so in the verdict rather than reporting a failure", () => {
    const said = verdict(history([], "2026-09-15", "2026-09-21"), "Youssef");
    expect(said).toContain("has not logged a single prayer in these 7 days");
    expect(said).toContain("the app knowing nothing, not Youssef praying nothing");
  });
});

describe("the day grid", () => {
  it("fills every prayer of every day, logged or not", () => {
    const h = history([l("2026-09-15", "fajr", "on_time"), l("2026-09-15", "asr", "late")], "2026-09-15", "2026-09-16");
    expect(h.days).toHaveLength(2);
    expect(h.days[0].cells).toEqual({ fajr: "on_time", dhuhr: "none", asr: "late", maghrib: "none", isha: "none" });
    expect(h.days[0].logged).toBe(2);
    expect(h.days[0].onTime).toBe(1);
    expect(h.days[1].cells.fajr).toBe("none");
  });

  it("separates accounting for the whole day from keeping it", () => {
    const owned = history(fullDay("2026-09-15", "missed"), "2026-09-15", "2026-09-15").days[0];
    expect(owned.allFive).toBe(true);   // he accounted for all five
    expect(owned.allOnTime).toBe(false); // and kept none of them
    const kept = history(fullDay("2026-09-15", "on_time"), "2026-09-15", "2026-09-15").days[0];
    expect(kept.allFive && kept.allOnTime).toBe(true);
  });
});

describe("per prayer", () => {
  const logs = [
    ...fullDay("2026-09-15"),
    ...fullDay("2026-09-16"),
    // Day three: he sleeps through Fajr and owns it, the rest on time.
    l("2026-09-17", "fajr", "missed"), l("2026-09-17", "dhuhr", "on_time"), l("2026-09-17", "asr", "on_time"),
    l("2026-09-17", "maghrib", "on_time"), l("2026-09-17", "isha", "on_time"),
  ];
  const h = history(logs, "2026-09-15", "2026-09-17");

  it("makes the five comparable as a share of the days in range", () => {
    expect(h.byPrayer.find((p) => p.prayer === "fajr")!.share).toBeCloseTo(2 / 3);
    expect(h.byPrayer.find((p) => p.prayer === "isha")!.share).toBe(1);
  });

  it("names the one worth talking about", () => {
    expect(h.weakest?.prayer).toBe("fajr");
    expect(verdict(h, "Omar")).toContain("Fajr is the one to talk about");
  });

  it("names nothing when every prayer is kept", () => {
    const perfect = history([...fullDay("2026-09-15"), ...fullDay("2026-09-16")], "2026-09-15", "2026-09-16");
    expect(perfect.weakest).toBeNull();
    expect(verdict(perfect, "Omar")).not.toContain("to talk about");
  });
});

describe("streak of days fully accounted for", () => {
  it("counts back from the last day and stops at the first gap", () => {
    const h = history([...fullDay("2026-09-15"), ...fullDay("2026-09-17"), ...fullDay("2026-09-18")], "2026-09-15", "2026-09-18");
    expect(h.streakAllFive).toBe(2);
  });
  it("is zero when the last day is incomplete, however good the days before", () => {
    const h = history([...fullDay("2026-09-15"), ...fullDay("2026-09-16")], "2026-09-15", "2026-09-17");
    expect(h.streakAllFive).toBe(0);
  });
});

describe("honesty and the mosque", () => {
  it("counts prayers filled in after the fact apart from the rest", () => {
    const h = history([l("2026-09-15", "fajr", "on_time", { entered_late: true }), l("2026-09-15", "asr", "on_time")], "2026-09-15", "2026-09-15");
    expect(h.honesty.enteredLate).toBe(1);
    expect(h.totals.onTime).toBe(2);
  });
  it("counts congregation per prayer and overall", () => {
    const h = history(fullDay("2026-09-15", "on_time", { at_mosque: true }), "2026-09-15", "2026-09-15");
    expect(h.totals.mosque).toBe(5);
    expect(h.byPrayer.every((p) => p.mosque === 1)).toBe(true);
  });
});

describe("the range itself", () => {
  it("ignores rows outside it", () => {
    const h = history([l("2026-09-01", "fajr", "on_time"), l("2026-09-16", "fajr", "on_time")], "2026-09-15", "2026-09-16");
    expect(h.totals.onTime).toBe(1);
  });
  it("refuses to build a range nobody meant to ask for", () => {
    expect(history([], "2020-01-01", "2026-09-21").days.length).toBeLessThanOrEqual(401);
  });
});
