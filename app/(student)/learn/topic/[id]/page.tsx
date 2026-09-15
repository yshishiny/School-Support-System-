import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExplainButton, PracticeButton } from "@/components/LearnButtons";
import { masteryFor } from "@/lib/learning";
import type { Topic } from "@/lib/types";

export const maxDuration = 300;

export default async function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const { data: topic } = await supabase.from("topics").select("*").eq("id", id).single();
  if (!topic) notFound();
  const t = topic as Topic;
  const grade = t.track === "school" ? (t.grade ?? profile.grade) : null;
  const [{ data: lesson }, { data: quizzes }] = await Promise.all([
    supabase.from("lessons").select("content_md").eq("topic_id", id).filter("grade", grade === null ? "is" : "eq", grade).maybeSingle(),
    supabase.from("quizzes").select("id, title, created_at, attempts(score, total, submitted_at, flagged)").eq("topic_id", id).eq("student_id", profile.id).order("created_at", { ascending: false }),
  ]);
  type QZ = { id: string; title: string; created_at: string; attempts: { score: number | null; total: number | null; submitted_at: string | null; flagged: boolean }[] };
  const list = (quizzes ?? []) as QZ[];
  // (sets that failed mid-generation are deleted by the action; nothing else to filter)
  const done = list.flatMap((q) => q.attempts).filter((a) => a.submitted_at && a.total && !a.flagged) as { score: number; total: number; submitted_at: string }[];
  const mastery = masteryFor(done);

  return (
    <main className="space-y-4">
      <Link href="/learn" className="text-sm muted">← Learn</Link>
      <header className="card">
        <div className="text-xs muted">{t.subject}{t.unit ? ` · ${t.unit}` : ""}</div>
        <h1 className="h1">{t.name}</h1>
        {t.description && <p className="muted text-sm mt-1">{t.description}</p>}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-2 rounded-full bg-panel-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${mastery ?? 0}%` }} /></div>
          <span className="text-sm font-semibold">{mastery !== null ? `${mastery}%` : "not yet practised"}</span>
        </div>
      </header>

      <section className="card space-y-2">
        <h2 className="h2">Practice</h2>
        <p className="text-xs muted">8 fresh questions each time, with an explanation after every answer. New sets focus on what you got wrong before.</p>
        <div className="grid grid-cols-3 gap-2">
          <PracticeButton topicId={t.id} difficulty="easy" label="Easy" className="btn-ghost w-full" />
          <PracticeButton topicId={t.id} difficulty="medium" label="Medium" className="btn-primary w-full" />
          <PracticeButton topicId={t.id} difficulty="hard" label="Hard" className="btn-ghost w-full" />
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">Lesson</h2>
        {lesson ? (
          <article className="prose-lesson text-sm leading-relaxed space-y-2">
            <ReactMarkdown>{lesson.content_md}</ReactMarkdown>
          </article>
        ) : (
          <>
            <p className="text-sm muted">Missed this at school, or did not get it? Get a plain-English explanation with worked examples.</p>
            <ExplainButton topicId={t.id} />
          </>
        )}
      </section>

      {list.length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">Your sets</h2>
          <ul className="text-sm divide-y divide-line">
            {list.map((q) => {
              const a = q.attempts.find((x) => x.submitted_at);
              return (
                <li key={q.id} className="py-2 flex items-center justify-between gap-2">
                  <span className="flex-1">{q.title}</span>
                  {a ? (
                    <span className={`badge ${a.flagged ? "text-warn" : ""}`}>{a.score}/{a.total}{a.flagged ? " ⚠️" : ""}</span>
                  ) : (
                    <Link href={`/quiz/${q.id}`} className="btn-ghost btn-sm">Continue</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
