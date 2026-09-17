import { describe, expect, it } from "vitest";
import { buildQuestion, compensatedRefs, pickFromSegments, pickIndex } from "./compensation";

const segs = [
  { ref: "103:1", text: "وَالْعَصْرِ", translation: null },
  { ref: "103:2", text: "إِنَّ الْإِنسَانَ لَفِي خُسْرٍ", translation: null },
  { ref: "103:3", text: "إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ", translation: null },
  { ref: "112:1", text: "قُلْ هُوَ اللَّهُ أَحَدٌ", translation: null },
  { ref: "112:2", text: "اللَّهُ الصَّمَدُ", translation: null },
  { ref: "1:1", text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", translation: null },
];

describe("compensation", () => {
  it("picks two consecutive ayahs deterministically", () => {
    const a = pickFromSegments(segs, "prayer:2026-09-15:isha");
    const b = pickFromSegments(segs, "prayer:2026-09-15:isha");
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    expect(Number(a[1].ref.split(":")[1])).toBe(Number(a[0].ref.split(":")[1]) + 1);
    expect(pickIndex("x", 0)).toBe(0);
  });
  it("asks to complete a long ayah with the right word among the choices", () => {
    const q = buildQuestion([segs[1], segs[2]], segs, "k1");
    expect(q.prompt).toMatch(/أكمل الآية/);
    expect(q.choices).toHaveLength(4);
    expect(q.choices[q.correct]).toBe("بِالصَّبْرِ");
    expect(new Set(q.choices).size).toBe(4);
  });
  it("falls back to 'which surah' for a short ayah", () => {
    const q = buildQuestion([segs[3], segs[4]], segs, "k2");
    expect(q.prompt).toMatch(/من أي سورة/);
    expect(q.choices[q.correct]).toBe("سورة الإخلاص");
  });
  it("counts only entries answered right", () => {
    expect([...compensatedRefs([{ ref: "a", correct: true }, { ref: "b", correct: false }, { ref: "c", correct: null }])]).toEqual(["a"]);
  });
});
