import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn, shiftDate, prettyDate, relativeLabel } from "@/lib/dates";
import { setAssignmentStatusAction } from "@/lib/actions/assignments";
import { KIND_EMOJI, type Assignment } from "@/lib/types";

export default async function CalendarPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const { data } = await supabase
    .from("assignments")
    .select("*")
    .eq("student_id", profile.id)
    .gte("created_at", shiftDate(today, -60))
    .order("due_date", { ascending: true, nullsFirst: false });
  const all = (data ?? []) as Assignment[];
  const open = all.filter((a) => a.status === "open");
  const done = all.filter((a) => a.status === "done").slice(-15).reverse();

  const groups: { title: string; items: Assignment[] }[] = [
    { title: "⏰ Overdue", items: open.filter((a) => a.due_date && a.due_date < today) },
    { title: "🔥 Today", items: open.filter((a) => a.due_date === today) },
    { title: "➡️ Tomorrow", items: open.filter((a) => a.due_date === shiftDate(today, 1)) },
    { title: "🗓️ This week", items: open.filter((a) => a.due_date && a.due_date > shiftDate(today, 1) && a.due_date <= shiftDate(today, 7)) },
    { title: "🔭 Later", items: open.filter((a) => a.due_date && a.due_date > shiftDate(today, 7)) },
    { title: "📌 No date", items: open.filter((a) => !a.due_date) },
  ].filter((g) => g.items.length);

  return (
    <main className="space-y-4">
      <h1 className="h1">Planner</h1>
      {groups.length === 0 && <p className="card muted">Nothing open. Enjoy it, or add what the teacher gave you from the Today page.</p>}
      {groups.map((g) => (
        <section key={g.title} className="card">
          <h2 className="h2 mb-2">{g.title}</h2>
          <ul className="divide-y divide-line">
            {g.items.map((a) => (
              <li key={a.id} className="py-2 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{KIND_EMOJI[a.kind]} {a.title}</div>
                  <div className="text-xs muted">
                    {a.subject_name ? `${a.subject_name} · ` : ""}{a.due_date ? `${prettyDate(a.due_date)} · ${relativeLabel(a.due_date, today)}` : "no date"}
                    {a.source === "whatsapp" ? " · from class group" : ""}
                  </div>
                  {a.details && <div className="text-xs muted mt-1 whitespace-pre-line">{a.details}</div>}
                </div>
                {(a.kind === "homework" || a.kind === "project") && (
                  <form action={setAssignmentStatusAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="status" value="done" />
                    <button className="btn-ghost btn-sm">Done ✓</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {done.length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">✅ Recently done</h2>
          <ul className="text-sm space-y-1">
            {done.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 muted">
                <span className="line-through">{a.title}</span>
                <form action={setAssignmentStatusAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value="open" />
                  <button className="text-xs underline">undo</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
