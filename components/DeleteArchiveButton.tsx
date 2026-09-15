"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteChatArchiveAction } from "@/lib/actions/archive";

export function DeleteArchiveButton({ archiveId }: { archiveId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) return <button type="button" className="text-xs muted hover:text-bad" onClick={() => setConfirm(true)}>Delete archive</button>;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="muted">Delete messages and media?</span>
      <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { await deleteChatArchiveAction(archiveId); router.refresh(); })}>
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" className="text-xs muted" onClick={() => setConfirm(false)}>Cancel</button>
    </div>
  );
}
