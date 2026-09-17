"use client";

import { useEffect, useState } from "react";
import { liveFeedAction, type LiveSnapshot } from "@/lib/actions/live";

function hhmm(iso: string, tz: string): string {
  try { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso)); } catch { return iso.slice(11, 16); }
}

/** Live panel on the parent home: who is online and what happened, refreshed every 30 seconds while the page is visible. */
export function LiveFeed({ initial, tz }: { initial: LiveSnapshot; tz: string }) {
  const [snap, setSnap] = useState(initial);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = async () => { if (document.visibilityState !== "visible") return; try { setSnap(await liveFeedAction()); } catch { /* keep the last snapshot */ } };
    timer = setInterval(tick, 30000);
    const onVis = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  const online = snap.kids.filter((k) => k.online);
  const latest = snap.events.slice(0, open ? 30 : 4);
  return (
    <section className="card !py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="relative flex h-2.5 w-2.5"><span className={`absolute inline-flex h-full w-full rounded-full ${online.length ? "bg-good animate-ping" : "bg-line"}`} /><span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online.length ? "bg-good" : "bg-line"}`} /></span>
        <span className="font-semibold">Live</span>
        <span className="muted text-xs flex-1 truncate">{online.length ? online.map((k) => `${k.name} ${k.label}`).join(" · ") : snap.kids.map((k) => `${k.name} ${k.label || "not seen yet"}`).join(" · ")}</span>
        <span className="text-[10px] muted">{hhmm(snap.at, tz)}</span>
      </div>
      {latest.length > 0 ? (
        <ul className="text-xs space-y-0.5">
          {latest.map((e, i) => <li key={i}><span className="muted">{hhmm(e.at, tz)}</span> {e.icon} <b>{e.name}</b> {e.text}</li>)}
        </ul>
      ) : <p className="text-xs muted">Nothing in the last 24 hours.</p>}
      {snap.events.length > 4 && <button type="button" className="text-xs muted underline" onClick={() => setOpen((o) => !o)}>{open ? "Show less" : `Show all ${snap.events.length}`}</button>}
    </section>
  );
}
