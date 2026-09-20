/**
 * Marking a recitation against the text it was supposed to be.
 *
 * Transcribing speech is the easy half and the half that buys nothing on its own: a child does not need to be told
 * what he said, he needs to be told **which word he got wrong**. So the transcript is aligned against the text
 * word by word and every word comes back with a verdict.
 *
 * Arabic makes this delicate in one specific way. A reciter says the word; a transcriber writes it with whatever
 * spelling and vowel marks it chooses; and the مصحف spells several things its own way (ٱلرَّحْمَٰن with a dagger
 * alef, ٱ at the start, ة versus ه at a stop). Comparing those literally would mark a perfect recitation wrong,
 * which would be worse than not marking it at all — a child who is told he is wrong when he is right stops
 * trusting the thing that told him. So both sides are folded to their consonantal skeleton before comparing, and
 * only a genuinely different word counts as a mistake.
 */

const TASHKEEL = /[ً-ْٰٓ-ٕـۖ-ۭ]/g;
const NOT_ARABIC = /[^ء-ي\s]/g;

/**
 * The consonantal skeleton: what was actually said, with every way of writing it folded together.
 *
 * Order matters here and is easy to get wrong. ٱ (the wasla alef the مصحف opens ٱلله with) sits outside the
 * plain Arabic letter block, so stripping "not a letter" first deletes it and turns ٱلله into لله — a perfect
 * recitation marked as a missing word. Every letter is normalised before anything is thrown away.
 */
export function fold(word: string): string {
  return word
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")  // آ أ إ ٱ → ا, before anything is removed
    .replace(/\u0649/g, "\u064A")    // ى → ي
    .replace(/\u0629/g, "\u0647")    // ة → ه, which a stop changes anyway
    .replace(TASHKEEL, "")          // vowel marks, sukun, dagger alef, tatweel, ayah marks
    .replace(NOT_ARABIC, " ")       // ۝, punctuation, digits, latin
    .replace(/\s+/g, " ")
    .trim();
}

export function words(text: string): string[] {
  return fold(text).split(" ").filter(Boolean);
}

export type WordVerdict = "correct" | "wrong" | "missed" | "extra";

export interface MarkedWord {
  /** The word as the original text writes it, so a child sees his own مصحف spelling, not the folded form. */
  text: string;
  verdict: WordVerdict;
}

export interface Marking {
  words: MarkedWord[];
  /** Out of 100, by how much of the expected text was recited correctly. */
  score: number;
  correct: number;
  expected: number;
  /** The first place it went wrong, which is the only one worth saying out loud. */
  firstSlip: number | null;
}

/**
 * Longest common subsequence over the folded words.
 *
 * Alignment rather than position-by-position comparison, because a child who skips one word has not got every
 * word after it wrong — he has missed one. Marking the rest of the ayah red for a single dropped word is exactly
 * the kind of discouragement that stops him practising.
 */
function lcs(a: string[], b: string[]): number[][] {
  const m = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      m[i][j] = a[i] === b[j] ? m[i + 1][j + 1] + 1 : Math.max(m[i + 1][j], m[i][j + 1]);
    }
  }
  return m;
}

export function mark(expected: string, heard: string): Marking {
  // Kept side by side: the folded form decides, the original is what a child is shown — with his own
  // vowel marks intact, because a مصحف stripped of tashkeel is not the text he learnt from.
  const original = expected.split(/\s+/).filter(Boolean);
  const exp = words(expected);
  const got = words(heard);
  if (exp.length === 0) return { words: [], score: 0, correct: 0, expected: 0, firstSlip: null };

  const m = lcs(exp, got);
  const out: MarkedWord[] = [];
  let i = 0;
  let j = 0;
  let correct = 0;
  let firstSlip: number | null = null;

  const show = (k: number) => original[k] ?? exp[k];

  while (i < exp.length && j < got.length) {
    if (exp[i] === got[j]) {
      out.push({ text: show(i), verdict: "correct" });
      correct += 1;
      i += 1;
      j += 1;
    } else if (m[i + 1][j] >= m[i][j + 1]) {
      // A word of the text that was not said.
      out.push({ text: show(i), verdict: "missed" });
      if (firstSlip === null) firstSlip = out.length - 1;
      i += 1;
    } else {
      // Something said that is not in the text. Shown so he can hear what he substituted.
      out.push({ text: got[j], verdict: "extra" });
      if (firstSlip === null) firstSlip = out.length - 1;
      j += 1;
    }
  }
  while (i < exp.length) {
    out.push({ text: show(i), verdict: "missed" });
    if (firstSlip === null) firstSlip = out.length - 1;
    i += 1;
  }
  while (j < got.length) {
    out.push({ text: got[j], verdict: "extra" });
    if (firstSlip === null) firstSlip = out.length - 1;
    j += 1;
  }

  return {
    words: out,
    score: Math.round((correct / exp.length) * 100),
    correct,
    expected: exp.length,
    firstSlip,
  };
}

/** What to say to the child. One sentence, and never a list of everything he got wrong. */
export function verdictLine(m: Marking): string {
  if (m.expected === 0) return "Nothing to check.";
  if (m.score === 100) return "Every word. ما شاء الله 🌟";
  if (m.score >= 90) return "Almost perfect — one slip.";
  if (m.score >= 70) return "Good. Look at the words in red and go again.";
  if (m.score >= 40) return "Getting there. Read it through once more, then recite.";
  return "Read it with the text in front of you first, then try from memory.";
}
