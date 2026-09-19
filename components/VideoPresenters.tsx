"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearPresenterAction, setVideoCapAction, syncClipsAction, uploadPresenterAction } from "@/lib/actions/ops-video";
import { CHARACTERS } from "@/lib/characters";
import { runAction } from "@/lib/client-action";

/** Admin → Teachers: the presenter photo per character and the monthly clip cap. */
export function VideoPresenters({ enabled, presenters, cap, used, stats }: { enabled: boolean; presenters: Record<string, { url: string; custom: boolean }>; cap: number; used: number; stats: { done: number; pending: number; failed: number; errors: string[] } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [sync, setSync] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <section className="card space-y-2">
        <h2 className="h2">🎬 Teachers on video</h2>
        <p className="text-xs muted">Each scripted line becomes a short clip of a human presenter speaking with the premium voice (D-ID). Clips are rendered once per line and kept; while a clip renders, the animated teacher speaks the line. Needs <code>DID_API_KEY</code> in Vercel and the premium voices (Azure) switched on.</p>
        <div className="text-sm">{enabled ? "🟢 On" : "⚪ Off · DID_API_KEY not set"} · {used} clip{used === 1 ? "" : "s"} this month of {cap}</div>
        <div className="text-sm flex flex-wrap items-center gap-2">
          <span className="chip">✅ {stats.done} ready</span><span className="chip">⏳ {stats.pending} rendering</span><span className="chip">❌ {stats.failed} failed</span>
          <button type="button" className="btn-ghost btn-sm" disabled={pending || !enabled} onClick={() => start(async () => { setSync(null); const r = await runAction(() => syncClipsAction(), setSync); if (r?.error) setSync(r.error); else if (r?.summary) setSync(r.summary); router.refresh(); })}>{pending ? "Checking…" : "Check renders now"}</button>
        </div>
        {sync && <p className="text-xs">{sync}</p>}
        {stats.errors.length > 0 && <p className="text-xs text-bad">Latest failures: {stats.errors.join(" · ")}</p>}
        <p className="text-xs muted">Clips finish 1–3 minutes after a lesson starts; the app checks while a lesson is open, and this button checks at any time.</p>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => { const r = await runAction(() => setVideoCapAction(f), setMsg); if (r?.error) setMsg(r.error); else setMsg("Saved."); router.refresh(); }); }}>
          <label className="label !mb-0">Monthly cap</label>
          <input name="cap" type="number" min={0} defaultValue={cap} className="input !w-28" />
          <button className="btn-ghost btn-sm" disabled={pending}>Save</button>
        </form>
        <p className="text-xs muted">A lesson has 6–12 lines; 500 clips ≈ 50 lessons. Roughly US$1–3 per lesson script once on D-ID's API plans.</p>
      </section>
      <section className="card space-y-3">
        <h2 className="h2">Presenter photos</h2>
        <p className="text-xs muted">A clear, front-facing face on a plain background, shoulders visible, no glasses glare. Until a photo is chosen the service's sample face is used. Use faces you have the right to use (D-ID Studio offers licensed AI faces).</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CHARACTERS.map((c) => {
            const p = presenters[c.id];
            return (
              <div key={c.id} className="tile flex gap-3 items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p?.url} alt="" className="h-24 w-20 rounded-xl object-cover bg-panel" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="font-bold">{c.emoji} {c.name}</div>
                  <div className="text-[11px] muted">{p?.custom ? "Your photo" : "Sample face (upload one)"}</div>
                  <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => { setMsg(null); const r = await runAction(() => uploadPresenterAction(c.id, f), setMsg); if (r?.error) setMsg(r.error); router.refresh(); }); }} className="flex flex-wrap items-center gap-1.5">
                    <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-xs max-w-[11rem]" />
                    <button className="btn-primary btn-sm" disabled={pending}>Upload</button>
                    {p?.custom && <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { await clearPresenterAction(c.id); router.refresh(); })}>Remove</button>}
                  </form>
                </div>
              </div>
            );
          })}
        </div>
        {msg && <p className="text-xs">{msg}</p>}
      </section>
    </div>
  );
}
