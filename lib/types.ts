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
  timezone: string;
  report_hour: number;
  latitude: number | null;
  longitude: number | null;
  allowance_enabled: boolean;
  allowance_amount: number;
  allowance_pay_weekday: number;
  allowance_kpis: { code: string; weight?: number; enabled?: boolean }[] | null;
  snap_ai_check?: boolean;
  practices_enabled: string[];
  custody_pattern: Record<string, string | null>; // weekday ("0".."6") -> parent id; empty = shared
}

export interface Consequence {
  id: string;
  student_id: string;
  family_id: string;
  code: string;
  label: string;
  reason: string | null;
  starts_on: string;
  ends_on: string;
  earn_back_task: string | null;
  student_claimed_at: string | null;
  earned_back_at: string | null;
  closed_at: string | null;
  created_at: string;
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
  theme: string;
  interests: string | null;
  favourite_subjects: string[];
  learner_profile: { answers: Record<string, string>; completed_at: string } | null;
  tour_seen_at: string | null;
  professional_guidance: string | null; // notes from a clinician or specialist, entered by the parent
  avatar_image_id: string | null;
  banner_image_id: string | null;
  home_layout: "a" | "b" | "c";
  banner_fit: "cover" | "full";
  banner_zoom: number;
  banner_x: number;
  banner_y: number;
  // parents only
  telegram_chat_id: string | null;
  whatsapp: string | null;
  parent_label: string | null; // "Dad", "Mum"…
  birth_date?: string | null;
  stage?: "school" | "university" | "postgraduate" | "adult";
  gender?: "boy" | "girl" | "other" | null;
  school_name?: string | null;
  phone?: string | null;
  parent_notes?: string | null;
  last_seen_at?: string | null;
  last_path?: string | null;
  live_pings?: boolean;
  rater?: boolean; // older sibling who may rate manners and dish
  target_reward_id?: string | null;
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
  entered_late?: boolean; // filled in on a later day
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
  requires_full_weeks?: number;
  effort_note?: string | null;
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
  language: "en" | "ar";
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
  scheduled_for: string | null; // set when the quiz belongs to the weekly plan
  plan_slot: "school" | "exam" | null;
  language: "en" | "ar";
  created_at: string;
  material_id?: string | null; // practice set written from a school file
  checkpoint_id?: string | null; // timed one-attempt verification test
  time_limit_min?: number | null;
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

export interface ChatArchive {
  id: string;
  family_id: string;
  student_id: string | null;
  label: string;
  storage_path: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  error: string | null;
  message_count: number;
  attachment_count: number;
  first_date: string | null;
  last_date: string | null;
  stats: Record<string, unknown> | null;
  insights_md: string | null;
  uploaded_at: string;
  processed_at: string | null;
}

export interface CoachReport {
  id: string;
  student_id: string;
  family_id: string;
  period_start: string;
  period_end: string;
  headline: string;
  parent_md: string;
  kid_md: string;
  data: {
    subjects: { subject: string; sets: number; pct: number | null; trend: "up" | "flat" | "down" | null; weakest: string[]; strongest: string[] }[];
    focus: { subject: string; why: string; foundation: string[] }[];
    accelerate: { subject: string; plan: string }[];
  };
  levels: Record<string, "easy" | "medium" | "hard">;
  created_at: string;
}

export interface MemorizeItem {
  id: string;
  student_id: string;
  kind: "quran" | "hadith";
  title: string;
  reference: string | null;
  text_ar: string;
  translation: string | null;
  segments: { ref: string; text: string; translation?: string | null }[];
  best_score: number | null;
  sessions: number;
  last_practised: string | null;
  created_at: string;
}

export interface AccessLog {
  id: string;
  user_id: string;
  event: "login" | "visit";
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  device_type: string | null;
  device_os: string | null;
  device_browser: string | null;
  user_agent: string | null;
  path: string | null;
  created_at: string;
}
