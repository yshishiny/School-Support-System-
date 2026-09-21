/**
 * The whole catalogue and everything written against it, in four reads.
 *
 * 1,711 topics is small enough to hold and compare in memory, and doing it that way means the page can answer
 * "what is missing" — a question no per-topic query can answer, because the rows that are missing are the ones
 * that do not exist.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { coverage, type Coverage, type HeldRow, type LessonRow, type ResourceRow, type TopicRow } from "@/lib/lms/coverage";

export interface CatalogueEntry { id: string; name: string; language: string }

export interface Catalogue {
  rows: Coverage[];
  curricula: CatalogueEntry[];
}

export async function loadCoverage(): Promise<Catalogue> {
  const admin = createAdminClient();
  const [{ data: topics }, { data: lessons }, { data: resources }, { data: held }, { data: curricula }] = await Promise.all([
    admin.from("topics").select("id, subject, unit, name, language, grade, curriculum_id, stream, track").order("subject").order("sort").limit(5000),
    admin.from("lessons").select("topic_id, grade, level, model, created_at, checked_at, failed_checks, human_reviewed_at").limit(5000),
    admin.from("topic_resources").select("topic_id, grade, visuals, videos, model, updated_at").limit(5000),
    admin.from("held_lessons").select("topic_id, level, blocking, cleared_at, created_at").limit(2000),
    admin.from("curricula").select("id, name, language"),
  ]);

  const asTopics: TopicRow[] = ((topics ?? []) as {
    id: string; subject: string; unit: string | null; name: string; language: string | null;
    grade: number | null; curriculum_id: string | null; stream: string | null; track: string;
  }[]).map((t) => ({
    id: t.id, subject: t.subject, unit: t.unit ?? "", name: t.name,
    language: t.language ?? "en", grade: t.grade, curriculumId: t.curriculum_id, stream: t.stream, track: t.track,
  }));

  return {
    rows: coverage(asTopics, (lessons ?? []) as LessonRow[], (resources ?? []) as ResourceRow[], (held ?? []) as HeldRow[]),
    curricula: ((curricula ?? []) as CatalogueEntry[]),
  };
}
