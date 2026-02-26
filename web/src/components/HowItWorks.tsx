"use client";

import PixelBorder from "./PixelBorder";

const STEPS = [
  {
    num: "01",
    icon: "⬇",
    title: "DOWNLOAD & INSTALL",
    desc: "Grab Spiros for Windows. One-click install, no setup needed. Runs silently in your system tray.",
  },
  {
    num: "02",
    icon: "◈",
    title: "TRACK YOUR ACTIVITY",
    desc: "Spiros auto-detects every app, window, and project. Your dashboard fills with real-time stats.",
  },
  {
    num: "03",
    icon: "★",
    title: "LEVEL UP & COMPETE",
    desc: "Earn XP, unlock achievements, and climb the leaderboard. Add friends and compare stats.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 bg-bg-dark/50">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="text-[9px] text-gold border border-gold/40 bg-gold/10 px-3 py-1">
            ★ HOW IT WORKS
          </span>
          <h2 className="text-lg sm:text-xl text-text-bright mt-6 text-shadow-pixel">
            BEGIN YOUR QUEST
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div key={step.num} className="relative">
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[calc(50%+60px)] w-[calc(100%-40px)] border-t-2 border-dashed border-border-light" />
              )}

              <PixelBorder highlight className="p-6 text-center relative">
                {/* Step number */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-bg-darkest border-2 border-gold px-3 py-1 text-[9px] text-gold">
                  {step.num}
                </div>

                <div className="text-3xl mt-4 mb-4">{step.icon}</div>
                <h3 className="text-xs text-text-bright mb-3">{step.title}</h3>
                <p className="text-[10px] text-text-dim leading-loose">
                  {step.desc}
                </p>
              </PixelBorder>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
