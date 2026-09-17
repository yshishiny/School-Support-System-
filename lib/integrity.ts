/**
 * Integrity signals: deterministic checks that the system is being used honestly, turned into
 * questions a parent can ask that evening. Labels only, no accusations; the conversation does the work.
 */
export interface IntegrityInput {
  today: string;
  tz?: string;
  attempts: { submitted_at: string | null; seconds: number | null; total: number | null; tab_switches: number; kind: string; title?: string | null }[];
  prayers: { log_date: string; logged_at: string; status: string; entered_late: boolean; claim: string | null; prayer: string }[];
  checkins: { checkin_date: string; submitted_at: string | null; hourLocal?: number }[];
  lessonLogs: { log_date: string; subject_name: string; note: string }[];
  snaps: { taken_on: string; status: string; ai_verdict: string | null; kind?: string; ai_detail?: { total_minutes?: number | null; top_apps?: { app: string; minutes: number }[] } | null }[];
  screenLimit?: number; // minutes per day
  materials?: { subject: string | null; title: string; topics: string[]; created_at: string; uploaded_by_student: boolean; is_week_summary?: boolean; covers_week_start?: string | null; subjects?: { subject: string; topics: string[] }[] }[]; // school files shared this week
  timetableSubjects?: { weekday: number; subject_name: string }[]; // to know which days the subject had a class
  mannersSelf?: { date: string; self: number | null }[]; // the child's own rating at check-in
  parentTicks?: { tick_date: string; code: string; value: boolean }[]; // the parent's daily taps
}

export interface IntegritySignal {
  code: string;
  label: string; // for the report / home
  ask: string; // the question for the parent
}

const cap = (p: string) => p[0].toUpperCase() + p.slice(1);
const norm = (x: string) => x.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z\u0600-\u06ff ]/g, " ").trim();
/** "English (GPA)" and "English Literature" are the same subject for the file-vs-log check. */
export function sameSubject(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x) || x.split(" ").some((w) => w.length > 3 && y.split(" ").includes(w)));
}

export function integritySignals(i: IntegrityInput): IntegritySignal[] {
  const out: IntegritySignal[] = [];
  const weekAgo = new Date(Date.parse(i.today + "T00:00:00Z") - 6 * 86400000).toISOString().slice(0, 10);

  // 1. Quiz finished too fast to have been read.
  const fast = i.attempts.filter((a) => a.submitted_at && a.kind !== "review" && (a.total ?? 0) >= 5 && a.seconds !== null && a.seconds / (a.total ?? 1) < 8);
  if (fast.length) out.push({ code: "fast_quiz", label: `${fast.length} quiz set${fast.length === 1 ? "" : "s"} finished at under 8 seconds a question`, ask: `Ask him to explain one question from “${fast[0].title ?? "the set"}” he finished in ${fast[0].seconds} seconds.` });

  // 2. Switching tabs during a quiz.
  const tabs = i.attempts.filter((a) => a.submitted_at && a.tab_switches >= 3);
  if (tabs.length) out.push({ code: "tab_switches", label: `Left the quiz screen ${tabs[0].tab_switches} times during a set`, ask: "Ask, lightly, what he was looking at during the quiz." });

  // 3. Several prayers logged within minutes of each other (logged at the time, not as late entries).
  const byDay = new Map<string, number[]>();
  for (const p of i.prayers.filter((p) => !p.entered_late && p.log_date >= weekAgo)) byDay.set(p.log_date, [...(byDay.get(p.log_date) ?? []), Date.parse(p.logged_at)]);
  for (const [day, times] of byDay) {
    const sorted = times.sort((a, b) => a - b);
    for (let k = 0; k + 2 < sorted.length; k += 1) {
      if (sorted[k + 2] - sorted[k] < 3 * 60000) {
        out.push({ code: "prayer_burst", label: `Three prayers logged within three minutes on ${day}`, ask: "Ask which prayer he prayed where that day, one at a time." });
        break;
      }
    }
  }

  // 4. Repeated "on time" claims entered later, outside school hours.
  const retro = i.prayers.filter((p) => p.entered_late && p.status === "on_time" && p.claim !== "school" && p.log_date >= weekAgo);
  if (retro.length >= 3) out.push({ code: "retro_on_time", label: `${retro.length} prayers marked on time after the fact this week`, ask: `Ask where he prayed ${cap(retro[retro.length - 1].prayer)} on ${retro[retro.length - 1].log_date} and with whom.` });

  // 5. Check-in submitted in the small hours.
  const night = i.checkins.filter((c) => c.hourLocal !== undefined && c.hourLocal >= 0 && c.hourLocal < 5);
  if (night.length) out.push({ code: "night_checkin", label: "A check-in went in between midnight and 5am", ask: "Ask what time he actually slept that night." });

  // 6. The same class note copied across days for one subject.
  const seen = new Map<string, string>();
  for (const l of i.lessonLogs.filter((l) => l.log_date >= weekAgo)) {
    const key = `${l.subject_name.toLowerCase()}|${l.note.trim().toLowerCase()}`;
    if (l.note.trim().length >= 6 && seen.has(key) && seen.get(key) !== l.log_date) {
      out.push({ code: "copy_notes", label: `The same ${l.subject_name} note on two days`, ask: `Ask him to tell you one new thing from ${l.subject_name} on ${l.log_date}.` });
      break;
    }
    seen.set(key, l.log_date);
  }

  // 7b. "No class / absent" used to skip the class log.
  const noClass = i.lessonLogs.filter((l) => l.log_date >= weekAgo && /^no class/i.test(l.note.trim()));
  const noClassToday = noClass.filter((l) => l.log_date === i.today);
  if (noClassToday.length >= 3 || noClass.length >= 5) out.push({ code: "no_class_overuse", label: `“No class” marked ${noClassToday.length >= 3 ? `${noClassToday.length} times today` : `${noClass.length} times this week`}`, ask: `Ask which classes really did not happen ${noClassToday.length >= 3 ? "today" : "this week"} (${[...new Set((noClassToday.length >= 3 ? noClassToday : noClass).map((l) => l.subject_name))].join(", ")}) and what he did in that time.` });

  // 8. What the school shared vs what he logged: a file for a subject this week while his log says "no class" or nothing.
  // 8b. A weekly syllabus for this week: every subject it lists vs his log for that week.
  const thisWeekStart = new Date(Date.parse(i.today + "T00:00:00Z") - new Date(i.today + "T00:00:00Z").getUTCDay() * 86400000).toISOString().slice(0, 10);
  for (const m of (i.materials ?? []).filter((m) => m.is_week_summary && m.covers_week_start === thisWeekStart && (m.subjects?.length ?? 0) > 0)) {
    const problems: string[] = [];
    for (const entry of m.subjects!) {
      const logs = i.lessonLogs.filter((l) => l.log_date >= thisWeekStart && sameSubject(l.subject_name, entry.subject));
      const onTimetable = !i.timetableSubjects || i.timetableSubjects.some((t) => sameSubject(t.subject_name, entry.subject));
      if (!onTimetable) continue;
      const noClass = logs.filter((l) => /^no class/i.test(l.note.trim())).length;
      const topicWords = new Set(entry.topics.flatMap((t) => norm(t).split(" ")).filter((w) => w.length > 3));
      const mentioned = logs.some((l) => norm(l.note).split(" ").some((w) => topicWords.has(w)));
      if (noClass) problems.push(`${entry.subject}: “no class” ×${noClass}`);
      else if (logs.length === 0) problems.push(`${entry.subject}: nothing logged`);
      else if (!mentioned && entry.topics.length) problems.push(`${entry.subject}: notes do not match (${entry.topics.slice(0, 2).join(", ")})`);
    }
    if (problems.length) out.push({ code: "syllabus_vs_log", label: `The school's weekly syllabus disagrees with his log on ${problems.length} subject${problems.length === 1 ? "" : "s"}`, ask: `Go through the syllabus with him subject by subject: ${problems.slice(0, 6).join("; ")}.` });
  }

  const seenSubj = new Set<string>();
  for (const m of (i.materials ?? []).filter((m) => m.subject && !m.is_week_summary && m.created_at.slice(0, 10) >= weekAgo)) {
    const subj = m.subject!;
    if (seenSubj.has(norm(subj))) continue;
    seenSubj.add(norm(subj));
    const logs = i.lessonLogs.filter((l) => l.log_date >= weekAgo && sameSubject(l.subject_name, subj));
    const noClass = logs.filter((l) => /^no class/i.test(l.note.trim()));
    const days = (i.timetableSubjects ?? []).filter((t) => sameSubject(t.subject_name, subj)).length;
    const topicWords = new Set(m.topics.flatMap((t) => norm(t).split(" ")).filter((w) => w.length > 3));
    const mentioned = logs.some((l) => norm(l.note).split(" ").some((w) => topicWords.has(w)));
    const gap = noClass.length > 0 ? `${noClass.length} of his ${subj} classes marked “no class”` : logs.length === 0 && (days > 0 || !i.timetableSubjects) ? `no ${subj} class logged this week` : !mentioned && m.topics.length > 0 && logs.length > 0 ? `his ${subj} notes do not mention any of it` : null;
    if (gap) out.push({ code: "log_vs_school", label: `School shared “${m.title}” for ${subj} this week, but ${gap}`, ask: `Ask what was taken in ${subj} this week. The school's file covers: ${m.topics.slice(0, 5).join(", ") || m.title}. ${noClass.length ? `He marked “no class” on ${noClass.map((l) => l.log_date).join(", ")}.` : ""}`.trim() });
  }

  // 9. Manners: he rated himself 4-5 on a day a parent marked ✗.
  const gaps = (i.mannersSelf ?? []).filter((m) => m.date >= weekAgo && (m.self ?? 0) >= 4 && (i.parentTicks ?? []).some((t) => t.tick_date === m.date && t.code === "manners" && t.value === false));
  if (gaps.length) out.push({ code: "manners_gap", label: `Rated his own manners ${gaps.length === 1 ? "well" : `well on ${gaps.length} days`} when a parent marked ✗ (${gaps.map((g) => g.date).join(", ")})`, ask: `Ask him, without the ✗ in view, what happened on ${gaps[gaps.length - 1].date} that a parent saw differently, and who he thinks was affected.` });

  // 10. Screen time over the family limit (from the evening screenshot).
  const limit = i.screenLimit ?? 180;
  const over = i.snaps.filter((s) => s.kind === "screentime" && s.taken_on >= weekAgo && s.status !== "rejected" && (s.ai_detail?.total_minutes ?? 0) > limit);
  if (over.length) {
    const worst = [...over].sort((a, b) => (b.ai_detail?.total_minutes ?? 0) - (a.ai_detail?.total_minutes ?? 0))[0];
    const top = worst.ai_detail?.top_apps?.slice(0, 2).map((a) => `${a.app} ${a.minutes}m`).join(", ");
    out.push({ code: "screen_over_limit", label: `Screen time over the ${Math.round(limit / 60 * 10) / 10}h limit on ${over.length} day${over.length === 1 ? "" : "s"} this week (${Math.floor((worst.ai_detail?.total_minutes ?? 0) / 60)}h ${(worst.ai_detail?.total_minutes ?? 0) % 60}m on ${worst.taken_on})`, ask: `Ask what took the time on ${worst.taken_on}${top ? ` (${top})` : ""} and what he would cut first; agree on one change for tomorrow.` });
  }

  // 7. Snaps sent back more than once.
  const rejected = i.snaps.filter((s) => s.status === "rejected" && s.taken_on >= weekAgo);
  if (rejected.length >= 2) out.push({ code: "snaps_rejected", label: `${rejected.length} snaps sent back this week`, ask: "Have a look at the bed and desk yourself tonight, without making it a thing." });

  return out;
}
