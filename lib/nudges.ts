/**
 * Reminders for the kids. Pure: given the hour and the day's state, which messages are due and what they say.
 * Short, warm, never nagging: at most three a day, and nothing once the job is done.
 */
export type NudgeCode = "wakeup" | "morning" | "evening" | "lastcall" | "catchup";

export interface NudgeSettings { wakeup?: boolean; wakeHour?: number; morning: boolean; evening: boolean; lastcall: boolean; prayers: boolean }
export const DEFAULT_NUDGES: NudgeSettings = { wakeup: true, wakeHour: 6, morning: true, evening: true, lastcall: true, prayers: false };

export interface NudgeState {
  firstName: string;
  hourLocal: number;
  weekday: number; // 0 = Sunday
  schoolOff: boolean;
  lessons: { subject_name: string; start_time: string }[];
  checkinDone: boolean;
  streak: number;
  quizzesToday: number;
  quizzesDone: number;
  classesToLog: number; // today's classes not logged yet (0 before school ends)
  snapsOpen: string[]; // snap tasks whose window is open and not sent
  missedCheckins: number; // earlier days this week
  missedClasses: number; // earlier days this week
  weekClosesLabel: string; // "Thursday"
  appUrl: string;
  allowanceHint?: string | null; // the most valuable missing basic, from the allowance meter
  morningTodo?: string[]; // the routine items still to do (fajr, bed, sandwich, bag)
}

export interface Nudge { code: NudgeCode; text: string }

const WINDOWS: Record<NudgeCode, [number, number]> = { wakeup: [5, 8], morning: [6, 9], evening: [19, 21], lastcall: [21, 23], catchup: [17, 21] };

/** Which nudges fall in this hour. Each is sent at most once a day by the caller. */
export function dueNudges(s: NudgeState, settings: NudgeSettings, alreadySent: string[]): Nudge[] {
  const out: Nudge[] = [];
  const inWindow = (c: NudgeCode) => s.hourLocal >= WINDOWS[c][0] && s.hourLocal < WINDOWS[c][1];
  const sent = (c: NudgeCode) => alreadySent.includes(c);

  // Wake-up at the family's hour on a school day: the routine, and what it pays.
  if (settings.wakeup !== false && !s.schoolOff && s.hourLocal === (settings.wakeHour ?? 6) && !sent("wakeup")) {
    const first = s.lessons[0];
    const todo = s.morningTodo?.length ? s.morningTodo.join(", ") : "Fajr, bed, sandwich, bag";
    out.push({ code: "wakeup", text: `⏰ Wake up, ${s.firstName}!${first ? ` First lesson ${first.subject_name} at ${first.start_time.slice(0, 5)}.` : ""} Before you leave: ${todo}, then tap “I'm ready” = points and the +10 morning champion bonus. ${s.appUrl}` });
  }

  if (settings.morning && inWindow("morning") && !sent("morning") && !s.schoolOff) {
    const first = s.lessons[0];
    const parts = [`${s.lessons.length} class${s.lessons.length === 1 ? "" : "es"}${first ? ` (first ${first.subject_name} at ${first.start_time.slice(0, 5)})` : ""}`];
    if (s.quizzesToday) parts.push(`${s.quizzesToday} quiz set${s.quizzesToday === 1 ? "" : "s"} planned`);
    if (s.snapsOpen.length) parts.push(`snap: ${s.snapsOpen.join(", ")}`);
    out.push({ code: "morning", text: `☀️ Salam ${s.firstName}! Today: ${parts.join(" · ")}. Log each class after school and check in tonight. ${s.appUrl}` });
  }

  if (settings.evening && inWindow("evening") && !sent("evening") && !s.checkinDone) {
    const todo: string[] = ["your check-in (+10)"];
    if (s.classesToLog) todo.push(`${s.classesToLog} class${s.classesToLog === 1 ? "" : "es"} to log`);
    if (s.quizzesToday > s.quizzesDone) todo.push(`${s.quizzesToday - s.quizzesDone} quiz set${s.quizzesToday - s.quizzesDone === 1 ? "" : "s"}`);
    if (s.snapsOpen.length) todo.push(`snap ${s.snapsOpen.join(" and ")}`);
    out.push({ code: "evening", text: `🌙 ${s.firstName}, evening round: ${todo.join(" · ")}.${s.streak ? ` Streak ${s.streak}🔥 stays alive with the check-in.` : ""}${s.allowanceHint ? ` Allowance priority: ${s.allowanceHint}.` : ""} ${s.appUrl}` });
  }

  if (settings.lastcall && inWindow("lastcall") && !sent("lastcall") && !s.checkinDone) {
    out.push({ code: "lastcall", text: `⏰ Last call, ${s.firstName}: two minutes for tonight's check-in before bed${s.streak ? ` and the ${s.streak}-day streak is safe` : ""}. ${s.appUrl}` });
  }

  // The day before the week closes: whatever is still missing.
  if (settings.evening && inWindow("catchup") && !sent("catchup") && (s.missedCheckins || s.missedClasses)) {
    const parts: string[] = [];
    if (s.missedCheckins) parts.push(`${s.missedCheckins} check-in${s.missedCheckins === 1 ? "" : "s"}`);
    if (s.missedClasses) parts.push(`${s.missedClasses} class${s.missedClasses === 1 ? "" : "es"} to log`);
    out.push({ code: "catchup", text: `📖 ${s.firstName}, the week closes ${s.weekClosesLabel}: ${parts.join(" and ")} still missing from earlier days. Fill them in tonight so the allowance stays whole. ${s.appUrl}` });
  }
  return out;
}

/** Only the day before pay day gets the catch-up nudge. */
export function isCatchupDay(weekday: number, payWeekday: number): boolean {
  return (weekday + 1) % 7 === payWeekday;
}
