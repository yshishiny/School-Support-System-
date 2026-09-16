"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logPrayerAction } from "@/lib/actions/prayers";
import { getPosition } from "@/lib/geo-client";
import { recordPositionAction } from "@/lib/actions/location";
import type { QueueItem } from "@/lib/today-queue";

const KIND_ICON: Record<string, string> = { prayer: "🕌", quiz: "⚡", check: "💓", checkin: "✅", recall: "🤔", review: "🔁", catchup: "⏰", learner: "🦸", snap: "📸", done: "🎉" };

/** The one big card: what to do now. A prayer logs in place; everything else links. */
export function NowCard({ item, index, total, mascot }: { item: QueueItem; index: number; total: number; mascot: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const isDone = item.kind === "done";

  function pray() {
    if (!item.prayer) return;
    start(async () => {
      const pos = await getPosition(5000);
      const r = await logPrayerAction(item.prayer!);
      if (!("error" in r && r.error)) void recordPositionAction("prayer", pos);
      setMsg("error" in r && r.error ? r.error : null);
      router.refresh();
    });
  }

  return (
    <section className="card relative overflow-hidden space-y-3" style={{ background: "linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 22%, var(--color-panel)) 0%, var(--color-panel) 70%)" }}>
      <div className="pointer-events-none absolute -right-3 -bottom-6 text-[110px] leading-none opacity-10 select-none" aria-hidden>{mascot}</div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-accent-2" style={{ fontFamily: "var(--font-display)" }}>
        {isDone ? "Today" : `Now · ${index + 1} of ${total} today`}
      </div>
      <div className="flex items-start gap-3">
        <span className="text-4xl sticker-still">{KIND_ICON[item.kind] ?? "⭐"}</span>
        <div className="min-w-0">
          <div className="h1 leading-tight">{item.title}</div>
          <div className="text-sm muted">{item.subtitle}</div>
        </div>
      </div>
      {item.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.chips.map((c) => <span key={c} className="badge">{c}</span>)}
        </div>
      )}
      <div className="flex items-center gap-2">
        {item.kind === "prayer" ? (
          <button type="button" className="btn-primary flex-1 text-base" disabled={pending} onClick={pray}>{pending ? "Saving…" : `🤲 ${item.cta}`}</button>
        ) : item.href ? (
          <Link href={item.href} className="btn-primary flex-1 text-base">{item.cta}</Link>
        ) : null}
        {!isDone && total > 1 && <span className="text-xs muted px-2">next ↓</span>}
      </div>
      {msg && <p className="text-xs text-bad">{msg}</p>}
    </section>
  );
}
