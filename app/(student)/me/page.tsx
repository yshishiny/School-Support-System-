import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/lib/actions/auth";
import { ThemePicker } from "@/components/ThemePicker";
import { PointsGuide } from "@/components/PointsGuide";
import { InterestsForm } from "@/components/InterestsForm";
import Link from "next/link";
import { learnerTags, type LearnerProfile } from "@/lib/learner";
import type { Checkin } from "@/lib/types";

export default async function MePage() {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const [{ data: checkins }, { data: topics }] = await Promise.all([
    supabase.from("checkins").select("*").eq("student_id", profile.id).order("checkin_date", { ascending: false }).limit(14),
    supabase.from("topics").select("subject").eq("track", "school").eq("grade", profile.grade ?? 0),
  ]);
  const subjects = [...new Set((topics ?? []).map((t) => t.subject as string))].sort();
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

      {(() => {
        const tags = learnerTags((profile as { learner_profile?: LearnerProfile | null }).learner_profile);
        return (
          <Link href="/me/about-me" className="card flex items-center gap-3 border-accent/50">
            <span className="text-4xl sticker-still">🦸</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{tags.length ? "How I learn" : "Tell your coach about you"}</div>
              <div className="text-xs muted truncate">{tags.length ? tags.slice(0, 3).join(" · ") : "10 quick questions so lessons and quizzes fit you · +15 pts"}</div>
            </div>
            <span className="btn-ghost btn-sm">{tags.length ? "Edit" : "Start"}</span>
          </Link>
        );
      })()}

      <ThemePicker current={profile.theme} />

      <InterestsForm interests={profile.interests} favourites={profile.favourite_subjects ?? []} subjects={subjects} />

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
