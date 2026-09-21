import Link from "next/link";
import { brand } from "@/lib/brand";
import { APP_VERSION, buildId } from "@/lib/version";

/**
 * Which of the two sites you are looking at, and exactly what is running on it.
 *
 * The beta shares the family's real data with the live site, so the two must never be confused on a phone; and
 * the number it shows has to be the number that is actually deployed. It used to be neither — it was decorative
 * (unclickable, eleven pixels, faint) and it printed a string from lib/version.ts that had drifted fifteen
 * releases behind package.json. Now it names the site in words, carries the version from the package, and is a
 * link: tapping it opens About, where the build's commit is written out in full. The two apps have their own
 * About page, so the target is passed in — sending a parent to the children's one only bounces him to a login.
 *
 * Shown on every screen of both apps — the parent's and the children's — because "which one am I looking at?"
 * is a question either of them can be asking.
 */
export function SiteBadge({ href = "/about", className = "" }: { href?: string; className?: string }) {
  const b = brand();
  return (
    <Link
      href={href}
      title={`${b.beta ? "Beta site — same family data as the live one" : "Live site"} · build ${buildId()}`}
      className={`absolute end-3 top-1 z-40 rounded-full px-2.5 py-1 text-[11px] font-mono font-bold leading-none shadow transition hover:opacity-100 ${b.beta ? "" : "opacity-70"} ${className}`}
      style={{
        background: b.beta ? `linear-gradient(135deg, ${b.accent}, ${b.accent2})` : "rgba(255,255,255,.14)",
        color: b.beta ? "#20140a" : "inherit",
      }}
    >
      {b.beta ? `${b.glyph} BETA` : "LIVE"} <span className="font-normal">v{APP_VERSION}</span>
    </Link>
  );
}
