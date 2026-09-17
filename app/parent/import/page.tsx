import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "@/components/ImportWizard";
import { TimetablePhotoWizard } from "@/components/TimetablePhotoWizard";
import { SourcesPanel, type FindingRow, type SourceRow } from "@/components/SourcesPanel";
import { Tabs } from "@/components/Tabs";
import { todayIn, shiftDate, prettyDate } from "@/lib/dates";

export const maxDuration = 300;

export default async function ImportPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [{ data: kids }, { data: imports }, { data: sources }, { data: findings }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
    supabase.from("whatsapp_imports").select("*, profiles!whatsapp_imports_student_id_fkey(full_name)").eq("family_id", family.id).order("imported_at", { ascending: false }).limit(5),
    supabase.from("sources").select("id, label, url, last_checked_at, last_error, student_id").eq("family_id", family.id).order("created_at"),
    supabase.from("source_findings").select("id, source_id, found_at, summary, items, status").eq("family_id", family.id).order("found_at", { ascending: false }).limit(10),
  ]);
  const last = imports?.[0]?.imported_at ? String(imports[0].imported_at).slice(0, 10) : shiftDate(today, -14);

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Import</h1>
        <div className="flex gap-2"><Link href="/parent/materials" className="btn-ghost btn-sm">📎 School files</Link><Link href="/parent/import/archive" className="btn-ghost btn-sm">🗄️ Chat archive</Link></div>
      </div>
      <div className="card text-sm space-y-1 muted">
        <p><b className="text-ink">PDFs and worksheets:</b> the files teachers drop in the group go to <Link href="/parent/materials" className="text-accent-2">School files</Link>, with the subject and the teacher&apos;s instructions. The boys practise straight from them.</p>
        <p><b className="text-ink">Photos:</b> save the homework, supply list or announcement images from the group and upload them. The AI reads English and Arabic.</p>
        <p><b className="text-ink">Chat text:</b> group name → <b className="text-ink">Export chat</b> → <b className="text-ink">Without media</b> → upload the .txt file. Only messages after the date you pick are read.</p>
        <p><b className="text-ink">Whole-year exports</b> with media go to the <Link href="/parent/import/archive" className="text-accent-2">chat archive</Link>, where the app learns how each group communicates.</p>
        <p>Everything is shown for you to approve before it is added.</p>
      </div>
      {(kids ?? []).length === 0 ? (
        <p className="card">Add a child first.</p>
      ) : (
        <Tabs
          storageKey="import"
          tabs={[
            { id: "whatsapp", label: "WhatsApp", emoji: "💬", content: <ImportWizard students={kids ?? []} defaultSince={last} /> },
            { id: "timetable", label: "Timetable photo", emoji: "🗓️", content: <TimetablePhotoWizard students={kids ?? []} /> },
            { id: "sources", label: "School website", emoji: "🏫", badge: (findings ?? []).filter((f) => f.status === "new").length || null, content: <SourcesPanel sources={(sources ?? []) as SourceRow[]} findings={(findings ?? []) as FindingRow[]} students={kids ?? []} /> },
            { id: "recent", label: "Recent", emoji: "🕓", content: (
              <section className="card">
                <h2 className="h2 mb-2">Recent imports</h2>
                {(imports ?? []).length === 0 ? <p className="text-sm muted">None yet.</p> : (
                  <ul className="text-sm space-y-1 muted">
                    {(imports ?? []).map((i) => (
                      <li key={i.id}>{prettyDate(String(i.imported_at).slice(0, 10))} · {(i as { profiles?: { full_name?: string } }).profiles?.full_name} · {i.message_count} messages → {i.items_added} added</li>
                    ))}
                  </ul>
                )}
              </section>
            ) },
          ]}
        />
      )}
    </main>
  );
}
