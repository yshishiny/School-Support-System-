import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { report } from "@/lib/ops/fault";
import { createAdminClient } from "@/lib/supabase/admin";
import { effortFor, modelFor } from "@/lib/ai/models";
import { illustrateScene } from "@/lib/ai/illustrate";
import { findPhoto } from "@/lib/photos";
import { VISUALS_VERSION, type LessonScript } from "@/lib/ai/lesson-script";
import type { StoredBeat } from "./enrich";

type Beat = LessonScript["beats"][number];

const PhrasesSchema = z.object({ beats: z.array(z.object({ index: z.number().int(), photo: z.string().nullable(), brief: z.string().nullable() })) });

/**
 * For a lesson written before photographs and the illustrator existed: a photo search phrase per beat and a
 * drawing brief for the beats that carry (or should carry) a diagram, from the spoken lines. One small call.
 */
async function planVisuals(beats: Beat[], subject: string, topic: string, language: "en" | "ar"): Promise<Map<number, { photo: string | null; brief: string | null }>> {
  const client = new Anthropic();
  const lines = beats.map((b, i) => `${i}. [${b.kind}${b.show ? ` · show:${b.show.type}` : ""}] ${b.say}`).join("\n");
  const res = await client.messages.create({
    model: modelFor("lesson-qa"),
    max_tokens: 3000,
    system: [{ type: "text", text: `You plan pictures for a spoken school lesson. For each beat give: "photo": a 2-5 word English search phrase for a real photograph of the thing or place the beat talks about (e.g. "Giza pyramids", "plant cell micrograph", "railway tracks parallel"), or null when the beat is abstract (a rule, a formula, a greeting, a quiz question). "brief": for explain and example beats about something that can be drawn (shapes, apparatus, organs, maps, graphs, processes, timelines), a 60-120 word brief for an illustrator: the objects, their arrangement, and 3-6 steps in the order the teacher names them, each with its label; null for the rest. Labels in ${language === "ar" ? "Arabic" : "English"}. Faithful to the lesson; invent nothing.` }],
    messages: [{ role: "user", content: `Subject: ${subject} · Topic: ${topic}\n\n${lines}` }],
    output_config: { format: zodOutputFormat(PhrasesSchema), ...effortFor("lesson-qa", "low") },
  });
  const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  const out = PhrasesSchema.parse(JSON.parse(text));
  return new Map(out.beats.map((b) => [b.index, { photo: b.photo, brief: b.brief }]));
}

/**
 * Upgrades an older script's pictures in place: illustrator drawings and photographs, the words untouched so the
 * presenter clips stay valid. Runs once per script (visuals_version), in the background.
 */
export async function upgradeScriptVisuals(scriptId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: row } = await admin.from("lesson_scripts").select("id, title, language, script, visuals_version, topic_id, material_id, topics(subject, name)").eq("id", scriptId).maybeSingle();
  const r = row as unknown as { id: string; title: string; language: string; script: { beats: Beat[]; quiz: unknown }; visuals_version: number | null; topics: { subject: string; name: string } | null } | null;
  if (!r || (r.visuals_version ?? 0) >= VISUALS_VERSION) return;
  // Claim it so two opens do not both pay for the same drawings (0 = in progress).
  const { data: claimed } = await admin.from("lesson_scripts").update({ visuals_version: 0, visuals_started_at: new Date().toISOString() }).eq("id", scriptId).or(`visuals_version.is.null,and(visuals_version.gt.0,visuals_version.lt.${VISUALS_VERSION})`).select("id");
  if (!claimed?.length) return;
  const language = r.language === "ar" ? "ar" : "en";
  const subject = r.topics?.subject ?? "School";
  const topic = r.topics?.name ?? r.title;
  try {
    const plan = await planVisuals(r.script.beats, subject, topic, language).catch(() => new Map<number, { photo: string | null; brief: string | null }>());
    const beats: StoredBeat[] = await Promise.all(r.script.beats.map(async (b, i): Promise<StoredBeat> => {
      const p = plan.get(i);
      const photoPhrase = b.photo ?? p?.photo ?? null;
      const brief = (b.show?.type === "scene" && b.show.brief) || p?.brief || null;
      const drawable = b.kind === "explain" || b.kind === "example" || b.kind === "recap";
      const [drawn, image] = await Promise.all([
        brief && drawable && b.show?.type !== "steps" && b.show?.type !== "table" && b.show?.type !== "formula" ? illustrateScene({ subject, topic, language, say: b.say, brief, existingCues: b.show?.cues ?? null }) : Promise.resolve(null),
        photoPhrase ? findPhoto(photoPhrase) : Promise.resolve(null),
      ]);
      const show = drawn ? { type: "scene" as const, content: drawn.svg, cues: drawn.cues, brief } : b.show ?? null;
      return { ...b, show, photo: photoPhrase, image: image ?? (b as StoredBeat).image ?? null };
    }));
    await admin.from("lesson_scripts").update({ script: { beats, quiz: r.script.quiz }, visuals_version: VISUALS_VERSION }).eq("id", scriptId);
  } catch (err) {
    await report("teach.upgradeVisuals", err, { meta: { scriptId } });
    await admin.from("lesson_scripts").update({ visuals_version: null }).eq("id", scriptId);
  }
}
