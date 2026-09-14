import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { EXAM_INFO, scaledEstimate, sectionsFor, trackFor } from "@/lib/exams";
import { masteryMaps, masteryColor, type AttemptWithQuiz } from "@/lib/mastery";
import { PracticeButton } from "@/components/LearnButtons";
import type { Topic } from "@/lib/types";

export const maxDuration = 60;

export default async function LearnPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const exam: "ACT" | "SAT" | null = profile.target_exam === "SAT" ? "SAT" : profile.target_exam === "ACT" || (profile.grade ?? 0) >= 9 ? "ACT" : null;
  const examTrack = exam ? trackFor(exam) : null;

  const [{ data: topics }, { data: attempts }, { count: dueCount }] = await Promise.all([
    supabase.from("topics").select("*").or(`grade.eq.${profile.grade ?? 0},track.eq.act,track.eq.sat`).order("subject").order("sort"),
    supabase.from("attempts").select("*, quizzes(topic_id, act_section, track, title)").eq("student_id", profile.id).not("submitted_at", "is", null),
    supabase.from("review_queue").select("id", { count: "exact", head: true }).eq("student_id", profile.id).lte("due_date", today),
  ]);
  const all = (topics ?? []) as Topic[];
  const school = all.filter((t) => t.track === "school");
  const examTopics = all.filter((t) => t.track === examTrack);
  const { topic: mastery, section: sectionMastery } = masteryMaps((attempts ?? []) as AttemptWithQuiz[]);
  const subjects = [...new Set(school.map((t) => t.subject))];
  const weakest = school
    .filter((t) => mastery.has(t.id) && (mastery.get(t.id) ?? 0) < 70)
    .sort((a, b) => (mastery.get(a.id) ?? 0) - (mastery.get(b.id) ?? 0))
    .slice(0, 3);
  const daysToExam = profile.target_exam_date ? Math.ceil((new Date(profile.target_exam_date).getTime() - new Date(today).getTime()) / 86400000) : null;

  return (
    <main className="space-y-4">
      <h1 className="h1">Learn</h1>

      {(dueCount ?? 0) > 0 && (
        <Link href="/review" className="card flex items-center gap-3 border-accent/50">
          <span className="text-3xl">🔁</span>
          <div className="flex-1">
            <div className="font-bold">{dueCount} question{dueCount === 1 ? "" : "s"} to review</div>
            <div className="text-xs muted">Questions you missed, back at the right time. Quick points.</div>
          </div>
          <span className="btn-primary btn-sm">Start</span>
        </Link>
      )}

      {weakest.length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">🎯 Work on these</h2>
          <ul className="space-y-1 text-sm">
            {weakest.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <Link href={`/learn/topic/${t.id}`} className="flex-1 hover:text-accent-2">{t.subject}: {t.name}</Link>
                <span className="badge text-warn">{mastery.get(t.id)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {exam && (
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="h2">🎓 {exam} prep</h2>
            {daysToExam !== null && <span className="badge text-accent-2">{daysToExam} days to go</span>}
          </div>
          <p className="text-xs muted">{EXAM_INFO[exam].blurb} Each set here is 8 timed questions.</p>
          <div className="grid grid-cols-2 gap-2">
            {sectionsFor(exam).map(([key, s]) => {
              const m = sectionMastery.get(key);
              const est = scaledEstimate(exam, m ?? null);
              return (
                <div key={key} className="rounded-xl border border-line p-3 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">{s.label}{s.optional ? "*" : ""}</span>
                    <span className="text-xs muted">{est !== null ? `~${est}` : "no data"}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden"><div className={`h-full ${masteryColor(m)}`} style={{ width: `${m ?? 0}%` }} /></div>
                  <PracticeButton actSection={key} label="Mixed set" className="btn-ghost btn-sm w-full" />
                </div>
              );
            })}
          </div>
          <details>
            <summary className="cursor-pointer text-sm muted">Practice one {exam} skill at a time</summary>
            <ul className="mt-2 divide-y divide-line">
              {examTopics.map((t) => (
                <li key={t.id} className="py-2 flex items-center gap-2 text-sm">
                  <Link href={`/learn/topic/${t.id}`} className="flex-1 hover:text-accent-2">
                    <span className="muted">{t.subject.replace(`${exam} `, "")} · </span>{t.name}
                  </Link>
                  {mastery.has(t.id) && <span className={`w-2 h-2 rounded-full ${masteryColor(mastery.get(t.id))}`} />}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {subjects.map((subject) => {
        const list = school.filter((t) => t.subject === subject);
        const scores = list.map((t) => mastery.get(t.id)).filter((m): m is number => m !== undefined);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        return (
          <section key={subject} className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="h2">{subject}</h2>
              <span className="text-xs muted">{scores.length}/{list.length} practised{avg !== null ? ` · avg ${avg}%` : ""}</span>
            </div>
            <ul className="divide-y divide-line">
              {list.map((t) => (
                <li key={t.id}>
                  <Link href={`/learn/topic/${t.id}`} className="py-2 flex items-center gap-3 hover:text-accent-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${masteryColor(mastery.get(t.id))}`} />
                    <span className="flex-1 text-sm">{t.name}</span>
                    {t.unit && <span className="text-xs muted hidden sm:inline">{t.unit}</span>}
                    {mastery.has(t.id) && <span className="text-xs font-semibold">{mastery.get(t.id)}%</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {subjects.length === 0 && <p className="card muted">No curriculum loaded for grade {profile.grade}. Ask your parent to add topics.</p>}
    </main>
  );
}
