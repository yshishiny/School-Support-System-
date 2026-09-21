import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent } from "@/lib/auth";
import { traceFor } from "@/lib/trace/load";
import { markAllowancePaidAction } from "@/lib/actions/allowance";
import { verdict } from "@/lib/trace";
import { RATING_LABEL, type Dimension, type Rating } from "@/lib/evaluation";
import { mismatchLine, payoutOf } from "@/lib/rewards/money";
import { subjectEmoji } from "@/lib/plan";
import { prettyDate, todayIn } from "@/lib/dates";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TONE: Record<Rating, { dot: string; text: string }> = {
  strong: { dot: "bg-good", text: "text-good" },
  steady: { dot: "bg-accent", text: "" },
  slipping: { dot: "bg-warn", text: "text-warn" },
  poor: { dot: "bg-bad", text: "text-bad" },
  unknown: { dot: "bg-muted", text: "muted" },
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

function Figure({ value, unit, label, tone }: { value: string | number; unit?: string; label: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className={`text-3xl font-bold leading-none ${tone ?? ""}`} style={{ fontFamily: "var(--font-display)" }}>
        {value}
        {unit && <span className="text-sm font-semibold muted ml-1">{unit}</span>}
      </div>
      <div className="text-[11px] uppercase tracking-wide muted mt-1.5">{label}</div>
    </div>
  );
}

/** One line of the evaluation: the verdict, why, and a jump to the detail that proves it. */
function Row({ d }: { d: Dimension }) {
  const t = TONE[d.rating];
  return (
    <a href={d.anchor} className="group flex items-start gap-3 py-3 border-t border-line first:border-0 -mx-1 px-1 rounded-lg hover:bg-panel-2/50 transition">
      <span className="text-xl shrink-0 leading-none mt-0.5">{d.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold">{d.label}</span>
          <span className={`inline-flex items-center gap-1.5 text-xs ${t.text}`}>
            <span className={`h-2 w-2 rounded-full ${t.dot}`} />
            {RATING_LABEL[d.rating]}
          </span>
        </span>
        <span className="block text-sm muted mt-0.5">{d.headline}</span>
        {d.evidence.length > 0 && (
          <span className="block text-xs muted mt-1">{d.evidence.join(" · ")}</span>
        )}
      </span>
      <span className="shrink-0 muted text-lg leading-none transition group-hover:text-accent-2" aria-hidden>›</span>
    </a>
  );
}

/**
 * A section whose heading is the way in.
 *
 * Every title on this page names something that has a real page of its own, and a parent reading about his son's
 * academics wants to open his academics — not hunt for a small grey button at the bottom of the card. The
 * heading carries the link, scoped to this child wherever the destination can take a child (`?tab=<id>` is what
 * the side menus on those pages read). `hint` says what is through the door, so the tap is never a guess.
 */
function Section({ id, title, href, hint, children }: { id: string; title: string; href?: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card space-y-2 scroll-mt-4">
      {href ? (
        <Link href={href} className="group flex items-baseline gap-2 -mx-1 px-1 rounded-lg hover:bg-panel-2/50 transition">
          <h2 className="h2 group-hover:text-accent-2 transition">{title}</h2>
          {hint && <span className="text-xs muted hidden sm:inline truncate">{hint}</span>}
          <span className="ml-auto shrink-0 muted text-lg leading-none transition group-hover:text-accent-2" aria-hidden>›</span>
        </Link>
      ) : (
        <h2 className="h2">{title}</h2>
      )}
      {children}
    </section>
  );
}

/**
 * One child, the whole width, every discipline.
 *
 * The order is the order a parent asks: how is he, then why do you say that, then the detail behind each. What
 * used to live on Progress is folded in here, because a parent does not think of "his learning" and "his money"
 * as two destinations — they are two things about the same boy.
 */
export default async function ChildTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { family } = await requireParent();
  const t = await traceFor(family, id);
  if (!t) notFound();
  const today = todayIn(family.timezone);
  const st = t.status;
  const ev = t.evaluation;

  return (
    <main className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/parent/trace" className="btn-ghost btn-sm shrink-0">← All children</Link>
        {/* His siblings, small, so switching child never means going back out. */}
        {t.siblings.length > 0 && (
          <span className="flex items-center gap-1.5 ml-auto">
            {t.siblings.map((sib) => (
              <Link key={sib.id} href={`/parent/trace/${sib.id}`} title={sib.name} className="opacity-60 hover:opacity-100 transition">
                <Face src={sib.avatar} emoji={sib.emoji} size="h-8 w-8" />
              </Link>
            ))}
          </span>
        )}
      </div>

      <header className="flex items-center gap-4">
        <Face src={t.avatar} emoji={t.emoji} size="h-16 w-16 text-3xl" />
        <div className="min-w-0">
          <h1 className="h1 leading-tight">{t.fullName}</h1>
          <p className="muted text-sm">
            {t.grade !== null && <>Grade {t.grade} · </>}week of {prettyDate(st.start)} → {prettyDate(st.end)}
          </p>
        </div>
      </header>

      {/* ── The evaluation, before anything else ──────────────────────────── */}
      <section className="card space-y-1">
        <div className="text-[10px] uppercase tracking-wide muted">How {t.name} is doing</div>
        <p className="text-sm font-medium pb-1">{ev.verdict}</p>
        <div>{ev.dimensions.map((d) => <Row key={d.key} d={d} />)}</div>
        <p className="text-xs muted pt-1">
          Every line above opens the detail it rests on. “{RATING_LABEL.unknown}” is not a pass — it means nothing
          was recorded, which is the one thing a parent cannot judge him on.
        </p>
      </section>

      {/* ── Academic ──────────────────────────────────────────────────────── */}
      <Section id="academic" title="📚 Academic" href={`/parent/progress?tab=${t.id}`} hint="mastery, checkpoints, grade sheets">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-1">
          <Figure value={`${st.results.find((r) => r.code === "classlog")?.detail.match(/^(\d+)/)?.[1] ?? 0}`} label="Classes written up" />
          <Figure value={t.learning.recentQuizzes.length} label="Recent quizzes" />
          <Figure value={t.learning.reviewsDue} label="Reviews waiting" tone={t.learning.reviewsDue > 20 ? "text-warn" : ""} />
          <Figure value={t.learning.grades[0]?.average ?? "—"} label="School average" />
        </div>

        {t.learning.subjectsThisWeek.length > 0 && (
          <p className="text-xs muted">Subjects logged this week: {t.learning.subjectsThisWeek.join(" · ")}</p>
        )}

        {t.learning.weakest.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div>
              <div className="text-xs font-semibold muted mb-1">Weakest topics</div>
              <ul className="text-sm space-y-1">
                {t.learning.weakest.map((m) => (
                  <li key={`${m.subject}-${m.topic}`} className="flex items-baseline gap-2">
                    <span className="shrink-0">{subjectEmoji(m.subject)}</span>
                    <span className="flex-1 min-w-0 truncate">{m.topic}</span>
                    <b className={`shrink-0 tabular-nums ${m.pct < 50 ? "text-bad" : m.pct < 80 ? "text-warn" : "text-good"}`}>{m.pct}%</b>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold muted mb-1">Strongest topics</div>
              <ul className="text-sm space-y-1">
                {t.learning.strongest.map((m) => (
                  <li key={`${m.subject}-${m.topic}`} className="flex items-baseline gap-2">
                    <span className="shrink-0">{subjectEmoji(m.subject)}</span>
                    <span className="flex-1 min-w-0 truncate">{m.topic}</span>
                    <b className={`shrink-0 tabular-nums ${m.pct < 50 ? "text-bad" : m.pct < 80 ? "text-warn" : "text-good"}`}>{m.pct}%</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {t.learning.recentQuizzes.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs muted select-none">Recent quizzes, one by one</summary>
            <ul className="mt-1 divide-y divide-line">
              {t.learning.recentQuizzes.map((q, k) => (
                <li key={k} className="py-1.5 flex items-baseline gap-2">
                  <span className="muted text-xs w-14 shrink-0 tabular-nums">{q.on.slice(5)}</span>
                  <span className="flex-1 min-w-0 truncate">{q.title}</span>
                  <b className={`shrink-0 tabular-nums ${q.score / q.total < 0.5 ? "text-bad" : q.score / q.total < 0.8 ? "text-warn" : "text-good"}`}>{q.score}/{q.total}</b>
                </li>
              ))}
            </ul>
          </details>
        )}

        {t.learning.grades[0]?.appraisal && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs muted select-none">School grades sheet, {t.learning.grades[0].month}</summary>
            <p className="mt-1 text-sm whitespace-pre-wrap">{t.learning.grades[0].appraisal}</p>
          </details>
        )}

        {t.learning.coach && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs muted select-none">What the coach makes of him — {t.learning.coach.headline}</summary>
            <p className="mt-1 text-sm whitespace-pre-wrap">{t.learning.coach.parent_md}</p>
          </details>
        )}

      </Section>

      {/* ── The rest of his learning, each with its own door ──────────────── */}
      <Section id="tasks" title="📝 Tasks and homework" href={`/parent/assignments?tab=${t.id}`} hint="set, chase, mark done">
        {t.tasks.open === 0 ? (
          <p className="text-sm muted">Nothing open.</p>
        ) : (
          <>
            <p className="text-sm">
              <b className={t.tasks.overdue > 0 ? "text-bad" : ""}>{t.tasks.open} open</b>
              {t.tasks.overdue > 0 && <> · {t.tasks.overdue} overdue</>}
              {t.tasks.soon > 0 && <> · {t.tasks.soon} due this week</>}
            </p>
            <ul className="text-sm divide-y divide-line">
              {t.tasks.next.map((a, k) => (
                <li key={k} className="py-1.5 flex items-baseline gap-2">
                  <span className="flex-1 min-w-0 truncate">{a.title}</span>
                  <span className="shrink-0 text-xs muted">{a.kind}</span>
                  <span className={`shrink-0 text-xs tabular-nums ${a.due && a.due < today ? "text-bad" : "muted"}`}>{a.due ?? "no date"}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section id="practice" title="🧠 Practice and revision" href={`/parent/plan?tab=${t.id}`} hint="the quiz plan and what is waiting">
        <p className="text-sm">
          <b className={t.learning.reviewsDue > 20 ? "text-warn" : ""}>{t.learning.reviewsDue}</b> review{t.learning.reviewsDue === 1 ? "" : "s"} waiting ·{" "}
          {st.results.find((r) => r.code === "quizzes")?.detail ?? "no planned quizzes"}
        </p>
        <p className="text-xs muted">
          Reviews are the spaced practice the app schedules from what he got wrong. A pile of them means he has
          stopped opening it, not that he has forgotten more.
        </p>
      </Section>

      <Section id="files" title="📎 Extra practice from school files" href={`/parent/materials?tab=${t.id}`} hint="what the school sent, turned into sets">
        <p className="text-sm">{st.results.find((r) => r.code === "materials")?.detail ?? "no file deadlines yet"}</p>
        <p className="text-xs muted">Each file the school shares becomes practice: a first set within 3 days, a second by day 7, a third by day 14.</p>
      </Section>

      <Section id="curriculum" title="🎓 Curriculum" href="/parent/children" hint="change his curriculum or stream">
        <p className="text-sm">
          {t.curriculum.name ?? <span className="muted">No curriculum chosen yet</span>}
          {t.curriculum.grade !== null && <> · Grade {t.curriculum.grade}</>}
          {t.curriculum.stream && <> · {t.curriculum.stream}</>}
        </p>
        {t.learning.subjectsThisWeek.length > 0 && (
          <p className="text-xs muted">Subjects he logged this week: {t.learning.subjectsThisWeek.join(" · ")}</p>
        )}
      </Section>

      <Section id="coach" title="🦸 Coach" href={`/parent/progress?tab=${t.id}`} hint="ask the coach for a fresh read">
        {t.learning.coach ? (
          <>
            <p className="text-sm font-medium">{t.learning.coach.headline}</p>
            <details className="text-sm">
              <summary className="cursor-pointer text-xs muted select-none">What it says in full</summary>
              <p className="mt-1 whitespace-pre-wrap">{t.learning.coach.parent_md}</p>
            </details>
          </>
        ) : (
          <p className="text-sm muted">No coach report for {t.name} yet.</p>
        )}
      </Section>

      <Section id="reports" title="📨 Reports" href="/parent/reports" hint="the nightly study report">
        <p className="text-sm">
          {t.lastReport ? <>Last report {prettyDate(t.lastReport.date)} · {t.lastReport.status}</> : <span className="muted">No report has been sent yet.</span>}
        </p>
      </Section>

      {/* ── Manners and home duties ───────────────────────────────────────── */}
      <Section id="manners" title="🤝 Manners" href="/parent/manners" hint="the daily ✓ and ✗">
        <ul className="text-sm divide-y divide-line">
          {st.results.filter((r) => r.code === "manners").map((r) => (
            <li key={r.code} className="py-2 flex items-center gap-3">
              <span className="flex-1">{r.label}<span className="block text-xs muted">{r.detail}</span></span>
              {r.basis === "default" && <span className="badge muted text-[10px]">given</span>}
              <span className="tabular-nums text-sm">{r.earned}/{r.weight}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs muted">Only you can measure this one. One tap a day on the home page; an untapped day now pays half.</p>
      </Section>

      <Section id="duties" title="🧹 Home duties" href="/parent/snaps" hint="photos to approve">
        <ul className="text-sm divide-y divide-line">
          {st.results.filter((r) => r.code.startsWith("snap:") || r.code === "dish" || r.code === "phone").map((r) => (
            <li key={r.code} className="py-2 flex items-center gap-3">
              <span className="text-lg shrink-0">{r.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate">{r.label}</span>
                <span className="block text-xs muted">{r.detail}</span>
              </span>
              {r.basis === "default" && <span className="badge muted text-[10px] shrink-0">given</span>}
              <span className={`shrink-0 tabular-nums text-sm ${r.basis === "default" ? "muted" : r.fraction >= 0.99 ? "text-good" : r.fraction >= 0.5 ? "text-warn" : "text-bad"}`}>{r.earned}/{r.weight}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Faith and wellbeing ───────────────────────────────────────────── */}
      <Section id="faith" title="🕌 Prayers" href="#week" hint="day by day, below">
        <ul className="text-sm divide-y divide-line">
          {st.results.filter((r) => r.code === "prayers" || r.code === "checkins").map((r) => (
            <li key={r.code} className="py-2 flex items-center gap-3">
              <span className="flex-1">{r.label}<span className="block text-xs muted">{r.detail}</span></span>
              <span className={`tabular-nums text-sm ${r.fraction >= 0.99 ? "text-good" : r.fraction >= 0.5 ? "text-warn" : "text-bad"}`}>{r.earned}/{r.weight}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="wellbeing" title="💓 How he is in himself" href={`/parent/clinician/${t.id}`} hint="a letter for a doctor or a counsellor">
        <p className="text-sm">{t.wellbeing.note}</p>
        <p className="text-xs muted">
          {t.wellbeing.checks > 0 ? `${t.wellbeing.checks} check-in${t.wellbeing.checks === 1 ? "" : "s"} in the last five weeks. ` : ""}
          {t.wellbeing.signals > 0 ? `${t.wellbeing.signals} signal${t.wellbeing.signals === 1 ? "" : "s"} worth watching. ` : ""}
          What he wrote stays private to him — you see the colour, never the answers.
        </p>
      </Section>

      {/* ── Money ─────────────────────────────────────────────────────────── */}
      <Section id="money" title="🧾 Money and proof" href={`/parent/allowance?tab=${t.id}`} hint="the meter, the wallet, consequences">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-1">
          <Figure value={t.owed.handOver} unit="EGP" label="Hand over now" tone="text-accent-2" />
          <Figure value={t.owed.unpaidTotal} unit="EGP" label="Unsettled weeks" tone={t.owed.unpaidTotal > 0 ? "text-accent-2" : ""} />
          <Figure value={t.points} label="Points held" />
          <Figure value={`${st.score}/100`} label="This week's score" tone={st.blocked ? "text-bad" : ""} />
        </div>
        <p className="text-sm border-t border-line pt-2.5">{verdict(t.owed, t.name)}</p>

        {st.blocked && (
          <p className="text-sm text-bad">
            This week pays nothing: {st.blocked}. The score stands at {st.score} — the gate does not change it, only
            whether it pays.{st.blockedForGood ? " Nothing is due before pay day now, so the week is settled at 0." : " One snap on one day lifts it."}
          </p>
        )}

        {t.owed.unpaidWeeks.length > 0 && (
          <ul className="text-sm divide-y divide-line">
            {t.owed.unpaidWeeks.map((w) => (
              <li key={w.id} className="py-2.5 flex items-center gap-3">
                <span className="flex-1 min-w-0">
                  <span className="block">{prettyDate(w.week_start)} → {prettyDate(w.week_end)}</span>
                  <span className="block text-xs muted">Scored {w.score} · {w.band}{w.claimed_at ? " · he has asked for it" : ""}</span>
                </span>
                <b className="shrink-0 text-accent-2">{w.amount} EGP</b>
                <form action={markAllowancePaidAction.bind(null, w.id)} className="shrink-0">
                  <button className="btn-primary btn-sm">Mark paid</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {t.requestList.length > 0 && (
          <div className="border-t border-line pt-2">
            <div className="text-xs font-semibold muted mb-1">Reward requests waiting</div>
            <ul className="text-sm divide-y divide-line">
              {t.requestList.map((r) => {
                const pays = payoutOf({ cash_amount_egp: r.cash });
                const lie = mismatchLine(r.title, r.cash);
                return (
                  <li key={r.id} className="py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="flex-1 min-w-0">{r.emoji} <b>{r.title}</b></span>
                      <span className="shrink-0 muted text-xs">{r.pointsSpent} points</span>
                      {pays > 0 && <b className="shrink-0 text-accent-2">pays {pays} EGP</b>}
                    </div>
                    {lie && <div className="text-xs text-bad mt-0.5">{lie} Approving pays {pays} EGP.</div>}
                  </li>
                );
              })}
            </ul>
            <Link href="/parent/rewards?tab=requests" className="btn-ghost btn-sm mt-2">Approve or reject →</Link>
          </div>
        )}
      </Section>

      <Section id="rewards" title="🎁 Rewards" href="/parent/rewards?tab=requests" hint="the catalog and what he has asked for">
        <p className="text-sm">
          {t.points} points held ·{" "}
          {t.requestList.length > 0 ? <b className="text-warn">{t.requestList.length} request{t.requestList.length === 1 ? "" : "s"} waiting on you</b> : "nothing requested"}
        </p>
        <p className="text-xs muted">A reward pays what its cash amount says, never what its title says. A title that disagrees is flagged in the catalog.</p>
      </Section>

      {/* ── The week, and the ledger under everything ─────────────────────── */}
      <Section id="week" title={`📅 What ${t.name} did, day by day`}>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left muted text-xs">
                <th className="py-1.5 pr-3 font-semibold">Day</th>
                <th className="py-1.5 px-2 font-semibold">Check-in</th>
                <th className="py-1.5 px-2 font-semibold">Prayers</th>
                <th className="py-1.5 px-2 font-semibold">Classes</th>
                <th className="py-1.5 px-2 font-semibold">Quizzes</th>
                <th className="py-1.5 px-2 font-semibold">Snaps</th>
                <th className="py-1.5 pl-2 font-semibold text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {t.days.map((d) => {
                const future = d.date > today;
                const nothing = !future && !d.checkedIn && d.prayers + d.classesLogged + d.quizzesDone + d.snaps === 0;
                const cell = (n: number) => (future ? <span className="muted">·</span> : n > 0 ? n : <span className="muted">—</span>);
                return (
                  <tr key={d.date} className={`border-t border-line ${future ? "opacity-40" : ""}`}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className={nothing ? "text-bad" : ""}>{DAY_NAMES[new Date(d.date + "T00:00:00Z").getUTCDay()]}</span>
                      <span className="muted text-xs ml-1">{d.date.slice(8)}</span>
                    </td>
                    <td className="py-2 px-2">{future ? <span className="muted">·</span> : d.checkedIn ? <span className="text-good">yes</span> : <span className="muted">—</span>}</td>
                    <td className="py-2 px-2">{cell(d.prayers)}</td>
                    <td className="py-2 px-2">{cell(d.classesLogged)}</td>
                    <td className="py-2 px-2">{cell(d.quizzesDone)}</td>
                    <td className="py-2 px-2">{cell(d.snaps)}</td>
                    <td className="py-2 pl-2 text-right">{cell(d.pointsEarned)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs border-t border-line pt-2.5">
          Score {st.score}/100 → <b>{st.amount} EGP</b> ·{" "}
          <b className={st.measuredScore > 0 ? "text-good" : "text-bad"}>{st.measuredScore} earned</b> from what he did,{" "}
          <b>{st.defaultScore} given</b> for what had nothing to measure.
        </div>
        {t.weekEmpty && (
          <p className="text-xs text-bad">
            Nothing at all is recorded for {t.name} this week, yet the score is {st.score}. That is the app being
            generous with untouched columns, not evidence that he did anything.
          </p>
        )}
      </Section>

      <Section id="ledger" title="🧮 Every entry">
        <p className="text-xs muted">Each figure on this page comes from one of these lines.</p>
        {t.lines.length === 0 ? <p className="text-sm muted">Nothing recorded yet.</p> : (
          <ul className="text-sm divide-y divide-line max-h-[28rem] overflow-y-auto">
            {t.lines.map((l, k) => (
              <li key={`${l.on}-${k}`} className="py-2 flex items-baseline gap-3">
                <span className="muted text-xs whitespace-nowrap w-24 shrink-0 tabular-nums">{l.on.slice(5)}{l.at ? ` ${l.at}` : ""}</span>
                <span className="flex-1 min-w-0">{l.what}</span>
                {l.points !== null && <b className={`shrink-0 tabular-nums ${l.points >= 0 ? "text-good" : "text-bad"}`}>{l.points > 0 ? "+" : ""}{l.points}</b>}
                {l.egp !== null && <b className={`shrink-0 tabular-nums ${l.egp >= 0 ? "text-accent-2" : "muted"}`}>{l.egp > 0 ? "+" : ""}{l.egp} EGP</b>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
