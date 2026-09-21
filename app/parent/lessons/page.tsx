import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { LessonReview } from "@/components/LessonReview";
import { reviewQueue } from "@/lib/teaching/queue";

export const dynamic = "force-dynamic";

/**
 * Lessons the reviewer would not release, waiting on a person.
 *
 * This is the one judgement the teaching model hands to a parent rather than to a model, and it is the only
 * thing on the old Progress page that was not about one child: a lesson is cached per topic and per grade, so
 * it belongs to whichever of them reaches that topic next. That is why it gets its own page rather than a
 * section on a child's.
 */
export default async function LessonsPage() {
  const { family } = await requireParent();
  const toReview = await reviewQueue(family.id);

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">Lessons to check</h1>
        <Link href="/parent" className="btn-ghost btn-sm">← Home</Link>
      </div>
      <p className="muted text-sm">
        A lesson the reviewer was not confident about is never stored, so no child has read it. Release it, or send
        it back with what was wrong — what you write is given to the model before it tries that topic again.
      </p>
      {toReview.length === 0
        ? <p className="card text-sm muted">Nothing waiting. Every lesson written so far passed its checks.</p>
        : <LessonReview items={toReview} />}
    </main>
  );
}
