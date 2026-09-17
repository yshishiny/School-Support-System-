/**
 * Follow-up questions for the child on each integrity signal. The same thing is asked up to three times on
 * different days, each time differently and with more detail requested, so a made-up answer is hard to keep
 * straight and an honest one is easy. Pure: the question bank and the round logic.
 */
import type { IntegritySignal } from "./integrity";

export const MIN_ANSWER_CHARS = 25;
export const FOLLOWUP_POINTS = 2;

type Bank = { r1: string; r2: string; r3: (prev: string) => string };

const short = (s: string) => (s.length > 90 ? `${s.slice(0, 87)}…` : s);

/** {detail} is the dates/subjects taken from the signal's own text. */
const BANK: Record<string, Bank> = {
  retro_on_time: {
    r1: "You logged some prayers as “on time” a while after the time. For {detail}: where exactly were you, and who was around you when you prayed?",
    r2: "One more on {detail}: what were you doing just before that prayer and right after it? Be specific (the room, the time, what was on).",
    r3: (p) => `Earlier you said: “${short(p)}”. Tell it once more from the start, and add one detail you did not mention before.`,
  },
  prayer_burst: {
    r1: "Three prayers went into the app within three minutes on {detail}. Which of them did you pray at its time, and which did you log later? Name each one.",
    r2: "For {detail}, go prayer by prayer: Dhuhr, Asr, Maghrib. Where were you for each, and roughly what time?",
    r3: (p) => `You wrote: “${short(p)}”. Which of those would you change now that you think about it, and which are exactly right?`,
  },
  copy_notes: {
    r1: "Your class note for {detail} is the same as another day. What was actually different in that class? One thing the teacher said or did.",
    r2: "About {detail}: what page, exercise or example did you work on that day, and what did you find hardest?",
    r3: (p) => `Earlier you said: “${short(p)}”. Explain that thing to your coach in two sentences, as if teaching it.`,
  },
  no_class_overuse: {
    r1: "You marked “no class” for {detail}. For each one: why did the class not happen (teacher absent, trip, exam, free period…)?",
    r2: "For the classes that did not happen ({detail}): where were you during that time and what did you do instead?",
    r3: (p) => `You said: “${short(p)}”. Which of those classes could have actually happened while you were not in them? Be honest, nothing bad follows an honest answer.`,
  },
  fast_quiz: {
    r1: "A quiz set went in very fast. Pick any one question from it you remember: what was it about, and how did you get the answer?",
    r2: "Same set: which question was the hardest, and what made you sure of your answer?",
    r3: (p) => `Earlier you wrote: “${short(p)}”. Explain the rule behind that question in your own words.`,
  },
  tab_switches: {
    r1: "During a quiz you left the screen a few times. What were you doing each time you left?",
    r2: "Did anything from outside the quiz help you answer? It is fine to say yes; say what it was.",
    r3: (p) => `You said: “${short(p)}”. If a friend did the same during a test, would you call it fair? Why?`,
  },
  night_checkin: {
    r1: "One check-in went in after midnight. What time did you really go to sleep that night, and why so late?",
    r2: "Same night: what were you doing between 22:00 and the time you slept? Name the things in order.",
    r3: (p) => `You said: “${short(p)}”. What would you do differently tonight so the check-in goes in before 22:00?`,
  },
  snaps_rejected: {
    r1: "A couple of your snaps were sent back this week. What was wrong with them, in your view?",
    r2: "Before you snap tonight: what exactly will you do differently so it passes first time?",
    r3: (p) => `You said: “${short(p)}”. Did it work? What did the parent say the second time?`,
  },
};

BANK.log_vs_school = {
  r1: "The school shared a file for {detail} this week, but your class log says otherwise (no class, or nothing about it). What was actually taken in that subject this week? Name the lesson and one thing the teacher explained.",
  r2: "Open the school's file for {detail} on Learn → Files and look at it. Which of its topics did you actually take in class, and on which day? Which ones have not been taught yet?",
  r3: (p) => `You said: “${short(p)}”. Go back to the check-in and fix the class log for that subject so it matches what really happened, then write here what you changed.`,
};

BANK.syllabus_vs_log = {
  r1: "The school's weekly syllabus lists what each subject covered this week, and your class log disagrees on some subjects ({detail}). Go subject by subject: what did you actually take, and where does your log go wrong?",
  r2: "Open Learn → Files, the weekly syllabus. For each subject you marked “no class” or left empty this week: did that class happen? If yes, what was taught?",
  r3: (p) => `You said: “${short(p)}”. Fix the class log for those days now (Check-in → earlier days) so it matches the syllabus, and write here which days you changed.`,
};

BANK.screen_over_limit = {
  r1: "Your screen-time screenshot was over the family limit on {detail}. What took the time that day, app by app, and what was going on at home at the same time?",
  r2: "Same day ({detail}): which of that time was for school, and which was just scrolling? Give minutes for each, honestly.",
  r3: (p) => `You said: “${short(p)}”. Pick one thing to change tomorrow (an app, a time of day, a place for the phone) and write it as a promise.`,
};

BANK.manners_gap = {
  r1: "You rated your own manners well on {detail}, and a parent saw it differently. Tell what happened that day, from your side, with the details: who, what was said, what came next.",
  r2: "Same day ({detail}): if you were the other person, how would you describe it? What would you have wanted to hear from you?",
  r3: (p) => `You said: “${short(p)}”. Is there anything to repair, an apology or a fix, and have you done it? Say what.`,
};

const GENERIC: Bank = {
  r1: "Your coach noticed: {label}. Tell what happened in your own words, with the details (when, where, who).",
  r2: "About “{label}”: walk through it step by step, from the start.",
  r3: (p) => `You said: “${short(p)}”. Anything you would add or change now?`,
};

/** The dates/subjects inside a signal's parent question, for the child's version. */
export function signalDetail(sig: IntegritySignal): string {
  const dates = sig.ask.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  const paren = sig.ask.match(/\(([^)]+)\)/)?.[1];
  const subject = sig.label.match(/^The same (.+?) note/)?.[1] ?? sig.label.match(/ for (.+?) this week, but/)?.[1];
  if (sig.code === "syllabus_vs_log") { const m = sig.ask.match(/subject by subject: (.+)\.$/); return m ? m[1].slice(0, 160) : "several subjects"; }
  if (sig.code === "screen_over_limit") { const d = sig.label.match(/\d{4}-\d{2}-\d{2}/)?.[0]; return d ?? "that day"; }
  if (sig.code === "manners_gap") { const ds = sig.label.match(/\d{4}-\d{2}-\d{2}/g) ?? []; return ds.length ? ds.join(", ") : "that day"; }
  const parts = [...new Set([...(subject ? [subject] : []), ...dates, ...(paren ? [paren] : [])])];
  return parts.length ? parts.join(", ") : "that day";
}

export function followupQuestion(sig: IntegritySignal, round: 1 | 2 | 3, previousAnswer: string | null): string {
  const bank = BANK[sig.code] ?? GENERIC;
  const fill = (t: string) => t.replace("{detail}", signalDetail(sig)).replace("{label}", sig.label.toLowerCase());
  if (round === 1) return fill(bank.r1);
  if (round === 2) return fill(bank.r2);
  return fill(bank.r3(previousAnswer ?? ""));
}

export interface FollowupRow { id: string; signal_key: string; signal_code: string; signal_label: string; round: number; question: string; asked_on: string; answer: string | null; answered_at: string | null }

/**
 * Which new rounds to create today: round 1 for a signal without a thread; the next round when the previous
 * one was answered on an earlier day. Never more than one new round per signal per day, three at most.
 */
export function roundsToOpen(signals: IntegritySignal[], existing: FollowupRow[], today: string, weekKey: string): { sig: IntegritySignal; round: 1 | 2 | 3; prev: string | null }[] {
  const out: { sig: IntegritySignal; round: 1 | 2 | 3; prev: string | null }[] = [];
  for (const sig of signals) {
    const key = `${sig.code}:${weekKey}`;
    const rows = existing.filter((r) => r.signal_key === key).sort((a, b) => a.round - b.round);
    if (rows.length === 0) {
      out.push({ sig, round: 1, prev: null });
      continue;
    }
    const last = rows[rows.length - 1];
    if (last.round >= 3 || !last.answer || !last.answered_at || last.answered_at.slice(0, 10) >= today || last.asked_on >= today) continue;
    out.push({ sig, round: (last.round + 1) as 2 | 3, prev: last.answer });
  }
  return out;
}

export function validAnswer(text: string): string | null {
  const t = text.trim();
  if (t.length < MIN_ANSWER_CHARS) return `Give a bit more detail (at least ${MIN_ANSWER_CHARS} characters).`;
  if (new Set(t.toLowerCase().split(/\s+/)).size < 4) return "Use a few different words; the details are the point.";
  return null;
}
