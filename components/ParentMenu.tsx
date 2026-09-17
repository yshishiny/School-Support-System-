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
  { href: "/parent/manners", label: "Manners", emoji: "🤝", color: "#f77f00", group: "Fairness" },
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
/** Phone: five big buttons at the bottom, like the kids' app. Everything else lives under More. */
export function ParentPhoneBar({ unread = 0 }: { unread?: number }) {
  const path = usePathname();
  const items = [
    { href: "/parent", label: "Home", emoji: "🏠" },
    { href: "/parent/notifications", label: "Inbox", emoji: "🔔", badge: unread },
    { href: "/parent/children", label: "Kids", emoji: "🧒" },
    { href: "/parent/allowance", label: "Allowance", emoji: "💵" },
    { href: "/parent/settings", label: "More", emoji: "⚙️" },
  ];
  const active = (href: string) => (href === "/parent" ? path === "/parent" : href === "/parent/settings" ? !items.slice(0, 4).some((i) => path.startsWith(i.href)) && path.startsWith("/parent") : path.startsWith(href));
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-panel/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Parent sections">
      <ul className="flex">
        {items.map((it) => (
          <li key={it.href} className="flex-1 min-w-0">
            <Link href={it.href} className={`relative flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold ${active(it.href) ? "text-accent-2" : "text-muted"}`} style={{ fontFamily: "var(--font-display)" }}>
              <span className={`text-2xl leading-none rounded-2xl px-3 py-1 ${active(it.href) ? "bg-accent/20 -translate-y-0.5" : ""}`}>{it.emoji}</span>
              {it.label}
              {!!it.badge && <span className="absolute top-0 right-1/4 rounded-full bg-bad text-white text-[10px] font-bold px-1.5 leading-4">{it.badge}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const PARENT_SECTIONS = ITEMS;

export function ParentMenu({ unread = 0, isAdmin = false, openErrors = 0 }: { unread?: number; isAdmin?: boolean; openErrors?: number }) {
  const path = usePathname();
  const isActive = (href: string) => path === href || (href !== "/parent" && path.startsWith(href));
  const items = isAdmin ? [...ITEMS, { href: "/parent/admin", label: "Admin", emoji: "🛠️", color: "#495057", group: "Family" }] : ITEMS;
  const groups = [...new Set(items.map((i) => i.group))];
  const Badge = ({ n }: { n: number }) => (n > 0 ? <span className="ml-auto rounded-full bg-bad text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{n}</span> : null);
  return (
    <nav className="hidden sm:block sm:sticky sm:top-3 sm:self-start min-w-0" aria-label="Parent sections">
      {/* desktop: one panel, grouped rows */}
      <div className="hidden sm:block w-48 rounded-2xl border border-line bg-panel p-2 space-y-2">
        {groups.map((g) => (
          <div key={g}>
            <div className="text-[10px] uppercase tracking-wider muted px-2 pt-1 pb-0.5">{g}</div>
            <ul className="space-y-0.5">
              {items.filter((i) => i.group === g).map((it) => {
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
                      {it.href === "/parent/admin" && <Badge n={openErrors} />}
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
