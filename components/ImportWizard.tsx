"use client";

import { useActionState, useState, useTransition } from "react";
import { analyzeExportAction, confirmImportAction } from "@/lib/actions/import";
import type { ExtractedItem } from "@/lib/ai/extract-items";
import { KIND_EMOJI } from "@/lib/types";
import { Notice, SubmitButton } from "./ui";

export function ImportWizard({ students, defaultSince }: { students: { id: string; full_name: string }[]; defaultSince: string }) {
  const [state, analyze] = useActionState(analyzeExportAction, undefined);
  const [selected, setSelected] = useState<Record<number, boolean> | null>(null);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const items = state?.items ?? [];
  const sel = selected ?? Object.fromEntries(items.map((_, i) => [i, true]));

  if (result) {
    return (
      <div className="card space-y-2">
        <p className="h2">Imported ✓</p>
        <p className="text-sm">{result.added} added{result.skipped ? `, ${result.skipped} skipped as duplicates` : ""}.</p>
        <a href="/parent/assignments" className="btn-primary">See tasks</a>
        <a href="/parent/import" className="btn-ghost">Import another</a>
      </div>
    );
  }

  if (state?.items && state.studentId) {
    const chosen = items.filter((_, i) => sel[i]);
    return (
      <div className="space-y-3">
        <div className="card space-y-2">
          <p className="text-sm muted">{state.messageCount} message(s) or photo(s) read.</p>
          {state.summary && <p className="text-sm">{state.summary}</p>}
        </div>
        {items.length === 0 && <p className="card muted">Nothing actionable found in that range.</p>}
        {items.map((it, i) => (
          <label key={i} className={`card flex gap-3 cursor-pointer ${sel[i] ? "" : "opacity-50"}`}>
            <input type="checkbox" checked={!!sel[i]} onChange={(e) => setSelected({ ...sel, [i]: e.target.checked })} className="mt-1" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">{KIND_EMOJI[it.kind]} {it.title}</div>
              <div className="text-xs muted">{it.subject ?? "no subject"} · {it.due_date ?? "no date"} · {it.confidence} confidence</div>
              {it.details && <div className="text-xs mt-1 whitespace-pre-line">{it.details}</div>}
              <details className="text-xs muted mt-1"><summary className="cursor-pointer">original</summary><p className="whitespace-pre-wrap">{it.source_excerpt}</p></details>
            </div>
          </label>
        ))}
        <button
          className="btn-primary w-full"
          disabled={pending || chosen.length === 0}
          onClick={() =>
            startTransition(async () => {
              const r = await confirmImportAction(state.studentId!, chosen as ExtractedItem[], state.messageCount ?? 0);
              setResult(r);
            })
          }
        >
          {pending ? "Adding…" : `Add ${chosen.length} item${chosen.length === 1 ? "" : "s"}`}
        </button>
      </div>
    );
  }

  return (
    <form action={analyze} className="card space-y-3">
      <div>
        <label className="label">Whose class group is this?</label>
        <select name="student_id" className="input" required defaultValue={students[0]?.id}>
          {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Photos or screenshots from the group (several at once is fine)</label>
        <input name="images" type="file" accept="image/*" multiple className="input" />
      </div>
      <div>
        <label className="label">…or the exported chat file (.txt)</label>
        <input name="file" type="file" accept=".txt,text/plain" className="input" />
      </div>
      <div>
        <label className="label">…or paste messages</label>
        <textarea name="pasted" rows={5} className="input" placeholder="14/09/2026, 20:15 - Ms. Sarah: Homework page 45..." />
      </div>
      <div>
        <label className="label">For chat files: only read messages since</label>
        <input name="since" type="date" className="input" defaultValue={defaultSince} />
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Reading messages… (10–30s)">Analyze</SubmitButton>
      <Notice error={state?.error} />
    </form>
  );
}
