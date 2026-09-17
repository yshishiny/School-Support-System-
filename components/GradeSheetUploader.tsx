"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { registerGradeSheetAction } from "@/lib/actions/grades";

/** A photo or PDF of the school's grades sheet, once a month. Read by the AI, appraised, counted for the allowance. */
export function GradeSheetUploader({ familyId, studentId, month }: { familyId: string; studentId: string; month: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function onFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setMsg(null);
    try {
      if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type)) throw new Error("PDF, JPG, PNG or WEBP only.");
      if (f.size > 20 * 1024 * 1024) throw new Error("Over 20 MB.");
      setBusy("Uploading…");
      const ext = f.type === "application/pdf" ? "pdf" : f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
      const path = `${familyId}/${studentId}/grades-${month}-${crypto.randomUUID()}.${ext}`;
      const { error } = await createBrowserSupabase().storage.from("materials").upload(path, f, { contentType: f.type });
      if (error) throw new Error(error.message);
      setBusy("Reading the sheet…");
      const r = await registerGradeSheetAction(studentId, path, f.type, month);
      if (r.error) throw new Error(r.error);
      setMsg(`Done${r.average !== null && r.average !== undefined ? ` · average ${r.average}%` : ""}.`);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-1">
      <label className={`btn-primary btn-sm cursor-pointer inline-flex ${busy ? "opacity-60" : ""}`}>
        {busy ?? "📊 Upload this month's grades sheet"}
        <input type="file" accept="application/pdf,image/*" capture="environment" className="sr-only" disabled={!!busy} onChange={(e) => onFile(e.target.files)} />
      </label>
      {msg && <p className="text-xs muted">{msg}</p>}
    </div>
  );
}
