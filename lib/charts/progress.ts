/**
 * One child's week-by-week series, from the rows the app already keeps.
 *
 * Every series shares one x-axis — the same last N weeks — so the four charts can be read together as small
 * multiples rather than as four unrelated pictures.
 *
 * The distinction carried through all of them: **null is "nothing to measure", 0 is "measured, and it was
 * nothing"**. A week with no quiz in it is not a week he scored nothing, and drawing it as zero would be the
 * same lie the allowance score used to tell in the other direction. Nulls become gaps; zeros become bars.
 */
import { shiftDate } from "@/lib/dates";

export interface WeekPoint {
  start: string;
  /** "12 Sep" — short enough for an axis. */
  label: string;
  value: number | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function weekLabel(start: string): string {
  const d = new Date(`${start}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The last `n` week-starts, oldest first, counting back from the week running now. */
export function weeksBack(currentStart: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDate(currentStart, -7 * (n - 1 - i)));
}

const shell = (starts: string[]): WeekPoint[] => starts.map((start) => ({ start, label: weekLabel(start), value: null }));
const weekOf = (starts: string[], date: string): number =>
  starts.findIndex((s, i) => date >= s && (i === starts.length - 1 || date < starts[i + 1]));

/** The score each closed week ended on. A week never closed is a gap, not a nought. */
export function weeklyScore(weeks: { week_start: string; score: number }[], starts: string[]): WeekPoint[] {
  const out = shell(starts);
  for (const w of weeks) {
    const i = starts.indexOf(w.week_start);
    if (i >= 0) out[i].value = w.score;
  }
  return out;
}

/** Points earned in each week. Zero is a real answer here: the week happened and he earned nothing in it. */
export function weeklyPoints(entries: { created_at: string; delta: number }[], starts: string[], today: string): WeekPoint[] {
  const out = shell(starts);
  starts.forEach((s, i) => { if (s <= today) out[i].value = 0; });
  for (const e of entries) {
    const i = weekOf(starts, e.created_at.slice(0, 10));
    if (i >= 0 && e.delta > 0 && out[i].value !== null) out[i].value = (out[i].value as number) + e.delta;
  }
  return out;
}

/** Share of questions he got right, per week. A week with no attempt is a gap: there is nothing to be right about. */
export function weeklyAccuracy(attempts: { submitted_at: string | null; score: number | null; total: number | null }[], starts: string[]): WeekPoint[] {
  const out = shell(starts);
  const got = starts.map(() => ({ score: 0, total: 0 }));
  for (const a of attempts) {
    if (!a.submitted_at || a.score === null || a.total === null || a.total <= 0) continue;
    const i = weekOf(starts, a.submitted_at.slice(0, 10));
    if (i < 0) continue;
    got[i].score += a.score;
    got[i].total += a.total;
  }
  got.forEach((g, i) => { if (g.total > 0) out[i].value = Math.round((g.score / g.total) * 100); });
  return out;
}

/** Days in each week with four or more prayers logged. Zero is measured: the days passed and none was kept. */
export function weeklyPrayers(logs: { log_date: string; status: string | null }[], starts: string[], today: string): WeekPoint[] {
  const out = shell(starts);
  const perDay = new Map<string, number>();
  for (const l of logs) {
    if (l.status !== "on_time" && l.status !== "late") continue;
    perDay.set(l.log_date, (perDay.get(l.log_date) ?? 0) + 1);
  }
  starts.forEach((s, i) => {
    if (s > today) return;
    let kept = 0;
    for (let k = 0; k < 7; k += 1) {
      const d = shiftDate(s, k);
      if (d > today) break;
      if ((perDay.get(d) ?? 0) >= 4) kept += 1;
    }
    out[i].value = kept;
  });
  return out;
}

/** Whether a series has anything in it at all, so a chart of nothing can say so instead of drawing an empty box. */
export function hasData(points: WeekPoint[]): boolean {
  return points.some((p) => p.value !== null);
}
