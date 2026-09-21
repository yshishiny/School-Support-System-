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
import { InstallCard } from "@/components/InstallCard";
import { GradeSheetUploader } from "@/components/GradeSheetUploader";
import { KpiTicks } from "@/components/KpiTicks";
import { mergeKpis } from "@/lib/allowance";
import { todayIn } from "@/lib/dates";
import { APP_VERSION } from "@/lib/version";
import { brand } from "@/lib/brand";
import { DEFAULT_NUDGES, type NudgeSettings } from "@/lib/nudges";
import { HeroUploader } from "@/components/HeroUploader";
import { HeroGallery } from "@/components/HeroGallery";
import { BannerAdjuster } from "@/components/BannerAdjuster";
import { heroChoices, signHeroUrls, type HeroImage } from "@/lib/hero";
import type { Checkin } from "@/lib/types";
import { SnapReview } from "@/components/SnapReview";
import { Tabs } from "@/components/Tabs";
import { Seated } from "@/components/Seated";
import { signSnapUrls } from "@/lib/snaps/server";
import { prettyDate, shiftDate } from "@/lib/dates";

export default async function MePage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [{ data: sheets }, { data: siblings }, { data: sibTicks }] = await Promise.all([
    supabase.from("grade_sheets").select("month, status, average, previous_average, appraisal").eq("student_id", profile.id).order("month", { ascending: false }).limit(3),
    (profile as { rater?: boolean }).rater ? supabase.from("profiles").select("id, full_name, avatar_emoji").eq("family_id", family.id).eq("role", "student").neq("id", profile.id) : Promise.resolve({ data: [] as { id: string; full_name: string; avatar_emoji: string }[] }),
    (profile as { rater?: boolean }).rater ? supabase.from("kpi_ticks").select("student_id, code, value").eq("family_id", family.id).eq("tick_date", today) : Promise.resolve({ data: [] as { student_id: string; code: string; value: boolean }[] }),
  ]);
  const [{ data: checkins }, { data: topics }, { data: heroRows }] = await Promise.all([
    supabase.from("checkins").select("*").eq("student_id", profile.id).order("checkin_date", { ascending: false }).limit(14),
    supabase.from("topics").select("subject").eq("track", "school").eq("grade", profile.grade ?? 0),
    supabase.from("hero_images").select("*").eq("student_id", profile.id).order("created_at", { ascending: false }),
  ]);
  type SibSnap = { id: string; student_id: string; task_code: string; kind: string; path: string; taken_on: string; ai_verdict: string | null; ai_note: string | null; created_at: string };
  const sibIds = (siblings ?? []).map((x) => x.id);
  const { data: sibSnapRows } = sibIds.length ? await supabase.from("snaps").select("id, student_id, task_code, kind, path, taken_on, ai_verdict, ai_note, created_at").in("student_id", sibIds).eq("status", "pending").gte("taken_on", shiftDate(today, -3)).order("created_at", { ascending: false }).limit(12) : { data: [] as SibSnap[] };
  const sibSnaps = (sibSnapRows ?? []) as SibSnap[];
  const sibSnapUrls = await signSnapUrls(sibSnaps.map((x) => ({ id: x.id, path: x.path })));
  const heroes = (heroRows ?? []) as HeroImage[];
  const heroUrls = await signHeroUrls(heroes);
  const { avatar, banner } = await heroChoices(profile);
  const subjects = [...new Set((topics ?? []).map((t) => t.subject as string))].sort();
  const list = (checkins ?? []) as Checkin[];
  const totalMinutes = list.reduce((s, c) => s + c.minutes_studied, 0);

  const tags = learnerTags((profile as { learner_profile?: LearnerProfile | null }).learner_profile);
  const sibs = siblings ?? [];

  // Fourteen cards stacked down a phone is a page nobody reaches the bottom of. Four tabs, one screen each.
  const pictures = (
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
  );

  const progress = (
    <>
      <section className="card">
        <h2 className="h2 mb-2">Last two weeks</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-2xl font-extrabold">{list.length}</div><div className="text-xs muted">check-ins</div></div>
          <div><div className="text-2xl font-extrabold">{Math.round(totalMinutes / 60)}h</div><div className="text-xs muted">studied</div></div>
          <div><div className="text-2xl font-extrabold">{list.length ? (list.reduce((s, c) => s + (c.mood ?? 3), 0) / list.length).toFixed(1) : "–"}</div><div className="text-xs muted">avg mood</div></div>
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="h2">📊 Grades sheet</h2>
        <p className="text-xs muted">Once a month, a photo of the school&apos;s grades sheet. The coach reads it, writes your appraisal, and it counts toward the allowance from the 21st.</p>
        {(sheets ?? []).map((g) => (
          <div key={g.month} className="tile !p-2 text-sm">
            <div className="font-semibold">{g.month.slice(0, 7)}{g.average !== null ? ` · average ${g.average}%` : ""}{g.previous_average !== null && g.average !== null ? ` (${Number(g.average) >= Number(g.previous_average) ? "▲" : "▼"} from ${g.previous_average}%)` : ""}{g.status !== "ready" ? ` · ${g.status}` : ""}</div>
            {g.appraisal && <p className="text-xs muted mt-1">{g.appraisal}</p>}
          </div>
        ))}
        {!(sheets ?? []).some((g) => g.month === monthStart) && <GradeSheetUploader familyId={family.id} studentId={profile.id} month={today.slice(0, 7)} />}
      </section>

      <PointsGuide />
    </>
  );

  const familyTab = (
    <>
      <section className="card space-y-2">
        <h2 className="h2">🤝 Rate your siblings today</h2>
        <p className="text-xs muted">You are trusted with this. Only a ✗ counts against them, and your parents see who tapped.</p>
        {sibs.map((sib) => {
          const ticks: Record<string, boolean> = {};
          (sibTicks ?? []).filter((t) => t.student_id === sib.id).forEach((t) => (ticks[t.code] = t.value));
          return <div key={sib.id} className="space-y-1"><div className="text-sm font-semibold">{sib.avatar_emoji} {sib.full_name.split(" ")[0]}</div><KpiTicks studentId={sib.id} kpis={mergeKpis(family.allowance_kpis)} ticks={ticks} /></div>;
        })}
      </section>

      <section className="card space-y-2">
        <h2 className="h2">📸 Snaps to check{sibSnaps.length ? ` (${sibSnaps.length})` : ""}</h2>
        <p className="text-xs muted">Look at the picture and decide: done or not. A ✓ gives the points; a ✗ sends it back with your note.</p>
        {sibSnaps.length === 0 && <p className="text-sm muted">Nothing waiting.</p>}
        {sibSnaps.map((x) => {
          const sib = sibs.find((z) => z.id === x.student_id);
          const url = sibSnapUrls.get(x.id);
          return (
            <div key={x.id} className="tile space-y-2">
              <div className="text-sm"><b>{sib?.avatar_emoji} {sib?.full_name.split(" ")[0]}</b> · {x.task_code} · <span className="muted">{prettyDate(x.taken_on)} {x.created_at.slice(11, 16)}</span></div>
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-full max-h-64 object-contain rounded-xl bg-panel-2" /></a>
              )}
              {x.ai_verdict && x.ai_verdict !== "skipped" && <div className="text-xs muted">Coach: {x.ai_note}</div>}
              <SnapReview snapId={x.id} />
            </div>
          );
        })}
      </section>
    </>
  );

  const more = (
    <>
      <InstallCard compact />
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

      {/* Spelled out for the children too: which of the two apps this is, and exactly what is running in it. */}
      <Link href="/about" className="text-xs muted block text-center">
        {brand().name} · v{APP_VERSION} · {brand().beta ? "beta" : "live"} · About
      </Link>

      <form action={logoutAction}>
        <button className="btn-ghost w-full">Sign out</button>
      </form>
    </>
  );

  return (
    <main className="space-y-3">
      <header className="card flex items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-16 w-16 rounded-full object-cover border-2 border-accent" />
        ) : (
          <div className="text-4xl">{profile.avatar_emoji}</div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="h1">{profile.full_name}</h1>
          <p className="muted text-sm">Grade {profile.grade}</p>
        </div>
      </header>

      <Link href="/me/about-me" className="card flex items-center gap-3 border-accent/50">
        <span className="text-4xl sticker-still">🦸</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold">{tags.length ? "How I learn" : "Tell your coach about you"}</div>
          <div className="text-xs muted truncate">{tags.length ? tags.slice(0, 3).join(" · ") : "10 quick questions so lessons and quizzes fit you · +15 pts"}</div>
        </div>
        <span className="btn-ghost btn-sm">{tags.length ? "Edit" : "Start"}</span>
      </Link>

      <Seated
        links={[{ href: "/calendar", label: "Planner", emoji: "\u{1F5D3}\uFE0F", note: "Your week: school, exams and days off" }]}
      />

      <Tabs
        storageKey="me"
        tabs={[
          { id: "me", label: "Me", emoji: "🧑‍🚀", content: <>{pictures}<HomeLayoutPicker current={profile.home_layout ?? "b"} /><ThemePicker current={profile.theme} /><InterestsForm interests={profile.interests} favourites={profile.favourite_subjects ?? []} subjects={subjects} /></> },
          { id: "progress", label: "Progress", emoji: "📈", content: progress },
          ...(sibs.length > 0 ? [{ id: "family", label: "Family", emoji: "🤝", badge: sibSnaps.length, content: familyTab }] : []),
          { id: "more", label: "More", emoji: "⚙️", content: more },
        ]}
      />
    </main>
  );
}
