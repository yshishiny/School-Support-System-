import { describe, expect, it } from "vitest";
import { classifyPosition, distanceM, parseCoordinates } from "./places";

const places = [
  { kind: "home" as const, label: "Home", latitude: 30.05, longitude: 31.23, radius_m: 250 },
  { kind: "school" as const, label: "School", latitude: 30.02, longitude: 31.40, radius_m: 400, student_id: "y" },
];

describe("places", () => {
  it("measures distance roughly right", () => {
    expect(distanceM(30.05, 31.23, 30.05, 31.24)).toBeGreaterThan(900);
    expect(distanceM(30.05, 31.23, 30.05, 31.24)).toBeLessThan(1000);
  });
  it("labels home, school, and away with a distance", () => {
    expect(classifyPosition(30.0505, 31.2302, places, "y").label).toBe("Home");
    expect(classifyPosition(30.021, 31.401, places, "y").label).toBe("School");
    expect(classifyPosition(30.021, 31.401, places, "o").kind).toBe("away"); // another child's school
    expect(classifyPosition(30.10, 31.23, places, "y").label).toMatch(/km from home/);
  });
  it("gives GPS accuracy some slack", () => {
    expect(classifyPosition(30.0525, 31.23, places, "y", 200).label).toBe("Home");
  });
  it("parses coordinates and map links", () => {
    expect(parseCoordinates("30.0444, 31.2357")).toEqual({ lat: 30.0444, lng: 31.2357 });
    expect(parseCoordinates("https://www.google.com/maps/place/x/@30.0444,31.2357,17z")).toEqual({ lat: 30.0444, lng: 31.2357 });
    expect(parseCoordinates("New Cairo")).toBeNull();
  });
});
