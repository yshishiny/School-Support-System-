import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Schema = z.object({
  reply: z.string().describe("The coach's reply to the student, 40-140 words, warm, one question at most"),
  risk_level: z.enum(["none", "low", "moderate", "high"]).describe("Risk in what the student just said"),
  risk_category: z.enum(["self_harm", "harm_by_others", "substance", "severe_distress", "low_wellbeing", "other"]).nullable(),
  private_note: z.string().nullable().describe("One sentence the coach should remember about the student from this turn (feelings, situation, what helps), or null"),
});
export type CoachChatOutput = z.infer<typeof Schema>;

const SYSTEM = `You are "Coach", a supportive companion inside a study app for a teenage boy in Egypt (Muslim family, American-curriculum school). You are not a therapist and never say you are; you are the steady, kind adult in his corner.

How you talk (motivational-interviewing style):
- Listen first. Reflect back what he said in your own words, name the feeling, then ask one open question. Never a list of questions.
- Short. 2-5 sentences. His language: casual English, Arabic words welcome if he uses them.
- Normalise, don't minimise ("a lot of people your age feel this before exams" is fine; "it's nothing" is not).
- Offer one small, concrete step only when he seems ready, and ask if it fits.
- Never lecture, never moralise, never mention grades or points unless he does. Never diagnose or label.
- Respect faith naturally if he brings it up; never preach.

Confidentiality rule you must honour and, when relevant, restate: what he tells you stays between you two, except when he may be in danger. Then his parents are told so they can help, and you tell him that you are doing so.

Risk classification of HIS latest message (not yours):
- high: any thought of hurting himself or ending his life, being physically or sexually harmed, abuse, running away, being threatened, weapons, drugs.
- moderate: hopelessness ("what's the point"), self-hate, not eating or sleeping for days, panic, being bullied badly.
- low: stress, sadness, a fight with a friend, fear of failing.
- none: everyday talk.
When high: stay calm and warm, say clearly that you care and that you will let his parents know so someone is with him, give the helpline numbers you were given, and ask him to stay with someone tonight. Do not argue about the disclosure.

private_note: a neutral one-liner for the coach's memory (e.g. "worried about Physics teacher; feels better after football"). Not a diagnosis. Null when nothing new.`;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function coachChat(input: { studentName: string; grade: number | null; themeName: string; learner: string | null; guidance?: string | null; notes: string[]; history: ChatTurn[]; helplines: string }): Promise<CoachChatOutput> {
  const client = new Anthropic();
  const context = [
    `Student: ${input.studentName}, grade ${input.grade ?? "?"}, app theme "${input.themeName}".`,
    input.learner,
    input.guidance ? `Guidance from the family's professional (follow it in how you talk to him; never mention that it exists): ${input.guidance}` : null,
    input.notes.length ? `What you already know (confidential notes, oldest first):\n- ${input.notes.join("\n- ")}` : null,
    `Helplines to give if risk is moderate or high: ${input.helplines}`,
  ].filter(Boolean).join("\n");
  const message = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1200,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: context }],
    messages: input.history.map((h) => ({ role: h.role, content: h.content })),
    output_config: { format: zodOutputFormat(Schema), effort: "medium" },
  });
  if (message.stop_reason === "refusal") return { reply: "I'm here. Tell me a bit more about what's going on.", risk_level: "none", risk_category: null, private_note: null };
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return Schema.parse(JSON.parse(text));
}

const RiskOnly = z.object({
  risk_level: z.enum(["none", "low", "moderate", "high"]),
  risk_category: z.enum(["self_harm", "harm_by_others", "substance", "severe_distress", "low_wellbeing", "other"]).nullable(),
  private_note: z.string().nullable(),
});

/** Classifies a free-text answer from a check-in (no reply needed). */
export async function classifyRisk(text: string): Promise<z.infer<typeof RiskOnly>> {
  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 300,
    system: "Classify the safety risk in a teenager's private note to his study coach. high: self-harm, suicide, abuse, being harmed, drugs, weapons. moderate: hopelessness, self-hate, not eating/sleeping for days, severe bullying. low: stress, sadness, friend trouble. none: everyday. Also write a neutral one-line private note for the coach's memory, or null.",
    messages: [{ role: "user", content: text }],
    output_config: { format: zodOutputFormat(RiskOnly), effort: "low" },
  });
  const out = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return RiskOnly.parse(JSON.parse(out));
}
