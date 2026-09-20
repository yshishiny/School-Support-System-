/** A unified activity feed for the parent: what each child did, newest first. Pure mapping. */
export interface ActivityEvent { at: string; studentId: string; icon: string; text: string; href?: string }

export interface ActivityRows {
  attempts: { student_id: string; started_at: string; submitted_at: string | null; score: number | null; total: number | null; kind: string; quizzes: { title: string; checkpoint_id?: string | null } | null }[];
  checkins: { student_id: string; submitted_at: string; minutes_studied: number; entered_late?: boolean }[];
  prayers: { student_id: string; logged_at: string; prayer: string; status: string; entered_late?: boolean }[];
  snaps: { student_id: string; created_at: string; task_code: string; status: string; ai_verdict: string | null }[];
  lessons: { student_id: string; started_at: string; finished_at: string | null; understanding: string | null; lesson_scripts: { title: string } | null }[];
  logs: { student_id: string; created_at: string; subject_name: string; note: string }[];
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function buildActivity(r: ActivityRows, limit = 30): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  for (const a of r.attempts) {
    if (a.submitted_at) out.push({ at: a.submitted_at, studentId: a.student_id, icon: a.quizzes?.checkpoint_id ? "🎯" : a.kind === "review" ? "🔁" : "⚡", text: `finished ${a.quizzes?.title ?? (a.kind === "review" ? "a review session" : "a quiz")} · ${a.score ?? 0}/${a.total ?? 0}` });
    else out.push({ at: a.started_at, studentId: a.student_id, icon: "▶️", text: `started ${a.quizzes?.title ?? "a quiz"}` });
  }
  for (const c of r.checkins) out.push({ at: c.submitted_at, studentId: c.student_id, icon: "✅", text: `checked in · ${c.minutes_studied} min studied${c.entered_late ? " (filled in later)" : ""}` });
  for (const p of r.prayers) out.push({ at: p.logged_at, studentId: p.student_id, icon: "🕌", text: `${cap(p.prayer)} ${p.status === "on_time" ? "on time" : p.status}${p.entered_late ? " (logged later)" : ""}` });
  for (const s of r.snaps) out.push({ at: s.created_at, studentId: s.student_id, icon: "📸", text: `snapped ${s.task_code}${s.status === "approved" ? " · approved" : s.status === "rejected" ? " · sent back" : s.ai_verdict === "looks_good" ? " · looks good" : ""}` });
  for (const l of r.lessons) out.push(l.finished_at ? { at: l.finished_at, studentId: l.student_id, icon: "🧑‍🏫", text: `finished the lesson “${l.lesson_scripts?.title ?? "lesson"}” · ${l.understanding ?? ""}` } : { at: l.started_at, studentId: l.student_id, icon: "🧑‍🏫", text: `started the lesson “${l.lesson_scripts?.title ?? "lesson"}”` });
  for (const g of r.logs) out.push({ at: g.created_at, studentId: g.student_id, icon: "📖", text: `logged ${g.subject_name}: ${g.note.slice(0, 60)}` });
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** "Quiz: Fractions" from the page the child is on. */
export function describePath(path: string | null | undefined): string {
  if (!path) return "in the app";
  if (path.startsWith("/quiz/")) return "doing a quiz";
  if (path.startsWith("/checkin")) return "doing the check-in";
  if (path.startsWith("/learn")) return "on Learn";
  if (path.startsWith("/coach")) return "with the coach";
  if (path.startsWith("/snaps")) return "on snaps";
  if (path.startsWith("/review")) return "reviewing";
  if (path.startsWith("/today")) return "on Today";
  return "in the app";
}

/** Online if seen within the last three minutes. */
export function presence(lastSeen: string | null | undefined, path: string | null | undefined, nowMs = Date.now()): { online: boolean; label: string } {
  if (!lastSeen) return { online: false, label: "" };
  const mins = Math.round((nowMs - Date.parse(lastSeen)) / 60000);
  if (mins <= 3) return { online: true, label: `online now · ${describePath(path)}` };
  return { online: false, label: mins < 60 ? `seen ${mins} min ago` : mins < 1440 ? `seen ${Math.round(mins / 60)} h ago` : `seen ${Math.round(mins / 1440)} d ago` };
}
