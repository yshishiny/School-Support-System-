/**
 * What a child should do next, in the order a child would do it.
 *
 * Learn opened on six tabs — This week, For me, Subjects, exams, Quran, Files — and left him to assemble his own
 * evening out of them. His actual day is simpler and starts somewhere else: the school gave him sheets, some of
 * those sheets are homework, each has a lesson behind it, and there are quizzes to sit. Everything else is
 * reference.
 *
 * The order below is a claim about what matters, and it is the only thing in this file worth arguing with:
 *
 * 1. **Homework that is late.** Nothing he could learn tonight outranks something already owed.
 * 2. **Homework due today.**
 * 3. **A quiz booked for today**, which has a time and will not wait.
 * 4. **Sheets the school sent**, newest first — the spine of his week.
 * 5. **Practice**, always available and never urgent: the route to a better grade rather than a rescue.
 *
 * Reviews sit outside the order entirely. They are the pile that grows when he stops opening the app, so they
 * are shown as a standing count rather than as another thing shouting for tonight.
 */

export type Urgency = "late" | "today" | "soon" | "none";

export interface Task {
  id: string;
  title: string;
  subject: string | null;
  dueDate: string | null;
  kind: string;
}

export interface Sheet {
  id: string;
  title: string;
  subject: string | null;
  createdAt: string;
  /** Questions were transcribed, so he can answer it in the app rather than only read it. */
  solvable: boolean;
  /** Practice sets already built from this sheet. */
  sets: number;
  /** A lesson exists for what this sheet is about. */
  hasLesson: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  scheduledFor: string | null;
  done: boolean;
}

export function urgencyOf(dueDate: string | null, today: string): Urgency {
  if (dueDate === null) return "none";
  if (dueDate < today) return "late";
  if (dueDate === today) return "today";
  return "soon";
}

/** Late first, then today, then dated, then undated; ties broken by title so the list never reorders itself. */
export function orderTasks(tasks: Task[], today: string): Task[] {
  const rank = (t: Task) => ({ late: 0, today: 1, soon: 2, none: 3 })[urgencyOf(t.dueDate, today)];
  return [...tasks].sort((a, b) => rank(a) - rank(b) || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9") || a.title.localeCompare(b.title));
}

/**
 * Sheets newest first, because the one the school sent today is the one tonight is about.
 *
 * A sheet he can answer in the app is not promoted above a newer one: recency is what makes a sheet relevant,
 * and being answerable only changes what the button says.
 */
export function orderSheets(sheets: Sheet[]): Sheet[] {
  return [...sheets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface Next {
  kind: "late" | "today" | "quiz" | "sheet" | "practice";
  /** Said to the child, in the second person, naming the actual thing. */
  line: string;
}

/** The single thing to open first, and why. */
export function whatNow(tasks: Task[], sheets: Sheet[], quizzes: Quiz[], today: string): Next {
  const ordered = orderTasks(tasks, today);
  const late = ordered.filter((t) => urgencyOf(t.dueDate, today) === "late");
  const due = ordered.filter((t) => urgencyOf(t.dueDate, today) === "today");
  const quizToday = quizzes.filter((q) => q.scheduledFor === today && !q.done);

  if (late.length > 0) {
    return {
      kind: "late",
      line: late.length === 1
        ? `${late[0].title} is late. Start there.`
        : `${late.length} things are late. Start with ${late[0].title}.`,
    };
  }
  if (due.length > 0) return { kind: "today", line: `${due[0].title} is due today.` };
  if (quizToday.length > 0) return { kind: "quiz", line: `You have ${quizToday.length === 1 ? "a quiz" : `${quizToday.length} quizzes`} to sit today.` };
  const newest = orderSheets(sheets)[0];
  if (newest) return { kind: "sheet", line: `Nothing is due. Work through ${newest.title}.` };
  return { kind: "practice", line: "Nothing owed and nothing new from school. Practice is how the grade moves." };
}

/** What a sheet's main button should say, given how far it has been taken. */
export function sheetAction(s: Sheet): { label: string; hint: string } {
  if (s.solvable) return { label: "Answer it", hint: "The questions are in the app — no printing." };
  if (s.sets > 0) return { label: "Practise from it", hint: `${s.sets} set${s.sets === 1 ? "" : "s"} built from this sheet.` };
  return { label: "Make practice from it", hint: "Turns this sheet into questions you can answer." };
}
