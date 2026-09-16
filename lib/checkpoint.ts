/**
 * Checkpoints: a timed, one-attempt test built from what the child logged this week, so the self-report
 * ("I took linear equations in Math") can be compared with a score. Pure helpers.
 */
export interface CheckpointAnswer { correct: boolean; skill_tag: string | null }
export interface ClaimedSubject { subject: string; lessons: number }

export type Position = "strong" | "ok" | "weak" | "unmeasured";

export interface SubjectPosition {
  subject: string;
  correct: number;
  total: number;
  claimed: number; // lessons logged this week in that subject
  position: Position;
  verdict: "consistent" | "claimed_not_learned" | "not_claimed" | "unmeasured";
}

export interface CheckpointResult {
  score: number;
  total: number;
  bySubject: SubjectPosition[];
}

/** The subject is the part of the skill tag before the colon ("Math: slope"), as the checkpoint prompt requires. */
export function subjectOfTag(tag: string | null): string {
  if (!tag) return "General";
  const i = tag.indexOf(":");
  return (i > 0 ? tag.slice(0, i) : tag).trim() || "General";
}

export function positionFor(correct: number, total: number): Position {
  if (total === 0) return "unmeasured";
  const pct = correct / total;
  return pct >= 0.8 ? "strong" : pct >= 0.5 ? "ok" : "weak";
}

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z؀-ۿ]+/g, " ").trim();

/** Scores per subject and compares with what was claimed in the class log. */
export function checkpointResult(answers: CheckpointAnswer[], claimed: ClaimedSubject[]): CheckpointResult {
  const map = new Map<string, { correct: number; total: number }>();
  for (const a of answers) {
    const s = subjectOfTag(a.skill_tag);
    const cur = map.get(s) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.correct) cur.correct += 1;
    map.set(s, cur);
  }
  const bySubject: SubjectPosition[] = [];
  for (const [subject, v] of map) {
    const claim = claimed.find((c) => norm(c.subject) === norm(subject) || norm(c.subject).startsWith(norm(subject)) || norm(subject).startsWith(norm(c.subject)));
    const lessons = claim?.lessons ?? 0;
    const position = positionFor(v.correct, v.total);
    const verdict = position === "unmeasured" ? "unmeasured" : lessons === 0 ? "not_claimed" : position === "weak" && lessons >= 2 ? "claimed_not_learned" : "consistent";
    bySubject.push({ subject, correct: v.correct, total: v.total, claimed: lessons, position, verdict });
  }
  bySubject.sort((a, b) => a.correct / Math.max(1, a.total) - b.correct / Math.max(1, b.total));
  return { score: answers.filter((a) => a.correct).length, total: answers.length, bySubject };
}

const ICON: Record<Position, string> = { strong: "🟢", ok: "🟡", weak: "🔴", unmeasured: "⚪" };

/** One line for the report: "11/15 · Math 4/4 🟢 · Physics 1/4 🔴 (logged 3 lessons, not learned)". */
export function checkpointLine(r: CheckpointResult): string {
  const parts = r.bySubject.map((s) => `${s.subject} ${s.correct}/${s.total} ${ICON[s.position]}${s.verdict === "claimed_not_learned" ? ` (logged ${s.claimed} lesson${s.claimed === 1 ? "" : "s"}, not learned)` : ""}`);
  return `${r.score}/${r.total}${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
}

/** Subjects that need the parent's attention: claimed in the log but failed in the test. */
export function claimedNotLearned(r: CheckpointResult): string[] {
  return r.bySubject.filter((s) => s.verdict === "claimed_not_learned").map((s) => s.subject);
}
