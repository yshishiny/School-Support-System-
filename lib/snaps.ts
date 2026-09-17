/**
 * "Show your win": photo tasks for days when no adult is around, plus weekly handwriting samples.
 * Pure helpers: templates, which tasks are due on a date, whether a snap counts, and per-day status.
 */
import { weekdayOf } from "./dates";

export type SnapKind = "photo" | "homework" | "handwriting" | "bag" | "screentime";
export type SnapVerdict = "looks_good" | "unclear" | "not_it" | "people" | "error";
export type SnapStatus = "pending" | "approved" | "rejected";

export interface SnapTask {
  id: string;
  student_id: string | null;
  code: string;
  kind: SnapKind;
  label: string;
  emoji: string;
  prompt: string | null;
  days: number[];
  window_start: string | null; // "HH:MM:SS"
  window_end: string | null;
  weight: number;
  enabled: boolean;
}

export interface SnapLite {
  task_code: string;
  taken_on: string;
  status: SnapStatus;
  ai_verdict: SnapVerdict | null;
}

export interface SnapTemplate {
  code: string;
  kind: SnapKind;
  label: string;
  emoji: string;
  prompt: string;
  days: number[];
  window_start: string | null;
  window_end: string | null;
  weight: number;
  hint: string;
}

const SCHOOL_DAYS = [0, 1, 2, 3, 4];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const SNAP_TEMPLATES: SnapTemplate[] = [
  { code: "bed", kind: "photo", label: "Bed made", emoji: "🛏️", prompt: "A made bed: cover pulled flat, pillow in place, nothing piled on it.", days: ALL_DAYS, window_start: "06:00", window_end: "12:00", weight: 10, hint: "Morning. One picture of the whole bed." },
  { code: "desk", kind: "photo", label: "Desk and drawers tidy", emoji: "🗄️", prompt: "A tidy study desk: surface clear except study things, drawers closed, no clothes or plates.", days: ALL_DAYS, window_start: "16:00", window_end: "23:00", weight: 10, hint: "Evening, after homework." },
  { code: "dish", kind: "photo", label: "Dish cleared and space clean", emoji: "🍽️", prompt: "A cleared eating place: no used plate or cup left, table wiped, or the plate in the sink or dishwasher.", days: ALL_DAYS, window_start: null, window_end: null, weight: 10, hint: "After a meal, when no parent is home." },
  { code: "homework", kind: "homework", label: "Homework page", emoji: "📓", prompt: "A page of today's homework, written by hand, mostly filled in.", days: SCHOOL_DAYS, window_start: "14:00", window_end: "23:59", weight: 15, hint: "One page, readable. The AI checks it matches today's subjects." },
  { code: "handwriting", kind: "handwriting", label: "Handwriting sample", emoji: "✍️", prompt: "Four to six handwritten lines in English or Arabic, on lined paper, photographed straight on.", days: [5], window_start: null, window_end: null, weight: 5, hint: "Once a week. The coach gives feedback and a line to practise." },
  { code: "sandwich", kind: "photo", label: "Sandwich ready for school", emoji: "🥪", prompt: "A prepared sandwich or lunch, wrapped or in a lunch box, ready to take to school.", days: [6, 0, 1, 2, 3, 4], window_start: "18:00", window_end: "07:45", weight: 5, hint: "The night before or in the morning. Part of the morning routine." },
  { code: "bag", kind: "bag", label: "Bag packed for tomorrow", emoji: "🎒", prompt: "An open school bag with the books and notebooks for the next school day visible.", days: [6, 0, 1, 2, 3, 4], window_start: "18:00", window_end: "07:45", weight: 5, hint: "The AI reads the book labels it can see and compares with the next day's timetable." },
  { code: "screentime", kind: "screentime", label: "Screen time screenshot", emoji: "⏱️", prompt: "A screenshot of today's Digital Wellbeing (Android) or Screen Time (iPhone) summary: total time and the top apps.", days: ALL_DAYS, window_start: "19:00", window_end: "23:59", weight: 10, hint: "Every evening. The AI reads the total; over the family limit it becomes a question, not a punishment." },
];

export function templateByCode(code: string): SnapTemplate | undefined {
  return SNAP_TEMPLATES.find((t) => t.code === code);
}

/** Tasks due for a student on a date (family-wide tasks and the ones assigned to him). */
export function dueSnapTasks(date: string, tasks: SnapTask[], studentId: string): SnapTask[] {
  const wd = weekdayOf(date);
  return tasks.filter((t) => t.enabled && (t.student_id === null || t.student_id === studentId) && t.days.includes(wd));
}

/** A snap counts as done when approved, or still pending but the AI found it plausible (benefit of the doubt until reviewed). */
export function snapCounts(s: Pick<SnapLite, "status" | "ai_verdict">): boolean {
  if (s.status === "approved") return true;
  if (s.status === "rejected") return false;
  return s.ai_verdict === "looks_good";
}

/** Whether "now" (HH:MM in the family zone) is inside the task window. No window = always open. */
export function windowOpen(task: Pick<SnapTask, "window_start" | "window_end">, hhmm: string): boolean {
  if (!task.window_start || !task.window_end) return true;
  const a = task.window_start.slice(0, 5);
  const b = task.window_end.slice(0, 5);
  return a <= b ? hhmm >= a && hhmm <= b : hhmm >= a || hhmm <= b;
}

export type DayState = "due" | "sent" | "good" | "approved" | "rejected" | "closed";

/** Status of one task for a child on a day. `closed` = the window passed with nothing sent. */
export function taskDayState(task: SnapTask, snaps: SnapLite[], date: string, hhmm: string): DayState {
  const mine = snaps.filter((s) => s.task_code === task.code && s.taken_on === date);
  const latest = mine[mine.length - 1];
  if (!latest) {
    if (task.window_end && hhmm > task.window_end.slice(0, 5)) return "closed";
    return "due";
  }
  if (latest.status === "approved") return "approved";
  if (latest.status === "rejected") return "rejected";
  return latest.ai_verdict === "looks_good" ? "good" : "sent";
}

/** Days in [start..lastDay] on which the task was due and a counting snap exists. */
export function snapDaysDone(task: SnapTask, snaps: SnapLite[], days: string[]): { due: number; done: number } {
  const dueDays = days.filter((d) => task.days.includes(weekdayOf(d)));
  const done = dueDays.filter((d) => snaps.some((s) => s.task_code === task.code && s.taken_on === d && snapCounts(s))).length;
  return { due: dueDays.length, done };
}

export interface HandwritingAnalysis {
  language: "english" | "arabic" | "mixed" | "unknown";
  legibility: number; // 1..5
  spacing: number;
  letter_formation: number;
  size_consistency: number;
  line_alignment: number;
  strengths: string[];
  focus: string[];
  practice_line: string; // a sentence to copy next time, in the sample's language
  kid_note: string; // two friendly sentences for the child
}

export function handwritingScore(a: Pick<HandwritingAnalysis, "legibility" | "spacing" | "letter_formation" | "size_consistency" | "line_alignment">): number {
  const vals = [a.legibility, a.spacing, a.letter_formation, a.size_consistency, a.line_alignment];
  return Math.round((vals.reduce((s, v) => s + v, 0) / (5 * vals.length)) * 100);
}
