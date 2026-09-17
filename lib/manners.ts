/** Manners: the child rates himself first; the parent confirms. Hints, the gap rule and the week view are pure. */
export const MANNERS_SCALE: { v: number; e: string; label: string }[] = [
  { v: 1, e: "😤", label: "Rough day: shouting or rudeness" },
  { v: 2, e: "😕", label: "A slip or two" },
  { v: 3, e: "😐", label: "Okay, nothing special" },
  { v: 4, e: "🙂", label: "Respectful, helped when asked" },
  { v: 5, e: "😇", label: "Kind and respectful all day, helped without being asked" },
];

export const MANNERS_HINTS: { emoji: string; title: string; look: string }[] = [
  { emoji: "🗣️", title: "Tone", look: "Did he answer without shouting, sarcasm or eye-rolling, even when told no?" },
  { emoji: "👋", title: "Greetings", look: "Salam when he comes in and leaves; thanks after a meal; goodnight." },
  { emoji: "🤝", title: "Helping", look: "Did he help without being asked, or at least without a fight when asked?" },
  { emoji: "📵", title: "Phone at the table", look: "Phone away during meals and while someone is talking to him." },
  { emoji: "👦", title: "Siblings", look: "How he speaks to his brother and sister; sharing; no teasing that hurts." },
  { emoji: "🧕", title: "Helpers and elders", look: "The same respect to the helper, the driver, grandparents." },
  { emoji: "🙊", title: "Honesty", look: "When he did something wrong, did he say so, or did he cover it?" },
  { emoji: "🔁", title: "Repair", look: "After a slip, did he apologise and make it right on his own?" },
];

/** A gap worth a question: he rated himself 4 or 5 while the parent marked ✗ that day. */
export function mannersGap(self: number | null | undefined, parentTick: boolean | undefined): boolean {
  return (self ?? 0) >= 4 && parentTick === false;
}

export interface MannersDay { date: string; self: number | null; note: string | null; parent: boolean | undefined; gap: boolean }

export function mannersWeek(days: string[], checkins: { checkin_date: string; manners_self: number | null; manners_note: string | null }[], ticks: { tick_date: string; code: string; value: boolean }[]): MannersDay[] {
  return days.map((date) => {
    const c = checkins.find((x) => x.checkin_date === date);
    const t = ticks.find((x) => x.tick_date === date && x.code === "manners");
    return { date, self: c?.manners_self ?? null, note: c?.manners_note ?? null, parent: t?.value, gap: mannersGap(c?.manners_self, t?.value) };
  });
}
