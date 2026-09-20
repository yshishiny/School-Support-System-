import { describe, expect, it } from "vitest";
import { LEVEL, LEVELS, canOpen, isLevel, levelOf, levelsOpenTo } from "./levels";

describe("the two depths of a lesson", () => {
  it("never locks the basics, whatever a family has paid", () => {
    expect(canOpen("basics", false)).toBe(true);
    expect(canOpen("basics", true)).toBe(true);
    expect(levelsOpenTo(false)).toEqual(["basics"]);
  });

  it("opens the deep version only once it is unlocked", () => {
    expect(canOpen("advanced", false)).toBe(false);
    expect(canOpen("advanced", true)).toBe(true);
    expect(levelsOpenTo(true)).toEqual(["basics", "advanced"]);
  });

  it("falls back to the free level rather than locking a child out on a bad value", () => {
    expect(levelOf(undefined)).toBe("basics");
    expect(levelOf("nonsense")).toBe("basics");
    expect(levelOf(null)).toBe("basics");
    expect(levelOf("advanced")).toBe("advanced");
  });

  it("recognises only the two it knows", () => {
    expect(isLevel("basics")).toBe(true);
    expect(isLevel("advanced")).toBe(true);
    expect(isLevel("hard")).toBe(false);
  });

  it("tells the two writers genuinely different things", () => {
    for (const id of LEVELS) {
      expect(LEVEL[id].lessonBrief.length).toBeGreaterThan(80);
      expect(LEVEL[id].quizBrief.length).toBeGreaterThan(40);
    }
    expect(LEVEL.basics.lessonBrief).not.toBe(LEVEL.advanced.lessonBrief);
    // The basics must not wander into the deep material, and the deep version must not repeat the basics.
    expect(LEVEL.basics.lessonBrief).toMatch(/homework tonight/);
    expect(LEVEL.advanced.lessonBrief).toMatch(/do not repeat it/);
  });
});

describe("the depth briefs, as the writers receive them", () => {
  // The whole paid difference is that these two briefs ask for different lessons. If they ever converge — the
  // deep one re-teaching the rule, or the plain one wandering into proofs — a family is paying for nothing.
  it("keeps the plain lesson out of the deep material", () => {
    const b = LEVEL.basics.lessonBrief.toLowerCase();
    expect(b).toMatch(/missed the class|did not follow/);
    expect(b).toMatch(/do not digress/);
    expect(b).not.toMatch(/exam sets|boundary cases/);
  });

  it("keeps the deep lesson from repeating the plain one", () => {
    const a = LEVEL.advanced.lessonBrief.toLowerCase();
    expect(a).toMatch(/why the rule is true/);
    expect(a).toMatch(/boundary cases|fails/);
    expect(a).toMatch(/trap an exam sets/);
  });

  it("asks for genuinely different questions at each depth", () => {
    expect(LEVEL.basics.quizBrief.toLowerCase()).toMatch(/one idea per question/);
    expect(LEVEL.advanced.quizBrief.toLowerCase()).toMatch(/multi-step|transfer/);
  });
});
