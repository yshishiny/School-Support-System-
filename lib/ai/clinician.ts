import Anthropic from "@anthropic-ai/sdk";
import { modelFor } from "./models";

/**
 * Drafts an information summary for a child and adolescent mental-health professional from app data.
 * Structure follows the headings of a standard psychiatric assessment (AACAP practice parameter on the
 * psychiatric assessment of children and adolescents), but the content is limited to what the app can
 * actually observe: self-report screens, study behaviour, routine, and safety flags. It never diagnoses.
 */
const SYSTEM = `You write a concise, professional information summary for a child and adolescent psychiatrist or psychologist, prepared by a parent from a home study app. The reader is a clinician; write in clinical register, plain and specific, no marketing tone, no emojis.

Absolute rules:
- This is collateral information, not an assessment. State that in the first lines. Never assign a diagnosis, never use diagnostic labels as conclusions, never estimate severity beyond what a screening instrument's published cut-offs say.
- Distinguish clearly between (a) validated instruments with published cut-offs (WHO-5 Well-Being Index only), (b) non-validated app questionnaires (weekly pulse, mindset, habits, learner intake), (c) behavioural data logged by the app (quiz results, check-ins, class notes, prayer logging, streaks), and (d) AI-generated observations (coach notes, risk classifications), which must be labelled as machine-generated and unverified.
- Report numbers as given; do not invent, round, or extrapolate. Where data is absent, say "not available".
- If chat themes are provided, summarise themes only, neutrally, in third person; never quote the child verbatim. If chat themes are not provided, state that the child's private chat with the app's coach was excluded at the family's choice.
- Safety flags: list category, date and how they were handled by the app (parent notified, helplines shown). Do not speculate on intent.
- End with "Questions the family suggests exploring" derived from the parent's stated reason, and "Limitations of this summary".

Use exactly these headings, in order:
1. Purpose and provenance
2. Identifying information
3. Reason for referral (parent's words)
4. Screening instruments (table: instrument, dates, scores, published cut-off, band)
5. Mood, sleep, energy and pressure over time (weekly pulse, non-validated)
6. Academic functioning (subjects, trends, engagement)
7. Routine and health behaviours (sleep, activity, screen time, meals, prayer logging)
8. Safety flags and how the app responded
9. Strengths and protective factors
10. Machine-generated observations (coach notes; chat themes if included)
11. Questions the family suggests exploring
12. Limitations of this summary
References: WHO-5 (Topp CW et al., Psychother Psychosom 2015;84:167-176; cut-offs ≤50 poor wellbeing, ≤28 screening threshold for depression); AACAP Practice Parameters for the Psychiatric Assessment of Children and Adolescents (J Am Acad Child Adolesc Psychiatry 1997;36(10 Suppl):4S-20S).`;

export async function draftClinicianSummary(payload: string): Promise<{ content: string; model: string }> {
  const client = new Anthropic();
  const model = modelFor("clinician");
  const stream = client.messages.stream({
    model,
    max_tokens: 7000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: payload }],
    output_config: { effort: "high" },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to draft this summary.");
  const content = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return { content, model };
}
