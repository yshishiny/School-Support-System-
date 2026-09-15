import { describe, expect, it } from "vitest";
import { attentionTier, computeSignals, type SignalInput } from "./signals";

const quiet: SignalInput = {
  today: "2026-09-15",
  pulses: [{ taken_on: "2026-09-14", answers: { mood: "4", stress: "2", sleep: "4", energy: "5" } }],
  who5: [{ taken_on: "2026-09-01", score: 76, answers: { w1: "4", w2: "4", w3: "3", w4: "4", w5: "4" } }],
  mindset: { answers: { m1: "2", m2: "4", m3: "4", m4: "4", m5: "2", m6: "3" } },
  habits: { answers: { h1: "4", h2: "2", h3: "5", h4: "3", h5: "3", h6: "5" } },
  activityHoursLocal: [16, 17, 20, 21],
  plannedDoneThisWeek: 4,
  plannedDoneLastWeek: 4,
  checkinsThisWeek: 5,
  checkinsLastWeek: 5,
  longestStreakBefore: 5,
  currentStreak: 5,
  checkinMoods: [4, 4, 3, 5],
  stuckOnTexts: ["quadratics"],
  riskLevels: ["none", "none"],
  flaggedAttempts: 0,
  daysSinceLastChat: 2,
  lastChatWasLow: false,
  accountAgeDays: 60,
};

describe("computeSignals", () => {
  it("is silent on a quiet fortnight", () => {
    const s = computeSignals(quiet);
    expect(s).toHaveLength(0);
    expect(attentionTier(s).tier).toBe("none");
  });
  it("flags a single meaningful signal as 'watch' (low threshold by design)", () => {
    const s = computeSignals({ ...quiet, pulses: [{ taken_on: "2026-09-14", answers: { mood: "2", stress: "2", sleep: "4", energy: "5" } }] });
    expect(s.map((x) => x.code)).toEqual(["low_mood"]);
    expect(attentionTier(s).tier).toBe("watch");
  });
  it("combines sleep, late-night use and engagement drop into amber", () => {
    const s = computeSignals({
      ...quiet,
      pulses: [{ taken_on: "2026-09-14", answers: { mood: "3", stress: "5", sleep: "1", energy: "3" } }],
      activityHoursLocal: [1, 2, 1, 3, 0],
      plannedDoneThisWeek: 1,
      plannedDoneLastWeek: 4,
    });
    const codes = s.map((x) => x.code);
    expect(codes).toContain("short_sleep");
    expect(codes).toContain("late_night_use");
    expect(codes).toContain("engagement_drop");
    expect(codes).toContain("high_pressure");
    expect(attentionTier(s).tier).toBe("amber");
  });
  it("does not flag missing check-ins or engagement drops on a brand-new account", () => {
    const s = computeSignals({ ...quiet, accountAgeDays: 1, checkinsThisWeek: 0, checkinsLastWeek: 0, plannedDoneThisWeek: 0, plannedDoneLastWeek: 4 });
    expect(s.map((x) => x.code)).not.toContain("no_checkins");
    expect(s.map((x) => x.code)).not.toContain("engagement_drop");
  });
  it("reads feelings written into the 'stuck on' box, in Arabic too", () => {
    const s = computeSignals({ ...quiet, stuckOnTexts: ["مش قادر أركز وتعبان"] });
    expect(s.map((x) => x.code)).toContain("stuck_feelings");
  });
  it("escalates to red only with a moderate-risk chat plus other load", () => {
    const s = computeSignals({ ...quiet, riskLevels: ["moderate"], pulses: [{ taken_on: "2026-09-14", answers: { mood: "1", stress: "5", sleep: "1", energy: "1" } }] });
    expect(attentionTier(s).tier).toBe("red");
  });
});
