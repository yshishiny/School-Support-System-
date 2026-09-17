"use server";

import { revalidatePath } from "next/cache";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAwards, computeStreak, POINTS } from "@/lib/points";
import { shiftDate, todayIn } from "@/lib/dates";
import { parseLessonFieldKey } from "@/lib/lessons";
import { pingParents } from "@/lib/notify";
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
  // The day this check-in is for: today, or a missed day earlier in the same week (filled in later).
  const requested = String(formData.get("checkin_date") ?? "").trim();
  const checkinDate = /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today && requested >= shiftDate(today, -6) ? requested : today;
  const enteredLate = checkinDate !== today;

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
  // Lesson notes are posted as lesson_<subject> (today) or lesson_<date>__<subject> (a previous day),
  // with lessontopic_<same key> carrying the curriculum topic id when one was picked.
  const earliest = shiftDate(today, -7);
  const lessonNotes: { date: string; subject: string; note: string; topicId: string | null; homeworkGiven: boolean | null; homework: string | null; homeworkDue: string | null }[] = [];
  const todayIncomplete: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("lesson_")) continue;
    const k = key.slice(7);
    const note = String(value).trim();
    const { date, subject } = parseLessonFieldKey(k, checkinDate);
    if (date > today || date < earliest) continue;
    const hwAnswer = String(formData.get(`lessonhwgiven_${k}`) ?? "");
    const homeworkGiven = hwAnswer === "yes" ? true : hwAnswer === "no" ? false : null;
    if (date === checkinDate && (note.length < 2 || homeworkGiven === null)) todayIncomplete.push(subject);
    if (note.length < 2) continue;
    const topicId = String(formData.get(`lessontopic_${k}`) ?? "").trim() || null;
    const homework = homeworkGiven ? String(formData.get(`lessonhw_${k}`) ?? "").trim().slice(0, 200) || null : null;
    const dueRaw = String(formData.get(`lessonhwdue_${k}`) ?? "").trim();
    const homeworkDue = homeworkGiven && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null;
    lessonNotes.push({ date, subject, note: note.slice(0, 500), topicId, homeworkGiven, homework, homeworkDue });
  }
  if (todayIncomplete.length) {
    return { error: `Every class ${enteredLate ? "that day" : "today"} needs the lesson title and a homework yes/no: ${todayIncomplete.join(", ")}. (Tap “No class” if it did not happen.)` };
  }

  const ids = Object.keys(itemStatuses);
  const { data: assignments } = ids.length
    ? await supabase.from("assignments").select("*").in("id", ids).eq("student_id", profile.id)
    : { data: [] as Assignment[] };

  // Upsert the check-in row (a re-submit updates the same day).
  const { data: checkin, error } = await supabase
    .from("checkins")
    .upsert(
      { student_id: profile.id, checkin_date: checkinDate, mood, minutes_studied: minutes, learned, stuck_on: stuckOn, submitted_at: new Date().toISOString(), entered_late: enteredLate },
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

  let savedLogs: { id: string; log_date: string }[] = [];
  if (lessonNotes.length) {
    const { data } = await supabase
      .from("lesson_logs")
      .upsert(
        lessonNotes.map((l) => ({ student_id: profile.id, log_date: l.date, subject_name: l.subject, note: l.note, topic_id: l.topicId, homework_given: l.homeworkGiven, homework: l.homework, homework_due: l.homeworkDue })),
        { onConflict: "student_id,log_date,subject_name" },
      )
      .select("id, log_date, subject_name, assignment_id");
    savedLogs = data ?? [];
    // Homework "yes" becomes a task on the list (one per class and day), so it is done on time.
    const { data: subjectRows } = await supabase.from("subjects").select("id, name").eq("student_id", profile.id);
    for (const l of lessonNotes) {
      const row = (data ?? []).find((r) => r.log_date === l.date && r.subject_name === l.subject);
      if (!row) continue;
      if (l.homeworkGiven) {
        const title = `${l.subject}: ${l.homework ?? "homework"}`;
        const subject = (subjectRows ?? []).find((x) => x.name.toLowerCase() === l.subject.toLowerCase());
        if (row.assignment_id) {
          await supabase.from("assignments").update({ title, due_date: l.homeworkDue, subject_name: l.subject, subject_id: subject?.id ?? null }).eq("id", row.assignment_id).eq("student_id", profile.id);
        } else {
          const { data: a } = await supabase
            .from("assignments")
            .insert({ student_id: profile.id, subject_id: subject?.id ?? null, subject_name: l.subject, kind: "homework", title, details: `From the ${l.date} class log.`, due_date: l.homeworkDue, source: "student", created_by: profile.id })
            .select("id")
            .single();
          if (a) await supabase.from("lesson_logs").update({ assignment_id: a.id }).eq("id", row.id);
        }
      } else if (row.assignment_id) {
        // Changed his mind: the class had no homework after all.
        await supabase.from("assignments").delete().eq("id", row.assignment_id).eq("student_id", profile.id).eq("status", "open");
        await supabase.from("lesson_logs").update({ assignment_id: null }).eq("id", row.id);
      }
    }
  }

  // Points: written with the service role because students cannot insert into the ledger.
  const admin = createAdminClient();
  const { data: past } = await admin.from("checkins").select("checkin_date").eq("student_id", profile.id);
  const streak = computeStreak((past ?? []).map((r) => r.checkin_date as string), today) || computeStreak((past ?? []).map((r) => r.checkin_date as string), checkinDate);
  const awards = computeAwards({
    checkinId: checkin.id,
    today: checkinDate,
    streak,
    enteredLate,
    items: ((assignments ?? []) as Assignment[]).map((a) => ({
      assignmentId: a.id,
      status: itemStatuses[a.id],
      dueDate: a.due_date,
      kind: a.kind,
    })),
  });
  let earned = 0;
  if (savedLogs.length) {
    // Today's classes pay full; a previous day filled in later pays less. Each row pays once (unique ref).
    const todayRows = savedLogs.filter((r) => r.log_date === today).slice(0, POINTS.LESSON_NOTE_MAX);
    const lateRows = savedLogs.filter((r) => r.log_date !== today).slice(0, POINTS.LESSON_NOTE_MAX);
    for (const row of todayRows) awards.push({ delta: POINTS.LESSON_NOTE, reason: "Wrote what today's lesson covered", ref_type: "lesson_log", ref_id: row.id });
    for (const row of lateRows) awards.push({ delta: POINTS.LESSON_NOTE_LATE, reason: "Filled in a previous day's lesson", ref_type: "lesson_log", ref_id: row.id });
  }
  for (const award of awards) {
    // Unique index on (student, ref_type, ref_id) makes re-submits idempotent.
    const { error: insertError } = await admin.from("points_ledger").insert({ student_id: profile.id, ...award });
    if (!insertError) earned += award.delta;
  }

  void pingParents(family.id, `${profile.full_name.split(" ")[0]} checked in`, `${minutes} min studied · ${lessonNotes.length} class${lessonNotes.length === 1 ? "" : "es"} logged · +${earned} points${enteredLate ? " · filled in later" : ""}`);
  ["/today", "/checkin", "/calendar", "/parent", "/parent/assignments"].forEach((p) => revalidatePath(p));
  return { earned, streak };
}
