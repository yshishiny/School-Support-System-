import { describe, expect, it } from "vitest";
import { describeAccess, parseUserAgent, requestContext } from "./device";

describe("parseUserAgent", () => {
  it("recognises an iPhone on Safari", () => {
    const d = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1");
    expect(d).toEqual({ type: "phone", os: "iPhone", browser: "Safari" });
  });
  it("recognises an Android phone model on Chrome", () => {
    const d = parseUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36");
    expect(d.type).toBe("phone");
    expect(d.os).toBe("Android · SM-S918B");
    expect(d.browser).toBe("Chrome");
  });
  it("recognises a Windows laptop on Edge", () => {
    const d = parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0");
    expect(d).toEqual({ type: "desktop", os: "Windows", browser: "Edge" });
  });
});

describe("requestContext", () => {
  it("reads the first forwarded IP and the Vercel geo headers", () => {
    const h: Record<string, string> = { "x-forwarded-for": "197.0.0.5, 10.0.0.1", "x-vercel-ip-city": "Cairo", "x-vercel-ip-country": "EG", "x-vercel-ip-latitude": "30.04", "x-vercel-ip-longitude": "31.23", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1" };
    const c = requestContext((n) => h[n]);
    expect(c.ip).toBe("197.0.0.5");
    expect(c.city).toBe("Cairo");
    expect(c.latitude).toBe(30.04);
    expect(describeAccess({ city: c.city, country: c.country, device_os: c.device.os, device_browser: c.device.browser })).toBe("Cairo, EG · iPhone Safari");
  });
});
