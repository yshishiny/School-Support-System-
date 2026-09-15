import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { CoachStats } from "@/lib/coach/analyze";
import { learnerPromptLine } from "@/lib/learner";

const Schema = z.object({
  headline: z.string().describe("One line for the parent's daily report, max 20 words, e.g. 'Omar: strong in Math, needs foundations in Arabic grammar'"),
  parent_md: z.string().describe("Markdown for the parent, 180-320 words: what the data shows per subject, what to do this week, concrete."),
  kid_md: z.string().describe("Markdown for the student, 60-120 words, warm hero-coach tone in the voice of their theme (club or career), 2-3 concrete next steps, no lecturing"),
  focus: z.array(z.object({ subject: z.string(), why: z.string(), foundation: z.array(z.string()).describe("2-4 foundation topics to rebuild, textbook names") })).describe("Subjects that need more practice, most urgent first, max 3"),
  accelerate: z.array(z.object({ subject: z.string(), plan: z.string() })).describe("Subjects where the student is clearly strong and should be pushed harder (max 2)"),
  levels: z.array(z.object({ subject: z.string(), level: z.enum(["easy", "medium", "hard"]) })).describe("Difficulty the next quizzes should use, one entry per curriculum subject"),
});
export type CoachOutput = z.infer<typeof Schema>;

const SYSTEM = `You are the study coach for a family in Egypt: two boys at an American-curriculum international school, also studying the Egyptian Ministry subjects in Arabic (Arabic, Religion, Social Studies). You get two weeks of data from their study app.

Judge like a good teacher, not a dashboard:
- A subject with no sets yet is "not measured", never "weak". Say so.
- Weak = under 60% across at least 2 sets, or the same topics missed repeatedly. Strong = 85%+ across 3+ sets or a rising trend above 80%.
- For each weak subject, name the foundation topics to rebuild (use the topic names given) and one concrete way to practise this week.
- For strong subjects, especially Math and English, say how to accelerate: harder sets, ACT/SAT style, next unit early.
- Arabic subjects matter as much as the English ones. If Religion has Quran or hadith work, remind the student that the app has a memorisation trainer (القرآن والحديث) and suggest what to memorise.
- Routine counts: check-in streak, class notes written, planned quizzes done vs skipped, prayers on time. Praise real effort specifically.
- Levels: "hard" only when strong as defined; "easy" when weak; else "medium". Subjects not measured stay "medium".
- The student's note is in their own words, cheerful and specific, in the voice of their theme (a Real Madrid fan gets a locker-room captain; a future cybersecurity engineer gets a mission briefing), never cheesy, never mentioning grades as threats. Use their first name. Write Arabic subject names in Arabic.
- If a learner profile is given, match it: the praise style they asked for, their preferred explanation length, and gentle handling when they say mistakes make them feel bad or stress is high (then lead with what went right and make the next step small).
- Numbers: quote percentages only where they help. Never invent data.`;

export async function runCoach(stats: CoachStats): Promise<CoachOutput & { model: string }> {
  const client = new Anthropic();
  const s = stats.student;
  const lines = [
    `Student: ${s.full_name}, grade ${s.grade}, theme "${stats.themeName}", interests: ${s.interests ?? "not given"}, favourite subjects: ${s.favourite_subjects?.join(", ") || "not given"}, target exam: ${s.target_exam ?? "none"}.`,
    `Period: ${stats.periodStart} to ${stats.today}. Check-ins ${stats.checkins}/14, streak ${stats.streak}, minutes studied at home ${stats.minutesStudied}, prayers on time ${stats.prayersOnTimeRate === null ? "not logged" : stats.prayersOnTimeRate + "%"}.`,
    `Subjects:`,
    ...stats.subjects.map(
      (x) =>
        `- ${x.subject} (${x.label}): ${x.sets} sets, avg ${x.pct === null ? "not measured" : x.pct + "%"}${x.trend ? `, trend ${x.trend}` : ""}; weakest topics: ${x.weakest.join("; ") || "none"}; strongest: ${x.strongest.join("; ") || "none"}; class notes written: ${x.notesLogged}; planned quizzes done ${x.plannedDone}/${x.planned}.`,
    ),
    stats.exam.sets ? `Exam prep (SAT/ACT): ${stats.exam.sets} sets, avg ${stats.exam.pct}%; sections: ${stats.exam.sections.map((x) => `${x.key} ${x.pct}%`).join(", ")}.` : "Exam prep: no sets yet.",
    learnerPromptLine(s.learner_profile),
    stats.stuckOn.length ? `Student said they were stuck on: ${stats.stuckOn.join(" | ")}` : null,
    stats.religionNotes.length ? `Religion class notes: ${stats.religionNotes.join(" | ")}` : null,
  ].filter(Boolean);
  const model = "claude-opus-5";
  const stream = client.messages.stream({
    model,
    max_tokens: 6000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: lines.join("\n") }],
    output_config: { format: zodOutputFormat(Schema), effort: "medium" },
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The coach declined to write this analysis.");
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  return { ...Schema.parse(JSON.parse(text)), model };
}
