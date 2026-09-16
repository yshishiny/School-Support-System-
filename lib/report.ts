import { KIND_EMOJI } from "./types";
import type { AssignmentKind, ItemStatus } from "./types";
import { prettyDate } from "./dates";
import { APP_NAME, APP_VERSION } from "./version";

export interface ReportChild {
  name: string;
  grade: number | null;
  checkin: {
    mood: number | null;
    minutes: number;
    learned: string | null;
    stuckOn: string | null;
    items: { title: string; kind: AssignmentKind; status: ItemStatus }[];
    enteredLate?: boolean;
  } | null;
  pointsToday: number;
  balance: number;
  streak: number;
  dueTomorrow: { title: string; kind: AssignmentKind }[];
  upcoming: { title: string; kind: AssignmentKind; due_date: string }[]; // quizzes/exams in the next 7 days
  overdue: { title: string; kind: AssignmentKind; due_date: string }[];
  pendingRedemptions: { title: string; points: number }[];
  practice?: { sets: number; correct: number; total: number; reviewsDue: number; flags: string[] };
  covered?: { subject: string; note: string }[];
  prayers?: { prayer: string; status: "on_time" | "late" | "missed"; enteredLate?: boolean; claim?: string | null }[];
  askTonight?: string[]; // integrity signals turned into questions for the parent
  coach?: string | null; // latest coach headline
  attention?: { tier: string; labels: string[] } | null; // early-warning signals, labels only
  access?: { time: string; event: "login" | "visit"; where: string; ip: string | null }[]; // today's entries
  accessWeek?: { days: number; countries: string[]; logins: number } | null; // last 7 days summary
  lastLocation?: { time: string; lat: number; lng: number; source: string; place?: string | null } | null; // from the phone, with consent
  school?: { off: boolean; reason: string | null; lessons: number } | null;
  classLog?: { due: number; done: number; missing: string | null } | null; // this allowance week
  checkpoint?: { line: string; kind: string; notLearned: string[] } | { pending: string } | null;
  snaps?: { label: string; state: "approved" | "good" | "sent" | "rejected" | "missing" }[]; // show-your-win tasks due today
  handwriting?: { score: number; before: number | null; focus: string[] } | null; // latest sample this week
}

const MOOD = ["", "😞", "😕", "😐", "🙂", "😄"];

function statusMark(s: ItemStatus): string {
  return s === "done" ? "✅" : s === "partial" ? "🟡" : "❌";
}

function accessLines(list: NonNullable<ReportChild["access"]>): string[] {
  if (list.length === 0) return ["📱 No entries today."];
  return [`📱 Entries today (${list.length}):`, ...list.slice(0, 6).map((a) => `  ${a.time} ${a.event === "login" ? "login" : "visit"} · ${a.where}${a.ip ? ` · ${a.ip}` : ""}`), ...(list.length > 6 ? [`  … and ${list.length - 6} more`] : [])];
}

/** Plain-text daily report, formatted for WhatsApp (bold with *asterisks*). */
export function buildDailyReport(date: string, children: ReportChild[], parentAccess?: NonNullable<ReportChild["access"]>, custodyLine?: string | null): string {
  const lines: string[] = [`📚 *Study report, ${prettyDate(date)}*`];
  if (custodyLine) lines.push(custodyLine);

  for (const c of children) {
    lines.push("");
    lines.push(`*${c.name}*${c.grade ? ` (Grade ${c.grade})` : ""}`);
    if (c.school) lines.push(c.school.off ? `🏖️ No school today${c.school.reason && c.school.reason !== "Weekend" ? ` (${c.school.reason})` : ""}.` : `🏫 School day, ${c.school.lessons} lesson${c.school.lessons === 1 ? "" : "s"}.`);
    if (!c.checkin) {
      lines.push("⚠️ No check-in today.");
    } else {
      const ck = c.checkin;
      const done = ck.items.filter((i) => i.status === "done").length;
      lines.push(
        `Check-in ✓${ck.enteredLate ? " (filled in later)" : ""}  ${ck.mood ? MOOD[ck.mood] + " " : ""}${ck.minutes} min studied` +
          (ck.items.length ? `, ${done}/${ck.items.length} tasks done` : ""),
      );
      for (const i of ck.items) lines.push(`  ${statusMark(i.status)} ${KIND_EMOJI[i.kind]} ${i.title}`);
      if (ck.learned) lines.push(`💡 Learned: ${ck.learned.trim()}`);
      if (ck.stuckOn) lines.push(`❓ Stuck on: ${ck.stuckOn.trim()}`);
    }
    if (c.prayers) {
      const cap = (p: string) => p[0].toUpperCase() + p.slice(1);
      const onTime = c.prayers.filter((p) => p.status === "on_time").length;
      const late = c.prayers.filter((p) => p.status === "late").map((p) => cap(p.prayer));
      const missed = c.prayers.filter((p) => p.status === "missed").map((p) => cap(p.prayer));
      const later = c.prayers.filter((p) => p.status === "on_time" && p.enteredLate).map((p) => `${cap(p.prayer)}${p.claim === "school" ? " at school" : ""}`);
      const missing = 5 - c.prayers.length;
      lines.push(`🕌 Prayers: ${onTime}/5 on time${later.length ? ` (logged later: ${later.join(", ")})` : ""}${late.length ? ` · late: ${late.join(", ")}` : ""}${missed.length ? ` · missed (said so): ${missed.join(", ")}` : ""}${missing > 0 ? ` · ${missing} not logged` : ""}`);
    }
    if (c.askTonight && c.askTonight.length) lines.push(`🔎 Worth asking tonight: ${c.askTonight.join(" · ")}`);
    if (c.checkpoint) lines.push("pending" in c.checkpoint ? `🎯 Checkpoint: ${c.checkpoint.pending}` : `🎯 ${c.checkpoint.kind === "spot" ? "Spot check" : "Checkpoint"}: ${c.checkpoint.line}${c.checkpoint.notLearned.length ? ` · ask about ${c.checkpoint.notLearned.join(", ")}` : ""}`);
    if (c.classLog && c.classLog.due > 0) lines.push(`📖 Class log this week: ${c.classLog.done}/${c.classLog.due}${c.classLog.missing ? ` · still missing ${c.classLog.missing}` : " · complete"}`);
    if (c.covered && c.covered.length) {
      lines.push(`📖 Covered today: ${c.covered.map((l) => `${l.subject}: ${l.note}`).join(" · ")}`);
    }
    if (c.practice) {
      const p = c.practice;
      if (p.sets > 0) {
        lines.push(`🧠 Practice: ${p.sets} set${p.sets === 1 ? "" : "s"}, ${p.correct}/${p.total} correct (${Math.round((p.correct / Math.max(1, p.total)) * 100)}%)`);
      } else {
        lines.push(`🧠 Practice: none today${p.reviewsDue > 0 ? ` · ${p.reviewsDue} reviews waiting` : ""}`);
      }
      for (const f of p.flags) lines.push(`  ⚠️ ${f}`);
    }
    if (c.snaps && c.snaps.length) {
      const mark = { approved: "✅", good: "🟢", sent: "🟡", rejected: "❌", missing: "⬜" } as const;
      lines.push(`📸 Snaps: ${c.snaps.map((x) => `${mark[x.state]} ${x.label}`).join(" · ")}${c.snaps.some((x) => x.state === "good" || x.state === "sent") ? " · waiting for your tick" : ""}`);
    }
    if (c.handwriting) lines.push(`✍️ Handwriting ${c.handwriting.score}/100${c.handwriting.before !== null ? ` (was ${c.handwriting.before})` : ""}${c.handwriting.focus.length ? ` · work on: ${c.handwriting.focus.join(", ")}` : ""}`);
    lines.push(`⭐ +${c.pointsToday} today · balance ${c.balance} · streak ${c.streak}🔥`);
    if (c.coach) lines.push(`🦸 Coach: ${c.coach}`);
    if (c.attention && c.attention.tier !== "none") {
      const icon = c.attention.tier === "red" ? "🚨" : c.attention.tier === "amber" ? "🟡" : "👀";
      lines.push(`${icon} Signals to watch: ${c.attention.labels.slice(0, 3).join("; ")}${c.attention.tier === "watch" ? " (not urgent, worth a look)" : ""}`);
    }
    if (c.overdue.length) {
      lines.push(`⏰ Overdue: ${c.overdue.map((o) => `${o.title} (${prettyDate(o.due_date)})`).join("; ")}`);
    }
    if (c.dueTomorrow.length) {
      lines.push(`📌 Tomorrow: ${c.dueTomorrow.map((d) => `${KIND_EMOJI[d.kind]} ${d.title}`).join("; ")}`);
    }
    if (c.upcoming.length) {
      lines.push(`🎯 Coming up: ${c.upcoming.map((u) => `${u.title} (${prettyDate(u.due_date)})`).join("; ")}`);
    }
    if (c.pendingRedemptions.length) {
      lines.push(`🎁 Wants to redeem: ${c.pendingRedemptions.map((r) => `${r.title} (${r.points} pts)`).join("; ")}`);
    }
    if (c.lastLocation) lines.push(`📍 Last seen ${c.lastLocation.time}${c.lastLocation.place ? `: ${c.lastLocation.place}` : ""} (at his ${c.lastLocation.source}) · https://maps.google.com/?q=${c.lastLocation.lat},${c.lastLocation.lng}`);
    if (c.access) lines.push(...accessLines(c.access));
    if (c.accessWeek && c.accessWeek.logins > 0) lines.push(`  Last 7 days: ${c.accessWeek.logins} entr${c.accessWeek.logins === 1 ? "y" : "ies"} on ${c.accessWeek.days} day${c.accessWeek.days === 1 ? "" : "s"} · countries: ${c.accessWeek.countries.join(", ") || "unknown"}`);
  }
  if (parentAccess) {
    lines.push("");
    lines.push("*Parent accounts*");
    lines.push(...accessLines(parentAccess));
  }
  lines.push("");
  lines.push(`— ${APP_NAME} v${APP_VERSION}`);
  return lines.join("\n");
}
