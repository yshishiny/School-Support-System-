"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { addHadithItemAction, addQuranItemAction } from "@/lib/actions/memorize";
import { SURAHS } from "@/lib/quran";
import { Notice, SubmitButton } from "./ui";

export function MemorizeForms() {
  const router = useRouter();
  const [tab, setTab] = useState<"quran" | "hadith">("quran");
  const [q, quranAction] = useActionState(addQuranItemAction, undefined);
  const [h, hadithAction] = useActionState(addHadithItemAction, undefined);
  const [surah, setSurah] = useState(1);
  const info = SURAHS.find((s) => s.n === surah)!;
  if (q?.id || h?.id) router.push(`/learn/memorize/${q?.id ?? h?.id}`);

  return (
    <section className="card space-y-3">
      <div className="seg grid-cols-2">
        {(["quran", "hadith"] as const).map((t) => (
          <label key={t}>
            <input type="radio" className="sr-only" checked={tab === t} onChange={() => setTab(t)} />
            <span className={`block py-1.5 rounded-lg ${tab === t ? "bg-accent text-white" : ""}`}>{t === "quran" ? "📖 Add Quran" : "📜 Add hadith"}</span>
          </label>
        ))}
      </div>
      {tab === "quran" ? (
        <form action={quranAction} className="space-y-3">
          <div>
            <label className="label">Surah</label>
            <select name="surah" className="input" value={surah} onChange={(e) => setSurah(Number(e.target.value))}>
              {SURAHS.map((s) => (
                <option key={s.n} value={s.n}>{s.n}. {s.ar} · {s.en} ({s.ayahs})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">From ayah</label><input name="from" type="number" min={1} max={info.ayahs} defaultValue={1} className="input" /></div>
            <div><label className="label">To ayah</label><input name="to" type="number" min={1} max={info.ayahs} defaultValue={Math.min(info.ayahs, 5)} className="input" /></div>
          </div>
          <p className="text-xs muted">Exact Uthmani text with the Saheeh International meaning, up to 40 ayahs at a time.</p>
          <SubmitButton className="btn-primary w-full" pendingText="Fetching the ayahs…">Add to my list</SubmitButton>
          <Notice error={q?.error} />
        </form>
      ) : (
        <form action={hadithAction} className="space-y-3">
          <div><label className="label">Title</label><input name="title" className="input" placeholder="e.g. حديث إنما الأعمال بالنيات" maxLength={120} required /></div>
          <div><label className="label">Hadith text (copy it from your book so it is exact)</label><textarea name="text" className="input" rows={4} dir="rtl" maxLength={3000} required /></div>
          <div className="grid grid-cols-1 gap-2">
            <div><label className="label">Source (optional)</label><input name="reference" className="input" placeholder="e.g. متفق عليه · Bukhari 1" maxLength={120} /></div>
            <div><label className="label">Meaning in English (optional)</label><textarea name="translation" className="input" rows={2} maxLength={3000} /></div>
          </div>
          <SubmitButton className="btn-primary w-full" pendingText="Saving…">Add to my list</SubmitButton>
          <Notice error={h?.error} />
        </form>
      )}
    </section>
  );
}
