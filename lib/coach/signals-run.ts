import { createAdminClient } from "@/lib/supabase/admin";
import { attentionTier, computeSignals, type AttentionTier, type Signal, type SignalInput } from "@/lib/signals";
import { computeStreak } from "@/lib/points";
import { shiftDate, todayIn } from "@/lib/dates";
import { formatInTimeZone } from "date-fns-tz";

export interface AttentionResult {
  today: string;
  score: number;
  tier: AttentionTier;
  signals: Signal[];
}

/** Gathers 14 days of data for one student and runs the deterministic signal rules. No AI. */
export async function computeAttention(studentId: string): Promise<AttentionResult> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("family_id").eq("id", studentId).single();
  const { data: family } = await admin.from("families").select("timezone").eq("id", profile?.family_id ?? "").maybeSingle();
  const tz = family?.timezone ?? "Africa/Cairo";
  const today = todayIn(tz);
  const d14 = shiftDate(today, -14);
  const d7 = shiftDate(today, -7);
  const iso14 = new Date(Date.parse(d14 + "T00:00:00Z")).toISOString();

  const [{ data: checks }, { data: checkins }, { data: allCheckins }, { data: planned }, { data: msgs }, { data: notes }, { data: attempts }, { data: ledger }] = await Promise.all([
    admin.from("wellbeing_checks").select("instrument, taken_on, score, answers").eq("student_id", studentId).gte("taken_on", shiftDate(today, -60)).order("taken_on", { ascending: false }),
    admin.from("checkins").select("checkin_date, mood, stuck_on, submitted_at").eq("student_id", studentId).gte("checkin_date", d14),
    admin.from("checkins").select("checkin_date").eq("student_id", studentId),
    admin.from("quizzes").select("scheduled_for, attempts(submitted_at)").eq("student_id", studentId).not("scheduled_for", "is", null).gte("scheduled_for", d14).lt("scheduled_for", today),
    admin.from("coach_messages").select("role, risk_level, created_at").eq("student_id", studentId).gte("created_at", iso14).order("created_at", { ascending: false }),
    admin.from("coach_notes").select("created_at").eq("student_id", studentId).gte("created_at", iso14),
    admin.from("attempts").select("flagged, submitted_at").eq("student_id", studentId).gte("submitted_at", iso14),
    admin.from("points_ledger").select("created_at").eq("student_id", studentId).gte("created_at", iso14),
  ]);
  type Check = { instrument: string; taken_on: string; score: number | null; answers: Record<string, string> };
  const cks = (checks ?? []) as Check[];
  const pulses = cks.filter((c) => c.instrument === "pulse").map((c) => ({ taken_on: c.taken_on, answers: c.answers }));
  const who5 = cks.filter((c) => c.instrument === "who5").map((c) => ({ taken_on: c.taken_on, score: c.score ?? 0, answers: c.answers }));
  const mindset = cks.find((c) => c.instrument === "mindset") ?? null;
  const habits = cks.find((c) => c.instrument === "habits") ?? null;

  const hourOf = (iso: string) => Number(formatInTimeZone(new Date(iso), tz, "H"));
  const activity = [...(ledger ?? []).map((l) => l.created_at as string), ...(checkins ?? []).map((c) => c.submitted_at as string), ...(msgs ?? []).filter((m) => m.role === "user").map((m) => m.created_at as string)].filter(Boolean).map(hourOf);

  const plannedRows = (planned ?? []) as { scheduled_for: string; attempts: { submitted_at: string | null }[] }[];
  const doneIn = (from: string, to: string) => plannedRows.filter((q) => q.scheduled_for >= from && q.scheduled_for < to && q.attempts.some((a) => a.submitted_at)).length;
  const ck = (checkins ?? []) as { checkin_date: string; mood: number | null; stuck_on: string | null }[];
  const streakDates = (allCheckins ?? []).map((c) => c.checkin_date as string);
  const currentStreak = computeStreak(streakDates, today) || computeStreak(streakDates, shiftDate(today, -1));
  // Longest streak that ended before the last 7 days (rough: any 7 consecutive days in history).
  const sorted = [...new Set(streakDates)].sort();
  let longest = 0, run = 0;
  for (let k = 0; k < sorted.length; k++) {
    run = k > 0 && shiftDate(sorted[k - 1], 1) === sorted[k] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const userMsgs = (msgs ?? []).filter((m) => m.role === "user");
  const lastUser = userMsgs[0];
  const lastAssistant = (msgs ?? []).find((m) => m.role === "assistant");
  const riskLevels = (msgs ?? []).map((m) => m.risk_level).filter((r): r is "none" | "low" | "moderate" | "high" => !!r);

  const input: SignalInput = {
    today,
    pulses,
    who5,
    mindset: mindset ? { answers: mindset.answers } : null,
    habits: habits ? { answers: habits.answers } : null,
    activityHoursLocal: activity,
    plannedDoneThisWeek: doneIn(d7, today),
    plannedDoneLastWeek: doneIn(d14, d7),
    checkinsThisWeek: ck.filter((c) => c.checkin_date >= d7).length,
    checkinsLastWeek: ck.filter((c) => c.checkin_date < d7).length,
    longestStreakBefore: longest,
    currentStreak,
    checkinMoods: ck.map((c) => c.mood ?? 3),
    stuckOnTexts: ck.map((c) => c.stuck_on ?? "").filter(Boolean),
    riskLevels,
    flaggedAttempts: (attempts ?? []).filter((a) => a.flagged).length,
    daysSinceLastChat: lastUser ? Math.floor((Date.now() - new Date(lastUser.created_at).getTime()) / 86400000) : null,
    lastChatWasLow: !!lastAssistant && (lastAssistant.risk_level === "low" || lastAssistant.risk_level === "moderate"),
  };
  void notes;
  const signals = computeSignals(input);
  const { score, tier } = attentionTier(signals);
  return { today, score, tier, signals };
}

/** Stores today's snapshot (one per day) so trends and the daily report can use it. */
export async function snapshotAttention(studentId: string, familyId: string): Promise<AttentionResult> {
  const r = await computeAttention(studentId);
  const admin = createAdminClient();
  await admin.from("attention_snapshots").upsert({ student_id: studentId, family_id: familyId, taken_on: r.today, score: r.score, tier: r.tier, signals: r.signals }, { onConflict: "student_id,taken_on" });
  return r;
}
