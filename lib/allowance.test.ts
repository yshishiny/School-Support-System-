import { describe, expect, it } from "vitest";
import { amountFor, bandFor, eligibilityHint, mergeKpis, scoreWeek, weekFor, DEFAULT_KPIS, SCHOOL_ONLY_KPIS } from "./allowance";

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
  kpis: mergeKpis([{ code: "classlog", enabled: false }, { code: "checkpoint", enabled: false }, { code: "homework", enabled: false }, { code: "grades", enabled: false }, { code: "materials", enabled: false }]), // these have their own tests below
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
  it("scores the class log and allows catch-up until the week closes", () => {
    const kpis = mergeKpis(null);
    const full = scoreWeek({ ...base, kpis, classLog: { due: 8, done: 8, missingLine: null } });
    expect(full.results.find((r) => r.code === "classlog")!.fraction).toBe(1);
    const half = scoreWeek({ ...base, kpis, classLog: { due: 8, done: 4, missingLine: "Mon: Math" } });
    const r = half.results.find((x) => x.code === "classlog")!;
    expect(r.fraction).toBe(0.5);
    expect(half.maxScore).toBe(100); // still recoverable this week
    expect(half.hints[0]).toContain("Fill in 4 classes");
    const none = scoreWeek({ ...base, kpis });
    expect(none.results.find((x) => x.code === "classlog")!.detail).toBe("no classes yet this week");
  });
  it("gives the checkpoint the benefit of the doubt until it expires", () => {
    const kpis = mergeKpis([{ code: "classlog", enabled: false }, { code: "materials", enabled: false }]);
    expect(scoreWeek({ ...base, kpis, checkpoint: { status: "ready" } }).results.find((r) => r.code === "checkpoint")!.fraction).toBe(1);
    expect(scoreWeek({ ...base, kpis, checkpoint: { status: "expired" } }).results.find((r) => r.code === "checkpoint")!.fraction).toBe(0);
    expect(scoreWeek({ ...base, kpis, checkpoint: { status: "ready" } }).hints).toContain("Do the weekly checkpoint (20 min, one attempt)");
  });
  it("scores homework by due date and the monthly grades sheet from the 21st", () => {
    const kpis = mergeKpis([{ code: "classlog", enabled: false }, { code: "checkpoint", enabled: false }, { code: "materials", enabled: false }]);
    const hw = scoreWeek({ ...base, kpis, homework: { due: 4, doneOnTime: 3, open: 1 } }).results.find((r) => r.code === "homework")!;
    expect(hw.fraction).toBe(0.75);
    expect(scoreWeek({ ...base, kpis, homework: { due: 4, doneOnTime: 3, open: 1 } }).hints.some((h) => h.startsWith("Finish 1 open homework"))).toBe(true);
    expect(scoreWeek({ ...base, kpis, gradesSheet: { uploaded: false, dayOfMonth: 10 } }).results.find((r) => r.code === "grades")!.fraction).toBe(1);
    expect(scoreWeek({ ...base, kpis, gradesSheet: { uploaded: false, dayOfMonth: 25 } }).results.find((r) => r.code === "grades")!.fraction).toBe(0);
    expect(scoreWeek({ ...base, kpis, gradesSheet: { uploaded: true, dayOfMonth: 25 } }).results.find((r) => r.code === "grades")!.fraction).toBe(1);
  });
  it("respects weight overrides and disabled KPIs", () => {
    const kpis = mergeKpis([{ code: "quizzes", enabled: false }, { code: "dish", weight: 40 }]);
    expect(kpis.find((k) => k.code === "quizzes")!.enabled).toBe(false);
    expect(kpis.find((k) => k.code === "dish")!.weight).toBe(40);
    expect(DEFAULT_KPIS.find((k) => k.code === "dish")!.weight).toBe(20);
  });
});

describe("eligibility", () => {
  it("tells him what is still reachable and what to do", () => {
    const r = scoreWeek({ ...base, checkinDates: [], ticks: [{ tick_date: "2026-09-12", code: "dish", value: false }] });
    expect(r.hints[0]).toContain("No more ✗");
    expect(r.hints).toContain("Do tonight's check-in");
    expect(r.maxScore).toBeGreaterThan(r.score);
    const h = eligibilityHint(r, 250);
    expect(["good", "warn"]).toContain(h.tone);
  });
  it("says the week is gone when even a perfect finish stays under 50", () => {
    const ticks = ["2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"].flatMap((d) => [
      { tick_date: d, code: "dish", value: false }, { tick_date: d, code: "manners", value: false }, { tick_date: d, code: "phone", value: false },
    ]);
    const r = scoreWeek({ ...base, ticks, checkinDates: [], prayerDays: {}, plannedAttempted: 0, wellbeingDone: false });
    expect(r.bestBand).toBe("some"); // app KPIs can still be recovered
    expect(eligibilityHint(r, 250).tone).toBe("warn");
  });
});

describe("a learner who is past school", () => {
  it("keeps every measure for a child at school", () => {
    const k = mergeKpis(null, [], "school");
    expect(k.find((x) => x.code === "checkpoint")?.enabled).toBe(true);
    expect(k.find((x) => x.code === "grades")?.enabled).toBe(true);
    expect(k.find((x) => x.code === "classlog")?.enabled).toBe(true);
  });

  it("drops the school-only measures for a university student and a postgraduate", () => {
    for (const stage of ["university", "postgraduate", "adult"]) {
      const k = mergeKpis(null, [], stage);
      for (const code of SCHOOL_ONLY_KPIS) expect(k.find((x) => x.code === code)?.enabled, `${stage}/${code}`).toBe(false);
      // What still applies to anyone in the house stays on.
      expect(k.find((x) => x.code === "prayers")?.enabled).toBe(true);
      expect(k.find((x) => x.code === "checkins")?.enabled).toBe(true);
      expect(k.find((x) => x.code === "manners")?.enabled).toBe(true);
    }
  });

  it("treats a missing stage as school, so nothing changes for existing families", () => {
    expect(mergeKpis(null, [], null).find((x) => x.code === "checkpoint")?.enabled).toBe(true);
    expect(mergeKpis(null, []).find((x) => x.code === "checkpoint")?.enabled).toBe(true);
  });

  it("does not mark a postgraduate down for a checkpoint she can never have", () => {
    const kpis = mergeKpis(null, [], "postgraduate");
    const week = scoreWeek({
      kpis, start: "2026-09-12", end: "2026-09-18", today: "2026-09-18",
      ticks: [], prayerDays: {}, checkinDates: [], plannedTotal: 0, plannedAttempted: 0,
      wellbeingDue: false, wellbeingDone: false,
      checkpoint: { status: "expired" },
      classLog: { due: 10, done: 0, missingLine: null },
      gradesSheet: { uploaded: false, dayOfMonth: 28 },
    });
    expect(week.results.some((r) => r.code === "checkpoint")).toBe(false);
    expect(week.results.some((r) => r.code === "classlog")).toBe(false);
    expect(week.results.some((r) => r.code === "grades")).toBe(false);
  });
});

describe("earned against given", () => {
  // The week that prompted this: a child who did nothing at all still scored 37, because seven
  // untouched columns paid in full. The score itself is unchanged; what is new is being able to say
  // how much of it he earned.
  const empty = {
    kpis: mergeKpis([]),
    start: "2026-09-12",
    end: "2026-09-18",
    today: "2026-09-18",
    ticks: [],
    prayerDays: {},
    checkinDates: [],
    plannedTotal: 0,
    plannedAttempted: 0,
    wellbeingDue: false,
    wellbeingDone: false,
  };

  it("counts a full mark as given when there was nothing to measure", () => {
    const r = scoreWeek(empty);
    expect(r.measuredScore).toBe(0);
    expect(r.defaultScore).toBe(r.score);
    expect(r.score).toBeGreaterThan(0); // the point: a blank week is not a zero
  });

  it("splits the score into two parts that add back up", () => {
    const r = scoreWeek(base);
    expect(r.measuredScore + r.defaultScore).toBe(r.score);
  });

  it("calls a parent KPI measured once it has been ticked either way", () => {
    const ticked = scoreWeek({ ...empty, ticks: [{ tick_date: "2026-09-12", code: "dish", value: true }] });
    const dish = ticked.results.find((r) => r.code === "dish")!;
    expect(dish.basis).toBe("measured");
    expect(dish.detail).toBe("1 day marked ✓");
    expect(scoreWeek(empty).results.find((r) => r.code === "dish")!.basis).toBe("default");
  });

  it("says plainly when a parent KPI was never ticked", () => {
    expect(scoreWeek(empty).results.find((r) => r.code === "dish")!.detail).toBe("never ticked either way");
  });

  it("counts prayers and check-ins as measured even at zero", () => {
    const r = scoreWeek(empty);
    expect(r.results.find((x) => x.code === "prayers")!.basis).toBe("measured");
    expect(r.results.find((x) => x.code === "checkins")!.basis).toBe("measured");
  });

  it("reports how much of the week was measurable at all", () => {
    expect(scoreWeek(empty).measurable).toBeLessThan(50);
  });
});
