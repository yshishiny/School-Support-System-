import { requireStudent } from "@/lib/auth";
import { themeById } from "@/lib/themes";
import { Tour } from "@/components/Tour";

export default async function TourPage() {
  const { profile } = await requireStudent();
  const theme = themeById(profile.theme);
  const stickers = theme.stickers ?? [theme.emoji];
  return (
    <main className="space-y-4">
      <Tour firstName={profile.full_name.split(" ")[0]} mascot={stickers[0] ?? theme.emoji} stickers={stickers} alreadySeen={!!profile.tour_seen_at} />
    </main>
  );
}
