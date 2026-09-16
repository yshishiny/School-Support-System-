import { describe, expect, it } from "vitest";
import { checkpointLine, checkpointResult, claimedNotLearned, subjectOfTag } from "./checkpoint";

describe("checkpoint", () => {
  it("reads the subject off the skill tag", () => {
    expect(subjectOfTag("Math: slope from two points")).toBe("Math");
    expect(subjectOfTag("slope")).toBe("slope");
    expect(subjectOfTag(null)).toBe("General");
  });
  it("positions each subject and compares with the class log", () => {
    const answers = [
      ...Array(4).fill({ correct: true, skill_tag: "Math: x" }),
      { correct: true, skill_tag: "Physics: force" }, { correct: false, skill_tag: "Physics: force" }, { correct: false, skill_tag: "Physics: mass" }, { correct: false, skill_tag: "Physics: units" },
      { correct: true, skill_tag: "Biology: cells" }, { correct: true, skill_tag: "Biology: cells" },
    ];
    const r = checkpointResult(answers, [{ subject: "Math (GPA)", lessons: 3 }, { subject: "Physics", lessons: 3 }]);
    expect(r.score).toBe(7);
    expect(r.total).toBe(10);
    const phys = r.bySubject.find((s) => s.subject === "Physics")!;
    expect(phys.position).toBe("weak");
    expect(phys.verdict).toBe("claimed_not_learned");
    expect(r.bySubject.find((s) => s.subject === "Math")!.verdict).toBe("consistent");
    expect(r.bySubject.find((s) => s.subject === "Biology")!.verdict).toBe("not_claimed");
    expect(claimedNotLearned(r)).toEqual(["Physics"]);
    expect(checkpointLine(r)).toBe("7/10 · Physics 1/4 🔴 (logged 3 lessons, not learned) · Math 4/4 🟢 · Biology 2/2 🟢");
  });
});
