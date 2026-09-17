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
  { href: "/parent/allowance", label: "Allowance", emoji: "💵", color: "#e0a800", group: "Fairness" },
  { href: "/parent/snaps", label: "Snaps", emoji: "📸", color: "#ef476f", group: "Fairness" },
  { href: "/parent/rewards", label: "Rewards", emoji: "🎁", color: "#118ab2", group: "Fairness" },
  { href: "/parent/reports", label: "Reports", emoji: "📨", color: "#0e7c86", group: "Family" },
  { href: "/parent/guide", label: "Guide", emoji: "❓", color: "#9b5de5", group: "Family" },
  { href: "/parent/settings", label: "More", emoji: "⚙️", color: "#6c757d", group: "Family" },
];

/**
 * The parent's menu. Wide screens: one quiet panel, items grouped, each with a small coloured icon disc; the
 * current page gets a soft fill and a colour bar. Phones: a compact scrolling strip at the top.
 */
export function ParentMenu({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || (href !== "/parent" && path.startsWith(href));
  const groups = [...new Set(ITEMS.map((i) => i.group))];
  const Badge = ({ n }: { n: number }) => (n > 0 ? <span className="ml-auto rounded-full bg-bad text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{n}</span> : null);
  return (
    <nav className="sm:sticky sm:top-3 sm:self-start" aria-label="Parent sections">
      {/* phone: one scrolling strip */}
      <div className="sm:hidden -mx-4 px-4 flex gap-1.5 overflow-x-auto pb-2 sticky top-0 z-20 bg-bg/90 backdrop-blur pt-1">
        {ITEMS.map((it) => {
          const on = isActive(it.href);
          return (
            <Link key={it.href} href={it.href} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 transition border ${on ? "text-ink border-transparent" : "text-muted border-line bg-panel"}`} style={{ background: on ? `${it.color}33` : undefined, fontFamily: "var(--font-display)" }}>
              <span className="text-base leading-none">{it.emoji}</span>{it.label}
              {it.href === "/parent/notifications" && unread > 0 && <span className="rounded-full bg-bad text-white text-[9px] px-1 leading-3">{unread}</span>}
            </Link>
          );
        })}
      </div>
      {/* desktop: one panel, grouped rows */}
      <div className="hidden sm:block w-48 rounded-2xl border border-line bg-panel p-2 space-y-2">
        {groups.map((g) => (
          <div key={g}>
            <div className="text-[10px] uppercase tracking-wider muted px-2 pt-1 pb-0.5">{g}</div>
            <ul className="space-y-0.5">
              {ITEMS.filter((i) => i.group === g).map((it) => {
                const on = isActive(it.href);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={on ? "page" : undefined}
                      className={`relative flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition ${on ? "text-ink" : "text-muted hover:text-ink hover:bg-panel-2"}`}
                      style={on ? { background: `${it.color}1f` } : undefined}
                    >
                      {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r" style={{ background: it.color }} />}
                      <span className="grid place-items-center h-7 w-7 rounded-lg text-base leading-none shrink-0" style={{ background: `${it.color}${on ? "40" : "22"}` }}>{it.emoji}</span>
                      <span className={`text-sm ${on ? "font-bold" : "font-semibold"}`} style={{ fontFamily: "var(--font-display)" }}>{it.label}</span>
                      {it.href === "/parent/notifications" && <Badge n={unread} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
