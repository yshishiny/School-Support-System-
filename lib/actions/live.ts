"use server";

import { requireParent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildActivity, presence, type ActivityEvent, type ActivityRows } from "@/lib/activity";

export interface LiveSnapshot {
  at: string;
  kids: { id: string; name: string; online: boolean; label: string }[];
  events: (ActivityEvent & { name: string })[];
}

/** What the kids are doing right now and what they did in the last 24 hours. Polled by the parent home. */
export async function liveFeedAction(): Promise<LiveSnapshot> {
  const { family } = await requireParent();
  const admin = createAdminClient();
  const { data: kids } = await admin.from("profiles").select("id, full_name, last_seen_at, last_path").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const ids = (kids ?? []).map((k) => k.id);
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const [{ data: attempts }, { data: checkins }, { data: prayers }, { data: snaps }, { data: lessons }, { data: logs }] = ids.length
    ? await Promise.all([
        admin.from("attempts").select("student_id, started_at, submitted_at, score, total, kind, quizzes(title, checkpoint_id)").in("student_id", ids).gte("started_at", since),
        admin.from("checkins").select("student_id, submitted_at, minutes_studied, entered_late").in("student_id", ids).gte("submitted_at", since),
        admin.from("prayer_logs").select("student_id, logged_at, prayer, status, entered_late").in("student_id", ids).gte("logged_at", since),
        admin.from("snaps").select("student_id, created_at, task_code, status, ai_verdict").in("student_id", ids).gte("created_at", since),
        admin.from("lesson_sessions").select("student_id, started_at, finished_at, understanding, lesson_scripts(title)").in("student_id", ids).gte("started_at", since),
        admin.from("lesson_logs").select("student_id, created_at, subject_name, note").in("student_id", ids).gte("created_at", since),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const nameOf = (id: string) => (kids ?? []).find((k) => k.id === id)?.full_name.split(" ")[0] ?? "?";
  const events = buildActivity({ attempts: (attempts ?? []) as unknown as ActivityRows["attempts"], checkins: (checkins ?? []) as ActivityRows["checkins"], prayers: (prayers ?? []) as ActivityRows["prayers"], snaps: (snaps ?? []) as ActivityRows["snaps"], lessons: (lessons ?? []) as unknown as ActivityRows["lessons"], logs: (logs ?? []) as ActivityRows["logs"] }).map((e) => ({ ...e, name: nameOf(e.studentId) }));
  return {
    at: new Date().toISOString(),
    kids: (kids ?? []).map((k) => ({ id: k.id, name: k.full_name.split(" ")[0], ...presence(k.last_seen_at, k.last_path) })),
    events,
  };
}
