export interface Tier {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  period: string;
  annualPrice: string;
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
    name: "WANDERER",
    subtitle: "Free Forever",
    price: "$0",
    period: "",
    annualPrice: "$0",
    annualSave: "",
    features: [
      "Local activity tracking",
      "Full dashboard & charts",
      "Core gamification & XP",
      "Core village buildings",
      "Local project scanner",
      "7-day history",
      "Community support",
    ],
    cta: "DOWNLOAD FREE",
    ctaHref: "/download",
    highlight: false,
    color: "text-text-dim",
  },
  {
    id: "champion",
    name: "CHAMPION",
    subtitle: "Pro Adventurer",
    price: "$5",
    period: "/mo",
    annualPrice: "$48",
    annualSave: "Save 20%",
    features: [
      "Cloud sync & backup",
      "Advanced analytics",
      "All achievements unlocked",
      "Full village (all buildings, raids)",
      "Friends, leaderboards & community",
      "Unlimited history",
      "Past version downloads",
      "Priority support",
    ],
    cta: "GET NOTIFIED",
    ctaHref: "mailto:subscribe@spiros.app?subject=Champion%20Tier%20Waitlist",
    highlight: true,
    color: "text-gold",
  },
  {
    id: "guild",
    name: "GUILD",
    subtitle: "Team Adventurers",
    price: "$8",
    period: "/seat/mo",
    annualPrice: "$72",
    annualSave: "Save 25%",
    features: [
      "Everything in Champion",
      "Team dashboard & stats",
      "Team activity aggregation",
      "Shared guild village",
      "Team project views",
      "Team leaderboards & challenges",
      "Custom team achievements",
      "Manage seats & member activity",
      "Dedicated support",
    ],
    cta: "GET NOTIFIED",
    ctaHref: "mailto:subscribe@spiros.app?subject=Guild%20Tier%20Waitlist",
    highlight: false,
    color: "text-purple",
  },
];

export function isPro(tier: string | null | undefined): boolean {
  return tier === "champion" || tier === "guild";
}
