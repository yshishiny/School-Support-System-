"use client";

import { useMemo, useState } from "react";
import { resolveErrorsAction } from "@/lib/actions/ops";
import type { ErrorRow } from "@/lib/ops/health";

function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  return mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
}

const siteOf = (e: ErrorRow) => {
  const m = e.meta as { site?: string; version?: string } | null;
  return m?.site ? `${m.site === "main" ? "live" : m.site}${m.version ? ` ${m.version}` : ""}` : null;
};
const detailOf = (e: ErrorRow) => (e.meta && typeof e.meta === "object" ? ((e.meta as { detail?: string }).detail ?? null) : null);
const codeOf = (e: ErrorRow) => (e.meta && typeof e.meta === "object" ? ((e.meta as { code?: string }).code ?? null) : null);

/**
 * The error log, read the way it is actually used: somebody says "it told me k3f9a2" and that one row has to
 * come up. Failing that, the question is which *function* is failing, so the rows group by it rather than
 * scrolling past one at a time.
 */
export function ErrorLog({ rows }: { rows: ErrorRow[] }) {
  const [find, setFind] = useState("");
  const [only, setOnly] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const q = find.trim().toLowerCase();
  const byRef = q.length >= 4 ? rows.filter((e) => (e.ref ?? "").toLowerCase().startsWith(q)) : [];
  const shown = useMemo(() => {
    let list = rows;
    if (open) list = list.filter((e) => !e.resolved_at);
    if (only) list = list.filter((e) => e.area === only);
    if (q) {
      list = list.filter((e) =>
        (e.ref ?? "").toLowerCase().includes(q) ||
        e.area.toLowerCase().includes(q) ||
        e.message.toLowerCase().includes(q) ||
        (e.profiles?.full_name ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [rows, open, only, q]);

  // Which function is failing most: the question worth answering before reading any single row.
  const areas = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of rows) if (!e.resolved_at) m.set(e.area, (m.get(e.area) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const openCount = rows.filter((e) => !e.resolved_at).length;

  return (
    <div className="space-y-3">
      <div className="card !py-3 space-y-2">
        <label className="label" htmlFor="err-find">Someone quoted a reference</label>
        <input
          id="err-find"
          className="input font-mono tracking-widest"
          placeholder="k3f9a2 — or a function, a message, a name"
          value={find}
          onChange={(e) => setFind(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
        {q.length >= 4 && (
          byRef.length > 0
            ? <p className="text-xs text-good">Found it: {byRef[0].area} · {when(byRef[0].created_at)}{byRef[0].profiles?.full_name ? ` · ${byRef[0].profiles.full_name.split(" ")[0]}` : ""}</p>
            : <p className="text-xs muted">No reference starts with “{q}”. It may be older than the last {rows.length} failures, or from a refusal, which is not logged because nothing broke.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className={`chip ${open ? "chip-on" : ""}`}>
          {open ? `🔴 open · ${openCount}` : `all · ${rows.length}`}
        </button>
        {areas.slice(0, 12).map(([a, n]) => (
          <button key={a} type="button" onClick={() => setOnly((cur) => (cur === a ? null : a))} className={`chip ${only === a ? "chip-on" : ""}`}>
            {a} · {n}
          </button>
        ))}
        {openCount > 0 && (
          <form action={resolveErrorsAction.bind(null, null)} className="ml-auto">
            <button className="btn-ghost btn-sm">Mark all resolved</button>
          </form>
        )}
      </div>

      {rows.length === 0 && (
        <p className="card muted text-sm">
          Nothing recorded. Every failure the app catches — a database that said no, an AI call, a file that
          would not read, a nightly job, a browser crash — lands here from both sites with the function it
          happened in and the reference the person on the phone was shown.
        </p>
      )}
      {rows.length > 0 && shown.length === 0 && <p className="card muted text-sm">Nothing matches.</p>}

      {shown.map((e) => (
        <details key={e.id} className={`card !py-2 text-sm ${e.resolved_at ? "opacity-60" : ""}`}>
          <summary className="cursor-pointer flex flex-wrap items-center gap-2">
            <span>{e.resolved_at ? "✅" : "🔴"}</span>
            <b>{e.area}</b>
            {e.ref && <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[11px] tracking-widest">{e.ref}</code>}
            {codeOf(e) && <span className="badge !py-0 !px-2 text-[10px]">{codeOf(e)}</span>}
            {siteOf(e) && <span className="badge !py-0 !px-2 text-[10px]">{siteOf(e)}</span>}
            <span className="flex-1 min-w-0 truncate">{e.message}</span>
            <span className="text-xs muted">{e.profiles?.full_name ? `${e.profiles.full_name.split(" ")[0]} · ` : ""}{when(e.created_at)}</span>
          </summary>
          <div className="mt-2 space-y-1 text-xs">
            <div className="whitespace-pre-wrap break-words rounded-xl bg-panel-2 p-2">{e.message}</div>
            {detailOf(e) && <div className="whitespace-pre-wrap break-words rounded-xl bg-panel-2 p-2 muted">what it actually said: {detailOf(e)}</div>}
            {e.meta && <div className="muted break-words">meta: {JSON.stringify(e.meta).slice(0, 600)}</div>}
            {e.stack && <pre className="overflow-x-auto rounded-xl bg-panel-2 p-2 text-[10px] leading-tight max-h-48">{e.stack.slice(0, 2500)}</pre>}
            {!e.resolved_at && <form action={resolveErrorsAction.bind(null, e.id)}><button className="btn-ghost btn-sm">Resolved</button></form>}
          </div>
        </details>
      ))}
    </div>
  );
}
