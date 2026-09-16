/**
 * Points rules. Everything that pays points goes through here so the numbers
 * live in one place. Points reward consistency and effort, not raw scores.
 */
export const POINTS = {
  CHECKIN: 10, // submitting the daily check-in
  CHECKIN_LATE: 5, // a missed day filled in later in the week
  HOMEWORK_ON_TIME: 5, // each homework/project marked done on or before its due date
  HOMEWORK_LATE: 2, // marked done after the due date
  ALL_DONE_BONUS: 15, // every item due today marked done
  LESSON_NOTE: 2, // each subject the student describes in "what did you take today"
  LESSON_NOTE_MAX: 5, // per day
  LESSON_NOTE_LATE: 1, // filling in a previous day's class later
  STREAK_MILESTONES: { 3: 20, 7: 50, 14: 100, 30: 250 } as Record<number, number>,
} as const;

export interface AwardInput {
  checkinId: string;
  today: string; // YYYY-MM-DD
  items: { assignmentId: string; status: "done" | "partial" | "not_done"; dueDate: string | null; kind: string }[];
  streak: number; // consecutive check-in days including today
  enteredLate?: boolean; // filled in on a later day
}

export interface Award {
  delta: number;
  reason: string;
  ref_type: string;
  ref_id: string;
}

/** Pure function: given a submitted check-in, list the awards it earns. */
export function computeAwards(input: AwardInput): Award[] {
  const awards: Award[] = [];
  awards.push({ delta: input.enteredLate ? POINTS.CHECKIN_LATE : POINTS.CHECKIN, reason: input.enteredLate ? "Check-in filled in later" : "Daily check-in", ref_type: "checkin", ref_id: input.checkinId });

  const workItems = input.items.filter((i) => i.kind === "homework" || i.kind === "project");
  for (const item of workItems) {
    if (item.status !== "done") continue;
    const late = item.dueDate !== null && item.dueDate < input.today;
    awards.push({
      delta: late ? POINTS.HOMEWORK_LATE : POINTS.HOMEWORK_ON_TIME,
      reason: late ? "Homework done (late)" : "Homework done on time",
      ref_type: "assignment",
      ref_id: item.assignmentId,
    });
  }

  const dueToday = input.items.filter((i) => i.dueDate !== null && i.dueDate <= input.today);
  if (dueToday.length > 0 && dueToday.every((i) => i.status === "done")) {
    awards.push({ delta: POINTS.ALL_DONE_BONUS, reason: "Everything due today is done", ref_type: "checkin_bonus", ref_id: input.checkinId });
  }

  const milestone = POINTS.STREAK_MILESTONES[input.streak];
  if (milestone) {
    awards.push({ delta: milestone, reason: `${input.streak}-day streak`, ref_type: `streak_${input.streak}`, ref_id: input.checkinId });
  }
  return awards;
}

/**
 * Streak length ending at `today`, given the set of dates with a check-in.
 * `today` itself must be in the set to count.
 */
export function computeStreak(checkinDates: Iterable<string>, today: string): number {
  const set = new Set(checkinDates);
  let streak = 0;
  let cursor = today;
  while (set.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

function previousDay(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Level from lifetime points: every 200 points is a level. */
export function levelFor(totalPoints: number): { level: number; into: number; span: number } {
  const span = 200;
  const level = Math.floor(Math.max(0, totalPoints) / span) + 1;
  return { level, into: Math.max(0, totalPoints) % span, span };
}
