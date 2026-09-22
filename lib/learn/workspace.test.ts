import { describe, expect, it } from "vitest";
import { orderSheets, orderTasks, sheetAction, urgencyOf, whatNow, type Quiz, type Sheet, type Task } from "./workspace";

const TODAY = "2026-09-22";
const task = (over: Partial<Task> = {}): Task =>
  ({ id: "t", title: "Maths p.12", subject: "Math", dueDate: TODAY, kind: "homework", ...over });
const sheet = (over: Partial<Sheet> = {}): Sheet =>
  ({ id: "s", title: "Story Settings", subject: "English", createdAt: "2026-09-22T10:00:00Z", solvable: false, sets: 0, hasLesson: false, ...over });
const quiz = (over: Partial<Quiz> = {}): Quiz => ({ id: "q", title: "Algebra", scheduledFor: TODAY, done: false, ...over });

describe("urgencyOf", () => {
  it("knows late from today from later", () => {
    expect(urgencyOf("2026-09-21", TODAY)).toBe("late");
    expect(urgencyOf(TODAY, TODAY)).toBe("today");
    expect(urgencyOf("2026-09-25", TODAY)).toBe("soon");
  });

  it("never calls undated work late", () => {
    expect(urgencyOf(null, TODAY)).toBe("none");
  });
});

describe("orderTasks", () => {
  it("puts what is owed before what is new", () => {
    const got = orderTasks([
      task({ id: "soon", dueDate: "2026-09-25" }),
      task({ id: "none", dueDate: null }),
      task({ id: "late", dueDate: "2026-09-20" }),
      task({ id: "today", dueDate: TODAY }),
    ], TODAY);
    expect(got.map((t) => t.id)).toEqual(["late", "today", "soon", "none"]);
  });

  it("puts the oldest debt first among the late ones", () => {
    const got = orderTasks([
      task({ id: "b", dueDate: "2026-09-21" }),
      task({ id: "a", dueDate: "2026-09-17" }),
    ], TODAY);
    expect(got.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("breaks a tie on the title so the list does not shuffle between loads", () => {
    const got = orderTasks([task({ id: "z", title: "Zebra" }), task({ id: "a", title: "Apple" })], TODAY);
    expect(got.map((t) => t.id)).toEqual(["a", "z"]);
  });

  it("does not mutate what it was given", () => {
    const list = [task({ id: "a", dueDate: "2026-09-25" }), task({ id: "b", dueDate: "2026-09-20" })];
    orderTasks(list, TODAY);
    expect(list.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("orderSheets", () => {
  it("shows the newest sheet first, because tonight is about today's sheet", () => {
    const got = orderSheets([
      sheet({ id: "old", createdAt: "2026-09-16T10:00:00Z" }),
      sheet({ id: "new", createdAt: "2026-09-22T10:00:00Z" }),
    ]);
    expect(got.map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("does not promote a solvable sheet over a newer one", () => {
    // Being answerable changes the button, not the relevance.
    const got = orderSheets([
      sheet({ id: "new", createdAt: "2026-09-22T10:00:00Z", solvable: false }),
      sheet({ id: "solvable", createdAt: "2026-09-16T10:00:00Z", solvable: true }),
    ]);
    expect(got[0].id).toBe("new");
  });
});

describe("whatNow", () => {
  it("sends him at the late work before anything he could learn tonight", () => {
    const n = whatNow([task({ title: "Maths p.12", dueDate: "2026-09-17" })], [sheet()], [quiz()], TODAY);
    expect(n.kind).toBe("late");
    expect(n.line).toBe("Maths p.12 is late. Start there.");
  });

  it("names the oldest one when several are late, without listing them all", () => {
    const n = whatNow([
      task({ id: "a", title: "Maths p.12", dueDate: "2026-09-17" }),
      task({ id: "b", title: "Book report", dueDate: "2026-09-19" }),
    ], [], [], TODAY);
    expect(n.line).toBe("2 things are late. Start with Maths p.12.");
  });

  it("then today's homework", () => {
    const n = whatNow([task({ title: "Science ws", dueDate: TODAY })], [sheet()], [quiz()], TODAY);
    expect(n.kind).toBe("today");
    expect(n.line).toContain("Science ws");
  });

  it("then a quiz that has a time and will not wait", () => {
    const n = whatNow([], [sheet()], [quiz()], TODAY);
    expect(n.kind).toBe("quiz");
  });

  it("ignores a quiz already sat", () => {
    const n = whatNow([], [sheet()], [quiz({ done: true })], TODAY);
    expect(n.kind).toBe("sheet");
  });

  it("then the newest sheet from school", () => {
    const n = whatNow([], [
      sheet({ title: "Old one", createdAt: "2026-09-16T10:00:00Z" }),
      sheet({ title: "Today's sheet", createdAt: "2026-09-22T10:00:00Z" }),
    ], [], TODAY);
    expect(n.kind).toBe("sheet");
    expect(n.line).toContain("Today's sheet");
  });

  it("falls back to practice, and says why rather than leaving him on an empty page", () => {
    const n = whatNow([], [], [], TODAY);
    expect(n.kind).toBe("practice");
    expect(n.line).toContain("Practice is how the grade moves");
  });

  it("does not treat undated work as due today", () => {
    const n = whatNow([task({ dueDate: null })], [], [], TODAY);
    expect(n.kind).not.toBe("today");
  });
});

describe("sheetAction", () => {
  it("offers to answer a sheet whose questions are in the app", () => {
    expect(sheetAction(sheet({ solvable: true })).label).toBe("Answer it");
  });

  it("offers the practice already built before offering to build more", () => {
    const a = sheetAction(sheet({ sets: 2 }));
    expect(a.label).toBe("Practise from it");
    expect(a.hint).toContain("2 sets");
  });

  it("offers to make practice from a sheet that is only readable", () => {
    expect(sheetAction(sheet()).label).toBe("Make practice from it");
  });

  it("prefers answering the real sheet over practice built from it", () => {
    // Doing the teacher's actual questions beats a set inspired by them.
    expect(sheetAction(sheet({ solvable: true, sets: 3 })).label).toBe("Answer it");
  });
});
