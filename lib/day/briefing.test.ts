import { describe, expect, it } from "vitest";
import { addDays, build, firstLine, isOpen, yesterdayLine, type Item, type QuizRow, type Yesterday } from "./briefing";

const TODAY = "2026-09-22";
const item = (over: Partial<Item> = {}): Item =>
  ({ id: "a", kind: "homework", title: "Maths p.12", subject: "Math", dueDate: TODAY, completedAt: null, signedAt: null, ...over });
const quiz = (over: Partial<QuizRow> = {}): QuizRow =>
  ({ id: "q", title: "Algebra", scheduledFor: TODAY, submittedAt: null, ...over });
const quiet: Yesterday = { checkedIn: false, classNotes: 0, quizzesSat: [], prayersLogged: 0, snaps: 0, finished: [] };
const busy: Yesterday = { checkedIn: true, classNotes: 3, quizzesSat: [{ title: "Algebra", score: 8, total: 10 }], prayersLogged: 5, snaps: 2, finished: ["Maths p.12"] };

describe("isOpen", () => {
  it("closes a child's task when it is completed", () => {
    expect(isOpen(item({ completedAt: "2026-09-21T10:00:00Z" }))).toBe(false);
  });

  it("closes a paper only when it is signed, not when the child marks it done", () => {
    // A child cannot clear a signature by doing anything.
    expect(isOpen(item({ kind: "sign", completedAt: "2026-09-21T10:00:00Z", signedAt: null }))).toBe(true);
    expect(isOpen(item({ kind: "sign", completedAt: null, signedAt: "2026-09-21T10:00:00Z" }))).toBe(false);
  });
});

describe("build — what is due", () => {
  it("separates late, today, and coming up", () => {
    const b = build([
      item({ id: "late", dueDate: "2026-09-20" }),
      item({ id: "now", dueDate: TODAY }),
      item({ id: "soon", dueDate: "2026-09-25" }),
    ], [], quiet, TODAY);
    expect(b.overdue.map((i) => i.id)).toEqual(["late"]);
    expect(b.dueToday.map((i) => i.id)).toEqual(["now"]);
    expect(b.comingUp.map((i) => i.id)).toEqual(["soon"]);
  });

  it("does not call undated work late", () => {
    // The school often gives no date. That is not the child being behind.
    const b = build([item({ id: "nodate", dueDate: null })], [], quiet, TODAY);
    expect(b.overdue).toHaveLength(0);
    expect(b.undated.map((i) => i.id)).toEqual(["nodate"]);
  });

  it("keeps undated work visible rather than dropping it", () => {
    const b = build([item({ id: "p", kind: "project", dueDate: null })], [], quiet, TODAY);
    expect(b.undated).toHaveLength(1);
  });

  it("does not list an undated note as work", () => {
    const b = build([item({ kind: "note", dueDate: null })], [], quiet, TODAY);
    expect(b.undated).toHaveLength(0);
  });

  it("leaves anything beyond the horizon out of coming up", () => {
    const b = build([item({ id: "far", dueDate: addDays(TODAY, 30) })], [], quiet, TODAY);
    expect(b.comingUp).toHaveLength(0);
  });

  it("ignores what is already done", () => {
    const b = build([item({ completedAt: "2026-09-21T09:00:00Z" })], [], quiet, TODAY);
    expect(b.dueToday).toHaveLength(0);
  });

  it("orders by date, then by title, so the list never wobbles", () => {
    const b = build([
      item({ id: "b", title: "B", dueDate: "2026-09-25" }),
      item({ id: "a", title: "A", dueDate: "2026-09-25" }),
      item({ id: "c", title: "C", dueDate: "2026-09-23" }),
    ], [], quiet, TODAY);
    expect(b.comingUp.map((i) => i.title)).toEqual(["C", "A", "B"]);
  });
});

describe("build — papers to sign", () => {
  it("keeps a signature out of the child's lists entirely", () => {
    const b = build([item({ id: "slip", kind: "sign", dueDate: "2026-09-20" })], [], quiet, TODAY);
    expect(b.toSign.map((i) => i.id)).toEqual(["slip"]);
    expect(b.overdue).toHaveLength(0);
    expect(b.dueToday).toHaveLength(0);
    expect(b.comingUp).toHaveLength(0);
  });

  it("drops it once signed", () => {
    const b = build([item({ kind: "sign", signedAt: "2026-09-21T20:00:00Z" })], [], quiet, TODAY);
    expect(b.toSign).toHaveLength(0);
  });
});

describe("build — quizzes", () => {
  it("splits today's from the ones coming", () => {
    const b = build([], [quiz({ id: "today" }), quiz({ id: "fri", scheduledFor: "2026-09-25" })], quiet, TODAY);
    expect(b.quizzesToday.map((q) => q.id)).toEqual(["today"]);
    expect(b.quizzesSoon.map((q) => q.id)).toEqual(["fri"]);
  });

  it("does not chase a quiz already sat", () => {
    const b = build([], [quiz({ submittedAt: "2026-09-22T08:00:00Z" })], quiet, TODAY);
    expect(b.quizzesToday).toHaveLength(0);
  });

  it("leaves an unscheduled quiz out of both", () => {
    const b = build([], [quiz({ scheduledFor: null })], quiet, TODAY);
    expect(b.quizzesToday).toHaveLength(0);
    expect(b.quizzesSoon).toHaveLength(0);
  });
});

describe("yesterday", () => {
  it("calls a completely blank day silent, not idle", () => {
    const b = build([], [], quiet, TODAY);
    expect(b.yesterdaySilent).toBe(true);
    expect(yesterdayLine(b, "Omar")).toContain("was not told");
    expect(yesterdayLine(b, "Omar")).not.toContain("nothing done");
  });

  it("is not silent when even one thing was logged", () => {
    const b = build([], [], { ...quiet, prayersLogged: 1 }, TODAY);
    expect(b.yesterdaySilent).toBe(false);
  });

  it("reads back what actually happened, with the score", () => {
    const line = yesterdayLine(build([], [], busy, TODAY), "Omar");
    expect(line).toContain("checked in");
    expect(line).toContain("Algebra (8/10)");
    expect(line).toContain("5/5 prayers");
  });

  it("names a quiz with no score without inventing one", () => {
    const y: Yesterday = { ...quiet, quizzesSat: [{ title: "Science", score: null, total: null }] };
    const line = yesterdayLine(build([], [], y, TODAY), "Omar");
    expect(line).toContain("Science");
    expect(line).not.toContain("/");
  });
});

describe("firstLine", () => {
  it("leads with the signature, because that one is the parent's to do", () => {
    const b = build([item({ kind: "sign" }), item({ id: "late", dueDate: "2026-09-01" })], [], quiet, TODAY);
    expect(firstLine(b, "Omar")).toBe("1 paper needs your signature.");
  });

  it("then with what is late", () => {
    const b = build([item({ id: "late", dueDate: "2026-09-01" })], [], quiet, TODAY);
    expect(firstLine(b, "Omar")).toBe("1 thing is past due.");
  });

  it("then with today's load", () => {
    const b = build([item()], [quiz()], quiet, TODAY);
    expect(firstLine(b, "Omar")).toBe("Omar has 1 due today and 1 quiz to sit.");
  });

  it("says plainly when there is nothing", () => {
    expect(firstLine(build([], [], quiet, TODAY), "Omar")).toBe("Nothing outstanding for Omar.");
  });

  it("points at the next thing when today is clear", () => {
    const b = build([item({ title: "Book report", dueDate: "2026-09-24" })], [], quiet, TODAY);
    expect(firstLine(b, "Omar")).toContain("Next: Book report");
  });
});

describe("addDays", () => {
  it("crosses a month end", () => expect(addDays("2026-09-28", 7)).toBe("2026-10-05"));
});
