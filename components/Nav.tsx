"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  emoji: string;
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-line bg-panel/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-3xl">
        {items.map((it) => {
          const active =
            path === it.href ||
            (it.href !== "/parent" && path.startsWith(it.href)) ||
            (it.href === "/learn" && (path.startsWith("/quiz") || path.startsWith("/review")));
          return (
            <li key={it.href} className="flex-1">
              <Link href={it.href} className={`flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-semibold transition ${active ? "text-accent-2" : "text-muted"}`} style={{ fontFamily: "var(--font-display)" }}>
                <span className={`text-2xl leading-none rounded-2xl px-3 py-1 transition ${active ? "bg-accent/20 -translate-y-0.5 pop" : ""}`}>{it.emoji}</span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
