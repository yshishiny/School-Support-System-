/** Reward ideas a parent can enable with one tap. Prices in points; a good week is 150-250 points. */
export interface RewardTemplate {
  key: string;
  emoji: string;
  title: string;
  description: string;
  kind: "cash" | "privilege" | "item";
  cost_points: number;
  cash_amount_egp?: number;
  group: "free" | "screen" | "football" | "long" | "values" | "friends";
  requires_full_weeks?: number;
  effort_note?: string;
}

export const REWARD_TEMPLATES: RewardTemplate[] = [
  { key: "friday_dinner", emoji: "🍕", title: "Choose Friday dinner", description: "He picks what the family eats on Friday.", kind: "privilege", cost_points: 120, group: "free" },
  { key: "family_movie", emoji: "🎬", title: "Pick the family movie", description: "His choice, no vetoes (within reason).", kind: "privilege", cost_points: 100, group: "free" },
  { key: "skip_chore", emoji: "🎟️", title: "Skip-one-chore token", description: "One chore, one time, no questions.", kind: "privilege", cost_points: 150, group: "free" },
  { key: "late_weekend", emoji: "🌙", title: "45 minutes later on a weekend night", description: "Bedtime moves once.", kind: "privilege", cost_points: 150, group: "free" },
  { key: "dad_afternoon", emoji: "🧢", title: "An afternoon with Dad, his pick", description: "Three hours doing what he chooses.", kind: "privilege", cost_points: 300, group: "free" },
  { key: "screen_30", emoji: "⏱️", title: "+30 minutes screen time", description: "On top of the daily limit, one day.", kind: "privilege", cost_points: 80, group: "screen" },
  { key: "game_credits", emoji: "🎮", title: "Game credits (100 EGP)", description: "In-game currency of his choice.", kind: "cash", cost_points: 400, cash_amount_egp: 100, group: "screen" },
  { key: "friday_gaming", emoji: "🕹️", title: "Late gaming pass, Friday", description: "Gaming until midnight one Friday.", kind: "privilege", cost_points: 250, group: "screen" },
  { key: "big_match", emoji: "📺", title: "The big match with Dad", description: "Stream the match together, snacks included.", kind: "privilege", cost_points: 200, group: "football" },
  { key: "stadium", emoji: "🏟️", title: "Stadium trip", description: "A live match. Needs four full-allowance weeks in a row.", kind: "privilege", cost_points: 1500, group: "football" },
  { key: "boots", emoji: "👟", title: "New boots or kit item", description: "One item from the wish list.", kind: "item", cost_points: 2000, group: "football" },
  { key: "savings_match", emoji: "🏦", title: "Savings match (100 EGP)", description: "For every 100 EGP he saves toward a goal, Dad adds 100.", kind: "cash", cost_points: 500, cash_amount_egp: 100, group: "long" },
  { key: "book", emoji: "📚", title: "A book of his choice", description: "Any book, any language.", kind: "item", cost_points: 300, group: "long" },
  { key: "friend_weekend", emoji: "🏕️", title: "Weekend with a friend (+250 EGP)", description: "A weekend out or a sleepover with a friend, with 250 EGP extra spending money on top of the allowance.", kind: "cash", cost_points: 1200, cash_amount_egp: 250, group: "friends", requires_full_weeks: 3, effort_note: "Three full-allowance weeks in a row, the checkpoint attempted each of those weeks, and this month's grades sheet uploaded." },
  { key: "friend_over", emoji: "🎲", title: "Friend over for the afternoon", description: "A friend comes over after school, snacks on us.", kind: "privilege", cost_points: 250, group: "friends", requires_full_weeks: 1, effort_note: "One full-allowance week." },
  { key: "sadaqah", emoji: "🤲", title: "Sadaqah in his name (100 EGP)", description: "He chooses the cause; Dad gives it in his name.", kind: "cash", cost_points: 250, cash_amount_egp: 100, group: "values" },
];

export const TEMPLATE_GROUPS: Record<RewardTemplate["group"], string> = {
  free: "Costs nothing",
  screen: "Screen and games",
  football: "Football",
  long: "Longer horizon",
  values: "Values",
  friends: "Friends (extra effort)",
};
