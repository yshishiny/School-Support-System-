/** Week-summary files: which school week (Sunday to Thursday) a syllabus covers, and whether its own dates make sense. Pure. */
import { shiftDate, weekdayOf } from "@/lib/dates";

export function schoolWeekStart(date: string): string {
  return shiftDate(date, -weekdayOf(date)); // Sunday
}

export interface WeekDecision { coversWeekStart: string; note: string | null; mismatch: boolean }

/**
 * Decide the week a summary covers. The parent's choice wins; otherwise the file's own dates when they fall in this
 * or last week; otherwise this week, with a note that the dates in the file look wrong (a typo at school is common).
 */
export function decideWeek(today: string, parentChoice: "this" | "last" | null, coversFrom: string | null, coversTo: string | null): WeekDecision {
  const thisWeek = schoolWeekStart(today);
  const lastWeek = shiftDate(thisWeek, -7);
  const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  const stated = coversFrom ? `${fmt(coversFrom)}${coversTo && coversTo !== coversFrom ? `–${fmt(coversTo)}` : ""}` : null;
  if (parentChoice) {
    const w = parentChoice === "this" ? thisWeek : lastWeek;
    const fileWeek = coversFrom ? schoolWeekStart(coversFrom) : null;
    const mismatch = !!fileWeek && fileWeek !== w;
    return { coversWeekStart: w, note: mismatch ? `The file says ${stated}, which is not ${parentChoice === "this" ? "this" : "last"} week; kept as ${parentChoice} week as you chose.` : null, mismatch };
  }
  if (coversFrom) {
    const fileWeek = schoolWeekStart(coversFrom);
    if (fileWeek === thisWeek || fileWeek === lastWeek) return { coversWeekStart: fileWeek, note: null, mismatch: false };
    return { coversWeekStart: thisWeek, note: `The file says ${stated}, which is neither this week nor last week (a typo at school?). Treated as this week; change it below if that is wrong.`, mismatch: true };
  }
  return { coversWeekStart: thisWeek, note: "No dates found in the file; treated as this week. Change it below if that is wrong.", mismatch: false };
}
