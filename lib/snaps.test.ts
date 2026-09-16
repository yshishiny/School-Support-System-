import { describe, expect, it } from "vitest";
import { dueSnapTasks, handwritingScore, snapCounts, snapDaysDone, taskDayState, windowOpen, type SnapTask } from "./snaps";

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
