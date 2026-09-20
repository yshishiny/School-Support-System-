import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { prettyDate, shiftDate, todayIn } from "@/lib/dates";
import { SNAP_TEMPLATES, type HandwritingAnalysis } from "@/lib/snaps";
import { loadSnapTasks, signSnapUrls } from "@/lib/snaps/server";
import { Tabs } from "@/components/Tabs";
import { SnapReview } from "@/components/SnapReview";

const VERDICT: Record<string, { icon: string; text: string }> = {
  looks_good: { icon: "🟢", text: "the coach thinks it looks done" },
  unclear: { icon: "🟡", text: "the coach could not see it properly" },
  not_it: { icon: "🔴", text: "the coach does not think it is done" },
  people: { icon: "🙈", text: "somebody is in the picture" },
  error: { icon: "⚪", text: "the coach could not check it" },
  skipped: { icon: "⚪", text: "no coach check on this one" },
};

type Row = {
  id: string; student_id: string; task_code: string; kind: string; path: string; taken_on: string;
  status: "pending" | "approved" | "rejected"; ai_verdict: string | null; ai_score: number | null; ai_note: string | null;
  ai_detail: (Partial<HandwritingAnalysis> & { score?: number }) | null; created_at: string; reviewed_by: string | null;
  rater_verdict: "approved" | "rejected" | null; rater_id: string | null; rater_note: string | null;
};

/**
 * The older sisters' screen. A parent can mark a grown child as a rater; until now that only let her tick manners
 * and the dish, with no way to see the pictures her brothers send. This is that way: their pending snaps, one tap
 * each, and never her own.
 */
export default async function RaterSnapsPage() {
  const { profile, family } = await requireStudent();
  if (!(profile as { rater?: boolean }).rater) redirect("/snaps");
  const admin = createAdminClient();
  const today = todayIn(family.timezone);

  const [{ data: kids }, tasks, { data: rows }] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar_emoji").eq("family_id", family.id).eq("role", "student").neq("id", profile.id),
    loadSnapTasks(family.id, family.timezone),
    admin
      .from("snaps")
      .select("id, student_id, task_code, kind, path, taken_on, status, ai_verdict, ai_score, ai_note, ai_detail, created_at, reviewed_by, rater_verdict, rater_id, rater_note")
      .eq("family_id", family.id)
      .neq("student_id", profile.id)
      .gte("taken_on", shiftDate(today, -7))
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const siblings = (kids ?? []) as { id: string; full_name: string; avatar_emoji: string }[];
  const snaps = (rows ?? []) as Row[];
  const waiting = snaps.filter((s) => s.status === "pending");
  // The ones she has not looked at yet come first; the ones she has sit below, waiting on a parent.
  const pending = waiting.filter((s) => !s.rater_verdict);
  const said = waiting.filter((s) => !!s.rater_verdict);
  const decided = snaps.filter((s) => s.status !== "pending").slice(0, 12);
  const urls = await signSnapUrls([...waiting, ...decided].map((s) => ({ id: s.id, path: s.path })));
  const nameOf = (id: string) => siblings.find((s) => s.id === id)?.full_name.split(" ")[0] ?? "someone";
  const taskOf = (code: string) => tasks.find((t) => t.code === code) ?? SNAP_TEMPLATES.find((t) => t.code === code);

  // Three piles, one at a time: what she has to look at, what she has answered and is waiting on Dad, and what
  // is finished. Stacked, the finished ones pushed the work she actually has to do off the screen.
  const toCheck = pending.length === 0 ? (
    <p className="card text-sm muted">Nothing waiting. Anything they send in the next few days turns up here.</p>
  ) : (
    <>
      {pending.map((s) => {
        const t = taskOf(s.task_code);
        const v = VERDICT[s.ai_verdict ?? "error"] ?? VERDICT.error;
        const url = urls.get(s.id);
        return (
          <article key={s.id} className="card !p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xl">{t?.emoji ?? "📷"}</span>
              <div className="flex-1 min-w-0">
                <b>{nameOf(s.student_id)}</b> · {t?.label ?? s.task_code}
                <div className="text-[11px] muted">{prettyDate(s.taken_on)} · sent {s.created_at.slice(11, 16)}</div>
              </div>
            </div>
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-full max-h-80 object-contain rounded-xl bg-panel-2" /></a>
            )}
            {t?.prompt && <p className="text-[11px] muted">Should show: {t.prompt}</p>}
            <p className="text-xs">{v.icon} {v.text}{s.ai_note ? ` · ${s.ai_note}` : ""}</p>
            <SnapReview snapId={s.id} />
          </article>
        );
      })}
      <p className="text-[11px] muted px-1">Your answer is a recommendation: your dad makes the final call and the points move then.</p>
    </>
  );

  const withDad = said.length === 0 ? (
    <p className="card text-sm muted">Nothing of yours is waiting on him.</p>
  ) : (
    <section className="card !py-3 space-y-2">
      {said.map((s) => (
        <div key={s.id} className="flex items-center gap-2 text-sm">
          <span>{s.rater_verdict === "approved" ? "👍" : "👎"}</span>
          <span className="flex-1 min-w-0 truncate">{nameOf(s.student_id)} · {taskOf(s.task_code)?.label ?? s.task_code}</span>
          <span className="text-[11px] muted">you said {s.rater_verdict === "approved" ? "done" : "not done"}</span>
        </div>
      ))}
      <p className="text-[11px] muted">He sees your name on each one. Nothing is paid until he agrees.</p>
    </section>
  );

  const finished = decided.length === 0 ? (
    <p className="card text-sm muted">Nothing decided in the last week.</p>
  ) : (
    <section className="card !py-3">
      <ul className="divide-y divide-line text-sm">
        {decided.map((s) => (
          <li key={s.id} className="flex items-center gap-2 py-1.5">
            <span className="flex-1 min-w-0 truncate">{taskOf(s.task_code)?.emoji ?? "📷"} {nameOf(s.student_id)} · {taskOf(s.task_code)?.label ?? s.task_code}</span>
            <span className={`badge ${s.status === "approved" ? "text-good" : "text-bad"}`}>{s.status === "approved" ? "approved" : "sent back"}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main className="space-y-3">
      <header className="flex items-center gap-3">
        <span className="text-3xl">🧐</span>
        <div className="flex-1 min-w-0">
          <h1 className="h1">Check their snaps</h1>
          <p className="text-xs muted">Say whether each one is done; your dad confirms it and the points follow. Your own pictures never appear here.</p>
        </div>
        <Link href="/snaps" className="btn-ghost btn-sm">Mine</Link>
      </header>

      <Tabs
        storageKey="snaps-review"
        tabs={[
          { id: "check", label: "To check", emoji: "🧐", badge: pending.length, content: toCheck },
          { id: "dad", label: "With Dad", emoji: "⏳", badge: said.length, content: withDad },
          { id: "done", label: "Decided", emoji: "✅", content: finished },
        ]}
      />
    </main>
  );
}
