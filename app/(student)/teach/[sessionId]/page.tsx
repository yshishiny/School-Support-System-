import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { characterById } from "@/lib/characters";
import { Stage } from "@/components/teach/Stage";
import type { LessonScript } from "@/lib/ai/lesson-script";
import { cloudVoiceList } from "@/lib/tts";
import { presenterGenders, presenterUrls, videoEnabled, videoKinds, videoMode } from "@/lib/video";
import { after } from "next/server";
import { VISUALS_VERSION } from "@/lib/ai/lesson-script";
import { upgradeScriptVisuals } from "@/lib/teach/upgrade";

/** The lesson on the full-screen stage; the child's progress in the session decides where it resumes. */
export default async function LessonPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  const { data } = await admin.from("lesson_sessions").select("id, character_id, beat_index, quiz_id, finished_at, lesson_scripts(id, title, minutes, language, script, version, visuals_version)").eq("id", sessionId).eq("student_id", profile.id).maybeSingle();
  const row = data as unknown as { id: string; character_id: string; beat_index: number; quiz_id: string | null; finished_at: string | null; lesson_scripts: { id: string; title: string; minutes: number; language: string; version: number | null; visuals_version: number | null; script: { beats: LessonScript["beats"]; quiz: LessonScript["quiz"] } } | null } | null;
  if (!row?.lesson_scripts) notFound();
  if (row.finished_at && row.quiz_id) redirect(`/quiz/${row.quiz_id}`);
  const s = row.lesson_scripts;
  // An older lesson: better pictures are prepared in the background, words and clips untouched (0 = already running).
  const upgrading = (s.visuals_version ?? 0) < VISUALS_VERSION;
  if (upgrading && s.visuals_version !== 0 && process.env.ANTHROPIC_API_KEY) after(() => upgradeScriptVisuals(s.id));
  const language = s.language === "ar" ? "ar" : "en";
  const kinds = videoKinds(await videoMode());
  const character = characterById(row.character_id);
  const gender = (await presenterGenders().catch(() => ({} as Record<string, "m" | "f" | null>)))[character.id];
  const presenter = videoEnabled() ? (await presenterUrls().catch(() => ({} as Record<string, { url: string; custom: boolean }>)))[character.id]?.url ?? null : null;
  return <Stage sessionId={row.id} scriptId={s.id} character={character} script={{ title: s.title, minutes: s.minutes, beats: s.script.beats, quiz: s.script.quiz }} language={language} startBeat={row.beat_index} minutes={s.minutes} cloudVoices={cloudVoiceList(language)} video={videoEnabled() && cloudVoiceList(language).length > 0} videoKinds={kinds} preferFemale={gender ? gender === "f" : undefined} presenterUrl={presenter} upgrading={upgrading} />;
}
