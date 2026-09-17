import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, prettyDate, weekdayOf } from "@/lib/dates";
import { SideTabs } from "@/components/SideTabs";
import { KpiTicks } from "@/components/KpiTicks";
import { kidColor } from "@/lib/kid-tabs";
import { mergeKpis } from "@/lib/allowance";
import { MANNERS_HINTS, MANNERS_SCALE, mannersWeek } from "@/lib/manners";
import { signHeroUrls } from "@/lib/hero";
import type { Profile } from "@/lib/types";

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Manners: the child's own rating first, the parent's tick beside it, hints on what to look for, and the week. */
export default async function MannersPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(today, -6 + i));
  const { data: kids } = await supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const students = (kids ?? []) as Profile[];
  const ids = students.map((s) => s.id);
  const [{ data: checkins }, { data: ticks }, { data: heroRows }] = await Promise.all([
    supabase.from("checkins").select("student_id, checkin_date, manners_self, manners_note").in("student_id", ids).gte("checkin_date", days[0]),
    supabase.from("kpi_ticks").select("student_id, tick_date, code, value").in("student_id", ids).gte("tick_date", days[0]).eq("code", "manners"),
    supabase.from("hero_images").select("id, path").in("id", students.map((s) => s.avatar_image_id).filter((x): x is string => !!x)),
  ]);
  const avatarUrls = await signHeroUrls((heroRows ?? []) as { id: string; path: string }[]);
  const kpis = mergeKpis(family.allowance_kpis).filter((k) => k.code === "manners");

  return (
    <main className="space-y-4">
      <h1 className="h1">🤝 Manners</h1>
      <p className="text-sm muted">He rates his own manners at check-in; you tap ✓ or ✗ once a day. When he says 4 or 5 and you say ✗, the coach asks him about that day, three times, differently. Only a ✗ costs allowance points.</p>
      {students.length === 0 ? <p className="card muted">Add a child first.</p> : (
        <SideTabs
          storageKey="manners-kids"
          tabs={students.map((s, idx) => {
            const week = mannersWeek(days, ((checkins ?? []) as { student_id: string; checkin_date: string; manners_self: number | null; manners_note: string | null }[]).filter((c) => c.student_id === s.id), ((ticks ?? []) as { student_id: string; tick_date: string; code: string; value: boolean }[]).filter((t) => t.student_id === s.id));
            const todayRow = week[week.length - 1];
            const tickMap: Record<string, boolean> = {};
            if (todayRow.parent !== undefined) tickMap.manners = todayRow.parent;
            const gaps = week.filter((d) => d.gap);
            const selfAvg = (() => { const v = week.map((d) => d.self).filter((x): x is number => x !== null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; })();
            const bad = week.filter((d) => d.parent === false).length;
            return {
              id: s.id,
              label: s.full_name.split(" ")[0],
              emoji: s.avatar_emoji,
              color: kidColor(idx),
              avatarUrl: s.avatar_image_id ? avatarUrls.get(s.avatar_image_id) ?? null : null,
              sub: todayRow.self ? `he says ${todayRow.self}/5` : "no self-rating yet",
              content: (
                <div className="space-y-3">
                  <section className="card space-y-2">
                    <h2 className="h2">Today · {prettyDate(today)}</h2>
                    <div className="tile text-sm">
                      {todayRow.self ? (
                        <div><span className="text-2xl mr-1">{MANNERS_SCALE.find((m) => m.v === todayRow.self)?.e}</span> He rated himself <b>{todayRow.self}/5</b>: {MANNERS_SCALE.find((m) => m.v === todayRow.self)?.label.toLowerCase()}.{todayRow.note ? <div className="text-xs muted mt-1">He wrote: “{todayRow.note}”</div> : null}</div>
                      ) : <span className="muted">He has not checked in yet today. Read his rating first, then tap yours; if he has not, tap anyway.</span>}
                    </div>
                    <div className="text-[11px] font-semibold muted">Your tick</div>
                    <KpiTicks studentId={s.id} kpis={kpis} ticks={tickMap} />
                    {todayRow.gap && <p className="text-xs text-warn">Gap today: he says {todayRow.self}/5, you marked ✗. The coach will ask him about it tonight; you will see his answers under “Worth asking tonight” on Home.</p>}
                  </section>

                  <section className="card space-y-1">
                    <h2 className="h2">This week</h2>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                      {week.map((d) => (
                        <div key={d.date} className={`tile !p-1.5 ${d.gap ? "border border-warn" : ""}`}>
                          <div className="muted">{SHORT[weekdayOf(d.date)]}</div>
                          <div className="text-lg leading-none">{d.self ? MANNERS_SCALE.find((m) => m.v === d.self)?.e : "·"}</div>
                          <div className={d.parent === true ? "text-good" : d.parent === false ? "text-bad" : "muted"}>{d.parent === true ? "✓" : d.parent === false ? "✗" : "–"}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs muted">Top row: his rating. Bottom: your tick.{selfAvg ? ` His average ${selfAvg}/5.` : ""}{bad ? ` ${bad} ✗ this week.` : " No ✗ this week."}{gaps.length ? ` ${gaps.length} day${gaps.length === 1 ? "" : "s"} where you disagreed.` : ""}</div>
                    {week.filter((d) => d.note).length > 0 && <ul className="text-xs space-y-0.5 mt-1">{week.filter((d) => d.note).map((d) => <li key={d.date}><span className="muted">{SHORT[weekdayOf(d.date)]}:</span> “{d.note}”</li>)}</ul>}
                  </section>

                  <section className="card space-y-1">
                    <h2 className="h2">What to look for</h2>
                    <ul className="text-sm space-y-1">
                      {MANNERS_HINTS.map((h) => <li key={h.title} className="flex gap-2"><span>{h.emoji}</span><span><b>{h.title}.</b> <span className="muted">{h.look}</span></span></li>)}
                    </ul>
                    <p className="text-xs muted">Double-check with him first: ask “how were your manners today?” before you tap. A ✗ he agrees with teaches more than one he argues with.</p>
                  </section>
                </div>
              ),
            };
          })}
        />
      )}
    </main>
  );
}
