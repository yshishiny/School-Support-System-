import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemorizeForms } from "@/components/MemorizeForms";
import type { MemorizeItem } from "@/lib/types";

export const maxDuration = 60;

export default async function MemorizePage() {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const { data } = await supabase.from("memorize_items").select("*").eq("student_id", profile.id).order("created_at", { ascending: false });
  const items = (data ?? []) as MemorizeItem[];
  return (
    <main className="space-y-4">
      <Link href="/learn" className="text-sm muted">← Learn</Link>
      <header className="card">
        <h1 className="h1">📿 القرآن والحديث</h1>
        <p className="text-sm muted mt-1">Add what your Religion teacher asked you to memorise. Read it, hide a third, hide two thirds, then recite from memory. Every recall session pays points.</p>
      </header>
      {items.length > 0 && (
        <section className="space-y-2">
          {items.map((it) => (
            <Link key={it.id} href={`/learn/memorize/${it.id}`} className="card flex items-center gap-3" dir="rtl">
              <span className="text-2xl">{it.kind === "quran" ? "📖" : "📜"}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{it.title}</div>
                <div className="text-xs muted" dir="ltr">{it.reference ?? ""}{it.sessions ? ` · ${it.sessions} sessions · best ${it.best_score ?? 0}%` : " · not practised yet"}</div>
              </div>
              <span className="btn-primary btn-sm">Practise</span>
            </Link>
          ))}
        </section>
      )}
      <MemorizeForms />
    </main>
  );
}
