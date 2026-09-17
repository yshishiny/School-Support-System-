import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { characterById } from "@/lib/characters";
import { Stage } from "@/components/teach/Stage";
import type { LessonScript } from "@/lib/ai/lesson-script";

export default async function LessonPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { profile } = await requireStudent();
  const admin = createAdminClient();
  const { data } = await admin.from("lesson_sessions").select("id, character_id, beat_index, quiz_id, finished_at, lesson_scripts(id, title, minutes, language, script)").eq("id", sessionId).eq("student_id", profile.id).maybeSingle();
  const row = data as unknown as { id: string; character_id: string; beat_index: number; quiz_id: string | null; finished_at: string | null; lesson_scripts: { id: string; title: string; minutes: number; language: string; script: { beats: LessonScript["beats"]; quiz: LessonScript["quiz"] } } | null } | null;
  if (!row?.lesson_scripts) notFound();
  if (row.finished_at && row.quiz_id) redirect(`/quiz/${row.quiz_id}`);
  const s = row.lesson_scripts;
  return (
    <main className="space-y-3">
      <div className="flex items-center justify-between"><Link href="/teach" className="text-sm muted">← Teacher</Link><span className="badge">beta</span></div>
      <Stage sessionId={row.id} scriptId={s.id} character={characterById(row.character_id)} script={{ title: s.title, minutes: s.minutes, beats: s.script.beats, quiz: s.script.quiz }} language={s.language === "ar" ? "ar" : "en"} startBeat={row.beat_index} minutes={s.minutes} />
    </main>
  );
}
