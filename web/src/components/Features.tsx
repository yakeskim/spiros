"use client";

import PixelBorder from "./PixelBorder";

const FEATURES = [
  {
    icon: "◈",
    color: "text-blue",
    borderColor: "border-blue/30",
    title: "ACTIVITY TRACKING",
    desc: "Auto-tracks every app and window you use. Daily, weekly, and monthly views with rich breakdowns.",
  },
  {
    icon: "⌨",
    color: "text-cyan",
    borderColor: "border-cyan/30",
    title: "INPUT ANALYTICS",
    desc: "Clicks, keystrokes, words typed, and scroll events. See exactly how you interact with your machine.",
  },
  {
    icon: "★",
    color: "text-gold",
    borderColor: "border-gold/30",
    title: "GAMIFICATION & XP",
    desc: "Level up from Novice to Legend. Earn gold, resources, and prestige as you use your computer.",
  },
  {
    icon: "🏆",
    color: "text-purple",
    borderColor: "border-purple/30",
    title: "ACHIEVEMENTS",
    desc: "20 unique achievements to unlock — from marathon coding sessions to creative tool mastery.",
  },
  {
    icon: "♦",
    color: "text-green",
    borderColor: "border-green/30",
    title: "FRIENDS & LEADERBOARDS",
    desc: "Add friends, compare stats side by side, and compete on daily and all-time leaderboards.",
  },
  {
    icon: "⬡",
    color: "text-orange",
    borderColor: "border-orange/30",
    title: "PROJECT SCANNER",
    desc: "Auto-detects dev projects, languages, and commits. See time per project without any setup.",
  },
];

export default function Features() {
  return (
    <section id="features" className="px-4 w-full">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="text-[9px] text-gold border border-gold/40 bg-gold/10 px-3 py-1">
            ◈ FEATURES
          </span>
          <h2 className="text-lg sm:text-xl text-text-bright mt-6 text-shadow-pixel">
            EQUIPPED FOR BATTLE
          </h2>
          <p className="text-[10px] text-text-dim mt-4 max-w-lg mx-auto leading-loose">
            Everything you need to understand, gamify, and optimize your screen time.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <PixelBorder
              key={f.title}
              highlight
              className={`p-6 hover:border-border-highlight transition-colors group ${f.borderColor}`}
            >
              <div className={`text-2xl mb-4 ${f.color}`}>{f.icon}</div>
              <h3 className="text-xs text-text-bright mb-3">{f.title}</h3>
              <p className="text-[10px] text-text-dim leading-loose">
                {f.desc}
              </p>
            </PixelBorder>
          ))}
        </div>
      </div>
    </section>
  );
}
