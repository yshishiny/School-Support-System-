"use server";

import { failed } from "@/lib/ops/fault";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn } from "@/lib/dates";
import { readGrades } from "@/lib/ai/read-grades";
import { MATERIAL_BUCKET } from "@/lib/materials/server";
import { pingParents } from "@/lib/notify";

const PATHS = ["/me", "/rewards", "/parent", "/parent/progress", "/parent/allowance"];

/** After the browser uploaded the sheet to the materials bucket: record it for the month and read it. */
export async function registerGradeSheetAction(studentId: string, path: string, mime: string, month?: string): Promise<{ error?: string; average?: number | null; appraisal?: string }> {
  const { profile, family } = await requireSession();
  if (!path.startsWith(`${family.id}/${studentId}/`)) return { error: "Bad upload path." };
  if (profile.role !== "parent" && profile.id !== studentId) return { error: "Not allowed." };
  const admin = createAdminClient();
  const { data: student } = await admin.from("profiles").select("full_name, grade").eq("id", studentId).eq("family_id", family.id).maybeSingle();
  if (!student) return { error: "Child not found." };
  const today = todayIn(family.timezone);
  const m = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : `${today.slice(0, 7)}-01`;
  const { data: prev } = await admin.from("grade_sheets").select("average").eq("student_id", studentId).eq("status", "ready").lt("month", m).order("month", { ascending: false }).limit(1).maybeSingle();
  const { data: row, error } = await admin.from("grade_sheets").upsert({ student_id: studentId, family_id: family.id, month: m, path, mime, status: "new", previous_average: prev?.average ?? null }, { onConflict: "student_id,month" }).select("id").single();
  if (error || !row) return failed("actions.grades.registerGradeSheet", error, "Could not save.");
  try {
    const { data: file } = await admin.storage.from(MATERIAL_BUCKET).download(path);
    if (!file) throw new Error("Could not read the file back.");
    const buf = Buffer.from(await file.arrayBuffer());
    const r = await readGrades({ media_type: mime as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", data: buf.toString("base64") }, { studentFirstName: student.full_name.split(" ")[0], grade: student.grade, previousAverage: prev?.average !== undefined && prev?.average !== null ? Number(prev.average) : null });
    await admin.from("grade_sheets").update({ status: "ready", items: r.items, average: r.average, appraisal: r.appraisal, error: null }).eq("id", row.id);
    void pingParents(family.id, `${student.full_name.split(" ")[0]}'s grades sheet is in`, `${r.period}${r.average !== null ? ` · average ${r.average}%` : ""}${prev?.average ? ` (was ${prev.average}%)` : ""}`, "/parent/progress");
    PATHS.forEach((p) => revalidatePath(p));
    return { average: r.average, appraisal: r.appraisal };
  } catch (err) {
    const { error: msg } = await failed("actions.grades.readGradeSheet", err, "Saved, but the sheet could not be read.");
    await admin.from("grade_sheets").update({ status: "failed", error: msg }).eq("id", row.id);
    PATHS.forEach((p) => revalidatePath(p));
    return { error: msg };
  }
}
