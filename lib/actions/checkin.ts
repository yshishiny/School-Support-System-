"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAwards, computeStreak, POINTS } from "@/lib/points";
import { todayIn } from "@/lib/dates";
import type { Assignment, ItemStatus } from "@/lib/types";

export interface CheckinResult {
  error?: string;
  earned?: number;
  streak?: number;
}

export async function submitCheckinAction(_prev: CheckinResult | undefined, formData: FormData): Promise<CheckinResult> {
  const { profile, family } = await requireStudent();
  console.log("[checkin] submit from", profile.id);
  const supabase = await createClient();
  const today = todayIn(family.timezone);

  const mood = Number(formData.get("mood") ?? 0) || null;
  const minutes = Math.max(0, Math.min(600, Number(formData.get("minutes_studied") ?? 0) || 0));
  const learned = String(formData.get("learned") ?? "").trim() || null;
  const stuckOn = String(formData.get("stuck_on") ?? "").trim() || null;

  if (!learned || learned.length < 10) {
    return { error: "Almost there: write at least one sentence in “What did you learn today?” (10+ characters), then submit again." };
  }

  // Items are posted as item_<assignmentId> = done|partial|not_done
  const itemStatuses: Record<string, ItemStatus> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("item_")) itemStatuses[key.slice(5)] = String(value) as ItemStatus;
  }
  // Lesson notes are posted as lesson_<subject> = what was covered today
  const lessonNotes: { subject: string; note: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("lesson_")) {
      const note = String(value).trim();
      if (note.length >= 3) lessonNotes.push({ subject: key.slice(7), note: note.slice(0, 500) });
    }
  }

  const ids = Object.keys(itemStatuses);
  const { data: assignments } = ids.length
    ? await supabase.from("assignments").select("*").in("id", ids).eq("student_id", profile.id)
    : { data: [] as Assignment[] };

  // Upsert the check-in row (a re-submit updates the same day).
  const { data: checkin, error } = await supabase
    .from("checkins")
    .upsert(
      { student_id: profile.id, checkin_date: today, mood, minutes_studied: minutes, learned, stuck_on: stuckOn, submitted_at: new Date().toISOString() },
      { onConflict: "student_id,checkin_date" },
    )
    .select()
    .single();
  if (error || !checkin) return { error: error?.message ?? "Could not save the check-in." };

  if (assignments && assignments.length) {
    await supabase.from("checkin_items").upsert(
      assignments.map((a) => ({ checkin_id: checkin.id, assignment_id: a.id, status: itemStatuses[a.id] })),
      { onConflict: "checkin_id,assignment_id" },
    );
    for (const a of assignments as Assignment[]) {
      const s = itemStatuses[a.id];
      const status = s === "done" ? "done" : a.status === "done" ? "done" : "open";
      await supabase
        .from("assignments")
        .update({ status, completed_at: status === "done" ? a.completed_at ?? new Date().toISOString() : null })
        .eq("id", a.id);
    }
  }

  if (lessonNotes.length) {
    await supabase.from("lesson_logs").upsert(
      lessonNotes.map((l) => ({ student_id: profile.id, log_date: today, subject_name: l.subject, note: l.note })),
      { onConflict: "student_id,log_date,subject_name" },
    );
  }

  // Points: written with the service role because students cannot insert into the ledger.
  const admin = createAdminClient();
  const { data: past } = await admin.from("checkins").select("checkin_date").eq("student_id", profile.id);
  const streak = computeStreak((past ?? []).map((r) => r.checkin_date as string), today);
  const awards = computeAwards({
    checkinId: checkin.id,
    today,
    streak,
    items: ((assignments ?? []) as Assignment[]).map((a) => ({
      assignmentId: a.id,
      status: itemStatuses[a.id],
      dueDate: a.due_date,
      kind: a.kind,
    })),
  });
  let earned = 0;
  if (lessonNotes.length) {
    const { data: logRows } = await admin.from("lesson_logs").select("id").eq("student_id", profile.id).eq("log_date", today);
    for (const row of (logRows ?? []).slice(0, POINTS.LESSON_NOTE_MAX)) {
      awards.push({ delta: POINTS.LESSON_NOTE, reason: "Wrote what today's lesson covered", ref_type: "lesson_log", ref_id: row.id });
    }
  }
  for (const award of awards) {
    // Unique index on (student, ref_type, ref_id) makes re-submits idempotent.
    const { error: insertError } = await admin.from("points_ledger").insert({ student_id: profile.id, ...award });
    if (!insertError) earned += award.delta;
  }

  revalidatePath("/today");
  revalidatePath("/parent");
  return { earned, streak };
}
