import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { JoinForm } from "@/components/JoinForm";

/** A co-parent lands here from an invite link and creates their own login inside the same family. */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("family_invites")
    .select("id, label, expires_at, used_at, families(name), profiles!family_invites_created_by_fkey(full_name)")
    .eq("token", token)
    .maybeSingle();
  const inv = invite as unknown as { id: string; label: string | null; expires_at: string; used_at: string | null; families: { name: string } | null; profiles: { full_name: string } | null } | null;
  const valid = !!inv && !inv.used_at && new Date(inv.expires_at) > new Date();
  return (
    <main className="mx-auto max-w-sm px-4 py-12 space-y-6">
      <div className="text-center space-y-1">
        <div className="text-5xl">👨‍👩‍👦‍👦</div>
        <h1 className="h1">{valid ? `Join ${inv!.families?.name ?? "the family"}` : "Invite not valid"}</h1>
        <p className="muted text-sm">
          {valid
            ? `${inv!.profiles?.full_name?.split(" ")[0] ?? "A parent"} invited you${inv!.label ? ` as ${inv!.label}` : ""}. You get your own login and see the same kids, reports and alerts.`
            : "This link was already used or has expired. Ask for a new one from More → Parents."}
        </p>
      </div>
      {valid ? <JoinForm token={token} label={inv!.label} /> : <Link href="/login" className="btn-ghost w-full">Go to sign in</Link>}
    </main>
  );
}
