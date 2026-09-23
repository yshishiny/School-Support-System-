/**
 * Gathers what the coach needs to judge a student: per-subject results and trends, class notes,
 * routine (check-ins, prayers), and how the weekly plan went. No AI here; pure data shaping.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftDate, todayIn } from "@/lib/dates";
import { computeStreak } from "@/lib/points";
import { subjectLabel } from "@/lib/plan";
import type { Profile, Topic } from "@/lib/types";
import { learnerOf, schoolTopicsFor } from "@/lib/curriculum";

export interface SubjectStat {
  subject: string;
  label: string;
  language: "en" | "ar";
  sets: number;
  pct: number | null; // last 14 days
  trend: "up" | "flat" | "down" | null;
  weakest: string[]; // topic names under 60%
  strongest: string[]; // topic names 85%+
  notesLogged: number; // classes described in check-ins
  planned: number;
  plannedDone: number;
}

export interface CoachStats {
  today: string;
  periodStart: string;
  student: Profile;
  themeName: string;
  subjects: SubjectStat[];
  exam: { sets: number; pct: number | null; sections: { key: string; pct: number }[] };
  checkins: number;
  streak: number;
  prayersOnTimeRate: number | null;
  minutesStudied: number;
  stuckOn: string[];
  religionNotes: string[];
  wellbeing: { instrument: string; band: string | null; score: number | null; taken_on: string }[];
  privateNotes: string[];
  attention?: { tier: string; score: number; labels: string[] };
  topicNames: { id: string; subject: string; name: string }[];
}

interface AttemptRow {
  score: number | null;
  total: number | null;
  submitted_at: string | null;
  flagged: boolean;
  quizzes: { topic_id: string | null; act_section: string | null; track: string; scheduled_for: string | null; plan_slot: string | null } | null;
}

export async function collectCoachStats(studentId: string, days = 14): Promise<CoachStats> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", studentId).single();
  if (!profile) throw new Error("Student not found.");
  const p = profile as Profile;
  const { data: family } = await admin.from("families").select("timezone").eq("id", p.family_id).single();
  const today = todayIn(family?.timezone ?? "Africa/Cairo");
  const periodStart = shiftDate(today, -days);

  const [{ data: topics }, { data: attempts }, { data: logs }, { data: checkins }, { data: prayers }, { data: planned }, { data: wellbeing }, { data: privateNotes }] = await Promise.all([
    schoolTopicsFor(learnerOf(p)).then((data) => ({ data })),
    admin.from("attempts").select("score, total, submitted_at, flagged, quizzes(topic_id, act_section, track, scheduled_for, plan_slot)").eq("student_id", studentId).not("submitted_at", "is", null).gte("submitted_at", periodStart),
    admin.from("lesson_logs").select("subject_name, note, topic_id").eq("student_id", studentId).gte("log_date", periodStart),
    admin.from("checkins").select("checkin_date, minutes_studied, stuck_on").eq("student_id", studentId).gte("checkin_date", periodStart),
    admin.from("prayer_logs").select("status").eq("student_id", studentId).gte("log_date", periodStart),
    admin.from("quizzes").select("topic_id, plan_slot, scheduled_for, attempts(submitted_at)").eq("student_id", studentId).not("scheduled_for", "is", null).gte("scheduled_for", periodStart).lt("scheduled_for", today),
    admin.from("wellbeing_checks").select("instrument, band, score, taken_on").eq("student_id", studentId).gte("taken_on", shiftDate(today, -35)).order("taken_on", { ascending: false }).limit(12),
    admin.from("coach_notes").select("note").eq("student_id", studentId).order("created_at", { ascending: false }).limit(10),
  ]);
  const allTopics = (topics ?? []) as Topic[];
  const topicById = new Map(allTopics.map((t) => [t.id, t]));
  const rows = ((attempts ?? []) as unknown as AttemptRow[]).filter((a) => !a.flagged && a.total);

  // Per topic and per subject aggregates.
  const byTopic = new Map<string, { s: number; t: number }>();
  const bySubject = new Map<string, { rows: { pct: number; at: string }[] }>();
  for (const a of rows) {
    const t = a.quizzes?.topic_id ? topicById.get(a.quizzes.topic_id) : null;
    if (!t) continue;
    const agg = byTopic.get(t.id) ?? { s: 0, t: 0 };
    agg.s += a.score ?? 0;
    agg.t += a.total ?? 0;
    byTopic.set(t.id, agg);
    const sub = bySubject.get(t.subject) ?? { rows: [] };
    sub.rows.push({ pct: Math.round(((a.score ?? 0) / (a.total ?? 1)) * 100), at: a.submitted_at! });
    bySubject.set(t.subject, sub);
  }
  const subjectsAll = [...new Set(allTopics.map((t) => t.subject))];
  const plannedRows = (planned ?? []) as { topic_id: string | null; plan_slot: string | null; attempts: { submitted_at: string | null }[] }[];
  const subjects: SubjectStat[] = subjectsAll.map((subject) => {
    const sub = bySubject.get(subject);
    const list = (sub?.rows ?? []).sort((x, y) => x.at.localeCompare(y.at));
    const pct = list.length ? Math.round(list.reduce((s, r) => s + r.pct, 0) / list.length) : null;
    let trend: SubjectStat["trend"] = null;
    if (list.length >= 4) {
      const half = Math.floor(list.length / 2);
      const a = list.slice(0, half).reduce((s, r) => s + r.pct, 0) / half;
      const b = list.slice(half).reduce((s, r) => s + r.pct, 0) / (list.length - half);
      trend = b - a > 8 ? "up" : a - b > 8 ? "down" : "flat";
    }
    const topicsOf = allTopics.filter((t) => t.subject === subject);
    const withPct = topicsOf.map((t) => ({ t, agg: byTopic.get(t.id) })).filter((x) => x.agg && x.agg.t > 0).map((x) => ({ name: x.t.name, pct: Math.round((x.agg!.s / x.agg!.t) * 100) }));
    const plannedOf = plannedRows.filter((q) => q.topic_id && topicById.get(q.topic_id)?.subject === subject);
    return {
      subject,
      label: subjectLabel(subject),
      language: topicsOf[0]?.language ?? "en",
      sets: list.length,
      pct,
      trend,
      weakest: withPct.filter((x) => x.pct < 60).sort((a, b) => a.pct - b.pct).slice(0, 4).map((x) => `${x.name} (${x.pct}%)`),
      strongest: withPct.filter((x) => x.pct >= 85).slice(0, 3).map((x) => `${x.name} (${x.pct}%)`),
      notesLogged: (logs ?? []).filter((l) => l.topic_id && topicById.get(l.topic_id)?.subject === subject).length,
      planned: plannedOf.length,
      plannedDone: plannedOf.filter((q) => q.attempts.some((a) => a.submitted_at)).length,
    };
  });

  const examRows = rows.filter((a) => a.quizzes?.act_section);
  const bySection = new Map<string, { s: number; t: number }>();
  for (const a of examRows) {
    const k = a.quizzes!.act_section!;
    const agg = bySection.get(k) ?? { s: 0, t: 0 };
    agg.s += a.score ?? 0;
    agg.t += a.total ?? 0;
    bySection.set(k, agg);
  }
  const examTotal = examRows.reduce((s, a) => s + (a.total ?? 0), 0);
  const ck = checkins ?? [];
  const pr = prayers ?? [];
  const religionNotes = (logs ?? []).filter((l) => /religion|دين|إسلامية/i.test(l.subject_name)).map((l) => l.note);

  return {
    today,
    periodStart,
    student: p,
    themeName: "",
    subjects,
    exam: {
      sets: examRows.length,
      pct: examTotal ? Math.round((examRows.reduce((s, a) => s + (a.score ?? 0), 0) / examTotal) * 100) : null,
      sections: [...bySection.entries()].map(([key, v]) => ({ key, pct: Math.round((v.s / Math.max(1, v.t)) * 100) })),
    },
    checkins: ck.length,
    streak: computeStreak(ck.map((c) => c.checkin_date as string), today),
    prayersOnTimeRate: pr.length ? Math.round((pr.filter((x) => x.status === "on_time").length / pr.length) * 100) : null,
    minutesStudied: ck.reduce((s, c) => s + (c.minutes_studied ?? 0), 0),
    stuckOn: ck.map((c) => c.stuck_on).filter((x): x is string => !!x).slice(-5),
    religionNotes: religionNotes.slice(-5),
    wellbeing: (wellbeing ?? []) as { instrument: string; band: string | null; score: number | null; taken_on: string }[],
    privateNotes: (privateNotes ?? []).map((n) => n.note).reverse(),
    topicNames: allTopics.map((t) => ({ id: t.id, subject: t.subject, name: t.name })),
  };
}
