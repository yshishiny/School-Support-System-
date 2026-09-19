"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { logPastPrayerAction, logPrayerAction } from "@/lib/actions/prayers";
import { getPosition } from "@/lib/geo-client";
import { recordPositionAction } from "@/lib/actions/location";
import { PRAYER_LABEL, type PastClaim, type PrayerName, type PrayerState, type PrayerStatus } from "@/lib/prayers";

export interface PrayerRow {
  prayer: PrayerName;
  time: string; // HH:mm local
  startMs: number;
  /** When the window closes: after this, praying counts as late. */
  endMs: number;
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

/**
 * The window a row is in *now*, not when the page was rendered: the page is left open for hours on a phone, and a
 * server-rendered state would leave the child looking at a countdown long after the prayer had come in.
 */
function stateNow(r: PrayerRow, now: number): PrayerState {
  if (!r.endMs) return r.state;
  if (now < r.startMs) return "not_yet";
  if (now < r.endMs) return "open";
  return "late_only";
}

/** Small pill, top-right: previous prayer status and the next one, tap to open the sheet. */
export function PrayerPill({ rows, onTimeCount, yesterday = [], today = "", yesterdayDate = "" }: { rows: PrayerRow[]; onTimeCount: number; yesterday?: PrayerRow[]; today?: string; yesterdayDate?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);
  // While the sheet is up it owns the screen: the page behind it must not scroll under the child's finger.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const current = rows.find((r) => stateNow(r, now) === "open");
  const prev = [...rows].reverse().find((r) => r.startMs <= now);
  const next = rows.find((r) => r.startMs > now);
  const due = current && !current.logged ? current : null;

  const logPast = (prayer: PrayerName, date: string, claim: PastClaim) => {
    setMsg(null);
    setBusy(`${date}:${prayer}:${claim}`);
    start(async () => {
      try {
        const res = await logPastPrayerAction(prayer, date, claim);
        setMsg(res.error ?? `${PRAYER_LABEL[prayer]} ${claim === "on_time" ? "on time" : claim === "late" ? "late" : "missed"} · +${res.earned}`);
      } catch {
        setMsg("That did not save. Check the connection and try again.");
      } finally {
        setBusy(null);
      }
    });
  };
  const log = (prayer: PrayerName, atMosque = false) => {
    setMsg(null);
    setBusy(`now:${prayer}:${atMosque ? "mosque" : "home"}`);
    start(async () => {
      try {
        // The prayer is saved first: asking the phone for its position can sit behind a permission prompt for
        // seconds, and a tap that does nothing for that long reads as broken.
        const res = await logPrayerAction(prayer, atMosque);
        setMsg(res.error ?? `${PRAYER_LABEL[prayer]} ${res.status === "on_time" ? "on time" : "late"}${atMosque ? " at the mosque 🕌" : ""} · +${res.earned}`);
        if (!res.error) void getPosition(5000).then((pos) => recordPositionAction("prayer", pos)).catch(() => null);
      } catch {
        setMsg("That did not save. Check the connection and try again.");
      } finally {
        setBusy(null);
      }
    });
  };

  // Plain functions, not components declared in the body: a component defined here is a new type on every render,
  // so React would throw the rows away and rebuild them on each clock tick — and a button replaced between a
  // finger going down and coming up never fires its tap.
  const pastButtons = (prayer: PrayerName, date: string) => {
    const label = (claim: PastClaim, text: string) => (busy === `${date}:${prayer}:${claim}` ? "…" : text);
    return (
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button type="button" disabled={pending} onClick={() => logPast(prayer, date, "on_time")} className="btn-ghost min-h-11 !px-1 text-xs" title="I prayed it on time (for example at school)">{label("on_time", "On time")}</button>
        <button type="button" disabled={pending} onClick={() => logPast(prayer, date, "late")} className="btn-ghost min-h-11 !px-1 text-xs">{label("late", "Late")}</button>
        <button type="button" disabled={pending} onClick={() => logPast(prayer, date, "missed")} className="btn-ghost min-h-11 !px-1 text-xs !text-bad">{label("missed", "Missed")}</button>
      </div>
    );
  };

  const row = (r: PrayerRow, date: string, key: string) => {
    const state = stateNow(r, now);
    return (
      <div key={key} className="rounded-xl bg-panel-2/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{PRAYER_LABEL[r.prayer]}</span>
          <span className="muted text-sm tabular-nums">{r.time}</span>
          <span className="flex-1 text-right text-sm">
            {r.logged === "on_time" && <span className="text-good">✓ on time{r.enteredLate ? " (later)" : ""}</span>}
            {r.logged === "late" && <span className="text-warn">✓ late</span>}
            {r.logged === "missed" && <span className="text-bad">✗ missed</span>}
            {!r.logged && state === "not_yet" && <span className="muted">{countdown(r.startMs - now)}</span>}
          </span>
        </div>
        {!r.logged && state === "open" && (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button type="button" disabled={pending} onClick={() => log(r.prayer, true)} className="btn-primary min-h-12">{busy === `now:${r.prayer}:mosque` ? "…" : "🕌 At the mosque"}</button>
            <button type="button" disabled={pending} onClick={() => log(r.prayer, false)} className="btn-ghost min-h-12">{busy === `now:${r.prayer}:home` ? "…" : "At home ✓"}</button>
          </div>
        )}
        {!r.logged && state === "late_only" && pastButtons(r.prayer, date)}
      </div>
    );
  };

  const missedYesterday = yesterday.filter((r) => !r.logged);

  const sheet = (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Prayers">
      <button type="button" aria-label="Close" className="absolute inset-0 w-full bg-black/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85vh] sm:rounded-3xl">
        <div className="flex max-h-[88svh] flex-col rounded-t-3xl border border-line bg-panel shadow-2xl sm:max-h-[85vh] sm:rounded-3xl">
          <div className="shrink-0 px-4 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
            <div className="flex items-center gap-2">
              <span className="text-xl">🕌</span>
              <div className="flex-1">
                <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>Prayers</div>
                <div className="text-xs muted">{onTimeCount}/5 on time today · +3 each · +10 all five · +20 all five at the mosque · +25 a week of Fajr there</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm min-h-10 px-3" aria-label="Close">✕</button>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3">
            {rows.map((r) => row(r, today, r.prayer))}
            {missedYesterday.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs muted">Yesterday · say it honestly</div>
                {missedYesterday.map((r) => row({ ...r, state: "late_only", endMs: 0 }, yesterdayDate, `y-${r.prayer}`))}
              </div>
            )}
            <p className="text-[11px] muted">Missed the moment? On time at school +3 · on time elsewhere +2 · late +1 · missed but honest +1.</p>
          </div>
          {msg && <div className="shrink-0 border-t border-line px-4 py-2 text-sm">{msg}</div>}
          <div className="shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost w-full min-h-11">Close</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
      {/* A portal, because the pill sits inside cards that clip their overflow: anchored here the panel was cut off. */}
      {open && mounted && createPortal(sheet, document.body)}
    </>
  );
}
