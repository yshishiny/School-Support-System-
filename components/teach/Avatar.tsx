"use client";

import type { Character } from "@/lib/characters";
import { Teacher } from "./Teacher";

/** Head-and-shoulders view of a teacher for cards and headers; the full rig lives in Teacher.tsx. */
export function Avatar({ c, speaking, size = 160, mood = "neutral" }: { c: Character; speaking: boolean; size?: number; mood?: "neutral" | "happy" | "think" }) {
  return <Teacher c={c} crop="bust" size={size} mood={mood} viseme={speaking ? "open" : "rest"} gesture={speaking ? "explain" : "idle"} />;
}
