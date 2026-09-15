import { createAdminClient } from "@/lib/supabase/admin";
import { collectCoachStats } from "./analyze";
import { draftClinicianSummary } from "@/lib/ai/clinician";
import { INSTRUMENTS, type Instrument } from "@/lib/wellbeing";
import { learnerPromptLine } from "@/lib/learner";
import { shiftDate } from "@/lib/dates";
import { computeAttention } from "./signals-run";

export type ClinicianScope = "standard" | "with_chat_themes";

const PERIOD_DAYS = 56;

/** Builds the data pack, drafts the narrative and stores it. Chat content is only read when the scope allows it. */
export async function generateClinicianReport(studentId: string, familyId: string, reason: string, scope: ClinicianScope) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
  const admin = createAdminClient();
  const stats = await collectCoachStats(studentId, PERIOD_DAYS);
  const s = stats.student;
  const periodStart = shiftDate(stats.today, -PERIOD_DAYS);

  const [{ data: checks }, { data: alerts }, { data: notes }, { data: chat }, { data: memorize }] = await Promise.all([
    admin.from("wellbeing_checks").select("instrument, answers, score, band, taken_on").eq("student_id", studentId).gte("taken_on", periodStart).order("taken_on"),
    admin.from("safety_alerts").select("level, category, created_at, notified, acknowledged_at").eq("student_id", studentId).order("created_at"),
    admin.from("coach_notes").select("note, source, created_at").eq("student_id", studentId).gte("created_at", periodStart).order("created_at"),
    scope === "with_chat_themes" ? admin.from("coach_messages").select("role, content, risk_level, created_at").eq("student_id", studentId).gte("created_at", periodStart).order("created_at") : Promise.resolve({ data: [] as { role: string; content: string; risk_level: string | null; created_at: string }[] }),
    admin.from("memorize_items").select("kind, sessions, best_score").eq("student_id", studentId),
  ]);

  const rows = (checks ?? []) as { instrument: Instrument; answers: Record<string, string>; score: number | null; band: string | null; taken_on: string }[];
  const labelOf = (inst: Instrument, qid: string, v: string) => INSTRUMENTS[inst].questions.find((q) => q.id === qid)?.options.find((o) => o.value === v)?.label ?? v;
  const instrumentLines = rows.map((r) => `- ${INSTRUMENTS[r.instrument].title} [${r.instrument}] on ${r.taken_on}: score ${r.score ?? "n/a"}/100, band ${r.band ?? "n/a"}; answers: ${Object.entries(r.answers).map(([k, v]) => `${INSTRUMENTS[r.instrument].questions.find((q) => q.id === k)?.prompt ?? k} → ${labelOf(r.instrument, k, v)}`).join(" | ")}`);
  const age = s.grade ? `grade ${s.grade} (typically ${s.grade + 5}-${s.grade + 6} years)` : "grade unknown";

  const payload = [
    `Prepared on ${stats.today} by the parent from the family study app. Period covered: ${periodStart} to ${stats.today}. Scope: ${scope === "with_chat_themes" ? "includes themes from the child's private chat with the app coach, with the child informed and agreeing" : "excludes the child's private chat with the app coach"}.`,
    `Identifying: first name ${s.full_name.split(" ")[0]}, male, ${age}, American-curriculum international school in Egypt plus Egyptian Ministry subjects in Arabic. Family: Muslim; the app logs prayer times. Target exam: ${s.target_exam ?? "none"}.`,
    `Parent's reason for referral (verbatim): ${reason || "not stated"}`,
    learnerPromptLine(s.learner_profile) ? `Learner intake (non-validated self-report, once): ${learnerPromptLine(s.learner_profile)}` : "Learner intake: not completed.",
    `Screening and questionnaire responses (WHO-5 is validated; pulse, mindset, habits are app questionnaires):\n${instrumentLines.join("\n") || "none in period"}`,
    `Academic functioning (${PERIOD_DAYS} days): check-ins ${stats.checkins}, current streak ${stats.streak} days, minutes studied at home (self-reported) ${stats.minutesStudied}. Subjects: ${stats.subjects.map((x) => `${x.subject}: ${x.sets} sets, avg ${x.pct ?? "n/a"}%${x.trend ? `, trend ${x.trend}` : ""}, planned quizzes done ${x.plannedDone}/${x.planned}, class notes ${x.notesLogged}${x.weakest.length ? `, weakest ${x.weakest.join("; ")}` : ""}`).join(" || ")}. Exam prep: ${stats.exam.sets} sets${stats.exam.pct !== null ? `, avg ${stats.exam.pct}%` : ""}.`,
    `Things the child wrote he was stuck on (check-in field): ${stats.stuckOn.join(" | ") || "none"}.`,
    `Prayer logging: ${stats.prayersOnTimeRate === null ? "not logged" : `${stats.prayersOnTimeRate}% of logged prayers on time`}. Quran/hadith memorisation items: ${(memorize ?? []).length} (${(memorize ?? []).reduce((a, m) => a + (m.sessions ?? 0), 0)} sessions).`,
    `Safety flags raised by the app: ${(alerts ?? []).map((a) => `${a.created_at.slice(0, 10)} ${a.level} ${a.category} (parent notified: ${a.notified ? "yes" : "no"}; acknowledged: ${a.acknowledged_at ? a.acknowledged_at.slice(0, 10) : "no"})`).join("; ") || "none"}.`,
    `Machine-generated coach notes (one-liners written by the AI after chats/check-ins; unverified): ${(notes ?? []).map((n) => `${n.created_at.slice(0, 10)} [${n.source}] ${n.note}`).join(" | ") || "none"}.`,
    scope === "with_chat_themes"
      ? `Private chat with the app coach (${(chat ?? []).length} turns). Summarise THEMES only, no quotes. Risk classifications per child turn are included:\n${(chat ?? []).map((m) => `${m.created_at.slice(0, 16)} ${m.role}${m.risk_level ? ` [risk:${m.risk_level}]` : ""}: ${m.content.slice(0, 400)}`).join("\n") || "no messages"}`
      : "Private chat with the app coach: EXCLUDED at the family's choice. State this.",
  ].join("\n\n");

  const attention = await computeAttention(studentId);
  const { data: snapshots } = await admin.from("attention_snapshots").select("taken_on, tier, score, signals").eq("student_id", studentId).gte("taken_on", periodStart).order("taken_on");
  const signalsBlock = `

Rule-based early-warning signals (deterministic, non-clinical, sensitive by design). Today: tier ${attention.tier}, score ${attention.score}: ${attention.signals.map((x) => `${x.label} [${x.pillar}]`).join("; ") || "none"}. Nightly history: ${(snapshots ?? []).map((r) => `${r.taken_on} ${r.tier} (${r.score})`).join(", ") || "none yet"}.`;
  const { content, model } = await draftClinicianSummary(payload + signalsBlock);
  const { data, error } = await admin
    .from("clinician_reports")
    .insert({
      student_id: studentId,
      family_id: familyId,
      scope,
      reason: reason || null,
      period_start: periodStart,
      period_end: stats.today,
      content_md: content,
      data: { instruments: rows.map((r) => ({ instrument: r.instrument, taken_on: r.taken_on, score: r.score, band: r.band })), alerts: alerts ?? [], subjects: stats.subjects, notesCount: (notes ?? []).length, chatTurns: (chat ?? []).length },
      model,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the summary.");
  return data.id as string;
}
