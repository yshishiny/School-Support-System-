import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const QuestionSchema = z.object({
  prompt: z.string(),
  choices: z.array(z.string()).length(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string().describe("Why the right answer is right and why the tempting wrong ones are wrong, in 2-4 sentences a student can learn from"),
  skill_tag: z.string().describe("Short skill label, e.g. 'slope from two points'"),
});
const QuizSchema = z.object({
  title: z.string(),
  passage: z.string().nullable().describe("A shared passage or data description when the questions need one (ACT Reading/Science, literature); else null"),
  questions: z.array(QuestionSchema),
});
export type GeneratedQuiz = z.infer<typeof QuizSchema>;

export interface QuizSpec {
  track: "school" | "act" | "sat";
  grade: number | null;
  subject: string;
  unit: string | null;
  topic: string; // topic name, or "mixed" for an ACT section set
  actSection: string | null;
  difficulty: "easy" | "medium" | "hard";
  count: number;
  weakSkills: string[];
  avoidPrompts: string[]; // previously seen prompts, to reduce repeats
}

const SYSTEM = `You write practice questions for a student at an American-curriculum international school in Egypt. Output multiple-choice questions with exactly four choices and one correct answer.

Quality rules:
- Match the grade level and the specific topic. Questions test understanding, not trivia.
- Vary question types: direct computation, word problems, "which statement is true", error-spotting, apply-to-new-situation.
- Distractors must be plausible and come from real misconceptions.
- Randomise the position of the correct answer across questions.
- Explanations teach: show the method in short steps. Never mention letters like "option C"; restate the answer content instead.
- Use plain text and unicode math (x², √, ×, ÷, π, ≤). No LaTeX, no markdown tables.
- For ACT sets: mirror real ACT style and difficulty. ACT English questions present an underlined portion of a sentence and ask for the best version (choice A is often "NO CHANGE"). ACT Reading and Science need a passage in "passage" (Reading: 250-400 words; Science: describe an experiment with a small data table written as lines of text). ACT Math needs no passage.
- For Digital SAT sets: mirror the real test. Reading & Writing questions each come with their own short passage (25-150 words) placed at the start of the prompt, then the question. SAT Math mixes algebra, advanced math, data analysis and geometry; calculator is allowed.
- Never repeat a prompt that appears in the "avoid" list.`;

export async function generateQuiz(spec: QuizSpec): Promise<GeneratedQuiz> {
  const client = new Anthropic();
  const lines = [
    `Track: ${spec.track === "act" ? "ACT practice" : spec.track === "sat" ? "Digital SAT practice" : "School curriculum"}`,
    spec.grade ? `Grade: ${spec.grade}` : null,
    `Subject: ${spec.subject}`,
    spec.unit ? `Unit: ${spec.unit}` : null,
    `Topic: ${spec.topic}`,
    spec.actSection ? `Exam section: ${spec.actSection}` : null,
    `Difficulty: ${spec.difficulty}`,
    `Number of questions: ${spec.count}`,
    spec.weakSkills.length ? `Give extra weight to these weak skills: ${spec.weakSkills.join("; ")}` : null,
    spec.avoidPrompts.length ? `Avoid these prompts:\n- ${spec.avoidPrompts.slice(0, 40).join("\n- ")}` : null,
  ].filter(Boolean);

  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 32000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: lines.join("\n") }],
    output_config: { format: zodOutputFormat(QuizSchema) },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined to generate this quiz.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  const quiz = QuizSchema.parse(JSON.parse(text));
  if (quiz.questions.length === 0) throw new Error("No questions were generated.");
  return quiz;
}
