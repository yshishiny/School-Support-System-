import { characterById } from "@/lib/characters";
import { Stage } from "@/components/teach/Stage";
import { DEMO_AR, DEMO_EN } from "@/lib/teach/demo-script";

/** The sample lesson on the full stage, in demo mode (nothing is saved). */
export default async function DemoLessonPage({ searchParams }: { searchParams: Promise<{ c?: string; lang?: string }> }) {
  const { c, lang } = await searchParams;
  const character = characterById(c);
  const ar = lang === "ar";
  const script = ar ? DEMO_AR : DEMO_EN;
  return <Stage demo sessionId="demo" scriptId="demo" character={character} script={script} language={ar ? "ar" : "en"} startBeat={0} minutes={script.minutes} />;
}
