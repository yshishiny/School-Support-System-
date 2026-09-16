"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { registerSnapAction, type RegisterResult } from "@/lib/actions/snaps";

const MAX_SIDE = 1600;

/** Downscales in the browser (smaller upload, no EXIF) and returns a JPEG blob plus its SHA-256. */
async function prepare(file: File): Promise<{ blob: Blob; sha: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not read the picture."))), "image/jpeg", 0.85));
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const sha = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { blob, sha };
}

const VERDICT_LINE: Record<string, string> = {
  looks_good: "Looks good ✅",
  unclear: "Hard to see 🤔 · try again with more light",
  not_it: "Hmm, that does not look done yet",
  people: "No people in the picture please 🙈 · take it again",
  error: "Sent ✅ · a parent will check it",
};

/** One camera button per task. The picture goes straight to the private bucket, then the AI answers in a few seconds. */
export function SnapCapture({ familyId, studentId, taskId, label, done, compact = false }: { familyId: string; studentId: string; taskId: string; label: string; done: boolean; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setError(null);
    setResult(null);
    try {
      setBusy("Preparing…");
      const { blob, sha } = await prepare(f);
      setBusy("Sending…");
      const supabase = createBrowserSupabase();
      const path = `${familyId}/${studentId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("snaps").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);
      setBusy("Coach is looking…");
      const r = await registerSnapAction(taskId, path, sha);
      if (r.error) throw new Error(r.error);
      setResult(r);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={compact ? "" : "space-y-1"}>
      <label className={`${done ? "btn-ghost" : "btn-primary"} btn-sm cursor-pointer inline-flex items-center gap-1 ${busy ? "opacity-60" : ""}`}>
        {busy ?? (done ? "📷 Send another" : `📷 Snap ${label.toLowerCase()}`)}
        <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={!!busy} onChange={(e) => onFile(e.target.files)} />
      </label>
      {error && <p className="text-xs text-bad">{error}</p>}
      {result && (
        <div className="text-xs space-y-0.5">
          <div className="font-semibold">{VERDICT_LINE[result.verdict ?? "error"] ?? "Sent"}{result.earned ? ` · +${result.earned} ★` : ""}</div>
          {result.kidNote && <div className="muted">{result.kidNote}</div>}
          {result.handwriting && (
            <div className="tile !p-2 mt-1 space-y-1">
              <div className="font-bold">Handwriting score {result.handwriting.score}/100</div>
              {result.handwriting.focus.length > 0 && <div>Work on: {result.handwriting.focus.join(" · ")}</div>}
              <div>Copy this line five times next time:<br /><b className="text-base" style={{ fontFamily: "var(--font-arabic), var(--font-display)" }}>{result.handwriting.practiceLine}</b></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
