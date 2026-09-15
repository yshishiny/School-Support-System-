import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { EXAM_INFO, examsFor, scaledEstimate, sectionsFor } from "@/lib/exams";
import { masteryMaps, masteryColor, type AttemptWithQuiz } from "@/lib/mastery";
import { setTargetExamAction } from "@/lib/actions/learning";
import type { Profile, Topic } from "@/lib/types";
import { subjectLabel } from "@/lib/plan";

export default async function ProgressPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const { data: kids } = await supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const students = (kids ?? []) as Profile[];
  const ids = students.map((s) => s.id);
  const [{ data: topics }, { data: attempts }, { data: due }] = await Promise.all([
    supabase.from("topics").select("*").order("subject").order("sort"),
    ids.length ? supabase.from("attempts").select("*, quizzes(topic_id, act_section, track, title)").in("student_id", ids).not("submitted_at", "is", null).order("submitted_at", { ascending: false }) : { data: [] },
    ids.length ? supabase.from("review_queue").select("student_id").in("student_id", ids).lte("due_date", today) : { data: [] },
  ]);
  const allTopics = (topics ?? []) as Topic[];
  const allAttempts = (attempts ?? []) as AttemptWithQuiz[];

  return (
    <main className="space-y-4">
      <h1 className="h1">Progress</h1>
      {students.map((s) => {
        const mine = allAttempts.filter((a) => a.student_id === s.id);
        const { topic: mastery, section } = masteryMaps(mine);
        const school = allTopics.filter((t) => t.track === "school" && t.grade === s.grade);
        const subjects = [...new Set(school.map((t) => t.subject))];
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const thisWeek = mine.filter((a) => a.submitted_at! >= weekAgo);
        const flagged = mine.filter((a) => a.flagged).slice(0, 5);
        const dueCount = (due ?? []).filter((d) => d.student_id === s.id).length;
        const exams = examsFor(s.target_exam, s.grade);
        return (
          <section key={s.id} className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{s.avatar_emoji}</div>
              <div className="flex-1">
                <div className="font-bold">{s.full_name} <span className="muted font-normal text-sm">· Grade {s.grade}</span></div>
                <div className="text-xs muted">{thisWeek.length} sets this week · {dueCount} reviews due · {mine.length} sets total</div>
              </div>
            </div>

            {exams.map((exam) => (
              <div key={exam} className="rounded-xl border border-line p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">🎓 {exam} readiness</span>
                  {s.target_exam_date && <span className="text-xs muted">target {s.target_exam_date}</span>}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {sectionsFor(exam).map(([k, sec]) => {
                    const m = section.get(k);
                    return (
                      <div key={k}>
                        <div className="text-lg font-extrabold">{m !== undefined ? `~${scaledEstimate(exam, m)}` : "–"}</div>
                        <div className="muted">{sec.label}</div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] muted">Estimates from practice sets ({EXAM_INFO[exam].scale}). Real scores depend on full timed tests.</p>
              </div>
            ))}
            {section.has("mixed") && <p className="text-xs muted">SAT + ACT mixed sets: {section.get("mixed")}% correct.</p>}

            <div className="space-y-2">
              {subjects.map((subject) => {
                const list = school.filter((t) => t.subject === subject);
                return (
                  <div key={subject}>
                    <div className="text-sm font-semibold mb-1">{subjectLabel(subject)}</div>
                    <div className="flex flex-wrap gap-1">
                      {list.map((t) => (
                        <span key={t.id} title={`${t.name}: ${mastery.has(t.id) ? mastery.get(t.id) + "%" : "not practised"}`} className={`h-4 w-4 rounded ${masteryColor(mastery.get(t.id))}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] muted">Each square is a topic: green 80%+, yellow 50-79%, red below 50%, grey not practised. Hover for names.</p>
            </div>

            {flagged.length > 0 && (
              <div className="rounded-xl border border-warn/40 p-3 text-sm space-y-1">
                <div className="font-semibold text-warn">⚠️ Flagged attempts</div>
                {flagged.map((a) => (
                  <div key={a.id} className="text-xs">{a.submitted_at?.slice(0, 10)} · {a.quizzes?.title ?? "review"} · {a.score}/{a.total} · {a.flag_reason}</div>
                ))}
              </div>
            )}

            <form action={setTargetExamAction} className="grid grid-cols-5 gap-2 items-end">
              <input type="hidden" name="student_id" value={s.id} />
              <div className="col-span-2">
                <label className="label">Target exam</label>
                <select name="target_exam" className="input" defaultValue={s.target_exam ?? ""}>
                  <option value="">None</option>
                  <option value="ACT">ACT</option>
                  <option value="SAT">SAT</option>
                  <option value="BOTH">Both SAT and ACT</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Exam date</label>
                <input name="target_exam_date" type="date" className="input" defaultValue={s.target_exam_date ?? ""} />
              </div>
              <button className="btn-ghost btn-sm">Save</button>
            </form>
          </section>
        );
      })}
    </main>
  );
}
