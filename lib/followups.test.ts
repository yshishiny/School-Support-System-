import { describe, expect, it } from "vitest";
import { followupQuestion, roundsToOpen, signalDetail, validAnswer, type FollowupRow } from "./followups";

const sig = { code: "retro_on_time", label: "3 prayers marked on time after the fact this week", ask: "Ask where he prayed Isha on 2026-09-16 and with whom." };
const noClass = { code: "no_class_overuse", label: "“No class” marked 10 times this week", ask: "Ask which classes really did not happen this week (Physics, Biology, Arabic) and what he did in that time." };

describe("followups", () => {
  it("pulls the dates and subjects into the child's question and phrases each round differently", () => {
    expect(signalDetail(sig)).toBe("2026-09-16");
    expect(signalDetail(noClass)).toBe("Physics, Biology, Arabic");
    const q1 = followupQuestion(sig, 1, null);
    const q2 = followupQuestion(sig, 2, null);
    const q3 = followupQuestion(sig, 3, "I prayed at home with my brother");
    expect(q1).toContain("2026-09-16");
    expect(q1).not.toBe(q2);
    expect(q3).toContain("I prayed at home with my brother");
  });
  it("opens round 1 for a new signal, the next round only after an answer on an earlier day, and stops at 3", () => {
    const wk = "2026-09-13";
    expect(roundsToOpen([sig], [], "2026-09-17", wk)).toEqual([{ sig, round: 1, prev: null }]);
    const r1: FollowupRow = { id: "1", signal_key: `retro_on_time:${wk}`, signal_code: sig.code, signal_label: sig.label, round: 1, question: "q", asked_on: "2026-09-16", answer: null, answered_at: null };
    expect(roundsToOpen([sig], [r1], "2026-09-17", wk)).toEqual([]);
    const r1a = { ...r1, answer: "at home with dad after dinner", answered_at: "2026-09-16T20:00:00Z" };
    expect(roundsToOpen([sig], [r1a], "2026-09-17", wk)).toEqual([{ sig, round: 2, prev: r1a.answer }]);
    expect(roundsToOpen([sig], [{ ...r1a, answered_at: "2026-09-17T08:00:00Z" }], "2026-09-17", wk)).toEqual([]);
    const r3 = { ...r1a, round: 3, asked_on: "2026-09-15" };
    expect(roundsToOpen([sig], [r1a, { ...r1a, round: 2, asked_on: "2026-09-15" }, r3], "2026-09-17", wk)).toEqual([]);
  });
  it("wants a real answer", () => {
    expect(validAnswer("ok")).toMatch(/more detail/);
    expect(validAnswer("yes yes yes yes yes yes yes yes yes")).toMatch(/different words/);
    expect(validAnswer("I prayed Isha at home in my room after dinner, my brother was there too.")).toBeNull();
  });
});
