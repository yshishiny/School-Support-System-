/**
 * Wellbeing and learning check-ins on a schedule, with scoring. The only clinically validated instrument here is
 * the WHO-5 Well-Being Index (public domain, validated for ages 9+). The others are short, plainly worded
 * self-report items adapted from research scales (growth mindset, academic self-efficacy, self-regulation,
 * WHO sleep/activity guidance); they guide the coach, they do not diagnose.
 */
export type Instrument = "pulse" | "who5" | "mindset" | "habits";
export type Band = "green" | "amber" | "red";

export interface CheckQuestion {
  id: string;
  prompt: string;
  emoji: string;
  options: { value: string; label: string; emoji?: string }[];
  reverse?: boolean; // for agree-scales: higher raw = worse
}

export interface InstrumentDef {
  id: Instrument;
  title: string;
  emoji: string;
  intro: string;
  everyDays: number;
  minutes: number;
  questions: CheckQuestion[];
  freeText?: string; // optional open prompt at the end
}

const AGREE = [
  { value: "1", label: "Not at all" },
  { value: "2", label: "A little" },
  { value: "3", label: "Somewhat" },
  { value: "4", label: "Mostly" },
  { value: "5", label: "Totally" },
];

const WHO5_SCALE = [
  { value: "5", label: "All of the time" },
  { value: "4", label: "Most of the time" },
  { value: "3", label: "More than half" },
  { value: "2", label: "Less than half" },
  { value: "1", label: "Some of the time" },
  { value: "0", label: "At no time" },
];

export const INSTRUMENTS: Record<Instrument, InstrumentDef> = {
  pulse: {
    id: "pulse",
    title: "Weekly pulse",
    emoji: "💓",
    intro: "Four quick taps about this week. Just for you and your coach.",
    everyDays: 7,
    minutes: 1,
    questions: [
      { id: "mood", emoji: "🙂", prompt: "This week, overall, I felt…", options: [
        { value: "5", label: "Great", emoji: "😄" }, { value: "4", label: "Good", emoji: "🙂" }, { value: "3", label: "OK", emoji: "😐" }, { value: "2", label: "Low", emoji: "😕" }, { value: "1", label: "Really bad", emoji: "😞" },
      ] },
      { id: "stress", emoji: "😮‍💨", prompt: "School pressure this week was…", reverse: true, options: [
        { value: "1", label: "Easy", emoji: "😌" }, { value: "2", label: "Fine", emoji: "🙂" }, { value: "3", label: "Some", emoji: "😐" }, { value: "4", label: "A lot", emoji: "😣" }, { value: "5", label: "Too much", emoji: "🤯" },
      ] },
      { id: "sleep", emoji: "😴", prompt: "On school nights I slept about…", options: [
        { value: "1", label: "Under 6 h", emoji: "🥱" }, { value: "2", label: "6–7 h", emoji: "😪" }, { value: "4", label: "7–8 h", emoji: "😊" }, { value: "5", label: "8–10 h", emoji: "😴" },
      ] },
      { id: "energy", emoji: "⚡", prompt: "My energy for studying was…", options: [
        { value: "5", label: "Full", emoji: "🔋" }, { value: "3", label: "Medium", emoji: "🪫" }, { value: "1", label: "Empty", emoji: "😩" },
      ] },
    ],
    freeText: "Anything on your mind? (optional, stays private)",
  },
  who5: {
    id: "who5",
    title: "How you have been feeling",
    emoji: "🌤️",
    intro: "Five statements about the last two weeks. Pick what is closest to how you felt. There are no wrong answers.",
    everyDays: 28,
    minutes: 2,
    questions: [
      { id: "w1", emoji: "😊", prompt: "I have felt cheerful and in good spirits", options: WHO5_SCALE },
      { id: "w2", emoji: "🧘", prompt: "I have felt calm and relaxed", options: WHO5_SCALE },
      { id: "w3", emoji: "🏃", prompt: "I have felt active and vigorous", options: WHO5_SCALE },
      { id: "w4", emoji: "🌅", prompt: "I woke up feeling fresh and rested", options: WHO5_SCALE },
      { id: "w5", emoji: "🎯", prompt: "My daily life has been filled with things that interest me", options: WHO5_SCALE },
    ],
    freeText: "Want to tell your coach anything? (optional, private)",
  },
  mindset: {
    id: "mindset",
    title: "How you see learning",
    emoji: "🧠",
    intro: "Six statements. How true is each one for you right now?",
    everyDays: 42,
    minutes: 2,
    questions: [
      { id: "m1", emoji: "🧬", prompt: "How smart you are is fixed and you can't really change it", reverse: true, options: AGREE },
      { id: "m2", emoji: "🌱", prompt: "When I work hard at something difficult, I actually get smarter at it", options: AGREE },
      { id: "m3", emoji: "🧗", prompt: "I can learn hard topics if I keep at them", options: AGREE },
      { id: "m4", emoji: "🙋", prompt: "When I don't understand, I ask or look for help", options: AGREE },
      { id: "m5", emoji: "😰", prompt: "I avoid tasks where I might look bad", reverse: true, options: AGREE },
      { id: "m6", emoji: "🎯", prompt: "I set a small goal before I start studying", options: AGREE },
    ],
  },
  habits: {
    id: "habits",
    title: "Body and study habits",
    emoji: "🍎",
    intro: "A healthy body carries a strong brain. Six honest taps.",
    everyDays: 42,
    minutes: 2,
    questions: [
      { id: "h1", emoji: "🏃", prompt: "Days per week I move or play sport for an hour", options: [{ value: "1", label: "0–1" }, { value: "3", label: "2–3" }, { value: "4", label: "4–5" }, { value: "5", label: "6–7" }] },
      { id: "h2", emoji: "📱", prompt: "Phone or games on school days, outside homework", reverse: true, options: [{ value: "1", label: "Under 1 h" }, { value: "2", label: "1–2 h" }, { value: "4", label: "3–4 h" }, { value: "5", label: "5 h or more" }] },
      { id: "h3", emoji: "🍳", prompt: "I eat breakfast before school", options: [{ value: "1", label: "Rarely" }, { value: "3", label: "Some days" }, { value: "5", label: "Most days" }] },
      { id: "h4", emoji: "⏰", prompt: "I start homework…", reverse: true, options: [{ value: "1", label: "Soon after school" }, { value: "3", label: "After a break" }, { value: "5", label: "Very late, last minute" }] },
      { id: "h5", emoji: "🧩", prompt: "While studying, my phone is…", options: [{ value: "5", label: "In another room" }, { value: "3", label: "Next to me, silent" }, { value: "1", label: "I keep checking it" }] },
      { id: "h6", emoji: "💧", prompt: "Water and real meals during the day", options: [{ value: "5", label: "Yes, regularly" }, { value: "3", label: "Sometimes" }, { value: "1", label: "I forget" }] },
    ],
  },
};

export const INSTRUMENT_ORDER: Instrument[] = ["pulse", "who5", "mindset", "habits"];

export interface ScoreResult {
  score: number; // 0-100, higher is better
  band: Band;
}

/** WHO-5: raw 0-25 × 4. ≤50 suggests poor wellbeing; ≤28 is the usual screening cut-off for depression. */
export function scoreInstrument(instrument: Instrument, answers: Record<string, string>): ScoreResult {
  const def = INSTRUMENTS[instrument];
  if (instrument === "who5") {
    const vals = def.questions.map((q) => Number(answers[q.id]));
    if (vals.some((v) => Number.isNaN(v))) return { score: 0, band: "amber" };
    const score = vals.reduce((a, b) => a + b, 0) * 4;
    return { score, band: score <= 28 ? "red" : score <= 50 ? "amber" : "green" };
  }
  // Generic 1-5 items normalised to 0-100, reverse-scored where marked.
  const pts: number[] = [];
  for (const q of def.questions) {
    const raw = Number(answers[q.id]);
    if (Number.isNaN(raw)) continue;
    const v = q.reverse ? 6 - raw : raw;
    pts.push(((v - 1) / 4) * 100);
  }
  if (pts.length === 0) return { score: 0, band: "amber" };
  const score = Math.round(pts.reduce((a, b) => a + b, 0) / pts.length);
  const band: Band = instrument === "pulse" ? (score < 30 ? "red" : score < 55 ? "amber" : "green") : score < 40 ? "amber" : "green";
  return { score, band };
}

export interface CheckHistoryRow {
  instrument: Instrument;
  taken_on: string;
  band: Band | null;
  score: number | null;
}

/** Which instruments are due today, most important first. Pulse weekly, WHO-5 monthly, the others every six weeks. */
export function dueInstruments(today: string, history: CheckHistoryRow[]): Instrument[] {
  const dayMs = 86400000;
  const t = Date.parse(today + "T00:00:00Z");
  const due: Instrument[] = [];
  for (const id of INSTRUMENT_ORDER) {
    const last = history.filter((h) => h.instrument === id).map((h) => h.taken_on).sort().pop();
    const days = last ? (t - Date.parse(last + "T00:00:00Z")) / dayMs : Infinity;
    if (days >= INSTRUMENTS[id].everyDays) due.push(id);
  }
  return due;
}

/** Coarse status a parent may see: never the answers, only whether things look fine, worth a chat, or need one. */
export function wellbeingStatus(history: CheckHistoryRow[], today: string): { band: Band | null; checks: number; note: string } {
  const recent = history.filter((h) => Date.parse(today + "T00:00:00Z") - Date.parse(h.taken_on + "T00:00:00Z") <= 35 * 86400000);
  if (recent.length === 0) return { band: null, checks: 0, note: "No check-ins in the last five weeks." };
  const who5 = recent.filter((h) => h.instrument === "who5").sort((a, b) => b.taken_on.localeCompare(a.taken_on));
  const pulses = recent.filter((h) => h.instrument === "pulse").sort((a, b) => b.taken_on.localeCompare(a.taken_on)).slice(0, 3);
  if (who5[0]?.band === "red" || pulses.filter((p) => p.band === "red").length >= 2) return { band: "red", checks: recent.length, note: "Recent answers point to low wellbeing. A calm conversation this week would help." };
  if (who5[0]?.band === "amber" || pulses.filter((p) => p.band !== "green").length >= 2) return { band: "amber", checks: recent.length, note: "Some weeks felt heavy. Worth checking in gently." };
  return { band: "green", checks: recent.length, note: "Things look fine." };
}
