import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChatArchiveUploader } from "@/components/ChatArchiveUploader";
import { DeleteArchiveButton } from "@/components/DeleteArchiveButton";
import { prettyDate } from "@/lib/dates";

export const maxDuration = 300;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ArchiveRow {
  id: string;
  label: string;
  status: string;
  error: string | null;
  message_count: number;
  attachment_count: number;
  first_date: string | null;
  last_date: string | null;
  stats: { senders?: { name: string; messages: number; attachments: number }[]; kinds?: Record<string, number>; weekdays?: number[]; hours?: number[] } | null;
  insights_md: string | null;
  uploaded_at: string;
  profiles: { full_name: string } | null;
}

export default async function ArchivePage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const [{ data: kids }, { data: archives }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
    supabase.from("chat_archives").select("*, profiles!chat_archives_student_id_fkey(full_name)").eq("family_id", family.id).order("uploaded_at", { ascending: false }),
  ]);
  const list = (archives ?? []) as ArchiveRow[];

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Chat archive</h1>
        <Link href="/parent/import" className="btn-ghost btn-sm">← Import</Link>
      </div>
      <div className="card text-sm space-y-1 muted">
        <p><b className="text-ink">Why:</b> upload last year&apos;s group exports and the app studies how teachers announce homework, quizzes and events, which senders matter, and what arrives as photos or PDFs. Future imports use those conventions.</p>
        <p><b className="text-ink">How:</b> in WhatsApp open the group → <b className="text-ink">Export chat</b> → <b className="text-ink">Include media</b> (or without) → save the .zip → upload it here. Big files upload straight to storage, so 50 to 100 MB is fine.</p>
        <p>Only you can see the archive. Phone numbers are never sent to the model.</p>
      </div>
      <ChatArchiveUploader familyId={family.id} students={kids ?? []} />

      {list.map((a) => (
        <section key={a.id} className="card space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold">{a.label}</div>
              <div className="text-xs muted">
                {a.profiles?.full_name ?? "Both"} · uploaded {prettyDate(a.uploaded_at.slice(0, 10))}
                {a.first_date && a.last_date ? ` · ${prettyDate(a.first_date)} → ${prettyDate(a.last_date)}` : ""}
              </div>
            </div>
            <span className={`badge ${a.status === "ready" ? "text-good" : a.status === "failed" ? "text-bad" : ""}`}>{a.status}</span>
          </div>
          {a.status === "failed" && <p className="text-sm text-bad">{a.error}</p>}
          {a.status === "ready" && (
            <>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <Stat n={a.message_count} label="messages" />
                <Stat n={a.attachment_count} label="attachments" />
                <Stat n={a.stats?.senders?.length ?? 0} label="senders" />
              </div>
              {a.stats?.kinds && Object.keys(a.stats.kinds).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(a.stats.kinds).sort((x, y) => y[1] - x[1]).map(([k, v]) => (
                    <span key={k} className="badge">{kindEmoji(k)} {v} {k}</span>
                  ))}
                </div>
              )}
              {a.stats?.weekdays && (
                <div className="flex items-end gap-1 h-12">
                  {a.stats.weekdays.map((v, i) => {
                    const max = Math.max(1, ...a.stats!.weekdays!);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full rounded-t bg-accent/70" style={{ height: `${Math.round((v / max) * 36)}px` }} title={`${v} messages`} />
                        <span className="text-[10px] muted">{DAYS[i]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {a.stats?.senders && (
                <details className="text-sm">
                  <summary className="cursor-pointer muted">Who posts most</summary>
                  <ul className="mt-1 space-y-0.5">
                    {a.stats.senders.slice(0, 10).map((s) => (
                      <li key={s.name} className="flex justify-between"><span className="truncate">{s.name}</span><span className="muted shrink-0">{s.messages} msgs · {s.attachments} files</span></li>
                    ))}
                  </ul>
                </details>
              )}
              {a.insights_md ? (
                <div className="prose-lesson text-sm rounded-xl bg-panel-2 p-3">
                  <ReactMarkdown>{a.insights_md}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-xs muted">No AI study for this archive (the model was unavailable). The messages are stored anyway.</p>
              )}
            </>
          )}
          <div className="flex justify-end">
            <DeleteArchiveButton archiveId={a.id} />
          </div>
        </section>
      ))}
    </main>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl bg-panel-2 p-2">
      <div className="text-xl font-extrabold">{n}</div>
      <div className="text-xs muted">{label}</div>
    </div>
  );
}

function kindEmoji(kind: string): string {
  return { image: "🖼️", video: "🎬", audio: "🎤", pdf: "📄", doc: "📝", sheet: "📊", slides: "📽️", other: "📎" }[kind] ?? "📎";
}
