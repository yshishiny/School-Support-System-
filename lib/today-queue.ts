/**
 * The Today page shows ONE thing to do now and a short queue after it. This decides the order.
 * Pure so the ranking is testable.
 */
import type { PrayerName } from "./prayers";

export type QueueKind = "prayer" | "quiz" | "check" | "checkin" | "recall" | "review" | "catchup" | "learner" | "snap" | "classlog" | "checkpoint" | "followup" | "done";

export interface QueueItem {
  key: string;
  kind: QueueKind;
  title: string;
  subtitle: string;
  href: string | null;
  cta: string;
  prayer?: PrayerName;
  chips: string[];
}

export interface QueueInput {
  hourLocal: number;
  prayerOpen: { prayer: PrayerName; label: string; time: string } | null; // window open and not logged
  plannedToday: { id: string; title: string; done: boolean; slot: string | null }[];
  catchup: { id: string; title: string }[];
  checkinDone: boolean;
  classesToday: number;
  hasNotes: boolean;
  recallDone: boolean;
  dueCheck: { id: string; title: string; minutes: number } | null;
  reviewsDue: number;
  learnerDone: boolean;
  snapsDue?: { id: string; label: string; emoji: string }[]; // snap tasks open now and not yet sent today
  followups?: number; // open coach questions on integrity signals
  classLogMissing?: { count: number; line: string; deadline: string } | null; // previous days' classes still not logged this week
  checkinsMissed?: { date: string; label: string }[]; // earlier days this week without a check-in
  checkpoint?: { quizId: string; title: string; questions: number; minutes: number; dueLabel: string } | null; // ready, not attempted
}

export function buildQueue(i: QueueInput): QueueItem[] {
  const q: QueueItem[] = [];
  if (i.prayerOpen) {
    q.push({ key: `prayer-${i.prayerOpen.prayer}`, kind: "prayer", prayer: i.prayerOpen.prayer, title: `${i.prayerOpen.label} · ${i.prayerOpen.time}`, subtitle: "Tap when you pray it", href: null, cta: "Prayed", chips: ["+3 on time"] });
  }
  const evening = i.hourLocal >= 18;
  const checkin: QueueItem = {
    key: "checkin",
    kind: "checkin",
    title: "Evening check-in",
    subtitle: i.classesToday ? `Tick ${i.classesToday} class${i.classesToday === 1 ? "" : "es"}, one line each` : "How was today? Two minutes.",
    href: "/checkin",
    cta: "Start",
    chips: ["+10", i.classesToday ? `+${Math.min(5, i.classesToday) * 2} notes` : "streak"],
  };
  const quizzes = i.plannedToday.filter((p) => !p.done).map<QueueItem>((p) => ({
    key: `quiz-${p.id}`,
    kind: "quiz",
    title: p.title,
    subtitle: p.slot === "exam" ? "Timed exam set" : p.slot === "arabic" ? "Today's Arabic set" : "Today's planned set",
    href: `/quiz/${p.id}`,
    cta: "Play now",
    chips: ["8 questions", "+5 on the day"],
  }));
  if (i.checkpoint) q.push({ key: `checkpoint-${i.checkpoint.quizId}`, kind: "checkpoint", title: i.checkpoint.title, subtitle: `${i.checkpoint.questions} questions · ${i.checkpoint.minutes} min · one attempt · by ${i.checkpoint.dueLabel}`, href: `/quiz/${i.checkpoint.quizId}`, cta: "Start when ready", chips: ["study first", "counts for allowance"] });
  if (i.classLogMissing && i.classLogMissing.count > 0) q.push({ key: "classlog", kind: "classlog", title: `${i.classLogMissing.count} class${i.classLogMissing.count === 1 ? "" : "es"} not logged yet`, subtitle: `${i.classLogMissing.line} · fill in before ${i.classLogMissing.deadline}`, href: "/checkin", cta: "Fill in", chips: ["+1 each", "keeps the allowance"] });
  if (evening && !i.checkinDone) q.push(checkin);
  for (const m of (i.checkinsMissed ?? []).slice(0, 2)) q.push({ key: `checkin-${m.date}`, kind: "checkin", title: `${m.label}'s check-in`, subtitle: "You missed it: fill it in before the week closes", href: `/checkin?date=${m.date}`, cta: "Fill in", chips: ["+5", "streak kept"] });
  q.push(...quizzes);
  if (i.followups) q.push({ key: "followup", kind: "followup", title: `${i.followups} question${i.followups === 1 ? "" : "s"} from your coach`, subtitle: "Something the app noticed: tell the story with the details", href: "/coach/followup", cta: "Answer", chips: ["+2 each", "honest wins"] });
  if (i.dueCheck) q.push({ key: `check-${i.dueCheck.id}`, kind: "check", title: i.dueCheck.title, subtitle: `${i.dueCheck.minutes} min · private`, href: `/coach/check/${i.dueCheck.id}`, cta: "Go", chips: ["+5"] });
  if (!evening && !i.checkinDone) q.push(checkin);
  if (i.hasNotes && !i.recallDone) q.push({ key: "recall", kind: "recall", title: "Recall quiz on today's lessons", subtitle: "Exactly what you took at school today", href: "/learn?tab=me", cta: "Start", chips: ["+5 +1/correct"] });
  if (i.reviewsDue > 0) q.push({ key: "review", kind: "review", title: `${i.reviewsDue} question${i.reviewsDue === 1 ? "" : "s"} to review`, subtitle: "Ones you missed, back at the right time", href: "/review", cta: "Go", chips: ["+5"] });
  for (const c of i.catchup.slice(0, 2)) q.push({ key: `catchup-${c.id}`, kind: "catchup", title: c.title, subtitle: "Catch-up from an earlier day", href: `/quiz/${c.id}`, cta: "Do it", chips: ["points, no day bonus"] });
  for (const sn of (i.snapsDue ?? []).slice(0, 2)) q.push({ key: `snap-${sn.id}`, kind: "snap", title: `${sn.emoji} ${sn.label}`, subtitle: "Snap it to show your win", href: "/snaps", cta: "Snap", chips: ["counts for allowance"] });
  if (!i.learnerDone) q.push({ key: "learner", kind: "learner", title: "Tell your coach about you", subtitle: "10 quick questions, no wrong answers", href: "/me/about-me", cta: "Go", chips: ["+15 once"] });
  if (q.length === 0) q.push({ key: "done", kind: "done", title: "All done for today", subtitle: "Streak safe. Tomorrow's quizzes are ready.", href: "/learn", cta: "Practise anyway", chips: [] });
  return q;
}
