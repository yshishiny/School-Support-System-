import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { SettingsForm, TelegramSettings } from "@/components/SettingsForm";
import { PlacesForm, type PlaceRow } from "@/components/PlacesForm";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { family, profile } = await requireParent();
  const supabase = await createClient();
  const [{ data: places }, { data: kids }] = await Promise.all([
    supabase.from("places").select("*").eq("family_id", family.id).order("kind"),
    supabase.from("profiles").select("id, full_name").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
  ]);
  return (
    <main className="space-y-4">
      <h1 className="h1">More</h1>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/parent/children" className="card text-center"><div className="text-3xl">🧒</div><div className="font-semibold mt-1">Kids & timetable</div></Link>
        <Link href="/parent/reports" className="card text-center"><div className="text-3xl">📨</div><div className="font-semibold mt-1">Daily reports</div></Link>
      </div>
      <SettingsForm family={family} />
      <PlacesForm places={(places ?? []) as PlaceRow[]} students={kids ?? []} />
      <TelegramSettings family={family} botUsername={process.env.TELEGRAM_BOT_USERNAME ?? null} />
      <div className="card text-sm muted">Signed in as {profile.full_name}</div>
      <form action={logoutAction}><button className="btn-ghost w-full">Sign out</button></form>
    </main>
  );
}
