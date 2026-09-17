/** One colour per child, used by every parent page's side menu so a kid always has the same colour. */
export const KID_COLORS = ["#3a86ff", "#ff6b6b", "#2ec4b6", "#ffbe0b", "#8338ec", "#fb5607"];
export function kidColor(index: number): string {
  return KID_COLORS[index % KID_COLORS.length];
}
