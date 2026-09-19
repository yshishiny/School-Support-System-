import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { AppShell } from "@/components/AppShell";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DeployWatcher } from "@/components/DeployWatcher";
import { brand, brandVars } from "@/lib/brand";

export function generateMetadata(): Metadata {
  const b = brand();
  return {
    title: b.name,
    description: "Daily study check-ins, homework tracking and rewards for the family.",
    manifest: "/manifest.webmanifest",
    icons: { icon: [{ url: "/brand/app-icon", type: "image/svg+xml" }], apple: [{ url: b.beta ? "/brand/app-icon?size=180" : "/icons/apple-touch-icon.png" }] },
  };
}

export function generateViewport(): Viewport {
  return { themeColor: brand().themeColor, width: "device-width", initialScale: 1 };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const b = brand();
  return (
    <html lang="en" data-site={b.beta ? "beta" : "live"}>
      <head>
        <link rel="apple-touch-icon" href={b.beta ? "/brand/app-icon?size=180" : "/icons/apple-touch-icon.png"} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&family=Amiri:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased" style={brandVars(b)}>
        {children}
        <DeployWatcher />
        <AppShell />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
