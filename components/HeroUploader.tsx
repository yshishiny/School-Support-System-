"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { registerHeroImageAction } from "@/lib/actions/hero";
import { Notice } from "./ui";

const MAX = 10 * 1024 * 1024;

/** Uploads one or more pictures straight to the private bucket, then registers them. */
export function HeroUploader({ familyId, studentId, compact = false }: { familyId: string; studentId: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const supabase = createBrowserSupabase();
    let n = 0;
    for (const f of Array.from(files).slice(0, 10)) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError(`${f.name}: only JPG, PNG or WEBP.`); continue; }
      if (f.size > MAX) { setError(`${f.name} is over 10 MB.`); continue; }
      n += 1;
      setBusy(`Uploading ${n} of ${files.length}…`);
      const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
      const path = `${familyId}/${studentId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("hero-images").upload(path, f, { contentType: f.type, upsert: false });
      if (upErr) { setError(upErr.message); break; }
      const r = await registerHeroImageAction(studentId, path, f.name.replace(/\.[a-z]+$/i, ""));
      if (r.error) { setError(r.error); break; }
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <div className={compact ? "" : "space-y-1"}>
      <label className={`btn-ghost btn-sm cursor-pointer ${busy ? "opacity-60" : ""}`}>
        {busy ?? "🖼️ Add pictures"}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={!!busy} onChange={(e) => onFiles(e.target.files)} />
      </label>
      <Notice error={error ?? undefined} />
    </div>
  );
}
