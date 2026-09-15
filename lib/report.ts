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
}

const MOOD = ["", "😞", "😕", "😐", "🙂", "😄"];

function statusMark(s: ItemStatus): string {
  return s === "done" ? "✅" : s === "partial" ? "🟡" : "❌";
}

/** Plain-text daily report, formatted for WhatsApp (bold with *asterisks*). */
export function buildDailyReport(date: string, children: ReportChild[]): string {
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
  }
  return lines.join("\n");
}
