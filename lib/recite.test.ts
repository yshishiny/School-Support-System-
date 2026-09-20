import { describe, expect, it } from "vitest";
import { fold, mark, verdictLine, words } from "./recite";

const FATIHA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

describe("folding — a transcriber's spelling must not fail a correct reciter", () => {
  it("strips vowel marks and the dagger alef", () => {
    expect(fold("ٱلرَّحْمَٰنِ")).toBe(fold("الرحمن"));
  });

  it("folds every alef together", () => {
    expect(fold("أحمد")).toBe(fold("احمد"));
    expect(fold("إبراهيم")).toBe(fold("ابراهيم"));
    expect(fold("آمن")).toBe(fold("امن"));
    expect(fold("ٱلله")).toBe(fold("الله"));
  });

  it("folds ى to ي and ة to ه, which a stop changes anyway", () => {
    expect(fold("موسى")).toBe(fold("موسي"));
    expect(fold("الصلاة")).toBe(fold("الصلاه"));
  });

  it("drops ayah marks and punctuation without merging words", () => {
    expect(words("الحمد لله ۝ رب العالمين")).toEqual(words("الحمد لله رب العالمين"));
  });
});

describe("marking — the child is told which word, not just a number", () => {
  it("gives a perfect recitation full marks despite different spelling", () => {
    const m = mark(FATIHA, "بسم الله الرحمن الرحيم");
    expect(m.score).toBe(100);
    expect(m.firstSlip).toBeNull();
    expect(m.words.every((w) => w.verdict === "correct")).toBe(true);
  });

  it("marks one dropped word as missed and keeps the rest correct", () => {
    // The whole point of aligning rather than comparing position by position.
    const m = mark("الحمد لله رب العالمين", "الحمد رب العالمين");
    expect(m.words.map((w) => w.verdict)).toEqual(["correct", "missed", "correct", "correct"]);
    expect(m.correct).toBe(3);
    expect(m.expected).toBe(4);
    expect(m.score).toBe(75);
  });

  it("does not mark everything after a slip as wrong", () => {
    const m = mark("ا ب ج د ه و", "ا ب ج س د ه و");
    expect(m.words.filter((w) => w.verdict === "correct")).toHaveLength(6);
    expect(m.words.filter((w) => w.verdict === "extra")).toHaveLength(1);
    expect(m.score).toBe(100);
  });

  it("names the first slip and only the first", () => {
    const m = mark("الحمد لله رب العالمين", "الحمد لله العالمين");
    expect(m.firstSlip).toBe(2);
  });

  it("shows the child his own spelling, not the folded form", () => {
    const m = mark(FATIHA, "بسم الله الرحمن الرحيم");
    expect(m.words[2].text).toContain("ٰ");  // the dagger alef of ٱلرَّحْمَٰنِ survives on screen
  });

  it("scores a silent attempt zero rather than throwing", () => {
    const m = mark(FATIHA, "");
    expect(m.score).toBe(0);
    expect(m.words.every((w) => w.verdict === "missed")).toBe(true);
  });

  it("handles nothing to recite", () => {
    expect(mark("", "أي شيء").score).toBe(0);
  });
});

describe("what he is told", () => {
  it("never lists every mistake", () => {
    for (const heard of ["", "الحمد", "الحمد لله", "الحمد لله رب العالمين"]) {
      expect(verdictLine(mark("الحمد لله رب العالمين", heard)).split(".").length).toBeLessThanOrEqual(3);
    }
  });

  it("celebrates only a perfect one", () => {
    expect(verdictLine(mark("الحمد لله", "الحمد لله"))).toMatch(/ما شاء الله/);
    expect(verdictLine(mark("الحمد لله", "الحمد"))).not.toMatch(/ما شاء الله/);
  });
});
