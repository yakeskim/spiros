"use client";

import { useState } from "react";
import { TIERS } from "@/lib/tiers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PixelBorder from "@/components/PixelBorder";
import PixelButton from "@/components/PixelButton";

export default function SubscribePage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-16 space-y-12">
        {/* Header */}
        <div className="text-center">
          <span className="text-[9px] text-gold border border-gold/40 bg-gold/10 px-3 py-1">
            &#9876; SUBSCRIBE
          </span>
          <h1 className="text-lg sm:text-xl text-text-bright mt-6 text-shadow-pixel">
            CHOOSE YOUR CLASS
          </h1>
          <p className="text-[10px] text-text-dim mt-4 max-w-md mx-auto leading-loose">
            Start free. Upgrade when you&apos;re ready for the full adventure.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setBilling("monthly")}
            className={`font-pixel text-[9px] px-4 py-2 border-2 cursor-pointer transition-all ${
              billing === "monthly"
                ? "bg-gold text-bg-darkest border-gold-dark shadow-pixel-gold"
                : "bg-transparent text-text-dim border-border-dark shadow-pixel hover:text-text-bright"
            }`}
          >
            MONTHLY
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`font-pixel text-[9px] px-4 py-2 border-2 cursor-pointer transition-all ${
              billing === "annual"
                ? "bg-gold text-bg-darkest border-gold-dark shadow-pixel-gold"
                : "bg-transparent text-text-dim border-border-dark shadow-pixel hover:text-text-bright"
            }`}
          >
            ANNUAL
            <span className="ml-2 text-[7px] text-green">SAVE</span>
          </button>
        </div>

        {/* Coming Soon banner */}
        <div className="text-center">
          <span className="text-[8px] text-bg-darkest bg-gold px-4 py-1 animate-pixel-blink inline-block">
            PAID TIERS COMING SOON
          </span>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier) => {
            const isAnnual = billing === "annual";
            const displayPrice =
              tier.id === "free"
                ? "$0"
                : isAnnual
                ? tier.annualPrice
                : tier.price;
            const displayPeriod =
              tier.id === "free"
                ? ""
                : isAnnual
                ? "/yr" + (tier.period.includes("seat") ? "/seat" : "")
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
                {/* Tier badge */}
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
                {isAnnual && tier.annualSave ? (
                  <p className="text-[8px] text-green mb-6">{tier.annualSave}</p>
                ) : !isAnnual && tier.annualSave ? (
                  <p className="text-[8px] text-text-dim mb-6">
                    or {tier.annualPrice}/yr ({tier.annualSave.toLowerCase()})
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

                {/* CTA */}
                {tier.id === "free" ? (
                  <PixelButton variant="ghost" href="/download" className="w-full">
                    DOWNLOAD FREE
                  </PixelButton>
                ) : (
                  <PixelButton
                    variant={tier.highlight ? "primary" : "ghost"}
                    href={tier.ctaHref}
                    className="w-full"
                  >
                    {tier.cta}
                  </PixelButton>
                )}

                {tier.id !== "free" && (
                  <p className="text-[7px] text-text-dim text-center mt-3">
                    We&apos;ll email you when this tier launches.
                  </p>
                )}
              </PixelBorder>
            );
          })}
        </div>

        {/* Back link */}
        <div className="text-center">
          <a
            href="/"
            className="text-[9px] text-text-dim hover:text-gold transition-colors"
          >
            &larr; Back to Spiros
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
