import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

/** Built per deployment, so the beta installs as its own app with its own name, colour and icon. */
export default function manifest(): MetadataRoute.Manifest {
  const b = brand();
  const icon = (size: number) => ({ src: `/brand/app-icon?size=${size}`, sizes: `${size}x${size}`, type: "image/svg+xml" });
  return {
    id: b.beta ? "/?beta" : "/",
    name: b.name,
    short_name: b.shortName,
    description: "The family's study companion: check-ins, prayers, quizzes, snaps and the weekly allowance for the kids; live view, reports and school files for the parents.",
    start_url: b.beta ? "/?source=app&site=beta" : "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: b.bg,
    theme_color: b.themeColor,
    lang: "en",
    dir: "auto",
    categories: ["education", "kids", "productivity"],
    icons: b.beta
      ? [{ ...icon(192), purpose: "any" }, { ...icon(512), purpose: "any" }, { ...icon(512), purpose: "maskable" }]
      : [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/brand/app-icon", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
    shortcuts: [
      { name: "Today", url: "/today?source=shortcut" },
      { name: "Snaps", url: "/snaps?source=shortcut" },
      { name: "Parent home", url: "/parent?source=shortcut" },
    ],
  };
}
