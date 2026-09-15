"use client";

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return <button type="button" className="btn-ghost btn-sm print:hidden" onClick={() => window.print()}>{label}</button>;
}
