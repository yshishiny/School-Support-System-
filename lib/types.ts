export type UserRole = "parent" | "student";
export type AssignmentKind = "homework" | "quiz" | "exam" | "project" | "event" | "note";
export type AssignmentSource = "manual" | "whatsapp" | "student";
export type AssignmentStatus = "open" | "done" | "missed";
export type ItemStatus = "done" | "partial" | "not_done";
export type RewardKind = "cash" | "privilege" | "item";
export type RedemptionStatus = "pending" | "approved" | "rejected" | "delivered";

export interface Family {
  id: string;
  name: string;
  parent_whatsapp: string | null;
  timezone: string;
  report_hour: number;
  telegram_chat_id: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Profile {
  id: string;
  family_id: string;
  role: UserRole;
  full_name: string;
  grade: number | null;
  avatar_emoji: string;
  locale: string;
  target_exam: string | null;
  target_exam_date: string | null;
}

export interface Subject {
  id: string;
  student_id: string;
  name: string;
  teacher: string | null;
  color: string;
}

export interface Assignment {
  id: string;
  student_id: string;
  subject_id: string | null;
  subject_name: string | null;
  kind: AssignmentKind;
  title: string;
  details: string | null;
  due_date: string | null;
  source: AssignmentSource;
  source_excerpt: string | null;
  status: AssignmentStatus;
  completed_at: string | null;
  created_at: string;
}

export interface TimetableEntry {
  id: string;
  student_id: string;
  weekday: number;
  start_time: string;
  end_time: string | null;
  subject_name: string;
  room: string | null;
}

export interface Checkin {
  id: string;
  student_id: string;
  checkin_date: string;
  mood: number | null;
  minutes_studied: number;
  learned: string | null;
  stuck_on: string | null;
  submitted_at: string;
}

export interface CheckinItem {
  id: string;
  checkin_id: string;
  assignment_id: string;
  status: ItemStatus;
  note: string | null;
}

export interface PointsEntry {
  id: string;
  student_id: string;
  delta: number;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
}

export interface Reward {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  kind: RewardKind;
  cost_points: number;
  cash_amount_egp: number | null;
  emoji: string;
  active: boolean;
}

export interface Redemption {
  id: string;
  student_id: string;
  reward_id: string;
  points_spent: number;
  status: RedemptionStatus;
  note: string | null;
  requested_at: string;
  decided_at: string | null;
}

export interface DailyReport {
  id: string;
  family_id: string;
  report_date: string;
  body: string;
  channel: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

export const KIND_LABEL: Record<AssignmentKind, string> = {
  homework: "Homework",
  quiz: "Quiz",
  exam: "Exam",
  project: "Project",
  event: "Event",
  note: "Note",
};

export const KIND_EMOJI: Record<AssignmentKind, string> = {
  homework: "📝",
  quiz: "⚡",
  exam: "🎯",
  project: "🧩",
  event: "📅",
  note: "📌",
};

export type LearningTrack = "school" | "act" | "sat";

export interface Topic {
  id: string;
  family_id: string | null;
  track: LearningTrack;
  grade: number | null;
  subject: string;
  unit: string | null;
  name: string;
  description: string | null;
  act_section: string | null;
  sort: number;
}

export interface Quiz {
  id: string;
  student_id: string;
  topic_id: string | null;
  track: LearningTrack;
  act_section: string | null;
  title: string;
  passage: string | null;
  difficulty: string;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  position: number;
  prompt: string;
  choices: string[];
  skill_tag: string | null;
}

export interface Attempt {
  id: string;
  student_id: string;
  quiz_id: string | null;
  kind: "quiz" | "review";
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total: number | null;
  seconds: number | null;
  tab_switches: number;
  flagged: boolean;
  flag_reason: string | null;
}
