import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spiros — Subscribe",
  description: "Compare Spiros tiers: Wanderer (free), Champion ($5/mo), and Guild ($8/seat/mo). Choose the plan that fits your adventure.",
};

export default function SubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
