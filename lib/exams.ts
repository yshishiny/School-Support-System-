/** College-entrance exam sections the boys can practise. Keys match topics.act_section / quizzes.act_section. */
export type ExamName = "ACT" | "SAT" | "BOTH";

export interface ExamSection {
  exam: ExamName;
  label: string;
  questions: number;
  minutes: number;
  optional?: boolean;
  setSize: number; // questions per practice set here (passage-heavy sections are shorter so they generate quickly)
}

export const EXAM_SECTIONS: Record<string, ExamSection> = {
  // Enhanced ACT (2025 onwards)
  english: { exam: "ACT", label: "English", questions: 50, minutes: 35, setSize: 6 },
  math: { exam: "ACT", label: "Math", questions: 45, minutes: 50, setSize: 8 },
  reading: { exam: "ACT", label: "Reading", questions: 36, minutes: 40, setSize: 5 },
  science: { exam: "ACT", label: "Science", questions: 40, minutes: 40, optional: true, setSize: 6 },
  // Digital SAT
  sat_rw: { exam: "SAT", label: "Reading & Writing", questions: 54, minutes: 64, setSize: 6 },
  sat_math: { exam: "SAT", label: "Math", questions: 44, minutes: 70, setSize: 8 },
  // A mixed set drawing on both tests
  mixed: { exam: "BOTH", label: "SAT + ACT mix", questions: 8, minutes: 8, setSize: 8 },
};

export const EXAM_INFO: Record<"ACT" | "SAT", { blurb: string; scale: string }> = {
  ACT: { blurb: "Enhanced ACT: English 50 q / 35 min · Math 45 q / 50 min · Reading 36 q / 40 min · Science optional.", scale: "1–36 per section" },
  SAT: { blurb: "Digital SAT: Reading & Writing 54 q / 64 min · Math 44 q / 70 min. Adaptive, calculator allowed throughout.", scale: "200–800 per section" },
};

/** Which exams to show for a student: the chosen one, or both once they are in high school. */
export function examsFor(targetExam: string | null, grade: number | null): ("ACT" | "SAT")[] {
  if (targetExam === "SAT") return ["SAT"];
  if (targetExam === "ACT") return ["ACT"];
  if (targetExam === "BOTH" || (grade ?? 0) >= 9) return ["SAT", "ACT"];
  return [];
}

export function sectionsFor(exam: "ACT" | "SAT"): [string, ExamSection][] {
  return Object.entries(EXAM_SECTIONS).filter(([, s]) => s.exam === exam);
}

export function secondsPerQuestion(sectionKey: string): number {
  const s = EXAM_SECTIONS[sectionKey];
  return s ? Math.round((s.minutes * 60) / s.questions) : 60;
}

/** Rough scaled-score estimate from a practice percentage. Real curves vary by test. */
export function scaledEstimate(exam: ExamName, pct: number | null): number | null {
  if (pct === null) return null;
  if (exam === "ACT") return Math.max(1, Math.min(36, Math.round(10 + (pct / 100) * 26)));
  if (exam === "SAT") return Math.max(200, Math.min(800, Math.round((200 + (pct / 100) * 600) / 10) * 10));
  return Math.round(pct);
}

export function trackFor(exam: ExamName): "act" | "sat" {
  return exam === "SAT" ? "sat" : "act";
}
