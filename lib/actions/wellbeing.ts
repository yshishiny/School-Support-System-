"use server";

import { revalidatePath } from "next/cache";
import { requireParent, requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { INSTRUMENTS, scoreInstrument, type Instrument } from "@/lib/wellbeing";
import { classifyRisk, coachChat, type ChatTurn } from "@/lib/ai/coach-chat";
import { HELPLINES, parentAlertText, type RiskCategory, type RiskLevel } from "@/lib/safety";
import { sendTelegram } from "@/lib/whatsapp/send";
import { learnerPromptLine } from "@/lib/learner";
import { themeById } from "@/lib/themes";
import { todayIn } from "@/lib/dates";

const CHECK_POINTS = 5;
const MAX_HISTORY = 24;

async function raiseAlert(opts: { familyId: string; studentId: string; studentName: string; level: "amber" | "red"; category: RiskCategory; summary: string }) {
  const admin = createAdminClient();
  // One red alert per day per student is enough to get the parent moving; do not spam.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recent } = await admin.from("safety_alerts").select("id").eq("student_id", opts.studentId).eq("level", opts.level).gte("created_at", since).limit(1);
  if (recent && recent.length) return;
  const { data: family } = await admin.from("families").select("telegram_chat_id").eq("id", opts.familyId).single();
  const send = await sendTelegram(family?.telegram_chat_id ?? null, parentAlertText(opts.studentName, opts.level, opts.category));
  await admin.from("safety_alerts").insert({ family_id: opts.familyId, student_id: opts.studentId, level: opts.level, category: opts.category, summary: opts.summary, notified: send.ok });
  revalidatePath("/parent");
  revalidatePath("/parent/progress");
}

export async function submitCheckAction(instrument: Instrument, answers: Record<string, string>, freeText: string): Promise<{ error?: string; earned?: number; band?: string; score?: number }> {
  const { profile, family } = await requireStudent();
  const def = INSTRUMENTS[instrument];
  if (!def) return { error: "Unknown check." };
  const clean: Record<string, string> = {};
  for (const q of def.questions) if (q.options.some((o) => o.value === answers[q.id])) clean[q.id] = answers[q.id];
  if (Object.keys(clean).length < Math.ceil(def.questions.length * 0.6)) return { error: "Answer a few more, then finish." };
  const today = todayIn(family.timezone);
  const { score, band } = scoreInstrument(instrument, clean);
  const admin = createAdminClient();
  const text = freeText.trim().slice(0, 1500) || null;
  const { data: row, error } = await admin
    .from("wellbeing_checks")
    .insert({ student_id: profile.id, instrument, answers: clean, score, band, free_text: text, taken_on: today })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Could not save." };

  // Points once per instrument per day.
  let earned = 0;
  const { error: payErr } = await admin.from("points_ledger").insert({ student_id: profile.id, delta: CHECK_POINTS, reason: `${def.title} check-in`, ref_type: "wellbeing", ref_id: row.id });
  if (!payErr) earned = CHECK_POINTS;

  // Safety: free text is classified; a red WHO-5 or repeated red pulses raise a gentle amber to the parent.
  if (text && process.env.ANTHROPIC_API_KEY) {
    try {
      const r = await classifyRisk(text);
      if (r.private_note) await admin.from("coach_notes").insert({ student_id: profile.id, note: r.private_note, source: instrument });
      if (r.risk_level === "high") await raiseAlert({ familyId: family.id, studentId: profile.id, studentName: profile.full_name.split(" ")[0], level: "red", category: r.risk_category ?? "other", summary: `Check-in note flagged ${r.risk_category ?? "risk"}` });
      else if (r.risk_level === "moderate") await raiseAlert({ familyId: family.id, studentId: profile.id, studentName: profile.full_name.split(" ")[0], level: "amber", category: r.risk_category ?? "severe_distress", summary: "Check-in note suggests he is struggling" });
    } catch (err) {
      console.error("[wellbeing] classify failed", err);
    }
  }
  if (band === "red") {
    await admin.from("coach_notes").insert({ student_id: profile.id, note: `${def.title} came out low (${score}/100) on ${today}.`, source: instrument });
    if (instrument === "who5") await raiseAlert({ familyId: family.id, studentId: profile.id, studentName: profile.full_name.split(" ")[0], level: "amber", category: "low_wellbeing", summary: "WHO-5 wellbeing score in the low range" });
  }
  ["/coach", "/today", "/me"].forEach((p) => revalidatePath(p));
  return { earned, band, score };
}

export interface ChatReply {
  reply: string;
  risk: RiskLevel;
  helplines?: { name: string; number: string }[];
  error?: string;
}

export async function coachChatAction(message: string): Promise<ChatReply> {
  const { profile, family } = await requireStudent();
  const text = message.trim().slice(0, 2000);
  if (!text) return { reply: "", risk: "none", error: "Say something first." };
  if (!process.env.ANTHROPIC_API_KEY) return { reply: "", risk: "none", error: "The coach is not configured on the server." };
  const admin = createAdminClient();
  const [{ data: past }, { data: notes }] = await Promise.all([
    admin.from("coach_messages").select("role, content").eq("student_id", profile.id).order("created_at", { ascending: false }).limit(MAX_HISTORY),
    admin.from("coach_notes").select("note").eq("student_id", profile.id).order("created_at", { ascending: false }).limit(12),
  ]);
  const history: ChatTurn[] = [...(past ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })), { role: "user", content: text }];
  await admin.from("coach_messages").insert({ student_id: profile.id, role: "user", content: text });
  try {
    const out = await coachChat({
      studentName: profile.full_name.split(" ")[0],
      grade: profile.grade,
      themeName: themeById(profile.theme).name,
      learner: learnerPromptLine(profile.learner_profile),
      guidance: profile.professional_guidance,
      notes: (notes ?? []).map((n) => n.note).reverse(),
      history,
      helplines: HELPLINES.map((h) => `${h.name}: ${h.number}`).join("; "),
    });
    await admin.from("coach_messages").insert({ student_id: profile.id, role: "assistant", content: out.reply, risk_level: out.risk_level });
    if (out.private_note) await admin.from("coach_notes").insert({ student_id: profile.id, note: out.private_note, source: "chat" });
    if (out.risk_level === "high") {
      await raiseAlert({ familyId: family.id, studentId: profile.id, studentName: profile.full_name.split(" ")[0], level: "red", category: out.risk_category ?? "other", summary: `Coach chat flagged ${out.risk_category ?? "risk"}` });
    } else if (out.risk_level === "moderate") {
      await raiseAlert({ familyId: family.id, studentId: profile.id, studentName: profile.full_name.split(" ")[0], level: "amber", category: out.risk_category ?? "severe_distress", summary: "Coach chat suggests he is struggling" });
    }
    return { reply: out.reply, risk: out.risk_level, helplines: out.risk_level === "moderate" || out.risk_level === "high" ? HELPLINES : undefined };
  } catch (err) {
    return { reply: "", risk: "none", error: err instanceof Error ? err.message : "The coach did not answer." };
  }
}

export async function clearCoachChatAction(): Promise<void> {
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  // The student can clear the visible conversation; the coach's private one-line notes stay so it still knows him.
  await admin.from("coach_messages").delete().eq("student_id", profile.id);
  revalidatePath("/coach");
}

export async function acknowledgeAlertAction(alertId: string): Promise<void> {
  const { family } = await requireParent();
  const admin = createAdminClient();
  await admin.from("safety_alerts").update({ acknowledged_at: new Date().toISOString() }).eq("id", alertId).eq("family_id", family.id);
  revalidatePath("/parent");
  revalidatePath("/parent/progress");
}
