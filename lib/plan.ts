/**
 * Weekly quiz plan: which pre-prepared quizzes each student should have for the next seven days.
 * Pure functions (no I/O) so the choice of days, subjects and topics is unit-testable.
 */
import { shiftDate, weekdayOf } from "./dates";

export const PLAN_DAYS = 7;

/** Exam sections rotate day by day so a week covers every section at least once. */
const EXAM_ROTATION: { key: string; exam: "SAT" | "ACT" | "BOTH" }[] = [
  { key: "sat_rw", exam: "SAT" },
  { key: "math", exam: "ACT" },
  { key: "sat_math", exam: "SAT" },
  { key: "english", exam: "ACT" },
  { key: "mixed", exam: "BOTH" },
  { key: "reading", exam: "ACT" },
  { key: "science", exam: "ACT" },
];

export type PlanSlotKind = "school" | "exam";

export interface PlanSlot {
  date: string;
  slot: PlanSlotKind;
  /** Curriculum subject (school slot) or exam section key (exam slot). */
  subject: string;
  topicId?: string;
  topicName?: string;
  actSection?: string;
}

export interface PlanTopic {
  id: string;
  subject: string;
  name: string;
  sort: number;
}

export interface ExistingPlanned {
  scheduled_for: string | null;
  plan_slot: string | null;
  topic_id: string | null;
  act_section: string | null;
}

export interface PlanInput {
  today: string;
  timetable: { weekday: number; subject_name: string }[];
  topics: PlanTopic[]; // school topics at the student's grade
  exams: ("SAT" | "ACT")[];
  mastery: Map<string, number>; // topic id -> % from past attempts
  existing: ExistingPlanned[];
  covered?: Set<string>; // topic ids the student logged as taken at school recently
  days?: number;
}

/** Maps a timetable subject name ("Math (GPA)", "English Pre-SAT", "History") to a curriculum subject, or null for subjects we do not quiz. */
export function curriculumSubject(timetableName: string, available: string[]): string | null {
  const raw = timetableName.toLowerCase().replace(/\s+/g, " ").trim();
  const n = raw.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  if (/french|german|\bp\.?e\b|\bart\b|music|line|library|advisory|homeroom/.test(n)) return null;
  let wanted: string | null = null;
  // Egyptian Ministry (M.O.E.) subjects, taught in Arabic.
  if (/arabic social|m\.?o\.?e/.test(raw)) wanted = "Arabic Social Studies";
  else if (/religion|islamic|deen/.test(n)) wanted = "Religion";
  else if (/arabic/.test(n)) wanted = "Arabic";
  else if (/math|algebra|geometry|calculus/.test(n)) wanted = "Math";
  else if (/physics/.test(n)) wanted = "Physics";
  else if (/biolog/.test(n)) wanted = "Biology";
  else if (/chem/.test(n)) wanted = "Chemistry";
  else if (/science/.test(n)) wanted = "Science";
  else if (/social english/.test(n)) wanted = "Social Studies";
  else if (/english|ela|literature|writing/.test(n)) wanted = "English";
  else if (/history|social|geograph|civics|economics/.test(n)) wanted = "Social Studies";
  if (!wanted) return null;
  const hit = available.find((a) => a.toLowerCase() === wanted!.toLowerCase());
  if (hit) return hit;
  // Grade 8 "Science" covers biology/physics; grade 10 splits them. Fall back either way.
  if (wanted === "Science") return available.find((a) => /biology|physics|chemistry/i.test(a)) ?? null;
  if (["Biology", "Physics", "Chemistry"].includes(wanted)) return available.find((a) => /^science$/i.test(a)) ?? null;
  return null;
}

function dayNumber(isoDate: string): number {
  return Math.floor(Date.parse(isoDate + "T00:00:00Z") / 86400000);
}

/**
 * Picks the topic to quiz for a subject: a recently covered class topic that is not yet mastered (80%+),
 * else the weakest practised topic under 70%, else the first unpractised one, else the weakest overall.
 */
export function pickTopic(topics: PlanTopic[], subject: string, mastery: Map<string, number>, exclude: Set<string>, covered: Set<string> = new Set()): PlanTopic | null {
  const list = topics.filter((t) => t.subject === subject && !exclude.has(t.id)).sort((a, b) => a.sort - b.sort);
  if (list.length === 0) return null;
  const taught = list.filter((t) => covered.has(t.id) && (mastery.get(t.id) ?? 0) < 80).sort((a, b) => (mastery.get(a.id) ?? -1) - (mastery.get(b.id) ?? -1));
  if (taught.length) return taught[0];
  const weak = list.filter((t) => mastery.has(t.id) && (mastery.get(t.id) ?? 0) < 70).sort((a, b) => (mastery.get(a.id) ?? 0) - (mastery.get(b.id) ?? 0));
  if (weak.length) return weak[0];
  const fresh = list.find((t) => !mastery.has(t.id));
  if (fresh) return fresh;
  return [...list].sort((a, b) => (mastery.get(a.id) ?? 0) - (mastery.get(b.id) ?? 0))[0];
}

/** The slots the plan wants for the window, and the subset that still has no quiz. */
export function planSlots(input: PlanInput): { wanted: PlanSlot[]; missing: PlanSlot[] } {
  const days = input.days ?? PLAN_DAYS;
  const available = [...new Set(input.topics.map((t) => t.subject))];
  const rotation = EXAM_ROTATION.filter((r) => r.exam === "BOTH" ? input.exams.length === 2 : input.exams.includes(r.exam));
  const existingKey = new Set(input.existing.filter((e) => e.scheduled_for && e.plan_slot).map((e) => `${e.scheduled_for}:${e.plan_slot}`));
  const usedTopics = new Set(input.existing.map((e) => e.topic_id).filter((x): x is string => !!x));
  const usedSubjects: string[] = [];

  const wanted: PlanSlot[] = [];
  for (let i = 0; i < days; i++) {
    const date = shiftDate(input.today, i);
    const wd = weekdayOf(date);
    const rows = input.timetable.filter((t) => t.weekday === wd);
    if (rows.length === 0) continue; // no school that day

    const subjects = [...new Set(rows.map((r) => curriculumSubject(r.subject_name, available)).filter((s): s is string => !!s))];
    const existingSchool = input.existing.find((e) => e.scheduled_for === date && e.plan_slot === "school");
    if (existingSchool) {
      const t = input.topics.find((x) => x.id === existingSchool.topic_id);
      if (t) usedSubjects.push(t.subject);
      wanted.push({ date, slot: "school", subject: t?.subject ?? "", topicId: t?.id, topicName: t?.name });
    } else if (subjects.length) {
      // Prefer a subject not yet used this window so the week covers different subjects.
      const subject = subjects.find((s) => !usedSubjects.includes(s)) ?? subjects[usedSubjects.filter((u) => subjects.includes(u)).length % subjects.length];
      // Reuse a topic only when the subject has nothing else left (a new set is still generated).
      const covered = input.covered ?? new Set<string>();
      const topic = pickTopic(input.topics, subject, input.mastery, usedTopics, covered) ?? pickTopic(input.topics, subject, input.mastery, new Set(), covered);
      if (topic) {
        usedTopics.add(topic.id);
        usedSubjects.push(subject);
        wanted.push({ date, slot: "school", subject, topicId: topic.id, topicName: topic.name });
      }
    }
    if (rotation.length) {
      const r = rotation[dayNumber(date) % rotation.length];
      wanted.push({ date, slot: "exam", subject: r.key, actSection: r.key });
    }
  }
  const missing = wanted.filter((w) => !existingKey.has(`${w.date}:${w.slot}`));
  return { wanted, missing };
}

/** Display name for a curriculum subject; Ministry subjects show their Arabic names. */
export function subjectLabel(subject: string): string {
  return { Arabic: "اللغة العربية", Religion: "التربية الدينية", "Arabic Social Studies": "الدراسات الاجتماعية" }[subject] ?? subject;
}

export function isArabicSubject(subject: string): boolean {
  return subject === "Arabic" || subject === "Religion" || subject === "Arabic Social Studies";
}
