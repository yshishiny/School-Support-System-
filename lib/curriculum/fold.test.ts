import { describe, expect, it } from "vitest";
import { NOT_THE_SAME, planFold, subjectsAfter, summarise, targetSubject, type FoldTopic } from "./fold";

const t = (over: Partial<FoldTopic> = {}): FoldTopic =>
  ({ id: "x", grade: 8, subject: "Math", unit: "Number System", name: "Exponent rules", sort: 101, language: "en", work: 0, ...over });

describe("targetSubject", () => {
  it("renames a school subject to what the American list calls it", () => {
    expect(targetSubject({ grade: 8, subject: "Math", unit: "Number System" })).toBe("Mathematics");
    expect(targetSubject({ grade: 8, subject: "English", unit: "Reading" })).toBe("English Language Arts");
  });

  it("gives the same subject a different name in a different year", () => {
    // "Math" is Mathematics at 8 and Geometry at 10; "Social Studies" is US history then world history.
    expect(targetSubject({ grade: 10, subject: "Math", unit: "Geometry" })).toBe("Geometry");
    expect(targetSubject({ grade: 8, subject: "Social Studies", unit: "US History" })).toBe("Social Studies");
    expect(targetSubject({ grade: 10, subject: "Social Studies", unit: "World History" })).toBe("World History II");
  });

  it("believes the unit over the subject where they disagree", () => {
    // Grade 10 "Math" is ten geometry topics and three algebra ones. Quadratics are not geometry.
    expect(targetSubject({ grade: 10, subject: "Math", unit: "Algebra 2" })).toBe("Algebra II");
  });

  it("keeps a subject the American list does not have", () => {
    expect(targetSubject({ grade: 10, subject: "Religion", unit: "فقه" })).toBe("Religion");
    expect(targetSubject({ grade: 10, subject: "Physics", unit: "Mechanics" })).toBe("Physics");
  });
});

describe("planFold — what comes across", () => {
  it("moves every school topic, losing none", () => {
    const school = [t({ id: "a" }), t({ id: "b", subject: "Religion" }), t({ id: "c", grade: 10, subject: "Physics" })];
    const plan = planFold(school, [t({ id: "s", subject: "Mathematics" })]);
    expect(plan.moves.map((m) => m.topic.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("never changes a school topic's id, because its lessons hang off it", () => {
    // The whole point of folding this direction: not one foreign key moves, so no lesson can be mis-filed.
    const plan = planFold([t({ id: "keep-me", work: 11 })], [t({ id: "s", subject: "Mathematics" })]);
    expect(plan.moves[0].topic.id).toBe("keep-me");
  });

  it("sorts the school's own syllabus above the seeded catalogue", () => {
    // Seeded sorts start at 101. A child should not scroll past Common Core to reach what his teacher set.
    const plan = planFold([t({ id: "a", name: "First" }), t({ id: "b", name: "Second" })], [t({ id: "s", subject: "Mathematics", sort: 101 })]);
    expect(plan.moves.map((m) => m.sort)).toEqual([1, 2]);
  });

  it("numbers each subject from one, independently", () => {
    const plan = planFold([t({ id: "a" }), t({ id: "b", subject: "Religion" })], []);
    expect(plan.moves.map((m) => m.sort)).toEqual([1, 1]);
  });

  it("flags the subjects the curriculum did not have, and only those", () => {
    const plan = planFold([t({ id: "a" }), t({ id: "b", subject: "Religion", language: "ar" })], [t({ id: "s", subject: "Mathematics" })]);
    expect(plan.moves.find((m) => m.topic.id === "a")!.newSubject).toBe(false);
    expect(plan.moves.find((m) => m.topic.id === "b")!.newSubject).toBe(true);
    expect(plan.subjects).toEqual([{ grade: 8, subject: "Religion", language: "ar", sort: 900 }]);
  });

  it("carries the subject's own language, so an Arabic subject is not filed as English", () => {
    const plan = planFold([t({ subject: "Arabic", language: "ar" })], []);
    expect(plan.subjects[0].language).toBe("ar");
  });

  it("does not treat the same subject in two grades as one new subject", () => {
    const plan = planFold([t({ id: "a", subject: "Religion" }), t({ id: "b", grade: 10, subject: "Religion" })], []);
    expect(plan.subjects.map((s) => s.grade)).toEqual([8, 10]);
  });
});

describe("planFold — what the seeded list loses", () => {
  const seeded = (name: string, over: Partial<FoldTopic> = {}) => t({ id: `s-${name}`, subject: "Mathematics", name, ...over });

  it("drops a seeded topic the school's own topic already covers", () => {
    const plan = planFold(
      [t({ id: "sch", name: "Rational and irrational numbers, square and cube roots" })],
      [seeded("Rational and irrational numbers")],
    );
    expect(plan.absorbed.map((a) => a.seeded.name)).toEqual(["Rational and irrational numbers"]);
    expect(plan.kept).toEqual([]);
  });

  it("lets one school topic absorb several seeded ones, because it is usually the coarser of the two", () => {
    const plan = planFold(
      [t({ id: "sch", name: "Rational and irrational numbers, square and cube roots" })],
      [seeded("Rational and irrational numbers"), seeded("Approximating irrational numbers"), seeded("Square roots and cube roots")],
    );
    expect(plan.absorbed).toHaveLength(3);
  });

  it("keeps a seeded topic the school's list does not reach", () => {
    const plan = planFold([t({ id: "sch", name: "Exponent rules and scientific notation" })], [seeded("Ellipsis and punctuation for pause")]);
    expect(plan.kept.map((k) => k.name)).toEqual(["Ellipsis and punctuation for pause"]);
    expect(plan.absorbed).toEqual([]);
  });

  it("never lets a topic absorb across a subject or a grade", () => {
    const plan = planFold([t({ id: "sch", subject: "Religion", name: "Scientific notation" })], [seeded("Scientific notation")]);
    expect(plan.absorbed).toEqual([]);
    expect(plan.kept).toHaveLength(1);
  });

  it("refuses the pairs on the reviewed list however well they score", () => {
    const plan = planFold(
      [t({ id: "sch", grade: 10, subject: "Social Studies", unit: "World History", name: "World War I" })],
      [t({ id: "s", grade: 10, subject: "World History II", name: "The Second World War" })],
    );
    expect(plan.absorbed).toEqual([]);
    expect(plan.kept.map((k) => k.name)).toEqual(["The Second World War"]);
  });

  it("does not delete the Second World War from a syllabus", () => {
    // The matcher scored "World War I" against "The Second World War" at 1.00: it drops one-character tokens,
    // so the roman numeral that is the entire difference between the two wars vanishes. No threshold catches
    // this — only reading the pairs does. Kept as a regression test because the cost of it recurring is a
    // child's history course quietly losing a war.
    const school = [
      t({ id: "w1", grade: 10, subject: "Social Studies", unit: "World History", name: "World War I" }),
      t({ id: "w2", grade: 10, subject: "Social Studies", unit: "World History", name: "World War II and the Holocaust" }),
    ];
    const plan = planFold(school, [
      t({ id: "s1", grade: 10, subject: "World History II", name: "Causes and course of the First World War" }),
      t({ id: "s2", grade: 10, subject: "World History II", name: "The Second World War" }),
    ]);
    expect(plan.absorbed.find((a) => a.seeded.name === "The Second World War")!.by.id).toBe("w2");
    expect(plan.absorbed.find((a) => a.seeded.name === "Causes and course of the First World War")!.by.id).toBe("w1");
  });

  it("lets the blocked seeded topic go to the school topic that does own it", () => {
    const school = [
      t({ id: "one", name: "Solving linear equations in one variable" }),
      t({ id: "sys", name: "Systems of linear equations" }),
    ];
    const plan = planFold(school, [seeded("Linear equations with one, none or many solutions")]);
    expect(plan.absorbed[0].by.id).toBe("one");
  });

  it("states every blocked pair as a school topic and a seeded one, in that order", () => {
    for (const [school, seed] of NOT_THE_SAME) {
      expect(typeof school).toBe("string");
      expect(school).not.toBe(seed);
    }
  });
});

describe("planFold — housekeeping", () => {
  it("does not mutate what it was given", () => {
    const school = [t({ id: "b", name: "B" }), t({ id: "a", name: "A" })];
    planFold(school, []);
    expect(school.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("gives the same plan twice over the same data", () => {
    const school = [t({ id: "a", name: "Exponent rules and scientific notation" }), t({ id: "b", name: "Volume of cylinders" })];
    const seed = [t({ id: "s", subject: "Mathematics", name: "Scientific notation" })];
    expect(JSON.stringify(planFold(school, seed))).toBe(JSON.stringify(planFold(school, seed)));
  });

  it("is happy with a grade the school has nothing for", () => {
    const plan = planFold([], [t({ id: "s", subject: "Chemistry", grade: 10 })]);
    expect(plan.moves).toEqual([]);
    expect(plan.kept).toHaveLength(1);
  });
});

describe("summarise and subjectsAfter", () => {
  it("counts the work coming across, which is the reason for doing this at all", () => {
    const plan = planFold([t({ id: "a", work: 11 }), t({ id: "b", work: 4 })], []);
    expect(summarise(plan).work).toBe(15);
  });

  it("shows what a child of that grade would see afterwards", () => {
    const plan = planFold(
      [t({ id: "a", name: "Exponent rules and scientific notation" }), t({ id: "r", subject: "Religion" })],
      [t({ id: "s1", subject: "Mathematics", name: "Scientific notation" }), t({ id: "s2", subject: "Mathematics", name: "Integer exponents" })],
    );
    expect(subjectsAfter(plan, 8)).toEqual([
      { subject: "Mathematics", topics: 2 },
      { subject: "Religion", topics: 1 },
    ]);
  });

  it("counts nothing for a grade nobody is in", () => {
    expect(subjectsAfter(planFold([t()], []), 12)).toEqual([]);
  });
});
