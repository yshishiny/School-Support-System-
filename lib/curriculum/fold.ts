/**
 * Folding the school's own topics into the American curriculum.
 *
 * The app grew a curriculum catalogue after it already had topics. The first 160 school topics were never
 * tagged with a curriculum, and everything anybody has prepared hangs off them: 27 lessons, 13 scripts, 29
 * media sets, 59 quizzes, 29 logs. Then both boys were set to the American curriculum and `topicsFor` started
 * answering with the seeded Common Core list — 88 topics for Omar, 113 for Youssef, and not one lesson between
 * them. The teaching did not disappear. It became unreachable.
 *
 * Which way the fold runs was decided by one query: of the 1,521 seeded topics, **none** has a lesson, script,
 * quiz, media set, log, flag or check against it. The seeded list is a catalogue nobody has used; the school's
 * list is the one the children are actually taught from. So the school's row is the one that survives:
 *
 * - **Every school topic joins the curriculum as itself**, under the American subject name. Its id does not
 *   change, so not one foreign key moves and not one lesson can land on the wrong topic.
 * - **A seeded topic the school already covers is dropped.** "Rational and irrational numbers", "Approximating
 *   irrational numbers" and "Square roots and cube roots" are three lines for what the school teaches as one,
 *   and showing a child both versions of his own syllabus helps nobody.
 * - **A seeded topic the school does not cover stays.** Common Core has an Ellipsis topic and the school's list
 *   does not; that is coverage, not clutter.
 *
 * Absorption is one-to-many on purpose — a school topic is usually the coarser of the two — and it is checked
 * against a reviewed list of pairs the word matcher gets wrong. The matcher proposes; the table disposes.
 *
 * Three subject names are worth stating plainly rather than deriving: an American-diploma school in Egypt still
 * teaches Arabic, Arabic Social Studies and Religion to the national syllabus. Those are not strays left over
 * from an older schema. They are subjects this curriculum was missing.
 */

import { SURE, similarity } from "@/lib/lms/gap";

export interface FoldTopic {
  id: string;
  grade: number;
  subject: string;
  /** The school's own grouping — "Geometry", "Algebra 2", "نحو". Finer than the subject, and sometimes truer. */
  unit: string;
  name: string;
  sort: number;
  language: string;
  /** Lessons, scripts, media, quizzes and logs hanging off this topic. */
  work: number;
}

/**
 * What each school subject is called in the American list.
 *
 * Keyed by grade because the same subject has different American names in different years: "Math" is
 * Mathematics in grade 8 and Geometry in grade 10; "Social Studies" is US history in grade 8 and world history
 * in grade 10.
 */
export const SUBJECT_MAP: Record<string, string> = {
  "8|Math": "Mathematics",
  "8|English": "English Language Arts",
  "8|Science": "Science",
  "8|Social Studies": "Social Studies",
  "10|Math": "Geometry",
  "10|English": "English 10",
  "10|Social Studies": "World History II",
};

/**
 * Where the school's unit disagrees with its own subject label, and the unit is right.
 *
 * Grade 10 "Math" is ten geometry topics and three algebra ones. Filing quadratics and logarithms under
 * Geometry because they shared a subject label would be a lie a child would notice.
 */
export const UNIT_MAP: Record<string, string> = {
  "10|Math|Algebra 2": "Algebra II",
};

/**
 * Pairs the word matcher scores as the same topic that are not.
 *
 * Three entries, reached by reading every pair the matcher proposed rather than trusting the number. They are
 * the argument for reading them:
 *
 * - **"World War I" and "The Second World War" scored 1.00.** The matcher drops one-character tokens as noise,
 *   so the roman numeral that is the entire difference between the two wars disappears and both reduce to
 *   *world* + *war*. Left alone this would have deleted the Second World War from a fifteen-year-old's history
 *   syllabus. It is also why the threshold is not the safeguard here: no score would have caught it.
 * - **"Systems of linear equations" and "Linear equations with one, none or many solutions"** are different
 *   standards — one is about solving a pair simultaneously, the other about when a single equation has no
 *   solution or infinitely many. The school's list has its own topic for the second, which claims it correctly.
 * - **"Informational text: central idea, structure, author's purpose" and "Analysing text structure for
 *   effect"** share *text* and *structure* and nothing else; one is finding the main idea, the other is why an
 *   author arranged a passage the way they did.
 */
export const NOT_THE_SAME: [school: string, seeded: string][] = [
  ["World War I", "The Second World War"],
  ["Systems of linear equations", "Linear equations with one, none or many solutions"],
  ["Informational text: central idea, structure, author's purpose", "Analysing text structure for effect"],
];

const rejected = new Set(NOT_THE_SAME.map(([a, b]) => `${a}||${b}`));

/** The American subject this school topic belongs in. */
export function targetSubject(t: Pick<FoldTopic, "grade" | "subject" | "unit">): string {
  return UNIT_MAP[`${t.grade}|${t.subject}|${t.unit}`] ?? SUBJECT_MAP[`${t.grade}|${t.subject}`] ?? t.subject;
}

export interface Move {
  topic: FoldTopic;
  /** The subject it lands under, which may differ from the one it had. */
  subject: string;
  /** Ahead of the seeded rows, which start at 101, so the school's own syllabus heads the subject. */
  sort: number;
  /** True when this topic brings a subject the curriculum did not have. */
  newSubject: boolean;
}

export interface Absorb {
  /** The seeded row that goes. It holds no lesson, quiz or media, which is why it can. */
  seeded: FoldTopic;
  /** The school topic that already covers it and stays. */
  by: FoldTopic;
  score: number;
}

export interface Plan {
  moves: Move[];
  absorbed: Absorb[];
  /** Seeded topics with no school counterpart. These are the coverage the catalogue adds. */
  kept: FoldTopic[];
  /** Subjects to add to the catalogue, so a parent's subject list matches what the child studies. */
  subjects: { grade: number; subject: string; language: string; sort: number }[];
}

/**
 * Work out the fold for one set of grades.
 *
 * `seeded` should be only the American rows for the grades the school's list covers. A grade the school has
 * nothing for is left alone entirely — there is no counterpart to fold it into.
 */
export function planFold(school: FoldTopic[], seeded: FoldTopic[]): Plan {
  // Every school topic comes across; nothing here can fail or be skipped.
  //
  // They sort ahead of the seeded rows rather than after them. The seeded sorts start at 101, so numbering the
  // school's topics from 1 puts this term's actual syllabus at the top of the subject and the catalogue below
  // it — the other way round, a child would scroll past twenty-seven Common Core headings he has never been
  // taught to reach the ten his teacher set.
  const nextSort = new Map<string, number>();
  const subjectsPresent = new Set(seeded.map((s) => `${s.grade}|${s.subject}`));
  const newSubjects = new Map<string, { grade: number; subject: string; language: string; sort: number }>();
  const moves: Move[] = [];

  for (const t of [...school].sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject) || a.sort - b.sort)) {
    const subject = targetSubject(t);
    const k = `${t.grade}|${subject}`;
    const fresh = !subjectsPresent.has(k);
    const sort = (nextSort.get(k) ?? 0) + 1;
    nextSort.set(k, sort);
    moves.push({ topic: t, subject, sort, newSubject: fresh });
    if (fresh && !newSubjects.has(k)) {
      newSubjects.set(k, { grade: t.grade, subject, language: t.language, sort: 900 + newSubjects.size });
    }
  }

  // A seeded row goes only if a school topic landing in the same subject already covers it.
  const absorbed: Absorb[] = [];
  const kept: FoldTopic[] = [];
  for (const s of seeded) {
    let best: Absorb | null = null;
    for (const mv of moves) {
      if (mv.topic.grade !== s.grade || mv.subject !== s.subject) continue;
      if (rejected.has(`${mv.topic.name}||${s.name}`)) continue;
      const score = similarity(mv.topic.name, s.name);
      // Ties go to the earlier school topic, which keeps two runs over the same data identical.
      if (score >= SURE && (!best || score > best.score)) best = { seeded: s, by: mv.topic, score };
    }
    if (best) absorbed.push(best);
    else kept.push(s);
  }

  return { moves, absorbed, kept, subjects: [...newSubjects.values()] };
}

/** What the fold does, in the terms a person would ask about. */
export function summarise(plan: Plan): { moved: number; absorbed: number; kept: number; newSubjects: number; work: number } {
  return {
    moved: plan.moves.length,
    absorbed: plan.absorbed.length,
    kept: plan.kept.length,
    newSubjects: plan.subjects.length,
    work: plan.moves.reduce((n, m) => n + m.topic.work, 0),
  };
}

/** Every subject a child of this grade would see afterwards, with how many topics each holds. */
export function subjectsAfter(plan: Plan, grade: number): { subject: string; topics: number }[] {
  const n = new Map<string, number>();
  const add = (s: string) => n.set(s, (n.get(s) ?? 0) + 1);
  for (const mv of plan.moves) if (mv.topic.grade === grade) add(mv.subject);
  for (const k of plan.kept) if (k.grade === grade) add(k.subject);
  return [...n.entries()].map(([subject, topics]) => ({ subject, topics })).sort((a, b) => a.subject.localeCompare(b.subject));
}
