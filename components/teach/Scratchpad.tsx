"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#fff8e1", "#ffd166", "#7ee8fa", "#ff8fa3"];

/** A finger-drawing layer over the board: the child works the example alongside the teacher. */
export function Scratchpad({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !open) return;
    const fit = () => {
      const r = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const snap = document.createElement("canvas");
      snap.width = cv.width; snap.height = cv.height;
      snap.getContext("2d")?.drawImage(cv, 0, 0);
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      const ctx = cv.getContext("2d");
      if (ctx) { ctx.scale(dpr, dpr); ctx.drawImage(snap, 0, 0, r.width, r.height); }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const stroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const clear = () => { const cv = ref.current; const ctx = cv?.getContext("2d"); if (cv && ctx) ctx.clearRect(0, 0, cv.width, cv.height); };

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-20">
      <canvas
        ref={ref}
        className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
        onPointerDown={(e) => { drawing.current = true; last.current = pos(e); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={stroke}
        onPointerUp={() => { drawing.current = false; last.current = null; }}
        onPointerCancel={() => { drawing.current = false; last.current = null; }}
      />
      <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur px-2 py-1">
        {COLORS.map((c) => <button key={c} type="button" aria-label="pen colour" onClick={() => setColor(c)} className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-white scale-110" : "border-transparent"}`} style={{ background: c }} />)}
        <button type="button" className="text-xs font-bold px-2 py-1 rounded-full bg-white/15 text-white" onClick={clear}>Clear</button>
        <button type="button" className="text-xs font-bold px-2 py-1 rounded-full bg-white/15 text-white" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
