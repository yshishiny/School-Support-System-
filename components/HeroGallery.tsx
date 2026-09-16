"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { chooseHeroAction, deleteHeroImageAction } from "@/lib/actions/hero";

export interface GalleryItem {
  id: string;
  url: string;
  caption: string | null;
}

/** The child's pictures: pick one as avatar (the circle) and one as banner (behind the home page header). */
export function HeroGallery({ items, avatarId, bannerId, canDelete }: { items: GalleryItem[]; avatarId: string | null; bannerId: string | null; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (items.length === 0) return <p className="text-sm muted">No pictures yet. Add a few: you as a sultan, you with the trophy, anything that feels like you.</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.id} className="tile p-1.5 space-y-1">
          <div className="aspect-square overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt={it.caption ?? ""} className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-wrap gap-1">
            <button type="button" disabled={pending} onClick={() => start(async () => { await chooseHeroAction("avatar", avatarId === it.id ? null : it.id); router.refresh(); })} className={`chip !px-2 !py-0.5 !text-[11px] ${avatarId === it.id ? "chip-on" : ""}`}>{avatarId === it.id ? "✓ avatar" : "avatar"}</button>
            <button type="button" disabled={pending} onClick={() => start(async () => { await chooseHeroAction("banner", bannerId === it.id ? null : it.id); router.refresh(); })} className={`chip !px-2 !py-0.5 !text-[11px] ${bannerId === it.id ? "chip-on" : ""}`}>{bannerId === it.id ? "✓ banner" : "banner"}</button>
            {canDelete && <button type="button" disabled={pending} onClick={() => start(async () => { await deleteHeroImageAction(it.id); router.refresh(); })} className="text-[11px] muted hover:text-bad ml-auto">remove</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
