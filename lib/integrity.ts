/**
 * Integrity signals: deterministic checks that the system is being used honestly, turned into
 * questions a parent can ask that evening. Labels only, no accusations; the conversation does the work.
 */
export interface IntegrityInput {
  today: string;
  tz?: string;
  attempts: { submitted_at: string | null; seconds: number | null; total: number | null; tab_switches: number; kind: string; title?: string | null }[];
  prayers: { log_date: string; logged_at: string; status: string; entered_late: boolean; claim: string | null; prayer: string }[];
  checkins: { checkin_date: string; submitted_at: string | null; hourLocal?: number }[];
  lessonLogs: { log_date: string; subject_name: string; note: string }[];
  snaps: { taken_on: string; status: string; ai_verdict: string | null }[];
}

export interface IntegritySignal {
  code: string;
  label: string; // for the report / home
  ask: string; // the question for the parent
}

const cap = (p: string) => p[0].toUpperCase() + p.slice(1);

export function integritySignals(i: IntegrityInput): IntegritySignal[] {
  const out: IntegritySignal[] = [];
  const weekAgo = new Date(Date.parse(i.today + "T00:00:00Z") - 6 * 86400000).toISOString().slice(0, 10);

  // 1. Quiz finished too fast to have been read.
  const fast = i.attempts.filter((a) => a.submitted_at && a.kind !== "review" && (a.total ?? 0) >= 5 && a.seconds !== null && a.seconds / (a.total ?? 1) < 8);
  if (fast.length) out.push({ code: "fast_quiz", label: `${fast.length} quiz set${fast.length === 1 ? "" : "s"} finished at under 8 seconds a question`, ask: `Ask him to explain one question from “${fast[0].title ?? "the set"}” he finished in ${fast[0].seconds} seconds.` });

  // 2. Switching tabs during a quiz.
  const tabs = i.attempts.filter((a) => a.submitted_at && a.tab_switches >= 3);
  if (tabs.length) out.push({ code: "tab_switches", label: `Left the quiz screen ${tabs[0].tab_switches} times during a set`, ask: "Ask, lightly, what he was looking at during the quiz." });

  // 3. Several prayers logged within minutes of each other (logged at the time, not as late entries).
  const byDay = new Map<string, number[]>();
  for (const p of i.prayers.filter((p) => !p.entered_late && p.log_date >= weekAgo)) byDay.set(p.log_date, [...(byDay.get(p.log_date) ?? []), Date.parse(p.logged_at)]);
  for (const [day, times] of byDay) {
    const sorted = times.sort((a, b) => a - b);
    for (let k = 0; k + 2 < sorted.length; k += 1) {
      if (sorted[k + 2] - sorted[k] < 3 * 60000) {
        out.push({ code: "prayer_burst", label: `Three prayers logged within three minutes on ${day}`, ask: "Ask which prayer he prayed where that day, one at a time." });
        break;
      }
    }
  }

  // 4. Repeated "on time" claims entered later, outside school hours.
  const retro = i.prayers.filter((p) => p.entered_late && p.status === "on_time" && p.claim !== "school" && p.log_date >= weekAgo);
  if (retro.length >= 3) out.push({ code: "retro_on_time", label: `${retro.length} prayers marked on time after the fact this week`, ask: `Ask where he prayed ${cap(retro[retro.length - 1].prayer)} on ${retro[retro.length - 1].log_date} and with whom.` });

  // 5. Check-in submitted in the small hours.
  const night = i.checkins.filter((c) => c.hourLocal !== undefined && c.hourLocal >= 0 && c.hourLocal < 5);
  if (night.length) out.push({ code: "night_checkin", label: "A check-in went in between midnight and 5am", ask: "Ask what time he actually slept that night." });

  // 6. The same class note copied across days for one subject.
  const seen = new Map<string, string>();
  for (const l of i.lessonLogs.filter((l) => l.log_date >= weekAgo)) {
    const key = `${l.subject_name.toLowerCase()}|${l.note.trim().toLowerCase()}`;
    if (l.note.trim().length >= 6 && seen.has(key) && seen.get(key) !== l.log_date) {
      out.push({ code: "copy_notes", label: `The same ${l.subject_name} note on two days`, ask: `Ask him to tell you one new thing from ${l.subject_name} on ${l.log_date}.` });
      break;
    }
    seen.set(key, l.log_date);
  }

  // 7b. "No class / absent" used to skip the class log.
  const noClass = i.lessonLogs.filter((l) => l.log_date >= weekAgo && /^no class/i.test(l.note.trim()));
  const noClassToday = noClass.filter((l) => l.log_date === i.today);
  if (noClassToday.length >= 3 || noClass.length >= 5) out.push({ code: "no_class_overuse", label: `“No class” marked ${noClassToday.length >= 3 ? `${noClassToday.length} times today` : `${noClass.length} times this week`}`, ask: `Ask which classes really did not happen ${noClassToday.length >= 3 ? "today" : "this week"} (${[...new Set((noClassToday.length >= 3 ? noClassToday : noClass).map((l) => l.subject_name))].join(", ")}) and what he did in that time.` });

  // 7. Snaps sent back more than once.
  const rejected = i.snaps.filter((s) => s.status === "rejected" && s.taken_on >= weekAgo);
  if (rejected.length >= 2) out.push({ code: "snaps_rejected", label: `${rejected.length} snaps sent back this week`, ask: "Have a look at the bed and desk yourself tonight, without making it a thing." });

  return out;
}
