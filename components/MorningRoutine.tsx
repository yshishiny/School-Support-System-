"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { morningReadyAction } from "@/lib/actions/morning";
import { runAction } from "@/lib/client-action";
import { MORNING_BONUS, type MorningItem } from "@/lib/morning";

/** The morning card on Today: four things before the first lesson, one tap for "ready", a bonus for the full set. */
export function MorningRoutine({ items, phase, firstLesson, champion }: { items: MorningItem[]; phase: "night" | "morning"; firstLesson: string | null; champion: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const done = items.filter((x) => x.done).length;
  const shown = phase === "night" ? items.filter((x) => x.code === "sandwich" || x.code === "bag") : items;
  if (shown.length === 0) return null;
  return (
    <section className={`card space-y-2 ${champion ? "border-good" : "border-accent/60"}`}>
      <div className="flex items-center gap-2">
        <span className="text-3xl sticker-still">{phase === "night" ? "🌙" : champion ? "🏆" : "☀️"}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>{phase === "night" ? "Tonight, for tomorrow" : champion ? "Morning champion!" : `Morning routine · ${done}/${items.length}`}</div>
          <div className="text-xs muted">{phase === "night" ? "Get the sandwich and the bag done now: two snaps, two points each, and a calmer morning." : `Everything before ${firstLesson ?? "08:00"} = +${MORNING_BONUS} bonus on top of the points.`}</div>
        </div>
      </div>
      <ul className="space-y-1">
        {shown.map((x) => (
          <li key={x.code} className="flex items-center gap-2 text-sm">
            <span className={`h-6 w-6 rounded-full grid place-items-center text-xs font-bold ${x.done ? "bg-good/30 text-good" : "bg-panel-2 text-muted"}`}>{x.done ? "✓" : "·"}</span>
            <span className="text-lg">{x.emoji}</span>
            <span className={`flex-1 ${x.done ? "line-through muted" : ""}`}>{x.label}</span>
            <span className="text-xs muted">+{x.points}</span>
            {!x.done && x.href && <Link href={x.href} className="btn-ghost btn-sm">Go</Link>}
            {!x.done && x.code === "ready" && phase === "morning" && (
              <button type="button" disabled={pending} className="btn-primary btn-sm" onClick={() => start(async () => { setMsg(null); const r = await runAction(() => morningReadyAction(), setMsg); if (!r) return; if (r.error) setMsg(r.error); else { setMsg(r.champion ? `🏆 Morning champion! +${r.earned}` : `+${r.earned} · ${items.length - done - 1 > 0 ? "finish the rest for the bonus" : "well done"}`); router.refresh(); } })}>I&apos;m ready</button>
            )}
          </li>
        ))}
      </ul>
      {msg && <p className="text-xs muted">{msg}</p>}
    </section>
  );
}
