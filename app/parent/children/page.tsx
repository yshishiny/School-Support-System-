import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddChildForm } from "@/components/AddChildForm";
import { HeroUploader } from "@/components/HeroUploader";
import { addSubjectAction, deleteSubjectAction, addTimetableAction, deleteTimetableAction, applyTimetableTemplateAction, setChildHomeLayoutAction, setDayOffAction } from "@/lib/actions/children";
import { prettyDate, todayIn } from "@/lib/dates";
import type { Profile, Subject, TimetableEntry } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ChildrenPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const { data: kids } = await supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const students = (kids ?? []) as Profile[];
  const ids = students.map((s) => s.id);
  const today = todayIn(family.timezone);
  const [{ data: subjects }, { data: timetable }, { data: heroes }, { data: daysOff }] = await Promise.all([
    ids.length ? supabase.from("subjects").select("*").in("student_id", ids).order("name") : { data: [] },
    ids.length ? supabase.from("timetable_entries").select("*").in("student_id", ids).order("weekday").order("start_time") : { data: [] },
    ids.length ? supabase.from("hero_images").select("id, student_id").in("student_id", ids) : { data: [] },
    supabase.from("school_days_off").select("id, day, label").eq("family_id", family.id).gte("day", today).order("day").limit(40),
  ]);

  return (
    <main className="space-y-4">
      <h1 className="h1">Kids</h1>
      {students.map((s) => {
        const subs = ((subjects ?? []) as Subject[]).filter((x) => x.student_id === s.id);
        const tt = ((timetable ?? []) as TimetableEntry[]).filter((x) => x.student_id === s.id);
        return (
          <section key={s.id} className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{s.avatar_emoji}</div>
              <div className="flex-1">
                <div className="font-bold">{s.full_name}</div>
                <div className="text-xs muted">Grade {s.grade} · {(heroes ?? []).filter((h) => h.student_id === s.id).length} hero picture{(heroes ?? []).filter((h) => h.student_id === s.id).length === 1 ? "" : "s"}</div>
              </div>
              <HeroUploader familyId={family.id} studentId={s.id} compact />
            </div>
            <form action={setChildHomeLayoutAction} className="flex items-center gap-2 text-sm">
              <input type="hidden" name="student_id" value={s.id} />
              <span className="muted">Home page style</span>
              <select name="home_layout" className="input py-1 w-44" defaultValue={s.home_layout ?? "b"}>
                <option value="a">A · Three things</option>
                <option value="b">B · One thing now</option>
                <option value="c">C · Picture &amp; tiles</option>
              </select>
              <button className="btn-ghost btn-sm">Set</button>
            </form>

            <div>
              <h3 className="font-semibold mb-1">Subjects</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {subs.map((x) => (
                  <form key={x.id} action={deleteSubjectAction} className="badge">
                    <input type="hidden" name="id" value={x.id} />
                    {x.name}{x.teacher ? ` · ${x.teacher}` : ""}
                    <button className="muted hover:text-bad" title="Remove">×</button>
                  </form>
                ))}
                {subs.length === 0 && <span className="muted text-sm">None yet.</span>}
              </div>
              <form action={addSubjectAction} className="flex gap-2">
                <input type="hidden" name="student_id" value={s.id} />
                <input name="name" className="input" placeholder="Subject" required />
                <input name="teacher" className="input" placeholder="Teacher (optional)" />
                <button className="btn-ghost btn-sm shrink-0">Add</button>
              </form>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">Timetable</h3>
                <form action={applyTimetableTemplateAction}>
                  <input type="hidden" name="student_id" value={s.id} />
                  <button className="btn-ghost btn-sm" title="Replace with the KIS American Division timetable for this grade">Load school timetable</button>
                </form>
              </div>
              {tt.length > 0 && (
                <ul className="text-sm mb-2 divide-y divide-line">
                  {tt.map((t) => (
                    <li key={t.id} className="py-1 flex items-center gap-2">
                      <span className="muted w-10">{DAYS[t.weekday]}</span>
                      <span className="muted w-24">{t.start_time.slice(0, 5)}{t.end_time ? `–${t.end_time.slice(0, 5)}` : ""}</span>
                      <span className="flex-1">{t.subject_name}{t.room ? <span className="muted"> · {t.room}</span> : null}</span>
                      <form action={deleteTimetableAction}><input type="hidden" name="id" value={t.id} /><button className="muted hover:text-bad">×</button></form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addTimetableAction} className="grid grid-cols-6 gap-2">
                <input type="hidden" name="student_id" value={s.id} />
                <select name="weekday" className="input col-span-2" defaultValue={0}>
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
                <input name="start_time" type="time" className="input col-span-2" required />
                <input name="end_time" type="time" className="input col-span-2" />
                <input name="subject_name" className="input col-span-3" placeholder="Subject" required />
                <input name="room" className="input col-span-2" placeholder="Teacher / room" />
                <button className="btn-ghost btn-sm col-span-1">Add</button>
              </form>
            </div>
          </section>
        );
      })}
      <AddChildForm />
      <section className="card space-y-2">
        <h2 className="h2">🏖️ School days off</h2>
        <p className="text-xs muted">Holidays, exam breaks, strikes. Fridays and Saturdays are off already. Marked days show as “no school” on your home page and in the report.</p>
        <form action={setDayOffAction} className="flex flex-wrap gap-2 items-end">
          <div><label className="label">Date</label><input name="day" type="date" className="input" defaultValue={today} required /></div>
          <div className="flex-1 min-w-[10rem]"><label className="label">Reason (optional)</label><input name="label" className="input" placeholder="6 October holiday" /></div>
          <button className="btn-primary">Mark off</button>
        </form>
        {(daysOff ?? []).length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {(daysOff ?? []).map((d) => (
              <li key={d.id} className="py-1.5 flex items-center gap-2">
                <span className="flex-1">{prettyDate(d.day)}{d.label ? ` · ${d.label}` : ""}</span>
                <form action={setDayOffAction}><input type="hidden" name="day" value={d.day} /><input type="hidden" name="remove" value="1" /><button className="btn-ghost btn-sm">✕</button></form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
