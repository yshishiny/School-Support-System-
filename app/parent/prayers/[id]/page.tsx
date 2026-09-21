import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { signHeroUrls } from "@/lib/hero";
import { history, verdict, type Cell, type PrayerLog } from "@/lib/prayers/history";
import { fajrMosqueStreak, PRAYERS, PRAYER_LABEL } from "@/lib/prayers";
import { prettyDate, shiftDate, todayIn } from "@/lib/dates";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How each cell reads. Silence is grey and empty; an owned miss is its own mark, not a failure mark. */
const CELL: Record<Cell, { text: string; cls: string; title: string }> = {
  on_time: { text: "●", cls: "text-good", title: "On time" },
  late: { text: "▲", cls: "text-warn", title: "Late" },
  missed: { text: "○", cls: "text-bad", title: "He said he missed it" },
  none: { text: "·", cls: "muted", title: "Never logged either way" },
};

function Face({ src, emoji, size }: { src: string | null; emoji: string; size: string }) {
  return (
    <span className={`${size} shrink-0 rounded-full overflow-hidden border border-line bg-panel-2 grid place-items-center`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : <span className="text-xl leading-none">{emoji}</span>}
    </span>
  );
}

function Figure({ value, label, tone }: { value: string | number; label: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className={`text-2xl font-bold leading-none ${tone ?? ""}`} style={{ fontFamily: "var(--font-display)" }}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide muted mt-1.5">{label}</div>
    </div>
  );
}

/**
 * One child's prayers, over a stretch of days.
 *
 * The page exists to answer a question the weekly score cannot: *which* of the five is slipping, and is it
 * slipping or was it never recorded. Those two look identical in a number out of a hundred and call for
 * opposite conversations, so the grid keeps them visibly apart — and so does every total on the page.
 */
export default async function PrayersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ days?: string }> }) {
  const { id } = await params;
  const { days: daysParam } = await searchParams;
  const { family } = await requireParent();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: kidRows } = await supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const kids = (kidRows ?? []) as Profile[];
  const s = kids.find((k) => k.id === id);
  if (!s) notFound();

  const span = RANGES.some((r) => String(r.days) === daysParam) ? Number(daysParam) : 30;
  const today = todayIn(family.timezone);
  const from = shiftDate(today, -(span - 1));

  const heroIds = kids.map((k) => k.avatar_image_id).filter((x): x is string => !!x);
  const [{ data: logRows }, avatars] = await Promise.all([
    admin.from("prayer_logs").select("log_date, prayer, status, entered_late, at_mosque").eq("student_id", s.id).gte("log_date", shiftDate(from, -30)).lte("log_date", today),
    heroIds.length ? admin.from("hero_images").select("id, path").in("id", heroIds).then((r) => signHeroUrls((r.data ?? []) as { id: string; path: string }[])) : Promise.resolve(new Map<string, string>()),
  ]);
  const logs = (logRows ?? []) as PrayerLog[];
  const h = history(logs, from, today);
  const first = s.full_name.split(" ")[0];
  const avatarOf = (k: Profile) => (k.avatar_image_id ? avatars.get(k.avatar_image_id) ?? null : null);
  const mosqueStreak = fajrMosqueStreak(logs.map((l) => ({ log_date: l.log_date, prayer: l.prayer, at_mosque: !!l.at_mosque })), today);
  const kept = h.totals.possible === 0 ? 0 : Math.round((h.totals.onTime / h.totals.possible) * 100);

  return (
    <main className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href={`/parent/trace/${s.id}`} className="btn-ghost btn-sm shrink-0">← {first}</Link>
        {kids.length > 1 && (
          <span className="flex items-center gap-1.5 ml-auto">
            {kids.filter((k) => k.id !== s.id).map((k) => (
              <Link key={k.id} href={`/parent/prayers/${k.id}?days=${span}`} title={k.full_name.split(" ")[0]} className="opacity-60 hover:opacity-100 transition">
                <Face src={avatarOf(k)} emoji={k.avatar_emoji} size="h-8 w-8" />
              </Link>
            ))}
          </span>
        )}
      </div>

      <header className="flex items-center gap-4">
        <Face src={avatarOf(s)} emoji={s.avatar_emoji} size="h-16 w-16 text-3xl" />
        <div className="min-w-0 flex-1">
          <h1 className="h1 leading-tight">🕌 {first}&rsquo;s prayers</h1>
          <p className="muted text-sm">{prettyDate(from)} → {prettyDate(today)}</p>
        </div>
      </header>

      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <Link
            key={r.days}
            href={`/parent/prayers/${s.id}?days=${r.days}`}
            className={`chip ${r.days === span ? "!border-accent text-accent-2" : ""}`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <section className="card space-y-3">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          <Figure value={`${kept}%`} label="On time" tone={kept >= 80 ? "text-good" : kept >= 50 ? "text-warn" : "text-bad"} />
          <Figure value={h.totals.late} label="Late" tone={h.totals.late > 0 ? "text-warn" : ""} />
          <Figure value={h.totals.missed} label="Owned up to" />
          <Figure value={h.totals.notLogged} label="Never logged" tone={h.totals.notLogged > h.totals.onTime ? "text-bad" : ""} />
          <Figure value={h.totals.mosque} label="At the mosque" />
          <Figure value={h.streakAllFive} label="Days in a row, all five" tone={h.streakAllFive > 0 ? "text-good" : ""} />
        </div>
        <p className="text-sm border-t border-line pt-3">{verdict(h, first)}</p>
        {mosqueStreak > 0 && <p className="text-xs text-good">🕌 Fajr at the mosque {mosqueStreak} day{mosqueStreak === 1 ? "" : "s"} running.</p>}
        <p className="text-xs muted">
          <b>Never logged</b> is the app knowing nothing — it is not the same as a missed prayer, and it is never
          counted as one. <b>Owned up to</b> is a prayer {first} typed in as missed; the points system pays for that
          honesty on purpose, and so should you.
        </p>
      </section>

      {/* ── Which of the five ─────────────────────────────────────────────── */}
      <section className="card space-y-2">
        <h2 className="h2">Which of the five</h2>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left muted text-xs">
                <th className="py-1.5 pr-3 font-semibold">Prayer</th>
                <th className="py-1.5 px-2 font-semibold">On time</th>
                <th className="py-1.5 px-2 font-semibold">Late</th>
                <th className="py-1.5 px-2 font-semibold">Owned</th>
                <th className="py-1.5 px-2 font-semibold">Not logged</th>
                <th className="py-1.5 px-2 font-semibold">Mosque</th>
                <th className="py-1.5 pl-2 font-semibold w-1/3">Kept</th>
              </tr>
            </thead>
            <tbody>
              {h.byPrayer.map((p) => (
                <tr key={p.prayer} className={`border-t border-line ${h.weakest?.prayer === p.prayer ? "text-bad" : ""}`}>
                  <td className="py-2 pr-3 whitespace-nowrap font-medium">{p.label}</td>
                  <td className="py-2 px-2 tabular-nums">{p.onTime}</td>
                  <td className="py-2 px-2 tabular-nums">{p.late || <span className="muted">—</span>}</td>
                  <td className="py-2 px-2 tabular-nums">{p.missed || <span className="muted">—</span>}</td>
                  <td className="py-2 px-2 tabular-nums">{p.notLogged || <span className="muted">—</span>}</td>
                  <td className="py-2 px-2 tabular-nums">{p.mosque || <span className="muted">—</span>}</td>
                  <td className="py-2 pl-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2 flex-1 rounded-full bg-panel-2 overflow-hidden">
                        <span className={`block h-full ${p.share >= 0.8 ? "bg-good" : p.share >= 0.5 ? "bg-warn" : "bg-bad"}`} style={{ width: `${Math.round(p.share * 100)}%` }} />
                      </span>
                      <span className="tabular-nums text-xs muted w-9 text-right">{Math.round(p.share * 100)}%</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {h.weakest && (
          <p className="text-xs">
            <b>{h.weakest.label}</b> is the one to talk about: on time on {h.weakest.onTime} of {h.totals.days} days
            {h.weakest.notLogged > 0 && <>, and never logged on {h.weakest.notLogged}</>}.
          </p>
        )}
      </section>

      {/* ── Day by day ────────────────────────────────────────────────────── */}
      <section className="card space-y-2">
        <h2 className="h2">Day by day</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs muted">
          {(Object.keys(CELL) as Cell[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5"><span className={CELL[k].cls}>{CELL[k].text}</span>{CELL[k].title}</span>
          ))}
        </div>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left muted text-xs">
                <th className="py-1.5 pr-3 font-semibold">Day</th>
                {PRAYERS.map((p) => <th key={p} className="py-1.5 px-2 font-semibold text-center">{PRAYER_LABEL[p]}</th>)}
                <th className="py-1.5 pl-2 font-semibold text-right">Kept</th>
              </tr>
            </thead>
            <tbody>
              {[...h.days].reverse().map((d) => (
                <tr key={d.date} className="border-t border-line">
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {DAY_NAMES[new Date(d.date + "T00:00:00Z").getUTCDay()]}
                    <span className="muted text-xs ml-1">{d.date.slice(5)}</span>
                  </td>
                  {PRAYERS.map((p) => (
                    <td key={p} className="py-1.5 px-2 text-center">
                      <span className={CELL[d.cells[p]].cls} title={CELL[d.cells[p]].title}>{CELL[d.cells[p]].text}</span>
                    </td>
                  ))}
                  <td className={`py-1.5 pl-2 text-right tabular-nums text-xs ${d.allOnTime ? "text-good" : d.logged === 0 ? "muted" : ""}`}>
                    {d.onTime}/5
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
