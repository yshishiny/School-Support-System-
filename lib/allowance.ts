/**
 * Weekly allowance earned through the basics. Pure functions: KPI definitions, week boundaries,
 * scoring with graded bands, and the mid-week projection the child sees.
 */
import { shiftDate, weekdayOf } from "./dates";

export type KpiSource = "parent" | "app" | "snap";
export interface KpiDef {
  code: string;
  label: string;
  emoji: string;
  source: KpiSource;
  weight: number;
  enabled: boolean;
  hint: string;
  days?: number[]; // snap tasks: weekdays the task is due
}

export const DEFAULT_KPIS: KpiDef[] = [
  { code: "dish", label: "Cleared his dish and his space", emoji: "🍽️", source: "parent", weight: 20, enabled: true, hint: "One tap a day. Only an explicit ✗ counts against him." },
  { code: "manners", label: "Manners: respectful, no shouting", emoji: "🤝", source: "parent", weight: 20, enabled: true, hint: "With mother, siblings, helpers. One tap a day." },
  { code: "prayers", label: "Prayers logged, 4 of 5 most days", emoji: "🕌", source: "app", weight: 15, enabled: true, hint: "Counted from the prayer pill." },
  { code: "checkins", label: "Check-in done 5 of 7 days", emoji: "✅", source: "app", weight: 15, enabled: true, hint: "Counted automatically." },
  { code: "classlog", label: "Every class logged: what he took, homework yes/no", emoji: "📖", source: "app", weight: 15, enabled: true, hint: "Per the timetable. A missed day can be filled in until the week closes; after that it counts against him." },
  { code: "checkpoint", label: "Weekly checkpoint attempted", emoji: "🎯", source: "app", weight: 10, enabled: true, hint: "The timed test on what he logged this week. Attempting it is the KPI; the score positions him." },
  { code: "homework", label: "Homework done by its due date", emoji: "📝", source: "app", weight: 10, enabled: true, hint: "Homework and projects due this week, marked done in the check-in on time." },
  { code: "grades", label: "Monthly grades sheet uploaded", emoji: "📊", source: "app", weight: 5, enabled: true, hint: "A photo of the school's grades sheet each month, from the 21st onward. The AI writes an appraisal." },
  { code: "quizzes", label: "Attempted 60% of the week's planned quizzes", emoji: "📅", source: "app", weight: 15, enabled: true, hint: "Attempts, never scores." },
  { code: "phone", label: "Phone parked by the agreed hour", emoji: "📵", source: "parent", weight: 10, enabled: true, hint: "One tap a day." },
  { code: "wellbeing", label: "Did the coach check-in when it was due", emoji: "💓", source: "app", weight: 5, enabled: true, hint: "Weekly pulse or monthly check." },
];

export type KpiOverride = { code: string; weight?: number; enabled?: boolean };

/** Snap tasks become KPIs too (code "snap:<task code>"), so "show your win" pays into the same score. */
export interface SnapKpiInput { code: string; label: string; emoji: string; weight: number; enabled: boolean; days: number[]; kind: string }

export function mergeKpis(overrides: KpiOverride[] | null | undefined, snapTasks: SnapKpiInput[] = []): KpiDef[] {
  const map = new Map((overrides ?? []).map((o) => [o.code, o]));
  const base = DEFAULT_KPIS.map((k) => {
    const o = map.get(k.code);
    return o ? { ...k, weight: o.weight ?? k.weight, enabled: o.enabled ?? k.enabled } : k;
  });
  const snaps = snapTasks.map<KpiDef>((t) => ({ code: `snap:${t.code}`, label: `Snap: ${t.label}`, emoji: t.emoji, source: "snap", weight: t.weight, enabled: t.enabled, days: t.days, hint: t.kind === "handwriting" ? "One sample on its day." : "A picture on each due day; the AI screens, you approve." }));
  return [...base, ...snaps];
}

/** The allowance week ends on pay day and starts the day after the previous pay day. */
export function weekFor(date: string, payWeekday: number): { start: string; end: string } {
  const wd = weekdayOf(date);
  const daysUntilPay = (payWeekday - wd + 7) % 7;
  const end = shiftDate(date, daysUntilPay);
  return { start: shiftDate(end, -6), end };
}

export type Band = "full" | "most" | "some" | "none";
export const BANDS: { band: Band; min: number; share: number; label: string }[] = [
  { band: "full", min: 90, share: 1, label: "Full allowance" },
  { band: "most", min: 70, share: 0.7, label: "Most of it" },
  { band: "some", min: 50, share: 0.4, label: "Some of it" },
  { band: "none", min: 0, share: 0, label: "Not this week" },
];

export function bandFor(score: number): (typeof BANDS)[number] {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

export interface WeekInput {
  kpis: KpiDef[];
  start: string;
  end: string;
  today: string; // for projection; days after today are "still earnable"
  ticks: { tick_date: string; code: string; value: boolean }[]; // parent's daily taps
  prayerDays: Record<string, number>; // date -> prayers logged that day
  checkinDates: string[];
  plannedTotal: number; // planned quizzes scheduled in the week up to today
  plannedAttempted: number;
  wellbeingDue: boolean; // was something due in the week
  wellbeingDone: boolean;
  snapDays?: Record<string, string[]>; // "snap:<code>" -> dates with a counting snap
  classLog?: { due: number; done: number; missingLine: string | null }; // timetable classes in the week so far
  checkpoint?: { status: "none" | "ready" | "done" | "expired" | "failed" };
  homework?: { due: number; doneOnTime: number; open: number }; // due in the week up to today
  gradesSheet?: { uploaded: boolean; dayOfMonth: number };
}

export interface KpiResult {
  code: string;
  label: string;
  emoji: string;
  weight: number;
  fraction: number; // 0..1 so far
  earned: number; // weight × fraction
  detail: string;
}

export interface WeekResult {
  score: number; // 0-100 projected on elapsed days
  band: Band;
  results: KpiResult[];
  elapsedDays: number;
  totalDays: number;
  maxScore: number; // best score still reachable if every remaining day is perfect
  bestBand: Band; // the band that maxScore reaches
  hints: string[]; // what to do to stay eligible, most valuable first
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/** Scores the week on the days elapsed so far. Parent KPIs give the benefit of the doubt: only an explicit ✗ counts. */
export function scoreWeek(i: WeekInput): WeekResult {
  const totalDays = 7;
  const lastDay = i.today < i.end ? i.today : i.end;
  const elapsedDays = Math.max(1, Math.min(7, daysBetween(i.start, lastDay) + 1));
  const days: string[] = Array.from({ length: elapsedDays }, (_, k) => shiftDate(i.start, k));
  const active = i.kpis.filter((k) => k.enabled && k.weight > 0);
  const totalWeight = active.reduce((s, k) => s + k.weight, 0) || 1;

  const remaining = totalDays - elapsedDays;
  const maxByCode = new Map<string, number>();
  const hintByCode = new Map<string, string>();
  const results: KpiResult[] = active.map((k) => {
    let fraction = 1;
    let detail = "";
    let maxFraction = 1;
    if (k.source === "parent") {
      const bad = i.ticks.filter((t) => t.code === k.code && !t.value && days.includes(t.tick_date)).length;
      fraction = Math.max(0, 1 - bad / elapsedDays);
      maxFraction = Math.max(0, 1 - bad / totalDays);
      detail = bad ? `${bad} day${bad === 1 ? "" : "s"} marked ✗` : "no ✗ so far";
      if (bad) hintByCode.set(k.code, `No more ✗ on “${k.label.toLowerCase()}”`);
    } else if (k.code === "prayers") {
      const good = days.filter((d) => (i.prayerDays[d] ?? 0) >= 4).length;
      const target = Math.max(1, Math.round(elapsedDays * (5 / 7)));
      fraction = Math.min(1, good / target);
      maxFraction = Math.min(1, (good + remaining) / 5);
      detail = `${good} of ${elapsedDays} days with 4+ prayers`;
      if (fraction < 1) hintByCode.set(k.code, "Log at least 4 prayers today");
    } else if (k.code === "checkins") {
      const done = i.checkinDates.filter((d) => days.includes(d)).length;
      const target = Math.max(1, Math.round(elapsedDays * (5 / 7)));
      fraction = Math.min(1, done / target);
      maxFraction = Math.min(1, (done + remaining) / 5);
      detail = `${done} check-in${done === 1 ? "" : "s"} in ${elapsedDays} days`;
      if (fraction < 1) hintByCode.set(k.code, "Do tonight's check-in");
    } else if (k.code === "quizzes") {
      if (i.plannedTotal === 0) {
        fraction = 1;
        detail = "no planned quizzes yet";
      } else {
        fraction = Math.min(1, i.plannedAttempted / i.plannedTotal / 0.6);
        maxFraction = 1; // missed sets stay open as catch-up
        detail = `${i.plannedAttempted} of ${i.plannedTotal} attempted`;
        if (fraction < 1) hintByCode.set(k.code, "Attempt today's planned quiz (catch-up counts)");
      }
    } else if (k.code === "classlog") {
      const c = i.classLog ?? { due: 0, done: 0, missingLine: null };
      fraction = c.due === 0 ? 1 : c.done / c.due;
      maxFraction = 1; // catch-up is allowed until the week closes
      detail = c.due === 0 ? "no classes yet this week" : `${c.done} of ${c.due} classes logged`;
      if (fraction < 1) hintByCode.set(k.code, `Fill in ${c.due - c.done} class${c.due - c.done === 1 ? "" : "es"} in the check-in${c.missingLine ? ` (${c.missingLine})` : ""}`);
    } else if (k.code === "homework") {
      const h = i.homework ?? { due: 0, doneOnTime: 0, open: 0 };
      fraction = h.due === 0 ? 1 : h.doneOnTime / h.due;
      maxFraction = 1;
      detail = h.due === 0 ? "nothing due yet" : `${h.doneOnTime} of ${h.due} done on time${h.open ? ` · ${h.open} still open` : ""}`;
      if (h.open) hintByCode.set(k.code, `Finish ${h.open} open homework${h.open === 1 ? "" : "s"} and mark ${h.open === 1 ? "it" : "them"} done in the check-in`);
    } else if (k.code === "grades") {
      const g = i.gradesSheet ?? { uploaded: false, dayOfMonth: 1 };
      fraction = g.uploaded || g.dayOfMonth < 21 ? 1 : 0;
      maxFraction = 1;
      detail = g.uploaded ? "this month's sheet is in" : g.dayOfMonth < 21 ? "due from the 21st" : "not uploaded yet this month";
      if (fraction < 1) hintByCode.set(k.code, "Upload a photo of this month's grades sheet (Me → Grades)");
    } else if (k.code === "checkpoint") {
      const st = i.checkpoint?.status ?? "none";
      fraction = st === "expired" ? 0 : 1; // benefit of the doubt until it is due
      maxFraction = st === "expired" ? 0 : 1;
      detail = st === "done" ? "done" : st === "ready" ? "ready, not attempted yet" : st === "expired" ? "not attempted before the week closed" : st === "failed" ? "could not be prepared (does not count)" : "none this week";
      if (st === "ready") hintByCode.set(k.code, "Do the weekly checkpoint (20 min, one attempt)");
    } else if (k.source === "snap") {
      const dueDays = days.filter((d) => (k.days ?? [0, 1, 2, 3, 4, 5, 6]).includes(weekdayOf(d)));
      const doneDays = (i.snapDays?.[k.code] ?? []).filter((d) => dueDays.includes(d)).length;
      const remainingDue = Array.from({ length: remaining }, (_, n) => shiftDate(lastDay, n + 1)).filter((d) => (k.days ?? [0, 1, 2, 3, 4, 5, 6]).includes(weekdayOf(d))).length;
      if (dueDays.length === 0) {
        fraction = 1;
        maxFraction = 1;
        detail = remainingDue ? "not due yet this week" : "not due this week";
      } else {
        fraction = doneDays / dueDays.length;
        maxFraction = (doneDays + remainingDue) / (dueDays.length + remainingDue);
        detail = `${doneDays} of ${dueDays.length} day${dueDays.length === 1 ? "" : "s"} snapped`;
        if (fraction < 1 && (k.days ?? [0, 1, 2, 3, 4, 5, 6]).includes(weekdayOf(lastDay)) && !(i.snapDays?.[k.code] ?? []).includes(lastDay)) hintByCode.set(k.code, `Snap “${k.label.replace(/^Snap: /, "").toLowerCase()}” today`);
      }
    } else if (k.code === "wellbeing") {
      fraction = i.wellbeingDue && !i.wellbeingDone ? 0 : 1;
      maxFraction = 1;
      detail = i.wellbeingDue ? (i.wellbeingDone ? "done" : "due, not done yet") : "nothing due";
      if (fraction < 1) hintByCode.set(k.code, "Do the coach check-in (2 minutes)");
    }
    maxByCode.set(k.code, k.weight * maxFraction);
    return { code: k.code, label: k.label, emoji: k.emoji, weight: k.weight, fraction, earned: Math.round(k.weight * fraction * 10) / 10, detail };
  });
  const score = Math.round((results.reduce((s, r) => s + r.earned, 0) / totalWeight) * 100);
  const maxScore = Math.round(([...maxByCode.values()].reduce((s, v) => s + v, 0) / totalWeight) * 100);
  // Hints ordered by how much each KPI is still worth.
  const hints = active
    .filter((k) => hintByCode.has(k.code))
    .sort((a, b) => b.weight - a.weight)
    .map((k) => hintByCode.get(k.code)!);
  return { score, band: bandFor(score).band, results, elapsedDays, totalDays, maxScore, bestBand: bandFor(maxScore).band, hints };
}

export function amountFor(score: number, allowance: number): number {
  return Math.round(allowance * bandFor(score).share);
}

/** Consequences a parent can enable. Never schoolwork. Each has a way back. */
export interface PracticeDef {
  code: string;
  label: string;
  emoji: string;
  description: string;
  days: number;
  earnBack: string;
}

export const PRACTICES: PracticeDef[] = [
  { code: "classlog_gap", label: "Class log left unfinished", emoji: "📖", description: "Assigned automatically when the week closes with classes never logged: no screens after 8pm until every class is filled in.", days: 3, earnBack: "Fill in every missing class in the check-in, then tell a parent." },
  { code: "make_it_right", label: "Make it right", emoji: "🧽", description: "Skipped his dish: he does the whole family's dishes tonight. Rude: he repairs it in person.", days: 1, earnBack: "Do the repair and tell a parent." },
  { code: "phone_early", label: "Phone parked early", emoji: "📵", description: "Phone goes to the kitchen at 8pm instead of the usual hour.", days: 3, earnBack: "One clean day (dish, manners, check-in) restores one night." },
  { code: "screen_cut", label: "Screen time minus 30 min", emoji: "⏳", description: "Thirty minutes less screen time each day, never a full ban.", days: 3, earnBack: "A full check-in with class notes two days in a row." },
  { code: "match_blackout", label: "No match this weekend", emoji: "📺", description: "No streaming of the weekend's match. For the bigger things.", days: 3, earnBack: "Not earned back; it passes." },
  { code: "kpi_zero", label: "One KPI zeroed this week", emoji: "📉", description: "A named basic counts as zero for this week's allowance.", days: 7, earnBack: "A named task restores half of it by Sunday." },
  { code: "reflection", label: "Five-minute reflection", emoji: "🪞", description: "Talk to the coach in the app: what happened, what he would do differently, what he needs.", days: 1, earnBack: "Done when the reflection is written." },
  { code: "extra_chore", label: "Extra chore", emoji: "🧹", description: "One chore of a parent's choice, that day.", days: 1, earnBack: "Done when the chore is done and checked." },
  { code: "early_bed", label: "Early bedtime", emoji: "🌙", description: "Lights out one hour earlier for two nights.", days: 2, earnBack: "Not earned back; it passes." },
];

export function practiceByCode(code: string): PracticeDef | undefined {
  return PRACTICES.find((p) => p.code === code);
}

/** One sentence about eligibility, for the child: where he stands and what is still reachable. */
export function eligibilityHint(r: WeekResult, allowance: number): { tone: "good" | "warn" | "bad"; text: string } {
  const now = bandFor(r.score);
  const best = bandFor(r.maxScore);
  const nowEgp = Math.round(allowance * now.share);
  const bestEgp = Math.round(allowance * best.share);
  if (now.band === "full") return { tone: "good", text: `On track for the full ${allowance} EGP. Keep every basic ✓ and it is yours.` };
  if (best.band === "full") return { tone: "warn", text: `Heading for ${nowEgp} EGP, but the full ${allowance} is still reachable this week if the rest of the week is clean.` };
  if (best.band === "none") return { tone: "bad", text: `This week's allowance is gone. Next week starts fresh; a clean week pays the full ${allowance}.` };
  return { tone: "warn", text: `Heading for ${nowEgp} EGP. The best you can still reach this week is ${bestEgp} EGP (${best.label.toLowerCase()}).` };
}

/** Where in the app a basic is fixed, so the child's allowance page can send him straight there. */
export const KPI_ROUTE: Record<string, { href: string; cta: string }> = {
  prayers: { href: "/today", cta: "Log prayers" },
  checkins: { href: "/checkin", cta: "Check in" },
  classlog: { href: "/checkin", cta: "Fill in classes" },
  quizzes: { href: "/learn?tab=me", cta: "Do a quiz" },
  checkpoint: { href: "/today", cta: "Open checkpoint" },
  homework: { href: "/checkin", cta: "Mark homework" },
  grades: { href: "/me", cta: "Upload sheet" },
  wellbeing: { href: "/coach", cta: "Coach check-in" },
};
export function kpiRoute(code: string): { href: string; cta: string } | null {
  if (code.startsWith("snap:")) return { href: "/snaps", cta: "Snap it" };
  return KPI_ROUTE[code] ?? null;
}

export interface PlanItem {
  code: string;
  emoji: string;
  label: string;
  detail: string;
  atStake: number;     // points still missing on this basic (weight - earned)
  recoverable: boolean; // can the missing part still be earned this week
  how: string;          // what to do, in the child's words
  href: string | null;
  cta: string | null;
}

/**
 * The child's plan for the rest of the week: every basic that is not full, most valuable first, with what to do and
 * whether it can still be recovered. Parent-judged basics can only be protected (no more ✗), never caught up.
 */
export function allowancePlan(r: WeekResult): { todo: PlanItem[]; protect: PlanItem[]; lost: PlanItem[] } {
  const items: PlanItem[] = r.results
    .filter((k) => k.fraction < 0.999)
    .map((k) => {
      const atStake = Math.round((k.weight - k.earned) * 10) / 10;
      const route = kpiRoute(k.code);
      const parentJudged = ["dish", "manners", "phone"].includes(k.code);
      const hint = r.hints.find((h) => h.toLowerCase().includes(k.label.toLowerCase().slice(0, 12)) || (k.code === "prayers" && /prayer/i.test(h)) || (k.code === "checkins" && /check-in/i.test(h) && !/coach/i.test(h)) || (k.code === "classlog" && /class/i.test(h)) || (k.code === "quizzes" && /quiz/i.test(h) && !/checkpoint/i.test(h)) || (k.code === "checkpoint" && /checkpoint/i.test(h)) || (k.code === "homework" && /homework/i.test(h)) || (k.code === "grades" && /grades/i.test(h)) || (k.code === "wellbeing" && /coach/i.test(h)) || (k.code.startsWith("snap:") && /snap/i.test(h) && h.toLowerCase().includes(k.label.replace(/^Snap: /, "").toLowerCase().slice(0, 6))));
      let recoverable = true;
      let how = hint ?? "";
      if (parentJudged) {
        recoverable = false;
        how = `A ✗ from a parent stays. Keep the rest of the week clean so no more points go.`;
      } else if (k.code === "checkpoint" && /not attempted before the week closed/.test(k.detail)) {
        recoverable = false;
        how = "The checkpoint closed with the week.";
      } else if (!how) {
        how = k.code === "prayers" ? "Log 4 prayers a day; yesterday's can still be reported." : k.code === "checkins" ? "Check in tonight; a missed day can be filled in from Today." : "Catch up before pay day.";
      }
      return { code: k.code, emoji: k.emoji, label: k.label, detail: k.detail, atStake, recoverable, how, href: route?.href ?? null, cta: route?.cta ?? null };
    })
    .filter((p) => p.atStake > 0)
    .sort((a, b) => b.atStake - a.atStake);
  return { todo: items.filter((p) => p.recoverable), protect: items.filter((p) => !p.recoverable && ["dish", "manners", "phone"].includes(p.code)), lost: items.filter((p) => !p.recoverable && !["dish", "manners", "phone"].includes(p.code)) };
}

/** The child's "why this amount" in plain words. */
export function whyThisAmount(r: WeekResult, allowance: number): string {
  const now = bandFor(r.score);
  const best = bandFor(r.maxScore);
  const nowEgp = Math.round(allowance * now.share);
  const bestEgp = Math.round(allowance * best.share);
  const daysLeft = r.totalDays - r.elapsedDays;
  const head = `Your score is ${r.score} out of 100 after ${r.elapsedDays} day${r.elapsedDays === 1 ? "" : "s"}. ${now.min ? `${now.min}+ pays ${now.label.toLowerCase()}` : "Under 50 pays nothing"}, so right now that is ${nowEgp} EGP.`;
  if (now.band === "full") return `${head} Keep every basic ✓ for the ${daysLeft} day${daysLeft === 1 ? "" : "s"} left and the full ${allowance} EGP is yours.`;
  if (best.band === now.band) return `${head} What is missing cannot be recovered this week, so ${nowEgp} EGP is where this week ends unless you lose more. Next week starts fresh at 100.`;
  return `${head} If you do everything below by pay day you reach ${r.maxScore}, which is ${best.label.toLowerCase()}: ${bestEgp} EGP.`;
}
