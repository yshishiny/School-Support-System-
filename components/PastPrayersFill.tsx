"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logPastPrayerAction } from "@/lib/actions/prayers";
import { runAction } from "@/lib/client-action";
import type { PrayerName } from "@/lib/prayers";

export interface PastDay { date: string; label: string; missing: PrayerName[] }
const NAME: Record<PrayerName, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

/** Past days of the allowance week with prayers not logged: three honest buttons per prayer. */
export function PastPrayersFill({ days }: { days: PastDay[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const log = (date: string, prayer: PrayerName, claim: "on_time" | "late" | "missed") =>
    start(async () => {
      setMsg(null);
      const r = await runAction(() => logPastPrayerAction(prayer, date, claim), setMsg);
      if (!r) return;
      if (r.error) { setMsg(r.error); return; }
      setDone((s) => new Set(s).add(`${date}:${prayer}`));
      router.refresh();
    });
  return (
    <div className="space-y-2">
      {days.map((d) => (
        <div key={d.date} className="tile space-y-1.5">
          <div className="text-sm font-semibold">{d.label} <span className="muted font-normal text-xs">· {d.missing.length} not logged</span></div>
          {d.missing.filter((p) => !done.has(`${d.date}:${p}`)).map((p) => (
            <div key={p} className="rounded-xl bg-panel-2/60 p-2 space-y-1.5">
              <div className="text-xs font-semibold">{NAME[p]}</div>
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" disabled={pending} className="btn-ghost min-h-11 !px-1 text-xs" onClick={() => log(d.date, p, "on_time")}>On time</button>
                <button type="button" disabled={pending} className="btn-ghost min-h-11 !px-1 text-xs" onClick={() => log(d.date, p, "late")}>Late</button>
                <button type="button" disabled={pending} className="btn-ghost min-h-11 !px-1 text-xs !text-bad" onClick={() => log(d.date, p, "missed")}>Missed</button>
              </div>
            </div>
          ))}
        </div>
      ))}
      {msg && <p className="text-xs text-bad">{msg}</p>}
      <p className="text-xs muted">Every prayer you fill in later asks for a small balance: read two ayahs and answer one question right. Then it counts for the allowance.</p>
    </div>
  );
}
