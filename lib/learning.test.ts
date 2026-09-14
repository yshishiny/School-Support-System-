import { describe, it, expect } from "vitest";
import { quizPoints, integrityFlag, nextReview, masteryFor, actEstimate, actSecondsPerQuestion } from "./learning";

describe("quizPoints", () => {
  it("pays completion, correct answers and a high-score bonus", () => {
    expect(quizPoints(9, 10, "quiz", 0)).toBe(5 + 9 + 5);
    expect(quizPoints(5, 10, "quiz", 0)).toBe(5 + 5);
  });
  it("respects the daily cap", () => {
    expect(quizPoints(10, 10, "quiz", 55)).toBe(5);
    expect(quizPoints(10, 10, "quiz", 60)).toBe(0);
  });
});

describe("integrityFlag", () => {
  it("flags fast high scores", () => {
    expect(integrityFlag({ secondsPerAnswer: [2, 3, 2, 4, 3], score: 5, total: 5, tabSwitches: 0 })).toMatch(/very fast/);
  });
  it("does not flag a slow honest attempt", () => {
    expect(integrityFlag({ secondsPerAnswer: [20, 35, 40, 15, 30], score: 3, total: 5, tabSwitches: 1 })).toBeNull();
  });
  it("flags many tab switches with a good score", () => {
    expect(integrityFlag({ secondsPerAnswer: [30, 30, 30, 30], score: 4, total: 4, tabSwitches: 4 })).toMatch(/tab/);
  });
});

describe("nextReview", () => {
  it("schedules a wrong answer for tomorrow", () => {
    expect(nextReview(null, false, "2026-09-14")).toEqual({ due_date: "2026-09-15", interval_days: 1, lapses: 1 });
  });
  it("grows the interval on correct answers", () => {
    expect(nextReview({ interval_days: 4, lapses: 1 }, true, "2026-09-14")).toEqual({ due_date: "2026-09-24", interval_days: 10, lapses: 1 });
  });
});

describe("masteryFor and actEstimate", () => {
  it("weights the latest attempt more", () => {
    const m = masteryFor([
      { score: 4, total: 10, submitted_at: "2026-09-01" },
      { score: 9, total: 10, submitted_at: "2026-09-10" },
    ]);
    expect(m).toBe(70);
    expect(masteryFor([])).toBeNull();
  });
  it("maps percentages to the 1-36 scale", () => {
    expect(actEstimate(100)).toBe(36);
    expect(actEstimate(50)).toBe(23);
    expect(actEstimate(null)).toBeNull();
  });
  it("knows enhanced ACT pacing", () => {
    expect(actSecondsPerQuestion("english")).toBe(42);
    expect(actSecondsPerQuestion("math")).toBe(67);
  });
});
