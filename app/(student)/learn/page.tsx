import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, prettyDate } from "@/lib/dates";
import { EXAM_INFO, EXAM_SECTIONS, examsFor, scaledEstimate, sectionsFor, trackFor } from "@/lib/exams";
import { masteryMaps, masteryColor, type AttemptWithQuiz } from "@/lib/mastery";
import { PracticeButton, PrepareWeekButton } from "@/components/LearnButtons";
import { weekTopicsFor } from "@/lib/learning/resources";
import { weekdayOf } from "@/lib/dates";
import { Tabs } from "@/components/Tabs";
import { MaterialUploader } from "@/components/MaterialUploader";
import { DoWorksheetButton, PractiseFromFile, PrepareWorksheetButton, ReadAgainButton } from "@/components/MaterialCards";
import { signMaterialUrls, type MaterialRow } from "@/lib/materials/server";
import { WeekPlanCard } from "@/components/WeekPlanCard";
import type { PlannedQuiz } from "@/lib/plan/prepare";
import { shiftDate } from "@/lib/dates";
import { isArabicSubject, subjectEmoji, subjectLabel, ARABIC_SUBJECTS } from "@/lib/plan";
import type { Topic } from "@/lib/types";

export const maxDuration = 300;


export default async function LearnPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const exams = examsFor(profile.target_exam, profile.grade);
  const examTracks = new Set(exams.map(trackFor));

  const [{ data: topics }, { data: attempts }, { count: dueCount }, { count: memorizeCount }, { data: planned }, { data: materialRows }, { data: materialQuizzes }, { data: mySubjects }] = await Promise.all([
    supabase.from("topics").select("*").or(`grade.eq.${profile.grade ?? 0},track.eq.act,track.eq.sat`).order("subject").order("sort"),
    supabase.from("attempts").select("*, quizzes(topic_id, act_section, track, title)").eq("student_id", profile.id).not("submitted_at", "is", null),
    supabase.from("review_queue").select("id", { count: "exact", head: true }).eq("student_id", profile.id).lte("due_date", today),
    supabase.from("memorize_items").select("id", { count: "exact", head: true }).eq("student_id", profile.id),
    supabase.from("quizzes").select("id, title, scheduled_for, plan_slot, topic_id, act_section, topics(subject), attempts(score, total, submitted_at)").eq("student_id", profile.id).not("scheduled_for", "is", null).gte("scheduled_for", shiftDate(today, -6)).lte("scheduled_for", shiftDate(today, 6)).order("scheduled_for"),
    supabase.from("materials").select("*").eq("student_id", profile.id).order("created_at", { ascending: false }).limit(40),
    supabase.from("quizzes").select("material_id, title, attempts(submitted_at)").eq("student_id", profile.id).not("material_id", "is", null),
    supabase.from("subjects").select("name").eq("student_id", profile.id),
  ]);
  const week = await weekTopicsFor(profile.id, profile.grade, family.timezone);
  const weekMissing = week.filter((w) => !w.hasLesson || !w.hasResources).length;
  const materials = (materialRows ?? []) as MaterialRow[];
  const materialUrls = await signMaterialUrls(materials.map((m) => ({ id: m.id, path: m.path })));
  type MQ = { material_id: string | null; title: string; attempts: { submitted_at: string | null }[] };
  const mq = (materialQuizzes ?? []) as MQ[];
  const setsFor = (id: string) => mq.filter((q) => q.material_id === id && !q.title.startsWith("Worksheet:")).length;
  const worksheetDone = (id: string) => mq.filter((q) => q.material_id === id && q.title.startsWith("Worksheet:") && q.attempts.some((a) => a.submitted_at)).length;
  const all = (topics ?? []) as Topic[];
  const school = all.filter((t) => t.track === "school");
  const examTopics = all.filter((t) => examTracks.has(t.track as "act" | "sat"));
  const { topic: mastery, section: sectionMastery } = masteryMaps((attempts ?? []) as AttemptWithQuiz[]);
  const subjects = [...new Set(school.map((t) => t.subject))].sort((a, b) => Number(isArabicSubject(a)) - Number(isArabicSubject(b)) || a.localeCompare(b));
  const weakest = school
    .filter((t) => mastery.has(t.id) && (mastery.get(t.id) ?? 0) < 70)
    .sort((a, b) => (mastery.get(a.id) ?? 0) - (mastery.get(b.id) ?? 0))
    .slice(0, 3);
  const daysToExam = profile.target_exam_date ? Math.ceil((new Date(profile.target_exam_date).getTime() - new Date(today).getTime()) / 86400000) : null;

  const forMe = (
    <>
      {(dueCount ?? 0) > 0 && (
        <Link href="/review" className="card flex items-center gap-3 border-accent/50">
          <span className="text-4xl sticker-still">🔁</span>
          <div className="flex-1">
            <div className="font-bold">{dueCount} question{dueCount === 1 ? "" : "s"} to review</div>
            <div className="text-xs muted">Questions you missed, back at the right time. Quick points.</div>
          </div>
          <span className="btn-primary btn-sm">Start</span>
        </Link>
      )}
      {weakest.length > 0 ? (
        <section className="card">
          <h2 className="h2 mb-2">🎯 Work on these</h2>
          <ul className="space-y-1 text-sm">
            {weakest.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <Link href={`/learn/topic/${t.id}`} className="flex-1 hover:text-accent-2">{subjectEmoji(t.subject)} {subjectLabel(t.subject)}: {t.name}</Link>
                <span className="badge text-warn">{mastery.get(t.id)}%</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="card flex items-center gap-3">
          <span className="text-4xl sticker-still">🌱</span>
          <div className="text-sm"><b>No weak spots found yet.</b> <span className="muted">Do a few sets and this tab fills with what to fix first.</span></div>
        </section>
      )}
      <WeekPlanCard quizzes={((planned ?? []) as unknown as PlannedQuiz[]).map((q) => ({ ...q, subject: q.topics?.subject ?? null }))} today={today} />
    </>
  );

  const subjectTabs = (
    <Tabs
      storageKey="learn-subject"
      size="sm"
      tabs={subjects.map((subject) => {
        const list = school.filter((t) => t.subject === subject);
        const scores = list.map((t) => mastery.get(t.id)).filter((m): m is number => m !== undefined);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
        const units = [...new Set(list.map((t) => t.unit ?? ""))];
        return {
          id: subject,
          label: subjectLabel(subject),
          emoji: subjectEmoji(subject),
          content: (
            <section className="card" dir={isArabicSubject(subject) ? "rtl" : undefined}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="h2">{subjectEmoji(subject)} {subjectLabel(subject)}</h2>
                <span className="text-xs muted">{scores.length}/{list.length} practised{avg !== null ? ` · avg ${avg}%` : ""}</span>
              </div>
              {units.map((unit) => (
                <div key={unit} className="mb-2">
                  {unit && units.length > 1 && <div className="text-xs font-bold muted mt-2 mb-1">{unit}</div>}
                  <ul className="divide-y divide-line">
                    {list.filter((t) => (t.unit ?? "") === unit).map((t) => (
                      <li key={t.id}>
                        <Link href={`/learn/topic/${t.id}`} className="py-2 flex items-center gap-3 hover:text-accent-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${masteryColor(mastery.get(t.id))}`} />
                          <span className="flex-1 text-sm">{t.name}</span>
                          {mastery.has(t.id) && <span className="text-xs font-semibold">{mastery.get(t.id)}%</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ),
        };
      })}
    />
  );

  const examTab = (
    <>
      {exams.map((exam) => (
        <section key={exam} className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="h2">🎓 {exam} prep</h2>
            {daysToExam !== null && exam === exams[0] && <span className="badge text-accent-2">{daysToExam} days to go</span>}
          </div>
          <p className="text-xs muted">{EXAM_INFO[exam].blurb} Sets are 5 to 8 timed questions.</p>
          <div className="grid grid-cols-2 gap-2">
            {sectionsFor(exam).map(([key, s]) => {
              const m = sectionMastery.get(key);
              const est = scaledEstimate(exam, m ?? null);
              return (
                <div key={key} className="tile space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">{s.label}{s.optional ? "*" : ""}</span>
                    <span className="text-xs muted">{est !== null ? `~${est}` : "no data"}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden"><div className={`h-full ${masteryColor(m)}`} style={{ width: `${m ?? 0}%` }} /></div>
                  <PracticeButton actSection={key} label="Mixed set" className="btn-ghost btn-sm w-full" />
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {exams.length === 2 && (
        <section className="card flex items-center gap-3">
          <span className="text-4xl sticker-still">🔀</span>
          <div className="flex-1">
            <div className="font-bold">{EXAM_SECTIONS.mixed.label}</div>
            <div className="text-xs muted">
              One set alternating SAT and ACT style across all sections.
              {sectionMastery.has("mixed") ? ` Last: ${sectionMastery.get("mixed")}%` : ""}
            </div>
          </div>
          <PracticeButton actSection="mixed" label="Start" className="btn-primary btn-sm" />
        </section>
      )}
      {exams.length > 0 && (
        <section className="card">
          <details>
            <summary className="cursor-pointer text-sm muted">Practice one exam skill at a time</summary>
            <ul className="mt-2 divide-y divide-line">
              {examTopics.map((t) => (
                <li key={t.id} className="py-2 flex items-center gap-2 text-sm">
                  <Link href={`/learn/topic/${t.id}`} className="flex-1 hover:text-accent-2">
                    <span className="muted">{t.subject} · </span>{t.name}
                  </Link>
                  {mastery.has(t.id) && <span className={`w-2 h-2 rounded-full ${masteryColor(mastery.get(t.id))}`} />}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
      {exams.length === 0 && <p className="card muted text-sm">Exam prep opens in grade 9, or when your parent sets a target exam.</p>}
    </>
  );

  const quranTab = (
    <Link href="/learn/memorize" className="card flex items-center gap-3 border-good/40">
      <span className="text-4xl sticker-still">📿</span>
      <div className="flex-1">
        <div className="font-bold">القرآن والحديث · memorise</div>
        <div className="text-xs muted">{memorizeCount ? `${memorizeCount} item${memorizeCount === 1 ? "" : "s"} in your list. ` : ""}Exact ayahs from any surah, or a hadith from your book. Read, hide, recite. Points every day.</div>
      </div>
      <span className="btn-primary btn-sm">Open</span>
    </Link>
  );

  const filesTab = (
    <div className="space-y-3">
      {materials.map((m) => (
        <section key={m.id} className="card space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-3xl sticker-still">{m.mime === "application/pdf" ? "📄" : "🖼️"}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{m.title}</div>
              <div className="text-xs muted">{m.subject ?? "no subject"} · {prettyDate(m.created_at.slice(0, 10))}{m.status !== "ready" ? " · not read yet" : ""}</div>
            </div>
            {materialUrls.get(m.id) && <a href={materialUrls.get(m.id)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Open</a>}
          </div>
          {m.instructions && <p className="text-sm"><b>Teacher says:</b> {m.instructions}</p>}
          {m.summary && <p className="text-xs muted">{m.summary}</p>}
          {m.status === "ready" && m.worksheet?.questions?.length ? <DoWorksheetButton materialId={m.id} questions={m.worksheet.questions.length} attempts={worksheetDone(m.id)} /> : null}
          {m.status === "ready" && !m.worksheet && m.kind === "worksheet" && <PrepareWorksheetButton materialId={m.id} prepared={null} />}
          {m.status === "ready" ? <PractiseFromFile materialId={m.id} sets={setsFor(m.id)} /> : <ReadAgainButton materialId={m.id} />}
        </section>
      ))}
      {materials.length === 0 && <p className="card text-sm muted">No files yet. When the teacher drops a PDF in the group, save it and add it here: the coach reads it and writes practice questions from it.</p>}
      <MaterialUploader familyId={family.id} students={[{ id: profile.id, full_name: profile.full_name }]} subjects={[...new Set((mySubjects ?? []).map((x) => x.name))].sort()} fixedStudentId={profile.id} />
    </div>
  );

  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const thisWeek = (
    <div className="space-y-3">
      {week.length === 0 ? (
        <section className="card flex items-center gap-3">
          <span className="text-4xl sticker-still">🗓️</span>
          <div className="text-sm"><b>Nothing logged yet this week.</b> <span className="muted">Fill in your classes at check-in (what you took in each lesson) and this tab fills with a lesson, diagrams and videos for each one, ready before you open it.</span></div>
        </section>
      ) : (
        <>
          <p className="text-xs muted">What you took at school this week and what is planned next: each topic with a written lesson, diagrams to see it, and the same idea explained by different teachers on video.</p>
          {weekMissing > 0 && <PrepareWeekButton missing={weekMissing} />}
          <ul className="space-y-2">
            {week.map((w) => (
              <li key={w.topic.id}>
                <Link href={`/learn/topic/${w.topic.id}?tab=lesson`} className="card !py-3 flex items-center gap-3 hover:border-accent/60" dir={w.topic.language === "ar" ? "rtl" : undefined}>
                  <span className="text-3xl">{subjectEmoji(w.topic.subject)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold leading-tight">{w.topic.name}</div>
                    <div className="text-xs muted">{subjectLabel(w.topic.subject)} · {w.why === "logged" ? `taken ${w.when === today ? "today" : DAY[weekdayOf(w.when)]}` : `quiz ${w.when === today ? "today" : DAY[weekdayOf(w.when)]}`}{mastery.has(w.topic.id) ? ` · ${mastery.get(w.topic.id)}%` : ""}</div>
                  </div>
                  <div className="flex gap-1 text-base shrink-0" title="lesson · diagrams · videos">
                    <span className={w.hasLesson ? "" : "opacity-25"}>📖</span>
                    <span className={w.hasResources ? "" : "opacity-25"}>🖼️</span>
                    <span className={w.hasResources ? "" : "opacity-25"}>▶️</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );

  const arabicCount = subjects.filter((s) => ARABIC_SUBJECTS.includes(s)).length;
  return (
    <main className="space-y-4">
      <h1 className="h1">Learn</h1>
      <Tabs
        storageKey="learn"
        tabs={[
          { id: "week", label: "This week", emoji: "🗓️", badge: week.length || null, content: thisWeek },
          { id: "me", label: "For me", emoji: "⭐", badge: dueCount ?? 0, content: forMe },
          { id: "subjects", label: "Subjects", emoji: "📚", badge: null, content: subjects.length ? subjectTabs : <p className="card muted">No curriculum loaded for grade {profile.grade}.</p> },
          ...(exams.length ? [{ id: "exams", label: exams.join(" & "), emoji: "🎓", badge: null, content: examTab }] : []),
          { id: "quran", label: arabicCount ? "القرآن" : "Quran", emoji: "📿", badge: memorizeCount ?? 0, content: quranTab },
          { id: "files", label: "Files", emoji: "📎", badge: materials.length || null, content: filesTab },
        ]}
      />
    </main>
  );
}
