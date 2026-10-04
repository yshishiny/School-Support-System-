import { describe, expect, it } from "vitest";
import { offersWorksheet, wantsWorksheet, type Candidate } from "./worksheet";

const c = (over: Partial<Candidate> = {}): Candidate =>
  ({ status: "ready", kind: "worksheet", hasQuestions: true, worksheet: null, ...over });

describe("wantsWorksheet", () => {
  it("takes the reader's own answer when it has one", () => {
    expect(wantsWorksheet(c({ hasQuestions: true, kind: "study_guide" }))).toBe(true);
    expect(wantsWorksheet(c({ hasQuestions: false, kind: "worksheet" }))).toBe(false);
  });

  it("falls back to the old label for a file read before the question was asked", () => {
    // Nothing that used to be offered stops being offered just because the row predates the column.
    expect(wantsWorksheet(c({ hasQuestions: null, kind: "worksheet" }))).toBe(true);
    expect(wantsWorksheet(c({ hasQuestions: null, kind: "announcement" }))).toBe(false);
  });

  it("never spends a call on a file that already has its questions", () => {
    expect(wantsWorksheet(c({ worksheet: { questions: [] } }))).toBe(false);
  });

  it("waits until the file has been read", () => {
    expect(wantsWorksheet(c({ status: "new" }))).toBe(false);
    expect(wantsWorksheet(c({ status: "failed" }))).toBe(false);
  });
});

describe("offersWorksheet", () => {
  it("keeps the button on a sheet already transcribed, because a bad one is worth redoing", () => {
    expect(offersWorksheet(c({ hasQuestions: false, kind: "notes", worksheet: { questions: [] } }))).toBe(true);
  });

  it("is wider than wantsWorksheet by exactly that case", () => {
    const already = c({ worksheet: { questions: [] } });
    expect(wantsWorksheet(already)).toBe(false);
    expect(offersWorksheet(already)).toBe(true);
  });

  it("does not put the button on a letter home", () => {
    // It only ever produced a wasted AI call and an apology.
    expect(offersWorksheet(c({ hasQuestions: false, kind: "announcement" }))).toBe(false);
  });

  it("stays off a file that has not been read", () => {
    expect(offersWorksheet(c({ status: "failed" }))).toBe(false);
  });
});
