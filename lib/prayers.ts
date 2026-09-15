import { Coordinates, CalculationMethod, PrayerTimes } from "adhan";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "./learning";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerName = (typeof PRAYERS)[number];
export type PrayerStatus = "on_time" | "late";

export const PRAYER_LABEL: Record<PrayerName, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export const PRAYER_POINTS = {
  ON_TIME: 3,
  LATE: 1,
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
  return status === "on_time" ? PRAYER_POINTS.ON_TIME : PRAYER_POINTS.LATE;
}
