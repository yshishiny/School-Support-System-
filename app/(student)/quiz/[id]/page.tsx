import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ensureAttempt } from "@/lib/actions/learning";
import { secondsPerQuestion } from "@/lib/exams";
import { QuizRunner } from "@/components/QuizRunner";
import type { Quiz, QuizQuestion } from "@/lib/types";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const { data: quiz } = await supabase.from("quizzes").select("*").eq("id", id).eq("student_id", profile.id).single();
  if (!quiz) notFound();
  const q = quiz as Quiz;
  const { data: questions } = await supabase.from("quiz_questions").select("id, quiz_id, position, prompt, choices, skill_tag").eq("quiz_id", id).order("position");
  if (!questions || questions.length === 0) {
    return (
      <main className="card space-y-2">
        <p className="h2">This set has no questions</p>
        <p className="text-sm muted">Generation was interrupted. Go back and start a new set.</p>
        <a href={q.topic_id ? `/learn/topic/${q.topic_id}` : "/learn"} className="btn-primary">Back</a>
      </main>
    );
  }
  const attemptId = await ensureAttempt(id);
  const backHref = q.topic_id ? `/learn/topic/${q.topic_id}` : "/learn";

  return (
    <main className="space-y-3">
      <QuizRunner
        attemptId={attemptId}
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
