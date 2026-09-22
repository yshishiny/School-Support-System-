/**
 * "I don't get it — teach me again."
 *
 * A lesson is written once per topic, grade and depth, and shared by every child in that year. So a child who
 * does not understand it cannot be given a rewrite: that would change the lesson under his brother, who was
 * fine with it. A re-teach is his own — same topic, same depth, taught another way, stored against his name.
 *
 * Three ways, because "I don't get it" is three different complaints:
 *
 * - **simpler** — the words were too hard, not the idea.
 * - **examples** — the rule made sense, using it did not.
 * - **different** — the explanation itself did not land, and saying it again louder will not help.
 *
 * Nothing here asks the child to diagnose himself in those terms; the buttons say what he would say.
 */

export type Style = "simpler" | "examples" | "different";

export interface StyleDef {
  id: Style;
  /** What the child taps. His words, not a teacher's. */
  label: string;
  emoji: string;
  /** What he is told he will get, before he spends a minute waiting for it. */
  promise: string;
  /** The instruction added to the brief. Written at the model, not at the child. */
  brief: string;
}

export const STYLES: StyleDef[] = [
  {
    id: "simpler",
    label: "Use easier words",
    emoji: "🧊",
    promise: "The same lesson with smaller words and shorter sentences.",
    brief:
      "The student read the standard lesson on this topic and found the LANGUAGE too hard — not the idea. Teach exactly the same content with much simpler vocabulary and shorter sentences. Explain any word a specialist would use the first time it appears. Do not cut the content and do not talk down to them: they are not slow, the words were.",
  },
  {
    id: "examples",
    label: "Show me more examples",
    emoji: "✏️",
    promise: "More worked examples, every step shown.",
    brief:
      "The student understood the rule but cannot apply it. Keep the explanation short and spend the lesson on WORKED EXAMPLES: at least five, easiest first, every single step written out, and after each one a sentence naming the mistake most students make there. End with two for them to try, answers below.",
  },
  {
    id: "different",
    label: "Explain it another way",
    emoji: "🔄",
    promise: "A different angle — a new analogy and a fresh route in.",
    brief:
      "The student read the standard lesson and it did not land. Do NOT repeat its structure or its analogy. Come at the idea from a different direction: a different analogy, a different order, and where possible a concrete or visual route rather than a formal one. Saying the same thing again more slowly is the one thing that will not help.",
  },
];

export function styleOf(id: string): StyleDef | null {
  return STYLES.find((s) => s.id === id) ?? null;
}

/** Whether a string from a form is a style we know, so a bad value never reaches the model. */
export function isStyle(v: unknown): v is Style {
  return typeof v === "string" && STYLES.some((s) => s.id === v);
}

export interface Retake {
  id: string;
  style: Style;
  contentMd: string;
  createdAt: string;
}

/**
 * The child's retakes for one topic, newest first, at most one per style.
 *
 * Keeping only the newest of each style stops a child stacking six near-identical "simpler" attempts and
 * losing the one that worked among them.
 */
export function newestPerStyle(rows: Retake[]): Retake[] {
  const seen = new Set<Style>();
  const out: Retake[] = [];
  for (const r of [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    if (seen.has(r.style)) continue;
    seen.add(r.style);
    out.push(r);
  }
  return out;
}

/** Which ways he has not yet tried, so the buttons lead somewhere new. */
export function untried(rows: Retake[]): StyleDef[] {
  const had = new Set(rows.map((r) => r.style));
  return STYLES.filter((s) => !had.has(s.id));
}
