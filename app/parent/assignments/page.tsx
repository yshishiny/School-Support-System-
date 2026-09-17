import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, prettyDate, relativeLabel } from "@/lib/dates";
import { AddAssignmentForm } from "@/components/AddAssignmentForm";
import { SideTabs } from "@/components/SideTabs";
import { kidColor } from "@/lib/kid-tabs";
import { deleteAssignmentAction, setAssignmentStatusAction } from "@/lib/actions/assignments";
import { KIND_EMOJI, type Assignment, type Profile, type Subject } from "@/lib/types";

export default async function AssignmentsPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const { data: kids } = await supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const students = (kids ?? []) as Profile[];
  const ids = students.map((s) => s.id);
  const [{ data: subjects }, { data: assignments }] = await Promise.all([
    ids.length ? supabase.from("subjects").select("*").in("student_id", ids).order("name") : { data: [] },
    ids.length ? supabase.from("assignments").select("*").in("student_id", ids).gte("created_at", shiftDate(today, -45)).order("due_date", { ascending: true, nullsFirst: false }) : { data: [] },
  ]);
  const all = (assignments ?? []) as Assignment[];

  return (
    <main className="space-y-4">
      <h1 className="h1">Tasks</h1>
      {students.length > 0 && <AddAssignmentForm students={students} subjects={(subjects ?? []) as Subject[]} defaultDate={shiftDate(today, 1)} />}
      <SideTabs storageKey="tasks-kids" tabs={students.map((s, idx) => {
        const mine = all.filter((a) => a.student_id === s.id);
        const open = mine.filter((a) => a.status === "open");
        const done = mine.filter((a) => a.status !== "open").slice(-10).reverse();
        return { id: s.id, label: s.full_name.split(" ")[0], emoji: s.avatar_emoji, color: kidColor(idx), sub: `${open.length} open`, content: (
          <section className="card">
            {open.length === 0 && <p className="muted text-sm">No open tasks.</p>}
            <ul className="divide-y divide-line">
              {open.map((a) => (
                <li key={a.id} className="py-2 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{KIND_EMOJI[a.kind]} {a.title}</div>
                    <div className="text-xs muted">
                      {a.subject_name ? `${a.subject_name} · ` : ""}{a.due_date ? `${prettyDate(a.due_date)} · ${relativeLabel(a.due_date, today)}` : "no date"} · {a.source}
                    </div>
                    {a.source_excerpt && <details className="text-xs muted mt-1"><summary className="cursor-pointer">original message</summary><p className="whitespace-pre-wrap mt-1">{a.source_excerpt}</p></details>}
                  </div>
                  <form action={setAssignmentStatusAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="done" /><button className="btn-ghost btn-sm">Done</button></form>
                  <form action={deleteAssignmentAction}><input type="hidden" name="id" value={a.id} /><button className="btn-ghost btn-sm text-bad">✕</button></form>
                </li>
              ))}
            </ul>
            {done.length > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer muted">Completed ({done.length})</summary>
                <ul className="mt-1 space-y-1">
                  {done.map((a) => <li key={a.id} className="muted line-through">{a.title}</li>)}
                </ul>
              </details>
            )}
          </section>
        ) };
      })} />
    </main>
  );
}
