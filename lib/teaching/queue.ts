import { createAdminClient } from "@/lib/supabase/admin";
import { attempt } from "@/lib/ops/fault";
import { checks, type CurriculumTopic } from "./fluency";
import { levelOf, type Level } from "@/lib/levels";

/**
 * What a parent is being asked about.
 *
 * Two different things arrive here and they need different words. A **held** lesson failed a blocking check and was
 * never stored, so no child has seen it — the parent is being told, not asked. A **warned** lesson passed every
 * blocking check and is being read right now, with one thing the review was unsure about — there the parent is
 * genuinely being asked, and their answer is the only thing that can settle it.
 *
 * Held lessons are not in `lessons` by design: nothing that fails a blocking check is ever written to the cache.
 * They are recovered from the operations log, which is the only record they existed.
 */
export type ItemKind = "held" | "warned";

export interface ReviewItem {
  kind: ItemKind;
  /** Present for a warned lesson, which exists; absent for a held one, which does not. */
  lessonId: string | null;
  topicId: string;
  topic: string;
  subject: string;
  unit: string | null;
  grade: number | null;
  level: Level;
  language: string;
  /** The sentences the failed checks actually asked, resolved here so the client imports none of this. */
  failed: { id: string; question: string }[];
  at: string;
  /** The reference a held lesson was logged under, so it can be found in Admin. */
  ref: string | null;
}

/** The sentences the check ids stood for, so a parent reads questions rather than slugs. */
function questionsFor(ids: string[], o: Omit<ReviewItem, "failed">): { id: string; question: string }[] {
  const topic: CurriculumTopic = {
    id: o.topicId, curriculumId: "", grade: o.grade ?? 0, stream: null,
    subject: o.subject, unit: o.unit, name: o.topic, language: o.language,
  };
  const cs = checks(topic, o.level);
  return ids.map((id) => ({ id, question: cs.find((c) => c.id === id)?.question ?? id }));
}

/**
 * Everything in this family's children's years that a parent has not answered on yet.
 *
 * Scoped by the grades the family's children are actually in: the lesson cache is shared by every family, so a
 * parent must not be handed another family's year to review, and there is nothing useful they could say about it.
 */
export async function reviewQueue(familyId: string, limit = 40): Promise<ReviewItem[]> {
  return attempt("teaching.queue", async () => {
    const admin = createAdminClient();
    const { data: kids } = await admin
      .from("profiles").select("grade").eq("family_id", familyId).eq("role", "student");
    const grades = [...new Set(((kids ?? []) as { grade: number | null }[]).map((k) => k.grade).filter((g): g is number => g !== null))];
    if (grades.length === 0) return [];

    const { data: warned } = await admin
      .from("lessons")
      .select("id, topic_id, grade, level, failed_checks, created_at, topics(name, subject, unit, language)")
      .in("grade", grades)
      .is("human_reviewed_at", null)
      .not("failed_checks", "eq", "{}")
      .order("created_at", { ascending: false })
      .limit(limit);

    const items: ReviewItem[] = ((warned ?? []) as unknown as {
      id: string; topic_id: string; grade: number | null; level: string; failed_checks: string[]; created_at: string;
      topics: { name: string; subject: string; unit: string | null; language: string } | null;
    }[]).map((r) => {
      const base = {
        kind: "warned" as const,
        lessonId: r.id,
        topicId: r.topic_id,
        topic: r.topics?.name ?? "a topic",
        subject: r.topics?.subject ?? "",
        unit: r.topics?.unit ?? null,
        grade: r.grade,
        level: levelOf(r.level),
        language: r.topics?.language ?? "en",
        at: r.created_at,
        ref: null,
      };
      return { ...base, failed: questionsFor(r.failed_checks ?? [], base) };
    });

    // Held lessons live in their own table. They used to be recovered from the error log, which is where they were
    // being written — and one correct hold then showed up as three red rows on Admin plus a note in the parent's
    // inbox. A stopped lesson is the system working; only faults belong in the fault log.
    const { data: held } = await admin
      .from("held_lessons")
      .select("id, topic_id, level, grade, blocking, created_at, topics(name, subject, unit, language)")
      // This family's years, and holds recorded without one — a null grade means "every year", not "no year".
      .or(`grade.in.(${grades.join(",")}),grade.is.null`)
      .is("cleared_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const h of (held ?? []) as unknown as {
      id: string; topic_id: string; level: string; grade: number | null; blocking: string[]; created_at: string;
      topics: { name: string; subject: string; unit: string | null; language: string } | null;
    }[]) {
      const base = {
        kind: "held" as const,
        lessonId: null,
        topicId: h.topic_id,
        topic: h.topics?.name ?? "a topic",
        subject: h.topics?.subject ?? "",
        unit: h.topics?.unit ?? null,
        grade: h.grade,
        level: levelOf(h.level),
        language: h.topics?.language ?? "en",
        at: h.created_at,
        ref: null,
      };
      items.push({ ...base, failed: questionsFor(h.blocking ?? [], base) });
    }

    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }, [] as ReviewItem[]);
}
