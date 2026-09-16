import { Coordinates, CalculationMethod, PrayerTimes } from "adhan";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "./learning";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerName = (typeof PRAYERS)[number];
export type PrayerStatus = "on_time" | "late" | "missed";

export const PRAYER_LABEL: Record<PrayerName, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export const PRAYER_POINTS = {
  ON_TIME: 3,
  ON_TIME_LATER: 2, // said "on time" after the window, outside school hours
  LATE: 1,
  MISSED_HONEST: 1, // saying "I missed it" still counts for honesty
  ALL_ON_TIME_BONUS: 10,
} as const;

export interface PrayerWindow {
  prayer: PrayerName;
  start: Date; // adhan time
  end: Date; // praying before this counts as on time
}

/** Prayer windows for a local date (YYYY-MM-DD). Egyptian General Authority method. */
export function prayerWindows(isoDate: string, lat: number, lng: number): PrayerWindow[] {
  const params = CalculationMethod.Egyptian();
  const coords = new Coordinates(lat, lng);
  const today = new PrayerTimes(coords, new Date(isoDate + "T12:00:00Z"), params);
  const tomorrow = new PrayerTimes(coords, new Date(addDays(isoDate, 1) + "T12:00:00Z"), params);
  return [
    { prayer: "fajr", start: today.fajr, end: today.sunrise },
    { prayer: "dhuhr", start: today.dhuhr, end: today.asr },
    { prayer: "asr", start: today.asr, end: today.maghrib },
    { prayer: "maghrib", start: today.maghrib, end: today.isha },
    { prayer: "isha", start: today.isha, end: tomorrow.fajr },
  ];
}

export type PrayerState = "not_yet" | "open" | "late_only";

/** What logging a prayer now would mean. */
export function prayerState(w: PrayerWindow, now: Date): PrayerState {
  if (now < w.start) return "not_yet";
  if (now < w.end) return "open";
  return "late_only";
}

/**
 * Which local date a prayer log at `now` belongs to. Isha prayed after midnight
 * still belongs to the previous day, as long as it is before that night's Fajr.
 */
export function prayerLogDate(prayer: PrayerName, now: Date, tz: string, lat: number, lng: number): string {
  const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
  if (prayer !== "isha") return today;
  const yesterday = addDays(today, -1);
  const yIsha = prayerWindows(yesterday, lat, lng)[4];
  return now >= yIsha.start && now < yIsha.end ? yesterday : today;
}

export function formatPrayerTime(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "HH:mm");
}

/** Points for a single prayer log and the all-five bonus. */
export function prayerPoints(status: PrayerStatus): number {
  return status === "on_time" ? PRAYER_POINTS.ON_TIME : status === "late" ? PRAYER_POINTS.LATE : 0;
}

/** School hours on a date from the timetable ("HH:MM" strings), or null on a day with no lessons. */
export function schoolSpan(date: string, timetable: { weekday: number; start_time: string; end_time: string | null }[]): { start: string; end: string } | null {
  const wd = new Date(date + "T00:00:00Z").getUTCDay();
  const rows = timetable.filter((t) => t.weekday === wd);
  if (rows.length === 0) return null;
  const starts = rows.map((r) => r.start_time.slice(0, 5)).sort();
  const ends = rows.map((r) => (r.end_time ?? r.start_time).slice(0, 5)).sort();
  return { start: starts[0], end: ends[ends.length - 1] };
}

/** True when the prayer's window overlaps school hours (a prayer prayed at school cannot be logged at the time). */
export function windowAtSchool(w: PrayerWindow, span: { start: string; end: string } | null, tz: string): boolean {
  if (!span) return false;
  const a = formatInTimeZone(w.start, tz, "HH:mm");
  const b = formatInTimeZone(w.end, tz, "HH:mm");
  // Overlap of [a, b) with [school start, school end + 45 min]
  const endPlus = ((h: string) => { const [hh, mm] = h.split(":").map(Number); const t = hh * 60 + mm + 45; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; })(span.end);
  return a < endPlus && b > span.start;
}

export type PastClaim = "on_time" | "late" | "missed";

/** Points for a prayer reported after its window, said honestly. */
export function pastPrayerPoints(claim: PastClaim, atSchool: boolean): number {
  if (claim === "on_time") return atSchool ? PRAYER_POINTS.ON_TIME : PRAYER_POINTS.ON_TIME_LATER;
  if (claim === "late") return PRAYER_POINTS.LATE;
  return PRAYER_POINTS.MISSED_HONEST;
}
