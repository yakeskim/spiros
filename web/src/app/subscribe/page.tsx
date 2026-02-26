import type { Metadata } from "next";
import PixelBorder from "@/components/PixelBorder";
import PixelButton from "@/components/PixelButton";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Spiros — Champion Tier",
  description: "Join the Champion tier waitlist. Cloud sync, friends, leaderboards, unlimited history, and more.",
};

const FEATURES = [
  "Everything in Wanderer",
  "Cloud sync & backup",
  "Friends & leaderboards",
  "Unlimited history",
  "Priority support",
  "Early access to new features",
];

export default function SubscribePage() {
  return (
    <div className="min-h-screen bg-bg-darkest flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-lg w-full">
          {/* Back link */}
          <a
            href="/"
            className="text-[9px] text-text-dim hover:text-gold transition-colors mb-8 inline-block"
          >
            &larr; Back to Spiros
          </a>

          <PixelBorder highlight className="p-10 flex flex-col items-center text-center border-gold/50">
            {/* Coming soon badge */}
            <span className="text-[8px] text-bg-darkest bg-gold px-3 py-1 mb-6 animate-pixel-blink">
              COMING SOON
            </span>

            {/* Tier name */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg text-gold text-shadow-pixel">&#9876;</span>
              <h1 className="text-lg text-gold text-shadow-pixel">CHAMPION</h1>
            </div>
            <p className="text-[9px] text-text-dim mb-8">Pro Adventurer Tier</p>

            {/* Price */}
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl text-text-bright text-shadow-pixel">$5</span>
              <span className="text-[10px] text-text-dim">/mo</span>
            </div>
            <p className="text-[8px] text-green mb-8">$48/yr (save 20%)</p>

            {/* Features */}
            <ul className="space-y-3 mb-10 text-left w-full max-w-xs">
              {FEATURES.map((f) => (
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
            <a
              href="mailto:subscribe@spiros.app?subject=Champion%20Tier%20Waitlist"
              className="font-pixel text-[10px] sm:text-xs px-8 py-3 border-2 bg-gold text-bg-darkest border-gold-dark shadow-pixel-gold hover:brightness-110 active:shadow-pixel-pressed active:translate-x-[2px] active:translate-y-[2px] cursor-pointer inline-block text-center w-full max-w-xs transition-all mb-4"
            >
              GET NOTIFIED
            </a>

            <p className="text-[7px] text-text-dim mb-6">
              We&apos;ll email you when Champion tier launches.
            </p>

            {/* Fallback */}
            <PixelButton variant="ghost" href="/#download" className="w-full max-w-xs">
              DOWNLOAD FREE
            </PixelButton>
          </PixelBorder>
        </div>
      </main>
      <Footer />
    </div>
  );
}
