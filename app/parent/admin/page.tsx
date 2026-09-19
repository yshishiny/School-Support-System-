import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Tabs } from "@/components/Tabs";
import { configChecks, databaseChecks, githubCommits, googleStatus, jobChecks, recentErrors, supabaseStatus, vercelDeployments, type Check } from "@/lib/ops/health";
import { resolveErrorsAction } from "@/lib/actions/ops";
import { schedulerStatus } from "@/lib/actions/ops-scheduler";
import { SchedulerSwitch } from "@/components/SchedulerSwitch";
import { VideoPresenters } from "@/components/VideoPresenters";
import { clipStats, presenterGenders, presenterUrls, videoCap, videoEnabled, videoMode, videoMonthCount } from "@/lib/video";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOT: Record<Check["tone"], string> = { good: "🟢", warn: "🟡", bad: "🔴", muted: "⚪" };

function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
}

function CheckList({ rows }: { rows: Check[] }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((c) => (
        <li key={c.name} className="py-2 flex items-start gap-2 text-sm">
          <span>{DOT[c.tone]}</span>
          <span className="w-44 shrink-0 font-semibold">{c.name}</span>
          <span className="flex-1 min-w-0 break-words">{c.value}{c.detail && <span className="muted"> · {c.detail}</span>}{c.url && <a href={c.url} target="_blank" rel="noreferrer" className="underline ml-1">open</a>}</span>
        </li>
      ))}
    </ul>
  );
}

/** The administrator's page: health, errors, jobs, external services, data. */
export default async function AdminPage() {
  await requireAdmin();
  const [config, db, jobs, errors, vercel, github, supa, google] = await Promise.all([
    configChecks(),
    databaseChecks().catch((e) => [{ name: "Database", tone: "bad" as const, value: e instanceof Error ? e.message : String(e) }]),
    jobChecks().catch(() => ({ checks: [] as Check[], runs: [] })),
    recentErrors().catch(() => []),
    vercelDeployments(),
    githubCommits(),
    supabaseStatus(),
    googleStatus(),
  ]);
  const sched = await schedulerStatus().catch(() => ({ enabled: false, appUrl: null, lastRun: null, lastOk: null }));
  const [presenters, cap, used, stats, mode, genders] = await Promise.all([presenterUrls().catch(() => ({})), videoCap().catch(() => 500), videoMonthCount().catch(() => 0), clipStats().catch(() => ({ done: 0, pending: 0, failed: 0, errors: [] as string[] })), videoMode().catch(() => "hook_recap" as const), presenterGenders().catch(() => ({}))]);
  const openErrors = errors.filter((e) => !e.resolved_at);
  const worst = (rows: Check[]) => (rows.some((c) => c.tone === "bad") ? "bad" : rows.some((c) => c.tone === "warn") ? "warn" : "good");
  const overall = worst([...config, ...db, ...jobs.checks]);
  const summary: Check[] = [
    { name: "Overall", tone: openErrors.length ? "warn" : overall, value: openErrors.length ? `${openErrors.length} open error${openErrors.length === 1 ? "" : "s"}` : overall === "good" ? "all good" : "attention needed" },
    ...config.filter((c) => c.tone === "bad" || c.tone === "warn"),
    ...db.filter((c) => c.tone !== "muted" && c.name === "Database"),
    ...jobs.checks,
    google,
  ];
  const byArea = new Map<string, number>();
  openErrors.forEach((e) => byArea.set(e.area, (byArea.get(e.area) ?? 0) + 1));

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">🛠️ Admin</h1>
        <span className="text-xs muted">Only you see this page</span>
      </div>
      <Tabs
        storageKey="admin"
        defaultId={openErrors.length ? "errors" : "health"}
        tabs={[
          { id: "health", label: "Health", emoji: overall === "good" && !openErrors.length ? "💚" : "🩺", content: (
            <div className="space-y-3">
              <section className="card"><h2 className="h2 mb-1">At a glance</h2><CheckList rows={summary} /></section>
              <section className="card"><h2 className="h2 mb-1">Configuration</h2><CheckList rows={config} /><p className="text-xs muted mt-2">Keys live in Vercel → Project → Settings → Environment Variables. A change needs a redeploy.</p></section>
              <section className="card"><h2 className="h2 mb-1">Database and storage</h2><CheckList rows={db} /></section>
            </div>
          ) },
          { id: "errors", label: "Errors", emoji: "🐞", badge: openErrors.length || null, content: (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {[...byArea.entries()].map(([a, n]) => <span key={a} className="chip">{a} · {n}</span>)}
                {openErrors.length > 0 && <form action={resolveErrorsAction.bind(null, null)} className="ml-auto"><button className="btn-ghost btn-sm">Mark all resolved</button></form>}
              </div>
              {errors.length === 0 && <p className="card muted text-sm">No errors recorded. Every caught failure (file reading, snap check, AI calls, nightly jobs, browser crashes) lands here, and you get one inbox note per area per hour.</p>}
              {errors.map((e) => (
                <details key={e.id} className={`card !py-2 text-sm ${e.resolved_at ? "opacity-60" : ""}`}>
                  <summary className="cursor-pointer flex flex-wrap items-center gap-2">
                    <span>{e.resolved_at ? "✅" : "🔴"}</span>
                    <b>{e.area}</b>
                    <span className="flex-1 min-w-0 truncate">{e.message}</span>
                    <span className="text-xs muted">{e.profiles?.full_name ? `${e.profiles.full_name.split(" ")[0]} · ` : ""}{when(e.created_at)}</span>
                  </summary>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="whitespace-pre-wrap break-words rounded-xl bg-panel-2 p-2">{e.message}</div>
                    {e.meta && <div className="muted break-words">meta: {JSON.stringify(e.meta).slice(0, 600)}</div>}
                    {e.stack && <pre className="overflow-x-auto rounded-xl bg-panel-2 p-2 text-[10px] leading-tight max-h-48">{e.stack.slice(0, 2500)}</pre>}
                    {!e.resolved_at && <form action={resolveErrorsAction.bind(null, e.id)}><button className="btn-ghost btn-sm">Resolved</button></form>}
                  </div>
                </details>
              ))}
            </div>
          ) },
          { id: "jobs", label: "Jobs", emoji: "⏰", content: (
            <div className="space-y-3">
              <section className="card space-y-2">
                <h2 className="h2">Hourly reminders (wake-up, morning, evening, last call)</h2>
                <p className="text-xs muted">Vercel's free plan runs jobs once a day, so the hourly reminders are fired from inside the database (pg_cron, every hour at :05). Switching on stores the app's own cron secret and address for that job; nothing leaves the server.</p>
                <div className="text-sm">{sched.enabled ? `🟢 On · calls ${sched.appUrl}/api/cron/nudges hourly` : "⚪ Off · no wake-up or evening reminders reach the kids yet"}{sched.lastRun ? ` · last run ${when(sched.lastRun)} ${sched.lastOk ? "ok" : "with errors"}` : ""}</div>
                <SchedulerSwitch enabled={sched.enabled} />
              </section>
              <section className="card"><CheckList rows={jobs.checks} /><p className="text-xs muted mt-2">daily-report 18:00 UTC and prepare-plan 00:30 UTC run on Vercel Cron (Hobby: daily only). nudges needs an external hourly call to /api/cron/nudges with the cron secret.</p></section>
              <section className="card">
                <h2 className="h2 mb-1">Last runs</h2>
                {jobs.runs.length === 0 ? <p className="text-sm muted">Nothing recorded yet; the first run after this deploy appears here.</p> : (
                  <ul className="divide-y divide-line text-xs">
                    {jobs.runs.map((r) => (
                      <li key={r.id} className="py-1.5">
                        <details>
                          <summary className="cursor-pointer flex items-center gap-2"><span>{r.ok ? "🟢" : "🔴"}</span><b>{r.job}</b><span className="muted">{when(r.started_at)} · {r.seconds}s</span>{r.error && <span className="text-bad truncate">{r.error}</span>}</summary>
                          <pre className="mt-1 overflow-x-auto rounded-xl bg-panel-2 p-2 text-[10px] leading-tight max-h-56">{JSON.stringify(r.results, null, 1)}</pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) },
          { id: "teachers", label: "Teachers", emoji: "🎬", content: <VideoPresenters enabled={videoEnabled()} presenters={presenters} cap={cap} used={used} stats={stats} mode={mode} genders={genders} /> },
          { id: "services", label: "Services", emoji: "🔌", content: (
            <div className="space-y-3">
              <section className="card space-y-1">
                <h2 className="h2">▲ Vercel</h2>
                {vercel.ok ? (
                  <ul className="divide-y divide-line text-xs">{vercel.rows.map((d) => <li key={d.url} className="py-1.5 flex flex-wrap items-center gap-2"><span>{d.state === "READY" ? "🟢" : d.state === "ERROR" ? "🔴" : "🟡"}</span><b>{d.state}</b><span className="muted">{when(d.created)} · {d.branch}</span><span className="flex-1 truncate">{d.commit}</span><a href={d.url} target="_blank" rel="noreferrer" className="underline">open</a></li>)}</ul>
                ) : <p className="text-sm muted">{vercel.note}</p>}
                <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="text-xs underline">Vercel dashboard (logs, analytics, env vars)</a>
              </section>
              <section className="card space-y-1">
                <h2 className="h2">⚡ Supabase</h2>
                <p className="text-sm">Project <code>{supa.ref}</code>{supa.ok ? ` · ${supa.status} · ${supa.region}` : ""}</p>
                {!supa.ok && <p className="text-sm muted">{supa.note}</p>}
                <a href={`https://supabase.com/dashboard/project/${supa.ref}`} target="_blank" rel="noreferrer" className="text-xs underline">Supabase dashboard (logs, usage, storage)</a>
              </section>
              <section className="card space-y-1">
                <h2 className="h2">🐙 GitHub</h2>
                {github.ok ? (
                  <ul className="divide-y divide-line text-xs">{github.rows.map((c) => <li key={c.sha} className="py-1.5 flex items-center gap-2"><code>{c.sha}</code><span className="flex-1 truncate">{c.message}</span><span className="muted">{when(c.date)}</span><a href={c.url} target="_blank" rel="noreferrer" className="underline">open</a></li>)}</ul>
                ) : <p className="text-sm muted">{github.note}</p>}
                <a href="https://github.com/yshishiny/School-Support-System-" target="_blank" rel="noreferrer" className="text-xs underline">Repository</a>
              </section>
              <section className="card space-y-1">
                <h2 className="h2">🔵 Google</h2>
                <CheckList rows={[google]} />
                <p className="text-xs muted">Google is used only for YouTube lookups. Quota and key management: Google Cloud console → APIs & Services.</p>
              </section>
              <section className="card space-y-1">
                <h2 className="h2">🤖 Anthropic</h2>
                <CheckList rows={config.filter((c) => c.name === "Anthropic API key")} />
                <p className="text-xs muted">Usage and credit: console.anthropic.com → Usage. A "credit balance too low" error lands under Errors and in your inbox.</p>
              </section>
            </div>
          ) },
        ]}
      />
      <Link href="/parent/notifications" className="text-xs muted underline">System notes also arrive in your inbox</Link>
    </main>
  );
}
