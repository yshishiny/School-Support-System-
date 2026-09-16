import { KIND_EMOJI } from "./types";
import type { AssignmentKind, ItemStatus } from "./types";
import { prettyDate } from "./dates";

export interface ReportChild {
  name: string;
  grade: number | null;
  checkin: {
    mood: number | null;
    minutes: number;
    learned: string | null;
    stuckOn: string | null;
    items: { title: string; kind: AssignmentKind; status: ItemStatus }[];
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
  prayers?: { prayer: string; status: "on_time" | "late" }[];
  coach?: string | null; // latest coach headline
  attention?: { tier: string; labels: string[] } | null; // early-warning signals, labels only
  access?: { time: string; event: "login" | "visit"; where: string; ip: string | null }[]; // today's entries
  accessWeek?: { days: number; countries: string[]; logins: number } | null; // last 7 days summary
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
export function buildDailyReport(date: string, children: ReportChild[], parentAccess?: NonNullable<ReportChild["access"]>): string {
  const lines: string[] = [`📚 *Study report, ${prettyDate(date)}*`];

  for (const c of children) {
    lines.push("");
    lines.push(`*${c.name}*${c.grade ? ` (Grade ${c.grade})` : ""}`);
    if (!c.checkin) {
      lines.push("⚠️ No check-in today.");
    } else {
      const ck = c.checkin;
      const done = ck.items.filter((i) => i.status === "done").length;
      lines.push(
        `Check-in ✓  ${ck.mood ? MOOD[ck.mood] + " " : ""}${ck.minutes} min studied` +
          (ck.items.length ? `, ${done}/${ck.items.length} tasks done` : ""),
      );
      for (const i of ck.items) lines.push(`  ${statusMark(i.status)} ${KIND_EMOJI[i.kind]} ${i.title}`);
      if (ck.learned) lines.push(`💡 Learned: ${ck.learned.trim()}`);
      if (ck.stuckOn) lines.push(`❓ Stuck on: ${ck.stuckOn.trim()}`);
    }
    if (c.prayers) {
      const onTime = c.prayers.filter((p) => p.status === "on_time").length;
      const late = c.prayers.filter((p) => p.status === "late").map((p) => p.prayer[0].toUpperCase() + p.prayer.slice(1));
      const missing = 5 - c.prayers.length;
      lines.push(`🕌 Prayers: ${onTime}/5 on time${late.length ? ` · late: ${late.join(", ")}` : ""}${missing > 0 ? ` · ${missing} not logged` : ""}`);
    }
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
    if (c.access) lines.push(...accessLines(c.access));
    if (c.accessWeek && c.accessWeek.logins > 0) lines.push(`  Last 7 days: ${c.accessWeek.logins} entr${c.accessWeek.logins === 1 ? "y" : "ies"} on ${c.accessWeek.days} day${c.accessWeek.days === 1 ? "" : "s"} · countries: ${c.accessWeek.countries.join(", ") || "unknown"}`);
  }
  if (parentAccess) {
    lines.push("");
    lines.push("*Parent account*");
    lines.push(...accessLines(parentAccess));
  }
  return lines.join("\n");
}
