import { describe, expect, it } from "vitest";
import { brief, checks, delegation, disclosure, provenance, verdict, type CurriculumTopic } from "./fluency";

const arabic: CurriculumTopic = {
  id: "t1", curriculumId: "egyptian_national", grade: 8, stream: null,
  subject: "Mathematics", unit: "الجبر", name: "تحليل الفرق بين مربعين", language: "ar",
};
const english: CurriculumTopic = {
  id: "t2", curriculumId: "american", grade: 11, stream: null,
  subject: "Physics", unit: "Dynamics", name: "Newtons second law", language: "en",
};

describe("delegation — what stays human", () => {
  it("never gives the model the judgement of whether the class matched", () => {
    const d = delegation(arabic, "basics", { hasTutor: false });
    const judge = d.find((x) => x.task.includes("matched what the class"));
    expect(judge?.to).toBe("parent");
  });

  it("sends a misunderstanding that survived two explanations to a person, not back to the model", () => {
    const withTutor = delegation(english, "advanced", { hasTutor: true });
    const without = delegation(english, "advanced", { hasTutor: false });
    expect(withTutor.find((x) => x.task.includes("Diagnose"))?.to).toBe("human_tutor");
    expect(without.find((x) => x.task.includes("Diagnose"))?.to).toBe("parent");
  });

  it("gives every delegation a reason", () => {
    for (const d of delegation(arabic, "advanced", { hasTutor: false })) {
      expect(d.because.length).toBeGreaterThan(20);
    }
  });
});

describe("description — the brief comes from the curriculum row", () => {
  it("names the unit, not just the topic", () => {
    expect(brief(arabic, "basics").product).toContain("الجبر");
    expect(brief(arabic, "basics").process).toContain("الجبر");
  });

  it("asks for the language the subject is taught in", () => {
    expect(brief(arabic, "basics").process).toContain("Arabic");
    expect(brief(english, "basics").process).toContain("English");
  });

  it("tells the model to admit uncertainty rather than write something plausible", () => {
    expect(brief(english, "advanced").performance).toMatch(/not certain|uncertain/i);
  });

  it("carries the stream when the grade is streamed", () => {
    const streamed = { ...english, stream: "science_math", curriculumId: "egyptian_national" };
    expect(brief(streamed, "basics").product).toContain("science_math");
  });
});

describe("discernment — a check that did not run is a check that failed", () => {
  it("blocks when a blocking check has no result at all", () => {
    const cs = checks(arabic, "basics");
    expect(verdict(cs, []).release).toBe(false);
  });

  it("releases only when every blocking check passed", () => {
    const cs = checks(arabic, "basics");
    const all = cs.map((c) => ({ id: c.id, passed: true }));
    expect(verdict(cs, all).release).toBe(true);

    const oneBlockFailed = all.map((r) => (r.id === "no_invention" ? { ...r, passed: false } : r));
    const v = verdict(cs, oneBlockFailed);
    expect(v.release).toBe(false);
    expect(v.blocking).toContain("no_invention");
  });

  it("lets a warning through but keeps it on the record for a parent", () => {
    const cs = checks(arabic, "basics");
    const results = cs.map((c) => ({ id: c.id, passed: c.id !== "attemptable" }));
    const v = verdict(cs, results);
    expect(v.release).toBe(true);
    expect(v.warnings).toContain("attemptable");
  });

  it("asks the deeper level to say why the rule holds", () => {
    expect(checks(english, "advanced").map((c) => c.id)).toContain("says_why");
    expect(checks(english, "basics").map((c) => c.id)).not.toContain("says_why");
  });
});

describe("diligence — the child is told, in the language he reads", () => {
  it("always discloses that a model wrote it", () => {
    expect(disclosure({ aiWritten: true, topicId: "t", level: "basics", model: "m", checkedAt: "", failedChecks: [] }, "en"))
      .toMatch(/written by an AI/i);
    expect(disclosure({ aiWritten: true, topicId: "t", level: "basics", model: "m", checkedAt: "", failedChecks: [] }, "ar"))
      .toContain("مساعد ذكي");
  });

  it("says so when a parent has checked it", () => {
    const p = { aiWritten: true as const, topicId: "t", level: "basics" as const, model: "m", checkedAt: "", failedChecks: [], humanReviewedBy: "dad" };
    expect(disclosure(p, "en")).toMatch(/checked by one of your parents/i);
    expect(disclosure(p, "ar")).toContain("وراجعه");
  });

  it("records every failed check, blocking or not", () => {
    const cs = checks(english, "advanced");
    const results = cs.map((c) => ({ id: c.id, passed: !["names_trap", "attemptable"].includes(c.id) }));
    const p = provenance({ topic: english, level: "advanced", model: "test", cs, results });
    expect(p.failedChecks.sort()).toEqual(["attemptable", "names_trap"]);
    expect(p.aiWritten).toBe(true);
  });
});
