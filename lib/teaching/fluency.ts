/**
 * The four dimensions, applied to one act of teaching.
 *
 * This app has an AI write lessons a child reads alone, at night, with nobody checking. That is the highest-stakes
 * use of a model in the whole product and it has been running on one paragraph of instruction (`LEVEL[x].lessonBrief`)
 * and no verification at all. `topic_flags` — the one place a wrong lesson could be caught — has never held a row.
 *
 * So the four dimensions are written down here as a contract a lesson has to pass, not as advice:
 *
 *   Delegation   who does this part — the model, the child, a parent, or a paid human
 *   Description  what the model is told: the thing, the way, and the standard
 *   Discernment  what is checked before a child reads it, and what blocks
 *   Diligence    what is recorded and disclosed afterwards
 *
 * Each is a function over a real curriculum row, so a lesson for Prep 2 Arabic and one for Grade 11 Physics get
 * genuinely different briefs and genuinely different checks, rather than the same paragraph twice.
 */
import { LEVEL, type Level } from "@/lib/levels";

/** A topic as the curriculum holds it. */
export interface CurriculumTopic {
  id: string;
  curriculumId: string;
  grade: number;
  stream: string | null;
  subject: string;
  unit: string | null;
  name: string;
  /** The language the class is taught in — not the child's phone language. */
  language: string;
}

// ── I. Delegation ────────────────────────────────────────────────────────────

export type Doer = "model" | "child" | "parent" | "human_tutor";

export interface Delegated {
  task: string;
  to: Doer;
  /** Why it sits there. A delegation with no reason is a habit, not a decision. */
  because: string;
}

/**
 * Who does what, for this topic at this depth.
 *
 * The rule underneath: the model may explain and may drill, but it may not decide what a child has understood,
 * and it may not be the only thing standing between a wrong fact and a child. Those two stay human.
 */
export function delegation(topic: CurriculumTopic, level: Level, o: { hasTutor: boolean }): Delegated[] {
  const out: Delegated[] = [
    { task: `Explain ${topic.name}`, to: "model",
      because: "Explaining a fixed syllabus point is repeatable work the model does well and a parent has no time for." },
    { task: "Attempt the questions before seeing any answer", to: "child",
      because: "A lesson the child only watches teaches nothing; the attempt is where the learning is." },
    { task: "Write practice questions at this level", to: "model",
      because: "Volume and variation are the model's strength, and a wrong practice question costs a minute, not a grade." },
    { task: "Judge whether this matched what the class actually did", to: "parent",
      because: "Only somebody who sees the school's own materials can tell, and the model must never claim to know." },
  ];
  if (level === "advanced") {
    out.push({ task: "Diagnose a misunderstanding that survives two explanations", to: o.hasTutor ? "human_tutor" : "parent",
      because: "Repeating an explanation louder is what a model does when it cannot tell why a child is stuck. A person has to look." });
  }
  return out;
}

// ── II. Description ──────────────────────────────────────────────────────────

export interface Brief {
  /** The thing to produce. */
  product: string;
  /** The way to go about it. */
  process: string;
  /** What good looks like, and what to do when unsure. */
  performance: string;
}

/**
 * What the model is told, built from the curriculum row rather than the grade alone.
 *
 * The unit matters as much as the topic: "الجذر التربيعي" inside "الجبر" for Prep 1 is a different lesson from the
 * same words inside a Grade 11 unit, and a brief that omits the unit invites the model to teach the harder one.
 */
export function brief(topic: CurriculumTopic, level: Level): Brief {
  const place = [topic.unit, topic.subject].filter(Boolean).join(" · ");
  const def = LEVEL[level];
  return {
    product:
      `Teach one topic: "${topic.name}" (${place}), grade ${topic.grade}` +
      `${topic.stream ? `, ${topic.stream} stream` : ""}, ${topic.curriculumId} curriculum. ` +
      def.lessonBrief,
    process:
      `Write in ${topic.language === "ar" ? "Arabic" : "English"}, the language this subject is taught in. ` +
      `Stay inside the unit "${topic.unit ?? topic.subject}": a child meeting this for the first time has not yet met ` +
      `the units after it, so an explanation that leans on them is not an explanation. Work every example to its ` +
      `last line — a step called "obvious" is the step the child is stuck on.`,
    performance:
      `Good means a child who missed the class can attempt tonight's homework unaided. ` +
      `Where you are not certain of a fact, a formula or what this syllabus includes, say so in the lesson in one ` +
      `plain sentence rather than writing something plausible. An admission costs a child nothing; an invention ` +
      `costs him the exam question.`,
  };
}

// ── III. Discernment ─────────────────────────────────────────────────────────

export interface Check {
  id: string;
  /** Asked of the finished lesson, answerable yes or no. */
  question: string;
  /** `block` never reaches a child; `warn` reaches the child and the parent's review queue together. */
  severity: "block" | "warn";
}

/** What is checked before a child reads it. */
export function checks(topic: CurriculumTopic, level: Level): Check[] {
  const base: Check[] = [
    { id: "on_topic", severity: "block",
      question: `Is this a lesson about "${topic.name}", rather than about the unit in general?` },
    { id: "language", severity: "block",
      question: `Is it written in ${topic.language === "ar" ? "Arabic" : "English"}?` },
    { id: "grade_fit", severity: "block",
      question: `Would a grade ${topic.grade} child follow it without meeting anything from a later year?` },
    { id: "worked_example", severity: "block",
      question: "Is there at least one example worked to its final line, with no step skipped?" },
    { id: "no_invention", severity: "block",
      question: "Is every stated fact, formula or date one you are confident in, with uncertainty admitted where it exists?" },
    { id: "attemptable", severity: "warn",
      question: "Could the child attempt a homework question on this immediately after reading?" },
  ];
  if (level === "advanced") {
    base.push(
      { id: "says_why", severity: "block",
        question: "Does it say why the rule holds, not only what it is?" },
      { id: "names_trap", severity: "warn",
        question: "Does it name the mistake an exam sets on this topic?" },
    );
  }
  return base;
}

export interface CheckResult { id: string; passed: boolean; note?: string }

export interface Verdict {
  /** May a child be shown this? */
  release: boolean;
  /** Failed checks that stop it. */
  blocking: string[];
  /** Failed checks that let it through but must be seen by a parent. */
  warnings: string[];
}

export function verdict(cs: Check[], results: CheckResult[]): Verdict {
  const by = new Map(results.map((r) => [r.id, r]));
  const failed = cs.filter((c) => by.get(c.id)?.passed !== true);
  // A check that was never run counts as failed. Silence is not a pass: that is the whole lesson of this session.
  const blocking = failed.filter((c) => c.severity === "block").map((c) => c.id);
  const warnings = failed.filter((c) => c.severity === "warn").map((c) => c.id);
  return { release: blocking.length === 0, blocking, warnings };
}

// ── IV. Diligence ────────────────────────────────────────────────────────────

export interface Provenance {
  /** Always true, always shown. A child should never wonder whether a person wrote this. */
  aiWritten: true;
  topicId: string;
  level: Level;
  /** What produced it, so a bad batch can be found by its model rather than one lesson at a time. */
  model: string;
  checkedAt: string;
  failedChecks: string[];
  /** Set when a parent has read it and said it matched the class. */
  humanReviewedBy?: string | null;
}

/** The line a child actually sees. Disclosure a child cannot read is not disclosure. */
export function disclosure(p: Provenance, lang: string): string {
  const reviewed = !!p.humanReviewedBy;
  if (lang === "ar") {
    return reviewed
      ? "كتب هذا الدرس مساعد ذكي وراجعه أحد والديك."
      : "كتب هذا الدرس مساعد ذكي. إن بدا شيء مخالفاً لما شرحه معلمك، أبلغ والديك.";
  }
  return reviewed
    ? "This lesson was written by an AI and checked by one of your parents."
    : "This lesson was written by an AI. If anything looks different from what your teacher said, tell a parent.";
}

export function provenance(o: {
  topic: CurriculumTopic; level: Level; model: string; cs: Check[]; results: CheckResult[];
}): Provenance {
  const v = verdict(o.cs, o.results);
  return {
    aiWritten: true,
    topicId: o.topic.id,
    level: o.level,
    model: o.model,
    checkedAt: new Date().toISOString(),
    failedChecks: [...v.blocking, ...v.warnings],
    humanReviewedBy: null,
  };
}
