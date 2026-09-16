/**
 * "What did you take today?" helpers: which curriculum topics to offer for a class,
 * and which previous school days still have classes with no note.
 */
import { curriculumSubject } from "./plan";
import { shiftDate, weekdayOf } from "./dates";
import { nextClassDate } from "./class-log";

export interface LessonTopicOption {
  id: string;
  name: string;
  unit: string | null;
}

export interface LessonSubjectInput {
  subject: string; // timetable name, e.g. "Math (GPA)"
  topics: LessonTopicOption[]; // all curriculum topics for the mapped subject, in teaching order
  suggested: string[]; // topic ids to show first
  existingNote: string | null;
  existingTopicId: string | null;
  existingHomeworkGiven: boolean | null; // null = not answered yet
  existingHomework: string | null;
  existingHomeworkDue: string | null;
  defaultHomeworkDue: string; // next time this subject is on the timetable
}

export interface LessonDay {
  date: string;
  label: string; // "Today", "Yesterday", "Sun 13 Sep"
  subjects: LessonSubjectInput[];
}

const SKIP = /^(p\.?e\.?|music|art|line|library|advisory|homeroom)$/i;

/** Topics most likely taught next: the ones after the furthest topic already logged for this subject, plus that topic itself. */
export function suggestTopics(topics: LessonTopicOption[], loggedTopicIds: string[], n = 4): string[] {
  if (topics.length === 0) return [];
  const index = new Map(topics.map((t, i) => [t.id, i]));
  const logged = loggedTopicIds.filter((id) => index.has(id));
  if (logged.length === 0) return topics.slice(0, n).map((t) => t.id);
  const furthest = Math.max(...logged.map((id) => index.get(id)!));
  const out = [topics[furthest].id];
  for (let i = furthest + 1; i < topics.length && out.length < n; i++) out.push(topics[i].id);
  for (let i = furthest - 1; i >= 0 && out.length < n; i--) if (!logged.includes(topics[i].id)) out.push(topics[i].id);
  return out;
}

export interface BuildDaysInput {
  today: string;
  timetable: { weekday: number; subject_name: string }[];
  topics: { id: string; subject: string; name: string; unit: string | null; sort: number }[];
  logs: { log_date: string; subject_name: string; note: string; topic_id: string | null; homework_given?: boolean | null; homework?: string | null; homework_due?: string | null }[];
  lookBackDays?: number; // previous days to offer for catch-up
  daysOff?: string[];
}

/** Today's classes plus any previous school day (within the look-back) that still has a class without a note. */
export function buildLessonDays(input: BuildDaysInput): LessonDay[] {
  const lookBack = input.lookBackDays ?? 6; // the allowance week: a missed day is filled in before it closes
  const available = [...new Set(input.topics.map((t) => t.subject))];
  const bySubject = new Map<string, LessonTopicOption[]>();
  for (const s of available) {
    bySubject.set(
      s,
      input.topics.filter((t) => t.subject === s).sort((a, b) => a.sort - b.sort).map((t) => ({ id: t.id, name: t.name, unit: t.unit })),
    );
  }
  const days: LessonDay[] = [];
  for (let back = 0; back <= lookBack; back++) {
    const date = shiftDate(input.today, -back);
    if (input.daysOff?.includes(date)) continue;
    const rows = input.timetable.filter((t) => t.weekday === weekdayOf(date));
    const names = [...new Set(rows.map((r) => r.subject_name))].filter((n) => !SKIP.test(n.trim()));
    if (names.length === 0) continue;
    const logsThatDay = input.logs.filter((l) => l.log_date === date);
    const subjects: LessonSubjectInput[] = names.map((name) => {
      const mapped = curriculumSubject(name, available);
      const topics = mapped ? bySubject.get(mapped) ?? [] : [];
      const loggedIds = input.logs
        .filter((l) => l.log_date < date || l.log_date === date)
        .filter((l) => l.topic_id && topics.some((t) => t.id === l.topic_id))
        .sort((a, b) => a.log_date.localeCompare(b.log_date))
        .map((l) => l.topic_id!);
      const existing = logsThatDay.find((l) => l.subject_name === name) ?? null;
      return {
        subject: name,
        topics,
        suggested: suggestTopics(topics, loggedIds),
        existingNote: existing?.note ?? null,
        existingTopicId: existing?.topic_id ?? null,
        existingHomeworkGiven: existing ? existing.homework_given ?? null : null,
        existingHomework: existing?.homework ?? null,
        existingHomeworkDue: existing?.homework_due ?? null,
        defaultHomeworkDue: nextClassDate(name, input.timetable, date, input.daysOff),
      };
    });
    const complete = (s: LessonSubjectInput) => !!s.existingNote && s.existingHomeworkGiven !== null;
    // Previous days are only shown while something is still missing (a note without the homework answer counts as missing).
    if (back > 0 && subjects.every(complete)) continue;
    const label = back === 0 ? "Today" : back === 1 ? "Yesterday" : new Date(date + "T00:00:00Z").toUTCString().slice(0, 11).replace(",", "");
    days.push({ date, label, subjects: back === 0 ? subjects : subjects.filter((s) => !complete(s)) });
  }
  return days;
}

/** Form field names for a class note: today's use the bare subject, previous days carry the date. */
export function lessonFieldKey(date: string, today: string, subject: string): string {
  return date === today ? subject : `${date}__${subject}`;
}

export function parseLessonFieldKey(key: string, today: string): { date: string; subject: string } {
  const m = /^(\d{4}-\d{2}-\d{2})__(.+)$/.exec(key);
  return m ? { date: m[1], subject: m[2] } : { date: today, subject: key };
}
