import type { QueueItem } from "@/lib/today-queue";
import type { PrayerRow } from "@/components/PrayerPill";
import type { WeekStatus } from "@/lib/allowance/week";
import type { Consequence, TimetableEntry } from "@/lib/types";

/** Everything the Today page knows, computed once and handed to whichever layout the child picked. */
export interface TodayData {
  firstName: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  balance: number;
  level: { level: number; into: number; span: number };
  streak: number;
  mascot: string;
  stickers: string[];
  tagline: string;
  queue: QueueItem[];
  totalToday: number;
  prayerRows: PrayerRow[];
  onTimeCount: number;
  allowance: WeekStatus | null;
  allowanceTone: "good" | "warn" | "bad" | null;
  quizzesDoneWeek: number;
  todayRows: TimetableEntry[];
  weekStrip: { label: string; done: number; total: number; isToday: boolean; past: boolean }[];
  coachLine: string | null;
  consequences: Consequence[];
  checkinDone: boolean;
  classesToday: number;
}

export type HomeLayout = "a" | "b" | "c";
