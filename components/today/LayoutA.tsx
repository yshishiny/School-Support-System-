import Link from "next/link";
import { PrayerPill } from "@/components/PrayerPill";
import { ConsequenceCard } from "@/components/ConsequenceCard";
import { PrayButton } from "./PrayButton";
import { PrayerDots } from "./PrayerDots";
import type { TodayData } from "./types";
import { HeroBanner } from "./HeroBanner";

const ICON: Record<string, string> = { prayer: "🕌", quiz: "⚡", check: "💓", checkin: "✅", recall: "🤔", review: "🔁", catchup: "⏰", learner: "🦸", done: "🎉" };

/** Option A: a compact hero, then the three things of the day ranked, prayers as dots, a week strip, one coach line. */
export function LayoutA({ d }: { d: TodayData }) {
  const next = d.prayerRows.find((r) => r.startMs > Date.now());
  const top = d.queue.slice(0, 3);
  return (
    <main className="space-y-3">
      <ConsequenceCard items={d.consequences} />
      {d.bannerUrl && d.banner.fit === "full" && (
        <div className="-mx-4 -mt-4"><HeroBanner url={d.bannerUrl} fit="full" zoom={1} x={50} y={50} rounded="rounded-b-[28px]" /></div>
      )}
      <header className="card relative overflow-hidden space-y-3" style={d.bannerUrl && d.banner.fit === "cover" ? { backgroundImage: `linear-gradient(90deg, color-mix(in srgb, var(--color-panel) 94%, transparent) 40%, color-mix(in srgb, var(--color-panel) 60%, transparent)), url(${d.bannerUrl})`, backgroundSize: `auto, ${d.banner.zoom * 100}% auto`, backgroundPosition: `center, ${d.banner.x}% ${d.banner.y}%`, backgroundRepeat: "no-repeat" } : undefined}>
        <div className="flex items-center gap-3">
          <Link href="/me" className="ring h-16 w-16 shrink-0 rounded-full p-[3px]" style={{ ["--pct" as string]: (d.level.into / d.level.span) * 100 }}>
            {d.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="h-full w-full rounded-full bg-panel flex items-center justify-center text-3xl">{d.avatarEmoji}</div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="h1 truncate leading-tight">Hey {d.firstName}</div>
            <div className="text-xs muted truncate">Level {d.level.level} · {d.level.into}/{d.level.span} XP · {d.tagline}</div>
          </div>
          <div className="flex items-start gap-1.5">
            <Link href="/rewards" className="badge text-base"><b className="text-accent-2">{d.balance.toLocaleString()}</b> ★</Link>
            <PrayerPill rows={d.prayerRows} onTimeCount={d.onTimeCount} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="tile !p-2.5"><div className="text-[11px] muted">Streak</div><div className="font-bold text-lg" style={{ fontFamily: "var(--font-display)" }}>{d.streak} 🔥</div></div>
          <Link href="/rewards" className="tile !p-2.5"><div className="text-[11px] muted">Allowance</div><div className="font-bold text-lg text-accent-2" style={{ fontFamily: "var(--font-display)" }}>{d.allowance ? `${d.allowance.amount} EGP` : `Lvl ${d.level.level}`}</div></Link>
          <div className="tile !p-2.5"><div className="text-[11px] muted">Next prayer</div><div className="font-bold text-lg" style={{ fontFamily: "var(--font-display)" }}>{next ? `${next.prayer[0].toUpperCase()}${next.prayer.slice(1, 3)} ${next.time}` : "Done ✓"}</div></div>
        </div>
      </header>

      <div className="text-[11px] font-bold uppercase tracking-wider muted px-1" style={{ fontFamily: "var(--font-display)" }}>Today · {d.totalToday} thing{d.totalToday === 1 ? "" : "s"}</div>
      <div className="space-y-2">
        {top.map((it, i) => {
          const primary = i === 0 && it.kind !== "done";
          const inner = (
            <>
              <div className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center text-2xl ${primary ? "bg-black/10" : "bg-accent/10"}`}>{ICON[it.kind] ?? "⭐"}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{ fontFamily: "var(--font-display)" }}>{it.title}</div>
                <div className={`text-xs truncate ${primary ? "opacity-80" : "muted"}`}>{it.subtitle}{it.chips.length ? ` · ${it.chips.join(" ")}` : ""}</div>
              </div>
            </>
          );
          const cls = `card flex items-center gap-3 ${primary ? "!bg-none text-[#1a1400]" : ""}`;
          const style = primary ? { background: "linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, var(--color-accent-2)))", boxShadow: "0 8px 22px color-mix(in srgb, var(--color-accent) 40%, transparent)" } : undefined;
          if (it.kind === "prayer" && it.prayer) {
            return (
              <div key={it.key} className={cls} style={style}>
                {inner}
                <PrayButton prayer={it.prayer} label={`🤲 ${it.cta}`} className={primary ? "btn-ghost btn-sm !bg-black/15 !border-black/20 !text-[#1a1400]" : "btn-primary btn-sm"} />
              </div>
            );
          }
          return (
            <Link key={it.key} href={it.href ?? "#"} className={cls} style={style}>
              {inner}
              <span className={primary ? "rounded-full bg-black/80 text-accent px-3 py-1.5 text-sm font-bold" : "btn-ghost btn-sm"} style={{ fontFamily: "var(--font-display)" }}>{it.cta}</span>
            </Link>
          );
        })}
      </div>

      <div className="card !py-3 flex items-center gap-3">
        <div className="font-semibold flex-1" style={{ fontFamily: "var(--font-display)" }}>Prayers</div>
        <PrayerDots rows={d.prayerRows} />
      </div>

      <div className="flex gap-1.5">
        {d.weekStrip.map((w) => (
          <div key={w.label} className={`flex-1 rounded-2xl border-2 py-1.5 text-center text-[11px] font-bold ${w.isToday ? "border-accent bg-accent/15 text-accent-2" : w.past && w.total > 0 && w.done === w.total ? "border-good/60 bg-good/15" : "border-line muted"}`}>
            {w.label}<br /><span className="text-sm">{w.total ? (w.done === w.total ? "✓" : `${w.done}/${w.total}`) : "·"}</span>
          </div>
        ))}
      </div>

      {d.todayRows.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 px-0.5">
          {d.todayRows.map((t) => <span key={t.id} className="badge shrink-0">{t.start_time.slice(0, 5)} {t.subject_name}</span>)}
        </div>
      )}

      {d.coachLine && (
        <Link href="/coach?tab=plan" className="flex gap-2.5 items-start px-1 text-sm">
          <span className="text-2xl leading-none">🦸</span>
          <span className="leading-snug"><b>Coach:</b> {d.coachLine}</span>
        </Link>
      )}
    </main>
  );
}
