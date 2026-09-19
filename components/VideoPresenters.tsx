"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearPresenterAction, retryFailedClipsAction, setPresenterGenderAction, setVideoCapAction, setVideoModeAction, syncClipsAction, uploadPresenterAction } from "@/lib/actions/ops-video";
import { CHARACTERS } from "@/lib/characters";
import { runAction } from "@/lib/client-action";

/** Phone photos are 5-10 MB and sometimes HEIC: shrink to a 1200 px JPEG in the browser before sending. */
async function shrinkPhoto(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  if (!blob) throw new Error("no blob");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

/** Admin → Teachers: the presenter photo per character and the monthly clip cap. */
export function VideoPresenters({ enabled, presenters, cap, used, stats, mode, genders }: { enabled: boolean; presenters: Record<string, { url: string; custom: boolean }>; cap: number; used: number; stats: { done: number; pending: number; failed: number; errors: string[] }; mode: "hook_recap" | "all"; genders: Record<string, "m" | "f" | null> }) {
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
        <div className="space-y-1">
          {([["hook_recap", "Hook and recap only", "The presenter opens and closes the lesson on video; the middle beats use the animated teacher with the premium voice. About 2 clips per lesson, ~70% cheaper."], ["all", "Every line", "The presenter speaks every scripted line. 8–12 clips per lesson."]] as const).map(([id, label, blurb]) => (
            <label key={id} className={`tile flex items-start gap-2 cursor-pointer ${mode === id ? "border-accent" : ""}`}>
              <input type="radio" name="video_mode" className="mt-1" checked={mode === id} disabled={pending} onChange={() => start(async () => { await setVideoModeAction(id); router.refresh(); })} />
              <span><span className="font-semibold text-sm">{label}</span><span className="block text-xs muted">{blurb}</span></span>
            </label>
          ))}
        </div>
        <div className="text-sm flex flex-wrap items-center gap-2">
          <span className="chip">✅ {stats.done} ready</span><span className="chip">⏳ {stats.pending} rendering</span><span className="chip">❌ {stats.failed} failed</span>
          <button type="button" className="btn-ghost btn-sm" disabled={pending || !enabled} onClick={() => start(async () => { setSync(null); const r = await runAction(() => syncClipsAction(), setSync); if (r?.error) setSync(r.error); else if (r?.summary) setSync(r.summary); router.refresh(); })}>{pending ? "Checking…" : "Check renders now"}</button>
          {stats.failed > 0 && <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await runAction(() => retryFailedClipsAction(), setSync); if (r?.summary) setSync(r.summary); router.refresh(); })}>Retry failed</button>}
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
        <p className="text-xs muted"><b>Accepted:</b> JPG, PNG, WebP or a phone photo of any size — the page shrinks it to 1200 px (about 300 KB) before sending, so a 10 MB camera photo is fine. If the browser cannot read the file (some HEIC photos), you get a message with the size and what to do.</p>
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
                  <div className="flex items-center gap-1 text-xs">
                    <span className="muted">Voice:</span>
                    {(["f", "m"] as const).map((g) => { const on = (genders[c.id] ?? (c.voice.preferFemale ? "f" : "m")) === g; return <button key={g} type="button" disabled={pending} className={`chip !px-2.5 !py-0.5 ${on ? "chip-on" : ""}`} onClick={() => start(async () => { await setPresenterGenderAction(c.id, g); router.refresh(); })}>{g === "f" ? "♀ woman" : "♂ man"}</button>; })}
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => { setMsg(null); const raw = f.get("photo"); if (raw instanceof File && raw.size > 0) { const small = await shrinkPhoto(raw).catch(() => null); if (small) f.set("photo", small); else if (raw.size > 5 * 1048576) { setMsg(`${c.name}: this photo is ${(raw.size / 1048576).toFixed(1)} MB and the browser could not shrink it (probably HEIC). Export it as JPG or PNG, or pick another photo.`); return; } } const r = await runAction(() => uploadPresenterAction(c.id, f), setMsg); if (r?.error) setMsg(`${c.name}: ${r.error}`); else setMsg(`${c.name}: photo saved. New clips will use it.`); router.refresh(); }); }} className="flex flex-wrap items-center gap-1.5">
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
