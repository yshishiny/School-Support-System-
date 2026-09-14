import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/components/ImportWizard";
import { todayIn, shiftDate, prettyDate } from "@/lib/dates";

export default async function ImportPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [{ data: kids }, { data: imports }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
    supabase.from("whatsapp_imports").select("*, profiles!whatsapp_imports_student_id_fkey(full_name)").eq("family_id", family.id).order("imported_at", { ascending: false }).limit(5),
  ]);
  const last = imports?.[0]?.imported_at ? String(imports[0].imported_at).slice(0, 10) : shiftDate(today, -14);

  return (
    <main className="space-y-4">
      <h1 className="h1">Import from WhatsApp</h1>
      <div className="card text-sm space-y-1 muted">
        <p><b className="text-ink">How:</b> open the class group → tap the group name → <b className="text-ink">Export chat</b> → <b className="text-ink">Without media</b> → save or share the .txt file to yourself, then upload it here.</p>
        <p>The AI reads only messages after the date you pick, finds homework, quizzes, exams and events, and shows them for you to approve before anything is added.</p>
      </div>
      {(kids ?? []).length === 0 ? <p className="card">Add a child first.</p> : <ImportWizard students={kids ?? []} defaultSince={last} />}
      {(imports ?? []).length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">Recent imports</h2>
          <ul className="text-sm space-y-1 muted">
            {(imports ?? []).map((i) => (
              <li key={i.id}>{prettyDate(String(i.imported_at).slice(0, 10))} · {(i as { profiles?: { full_name?: string } }).profiles?.full_name} · {i.message_count} messages → {i.items_added} added</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
