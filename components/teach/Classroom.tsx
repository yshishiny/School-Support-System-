"use client";

import type { Scene } from "@/lib/characters";
import type { Camera } from "@/lib/teach/performance";

const SCENES: Record<Scene, { wall: string; floor: string; window: string; stickers: string[]; glow: string }> = {
  space: { wall: "linear-gradient(180deg,#0e1a3a 0%,#1a2a55 100%)", floor: "linear-gradient(180deg,#2c3650,#1b2236)", window: "radial-gradient(circle at 60% 40%, #ffd166 0 14%, #3a86ff 15% 30%, #0b1020 31%)", stickers: ["🪐", "🚀", "⭐", "🛰️"], glow: "#3a86ff" },
  pitch: { wall: "linear-gradient(180deg,#bfe8ff 0%,#dff4ff 100%)", floor: "repeating-linear-gradient(90deg,#3ea55c 0 40px,#46b566 40px 80px)", window: "linear-gradient(180deg,#8fd3ff 0 45%,#4caf50 45%)", stickers: ["⚽", "🏆", "🥅", "🏅"], glow: "#2ec4b6" },
  lab: { wall: "linear-gradient(180deg,#e9f7f1 0%,#d6efe6 100%)", floor: "repeating-linear-gradient(45deg,#cfd8dc 0 22px,#eceff1 22px 44px)", window: "linear-gradient(180deg,#bde0fe 0 60%,#a2d2ff 60%)", stickers: ["🧪", "🔬", "🧬", "⚗️"], glow: "#8338ec" },
  cairo: { wall: "linear-gradient(180deg,#f5e6c8 0%,#ecd3a3 100%)", floor: "repeating-linear-gradient(90deg,#8d5524 0 26px,#a86a33 26px 52px)", window: "linear-gradient(180deg,#ffb703 0 30%,#fb8500 30% 60%,#e76f51 60%)", stickers: ["🏮", "📜", "🕌", "🐪"], glow: "#e9c46a" },
};

/**
 * The room: a wall, a window with the character's world in it, a floor, and a camera that eases between
 * wide, board and teacher framings. Children are the board and the teacher, laid out for portrait or landscape.
 */
export function Classroom({ scene, camera, children, overlay }: { scene: Scene; camera: Camera; children: React.ReactNode; overlay?: React.ReactNode }) {
  const s = SCENES[scene];
  return (
    <div className="stage-root fixed inset-0 z-50 overflow-hidden text-ink" style={{ background: s.wall, ["--stage-glow" as string]: s.glow }}>
      <div className="absolute inset-x-0 bottom-0 h-[22%] opacity-90" style={{ background: s.floor }} />
      <div className="absolute inset-x-0 bottom-[22%] h-px bg-black/20" />
      <div className="absolute right-[4%] top-[50%] h-[13%] w-[24%] rounded-xl border-4 border-[#5b4632] shadow-lg overflow-hidden landscape:hidden" style={{ background: s.window }}>
        <div className="absolute inset-y-0 left-1/2 w-1 bg-[#5b4632]" /><div className="absolute inset-x-0 top-1/2 h-1 bg-[#5b4632]" />
      </div>
      <div className="absolute left-[4%] top-[50%] flex flex-col gap-2 text-2xl landscape:flex-row landscape:left-auto landscape:right-[20%] landscape:top-[3.5%]" aria-hidden>
        {s.stickers.map((e, i) => <span key={e} className="sticker" style={{ animationDelay: `${i * 0.7}s` }}>{e}</span>)}
      </div>
      <div className={`stage-camera absolute inset-0 cam-${camera}`}>{children}</div>
      {overlay}
    </div>
  );
}
