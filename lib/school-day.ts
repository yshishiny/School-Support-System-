/** Is there school today? Weekend, a marked holiday, or a weekday with no lessons in the timetable. Pure. */
import { weekdayOf } from "./dates";

export interface DayOff { day: string; label: string | null }
export interface SchoolDay {
  off: boolean;
  reason: string | null; // "Weekend", "Holiday: …", "No lessons in the timetable"
  lessons: { subject_name: string; start_time: string; end_time: string | null }[];
}

export const WEEKEND = [5, 6]; // Egypt: Friday and Saturday

export function schoolDay(date: string, timetable: { weekday: number; subject_name: string; start_time: string; end_time: string | null }[], daysOff: DayOff[] = []): SchoolDay {
  const holiday = daysOff.find((d) => d.day === date);
  if (holiday) return { off: true, reason: holiday.label ? `Holiday: ${holiday.label}` : "Day off", lessons: [] };
  const wd = weekdayOf(date);
  const lessons = timetable.filter((t) => t.weekday === wd).sort((a, b) => a.start_time.localeCompare(b.start_time)).map((t) => ({ subject_name: t.subject_name, start_time: t.start_time, end_time: t.end_time }));
  if (lessons.length) return { off: false, reason: null, lessons };
  if (WEEKEND.includes(wd)) return { off: true, reason: "Weekend", lessons: [] };
  return { off: true, reason: timetable.length ? "No lessons in the timetable" : "No timetable yet", lessons: [] };
}

/** "8:00 Math · 9:30 English · …" */
export function lessonsLine(lessons: SchoolDay["lessons"], max = 8): string {
  const parts = lessons.slice(0, max).map((l) => `${l.start_time.slice(0, 5)} ${l.subject_name}`);
  return parts.join(" · ") + (lessons.length > max ? ` · +${lessons.length - max}` : "");
}
