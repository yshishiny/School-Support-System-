import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { synthesize } from "@/lib/tts";

export const maxDuration = 30;

/** One spoken line in a premium voice, for signed-in family members; MP3, cached upstream. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  let body: { text?: string; voice?: string; rate?: number; pitch?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  if (typeof body.text !== "string" || typeof body.voice !== "string") return NextResponse.json({ error: "text and voice are required." }, { status: 400 });
  try {
    const audio = await synthesize({ text: body.text, voice: body.voice, rate: Number(body.rate) || 1, pitch: Number(body.pitch) || 1 });
    return new NextResponse(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not synthesise." }, { status: 502 });
  }
}
