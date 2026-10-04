import { describe, expect, it } from "vitest";
import { headlineOf, labelOf, routesOf, sheetFirst, viewerFor, type SheetFile } from "./sheet";

const f = (over: Partial<SheetFile> = {}): SheetFile =>
  ({ mime: "application/pdf", questions: 0, hasQuestions: false, error: null, sets: 0, hasDigest: true, ...over });

describe("viewerFor", () => {
  it("shows a PDF and a photo in the page", () => {
    expect(viewerFor("application/pdf")).toBe("pdf");
    expect(viewerFor("image/jpeg")).toBe("image");
    expect(viewerFor("image/webp")).toBe("image");
  });

  it("falls back to a link for what a phone browser will not render", () => {
    expect(viewerFor("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("link");
    expect(viewerFor("text/csv")).toBe("link");
  });
});

describe("routesOf", () => {
  it("puts the teacher's own questions before anything the app invents", () => {
    expect(routesOf(f({ questions: 12 }))).toEqual(["answer", "practise", "paper"]);
  });

  it("says the questions are coming rather than offering nothing", () => {
    expect(routesOf(f({ hasQuestions: true }))).toEqual(["waiting", "practise", "paper"]);
  });

  it("never offers both answering and waiting", () => {
    const r = routesOf(f({ questions: 5, hasQuestions: true }));
    expect(r).toContain("answer");
    expect(r).not.toContain("waiting");
  });

  it("offers paper on a file it can do nothing else with", () => {
    // A sheet the app cannot read is still a sheet he has to hand in.
    expect(routesOf(f({ hasDigest: false }))).toEqual(["paper"]);
  });

  it("does not offer practice with nothing to build it from", () => {
    expect(routesOf(f({ hasDigest: false, questions: 3 }))).toEqual(["answer", "paper"]);
  });

  it("offers reading material practice and paper, and nothing to answer", () => {
    expect(routesOf(f())).toEqual(["practise", "paper"]);
  });
});

describe("headlineOf", () => {
  it("counts the questions waiting for him", () => {
    expect(headlineOf(f({ questions: 12 }), 0)).toBe("12 questions from this sheet, ready to answer here.");
  });

  it("uses the singular for one question", () => {
    expect(headlineOf(f({ questions: 1 }), 0)).toContain("1 question from this sheet");
  });

  it("invites a second go once he has sat it, rather than repeating the first line", () => {
    expect(headlineOf(f({ questions: 8 }), 1)).toContain("answered this once");
    expect(headlineOf(f({ questions: 8 }), 3)).toContain("3 times");
  });

  it("does not pretend a failed sheet is still coming", () => {
    const h = headlineOf(f({ hasQuestions: true, error: "The AI is busy right now." }), 0);
    expect(h).toContain("could not be read");
    expect(h).toContain("paper");
  });

  it("says a reading file has nothing to answer instead of leaving him hunting for a button", () => {
    expect(headlineOf(f(), 0)).toContain("it is for reading");
  });

  it("credits the practice already built from a reading file", () => {
    expect(headlineOf(f({ sets: 2 }), 0)).toContain("2 practice sets");
  });
});

describe("sheetFirst", () => {
  it("leads with the file when reading it is the whole task", () => {
    expect(sheetFirst(f())).toBe(true);
  });

  it("leads with the buttons when there is something to answer", () => {
    expect(sheetFirst(f({ questions: 9 }))).toBe(false);
  });

  it("leads with the buttons while the questions are still being typed up", () => {
    // They arrive in a minute; re-ordering the page under him when they land would be worse.
    expect(sheetFirst(f({ hasQuestions: true }))).toBe(false);
  });
});

describe("labelOf", () => {
  it("has a label and a reason for every route", () => {
    for (const r of ["answer", "waiting", "practise", "paper"] as const) {
      const { label, hint } = labelOf(r);
      expect(label.length).toBeGreaterThan(3);
      expect(hint.length).toBeGreaterThan(10);
    }
  });

  it("promises the marking says where it goes wrong, not the answer", () => {
    expect(labelOf("paper").hint).toContain("not the answer");
  });
});
