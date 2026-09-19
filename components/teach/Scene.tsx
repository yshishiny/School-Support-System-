"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const LIGHT = /^(#fff(?:fff)?|white|#f[0-9a-f]f[0-9a-f]f[0-9a-f]|#e[0-9a-f]e[0-9a-f]e[0-9a-f]|rgb\(2[3-5]\d,\s*2[3-5]\d,\s*2[3-5]\d\))$/i;

/** Labels stay readable whatever the drawing did: dark ink, a white halo, and no two labels on top of each other. */
function guardText(root: HTMLElement) {
  const svg = root.querySelector("svg");
  if (!svg) return;
  const texts = Array.from(svg.querySelectorAll<SVGTextElement>("text"));
  for (const t of texts) {
    const fill = (t.getAttribute("fill") ?? getComputedStyle(t).fill ?? "").trim();
    if (!fill || LIGHT.test(fill)) t.setAttribute("fill", "#1f2430");
    if (!t.getAttribute("paint-order")) { t.setAttribute("paint-order", "stroke"); t.setAttribute("stroke", "#ffffff"); t.setAttribute("stroke-width", "5"); t.setAttribute("stroke-linejoin", "round"); }
  }
  // Nudge overlapping labels apart (downwards), once, in canvas units.
  try {
    const boxes = texts.map((t) => ({ t, b: t.getBBox() })).filter((x) => x.b.width > 0).sort((a, b) => a.b.y - b.b.y);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = boxes[j].b, b = boxes[i].b;
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapX > 4 && overlapY > 2) {
          const dy = overlapY + 6;
          const prev = boxes[i].t.getAttribute("transform") ?? "";
          boxes[i].t.setAttribute("transform", `${prev} translate(0 ${dy})`.trim());
          boxes[i].b = { ...b, y: b.y + dy } as DOMRect;
        }
      }
    }
  } catch { /* getBBox needs layout; skip when not available */ }
}

/**
 * An illustrated scene: the base drawing is always there; each `<g data-step="n">` appears when the teacher reaches
 * its cue, the newest step glows, and a pointer sits over it so the child looks where the teacher is talking.
 */
export function Scene({ svg, step }: { svg: string; step: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // A stable object: React re-sets innerHTML on a new {__html} instance, which would wipe the step classes on every re-render.
  const html = useMemo(() => ({ __html: svg }), [svg]);

  useEffect(() => { if (ref.current) guardText(ref.current); }, [svg]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const place = () => {
      let target: Element | null = null;
      root.querySelectorAll<SVGElement>("[data-step]").forEach((el) => {
        const s = Number(el.getAttribute("data-step"));
        const on = s <= step;
        el.classList.toggle("scene-hidden", !on);
        el.classList.toggle("scene-now", s === step);
        if (s === step && !target) target = el;
      });
      if (target) {
        const r = (target as Element).getBoundingClientRect();
        const c = root.getBoundingClientRect();
        // A padded box in container coordinates: the ring frames it, the laser sits on its top-left shoulder.
        if (r.width || r.height) {
          const pad = 10;
          setFocus({ x: r.left - c.left - pad, y: r.top - c.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 });
          return;
        }
      }
      setFocus(null);
    };
    place();
    const t = window.setTimeout(place, 350);
    window.addEventListener("resize", place);
    return () => { window.clearTimeout(t); window.removeEventListener("resize", place); };
  }, [svg, step]);

  return (
    <div ref={ref} className="scene relative rounded-xl bg-white/95 p-2 shadow-[0_10px_30px_rgba(0,0,0,.25)] [&>div>svg]:w-full [&>div>svg]:h-auto [&>div>svg]:max-h-[42vh]">
      <div dangerouslySetInnerHTML={html} />
      {focus && (
        <>
          <span className="scene-ring" style={{ left: focus.x, top: focus.y, width: focus.w, height: focus.h }} aria-hidden />
          <span className="scene-laser" style={{ left: focus.x + focus.w / 2, top: focus.y }} aria-hidden>
            <i className="scene-laser-ripple" />
            <i className="scene-laser-dot" />
          </span>
        </>
      )}
    </div>
  );
}
