import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { secondsPerQuestion } from "@/lib/exams";
import { prettyDate, todayIn } from "@/lib/dates";
import { QuizRunner } from "@/components/QuizRunner";
import { NotTakenButton } from "@/components/NotTakenButton";
import { ensureAttempt } from "@/lib/learning/attempts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Quiz, QuizQuestion } from "@/lib/types";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", id).eq("student_id", profile.id).single();
  if (!quiz) notFound();
  const q = quiz as Quiz;
  const today = todayIn(family.timezone);
  if (q.scheduled_for && q.scheduled_for > today) {
    return (
      <main className="card space-y-2 text-center">
        <div className="text-5xl">🔒</div>
        <p className="h2">Unlocks {prettyDate(q.scheduled_for)}</p>
        <p className="text-sm muted">One planned quiz per day keeps the streak honest. Today&apos;s quiz is on your home page.</p>
        <a href="/today" className="btn-primary">Back to today</a>
      </main>
    );
  }
  const { data: questions } = await supabase.from("quiz_questions").select("id, quiz_id, position, prompt, choices, skill_tag").eq("quiz_id", id).order("position");
  if (!questions || questions.length === 0) {
    return (
      <main className="card space-y-2">
        <p className="h2">This set has no questions</p>
        <p className="text-sm muted">Generation was interrupted. Go back and start a new set.</p>
        <a href={q.topic_id ? `/learn/topic/${q.topic_id}` : q.material_id ? "/learn?tab=files" : "/learn"} className="btn-primary">Back</a>
      </main>
    );
  }
  const backHref = q.scheduled_for ? "/today" : q.topic_id ? `/learn/topic/${q.topic_id}` : q.material_id ? "/learn?tab=files" : "/learn";

  // Checkpoints: one attempt, a running clock that survives reloads (it starts with the attempt, not the page).
  let attemptId: string | null = null;
  let deadlineMs: number | null = null;
  if (q.checkpoint_id) {
    const admin = createAdminClient();
    const { data: done } = await admin.from("attempts").select("score, total").eq("quiz_id", id).eq("student_id", profile.id).not("submitted_at", "is", null).limit(1).maybeSingle();
    if (done) {
      return (
        <main className="card space-y-2 text-center">
          <div className="text-5xl">🎯</div>
          <p className="h2">Checkpoint done: {done.score} / {done.total}</p>
          <p className="text-sm muted">One attempt only, so the score stands. Missed questions are in your Review queue.</p>
          <a href="/today" className="btn-primary">Back to today</a>
        </main>
      );
    }
    attemptId = await ensureAttempt(id);
    const { data: att } = await admin.from("attempts").select("started_at").eq("id", attemptId).single();
    deadlineMs = new Date(att!.started_at).getTime() + (q.time_limit_min ?? 20) * 60000;
  }

  const { data: topicRow } = q.topic_id ? await supabase.from("topics").select("id, name").eq("id", q.topic_id).maybeSingle() : { data: null };
  return (
    <main className="space-y-3" dir={q.language === "ar" ? "rtl" : undefined} lang={q.language === "ar" ? "ar" : undefined}>
      {topicRow && !q.checkpoint_id && <NotTakenButton topicId={topicRow.id} topicName={topicRow.name} />}
      <QuizRunner
        attemptId={attemptId}
        quizId={id}
        deadlineMs={deadlineMs}
        questions={((questions ?? []) as QuizQuestion[]).map((x) => ({ id: x.id, prompt: x.prompt, choices: x.choices }))}
        passage={q.passage}
        paceSeconds={q.act_section ? secondsPerQuestion(q.act_section) : null}
        kind="quiz"
        backHref={backHref}
        title={q.title}
      />
    </main>
  );
}
