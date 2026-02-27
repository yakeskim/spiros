import MockupWindow from "./MockupWindow";

export default function HowItWorksStep1() {
  return (
    <section id="how-step-1" className="px-4 w-full">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Text */}
        <div>
          <span className="text-[12px] text-gold border border-gold/40 bg-gold/10 px-4 py-1.5">
            STEP 01
          </span>
          <h2 className="text-xl sm:text-2xl text-text-bright mt-6 text-shadow-pixel">
            DOWNLOAD &amp; INSTALL
          </h2>
          <p className="text-[13px] text-text-dim mt-5 leading-loose max-w-md">
            Grab Spiros for Windows or macOS. One-click install, no setup needed.
            Runs silently in your system tray from day one.
          </p>

          {/* Platform buttons */}
          <div className="flex items-center gap-4 mt-8">
            <a href="/download" className="text-[11px] text-text-bright border-2 border-border-light px-4 py-2 flex items-center gap-2 hover:border-gold hover:text-gold transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4 inline-block" fill="currentColor" style={{ color: "#f5c542" }}>
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
              </svg>
              WINDOWS
            </a>
            <a href="/download" className="text-[11px] text-text-bright border-2 border-border-light px-4 py-2 flex items-center gap-2 hover:border-gold hover:text-gold transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4 inline-block" fill="currentColor" style={{ color: "#8888aa" }}>
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11" />
              </svg>
              macOS
            </a>
          </div>
        </div>

        {/* Mockup */}
        <MockupWindow>
          <div className="flex flex-col items-center justify-center py-10 gap-5">
            {/* Floating sword */}
            <div className="text-5xl text-gold animate-float">&#9876;</div>

            {/* Title */}
            <div className="text-base text-text-bright text-shadow-pixel tracking-wider">
              SPIROS
            </div>

            {/* Progress bar */}
            <div className="w-56 h-4 bg-bg-dark border-2 border-border-dark relative overflow-hidden">
              <div className="h-full bg-gold loading-fill" />
            </div>

            {/* Loading text */}
            <div className="text-[11px] text-text-dim animate-pixel-blink">
              LOADING...
            </div>
          </div>
        </MockupWindow>
      </div>
    </section>
  );
}
