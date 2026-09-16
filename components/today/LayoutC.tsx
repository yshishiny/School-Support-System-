import Link from "next/link";
import { PrayerPill } from "@/components/PrayerPill";
import { ConsequenceCard } from "@/components/ConsequenceCard";
import { PrayButton } from "./PrayButton";
import { PrayerDots } from "./PrayerDots";
import { subjectEmoji } from "@/lib/plan";
import type { TodayData } from "./types";

/** Option C: the hero picture full-bleed with the name over it, a "Do now" bar, four bento tiles, classes as chips, the coach box. */
export function LayoutC({ d }: { d: TodayData }) {
  const now = d.queue[0];
  const next = d.prayerRows.find((r) => r.startMs > Date.now());
  const missing = d.allowance ? Math.max(0, 90 - d.allowance.score) : 0;
  return (
    <main className="space-y-3 -mt-4 -mx-4">
      <div className="relative h-[210px] overflow-hidden rounded-b-[32px]" style={d.bannerUrl ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 30%, var(--color-bg) 100%), url(${d.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center 20%" } : { background: "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 20%, var(--color-panel-2)), var(--color-bg))" }}>
        {!d.bannerUrl && <div className="absolute inset-0 flex items-center justify-center gap-4 text-7xl opacity-25 select-none" aria-hidden>{d.stickers.slice(0, 3).join(" ")}</div>}
        <div className="absolute top-3 right-3"><PrayerPill rows={d.prayerRows} onTimeCount={d.onTimeCount} /></div>
        <div className="absolute inset-x-4 bottom-4 flex items-end gap-3">
          <Link href="/me" className="h-14 w-14 shrink-0 rounded-2xl border-[3px] border-accent bg-panel flex items-center justify-center text-2xl overflow-hidden">
            {d.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : d.avatarEmoji}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="h1 leading-none truncate drop-shadow">{d.firstName}</div>
            <div className="text-xs text-ink/80">Level {d.level.level} · {d.tagline}</div>
          </div>
          <Link href="/rewards" className="text-right">
            <div className="font-bold text-2xl text-accent-2 leading-none drop-shadow" style={{ fontFamily: "var(--font-display)" }}>{d.balance.toLocaleString()}</div>
            <div className="text-[11px] text-ink/80">points</div>
          </Link>
        </div>
      </div>

      <div className="px-4 space-y-3">
        <ConsequenceCard items={d.consequences} />

        {now && (
          now.kind === "prayer" && now.prayer ? (
            <div className="card flex items-center gap-3 text-[#1a1400]" style={{ background: "linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, var(--color-accent-2)))", boxShadow: "0 8px 22px color-mix(in srgb, var(--color-accent) 35%, transparent)" }}>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-80" style={{ fontFamily: "var(--font-display)" }}>Do now</div>
                <div className="font-bold text-lg truncate" style={{ fontFamily: "var(--font-display)" }}>🕌 {now.title}</div>
              </div>
              <PrayButton prayer={now.prayer} label={`🤲 ${now.cta}`} className="btn-ghost btn-sm !bg-black/15 !border-black/20 !text-[#1a1400]" />
            </div>
          ) : (
            <Link href={now.href ?? "#"} className="card flex items-center gap-3 text-[#1a1400]" style={{ background: "linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, var(--color-accent-2)))", boxShadow: "0 8px 22px color-mix(in srgb, var(--color-accent) 35%, transparent)" }}>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-80" style={{ fontFamily: "var(--font-display)" }}>{now.kind === "done" ? "Today" : "Do now"}</div>
                <div className="font-bold text-lg truncate" style={{ fontFamily: "var(--font-display)" }}>{now.title}</div>
                <div className="text-xs opacity-80 truncate">{now.subtitle}{now.chips.length ? ` · ${now.chips[0]}` : ""}</div>
              </div>
              <div className="h-11 w-11 rounded-full bg-black/80 flex items-center justify-center text-accent text-lg">▶</div>
            </Link>
          )
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/rewards" className="tile space-y-1.5">
            <div className="text-[11px] muted">Allowance</div>
            <div className="font-bold text-2xl leading-none text-accent-2" style={{ fontFamily: "var(--font-display)" }}>{d.allowance ? d.allowance.amount : "—"}<span className="text-xs muted font-semibold"> {d.allowance ? "EGP" : ""}</span></div>
            <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden"><div className={`h-full ${d.allowanceTone === "good" ? "bg-good" : d.allowanceTone === "warn" ? "bg-warn" : "bg-bad"}`} style={{ width: `${d.allowance?.score ?? 0}%` }} /></div>
            <div className="text-[11px] muted">{d.allowance ? (d.allowanceTone === "good" ? `on track · day ${d.allowance.elapsedDays}/7` : missing ? `${missing} pts to full` : "week gone") : "not set up"}</div>
          </Link>
          <div className="tile space-y-1.5">
            <div className="text-[11px] muted">Prayers</div>
            <PrayerDots rows={d.prayerRows} size={20} />
            <div className="font-bold text-base" style={{ fontFamily: "var(--font-display)" }}>{next ? `${next.prayer[0].toUpperCase()}${next.prayer.slice(1)} ${next.time}` : "All five ✓"}</div>
            <div className="text-[11px] muted">{d.onTimeCount}/5 on time</div>
          </div>
          <Link href="/checkin" className="tile space-y-1">
            <div className="text-[11px] muted">Check-in</div>
            <div className="font-bold text-base" style={{ fontFamily: "var(--font-display)" }}>{d.checkinDone ? "Done ✓" : "Tonight"}</div>
            <div className="text-[11px] muted">{d.classesToday ? `${d.classesToday} classes · +${10 + Math.min(5, d.classesToday) * 2} pts` : "+10 pts"}</div>
            <div className="btn-ghost btn-sm text-center mt-1">{d.checkinDone ? "Update" : "Open"}</div>
          </Link>
          <div className="tile space-y-1">
            <div className="text-[11px] muted">Streak</div>
            <div className="font-bold text-2xl leading-none" style={{ fontFamily: "var(--font-display)" }}>{d.streak} 🔥</div>
            <div className="text-[11px] muted">{d.streak >= 7 ? "on a roll" : `${7 - (d.streak % 7)} more = bonus`}</div>
            <div className="flex gap-0.5 mt-1">{Array.from({ length: 7 }, (_, k) => <div key={k} className={`flex-1 h-1.5 rounded ${k < d.streak % 7 || (d.streak > 0 && d.streak % 7 === 0) ? "bg-good" : "bg-panel-2"}`} />)}</div>
          </div>
        </div>

        {d.queue.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {d.queue.slice(1, 5).map((it) => (
              <Link key={it.key} href={it.href ?? "#"} className="badge shrink-0 !py-1.5">{it.title} ›</Link>
            ))}
          </div>
        )}

        {d.todayRows.length > 0 && (
          <>
            <div className="text-[11px] font-bold uppercase tracking-wider muted" style={{ fontFamily: "var(--font-display)" }}>Today at school</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {d.todayRows.map((t) => <span key={t.id} className="badge shrink-0">{subjectEmoji(t.subject_name)} {t.start_time.slice(0, 5)} {t.subject_name}</span>)}
            </div>
          </>
        )}

        {d.coachLine && (
          <Link href="/coach?tab=plan" className="card !py-3 flex gap-2.5 items-start border-accent-2/40">
            <span className="text-2xl leading-none">🦸</span>
            <span className="text-sm leading-snug">{d.coachLine}</span>
          </Link>
        )}
      </div>
    </main>
  );
}
