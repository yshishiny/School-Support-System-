/**
 * Custody days for separated parents. A weekly pattern (weekday -> parent id) plus dated overrides.
 * "Nobody" (null) means both parents share that day or nothing is set. Pure and testable.
 */
import { weekdayOf } from "./dates";

export type CustodyPattern = Record<string, string | null>; // "0".."6" -> parent id
export interface CustodyOverride { day: string; parent_id: string | null; note?: string | null }
export interface ParentLite { id: string; full_name: string; parent_label: string | null }

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Which parent has the kids on a date, or null when shared / unset. */
export function custodianFor(date: string, pattern: CustodyPattern | null | undefined, overrides: CustodyOverride[] = []): string | null {
  const o = overrides.find((x) => x.day === date);
  if (o) return o.parent_id ?? null;
  const p = pattern?.[String(weekdayOf(date))];
  return p ?? null;
}

/** True when a pattern actually assigns at least one day (custody is in use). */
export function custodyInUse(pattern: CustodyPattern | null | undefined, overrides: CustodyOverride[] = []): boolean {
  return Object.values(pattern ?? {}).some((v) => !!v) || overrides.some((o) => !!o.parent_id);
}

/** "Dad" / "Mum" / first name for a parent. */
export function parentName(p: ParentLite | null | undefined): string {
  if (!p) return "both parents";
  return p.parent_label?.trim() || p.full_name.split(" ")[0];
}

/** Whether this parent should be asked the daily taps today. Unset custody: everyone is asked. */
export function askedToday(parentId: string, custodian: string | null): boolean {
  return custodian === null || custodian === parentId;
}
