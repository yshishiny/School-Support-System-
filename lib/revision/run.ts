/**
 * Monthly revision: from the 25th, one sheet and one 12-question quiz per subject that had school files this
 * month. Idempotent per (student, month, subject); runs from the nightly job and from a parent's button.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { generateQuiz } from "@/lib/ai/generate-quiz";
import { writeRevisionSheet } from "@/lib/ai/revision-sheet";
import { isRevisionTime, monthOf } from "@/lib/materials/study";
import { learnerPromptLine } from "@/lib/learner";
import { logError } from "@/lib/ops/log";

export interface RevisionRow { id: string; student_id: string; month: string; subject: string; material_ids: string[]; content_md: string | null; quiz_id: string | null; status: "new" | "ready" | "failed"; error: string | null; created_at: string }

export async function buildMonthlyRevisions(today: string, opts: { force?: boolean; studentId?: string; budgetMs?: number } = {}): Promise<string[]> {
  if (!opts.force && !isRevisionTime(today)) return [];
  const admin = createAdminClient();
  const started = Date.now();
  const month = monthOf(today);
  const out: string[] = [];
  let q = admin.from("profiles").select("id, family_id, grade, learner_profile, interests, full_name").eq("role", "student");
  if (opts.studentId) q = q.eq("id", opts.studentId);
  const { data: students } = await q;
  for (const s of students ?? []) {
    if (Date.now() - started > (opts.budgetMs ?? 200_000)) break;
    const { data: mats } = await admin.from("materials").select("id, subject, title, digest, language, created_at").eq("student_id", s.id).eq("status", "ready").not("digest", "is", null).gte("created_at", `${month}T00:00:00Z`);
    const bySubject = new Map<string, { id: string; title: string; digest: string; language: string }[]>();
    for (const m of (mats ?? []) as { id: string; subject: string | null; title: string; digest: string; language: string | null; created_at: string }[]) {
      const key = (m.subject ?? "General").trim();
      bySubject.set(key, [...(bySubject.get(key) ?? []), { id: m.id, title: m.title, digest: m.digest, language: m.language ?? "english" }]);
    }
    for (const [subject, list] of bySubject) {
      if (Date.now() - started > (opts.budgetMs ?? 200_000)) break;
      const { data: existing } = await admin.from("revision_sheets").select("id, status").eq("student_id", s.id).eq("month", month).eq("subject", subject).maybeSingle();
      if (existing && existing.status === "ready") continue;
      const language: "en" | "ar" = list.every((m) => m.language === "arabic") ? "ar" : "en";
      const { data: row } = existing ? { data: existing } : await admin.from("revision_sheets").insert({ student_id: s.id, family_id: s.family_id, month, subject, material_ids: list.map((m) => m.id) }).select("id, status").single();
      if (!row) continue;
      try {
        const [sheet, quiz] = await Promise.all([
          writeRevisionSheet({ subject, month: month.slice(0, 7), grade: s.grade, language, digests: list.map((m) => ({ title: m.title, digest: m.digest })) }),
          generateQuiz({ track: "school", grade: s.grade, subject, unit: null, topic: `Monthly revision: ${list.map((m) => m.title).join("; ").slice(0, 200)}`, actSection: null, difficulty: "medium", count: 12, weakSkills: [], avoidPrompts: [], language, sourceText: list.map((m) => `## ${m.title}\n${m.digest}`).join("\n\n").slice(0, 60_000), interests: s.interests, learner: learnerPromptLine(s.learner_profile) }),
        ]);
        const { data: qz, error } = await admin.from("quizzes").insert({ student_id: s.id, topic_id: null, track: "school", title: `Monthly revision · ${subject} · ${month.slice(0, 7)}`, passage: quiz.passage, difficulty: "medium", language, scheduled_for: today, plan_slot: `revision:${subject}` }).select("id").single();
        if (error || !qz) throw new Error(error?.message ?? "Could not save the revision quiz.");
        const { data: questions, error: qErr } = await admin.from("quiz_questions").insert(quiz.questions.map((qq, i) => ({ quiz_id: qz.id, position: i + 1, prompt: qq.prompt, choices: qq.choices, skill_tag: qq.skill_tag }))).select("id, position");
        if (qErr || !questions) throw new Error(qErr?.message ?? "Could not save the questions.");
        await admin.from("quiz_answer_keys").insert(questions.map((r) => ({ question_id: r.id, correct_index: quiz.questions[r.position - 1].correct_index, explanation: quiz.questions[r.position - 1].explanation })));
        await admin.from("revision_sheets").update({ status: "ready", content_md: sheet.content, quiz_id: qz.id, model: sheet.model, error: null, material_ids: list.map((m) => m.id) }).eq("id", row.id);
        out.push(`${s.full_name.split(" ")[0]} · ${subject}: ready`);
      } catch (err) {
        await admin.from("revision_sheets").update({ status: "failed", error: err instanceof Error ? err.message : String(err) }).eq("id", row.id);
        await logError("revision.build", err, { familyId: s.family_id, userId: s.id, meta: { subject, month } });
        out.push(`${s.full_name.split(" ")[0]} · ${subject}: error`);
      }
    }
  }
  return out;
}

export async function loadRevisions(studentIds: string[], limit = 30): Promise<RevisionRow[]> {
  if (!studentIds.length) return [];
  const admin = createAdminClient();
  const { data } = await admin.from("revision_sheets").select("id, student_id, month, subject, material_ids, content_md, quiz_id, status, error, created_at").in("student_id", studentIds).order("month", { ascending: false }).order("subject").limit(limit);
  return (data ?? []) as RevisionRow[];
}
