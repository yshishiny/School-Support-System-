import { describe, expect, it } from "vitest";
import { allowancePlan, whyThisAmount, type WeekResult } from "./allowance";

const base: WeekResult = {
  score: 62, band: "some", elapsedDays: 4, totalDays: 7, maxScore: 91, bestBand: "full",
  measuredScore: 51, defaultScore: 11, measurable: 89,
  hints: ["No more ✗ on “manners: respectful, no shouting”", "Fill in 3 classes in the check-in (Mon: Math, Chem)", "Log at least 4 prayers today", "Snap “bed made” today"],
  results: [
    { code: "dish", label: "Cleared his dish and his space", emoji: "🍽️", weight: 20, fraction: 1, earned: 20, detail: "no ✗ so far", basis: "measured" as const },
    { code: "manners", label: "Manners: respectful, no shouting", emoji: "🤝", weight: 20, fraction: 0.75, earned: 15, detail: "1 day marked ✗", basis: "measured" as const },
    { code: "classlog", label: "Every class logged: what he took, homework yes/no", emoji: "📖", weight: 15, fraction: 0.5, earned: 7.5, detail: "3 of 6 classes logged", basis: "measured" as const },
    { code: "prayers", label: "Prayers logged, 4 of 5 most days", emoji: "🕌", weight: 15, fraction: 0.66, earned: 9.9, detail: "2 of 4 days with 4+ prayers", basis: "measured" as const },
    { code: "snap:bed", label: "Snap: Bed made", emoji: "🛏️", weight: 10, fraction: 0.75, earned: 7.5, detail: "3 of 4 days snapped", basis: "measured" as const },
    { code: "checkpoint", label: "Weekly checkpoint attempted", emoji: "🎯", weight: 10, fraction: 1, earned: 10, detail: "none this week", basis: "default" as const },
  ],
};

describe("allowancePlan", () => {
  it("splits what can be caught up from what can only be protected, most valuable first", () => {
    const p = allowancePlan(base);
    expect(p.todo.map((x) => x.code)).toEqual(["classlog", "prayers", "snap:bed"]);
    expect(p.todo[0].atStake).toBe(7.5);
    expect(p.todo[0].href).toBe("/checkin");
    expect(p.todo[0].how).toMatch(/Fill in 3 classes/);
    expect(p.protect.map((x) => x.code)).toEqual(["manners"]);
    expect(p.protect[0].recoverable).toBe(false);
    expect(p.lost).toEqual([]);
  });
  it("marks an expired checkpoint as lost", () => {
    const r = { ...base, results: base.results.map((x) => (x.code === "checkpoint" ? { ...x, fraction: 0, earned: 0, detail: "not attempted before the week closed" } : x)) };
    expect(allowancePlan(r).lost.map((x) => x.code)).toEqual(["checkpoint"]);
  });
});

describe("whyThisAmount", () => {
  it("explains the band and what is still reachable", () => {
    const t = whyThisAmount(base, 200);
    expect(t).toMatch(/62 out of 100/);
    expect(t).toMatch(/80 EGP/);
    expect(t).toMatch(/reach 91.*full allowance: 200 EGP/);
  });
  it("says when the week can no longer improve", () => {
    expect(whyThisAmount({ ...base, score: 75, band: "most", maxScore: 78, bestBand: "most" }, 200)).toMatch(/cannot be recovered/);
  });
});
