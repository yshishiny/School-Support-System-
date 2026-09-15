import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClinicianForm } from "@/components/ClinicianForm";
import { PrintButton } from "@/components/PrintButton";
import { prettyDate } from "@/lib/dates";

export const maxDuration = 300;

interface Row {
  id: string;
  scope: string;
  reason: string | null;
  period_start: string;
  period_end: string;
  content_md: string;
  created_at: string;
}

export default async function ClinicianPage({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ view?: string }> }) {
  const { studentId } = await params;
  const { view } = await searchParams;
  const { family } = await requireParent();
  const supabase = await createClient();
  const { data: child } = await supabase.from("profiles").select("id, full_name, grade").eq("id", studentId).eq("family_id", family.id).eq("role", "student").maybeSingle();
  if (!child) notFound();
  const { data: reports } = await supabase.from("clinician_reports").select("id, scope, reason, period_start, period_end, content_md, created_at").eq("student_id", studentId).order("created_at", { ascending: false });
  const list = (reports ?? []) as Row[];
  const current = list.find((r) => r.id === view) ?? list[0] ?? null;
  const first = child.full_name.split(" ")[0];

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="h1">Clinician summary · {first}</h1>
        <Link href="/parent/progress" className="btn-ghost btn-sm">← Progress</Link>
      </div>
      <div className="card text-sm space-y-1 muted print:hidden">
        <p><b className="text-ink">What this is:</b> a collateral-information summary for a mental-health professional, in the sections of a standard child and adolescent psychiatric assessment. It reports the WHO-5 with its published cut-offs, the app&apos;s own questionnaires (marked non-validated), study and routine data, safety flags, and the AI&apos;s notes (marked machine-generated).</p>
        <p><b className="text-ink">What it is not:</b> a diagnosis or a risk assessment. Only a clinician who sees {first} can make those. Bring it to the appointment, do not send it unencrypted.</p>
      </div>
      <div className="print:hidden"><ClinicianForm studentId={studentId} firstName={first} /></div>

      {list.length > 1 && (
        <div className="flex flex-wrap gap-1.5 print:hidden">
          {list.map((r) => (
            <Link key={r.id} href={`?view=${r.id}`} className={`chip ${current?.id === r.id ? "chip-on" : ""}`}>{prettyDate(r.created_at.slice(0, 10))}{r.scope === "with_chat_themes" ? " · +chat" : ""}</Link>
          ))}
        </div>
      )}

      {current && (
        <article className="card space-y-3 print:border-0 print:shadow-none print:p-0 print:bg-white print:text-black">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs muted">Generated {current.created_at.slice(0, 16).replace("T", " ")} · period {current.period_start} → {current.period_end} · {current.scope === "with_chat_themes" ? "includes chat themes (child informed)" : "chat excluded"}</div>
            <PrintButton />
          </div>
          <div className="prose-lesson text-sm leading-relaxed print:text-[11pt]">
            <ReactMarkdown>{current.content_md}</ReactMarkdown>
          </div>
          <p className="text-[11px] muted print:text-black">Prepared with the family study app for {child.full_name}, grade {child.grade}. Collateral information provided by the parent; not a clinical assessment.</p>
        </article>
      )}
    </main>
  );
}
