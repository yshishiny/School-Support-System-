import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, prettyDate } from "@/lib/dates";
import { EXAM_INFO, EXAM_SECTIONS, examsFor, scaledEstimate, sectionsFor, trackFor } from "@/lib/exams";
import { masteryMaps, masteryColor, type AttemptWithQuiz } from "@/lib/mastery";
import { PracticeButton, PrepareWeekButton } from "@/components/LearnButtons";
import { weekTopicsFor } from "@/lib/learning/resources";
import { weekdayOf } from "@/lib/dates";
import { fileEmoji } from "@/lib/materials/files";
import { materialStages, nextStage } from "@/lib/materials/study";
import { loadRevisions } from "@/lib/revision/run";
import { Tabs } from "@/components/Tabs";
import { Group, MoreList } from "@/components/MoreList";
import { orderSheets, orderTasks, sheetAction, urgencyOf, whatNow, type Quiz as WQuiz, type Sheet as WSheet, type Task as WTask } from "@/lib/learn/workspace";
import { setAssignmentStatusAction } from "@/lib/actions/assignments";
import { CheckMyWorking } from "@/components/CheckMyWorking";
import { Seated } from "@/components/Seated";
import { learnerOf, schoolTopicsFor } from "@/lib/curriculum";
import { MaterialUploader } from "@/components/MaterialUploader";
import { DoWorksheetButton, PractiseFromFile, PrepareWorksheetButton, ReadAgainButton } from "@/components/MaterialCards";
import { signMaterialUrls, type MaterialRow } from "@/lib/materials/server";
import { WeekPlanCard } from "@/components/WeekPlanCard";
import type { PlannedQuiz } from "@/lib/plan/prepare";
import { shiftDate } from "@/lib/dates";
import { isArabicSubject, subjectEmoji, subjectLabel, ARABIC_SUBJECTS } from "@/lib/plan";
import type { Topic } from "@/lib/types";

export const maxDuration = 300;


/**
 * This child's topics: his year's syllabus, plus the exam tracks he is preparing for.
 *
 * The exam half used to be lost the moment a parent set a curriculum. The curriculum branch returned and the
 * SAT and ACT rows — which belong to no curriculum, because they belong to no school year — never came back,
 * so a grade-10 child silently stopped seeing the exam he is sitting. They are fetched by track instead, which
 * is what they are keyed by.
 */
async function curriculumTopics(
  profile: { id: string; grade: number | null; curriculum_id?: string | null; stream?: string | null },
  examTracks: Set<"act" | "sat">,
): Promise<Topic[]> {
  const supabase = await createClient();
  const [school, exam] = await Promise.all([
    schoolTopicsFor(learnerOf(profile)),
    examTracks.size === 0
      ? Promise.resolve({ data: [] as Topic[] })
      : supabase.from("topics").select("*").in("track", [...examTracks]).order("subject").order("sort"),
  ]);
  return [...school, ...((exam.data ?? []) as Topic[])];
}

export default async function LearnPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const exams = examsFor(profile.target_exam, profile.grade);
  const examTracks = new Set(exams.map(trackFor));

  const [topics, { data: attempts }, { count: dueCount }, { count: memorizeCount }, { data: planned }, { data: materialRows }, { data: materialQuizzes }, { data: mySubjects }, { data: myTasks }] = await Promise.all([
    curriculumTopics(profile, examTracks),
    supabase.from("attempts").select("*, quizzes(topic_id, act_section, track, title)").eq("student_id", profile.id).not("submitted_at", "is", null),
    supabase.from("review_queue").select("id", { count: "exact", head: true }).eq("student_id", profile.id).lte("due_date", today),
    supabase.from("memorize_items").select("id", { count: "exact", head: true }).eq("student_id", profile.id),
    supabase.from("quizzes").select("id, title, scheduled_for, plan_slot, topic_id, act_section, topics(subject), attempts(score, total, submitted_at)").eq("student_id", profile.id).not("scheduled_for", "is", null).gte("scheduled_for", shiftDate(today, -6)).lte("scheduled_for", shiftDate(today, 6)).order("scheduled_for"),
    supabase.from("materials").select("*").eq("student_id", profile.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("quizzes").select("material_id, title, attempts(submitted_at)").eq("student_id", profile.id).not("material_id", "is", null),
    supabase.from("subjects").select("name").eq("student_id", profile.id),
    supabase.from("assignments").select("id, title, subject_name, due_date, kind").eq("student_id", profile.id).is("completed_at", null).neq("kind", "sign").limit(100),
  ]);
  const week = await weekTopicsFor(profile.id, profile.grade, family.timezone);
  const revisions = await loadRevisions([profile.id], 12).catch(() => []);
  const weekMissing = week.filter((w) => !w.hasLesson || !w.hasResources).length;
  const materials = (materialRows ?? []) as MaterialRow[];
  const materialUrls = await signMaterialUrls(materials.map((m) => ({ id: m.id, path: m.path })));
  type MQ = { material_id: string | null; title: string; attempts: { submitted_at: string | null }[] };
  const mq = (materialQuizzes ?? []) as MQ[];
  const setsFor = (id: string) => mq.filter((q) => q.material_id === id && !q.title.startsWith("Worksheet:")).length;
  const attemptDatesFor = (id: string) => mq.filter((q) => q.material_id === id).flatMap((q) => q.attempts.filter((a) => a.submitted_at).map((a) => a.submitted_at!.slice(0, 10)));
  const worksheetDone = (id: string) => mq.filter((q) => q.material_id === id && q.title.startsWith("Worksheet:") && q.attempts.some((a) => a.submitted_at)).length;
  const all = topics ?? [];
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
              {/* Units are closed to start. Chemistry alone is 52 topics, which is three phone screens of list
                  before a child reaches the second subject — the headings are what you navigate by anyway. */}
              {units.map((unit) => {
                const inUnit = list.filter((t) => (t.unit ?? "") === unit);
                const rows = (
                  <ul className="divide-y divide-line">
                    {inUnit.map((t) => (
                      <li key={t.id}>
                        <Link href={`/learn/topic/${t.id}`} className="py-2 flex items-center gap-3 hover:text-accent-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${masteryColor(mastery.get(t.id))}`} />
                          <span className="flex-1 text-sm">{t.name}</span>
                          {mastery.has(t.id) && <span className="text-xs font-semibold">{mastery.get(t.id)}%</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                );
                if (!unit || units.length === 1) return <div key={unit} className="mb-2">{rows}</div>;
                const doneHere = inUnit.filter((t) => mastery.has(t.id)).length;
                return (
                  <Group
                    key={unit}
                    title={unit}
                    count={inUnit.length}
                    note={doneHere > 0 ? `${doneHere} practised` : undefined}
                    dir={isArabicSubject(subject) ? "rtl" : undefined}
                  >
                    {rows}
                  </Group>
                );
              })}
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
      {revisions.length > 0 && (
        <section className="card space-y-2 border-accent/50">
          <h2 className="h2">📚 Monthly revision</h2>
          <p className="text-xs muted">One sheet and one quiz per subject, built from everything the school shared this month. Read, then sit the quiz.</p>
          <ul className="divide-y divide-line text-sm">
            {revisions.map((r) => (
              <li key={r.id} className="py-2 flex items-center gap-2">
                <span className="text-xl">{subjectEmoji(r.subject)}</span>
                <span className="flex-1"><b>{r.subject}</b> <span className="muted text-xs">· {r.month.slice(0, 7)}{r.status !== "ready" ? ` · ${r.status}` : ""}</span></span>
                {r.status === "ready" && <Link href={`/learn/revision/${r.id}`} className="btn-primary btn-sm">Open</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <MoreList show={2} noun="more file" className="space-y-3">
      {materials.map((m) => (
        <section key={m.id} className="card space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-3xl sticker-still">{fileEmoji(m.mime)}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{m.title}</div>
              {m.original_name && <div className="text-[11px] muted truncate">📄 {m.original_name}</div>}
              <div className="text-xs muted">{m.subject ?? "no subject"} · {prettyDate(m.created_at.slice(0, 10))}{m.status !== "ready" ? " · not read yet" : ""}</div>
            </div>
            {materialUrls.get(m.id) && <a href={materialUrls.get(m.id)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Open</a>}
          </div>
          {m.status === "ready" && (() => {
            const st = materialStages(m.created_at.slice(0, 10), attemptDatesFor(m.id), today);
            const nx = nextStage(st);
            return (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {st.map((s) => <span key={s.n} className={`chip ${s.state === "done" ? "text-good" : s.state === "overdue" ? "text-bad" : s.state === "due" ? "text-warn" : "muted"}`}>{s.state === "done" ? "✓" : s.state === "overdue" ? "⏰" : "·"} {s.label}{s.state !== "done" ? ` by ${prettyDate(s.dueBy)}` : ""}</span>)}
                {nx && <span className="muted">→ {nx.state === "overdue" ? "late:" : "next:"} {nx.label.toLowerCase()} · counts for the allowance</span>}
              </div>
            );
          })()}
          {m.instructions && <p className="text-sm"><b>Teacher says:</b> {m.instructions}</p>}
          {m.summary && <p className="text-xs muted">{m.summary}</p>}
          {m.status === "ready" && m.worksheet?.questions?.length ? <DoWorksheetButton materialId={m.id} questions={m.worksheet.questions.length} attempts={worksheetDone(m.id)} /> : null}
          {m.status === "ready" && !m.worksheet && m.kind === "worksheet" && <PrepareWorksheetButton materialId={m.id} prepared={null} />}
          {m.status === "ready" ? <PractiseFromFile materialId={m.id} sets={setsFor(m.id)} /> : <ReadAgainButton materialId={m.id} />}
        </section>
      ))}
      </MoreList>
      {materials.length === 0 && <p className="card text-sm muted">No files yet. When the teacher drops a PDF in the group, save it and add it here: the coach reads it and writes practice questions from it.</p>}
      <MaterialUploader familyId={family.id} students={[{ id: profile.id, full_name: profile.full_name }]} subjects={[...new Set((mySubjects ?? []).map((x) => x.name))].sort()} fixedStudentId={profile.id} />
    </div>
  );

  // ── What he actually has to do, in the order he would do it ─────────────────
  // Learn used to open on six tabs and leave a child to assemble his evening out of them. His day starts with
  // the school's sheets and what is owed on them; everything else here is reference.
  const wTasks: WTask[] = ((myTasks ?? []) as { id: string; title: string; subject_name: string | null; due_date: string | null; kind: string }[])
    .map((a) => ({ id: a.id, title: a.title, subject: a.subject_name, dueDate: a.due_date, kind: a.kind }));
  const wSheets: WSheet[] = materials.filter((m) => m.status === "ready").map((m) => ({
    id: m.id,
    title: m.title,
    subject: m.subject,
    createdAt: m.created_at,
    solvable: !!m.worksheet?.questions?.length,
    sets: setsFor(m.id),
    hasLesson: (m.topics?.length ?? 0) > 0,
  }));
  const wQuizzes: WQuiz[] = ((planned ?? []) as unknown as PlannedQuiz[])
    .map((q) => ({ id: q.id, title: q.title, scheduledFor: q.scheduled_for, done: q.attempts.some((a) => a.submitted_at) }));
  const now = whatNow(wTasks, wSheets, wQuizzes, today);
  const orderedTasks = orderTasks(wTasks, today);
  const quizzesToSit = wQuizzes.filter((q) => !q.done && q.scheduledFor !== null && q.scheduledFor <= today);

  const myWork = (
    <div className="space-y-3">
      <section className="card !py-3 border-2 border-accent/50">
        <div className="text-[11px] uppercase tracking-wide muted">Do this next</div>
        <p className="text-base font-semibold leading-snug mt-0.5">{now.line}</p>
      </section>

      {orderedTasks.length > 0 && (
        <section className="card space-y-1">
          <h2 className="h2 text-base">📝 My homework <span className="muted font-normal text-sm">· {orderedTasks.length}</span></h2>
          <MoreList show={4} noun="more" className="divide-y divide-line">
            {orderedTasks.map((t) => {
              const u = urgencyOf(t.dueDate, today);
              return (
                <div key={t.id} className="py-2 flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{t.title}</span>
                    <span className="block text-xs muted">
                      {t.subject ?? "school"}
                      {u === "late" ? <span className="text-bad"> · late</span>
                        : u === "today" ? <span className="text-warn"> · due today</span>
                        : t.dueDate ? ` · due ${prettyDate(t.dueDate)}` : " · no date given"}
                    </span>
                  </span>
                  <form action={setAssignmentStatusAction} className="shrink-0">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value="done" />
                    <button className="btn-ghost btn-sm">Done ✓</button>
                  </form>
                </div>
              );
            })}
          </MoreList>
        </section>
      )}

      {quizzesToSit.length > 0 && (
        <section className="card space-y-1">
          <h2 className="h2 text-base">⚡ Quizzes to sit <span className="muted font-normal text-sm">· {quizzesToSit.length}</span></h2>
          <ul className="divide-y divide-line">
            {quizzesToSit.map((q) => (
              <li key={q.id} className="py-2 flex items-center gap-2">
                <span className="flex-1 text-sm">{q.title}</span>
                <Link href={`/quiz/${q.id}`} className="btn-primary btn-sm shrink-0">Start</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="h2 text-base px-1">📄 My sheets from school <span className="muted font-normal text-sm">· {wSheets.length}</span></h2>
        {wSheets.length === 0 ? (
          <p className="card text-sm muted">No sheets yet. When a parent adds a file from the class group it appears here, with a lesson and practice built from it.</p>
        ) : (
          <MoreList show={3} noun="more sheet" className="space-y-2">
            {orderSheets(wSheets).map((m) => {
              const act = sheetAction(m);
              const full = materials.find((x) => x.id === m.id)!;
              return (
                <section key={m.id} className="card space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-2xl shrink-0">{fileEmoji(full.mime)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold leading-tight">{m.title}</div>
                      <div className="text-xs muted">{m.subject ?? "school"} · {prettyDate(m.createdAt.slice(0, 10))}</div>
                    </div>
                    {materialUrls.get(m.id) && (
                      <a href={materialUrls.get(m.id)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm shrink-0">Open</a>
                    )}
                  </div>
                  {full.summary && <p className="text-xs muted leading-snug">{full.summary.slice(0, 180)}</p>}
                  <p className="text-[11px] muted">{act.hint}</p>
                  {m.solvable
                    ? <DoWorksheetButton materialId={m.id} questions={full.worksheet!.questions.length} attempts={worksheetDone(m.id)} />
                    : <PractiseFromFile materialId={m.id} sets={m.sets} />}
                  {/* The other half of finishing a sheet. Plenty of school work has to be written by hand, and
                      until now there was nowhere to put it once it was done on paper. */}
                  <details className="group">
                    <summary className="btn-ghost btn-sm w-full justify-center cursor-pointer list-none">
                      <span className="group-open:hidden">📷 I did it on paper — check it</span>
                      <span className="hidden group-open:inline">Close</span>
                    </summary>
                    <div className="mt-2">
                      <CheckMyWorking
                        materialId={m.id}
                        title="Photograph your answers"
                        blurb={`${m.title} · Take a clear photo of the page you wrote. You will be told where it first goes wrong — not the answer.`}
                      />
                    </div>
                  </details>
                </section>
              );
            })}
          </MoreList>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="h2 text-base">🎯 Want a better grade?</h2>
        <p className="text-xs muted">
          Homework gets you through the week; practice moves the grade. Eight fresh questions each time, aimed at
          what you got wrong before.
        </p>
        {weakest.length > 0 ? (
          <ul className="divide-y divide-line text-sm">
            {weakest.slice(0, 3).map((t) => (
              <li key={t.id} className="py-2 flex items-center gap-2">
                <Link href={`/learn/topic/${t.id}`} className="flex-1 min-w-0 truncate hover:text-accent-2">
                  {subjectEmoji(t.subject)} {t.name}
                </Link>
                <span className="badge text-warn text-xs shrink-0">{mastery.get(t.id)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm muted">Do a few sets and the weakest topics show up here to fix first.</p>
        )}
        {(dueCount ?? 0) > 0 && (
          <Link href="/review" className="btn-ghost btn-sm w-full justify-center">
            {dueCount} review{dueCount === 1 ? "" : "s"} waiting →
          </Link>
        )}
      </section>
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
          <MoreList show={4} noun="more topic" className="space-y-2">
            {week.map((w) => (
              <div key={w.topic.id}>
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
              </div>
            ))}
          </MoreList>
        </>
      )}
    </div>
  );

  const arabicCount = subjects.filter((s) => ARABIC_SUBJECTS.includes(s)).length;
  return (
    <main className="space-y-4">
      <h1 className="h1">Learn</h1>
      <Seated
        links={[
          { href: "/coach", label: "Coach", emoji: "\u{1F9B8}", note: "Practice, habits and your next step" },
        ]}
      />
      <Tabs
        storageKey="learn"
        tabs={[
          { id: "work", label: "My work", emoji: "🎒", badge: orderedTasks.length + quizzesToSit.length || null, content: myWork },
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
