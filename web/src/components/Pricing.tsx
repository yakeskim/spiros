"use client";

import { TIERS } from "@/lib/tiers";
import PixelBorder from "./PixelBorder";
import PixelButton from "./PixelButton";

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
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

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TIERS.map((tier) => (
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
                  {tier.price}
                </span>
                {tier.period && (
                  <span className="text-[10px] text-text-dim">{tier.period}</span>
                )}
              </div>
              {tier.annualSave ? (
                <p className="text-[8px] text-green mb-6">
                  {tier.annualPrice}/yr ({tier.annualSave.toLowerCase()})
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
          ))}
        </div>
      </div>
    </section>
  );
}
