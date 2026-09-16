"use client";

import { useOptimistic, useTransition } from "react";
import { tickKpiAction } from "@/lib/actions/allowance";
import type { KpiDef } from "@/lib/allowance";

/** The parent's three taps a day per child: ✓ or ✗ per parent-judged KPI. Tap again to clear. */
export function KpiTicks({ studentId, kpis, ticks }: { studentId: string; kpis: KpiDef[]; ticks: Record<string, boolean> }) {
  const [state, setState] = useOptimistic(ticks);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5">
      {kpis.filter((k) => k.source === "parent" && k.enabled).map((k) => {
        const v = state[k.code];
        return (
          <div key={k.code} className="tile flex items-center gap-1.5 py-1.5 px-2.5">
            <span className="text-base">{k.emoji}</span>
            <span className="text-xs font-semibold max-w-[8rem] truncate">{k.label}</span>
            {[true, false].map((val) => (
              <button
                key={String(val)}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setState({ ...state, [k.code]: v === val ? (undefined as unknown as boolean) : val });
                    await tickKpiAction(studentId, k.code, val);
                  })
                }
                className={`h-7 w-7 rounded-full border-2 text-sm font-bold transition ${v === val ? (val ? "bg-good/30 border-good" : "bg-bad/30 border-bad") : "border-line opacity-60 hover:opacity-100"}`}
                aria-label={val ? "done" : "not done"}
              >
                {val ? "✓" : "✗"}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
