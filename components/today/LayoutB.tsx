import Link from "next/link";
import { PrayerPill } from "@/components/PrayerPill";
import { NowCard } from "@/components/NowCard";
import { ConsequenceCard } from "@/components/ConsequenceCard";
import { subjectEmoji } from "@/lib/plan";
import type { TodayData } from "./types";

/** Option B: one big Now card, a short queue, one bar for the week, classes as chips, the coach as a speech bubble. */
export function LayoutB({ d }: { d: TodayData }) {
  const [nowItem, ...rest] = d.queue;
  return (
    <main className="space-y-3">
      <div className="flex items-center gap-2.5">
        <Link href="/me" className="shrink-0 ring h-11 w-11 rounded-full p-[2px]" style={{ ["--pct" as string]: (d.level.into / d.level.span) * 100 }}>
          {d.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            <div className="h-full w-full rounded-full bg-panel flex items-center justify-center text-xl">{d.avatarEmoji}</div>
          )}
        </Link>
        <div className="h2 flex-1 truncate leading-tight">{d.firstName}</div>
        <Link href="/rewards" className="badge text-sm"><b className="text-accent-2">{d.balance.toLocaleString()}</b> ★</Link>
        <PrayerPill rows={d.prayerRows} onTimeCount={d.onTimeCount} />
      </div>

      <ConsequenceCard items={d.consequences} />
      <NowCard item={nowItem} index={0} total={d.totalToday} mascot={d.mascot} />

      {rest.length > 0 && (
        <section className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider muted px-1" style={{ fontFamily: "var(--font-display)" }}>Up next</div>
          {rest.slice(0, 4).map((it) => (
            <Link key={it.key} href={it.href ?? "#"} className="card !py-3 flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${it.kind === "quiz" ? "bg-accent" : it.kind === "checkin" ? "bg-good" : it.kind === "prayer" ? "bg-warn" : "bg-accent-2"}`} />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{ fontFamily: "var(--font-display)" }}>{it.title}</div>
                <div className="text-xs muted truncate">{it.subtitle}{it.chips.length ? ` · ${it.chips[0]}` : ""}</div>
              </div>
              <span className="text-muted">›</span>
            </Link>
          ))}
        </section>
      )}

      <section className="card space-y-2">
        <div className="flex items-center gap-2">
          <div className="h2 flex-1">This week</div>
          {d.allowance ? (
            <div className="font-bold text-accent-2" style={{ fontFamily: "var(--font-display)" }}>{d.allowance.amount} EGP · {d.allowanceTone === "good" ? "on track" : d.allowanceTone === "warn" ? "at risk" : "gone"}</div>
          ) : (
            <div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>Level {d.level.level}</div>
          )}
        </div>
        <div className="h-2.5 rounded-full bg-panel-2 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${d.allowance ? d.allowance.score : Math.round((d.level.into / d.level.span) * 100)}%`, background: "linear-gradient(90deg, var(--color-good), var(--color-accent))" }} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs muted">
          {d.allowance && <span>Score {d.allowance.score} · day {d.allowance.elapsedDays}/7</span>}
          <span>Streak {d.streak} 🔥</span>
          <span>{d.quizzesDoneWeek} quiz{d.quizzesDoneWeek === 1 ? "" : "zes"} done</span>
          <span>{d.onTimeCount}/5 prayers on time</span>
          {d.allowance && <Link href="/rewards" className="underline">details</Link>}
        </div>
      </section>

      {d.todayRows.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 px-0.5">
          {d.todayRows.map((t) => <span key={t.id} className="badge shrink-0">{subjectEmoji(t.subject_name)} {t.start_time.slice(0, 5)} {t.subject_name}</span>)}
        </div>
      )}

      {d.coachLine && (
        <Link href="/coach?tab=plan" className="flex items-end gap-2.5">
          <span className="text-3xl sticker-still">🦸</span>
          <div className="flex-1 rounded-2xl rounded-bl-md border-2 border-accent/40 bg-accent/10 px-3 py-2 text-sm leading-snug">{d.coachLine}</div>
        </Link>
      )}

      <div className="flex justify-center gap-4 text-xs muted pt-1">
        <Link href="/checkin">Check-in page</Link>
        <Link href="/learn?tab=me">This week&apos;s quizzes</Link>
        <Link href="/me#layout">Home style</Link>
      </div>
    </main>
  );
}
