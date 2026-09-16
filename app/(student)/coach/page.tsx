import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { INSTRUMENTS, dueInstruments, type CheckHistoryRow } from "@/lib/wellbeing";
import { themeById } from "@/lib/themes";
import { CoachChat } from "@/components/CoachChat";
import { Tabs } from "@/components/Tabs";
import ReactMarkdown from "react-markdown";

export const maxDuration = 120;

export default async function CoachPage() {
  const { profile, family } = await requireStudent();
  const supabase = await createClient();
  const today = todayIn(family.timezone);
  const [{ data: checks }, { data: messages }, { data: report }, { data: shared }] = await Promise.all([
    supabase.from("wellbeing_checks").select("instrument, taken_on, band, score").eq("student_id", profile.id).order("taken_on", { ascending: false }).limit(60),
    supabase.from("coach_messages").select("role, content").eq("student_id", profile.id).order("created_at", { ascending: true }).limit(40),
    supabase.from("coach_reports").select("kid_md, created_at").eq("student_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("clinician_reports").select("created_at").eq("student_id", profile.id).eq("scope", "with_chat_themes").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const history = (checks ?? []) as CheckHistoryRow[];
  const due = dueInstruments(today, history);
  const theme = themeById(profile.theme);
  const mascot = (theme.stickers ?? [theme.emoji])[0] ?? theme.emoji;
  const first = profile.full_name.split(" ")[0];

  const checkTab = (
    <>
      {due.length === 0 && (
        <section className="card flex items-center gap-3">
          <span className="text-4xl sticker-still">✅</span>
          <div className="text-sm"><b>All caught up.</b> <span className="muted">Your next check-in appears here when it is due. Weekly pulse every week, the others every few weeks.</span></div>
        </section>
      )}
      {due.map((id) => {
        const d = INSTRUMENTS[id];
        return (
          <Link key={id} href={`/coach/check/${id}`} className="card flex items-center gap-3 border-accent/50">
            <span className="text-4xl sticker-still">{d.emoji}</span>
            <div className="flex-1">
              <div className="font-bold">{d.title}</div>
              <div className="text-xs muted">{d.questions.length} taps · {d.minutes} min · +5 pts · {d.shared ? "shared with your parents (labels only) · honesty is the whole point" : "private"}</div>
            </div>
            <span className="btn-primary btn-sm">Start</span>
          </Link>
        );
      })}
      {history.length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">Your last check-ins</h2>
          <ul className="text-sm divide-y divide-line">
            {history.slice(0, 8).map((h, i) => (
              <li key={i} className="py-1.5 flex items-center justify-between">
                <span>{INSTRUMENTS[h.instrument].emoji} {INSTRUMENTS[h.instrument].title}</span>
                <span className="muted text-xs">{h.taken_on}{h.score !== null ? ` · ${h.score}/100` : ""}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] muted mt-2">Your answers are yours. Your parents only ever see a green, yellow or red light, never what you wrote, unless the coach believes you are in danger.</p>
        </section>
      )}
    </>
  );

  return (
    <main className="space-y-4">
      <header className="card flex items-center gap-3 relative overflow-hidden">
        <span className="text-5xl sticker">{mascot}</span>
        <div>
          <h1 className="h1">Coach</h1>
          <p className="text-xs muted">Talk, check in, get a plan. {theme.tagline}.</p>
        </div>
      </header>
      {shared && (
        <section className="card border-warn/50 text-sm">
          <b>For your information:</b> on {String(shared.created_at).slice(0, 10)} your parents shared a summary with a doctor that included themes from this chat, as you agreed. Themes only, no quotes. Your chat here stays private otherwise.
        </section>
      )}
      <Tabs
        storageKey="coach"
        defaultId={due.length ? "check" : "chat"}
        tabs={[
          { id: "chat", label: "Talk", emoji: "💬", content: <CoachChat initial={(messages ?? []) as { role: "user" | "assistant"; content: string }[]} firstName={first} mascot={mascot} /> },
          { id: "check", label: "Check-in", emoji: "💓", badge: due.length, content: checkTab },
          {
            id: "plan",
            label: "My plan",
            emoji: "🦸",
            content: report?.kid_md ? (
              <section className="card space-y-1">
                <div className="prose-lesson text-sm"><ReactMarkdown>{report.kid_md}</ReactMarkdown></div>
                <p className="text-[11px] muted">Updated {String(report.created_at).slice(0, 10)}. Refreshes every week from your results.</p>
              </section>
            ) : (
              <section className="card text-sm muted">Your coach writes a plan after your first week of quizzes and check-ins.</section>
            ),
          },
        ]}
      />
    </main>
  );
}
