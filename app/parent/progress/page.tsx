import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { EXAM_INFO, examsFor, scaledEstimate, sectionsFor } from "@/lib/exams";
import { masteryMaps, masteryColor, type AttemptWithQuiz } from "@/lib/mastery";
import { setTargetExamAction } from "@/lib/actions/learning";
import type { Profile, Topic } from "@/lib/types";
import { subjectEmoji, subjectLabel } from "@/lib/plan";
import ReactMarkdown from "react-markdown";
import { CoachButton } from "@/components/CoachButton";
import type { CoachReport } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { wellbeingStatus, type CheckHistoryRow } from "@/lib/wellbeing";
import { computeAttention, type AttentionResult } from "@/lib/coach/signals-run";

export default async function ProgressPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const { data: kids } = await supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const students = (kids ?? []) as Profile[];
  const ids = students.map((s) => s.id);
  const [{ data: topics }, { data: attempts }, { data: due }, { data: coachRows }] = await Promise.all([
    supabase.from("topics").select("*").order("subject").order("sort"),
    ids.length ? supabase.from("attempts").select("*, quizzes(topic_id, act_section, track, title)").in("student_id", ids).not("submitted_at", "is", null).order("submitted_at", { ascending: false }) : { data: [] },
    ids.length ? supabase.from("review_queue").select("student_id").in("student_id", ids).lte("due_date", today) : { data: [] },
    ids.length ? supabase.from("coach_reports").select("*").in("student_id", ids).order("created_at", { ascending: false }) : { data: [] },
  ]);
  // Wellbeing: parents get a traffic light only. Answers stay with the child (RLS), so this uses the service role and discards them.
  const admin = createAdminClient();
  const { data: wbRows } = ids.length ? await admin.from("wellbeing_checks").select("student_id, instrument, taken_on, band, score").in("student_id", ids).order("taken_on", { ascending: false }).limit(300) : { data: [] };
  const wellbeingByStudent = new Map<string, ReturnType<typeof wellbeingStatus>>();
  for (const s of students) wellbeingByStudent.set(s.id, wellbeingStatus(((wbRows ?? []) as (CheckHistoryRow & { student_id: string })[]).filter((r) => r.student_id === s.id), today));
  const attentionByStudent = new Map<string, AttentionResult>();
  await Promise.all(students.map(async (s) => attentionByStudent.set(s.id, await computeAttention(s.id).catch(() => ({ today, score: 0, tier: "none" as const, signals: [] })))));
  const coachByStudent = new Map<string, CoachReport>();
  for (const r of (coachRows ?? []) as CoachReport[]) if (!coachByStudent.has(r.student_id)) coachByStudent.set(r.student_id, r);
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
        const coach = coachByStudent.get(s.id) ?? null;
        return (
          <section key={s.id} className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{s.avatar_emoji}</div>
              <div className="flex-1">
                <div className="font-bold">{s.full_name} <span className="muted font-normal text-sm">· Grade {s.grade}</span></div>
                <div className="text-xs muted">{thisWeek.length} sets this week · {dueCount} reviews due · {mine.length} sets total</div>
              </div>
            </div>

            {(() => {
              const w = wellbeingByStudent.get(s.id)!;
              const light = w.band === "green" ? "🟢" : w.band === "amber" ? "🟡" : w.band === "red" ? "🔴" : "⚪";
              return (
                <div className="rounded-xl border border-line p-3 text-sm flex items-center gap-3">
                  <span className="text-2xl">{light}</span>
                  <div className="flex-1">
                    <div className="font-semibold">Wellbeing check-ins <span className="muted font-normal">· {w.checks} in the last 5 weeks</span></div>
                    <div className="muted text-xs">{w.note} You see this light only; his answers and his chat with the coach stay private unless there is danger.</div>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const a = attentionByStudent.get(s.id)!;
              const icon = a.tier === "red" ? "🚨" : a.tier === "amber" ? "🟡" : a.tier === "watch" ? "👀" : "🟢";
              const pillars = { wellbeing: "Wellbeing", mindset: "Mindset", body: "Body & habits", engagement: "Engagement", safety: "Safety" } as const;
              return (
                <div className={`rounded-xl border p-3 text-sm space-y-1 ${a.tier === "none" ? "border-line" : a.tier === "watch" ? "border-accent/50" : a.tier === "amber" ? "border-warn/60" : "border-bad"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold">Early signals <span className="muted font-normal">· last 14 days · {a.tier === "none" ? "nothing to watch" : a.tier === "watch" ? "worth a look, not urgent" : a.tier === "amber" ? "talk this week" : "needs attention now"}</span></div>
                      <div className="muted text-xs">Rule-based and deliberately sensitive. Labels only; it never shows his answers. You and, if it persists, a professional decide what it means.</div>
                    </div>
                  </div>
                  {a.signals.length > 0 && (
                    <ul className="text-xs space-y-0.5 pl-1">
                      {a.signals.map((x) => (
                        <li key={x.code}><span className="badge mr-1">{pillars[x.pillar]}</span>{x.label}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}

            <div className="rounded-xl border border-accent/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">🦸 Coach&apos;s analysis</span>
                <div className="flex items-center gap-2">
                  <a href={`/parent/clinician/${s.id}`} className="text-xs muted underline" title="Summary for a psychiatrist or psychologist">For a professional</a>
                  <CoachButton studentId={s.id} hasReport={!!coach} />
                </div>
              </div>
              {coach ? (
                <>
                  <p className="text-sm font-medium">{coach.headline}</p>
                  <p className="text-[11px] muted">{coach.period_start} → {coach.period_end}</p>
                  {coach.data.focus.length > 0 && (
                    <ul className="text-sm space-y-1">
                      {coach.data.focus.map((f) => (
                        <li key={f.subject} className="rounded-lg bg-warn/10 border border-warn/30 p-2">
                          <b>Needs practice: {subjectEmoji(f.subject)} {subjectLabel(f.subject)}</b> · {f.why}
                          {f.foundation.length > 0 && <div className="text-xs muted mt-0.5">Foundations: {f.foundation.join(" · ")}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {coach.data.accelerate.length > 0 && (
                    <ul className="text-sm space-y-1">
                      {coach.data.accelerate.map((a) => (
                        <li key={a.subject} className="rounded-lg bg-good/10 border border-good/30 p-2"><b>Push harder: {subjectEmoji(a.subject)} {subjectLabel(a.subject)}</b> · {a.plan}</li>
                      ))}
                    </ul>
                  )}
                  <details className="text-sm">
                    <summary className="cursor-pointer muted">Full report</summary>
                    <div className="prose-lesson mt-2"><ReactMarkdown>{coach.parent_md}</ReactMarkdown></div>
                    <div className="text-xs muted mt-2">Quiz levels now: {Object.entries(coach.levels).map(([k, v]) => `${subjectLabel(k)} ${v}`).join(" · ") || "medium everywhere"}</div>
                  </details>
                </>
              ) : (
                <p className="text-xs muted">Runs every week by itself once there is data. Press to get a first analysis now: which subjects need foundations, where to push harder, and a note for {s.full_name.split(" ")[0]}.</p>
              )}
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
                    <div className="text-sm font-semibold mb-1">{subjectEmoji(subject)} {subjectLabel(subject)}</div>
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
