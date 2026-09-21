import type { ReactNode } from "react";

export interface NeedItem { href: string; label: string; n: number; emoji: string }
export interface KidView {
  id: string;
  name: string;
  grade: number | null;
  color: string;
  emoji: string;
  avatarUrl: string | null;
  online: boolean;
  presenceLabel: string | null;
  checkedIn: boolean;
  checkinLate: boolean;
  checkinTime: string | null;
  prayers: { prayer: string; status: string | null }[];
  prayersOnTime: number;
  quizzesDone: number;
  quizzesTotal: number;
  allowance: { amount: number; score: number; allowance: number } | null;
  classLog: { done: number; due: number; missing: string | null };
  school: { off: boolean; reason: string | null; line: string };
  ticks: Record<string, boolean>;
  snapsToday: { code: string; label: string; emoji: string; state: "due" | "sent" | "good" | "approved" | "rejected" | "closed" | "none" }[];
  overdue: string[];
  tests: string[];
  balance: number;
  streak: number;
  integrityCount: number;
  needsCount: number; // things on this child that need the parent (overdue, missing classes, integrity)
  card: ReactNode; // the full card used inside the kid tab (option B) and the middle column (option A)
}

/** Something that happened, for the home page's feed. The parent's inbox, shown where he looks first. */
export interface HomeEvent {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  at: string;      // ISO
  unread: boolean;
}

export interface HomeData {
  today: string;
  dateLine: string;
  firstName: string;
  unread: number;
  needs: NeedItem[];
  alerts: ReactNode;
  live: ReactNode;
  kids: KidView[];
  reportLine: string;
  allowanceEnabled: boolean;
  kpiToday: { label: string; emoji: string; code: string }[]; // parent-judged basics for the strip
  events: HomeEvent[];
  timezone: string;
}
