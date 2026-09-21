/**
 * A child's prayers over a stretch of days: which of the five he keeps, which he keeps dropping, and whether
 * the pattern is improving.
 *
 * The distinction this module exists to protect: **a prayer with no row is not a missed prayer**. "Missed" is
 * something a child typed — an admission, which the points system deliberately rewards — while silence is the
 * app not knowing. Adding the two together would tell a parent his son missed thirty prayers when in truth he
 * owned up to two and never opened the app on six days, and those call for opposite conversations.
 */
import { PRAYERS, PRAYER_LABEL, type PrayerName, type PrayerStatus } from "@/lib/prayers";
import { shiftDate } from "@/lib/dates";

export interface PrayerLog {
  log_date: string;
  prayer: string;
  status: PrayerStatus | null;
  entered_late?: boolean | null;
  at_mosque?: boolean | null;
}

/** What one prayer on one day amounts to. "none" is silence, and is never counted as "missed". */
export type Cell = PrayerStatus | "none";

export interface DayRow {
  date: string;
  cells: Record<PrayerName, Cell>;
  logged: number;
  onTime: number;
  /** All five logged, whatever the status: he accounted for the whole day. */
  allFive: boolean;
  /** All five on time. */
  allOnTime: boolean;
  mosque: number;
}

export interface PrayerStat {
  prayer: PrayerName;
  label: string;
  onTime: number;
  late: number;
  missed: number;
  notLogged: number;
  mosque: number;
  /** On time as a share of the days in range, so the five are comparable. */
  share: number;
}

export interface History {
  from: string;
  to: string;
  days: DayRow[];
  byPrayer: PrayerStat[];
  totals: { days: number; possible: number; onTime: number; late: number; missed: number; notLogged: number; mosque: number };
  /** The prayer he is on time for least often — what to talk about, if anything. */
  weakest: PrayerStat | null;
  /** Days running, back from the last day, on which all five were logged. */
  streakAllFive: number;
  /** Logged after the fact rather than at the time, and honest admissions. Two different things about character. */
  honesty: { enteredLate: number; ownedMissed: number };
}

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) {
    out.push(d);
    if (out.length > 400) break; // a range nobody meant to ask for
  }
  return out;
}

export function history(logs: PrayerLog[], from: string, to: string): History {
  const dates = datesBetween(from, to);
  const at = new Map<string, PrayerLog>();
  for (const l of logs) if (l.log_date >= from && l.log_date <= to) at.set(`${l.log_date}|${l.prayer}`, l);

  const days: DayRow[] = dates.map((date) => {
    const cells = {} as Record<PrayerName, Cell>;
    let logged = 0;
    let onTime = 0;
    let mosque = 0;
    for (const p of PRAYERS) {
      const row = at.get(`${date}|${p}`);
      cells[p] = row?.status ?? "none";
      if (row) logged += 1;
      if (row?.status === "on_time") onTime += 1;
      if (row?.at_mosque) mosque += 1;
    }
    return { date, cells, logged, onTime, allFive: logged === PRAYERS.length, allOnTime: onTime === PRAYERS.length, mosque };
  });

  const byPrayer: PrayerStat[] = PRAYERS.map((p) => {
    const rows = dates.map((d) => at.get(`${d}|${p}`));
    const count = (s: PrayerStatus) => rows.filter((r) => r?.status === s).length;
    const onTime = count("on_time");
    return {
      prayer: p,
      label: PRAYER_LABEL[p],
      onTime,
      late: count("late"),
      missed: count("missed"),
      notLogged: rows.filter((r) => !r).length,
      mosque: rows.filter((r) => r?.at_mosque).length,
      share: dates.length === 0 ? 0 : onTime / dates.length,
    };
  });

  const sum = (k: keyof Pick<PrayerStat, "onTime" | "late" | "missed" | "notLogged" | "mosque">) =>
    byPrayer.reduce((n, s) => n + s[k], 0);

  // Back from the last day in range: a run that is still going is the one worth naming.
  let streakAllFive = 0;
  for (let i = days.length - 1; i >= 0 && days[i].allFive; i -= 1) streakAllFive += 1;

  const ranked = [...byPrayer].sort((a, b) => a.share - b.share);
  const weakest = ranked[0] && ranked[0].share < 1 ? ranked[0] : null;

  return {
    from,
    to,
    days,
    byPrayer,
    totals: {
      days: dates.length,
      possible: dates.length * PRAYERS.length,
      onTime: sum("onTime"),
      late: sum("late"),
      missed: sum("missed"),
      notLogged: sum("notLogged"),
      mosque: sum("mosque"),
    },
    weakest,
    streakAllFive,
    honesty: {
      enteredLate: logs.filter((l) => l.log_date >= from && l.log_date <= to && l.entered_late).length,
      ownedMissed: sum("missed"),
    },
  };
}

/** One line a parent can act on, or a plain statement that there is nothing to read. */
export function verdict(h: History, firstName: string): string {
  if (h.totals.onTime + h.totals.late + h.totals.missed === 0) {
    return `${firstName} has not logged a single prayer in these ${h.totals.days} days. That is the app knowing nothing, not ${firstName} praying nothing — ask him before you read it either way.`;
  }
  const kept = Math.round((h.totals.onTime / h.totals.possible) * 100);
  const parts = [`${h.totals.onTime} of ${h.totals.possible} on time (${kept}%)`];
  if (h.totals.late > 0) parts.push(`${h.totals.late} late`);
  if (h.totals.missed > 0) parts.push(`${h.totals.missed} he owned up to missing`);
  if (h.totals.notLogged > 0) parts.push(`${h.totals.notLogged} never logged either way`);
  const tail = h.weakest ? ` ${h.weakest.label} is the one to talk about: on time ${h.weakest.onTime} of ${h.totals.days} days.` : "";
  return `${parts.join(" · ")}.${tail}`;
}
