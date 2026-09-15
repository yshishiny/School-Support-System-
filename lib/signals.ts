/**
 * Early-warning signals. Deliberately sensitive: the goal is to say "worth a look" early and let a parent or a
 * professional judge, never to diagnose. Every signal is a plain, deterministic rule over data the app already
 * holds. Parents see codes and labels only, never the underlying answers.
 */
export type SignalCode =
  | "low_mood" | "high_pressure" | "short_sleep" | "no_energy" | "who5_low_item" | "who5_drop"
  | "fixed_mindset" | "avoidance" | "screen_heavy" | "inactive" | "skips_breakfast"
  | "late_night_use" | "engagement_drop" | "streak_broken" | "checkin_mood_low" | "stuck_feelings"
  | "risk_low_repeat" | "risk_moderate" | "flagged_attempts" | "chat_silence_after_low" | "no_checkins";

export interface Signal {
  code: SignalCode;
  label: string; // parent-facing, no answer content
  weight: number; // contribution to the attention score
  pillar: "wellbeing" | "mindset" | "body" | "engagement" | "safety";
}

export type AttentionTier = "none" | "watch" | "amber" | "red";

export interface SignalInput {
  today: string;
  pulses: { taken_on: string; answers: Record<string, string> }[]; // newest first
  who5: { taken_on: string; score: number; answers: Record<string, string> }[]; // newest first
  mindset: { answers: Record<string, string> } | null;
  habits: { answers: Record<string, string> } | null;
  activityHoursLocal: number[]; // hour of day (local) of each logged action in the last 14 days
  plannedDoneThisWeek: number;
  plannedDoneLastWeek: number;
  checkinsThisWeek: number;
  checkinsLastWeek: number;
  longestStreakBefore: number;
  currentStreak: number;
  checkinMoods: number[]; // 1-5, last 14 days
  stuckOnTexts: string[];
  riskLevels: ("none" | "low" | "moderate" | "high")[]; // last 14 days, chat + notes
  flaggedAttempts: number;
  daysSinceLastChat: number | null;
  lastChatWasLow: boolean;
}

const FEELING_WORDS = /(tired|exhausted|sad|cry|hate|alone|lonely|scared|anxious|stress|stressed|can'?t sleep|give up|useless|stupid|زهقت|تعبان|حزين|خايف|قلقان|مش قادر|كرهت)/i;

export function computeSignals(i: SignalInput): Signal[] {
  const out: Signal[] = [];
  const push = (code: SignalCode, label: string, weight: number, pillar: Signal["pillar"]) => out.push({ code, label, weight, pillar });

  // Wellbeing (weekly pulse + WHO-5)
  const p = i.pulses.slice(0, 2);
  if (p.some((x) => Number(x.answers.mood) <= 2)) push("low_mood", "Reported a low week", 12, "wellbeing");
  if (p.length === 2 && p.every((x) => Number(x.answers.stress) >= 4)) push("high_pressure", "School pressure high two weeks running", 10, "wellbeing");
  else if (p.some((x) => Number(x.answers.stress) >= 5)) push("high_pressure", "School pressure felt like too much", 8, "wellbeing");
  if (p.some((x) => Number(x.answers.sleep) <= 1)) push("short_sleep", "Sleeping under 6 hours on school nights", 10, "body");
  if (p.length === 2 && p.every((x) => Number(x.answers.energy) <= 1)) push("no_energy", "No energy for studying two weeks running", 8, "wellbeing");
  const w = i.who5[0];
  if (w) {
    const lows = Object.values(w.answers).filter((v) => Number(v) <= 1).length;
    if (lows >= 1) push("who5_low_item", `Rarely felt ${lows === 1 ? "one" : lows} of: cheerful, calm, active, rested, interested`, 6 * lows, "wellbeing");
    const prev = i.who5[1];
    if (prev && prev.score - w.score >= 20) push("who5_drop", "Wellbeing score dropped sharply since last month", 14, "wellbeing");
  }

  // Mindset
  if (i.mindset) {
    const a = i.mindset.answers;
    if (Number(a.m1) >= 4 && Number(a.m2) <= 2) push("fixed_mindset", "Believes ability is fixed; effort feels pointless", 8, "mindset");
    if (Number(a.m5) >= 4) push("avoidance", "Avoids tasks where he might look bad", 6, "mindset");
  }

  // Body and habits
  if (i.habits) {
    const a = i.habits.answers;
    if (Number(a.h2) >= 5) push("screen_heavy", "Five or more hours of phone or games on school days", 8, "body");
    if (Number(a.h1) <= 1) push("inactive", "Almost no sport or movement in the week", 6, "body");
    if (Number(a.h3) <= 1) push("skips_breakfast", "Rarely eats breakfast", 4, "body");
  }
  const late = i.activityHoursLocal.filter((h) => h >= 0 && h < 5).length;
  if (late >= 4) push("late_night_use", `Using the app after midnight on ${late} occasions`, 8, "body");

  // Engagement
  if (i.plannedDoneLastWeek >= 3 && i.plannedDoneThisWeek <= i.plannedDoneLastWeek / 2) push("engagement_drop", "Quizzes done fell by half compared with last week", 8, "engagement");
  if (i.checkinsLastWeek >= 4 && i.checkinsThisWeek <= 1) push("engagement_drop", "Stopped checking in after a regular week", 8, "engagement");
  if (i.longestStreakBefore >= 7 && i.currentStreak === 0) push("streak_broken", "A long streak ended and did not restart", 5, "engagement");
  if (i.checkinsThisWeek === 0 && i.checkinsLastWeek === 0) push("no_checkins", "No check-ins for two weeks", 6, "engagement");
  const lowMoods = i.checkinMoods.filter((m) => m <= 2).length;
  if (lowMoods >= 2) push("checkin_mood_low", `Marked the day as bad ${lowMoods} times in two weeks`, 8, "wellbeing");
  if (i.stuckOnTexts.some((t) => FEELING_WORDS.test(t))) push("stuck_feelings", "Wrote about feelings, not schoolwork, in the 'stuck on' box", 8, "wellbeing");

  // Safety-adjacent (below the alert threshold)
  const lows = i.riskLevels.filter((r) => r === "low").length;
  if (lows >= 2) push("risk_low_repeat", "Several coach chats about stress or sadness", 8, "safety");
  if (i.riskLevels.includes("moderate")) push("risk_moderate", "A coach chat suggested he was struggling", 15, "safety");
  if (i.flaggedAttempts >= 2) push("flagged_attempts", "Quiz sets that looked rushed or copied", 4, "engagement");
  if (i.lastChatWasLow && i.daysSinceLastChat !== null && i.daysSinceLastChat >= 5) push("chat_silence_after_low", "Went quiet after a heavy conversation with the coach", 6, "safety");

  // Merge duplicate codes, keep the heavier one.
  const byCode = new Map<SignalCode, Signal>();
  for (const s of out) if (!byCode.has(s.code) || byCode.get(s.code)!.weight < s.weight) byCode.set(s.code, s);
  return [...byCode.values()].sort((a, b) => b.weight - a.weight);
}

/** Score is the sum of weights; "watch" starts at 10 on purpose (a single meaningful signal). */
export function attentionTier(signals: Signal[]): { score: number; tier: AttentionTier } {
  const score = signals.reduce((s, x) => s + x.weight, 0);
  if (signals.some((s) => s.code === "risk_moderate") && score >= 30) return { score, tier: "red" };
  if (score >= 30) return { score, tier: "amber" };
  if (score >= 10) return { score, tier: "watch" };
  return { score, tier: "none" };
}
