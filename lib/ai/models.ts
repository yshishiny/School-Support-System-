/**
 * One place that decides which Claude model each job runs on, by cost tier.
 * AI_TIER (Vercel env): "saver" (default) puts routine jobs on Haiku 4.5, "balanced" uses Sonnet for them,
 * "best" runs everything on Opus. Judgement-heavy jobs (coach report, clinician summary, confidential chat)
 * stay on Opus in every tier.
 */
export type AiJob = "lesson" | "lesson-qa" | "quiz" | "worksheet" | "explain" | "snap" | "lesson-guess" | "read-material" | "extract" | "risk" | "archive" | "coach-chat" | "coach-report" | "clinician";

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-5";
const OPUS = "claude-opus-5";

type Tier = "saver" | "balanced" | "best";

export function aiTier(): Tier {
  const t = (process.env.AI_TIER ?? "saver").toLowerCase();
  return t === "best" || t === "balanced" ? t : "saver";
}

const ROUTINE: AiJob[] = ["lesson-qa", "quiz", "worksheet", "explain", "snap", "lesson-guess", "read-material", "extract", "risk", "archive"];

export function modelFor(job: AiJob): string {
  // Lesson scripts are written once and reused: Sonnet in saver and balanced, Opus in best.
  if (job === "lesson") return aiTier() === "best" ? OPUS : SONNET;
  if (!ROUTINE.includes(job)) return OPUS;
  const tier = aiTier();
  if (tier === "best") return job === "risk" ? SONNET : OPUS;
  if (tier === "balanced") return job === "quiz" || job === "worksheet" || job === "explain" || job === "extract" || job === "archive" ? OPUS : SONNET;
  return HAIKU;
}

/**
 * Effort is an Opus/Sonnet 5 parameter; Haiku 4.5 rejects it. Spread the result into output_config.
 * Haiku runs without extended thinking, which is fine for these routine jobs.
 */
export function effortFor(job: AiJob, effort: "low" | "medium" | "high"): { effort?: "low" | "medium" | "high" } {
  return modelFor(job) === HAIKU ? {} : { effort };
}
