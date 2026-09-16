import { createAdminClient } from "@/lib/supabase/admin";
import { buildDailyReport, type ReportChild } from "@/lib/report";
import { deliverReport } from "@/lib/whatsapp/send";
import { computeStreak } from "@/lib/points";
import { shiftDate, todayIn } from "@/lib/dates";
import { describeAccess } from "@/lib/device";
import { formatInTimeZone } from "date-fns-tz";
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
  const { data: parents } = await admin.from("profiles").select("id").eq("family_id", familyId).eq("role", "parent");
  // Entries today (family-local day) for every account in the family.
  const dayStartIso = new Date(`${today}T00:00:00${formatInTimeZone(new Date(), family.timezone, "xxx")}`).toISOString();
  const memberIds = [...(students ?? []).map((s) => s.id), ...(parents ?? []).map((p) => p.id)];
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
  const children: ReportChild[] = [];
  for (const s of students ?? []) {
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
      admin.from("prayer_logs").select("prayer, status").eq("student_id", s.id).eq("log_date", today),
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
      prayers: (prayers ?? []).map((p) => ({ prayer: p.prayer as string, status: p.status as "on_time" | "late" })),
      coach: coach?.headline ?? null,
      access: accessFor(s.id),
      accessWeek: weekFor(s.id),
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

  const body = buildDailyReport(today, children, (parents ?? []).flatMap((p) => accessFor(p.id)));
  const send = await deliverReport(family, body);
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
