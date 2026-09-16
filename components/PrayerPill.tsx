"use client";

import { useEffect, useState, useTransition } from "react";
import { logPastPrayerAction, logPrayerAction } from "@/lib/actions/prayers";
import { getPosition } from "@/lib/geo-client";
import { recordPositionAction } from "@/lib/actions/location";
import { PRAYER_LABEL, type PastClaim, type PrayerName, type PrayerState, type PrayerStatus } from "@/lib/prayers";

export interface PrayerRow {
  prayer: PrayerName;
  time: string; // HH:mm local
  startMs: number;
  state: PrayerState;
  logged: PrayerStatus | null;
  enteredLate?: boolean;
}

function countdown(ms: number): string {
  if (ms <= 0) return "now";
  const m = Math.round(ms / 60000);
  if (m < 60) return `in ${m}m`;
  return `in ${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Small pill, top-right: previous prayer status and the next one, tap to expand. */
export function PrayerPill({ rows, onTimeCount, yesterday = [], today = "", yesterdayDate = "" }: { rows: PrayerRow[]; onTimeCount: number; yesterday?: PrayerRow[]; today?: string; yesterdayDate?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const current = rows.find((r) => r.state === "open");
  const prev = [...rows].reverse().find((r) => r.startMs <= now);
  const next = rows.find((r) => r.startMs > now);
  const due = current && !current.logged ? current : null;

  const logPast = (prayer: PrayerName, date: string, claim: PastClaim) => {
    setMsg(null);
    start(async () => {
      const res = await logPastPrayerAction(prayer, date, claim);
      setMsg(res.error ?? `${PRAYER_LABEL[prayer]} ${claim === "on_time" ? "on time" : claim === "late" ? "late" : "missed"} · +${res.earned}`);
    });
  };
  const PastButtons = ({ prayer, date }: { prayer: PrayerName; date: string }) => (
    <span className="inline-flex gap-1">
      <button type="button" disabled={pending} onClick={() => logPast(prayer, date, "on_time")} className="chip !py-0.5 text-[11px]" title="I prayed it on time (e.g. at school)">On time</button>
      <button type="button" disabled={pending} onClick={() => logPast(prayer, date, "late")} className="chip !py-0.5 text-[11px]">Late</button>
      <button type="button" disabled={pending} onClick={() => logPast(prayer, date, "missed")} className="chip !py-0.5 text-[11px]">Missed</button>
    </span>
  );
  const log = (prayer: PrayerName) => {
    setMsg(null);
    start(async () => {
      const pos = await getPosition(5000);
      const res = await logPrayerAction(prayer);
      if (!("error" in res && res.error)) void recordPositionAction("prayer", pos);
      setMsg(res.error ?? `${PRAYER_LABEL[prayer]} ${res.status === "on_time" ? "on time" : "late"} · +${res.earned}`);
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${due ? "border-accent bg-accent/15 pulse" : "border-line bg-panel-2"}`}
        title="Prayers"
      >
        <span>🕌</span>
        {due ? (
          <span className="font-semibold">{PRAYER_LABEL[due.prayer]} now</span>
        ) : (
          <>
            {prev && (
              <span className={prev.logged === "on_time" ? "text-good" : prev.logged === "late" ? "text-warn" : "text-bad"}>
                {prev.logged ? "✓" : "✗"} {PRAYER_LABEL[prev.prayer]}
              </span>
            )}
            {next && <span className="muted">· {PRAYER_LABEL[next.prayer]} {next.time}</span>}
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 card shadow-2xl space-y-1">
          <div className="flex items-center justify-between text-xs muted mb-1">
            <span>{onTimeCount}/5 on time today</span>
            <span>+3 · +1 late · +10 all five</span>
          </div>
          {rows.map((r) => (
            <div key={r.prayer} className="flex items-center gap-2 py-1 text-sm">
              <span className="w-16 font-medium">{PRAYER_LABEL[r.prayer]}</span>
              <span className="muted w-11">{r.time}</span>
              <span className="flex-1 text-right">
                {r.logged === "on_time" && <span className="text-good">✓ on time{r.enteredLate ? " (later)" : ""}</span>}
                {r.logged === "late" && <span className="text-warn">✓ late</span>}
                {r.logged === "missed" && <span className="text-bad">✗ missed</span>}
                {!r.logged && r.state === "not_yet" && <span className="muted">{countdown(r.startMs - now)}</span>}
                {!r.logged && r.state === "open" && (
                  <button type="button" disabled={pending} onClick={() => log(r.prayer)} className="btn-sm btn-primary">Prayed ✓</button>
                )}
                {!r.logged && r.state === "late_only" && <PastButtons prayer={r.prayer} date={today} />}
              </span>
            </div>
          ))}
          {yesterday.some((r) => !r.logged) && (
            <div className="pt-1 border-t border-line">
              <div className="text-xs muted mb-1">Yesterday · say it honestly</div>
              {yesterday.filter((r) => !r.logged).map((r) => (
                <div key={r.prayer} className="flex items-center gap-2 py-1 text-sm">
                  <span className="w-16 font-medium">{PRAYER_LABEL[r.prayer]}</span>
                  <span className="flex-1 text-right"><PastButtons prayer={r.prayer} date={yesterdayDate} /></span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] muted pt-1">Missed the moment? On time at school +3 · on time elsewhere +2 · late +1 · missed but honest +1.</p>
          {msg && <p className="text-xs muted pt-1">{msg}</p>}
        </div>
      )}
    </div>
  );
}
