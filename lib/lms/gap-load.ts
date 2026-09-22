/**
 * Everything the comparison needs for one child, in four reads.
 *
 * The curriculum side is filtered to the child's own grade and curriculum, which is the whole point: grade 8
 * currently holds three separate topic sets — American, Egyptian, and an older one attached to no curriculum
 * at all — and comparing a child against the wrong one would be worse than not comparing at all.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { gap, match, type CurriculumTopic, type Gap, type TaughtTopic } from "./gap";

export interface GapReport {
  gap: Gap;
  /** Which topic set the child was measured against, named, because the answer depends entirely on it. */
  curriculumName: string | null;
  grade: number | null;
  files: number;
  /** Topic sets at this grade the child is NOT being measured against, and how big they are. */
  otherSets: { name: string; topics: number; lessons: number }[];
}

export async function gapFor(studentId: string, familyId: string): Promise<GapReport | null> {
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("id, grade, curriculum_id")
    .eq("id", studentId)
    .eq("family_id", familyId)
    .maybeSingle();
  const profile = p as { id: string; grade: number | null; curriculum_id: string | null } | null;
  if (!profile) return null;

  const [{ data: topicRows }, { data: mats }, { data: curricula }] = await Promise.all([
    admin.from("topics").select("id, subject, unit, name, curriculum_id").eq("grade", profile.grade).eq("track", "school").limit(2000),
    admin.from("materials").select("id, title, subject, topics").eq("student_id", studentId).eq("status", "ready").limit(300),
    admin.from("curricula").select("id, name"),
  ]);

  type TRow = { id: string; subject: string; unit: string | null; name: string; curriculum_id: string | null };
  const all = (topicRows ?? []) as TRow[];
  const mine = all.filter((t) => t.curriculum_id === profile.curriculum_id);

  const { data: lessons } = await admin
    .from("lessons")
    .select("topic_id")
    .in("topic_id", mine.length > 0 ? mine.map((t) => t.id) : ["00000000-0000-0000-0000-000000000000"])
    .eq("level", "basics");
  const written = new Set(((lessons ?? []) as { topic_id: string }[]).map((l) => l.topic_id));

  const curriculum: CurriculumTopic[] = mine.map((t) => ({
    id: t.id, subject: t.subject, unit: t.unit ?? "", name: t.name, hasLesson: written.has(t.id),
  }));

  type MRow = { id: string; title: string; subject: string | null; topics: string[] | null };
  const files = (mats ?? []) as MRow[];
  // One row per topic per file. The same topic arriving from two files is kept twice on purpose: it says the
  // school came back to it, which is worth seeing.
  const taught: TaughtTopic[] = files.flatMap((m) =>
    (m.topics ?? []).map((topic) => ({ topic, fromTitle: m.title, fromId: m.id, subject: m.subject })));

  const names = new Map(((curricula ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const otherSets = [...new Set(all.map((t) => t.curriculum_id))]
    .filter((id) => id !== profile.curriculum_id)
    .map((id) => {
      const inSet = all.filter((t) => t.curriculum_id === id);
      return { name: id ? names.get(id) ?? id : "no curriculum set", topics: inSet.length, lessons: 0 };
    });

  // How many lessons sit in those other sets: the number that says whether work already done is reaching
  // this child or not.
  if (otherSets.length > 0) {
    const otherIds = all.filter((t) => t.curriculum_id !== profile.curriculum_id).map((t) => t.id);
    const { data: otherLessons } = await admin.from("lessons").select("topic_id").in("topic_id", otherIds.slice(0, 1000)).eq("level", "basics");
    const byId = new Map(all.map((t) => [t.id, t.curriculum_id]));
    for (const l of ((otherLessons ?? []) as { topic_id: string }[])) {
      const cid = byId.get(l.topic_id);
      const set = otherSets.find((s) => (cid ? names.get(cid) ?? cid : "no curriculum set") === s.name);
      if (set) set.lessons += 1;
    }
  }

  return {
    gap: gap(match(taught, curriculum), curriculum),
    curriculumName: profile.curriculum_id ? names.get(profile.curriculum_id) ?? profile.curriculum_id : null,
    grade: profile.grade,
    files: files.length,
    otherSets,
  };
}
