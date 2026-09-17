import Anthropic from "@anthropic-ai/sdk";
import { effortFor, modelFor } from "./models";

const SYSTEM = `You write a one-page monthly revision sheet for a student at an American-curriculum school in Egypt, from the study digests of the school files shared that month for one subject. Markdown, light. Structure:
1. **This month in one look**: 5-8 bullets, the key ideas.
2. **Must know by heart**: definitions, formulas, dates, vocabulary, as a tight list (in the files' language; Arabic stays Arabic).
3. **Worked example** for each main idea (2-4), short.
4. **Traps**: the mistakes students make on exactly this material.
5. **Self-test**: 8 short questions with answers under an "Answers" heading.
Faithful to the digests only; no invention. 500-900 words. Unicode math, never LaTeX.`;

export async function writeRevisionSheet(spec: { subject: string; month: string; grade: number | null; language: "en" | "ar"; digests: { title: string; digest: string }[] }): Promise<{ content: string; model: string }> {
  const client = new Anthropic();
  const body = spec.digests.map((d) => `### ${d.title}\n${d.digest}`).join("\n\n").slice(0, 60_000);
  const res = await client.messages.create({
    model: modelFor("explain"),
    max_tokens: 6000,
    output_config: { ...effortFor("explain", "medium") },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Subject: ${spec.subject}\nMonth: ${spec.month}\nGrade: ${spec.grade ?? ""}\n${spec.language === "ar" ? "Write in Arabic." : ""}\n\nDigests:\n\n${body}` }],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined to write this sheet.");
  return { content: res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(""), model: res.model };
}
