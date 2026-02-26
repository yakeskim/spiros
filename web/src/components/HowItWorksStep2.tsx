import MockupWindow from "./MockupWindow";

export default function HowItWorksStep2() {
  return (
    <section id="how-step-2" className="px-4 w-full">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Text */}
        <div>
          <span className="text-[10px] text-gold border border-gold/40 bg-gold/10 px-4 py-1.5">
            STEP 02
          </span>
          <h2 className="text-xl sm:text-2xl text-text-bright mt-6 text-shadow-pixel">
            TRACK YOUR ACTIVITY
          </h2>
          <p className="text-[11px] text-text-dim mt-5 leading-loose max-w-md">
            Spiros auto-detects every app, window, and project you use. Your
            dashboard fills with real-time stats, timelines, and breakdowns.
          </p>
        </div>

        {/* Mockup — Dashboard active (index 0) */}
        <MockupWindow sidebar activeNav={0}>
          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: "12h 30m", label: "Active" },
                { val: "8", label: "Apps" },
                { val: "1.2K", label: "Events" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="text-center border border-border-dark bg-bg-dark/50 py-2"
                >
                  <div className="text-xs text-text-bright text-shadow-pixel">
                    {s.val}
                  </div>
                  <div className="text-[7px] text-text-dim mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Timeline bar */}
            <div>
              <div className="text-[7px] text-text-dim mb-1">TODAY&apos;S TIMELINE</div>
              <div className="h-4 flex overflow-hidden border border-border-dark">
                <div className="bg-blue" style={{ width: "45%" }} />
                <div className="bg-cyan" style={{ width: "30%" }} />
                <div className="bg-purple" style={{ width: "15%" }} />
                <div className="bg-bg-dark flex-1" />
              </div>
              <div className="flex gap-3 mt-1.5">
                <span className="text-[6px] text-text-dim flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-blue inline-block" /> Development
                </span>
                <span className="text-[6px] text-text-dim flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-cyan inline-block" /> Browsing
                </span>
                <span className="text-[6px] text-text-dim flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-purple inline-block" /> Design
                </span>
              </div>
            </div>

            {/* Top apps */}
            <div>
              <div className="text-[7px] text-text-dim mb-2">TOP APPS</div>
              <div className="space-y-2">
                {[
                  { name: "VS Code", pct: 72, dur: "9h 00m", color: "bg-blue" },
                  { name: "Chrome", pct: 52, dur: "6h 30m", color: "bg-cyan" },
                  { name: "Figma", pct: 21, dur: "2h 38m", color: "bg-purple" },
                ].map((app) => (
                  <div key={app.name} className="flex items-center gap-2">
                    <span className="text-[7px] text-text-dim w-12 shrink-0">
                      {app.name}
                    </span>
                    <div className="flex-1 h-2 bg-bg-dark border border-border-dark relative overflow-hidden">
                      <div
                        className={`h-full ${app.color}`}
                        style={{ width: `${app.pct}%` }}
                      />
                    </div>
                    <span className="text-[6px] text-text-dim w-10 text-right shrink-0">
                      {app.dur}
                    </span>
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
