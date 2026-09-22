/**
 * What the school is actually teaching, against what the app has ready for it.
 *
 * A file from the class group arrives with a list of topics the model pulled out of it — free text like
 * "Standard Form (Scientific Notation)" or "HCF (Highest Common Factor)". The curriculum holds its own topic
 * names, written by somebody else. Nothing joins the two, so "we uploaded the term's worksheets" and "the app
 * has lessons for them" have never been comparable.
 *
 * The matching is deliberately dumb and deterministic: shared words, after the noise words are dropped. No
 * model call, so it is free, instant, and a parent can see exactly why two topics were paired. When it is not
 * sure it says so rather than guessing, because a wrong pairing hides a gap, which is the one thing this page
 * exists to prevent.
 */

const NOISE = new Set([
  "a", "an", "and", "the", "of", "in", "on", "to", "for", "with", "or", "its", "their", "between", "from",
  "using", "use", "used", "basic", "basics", "introduction", "intro", "understanding", "identifying",
  "analysing", "analyzing", "analysis", "practice", "worksheet", "review", "unit", "lesson", "topic",
]);

/** Words that carry meaning, lower case, without punctuation, plurals folded. */
export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[()[\],.:;–—/&'"’]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/(?<=\w{4})(?:es|s)$/, ""))
    .filter((w) => w.length > 1 && !NOISE.has(w));
}

/**
 * How much of the shorter phrase the two share, 0 to 1.
 *
 * Overlap rather than Jaccard on purpose: "Square roots and cube roots" should match "Square Roots and Cube
 * Roots (Grade 8 revision)" strongly, and Jaccard would punish it for the extra words.
 */
export function similarity(a: string, b: string): number {
  const x = new Set(words(a));
  const y = new Set(words(b));
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  return shared / Math.min(x.size, y.size);
}

/** Below this a pairing is a guess, and a guess that is wrong hides the very gap being looked for. */
export const SURE = 0.6;
/** Between this and SURE it is offered as a maybe, for a person to accept or ignore. */
export const MAYBE = 0.34;

export interface CurriculumTopic { id: string; subject: string; unit: string; name: string; hasLesson: boolean }

export type Confidence = "sure" | "maybe" | "none";

export interface Match {
  /** The topic exactly as the school's file phrased it. */
  taught: string;
  /** Which file it came from, so a parent can open the thing being talked about. */
  fromTitle: string;
  fromId: string;
  subject: string | null;
  best: CurriculumTopic | null;
  score: number;
  confidence: Confidence;
}

export function bestMatch(taught: string, curriculum: CurriculumTopic[]): { best: CurriculumTopic | null; score: number } {
  let best: CurriculumTopic | null = null;
  let score = 0;
  for (const c of curriculum) {
    const s = similarity(taught, c.name);
    // Ties go to the first, which keeps the output stable between runs.
    if (s > score) { score = s; best = c; }
  }
  return { best, score };
}

export function confidenceOf(score: number): Confidence {
  if (score >= SURE) return "sure";
  if (score >= MAYBE) return "maybe";
  return "none";
}

export interface TaughtTopic { topic: string; fromTitle: string; fromId: string; subject: string | null }

export function match(taught: TaughtTopic[], curriculum: CurriculumTopic[]): Match[] {
  return taught.map((t) => {
    // A subject on the file narrows the search when it is recognisable, and is ignored when it is not: the
    // school writes "Math" where the curriculum says "Mathematics", and a missed narrowing is better than a
    // missed match.
    const sameSubject = t.subject ? curriculum.filter((c) => similarity(c.subject, t.subject!) > 0) : [];
    const pool = sameSubject.length > 0 ? sameSubject : curriculum;
    const { best, score } = bestMatch(t.topic, pool);
    return { taught: t.topic, fromTitle: t.fromTitle, fromId: t.fromId, subject: t.subject, best, score, confidence: confidenceOf(score) };
  });
}

export interface Gap {
  /** Taught at school, in the curriculum, and a lesson is written: nothing to do. */
  covered: Match[];
  /** Taught at school, in the curriculum, no lesson written. This is the queue. */
  needsLesson: Match[];
  /** Taught at school and not in this child's curriculum at all — revision, or the wrong curriculum. */
  offCurriculum: Match[];
  /** In the curriculum, never seen in any file the school sent. Not late, just not reached. */
  notTaughtYet: CurriculumTopic[];
}

export function gap(matches: Match[], curriculum: CurriculumTopic[]): Gap {
  const hit = new Set(matches.filter((m) => m.confidence === "sure" && m.best).map((m) => m.best!.id));
  return {
    covered: matches.filter((m) => m.confidence === "sure" && m.best?.hasLesson),
    needsLesson: matches.filter((m) => m.confidence === "sure" && m.best && !m.best.hasLesson),
    offCurriculum: matches.filter((m) => m.confidence !== "sure"),
    notTaughtYet: curriculum.filter((c) => !hit.has(c.id)),
  };
}

/** One sentence a parent can act on, rather than four numbers to interpret. */
export function headline(g: Gap, firstName: string): string {
  const taught = g.covered.length + g.needsLesson.length + g.offCurriculum.length;
  if (taught === 0) return `No school files for ${firstName} yet, so there is nothing to compare.`;
  if (g.needsLesson.length === 0 && g.offCurriculum.length === 0) {
    return `Every topic ${firstName}'s school has sent has a lesson ready.`;
  }
  const bits: string[] = [];
  if (g.needsLesson.length > 0) bits.push(`${g.needsLesson.length} the school is teaching now with no lesson written`);
  if (g.offCurriculum.length > 0) bits.push(`${g.offCurriculum.length} that do not match ${firstName}'s curriculum at all`);
  return `Of ${taught} topics the school has sent: ${bits.join(", and ")}.`;
}
