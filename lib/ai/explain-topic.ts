import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are a patient tutor writing a lesson for a teenage student at an American-curriculum school. Write in clear, friendly English. Markdown is allowed (headings, bold, bullet lists, numbered steps) but keep it light. Use unicode math (x², √, ×, π), never LaTeX.

Structure every lesson as:
1. **Why this matters** (2 sentences, concrete)
2. **The big idea** (the concept in plain words, with one analogy)
3. **Key rules / vocabulary** (short bullets)
4. **Worked examples** (2-3, each showing every step and the common mistake to avoid)
5. **Quick self-check** (3 questions with answers hidden below a "Answers" heading)
6. **Where to go deeper**: name the matching Khan Academy unit or a typical textbook chapter title, without inventing URLs.

Length: 500-900 words.`;

export interface ExplainSpec {
  grade: number | null;
  subject: string;
  unit: string | null;
  topic: string;
  track: "school" | "act" | "sat";
}

export async function explainTopic(spec: ExplainSpec): Promise<{ content: string; model: string }> {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          spec.track === "act" ? "This is an ACT prep skill; include the ACT question style and a timing tip." : spec.track === "sat" ? "This is a Digital SAT prep skill; include the SAT question style and a timing tip." : `Grade ${spec.grade ?? ""}`,
          `Subject: ${spec.subject}`,
          spec.unit ? `Unit: ${spec.unit}` : "",
          `Topic: ${spec.topic}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to write this lesson.");
  const content = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return { content, model: message.model };
}
