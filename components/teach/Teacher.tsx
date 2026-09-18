"use client";

import type { CSSProperties } from "react";
import type { Character } from "@/lib/characters";
import type { Gesture, Mood, Viseme } from "@/lib/teach/performance";

/**
 * The animated teacher: an original full-body cartoon rig drawn in SVG. Joints are groups rotated by CSS
 * variables (shoulders, elbows, head, lean) so a pose change tweens; idle breathing, blinking and sway run as
 * keyframes; the mouth takes a viseme from the speech hook; wave, write and celebrate add their own motion.
 */
export interface TeacherProps {
  c: Character;
  gesture?: Gesture;
  mood?: Mood;
  viseme?: Viseme;
  /** Where the eyes look, in px offsets of the pupils. Overrides the gesture's default. */
  look?: { x: number; y: number };
  walking?: boolean;
  /** "full" is the whole body; "bust" crops to head and shoulders for cards. */
  crop?: "full" | "bust";
  size?: number;
  className?: string;
  /** Mirror the rig so the teacher faces left. */
  flip?: boolean;
}

interface Pose { sl: number; el: number; sr: number; er: number; head: number; lean: number; look: [number, number] }

const POSES: Record<Gesture, Pose> = {
  idle: { sl: 6, el: -8, sr: -6, er: 8, head: 0, lean: 0, look: [0, 0] },
  wave: { sl: 6, el: -8, sr: -160, er: -10, head: -4, lean: 0, look: [0, 0] },
  explain: { sl: 40, el: 60, sr: -40, er: -60, head: 2, lean: 0, look: [0, 1] },
  point: { sl: 6, el: -8, sr: -120, er: -15, head: -6, lean: -2, look: [4, -4] },
  write: { sl: 6, el: -8, sr: -100, er: -40, head: -8, lean: -3, look: [5, -4] },
  think: { sl: 8, el: -10, sr: 58, er: 134, head: 6, lean: 0, look: [3, -5] },
  celebrate: { sl: 165, el: -10, sr: -165, er: 10, head: -3, lean: 0, look: [0, -2] },
  listen: { sl: 6, el: -8, sr: -128, er: -91, head: 8, lean: 2, look: [-2, 1] },
  oops: { sl: 75, el: 110, sr: -75, er: -110, head: 10, lean: 0, look: [0, 2] },
  bow: { sl: 6, el: -8, sr: -6, er: 8, head: 10, lean: 14, look: [0, 4] },
};

const INK = "#2b1d2e";

function Mouth({ viseme, mood }: { viseme: Viseme; mood: Mood }) {
  const dark = "#6b2a3a";
  if (viseme === "open") return <g><ellipse cx="100" cy="112" rx="8" ry="8.5" fill={dark} stroke={INK} strokeWidth="1.5" /><ellipse cx="100" cy="117" rx="5" ry="3" fill="#e0607a" /><rect x="93" y="105" width="14" height="3.5" rx="1.5" fill="#fff" /></g>;
  if (viseme === "wide") return <g><ellipse cx="100" cy="111" rx="13" ry="5.5" fill={dark} stroke={INK} strokeWidth="1.5" /><rect x="90" y="106.5" width="20" height="3" rx="1.5" fill="#fff" /></g>;
  if (viseme === "round") return <ellipse cx="100" cy="112" rx="5.5" ry="6.5" fill={dark} stroke={INK} strokeWidth="1.5" />;
  if (viseme === "small") return <ellipse cx="100" cy="111" rx="5" ry="3.5" fill={dark} stroke={INK} strokeWidth="1.5" />;
  if (viseme === "closed") return <path d="M 90 111 Q 100 113 110 111" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />;
  if (mood === "sad") return <path d="M 88 115 Q 100 105 112 115" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />;
  if (mood === "happy" || mood === "encourage") return <g><path d="M 84 106 Q 100 124 116 106 Z" fill={dark} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" /><path d="M 87 107 Q 100 112 113 107 L 113 109 Q 100 114 87 109 Z" fill="#fff" /></g>;
  if (mood === "surprised") return <ellipse cx="100" cy="112" rx="5" ry="6" fill={dark} stroke={INK} strokeWidth="1.5" />;
  return <path d="M 88 108 Q 100 116 112 108" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />;
}

function Brows({ mood }: { mood: Mood }) {
  const p = mood === "think" ? ["M 70 72 Q 82 70 93 71", "M 107 65 Q 118 56 130 63"]
    : mood === "surprised" ? ["M 70 63 Q 82 54 93 61", "M 107 61 Q 118 54 130 63"]
    : mood === "sad" ? ["M 70 72 Q 82 70 93 65", "M 107 65 Q 118 70 130 72"]
    : mood === "happy" || mood === "encourage" ? ["M 70 67 Q 82 59 93 66", "M 107 66 Q 118 59 130 67"]
    : ["M 70 70 Q 82 64 93 69", "M 107 69 Q 118 64 130 70"];
  return <g className="t-joint">{p.map((d, i) => <path key={i} d={d} stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" />)}</g>;
}

function Hair({ c, layer }: { c: Character; layer: "back" | "front" }) {
  const h = c.colors.hair;
  const s = c.rig.hair;
  if (layer === "back") {
    if (s === "long") return <path d="M 54 72 Q 46 150 60 178 L 140 178 Q 154 150 146 72 Q 100 14 54 72 Z" fill={h} stroke={INK} strokeWidth="1.5" />;
    return null;
  }
  if (s === "curly") return <g fill={h} stroke={INK} strokeWidth="1.5">{[[60, 66], [70, 50], [84, 40], [100, 36], [116, 40], [130, 50], [140, 66], [76, 60], [100, 52], [124, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i < 7 ? 12 : 11} />)}</g>;
  if (s === "grey") return <path d="M 60 74 Q 68 44 100 42 Q 132 44 140 74 Q 122 62 100 64 Q 78 62 60 74 Z" fill={h} stroke={INK} strokeWidth="1.5" />;
  if (s === "long") return <path d="M 56 80 Q 56 30 100 30 Q 144 30 144 80 Q 132 56 108 58 Q 96 50 84 62 Q 66 62 56 80 Z" fill={h} stroke={INK} strokeWidth="1.5" />;
  return <path d="M 56 78 Q 56 30 100 30 Q 144 30 144 78 Q 130 58 100 60 Q 82 46 70 62 Q 62 66 56 78 Z" fill={h} stroke={INK} strokeWidth="1.5" />;
}

function Hat({ c }: { c: Character }) {
  if (c.hat === "cap") {
    const fill = c.colors.accent === "#ffffff" ? c.colors.top : c.colors.accent;
    return <g><path d="M 54 66 Q 100 14 146 66 Z" fill={fill} stroke={INK} strokeWidth="1.5" /><path d="M 100 64 L 166 68 Q 166 78 100 76 Z" fill={fill} stroke={INK} strokeWidth="1.5" /><rect x="50" y="62" width="100" height="9" rx="4.5" fill={c.colors.hair} stroke={INK} strokeWidth="1.2" /></g>;
  }
  if (c.hat === "scarf") return <g><path d="M 50 74 Q 100 8 150 74 L 150 98 Q 100 66 50 98 Z" fill={c.colors.accent} stroke={INK} strokeWidth="1.5" /><path d="M 146 84 Q 172 96 164 130 Q 156 104 140 96 Z" fill={c.colors.accent} stroke={INK} strokeWidth="1.5" /><path d="M 56 84 Q 100 60 144 84" stroke={INK} strokeWidth="1" fill="none" opacity=".35" /></g>;
  return null;
}

function Outfit({ c }: { c: Character }) {
  const o = c.rig.outfit;
  const top = c.colors.top;
  if (o === "galabeya") {
    return <g><path d="M 55 144 Q 100 132 145 144 L 158 300 L 42 300 Z" fill={top} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" /><path d="M 86 146 Q 100 168 114 146" fill="none" stroke={c.colors.accent} strokeWidth="3" /><path d="M 100 168 L 100 210" stroke={c.colors.accent} strokeWidth="2" opacity=".7" /></g>;
  }
  if (o === "labcoat") {
    return <g><path d="M 55 144 Q 100 132 145 144 L 140 218 L 60 218 Z" fill="#f7f7fb" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" /><path d="M 86 143 L 100 176 L 114 143 Z" fill={c.colors.accent} /><path d="M 86 143 L 92 200 M 114 143 L 108 200" stroke="#c9c9d6" strokeWidth="1.5" fill="none" /><rect x="66" y="184" width="16" height="14" rx="2" fill="none" stroke="#c9c9d6" strokeWidth="1.2" /></g>;
  }
  if (o === "tracksuit") {
    return <g><path d="M 55 144 Q 100 132 145 144 L 140 218 L 60 218 Z" fill={top} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" /><path d="M 64 150 L 66 216 M 136 150 L 134 216" stroke="#ffffff" strokeWidth="3" opacity=".9" /><path d="M 100 150 L 100 216" stroke="#0f4f4a" strokeWidth="1.5" /><path d="M 82 146 Q 100 200 118 146" fill="none" stroke="#0f4f4a" strokeWidth="2" /><g><rect x="94" y="192" width="12" height="7" rx="2" fill="#ffd166" stroke={INK} strokeWidth="1" /><circle cx="108" cy="195" r="4" fill="#ffd166" stroke={INK} strokeWidth="1" /></g></g>;
  }
  return <g><path d="M 55 144 Q 100 132 145 144 L 140 218 L 60 218 Z" fill={top} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" /><ellipse cx="100" cy="146" rx="22" ry="7" fill="#dfe6f5" stroke={INK} strokeWidth="1.2" /><circle cx="76" cy="170" r="6" fill={c.colors.accent} stroke={INK} strokeWidth="1" /><rect x="60" y="204" width="80" height="8" rx="4" fill="#23324f" /><rect x="94" y="203" width="12" height="10" rx="2" fill={c.colors.accent} /></g>;
}

function Prop({ c, hand }: { c: Character; hand: "left" | "right" }) {
  const p = c.rig.prop;
  if (hand === "right" && p === "pointer") return <g><line x1="140" y1="238" x2="140" y2="296" stroke="#5a3a1e" strokeWidth="4" strokeLinecap="round" /><circle cx="140" cy="296" r="4" fill={c.colors.accent} stroke={INK} strokeWidth="1" /></g>;
  if (hand === "right" && p === "flask") return <g><path d="M 134 246 L 134 256 L 126 274 Q 125 278 129 278 L 151 278 Q 155 278 154 274 L 146 256 L 146 246 Z" fill="#e6f3ff" stroke={INK} strokeWidth="1.4" /><path d="M 129 268 L 151 268 L 154 274 Q 155 278 151 278 L 129 278 Q 125 278 126 274 Z" fill={c.colors.accent} opacity=".85" /></g>;
  if (hand === "left" && p === "book") return <g><rect x="44" y="238" width="30" height="22" rx="2" fill={c.colors.accent} stroke={INK} strokeWidth="1.4" /><line x1="59" y1="238" x2="59" y2="260" stroke={INK} strokeWidth="1" /><path d="M 48 244 L 56 244 M 48 250 L 56 250 M 62 244 L 70 244" stroke={INK} strokeWidth="1" opacity=".5" /></g>;
  return null;
}

function Arm({ c, side, prop }: { c: Character; side: "left" | "right"; prop: boolean }) {
  const x = side === "left" ? 60 : 140;
  const s = side === "left" ? "var(--sl)" : "var(--sr)";
  const e = side === "left" ? "var(--el)" : "var(--er)";
  const sleeve = c.rig.outfit === "labcoat" ? "#f7f7fb" : c.colors.top;
  return (
    <g className="t-joint" style={{ transformOrigin: `${x}px 150px`, transform: `rotate(${s})` }}>
      <g className={`t-arm-swing t-arm-${side}`} style={{ transformOrigin: `${x}px 150px` }}>
        <rect x={x - 9} y="142" width="18" height="56" rx="9" fill={sleeve} stroke={INK} strokeWidth="1.6" />
        <g className="t-joint" style={{ transformOrigin: `${x}px 195px`, transform: `rotate(${e})` }}>
          <g className={`t-fore t-fore-${side}`} style={{ transformOrigin: `${x}px 195px` }}>
            <rect x={x - 8} y="190" width="16" height="46" rx="8" fill={sleeve} stroke={INK} strokeWidth="1.6" />
            <circle cx={x} cy="240" r="11" fill={c.colors.skin} stroke={INK} strokeWidth="1.6" />
            {prop && <Prop c={c} hand={side} />}
          </g>
        </g>
      </g>
    </g>
  );
}

export function Teacher({ c, gesture = "idle", mood = "neutral", viseme = "rest", look, walking = false, crop = "full", size = 240, className = "", flip = false }: TeacherProps) {
  const p = POSES[gesture];
  const lx = look ? look.x : p.look[0];
  const ly = look ? look.y : p.look[1];
  const vars = { "--sl": `${p.sl}deg`, "--el": `${p.el}deg`, "--sr": `${p.sr}deg`, "--er": `${p.er}deg`, "--head": `${p.head}deg`, "--lean": `${p.lean}deg`, "--lx": `${lx}px`, "--ly": `${ly}px` } as CSSProperties;
  const eyeScale = mood === "surprised" ? 1.15 : mood === "happy" || mood === "encourage" ? 0.9 : 1;
  const viewBox = crop === "bust" ? "20 18 160 150" : "-30 0 260 340";
  const ratio = crop === "bust" ? 150 / 160 : 340 / 260;
  const propRight = c.rig.prop === "pointer" || c.rig.prop === "flask";
  const propLeft = c.rig.prop === "book";
  return (
    <svg viewBox={viewBox} width={size} height={Math.round(size * ratio)} className={`t-rig ${walking ? "t-walking" : ""} t-g-${gesture} ${className}`} style={{ ...vars, overflow: crop === "bust" ? "hidden" : "visible", transform: flip ? "scaleX(-1)" : undefined }} aria-hidden>
      {crop === "full" && <ellipse cx="100" cy="326" rx="52" ry="9" fill="rgba(0,0,0,.28)" className="t-shadow" />}
      <g className="t-sway" style={{ transformOrigin: "100px 326px" }}>
        {crop === "full" && (
          <g className="t-legs">
            <g className="t-leg t-leg-l" style={{ transformOrigin: "87px 215px" }}><rect x="76" y="212" width="22" height="92" rx="9" fill={c.rig.trousers} stroke={INK} strokeWidth="1.6" /><ellipse cx="86" cy="308" rx="16" ry="7" fill="#2b2233" stroke={INK} strokeWidth="1.4" /></g>
            <g className="t-leg t-leg-r" style={{ transformOrigin: "113px 215px" }}><rect x="102" y="212" width="22" height="92" rx="9" fill={c.rig.trousers} stroke={INK} strokeWidth="1.6" /><ellipse cx="114" cy="308" rx="16" ry="7" fill="#2b2233" stroke={INK} strokeWidth="1.4" /></g>
          </g>
        )}
        <g className="t-joint" style={{ transformOrigin: "100px 215px", transform: "rotate(var(--lean))" }}>
          <g className="t-breathe" style={{ transformOrigin: "100px 215px" }}>
            <Outfit c={c} />
            <rect x="91" y="120" width="18" height="24" rx="6" fill={c.colors.skin} stroke={INK} strokeWidth="1.4" />
            <g className="t-joint t-head" style={{ transformOrigin: "100px 132px", transform: "rotate(var(--head))" }}>
              <Hair c={c} layer="back" />
              <circle cx="58" cy="88" r="8" fill={c.colors.skin} stroke={INK} strokeWidth="1.5" />
              <circle cx="142" cy="88" r="8" fill={c.colors.skin} stroke={INK} strokeWidth="1.5" />
              <ellipse cx="100" cy="82" rx="43" ry="47" fill={c.colors.skin} stroke={INK} strokeWidth="1.8" />
              {c.rig.beard && <path d="M 62 92 Q 66 138 100 140 Q 134 138 138 92 Q 130 118 100 122 Q 70 118 62 92 Z" fill={c.colors.hair} stroke={INK} strokeWidth="1.4" />}
              <g className="t-blink" style={{ transformOrigin: "100px 86px", transform: `scale(${eyeScale})` }}>
                <ellipse cx="82" cy="86" rx="10.5" ry="12.5" fill="#fff" stroke={INK} strokeWidth="1.8" />
                <ellipse cx="118" cy="86" rx="10.5" ry="12.5" fill="#fff" stroke={INK} strokeWidth="1.8" />
                <g className="t-joint" style={{ transform: "translate(var(--lx), var(--ly))" }}>
                  <circle cx="83" cy="87" r="6.5" fill={c.rig.eyes} />
                  <circle cx="119" cy="87" r="6.5" fill={c.rig.eyes} />
                  <circle cx="83" cy="87" r="3.4" fill={INK} />
                  <circle cx="119" cy="87" r="3.4" fill={INK} />
                  <circle cx="80.5" cy="83.5" r="2.2" fill="#fff" />
                  <circle cx="116.5" cy="83.5" r="2.2" fill="#fff" />
                </g>
              </g>
              <Brows mood={mood} />
              <path d="M 100 96 Q 96 102 101 104" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <circle cx="70" cy="102" r="6.5" fill="#ff7a90" opacity=".38" />
              <circle cx="130" cy="102" r="6.5" fill="#ff7a90" opacity=".38" />
              <Mouth viseme={viseme} mood={mood} />
              {c.rig.glasses && <g fill="none" stroke={INK} strokeWidth="2.2"><circle cx="82" cy="87" r="14" /><circle cx="118" cy="87" r="14" /><path d="M 96 86 Q 100 82 104 86" /><path d="M 68 84 L 58 82 M 132 84 L 142 82" /></g>}
              <Hair c={c} layer="front" />
              <Hat c={c} />
            </g>
            <Arm c={c} side="left" prop={propLeft} />
            <Arm c={c} side="right" prop={propRight} />
          </g>
        </g>
      </g>
    </svg>
  );
}
