import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Tabs } from "@/components/Tabs";
import { INBOX_EMOJI, INBOX_LABEL, type InboxKind } from "@/lib/inbox";
import { markNotificationsReadAction } from "@/lib/actions/family";
import { prettyDate } from "@/lib/dates";

type Row = { id: string; kind: InboxKind; title: string; body: string; url: string | null; read_at: string | null; created_at: string };

function when(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${prettyDate(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
}

/** Everything the app told this parent, newest first: reports, alerts, allowance, school news and live pings. */
export default async function ParentInboxPage() {
  const { profile } = await requireParent();
  const supabase = await createClient();
  const { data } = await supabase.from("parent_notifications").select("id, kind, title, body, url, read_at, created_at").eq("parent_id", profile.id).order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as Row[];
  const unread = rows.filter((r) => !r.read_at);
  const kinds = (["report", "alert", "allowance", "news", "ping"] as InboxKind[]).filter((k) => rows.some((r) => r.kind === k));

  function Item({ r }: { r: Row }) {
    const long = r.body.length > 240;
    return (
      <article className={`card !py-3 space-y-1 ${r.read_at ? "opacity-80" : "border-accent/60"}`}>
        <div className="flex items-start gap-2">
          <span className="text-2xl">{INBOX_EMOJI[r.kind]}</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold leading-tight">{r.title}</div>
            <div className="text-xs muted">{INBOX_LABEL[r.kind]} · {when(r.created_at)}{r.read_at ? "" : " · new"}</div>
          </div>
          {!r.read_at && <form action={markNotificationsReadAction.bind(null, r.id)}><button className="btn-ghost btn-sm">Read</button></form>}
        </div>
        {r.body && (long ? (
          <details className="text-sm whitespace-pre-line">
            <summary className="cursor-pointer muted text-xs">{r.body.slice(0, 160).replace(/\n/g, " ")}… (open)</summary>
            <div className="mt-1">{r.body}</div>
          </details>
        ) : (
          <p className="text-sm whitespace-pre-line">{r.body}</p>
        ))}
        {r.url && r.url !== "/parent/notifications" && <Link href={r.url} className="text-xs text-accent-2 underline">Open →</Link>}
      </article>
    );
  }

  const list = (items: Row[], empty: string) => (items.length === 0 ? <p className="card muted text-sm">{empty}</p> : <div className="space-y-2">{items.map((r) => <Item key={r.id} r={r} />)}</div>);

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="h1">🔔 Inbox</h1>
        {unread.length > 0 && <form action={markNotificationsReadAction.bind(null, null)}><button className="btn-ghost btn-sm">Mark all read ({unread.length})</button></form>}
      </div>
      <p className="text-sm muted">A copy of everything the app sends you: the daily report, safety alerts, allowance weeks, school news and the live pings from the boys. It fills even when Telegram or browser notifications are not connected.</p>
      <Tabs
        storageKey="inbox"
        defaultId={unread.length ? "unread" : "all"}
        tabs={[
          { id: "unread", label: "New", emoji: "✨", badge: unread.length, content: list(unread, "Nothing new. You are up to date.") },
          { id: "all", label: "All", emoji: "🗂️", badge: rows.length || null, content: list(rows, "Nothing here yet. The first daily report lands this evening.") },
          ...kinds.map((k) => ({ id: k, label: INBOX_LABEL[k], emoji: INBOX_EMOJI[k], badge: rows.filter((r) => r.kind === k && !r.read_at).length || null, content: list(rows.filter((r) => r.kind === k), "Nothing of this kind yet.") })),
        ]}
      />
    </main>
  );
}
