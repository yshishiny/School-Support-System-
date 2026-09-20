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
