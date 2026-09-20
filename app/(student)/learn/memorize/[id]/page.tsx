import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemorizeTrainer } from "@/components/MemorizeTrainer";
import { deleteMemorizeItemAction } from "@/lib/actions/memorize";
import type { MemorizeItem } from "@/lib/types";
import { Recite } from "@/components/Recite";
import { sttEnabled } from "@/lib/stt";

export default async function MemorizeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const { data } = await supabase.from("memorize_items").select("*").eq("id", id).eq("student_id", profile.id).maybeSingle();
  if (!data) notFound();
  const item = data as MemorizeItem;
  return (
    <main className="space-y-3">
      <div className="flex items-center justify-between">
        <Link href="/learn/memorize" className="text-sm muted">← القرآن والحديث</Link>
        <form action={deleteMemorizeItemAction.bind(null, item.id)}><button className="text-xs muted hover:text-bad">Remove</button></form>
      </div>
      <header className="card" dir="rtl">
        <h1 className="h1">{item.title}</h1>
        {item.reference && <p className="text-xs muted" dir="ltr">{item.reference}</p>}
      </header>
      <MemorizeTrainer item={item} />
      {/* Hiding the text and marking yourself is the one thing a child memorising cannot do: he cannot hear his
          own mistake. This is the other half. */}
      {sttEnabled() && <Recite itemId={item.id} label={item.title} />}
    </main>
  );
}
