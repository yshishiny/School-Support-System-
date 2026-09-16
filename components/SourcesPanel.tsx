"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSourceAction, checkSourceNowAction, deleteSourceAction, markFindingReviewedAction } from "@/lib/actions/sources";
import { confirmImportAction } from "@/lib/actions/import";
import type { ExtractedItem } from "@/lib/ai/extract-items";
import { KIND_EMOJI } from "@/lib/types";
import { Notice, SubmitButton } from "./ui";

export interface SourceRow { id: string; label: string; url: string; last_checked_at: string | null; last_error: string | null; student_id: string | null }
export interface FindingRow { id: string; source_id: string; found_at: string; summary: string; items: ExtractedItem[]; status: string }

export function SourcesPanel({ sources, findings, students }: { sources: SourceRow[]; findings: FindingRow[]; students: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [state, action] = useActionState(addSourceAction, undefined);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState(students[0]?.id ?? "");

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="h2">🏫 School announcements, checked weekly</h2>
        <p className="text-xs muted">Add the school website&apos;s news or announcements page. Every week the app reads it, and when something changed it extracts dates, exams, events and supply lists for your approval, and pings you on Telegram. Facebook pages cannot be read without a login; the WhatsApp export covers those.</p>
      </div>
      {sources.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {sources.map((s) => (
            <li key={s.id} className="py-1.5 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{s.label}</div>
                <div className="text-xs muted truncate">{s.url}</div>
                <div className="text-[11px] muted">{s.last_checked_at ? `checked ${s.last_checked_at.slice(0, 16).replace("T", " ")}` : "not checked yet"}{s.last_error ? ` · ⚠️ ${s.last_error}` : ""}</div>
              </div>
              <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await checkSourceNowAction(s.id); setMsg(r.error ? r.error : r.changed ? `${r.items} item(s) found.` : "Nothing new."); router.refresh(); })}>Check now</button>
              <button type="button" className="text-xs muted hover:text-bad" onClick={() => start(async () => { await deleteSourceAction(s.id); router.refresh(); })}>remove</button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="text-xs muted">{msg}</p>}
      <form action={action} className="grid gap-2 sm:grid-cols-3">
        <input name="label" className="input" placeholder="Label (e.g. KIS news)" maxLength={80} />
        <input name="url" className="input sm:col-span-2" placeholder="https://school-website.com/news" required />
        <select name="student_id" className="input"><option value="">Both kids</option>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
        <SubmitButton className="btn-primary sm:col-span-2" pendingText="Reading the page… up to a minute">Add and check</SubmitButton>
      </form>
      <Notice error={state?.error} />

      {findings.filter((f) => f.status === "new").map((f) => {
        const src = sources.find((s) => s.id === f.source_id);
        const chosen = f.items.filter((_, i) => sel[`${f.id}:${i}`] ?? true);
        return (
          <div key={f.id} className="rounded-xl border border-accent/40 p-3 space-y-2">
            <div className="text-sm"><b>{src?.label ?? "Source"}</b> · {f.found_at.slice(0, 10)}</div>
            <p className="text-sm muted">{f.summary}</p>
            {f.items.map((it, i) => (
              <label key={i} className="flex gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={sel[`${f.id}:${i}`] ?? true} onChange={(e) => setSel({ ...sel, [`${f.id}:${i}`]: e.target.checked })} className="mt-1" />
                <span><b>{KIND_EMOJI[it.kind]} {it.title}</b> <span className="muted">· {it.subject ?? "no subject"} · {it.due_date ?? "no date"}</span>{it.details ? <div className="text-xs muted">{it.details}</div> : null}</span>
              </label>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <select className="input py-1 w-44" value={target} onChange={(e) => setTarget(e.target.value)}>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>
              <button type="button" className="btn-primary btn-sm" disabled={pending || chosen.length === 0 || !target} onClick={() => start(async () => { const r = await confirmImportAction(target, chosen, 0); await markFindingReviewedAction(f.id); setMsg(`${r.added} added, ${r.skipped} skipped.`); router.refresh(); })}>Add {chosen.length} to {students.find((s) => s.id === target)?.full_name.split(" ")[0] ?? "child"}</button>
              <button type="button" className="text-xs muted" onClick={() => start(async () => { await markFindingReviewedAction(f.id); router.refresh(); })}>Dismiss</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
