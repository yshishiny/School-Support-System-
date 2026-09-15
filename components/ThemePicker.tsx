"use client";

import { useState, useTransition } from "react";
import { setThemeAction } from "@/lib/actions/theme";
import { THEMES, type ThemeGroup } from "@/lib/themes";

const GROUPS: { id: ThemeGroup; label: string }[] = [
  { id: "club", label: "⚽ Clubs" },
  { id: "career", label: "🎯 Future career" },
  { id: "classic", label: "✨ Classic" },
];

export function ThemePicker({ current }: { current: string }) {
  const [selected, setSelected] = useState(current);
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="h2">🎨 My theme</h2>
        {pending && <span className="text-xs muted">Applying…</span>}
      </div>
      {GROUPS.map((g) => (
        <div key={g.id}>
          <div className="text-sm font-semibold mb-2">{g.label}</div>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.filter((t) => t.group === g.id).map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={pending}
                onClick={() => {
                  setSelected(t.id);
                  start(async () => {
                    await setThemeAction(t.id);
                  });
                }}
                className={`rounded-xl border p-2 text-left transition ${selected === t.id ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-accent/60"}`}
                style={{ background: `linear-gradient(135deg, ${t.vars.panel2}, ${t.vars.bg})`, color: t.vars.ink }}
              >
                <div className="text-2xl">{t.emoji}</div>
                <div className="text-xs font-bold leading-tight mt-1">{t.name}</div>
                <div className="flex gap-1 mt-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.vars.accent }} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.vars.accent2 }} />
                  <span className="h-2.5 w-2.5 rounded-full border border-white/20" style={{ background: t.vars.panel }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
