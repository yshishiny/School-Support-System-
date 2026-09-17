import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CHARACTERS, characterById } from "@/lib/characters";
import { CharacterPicker } from "@/components/teach/CharacterPicker";
import { StartLessonButton } from "@/components/teach/StartLessonButton";
import { Avatar } from "@/components/teach/Avatar";
import { Tabs } from "@/components/Tabs";
import { isArabicSubject, subjectEmoji, subjectLabel } from "@/lib/plan";
import { prettyDate, shiftDate, todayIn } from "@/lib/dates";
import type { Topic } from "@/lib/types";

export const maxDuration = 300;

/** V2 beta: the child's virtual teacher. Pick a character, then a topic or a file, and the lesson begins. */
export default async function TeachPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const chosen = profile.character_id ? characterById(profile.character_id) : null;
  const [{ data: topics }, { data: logs }, { data: materials }, { data: sessions }] = await Promise.all([
    supabase.from("topics").select("*").eq("track", "school").eq("grade", profile.grade ?? 0).order("subject").order("sort"),
    supabase.from("lesson_logs").select("subject_name, topic_id, note, log_date").eq("student_id", profile.id).gte("log_date", shiftDate(today, -7)).order("log_date", { ascending: false }),
    supabase.from("materials").select("id, title, subject, status").eq("student_id", profile.id).eq("status", "ready").order("created_at", { ascending: false }).limit(12),
    supabase.from("lesson_sessions").select("id, started_at, finished_at, understanding, lesson_scripts(title)").eq("student_id", profile.id).order("started_at", { ascending: false }).limit(8),
  ]);
  const all = (topics ?? []) as Topic[];
  const subjects = [...new Set(all.map((t) => t.subject))].sort((a, b) => Number(isArabicSubject(a)) - Number(isArabicSubject(b)) || a.localeCompare(b));
  const recentTopicIds = [...new Set((logs ?? []).map((l) => l.topic_id).filter((x): x is string => !!x))];
  const recent = recentTopicIds.map((id) => all.find((t) => t.id === id)).filter((t): t is Topic => !!t).slice(0, 6);
  type S = { id: string; started_at: string; finished_at: string | null; understanding: string | null; lesson_scripts: { title: string } | null };
  const past = (sessions ?? []) as unknown as S[];

  if (!chosen) {
    return (
      <main className="space-y-4">
        <header><h1 className="h1">Pick your teacher</h1><p className="text-sm muted">One teacher for all your subjects. Same knowledge, different style. You can change later.</p></header>
        <CharacterPicker current={null} />
        <p className="text-xs muted">Beta: lessons use your phone&apos;s voice. Turn the volume up.</p>
      </main>
    );
  }

  const topicList = (list: Topic[]) => (
    <ul className="divide-y divide-line">
      {list.map((t) => (
        <li key={t.id} className="py-2 flex items-center gap-2 text-sm">
          <span className="flex-1 min-w-0"><span className="muted text-xs">{t.unit ? `${t.unit} · ` : ""}</span>{t.name}</span>
          <StartLessonButton topicId={t.id} />
        </li>
      ))}
    </ul>
  );

  return (
    <main className="space-y-4">
      <header className="flex items-center gap-3">
        <Avatar c={chosen} speaking={false} size={90} mood="happy" />
        <div className="flex-1">
          <h1 className="h1">{chosen.name}</h1>
          <p className="text-xs muted">{chosen.tagline}</p>
          <details className="text-xs mt-1"><summary className="cursor-pointer muted">Change teacher</summary><div className="mt-2"><CharacterPicker current={chosen.id} /></div></details>
        </div>
      </header>

      {recent.length > 0 && (
        <section className="card space-y-1">
          <h2 className="h2">📖 From your class log this week</h2>
          {topicList(recent)}
        </section>
      )}

      {(materials ?? []).length > 0 && (
        <section className="card space-y-1">
          <h2 className="h2">📎 Teach me from a school file</h2>
          <ul className="divide-y divide-line">
            {(materials ?? []).map((m) => <li key={m.id} className="py-2 flex items-center gap-2 text-sm"><span className="flex-1 min-w-0">{m.title}<span className="muted text-xs"> · {m.subject ?? ""}</span></span><StartLessonButton materialId={m.id} /></li>)}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="h2">📚 Any topic</h2>
        <Tabs storageKey="teach-subject" size="sm" tabs={subjects.map((s) => ({ id: s, label: subjectLabel(s), emoji: subjectEmoji(s), content: <div className="card" dir={isArabicSubject(s) ? "rtl" : undefined}>{topicList(all.filter((t) => t.subject === s))}</div> }))} />
      </section>

      {past.length > 0 && (
        <section className="card">
          <h2 className="h2 mb-1">Your lessons</h2>
          <ul className="text-sm divide-y divide-line">
            {past.map((s) => (
              <li key={s.id} className="py-1.5 flex items-center gap-2">
                <span className="flex-1">{s.lesson_scripts?.title ?? "Lesson"} <span className="muted text-xs">· {prettyDate(s.started_at.slice(0, 10))}</span></span>
                {s.finished_at ? <span className={`badge ${s.understanding === "understood" ? "text-good" : s.understanding === "lost" ? "text-bad" : "text-warn"}`}>{s.understanding}</span> : <Link href={`/teach/${s.id}`} className="btn-ghost btn-sm">Resume</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs muted">Beta · {CHARACTERS.length} teachers · lessons are written from your school files and curriculum, cached, and improved when flagged.</p>
    </main>
  );
}
