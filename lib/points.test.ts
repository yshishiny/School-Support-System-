import { describe, it, expect } from "vitest";
import { computeAwards, computeStreak, levelFor, POINTS } from "./points";

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-09-12", "2026-09-13", "2026-09-14"], "2026-09-14")).toBe(3);
  });
  it("is zero when today has no check-in", () => {
    expect(computeStreak(["2026-09-12", "2026-09-13"], "2026-09-14")).toBe(0);
  });
  it("stops at a gap", () => {
    expect(computeStreak(["2026-09-10", "2026-09-13", "2026-09-14"], "2026-09-14")).toBe(2);
  });
});

describe("computeAwards", () => {
  const base = { checkinId: "c1", today: "2026-09-14", streak: 1 };
  it("pays the check-in and on-time homework", () => {
    const awards = computeAwards({
      ...base,
      items: [{ assignmentId: "a1", status: "done", dueDate: "2026-09-14", kind: "homework" }],
    });
    const total = awards.reduce((s, a) => s + a.delta, 0);
    expect(total).toBe(POINTS.CHECKIN + POINTS.HOMEWORK_ON_TIME + POINTS.ALL_DONE_BONUS);
  });
  it("pays less for late homework and no bonus when something is not done", () => {
    const awards = computeAwards({
      ...base,
      items: [
        { assignmentId: "a1", status: "done", dueDate: "2026-09-10", kind: "homework" },
        { assignmentId: "a2", status: "not_done", dueDate: "2026-09-14", kind: "homework" },
      ],
    });
    expect(awards.map((a) => a.delta)).toEqual([POINTS.CHECKIN, POINTS.HOMEWORK_LATE]);
  });
  it("does not pay homework points for quizzes or exams", () => {
    const awards = computeAwards({
      ...base,
      items: [{ assignmentId: "q1", status: "done", dueDate: "2026-09-14", kind: "quiz" }],
    });
    expect(awards.some((a) => a.ref_type === "assignment")).toBe(false);
  });
  it("pays streak milestones once", () => {
    const awards = computeAwards({ ...base, streak: 7, items: [] });
    expect(awards.find((a) => a.ref_type === "streak_7")?.delta).toBe(50);
  });
});

describe("levelFor", () => {
  it("starts at level 1 and moves every 200 points", () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(199).level).toBe(1);
    expect(levelFor(200).level).toBe(2);
    expect(levelFor(450)).toEqual({ level: 3, into: 50, span: 200 });
  });
});
