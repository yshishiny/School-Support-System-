import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { peopleFor, recentAudit } from "@/lib/accounts/people";
import { PersonAdmin } from "@/components/PersonAdmin";

export const dynamic = "force-dynamic";

/**
 * Accounts: who can sign in, and what may be done about it.
 *
 * One page for both audiences, because the job is the same one. A parent sees their own family; an administrator
 * sees every family, grouped. What each may actually *do* is decided on the server by `lib/accounts/rights`, so
 * this page can be generous about what it shows without being generous about what it permits.
 */
export default async function PeoplePage() {
  const { profile, family } = await requireParent();
  const isAdmin = !!(profile as { is_admin?: boolean }).is_admin;
  const isOwner = !!(profile as { is_family_owner?: boolean }).is_family_owner;
  const viewer = { familyId: profile.family_id, isAdmin };
  const [people, audit] = await Promise.all([peopleFor(viewer), recentAudit(viewer)]);

  const families = [...new Set(people.map((p) => p.familyId))];
  const off = people.filter((p) => p.disabledAt).length;
  const noEmail = people.filter((p) => p.placeholder).length;

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">Accounts</h1>
        <Link href="/parent/settings" className="btn-ghost btn-sm">← Settings</Link>
      </div>

      <p className="muted text-sm">
        {isAdmin
          ? `Every account on this deployment: ${people.length} across ${families.length} famil${families.length === 1 ? "y" : "ies"}.`
          : isOwner
            ? "You are the main parent, so you can administer everyone in your family."
            : "You can administer the children. Only the main parent can administer another parent."}
        {off > 0 && <> · <b className="text-bad">{off} switched off</b></>}
        {noEmail > 0 && <> · {noEmail} with no real email, who cannot reset a forgotten password without you</>}
      </p>

      {families.map((fid) => {
        const mine = people.filter((p) => p.familyId === fid);
        return (
          <section key={fid} className="card">
            {isAdmin && families.length > 1 && (
              <h2 className="h2 mb-1">{mine[0]?.familyName}{fid === family.id ? " · yours" : ""}</h2>
            )}
            <ul className="divide-y divide-line">
              {mine.map((p) => <PersonAdmin key={p.id} p={p} viewerIsAdmin={isAdmin} showFamily={false} />)}
            </ul>
          </section>
        );
      })}

      <section className="card space-y-2">
        <h2 className="h2">What has been done</h2>
        <p className="text-xs muted">Every administrative act on an account, whether it went through or was refused.</p>
        {audit.length === 0 ? (
          <p className="text-sm muted">Nothing yet.</p>
        ) : (
          <ul className="text-xs divide-y divide-line max-h-80 overflow-y-auto">
            {audit.map((a) => (
              <li key={a.id} className="py-1.5 flex items-baseline gap-2">
                <span className="muted whitespace-nowrap w-24 shrink-0 tabular-nums">{a.created_at.slice(5, 16).replace("T", " ")}</span>
                <span className="flex-1 min-w-0">
                  <b>{a.actor}</b> · {a.action.replace(/_/g, " ")} · {a.subject}
                  {a.detail && <span className="muted"> — {a.detail}</span>}
                </span>
                {!a.ok && <span className="badge text-bad text-[10px] shrink-0">refused</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
