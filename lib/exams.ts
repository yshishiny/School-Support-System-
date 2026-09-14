/** College-entrance exam sections the boys can practise. Keys match topics.act_section / quizzes.act_section. */
export interface ExamSection {
  exam: "ACT" | "SAT";
  label: string;
  questions: number;
  minutes: number;
  optional?: boolean;
}

export const EXAM_SECTIONS: Record<string, ExamSection> = {
  // Enhanced ACT (2025 onwards)
  english: { exam: "ACT", label: "English", questions: 50, minutes: 35 },
  math: { exam: "ACT", label: "Math", questions: 45, minutes: 50 },
  reading: { exam: "ACT", label: "Reading", questions: 36, minutes: 40 },
  science: { exam: "ACT", label: "Science", questions: 40, minutes: 40, optional: true },
  // Digital SAT
  sat_rw: { exam: "SAT", label: "Reading & Writing", questions: 54, minutes: 64 },
  sat_math: { exam: "SAT", label: "Math", questions: 44, minutes: 70 },
};

export const EXAM_INFO: Record<"ACT" | "SAT", { blurb: string; scale: string }> = {
  ACT: { blurb: "Enhanced ACT: English 50 q / 35 min · Math 45 q / 50 min · Reading 36 q / 40 min · Science optional.", scale: "1–36 per section" },
  SAT: { blurb: "Digital SAT: Reading & Writing 54 q / 64 min · Math 44 q / 70 min. Adaptive, calculator allowed throughout.", scale: "200–800 per section" },
};

export function sectionsFor(exam: "ACT" | "SAT"): [string, ExamSection][] {
  return Object.entries(EXAM_SECTIONS).filter(([, s]) => s.exam === exam);
}

export function secondsPerQuestion(sectionKey: string): number {
  const s = EXAM_SECTIONS[sectionKey];
  return s ? Math.round((s.minutes * 60) / s.questions) : 60;
}

/** Rough scaled-score estimate from a practice percentage. Real curves vary by test. */
export function scaledEstimate(exam: "ACT" | "SAT", pct: number | null): number | null {
  if (pct === null) return null;
  if (exam === "ACT") return Math.max(1, Math.min(36, Math.round(10 + (pct / 100) * 26)));
  return Math.max(200, Math.min(800, Math.round((200 + (pct / 100) * 600) / 10) * 10));
}

export function trackFor(exam: "ACT" | "SAT"): "act" | "sat" {
  return exam === "ACT" ? "act" : "sat";
}
