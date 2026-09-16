/**
 * The class-log rule: every class on the timetable gets a line (what was taken) and a homework answer
 * (yes with details, or no). A missed day can be filled in until the end of the allowance week; after that
 * it counts against the week. Pure and testable.
 */
import { shiftDate, weekdayOf } from "./dates";

export const SKIP_SUBJECT = /^(p\.?e\.?|music|art|line|library|advisory|homeroom)$/i;

export interface ClassLogRow {
  log_date: string;
  subject_name: string;
  note: string;
  homework_given: boolean | null;
}

export interface DayCoverage {
  date: string;
  classes: string[]; // subjects that must be logged
  missing: string[]; // not logged, or logged without the homework answer
}

export interface Coverage {
  due: number;
  done: number;
  days: DayCoverage[]; // only days with something missing
  lastMissingDate: string | null;
}

/** A class is complete when it has a note and the homework question was answered. */
export function classComplete(log: ClassLogRow | undefined): boolean {
  return !!log && log.note.trim().length >= 2 && log.homework_given !== null;
}

/** Subjects to log on a date, from the timetable (P.E., art, music and the like are not required). */
export function classesOn(date: string, timetable: { weekday: number; subject_name: string }[], daysOff: string[] = []): string[] {
  if (daysOff.includes(date)) return [];
  const wd = weekdayOf(date);
  return [...new Set(timetable.filter((t) => t.weekday === wd).map((t) => t.subject_name))].filter((n) => !SKIP_SUBJECT.test(n.trim()));
}

/** Coverage of the classes from `start` up to and including `lastDay` (normally today). */
export function classLogCoverage(start: string, lastDay: string, timetable: { weekday: number; subject_name: string }[], logs: ClassLogRow[], daysOff: string[] = []): Coverage {
  let due = 0;
  let done = 0;
  const days: DayCoverage[] = [];
  for (let d = start; d <= lastDay; d = shiftDate(d, 1)) {
    const classes = classesOn(d, timetable, daysOff);
    if (classes.length === 0) continue;
    const missing = classes.filter((c) => !classComplete(logs.find((l) => l.log_date === d && l.subject_name === c)));
    due += classes.length;
    done += classes.length - missing.length;
    if (missing.length) days.push({ date: d, classes, missing });
  }
  return { due, done, days, lastMissingDate: days.length ? days[days.length - 1].date : null };
}

/** The next date after `after` on which this subject is on the timetable (default due date for homework). */
export function nextClassDate(subject: string, timetable: { weekday: number; subject_name: string }[], after: string, daysOff: string[] = []): string {
  for (let k = 1; k <= 14; k += 1) {
    const d = shiftDate(after, k);
    if (classesOn(d, timetable, daysOff).some((s) => s.toLowerCase() === subject.toLowerCase())) return d;
  }
  return shiftDate(after, 1);
}

/** Short human line: "Tue: Math, Science · Wed: Arabic" */
export function missingLine(days: DayCoverage[], max = 3): string {
  return days
    .slice(-max)
    .map((d) => `${new Date(d.date + "T00:00:00Z").toUTCString().slice(0, 3)}: ${d.missing.join(", ")}`)
    .join(" · ") + (days.length > max ? ` · +${days.length - max} more day${days.length - max === 1 ? "" : "s"}` : "");
}
