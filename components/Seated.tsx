import Link from "next/link";

export interface SeatedLink {
  href: string;
  label: string;
  emoji: string;
  /** One short line saying what is through the door, so the row is a signpost rather than a second bar. */
  note: string;
  badge?: number | null;
}

/**
 * The places that came off the bottom bar.
 *
 * The bar had grown to eleven, which on a phone is thirty-five points a target against a forty-four point
 * minimum — every tap a near miss, and the label two sizes below what a nine-year-old reads comfortably. Five
 * stay in the hand; these sit at the top of the page they belong to, where a full-width row can carry a real
 * label and a line of explanation instead of a ten-pixel one. Nothing became harder to reach, and the count on
 * the bar stops growing every time something ships.
 */
export function Seated({ links }: { links: SeatedLink[] }) {
  if (links.length === 0) return null;
  return (
    <nav className="grid gap-2 sm:grid-cols-2" aria-label="More places">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="group flex items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-2.5 min-h-[56px] transition hover:border-accent/60"
        >
          <span className="text-2xl leading-none shrink-0">{l.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold truncate" style={{ fontFamily: "var(--font-display)" }}>
              {l.label}
            </span>
            <span className="block text-xs muted truncate">{l.note}</span>
          </span>
          {!!l.badge && (
            <span className="shrink-0 rounded-full bg-accent text-white text-[11px] font-bold px-1.5 py-0.5 leading-none">
              {l.badge}
            </span>
          )}
          <span className="shrink-0 muted text-lg leading-none transition group-hover:text-accent-2" aria-hidden>
            ›
          </span>
        </Link>
      ))}
    </nav>
  );
}
