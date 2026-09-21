"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { failed, report } from "@/lib/ops/fault";
import { ensureLesson, ensureTopicResources } from "@/lib/learning/resources";
import type { Level } from "@/lib/levels";
import type { Topic } from "@/lib/types";

export interface LmsState { error?: string; ok?: string }

const LEVELS = new Set(["basics", "advanced"]);

async function topicOr(id: string): Promise<Topic | null> {
  const { data } = await createAdminClient().from("topics").select("*").eq("id", id).maybeSingle();
  return (data as Topic) ?? null;
}

/**
 * Writes a topic's lesson now, rather than waiting for the night a child happens to need it.
 *
 * The same path the nightly job uses, so a lesson made here goes through the same checks and can be held the
 * same way — a button that skipped the review would quietly be a second, worse pipeline.
 */
export async function writeLessonNowAction(_prev: LmsState | undefined, formData: FormData): Promise<LmsState> {
  await requireAdmin();
  const topicId = String(formData.get("topic_id") ?? "");
  const rawLevel = String(formData.get("level") ?? "basics");
  const level = (LEVELS.has(rawLevel) ? rawLevel : "basics") as Level;
  const t = await topicOr(topicId);
  if (!t) return { error: "No such topic." };

  try {
    const made = await ensureLesson(t, t.grade ?? null, null, level);
    revalidatePath("/parent/lms");
    if (made.status === "held") {
      return { ok: `Written and held: ${(made.failed ?? []).join(", ") || "a check refused it"}. It is in Lessons to check.` };
    }
    return { ok: made.status === "exists" ? "There was already one — nothing rewritten." : `Written (${level}).` };
  } catch (err) {
    const ref = await report("lms.writeLesson", err, { meta: { topicId, level } });
    return { error: `Could not write it (ref ${ref}).` };
  }
}

/** Throws the stored lesson away and writes a fresh one, for when the text is wrong rather than merely old. */
export async function rewriteLessonAction(_prev: LmsState | undefined, formData: FormData): Promise<LmsState> {
  await requireAdmin();
  const topicId = String(formData.get("topic_id") ?? "");
  const rawLevel = String(formData.get("level") ?? "basics");
  const level = (LEVELS.has(rawLevel) ? rawLevel : "basics") as Level;
  const t = await topicOr(topicId);
  if (!t) return { error: "No such topic." };

  const admin = createAdminClient();
  const { error } = await admin.from("lessons").delete().eq("topic_id", topicId).eq("level", level);
  if (error) return failed("actions.lms.rewriteLesson", error);
  return writeLessonNowAction(undefined, formData);
}

/** Diagrams and videos for a topic, produced on demand. */
export async function makeResourcesAction(_prev: LmsState | undefined, formData: FormData): Promise<LmsState> {
  await requireAdmin();
  const topicId = String(formData.get("topic_id") ?? "");
  const t = await topicOr(topicId);
  if (!t) return { error: "No such topic." };
  try {
    const made = await ensureTopicResources(t, null);
    revalidatePath("/parent/lms");
    return { ok: made === "exists" ? "There were already some." : "Diagrams and videos made." };
  } catch (err) {
    const ref = await report("lms.makeResources", err, { meta: { topicId } });
    return { error: `Could not make them (ref ${ref}).` };
  }
}
