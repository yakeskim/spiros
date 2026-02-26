"use client";

import PixelBorder from "./PixelBorder";
import PixelButton from "./PixelButton";

export default function Hero() {
  return (
    <section className="relative px-4 w-full overflow-hidden">
      {/* Decorative corner accents */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-gold/30" />
      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-gold/30" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-gold/30" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-gold/30" />

      <div className="max-w-4xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-block mb-8">
          <span className="text-[9px] text-gold border border-gold/40 bg-gold/10 px-3 py-1">
            &#9733; EARLY ACCESS — FREE FOREVER TIER
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-xl sm:text-2xl md:text-3xl text-text-bright leading-relaxed text-shadow-deep mb-6">
          YOUR SCREEN TIME
          <br />
          <span className="text-gold">IS NOW AN ADVENTURE</span>
        </h1>

        {/* Subheadline */}
        <p className="text-[10px] sm:text-xs text-text-dim leading-loose max-w-2xl mx-auto mb-10">
          Spiros tracks every app you use, turns your activity into XP,
          and levels you up like an RPG character. Compete with friends.
          Unlock achievements. See where your time actually goes.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <PixelButton href="#download">DOWNLOAD FREE</PixelButton>
          <PixelButton href="#how-it-works" variant="ghost">
            SEE HOW IT WORKS
          </PixelButton>
        </div>

        {/* XP Bar decoration */}
        <PixelBorder className="max-w-md mx-auto p-4">
          <div className="flex items-center justify-between text-[9px] text-text-dim mb-2">
            <span>Lv. 14 — <span className="text-gold">Architect</span></span>
            <span>2,847 / 4,000 XP</span>
          </div>
          <div className="w-full h-4 bg-bg-darkest border border-border-dark relative overflow-hidden">
            <div className="h-full bg-gold animate-xp-fill xp-bar-shine relative" />
          </div>
          <div className="flex justify-between text-[8px] text-text-dim mt-2">
            <span className="text-green">+142 XP today</span>
            <span>&#9876; 3 achievements unlocked</span>
          </div>
        </PixelBorder>
      </div>
    </section>
  );
}
