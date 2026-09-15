"use client";

import { useState, useTransition } from "react";
import { logPrayerAction } from "@/lib/actions/prayers";
import { PRAYER_LABEL, type PrayerName, type PrayerState, type PrayerStatus } from "@/lib/prayers";

export interface PrayerRow {
  prayer: PrayerName;
  time: string; // HH:mm local
  state: PrayerState;
  logged: PrayerStatus | null;
}

export function PrayerCard({ rows, onTimeCount }: { rows: PrayerRow[]; onTimeCount: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<PrayerName | null>(null);

  return (
    <section className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="h2">🕌 Prayers</h2>
        <span className="text-xs muted">{onTimeCount}/5 on time · +3 on time, +1 late, +10 for all five</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.prayer} className="py-2 flex items-center gap-3">
            <span className="w-20 font-medium">{PRAYER_LABEL[r.prayer]}</span>
            <span className="muted text-sm w-12">{r.time}</span>
            <span className="flex-1" />
            {r.logged === "on_time" && <span className="badge text-good">✓ on time</span>}
            {r.logged === "late" && <span className="badge text-warn">✓ late</span>}
            {!r.logged && r.state === "not_yet" && <span className="badge muted">not yet</span>}
            {!r.logged && r.state !== "not_yet" && (
              <button
                type="button"
                disabled={pending}
                className={`btn-sm ${r.state === "open" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => {
                  setBusy(r.prayer);
                  setMsg(null);
                  start(async () => {
                    const res = await logPrayerAction(r.prayer);
                    setBusy(null);
                    setMsg(res.error ?? `${PRAYER_LABEL[r.prayer]} ${res.status === "on_time" ? "on time" : "logged late"} · +${res.earned}`);
                  });
                }}
              >
                {busy === r.prayer ? "…" : r.state === "open" ? "Prayed ✓" : "Prayed (late)"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {msg && <p className="text-xs muted">{msg}</p>}
    </section>
  );
}
