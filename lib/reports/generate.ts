import { createAdminClient } from "@/lib/supabase/admin";
import { buildDailyReport, type ReportChild } from "@/lib/report";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import { computeStreak } from "@/lib/points";
import { shiftDate, todayIn } from "@/lib/dates";
import type { Assignment, AssignmentKind, ItemStatus } from "@/lib/types";

/** Builds today's report for one family, stores it, and tries to send it. */
export async function generateAndSendReport(familyId: string, opts: { force?: boolean } = {}) {
  const admin = createAdminClient();
  const { data: family } = await admin.from("families").select("*").eq("id", familyId).single();
  if (!family) throw new Error("family not found");
  const today = todayIn(family.timezone);
  const tomorrow = shiftDate(today, 1);
  const weekAhead = shiftDate(today, 7);

  if (!opts.force) {
    const { data: existing } = await admin.from("daily_reports").select("id").eq("family_id", familyId).eq("report_date", today).maybeSingle();
    if (existing) return { skipped: true as const };
  }

  const { data: students } = await admin.from("profiles").select("*").eq("family_id", familyId).eq("role", "student").order("grade", { ascending: false });
  const children: ReportChild[] = [];
  for (const s of students ?? []) {
    const [{ data: checkin }, { data: allCheckins }, { data: ledger }, { data: assignments }, { data: pending }] = await Promise.all([
      admin.from("checkins").select("*, checkin_items(status, assignments(title, kind))").eq("student_id", s.id).eq("checkin_date", today).maybeSingle(),
      admin.from("checkins").select("checkin_date").eq("student_id", s.id),
      admin.from("points_ledger").select("delta, created_at").eq("student_id", s.id),
      admin.from("assignments").select("*").eq("student_id", s.id).eq("status", "open"),
      admin.from("redemptions").select("points_spent, rewards(title)").eq("student_id", s.id).eq("status", "pending"),
    ]);
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
    });
  }

  const body = buildDailyReport(today, children);
  const send = await sendWhatsApp(family.parent_whatsapp, body);
  const row = {
    family_id: familyId,
    report_date: today,
    body,
    channel: send.channel,
    status: send.ok ? "sent" : send.channel === "none" ? "pending" : "failed",
    error: send.ok ? null : send.error ?? null,
    sent_at: send.ok ? new Date().toISOString() : null,
  };
  await admin.from("daily_reports").upsert(row, { onConflict: "family_id,report_date" });
  return { skipped: false as const, sent: send.ok, channel: send.channel, error: send.error, body };
}
