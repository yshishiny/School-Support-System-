"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logPrayerAction } from "@/lib/actions/prayers";
import type { PrayerName } from "@/lib/prayers";

export function PrayButton({ prayer, label, className = "btn-primary btn-sm" }: { prayer: PrayerName; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" className={className} disabled={pending} onClick={() => start(async () => { const r = await logPrayerAction(prayer); setErr("error" in r && r.error ? r.error : null); router.refresh(); })}>
        {pending ? "…" : label}
      </button>
      {err && <span className="text-[11px] text-bad">{err}</span>}
    </span>
  );
}
