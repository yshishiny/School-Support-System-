import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/lib/actions/auth";
import { ThemePicker } from "@/components/ThemePicker";
import { HomeLayoutPicker } from "@/components/HomeLayoutPicker";
import { PointsGuide } from "@/components/PointsGuide";
import { InterestsForm } from "@/components/InterestsForm";
import Link from "next/link";
import { learnerTags, type LearnerProfile } from "@/lib/learner";
import { RemindersCard } from "@/components/RemindersCard";
import { APP_NAME, APP_VERSION } from "@/lib/version";
import { DEFAULT_NUDGES, type NudgeSettings } from "@/lib/nudges";
import { HeroUploader } from "@/components/HeroUploader";
import { HeroGallery } from "@/components/HeroGallery";
import { BannerAdjuster } from "@/components/BannerAdjuster";
import { heroChoices, signHeroUrls, type HeroImage } from "@/lib/hero";
import type { Checkin } from "@/lib/types";

export default async function MePage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const [{ data: checkins }, { data: topics }, { data: heroRows }] = await Promise.all([
    supabase.from("checkins").select("*").eq("student_id", profile.id).order("checkin_date", { ascending: false }).limit(14),
    supabase.from("topics").select("subject").eq("track", "school").eq("grade", profile.grade ?? 0),
    supabase.from("hero_images").select("*").eq("student_id", profile.id).order("created_at", { ascending: false }),
  ]);
  const heroes = (heroRows ?? []) as HeroImage[];
  const heroUrls = await signHeroUrls(heroes);
  const { avatar, banner } = await heroChoices(profile);
  const subjects = [...new Set((topics ?? []).map((t) => t.subject as string))].sort();
  const list = (checkins ?? []) as Checkin[];
  const totalMinutes = list.reduce((s, c) => s + c.minutes_studied, 0);

  return (
    <main className="space-y-4">
      <header className="card flex items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-16 w-16 rounded-full object-cover border-2 border-accent" />
        ) : (
          <div className="text-4xl">{profile.avatar_emoji}</div>
        )}
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

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="h2">🖼️ My pictures</h2>
            <p className="text-xs muted">Pick one as your avatar and one as the banner behind your home page. Only your family can see them.</p>
          </div>
          <HeroUploader familyId={family.id} studentId={profile.id} compact />
        </div>
        <HeroGallery items={heroes.map((h) => ({ id: h.id, url: heroUrls.get(h.id) ?? "", caption: h.caption })).filter((x) => x.url)} avatarId={profile.avatar_image_id} bannerId={profile.banner_image_id} canDelete />
        {banner && (
          <div className="space-y-1 pt-1">
            <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Frame your banner</div>
            <BannerAdjuster url={banner} fit={profile.banner_fit ?? "full"} zoom={Number(profile.banner_zoom ?? 1) || 1} x={profile.banner_x ?? 50} y={profile.banner_y ?? 30} />
          </div>
        )}
      </section>

      <HomeLayoutPicker current={profile.home_layout ?? "b"} />

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

      <RemindersCard settings={{ ...DEFAULT_NUDGES, ...(((profile as { nudges?: Partial<NudgeSettings> }).nudges) ?? {}) }} />

      <Link href="/snaps" className="card flex items-center gap-3">
        <span className="text-4xl sticker-still">📸</span>
        <div className="flex-1"><div className="font-bold">Show your win</div><div className="text-xs muted">Snap your bed, desk, dish or homework page. Handwriting corner too.</div></div>
        <span className="btn-ghost btn-sm">Open</span>
      </Link>

      <Link href="/tour" className="card flex items-center gap-3">
        <span className="text-4xl sticker-still">🗺️</span>
        <div className="flex-1"><div className="font-bold">Take the tour again</div><div className="text-xs muted">Two minutes: what each tab does and how points work.</div></div>
        <span className="btn-ghost btn-sm">Open</span>
      </Link>

      <Link href="/about" className="text-xs muted block text-center">{APP_NAME} v{APP_VERSION} · About</Link>

      <form action={logoutAction}>
        <button className="btn-ghost w-full">Sign out</button>
      </form>
    </main>
  );
}
