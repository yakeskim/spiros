export interface Tier {
  id: string;
  name: string;
  subtitle: string;
  monthlyPrice: string;
  period: string;
  annualMonthlyPrice: string;
  annualTotalPrice: string;
  annualSave: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight: boolean;
  color: string;
}

export const TIERS: Tier[] = [
  {
    id: "free",
    name: "FREE",
    subtitle: "Get Started",
    monthlyPrice: "$0",
    period: "",
    annualMonthlyPrice: "$0",
    annualTotalPrice: "$0",
    annualSave: "",
    features: [
      "500 credits / 8hr window (2k/week)",
      "Basic daily dashboard & charts",
      "Gamification & XP",
      "1 project",
      "Friends leaderboard",
      "General chat (50 msg/day)",
      "Join teams",
      "AAA Neutral theme only",
      "90-day data retention",
    ],
    cta: "DOWNLOAD FREE",
    ctaHref: "/download",
    highlight: false,
    color: "text-text-dim",
  },
  {
    id: "starter",
    name: "STARTER",
    subtitle: "Adventurer",
    monthlyPrice: "$3.99",
    period: "/mo",
    annualMonthlyPrice: "$2.99",
    annualTotalPrice: "$35.88",
    annualSave: "Save 25%",
    features: [
      "Everything in Free",
      "2,500 credits / 8hr window (12k/week)",
      "Unlimited projects",
      "Cloud sync & backup",
      "All chat channels (unlimited)",
      "Data export (CSV/JSON)",
      "Community submissions",
      "Friend stat comparison",
      "All 3 themes",
    ],
    cta: "UPGRADE TO STARTER",
    ctaHref: "/subscribe",
    highlight: false,
    color: "text-green",
  },
  {
    id: "pro",
    name: "PRO",
    subtitle: "Pro Adventurer",
    monthlyPrice: "$9.99",
    period: "/mo",
    annualMonthlyPrice: "$7.49",
    annualTotalPrice: "$89.88",
    annualSave: "Save 25%",
    features: [
      "Everything in Starter",
      "10,000 credits / 8hr window (50k/week)",
      "Advanced analytics & trends",
      "1.25x XP bonus",
      "DMs + chat reactions",
      "Global leaderboard",
      "Weekly challenges",
      "Avatar color & custom title",
      "Streak freeze (1/week)",
    ],
    cta: "UPGRADE TO PRO",
    ctaHref: "/subscribe",
    highlight: true,
    color: "text-gold",
  },
  {
    id: "max",
    name: "MAX",
    subtitle: "Ultimate Adventurer",
    monthlyPrice: "$19.99",
    period: "/mo",
    annualMonthlyPrice: "$14.99",
    annualTotalPrice: "$179.88",
    annualSave: "Save 25%",
    features: [
      "Everything in Pro",
      "100,000 credits / 8hr window (500k/week)",
      "1.5x XP bonus",
      "Create & manage teams",
      "Profile frames",
      "2-year data retention",
    ],
    cta: "UPGRADE TO MAX",
    ctaHref: "/subscribe",
    highlight: false,
    color: "text-purple",
  },
];

export function isPro(tier: string | null | undefined): boolean {
  return tier === "starter" || tier === "pro" || tier === "max";
}

export function hasMinTier(
  current: string | null | undefined,
  required: string
): boolean {
  const order: Record<string, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    max: 3,
  };
  return (order[current ?? "free"] ?? 0) >= (order[required] ?? 0);
}
