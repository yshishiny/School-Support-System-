import { describe, expect, it } from "vitest";
import { bestMatch, confidenceOf, gap, headline, match, similarity, words, type CurriculumTopic, type TaughtTopic } from "./gap";

// The real grade-8 American topic names, and the real phrasings Omar's school files came back with.
const c = (id: string, subject: string, unit: string, name: string, hasLesson = false): CurriculumTopic => ({ id, subject, unit, name, hasLesson });
const MATHS: CurriculumTopic[] = [
  c("m1", "Mathematics", "The Number System", "Square roots and cube roots"),
  c("m2", "Mathematics", "The Number System", "Integer exponents"),
  c("m3", "Mathematics", "The Number System", "Scientific notation"),
  c("m4", "Mathematics", "Geometry", "The Pythagorean theorem"),
  c("m5", "Mathematics", "Statistics", "Two-way tables"),
];
const t = (topic: string, subject: string | null = "Math"): TaughtTopic => ({ topic, fromTitle: "Grade 8 American Math – Practice Sheet", fromId: "f1", subject });

describe("words", () => {
  it("drops the noise a curriculum writer and a teacher use differently", () => {
    expect(words("Analysing the structure of a text")).toEqual(["structure", "text"]);
  });

  it("folds plurals so roots matches root", () => {
    expect(words("Square roots")).toEqual(["square", "root"]);
  });

  it("does not maul a short word into nothing", () => {
    // "gases" -> "gase" would be wrong; the rule only fires after four characters.
    expect(words("mass and volume")).toEqual(["mass", "volume"]);
  });

  it("survives the punctuation a model puts in a heading", () => {
    expect(words("Standard Form (Scientific Notation)")).toEqual(["standard", "form", "scientific", "notation"]);
  });
});

describe("similarity", () => {
  it("pairs the school's phrasing with the curriculum's", () => {
    expect(similarity("Square Roots and Cube Roots", "Square roots and cube roots")).toBe(1);
    expect(similarity("Standard Form (Scientific Notation)", "Scientific notation")).toBe(1);
    expect(similarity("Powers and Exponents", "Integer exponents")).toBeGreaterThanOrEqual(0.5);
  });

  it("does not pair things that merely share a noise word", () => {
    expect(similarity("Least Common Multiple (LCM)", "Two-way tables")).toBe(0);
  });

  it("is zero against nothing", () => {
    expect(similarity("", "Scientific notation")).toBe(0);
  });
});

describe("match", () => {
  it("finds the maths topics the school taught that are in the curriculum", () => {
    const got = match([t("Square Roots and Cube Roots"), t("Standard Form (Scientific Notation)")], MATHS);
    expect(got.map((m) => m.best?.id)).toEqual(["m1", "m3"]);
    expect(got.every((m) => m.confidence === "sure")).toBe(true);
  });

  it("will not call a half-overlap a match, even when it happens to be one", () => {
    // "Powers and Exponents" really is "Integer exponents", and one shared word out of two is all the signal
    // there is. Run over Omar's real files, that same 0.5 also paired "mood and atmosphere" with "Verb mood
    // and shifts" and "Kinetic energy" with "Conservation of energy" — three wrong for one right. A wrong
    // pairing marks a gap as covered, so the band stays a maybe and a person decides.
    const got = match([t("Powers and Exponents")], MATHS);
    expect(got[0].best?.id).toBe("m2");
    expect(got[0].confidence).toBe("maybe");
  });

  it("refuses to pair what grade 8 simply does not contain", () => {
    // LCM, HCF and prime factorisation are grade 6 work. The school sent them as revision; pretending they
    // matched a grade 8 topic would hide exactly the thing this is for.
    const got = match([t("Least Common Multiple (LCM)"), t("Highest Common Factor (HCF)"), t("Prime Factorization")], MATHS);
    expect(got.every((m) => m.confidence !== "sure")).toBe(true);
  });

  it("ignores a subject label the curriculum does not use", () => {
    // The file says "Math"; the curriculum says "Mathematics". Narrowing on that would find nothing.
    const got = match([t("Square Roots and Cube Roots", "Math")], MATHS);
    expect(got[0].best?.id).toBe("m1");
  });

  it("searches everything when the file names no subject", () => {
    expect(match([t("Scientific notation", null)], MATHS)[0].best?.id).toBe("m3");
  });

  it("keeps the school's own wording, because that is what the parent recognises", () => {
    expect(match([t("Standard Form (Scientific Notation)")], MATHS)[0].taught).toBe("Standard Form (Scientific Notation)");
  });
});

describe("bestMatch", () => {
  it("returns nothing at all against an empty curriculum", () => {
    expect(bestMatch("anything", [])).toEqual({ best: null, score: 0 });
  });
});

describe("confidenceOf", () => {
  it("has three answers, and the middle one is not a match", () => {
    expect(confidenceOf(0.9)).toBe("sure");
    expect(confidenceOf(0.4)).toBe("maybe");
    expect(confidenceOf(0.1)).toBe("none");
  });
});

describe("gap", () => {
  const withLesson = MATHS.map((x) => (x.id === "m1" ? { ...x, hasLesson: true } : x));

  it("separates what is ready from what the school needs now", () => {
    const m = match([t("Square Roots and Cube Roots"), t("Scientific notation")], withLesson);
    const g = gap(m, withLesson);
    expect(g.covered.map((x) => x.best?.id)).toEqual(["m1"]);
    expect(g.needsLesson.map((x) => x.best?.id)).toEqual(["m3"]);
  });

  it("counts a topic the school teaches but the curriculum lacks as off-curriculum, not as missing", () => {
    const g = gap(match([t("Least Common Multiple (LCM)")], MATHS), MATHS);
    expect(g.offCurriculum).toHaveLength(1);
    expect(g.needsLesson).toHaveLength(0);
  });

  it("lists what the curriculum holds that no file has ever mentioned", () => {
    const g = gap(match([t("Square Roots and Cube Roots")], MATHS), MATHS);
    expect(g.notTaughtYet.map((x) => x.id)).toEqual(["m2", "m3", "m4", "m5"]);
  });

  it("does not count a merely-maybe pairing as reached", () => {
    // A guess must not make a curriculum topic look covered.
    const g = gap(match([t("something vaguely notation adjacent")], MATHS), MATHS);
    expect(g.notTaughtYet).toHaveLength(MATHS.length);
  });
});

describe("headline", () => {
  it("says there is nothing to compare when no file has arrived", () => {
    expect(headline(gap([], MATHS), "Omar")).toContain("nothing to compare");
  });

  it("names both kinds of gap in one sentence", () => {
    const m = match([t("Scientific notation"), t("Least Common Multiple (LCM)")], MATHS);
    const line = headline(gap(m, MATHS), "Omar");
    expect(line).toContain("1 the school is teaching now with no lesson written");
    expect(line).toContain("do not match Omar's curriculum");
  });

  it("says so plainly when there is no gap", () => {
    const all = MATHS.map((x) => ({ ...x, hasLesson: true }));
    const line = headline(gap(match([t("Scientific notation")], all), all), "Omar");
    expect(line).toContain("has a lesson ready");
  });
});
