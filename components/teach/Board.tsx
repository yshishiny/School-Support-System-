"use client";

import { useEffect, useMemo, useRef } from "react";
import { sanitizeSvg } from "@/lib/svg";
import { boardLines } from "@/lib/teach/performance";

import { Scene } from "./Scene";

export interface BoardShow { type: "text" | "steps" | "formula" | "table" | "svg" | "scene"; content: string; cues?: { phrase: string; step: number }[] | null }

/** An AI diagram drawn stroke by stroke: every shape gets a unit path length and a staggered draw animation. */
function DrawnSvg({ svg }: { svg: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => ({ __html: svg }), [svg]);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const shapes = root.querySelectorAll<SVGElement>("path, line, polyline, polygon, circle, ellipse, rect");
    shapes.forEach((el, i) => {
      el.setAttribute("pathLength", "1");
      el.classList.add("board-draw");
      el.style.animationDelay = `${Math.min(2.4, i * 0.12)}s`;
    });
    root.querySelectorAll<SVGElement>("text").forEach((el, i) => { el.classList.add("board-fade"); el.style.animationDelay = `${0.6 + Math.min(2.4, i * 0.15)}s`; });
  }, [svg]);
  return <div ref={ref} className="board-svg rounded-xl bg-white/95 p-2 [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[38vh]" dangerouslySetInnerHTML={html} />;
}

/**
 * The classroom board. Content appears as the teacher speaks: lines are revealed up to `revealed`,
 * formulas are chalked in, tables fill row by row, diagrams draw themselves.
 */
export function Board({ show, revealed, step = 99, rtl, title, kindLabel, idle = false, image = null, children }: { show: BoardShow | null; revealed: number; /** For scenes: the highest step spoken so far. */ step?: number; rtl: boolean; title: string; kindLabel: string; /** Nothing to show for this beat: a quiet "listen" note instead of an empty board. */ idle?: boolean; /** A real photograph behind the board content, with its credit. */ image?: { url: string; credit?: string | null; license?: string | null } | null; children?: React.ReactNode }) {
  const lines = show ? boardLines(show) : [];
  const n = Math.min(lines.length, Math.max(0, revealed));
  return (
    <div className="board relative h-full w-full rounded-[1.4rem] overflow-hidden" dir={rtl ? "rtl" : undefined}>
      {image && (
        <div className="absolute inset-0 overflow-hidden rounded-[1.4rem]" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={image.url} src={image.url} alt="" className="kenburns h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/45 to-black/75" />
          <div className="absolute bottom-3 end-3 text-[9px] text-white/60 max-w-[60%] truncate">{[image.credit, image.license].filter(Boolean).join(" · ") || "Wikimedia Commons"}</div>
        </div>
      )}
      <div className="board-frame absolute inset-0 pointer-events-none" />
      <div className="absolute top-2 inset-x-4 flex items-center justify-between text-[11px] uppercase tracking-wider text-[#d9d2b8]/70 font-bold" style={{ fontFamily: "var(--font-display)" }}>
        <span className="truncate">{title}</span>
        <span className="badge !whitespace-nowrap !border-[#d9d2b8]/30 !bg-transparent !text-[#f3eedc] !py-0.5 !px-2 ms-2 shrink-0">{kindLabel}</span>
      </div>
      <div className={`absolute inset-x-4 top-9 bottom-4 overflow-auto text-[#f6f1e2] ${rtl ? "text-right font-arabic" : ""}`} style={{ fontFamily: rtl ? "var(--font-arabic)" : "var(--font-display)" }}>
        {!show && idle && <div className="h-full flex items-center justify-center text-[#d9d2b8]/50 text-sm italic">{rtl ? "استمع…" : "Listen…"}</div>}
        {show?.type === "svg" && (() => { const s = sanitizeSvg(show.content); return s ? <DrawnSvg svg={s} /> : <p className="text-sm">{show.content}</p>; })()}
        {show?.type === "scene" && (() => { const s = sanitizeSvg(show.content); return s ? <Scene svg={s} step={step} /> : <p className="text-sm">{show.content}</p>; })()}
        {show?.type === "formula" && (
          <div key={show.content} className="h-full flex items-center justify-center">
            <div className="board-chalk text-[clamp(1.6rem,6vw,3.2rem)] font-bold text-center leading-tight px-2 py-3 rounded-2xl">{show.content}</div>
          </div>
        )}
        {show?.type === "steps" && (
          <ol className="space-y-2 text-[clamp(1rem,2.6vw,1.35rem)] leading-snug">
            {lines.slice(0, n).map((l, i) => (
              <li key={i} className={`board-line flex gap-3 items-start rounded-xl px-3 py-2 ${i === n - 1 ? "bg-white/10 ring-1 ring-white/20" : "opacity-85"}`} style={{ animationDelay: "0s" }}>
                <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ffd166] text-[#2b1d2e] font-bold text-sm">{i + 1}</span>
                <span>{l.replace(/^\d+[.)]\s*/, "")}</span>
              </li>
            ))}
          </ol>
        )}
        {show?.type === "table" && (
          <table className="w-full text-[clamp(.95rem,2.4vw,1.2rem)]"><tbody>
            {lines.slice(0, n).map((r, i) => (
              <tr key={i} className={`board-line ${i === 0 ? "font-bold text-[#ffd166]" : ""}`}>{r.split("|").map((cell, k) => <td key={k} className="px-2 py-1.5 border-b border-white/15">{cell.trim()}</td>)}</tr>
            ))}
          </tbody></table>
        )}
        {show?.type === "text" && (
          <div className="space-y-2 text-[clamp(1.05rem,2.8vw,1.4rem)] leading-relaxed">
            {lines.slice(0, n).map((l, i) => <p key={i} className="board-line">{l}</p>)}
          </div>
        )}
        {children}
      </div>
      <div className="absolute bottom-0 inset-x-0 h-2.5 bg-[#7a5230] border-t border-black/20" />
    </div>
  );
}
