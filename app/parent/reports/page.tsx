import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SendReportButton } from "@/components/SendReportButton";
import { waShareLink } from "@/lib/whatsapp/send";
import { prettyDate } from "@/lib/dates";
import type { DailyReport } from "@/lib/types";

export default async function ReportsPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const { data } = await supabase.from("daily_reports").select("*").eq("family_id", family.id).order("report_date", { ascending: false }).limit(14);
  const reports = (data ?? []) as DailyReport[];

  return (
    <main className="space-y-4">
      <h1 className="h1">Daily reports</h1>
      <div className="card space-y-3">
        <p className="text-sm muted">
          A report is generated automatically every evening and sent to {family.parent_whatsapp ? `WhatsApp +${family.parent_whatsapp}` : "WhatsApp once you set your number in Settings"}. You can also trigger it now.
        </p>
        <SendReportButton />
      </div>
      {reports.map((r) => (
        <section key={r.id} className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="h2">{prettyDate(r.report_date)}</h2>
            <div className="flex items-center gap-2">
              <span className={`badge ${r.status === "sent" ? "text-good" : r.status === "failed" ? "text-bad" : "text-warn"}`}>{r.status}{r.channel !== "none" ? ` · ${r.channel}` : ""}</span>
              <a href={waShareLink(r.body)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Share</a>
            </div>
          </div>
          {r.error && <p className="text-xs text-bad mb-2">{r.error}</p>}
          <pre className="whitespace-pre-wrap text-sm font-sans">{r.body}</pre>
        </section>
      ))}
      {reports.length === 0 && <p className="card muted">No reports yet.</p>}
    </main>
  );
}
