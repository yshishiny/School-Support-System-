/**
 * Learning rules: mastery, spaced repetition, quiz points, integrity flags.
 * Pure functions so they are unit-testable.
 */
export const QUIZ_POINTS = {
  COMPLETE: 5, // finishing a set
  PER_CORRECT: 1,
  HIGH_SCORE_BONUS: 5, // 80% or better
  REVIEW_COMPLETE: 5,
  DAILY_CAP: 60, // practice points per day, so grinding does not outpay real work
} as const;

import { secondsPerQuestion, scaledEstimate, sectionsFor } from "./exams";

/** Enhanced ACT (2025+) sections; kept for callers that only care about the ACT. */
export const ACT_SECTIONS = Object.fromEntries(sectionsFor("ACT"));

export function actSecondsPerQuestion(section: string): number {
  return secondsPerQuestion(section);
}

export function quizPoints(score: number, total: number, kind: "quiz" | "review", alreadyToday: number): number {
  if (total === 0) return 0;
  let pts = kind === "review" ? QUIZ_POINTS.REVIEW_COMPLETE : QUIZ_POINTS.COMPLETE;
  pts += score * QUIZ_POINTS.PER_CORRECT;
  if (score / total >= 0.8) pts += QUIZ_POINTS.HIGH_SCORE_BONUS;
  const room = Math.max(0, QUIZ_POINTS.DAILY_CAP - alreadyToday);
  return Math.min(pts, room);
}

export interface IntegrityInput {
  secondsPerAnswer: number[];
  score: number;
  total: number;
  tabSwitches: number;
  minReasonableSeconds?: number; // per question; defaults by content type
}

/** Flags patterns that suggest guessing, copying, or looking answers up. */
export function integrityFlag(input: IntegrityInput): string | null {
  const { secondsPerAnswer, score, total, tabSwitches } = input;
  const min = input.minReasonableSeconds ?? 6;
  if (total === 0) return null;
  const sorted = [...secondsPerAnswer].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const pct = score / total;
  if (median < min && pct >= 0.8) return `Answered very fast (median ${median}s per question) with a high score`;
  if (tabSwitches >= 3 && pct >= 0.7) return `Left the quiz tab ${tabSwitches} times`;
  return null;
}

export interface ReviewState {
  interval_days: number;
  lapses: number;
}

/** Next review schedule after answering: wrong → tomorrow; right → grow the interval. */
export function nextReview(prev: ReviewState | null, correct: boolean, today: string): { due_date: string; interval_days: number; lapses: number } {
  if (!correct) {
    return { due_date: addDays(today, 1), interval_days: 1, lapses: (prev?.lapses ?? 0) + 1 };
  }
  const interval = prev ? Math.max(2, Math.round(prev.interval_days * 2.5)) : 3;
  return { due_date: addDays(today, Math.min(interval, 60)), interval_days: Math.min(interval, 60), lapses: prev?.lapses ?? 0 };
}

export function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Mastery per topic from attempts: weighted toward the most recent attempt. */
export function masteryFor(attempts: { score: number; total: number; submitted_at: string }[]): number | null {
  const done = attempts.filter((a) => a.total > 0).sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
  if (done.length === 0) return null;
  let m = (done[0].score / done[0].total) * 100;
  for (const a of done.slice(1)) m = 0.4 * m + 0.6 * (a.score / a.total) * 100;
  return Math.round(m);
}

/** Rough ACT scale estimate (1-36) from a percentage correct on practice sets. */
export function actEstimate(pct: number | null): number | null {
  return scaledEstimate("ACT", pct);
}
