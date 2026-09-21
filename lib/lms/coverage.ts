/**
 * What has actually been written, against what the curriculum says exists.
 *
 * The catalogue holds 1,711 topics and about thirty of them have a lesson. Nothing in the app said so: material
 * is produced on demand, the night before a child needs it, so "not written yet" and "written and fine" looked
 * identical from every screen — which is a fine way to run a cache and a poor way to run a curriculum.
 *
 * A row here is one topic at one grade. Its state is the honest answer to "could a child open this right now?",
 * and the states are kept apart on purpose: **held** is a lesson that was written and refused, which is the
 * system working; **missing** is nothing attempted; **stale** is written long enough ago to be worth a look.
 * Reporting all three as "no" would hide the one that needs a person.
 */

import { videoKind } from "./material";

export type LessonState = "ready" | "stale" | "held" | "missing";

export interface TopicRow {
  id: string;
  subject: string;
  unit: string;
  name: string;
  language: string;
  grade: number | null;
  curriculumId: string | null;
  stream: string | null;
  track: string;
}

export interface LessonRow { topic_id: string; grade: number | null; level: string; model: string | null; created_at: string; checked_at: string | null; failed_checks: string[] | null; human_reviewed_at: string | null }
export interface ResourceRow { topic_id: string; grade: number | null; visuals: unknown[] | null; videos: unknown[] | null; model: string | null; updated_at: string }
export interface HeldRow { topic_id: string; level: string; blocking: string[] | null; cleared_at: string | null; created_at: string }

export interface Coverage {
  topic: TopicRow;
  /** One entry per level: what exists at that depth. */
  basics: LessonState;
  advanced: LessonState;
  visuals: number;
  /** Links that name an actual video. A YouTube search URL is not one of these. */
  videos: number;
  /** Links that only search for a video. Every one stored so far is one of these, which is worth knowing. */
  videoSearches: number;
  /** The newest thing written for this topic, whatever it was. */
  touchedAt: string | null;
  model: string | null;
  /** Checks a stored lesson carries as warnings, and the ones a held attempt failed. */
  warnings: string[];
  blocking: string[];
  reviewedByHuman: boolean;
}

export interface Totals {
  topics: number;
  ready: number;
  stale: number;
  held: number;
  missing: number;
  withVisuals: number;
  withVideos: number;
}

/** A lesson older than this is worth re-reading, not because it expired but because nobody has looked since. */
export const STALE_DAYS = 120;

export function stateOf(lesson: LessonRow | undefined, held: HeldRow | undefined, now: Date, staleDays = STALE_DAYS): LessonState {
  if (lesson) {
    const age = (now.getTime() - Date.parse(lesson.created_at)) / 86400000;
    return age > staleDays ? "stale" : "ready";
  }
  // Only a hold nobody has answered counts: once a good lesson is written the hold is cleared, and a cleared
  // hold is history rather than a thing waiting for somebody.
  if (held && !held.cleared_at) return "held";
  return "missing";
}

const key = (topicId: string, grade: number | null, level?: string) =>
  `${topicId}|${grade ?? ""}${level === undefined ? "" : `|${level}`}`;

export function coverage(
  topics: TopicRow[],
  lessons: LessonRow[],
  resources: ResourceRow[],
  held: HeldRow[],
  now = new Date(),
  staleDays = STALE_DAYS,
): Coverage[] {
  const lessonAt = new Map(lessons.map((l) => [key(l.topic_id, l.grade, l.level), l]));
  const resourceAt = new Map(resources.map((r) => [key(r.topic_id, r.grade), r]));
  const heldAt = new Map<string, HeldRow>();
  for (const h of held) {
    const k = `${h.topic_id}|${h.level}`;
    const prev = heldAt.get(k);
    // Keep the one that still needs answering, else the newest.
    if (!prev || (!h.cleared_at && prev.cleared_at) || h.created_at > prev.created_at) heldAt.set(k, h);
  }

  return topics.map((t) => {
    const b = lessonAt.get(key(t.id, t.grade, "basics"));
    const a = lessonAt.get(key(t.id, t.grade, "advanced"));
    const res = resourceAt.get(key(t.id, null)) ?? resourceAt.get(key(t.id, t.grade));
    const heldB = heldAt.get(`${t.id}|basics`);
    const heldA = heldAt.get(`${t.id}|advanced`);

    const touched = [b?.created_at, a?.created_at, res?.updated_at].filter((x): x is string => !!x).sort().reverse()[0] ?? null;
    return {
      topic: t,
      basics: stateOf(b, heldB, now, staleDays),
      advanced: stateOf(a, heldA, now, staleDays),
      visuals: (res?.visuals ?? []).length,
      videos: (res?.videos ?? []).filter((v) => videoKind((v ?? {}) as Record<string, unknown>) === "video").length,
      videoSearches: (res?.videos ?? []).filter((v) => videoKind((v ?? {}) as Record<string, unknown>) === "search").length,
      touchedAt: touched,
      model: b?.model ?? a?.model ?? res?.model ?? null,
      warnings: [...new Set([...(b?.failed_checks ?? []), ...(a?.failed_checks ?? [])])],
      blocking: [...new Set([...(heldB && !heldB.cleared_at ? heldB.blocking ?? [] : []), ...(heldA && !heldA.cleared_at ? heldA.blocking ?? [] : [])])],
      reviewedByHuman: !!(b?.human_reviewed_at || a?.human_reviewed_at),
    };
  });
}

/** Counted on the basics, which is the level every child can open and therefore the one that matters. */
export function totals(rows: Coverage[]): Totals {
  return {
    topics: rows.length,
    ready: rows.filter((r) => r.basics === "ready").length,
    stale: rows.filter((r) => r.basics === "stale").length,
    held: rows.filter((r) => r.basics === "held" || r.advanced === "held").length,
    missing: rows.filter((r) => r.basics === "missing").length,
    withVisuals: rows.filter((r) => r.visuals > 0).length,
    withVideos: rows.filter((r) => r.videos > 0).length,
  };
}

export interface Filter { curriculum?: string; grade?: number; subject?: string; language?: string; state?: LessonState }

export function apply(rows: Coverage[], f: Filter): Coverage[] {
  return rows.filter((r) =>
    (!f.curriculum || r.topic.curriculumId === f.curriculum)
    && (f.grade === undefined || r.topic.grade === f.grade)
    && (!f.subject || r.topic.subject === f.subject)
    && (!f.language || r.topic.language === f.language)
    && (!f.state || r.basics === f.state));
}

/** The distinct values worth offering as filters, taken from the rows rather than assumed. */
export function facets(rows: Coverage[]) {
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  return {
    curricula: uniq(rows.map((r) => r.topic.curriculumId).filter((x): x is string => !!x)).sort(),
    grades: uniq(rows.map((r) => r.topic.grade).filter((x): x is number => x !== null)).sort((a, b) => a - b),
    subjects: uniq(rows.map((r) => r.topic.subject)).sort(),
    languages: uniq(rows.map((r) => r.topic.language)).sort(),
  };
}

/** Subject-level rollup, so a thousand rows can be read as twenty. */
export interface SubjectSummary { subject: string; language: string; total: number; ready: number; held: number; missing: number; stale: number }

export function bySubject(rows: Coverage[]): SubjectSummary[] {
  const map = new Map<string, SubjectSummary>();
  for (const r of rows) {
    const k = `${r.topic.subject}|${r.topic.language}`;
    const s = map.get(k) ?? { subject: r.topic.subject, language: r.topic.language, total: 0, ready: 0, held: 0, missing: 0, stale: 0 };
    s.total += 1;
    s[r.basics] += 1;
    map.set(k, s);
  }
  return [...map.values()].sort((a, b) => b.missing - a.missing || a.subject.localeCompare(b.subject));
}
