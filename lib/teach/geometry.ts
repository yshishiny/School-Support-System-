import { z } from "zod";

/**
 * Exact construction drawing. The illustrator names points, lines (also "parallel to L through P"), intersections,
 * angle arcs at a vertex between two rays, tick marks, circles and polygons; this renders them with real maths, so
 * arcs sit on their rays, lines meet at true intersections and parallels are parallel. Steps map to data-step groups.
 */
const Step = z.number().int().min(0).max(8).nullable();
const Color = z.string().nullable();

export const GeometrySchema = z.object({
  points: z.array(z.object({ id: z.string(), x: z.number(), y: z.number(), label: z.string().nullable(), step: Step, hidden: z.boolean().nullable() })).describe("Named points in canvas units (x 0-640, y 0-360, y grows downwards)"),
  lines: z.array(z.object({
    id: z.string(), from: z.string(), to: z.string().nullable(), through: z.string().nullable(), parallel_to: z.string().nullable(), perpendicular_to: z.string().nullable(),
    kind: z.enum(["line", "segment", "ray", "dashed"]).nullable(), color: Color, label: z.string().nullable(), step: Step,
  })).describe("A line through two points (from,to), or through one point parallel/perpendicular to another line (from = that point). 'line' extends to the canvas edges; 'segment' stops at its points; 'ray' starts at 'from'."),
  intersections: z.array(z.object({ id: z.string(), of: z.tuple([z.string(), z.string()]), label: z.string().nullable(), step: Step })).describe("A point where two lines meet; usable as a vertex afterwards"),
  angles: z.array(z.object({ at: z.string(), from: z.string(), to: z.string(), label: z.string().nullable(), color: Color, radius: z.number().nullable(), right: z.boolean().nullable(), step: Step })).describe("The arc at vertex 'at' from the ray towards 'from' to the ray towards 'to' (the smaller angle). 'right' draws the square mark."),
  ticks: z.array(z.object({ from: z.string(), to: z.string(), count: z.number().int().min(1).max(3), step: Step })).describe("Equal-length marks across the middle of a segment"),
  circles: z.array(z.object({ center: z.string(), radius: z.number(), color: Color, label: z.string().nullable(), step: Step })),
  polygons: z.array(z.object({ points: z.array(z.string()).min(3), fill: Color, step: Step })),
  notes: z.array(z.object({ x: z.number(), y: z.number(), text: z.string(), color: Color, step: Step })).describe("Free text at a position, e.g. a result box"),
});
export type GeometrySpec = z.infer<typeof GeometrySchema>;

export const GraphSchema = z.object({
  x: z.object({ min: z.number(), max: z.number(), label: z.string().nullable(), step_size: z.number().nullable() }),
  y: z.object({ min: z.number(), max: z.number(), label: z.string().nullable(), step_size: z.number().nullable() }),
  series: z.array(z.object({ kind: z.enum(["line", "points", "bars"]), points: z.array(z.tuple([z.number(), z.number()])).min(1), color: Color, label: z.string().nullable(), step: Step })),
  marks: z.array(z.object({ x: z.number(), y: z.number(), label: z.string().nullable(), color: Color, step: Step })).describe("Highlighted points with dashed guides to both axes"),
});
export type GraphSpec = z.infer<typeof GraphSchema>;

type Pt = { x: number; y: number };
const W = 640, H = 360, INK = "#1f2430";
const PALETTE = ["#3a86ff", "#e63946", "#2a9d8f", "#f4a261", "#8338ec", "#52b788"];

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
const f = (n: number) => (Math.round(n * 10) / 10).toString();
const text = (x: number, y: number, s: string, color = INK, size = 26, anchor = "middle") => `<text x="${f(x)}" y="${f(y)}" font-size="${size}" font-weight="700" fill="${color}" stroke="#ffffff" stroke-width="5" paint-order="stroke" stroke-linejoin="round" text-anchor="${anchor}">${esc(s)}</text>`;
const grp = (step: number | null | undefined, inner: string) => (inner ? (step ? `<g data-step="${step}">${inner}</g>` : inner) : "");

/** Where two infinite lines meet, or null when parallel. */
export function intersect(a1: Pt, a2: Pt, b1: Pt, b2: Pt): Pt | null {
  const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / d;
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
}

/** The two points where a line through p with direction d leaves the canvas. */
export function clipToCanvas(p: Pt, d: Pt): [Pt, Pt] {
  const ts: number[] = [];
  if (Math.abs(d.x) > 1e-9) { ts.push((0 - p.x) / d.x, (W - p.x) / d.x); }
  if (Math.abs(d.y) > 1e-9) { ts.push((0 - p.y) / d.y, (H - p.y) / d.y); }
  const inside = (t: number) => { const q = { x: p.x + t * d.x, y: p.y + t * d.y }; return q.x > -1e-6 && q.x < W + 1e-6 && q.y > -1e-6 && q.y < H + 1e-6; };
  const ok = ts.filter(inside).sort((a, b) => a - b);
  const a = ok[0] ?? 0, b = ok[ok.length - 1] ?? 0;
  return [{ x: p.x + a * d.x, y: p.y + a * d.y }, { x: p.x + b * d.x, y: p.y + b * d.y }];
}

/** Arc path of the smaller angle at vertex v between rays towards a and b, plus the bisector direction for the label. */
export function anglePath(v: Pt, a: Pt, b: Pt, r: number): { d: string; mid: Pt; degrees: number } {
  let t1 = Math.atan2(a.y - v.y, a.x - v.x);
  let t2 = Math.atan2(b.y - v.y, b.x - v.x);
  let sweep = t2 - t1;
  while (sweep <= -Math.PI) sweep += 2 * Math.PI;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  if (sweep < 0) { [t1, t2] = [t2, t1]; sweep = -sweep; }
  const p1 = { x: v.x + r * Math.cos(t1), y: v.y + r * Math.sin(t1) };
  const p2 = { x: v.x + r * Math.cos(t2), y: v.y + r * Math.sin(t2) };
  const midT = t1 + sweep / 2;
  return { d: `M ${f(p1.x)} ${f(p1.y)} A ${r} ${r} 0 0 1 ${f(p2.x)} ${f(p2.y)}`, mid: { x: Math.cos(midT), y: Math.sin(midT) }, degrees: (sweep * 180) / Math.PI };
}

export function renderGeometry(g: GeometrySpec): string {
  const pts = new Map<string, Pt>();
  g.points.forEach((p) => pts.set(p.id, { x: p.x, y: p.y }));
  type L = { id: string; p: Pt; d: Pt; a: Pt; b: Pt; kind: string; color: string; label: string | null; step: number | null | undefined; from: Pt; to: Pt | null };
  const lines = new Map<string, L>();
  const lineIds = g.lines.map((l) => l.id);
  // Lines may reference other lines (parallel/perpendicular): resolve in order, twice, so forward references work too.
  for (let pass = 0; pass < 2; pass++) {
    for (const [k, l] of g.lines.entries()) {
      const from = pts.get(l.from);
      if (!from || lines.has(l.id)) continue;
      let d: Pt | null = null;
      let to: Pt | null = null;
      if (l.to && pts.get(l.to)) { to = pts.get(l.to)!; d = { x: to.x - from.x, y: to.y - from.y }; }
      else if (l.parallel_to && lines.get(l.parallel_to)) d = lines.get(l.parallel_to)!.d;
      else if (l.perpendicular_to && lines.get(l.perpendicular_to)) { const r = lines.get(l.perpendicular_to)!.d; d = { x: -r.y, y: r.x }; }
      else if (l.through && pts.get(l.through)) { to = pts.get(l.through)!; d = { x: to.x - from.x, y: to.y - from.y }; }
      if (!d || (Math.abs(d.x) < 1e-9 && Math.abs(d.y) < 1e-9)) continue;
      const [a, b] = clipToCanvas(from, d);
      lines.set(l.id, { id: l.id, p: from, d, a, b, kind: l.kind ?? "line", color: l.color ?? PALETTE[k % PALETTE.length], label: l.label, step: l.step, from, to });
    }
  }
  for (const x of g.intersections) {
    const A = lines.get(x.of[0]), B = lines.get(x.of[1]);
    if (!A || !B) continue;
    const p = intersect(A.a, A.b, B.a, B.b);
    if (p) pts.set(x.id, p);
  }
  const out: string[] = [`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Nunito, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#f7f9fc"/>`];
  // Polygons first (under everything).
  for (const poly of g.polygons) {
    const ps = poly.points.map((id) => pts.get(id)).filter((p): p is Pt => !!p);
    if (ps.length < 3) continue;
    out.push(grp(poly.step, `<polygon points="${ps.map((p) => `${f(p.x)},${f(p.y)}`).join(" ")}" fill="${poly.fill ?? "#3a86ff"}" fill-opacity=".18" stroke="none"/>`));
  }
  for (const c of g.circles) {
    const ce = pts.get(c.center);
    if (!ce) continue;
    out.push(grp(c.step, `<circle cx="${f(ce.x)}" cy="${f(ce.y)}" r="${f(c.radius)}" fill="none" stroke="${c.color ?? INK}" stroke-width="4"/>${c.label ? text(ce.x, ce.y - c.radius - 12, c.label, c.color ?? INK, 22) : ""}`));
  }
  for (const id of lineIds) {
    const l = lines.get(id);
    if (!l) continue;
    let p1 = l.a, p2 = l.b;
    if ((l.kind === "segment" || l.kind === "dashed") && l.to) { p1 = l.from; p2 = l.to; }
    if (l.kind === "ray") { const far = clipToCanvas(l.from, l.d)[1]; p1 = l.from; p2 = far; }
    const dash = l.kind === "dashed" ? ' stroke-dasharray="10 7"' : "";
    let label = "";
    if (l.label) {
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const len = Math.hypot(l.d.x, l.d.y) || 1;
      const nx = -l.d.y / len, ny = l.d.x / len;
      label = text(mx + nx * 22, my + ny * 22 + 8, l.label, l.color, 24);
    }
    out.push(grp(l.step, `<line x1="${f(p1.x)}" y1="${f(p1.y)}" x2="${f(p2.x)}" y2="${f(p2.y)}" stroke="${l.color}" stroke-width="5" stroke-linecap="round"${dash}/>${label}`));
  }
  for (const t of g.ticks) {
    const a = pts.get(t.from), b = pts.get(t.to);
    if (!a || !b) continue;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, nx = -uy, ny = ux;
    const marks: string[] = [];
    for (let i = 0; i < t.count; i++) {
      const o = (i - (t.count - 1) / 2) * 8;
      marks.push(`<line x1="${f(mx + ux * o - nx * 9)}" y1="${f(my + uy * o - ny * 9)}" x2="${f(mx + ux * o + nx * 9)}" y2="${f(my + uy * o + ny * 9)}" stroke="${INK}" stroke-width="3"/>`);
    }
    out.push(grp(t.step, marks.join("")));
  }
  for (const [k, an] of g.angles.entries()) {
    const v = pts.get(an.at), a = pts.get(an.from), b = pts.get(an.to);
    if (!v || !a || !b) continue;
    const color = an.color ?? PALETTE[(k + 1) % PALETTE.length];
    const r = an.radius ?? 34;
    const arc = anglePath(v, a, b, r);
    let shape: string;
    if (an.right || Math.abs(arc.degrees - 90) < 0.5) {
      const ua = { x: (a.x - v.x) / (Math.hypot(a.x - v.x, a.y - v.y) || 1), y: (a.y - v.y) / (Math.hypot(a.x - v.x, a.y - v.y) || 1) };
      const ub = { x: (b.x - v.x) / (Math.hypot(b.x - v.x, b.y - v.y) || 1), y: (b.y - v.y) / (Math.hypot(b.x - v.x, b.y - v.y) || 1) };
      const s = 18;
      shape = `<path d="M ${f(v.x + ua.x * s)} ${f(v.y + ua.y * s)} L ${f(v.x + (ua.x + ub.x) * s)} ${f(v.y + (ua.y + ub.y) * s)} L ${f(v.x + ub.x * s)} ${f(v.y + ub.y * s)}" fill="none" stroke="${color}" stroke-width="4"/>`;
    } else {
      shape = `<path d="${arc.d} L ${f(v.x)} ${f(v.y)} Z" fill="${color}" fill-opacity=".3" stroke="none"/><path d="${arc.d}" fill="none" stroke="${color}" stroke-width="4"/>`;
    }
    const lab = an.label ? text(v.x + arc.mid.x * (r + 26), v.y + arc.mid.y * (r + 26) + 9, an.label, color, 26) : "";
    out.push(grp(an.step, shape + lab));
  }
  const drawPoint = (id: string, label: string | null, step: number | null | undefined) => {
    const p = pts.get(id);
    if (!p) return;
    const onLines = [...lines.values()].filter((l) => Math.abs((l.d.y * (p.x - l.p.x) - l.d.x * (p.y - l.p.y)) / (Math.hypot(l.d.x, l.d.y) || 1)) < 0.5);
    // Label away from the lines through the point: opposite the sum of their normals, else up-right.
    let ox = 1, oy = -1;
    if (onLines.length) { const nx = onLines.reduce((s, l) => s + -l.d.y / (Math.hypot(l.d.x, l.d.y) || 1), 0), ny = onLines.reduce((s, l) => s + l.d.x / (Math.hypot(l.d.x, l.d.y) || 1), 0); const n = Math.hypot(nx, ny); if (n > 0.2) { ox = nx / n; oy = ny / n; } }
    out.push(grp(step, `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="6" fill="${INK}"/>${label ? text(p.x + ox * 20, p.y + oy * 20 + 9, label, INK, 26) : ""}`));
  };
  g.points.forEach((p) => { if (!p.hidden) drawPoint(p.id, p.label, p.step); });
  g.intersections.forEach((x) => drawPoint(x.id, x.label, x.step));
  for (const n of g.notes) {
    const w = Math.min(600, n.text.length * 13 + 28);
    out.push(grp(n.step, `<rect x="${f(n.x - w / 2)}" y="${f(n.y - 22)}" width="${f(w)}" height="40" rx="10" fill="#fff3cd" stroke="#f4a261" stroke-width="3"/>${text(n.x, n.y + 7, n.text, n.color ?? INK, 22)}`));
  }
  out.push("</svg>");
  return out.join("");
}

export function renderGraph(gr: GraphSpec): string {
  const L = 70, R = 30, T = 24, B = 54;
  const sx = (x: number) => L + ((x - gr.x.min) / (gr.x.max - gr.x.min || 1)) * (W - L - R);
  const sy = (y: number) => H - B - ((y - gr.y.min) / (gr.y.max - gr.y.min || 1)) * (H - T - B);
  const out: string[] = [`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Nunito, Arial, sans-serif"><rect width="${W}" height="${H}" fill="#f7f9fc"/><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${INK}"/></marker></defs>`];
  const nice = (span: number) => { const p = Math.pow(10, Math.floor(Math.log10(span / 5 || 1))); const m = span / 5 / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; };
  const xs = gr.x.step_size ?? nice(gr.x.max - gr.x.min), ys = gr.y.step_size ?? nice(gr.y.max - gr.y.min);
  for (let x = Math.ceil(gr.x.min / xs) * xs; x <= gr.x.max + 1e-9; x += xs) out.push(`<line x1="${f(sx(x))}" y1="${T}" x2="${f(sx(x))}" y2="${H - B}" stroke="#dfe5ee" stroke-width="1"/>${text(sx(x), H - B + 24, String(+x.toFixed(6)), "#4a5568", 16)}`);
  for (let y = Math.ceil(gr.y.min / ys) * ys; y <= gr.y.max + 1e-9; y += ys) out.push(`<line x1="${L}" y1="${f(sy(y))}" x2="${W - R}" y2="${f(sy(y))}" stroke="#dfe5ee" stroke-width="1"/>${text(L - 12, sy(y) + 6, String(+y.toFixed(6)), "#4a5568", 16, "end")}`);
  const x0 = sy(Math.max(gr.y.min, Math.min(gr.y.max, 0))), y0 = sx(Math.max(gr.x.min, Math.min(gr.x.max, 0)));
  out.push(`<line x1="${L}" y1="${f(x0)}" x2="${W - R + 8}" y2="${f(x0)}" stroke="${INK}" stroke-width="3" marker-end="url(#ah)"/><line x1="${f(y0)}" y1="${H - B}" x2="${f(y0)}" y2="${T - 8}" stroke="${INK}" stroke-width="3" marker-end="url(#ah)"/>`);
  if (gr.x.label) out.push(text(W - R - 4, H - 10, gr.x.label, INK, 20, "end"));
  if (gr.y.label) out.push(text(L + 20, T + 6, gr.y.label, INK, 20, "start"));
  gr.series.forEach((s, k) => {
    const color = s.color ?? PALETTE[k % PALETTE.length];
    let body = "";
    if (s.kind === "bars") {
      const bw = Math.max(8, ((W - L - R) / Math.max(1, s.points.length)) * 0.5);
      body = s.points.map(([x, y]) => `<rect x="${f(sx(x) - bw / 2)}" y="${f(Math.min(sy(y), sy(0)))}" width="${f(bw)}" height="${f(Math.abs(sy(y) - sy(0)))}" fill="${color}" fill-opacity=".8" stroke="${color}" stroke-width="2"/>`).join("");
    } else {
      if (s.kind === "line") body += `<polyline points="${s.points.map(([x, y]) => `${f(sx(x))},${f(sy(y))}`).join(" ")}" fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
      body += s.points.map(([x, y]) => `<circle cx="${f(sx(x))}" cy="${f(sy(y))}" r="${s.kind === "points" ? 7 : 5}" fill="${color}" stroke="#fff" stroke-width="2"/>`).join("");
    }
    if (s.label) {
      const [lx, ly] = s.points[s.points.length - 1];
      const tx = Math.min(Math.max(sx(lx) - 6, L + 60), W - R - 6), ty = Math.min(Math.max(sy(ly) - 16, T + 46), H - B - 8);
      body += text(tx, ty, s.label, color, 22, "end");
    }
    out.push(grp(s.step, body));
  });
  gr.marks.forEach((m, k) => {
    const color = m.color ?? PALETTE[(k + 1) % PALETTE.length];
    out.push(grp(m.step, `<line x1="${f(sx(m.x))}" y1="${f(sy(m.y))}" x2="${f(sx(m.x))}" y2="${f(x0)}" stroke="${color}" stroke-width="2" stroke-dasharray="6 5"/><line x1="${f(sx(m.x))}" y1="${f(sy(m.y))}" x2="${f(y0)}" y2="${f(sy(m.y))}" stroke="${color}" stroke-width="2" stroke-dasharray="6 5"/><circle cx="${f(sx(m.x))}" cy="${f(sy(m.y))}" r="8" fill="${color}" stroke="#fff" stroke-width="3"/>${m.label ? text(sx(m.x) + 14, sy(m.y) - 14, m.label, color, 22, "start") : ""}`));
  });
  out.push("</svg>");
  return out.join("");
}
