/**
 * The five things a parent asks at the end of a school day.
 *
 * What did he do yesterday · what is due today · what should he be doing now · what needs my signature · what
 * is coming. Each of those lived on a different screen, or on none, so answering them meant four taps and a
 * guess. They are one page now, and the rules below are what keep it honest:
 *
 * - **Nothing logged is not the same as nothing done.** A blank yesterday means the app was not told, and it
 *   says that, rather than reporting that a child did nothing.
 * - **Overdue is counted from the due date, not from a feeling.** A task the school gave no date for can never
 *   be late, but it is still real work, so it is listed rather than dropped.
 * - **A paper to sign is the parent's job**, so it never joins the child's list and never counts against them.
 */

export type Kind = "homework" | "quiz" | "exam" | "project" | "event" | "note" | "sign";

export interface Item {
  id: string;
  kind: Kind;
  title: string;
  subject: string | null;
  /** null means the school gave no date. */
  dueDate: string | null;
  completedAt: string | null;
  signedAt: string | null;
}

export interface QuizRow { id: string; title: string; scheduledFor: string | null; submittedAt: string | null }

export interface Yesterday {
  checkedIn: boolean;
  classNotes: number;
  quizzesSat: { title: string; score: number | null; total: number | null }[];
  prayersLogged: number;
  snaps: number;
  /** Tasks the child ticked off yesterday. */
  finished: string[];
}

export interface Briefing {
  yesterday: Yesterday;
  /** Nothing at all was recorded: say so rather than implying an idle child. */
  yesterdaySilent: boolean;
  dueToday: Item[];
  overdue: Item[];
  /** Dated work still ahead, within the horizon. */
  comingUp: Item[];
  /** No date given by the school: real work that would otherwise be invisible. */
  undated: Item[];
  toSign: Item[];
  quizzesToday: QuizRow[];
  quizzesSoon: QuizRow[];
}

const WORK: Kind[] = ["homework", "project", "quiz", "exam"];

export function isWork(i: Item): boolean {
  return WORK.includes(i.kind);
}

/** Open means not done. A paper to sign is open until it is signed, whatever the child did. */
export function isOpen(i: Item): boolean {
  return i.kind === "sign" ? i.signedAt === null : i.completedAt === null;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Undated last, then by date, then by title so the order never wobbles between loads. */
function byDue(a: Item, b: Item): number {
  if (a.dueDate === b.dueDate) return a.title.localeCompare(b.title);
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

export function build(items: Item[], quizzes: QuizRow[], y: Yesterday, today: string, horizonDays = 7): Briefing {
  const open = items.filter(isOpen);
  const ahead = addDays(today, horizonDays);
  const toSign = open.filter((i) => i.kind === "sign");
  const childs = open.filter((i) => i.kind !== "sign");

  return {
    yesterday: y,
    yesterdaySilent:
      !y.checkedIn && y.classNotes === 0 && y.quizzesSat.length === 0 && y.prayersLogged === 0
      && y.snaps === 0 && y.finished.length === 0,
    overdue: childs.filter((i) => i.dueDate !== null && i.dueDate < today).sort(byDue),
    dueToday: childs.filter((i) => i.dueDate === today).sort(byDue),
    comingUp: childs.filter((i) => i.dueDate !== null && i.dueDate > today && i.dueDate <= ahead).sort(byDue),
    undated: childs.filter((i) => i.dueDate === null && isWork(i)),
    toSign: toSign.sort(byDue),
    quizzesToday: quizzes.filter((q) => q.scheduledFor === today && !q.submittedAt),
    quizzesSoon: quizzes
      .filter((q) => q.scheduledFor !== null && q.scheduledFor > today && q.scheduledFor <= ahead && !q.submittedAt)
      .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? "")),
  };
}

/** What a parent should read first, in one sentence. A signature is theirs to give, so it leads. */
export function firstLine(b: Briefing, firstName: string): string {
  if (b.toSign.length > 0) {
    return `${b.toSign.length} paper${b.toSign.length === 1 ? "" : "s"} need${b.toSign.length === 1 ? "s" : ""} your signature.`;
  }
  if (b.overdue.length > 0) return `${b.overdue.length} thing${b.overdue.length === 1 ? " is" : "s are"} past due.`;
  if (b.dueToday.length > 0 || b.quizzesToday.length > 0) {
    const bits = [
      b.dueToday.length > 0 ? `${b.dueToday.length} due today` : null,
      b.quizzesToday.length > 0 ? `${b.quizzesToday.length} quiz${b.quizzesToday.length === 1 ? "" : "zes"} to sit` : null,
    ].filter(Boolean);
    return `${firstName} has ${bits.join(" and ")}.`;
  }
  if (b.comingUp.length > 0) return `Nothing due today. Next: ${b.comingUp[0].title}.`;
  return `Nothing outstanding for ${firstName}.`;
}

/** Yesterday in one line: either what happened, or an admission that nobody told the app. */
export function yesterdayLine(b: Briefing, firstName: string): string {
  if (b.yesterdaySilent) {
    return `Nothing was logged for ${firstName} yesterday. That means the app was not told — not that the day was empty.`;
  }
  const y = b.yesterday;
  const bits: string[] = [];
  if (y.checkedIn) bits.push("checked in");
  if (y.classNotes > 0) bits.push(`wrote up ${y.classNotes} lesson${y.classNotes === 1 ? "" : "s"}`);
  if (y.quizzesSat.length > 0) {
    bits.push(`sat ${y.quizzesSat.map((q) => (q.score !== null && q.total ? `${q.title} (${q.score}/${q.total})` : q.title)).join(", ")}`);
  }
  if (y.finished.length > 0) bits.push(`finished ${y.finished.length} task${y.finished.length === 1 ? "" : "s"}`);
  if (y.snaps > 0) bits.push(`sent ${y.snaps} photo${y.snaps === 1 ? "" : "s"}`);
  if (y.prayersLogged > 0) bits.push(`logged ${y.prayersLogged}/5 prayers`);
  return `${firstName} ${bits.join(" · ")}.`;
}
