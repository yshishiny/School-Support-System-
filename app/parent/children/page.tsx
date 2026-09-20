import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddChildForm } from "@/components/AddChildForm";
import { HeroUploader } from "@/components/HeroUploader";
import { addSubjectAction, deleteSubjectAction, addTimetableAction, deleteTimetableAction, applyTimetableTemplateAction, setChildHomeLayoutAction, setDayOffAction } from "@/lib/actions/children";
import { prettyDate, todayIn } from "@/lib/dates";
import { SideTabs } from "@/components/SideTabs";
import { Tabs } from "@/components/Tabs";
import { ChildProfileForm } from "@/components/ChildProfileForm";
import { CurriculumPicker } from "@/components/CurriculumPicker";
import { levelsOf, listCurricula, type Level } from "@/lib/curriculum";
import { ageOn, daysToBirthday } from "@/lib/people";
import { signHeroUrls } from "@/lib/hero";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();
  const [{ data: heroRows }, { data: authUsers }] = await Promise.all([
    admin.from("hero_images").select("id, path").in("id", students.map((x) => x.avatar_image_id).filter((x): x is string => !!x)),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);
  const avatarUrls = await signHeroUrls((heroRows ?? []) as { id: string; path: string }[]);
  // The catalogue is the same for every child on the page, so it is read once.
  const curricula = await listCurricula();
  const levelsByCurriculum: Record<string, Level[]> = Object.fromEntries(
    await Promise.all(curricula.map(async (c) => [c.id, await levelsOf(c.id)] as const)),
  );
  const usernameOf = (id: string) => (authUsers?.users ?? []).find((u) => u.id === id)?.email?.split("@")[0] ?? null;
  const COLORS = ["#3a86ff", "#ff6b6b", "#2ec4b6", "#ffbe0b", "#8338ec", "#fb5607"];

  return (
    <main className="space-y-4">
      <h1 className="h1">Kids</h1>
      {students.length > 0 && (
        <SideTabs
          storageKey="kids"
          tabs={students.map((s, idx) => {
            const subs = ((subjects ?? []) as Subject[]).filter((x) => x.student_id === s.id);
            const tt = ((timetable ?? []) as TimetableEntry[]).filter((x) => x.student_id === s.id);
            const age = ageOn(s.birth_date, today);
            const toBirthday = daysToBirthday(s.birth_date, today);
            const color = COLORS[idx % COLORS.length];
            const profileTab = (
              <>
                {toBirthday !== null && toBirthday <= 7 && <p className="card !py-2 text-sm border-warn/60">🎂 {toBirthday === 0 ? `Birthday today! ${s.full_name.split(" ")[0]} turns ${age}.` : `Birthday in ${toBirthday} day${toBirthday === 1 ? "" : "s"}.`}</p>}
                <ChildProfileForm s={s} age={age} username={usernameOf(s.id)} />
                {(() => {
                  const d = (s as { device?: { platform: string; standalone: boolean; screen: string; battery: number | null; charging: boolean | null; connection: string | null; updated_at: string } | null }).device;
                  const installed = (s as { app_installed_at?: string | null }).app_installed_at;
                  if (!d) return <p className="card !py-2 text-xs muted">📱 No device seen yet. It shows here after his next visit: phone type, app or browser, battery, network.</p>;
                  return (
                    <p className="card !py-2 text-xs">
                      📱 <b>{d.platform}</b> · {d.standalone ? "the installed app" : "a browser tab"}{installed ? ` (app since ${installed.slice(0, 10)})` : ""} · screen {d.screen}{d.battery !== null ? ` · battery ${d.battery}%${d.charging ? " charging" : ""}` : ""}{d.connection ? ` · ${d.connection}` : ""} · <span className="muted">seen {d.updated_at.slice(0, 16).replace("T", " ")}</span>
                    </p>
                  );
                })()}
              </>
            );
            const subjectsTab = (
              <div className="card space-y-2">
                <div className="flex flex-wrap gap-2">
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
            );
            const timetableTab = (
              <div className="card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm muted">{tt.length} period{tt.length === 1 ? "" : "s"}</span>
                  <form action={applyTimetableTemplateAction}>
                    <input type="hidden" name="student_id" value={s.id} />
                    <button className="btn-ghost btn-sm" title="Replace with the KIS American Division timetable for this grade">Load school timetable</button>
                  </form>
                </div>
                {tt.length > 0 && (
                  <ul className="text-sm divide-y divide-line">
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
                  <select name="weekday" className="input col-span-2" defaultValue={0}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
                  <input name="start_time" type="time" className="input col-span-2" required />
                  <input name="end_time" type="time" className="input col-span-2" />
                  <input name="subject_name" className="input col-span-3" placeholder="Subject" required />
                  <input name="room" className="input col-span-2" placeholder="Teacher / room" />
                  <button className="btn-ghost btn-sm col-span-1">Add</button>
                </form>
              </div>
            );
            const picturesTab = (
              <div className="card space-y-2">
                <p className="text-sm muted">{(heroes ?? []).filter((h) => h.student_id === s.id).length} hero picture{(heroes ?? []).filter((h) => h.student_id === s.id).length === 1 ? "" : "s"}. The child picks the avatar and banner on his Me page.</p>
                <HeroUploader familyId={family.id} studentId={s.id} />
              </div>
            );
            const curriculumTab = (
              <CurriculumPicker
                studentId={s.id}
                curricula={curricula}
                levelsByCurriculum={levelsByCurriculum}
                current={{
                  curriculumId: (s as Profile & { curriculum_id?: string | null }).curriculum_id ?? null,
                  grade: s.grade ?? null,
                  stream: (s as Profile & { stream?: string | null }).stream ?? null,
                }}
              />
            );
            const styleTab = (
              <form action={setChildHomeLayoutAction} className="card flex items-center gap-2 text-sm">
                <input type="hidden" name="student_id" value={s.id} />
                <span className="muted">Home page style</span>
                <select name="home_layout" className="input py-1 w-44" defaultValue={s.home_layout ?? "b"}>
                  <option value="a">A · Three things</option>
                  <option value="b">B · One thing now</option>
                  <option value="c">C · Picture &amp; tiles</option>
                </select>
                <button className="btn-ghost btn-sm">Set</button>
              </form>
            );
            return {
              id: s.id,
              label: s.full_name.split(" ")[0],
              emoji: s.avatar_emoji,
              color,
              sub: `${s.stage && s.stage !== "school" ? s.stage : `Grade ${s.grade ?? "?"}`}${age !== null ? ` · ${age} y` : ""}${toBirthday === 0 ? " · 🎂" : ""}`,
              avatarUrl: s.avatar_image_id ? avatarUrls.get(s.avatar_image_id) ?? null : null,
              content: (
                <Tabs
                  storageKey={`kid-${s.id}`}
                  size="sm"
                  tabs={[
                    { id: "profile", label: "Profile", emoji: "🪪", content: <>{curriculumTab}{profileTab}</> },
                    { id: "subjects", label: "Subjects", emoji: "📚", badge: subs.length || null, content: subjectsTab },
                    { id: "timetable", label: "Timetable", emoji: "🗓️", badge: tt.length || null, content: timetableTab },
                    { id: "pictures", label: "Pictures", emoji: "🖼️", content: picturesTab },
                    { id: "style", label: "Home style", emoji: "🎨", content: styleTab },
                  ]}
                />
              ),
            };
          })}
        />
      )}
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
