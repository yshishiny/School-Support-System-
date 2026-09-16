"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptMaterialItemsAction, createMaterialQuizAction, dismissMaterialItemsAction, rereadMaterialAction } from "@/lib/actions/materials";
import type { ExtractedItem } from "@/lib/ai/extract-items";
import { KIND_EMOJI } from "@/lib/types";

/** Suggested tasks from a file: tick the ones to add. */
export function MaterialItemsReview({ materialId, items }: { materialId: string; items: ExtractedItem[] }) {
  const router = useRouter();
  const [keep, setKeep] = useState<number[]>(items.map((_, i) => i).filter((i) => items[i].confidence !== "low" || true));
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  if (done) return <p className="text-xs text-good">{done}</p>;
  return (
    <div className="space-y-1 text-sm">
      <div className="text-xs font-semibold muted">Suggested tasks · tick what to add</div>
      {items.map((it, i) => (
        <label key={i} className="flex items-start gap-2 text-xs">
          <input type="checkbox" className="mt-0.5" checked={keep.includes(i)} onChange={(e) => setKeep(e.target.checked ? [...keep, i] : keep.filter((k) => k !== i))} />
          <span><b>{KIND_EMOJI[it.kind]} {it.title}</b>{it.due_date ? ` · due ${it.due_date}` : " · no date"}{it.confidence === "low" ? " · unsure" : ""}{it.details ? <span className="muted"> · {it.details}</span> : null}</span>
        </label>
      ))}
      <div className="flex gap-2 pt-1">
        <button type="button" disabled={pending || keep.length === 0} className="btn-primary btn-sm" onClick={() => start(async () => { const r = await acceptMaterialItemsAction(materialId, keep); setDone(`${r.added} task${r.added === 1 ? "" : "s"} added.`); router.refresh(); })}>Add {keep.length}</button>
        <button type="button" disabled={pending} className="btn-ghost btn-sm" onClick={() => start(async () => { await dismissMaterialItemsAction(materialId); setDone("Skipped."); router.refresh(); })}>Skip</button>
      </div>
    </div>
  );
}

/** The child's "practise from this file" button. */
export function PractiseFromFile({ materialId, sets }: { materialId: string; sets: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="input !py-1 !w-auto text-xs" value={difficulty} onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}>
        <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
      </select>
      <button type="button" disabled={pending} className="btn-primary btn-sm" onClick={() => start(async () => { setError(null); const r = await createMaterialQuizAction(materialId, difficulty); if (r?.error) setError(r.error); })}>{pending ? "Writing questions…" : sets ? `⚡ Another set (${sets} done)` : "⚡ Practise from this file"}</button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </div>
  );
}

/** Re-run the AI reading on a file that failed or changed. */
export function ReadAgainButton({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} className="btn-ghost btn-sm" onClick={() => start(async () => { setMsg(null); const r = await rereadMaterialAction(materialId); setMsg(r.error ?? (r.items !== undefined && r.summary && !r.summary.startsWith("Saved, but") ? "Read ✓" : r.summary ?? null)); router.refresh(); })}>{pending ? "Reading… (up to a minute)" : "🔁 Read again"}</button>
      {msg && <span className="text-xs muted">{msg}</span>}
    </span>
  );
}
