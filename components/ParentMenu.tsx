"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: { href: string; label: string; emoji: string; color: string; group: string }[] = [
  { href: "/parent", label: "Home", emoji: "🏠", color: "#3a86ff", group: "Today" },
  { href: "/parent/notifications", label: "Inbox", emoji: "🔔", color: "#f15bb5", group: "Today" },
  { href: "/parent/children", label: "Kids", emoji: "🧒", color: "#ff6b6b", group: "Today" },
  { href: "/parent/assignments", label: "Tasks", emoji: "📝", color: "#ffbe0b", group: "Today" },
  { href: "/parent/plan", label: "Quiz plan", emoji: "📅", color: "#2ec4b6", group: "Learning" },
  { href: "/parent/progress", label: "Progress", emoji: "🧠", color: "#8338ec", group: "Learning" },
  { href: "/parent/materials", label: "School files", emoji: "📎", color: "#fb5607", group: "Learning" },
  { href: "/parent/import", label: "Import", emoji: "💬", color: "#06d6a0", group: "Learning" },
  { href: "/parent/allowance", label: "Allowance", emoji: "💵", color: "#ffd166", group: "Fairness" },
  { href: "/parent/snaps", label: "Snaps", emoji: "📸", color: "#ef476f", group: "Fairness" },
  { href: "/parent/rewards", label: "Rewards", emoji: "🎁", color: "#118ab2", group: "Fairness" },
  { href: "/parent/reports", label: "Reports", emoji: "📨", color: "#073b4c", group: "Family" },
  { href: "/parent/guide", label: "Guide", emoji: "❓", color: "#9b5de5", group: "Family" },
  { href: "/parent/settings", label: "More", emoji: "⚙️", color: "#6c757d", group: "Family" },
];

/** The parent's menu: a colourful column on the left on wide screens, a scrolling strip at the top on phones. */
export function ParentMenu({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || (href !== "/parent" && path.startsWith(href));
  const groups = [...new Set(ITEMS.map((i) => i.group))];
  return (
    <nav className="sm:sticky sm:top-3 sm:self-start" aria-label="Parent sections">
      {/* phone: one scrolling strip */}
      <div className="sm:hidden -mx-4 px-4 flex gap-2 overflow-x-auto pb-2 sticky top-0 z-20 bg-bg/90 backdrop-blur pt-1">
        {ITEMS.map((it) => {
          const on = isActive(it.href);
          return (
            <Link key={it.href} href={it.href} className={`shrink-0 rounded-2xl border-2 px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition ${on ? "-translate-y-0.5 shadow-lg text-ink" : "text-muted"}`} style={{ borderColor: it.color, background: on ? `${it.color}40` : `${it.color}14`, fontFamily: "var(--font-display)" }}>
              <span className="text-lg">{it.emoji}</span>{it.label}
              {it.href === "/parent/notifications" && unread > 0 && <span className="rounded-full bg-bad text-white text-[10px] px-1.5 py-0.5 leading-none">{unread}</span>}
            </Link>
          );
        })}
      </div>
      {/* desktop: grouped column */}
      <div className="hidden sm:flex flex-col gap-3 w-44">
        {groups.map((g) => (
          <div key={g} className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide muted px-1">{g}</div>
            {ITEMS.filter((i) => i.group === g).map((it) => {
              const on = isActive(it.href);
              return (
                <Link key={it.href} href={it.href} className={`w-full rounded-2xl border-2 px-3 py-2 flex items-center gap-2 transition ${on ? "-translate-y-0.5 shadow-lg" : "opacity-85 hover:opacity-100"}`} style={{ borderColor: it.color, background: on ? `${it.color}40` : `${it.color}14` }}>
                  <span className="text-xl">{it.emoji}</span>
                  <span className="font-bold text-sm flex-1" style={{ fontFamily: "var(--font-display)" }}>{it.label}</span>
                  {it.href === "/parent/notifications" && unread > 0 && <span className="rounded-full bg-bad text-white text-[10px] px-1.5 py-0.5 leading-none">{unread}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
