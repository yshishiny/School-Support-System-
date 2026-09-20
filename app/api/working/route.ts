import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkWorking } from "@/lib/ai/check-working";
import { report } from "@/lib/ops/fault";

export const maxDuration = 120;

const MAX_BYTES = 8 * 1024 * 1024;
const KINDS = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * A photograph of his working, marked.
 *
 * A route rather than an action because the body is a photograph. The image is read and dropped — what is stored
 * is where he got stuck, which is the thing a parent has never been able to see and the thing worth keeping.
 */
export async function POST(request: Request): Promise<Response> {
  const { profile, family } = await requireStudent();
  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof Blob)) return NextResponse.json({ error: "No photograph arrived." }, { status: 400 });
  if (photo.size > MAX_BYTES) return NextResponse.json({ error: "That photograph is too large." }, { status: 400 });
  if (!KINDS.has(photo.type)) return NextResponse.json({ error: "Take a photo, or choose a JPEG or PNG." }, { status: 400 });

  const topicId = String(form.get("topic_id") ?? "") || null;
  const question = String(form.get("question") ?? "").trim().slice(0, 500) || null;

  const admin = createAdminClient();
  let subject: string | null = null;
  let topicName: string | null = null;
  if (topicId) {
    const { data: t } = await admin.from("topics").select("subject, name").eq("id", topicId).maybeSingle();
    subject = (t?.subject as string) ?? null;
    topicName = (t?.name as string) ?? null;
  }

  try {
    const buf = Buffer.from(await photo.arrayBuffer());
    const result = await checkWorking(
      { media_type: photo.type as "image/jpeg" | "image/png" | "image/webp", data: buf.toString("base64") },
      { subject, topic: topicName, grade: profile.grade, question },
    );

    // Kept whether he got it right or wrong: "he tried and it was fine" is as much a signal as "he is stuck".
    if (result.readable) {
      await admin.from("working_checks").insert({
        student_id: profile.id, family_id: family.id, topic_id: topicId, subject,
        problem: result.problem.slice(0, 300),
        correct: result.correct,
        first_wrong_line: result.first_wrong_line,
        what_went_wrong: result.what_went_wrong.slice(0, 300),
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    const ref = await report("working.check", err, { userId: profile.id, familyId: family.id, meta: { topicId } });
    return NextResponse.json({ error: `That could not be read (ref ${ref}). Try again in a moment.` }, { status: 502 });
  }
}
