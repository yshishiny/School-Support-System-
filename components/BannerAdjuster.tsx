"use client";

import { useRef, useState, useTransition, type PointerEvent as RPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { setBannerFramingAction } from "@/lib/actions/hero";

/** Drag to move, pinch or slide to zoom, then Save. The preview has the same shape as the banner on the home page. */
export function BannerAdjuster({ url, zoom: z0, x: x0, y: y0 }: { url: string; zoom: number; x: number; y: number }) {
  const router = useRouter();
  const [zoom, setZoom] = useState(z0);
  const [x, setX] = useState(x0);
  const [y, setY] = useState(y0);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  function onDown(e: RPointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }
  function onMove(e: RPointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !box.current) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(clamp(Math.round((pinch.current.zoom * (d / pinch.current.dist)) * 20) / 20, 1, 3));
      return;
    }
    const rect = box.current.getBoundingClientRect();
    const span = Math.max(1, zoom - 1); // how much of the image is off-canvas, in canvas widths
    // Position percent moves opposite to the drag; at zoom 1 there is nothing to pan.
    if (zoom > 1) {
      setX((v) => clamp(v - ((cur.x - prev.x) / (rect.width * span)) * 100, 0, 100));
      setY((v) => clamp(v - ((cur.y - prev.y) / (rect.height * span)) * 100, 0, 100));
    }
  }
  function onUp(e: RPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  return (
    <div className="space-y-2">
      <div
        ref={box}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative h-[170px] w-full overflow-hidden rounded-2xl border-2 border-accent/60 touch-none cursor-grab active:cursor-grabbing select-none"
        style={{ backgroundImage: `url(${url})`, backgroundSize: `${zoom * 100}% auto`, backgroundPosition: `${x}% ${y}%`, backgroundRepeat: "no-repeat" }}
      >
        <div className="absolute inset-x-3 bottom-2 text-[11px] text-white/90 drop-shadow">Your name and points sit here ↓</div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="muted">Zoom</span>
        <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[var(--color-accent)]" />
        <span className="w-10 text-right">{zoom.toFixed(2)}×</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-primary btn-sm" disabled={pending} onClick={() => start(async () => { await setBannerFramingAction(zoom, Math.round(x), Math.round(y)); setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 1500); })}>{pending ? "Saving…" : saved ? "Saved ✓" : "Save framing"}</button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => { setZoom(1); setX(50); setY(30); }}>Reset</button>
        <span className="text-[11px] muted">Drag to move · pinch or slide to zoom</span>
      </div>
    </div>
  );
}
