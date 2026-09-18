import { requireParent } from "@/lib/auth";
import { ParentMenu, ParentPhoneBar } from "@/components/ParentMenu";
import { unreadCount } from "@/lib/inbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_VERSION } from "@/lib/version";

/** Parent area: a colourful side menu (left on wide screens, a strip on phones) and the page beside it. */
export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireParent();
  const unread = await unreadCount(profile.id).catch(() => 0);
  const isAdmin = !!(profile as { is_admin?: boolean }).is_admin;
  const openErrors = isAdmin ? (await createAdminClient().from("app_errors").select("id", { count: "exact", head: true }).is("resolved_at", null)).count ?? 0 : 0;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-3 pb-24 sm:pb-10 overflow-x-clip">
      <div className="absolute top-1 right-4 text-xs font-mono bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded">
        v{APP_VERSION}
      </div>
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] sm:grid-cols-[12rem_minmax(0,1fr)]">
        <ParentMenu unread={unread} isAdmin={isAdmin} openErrors={openErrors} />
        <div className="min-w-0">{children}</div>
      </div>
      <ParentPhoneBar unread={unread} />
    </div>
  );
}
