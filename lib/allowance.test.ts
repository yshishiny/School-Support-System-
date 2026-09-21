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

// The four elapsed days of `base`, ticked ✓ on every parent column. Since an untouched column pays only half,
// a test about the app's own measures has to say explicitly that the parent did their part — otherwise it is
// really a test about the parent forgetting.
const DAYS4 = ["2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"];
const ok = (code: string) => DAYS4.map((d) => ({ tick_date: d, code, value: true }));
const allTicked = [...ok("dish"), ...ok("manners"), ...ok("phone")];

const base = {
  kpis: mergeKpis([{ code: "classlog", enabled: false }, { code: "checkpoint", enabled: false }, { code: "homework", enabled: false }, { code: "grades", enabled: false }, { code: "materials", enabled: false }]), // these have their own tests below
  start: "2026-09-11",
  end: "2026-09-17",
  today: "2026-09-14", // 4 days elapsed
  ticks: allTicked,
  prayerDays: { "2026-09-11": 5, "2026-09-12": 4, "2026-09-13": 4, "2026-09-14": 5 },
  checkinDates: ["2026-09-11", "2026-09-12", "2026-09-13"],
  plannedTotal: 5,
  plannedAttempted: 4,
  wellbeingDue: true,
  wellbeingDone: true,
};

describe("scoreWeek", () => {
  it("pays in full when every parent column is ticked ✓ and the app KPIs are met", () => {
    const r = scoreWeek(base);
    expect(r.elapsedDays).toBe(4);
    expect(r.score).toBe(100);
    expect(r.band).toBe("full");
  });
  it("only an explicit ✗ counts against a parent KPI", () => {
    const r = scoreWeek({ ...base, ticks: [...ok("manners"), ...ok("phone"), { tick_date: "2026-09-12", code: "dish", value: false }] });
    const dish = r.results.find((x) => x.code === "dish")!;
    expect(dish.fraction).toBe(0.75);
    expect(r.score).toBeLessThan(100);
  });
  it("drops the band when the basics slip", () => {
    const r = scoreWeek({
      ...base,
      ticks: [
        ...ok("phone"),
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
    expect(scoreWeek(empty).results.find((r) => r.code === "dish")!.detail).toBe("never ticked either way — half marks");
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

describe("an untouched parent column pays half", () => {
  it("halves a column nobody ever tapped", () => {
    const r = scoreWeek({ ...base, ticks: [...ok("manners"), ...ok("phone")] });
    const dish = r.results.find((x) => x.code === "dish")!;
    expect(dish.fraction).toBe(0.5);
    expect(dish.earned).toBe(10); // 20 weight
    expect(dish.detail).toBe("never ticked either way — half marks");
  });

  it("pays a ticked column in full, however few days were tapped", () => {
    const r = scoreWeek({ ...base, ticks: [...ok("manners"), ...ok("phone"), { tick_date: "2026-09-11", code: "dish", value: true }] });
    expect(r.results.find((x) => x.code === "dish")!.fraction).toBe(1);
  });

  it("still lets a parent recover the full mark by ticking later", () => {
    const r = scoreWeek({ ...base, ticks: [...ok("manners"), ...ok("phone")] });
    expect(r.results.find((x) => x.code === "dish")!.fraction).toBe(0.5);
    expect(r.maxScore).toBe(100); // nothing is lost for good; the taps can still be made
  });

  it("costs a never-tapped week a quarter of the score", () => {
    const tapped = scoreWeek(base);
    const silent = scoreWeek({ ...base, ticks: [] });
    expect(tapped.score).toBe(100);
    expect(silent.score).toBe(75); // dish 20 + manners 20 + phone 10, halved, out of 100
  });
});

describe("no snaps means no pay", () => {
  const withSnaps = mergeKpis(
    [{ code: "classlog", enabled: false }, { code: "checkpoint", enabled: false }, { code: "homework", enabled: false }, { code: "grades", enabled: false }, { code: "materials", enabled: false }],
    [{ code: "bed", label: "Bed made", emoji: "🛏️", weight: 10, enabled: true, days: [0, 1, 2, 3, 4, 5, 6], kind: "chore" }],
  );
  const snapWeek = { ...base, kpis: withSnaps };

  it("pays nothing when not one snap was taken", () => {
    const r = scoreWeek(snapWeek);
    expect(r.blocked).toBe("no photo proof at all: 0 of 4 snaps due this week");
    expect(r.band).toBe("none");
    expect(amountFor(r.score, 250, r.blocked)).toBe(0);
  });

  it("leaves the score alone — the gate decides whether it pays, not what it is", () => {
    const r = scoreWeek(snapWeek);
    expect(r.score).toBeGreaterThan(50); // it would have paid without the gate
    expect(bandFor(r.score).band).not.toBe("none");
  });

  it("is lifted by a single snap on a single day", () => {
    const r = scoreWeek({ ...snapWeek, snapDays: { "snap:bed": ["2026-09-12"] } });
    expect(r.blocked).toBeNull();
    expect(r.band).not.toBe("none");
    expect(amountFor(r.score, 250, r.blocked)).toBeGreaterThan(0);
  });

  it("stays liftable while a snap is still due, and closes once none is", () => {
    const midweek = scoreWeek(snapWeek); // day 4 of 7
    expect(midweek.blockedForGood).toBe(false);
    expect(midweek.bestBand).not.toBe("none");
    const closed = scoreWeek({ ...snapWeek, today: "2026-09-17" }); // pay day
    expect(closed.blockedForGood).toBe(true);
    expect(closed.bestBand).toBe("none");
  });

  it("does not fire when no snap was due at all", () => {
    const noneDue = mergeKpis(null, [{ code: "bed", label: "Bed made", emoji: "🛏️", weight: 10, enabled: true, days: [], kind: "chore" }]);
    expect(scoreWeek({ ...base, kpis: noneDue }).blocked).toBeNull();
  });

  it("puts the snap first in the hints", () => {
    expect(scoreWeek(snapWeek).hints[0]).toBe("Snap at least one chore today — with no photo at all the week pays nothing");
  });

  it("tells the child plainly, and differently once it cannot be fixed", () => {
    const open = scoreWeek(snapWeek);
    expect(eligibilityHint(open, 250).text).toContain("One snap on one day lifts it");
    const shut = scoreWeek({ ...snapWeek, today: "2026-09-17" });
    expect(eligibilityHint(shut, 250).text).toContain("Next week starts fresh");
    expect(eligibilityHint(shut, 250).tone).toBe("bad");
  });
});

describe("the week that prompted both rules", () => {
  // Youssef's closed week of 12–18 September, rebuilt from the breakdown the app stored: real schoolwork (13 of
  // 17 classes logged, 4 of 6 planned quizzes attempted), no prayers, one check-in, not one photograph in seven
  // days, and three parent columns nobody ever tapped. It scored 51 and paid 100 EGP.
  const snapTask = (code: string, label: string, weight: number, days: number[]) =>
    ({ code, label, emoji: "📸", weight, enabled: true, days, kind: "chore" });
  const kpis = mergeKpis(null, [
    snapTask("homework", "Homework page", 15, [0, 1, 2, 3, 4]),
    snapTask("screen", "Screen time", 10, [0, 1, 2, 3, 4, 5, 6]),
    snapTask("bed", "Bed made", 10, [0, 1, 2, 3, 4, 5, 6]),
    snapTask("dish", "Dish cleared", 10, [0, 1, 2, 3, 4, 5, 6]),
    snapTask("desk", "Desk tidy", 10, [0, 1, 2, 3, 4, 5, 6]),
    snapTask("hand", "Handwriting", 5, [3]),
    snapTask("sandwich", "Sandwich", 5, [0, 1, 2, 3, 4, 5]),
    snapTask("bag", "Bag packed", 5, [0, 1, 2, 3, 4, 5]),
  ]);
  const WEEK = ["2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"];
  const week = {
    kpis,
    start: "2026-09-12",
    end: "2026-09-18",
    today: "2026-09-18",
    ticks: [] as { tick_date: string; code: string; value: boolean }[],
    prayerDays: {},
    checkinDates: ["2026-09-14"],
    plannedTotal: 6,
    plannedAttempted: 4,
    wellbeingDue: true,
    wellbeingDone: false,
    classLog: { due: 17, done: 13, missingLine: null },
    snapDays: {} as Record<string, string[]>,
  };
  // Ticking every day ✓ reproduces what "no ✗ so far" used to pay, which is how the week scored 51.
  const tappedDaily = ["dish", "manners", "phone"].flatMap((c) => WEEK.map((d) => ({ tick_date: d, code: c, value: true })));

  it("reproduces the score the app actually stored", () => {
    expect(scoreWeek({ ...week, ticks: tappedDaily }).score).toBe(51);
  });

  it("falls under the paying line on the half-marks rule alone", () => {
    const halved = scoreWeek({ ...week, snapDays: { "snap:bed": ["2026-09-12"] } }); // gate lifted, taps still missing
    expect(halved.blocked).toBeNull();
    expect(halved.score).toBe(40);
    expect(amountFor(halved.score, 250, halved.blocked)).toBe(0);
  });

  it("pays nothing on the snap gate even when every day was tapped ✓", () => {
    const tapped = scoreWeek({ ...week, ticks: tappedDaily });
    expect(tapped.score).toBe(51); // would have paid
    expect(tapped.blocked).toBe("no photo proof at all: 0 of 46 snaps due this week");
    expect(amountFor(tapped.score, 250, tapped.blocked)).toBe(0);
  });

  it("pays again once the parent taps and one photograph exists", () => {
    const fixed = scoreWeek({ ...week, ticks: tappedDaily, snapDays: { "snap:bed": ["2026-09-12"] } });
    expect(fixed.blocked).toBeNull();
    expect(fixed.score).toBe(52);
    expect(fixed.band).toBe("some");
    expect(amountFor(fixed.score, 250, fixed.blocked)).toBe(100);
  });
});
