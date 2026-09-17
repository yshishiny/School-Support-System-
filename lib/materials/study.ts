/**
 * What happens to a school file after it is uploaded: three practice sets on a spaced schedule
 * (within 3 days, by day 7, by day 14), counted in the allowance, then a monthly revision per subject. Pure.
 */
import { shiftDate } from "@/lib/dates";

export const STAGES = [
  { n: 1, days: 3, label: "First set" },
  { n: 2, days: 7, label: "Second set" },
  { n: 3, days: 14, label: "Third set" },
] as const;

export interface StageState { n: 1 | 2 | 3; label: string; dueBy: string; state: "done" | "due" | "overdue" | "later" }

/** Stage k is done when at least k sets from this file were submitted by its deadline (any time before counts). */
export function materialStages(uploadedOn: string, attemptDates: string[], today: string): StageState[] {
  const done = [...attemptDates].sort();
  return STAGES.map((s) => {
    const dueBy = shiftDate(uploadedOn, s.days);
    const kth = done[s.n - 1];
    const state: StageState["state"] = kth && kth <= dueBy ? "done" : kth ? "done" : today > dueBy ? "overdue" : today >= shiftDate(dueBy, -3) || s.n === 1 ? "due" : "later";
    return { n: s.n, label: s.label, dueBy, state };
  });
}

/** The next thing to do on a file, for the Today queue and the Learn list. */
export function nextStage(stages: StageState[]): StageState | null {
  return stages.find((s) => s.state === "due" || s.state === "overdue") ?? null;
}

/** Allowance: stages whose deadline falls in [start..lastDay]: due, and done on time. */
export function materialsKpi(materials: { id: string; uploadedOn: string }[], attempts: { materialId: string; date: string }[], start: string, lastDay: string): { due: number; done: number } {
  let due = 0;
  let done = 0;
  for (const m of materials) {
    const dates = attempts.filter((a) => a.materialId === m.id).map((a) => a.date).sort();
    for (const s of STAGES) {
      const dueBy = shiftDate(m.uploadedOn, s.days);
      if (dueBy < start || dueBy > lastDay) continue;
      due += 1;
      if (dates[s.n - 1] && dates[s.n - 1] <= dueBy) done += 1;
    }
  }
  return { due, done };
}

/** Month key (first day) and whether it is revision time (from the 25th). */
export function monthOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}
export function isRevisionTime(date: string): boolean {
  return Number(date.slice(8, 10)) >= 25;
}
