import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { prettyDate, shiftDate, todayIn } from "@/lib/dates";
import { SNAP_TEMPLATES, type HandwritingAnalysis, type SnapTask } from "@/lib/snaps";
import { WEEKDAYS } from "@/lib/custody";
import { loadSnapTasks, signSnapUrls } from "@/lib/snaps/server";
import { addSnapTaskAction, deleteSnapTaskAction, updateSnapTaskAction } from "@/lib/actions/snaps";
import { SnapReview } from "@/components/SnapReview";
import type { Profile } from "@/lib/types";

const VERDICT: Record<string, { icon: string; text: string }> = {
  looks_good: { icon: "🟢", text: "AI: looks done" },
  unclear: { icon: "🟡", text: "AI: hard to see" },
  not_it: { icon: "🔴", text: "AI: does not look done" },
  people: { icon: "🙈", text: "AI: a person is visible" },
  error: { icon: "⚪", text: "AI could not check" },
};

type SnapRow = { id: string; student_id: string; task_code: string; kind: string; path: string; taken_on: string; status: "pending" | "approved" | "rejected"; ai_verdict: string | null; ai_score: number | null; ai_note: string | null; ai_detail: (Partial<HandwritingAnalysis> & { score?: number; subject_guess?: string | null; matches_today?: boolean | null; filled_fraction?: number }) | null; review_note: string | null; created_at: string };

/** The parent's photo feed: pending snaps first, one tap each, then recent history and the task settings. */
export default async function ParentSnapsPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [{ data: kids }, tasks, { data: snapRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false }),
    loadSnapTasks(family.id),
    supabase.from("snaps").select("id, student_id, task_code, kind, path, taken_on, status, ai_verdict, ai_score, ai_note, ai_detail, review_note, created_at").eq("family_id", family.id).gte("taken_on", shiftDate(today, -14)).order("created_at", { ascending: false }).limit(120),
  ]);
  const students = (kids ?? []) as Profile[];
  const snaps = (snapRows ?? []) as SnapRow[];
  const pending = snaps.filter((s) => s.status === "pending");
  const recent = snaps.filter((s) => s.status !== "pending").slice(0, 30);
  const urls = await signSnapUrls([...pending, ...recent].map((s) => ({ id: s.id, path: s.path })));
  const nameOf = (id: string) => students.find((s) => s.id === id)?.full_name.split(" ")[0] ?? "?";
  const taskOf = (code: string) => tasks.find((t) => t.code === code) ?? SNAP_TEMPLATES.find((t) => t.code === code);
  const hwByKid = students.map((s) => ({ s, samples: snaps.filter((x) => x.student_id === s.id && x.kind === "handwriting" && x.ai_detail?.score !== undefined).slice(0, 6) }));

  function Card({ s }: { s: SnapRow }) {
    const t = taskOf(s.task_code);
    const v = VERDICT[s.ai_verdict ?? "error"];
    const url = urls.get(s.id);
    return (
      <div className="card !p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xl">{t?.emoji ?? "📷"}</span>
          <div className="flex-1 min-w-0"><b>{nameOf(s.student_id)}</b> · {t?.label ?? s.task_code} · <span className="muted">{prettyDate(s.taken_on)} {s.created_at.slice(11, 16)}</span></div>
          {s.status !== "pending" && <span className={`badge ${s.status === "approved" ? "text-good" : "text-bad"}`}>{s.status}</span>}
        </div>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-full max-h-72 object-contain rounded-xl bg-panel-2" /></a>
        )}
        <div className="text-xs">
          <div>{v.icon} {v.text}{s.ai_score !== null ? ` (${Math.round(Number(s.ai_score) * 100)}%)` : ""}{s.ai_note ? ` · ${s.ai_note}` : ""}</div>
          {s.kind === "homework" && s.ai_detail && <div className="muted">{s.ai_detail.subject_guess ? `Subject: ${s.ai_detail.subject_guess}` : ""}{s.ai_detail.matches_today === false ? " · does not match today's subjects" : s.ai_detail.matches_today ? " · matches today" : ""}{typeof s.ai_detail.filled_fraction === "number" ? ` · ${Math.round(s.ai_detail.filled_fraction * 100)}% of the page written` : ""}</div>}
          {s.kind === "handwriting" && s.ai_detail && <div className="muted">Score {s.ai_detail.score}/100 · {s.ai_detail.language} · focus: {(s.ai_detail.focus ?? []).join(", ") || "—"}</div>}
          {s.review_note && <div className="text-warn">Your note: {s.review_note}</div>}
        </div>
        {s.status === "pending" && <SnapReview snapId={s.id} />}
      </div>
    );
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">📸 Show your win</h1>
        <Link href="/parent" className="btn-ghost btn-sm">← Home</Link>
      </div>
      <p className="text-sm muted">The boys snap their bed, desk, dish or homework page when nobody is home. The AI gives a first opinion; your tap is what counts for the allowance. Handwriting samples get a score and a line to practise.</p>

      <section className="space-y-2">
        <h2 className="h2">To review {pending.length ? <span className="badge">{pending.length}</span> : null}</h2>
        {pending.length === 0 ? <p className="card text-sm muted">Nothing waiting. Pending snaps the AI found plausible already count until you say otherwise.</p> : pending.map((s) => <Card key={s.id} s={s} />)}
      </section>

      {hwByKid.some((x) => x.samples.length) && (
        <section className="card space-y-2">
          <h2 className="h2">✍️ Handwriting trend</h2>
          {hwByKid.filter((x) => x.samples.length).map(({ s, samples }) => (
            <div key={s.id} className="text-sm">
              <b>{s.full_name.split(" ")[0]}</b>: {samples.slice().reverse().map((x) => `${prettyDate(x.taken_on)} ${x.ai_detail?.score}`).join(" → ")}
              <div className="text-xs muted">Latest focus: {(samples[0].ai_detail?.focus ?? []).join(", ") || "—"}</div>
            </div>
          ))}
        </section>
      )}

      {recent.length > 0 && (
        <details className="space-y-2">
          <summary className="h2 cursor-pointer">Recent · {recent.length}</summary>
          <div className="grid gap-2 sm:grid-cols-2 mt-2">{recent.map((s) => <Card key={s.id} s={s} />)}</div>
        </details>
      )}

      <section className="card space-y-3">
        <h2 className="h2">Snap tasks</h2>
        <p className="text-xs muted">Each task is a basic in the allowance score (weight below). Time windows are in your timezone. Switch a task off instead of deleting it to keep history.</p>
        {tasks.length > 0 && (
          <ul className="divide-y divide-line">
            {tasks.map((t: SnapTask) => (
              <li key={t.id} className="py-2">
                <form action={updateSnapTaskAction} className="space-y-1 text-sm">
                  <input type="hidden" name="id" value={t.id} />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" name="enabled" defaultChecked={t.enabled} />
                    <span className="text-lg">{t.emoji}</span>
                    <input name="label" className="input !py-1 flex-1" defaultValue={t.label} />
                    <span className="text-xs muted">{t.student_id ? nameOf(t.student_id) : "both"}</span>
                    <input name="weight" type="number" min={0} max={50} className="input !py-1 w-16 text-center" defaultValue={t.weight} title="Weight in the allowance score" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {WEEKDAYS.map((d, k) => <label key={d} className="flex items-center gap-0.5"><input type="checkbox" name={`day_${k}`} defaultChecked={t.days.includes(k)} />{d.slice(0, 3)}</label>)}
                    <span className="muted">window</span>
                    <input name="window_start" type="time" className="input !py-0.5 !px-1 w-24" defaultValue={t.window_start?.slice(0, 5) ?? ""} />
                    <input name="window_end" type="time" className="input !py-0.5 !px-1 w-24" defaultValue={t.window_end?.slice(0, 5) ?? ""} />
                    <button className="btn-ghost btn-sm">Save</button>
                  </div>
                </form>
                <form action={deleteSnapTaskAction.bind(null, t.id)} className="text-right"><button className="text-[11px] muted">delete</button></form>
              </li>
            ))}
          </ul>
        )}
        <form action={addSnapTaskAction} className="grid gap-2 sm:grid-cols-3">
          <select name="code" className="input">{SNAP_TEMPLATES.map((t) => <option key={t.code} value={t.code}>{t.emoji} {t.label} · {t.hint}</option>)}</select>
          <select name="student_id" className="input"><option value="">Both kids</option>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name.split(" ")[0]}</option>)}</select>
          <button className="btn-primary">Add task</button>
        </form>
      </section>
    </main>
  );
}
