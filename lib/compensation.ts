/**
 * Late-entry compensation: two ayahs to read and one question to answer right. Pure helpers.
 * The ayahs come from the child's own memorisation list when he has one, otherwise from a rotation of short surahs.
 */
import type { Ayah } from "./quran";
import { SURAHS } from "./quran";

export interface CompQuestion { prompt: string; choices: string[]; correct: number }
export interface CompensationRow { id: string; kind: string; ref: string; label: string; verses: Ayah[]; question: CompQuestion; read_at: string | null; answered_at: string | null; correct: boolean | null; attempts: number; created_at: string }

export const COMPENSATION_POINTS = 1;

/** Short surahs, two ayahs at a time, so a child without a list still gets exact text. */
export const FALLBACK_PASSAGES: { surah: number; from: number; to: number }[] = [
  { surah: 103, from: 1, to: 2 }, { surah: 103, from: 2, to: 3 }, { surah: 112, from: 1, to: 2 }, { surah: 112, from: 3, to: 4 }, { surah: 108, from: 1, to: 2 }, { surah: 110, from: 1, to: 2 },
  { surah: 94, from: 1, to: 2 }, { surah: 94, from: 5, to: 6 }, { surah: 93, from: 3, to: 4 }, { surah: 107, from: 1, to: 2 }, { surah: 105, from: 1, to: 2 }, { surah: 97, from: 1, to: 2 },
  { surah: 113, from: 1, to: 2 }, { surah: 114, from: 1, to: 2 }, { surah: 1, from: 1, to: 2 }, { surah: 1, from: 5, to: 6 }, { surah: 2, from: 255, to: 255 }, { surah: 67, from: 1, to: 2 },
];

/** A stable pick from a list, keyed by the entry (so re-rendering never changes the passage). */
export function pickIndex(key: string, length: number): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return length ? h % length : 0;
}

/** Two consecutive ayahs from a memorisation item's segments, keyed by the entry. */
export function pickFromSegments(segments: Ayah[], key: string): Ayah[] {
  if (segments.length === 0) return [];
  if (segments.length === 1) return [segments[0]];
  const start = pickIndex(key, segments.length - 1);
  return [segments[start], segments[start + 1]];
}

const words = (t: string) => t.split(/\s+/).filter(Boolean);

/**
 * One question on the ayahs just read. When the second ayah has enough words: "which word completes it?" with
 * the last word hidden and three last words from other ayahs as distractors. Otherwise: "which surah is this from?".
 */
export function buildQuestion(verses: Ayah[], pool: Ayah[], key: string): CompQuestion {
  const target = verses[verses.length - 1];
  const tw = words(target.text);
  const distractors = [...new Set(pool.filter((a) => a.ref !== target.ref).map((a) => words(a.text).slice(-1)[0]).filter((w) => w && w !== tw[tw.length - 1]))];
  if (tw.length >= 4 && distractors.length >= 3) {
    const last = tw[tw.length - 1];
    const stem = tw.slice(0, -1).join(" ");
    const picks: string[] = [];
    let k = pickIndex(key, distractors.length);
    while (picks.length < 3) { picks.push(distractors[k % distractors.length]); k += 7; }
    const choices = [...picks];
    const correct = pickIndex(key + "c", 4);
    choices.splice(correct, 0, last);
    return { prompt: `أكمل الآية: «${stem} …»`, choices, correct };
  }
  const surahNo = Number(target.ref.split(":")[0]);
  const right = SURAHS.find((s) => s.n === surahNo);
  const others = SURAHS.filter((s) => s.n !== surahNo && s.n >= 78);
  const picks: string[] = [];
  let k = pickIndex(key, others.length);
  while (picks.length < 3) { picks.push(`سورة ${others[k % others.length].ar}`); k += 5; }
  const correct = pickIndex(key + "s", 4);
  const choices = [...picks];
  choices.splice(correct, 0, `سورة ${right?.ar ?? "?"}`);
  return { prompt: "من أي سورة هذه الآيات؟", choices, correct };
}

/** The refs of late entries that were balanced (read + answered right), for the allowance count. */
export function compensatedRefs(rows: Pick<CompensationRow, "ref" | "correct">[]): Set<string> {
  return new Set(rows.filter((r) => r.correct === true).map((r) => r.ref));
}
