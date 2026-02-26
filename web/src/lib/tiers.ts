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
      "Unlimited activity tracking",
      "Basic daily dashboard & charts",
      "Gamification & XP",
      "1 project",
      "Friends leaderboard",
      "General chat (50 msg/day)",
      "Join guilds",
      "90-day data retention",
    ],
    cta: "DOWNLOAD FREE",
    ctaHref: "/download",
    highlight: false,
    color: "text-text-dim",
  },
  {
    id: "pro",
    name: "PRO",
    subtitle: "Pro Adventurer",
    monthlyPrice: "$5",
    period: "/mo",
    annualMonthlyPrice: "$3.33",
    annualTotalPrice: "$40",
    annualSave: "Save 33%",
    features: [
      "Everything in Free",
      "Advanced analytics & trends",
      "1.25x XP bonus",
      "Unlimited projects",
      "Cloud sync & backup",
      "All chat channels + DMs & reactions",
      "Global leaderboard",
      "Weekly challenges",
      "Streak freeze (1/week)",
      "Profile customization",
      "Data export (JSON & CSV)",
      "Community submissions & voting",
      "Friend stat comparison",
    ],
    cta: "UPGRADE TO PRO",
    ctaHref: "/subscribe",
    highlight: true,
    color: "text-gold",
  },
  {
    id: "team",
    name: "TEAM",
    subtitle: "Team Adventurers",
    monthlyPrice: "$12",
    period: "/mo",
    annualMonthlyPrice: "$8",
    annualTotalPrice: "$96",
    annualSave: "Save 33%",
    features: [
      "Everything in Pro",
      "1.5x XP bonus",
      "Create & manage guilds",
      "Guild analytics dashboard",
      "Profile frames",
      "2-year data retention",
    ],
    cta: "UPGRADE TO TEAM",
    ctaHref: "/subscribe",
    highlight: false,
    color: "text-purple",
  },
];

export function isPro(tier: string | null | undefined): boolean {
  return tier === "pro" || tier === "team";
}
