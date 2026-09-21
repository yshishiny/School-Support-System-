import type { ReactNode } from "react";

/**
 * The first few, then the rest behind a disclosure.
 *
 * Every long list in the app was a complete list: six files, fifty-two topics, a term of history, all laid out at
 * once. None of it was wrong, which is exactly why it was hard to cut — so this removes nothing. It puts the rest
 * one tap away and gives the tap an honest label, so a child sees where they are instead of where the scroll ends.
 *
 * `<details>` rather than state: it works before hydration, it is what a screen reader already understands, and
 * the browser finds text inside a closed one when you search the page.
 */
export function MoreList({
  children, show = 3, noun = "more item", className = "space-y-2",
}: { children: ReactNode[]; show?: number; noun?: string; className?: string }) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const items = children.filter((c) => c !== null && c !== undefined && c !== false);
  const head = items.slice(0, show);
  const rest = items.slice(show);
  return (
    <div className={className}>
      {head}
      {/* The control belongs under whatever it revealed, not in the middle of it, so the panel is ordered before
          the summary. Closed, the panel is not rendered at all and the order never shows. */}
      {rest.length > 0 && (
        <details className="group flex flex-col">
          <summary className="order-2 btn-ghost btn-sm w-full justify-center cursor-pointer list-none text-center group-open:mt-2">
            <span className="group-open:hidden">{plural(rest.length, noun)} ▾</span>
            <span className="hidden group-open:inline">Show less ▴</span>
          </summary>
          <div className={`${className} order-1 mt-2`}>{rest}</div>
        </details>
      )}
    </div>
  );
}

/**
 * A named group that starts closed, with the count on the outside.
 *
 * For a list already divided into parts — units of a subject, months of history — where the headings are the
 * useful thing and the rows underneath are what turns a page into a kilometre.
 */
export function Group({
  title, count, note, children, open = false, dir,
}: { title: string; count?: number; note?: string; children: ReactNode; open?: boolean; dir?: "rtl" }) {
  return (
    <details open={open} className="group border-b border-line last:border-0" dir={dir}>
      <summary className="py-2 flex items-center gap-2 cursor-pointer list-none">
        <span className="muted text-xs transition-transform group-open:rotate-90">▸</span>
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {note && <span className="text-xs muted">{note}</span>}
        {count !== undefined && <span className="badge text-xs">{count}</span>}
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}
