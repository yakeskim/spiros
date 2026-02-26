import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spiros — Subscribe",
  description: "Compare Spiros tiers: Free, Starter ($3.99/mo), Pro ($9.99/mo), and Max ($19.99/mo). Choose the plan that fits your adventure.",
};

export default function SubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
