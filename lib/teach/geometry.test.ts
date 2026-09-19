import { describe, expect, it } from "vitest";
import { anglePath, clipToCanvas, intersect, renderGeometry, renderGraph } from "./geometry";

describe("geometry maths", () => {
  it("finds the intersection of two lines and none for parallels", () => {
    expect(intersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 5 });
    expect(intersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBeNull();
  });
  it("extends a line to the canvas edges", () => {
    const [a, b] = clipToCanvas({ x: 320, y: 180 }, { x: 1, y: 0 });
    expect(a).toEqual({ x: 0, y: 180 });
    expect(b).toEqual({ x: 640, y: 180 });
  });
  it("draws the smaller angle between two rays, with its size", () => {
    const arc = anglePath({ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 0 }, 30);
    expect(arc.degrees).toBeCloseTo(90, 5);
    expect(arc.d.startsWith("M 100 70 A 30 30")).toBe(true);
  });
});

describe("renderGeometry", () => {
  const spec = {
    points: [{ id: "A", x: 60, y: 120, label: "A", step: null, hidden: null }, { id: "B", x: 580, y: 120, label: "B", step: null, hidden: null }, { id: "P", x: 100, y: 240, label: null, step: null, hidden: true }, { id: "T1", x: 200, y: 40, label: null, step: null, hidden: true }, { id: "T2", x: 420, y: 330, label: null, step: null, hidden: true }],
    lines: [
      { id: "L1", from: "A", to: "B", through: null, parallel_to: null, perpendicular_to: null, kind: "line", color: "#3a86ff", label: "l₁", step: 1 },
      { id: "L2", from: "P", to: null, through: null, parallel_to: "L1", perpendicular_to: null, kind: "line", color: "#3a86ff", label: "l₂", step: 1 },
      { id: "T", from: "T1", to: "T2", through: null, parallel_to: null, perpendicular_to: null, kind: "line", color: "#e63946", label: "t", step: 2 },
    ],
    intersections: [{ id: "X", of: ["L1", "T"], label: "X", step: 2 }, { id: "Y", of: ["L2", "T"], label: "Y", step: 2 }],
    angles: [{ at: "X", from: "B", to: "T1", label: "1", color: "#2a9d8f", radius: null, right: null, step: 3 }, { at: "Y", from: "T2", to: "P", label: "1", color: "#2a9d8f", radius: null, right: null, step: 3 }],
    ticks: [], circles: [], polygons: [], notes: [{ x: 320, y: 340, text: "∠1 = ∠1 (alternate angles)", color: null, step: 4 }],
  } as const;
  it("renders parallels, a transversal, true intersections and arcs on the rays, in steps", () => {
    const svg = renderGeometry(JSON.parse(JSON.stringify(spec)));
    expect(svg).toContain('data-step="1"');
    expect(svg).toContain('data-step="3"');
    expect((svg.match(/<line /g) ?? []).length).toBeGreaterThanOrEqual(3);
    // The parallel through P keeps L1's direction: horizontal at y = 240 from edge to edge.
    expect(svg).toContain('x1="0" y1="240" x2="640" y2="240"');
    // Both intersections are drawn as points with labels.
    expect(svg).toContain(">X</text>");
    expect(svg).toContain(">Y</text>");
    expect(svg).not.toContain("NaN");
  });
});

describe("renderGeometry segments", () => {
  const base = { points: [{ id: "C", x: 330, y: 80, label: null, step: null, hidden: true }, { id: "F", x: 330, y: 290, label: null, step: null, hidden: true }], intersections: [], angles: [], ticks: [], circles: [], polygons: [], notes: [] };
  it("keeps a dashed height between its two points instead of running off the canvas", () => {
    const svg = renderGeometry({ ...base, lines: [{ id: "H", from: "C", to: "F", through: null, parallel_to: null, perpendicular_to: null, kind: "dashed", color: "#e63946", label: null, step: 1 }] } as never);
    expect(svg).toContain('y1="80"');
    expect(svg).toContain('y2="290"');
    expect(svg).toContain("stroke-dasharray");
  });
});

describe("renderGraph", () => {
  it("draws axes, a line series and a marked point", () => {
    const svg = renderGraph({ x: { min: 0, max: 10, label: "time (s)", step_size: 2 }, y: { min: 0, max: 50, label: "distance (m)", step_size: 10 }, series: [{ kind: "line", points: [[0, 0], [10, 50]], color: null, label: "car", step: 1 }], marks: [{ x: 4, y: 20, label: "4 s → 20 m", color: null, step: 2 }] });
    expect(svg).toContain("<polyline");
    expect(svg).toContain("time (s)");
    expect(svg).toContain('data-step="2"');
    expect(svg).not.toContain("NaN");
  });
});

describe("graph labels stay in the plot", () => {
  it("clamps a series label whose last point is in the top corner", () => {
    const svg = renderGraph({ x: { min: 0, max: 10, label: null, step_size: 2 }, y: { min: 0, max: 50, label: null, step_size: 10 }, series: [{ kind: "line", points: [[0, 0], [10, 50]], color: null, label: "car", step: null }], marks: [] });
    const m = /<text x="([\d.]+)" y="([\d.]+)"[^>]*>car<\/text>/.exec(svg);
    expect(m).not.toBeNull();
    expect(Number(m![2])).toBeGreaterThanOrEqual(60);
    expect(Number(m![1])).toBeLessThanOrEqual(614);
  });
});
