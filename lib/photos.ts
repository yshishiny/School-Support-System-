import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { report } from "@/lib/ops/fault";

/**
 * A real photograph of the thing a lesson talks about, from Wikimedia Commons (free licences, credited on the board).
 * One search per phrase, cached; a search that ran and found nothing is cached too, so it is not repeated.
 * A search that failed is not cached, or a single timeout would bury that phrase permanently.
 */
export interface ScenePhoto { url: string; page: string | null; credit: string | null; license: string | null }

interface CommonsPage { title: string; imageinfo?: { thumburl?: string; url?: string; width?: number; height?: number; mime?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }

const BLOCK = /\b(map|logo|flag|diagram|chart|screenshot|icon|coat of arms|stamp|poster|cover|drawing|sketch|painting|clipart)\b/i;

export async function findPhoto(query: string): Promise<ScenePhoto | null> {
  const q = query.trim().slice(0, 80);
  if (!q) return null;
  const id = createHash("sha256").update(q.toLowerCase()).digest("hex").slice(0, 40);
  const admin = createAdminClient();
  const { data: hit } = await admin.from("scene_photos").select("url, page, credit, license").eq("id", id).maybeSingle();
  if (hit) return hit.url ? { url: hit.url, page: hit.page, credit: hit.credit, license: hit.license } : null;
  let photo: ScenePhoto | null = null;
  // A search that *ran* and found nothing is worth remembering; a search that *failed* is not, or one timeout
  // would cache "no photograph exists for this phrase" for ever.
  let searched = false;
  try {
    const params = new URLSearchParams({ action: "query", generator: "search", gsrsearch: `${q} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "12", prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "900", iiextmetadatafilter: "Artist|LicenseShortName|ImageDescription", format: "json", origin: "*" });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "User-Agent": "StudyPortal/2.0 (family study app; contact via GitHub yshishiny/School-Support-System-)" }, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      searched = true;
      const body = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
      const pages = Object.values(body.query?.pages ?? {});
      const good = pages
        .map((p) => ({ p, i: p.imageinfo?.[0] }))
        .filter(({ p, i }) => i && i.thumburl && /jpeg|png/.test(i.mime ?? "") && (i.width ?? 0) >= 500 && (i.height ?? 0) >= 350 && !BLOCK.test(p.title) && !BLOCK.test(i.extmetadata?.ImageDescription?.value ?? ""))
        .sort((a, b) => ((b.i?.width ?? 0) * (b.i?.height ?? 0)) - ((a.i?.width ?? 0) * (a.i?.height ?? 0)));
      const best = good[0];
      if (best?.i?.thumburl) {
        const artist = (best.i.extmetadata?.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 80) || null;
        photo = { url: best.i.thumburl, page: best.i.descriptionurl ?? null, credit: artist, license: best.i.extmetadata?.LicenseShortName?.value ?? null };
      }
    }
  } catch (err) {
    photo = null;
    await report("photos.findPhoto", err, { meta: { query: q } });
  }
  if (searched) await admin.from("scene_photos").upsert({ id, query: q, url: photo?.url ?? null, page: photo?.page ?? null, credit: photo?.credit ?? null, license: photo?.license ?? null }).then(() => null, () => null);
  return photo;
}
