import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { LearnerQuiz } from "@/components/LearnerQuiz";
import type { LearnerProfile } from "@/lib/learner";

export default async function AboutMePage() {
  const { profile } = await requireStudent();
  const lp = (profile as { learner_profile?: LearnerProfile | null }).learner_profile ?? null;
  return (
    <main className="space-y-4">
      <Link href="/me" className="text-sm muted">← Me</Link>
      <header className="card">
        <h1 className="h1">🦸 Tell your coach about you</h1>
        <p className="text-sm muted mt-1">Ten quick questions, no right answers. Your coach, the lessons and the quiz explanations adapt to how you like to learn. First time pays +15.</p>
      </header>
      <LearnerQuiz initial={lp?.answers ?? {}} />
    </main>
  );
}
