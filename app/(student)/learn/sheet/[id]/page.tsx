import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CheckMyWorking } from "@/components/CheckMyWorking";
import { DoWorksheetButton, PractiseFromFile, PrepareWorksheetButton } from "@/components/MaterialCards";
import { Group } from "@/components/MoreList";
import { fileEmoji } from "@/lib/materials/files";
import { signMaterialUrls, type MaterialRow } from "@/lib/materials/server";
import { headlineOf, labelOf, routesOf, sheetFirst, viewerFor, type SheetFile } from "@/lib/learn/sheet";
import { prettyDate } from "@/lib/dates";
import { subjectEmoji } from "@/lib/plan";

export const maxDuration = 300;

/**
 * One school file, for the child it was given to.
 *
 * A file used to be a row with an "Open" link that left the app for a raw PDF in a browser tab. The sheet, what
 * it was about, the questions on it and the two ways of finishing it were in four different places, and the
 * title — the one thing a child would tap — was not a link at all. This is that one place.
 */
export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireStudent();
  const supabase = await createClient();

  // Scoped to this child by the query itself, so a guessed id in the address bar reaches nothing.
  const { data } = await supabase.from("materials").select("*").eq("id", id).eq("student_id", profile.id).maybeSingle();
  const m = data as MaterialRow | null;
  if (!m) notFound();

  const admin = createAdminClient();
  const [urls, { data: quizRows }] = await Promise.all([
    signMaterialUrls([{ id: m.id, path: m.path }]),
    admin.from("quizzes").select("id, title, attempts(submitted_at)").eq("student_id", profile.id).eq("material_id", m.id),
  ]);
  const quizzes = (quizRows ?? []) as { id: string; title: string; attempts: { submitted_at: string | null }[] }[];
  const url = urls.get(m.id);
  const worksheetQuizzes = quizzes.filter((q) => q.title.startsWith("Worksheet:"));
  const sat = worksheetQuizzes.filter((q) => q.attempts.some((a) => a.submitted_at)).length;

  const sheet: SheetFile = {
    mime: m.mime,
    questions: m.worksheet?.questions.length ?? 0,
    hasQuestions: m.has_questions ?? m.kind === "worksheet",
    error: m.worksheet_error,
    sets: quizzes.length - worksheetQuizzes.length,
    hasDigest: (m.digest?.length ?? 0) > 200,
  };
  const routes = routesOf(sheet);
  const viewer = viewerFor(m.mime);
  const arabic = m.language === "arabic";

  // On a sheet with questions the buttons lead and the sheet sits under them; on a letter home or a page of
  // notes there is nothing to answer, so the file itself comes first.
  const actionBlock = (
    <section className="space-y-2">
      {routes.map((r) => {
        const { label, hint } = labelOf(r);
        if (r === "answer") {
          return (
            <div key={r} className="card space-y-1.5 border-2 border-accent/50">
              <div className="font-bold text-sm">{label}</div>
              <p className="text-xs muted">{hint}</p>
              <DoWorksheetButton materialId={m.id} questions={sheet.questions} attempts={sat} />
            </div>
          );
        }
        if (r === "waiting") {
          return (
            <div key={r} className="card space-y-1.5">
              <div className="font-bold text-sm">{sheet.error ? "📝 Answering it here did not work" : label}</div>
              <p className="text-xs muted">{sheet.error ?? hint}</p>
              {/* The child can ask for it now rather than waiting for tonight's sweep. */}
              <PrepareWorksheetButton materialId={m.id} prepared={null} />
            </div>
          );
        }
        if (r === "practise") {
          return (
            <div key={r} className="card space-y-1.5">
              <div className="font-bold text-sm">{label}</div>
              <p className="text-xs muted">{hint}</p>
              <PractiseFromFile materialId={m.id} sets={sheet.sets} />
            </div>
          );
        }
        // CheckMyWorking is its own card with its own heading, so it is not wrapped in a second one.
        return <CheckMyWorking key={r} materialId={m.id} title={label} blurb={hint} />;
      })}
    </section>
  );

  const sheetBlock = (
    <section className="card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="h2 !text-base">📄 The sheet</h2>
        {url && <a href={url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm shrink-0">Open full size</a>}
      </div>
      {!url ? (
        <p className="text-sm muted">The file could not be opened just now. Try again in a moment.</p>
      ) : viewer === "image" ? (
        <a href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={m.title} className="w-full rounded-lg border border-line bg-white" />
        </a>
      ) : viewer === "pdf" ? (
        <iframe src={url} title={m.title} className="w-full h-[70vh] rounded-lg border border-line bg-white" />
      ) : (
        <p className="text-sm muted">This kind of file has no reader on a phone. Tap <b>Open full size</b> to download it — or just work from what it says below.</p>
      )}
    </section>
  );

  return (
    <div className="space-y-3">
      <Link href="/learn" className="btn-ghost btn-sm">← My work</Link>

      <header className="card space-y-1">
        <div className="flex items-start gap-2">
          <span className="text-3xl shrink-0">{fileEmoji(m.mime)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="h1 !text-xl leading-tight" dir="auto">{m.title}</h1>
            <p className="text-xs muted">
              {m.subject ? `${subjectEmoji(m.subject)} ${m.subject} · ` : ""}{prettyDate(m.created_at.slice(0, 10))}
              {m.status !== "ready" ? " · not read yet" : ""}
            </p>
          </div>
        </div>
        <p className="text-sm font-semibold pt-1">{headlineOf(sheet, sat)}</p>
        {m.instructions && (
          <p className="text-xs muted" dir="auto"><b>From the teacher:</b> {m.instructions}</p>
        )}
      </header>

      {sheetFirst(sheet) ? <>{sheetBlock}{actionBlock}</> : <>{actionBlock}{sheetBlock}</>}

      {(m.summary || (m.topics?.length ?? 0) > 0 || m.digest) && (
        <section className="card space-y-2">
          <h2 className="h2 !text-base">🧠 What it is about</h2>
          {m.summary && <p className="text-sm" dir="auto">{m.summary}</p>}
          {(m.topics?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {m.topics!.map((t) => <span key={t} className="chip !text-xs" dir="auto">{t}</span>)}
            </div>
          )}
          {m.digest && (
            <Group title="The whole thing in short" dir={arabic ? "rtl" : undefined}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed" dir="auto">{m.digest}</p>
            </Group>
          )}
        </section>
      )}

      {quizzes.length > 0 && (
        <section className="card space-y-2">
          <h2 className="h2 !text-base">✅ What you have done on this sheet</h2>
          <ul className="divide-y divide-line text-sm">
            {quizzes.map((q) => {
              const done = q.attempts.filter((a) => a.submitted_at).length;
              return (
                <li key={q.id} className="py-2 flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate" dir="auto">{q.title}</span>
                  <span className="text-xs muted shrink-0">{done ? `done ${done}×` : "not sat"}</span>
                  <Link href={`/quiz/${q.id}`} className="btn-ghost btn-sm shrink-0">{done ? "Again" : "Start"}</Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
