import MockupWindow from "./MockupWindow";

export default function HowItWorksStep3() {
  return (
    <section id="how-step-3" className="px-4 w-full">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Text */}
        <div>
          <span className="text-[10px] text-gold border border-gold/40 bg-gold/10 px-4 py-1.5">
            STEP 03
          </span>
          <h2 className="text-xl sm:text-2xl text-text-bright mt-6 text-shadow-pixel">
            LEVEL UP &amp; COMPETE
          </h2>
          <p className="text-[11px] text-text-dim mt-5 leading-loose max-w-md">
            Earn XP for every minute of activity, unlock achievements, and climb
            the leaderboard. Add friends and see who reigns supreme.
          </p>
        </div>

        {/* Mockup — Achievements active (index 2) */}
        <MockupWindow sidebar activeNav={2}>
          <div className="space-y-4">
            {/* XP bar */}
            <div>
              <div className="flex items-center justify-between text-[9px] text-text-dim mb-1">
                <span>
                  Lv.12 <span className="text-gold">Scout</span>
                </span>
                <span>850 / 1,000 XP</span>
              </div>
              <div className="h-3 bg-bg-dark border border-border-dark relative overflow-hidden">
                <div
                  className="h-full bg-gold xp-bar-shine relative"
                  style={{ width: "85%" }}
                />
              </div>
            </div>

            {/* Level-up celebration */}
            <div className="border-2 border-gold bg-gold/5 text-center py-2">
              <span className="text-[9px] text-gold animate-pixel-blink">
                &#9733; LEVEL UP! &#9733;
              </span>
            </div>

            {/* Achievement grid */}
            <div>
              <div className="text-[9px] text-text-dim mb-2">ACHIEVEMENTS</div>
              <div className="grid grid-cols-2 gap-2">
                {/* Unlocked */}
                <div className="border-2 border-gold bg-gold/5 p-2 text-center">
                  <div className="text-lg">&#9876;</div>
                  <div className="text-[9px] text-gold mt-1">First Blood</div>
                  <div className="text-[8px] text-green mt-0.5">&#10003; Unlocked</div>
                </div>
                <div className="border-2 border-gold bg-gold/5 p-2 text-center">
                  <div className="text-lg">&#9733;</div>
                  <div className="text-[9px] text-gold mt-1">Marathon</div>
                  <div className="text-[8px] text-green mt-0.5">&#10003; Unlocked</div>
                </div>
                {/* Locked */}
                <div className="border-2 border-border-dark bg-bg-dark/50 p-2 text-center opacity-50">
                  <div className="text-lg text-text-dim">?</div>
                  <div className="text-[9px] text-text-dim mt-1">???</div>
                  <div className="text-[8px] text-text-dim mt-0.5">Locked</div>
                </div>
                <div className="border-2 border-border-dark bg-bg-dark/50 p-2 text-center opacity-50">
                  <div className="text-lg text-text-dim">?</div>
                  <div className="text-[9px] text-text-dim mt-1">???</div>
                  <div className="text-[8px] text-text-dim mt-0.5">Locked</div>
                </div>
              </div>
            </div>

            {/* Mini leaderboard */}
            <div>
              <div className="text-[9px] text-text-dim mb-2">LEADERBOARD</div>
              <div className="border border-border-dark">
                {[
                  { rank: "#1", name: "DragonSlayer", lvl: "Lv.24", highlight: false },
                  { rank: "#2", name: "PixelKnight", lvl: "Lv.19", highlight: false },
                  { rank: "#3", name: "You", lvl: "Lv.12", highlight: true },
                ].map((row) => (
                  <div
                    key={row.rank}
                    className={`flex items-center justify-between px-2 py-1.5 text-[9px] border-b border-border-dark last:border-b-0 ${
                      row.highlight
                        ? "bg-gold/10 text-gold"
                        : "text-text-dim"
                    }`}
                  >
                    <span className="w-6">{row.rank}</span>
                    <span className="flex-1">{row.name}</span>
                    <span>{row.lvl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </MockupWindow>
      </div>
    </section>
  );
}
