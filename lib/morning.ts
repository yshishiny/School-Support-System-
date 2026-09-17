/**
 * The morning routine: on a school day, before the first lesson, four things earn points and a bonus.
 * Pure helpers; the page and the reminder both use them.
 */
export interface MorningItem { code: "fajr" | "bed" | "sandwich" | "bag" | "ready"; emoji: string; label: string; done: boolean; href: string | null; points: number }

export const MORNING_BONUS = 10;
export const READY_POINTS = 3;

export function morningWindow(hhmm: string, firstLessonStart: string | null): "night" | "morning" | "closed" {
  if (hhmm >= "18:00") return "night";
  const start = firstLessonStart ?? "08:00";
  if (hhmm >= "04:30" && hhmm < start) return "morning";
  return "closed";
}

export function buildMorning(i: { fajrLogged: boolean; bedDone: boolean; sandwichDone: boolean; bagDone: boolean; ready: boolean; hasSandwichTask: boolean; hasBagTask: boolean; hasBedTask: boolean }): MorningItem[] {
  const items: MorningItem[] = [{ code: "fajr", emoji: "🕌", label: "Fajr prayed", done: i.fajrLogged, href: "/today", points: 3 }];
  if (i.hasBedTask) items.push({ code: "bed", emoji: "🛏️", label: "Bed made (snap)", done: i.bedDone, href: "/snaps", points: 2 });
  if (i.hasSandwichTask) items.push({ code: "sandwich", emoji: "🥪", label: "Sandwich ready (snap)", done: i.sandwichDone, href: "/snaps", points: 2 });
  if (i.hasBagTask) items.push({ code: "bag", emoji: "🎒", label: "Bag packed (snap)", done: i.bagDone, href: "/snaps", points: 2 });
  items.push({ code: "ready", emoji: "🚀", label: "Dressed, breakfast done, leaving on time", done: i.ready, href: null, points: READY_POINTS });
  return items;
}

/** Champion when every item is done, in the morning window, before the first lesson. */
export function isChampion(items: MorningItem[]): boolean {
  return items.length >= 3 && items.every((x) => x.done);
}
