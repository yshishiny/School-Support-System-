import { requireParent } from "@/lib/auth";
import { ParentMenu, ParentPhoneBar } from "@/components/ParentMenu";
import { ParentShell } from "@/components/ParentShell";
import { unreadCount } from "@/lib/inbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteBadge } from "@/components/SiteBadge";

/** Parent area: a side menu (left on wide screens, a strip on phones) and the page beside it — except on a
 * page about a single child, which takes the full width. See ParentShell. */
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireParent();
  const unread = await unreadCount(profile.id).catch(() => 0);
  const isAdmin = !!(profile as { is_admin?: boolean }).is_admin;
  const openErrors = isAdmin ? (await createAdminClient().from("app_errors").select("id", { count: "exact", head: true }).is("resolved_at", null)).count ?? 0 : 0;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 pb-24 sm:pb-10 overflow-x-clip">
      <SiteBadge href="/parent/about" />
      <ParentShell menu={<ParentMenu unread={unread} isAdmin={isAdmin} openErrors={openErrors} />}>
        {children}
      </ParentShell>
      <ParentPhoneBar unread={unread} />
    </div>
  );
}
