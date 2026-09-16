"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHomeLayoutAction } from "@/lib/actions/theme";
import type { HomeLayout } from "@/components/today/types";

const OPTIONS: { id: HomeLayout; name: string; blurb: string; sketch: React.ReactNode }[] = [
  { id: "a", name: "Three things", blurb: "Your day as three big rows, the first one in gold.", sketch: <div className="space-y-1"><div className="h-5 rounded-md bg-panel-2" /><div className="h-4 rounded-md bg-accent/70" /><div className="h-4 rounded-md bg-panel-2" /><div className="h-4 rounded-md bg-panel-2" /></div> },
  { id: "b", name: "One thing now", blurb: "One big card for what to do now, then a short list.", sketch: <div className="space-y-1"><div className="h-3 rounded-md bg-panel-2" /><div className="h-10 rounded-md bg-accent/70" /><div className="h-3 rounded-md bg-panel-2" /><div className="h-3 rounded-md bg-panel-2" /></div> },
  { id: "c", name: "Picture & tiles", blurb: "Your hero picture on top, four tiles below.", sketch: <div className="space-y-1"><div className="h-8 rounded-md bg-accent-2/50" /><div className="grid grid-cols-2 gap-1"><div className="h-4 rounded-md bg-panel-2" /><div className="h-4 rounded-md bg-panel-2" /><div className="h-4 rounded-md bg-panel-2" /><div className="h-4 rounded-md bg-panel-2" /></div></div> },
];

export function HomeLayoutPicker({ current }: { current: HomeLayout }) {
  const router = useRouter();
  const [sel, setSel] = useState<HomeLayout>(current);
  const [pending, start] = useTransition();
  return (
    <section id="layout" className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="h2">🏠 My home page</h2>
        {pending && <span className="text-xs muted">Applying…</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <button key={o.id} type="button" disabled={pending} onClick={() => { setSel(o.id); start(async () => { await setHomeLayoutAction(o.id); router.refresh(); }); }} className={`tile text-left space-y-2 ${sel === o.id ? "border-accent ring-2 ring-accent/40" : ""}`}>
            <div className="rounded-lg bg-bg/60 p-1.5">{o.sketch}</div>
            <div className="text-xs font-bold" style={{ fontFamily: "var(--font-display)" }}>{o.name}</div>
            <div className="text-[11px] muted leading-snug">{o.blurb}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
