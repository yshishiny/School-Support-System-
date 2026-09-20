"use server";

import { report } from "@/lib/ops/fault";
import { failed } from "@/lib/ops/fault";
import { logError } from "@/lib/ops/log";

import { revalidatePath } from "next/cache";
import { requireParent, requireSession, requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftDate, todayIn } from "@/lib/dates";
import { formatInTimeZone } from "date-fns-tz";
import { checkSnap } from "@/lib/ai/check-snap";
import { SNAP_TEMPLATES, handwritingScore, ownsTask, rotaTurn, templateByCode, type SnapKind, type SnapTask } from "@/lib/snaps";
import { weekFor } from "@/lib/allowance";
import { SNAP_BUCKET } from "@/lib/snaps/server";

const STUDENT_PATHS = ["/snaps", "/today"];
const PARENT_PATHS = ["/parent", "/parent/snaps", "/parent/allowance"];

export interface RegisterResult {
  error?: string;
  id?: string;
  verdict?: string;
  kidNote?: string;
  earned?: number;
  handwriting?: { score: number; practiceLine: string; focus: string[] };
}

/**
 * After the browser uploaded the picture, record it and let the AI give a first opinion.
 * The child sees the AI's friendly line right away; a parent approves later.
 */
export async function registerSnapAction(taskId: string, path: string, sha256: string): Promise<RegisterResult> {
  const { profile, family } = await requireStudent();
  if (!path.startsWith(`${family.id}/${profile.id}/`)) return { error: "Bad upload path." };
  const admin = createAdminClient();
  const { data: task } = await admin.from("snap_tasks").select("*").eq("id", taskId).eq("family_id", family.id).eq("enabled", true).maybeSingle();
  if (!task) return { error: "This task is not active any more." };
  const t = task as SnapTask;
  const today = todayIn(family.timezone);
  if (!ownsTask(t, profile.id, today)) return { error: "Not your turn for this one today." };

  // Same picture sent before (by this child): refuse, so an old photo cannot be reused.
  if (sha256) {
    const { data: dup } = await admin.from("snaps").select("id, taken_on").eq("student_id", profile.id).eq("sha256", sha256).maybeSingle();
    if (dup) {
      await admin.storage.from(SNAP_BUCKET).remove([path]);
      return { error: `That is the same picture you sent on ${dup.taken_on}. Take a fresh one.` };
    }
  }
  const { data: row, error } = await admin
    .from("snaps")
    .insert({ student_id: profile.id, family_id: family.id, task_id: t.id, task_code: t.code, kind: t.kind, path, sha256: sha256 || null, taken_on: today })
    .select("id")
    .single();
  if (error || !row) return failed("actions.snaps.registerSnap", error, "Could not save.");

  // AI first opinion (when the family keeps it on). Failures never block the child: the snap stays pending.
  let verdict = "error";
  let kidNote = "Sent. A parent will check it.";
  let handwriting: RegisterResult["handwriting"];
  if (family.snap_ai_check === false) {
    verdict = "skipped";
    kidNote = "Sent ✅ · someone at home will check it and you get the points then.";
    await admin.from("snaps").update({ ai_verdict: "skipped", ai_note: "AI check is off for this family." }).eq("id", row.id);
  } else {
    try {
      const { data: file } = await admin.storage.from(SNAP_BUCKET).download(path);
      if (!file) throw new Error("download failed");
      const buf = Buffer.from(await file.arrayBuffer());
      const mt = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp";
      const { data: logs } = t.kind === "homework" ? await admin.from("lesson_logs").select("subject_name").eq("student_id", profile.id).eq("log_date", today) : { data: [] };
      let subjectsNext: string[] = [];
      if (t.kind === "bag") {
        const { data: tt } = await admin.from("timetable_entries").select("weekday, subject_name, start_time").eq("student_id", profile.id);
        const hhmmNow = formatInTimeZone(new Date(), family.timezone, "HH:mm");
        // Before 08:00 the bag is for today; in the evening it is for the next school day.
        let d = hhmmNow < "08:00" ? today : shiftDate(today, 1);
        for (let k = 0; k < 7; k += 1) { const wd = new Date(d + "T00:00:00Z").getUTCDay(); if ((tt ?? []).some((x) => x.weekday === wd)) break; d = shiftDate(d, 1); }
        const wd = new Date(d + "T00:00:00Z").getUTCDay();
        subjectsNext = [...new Set((tt ?? []).filter((x) => x.weekday === wd).map((x) => x.subject_name))];
      }
      const check = await checkSnap({ media_type: mt, data: buf.toString("base64") }, { kind: t.kind as SnapKind, label: t.label, prompt: t.prompt }, { subjectsToday: (logs ?? []).map((l) => l.subject_name), subjectsNext, studentFirstName: profile.full_name.split(" ")[0], today });
      const r = check.result;
      verdict = r.verdict;
      kidNote = r.kid_note;
      const detail: Record<string, unknown> = { ...r };
      delete detail.note;
      delete detail.kid_note;
      delete detail.verdict;
      delete detail.score;
      if (check.kind === "handwriting") {
        const score = handwritingScore(check.result);
        detail.score = score;
        handwriting = { score, practiceLine: check.result.practice_line, focus: check.result.focus };
      }
      await admin.from("snaps").update({ ai_verdict: r.verdict, ai_score: Math.round(r.score * 100) / 100, ai_note: r.note, ai_detail: Object.keys(detail).length ? detail : null }).eq("id", row.id);
    } catch (err) {
      const ref = await report("snaps.check", err, { familyId: family.id, userId: profile.id, meta: { snapId: row.id, task: t.code } });
      await admin.from("snaps").update({ ai_verdict: "error", ai_note: `The check could not run (ref ${ref}). A parent can still approve it.` }).eq("id", row.id);
    }
  }

  // Small points for showing up: once per task per day, when the AI found it plausible (or on approval when the AI is off).
  const earned = verdict === "looks_good" ? await awardSnapPoints(profile.id, row.id, t.label, t.kind, today) : 0;
  [...STUDENT_PATHS, ...PARENT_PATHS].forEach((p) => revalidatePath(p));
  return { id: row.id, verdict, kidNote, earned, handwriting };
}

async function awardSnapPoints(studentId: string, snapId: string, label: string, kind: string, day: string): Promise<number> {
  const admin = createAdminClient();
  const { data: prior } = await admin.from("points_ledger").select("id").eq("student_id", studentId).eq("ref_type", "snap").eq("reason", `Snap: ${label} ${day}`).limit(1);
  if (prior?.length) return 0;
  const earned = kind === "handwriting" ? 5 : 2;
  await admin.from("points_ledger").insert({ student_id: studentId, delta: earned, reason: `Snap: ${label} ${day}`, ref_type: "snap", ref_id: snapId });
  return earned;
}

/**
 * One tap on somebody else's snap. A parent decides: the snap is approved or sent back, and the points move.
 * An older sibling marked as a rater recommends: the snap stays waiting, her name is on it, and no points move
 * until a parent confirms. Neither may act on their own picture.
 */
export async function reviewSnapAction(snapId: string, status: "approved" | "rejected", note?: string): Promise<void> {
  const { family, profile } = await requireSession();
  const isParent = profile.role === "parent";
  const isRater = profile.role === "student" && !!(profile as { rater?: boolean }).rater;
  if (!isParent && !isRater) return;
  const admin = createAdminClient();
  const { data: snap } = await admin.from("snaps").select("id, student_id, task_code, kind, taken_on, status").eq("id", snapId).eq("family_id", family.id).maybeSingle();
  if (!snap || snap.student_id === profile.id) return;
  const clean = (note ?? "").trim().slice(0, 200) || null;

  if (!isParent) {
    // A recommendation only. Changing her mind before a parent looks simply overwrites it.
    if (snap.status !== "pending") return;
    await admin.from("snaps").update({ rater_verdict: status, rater_id: profile.id, rater_at: new Date().toISOString(), rater_note: clean }).eq("id", snapId);
    [...STUDENT_PATHS, ...PARENT_PATHS, "/me", "/snaps/review"].forEach((p) => revalidatePath(p));
    return;
  }

  await admin.from("snaps").update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString(), review_note: clean }).eq("id", snapId);
  if (status === "approved") {
    const { data: task } = await admin.from("snap_tasks").select("label").eq("family_id", family.id).eq("code", snap.task_code).maybeSingle();
    await awardSnapPoints(snap.student_id, snap.id, task?.label ?? snap.task_code, snap.kind, snap.taken_on);
  }
  [...STUDENT_PATHS, ...PARENT_PATHS, "/me", "/snaps/review"].forEach((p) => revalidatePath(p));
}

/** Parent: the daily screen-time limit the screenshot is compared with. */
export async function setScreenLimitAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const minutes = Math.max(30, Math.min(600, Number(formData.get("screen_limit_minutes") ?? 180) || 180));
  const supabase = await createClient();
  await supabase.from("families").update({ screen_limit_minutes: minutes }).eq("id", family.id);
  PARENT_PATHS.forEach((p) => revalidatePath(p));
}

/** Parent switch: AI first look on snaps (a few piasters per picture) or straight to a person. */
export async function setSnapAiCheckAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  await supabase.from("families").update({ snap_ai_check: formData.get("snap_ai_check") === "on" }).eq("id", family.id);
  PARENT_PATHS.forEach((p) => revalidatePath(p));
}

/** Adds a task from a template (for every child, or one). */
export async function addSnapTaskAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const code = String(formData.get("code") ?? "");
  const tpl = templateByCode(code);
  if (!tpl) return;
  const studentId = String(formData.get("student_id") ?? "") || null;
  const supabase = await createClient();
  await supabase.from("snap_tasks").insert({ family_id: family.id, student_id: studentId, code: tpl.code, kind: tpl.kind, label: tpl.label, emoji: tpl.emoji, prompt: tpl.prompt, days: tpl.days, window_start: tpl.window_start, window_end: tpl.window_end, weight: tpl.weight });
  [...STUDENT_PATHS, ...PARENT_PATHS].forEach((p) => revalidatePath(p));
}

/** Edits weight, days, window, enabled for one task. */
export async function updateSnapTaskAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => formData.get(`day_${d}`) === "on");
  const ws = String(formData.get("window_start") ?? "").trim();
  const we = String(formData.get("window_end") ?? "").trim();
  await supabase
    .from("snap_tasks")
    .update({
      label: String(formData.get("label") ?? "").trim().slice(0, 60) || undefined,
      weight: Math.max(0, Math.min(50, Number(formData.get("weight") ?? 10) || 0)),
      enabled: formData.get("enabled") === "on",
      days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
      window_start: /^\d{2}:\d{2}$/.test(ws) && /^\d{2}:\d{2}$/.test(we) ? ws : null,
      window_end: /^\d{2}:\d{2}$/.test(ws) && /^\d{2}:\d{2}$/.test(we) ? we : null,
    })
    .eq("id", id)
    .eq("family_id", family.id);
  [...STUDENT_PATHS, ...PARENT_PATHS].forEach((p) => revalidatePath(p));
}

/**
 * Turns a task into a shared chore two or more children take in turns, or back into a plain one.
 * The turn is worked out from the start date, so it never drifts and both the app and the cron agree.
 */
export async function setSnapRotaAction(formData: FormData): Promise<void> {
  const { family } = await requireParent();
  const id = String(formData.get("id") ?? "");
  const period = String(formData.get("period") ?? "week") === "day" ? "day" : "week";
  const supabase = await createClient();
  const { data: kids } = await supabase.from("profiles").select("id").eq("family_id", family.id).eq("role", "student");
  const ids = (kids ?? []).map((k) => k.id as string).filter((k) => formData.get(`kid_${k}`) === "on");
  if (ids.length < 2) {
    await supabase.from("snap_tasks").update({ rota_student_ids: null, rota_period: null, rota_since: null }).eq("id", id).eq("family_id", family.id);
    [...STUDENT_PATHS, ...PARENT_PATHS].forEach((p) => revalidatePath(p));
    return;
  }
  const today = todayIn(family.timezone);
  const { data: current } = await supabase.from("snap_tasks").select("rota_since, rota_period, rota_student_ids").eq("id", id).eq("family_id", family.id).maybeSingle();
  const same = (current?.rota_student_ids as string[] | null)?.join(",") === ids.join(",") && current?.rota_period === period;
  // Keep the existing cycle when only the weights changed; a new line-up starts its first turn today.
  const since = same && current?.rota_since ? (current.rota_since as string) : period === "week" ? weekFor(today, family.allowance_pay_weekday ?? 5).start : today;
  await supabase.from("snap_tasks").update({ rota_student_ids: ids, rota_period: period, rota_since: since, student_id: rotaTurn({ rota_student_ids: ids, rota_period: period, rota_since: since }, today) }).eq("id", id).eq("family_id", family.id);
  [...STUDENT_PATHS, ...PARENT_PATHS].forEach((p) => revalidatePath(p));
}

export async function deleteSnapTaskAction(id: string): Promise<void> {
  const { family } = await requireParent();
  const supabase = await createClient();
  await supabase.from("snap_tasks").delete().eq("id", id).eq("family_id", family.id);
  [...STUDENT_PATHS, ...PARENT_PATHS].forEach((p) => revalidatePath(p));
}

