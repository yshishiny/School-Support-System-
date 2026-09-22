import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent } from "@/lib/auth";
import { todayIn, prettyDate } from "@/lib/dates";
import { dayFor } from "@/lib/day/load";
import { firstLine, yesterdayLine, type Item } from "@/lib/day/briefing";
import { setAssignmentStatusAction, signPaperAction } from "@/lib/actions/assignments";
import { KIND_EMOJI } from "@/lib/types";

export const dynamic = "force-dynamic";

const emojiOf = (k: Item["kind"]) => KIND_EMOJI[k] ?? "📌";

function Row({ i, today }: { i: Item; today: string }) {
  const late = i.dueDate !== null && i.dueDate < today;
  return (
    <li className="py-2 flex items-center gap-2">
      <span className="shrink-0">{emojiOf(i.kind)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{i.title}</span>
        <span className="block text-xs muted">
          {i.subject ?? "no subject"}
          {i.dueDate ? ` · due ${prettyDate(i.dueDate)}` : " · no date given"}
          {late && <span className="text-bad"> · late</span>}
        </span>
      </span>
      <form action={setAssignmentStatusAction} className="shrink-0">
        <input type="hidden" name="id" value={i.id} />
        <input type="hidden" name="status" value="done" />
        <button className="btn-ghost btn-sm">Done ✓</button>
      </form>
    </li>
  );
}

function List({ title, items, today, hint }: { title: string; items: Item[]; today: string; hint?: string }) {
  if (items.length === 0) return null;
  return (
    <section className="card">
      <h2 className="h2 text-base">{title} <span className="muted font-normal text-sm">· {items.length}</span></h2>
      {hint && <p className="text-xs muted mt-0.5">{hint}</p>}
      <ul className="divide-y divide-line mt-1">{items.map((i) => <Row key={i.id} i={i} today={today} />)}</ul>
    </section>
  );
}

/**
 * The evening question, answered on one page.
 *
 * What did he do yesterday, what is due today, what should he be doing, what needs my signature, what quizzes
 * are coming. Each of these already existed somewhere, or nowhere, and answering them meant four taps and a
 * guess.
 */
export default async function DayPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { family } = await requireParent();
  const { studentId } = await params;
  const today = todayIn(family.timezone);
  const d = await dayFor(studentId, family.id, today);
  if (!d) notFound();

  return (
    <main className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="h1 truncate">{d.firstName} today</h1>
          <p className="text-xs muted">{prettyDate(today)}</p>
        </div>
        <Link href={`/parent/trace/${d.studentId}`} className="btn-ghost btn-sm shrink-0">Everything →</Link>
      </div>

      <section className="card space-y-2">
        <p className="text-sm font-semibold">{firstLine(d, d.firstName)}</p>
        <p className={`text-sm border-t border-line pt-2 ${d.yesterdaySilent ? "muted" : ""}`}>
          <b>Yesterday ({prettyDate(d.yesterdayDate)}):</b> {yesterdayLine(d, d.firstName)}
        </p>
      </section>

      {d.toSign.length > 0 && (
        <section className="card border-2 border-accent">
          <h2 className="h2 text-base">✍️ Needs your signature <span className="muted font-normal text-sm">· {d.toSign.length}</span></h2>
          <p className="text-xs muted mt-0.5">{d.firstName} cannot clear these. They wait on you.</p>
          <ul className="divide-y divide-line mt-1">
            {d.toSign.map((i) => (
              <li key={i.id} className="py-2 flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{i.title}</span>
                  <span className="block text-xs muted">
                    {i.subject ?? "school"}
                    {i.dueDate ? ` · back by ${prettyDate(i.dueDate)}` : ""}
                    {i.dueDate && i.dueDate < today && <span className="text-bad"> · overdue</span>}
                  </span>
                </span>
                <form action={signPaperAction} className="shrink-0">
                  <input type="hidden" name="id" value={i.id} />
                  <button className="btn-primary btn-sm">Signed ✍️</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(d.quizzesToday.length > 0 || d.quizzesSoon.length > 0) && (
        <section className="card">
          <h2 className="h2 text-base">⚡ Quizzes</h2>
          <ul className="divide-y divide-line mt-1 text-sm">
            {d.quizzesToday.map((q) => (
              <li key={q.id} className="py-2 flex items-center gap-2">
                <span className="flex-1">{q.title}</span>
                <span className="badge text-warn text-xs">today</span>
              </li>
            ))}
            {d.quizzesSoon.map((q) => (
              <li key={q.id} className="py-2 flex items-center gap-2">
                <span className="flex-1">{q.title}</span>
                <span className="text-xs muted">{q.scheduledFor ? prettyDate(q.scheduledFor) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <List title="⏰ Past due" items={d.overdue} today={today} />
      <List title="📌 Due today" items={d.dueToday} today={today} />
      <List title="🗓️ This week" items={d.comingUp} today={today} />
      <List
        title="❓ No date from school"
        items={d.undated}
        today={today}
        hint="Real work the school gave no date for. It cannot be late, and it is easy to forget."
      />

      {d.toSign.length === 0 && d.overdue.length === 0 && d.dueToday.length === 0
        && d.comingUp.length === 0 && d.undated.length === 0 && d.quizzesToday.length === 0 && (
        <p className="card text-sm muted">
          Nothing on the list. If that looks wrong, it means the school&apos;s files or {d.firstName}&apos;s check-ins
          have not reached the app — <Link href="/parent/materials" className="underline">add a file</Link> and it will fill.
        </p>
      )}
    </main>
  );
}
