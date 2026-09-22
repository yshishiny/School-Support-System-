/**
 * The school's files for one class, shown to a child who is logging what he took today.
 *
 * This was built as "every file this week whose subject matches", joined with semicolons into one sentence.
 * With duplicate uploads that became thirteen documents and sixty-five topics in a single run-on paragraph,
 * repeated under every class and again under every missed day — the densest thing on a page a thirteen-year-old
 * has to read after school.
 *
 * Three rules fix it:
 *
 * - **The same sheet sent twice is one sheet.** Titles are matched loosely, because the model names the same
 *   worksheet "Subject-Verb Agreement" and "Subject–Verb Agreement: SAT-Style Practice" on two passes.
 * - **Three is enough to jog a memory.** He is picking which lesson he had, not auditing the term.
 * - **Topics are a hint, not a transcript.** Two per sheet, and only when they add something the title does not.
 */

export interface SharedFile {
  title: string;
  topics: string[];
  /** Newest wins when two are the same; ISO date, or absent for files predating the column. */
  createdAt?: string | null;
}

export interface SharedChip {
  title: string;
  /** At most two, short, and never a repeat of the title. */
  hint: string[];
}

/**
 * Loose enough that a dash, a subtitle or a capital does not make a second document.
 *
 * Plurals are folded, because "Story **Settings** Description" and a topic called "**setting** description"
 * are the same words to a reader and only differ to a string comparison.
 */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[:(),.'"]/g, " ")
    .replace(/\b(practice|sheet|worksheet|sat-style|sat style|grade \d+|american|revision)\b/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/(?<=\w{4})(?:es|s)$/, ""))
    .filter(Boolean)
    .join(" ")
    .trim();
}

export const SHOWN = 3;
const HINTS = 2;

/** A topic worth printing: not already implied by the title, and short enough to read at a glance. */
function usefulHints(title: string, topics: string[]): string[] {
  const inTitle = new Set(titleKey(title).split(" "));
  return topics
    .map((t) => t.split(/[:(]/)[0].trim())
    .filter((t) => t.length > 2 && t.length <= 42)
    .filter((t) => !titleKey(t).split(" ").every((w) => inTitle.has(w)))
    .slice(0, HINTS);
}

/**
 * The distinct sheets for this class, newest first, capped.
 *
 * Returns the ones to show and how many were left out, so the page can say "and 10 more" instead of silently
 * hiding them — the same rule the uploader learned the hard way.
 */
export function sharedChips(files: SharedFile[], limit = SHOWN): { chips: SharedChip[]; more: number } {
  const byKey = new Map<string, SharedFile>();
  for (const f of files) {
    const k = titleKey(f.title);
    const had = byKey.get(k);
    // Keep the newest of a duplicate set; a file with no date never displaces one that has one.
    if (!had || (f.createdAt ?? "") > (had.createdAt ?? "")) byKey.set(k, f);
  }
  const distinct = [...byKey.values()].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return {
    chips: distinct.slice(0, limit).map((f) => ({ title: f.title, hint: usefulHints(f.title, f.topics) })),
    more: Math.max(0, distinct.length - limit),
  };
}
