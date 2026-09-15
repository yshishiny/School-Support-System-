"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface TabDef {
  id: string;
  label: string;
  emoji: string;
  badge?: string | number | null;
  content: ReactNode;
}

/**
 * Pill tabs that keep every panel mounted (server-rendered) and just show one. The chosen tab is remembered
 * per `storageKey` in sessionStorage and can be preset with ?tab=<id> in the URL.
 */
export function Tabs({ tabs, storageKey, defaultId, size = "md" }: { tabs: TabDef[]; storageKey: string; defaultId?: string; size?: "md" | "sm" }) {
  const [active, setActive] = useState(defaultId ?? tabs[0]?.id);
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("tab");
      const saved = fromUrl ?? sessionStorage.getItem(`tabs:${storageKey}`);
      if (saved && tabs.some((t) => t.id === saved)) setActive(saved);
    } catch {
      /* storage unavailable */
    }
  }, [storageKey, tabs]);
  function choose(id: string) {
    setActive(id);
    try {
      sessionStorage.setItem(`tabs:${storageKey}`, id);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="space-y-3">
      <div className={`flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 ${size === "sm" ? "" : "sticky top-0 z-10 py-1 bg-bg/80 backdrop-blur rounded-2xl"}`} role="tablist">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => choose(t.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 font-bold transition ${size === "sm" ? "px-3 py-1 text-xs" : "px-3.5 py-2 text-sm"} ${on ? "border-accent bg-accent/20 text-accent-2 -translate-y-0.5" : "border-line bg-panel text-muted hover:border-accent/60"}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              <span className={size === "sm" ? "text-base" : "text-lg"}>{t.emoji}</span>
              {t.label}
              {t.badge !== undefined && t.badge !== null && t.badge !== 0 && <span className="rounded-full bg-accent text-white text-[10px] px-1.5 py-0.5 leading-none">{t.badge}</span>}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={t.id !== active} className={t.id === active ? "pop space-y-3" : undefined}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
