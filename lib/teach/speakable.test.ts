import { describe, expect, it } from "vitest";
import { speakable } from "./speakable";

describe("speakable", () => {
  it("turns maths symbols into English words", () => {
    expect(speakable("So 2/5 + 1/5 = 3/5.", "en")).toBe("So 2 over 5 plus 1 over 5 equals 3 over 5.");
    expect(speakable("x² + y² = r²", "en")).toBe("x squared plus y squared equals r squared");
    expect(speakable("∠A = 90° and AB ∥ CD", "en")).toBe("angle A equals 90 degrees and A B is parallel to C D");
    expect(speakable("√16 = 4, 5 − 3 = 2", "en")).toBe("the square root of 16 equals 4, 5 minus 3 equals 2");
    expect(speakable("Dr. Layla, e.g. 50%", "en")).toBe("Doctor Layla, for example, 50 percent");
  });
  it("leaves ordinary sentences alone", () => {
    expect(speakable("Course set. Let's go.", "en")).toBe("Course set. Let's go.");
    expect(speakable("well-known ideas", "en")).toBe("well-known ideas");
  });
  it("turns symbols into Arabic words", () => {
    expect(speakable("٢/٥ + ١/٥ = ٣/٥", "ar")).toBe("٢ على ٥ زائد ١ على ٥ يساوي ٣ على ٥");
    expect(speakable("الزاوية ∠أ = ٩٠°", "ar")).toBe("الزاوية الزاوية أ يساوي ٩٠ درجة");
  });
});
