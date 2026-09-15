"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { processChatArchiveAction } from "@/lib/actions/archive";
import { Notice } from "./ui";

const MAX_BYTES = 100 * 1024 * 1024;

/** Uploads a WhatsApp export straight to Storage (so big zips work), then asks the server to unpack and study it. */
export function ChatArchiveUploader({ familyId, students }: { familyId: string; students: { id: string; full_name: string }[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ messages: number; attachments: number } | null>(null);

  async function run() {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("That file is over 100 MB. Export without media, or split the export.");
      return;
    }
    const ext = file.name.toLowerCase().endsWith(".zip") ? "zip" : "txt";
    const path = `${familyId}/${crypto.randomUUID()}/${file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || `export.${ext}`}`;
    try {
      setPhase("uploading");
      const supabase = createBrowserSupabase();
      const { error: upErr } = await supabase.storage.from("chat-archives").upload(path, file, { contentType: ext === "zip" ? "application/zip" : "text/plain", upsert: false });
      if (upErr) throw new Error(upErr.message);
      setPhase("processing");
      const r = await processChatArchiveAction(path, label || file.name.replace(/\.(zip|txt)$/i, ""), studentId || null);
      if (r.error) throw new Error(r.error);
      setResult({ messages: r.messages ?? 0, attachments: r.attachments ?? 0 });
      setPhase("done");
      router.refresh();
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (phase === "done" && result) {
    return (
      <div className="card space-y-2">
        <p className="h2">Archive stored ✓</p>
        <p className="text-sm">{result.messages} messages and {result.attachments} attachments read. The study of how this group communicates is below.</p>
        <button className="btn-ghost" onClick={() => { setPhase("idle"); setFile(null); setResult(null); }}>Upload another</button>
      </div>
    );
  }

  const busy = phase !== "idle";
  return (
    <div className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Export file (.zip with media, or .txt)</label>
          <input type="file" accept=".zip,.txt,application/zip,text/plain" className="input" disabled={busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label className="label">Which child&apos;s group</label>
          <select className="input" value={studentId} disabled={busy} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
            <option value="">Both / not sure</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Label</label>
        <input className="input" placeholder="e.g. Grade 9 parents group 2025-26" value={label} disabled={busy} maxLength={120} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <button className="btn-primary w-full" disabled={!file || busy} onClick={run}>
        {phase === "uploading" ? "Uploading…" : phase === "processing" ? "Reading messages and learning the group… up to 3 minutes" : "Upload and study"}
      </button>
      <Notice error={error ?? undefined} />
    </div>
  );
}
