"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface SideTab { id: string; label: string; emoji: string; color: string; sub?: string; content: ReactNode; avatarUrl?: string | null }

/**
 * A colourful vertical menu on the left (a scrolling strip on phones) with one panel on the right.
 * Every panel stays mounted; the chosen tab is remembered per storageKey and can be preset with ?tab=.
 */
export function SideTabs({ tabs, storageKey }: { tabs: SideTab[]; storageKey: string }) {
  const [active, setActive] = useState(tabs[0]?.id);
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("tab");
      const saved = fromUrl ?? sessionStorage.getItem(`side:${storageKey}`);
      if (saved && tabs.some((t) => t.id === saved)) setActive(saved);
    } catch { /* ignore */ }
  }, [storageKey, tabs]);
  function choose(id: string) {
    setActive(id);
    try { sessionStorage.setItem(`side:${storageKey}`, id); } catch { /* ignore */ }
  }
  return (
    <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
      <nav className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 -mx-1 px-1 sm:sticky sm:top-3 sm:self-start" role="tablist">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => choose(t.id)} className={`shrink-0 sm:w-full text-left rounded-2xl border-2 px-3 py-2 transition flex items-center gap-2 ${on ? "-translate-y-0.5 shadow-lg" : "opacity-85 hover:opacity-100"}`} style={{ borderColor: t.color, background: on ? `${t.color}33` : `${t.color}14` }}>
              {t.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover border-2" style={{ borderColor: t.color }} />
              ) : <span className="text-2xl">{t.emoji}</span>}
              <span className="min-w-0"><span className="block font-bold leading-tight truncate" style={{ fontFamily: "var(--font-display)" }}>{t.label}</span>{t.sub && <span className="block text-[11px] muted truncate">{t.sub}</span>}</span>
            </button>
          );
        })}
      </nav>
      <div>
        {tabs.map((t) => (
          <div key={t.id} role="tabpanel" hidden={t.id !== active} className={t.id === active ? "pop space-y-3" : undefined}>{t.content}</div>
        ))}
      </div>
    </div>
  );
}
