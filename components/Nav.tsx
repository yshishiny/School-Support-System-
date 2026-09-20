"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  emoji: string;
  /** Routes seated under this one, so the primary still lights up when a child is deep inside it. */
  also?: string[];
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  // Five is the number. Six would put every target under the forty-four points a thumb needs; anything that
  // wants a place here belongs at the top of the page it already belongs to instead — see components/Seated.tsx.
  const seated: Record<string, string[]> = {
    "/learn": ["/quiz", "/review", "/coach"],
    "/allowance": ["/wallet", "/rewards"],
    "/me": ["/calendar", "/checkin", "/about", "/tour"],
  };
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-line bg-panel/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-3xl">
        {items.map((it) => {
          const owns = [...(it.also ?? []), ...(seated[it.href] ?? [])];
          const active =
            path === it.href ||
            (it.href !== "/parent" && path.startsWith(it.href)) ||
            owns.some((h) => path === h || path.startsWith(`${h}/`));
          return (
            <li key={it.href} className="flex-1">
              <Link href={it.href} className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-semibold transition ${active ? "text-accent-2" : "text-muted"}`} style={{ fontFamily: "var(--font-display)" }}>
                <span className={`text-2xl px-3 leading-none rounded-2xl py-1 transition ${active ? "bg-accent/20 -translate-y-0.5 pop" : ""}`}>{it.emoji}</span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
