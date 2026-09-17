import Link from "next/link";
import { headers } from "next/headers";
import { requireParent } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { setParentHomeLayoutAction } from "@/lib/actions/family";
import { SettingsForm, TelegramSettings } from "@/components/SettingsForm";
import { MyParentCard, ParentsPanel, type InviteRow, type OverrideRow, type ParentRow } from "@/components/ParentsPanel";
import { PlacesForm, type PlaceRow } from "@/components/PlacesForm";
import { PushToggle } from "@/components/PushToggle";
import { Tabs } from "@/components/Tabs";
import { PARENT_SECTIONS } from "@/components/ParentMenu";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import type { Profile } from "@/lib/types";
import { APP_NAME, APP_VERSION } from "@/lib/version";

const HOME_LAYOUTS: { id: "a" | "b" | "c"; title: string; emoji: string; blurb: string }[] = [
  { id: "a", title: "Command centre", emoji: "🎛️", blurb: "Three columns on a wide screen: what needs you, one card per child, live feed and inbox. Best at the laptop." },
  { id: "b", title: "Kid-first", emoji: "🧒", blurb: "Four numbers on top, then one child at a time in the coloured tabs. Best on the phone." },
  { id: "c", title: "The day as a timeline", emoji: "🕰️", blurb: "Fajr to check-in, both boys side by side, so a gap shows where it happened. Needs-you rail on the right." },
];

function HomeLayoutChooser({ current }: { current: string }) {
  return (
    <section className="card space-y-2">
      <h2 className="h2">🏠 Home page layout</h2>
      <p className="text-xs muted">Same information, three arrangements. Pick the one you find easiest; you can switch any time.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {HOME_LAYOUTS.map((l) => (
          <form key={l.id} action={setParentHomeLayoutAction} className={`tile space-y-1 ${current === l.id ? "ring-2 ring-accent" : ""}`}>
            <input type="hidden" name="home_layout" value={l.id} />
            <div className="text-2xl">{l.emoji}</div>
            <div className="font-bold text-sm">{l.title}{current === l.id ? " · current" : ""}</div>
            <div className="text-xs muted">{l.blurb}</div>
            {current !== l.id && <button className="btn-ghost btn-sm">Use this</button>}
          </form>
        ))}
      </div>
    </section>
  );
}

export default async function SettingsPage() {
  const { family, profile } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [{ data: places }, { data: kids }, { data: parents }, { data: invites }, { data: overrides }] = await Promise.all([
    supabase.from("places").select("*").eq("family_id", family.id).order("kind"),
    supabase.from("profiles").select("id, full_name").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
    supabase.from("profiles").select("id, full_name, parent_label, telegram_chat_id, whatsapp, created_at, live_pings").eq("family_id", family.id).eq("role", "parent").order("created_at"),
    supabase.from("family_invites").select("id, label, token, expires_at, used_at").eq("family_id", family.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("custody_overrides").select("id, day, parent_id, note").eq("family_id", family.id).gte("day", today).order("day").limit(30),
  ]);
  const h = await headers();
  const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`;
  const me = (parents ?? []).find((p) => p.id === profile.id) as ParentRow | undefined;
  return (
    <main className="space-y-4">
      <h1 className="h1">More</h1>
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {PARENT_SECTIONS.filter((i) => !["/parent", "/parent/settings", "/parent/notifications"].includes(i.href)).map((i) => (
          <Link key={i.href} href={i.href} className="tile !p-2.5 text-center min-w-0" style={{ borderColor: `${i.color}66`, background: `${i.color}14` }}>
            <div className="text-2xl">{i.emoji}</div>
            <div className="text-xs font-bold mt-0.5 truncate" style={{ fontFamily: "var(--font-display)" }}>{i.label}</div>
          </Link>
        ))}
        {(profile as { is_admin?: boolean }).is_admin && (
          <Link href="/parent/admin" className="tile !p-2.5 text-center min-w-0"><div className="text-2xl">🛠️</div><div className="text-xs font-bold mt-0.5">Admin</div></Link>
        )}
      </div>
      <Tabs
        storageKey="more"
        tabs={[
          { id: "you", label: "You", emoji: "👤", content: (<>
      {me && <MyParentCard me={me} />}
      <HomeLayoutChooser current={(profile as { home_layout?: string }).home_layout ?? "b"} />
      <section className="card space-y-2">
        <h2 className="h2">🔔 Notifications on this phone</h2>
        <p className="text-xs muted">Daily report headline and safety alerts as browser notifications on this device. Telegram below stays the full-text channel.</p>
        <PushToggle />
      </section>
      <TelegramSettings chatId={(profile as Profile).telegram_chat_id} botUsername={process.env.TELEGRAM_BOT_USERNAME ?? null} />
          </>) },
          { id: "parents", label: "Parents", emoji: "👨‍👩‍👦", content: (<>
      <ParentsPanel me={profile.id} parents={(parents ?? []) as ParentRow[]} invites={(invites ?? []) as InviteRow[]} pattern={family.custody_pattern ?? {}} overrides={(overrides ?? []) as OverrideRow[]} today={today} baseUrl={baseUrl} />
          </>) },
          { id: "family", label: "Family & places", emoji: "🏠", content: (<>
      <SettingsForm family={family} />
      <PlacesForm places={(places ?? []) as PlaceRow[]} students={kids ?? []} />
          </>) },
          { id: "about", label: "About", emoji: "ℹ️", content: (<>
      <Link href="/parent/about" className="card flex items-center gap-3">
        <span className="text-3xl">ℹ️</span>
        <div className="flex-1"><div className="font-semibold">About {APP_NAME}</div><div className="text-xs muted">Version {APP_VERSION} · agreement, copyright and trademark</div></div>
        <span className="btn-ghost btn-sm">Open</span>
      </Link>
          </>) },
        ]}
      />
      <div className="card text-sm muted">Signed in as {profile.full_name}</div>
      <form action={logoutAction}><button className="btn-ghost w-full">Sign out</button></form>
    </main>
  );
}
