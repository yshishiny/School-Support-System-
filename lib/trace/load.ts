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
import { owed, timeline, weekCounts, weekIsEmpty, type ClosedWeek, type DayEvidence, type Owed, type PointEntry, type TraceLine } from "@/lib/trace";
import { evaluate, type Evaluation } from "@/lib/evaluation";
import { wellbeingStatus, type CheckHistoryRow } from "@/lib/wellbeing";
import { computeAttention } from "@/lib/coach/signals-run";
import { masteryMaps, type AttemptWithQuiz } from "@/lib/mastery";
import { examsFor } from "@/lib/exams";
import { straightTalkLabels } from "@/lib/wellbeing";
import type { CoachReport, Topic } from "@/lib/types";
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

export interface SubjectMastery { topic: string; subject: string; pct: number; attempts: number }
export interface CheckpointLite { id: string; kind: string; subject: string | null; status: string; due_by: string | null; week_start: string | null; result: unknown; error: string | null; created_at: string }
export interface GradeSheet { month: string; status: string; average: number | null; previous_average: number | null; appraisal: string | null; items: { subject: string; grade: string; percent: number | null }[] | null }

export interface ChildTrace extends ChildSummary {
  status: WeekStatus;
  days: DayEvidence[];
  lines: TraceLine[];
  requestList: PendingRequest[];
  weekEmpty: boolean;
  /** The one judgement across every discipline, and the evidence under each. */
  evaluation: Evaluation;
  /** Learning detail, folded in from what used to be its own Progress page. */
  learning: {
    weakest: SubjectMastery[];
    strongest: SubjectMastery[];
    recentQuizzes: { title: string; score: number; total: number; on: string }[];
    grades: GradeSheet[];
    coach: CoachReport | null;
    subjectsThisWeek: string[];
    reviewsDue: number;
  };
  wellbeing: { band: "green" | "amber" | "red" | null; note: string; checks: number; signals: number };
  /** Open work, so the Tasks section says something rather than only linking away. */
  tasks: { open: number; overdue: number; soon: number; next: { title: string; kind: string; due: string | null }[] };
  /** Which curriculum he is on, resolved to a name a parent recognises. */
  curriculum: { name: string | null; stream: string | null; grade: number | null };
  /** The family's most recent daily report, for the Reports section. */
  lastReport: { date: string; status: string } | null;
  /**
   * Everything the Progress page used to hold about this child and nothing else did: his exams, the mastery
   * heat map, his checkpoints, the grade sheets, the attempts the app flagged, and the two things a parent
   * writes rather than reads — the target exam and a specialist's guidance.
   */
  school: {
    exams: string[];
    targetExam: string | null;
    targetExamDate: string | null;
    sectionPct: Record<string, number>;
    subjects: { subject: string; topics: { id: string; name: string; pct: number | null }[] }[];
    checkpoints: CheckpointLite[];
    flagged: { id: string; on: string; title: string; score: number | null; total: number | null; reason: string | null }[];
    guidance: string | null;
  };
  /** The honesty check the child answers knowing a parent reads the labels, never the words. */
  straightTalk: { on: string; admitted: string[] }[];
  /** Who else is in the family, for the row of small faces that switches child. */
  siblings: { id: string; name: string; emoji: string; avatar: string | null }[];
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

/** Mastery per topic from submitted attempts, named so a parent reads a subject rather than a uuid. */
/** One topic's mastery percentage, or null when he has never practised it. */
function pctByTopicFor(attempts: AttemptWithQuiz[], topicId: string): number | null {
  const { topic } = masteryMaps(attempts.filter((a) => a.quizzes?.topic_id === topicId));
  const v = topic.get(topicId);
  return v === undefined ? null : Math.round(v);
}

function masteryOf(attempts: AttemptWithQuiz[], topics: Topic[]): { weakest: SubjectMastery[]; strongest: SubjectMastery[] } {
  const { topic: pctByTopic } = masteryMaps(attempts);
  const tries = new Map<string, number>();
  for (const a of attempts) {
    const id = a.quizzes?.topic_id;
    if (id && a.submitted_at && !a.flagged) tries.set(id, (tries.get(id) ?? 0) + 1);
  }
  const named: SubjectMastery[] = [];
  pctByTopic.forEach((pct, id) => {
    const t = topics.find((x) => x.id === id);
    if (t) named.push({ topic: t.name, subject: t.subject, pct: Math.round(pct), attempts: tries.get(id) ?? 0 });
  });
  const sorted = [...named].sort((a, b) => a.pct - b.pct);
  return { weakest: sorted.slice(0, 5), strongest: [...sorted].reverse().slice(0, 5) };
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
    avatarsFor(kids),
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

  // Everything the Progress page used to hold about this one child, plus the ticks and alerts the evaluation
  // needs. Read together so the page is one round trip rather than six.
  const [
    { data: topicRows }, { data: attemptRows }, { data: gradeRows }, { data: coachRows },
    { data: subjRows }, { data: dueRows }, { data: wbRows }, { data: tickRows }, { data: alertRows },
    attention,
  ] = await Promise.all([
    supabase.from("topics").select("*"),
    supabase.from("attempts").select("*, quizzes(topic_id, act_section, track, title)").eq("student_id", s.id).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(200),
    admin.from("grade_sheets").select("month, status, average, previous_average, appraisal, items").eq("student_id", s.id).order("month", { ascending: false }).limit(3),
    supabase.from("coach_reports").select("*").eq("student_id", s.id).order("created_at", { ascending: false }).limit(1),
    admin.from("lesson_logs").select("subject_name").eq("student_id", s.id).gte("log_date", shiftDate(today, -6)),
    admin.from("review_queue").select("id", { count: "exact", head: false }).eq("student_id", s.id).lte("due_date", today),
    admin.from("wellbeing_checks").select("student_id, instrument, taken_on, band, score").eq("student_id", s.id).order("taken_on", { ascending: false }).limit(60),
    admin.from("kpi_ticks").select("code, value, tick_date").eq("student_id", s.id).gte("tick_date", status.start).lte("tick_date", status.end),
    supabase.from("safety_alerts").select("id").eq("student_id", s.id).is("acknowledged_at", null),
    computeAttention(s.id).catch(() => ({ today, score: 0, tier: "none" as const, signals: [] })),
  ]);

  // Open work, the curriculum he sits in, and the last report the family was sent: one more round trip, so the
  // sections that link away can still say something before a parent decides to follow the link.
  const [{ data: taskRows }, { data: curriculumRows }, { data: reportRow }, { data: cpRows }, { data: straightRows }] = await Promise.all([
    supabase.from("assignments").select("title, kind, due_date, status").eq("student_id", s.id).eq("status", "open").order("due_date", { nullsFirst: false }).limit(50),
    (s as Profile & { curriculum_id?: string | null }).curriculum_id
      ? supabase.from("curricula").select("id, name").eq("id", (s as Profile & { curriculum_id?: string | null }).curriculum_id!)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from("daily_reports").select("report_date, status").eq("family_id", family.id).order("report_date", { ascending: false }).limit(1),
    admin.from("checkpoints").select("id, kind, subject, status, due_by, week_start, result, error, created_at").eq("student_id", s.id).order("created_at", { ascending: false }).limit(12),
    // The answers never leave the server: only the labels of what he admitted to are passed up.
    admin.from("wellbeing_checks").select("taken_on, answers").eq("student_id", s.id).eq("instrument", "straight").order("taken_on", { ascending: false }).limit(6),
  ]);
  const tasksOpen = (taskRows ?? []) as { title: string; kind: string; due_date: string | null; status: string }[];
  const weekAhead = shiftDate(today, 7);

  const topics = (topicRows ?? []) as Topic[];
  const attempts = (attemptRows ?? []) as AttemptWithQuiz[];
  const mastery = masteryOf(attempts, topics);
  const recentQuizzes = attempts.slice(0, 8)
    .filter((a) => a.score !== null && a.total !== null)
    .map((a) => ({ title: a.quizzes?.title ?? "Quiz", score: a.score!, total: a.total!, on: (a.submitted_at ?? "").slice(0, 10) }));
  const wb = wellbeingStatus(((wbRows ?? []) as CheckHistoryRow[]), today);

  const ticks = (tickRows ?? []) as { code: string; value: boolean; tick_date: string }[];
  const tickCount = (code: string) => ticks.filter((t) => t.code === code).length;
  const badCount = (code: string) => ticks.filter((t) => t.code === code && !t.value).length;

  // The week's KPI lines already carry the arithmetic, and their wording is what the score was built from, so
  // the counts are read back out of them rather than recomputed — a page that states two different figures for
  // the same fact is worse than one that states none. weekCounts is pinned against live scoreWeek output.
  const counts = weekCounts(status.results);

  const evaluation = evaluate({
    academic: {
      classesDue: counts.classesDue, classesLogged: counts.classesLogged,
      quizzesPlanned: counts.quizzesPlanned, quizzesAttempted: counts.quizzesAttempted,
      homeworkDue: counts.homeworkDue, homeworkOnTime: counts.homeworkOnTime,
      recentQuizzes: recentQuizzes.length,
      recentCorrect: recentQuizzes.reduce((n, q) => n + q.score, 0),
      recentTotal: recentQuizzes.reduce((n, q) => n + q.total, 0),
      gradeAverage: (gradeRows ?? [])[0]?.average ?? null,
      gradePrevious: (gradeRows ?? [])[0]?.previous_average ?? null,
    },
    manners: { daysTicked: tickCount("manners"), daysBad: badCount("manners"), daysElapsed: elapsed, alerts: (alertRows ?? []).length },
    duties: {
      snapsDue: counts.snapsDue, snapsDone: counts.snapsDone,
      dishTicked: tickCount("dish"), dishBad: badCount("dish"),
      phoneTicked: tickCount("phone"), phoneBad: badCount("phone"),
      daysElapsed: elapsed,
    },
    faith: {
      daysElapsed: elapsed,
      daysWithFour: days.filter((d) => d.date <= today && d.prayers >= 4).length,
      logged: days.filter((d) => d.date <= today).reduce((n, d) => n + d.prayers, 0),
    },
    wellbeing: { band: wb.band, signals: attention.signals.length },
    money: {
      points: points.reduce((n, p) => n + p.delta, 0),
      owedEgp: owed(balances(wallet as WalletEntry[]).withDad, (weekRows ?? []) as ClosedWeek[]).ifSettled,
      requests: requestList.length,
      blocked: !!status.blocked,
    },
  });

  // The mastery heat map: every school topic at this child's grade, with the percentage where one exists.
  const { section: sectionPct } = masteryMaps(attempts);
  const schoolTopics = topics.filter((x) => x.track === "school" && x.grade === s.grade);
  const subjectsOf = [...new Set(schoolTopics.map((x) => x.subject))].sort();
  const profileWithExam = s as Profile & { target_exam?: string | null; target_exam_date?: string | null; professional_guidance?: string | null };

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
    evaluation,
    learning: {
      ...mastery,
      recentQuizzes,
      grades: (gradeRows ?? []) as GradeSheet[],
      coach: ((coachRows ?? []) as CoachReport[])[0] ?? null,
      subjectsThisWeek: [...new Set((subjRows ?? []).map((r) => r.subject_name as string))].sort(),
      reviewsDue: (dueRows ?? []).length,
    },
    wellbeing: { band: wb.band, note: wb.note, checks: wb.checks, signals: attention.signals.length },
    tasks: {
      open: tasksOpen.length,
      overdue: tasksOpen.filter((a) => a.due_date && a.due_date < today).length,
      soon: tasksOpen.filter((a) => a.due_date && a.due_date >= today && a.due_date <= weekAhead).length,
      next: tasksOpen.slice(0, 5).map((a) => ({ title: a.title, kind: a.kind, due: a.due_date })),
    },
    curriculum: {
      name: ((curriculumRows ?? []) as { name: string }[])[0]?.name ?? null,
      stream: (s as Profile & { stream?: string | null }).stream ?? null,
      grade: s.grade,
    },
    lastReport: ((reportRow ?? []) as { report_date: string; status: string }[])[0]
      ? { date: (reportRow as { report_date: string; status: string }[])[0].report_date, status: (reportRow as { report_date: string; status: string }[])[0].status }
      : null,
    school: {
      exams: examsFor(profileWithExam.target_exam ?? null, s.grade),
      targetExam: profileWithExam.target_exam ?? null,
      targetExamDate: profileWithExam.target_exam_date ?? null,
      sectionPct: Object.fromEntries(sectionPct),
      subjects: subjectsOf.map((subject) => ({
        subject,
        topics: schoolTopics.filter((x) => x.subject === subject).map((x) => ({ id: x.id, name: x.name, pct: pctByTopicFor(attempts, x.id) })),
      })),
      checkpoints: (cpRows ?? []) as CheckpointLite[],
      flagged: attempts.filter((a) => a.flagged).slice(0, 8).map((a) => ({
        id: a.id, on: (a.submitted_at ?? "").slice(0, 10), title: a.quizzes?.title ?? "review",
        score: a.score, total: a.total, reason: (a as AttemptWithQuiz & { flag_reason?: string | null }).flag_reason ?? null,
      })),
      guidance: profileWithExam.professional_guidance ?? null,
    },
    straightTalk: ((straightRows ?? []) as { taken_on: string; answers: Record<string, string> }[])
      .map((r) => ({ on: r.taken_on, admitted: straightTalkLabels(r.answers) })),
    siblings: kids.filter((k) => k.id !== s.id).map((k) => ({
      id: k.id,
      name: k.full_name.split(" ")[0],
      emoji: k.avatar_emoji,
      avatar: k.avatar_image_id ? avatars.get(k.avatar_image_id) ?? null : null,
    })),
  };
}
