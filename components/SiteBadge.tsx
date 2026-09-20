import { brand } from "@/lib/brand";
import { APP_VERSION } from "@/lib/version";

/**
 * Which of the two sites you are looking at. The beta shares the family's real data with the live site, so it
 * says so in its own colour on every screen, not only on the home page.
 */
export function SiteBadge({ className = "" }: { className?: string }) {
  const b = brand();
  return (
    <div
      className={`pointer-events-none absolute end-3 top-1 z-40 rounded-full px-2 py-0.5 text-[11px] font-mono font-bold shadow ${className}`}
      style={{ background: b.beta ? `linear-gradient(135deg, ${b.accent}, ${b.accent2})` : "rgba(255,255,255,.12)", color: b.beta ? "#20140a" : "inherit" }}
      title={b.beta ? "Beta site — same family data as the live one" : "Live site"}
    >
      {b.beta ? `${b.glyph} BETA v${APP_VERSION}` : `v${APP_VERSION}`}
    </div>
  );
}
