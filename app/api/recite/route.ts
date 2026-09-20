import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { transcribe } from "@/lib/stt";
import { mark, verdictLine } from "@/lib/recite";
import { report } from "@/lib/ops/fault";

export const maxDuration = 60;

/**
 * A recitation, heard and marked.
 *
 * A route rather than a server action because the body is audio: actions serialise their arguments, and a
 * megabyte of Opus through that path is neither fast nor kind to a phone on mobile data.
 *
 * The audio is never stored. It is transcribed, marked, and dropped — what is kept is the score and which words
 * slipped, which is everything a child or a parent would ever want from it and none of the child's voice.
 */
export async function POST(request: Request): Promise<Response> {
  const { profile } = await requireStudent();
  const form = await request.formData();
  const audio = form.get("audio");
  const itemId = String(form.get("item_id") ?? "");
  const segment = String(form.get("segment") ?? "");
  if (!(audio instanceof Blob)) return NextResponse.json({ error: "No recording arrived." }, { status: 400 });

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("memorize_items").select("id, student_id, kind, text_ar, segments, sessions, best_score").eq("id", itemId).maybeSingle();
  if (!item || item.student_id !== profile.id) {
    return NextResponse.json({ error: "That is not yours to practise." }, { status: 403 });
  }

  // One ayah when he picked one, the whole passage otherwise.
  const segments = (item.segments ?? []) as { ref?: string; text?: string }[];
  const expected = segment
    ? segments.find((s) => s.ref === segment)?.text ?? item.text_ar
    : item.text_ar;

  // Quranic recitation is classical, not Egyptian, whatever the child's own accent.
  const heard = await transcribe(audio, item.kind === "quran" ? "ar-SA" : "ar-EG");
  if ("error" in heard) return NextResponse.json({ error: heard.error }, { status: 502 });

  const marking = mark(expected as string, heard.text);

  // The best score stands: a bad morning does not erase a good week. Counted from the row already read, rather
  // than reading it twice and writing back what the second read said.
  const { error } = await admin
    .from("memorize_items")
    .update({
      sessions: ((item.sessions as number) ?? 0) + 1,
      best_score: Math.max(marking.score, (item.best_score as number) ?? 0),
      last_practised: new Date().toISOString().slice(0, 10),
    })
    .eq("id", itemId);
  if (error) await report("recite.save", error, { userId: profile.id, meta: { itemId } });

  return NextResponse.json({
    words: marking.words,
    score: marking.score,
    correct: marking.correct,
    expected: marking.expected,
    line: verdictLine(marking),
    heard: heard.text,
    lowConfidence: heard.confidence !== null && heard.confidence < 0.5,
  });
}
