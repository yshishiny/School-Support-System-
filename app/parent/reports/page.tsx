import { describeAccess } from "@/lib/device";
import { formatInTimeZone } from "date-fns-tz";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SendReportButton } from "@/components/SendReportButton";
import { waShareLink } from "@/lib/whatsapp/send";
import { prettyDate } from "@/lib/dates";
import type { DailyReport } from "@/lib/types";

export const maxDuration = 300;

export default async function ReportsPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const { data } = await supabase.from("daily_reports").select("*").eq("family_id", family.id).order("report_date", { ascending: false }).limit(14);
  const { data: members } = await supabase.from("profiles").select("id, full_name, role").eq("family_id", family.id);
  const { data: entries } = await supabase.from("access_logs").select("*").in("user_id", (members ?? []).map((x) => x.id)).order("created_at", { ascending: false }).limit(40);
  const nameOf = (id: string) => (members ?? []).find((x) => x.id === id)?.full_name?.split(" ")[0] ?? "?";
  const reports = (data ?? []) as DailyReport[];

  return (
    <main className="space-y-4">
      <h1 className="h1">Daily reports</h1>
      <div className="card space-y-3">
        <p className="text-sm muted">
          A report is generated automatically every evening and sent to {family.telegram_chat_id ? "Telegram" : "Telegram once connected in Settings"}{family.parent_whatsapp ? ` and WhatsApp +${family.parent_whatsapp}` : ""}. You can also trigger it now.
        </p>
        <SendReportButton lastStatus={reports[0] ? `${reports[0].status} via ${reports[0].channel}${reports[0].error ? ` (${reports[0].error})` : ""} · ${String(reports[0].sent_at ?? reports[0].created_at ?? "").slice(0, 16).replace("T", " ")}` : null} />
      </div>
      {reports.map((r) => (
        <section key={r.id} className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="h2">{prettyDate(r.report_date)}</h2>
            <div className="flex items-center gap-2">
              <span className={`badge ${r.status === "sent" ? "text-good" : r.status === "failed" ? "text-bad" : "text-warn"}`}>{r.status}{r.channel !== "none" ? ` · ${r.channel}` : ""}</span>
              <a href={waShareLink(r.body)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" title="Opens WhatsApp with the text so you can forward it by hand">Forward via WhatsApp</a>
            </div>
          </div>
          {r.error && <p className="text-xs text-bad mb-2">{r.error}</p>}
          <pre className="whitespace-pre-wrap text-sm font-sans">{r.body}</pre>
        </section>
      ))}
      {reports.length === 0 && <p className="card muted">No reports yet.</p>}
          <section className="card">
        <h2 className="h2 mb-2">📱 Entries to the system</h2>
        <p className="text-xs muted mb-2">Every login, and the first page of the day on each device: time, who, where (from the network address) and the device. Today&apos;s entries go into the daily report automatically.</p>
        <ul className="text-sm divide-y divide-line">
          {(entries ?? []).map((e) => (
            <li key={e.id} className="py-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="muted w-24 shrink-0">{formatInTimeZone(new Date(e.created_at), family.timezone, "d MMM HH:mm")}</span>
              <b>{nameOf(e.user_id)}</b>
              <span className="badge">{e.event}</span>
              <span className="muted">{describeAccess(e)}</span>
              {e.ip && <span className="text-[11px] muted">{e.ip}</span>}
            </li>
          ))}
          {(entries ?? []).length === 0 && <li className="muted text-sm">No entries yet.</li>}
        </ul>
      </section>
</main>
  );
}
