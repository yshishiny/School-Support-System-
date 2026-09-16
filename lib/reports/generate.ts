import { createAdminClient } from "@/lib/supabase/admin";
import { buildDailyReport, type ReportChild } from "@/lib/report";
import { notifyParents, familyParents } from "@/lib/notify";
import { custodianFor, parentName, type CustodyOverride } from "@/lib/custody";
import { schoolDay, type DayOff } from "@/lib/school-day";
import { classLogCoverage, missingLine, type ClassLogRow } from "@/lib/class-log";
import { computeIntegrity } from "@/lib/integrity/run";
import { straightTalkLabels } from "@/lib/wellbeing";
import { weekFor as allowanceWeekFor } from "@/lib/allowance";
import { dueSnapTasks, taskDayState, type HandwritingAnalysis, type SnapLite, type SnapTask } from "@/lib/snaps";
import { computeStreak } from "@/lib/points";
import { shiftDate, todayIn } from "@/lib/dates";
import { describeAccess } from "@/lib/device";
import { formatInTimeZone } from "date-fns-tz";
import { classifyPosition, type Place } from "@/lib/places";
import type { Assignment, AssignmentKind, ItemStatus } from "@/lib/types";

/** Builds today's report for one family, stores it, and tries to send it. */
export async function generateAndSendReport(familyId: string, opts: { force?: boolean } = {}) {
  const admin = createAdminClient();
  const { data: family, error: familyError } = await admin.from("families").select("*").eq("id", familyId).single();
  if (familyError || !family) throw new Error(`Could not load the family: ${familyError?.message ?? "not found"}`);
  const today = todayIn(family.timezone);
  const tomorrow = shiftDate(today, 1);
  const weekAhead = shiftDate(today, 7);

  if (!opts.force) {
    const { data: existing } = await admin.from("daily_reports").select("id").eq("family_id", familyId).eq("report_date", today).maybeSingle();
    if (existing) return { skipped: true as const };
  }

  const { data: students } = await admin.from("profiles").select("*").eq("family_id", familyId).eq("role", "student").order("grade", { ascending: false });
  const parents = await familyParents(familyId);
  const { data: overrideRows } = await admin.from("custody_overrides").select("day, parent_id").eq("family_id", familyId).eq("day", today);
  const custodian = custodianFor(today, family.custody_pattern, (overrideRows ?? []) as CustodyOverride[]);
  const custodianParent = custodian ? parents.find((p) => p.id === custodian) ?? null : null;
  // Entries today (family-local day) for every account in the family.
  const dayStartIso = new Date(`${today}T00:00:00${formatInTimeZone(new Date(), family.timezone, "xxx")}`).toISOString();
  const memberIds = [...(students ?? []).map((s) => s.id), ...parents.map((p) => p.id)];
  const weekStartIso = new Date(Date.parse(dayStartIso) - 6 * 86400000).toISOString();
  const { data: accessAll } = memberIds.length ? await admin.from("access_logs").select("user_id, event, ip, city, country, device_os, device_browser, created_at").in("user_id", memberIds).gte("created_at", weekStartIso).order("created_at") : { data: [] };
  const accessRows = (accessAll ?? []).filter((r) => r.created_at >= dayStartIso);
  const weekFor = (id: string) => {
    const mine = (accessAll ?? []).filter((r) => r.user_id === id);
    return { logins: mine.length, days: new Set(mine.map((r) => formatInTimeZone(new Date(r.created_at), family.timezone, "yyyy-MM-dd"))).size, countries: [...new Set(mine.map((r) => r.country).filter((x): x is string => !!x))] };
  };
  const accessFor = (id: string) => ((accessRows ?? []) as { user_id: string; event: "login" | "visit"; ip: string | null; city: string | null; country: string | null; device_os: string | null; device_browser: string | null; created_at: string }[])
    .filter((r) => r.user_id === id)
    .map((r) => ({ time: formatInTimeZone(new Date(r.created_at), family.timezone, "HH:mm"), event: r.event, where: describeAccess(r), ip: r.ip }));
  const { data: pingRows } = memberIds.length ? await admin.from("location_pings").select("user_id, latitude, longitude, source, created_at").in("user_id", memberIds).gte("created_at", dayStartIso).order("created_at", { ascending: false }) : { data: [] };
  const { data: placeRows } = await admin.from("places").select("id, kind, label, latitude, longitude, radius_m, student_id").eq("family_id", familyId);
  const places = (placeRows ?? []) as Place[];
  const lastLocationFor = (id: string) => {
    const p = (pingRows ?? []).find((r) => r.user_id === id);
    return p ? { time: formatInTimeZone(new Date(p.created_at), family.timezone, "HH:mm"), lat: p.latitude as number, lng: p.longitude as number, source: p.source as string, place: places.length ? classifyPosition(p.latitude as number, p.longitude as number, places, id).label : null } : null;
  };
  const studentIds = (students ?? []).map((s) => s.id);
  const weekStart = allowanceWeekFor(today, family.allowance_pay_weekday).start;
  const [{ data: ttRows }, { data: offRows }, { data: taskRows }, { data: snapRows }, { data: weekLogs }, { data: weekOff }] = await Promise.all([
    studentIds.length ? admin.from("timetable_entries").select("student_id, weekday, subject_name, start_time, end_time").in("student_id", studentIds) : { data: [] },
    admin.from("school_days_off").select("day, label").eq("family_id", familyId).eq("day", today),
    admin.from("snap_tasks").select("*").eq("family_id", familyId),
    studentIds.length ? admin.from("snaps").select("student_id, task_code, kind, taken_on, status, ai_verdict, ai_detail, created_at").in("student_id", studentIds).gte("taken_on", shiftDate(today, -14)).order("created_at") : { data: [] },
    studentIds.length ? admin.from("lesson_logs").select("student_id, log_date, subject_name, note, homework_given").in("student_id", studentIds).gte("log_date", weekStart).lte("log_date", today) : { data: [] },
    admin.from("school_days_off").select("day").eq("family_id", familyId).gte("day", weekStart).lte("day", today),
  ]);
  const snapTasks = (taskRows ?? []) as SnapTask[];
  type SnapRow = SnapLite & { student_id: string; kind: string; ai_detail: (Partial<HandwritingAnalysis> & { score?: number }) | null };
  const allSnaps = (snapRows ?? []) as SnapRow[];
  const children: ReportChild[] = [];
  for (const s of students ?? []) {
    const sd = schoolDay(today, ((ttRows ?? []) as { student_id: string; weekday: number; subject_name: string; start_time: string; end_time: string | null }[]).filter((t) => t.student_id === s.id), (offRows ?? []) as DayOff[]);
    const mySnaps = allSnaps.filter((x) => x.student_id === s.id);
    const integrity = await computeIntegrity(s.id, today, family.timezone).catch(() => []);
    const { data: straightRow } = await admin.from("wellbeing_checks").select("answers, taken_on").eq("student_id", s.id).eq("instrument", "straight").gte("taken_on", shiftDate(today, -7)).order("taken_on", { ascending: false }).limit(1).maybeSingle();
    const straightLabels = straightRow ? straightTalkLabels(straightRow.answers as Record<string, string>) : null;
    const cov = classLogCoverage(weekStart, today, ((ttRows ?? []) as { student_id: string; weekday: number; subject_name: string }[]).filter((t) => t.student_id === s.id), ((weekLogs ?? []) as (ClassLogRow & { student_id: string })[]).filter((l) => l.student_id === s.id), (weekOff ?? []).map((d) => d.day as string));
    const snapsToday = dueSnapTasks(today, snapTasks, s.id).filter((t) => t.kind !== "handwriting").map((t) => {
      const st = taskDayState(t, mySnaps, today, "23:59");
      return { label: t.label, state: (st === "due" || st === "closed" ? "missing" : st) as "approved" | "good" | "sent" | "rejected" | "missing" };
    });
    const hw = mySnaps.filter((x) => x.kind === "handwriting" && x.ai_detail?.score !== undefined);
    const hwLatest = hw[hw.length - 1];
    const handwriting = hwLatest && hwLatest.taken_on >= shiftDate(today, -6) ? { score: hwLatest.ai_detail!.score!, before: hw.length > 1 ? hw[hw.length - 2].ai_detail!.score ?? null : null, focus: hwLatest.ai_detail!.focus ?? [] } : null;
    const dayAgoIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ data: checkin }, { data: allCheckins }, { data: ledger }, { data: assignments }, { data: pending }, { data: attempts }, { count: reviewsDue }, { data: covered }, { data: prayers }, { data: coach }, { data: attention }] = await Promise.all([
      admin.from("checkins").select("*, checkin_items(status, assignments(title, kind))").eq("student_id", s.id).eq("checkin_date", today).maybeSingle(),
      admin.from("checkins").select("checkin_date").eq("student_id", s.id),
      admin.from("points_ledger").select("delta, created_at").eq("student_id", s.id),
      admin.from("assignments").select("*").eq("student_id", s.id).eq("status", "open"),
      admin.from("redemptions").select("points_spent, rewards(title)").eq("student_id", s.id).eq("status", "pending"),
      admin.from("attempts").select("score, total, flagged, flag_reason, quizzes(title)").eq("student_id", s.id).gte("submitted_at", dayAgoIso),
      admin.from("review_queue").select("id", { count: "exact", head: true }).eq("student_id", s.id).lte("due_date", today),
      admin.from("lesson_logs").select("subject_name, note").eq("student_id", s.id).eq("log_date", today),
      admin.from("prayer_logs").select("prayer, status, entered_late, claim").eq("student_id", s.id).eq("log_date", today),
      admin.from("coach_reports").select("headline").eq("student_id", s.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("attention_snapshots").select("tier, signals").eq("student_id", s.id).order("taken_on", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const done = (attempts ?? []) as unknown as { score: number | null; total: number | null; flagged: boolean; flag_reason: string | null; quizzes: { title: string } | null }[];
    const open = (assignments ?? []) as Assignment[];
    // "Today" for points: anything earned in the last 24 hours.
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    children.push({
      name: s.full_name,
      grade: s.grade,
      checkin: checkin
        ? {
            mood: checkin.mood,
            minutes: checkin.minutes_studied,
            learned: checkin.learned,
            stuckOn: checkin.stuck_on,
            enteredLate: !!checkin.entered_late,
            items: ((checkin.checkin_items ?? []) as { status: ItemStatus; assignments: { title: string; kind: AssignmentKind } | null }[]).map((i) => ({
              title: i.assignments?.title ?? "task",
              kind: i.assignments?.kind ?? "homework",
              status: i.status,
            })),
          }
        : null,
      pointsToday: (ledger ?? []).filter((l) => new Date(l.created_at).getTime() >= dayAgo && l.delta > 0).reduce((a, l) => a + l.delta, 0),
      balance: (ledger ?? []).reduce((a, l) => a + l.delta, 0),
      streak: computeStreak((allCheckins ?? []).map((c) => c.checkin_date), today),
      dueTomorrow: open.filter((a) => a.due_date === tomorrow).map((a) => ({ title: a.title, kind: a.kind })),
      upcoming: open
        .filter((a) => (a.kind === "quiz" || a.kind === "exam") && a.due_date && a.due_date > today && a.due_date <= weekAhead)
        .map((a) => ({ title: a.title, kind: a.kind, due_date: a.due_date! })),
      overdue: open
        .filter((a) => a.due_date && a.due_date < today && (a.kind === "homework" || a.kind === "project"))
        .map((a) => ({ title: a.title, kind: a.kind, due_date: a.due_date! })),
      pendingRedemptions: ((pending ?? []) as unknown as { points_spent: number; rewards: { title: string } | null }[]).map((p) => ({
        title: p.rewards?.title ?? "reward",
        points: p.points_spent,
      })),
      covered: (covered ?? []).map((l) => ({ subject: l.subject_name, note: l.note })),
      prayers: (prayers ?? []).map((p) => ({ prayer: p.prayer as string, status: p.status as "on_time" | "late" | "missed", enteredLate: !!p.entered_late, claim: (p.claim as string | null) ?? null })),
      coach: coach?.headline ?? null,
      school: { off: sd.off, reason: sd.reason, lessons: sd.lessons.length },
      classLog: { due: cov.due, done: cov.done, missing: cov.days.length ? missingLine(cov.days) : null },
      askTonight: [...(straightLabels ? [straightLabels.length ? `Straight talk this week: he admitted a slip on ${straightLabels.join(", ")}. Thank him for saying so before anything else.` : "Straight talk this week: nothing to admit."] : []), ...integrity.slice(0, 2).map((x) => x.ask)],
      snaps: snapsToday,
      handwriting,
      access: accessFor(s.id),
      accessWeek: weekFor(s.id),
      lastLocation: lastLocationFor(s.id),
      attention: attention ? { tier: attention.tier as string, labels: ((attention.signals ?? []) as { label: string }[]).map((x) => x.label) } : null,
      practice: {
        sets: done.length,
        correct: done.reduce((a, d) => a + (d.score ?? 0), 0),
        total: done.reduce((a, d) => a + (d.total ?? 0), 0),
        reviewsDue: reviewsDue ?? 0,
        flags: done.filter((d) => d.flagged).map((d) => `${d.quizzes?.title ?? "review"}: ${d.flag_reason}`),
      },
    });
  }

  const custodyLine = custodian ? `🏠 Tonight the kids are with ${parentName(custodianParent)}.` : null;
  const body = buildDailyReport(today, children, parents.flatMap((p) => accessFor(p.id)), custodyLine);
  // Each parent gets the same report; the custody line is personal ("with you tonight").
  const send = await notifyParents(familyId, (p) => (custodian === p.id ? body.replace(`with ${parentName(custodianParent)}.`, "with you.") : body));
  const row = {
    family_id: familyId,
    report_date: today,
    body,
    channel: send.channel,
    status: send.ok ? "sent" : send.channel === "none" ? "pending" : "failed",
    error: send.ok ? null : send.error ?? null,
    sent_at: send.ok ? new Date().toISOString() : null,
  };
  const { error: saveError } = await admin.from("daily_reports").upsert(row, { onConflict: "family_id,report_date" });
  if (saveError) throw new Error(`Could not save the report: ${saveError.message}`);
  return { skipped: false as const, sent: send.ok, channel: send.channel, error: send.error, body };
}
