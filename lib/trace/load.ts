/**
 * Everything one page needs about one child's money and the evidence behind it.
 *
 * Kept apart from the pages so the chooser and the child's own page read the same figures from the same place:
 * a list that says "200 EGP" and a page that then says something else is worse than no list at all.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { allowanceWeekStatus, type WeekStatus } from "@/lib/allowance/week";
import { loadWallet } from "@/lib/wallet/ledger";
import { balances, type WalletEntry } from "@/lib/wallet";
import { owed, timeline, weekIsEmpty, type ClosedWeek, type DayEvidence, type Owed, type PointEntry, type TraceLine } from "@/lib/trace";
import { shiftDate, todayIn } from "@/lib/dates";
import { signHeroUrls } from "@/lib/hero";
import type { Family, Profile } from "@/lib/types";

export type TraceFamily = Parameters<typeof allowanceWeekStatus>[1] & Pick<Family, "id">;

export interface PendingRequest {
  id: string;
  title: string;
  emoji: string;
  cash: string | number | null;
  pointsSpent: number;
  requestedAt: string;
}

export interface ChildSummary {
  id: string;
  name: string;        // first name
  fullName: string;
  grade: number | null;
  emoji: string;
  avatar: string | null;
  points: number;
  owed: Owed;
  /** Days this week with anything at all recorded, out of the days elapsed. */
  activeDays: number;
  elapsedDays: number;
  score: number;
  blocked: string | null;
  requests: number;
}

export interface ChildTrace extends ChildSummary {
  status: WeekStatus;
  days: DayEvidence[];
  lines: TraceLine[];
  requestList: PendingRequest[];
  weekEmpty: boolean;
}

async function students(familyId: string): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("family_id", familyId).eq("role", "student").order("grade", { ascending: false });
  return (data ?? []) as Profile[];
}

/** Avatars for a set of children, or an empty map when none of them has one. */
async function avatarsFor(kids: Profile[]): Promise<Map<string, string>> {
  const ids = kids.map((s) => s.avatar_image_id).filter((x): x is string => !!x);
  if (ids.length === 0) return new Map();
  const { data } = await createAdminClient().from("hero_images").select("id, path").in("id", ids);
  return signHeroUrls((data ?? []) as { id: string; path: string }[]);
}

/** The week's days, from the same rows the score was built on. */
async function evidenceFor(studentId: string, start: string, points: PointEntry[]): Promise<DayEvidence[]> {
  const admin = createAdminClient();
  const end = shiftDate(start, 6);
  const [{ data: ck }, { data: prayers }, { data: logs }, { data: quizzes }, { data: snaps }] = await Promise.all([
    admin.from("checkins").select("checkin_date").eq("student_id", studentId).gte("checkin_date", start).lte("checkin_date", end),
    admin.from("prayer_logs").select("log_date").eq("student_id", studentId).gte("log_date", start).lte("log_date", end),
    admin.from("lesson_logs").select("log_date").eq("student_id", studentId).gte("log_date", start).lte("log_date", end),
    admin.from("quizzes").select("scheduled_for, attempts(submitted_at)").eq("student_id", studentId).gte("scheduled_for", start).lte("scheduled_for", end),
    admin.from("snaps").select("taken_on, status").eq("student_id", studentId).gte("taken_on", start).lte("taken_on", end),
  ]);
  return Array.from({ length: 7 }, (_, k) => {
    const d = shiftDate(start, k);
    return {
      date: d,
      checkedIn: (ck ?? []).some((r) => r.checkin_date === d),
      prayers: (prayers ?? []).filter((r) => r.log_date === d).length,
      classesLogged: (logs ?? []).filter((r) => r.log_date === d).length,
      quizzesDone: (quizzes ?? []).filter((r) => r.scheduled_for === d && (r.attempts ?? []).some((a: { submitted_at: string | null }) => a.submitted_at)).length,
      snaps: (snaps ?? []).filter((r) => r.taken_on === d && r.status !== "rejected").length,
      pointsEarned: points.filter((p) => p.created_at.slice(0, 10) === d && p.delta > 0).reduce((n, p) => n + p.delta, 0),
    };
  });
}

function activeDays(days: DayEvidence[], today: string): { active: number; elapsed: number } {
  const elapsed = days.filter((d) => d.date <= today);
  return {
    active: elapsed.filter((d) => d.checkedIn || d.prayers + d.classesLogged + d.quizzesDone + d.snaps > 0).length,
    elapsed: elapsed.length,
  };
}

/** One row per child for the chooser: the number, and just enough to know whether it is worth opening. */
export async function traceSummaries(family: TraceFamily): Promise<ChildSummary[]> {
  const kids = await students(family.id);
  if (kids.length === 0) return [];
  const ids = kids.map((s) => s.id);
  const admin = createAdminClient();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [avatars, statuses, wallets, { data: weekRows }, { data: pointRows }, { data: reqRows }] = await Promise.all([
    avatarsFor(kids),
    Promise.all(kids.map((s) => allowanceWeekStatus(s.id, family))),
    Promise.all(kids.map((s) => loadWallet(s.id))),
    supabase.from("allowance_weeks").select("id, student_id, week_start, week_end, score, band, amount, paid_at, claimed_at").eq("family_id", family.id).order("week_start", { ascending: false }),
    admin.from("points_ledger").select("student_id, delta, reason, created_at, ref_type").in("student_id", ids),
    supabase.from("redemptions").select("id, student_id").in("student_id", ids).eq("status", "pending"),
  ]);
  const allWeeks = (weekRows ?? []) as (ClosedWeek & { student_id: string })[];
  const allPoints = (pointRows ?? []) as (PointEntry & { student_id: string })[];

  return Promise.all(kids.map(async (s, i) => {
    const mine = allPoints.filter((p) => p.student_id === s.id);
    const days = await evidenceFor(s.id, statuses[i].start, mine);
    const { active, elapsed } = activeDays(days, today);
    return {
      id: s.id,
      name: s.full_name.split(" ")[0],
      fullName: s.full_name,
      grade: s.grade,
      emoji: s.avatar_emoji,
      avatar: s.avatar_image_id ? avatars.get(s.avatar_image_id) ?? null : null,
      points: mine.reduce((n, p) => n + p.delta, 0),
      owed: owed(balances(wallets[i]).withDad, allWeeks.filter((w) => w.student_id === s.id)),
      activeDays: active,
      elapsedDays: elapsed,
      score: statuses[i].score,
      blocked: statuses[i].blocked,
      requests: (reqRows ?? []).filter((r) => r.student_id === s.id).length,
    };
  }));
}

/** One child, in full. Null when the id is not a child of this family — never trust an id from a URL. */
export async function traceFor(family: TraceFamily, studentId: string): Promise<ChildTrace | null> {
  const kids = await students(family.id);
  const s = kids.find((k) => k.id === studentId);
  if (!s) return null;
  const admin = createAdminClient();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [avatars, status, wallet, { data: weekRows }, { data: pointRows }, { data: reqRows }] = await Promise.all([
    avatarsFor([s]),
    allowanceWeekStatus(s.id, family),
    loadWallet(s.id),
    supabase.from("allowance_weeks").select("id, student_id, week_start, week_end, score, band, amount, paid_at, claimed_at").eq("family_id", family.id).eq("student_id", s.id).order("week_start", { ascending: false }),
    admin.from("points_ledger").select("student_id, delta, reason, created_at, ref_type").eq("student_id", s.id).order("created_at", { ascending: false }).limit(400),
    supabase.from("redemptions").select("id, points_spent, requested_at, rewards(title, emoji, cash_amount_egp)").eq("student_id", s.id).eq("status", "pending").order("requested_at", { ascending: false }),
  ]);
  const points = (pointRows ?? []) as PointEntry[];
  const days = await evidenceFor(s.id, status.start, points);
  const { active, elapsed } = activeDays(days, today);
  const requestList = ((reqRows ?? []) as unknown as { id: string; points_spent: number; requested_at: string; rewards: { title: string; emoji: string; cash_amount_egp: string | number | null } | null }[])
    .map((r) => ({ id: r.id, title: r.rewards?.title ?? "reward", emoji: r.rewards?.emoji ?? "🎁", cash: r.rewards?.cash_amount_egp ?? null, pointsSpent: r.points_spent, requestedAt: r.requested_at }));

  return {
    id: s.id,
    name: s.full_name.split(" ")[0],
    fullName: s.full_name,
    grade: s.grade,
    emoji: s.avatar_emoji,
    avatar: s.avatar_image_id ? avatars.get(s.avatar_image_id) ?? null : null,
    points: points.reduce((n, p) => n + p.delta, 0),
    owed: owed(balances(wallet as WalletEntry[]).withDad, (weekRows ?? []) as ClosedWeek[]),
    activeDays: active,
    elapsedDays: elapsed,
    score: status.score,
    blocked: status.blocked,
    requests: requestList.length,
    status,
    days,
    lines: timeline(points, wallet as WalletEntry[]),
    requestList,
    weekEmpty: weekIsEmpty(days.filter((d) => d.date <= today)),
  };
}
