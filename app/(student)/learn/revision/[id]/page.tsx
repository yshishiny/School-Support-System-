import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** One month's revision sheet for one subject, with its quiz. */
export default async function RevisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const { data: row } = await supabase.from("revision_sheets").select("id, month, subject, content_md, quiz_id, status, error").eq("id", id).eq("student_id", profile.id).maybeSingle();
  if (!row) notFound();
  const { data: attempt } = row.quiz_id ? await supabase.from("attempts").select("score, total, submitted_at").eq("quiz_id", row.quiz_id).eq("student_id", profile.id).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const ar = /[؀-ۿ]/.test((row.content_md ?? "").slice(0, 200));
  return (
    <main className="space-y-4" dir={ar ? "rtl" : undefined} lang={ar ? "ar" : undefined}>
      <Link href="/learn?tab=files" className="text-sm muted">← Learn</Link>
      <header className="card">
        <div className="text-xs muted">Monthly revision · {row.month.slice(0, 7)}</div>
        <h1 className="h1">{row.subject}</h1>
        <p className="text-sm muted mt-1">Read the sheet once, close it, then sit the quiz. The sheet is built only from what the school shared this month.</p>
        {row.quiz_id && (
          <div className="mt-3 flex items-center gap-2">
            <Link href={`/quiz/${row.quiz_id}`} className="btn-primary">{attempt ? "Sit it again" : "Sit the revision quiz (12 questions)"}</Link>
            {attempt && <span className="badge">{attempt.score}/{attempt.total}</span>}
          </div>
        )}
      </header>
      {row.status === "ready" && row.content_md ? (
        <article className="card prose-lesson text-sm leading-relaxed space-y-2"><ReactMarkdown>{row.content_md}</ReactMarkdown></article>
      ) : (
        <p className="card text-sm muted">{row.status === "failed" ? `Could not be written: ${row.error}` : "Being written…"}</p>
      )}
    </main>
  );
}
