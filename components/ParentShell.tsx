"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isFocusRoute } from "@/lib/parent-focus";

/** The parent area's two-column frame, or no frame at all on a page about one child. */
export function ParentShell({ menu, children }: { menu: ReactNode; children: ReactNode }) {
  const focus = isFocusRoute(usePathname() ?? "");
  if (focus) return <div className="min-w-0">{children}</div>;
  return (
    <div className="grid gap-4 grid-cols-[minmax(0,1fr)] sm:grid-cols-[12rem_minmax(0,1fr)]">
      {menu}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
