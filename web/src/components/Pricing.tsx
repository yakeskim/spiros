"use client";

import { useState } from "react";
import { TIERS } from "@/lib/tiers";
import PixelBorder from "./PixelBorder";
import PixelButton from "./PixelButton";

export default function Pricing() {
  const [billing, setBilling] = useState<"annual" | "monthly">("annual");
  const isAnnual = billing === "annual";

  return (
    <section id="pricing" className="px-4 w-full">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-8">
          <span className="text-[9px] text-gold border border-gold/40 bg-gold/10 px-3 py-1">
            &#9830; PRICING
          </span>
          <h2 className="text-lg sm:text-xl text-text-bright mt-6 text-shadow-pixel">
            CHOOSE YOUR CLASS
          </h2>
          <p className="text-[10px] text-text-dim mt-4 max-w-md mx-auto leading-loose">
            Start free. Upgrade when you&apos;re ready for the full adventure.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <button
            onClick={() => setBilling("annual")}
            className={`font-pixel text-[9px] px-4 py-2 border-2 cursor-pointer transition-all ${
              isAnnual
                ? "bg-gold text-bg-darkest border-gold-dark shadow-pixel-gold"
                : "bg-transparent text-text-dim border-border-dark shadow-pixel hover:text-text-bright"
            }`}
          >
            ANNUAL
            {isAnnual && <span className="ml-2 text-[7px]">SAVE</span>}
          </button>
          <button
            onClick={() => setBilling("monthly")}
            className={`font-pixel text-[9px] px-4 py-2 border-2 cursor-pointer transition-all ${
              !isAnnual
                ? "bg-gold text-bg-darkest border-gold-dark shadow-pixel-gold"
                : "bg-transparent text-text-dim border-border-dark shadow-pixel hover:text-text-bright"
            }`}
          >
            MONTHLY
          </button>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TIERS.map((tier) => {
            const isFree = tier.id === "free";
            const displayPrice = isFree
              ? "$0"
              : isAnnual
              ? tier.annualMonthlyPrice
              : tier.monthlyPrice;
            const displayPeriod = isFree
              ? ""
              : tier.period;

            return (
              <PixelBorder
                key={tier.id}
                highlight={tier.highlight}
                className={`p-8 flex flex-col ${
                  tier.highlight
                    ? "border-gold/50"
                    : tier.id === "guild"
                    ? "border-purple/30"
                    : ""
                }`}
              >
                {/* Tier name badge */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs ${tier.color}`}>{tier.name}</span>
                  {tier.highlight && (
                    <span className="text-[8px] text-bg-darkest bg-gold px-2 py-0.5 animate-pixel-blink">
                      BEST
                    </span>
                  )}
                </div>

                <p className="text-[9px] text-text-dim mb-4">{tier.subtitle}</p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl text-text-bright text-shadow-pixel">
                    {displayPrice}
                  </span>
                  {displayPeriod && (
                    <span className="text-[10px] text-text-dim">{displayPeriod}</span>
                  )}
                </div>

                {/* Billing note */}
                {!isFree && isAnnual && tier.annualSave ? (
                  <div className="mb-6">
                    <p className="text-[8px] text-text-dim">
                      Billed {tier.annualTotalPrice}/yr
                    </p>
                    <p className="text-[8px] text-green mt-1">
                      {tier.annualSave}
                    </p>
                  </div>
                ) : !isFree && !isAnnual && tier.annualSave ? (
                  <p className="text-[8px] text-text-dim mb-6">
                    or {tier.annualMonthlyPrice}/mo billed annually
                  </p>
                ) : (
                  <div className="mb-6" />
                )}

                {/* Features */}
                <ul className="flex-1 space-y-3 mb-8">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-[10px] text-text-dim"
                    >
                      <span className="text-green mt-0.5">&#10003;</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <PixelButton
                  variant={tier.highlight ? "primary" : "ghost"}
                  href={tier.ctaHref}
                  className="w-full"
                >
                  {tier.cta}
                </PixelButton>
              </PixelBorder>
            );
          })}
        </div>
      </div>
    </section>
  );
}
