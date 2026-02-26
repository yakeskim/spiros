"use client";

import PixelBorder from "./PixelBorder";
import PixelButton from "./PixelButton";

const PLANS = [
  {
    name: "WANDERER",
    subtitle: "Free Forever",
    price: "$0",
    period: "",
    features: [
      "Local activity tracking",
      "Full dashboard & charts",
      "Input analytics",
      "Gamification & XP system",
      "7-day history",
    ],
    cta: "DOWNLOAD FREE",
    ctaVariant: "ghost" as const,
    ctaHref: "#download",
    highlight: false,
  },
  {
    name: "CHAMPION",
    subtitle: "Pro Adventurer",
    price: "$5",
    period: "/mo",
    save: "$48/yr (save 20%)",
    features: [
      "Everything in Wanderer",
      "Cloud sync & backup",
      "Friends & leaderboards",
      "Unlimited history",
      "Priority support",
    ],
    cta: "JOIN WAITLIST",
    ctaVariant: "primary" as const,
    ctaHref: "/subscribe",
    highlight: true,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="text-[9px] text-gold border border-gold/40 bg-gold/10 px-3 py-1">
            ♦ PRICING
          </span>
          <h2 className="text-lg sm:text-xl text-text-bright mt-6 text-shadow-pixel">
            CHOOSE YOUR CLASS
          </h2>
          <p className="text-[10px] text-text-dim mt-4 max-w-md mx-auto leading-loose">
            Start free. Upgrade when you&apos;re ready for the full adventure.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {PLANS.map((plan) => (
            <PixelBorder
              key={plan.name}
              highlight={plan.highlight}
              className={`p-8 flex flex-col ${plan.highlight ? "border-gold/50" : ""}`}
            >
              {/* Plan name badge */}
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`text-xs ${plan.highlight ? "text-gold" : "text-text-dim"}`}
                >
                  {plan.name}
                </span>
                {plan.highlight && (
                  <span className="text-[8px] text-bg-darkest bg-gold px-2 py-0.5 animate-pixel-blink">
                    BEST
                  </span>
                )}
              </div>

              <p className="text-[9px] text-text-dim mb-4">{plan.subtitle}</p>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-2xl text-text-bright text-shadow-pixel">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-[10px] text-text-dim">{plan.period}</span>
                )}
              </div>
              {plan.save && (
                <p className="text-[8px] text-green mb-6">{plan.save}</p>
              )}
              {!plan.save && <div className="mb-6" />}

              {/* Features */}
              <ul className="flex-1 space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-[10px] text-text-dim"
                  >
                    <span className="text-green mt-0.5">&#10003;</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <PixelButton variant={plan.ctaVariant} href={plan.ctaHref} className="w-full">
                {plan.cta}
              </PixelButton>
            </PixelBorder>
          ))}
        </div>
      </div>
    </section>
  );
}
