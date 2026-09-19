"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * An illustrated scene: the base drawing is always there; each `<g data-step="n">` appears when the teacher reaches
 * its cue, the newest step glows, and a pointer sits over it so the child looks where the teacher is talking.
 */
export function Scene({ svg, step }: { svg: string; step: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  // A stable object: React re-sets innerHTML on a new {__html} instance, which would wipe the step classes on every re-render.
  const html = useMemo(() => ({ __html: svg }), [svg]);

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
        if (r.width || r.height) { setPointer({ x: r.left + r.width / 2 - c.left, y: r.top - c.top }); return; }
      }
      setPointer(null);
    };
    place();
    const t = window.setTimeout(place, 350);
    window.addEventListener("resize", place);
    return () => { window.clearTimeout(t); window.removeEventListener("resize", place); };
  }, [svg, step]);

  return (
    <div ref={ref} className="scene relative rounded-xl bg-white p-2 [&>div>svg]:w-full [&>div>svg]:h-auto [&>div>svg]:max-h-[42vh]">
      <div dangerouslySetInnerHTML={html} />
      {pointer && <span className="scene-pointer" style={{ left: pointer.x, top: pointer.y }} aria-hidden>👇</span>}
    </div>
  );
}
