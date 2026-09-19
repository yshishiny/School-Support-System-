import { illustrateScene } from "@/lib/ai/illustrate";
import { findPhoto, type ScenePhoto } from "@/lib/photos";
import type { LessonScript } from "@/lib/ai/lesson-script";

export type StoredBeat = LessonScript["beats"][number] & { image?: ScenePhoto | null };

/**
 * After the writer: the illustrator redraws every scene from its brief, and a real photograph is found for every
 * beat that names one. All in parallel; a failure leaves the writer's own drawing or no photo.
 */
export async function enrichBeats(beats: LessonScript["beats"], o: { subject: string; topic: string; language: "en" | "ar" }): Promise<StoredBeat[]> {
  return Promise.all(beats.map(async (b): Promise<StoredBeat> => {
    const [drawn, image] = await Promise.all([
      b.show?.type === "scene" && b.show.brief ? illustrateScene({ subject: o.subject, topic: o.topic, language: o.language, say: b.say, brief: b.show.brief, existingCues: b.show.cues }) : Promise.resolve(null),
      b.photo ? findPhoto(b.photo) : Promise.resolve(null),
    ]);
    const show = b.show && drawn ? { ...b.show, content: drawn.svg, cues: drawn.cues.length ? drawn.cues : b.show.cues } : b.show;
    return { ...b, show, image };
  }));
}
