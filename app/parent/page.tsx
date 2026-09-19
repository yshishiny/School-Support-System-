import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIn, shiftDate, prettyDate } from "@/lib/dates";
import { computeStreak } from "@/lib/points";
import { loadPlan } from "@/lib/plan/prepare";
import { acknowledgeAlertAction } from "@/lib/actions/wellbeing";
import { KpiTicks } from "@/components/KpiTicks";
import { mergeKpis } from "@/lib/allowance";
import { allowanceWeekStatus } from "@/lib/allowance/week";
import { classifyPosition, type Place } from "@/lib/places";
import { signHeroUrls } from "@/lib/hero";
import { lessonsLine, schoolDay, type DayOff } from "@/lib/school-day";
import { classLogCoverage, missingLine, type ClassLogRow } from "@/lib/class-log";
import { computeIntegrity } from "@/lib/integrity/run";
import { liveFeedAction } from "@/lib/actions/live";
import { LiveFeed } from "@/components/LiveFeed";
import { kidColor } from "@/lib/kid-tabs";
import { presence } from "@/lib/activity";
import { unreadCount } from "@/lib/inbox";
import { loadSnapTasks } from "@/lib/snaps/server";
import { loadFollowups } from "@/lib/followups/run";
import { taskDayState, type SnapLite } from "@/lib/snaps";
import { formatInTimeZone } from "date-fns-tz";
import { ParentLayoutA, ParentLayoutB, ParentLayoutC } from "@/components/parent-home/Layouts";
import type { HomeData, KidView } from "@/components/parent-home/types";
import { ageOn, daysToBirthday } from "@/lib/people";
import { weekFor } from "@/lib/allowance";
import { askedToday, custodianFor, custodyInUse, parentName, type CustodyOverride, type ParentLite } from "@/lib/custody";
import { KIND_EMOJI, type Assignment, type Checkin, type CheckinItem, type Profile, type TimetableEntry } from "@/lib/types";

const MOOD = ["", "😞", "😕", "😐", "🙂", "😄"];
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
}

export default async function ParentHome() {
  const { family, profile } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const weekAhead = shiftDate(today, 7);

  const { data: kids } = await supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const students = (kids ?? []) as Profile[];
  if (students.length === 0) {
    return (
      <main className="space-y-4">
        <h1 className="h1">Welcome 👋</h1>
        <div className="card space-y-3">
          <p>Start by adding your kids. Each gets a username and password to log in from their phone or the laptop.</p>
          <Link href="/parent/children" className="btn-primary">Add a child</Link>
        </div>
      </main>
    );
  }
  const ids = students.map((s) => s.id);
  const admin = createAdminClient();
  const [{ data: checkins }, { data: open }, { data: ledger }, { count: pendingCount }, { data: report }, { data: prayers }, { data: alerts }, { data: pings }, { data: placeRows }, { data: todayTicks }, { count: claimsCount }, { count: findingsCount }, { data: heroRows }, { data: parentRows }, { data: overrideRows }, { data: timetableRows }, { data: daysOffRows }, { count: snapsPending }, { data: materialsPending }, { data: weekLogs }] = await Promise.all([
    supabase.from("checkins").select("*, checkin_items(*, assignments(title, kind))").in("student_id", ids).gte("checkin_date", shiftDate(today, -30)),
    supabase.from("assignments").select("*").in("student_id", ids).eq("status", "open"),
    supabase.from("points_ledger").select("student_id, delta").in("student_id", ids),
    supabase.from("redemptions").select("id", { count: "exact", head: true }).in("student_id", ids).eq("status", "pending"),
    supabase.from("daily_reports").select("report_date, status, sent_at").eq("family_id", family.id).order("report_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("prayer_logs").select("student_id, prayer, status, entered_late").in("student_id", ids).eq("log_date", today),
    supabase.from("safety_alerts").select("*, profiles(full_name)").eq("family_id", family.id).is("acknowledged_at", null).order("created_at", { ascending: false }),
    supabase.from("location_pings").select("user_id, latitude, longitude, accuracy_m, source, created_at").in("user_id", ids).order("created_at", { ascending: false }).limit(50),
    supabase.from("places").select("id, kind, label, latitude, longitude, radius_m, student_id").eq("family_id", family.id),
    supabase.from("kpi_ticks").select("student_id, code, value").in("student_id", ids).eq("tick_date", today),
    supabase.from("consequences").select("id", { count: "exact", head: true }).eq("family_id", family.id).is("closed_at", null).not("student_claimed_at", "is", null),
    supabase.from("source_findings").select("id", { count: "exact", head: true }).eq("family_id", family.id).eq("status", "new"),
    admin.from("hero_images").select("id, path").in("id", students.map((s) => s.avatar_image_id).filter((x): x is string => !!x)),
    supabase.from("profiles").select("id, full_name, parent_label").eq("family_id", family.id).eq("role", "parent"),
    supabase.from("custody_overrides").select("day, parent_id").eq("family_id", family.id).eq("day", today),
    supabase.from("timetable_entries").select("student_id, weekday, subject_name, start_time, end_time").in("student_id", ids),
    supabase.from("school_days_off").select("day, label").eq("family_id", family.id).gte("day", today).lte("day", weekAhead),
    supabase.from("snaps").select("id", { count: "exact", head: true }).eq("family_id", family.id).eq("status", "pending"),
    supabase.from("materials").select("id, items").eq("family_id", family.id).eq("status", "ready").is("items_reviewed_at", null),
    supabase.from("lesson_logs").select("student_id, log_date, subject_name, note, homework_given").in("student_id", ids).gte("log_date", weekFor(today, family.allowance_pay_weekday).start).lte("log_date", today),
  ]);
  const weekStart = weekFor(today, family.allowance_pay_weekday).start;
  const filesToReview = (materialsPending ?? []).filter((m) => Array.isArray(m.items) && m.items.length > 0).length;
  const timetable = (timetableRows ?? []) as Pick<TimetableEntry, "student_id" | "weekday" | "subject_name" | "start_time" | "end_time">[];
  const daysOff = (daysOffRows ?? []) as DayOff[];
  const parents = (parentRows ?? []) as ParentLite[];
  const custodian = custodianFor(today, family.custody_pattern, (overrideRows ?? []) as CustodyOverride[]);
  const custodyOn = parents.length > 1 && custodyInUse(family.custody_pattern, (overrideRows ?? []) as CustodyOverride[]);
  const custodianParent = custodian ? parents.find((p) => p.id === custodian) ?? null : null;
  const myTurn = askedToday(profile.id, custodian);
  const avatarUrls = await signHeroUrls((heroRows ?? []) as { id: string; path: string }[]);
  const places = (placeRows ?? []) as Place[];
  const kpis = mergeKpis(family.allowance_kpis);
  const allowanceStatus = family.allowance_enabled ? await Promise.all(students.map((s) => allowanceWeekStatus(s.id, family).catch(() => null))) : students.map(() => null);
  const plans = await Promise.all(students.map((s) => loadPlan(s.id).catch(() => null)));
  const integrity = await Promise.all(students.map((s) => computeIntegrity(s.id, today, family.timezone).catch(() => [])));
  const live = await liveFeedAction().catch(() => null);
  const unread = await unreadCount(profile.id).catch(() => 0);
  const followups = await loadFollowups(ids, shiftDate(today, -13)).catch(() => []);
  const [snapTasks, { data: todaySnapRows }] = await Promise.all([
    loadSnapTasks(family.id, family.timezone).catch(() => []),
    supabase.from("snaps").select("student_id, task_code, taken_on, status, ai_verdict").eq("family_id", family.id).eq("taken_on", today),
  ]);
  const hhmm = formatInTimeZone(new Date(), family.timezone, "HH:mm");
  const planMissing = plans.reduce((n, p) => n + (p ? p.missing.length : 0), 0);
  const openAlerts = (alerts ?? []) as { id: string; level: "amber" | "red"; category: string; summary: string; created_at: string; profiles: { full_name: string } | null }[];
  type CK = Checkin & { checkin_items: (CheckinItem & { assignments: { title: string; kind: Assignment["kind"] } | null })[] };
  const allCk = (checkins ?? []) as CK[];
  const openAll = (open ?? []) as Assignment[];

  const needs: { href: string; label: string; n: number; emoji: string }[] = [
    { href: "/parent/rewards", label: "reward request", n: pendingCount ?? 0, emoji: "🎁" },
    { href: "/parent/allowance", label: "earn-back to confirm", n: claimsCount ?? 0, emoji: "🪞" },
    { href: "/parent/import", label: "announcement to review", n: findingsCount ?? 0, emoji: "🏫" },
    { href: "/parent/plan", label: "quiz to prepare", n: planMissing, emoji: "📅" },
    { href: "/parent/snaps", label: "snap to approve", n: snapsPending ?? 0, emoji: "📸" },
    { href: "/parent/materials", label: "file with tasks to confirm", n: filesToReview, emoji: "📎" },
  ].filter((x) => x.n > 0);

  const alertNodes = openAlerts.map((a) => (
    <section key={a.id} className={`card !py-3 space-y-2 ${a.level === "red" ? "border-bad" : "border-warn"}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{a.level === "red" ? "🚨" : "💛"}</span>
        <div className="flex-1 text-sm">
          <div className="font-bold">{a.level === "red" ? "Please talk to" : "A gentle heads-up about"} {a.profiles?.full_name?.split(" ")[0]}</div>
          <div className="muted text-xs">{a.summary}. {a.level === "red" ? "Sit with him calmly today and listen first. If you think he is in immediate danger call 123." : "A relaxed conversation this week, without grades, would help."} What he wrote stays private.</div>
        </div>
        <form action={acknowledgeAlertAction.bind(null, a.id)}><button className="btn-ghost btn-sm">Done</button></form>
      </div>
    </section>
  ));

  const kidsView: KidView[] = students.map((s, idx) => {
    const mine = allCk.filter((c) => c.student_id === s.id);
    const ck = mine.find((c) => c.checkin_date === today) ?? null;
    const streak = computeStreak(mine.map((c) => c.checkin_date), today) || computeStreak(mine.map((c) => c.checkin_date), shiftDate(today, -1));
    const balance = (ledger ?? []).filter((l) => l.student_id === s.id).reduce((a, l) => a + l.delta, 0);
    const overdue = openAll.filter((a) => a.student_id === s.id && a.due_date && a.due_date < today && (a.kind === "homework" || a.kind === "project"));
    const tests = openAll.filter((a) => a.student_id === s.id && (a.kind === "quiz" || a.kind === "exam") && a.due_date && a.due_date >= today && a.due_date <= weekAhead);
    const last7 = Array.from({ length: 7 }, (_, i) => shiftDate(today, -6 + i));
    const ticks: Record<string, boolean> = {};
    (todayTicks ?? []).filter((t) => t.student_id === s.id).forEach((t) => (ticks[t.code] = t.value));
    const aw = allowanceStatus[idx];
    const plan = plans[idx];
    const todayQuizzes = plan ? plan.quizzes.filter((q) => q.scheduled_for === today) : [];
    const todayDone = todayQuizzes.filter((q) => q.attempts.some((a) => a.submitted_at)).length;
    const prayed = (prayers ?? []).filter((p) => p.student_id === s.id);
    const onTime = prayed.filter((p) => p.status === "on_time").length;
    const lp = (pings ?? []).find((p) => p.user_id === s.id) ?? null;
    const avatar = s.avatar_image_id ? avatarUrls.get(s.avatar_image_id) ?? null : null;
    const where = lp && places.length ? classifyPosition(lp.latitude, lp.longitude, places, s.id, lp.accuracy_m).label : null;
    const school = schoolDay(today, timetable.filter((t) => t.student_id === s.id), daysOff);
    const schoolTomorrow = schoolDay(shiftDate(today, 1), timetable.filter((t) => t.student_id === s.id), daysOff);
    const cov = classLogCoverage(weekStart, today, timetable.filter((t) => t.student_id === s.id), ((weekLogs ?? []) as (ClassLogRow & { student_id: string })[]).filter((l) => l.student_id === s.id), daysOff.map((d) => d.day));
    const pr = presence(s.last_seen_at, s.last_path);
    const mySnaps = ((todaySnapRows ?? []) as (SnapLite & { student_id: string })[]).filter((x) => x.student_id === s.id);
    const snapsToday = snapTasks
      .filter((t) => t.enabled && (t.student_id === null || t.student_id === s.id) && t.kind !== "handwriting")
      .map((t) => ({ code: t.code, label: t.label, emoji: t.emoji, state: t.days.includes(new Date(today + "T00:00:00Z").getUTCDay()) ? taskDayState(t, mySnaps, today, hhmm) : ("none" as const) }));
    const card = (
      <section className="card space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/parent/children" className="h-14 w-14 shrink-0 rounded-full overflow-hidden border-2 border-accent bg-panel-2 flex items-center justify-center text-2xl">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : s.avatar_emoji}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg leading-tight" style={{ fontFamily: "var(--font-display)" }}>{s.full_name.split(" ")[0]} <span className="muted font-normal text-sm">· Grade {s.grade}</span></div>
            <div className="text-xs muted">{pr.label ? <span className={pr.online ? "text-good" : ""}>{pr.online ? "🟢 " : ""}{pr.label} · </span> : null}{balance.toLocaleString()} ★ · {streak} 🔥{lp ? ` · 📍 ${where ?? "seen"} ${ago(lp.created_at)}` : ""}</div>
            {(() => { const d = daysToBirthday(s.birth_date, today); return d !== null && d <= 7 ? <div className="text-xs text-warn">🎂 {d === 0 ? `Birthday today, turns ${ageOn(s.birth_date, today)}!` : `Birthday in ${d} day${d === 1 ? "" : "s"}`}</div> : null; })()}
          </div>
          <div className={`badge ${ck ? "text-good" : "text-bad"}`}>{ck ? (ck.entered_late ? "✓ checked in (later)" : "✓ checked in") : "no check-in"}</div>
        </div>

        <Link href="/parent/children" className={`tile !p-2 block text-xs ${school.off ? "border-warn/60" : ""}`}>
          {school.off ? (
            <span><b>{school.reason === "Weekend" ? "🏖️ No school today" : `🏖️ ${school.reason}`}</b>{!schoolTomorrow.off && schoolTomorrow.lessons.length ? <span className="muted"> · tomorrow: {lessonsLine(schoolTomorrow.lessons, 4)}</span> : null}</span>
          ) : (
            <span><b>🏫 {school.lessons.length} lesson{school.lessons.length === 1 ? "" : "s"}</b> <span className="muted">{lessonsLine(school.lessons, 6)}</span></span>
          )}
        </Link>

        {integrity[idx].length > 0 && (
          <details className="text-xs rounded-xl border border-accent/40 p-2">
            <summary className="cursor-pointer">🔎 Worth asking tonight · {integrity[idx].length} thing{integrity[idx].length === 1 ? "" : "s"}</summary>
            <ul className="mt-1 space-y-1">
              {integrity[idx].map((x) => <li key={x.code}><b>{x.label}.</b> <span className="muted">{x.ask}</span></li>)}
            </ul>
            <p className="muted mt-1">Signals, not verdicts. Ask with curiosity; the honest answer is the goal.</p>
            {(() => {
              const mineF = followups.filter((f) => f.student_id === s.id);
              if (!mineF.length) return null;
              return (
                <div className="mt-2 space-y-1 border-t border-line pt-2">
                  <div className="font-semibold">🗣️ What he told his coach (asked up to 3 times, differently)</div>
                  {mineF.map((f) => (
                    <div key={f.id} className={f.answer ? "" : "muted"}>
                      <span className="muted">{f.asked_on.slice(5)} · r{f.round} · {f.signal_code.replace(/_/g, " ")}:</span> {f.answer ? `“${f.answer}”` : "not answered yet"}
                    </div>
                  ))}
                  <p className="muted">Compare the rounds: an honest story stays the same and gains detail; a made-up one drifts.</p>
                </div>
              );
            })()}
          </details>
        )}
        {cov.due > 0 && (
          <div className={`text-xs ${cov.done === cov.due ? "text-good" : "text-warn"}`}>📖 Class log this week: {cov.done}/{cov.due}{cov.days.length ? ` · missing ${missingLine(cov.days)}` : " · complete"}</div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="tile !p-2"><div className="font-bold text-lg leading-none" style={{ fontFamily: "var(--font-display)" }}>{onTime}/5</div><div className="text-[11px] muted">prayers on time</div><div className="flex justify-center gap-1 mt-1">{PRAYERS.map((p) => { const l = prayed.find((x) => x.prayer === p); return <span key={p} title={l ? `${p}: ${l.status}${l.entered_late ? " (logged later)" : ""}` : p} className={`h-2 w-2 rounded-full ${l ? (l.status === "on_time" ? "bg-good" : l.status === "late" ? "bg-warn" : "bg-bad") : "bg-panel-2 border border-line"}`} />; })}</div></div>
          <Link href="/parent/plan" className="tile !p-2"><div className="font-bold text-lg leading-none" style={{ fontFamily: "var(--font-display)" }}>{todayDone}/{todayQuizzes.length}</div><div className="text-[11px] muted">quizzes today</div></Link>
          <Link href="/parent/allowance" className="tile !p-2"><div className="font-bold text-lg leading-none text-accent-2" style={{ fontFamily: "var(--font-display)" }}>{aw ? `${aw.amount}` : "—"}</div><div className="text-[11px] muted">{aw ? `EGP · score ${aw.score}` : "allowance off"}</div></Link>
        </div>

        {family.allowance_enabled && (myTurn ? (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold muted">Basics today · tap ✓ or ✗{ck?.manners_self ? ` · manners: he says ${ck.manners_self}/5${ck.manners_note ? ` (“${ck.manners_note}”)` : ""}` : ""}</div>
            <KpiTicks studentId={s.id} kpis={kpis} ticks={ticks} />
          </div>
        ) : (
          <details className="text-xs">
            <summary className="cursor-pointer muted">🏠 With {parentName(custodianParent)} today, so the daily taps are theirs{Object.keys(ticks).length ? ` · ${Object.values(ticks).filter(Boolean).length} ✓ ${Object.values(ticks).filter((v) => !v).length} ✗ so far` : ""}. Tap anyway?</summary>
            <div className="mt-1"><KpiTicks studentId={s.id} kpis={kpis} ticks={ticks} /></div>
          </details>
        ))}

        <div className="flex items-center gap-2">
          <div className="flex gap-1 flex-1">
            {last7.map((d) => {
              const has = mine.some((c) => c.checkin_date === d);
              return <div key={d} title={d} className={`h-1.5 flex-1 rounded ${has ? "bg-good" : d === today ? "bg-panel-2 border border-line" : "bg-bad/40"}`} />;
            })}
          </div>
          <span className="text-[11px] muted">7 days</span>
        </div>

        {(overdue.length > 0 || tests.length > 0) && (
          <div className="text-xs space-y-0.5">
            {overdue.length > 0 && <div className="text-bad">⏰ Overdue: {overdue.map((o) => o.title).join(", ")}</div>}
            {tests.length > 0 && <div className="text-warn">🎯 {tests.map((t) => `${t.title} (${prettyDate(t.due_date!)})`).join(", ")}</div>}
          </div>
        )}

        {ck && (
          <details className="text-sm">
            <summary className="cursor-pointer muted text-xs">Today&apos;s check-in · {ck.mood ? MOOD[ck.mood] : ""} {ck.minutes_studied} min · {ck.checkin_items.filter((i) => i.status === "done").length}/{ck.checkin_items.length} tasks</summary>
            <div className="mt-1 space-y-1">
              {ck.checkin_items.map((i) => (
                <div key={i.id} className="text-xs muted">{i.status === "done" ? "✅" : i.status === "partial" ? "🟡" : "❌"} {i.assignments ? `${KIND_EMOJI[i.assignments.kind]} ${i.assignments.title}` : "task"}</div>
              ))}
              {ck.learned && <div className="text-xs"><span className="muted">Learned:</span> {ck.learned}</div>}
              {ck.stuck_on && <div className="text-xs text-warn"><span className="muted">Stuck on:</span> {ck.stuck_on}</div>}
            </div>
          </details>
        )}
      </section>
    );
    return {
      id: s.id,
      name: s.full_name.split(" ")[0],
      grade: s.grade,
      color: kidColor(idx),
      emoji: s.avatar_emoji,
      avatarUrl: avatar,
      online: pr.online,
      presenceLabel: pr.label,
      checkedIn: !!ck,
      checkinLate: !!ck?.entered_late,
      checkinTime: ck ? formatInTimeZone(new Date(ck.submitted_at), family.timezone, "HH:mm") : null,
      prayers: PRAYERS.map((p) => ({ prayer: p, status: prayed.find((x) => x.prayer === p)?.status ?? null })),
      prayersOnTime: onTime,
      quizzesDone: todayDone,
      quizzesTotal: todayQuizzes.length,
      allowance: aw ? { amount: aw.amount, score: aw.score, allowance: aw.allowance } : null,
      classLog: { done: cov.done, due: cov.due, missing: cov.days.length ? missingLine(cov.days) : null },
      school: { off: school.off, reason: school.reason ?? null, line: lessonsLine(school.lessons, 6) },
      ticks,
      snapsToday,
      overdue: overdue.map((o) => o.title),
      tests: tests.map((t) => `${t.title} (${prettyDate(t.due_date!)})`),
      balance,
      streak,
      integrityCount: integrity[idx].length,
      needsCount: (cov.days.length ? 1 : 0) + overdue.length + integrity[idx].length + (ck ? 0 : 1),
      card,
    };
  });

  const data: HomeData = {
    today,
    dateLine: `${prettyDate(today)}${custodyOn ? ` · 🏠 ${custodian ? (custodian === profile.id ? "with you today" : `with ${parentName(custodianParent)} today`) : "shared day"}` : ""}`,
    firstName: profile.full_name.split(" ")[0],
    unread,
    needs,
    alerts: alertNodes,
    live: live ? <LiveFeed initial={live} tz={family.timezone} /> : null,
    kids: kidsView,
    reportLine: report ? `Last report ${prettyDate(report.report_date)} · ${report.status}` : "No report sent yet",
    allowanceEnabled: family.allowance_enabled,
    kpiToday: kpis.filter((k) => k.enabled && k.source === "parent").map((k) => ({ label: k.label, emoji: k.emoji, code: k.code })),
  };
  const layout = (profile as { home_layout?: string }).home_layout ?? "b";
  if (layout === "a") return <ParentLayoutA d={data} />;
  if (layout === "c") return <ParentLayoutC d={data} />;
  return <ParentLayoutB d={data} />;
}
