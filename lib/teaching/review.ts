import Anthropic from "@anthropic-ai/sdk";
import { modelFor } from "@/lib/ai/models";
import { report } from "@/lib/ops/fault";
import { checks, verdict, type CheckResult, type CurriculumTopic, type Verdict } from "./fluency";
import type { Level } from "@/lib/levels";

/**
 * Running the discernment pass on a finished lesson.
 *
 * Two kinds of check, and it matters which is which. Whether the lesson is in Arabic, whether it names its topic,
 * whether it contains a worked example — a machine can answer those, so a machine does, for nothing and instantly.
 * Whether a fact is invented or a grade 8 child could follow it needs judgement, so a second model is asked, and
 * asked to mark its *own side's* work strictly.
 *
 * The rule from `fluency.ts` holds throughout: a check with no result is a failed check. If the judge call throws,
 * times out or comes back unparseable, nothing is released. A lesson nobody read is a bad evening; a lesson with an
 * invented formula in it is a wrong exam answer months later.
 */

const ARABIC = /[؀-ۿ]/;

/** The checks a machine can settle on its own. */
function mechanical(topic: CurriculumTopic, lesson: string): CheckResult[] {
  const out: CheckResult[] = [];
  const body = lesson.trim();

  const arabic = ARABIC.test(body);
  out.push({
    id: "language",
    passed: topic.language === "ar" ? arabic : !arabic || body.replace(/[^؀-ۿ]/g, "").length < body.length * 0.1,
    note: topic.language === "ar" ? "expected Arabic script" : "expected Latin script",
  });

  // The topic's own name, or most of its words, should appear. A lesson that never says what it is about is a
  // lesson about the unit.
  const words = topic.name.split(/\s+/).filter((w) => w.length > 3);
  const present = words.filter((w) => body.includes(w)).length;
  out.push({
    id: "on_topic",
    passed: body.includes(topic.name) || (words.length > 0 && present / words.length >= 0.5),
    note: `${present}/${words.length} topic words present`,
  });

  // Every lesson is asked for worked examples with every step shown. A lesson with no numbered or bulleted
  // working in it did not do that, whatever it claims.
  out.push({
    id: "worked_example",
    passed: /^\s*(\d+[.)]|[-*])\s+\S/m.test(body) && body.length > 600,
    note: `${body.length} characters`,
  });

  return out;
}

const JUDGE = `You are checking a lesson written for a school child before the child is allowed to read it.

You will be given the lesson and a list of checks. Answer every check with true or false, strictly.

Mark a check false when you are unsure. A lesson held back costs a child one evening; a lesson with an invented
fact, a formula from the wrong year, or a step quietly skipped costs him an exam answer months later. You are not
being asked whether the lesson is good. You are being asked whether each specific statement is true of it.

Reply with JSON only: {"results":[{"id":"<check id>","passed":true|false,"note":"<ten words at most>"}]}`;

/** The checks that need judgement, asked of a second model. */
async function judged(topic: CurriculumTopic, level: Level, lesson: string, ids: string[]): Promise<CheckResult[]> {
  if (ids.length === 0) return [];
  const wanted = checks(topic, level).filter((c) => ids.includes(c.id));
  const client = new Anthropic();
  const message = await client.messages.create({
    model: modelFor("explain"),
    max_tokens: 1200,
    system: [{ type: "text", text: JUDGE, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        `Curriculum: ${topic.curriculumId}, grade ${topic.grade}${topic.stream ? `, ${topic.stream} stream` : ""}`,
        `Subject: ${topic.subject}${topic.unit ? ` · unit: ${topic.unit}` : ""}`,
        `Topic: ${topic.name}`,
        "",
        "Checks:",
        ...wanted.map((c) => `- ${c.id}: ${c.question}`),
        "",
        "Lesson:",
        lesson.slice(0, 24000),
      ].join("\n"),
    }],
  });
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as { results?: { id?: unknown; passed?: unknown; note?: unknown }[] };
  return (parsed.results ?? [])
    .filter((r) => typeof r.id === "string" && ids.includes(r.id))
    .map((r) => ({ id: r.id as string, passed: r.passed === true, note: typeof r.note === "string" ? r.note.slice(0, 120) : undefined }));
}

export interface Review extends Verdict {
  results: CheckResult[];
  /** What judged the judgement checks, or null when none were needed or the judge could not be reached. */
  model: string | null;
}

export async function reviewLesson(topic: CurriculumTopic, level: Level, lesson: string): Promise<Review> {
  const cs = checks(topic, level);
  const mech = mechanical(topic, lesson);
  const rest = cs.map((c) => c.id).filter((id) => !mech.some((m) => m.id === id));

  let ai: CheckResult[] = [];
  let model: string | null = null;
  try {
    ai = await judged(topic, level, lesson, rest);
    model = modelFor("explain");
  } catch (err) {
    // Deliberately not swallowed and deliberately not rethrown: the unanswered checks stay unanswered, which
    // `verdict` already treats as failure, so an unreachable judge holds the lesson rather than releasing it.
    await report("teaching.review", err, { meta: { topicId: topic.id, level, unanswered: rest } });
  }

  const results = [...mech, ...ai];
  return { ...verdict(cs, results), results, model };
}
