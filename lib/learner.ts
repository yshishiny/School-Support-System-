/**
 * "Get to know me": a short, friendly questionnaire about how the student likes to learn.
 * Not a clinical instrument; it only tunes the tone of the coach, lessons and quiz explanations.
 */
export interface LearnerQuestion {
  id: string;
  prompt: string;
  emoji: string;
  options: { value: string; label: string; emoji: string }[];
}

export const LEARNER_QUESTIONS: LearnerQuestion[] = [
  { id: "style", emoji: "🧠", prompt: "When something is hard, what helps you most?", options: [
    { value: "visual", label: "A picture, diagram or video", emoji: "🎨" },
    { value: "verbal", label: "Someone explaining it in words", emoji: "🗣️" },
    { value: "hands_on", label: "Trying examples myself", emoji: "🛠️" },
    { value: "steps", label: "Clear steps, one at a time", emoji: "🪜" },
  ] },
  { id: "motivation", emoji: "🔥", prompt: "What makes you want to keep going?", options: [
    { value: "competition", label: "Beating my score or my brother", emoji: "🏁" },
    { value: "rewards", label: "Points and prizes", emoji: "🎁" },
    { value: "praise", label: "Someone noticing I did well", emoji: "👏" },
    { value: "mastery", label: "Feeling I really get it", emoji: "💡" },
  ] },
  { id: "confidence", emoji: "💪", prompt: "Before a quiz, you usually feel…", options: [
    { value: "confident", label: "Ready, let's go", emoji: "😎" },
    { value: "ok", label: "Fine, a bit unsure", emoji: "🙂" },
    { value: "nervous", label: "Nervous I will mess up", emoji: "😬" },
    { value: "bored", label: "Bored, want it over", emoji: "🥱" },
  ] },
  { id: "mistakes", emoji: "❌", prompt: "When you get an answer wrong…", options: [
    { value: "curious", label: "I want to know why", emoji: "🔍" },
    { value: "annoyed", label: "I get annoyed and move on", emoji: "😤" },
    { value: "down", label: "I feel bad about myself", emoji: "😔" },
    { value: "shrug", label: "I don't really care", emoji: "🤷" },
  ] },
  { id: "pace", emoji: "⏱️", prompt: "How do you like to work?", options: [
    { value: "sprints", label: "Short bursts, 10 minutes", emoji: "⚡" },
    { value: "long", label: "One long focused session", emoji: "🏔️" },
    { value: "with_breaks", label: "Medium with breaks", emoji: "☕" },
  ] },
  { id: "praise", emoji: "🎉", prompt: "How should your coach talk to you?", options: [
    { value: "hype", label: "Hype me up like a captain", emoji: "📣" },
    { value: "calm", label: "Calm and straight to the point", emoji: "🧘" },
    { value: "funny", label: "Jokes and fun", emoji: "😂" },
    { value: "challenge", label: "Challenge me, no fluff", emoji: "🥊" },
  ] },
  { id: "time", emoji: "🕐", prompt: "When is your brain sharpest?", options: [
    { value: "after_school", label: "Right after school", emoji: "🎒" },
    { value: "evening", label: "In the evening", emoji: "🌆" },
    { value: "night", label: "Late at night", emoji: "🌙" },
    { value: "morning", label: "Early morning", emoji: "🌅" },
  ] },
  { id: "stress", emoji: "😮‍💨", prompt: "School stress right now is…", options: [
    { value: "low", label: "Low, all good", emoji: "😌" },
    { value: "medium", label: "Some subjects worry me", emoji: "😐" },
    { value: "high", label: "A lot, I feel behind", emoji: "😣" },
  ] },
  { id: "explain", emoji: "📖", prompt: "The best explanation is…", options: [
    { value: "short", label: "Short and simple", emoji: "✂️" },
    { value: "story", label: "A story or real example", emoji: "📚" },
    { value: "deep", label: "Full detail, tell me everything", emoji: "🔬" },
  ] },
  { id: "dream", emoji: "🌟", prompt: "In ten years you want to be…", options: [
    { value: "athlete", label: "A pro athlete or coach", emoji: "⚽" },
    { value: "engineer", label: "An engineer or builder", emoji: "⚙️" },
    { value: "doctor", label: "A doctor", emoji: "🩺" },
    { value: "tech", label: "In tech: coding, cyber, AI", emoji: "💻" },
    { value: "business", label: "Running my own business", emoji: "💼" },
    { value: "unsure", label: "Not sure yet", emoji: "🤔" },
  ] },
];

export type LearnerAnswers = Record<string, string>;

export interface LearnerProfile {
  answers: LearnerAnswers;
  completed_at: string;
}

function label(id: string, value: string | undefined): string | null {
  const q = LEARNER_QUESTIONS.find((x) => x.id === id);
  const o = q?.options.find((x) => x.value === value);
  return o ? o.label : null;
}

/** One paragraph for prompts: how this student learns and likes to be spoken to. */
export function learnerPromptLine(profile: LearnerProfile | null | undefined): string | null {
  if (!profile?.answers) return null;
  const a = profile.answers;
  const parts = [
    label("style", a.style) && `learns best with: ${label("style", a.style)}`,
    label("explain", a.explain) && `prefers explanations that are: ${label("explain", a.explain)}`,
    label("motivation", a.motivation) && `motivated by: ${label("motivation", a.motivation)}`,
    label("praise", a.praise) && `wants the coach to be: ${label("praise", a.praise)}`,
    label("confidence", a.confidence) && `before quizzes feels: ${label("confidence", a.confidence)}`,
    label("mistakes", a.mistakes) && `after a wrong answer: ${label("mistakes", a.mistakes)}`,
    label("stress", a.stress) && `school stress: ${label("stress", a.stress)}`,
    label("pace", a.pace) && `work rhythm: ${label("pace", a.pace)}`,
    label("dream", a.dream) && `dream: ${label("dream", a.dream)}`,
  ].filter(Boolean);
  return parts.length ? `Learner profile (self-reported): ${parts.join("; ")}.` : null;
}

/** Short tags shown on the Me page. */
export function learnerTags(profile: LearnerProfile | null | undefined): string[] {
  if (!profile?.answers) return [];
  return LEARNER_QUESTIONS.map((q) => {
    const o = q.options.find((x) => x.value === profile.answers[q.id]);
    return o ? `${o.emoji} ${o.label}` : null;
  }).filter((x): x is string => !!x);
}
