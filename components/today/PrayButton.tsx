"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logPrayerAction } from "@/lib/actions/prayers";
import { getPosition } from "@/lib/geo-client";
import { recordPositionAction } from "@/lib/actions/location";
import type { PrayerName } from "@/lib/prayers";

export function PrayButton({ prayer, label, className = "btn-primary btn-sm" }: { prayer: PrayerName; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const log = (atMosque: boolean) => start(async () => {
    // Saved first: waiting on the location permission prompt before the tap does anything reads as a dead button.
    const r = await logPrayerAction(prayer, atMosque);
    const failed = "error" in r && r.error ? r.error : null;
    setErr(failed);
    if (!failed) void getPosition(5000).then((pos) => recordPositionAction("prayer", pos)).catch(() => null);
    router.refresh();
  });
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex flex-wrap items-center justify-end gap-1">
        {/* The mosque comes first: it is the one worth extra, so it should be the easier tap. */}
        <button type="button" className={className} disabled={pending} onClick={() => log(true)} title="Prayed in congregation at the mosque">
          {pending ? "…" : `🕌 ${label.replace(/^🤲\s*/, "")}`}
        </button>
        <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => log(false)} title="Prayed at home">
          at home
        </button>
      </span>
      {err && <span className="text-[11px] text-bad">{err}</span>}
    </span>
  );
}
