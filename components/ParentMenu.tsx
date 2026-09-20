"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PARENT_SECTIONS as ITEMS } from "@/lib/parent-sections";


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
  const owns = (href: string) => (href === "/parent" ? path === "/parent" : path === href || path.startsWith(`${href}/`));
  // "More" is every parent page the other four do not own — including the sections that live only under it.
  const active = (href: string) =>
    href === "/parent/settings"
      ? !items.slice(0, 4).some((i) => owns(i.href))
      : owns(href);
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

/**
 * Wide screens: one quiet panel, items grouped, each with a small icon disc. Only the page you are on is
 * coloured — a menu in which all sixteen rows are coloured cannot point at any of them.
 */
export function ParentMenu({ unread = 0, isAdmin = false, openErrors = 0 }: { unread?: number; isAdmin?: boolean; openErrors?: number }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/parent" ? path === "/parent" : path === href || path.startsWith(`${href}/`));
  const items = isAdmin ? [...ITEMS, { href: "/parent/admin", label: "Admin", emoji: "🛠️", group: "Family" }] : ITEMS;
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
                      className={`relative flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition ${on ? "bg-accent/15 text-ink" : "text-muted hover:text-ink hover:bg-panel-2"}`}
                    >
                      {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-accent" />}
                      <span className={`grid place-items-center h-7 w-7 rounded-lg text-base leading-none shrink-0 ${on ? "bg-accent/25" : "bg-panel-2"}`}>{it.emoji}</span>
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
