import Link from "next/link";
import { SideTabs } from "@/components/SideTabs";
import { Tabs } from "@/components/Tabs";
import type { HomeData, KidView } from "./types";

function Head({ d }: { d: HomeData }) {
  return (
    <header className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs muted">{d.dateLine}</div>
        <h1 className="h1 truncate">Salam, {d.firstName}</h1>
      </div>
      <Link href="/parent/notifications" className={`relative h-10 w-10 rounded-full border-2 flex items-center justify-center text-lg ${d.unread ? "border-accent bg-accent/10" : "border-line bg-panel"}`} title="Inbox">
        🔔{d.unread > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-bad text-white text-[10px] px-1.5 leading-4 font-bold">{d.unread}</span>}
      </Link>
    </header>
  );
}

function NeedsList({ d, compact = false }: { d: HomeData; compact?: boolean }) {
  return (
    <section className="card !py-3 space-y-1">
      <div className="text-[10px] uppercase tracking-wide muted">Needs you · {d.needs.reduce((s, x) => s + x.n, 0) || "nothing"}</div>
      {d.needs.length === 0 ? <p className="text-sm muted">All caught up.</p> : (
        <ul className="divide-y divide-dashed divide-line">
          {d.needs.map((x) => (
            <li key={x.href}>
              <Link href={x.href} className="py-1.5 flex items-center gap-2 text-sm hover:text-accent-2">
                <span className="min-w-[22px] h-[22px] rounded-full bg-bad text-white text-[11px] font-bold grid place-items-center">{x.n}</span>
                <span className="flex-1">{x.emoji} {x.label}{x.n === 1 ? "" : "s"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!compact && d.allowanceEnabled && (
        <div className="tile !p-2 text-xs mt-1">
          <div className="font-semibold">Tap ✓/✗ today</div>
          {d.kids.map((k) => (
            <div key={k.id} className="muted">{k.name}: {d.kpiToday.map((p) => `${p.emoji}${k.ticks[p.code] === true ? "✓" : k.ticks[p.code] === false ? "✗" : "·"}`).join(" ")}</div>
          ))}
          <Link href="/parent?tab=kids" className="underline">open the kid tabs</Link>
        </div>
      )}
    </section>
  );
}

function KidStat({ k }: { k: KidView }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 text-center min-w-0">
      <div className="tile !p-1.5"><div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>{k.prayersOnTime}/5</div><div className="text-[10px] muted">prayers</div></div>
      <div className="tile !p-1.5"><div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>{k.classLog.done}/{k.classLog.due}</div><div className="text-[10px] muted">classes</div></div>
      <div className="tile !p-1.5"><div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>{k.quizzesDone}/{k.quizzesTotal}</div><div className="text-[10px] muted">quizzes</div></div>
      <div className="tile !p-1.5"><div className="font-bold" style={{ fontFamily: "var(--font-display)" }}>{k.snapsToday.filter((s) => s.state === "good" || s.state === "approved").length}/{k.snapsToday.filter((s) => s.state !== "none").length}</div><div className="text-[10px] muted">snaps</div></div>
    </div>
  );
}

function AllowanceRow({ k }: { k: KidView }) {
  if (!k.allowance) return null;
  return (
    <Link href="/parent/allowance" className="flex items-center gap-2 text-xs">
      <span className="muted">Allowance</span>
      <div className="flex-1 h-1.5 rounded-full bg-panel-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${k.allowance.score}%` }} /></div>
      <b>{k.allowance.amount} EGP</b>
    </Link>
  );
}

function ReportLine({ d }: { d: HomeData }) {
  return (
    <Link href="/parent/reports" className="flex items-center gap-2 text-xs muted px-1">
      <span>📨</span><span className="flex-1">{d.reportLine}</span><span className="underline">Reports</span>
    </Link>
  );
}

/** A · Command centre: to-do left, one child at a time in full-width tabs in the middle, live and inbox right. */
export function ParentLayoutA({ d }: { d: HomeData }) {
  return (
    <main className="space-y-3">
      <Head d={d} />
      {d.alerts}
      <div className="grid gap-3 lg:grid-cols-[13rem_minmax(0,1fr)_15rem]">
        <NeedsList d={d} />
        <div className="min-w-0">
          <Tabs
            storageKey="home-a-kids"
            underMenu
            tabs={d.kids.map((k) => ({
              id: k.id,
              label: `${k.name}${k.online ? " 🟢" : k.checkedIn ? " ✓" : ""}`,
              emoji: k.emoji,
              badge: k.needsCount || null,
              content: (
                <div className="space-y-2">
                  <div className="rounded-2xl border border-line bg-panel p-3 space-y-2" style={{ borderTop: `4px solid ${k.color}` }}>
                    <div className="text-xs muted">{k.online ? "🟢 online" : k.presenceLabel ?? "not online"}{k.school.off ? ` · 🏖️ ${k.school.reason}` : ` · 🏫 ${k.school.line}`}</div>
                    <KidStat k={k} />
                    <AllowanceRow k={k} />
                    {(k.classLog.missing || k.overdue.length > 0 || k.integrityCount > 0) && (
                      <div className="text-xs text-warn">{k.classLog.missing ? `📖 missing ${k.classLog.missing}` : ""}{k.overdue.length ? ` · ⏰ ${k.overdue.length} overdue` : ""}{k.integrityCount ? ` · 🔎 ${k.integrityCount} to ask tonight` : ""}</div>
                    )}
                  </div>
                  {k.card}
                </div>
              ),
            }))}
          />
        </div>
        <div className="space-y-3">
          {d.live}
          <section className="card !py-3">
            <div className="text-[10px] uppercase tracking-wide muted">Inbox · {d.unread ? `${d.unread} new` : "read"}</div>
            <Link href="/parent/notifications" className="text-sm underline">Open the inbox</Link>
          </section>
          <ReportLine d={d} />
        </div>
      </div>
    </main>
  );
}

/** B · Kid-first: a strip of four numbers, then one child at a time. */
export function ParentLayoutB({ d }: { d: HomeData }) {
  const online = d.kids.filter((k) => k.online);
  const needsN = d.needs.reduce((s, x) => s + x.n, 0);
  return (
    <main className="space-y-3">
      <Head d={d} />
      {d.alerts}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0">
        <Link href={d.needs[0]?.href ?? "/parent"} className="tile flex items-center gap-2"><span className="text-2xl">🧾</span><div><div className="font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{needsN || "0"}</div><div className="text-[11px] muted">need you</div></div></Link>
        <div className="tile flex items-center gap-2"><span className="text-2xl">{online.length ? "🟢" : "⚪"}</span><div><div className="font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{online.length ? `${online.length} online` : "nobody on"}</div><div className="text-[11px] muted truncate">{online.map((k) => `${k.name}${k.presenceLabel ? ` · ${k.presenceLabel}` : ""}`).join(", ") || "last seen in the tabs"}</div></div></div>
        <Link href="/parent/allowance" className="tile flex items-center gap-2"><span className="text-2xl">💵</span><div><div className="font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{d.allowanceEnabled ? d.kids.map((k) => k.allowance?.score ?? "—").join(" · ") : "off"}</div><div className="text-[11px] muted">allowance scores</div></div></Link>
        <Link href="/parent/notifications" className="tile flex items-center gap-2"><span className="text-2xl">🔔</span><div><div className="font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{d.unread ? `${d.unread} new` : "read"}</div><div className="text-[11px] muted">inbox</div></div></Link>
      </div>
      {d.needs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {d.needs.map((x) => <Link key={x.href} href={x.href} className="chip !border-accent/60">{x.emoji} {x.n} {x.label}{x.n === 1 ? "" : "s"}</Link>)}
        </div>
      )}
      {d.live}
      <SideTabs storageKey="home-kids" tabs={d.kids.map((k) => ({ id: k.id, label: k.name, emoji: k.emoji, color: k.color, avatarUrl: k.avatarUrl, sub: k.online ? "🟢 online" : k.checkedIn ? "✓ checked in" : "no check-in", content: k.card }))} />
      <ReportLine d={d} />
    </main>
  );
}

const PRAYER_LABEL: Record<string, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

function Chip({ tone, children }: { tone: "good" | "warn" | "bad" | "plain"; children: React.ReactNode }) {
  const cls = tone === "good" ? "bg-good/20 text-good" : tone === "warn" ? "bg-warn/25 text-warn" : tone === "bad" ? "bg-bad/15 text-bad" : "bg-panel-2";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

function prayerChip(k: KidView, name: string) {
  const p = k.prayers.find((x) => x.prayer === name);
  const tone = !p?.status ? "plain" : p.status === "on_time" ? "good" : p.status === "late" ? "warn" : "bad";
  return <Chip tone={tone}>{PRAYER_LABEL[name]} {p?.status ? (p.status === "on_time" ? "✓" : p.status === "late" ? "late" : "✗") : "—"}</Chip>;
}
function snapChip(k: KidView, code: string) {
  const s = k.snapsToday.find((x) => x.code === code);
  if (!s || s.state === "none") return null;
  const tone = s.state === "good" || s.state === "approved" ? "good" : s.state === "sent" ? "warn" : s.state === "rejected" || s.state === "closed" ? "bad" : "plain";
  return <Chip tone={tone}>{s.emoji} {s.label} {s.state === "good" || s.state === "approved" ? "✓" : s.state === "sent" ? "sent" : s.state === "rejected" ? "sent back" : s.state === "closed" ? "missed" : "due"}</Chip>;
}
function tickChip(k: KidView, code: string, label: string) {
  const v = k.ticks[code];
  return <Chip tone={v === true ? "good" : v === false ? "bad" : "plain"}>{label} {v === true ? "✓" : v === false ? "✗" : "·"}</Chip>;
}

/** C · The day as a timeline: morning to night, every child side by side. */
export function ParentLayoutC({ d }: { d: HomeData }) {
  const cols = `52px repeat(${d.kids.length}, minmax(0, 1fr))`;
  const slots: { when: string; label: string; cell: (k: KidView) => React.ReactNode }[] = [
    { when: "dawn", label: "Fajr · bed", cell: (k) => <>{prayerChip(k, "fajr")}{snapChip(k, "bed")}</> },
    { when: "school", label: "School", cell: (k) => <>{k.school.off ? <Chip tone="plain">🏖️ {k.school.reason}</Chip> : <span className="text-[11px] muted block">{k.school.line}</span>}{k.classLog.due > 0 && <Chip tone={k.classLog.done === k.classLog.due ? "good" : "warn"}>📖 {k.classLog.done}/{k.classLog.due} logged</Chip>}</> },
    { when: "noon", label: "Dhuhr · Asr · dish", cell: (k) => <>{prayerChip(k, "dhuhr")}{prayerChip(k, "asr")}{d.allowanceEnabled && tickChip(k, "dish", "🍽️ Dish")}{snapChip(k, "dish")}</> },
    { when: "pm", label: "Homework · quizzes", cell: (k) => <>{k.quizzesTotal > 0 && <Chip tone={k.quizzesDone === k.quizzesTotal ? "good" : k.quizzesDone ? "warn" : "plain"}>📅 {k.quizzesDone}/{k.quizzesTotal} quizzes</Chip>}{k.overdue.length > 0 && <Chip tone="bad">⏰ {k.overdue.length} overdue</Chip>}{k.tests.length > 0 && <Chip tone="warn">🎯 {k.tests[0]}</Chip>}{snapChip(k, "homework")}</> },
    { when: "eve", label: "Maghrib · Isha · desk · phone", cell: (k) => <>{prayerChip(k, "maghrib")}{prayerChip(k, "isha")}{snapChip(k, "desk")}{d.allowanceEnabled && tickChip(k, "manners", "🤝 Manners")}{d.allowanceEnabled && tickChip(k, "phone", "📵 Phone")}</> },
    { when: "night", label: "Check-in", cell: (k) => <Chip tone={k.checkedIn ? "good" : "warn"}>{k.checkedIn ? `✓ ${k.checkinTime ?? "checked in"}${k.checkinLate ? " (later)" : ""}` : "not yet"}</Chip> },
  ];
  return (
    <main className="space-y-3">
      <Head d={d} />
      {d.alerts}
      <div className="grid gap-3 lg:grid-cols-[1fr_15rem]">
        <section className="card overflow-x-auto">
          <div className="grid gap-2 items-end pb-1 border-b border-line" style={{ gridTemplateColumns: cols }}>
            <span className="text-[10px] uppercase tracking-wide muted">{d.today.slice(5)}</span>
            {d.kids.map((k) => (
              <div key={k.id} className="flex items-center gap-1.5 font-bold text-sm pb-1" style={{ borderBottom: `3px solid ${k.color}`, fontFamily: "var(--font-display)" }}>
                {k.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={k.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : <span>{k.emoji}</span>}
                <span className="truncate">{k.name}</span>{k.online && <span title="online">🟢</span>}
              </div>
            ))}
          </div>
          {slots.map((s) => (
            <div key={s.when} className="grid gap-2 py-2 border-b border-line last:border-0" style={{ gridTemplateColumns: cols }}>
              <div className="text-[10px] muted leading-tight pt-0.5"><b className="block text-ink text-[11px]" style={{ fontFamily: "var(--font-display)" }}>{s.label.split(" · ")[0]}</b>{s.label.split(" · ").slice(1).join(" · ")}</div>
              {d.kids.map((k) => <div key={k.id} className="flex flex-wrap gap-1 content-start min-w-0">{s.cell(k)}</div>)}
            </div>
          ))}
          <div className="grid gap-2 pt-2" style={{ gridTemplateColumns: cols }}>
            <span />
            {d.kids.map((k) => <details key={k.id} className="min-w-0"><summary className="cursor-pointer text-xs underline muted">{k.name}&apos;s full card</summary><div className="mt-2">{k.card}</div></details>)}
          </div>
        </section>
        <div className="space-y-3">
          <NeedsList d={d} compact />
          {d.allowanceEnabled && (
            <section className="card !py-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide muted">Allowance week</div>
              {d.kids.map((k) => <div key={k.id} className="flex items-center gap-2 text-xs"><span className="w-14 truncate">{k.name}</span><AllowanceRow k={{ ...k, allowance: k.allowance }} /></div>)}
            </section>
          )}
          {d.live}
          <ReportLine d={d} />
        </div>
      </div>
    </main>
  );
}

/** "2 hours ago", from an ISO timestamp, without dragging a date library onto the page. */
function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/** One child's face and name. Nothing else: everything about him is one tap away, on his own page. */
function KidFace({ k }: { k: KidView }) {
  return (
    <Link href={`/parent/trace/${k.id}`} className="group flex flex-col items-center gap-1.5 w-[4.5rem] shrink-0" title={k.name}>
      <span className="relative">
        <span className="h-16 w-16 rounded-full overflow-hidden border-2 border-line bg-panel-2 grid place-items-center text-2xl transition group-hover:border-accent">
          {k.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : k.emoji}
        </span>
        {k.online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-good border-2 border-panel" title="online" />}
        {k.needsCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-bad text-white text-[11px] font-bold grid place-items-center border-2 border-panel">
            {k.needsCount}
          </span>
        )}
      </span>
      <span className="text-xs font-semibold truncate max-w-full transition group-hover:text-accent-2" style={{ fontFamily: "var(--font-display)" }}>
        {k.name}
      </span>
    </Link>
  );
}

/**
 * The home page, answering one question: what do I need to know?
 *
 * The three arrangements above all put every child's full card on the front page — eleven facts each, six
 * children, before a parent has decided he cares about any of them. This one carries what happened and what is
 * waiting on a decision, and shows the children as faces alone. Everything about a child lives on his page,
 * which is one tap from here and holds all of it rather than a chosen eleventh.
 */
export function ParentLayoutD({ d }: { d: HomeData }) {
  const needsN = d.needs.reduce((s, x) => s + x.n, 0);
  return (
    <div className="space-y-4">
      <Head d={d} />
      {d.alerts}

      {/* Decisions waiting on him, before anything that merely happened. */}
      {d.needs.length > 0 && (
        <section className="card !py-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wide muted">Waiting on you · {needsN}</div>
          <ul className="divide-y divide-dashed divide-line">
            {d.needs.map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="py-2 flex items-center gap-2.5 text-sm hover:text-accent-2">
                  <span className="min-w-[22px] h-[22px] rounded-full bg-bad text-white text-[11px] font-bold grid place-items-center shrink-0">{x.n}</span>
                  <span className="flex-1">{x.emoji} {x.label}{x.n === 1 ? "" : "s"}</span>
                  <span className="muted shrink-0" aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The children, as faces. */}
      <section className="card !py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wide muted">Your children</div>
          <Link href="/parent/trace" className="text-xs muted hover:text-accent-2">Money and proof →</Link>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {d.kids.map((k) => <KidFace key={k.id} k={k} />)}
        </div>
        <p className="text-[11px] muted">Tap a face for everything about him — school, manners, duties, prayers, money.</p>
      </section>

      {/* The one thing a parent does from this page rather than reads. */}
      {d.allowanceEnabled && d.kpiToday.length > 0 && (
        <section className="card !py-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide muted">Today&rsquo;s taps</div>
          <p className="text-[11px] muted -mt-0.5">A basic nobody taps pays half. One tap each, per child.</p>
          {d.kids.map((k) => (
            <div key={k.id} className="flex items-center gap-2 text-sm">
              <span className="w-16 shrink-0 truncate text-xs">{k.name}</span>
              <span className="flex gap-1.5">
                {d.kpiToday.map((p) => (
                  <span key={p.code} title={p.label} className={k.ticks[p.code] === true ? "text-good" : k.ticks[p.code] === false ? "text-bad" : "muted"}>
                    {p.emoji}{k.ticks[p.code] === true ? "✓" : k.ticks[p.code] === false ? "✗" : "·"}
                  </span>
                ))}
              </span>
            </div>
          ))}
          <Link href="/parent/manners" className="btn-ghost btn-sm mt-1">Tap today&rsquo;s basics →</Link>
        </section>
      )}

      {/* What happened. */}
      <section className="card !py-3 space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wide muted">What happened</div>
          <Link href="/parent/notifications" className="text-xs muted hover:text-accent-2">Inbox →</Link>
        </div>
        {d.events.length === 0 ? (
          <p className="text-sm muted py-2">Nothing yet today.</p>
        ) : (
          <ul className="divide-y divide-line">
            {d.events.slice(0, 15).map((e) => {
              const body = e.body.split("\n")[0];
              const row = (
                <>
                  <span className="flex items-baseline gap-2">
                    {e.unread && <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" aria-label="unread" />}
                    <span className={`flex-1 min-w-0 text-sm ${e.unread ? "font-semibold" : ""}`}>{e.title}</span>
                    <span className="shrink-0 text-[11px] muted tabular-nums">{ago(e.at)}</span>
                  </span>
                  {body && <span className="block text-xs muted truncate mt-0.5">{body}</span>}
                </>
              );
              return (
                <li key={e.id} className="py-2">
                  {e.url ? <Link href={e.url} className="block hover:text-accent-2">{row}</Link> : row}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {d.live}
    </div>
  );
}
