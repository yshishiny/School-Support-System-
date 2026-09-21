import Link from "next/link";
import { SideTabs } from "@/components/SideTabs";
import { kidColor } from "@/lib/kid-tabs";
import { requireParent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPlan, type PlanOverview } from "@/lib/plan/prepare";
import { prettyDate } from "@/lib/dates";
import { EXAM_SECTIONS } from "@/lib/exams";
import { subjectEmoji, subjectLabel } from "@/lib/plan";
import { PreparePlanButton } from "@/components/PreparePlanButton";
import type { Profile } from "@/lib/types";

export const maxDuration = 300;

export default async function PlanPage() {
  const { family } = await requireParent();
  const supabase = await createClient();
  const { data: kids } = await supabase.from("profiles").select("*").eq("family_id", family.id).eq("role", "student").order("grade", { ascending: false });
  const students = (kids ?? []) as Profile[];
  const plans = await Promise.all(students.map((s) => loadPlan(s.id)));

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Weekly quiz plan</h1>
        <Link href="/parent/trace" className="btn-ghost btn-sm">Money and proof</Link>
      </div>
      <p className="text-sm muted">
        One school quiz per school day, chosen from that day&apos;s timetable and the topics each child is weakest in, plus a daily SAT/ACT set in high school.
        Quizzes are written ahead of time so the kids never wait. The plan also tops itself up every night.
      </p>
      <SideTabs storageKey="plan-kids" tabs={plans.map((plan, idx) => ({ id: plan.profile.id, label: plan.profile.full_name.split(" ")[0], emoji: plan.profile.avatar_emoji, color: kidColor(idx), sub: `${plan.missing.length ? `${plan.missing.length} to prepare` : "ready"}`, content: <StudentPlan plan={plan} /> }))} />
      {students.length === 0 && <p className="card muted">Add your kids first.</p>}
    </main>
  );
}

function StudentPlan({ plan }: { plan: PlanOverview }) {
  const { profile, wanted, missing, quizzes, today } = plan;
  const days = [...new Set(wanted.map((w) => w.date))];
  const ready = quizzes.filter((q) => q.scheduled_for >= today).length;
  const doneCount = quizzes.filter((q) => q.scheduled_for >= today && q.attempts.some((a) => a.submitted_at)).length;
  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-3xl">{profile.avatar_emoji}</div>
        <div className="flex-1">
          <div className="font-bold">{profile.full_name} <span className="muted font-normal text-sm">· Grade {profile.grade}</span></div>
          <div className="text-xs muted">{ready} of {wanted.length} quizzes ready for the next 7 days · {doneCount} done</div>
        </div>
        <PreparePlanButton studentId={profile.id} missing={missing.length} />
      </div>
      {days.length === 0 && <p className="text-sm muted">No school days found in the timetable. Add the timetable under Kids first.</p>}
      <ul className="divide-y divide-line">
        {days.map((date) => (
          <li key={date} className="py-2">
            <div className={`text-sm font-semibold ${date === today ? "text-accent-2" : ""}`}>{date === today ? "Today" : prettyDate(date)}</div>
            <ul className="mt-1 space-y-1 text-sm">
              {wanted
                .filter((w) => w.date === date)
                .map((w) => {
                  const q = quizzes.find((x) => x.scheduled_for === date && x.plan_slot === w.slot);
                  const attempt = q?.attempts.find((a) => a.submitted_at);
                  const label = w.slot === "school" ? `${subjectLabel(w.subject)}: ${w.topicName ?? "topic"}` : `${EXAM_SECTIONS[w.subject]?.exam ?? ""} ${EXAM_SECTIONS[w.subject]?.label ?? w.subject}`;
                  return (
                    <li key={w.slot} className="flex items-center justify-between gap-2">
                      <span className="truncate">{w.slot === "exam" ? "🎓" : subjectEmoji(w.subject)} {q?.title ?? label}</span>
                      <span className={`badge shrink-0 ${attempt ? "text-good" : q ? "" : "text-warn"}`}>
                        {attempt ? `✓ ${attempt.score}/${attempt.total}` : q ? "ready" : "not prepared"}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
