import { createAdminClient } from "@/lib/supabase/admin";
import { amountFor, mergeKpis, scoreWeek, weekFor, type KpiOverride, type WeekResult } from "@/lib/allowance";
import { dueInstruments, type CheckHistoryRow } from "@/lib/wellbeing";
import { shiftDate, todayIn } from "@/lib/dates";
import { snapCounts, type SnapLite, type SnapTask } from "@/lib/snaps";
import { classLogCoverage, missingLine, type ClassLogRow } from "@/lib/class-log";
import { compensatedRefs } from "@/lib/compensation";
import { materialsKpi, materialStages, nextStage } from "@/lib/materials/study";
import type { Family } from "@/lib/types";

export interface WeekStatus extends WeekResult {
  start: string;
  end: string;
  amount: number;
  allowance: number;
  enabled: boolean;
}

/** Live status of a student's current (or a given) allowance week. */
export async function allowanceWeekStatus(studentId: string, family: Pick<Family, "id" | "timezone" | "allowance_enabled" | "allowance_amount" | "allowance_pay_weekday" | "allowance_kpis">, anchorDate?: string): Promise<WeekStatus> {
  const admin = createAdminClient();
  const today = todayIn(family.timezone);
  const { start, end } = weekFor(anchorDate ?? today, family.allowance_pay_weekday);
  const { data: taskRows } = await admin.from("snap_tasks").select("*").eq("family_id", family.id).or(`student_id.is.null,student_id.eq.${studentId}`);
  const snapTasks = (taskRows ?? []) as SnapTask[];
  const kpis = mergeKpis(family.allowance_kpis as KpiOverride[] | null, snapTasks);
  const [{ data: ticks }, { data: prayers }, { data: checkins }, { data: planned }, { data: wb }, { data: snapRows }] = await Promise.all([
    admin.from("kpi_ticks").select("tick_date, code, value").eq("student_id", studentId).gte("tick_date", start).lte("tick_date", end),
    admin.from("prayer_logs").select("log_date, prayer, status, entered_late").eq("student_id", studentId).gte("log_date", start).lte("log_date", end),
    admin.from("checkins").select("checkin_date, entered_late").eq("student_id", studentId).gte("checkin_date", start).lte("checkin_date", end),
    admin.from("quizzes").select("scheduled_for, attempts(submitted_at)").eq("student_id", studentId).not("scheduled_for", "is", null).gte("scheduled_for", start).lte("scheduled_for", today < end ? today : end),
    admin.from("wellbeing_checks").select("instrument, taken_on, band, score").eq("student_id", studentId).gte("taken_on", shiftDate(start, -60)).order("taken_on", { ascending: false }),
    admin.from("snaps").select("task_code, taken_on, status, ai_verdict").eq("student_id", studentId).gte("taken_on", start).lte("taken_on", end),
  ]);
  const lastDay = today < end ? today : end;
  const [{ data: ttRows }, { data: logRows }, { data: offRows }] = await Promise.all([
    admin.from("timetable_entries").select("weekday, subject_name").eq("student_id", studentId),
    admin.from("lesson_logs").select("log_date, subject_name, note, homework_given").eq("student_id", studentId).gte("log_date", start).lte("log_date", lastDay),
    admin.from("school_days_off").select("day").eq("family_id", family.id).gte("day", start).lte("day", end),
  ]);
  const { data: cpRow } = await admin.from("checkpoints").select("status").eq("student_id", studentId).eq("kind", "weekly").eq("week_start", start).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const checkpoint = { status: (cpRow?.status as "ready" | "done" | "expired" | "failed" | undefined) ?? "none" } as const;
  const monthStart = `${today.slice(0, 7)}-01`;
  const [{ data: hwRows }, { data: sheetRow }] = await Promise.all([
    admin.from("assignments").select("due_date, status, completed_at, kind").eq("student_id", studentId).in("kind", ["homework", "project"]).gte("due_date", start).lte("due_date", lastDay),
    admin.from("grade_sheets").select("id").eq("student_id", studentId).eq("month", monthStart).maybeSingle(),
  ]);
  const hw = (hwRows ?? []) as { due_date: string; status: string; completed_at: string | null; kind: string }[];
  const homework = { due: hw.length, doneOnTime: hw.filter((a) => a.status === "done" && (!a.completed_at || a.completed_at.slice(0, 10) <= a.due_date)).length, open: hw.filter((a) => a.status === "open").length };
  const gradesSheet = { uploaded: !!sheetRow, dayOfMonth: Number(today.slice(8, 10)) };
  const [{ data: matRows }, { data: matQuizRows }] = await Promise.all([
    admin.from("materials").select("id, title, created_at").eq("student_id", studentId).eq("status", "ready").gte("created_at", `${shiftDate(start, -14)}T00:00:00Z`),
    admin.from("quizzes").select("material_id, attempts(submitted_at)").eq("student_id", studentId).not("material_id", "is", null).gte("created_at", `${shiftDate(start, -14)}T00:00:00Z`),
  ]);
  const matList = ((matRows ?? []) as { id: string; title: string; created_at: string }[]).map((m) => ({ id: m.id, title: m.title, uploadedOn: m.created_at.slice(0, 10) }));
  const matAttempts = ((matQuizRows ?? []) as { material_id: string; attempts: { submitted_at: string | null }[] }[]).flatMap((q) => q.attempts.filter((a) => a.submitted_at).map((a) => ({ materialId: q.material_id, date: a.submitted_at!.slice(0, 10) })));
  const mk = materialsKpi(matList, matAttempts, start, lastDay);
  const nextMat = matList.map((m) => ({ m, st: nextStage(materialStages(m.uploadedOn, matAttempts.filter((a) => a.materialId === m.id).map((a) => a.date), today)) })).filter((x) => x.st).sort((a, b) => a.st!.dueBy.localeCompare(b.st!.dueBy))[0];
  const materialsInput = { due: mk.due, done: mk.done, next: nextMat ? nextMat.m.title : null };
  const coverage = classLogCoverage(start, lastDay, ttRows ?? [], (logRows ?? []) as ClassLogRow[], (offRows ?? []).map((d) => d.day as string));
  const classLog = { due: coverage.due, done: coverage.done, missingLine: coverage.days.length ? missingLine(coverage.days) : null };
  const snapDays: Record<string, string[]> = {};
  for (const sn of (snapRows ?? []) as SnapLite[]) {
    if (!snapCounts(sn)) continue;
    const key = `snap:${sn.task_code}`;
    if (!snapDays[key]?.includes(sn.taken_on)) (snapDays[key] ??= []).push(sn.taken_on);
  }
  // Late entries count only once balanced (two ayahs read, one question right).
  const { data: compRows } = await admin.from("late_compensations").select("ref, correct").eq("student_id", studentId).gte("created_at", `${shiftDate(start, -7)}T00:00:00Z`);
  const balanced = compensatedRefs((compRows ?? []) as { ref: string; correct: boolean | null }[]);
  const prayerDays: Record<string, number> = {};
  for (const p of (prayers ?? []) as { log_date: string; prayer: string; status: string; entered_late: boolean }[]) {
    if (p.entered_late && !balanced.has(`prayer:${p.log_date}:${p.prayer}`)) continue;
    prayerDays[p.log_date] = (prayerDays[p.log_date] ?? 0) + 1;
  }
  const checkinDates = ((checkins ?? []) as { checkin_date: string; entered_late: boolean }[]).filter((c) => !c.entered_late || balanced.has(`checkin:${c.checkin_date}`)).map((c) => c.checkin_date);
  const plannedRows = (planned ?? []) as { scheduled_for: string; attempts: { submitted_at: string | null }[] }[];
  const history = (wb ?? []) as CheckHistoryRow[];
  // Something was due in this week if, at the start of the week, an instrument was due (using history before the week) …
  const before = history.filter((h) => h.taken_on < start);
  const wellbeingDue = dueInstruments(start, before).length > 0 || dueInstruments(today < end ? today : end, before).length > 0;
  const wellbeingDone = history.some((h) => h.taken_on >= start && h.taken_on <= end);
  const result = scoreWeek({
    kpis,
    start,
    end,
    today,
    ticks: (ticks ?? []) as { tick_date: string; code: string; value: boolean }[],
    prayerDays,
    checkinDates,
    plannedTotal: plannedRows.length,
    plannedAttempted: plannedRows.filter((q) => q.attempts.some((a) => a.submitted_at)).length,
    wellbeingDue,
    wellbeingDone,
    snapDays,
    classLog,
    checkpoint,
    homework,
    gradesSheet,
    materials: materialsInput,
  });
  return { ...result, start, end, amount: amountFor(result.score, family.allowance_amount), allowance: family.allowance_amount, enabled: family.allowance_enabled };
}

/** Closes a finished week (the day after pay day or later): stores the result once. Returns the row or null when nothing to close. */
export async function closeAllowanceWeek(studentId: string, family: Pick<Family, "id" | "timezone" | "allowance_enabled" | "allowance_amount" | "allowance_pay_weekday" | "allowance_kpis">) {
  if (!family.allowance_enabled) return null;
  const admin = createAdminClient();
  const today = todayIn(family.timezone);
  const yesterday = shiftDate(today, -1);
  const { end } = weekFor(yesterday, family.allowance_pay_weekday);
  if (end !== yesterday) return null; // the week closed on pay day; we run the morning after
  const status = await allowanceWeekStatus(studentId, family, yesterday);
  const { data: existing } = await admin.from("allowance_weeks").select("id").eq("student_id", studentId).eq("week_start", status.start).maybeSingle();
  if (existing) return null;
  const { data } = await admin
    .from("allowance_weeks")
    .insert({ student_id: studentId, family_id: family.id, week_start: status.start, week_end: status.end, score: status.score, band: status.band, amount: status.amount, breakdown: status.results })
    .select("*")
    .single();
  // Discipline rule: a week that closes with classes never logged gets the automatic practice (no way to skip it).
  const gap = status.results.find((r) => r.code === "classlog");
  if (gap && gap.fraction < 1) {
    const { data: open } = await admin.from("consequences").select("id").eq("student_id", studentId).eq("code", "classlog_gap").is("closed_at", null).limit(1);
    if (!open?.length) {
      await admin.from("consequences").insert({ student_id: studentId, family_id: family.id, code: "classlog_gap", label: "Class log left unfinished", reason: `Week ${status.start} → ${status.end}: ${gap.detail}`, starts_on: today, ends_on: shiftDate(today, 2), earn_back_task: "Fill in every missing class in the check-in, then tell a parent." });
    }
  }
  return data;
}
