import { createAdminClient } from "@/lib/supabase/admin";
import { attempt } from "@/lib/ops/fault";
import type { Topic } from "@/lib/types";

/**
 * Reading the curriculum catalogue.
 *
 * The catalogue is the same for every family and changes about once a year, so these are plain reads with no
 * per-family filtering to get wrong. What they are for is answering one question the app could not answer before:
 * *which subjects does this particular child study, and what is in each of them?* It used to be answered by a
 * parent typing subject names into a box.
 */

export interface Curriculum { id: string; name: string; name_ar: string | null; language: string; note: string | null }

export interface Level {
  curriculum_id: string;
  grade: number;
  stage: string;
  /** null means every child in the grade takes this; otherwise the child has chosen a stream. */
  stream: string | null;
  label: string;
  label_ar: string | null;
}

export interface Subject {
  subject: string;
  subject_ar: string | null;
  /** The language the subject is taught in, which is not always the child's phone language. */
  language: string;
  core: boolean;
  sort: number;
}

/** Who a child is, as far as the curriculum is concerned. */
export interface Learner {
  curriculumId: string | null;
  grade: number | null;
  stream: string | null;
}

export function hasCurriculum(l: Learner): boolean {
  return !!l.curriculumId && l.grade !== null;
}

export async function listCurricula(): Promise<Curriculum[]> {
  return attempt("curriculum.list", async () => {
    const admin = createAdminClient();
    const { data } = await admin.from("curricula").select("id, name, name_ar, language, note").order("sort");
    return (data ?? []) as Curriculum[];
  }, []);
}

/** Every level of one curriculum, in teaching order — the grades, and the streams inside the streamed grades. */
export async function levelsOf(curriculumId: string): Promise<Level[]> {
  return attempt("curriculum.levels", async () => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("curriculum_levels")
      .select("curriculum_id, grade, stage, stream, label, label_ar")
      .eq("curriculum_id", curriculumId)
      .order("sort");
    return (data ?? []) as Level[];
  }, []);
}

/**
 * The subjects this child studies.
 *
 * A streamed grade has rows for each stream and none in common, so a child with no stream set in a streamed year
 * would see nothing. That is deliberate: an empty list is a question to a parent, and a wrong list is not.
 */
export async function subjectsFor(l: Learner): Promise<Subject[]> {
  if (!hasCurriculum(l)) return [];
  return attempt("curriculum.subjects", async () => {
    const admin = createAdminClient();
    let q = admin
      .from("curriculum_subjects")
      .select("subject, subject_ar, language, core, sort")
      .eq("curriculum_id", l.curriculumId!)
      .eq("grade", l.grade!);
    q = l.stream ? q.eq("stream", l.stream) : q.is("stream", null);
    const { data } = await q.order("sort");
    return (data ?? []) as Subject[];
  }, []);
}

/** Every topic this child's year covers, in teaching order. */
export async function topicsFor(l: Learner, subject?: string): Promise<Topic[]> {
  if (!hasCurriculum(l)) return [];
  return attempt("curriculum.topics", async () => {
    const admin = createAdminClient();
    let q = admin
      .from("topics")
      .select("*")
      .eq("curriculum_id", l.curriculumId!)
      .eq("grade", l.grade!);
    q = l.stream ? q.eq("stream", l.stream) : q.is("stream", null);
    if (subject) q = q.eq("subject", subject);
    const { data } = await q.order("subject").order("sort");
    return (data ?? []) as Topic[];
  }, []);
}

/** The streams offered in one grade, for the picker. Empty means the grade is not streamed. */
export function streamsIn(levels: Level[], grade: number): Level[] {
  return levels.filter((l) => l.grade === grade && l.stream);
}

export function gradesIn(levels: Level[]): number[] {
  return [...new Set(levels.map((l) => l.grade))].sort((a, b) => a - b);
}

/** What to call a level in front of a parent. */
export function labelOf(levels: Level[], grade: number, stream: string | null, lang = "en"): string {
  const hit = levels.find((l) => l.grade === grade && (l.stream ?? null) === (stream ?? null));
  if (!hit) return `Grade ${grade}`;
  return (lang === "ar" && hit.label_ar) || hit.label;
}
