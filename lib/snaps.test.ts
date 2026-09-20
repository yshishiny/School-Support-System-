import { describe, expect, it } from "vitest";
import { dueSnapTasks, handwritingScore, isRota, rotaTurn, rotaTurnEnds, snapCounts, snapDaysDone, taskDayState, taskDueDates, windowOpen, type SnapTask } from "./snaps";

const bed: SnapTask = { id: "t1", student_id: null, code: "bed", kind: "photo", label: "Bed made", emoji: "🛏️", prompt: null, days: [0, 1, 2, 3, 4, 5, 6], window_start: "06:00:00", window_end: "12:00:00", weight: 10, enabled: true };
const hw: SnapTask = { ...bed, id: "t2", code: "homework", kind: "homework", days: [0, 1, 2, 3, 4], window_start: null, window_end: null, student_id: "y" };

describe("snaps", () => {
  it("lists tasks due on a date for a student", () => {
    // 2026-09-18 is a Friday (5)
    expect(dueSnapTasks("2026-09-18", [bed, hw], "y").map((t) => t.code)).toEqual(["bed"]);
    expect(dueSnapTasks("2026-09-16", [bed, hw], "y").map((t) => t.code)).toEqual(["bed", "homework"]);
    expect(dueSnapTasks("2026-09-16", [bed, hw], "o").map((t) => t.code)).toEqual(["bed"]);
  });
  it("respects time windows", () => {
    expect(windowOpen(bed, "07:30")).toBe(true);
    expect(windowOpen(bed, "13:00")).toBe(false);
    expect(windowOpen(hw, "23:30")).toBe(true);
    expect(windowOpen({ window_start: "22:00", window_end: "02:00" }, "23:30")).toBe(true);
  });
  it("counts approved and AI-plausible pending snaps", () => {
    expect(snapCounts({ status: "approved", ai_verdict: "not_it" })).toBe(true);
    expect(snapCounts({ status: "pending", ai_verdict: "looks_good" })).toBe(true);
    expect(snapCounts({ status: "pending", ai_verdict: "unclear" })).toBe(false);
    expect(snapCounts({ status: "rejected", ai_verdict: "looks_good" })).toBe(false);
  });
  it("reports the day state", () => {
    expect(taskDayState(bed, [], "2026-09-16", "08:00")).toBe("due");
    expect(taskDayState(bed, [], "2026-09-16", "13:00")).toBe("closed");
    expect(taskDayState(bed, [{ task_code: "bed", taken_on: "2026-09-16", status: "pending", ai_verdict: "looks_good" }], "2026-09-16", "13:00")).toBe("good");
    expect(taskDayState(bed, [{ task_code: "bed", taken_on: "2026-09-16", status: "pending", ai_verdict: "unclear" }], "2026-09-16", "13:00")).toBe("sent");
    expect(taskDayState(bed, [{ task_code: "bed", taken_on: "2026-09-16", status: "approved", ai_verdict: "unclear" }], "2026-09-16", "13:00")).toBe("approved");
  });
  it("counts due and done days in a week", () => {
    const days = ["2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16"]; // Sun..Wed
    const snaps = [
      { task_code: "bed", taken_on: "2026-09-13", status: "approved" as const, ai_verdict: null },
      { task_code: "bed", taken_on: "2026-09-15", status: "pending" as const, ai_verdict: "looks_good" as const },
      { task_code: "bed", taken_on: "2026-09-16", status: "rejected" as const, ai_verdict: "looks_good" as const },
    ];
    expect(snapDaysDone(bed, snaps, days)).toEqual({ due: 4, done: 2 });
  });
  it("scores handwriting out of 100", () => {
    expect(handwritingScore({ legibility: 5, spacing: 5, letter_formation: 5, size_consistency: 5, line_alignment: 5 })).toBe(100);
    expect(handwritingScore({ legibility: 3, spacing: 3, letter_formation: 2, size_consistency: 3, line_alignment: 4 })).toBe(60);
  });
});

describe("shared chores on a rota", () => {
  const base = { id: "t1", student_id: null, code: "petwaste", kind: "photo" as const, label: "Cats' litter cleaned", emoji: "🐾", prompt: null, days: [0, 1, 2, 3, 4, 5, 6], window_start: null, window_end: null, weight: 10, enabled: true };
  const weekly = { ...base, rota_student_ids: ["omar", "youssef"], rota_period: "week" as const, rota_since: "2026-09-19" };
  const daily = { ...weekly, rota_period: "day" as const };

  it("gives a child a whole week, then hands it over", () => {
    expect(rotaTurn(weekly, "2026-09-19")).toBe("omar");
    expect(rotaTurn(weekly, "2026-09-25")).toBe("omar");
    expect(rotaTurn(weekly, "2026-09-26")).toBe("youssef");
    expect(rotaTurn(weekly, "2026-10-03")).toBe("omar");
  });

  it("alternates day by day when the turn is a day", () => {
    expect(rotaTurn(daily, "2026-09-19")).toBe("omar");
    expect(rotaTurn(daily, "2026-09-20")).toBe("youssef");
    expect(rotaTurn(daily, "2026-09-21")).toBe("omar");
  });

  it("says when the turn ends and who is next", () => {
    expect(rotaTurnEnds(weekly, "2026-09-22")).toEqual({ lastDay: "2026-09-25", next: "youssef" });
  });

  it("only shows the task to the child whose turn it is", () => {
    expect(dueSnapTasks("2026-09-22", [weekly], "omar").map((t) => t.id)).toEqual(["t1"]);
    expect(dueSnapTasks("2026-09-22", [weekly], "youssef")).toEqual([]);
    expect(dueSnapTasks("2026-09-29", [weekly], "youssef").map((t) => t.id)).toEqual(["t1"]);
  });

  it("counts only a child's own turn days towards his week", () => {
    const week = ["2026-09-26", "2026-09-27", "2026-09-28"]; // Youssef's turn
    expect(taskDueDates(weekly, "youssef", week)).toEqual(week);
    expect(taskDueDates(weekly, "omar", week)).toEqual([]);
    expect(snapDaysDone(weekly, [{ task_code: "petwaste", taken_on: "2026-09-26", status: "approved", ai_verdict: null }], week, "omar")).toEqual({ due: 0, done: 0 });
    expect(snapDaysDone(weekly, [{ task_code: "petwaste", taken_on: "2026-09-26", status: "approved", ai_verdict: null }], week, "youssef")).toEqual({ due: 3, done: 1 });
  });

  it("is not a rota with fewer than two children", () => {
    expect(isRota({ ...base, rota_student_ids: ["omar"], rota_since: "2026-09-19" })).toBe(false);
    expect(rotaTurn({ ...base, rota_student_ids: ["omar"], rota_period: "week", rota_since: "2026-09-19" }, "2026-09-20")).toBeNull();
  });
});

describe("an older sister's opinion while a parent has not looked", () => {
  const s = (over: Partial<Parameters<typeof snapCounts>[0]> = {}) =>
    snapCounts({ status: "pending", ai_verdict: null, ...over });

  it("counts what she says is done, without paying for it", () => {
    expect(s({ rater_verdict: "approved" })).toBe(true);
    expect(s({ rater_verdict: "approved", ai_verdict: "not_it" })).toBe(true);
  });

  it("does not count what she sent back, even when the coach liked it", () => {
    expect(s({ rater_verdict: "rejected", ai_verdict: "looks_good" })).toBe(false);
  });

  it("falls back to the coach when she has not looked", () => {
    expect(s({ ai_verdict: "looks_good" })).toBe(true);
    expect(s({ ai_verdict: "unclear" })).toBe(false);
  });

  it("a parent's decision always wins", () => {
    expect(snapCounts({ status: "approved", ai_verdict: "not_it", rater_verdict: "rejected" })).toBe(true);
    expect(snapCounts({ status: "rejected", ai_verdict: "looks_good", rater_verdict: "approved" })).toBe(false);
  });
});
