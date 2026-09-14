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
              <Link href={it.href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-accent-2 font-semibold" : "text-muted"}`}>
                <span className="text-xl leading-none">{it.emoji}</span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
