import Link from "next/link";
import { accessUntil, hasAccess, type AccessGrant } from "@/lib/access";
import { prettyDate } from "@/lib/dates";

/**
 * The one place the virtual teacher is sold. On a child's page it says whether he can use it and until when; on a
 * parent's it links to the price list. It stays quiet when access is comfortable, and speaks up when it is not.
 */
export function UpgradeCard({ grants, studentId, today, href = "/parent/access", compact = false }: {
  grants: AccessGrant[];
  /** null on a parent's page: then it talks about the house rather than one child. */
  studentId: string | null;
  today: string;
  href?: string;
  compact?: boolean;
}) {
  const live = studentId ? hasAccess(grants, studentId, today) : grants.some((g) => g.ends_on >= today);
  const until = studentId ? accessUntil(grants, studentId, today) : grants.filter((g) => g.ends_on >= today).map((g) => g.ends_on).sort().reverse()[0] ?? null;
  const daysLeft = until ? Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : 0;
  const ending = live && daysLeft <= 3;

  if (live && !ending && compact) return null;

  return (
    <Link href={href} className={`card flex items-center gap-3 ${ending ? "border-2 border-warn" : !live ? "border-2 border-accent" : ""} ${compact ? "!py-3" : ""}`}>
      <span className="text-3xl">{live ? (ending ? "⏳" : "🎓") : "✨"}</span>
      <div className="min-w-0 flex-1">
        <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {live ? (ending ? "The teacher runs out soon" : "Virtual teacher is on") : "Unlock the virtual teacher"}
        </div>
        <div className="text-xs muted">
          {live && until
            ? `Until ${prettyDate(until)}${daysLeft <= 7 ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ""}`
            : "Lessons with a teacher who talks, draws on the board and asks you questions."}
        </div>
      </div>
      <span className="btn-primary btn-sm shrink-0">{live ? "Extend" : "See plans"}</span>
    </Link>
  );
}
