import Link from "next/link";
import { headers } from "next/headers";
import { requireParent } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { SettingsForm, TelegramSettings } from "@/components/SettingsForm";
import { MyParentCard, ParentsPanel, type InviteRow, type OverrideRow, type ParentRow } from "@/components/ParentsPanel";
import { PlacesForm, type PlaceRow } from "@/components/PlacesForm";
import { PushToggle } from "@/components/PushToggle";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import type { Profile } from "@/lib/types";
import { APP_NAME, APP_VERSION } from "@/lib/version";

export default async function SettingsPage() {
  const { family, profile } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [{ data: places }, { data: kids }, { data: parents }, { data: invites }, { data: overrides }] = await Promise.all([
    supabase.from("places").select("*").eq("family_id", family.id).order("kind"),
    supabase.from("profiles").select("id, full_name").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
    supabase.from("profiles").select("id, full_name, parent_label, telegram_chat_id, whatsapp, created_at").eq("family_id", family.id).eq("role", "parent").order("created_at"),
    supabase.from("family_invites").select("id, label, token, expires_at, used_at").eq("family_id", family.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("custody_overrides").select("id, day, parent_id, note").eq("family_id", family.id).gte("day", today).order("day").limit(30),
  ]);
  const h = await headers();
  const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const me = (parents ?? []).find((p) => p.id === profile.id) as ParentRow | undefined;
  return (
    <main className="space-y-4">
      <h1 className="h1">More</h1>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/parent/children" className="card text-center"><div className="text-3xl">🧒</div><div className="font-semibold mt-1">Kids & timetable</div></Link>
        <Link href="/parent/reports" className="card text-center"><div className="text-3xl">📨</div><div className="font-semibold mt-1">Daily reports</div></Link>
      </div>
      {me && <MyParentCard me={me} />}
      <section className="card space-y-2">
        <h2 className="h2">🔔 Notifications on this phone</h2>
        <p className="text-xs muted">Daily report headline and safety alerts as browser notifications on this device. Telegram below stays the full-text channel.</p>
        <PushToggle />
      </section>
      <TelegramSettings chatId={(profile as Profile).telegram_chat_id} botUsername={process.env.TELEGRAM_BOT_USERNAME ?? null} />
      <ParentsPanel me={profile.id} parents={(parents ?? []) as ParentRow[]} invites={(invites ?? []) as InviteRow[]} pattern={family.custody_pattern ?? {}} overrides={(overrides ?? []) as OverrideRow[]} today={today} baseUrl={baseUrl} />
      <SettingsForm family={family} />
      <PlacesForm places={(places ?? []) as PlaceRow[]} students={kids ?? []} />
      <Link href="/parent/about" className="card flex items-center gap-3">
        <span className="text-3xl">ℹ️</span>
        <div className="flex-1"><div className="font-semibold">About {APP_NAME}</div><div className="text-xs muted">Version {APP_VERSION} · agreement, copyright and trademark</div></div>
        <span className="btn-ghost btn-sm">Open</span>
      </Link>
      <div className="card text-sm muted">Signed in as {profile.full_name}</div>
      <form action={logoutAction}><button className="btn-ghost w-full">Sign out</button></form>
    </main>
  );
}
