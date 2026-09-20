import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { startReviewAttempt } from "@/lib/learning/attempts";
import { QuizRunner } from "@/components/QuizRunner";

export default async function ReviewPage() {
  await requireStudent();
  const review = await startReviewAttempt(10);
  if (!review) {
    return (
      <main className="space-y-4">
        <h1 className="h1">Review</h1>
        <div className="card text-center space-y-2">
          <div className="text-4xl">✨</div>
          <p>Nothing due right now. Questions you miss in practice come back here on a schedule.</p>
          <Link href="/learn" className="btn-primary">Go practise</Link>
        </div>
      </main>
    );
  }
  const supabase = await createClient();
  const { data: questions } = await supabase.from("quiz_questions").select("id, prompt, choices, quizzes(passage)").in("id", review.questionIds);
  type Row = { id: string; prompt: string; choices: string[]; quizzes: { passage: string | null } | null };
  const order = new Map(review.questionIds.map((id, i) => [id, i]));
  const list = ((questions ?? []) as unknown as Row[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return (
    <main className="space-y-3">
      <h1 className="h1">Review</h1>
      <QuizRunner
        attemptId={review.attemptId}
        questions={list.map((x) => ({ id: x.id, prompt: x.prompt, choices: x.choices, passage: x.quizzes?.passage ?? null }))}
        passage={null}
        paceSeconds={null}
        kind="review"
        backHref="/learn"
        title="Review session"
      />
    </main>
  );
}
