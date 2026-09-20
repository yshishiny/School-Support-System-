/**
 * Two depths of the same lesson.
 *
 * A child who missed a class needs the rule, one clear example, and the confidence to try the homework. A child
 * who already has that needs the reason the rule is true, the cases where it bites, and questions that do not
 * come apart in one step. Teaching both to the same page means one of them is always being failed.
 *
 * So every topic exists at two levels over the *same* curriculum — not different subjects, the same lesson taught
 * shallow or deep. The basics are free everywhere, for anybody: a child who cannot follow his class should never
 * be stopped by a price. The deep version, and the teacher who performs it, are what a family pays for.
 */
export type Level = "basics" | "advanced";

export const LEVELS: Level[] = ["basics", "advanced"];

export interface LevelDef {
  id: Level;
  label: string;
  emoji: string;
  /** What a child reads on the tab. */
  blurb: string;
  /** What the lesson writer is told. */
  lessonBrief: string;
  /** What the question writer is told. */
  quizBrief: string;
}

export const LEVEL: Record<Level, LevelDef> = {
  basics: {
    id: "basics",
    label: "The basics",
    emoji: "📖",
    blurb: "The rule, an example, and enough to do tonight's homework.",
    lessonBrief:
      "Teach this at the level of a student who missed the class or did not follow it. Plain language, short " +
      "sentences, one idea at a time. State the rule plainly and show it working on two straightforward examples, " +
      "every step written out, with the mistake most students make. Do not digress into why the rule is true, " +
      "into edge cases, or into anything beyond the grade. The goal is that he can attempt his homework tonight.",
    quizBrief:
      "One idea per question, numbers that stay tidy, no multi-step chains and no trick distractors. A student who " +
      "understood the lesson should get these right.",
  },
  advanced: {
    id: "advanced",
    label: "Go deeper",
    emoji: "🎓",
    blurb: "Why it works, where it breaks, and the questions an exam actually asks.",
    lessonBrief:
      "Teach this the way a strong private tutor teaches a student who already has the basics. Say why the rule is " +
      "true, not only what it is. Give the boundary cases and the conditions under which it fails. Connect it to " +
      "what it is built on and what it leads to next year. Work an example that takes several linked steps, and " +
      "name the trap an exam sets on this topic and how to see it coming. Assume the plain version has been read; " +
      "do not repeat it.",
    quizBrief:
      "Multi-step questions that combine this with something already learned, at least one that transfers the idea " +
      "to an unfamiliar situation, and distractors built from the specific misunderstanding a student has here — " +
      "the kind of wrong answer that looks right until you check it.",
  },
};

export function isLevel(v: unknown): v is Level {
  return v === "basics" || v === "advanced";
}

/** Anything unrecognised falls back to the free level: nobody is locked out by a bad value. */
export function levelOf(v: unknown): Level {
  return isLevel(v) ? v : "basics";
}

/**
 * Which levels this child may open. The basics are never gated; the deep version is what access buys.
 * `unlocked` is answered per site — the live site has nothing to sell, so it is always false there.
 */
export function levelsOpenTo(unlocked: boolean): Level[] {
  return unlocked ? ["basics", "advanced"] : ["basics"];
}

export function canOpen(level: Level, unlocked: boolean): boolean {
  return level === "basics" || unlocked;
}

/** What to say on a deep tab a child cannot open yet. Honest about what it is, never pushy. */
export const LOCKED_NOTE =
  "There is a deeper version of this lesson: why the rule works, where it breaks, and exam-style questions on it. " +
  "It comes with the teacher.";
