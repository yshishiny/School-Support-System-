import { formatInTimeZone } from "date-fns-tz";
import { addDays, parseISO } from "date-fns";

/** Today's date (YYYY-MM-DD) in the family's timezone. */
export function todayIn(tz: string, now: Date = new Date()): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

export function hourIn(tz: string, now: Date = new Date()): number {
  return Number(formatInTimeZone(now, tz, "H"));
}

export function shiftDate(isoDate: string, days: number): string {
  return formatInTimeZone(addDays(parseISO(isoDate), days), "UTC", "yyyy-MM-dd");
}

export function weekdayOf(isoDate: string): number {
  // 0 = Sunday, matching Postgres/JS conventions used in timetable_entries
  return parseISO(isoDate + "T00:00:00Z").getUTCDay();
}

export function prettyDate(isoDate: string): string {
  return formatInTimeZone(parseISO(isoDate + "T00:00:00Z"), "UTC", "EEE d MMM");
}

/** Human label relative to today: Today / Tomorrow / Overdue (n days) / in n days. */
export function relativeLabel(isoDate: string | null, today: string): string {
  if (!isoDate) return "No date";
  const diff = Math.round(
    (parseISO(isoDate + "T00:00:00Z").getTime() - parseISO(today + "T00:00:00Z").getTime()) / 86400000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `Overdue ${-diff}d`;
  return `In ${diff} days`;
}
