import { describe, expect, it } from "vitest";
import { amountFor, bandFor, mergeKpis, scoreWeek, weekFor, DEFAULT_KPIS } from "./allowance";

describe("weekFor", () => {
  it("ends on the pay day and starts six days earlier", () => {
    // 2026-09-16 is a Wednesday; pay day Thursday (4).
    expect(weekFor("2026-09-16", 4)).toEqual({ start: "2026-09-11", end: "2026-09-17" });
    expect(weekFor("2026-09-17", 4)).toEqual({ start: "2026-09-11", end: "2026-09-17" });
    expect(weekFor("2026-09-18", 4)).toEqual({ start: "2026-09-18", end: "2026-09-24" });
  });
});

describe("bands", () => {
  it("pays in graded bands", () => {
    expect(bandFor(95).band).toBe("full");
    expect(amountFor(95, 250)).toBe(250);
    expect(amountFor(75, 250)).toBe(175);
    expect(amountFor(55, 250)).toBe(100);
    expect(amountFor(40, 250)).toBe(0);
  });
});

const base = {
  kpis: mergeKpis(null),
  start: "2026-09-11",
  end: "2026-09-17",
  today: "2026-09-14", // 4 days elapsed
  ticks: [],
  prayerDays: { "2026-09-11": 5, "2026-09-12": 4, "2026-09-13": 4, "2026-09-14": 5 },
  checkinDates: ["2026-09-11", "2026-09-12", "2026-09-13"],
  plannedTotal: 5,
  plannedAttempted: 4,
  wellbeingDue: true,
  wellbeingDone: true,
};

describe("scoreWeek", () => {
  it("gives the benefit of the doubt on untouched parent KPIs and scores app KPIs from data", () => {
    const r = scoreWeek(base);
    expect(r.elapsedDays).toBe(4);
    expect(r.score).toBe(100);
    expect(r.band).toBe("full");
  });
  it("only an explicit ✗ counts against a parent KPI", () => {
    const r = scoreWeek({ ...base, ticks: [{ tick_date: "2026-09-12", code: "dish", value: false }, { tick_date: "2026-09-13", code: "manners", value: true }] });
    const dish = r.results.find((x) => x.code === "dish")!;
    expect(dish.fraction).toBe(0.75);
    expect(r.score).toBeLessThan(100);
  });
  it("drops the band when the basics slip", () => {
    const r = scoreWeek({
      ...base,
      ticks: [
        { tick_date: "2026-09-11", code: "dish", value: false }, { tick_date: "2026-09-12", code: "dish", value: false }, { tick_date: "2026-09-13", code: "dish", value: false },
        { tick_date: "2026-09-11", code: "manners", value: false }, { tick_date: "2026-09-12", code: "manners", value: false },
      ],
      checkinDates: [],
      plannedAttempted: 1,
      wellbeingDone: false,
    });
    expect(r.score).toBe(45);
    expect(r.band).toBe("none");
    const lighter = scoreWeek({ ...base, checkinDates: [], plannedAttempted: 1, wellbeingDone: false });
    expect(lighter.score).toBe(70);
    expect(lighter.band).toBe("most");
    const some = scoreWeek({ ...base, checkinDates: [], plannedAttempted: 1, wellbeingDone: false, prayerDays: {} });
    expect(some.band).toBe("some");
  });
  it("respects weight overrides and disabled KPIs", () => {
    const kpis = mergeKpis([{ code: "quizzes", enabled: false }, { code: "dish", weight: 40 }]);
    expect(kpis.find((k) => k.code === "quizzes")!.enabled).toBe(false);
    expect(kpis.find((k) => k.code === "dish")!.weight).toBe(40);
    expect(DEFAULT_KPIS.find((k) => k.code === "dish")!.weight).toBe(20);
  });
});
