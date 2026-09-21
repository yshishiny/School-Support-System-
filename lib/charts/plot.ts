/**
 * The arithmetic behind a chart, kept apart from the drawing of it.
 *
 * A scale that is subtly wrong does not throw and does not look broken — it just draws a picture that is not
 * true, which on this page would be a parent making a decision about his son from a lie. So the maths lives
 * here, in functions with tests, and the components below only turn the numbers into `d` attributes.
 */

export interface Box {
  /** The whole SVG. */
  w: number;
  h: number;
  /** Space for the axes and labels; the plot is what is left. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const plotWidth = (b: Box) => b.w - b.left - b.right;
export const plotHeight = (b: Box) => b.h - b.top - b.bottom;

/** One slot of a band scale: where a bar sits and how wide it is, capped so the band keeps its air. */
export function band(i: number, n: number, b: Box, maxThickness = 24): { x: number; w: number; centre: number } {
  const inner = plotWidth(b);
  const slot = n > 0 ? inner / n : inner;
  const w = Math.min(maxThickness, Math.max(2, slot * 0.6));
  const centre = b.left + slot * (i + 0.5);
  return { x: centre - w / 2, w, centre };
}

/** Where a value sits vertically. `max` is the top of the axis; 0 is the baseline. */
export function y(value: number, max: number, b: Box): number {
  if (max <= 0) return b.top + plotHeight(b);
  const clamped = Math.max(0, Math.min(max, value));
  return b.top + plotHeight(b) * (1 - clamped / max);
}

/** A round number at or above the data, so the axis reads in tens rather than in 37s. */
export function niceMax(values: (number | null)[], floor = 1): number {
  const real = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const top = Math.max(floor, ...real);
  if (top <= 5) return Math.ceil(top);
  const magnitude = 10 ** Math.floor(Math.log10(top));
  for (const step of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= top) return Math.round(candidate);
  }
  return Math.round(10 * magnitude);
}

/**
 * Runs of consecutive points that actually have a value.
 *
 * A week with no quiz in it is not a week he scored zero, and a line drawn straight through it would say he
 * did — the same confusion between silence and failure that the rest of this app spends its time refusing. Each
 * run is drawn as its own path, so a gap in the data is a gap in the line.
 */
export function segments(values: (number | null)[]): number[][] {
  const runs: number[][] = [];
  let current: number[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push(i);
    }
  });
  if (current.length) runs.push(current);
  return runs;
}

/** An SVG path through one run of points. A run of one is drawn as its marker alone, so it returns "". */
export function linePath(run: number[], values: (number | null)[], max: number, n: number, b: Box): string {
  if (run.length < 2) return "";
  return run
    .map((i, k) => `${k === 0 ? "M" : "L"}${band(i, n, b).centre.toFixed(1)},${y(values[i] as number, max, b).toFixed(1)}`)
    .join(" ");
}

/**
 * Evenly spaced ticks from 0 to max, inclusive, preferring a count that divides the axis into whole numbers.
 *
 * Four ticks over a max of 250 gives 62.5 and 187.5, which is not a scale anybody reads. Trying a few counts and
 * taking the first that comes out whole costs nothing and is the difference between an axis and a nuisance.
 */
export function ticks(max: number, preferred = 4): number[] {
  if (max <= 0) return [0];
  const counts = [preferred, 5, 4, 3, 2].filter((c, i, all) => c > 0 && all.indexOf(c) === i);
  const whole = counts.find((c) => Number.isInteger(max / c));
  const count = whole ?? preferred;
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(step * i * 100) / 100);
}
