import { band, linePath, niceMax, plotHeight, segments, ticks, y, type Box } from "@/lib/charts/plot";
import { hasData, type WeekPoint } from "@/lib/charts/progress";

/**
 * One week-by-week chart, drawn on the server as plain SVG.
 *
 * The colours are fixed hex rather than the app's theme variables on purpose: a child's chosen theme repaints
 * `--color-accent` to anything from crimson to gold, and a series hue has to keep its contrast against the card
 * it sits on. `#0ea5c4` was checked against this surface (#141b2f) for lightness band, chroma, contrast and
 * colour-vision separation; the theme variables were not, and cannot be, because they change per child.
 *
 * Everything else follows the house rules for marks: bars capped so the band keeps its air, a 4px rounded
 * data-end square to the baseline, 2px lines with round caps, markers with a 2px ring in the surface colour so
 * they stay legible where they cross, hairline recessive gridlines, and text that never wears the data colour.
 */
const SERIES = "#0ea5c4";
const SURFACE = "#141b2f";
const GRID = "#263252";
const INK_MUTED = "#8b95b5";

const BOX: Box = { w: 340, h: 148, top: 10, right: 8, bottom: 26, left: 32 };

export interface WeeklyChartProps {
  title: string;
  /** What one unit means, for the tooltip and the table. */
  unit: string;
  points: WeekPoint[];
  kind: "bar" | "line";
  /** Fixes the top of the axis when the measure has a natural ceiling (100 for a score, 7 for days). */
  axisMax?: number;
  /** A horizontal line the reader is meant to compare against, such as the 50 that starts paying. */
  reference?: { at: number; label: string };
  /** One line under the title saying what the reader is looking at. */
  note?: string;
}

export function WeeklyChart({ title, unit, points, kind, axisMax, reference, note }: WeeklyChartProps) {
  const values = points.map((p) => p.value);
  const n = points.length;
  const max = axisMax ?? niceMax(values, 1);
  const baseline = BOX.top + plotHeight(BOX);
  const empty = !hasData(points);
  const last = [...points].reverse().find((p) => p.value !== null) ?? null;

  return (
    <figure className="m-0 space-y-1">
      <figcaption>
        <div className="text-sm font-semibold">{title}</div>
        {note && <div className="text-xs muted">{note}</div>}
      </figcaption>

      {empty ? (
        <p className="text-xs muted py-6 text-center">Nothing recorded yet.</p>
      ) : (
        <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className="w-full h-auto" role="img" aria-label={`${title}, week by week`}>
          {/* Gridlines and their ticks: hairline, solid, recessive, and never in the data colour. */}
          {ticks(max, axisMax === 7 ? 7 : 4).map((t) => (
            <g key={t}>
              <line x1={BOX.left} x2={BOX.w - BOX.right} y1={y(t, max, BOX)} y2={y(t, max, BOX)} stroke={GRID} strokeWidth={1} />
              <text x={BOX.left - 5} y={y(t, max, BOX) + 3} textAnchor="end" fontSize={8} fill={INK_MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
                {t}
              </text>
            </g>
          ))}

          {/*
            The reference keeps the dashes and loses the floating label: at twelve weeks there is no horizontal
            position where a label does not eventually sit on a bar, and a caption under the chart cannot collide
            with anything.
          */}
          {reference && reference.at <= max && (
            <line
              x1={BOX.left} x2={BOX.w - BOX.right} y1={y(reference.at, max, BOX)} y2={y(reference.at, max, BOX)}
              stroke={INK_MUTED} strokeWidth={1} strokeDasharray="3 3"
            />
          )}

          {kind === "bar"
            ? points.map((p, i) => {
                const { x, w } = band(i, n, BOX);
                if (p.value === null) return null; // a week with nothing to measure draws nothing at all
                if (p.value === 0) {
                  // Measured, and the answer was nothing. Drawing no bar would make it identical to the gap
                  // above, which is the one confusion this whole app exists to refuse — so zero gets a mark.
                  return (
                    <g key={p.start}>
                      <rect x={x} y={baseline - 2} width={w} height={2} fill={SERIES} />
                      <title>{`${p.label}: 0 ${unit}`}</title>
                    </g>
                  );
                }
                const top = y(p.value, max, BOX);
                const h = Math.max(2, baseline - top);
                return (
                  <g key={p.start}>
                    {/* A rounded data-end and a square foot: the radius is squared off by the baseline rect. */}
                    <rect x={x} y={top} width={w} height={h} rx={Math.min(4, w / 2)} fill={SERIES} />
                    {h > 4 && <rect x={x} y={baseline - Math.min(4, h)} width={w} height={Math.min(4, h)} fill={SERIES} />}
                    <title>{`${p.label}: ${p.value} ${unit}`}</title>
                  </g>
                );
              })
            : (
              <>
                {segments(values).map((run) => (
                  <path
                    key={run[0]}
                    d={linePath(run, values, max, n, BOX)}
                    fill="none" stroke={SERIES} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  />
                ))}
                {points.map((p, i) =>
                  p.value === null ? null : (
                    <g key={p.start}>
                      {/* The ring is the surface colour, so a marker stays readable where the line runs under it. */}
                      <circle cx={band(i, n, BOX).centre} cy={y(p.value, max, BOX)} r={4} fill={SERIES} stroke={SURFACE} strokeWidth={2} />
                      <title>{`${p.label}: ${p.value} ${unit}`}</title>
                    </g>
                  ),
                )}
              </>
            )}

          {/* Only the first and last weeks are labelled: an axis of twelve dates is unreadable at this size. */}
          {[0, n - 1].map((i) => (
            <text key={i} x={band(i, n, BOX).centre} y={BOX.h - 8} textAnchor="middle" fontSize={8} fill={INK_MUTED}>
              {points[i]?.label}
            </text>
          ))}
        </svg>
      )}

      {/* The value that matters, once, in a text token — never a number on every point. */}
      {(last || reference) && (
        <p className="text-xs muted">
          {last && <>Latest · <b className="text-ink">{last.value} {unit}</b> in the week of {last.label}</>}
          {last && reference && " · "}
          {reference && <>dashed line: {reference.label}</>}
        </p>
      )}

      {/* Nothing is gated behind hover: the numbers are always reachable. */}
      {!empty && (
        <details className="text-xs">
          <summary className="cursor-pointer muted select-none">See the numbers</summary>
          <table className="mt-1 w-full text-left">
            <thead>
              <tr className="muted"><th className="font-semibold py-0.5">Week</th><th className="font-semibold py-0.5 text-right">{unit}</th></tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.start} className="border-t border-line">
                  <td className="py-0.5">{p.label}</td>
                  <td className="py-0.5 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {p.value === null ? <span className="muted">not measured</span> : p.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
