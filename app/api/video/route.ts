import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { characterById } from "@/lib/characters";
import { presenterGenders, requestClip, videoVoice } from "@/lib/video";

export const maxDuration = 30;

/** A presenter clip for one line: ready (signed URL), still rendering, or not available; family members only. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ status: "off", reason: "sign in" }, { status: 401 });
  let body: { text?: string; character?: string; language?: string; voice?: string | null; create?: boolean; kind?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ status: "error", reason: "bad request" }, { status: 400 }); }
  if (typeof body.text !== "string" || typeof body.character !== "string") return NextResponse.json({ status: "error", reason: "text and character are required" }, { status: 400 });
  const c = characterById(body.character);
  const language = body.language === "ar" ? "ar" : "en";
  const voice = videoVoice(c, language, body.voice, (await presenterGenders())[c.id]);
  if (!voice) return NextResponse.json({ status: "off", reason: "no premium voice" });
  const answer = await requestClip({ characterId: c.id, voice, text: body.text, create: body.create !== false, kind: typeof body.kind === "string" ? body.kind : null });
  return NextResponse.json(answer);
}
