import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/lib/actions/auth";
import { ThemePicker } from "@/components/ThemePicker";
import { PointsGuide } from "@/components/PointsGuide";
import type { Checkin } from "@/lib/types";

export default async function MePage() {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const { data: checkins } = await supabase.from("checkins").select("*").eq("student_id", profile.id).order("checkin_date", { ascending: false }).limit(14);
  const list = (checkins ?? []) as Checkin[];
  const totalMinutes = list.reduce((s, c) => s + c.minutes_studied, 0);

  return (
    <main className="space-y-4">
      <header className="card flex items-center gap-3">
        <div className="text-4xl">{profile.avatar_emoji}</div>
        <div>
          <h1 className="h1">{profile.full_name}</h1>
          <p className="muted text-sm">Grade {profile.grade}</p>
        </div>
      </header>

      <ThemePicker current={profile.theme} />

      <section className="card">
        <h2 className="h2 mb-2">Last two weeks</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-2xl font-extrabold">{list.length}</div><div className="text-xs muted">check-ins</div></div>
          <div><div className="text-2xl font-extrabold">{Math.round(totalMinutes / 60)}h</div><div className="text-xs muted">studied</div></div>
          <div><div className="text-2xl font-extrabold">{list.length ? (list.reduce((s, c) => s + (c.mood ?? 3), 0) / list.length).toFixed(1) : "–"}</div><div className="text-xs muted">avg mood</div></div>
        </div>
      </section>

      <PointsGuide />

      <form action={logoutAction}>
        <button className="btn-ghost w-full">Sign out</button>
      </form>
    </main>
  );
}
