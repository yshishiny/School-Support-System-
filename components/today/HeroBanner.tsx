import type { ReactNode } from "react";

export interface BannerProps {
  url: string | null;
  fit: "cover" | "full";
  zoom: number;
  x: number;
  y: number;
  fallback?: ReactNode; // shown when there is no picture
  children?: ReactNode; // overlay pinned to the bottom (name, points)
  topRight?: ReactNode; // e.g. the prayer pill
  rounded?: string;
}

/**
 * The hero picture. "full" shows the whole picture (never cropped) over a blurred copy of itself so the
 * banner has no empty bars; "cover" fills the banner shape and honours the zoom and focal point.
 */
export function HeroBanner({ url, fit, zoom, x, y, fallback, children, topRight, rounded = "rounded-b-[32px]" }: BannerProps) {
  const fade = "linear-gradient(180deg, rgba(0,0,0,0) 45%, var(--color-bg) 100%)";
  if (!url) {
    return (
      <div className={`relative h-[200px] overflow-hidden ${rounded}`} style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 20%, var(--color-panel-2)), var(--color-bg))" }}>
        {fallback}
        {topRight && <div className="absolute top-3 right-3">{topRight}</div>}
        {children && <div className="absolute inset-x-4 bottom-4">{children}</div>}
      </div>
    );
  }
  if (fit === "cover") {
    return (
      <div className={`relative h-[220px] overflow-hidden ${rounded}`} style={{ backgroundColor: "var(--color-panel-2)" }}>
        {zoom < 1 && <div className="absolute inset-0 scale-110" style={{ backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(18px) brightness(.7)" }} aria-hidden />}
        <div className="absolute inset-0" style={{ backgroundImage: `${fade}, url(${url})`, backgroundSize: `auto, ${zoom * 100}% auto`, backgroundPosition: `center, ${x}% ${y}%`, backgroundRepeat: "no-repeat" }} />
        {topRight && <div className="absolute top-3 right-3">{topRight}</div>}
        {children && <div className="absolute inset-x-4 bottom-4">{children}</div>}
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden ${rounded}`} style={{ backgroundColor: "var(--color-panel-2)" }}>
      {/* blurred copy fills the frame behind the untouched picture */}
      <div className="absolute inset-0 scale-110" style={{ backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(18px) brightness(.7)" }} aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="relative block w-full h-auto max-h-[480px] object-contain" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: fade }} />
      {topRight && <div className="absolute top-3 right-3">{topRight}</div>}
      {children && <div className="absolute inset-x-4 bottom-4">{children}</div>}
    </div>
  );
}
