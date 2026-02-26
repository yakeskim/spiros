"use client";

import PixelBorder from "./PixelBorder";

const GITHUB_RELEASE = "https://github.com/jakebaynham/spiros/releases/latest";

export default function Download() {
  return (
    <section id="download" className="px-4 w-full">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="text-[9px] text-gold border border-gold/40 bg-gold/10 px-3 py-1">
            &#9660; DOWNLOAD
          </span>
          <h2 className="text-lg sm:text-xl text-text-bright mt-6 text-shadow-pixel">
            START YOUR QUEST
          </h2>
          <p className="text-[10px] text-text-dim mt-4 max-w-md mx-auto leading-loose">
            Free to download. Your data stays on your machine.
            Create your account directly in the app after installation.
          </p>
        </div>

        {/* Platform cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Windows */}
          <PixelBorder className="p-8 flex flex-col items-center text-center" highlight>
            <div className="text-4xl mb-4" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                className="w-12 h-12 inline-block"
                fill="currentColor"
                style={{ color: "#f5c542" }}
              >
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
              </svg>
            </div>
            <h3 className="text-xs text-text-bright text-shadow-pixel mb-2">WINDOWS</h3>
            <p className="text-[8px] text-text-dim mb-1">Windows 10 / 11</p>
            <p className="text-[7px] text-text-dim mb-6">64-bit &middot; ~85 MB</p>
            <a
              href={`${GITHUB_RELEASE}/download/Spiros-Setup.exe`}
              className="font-pixel text-[10px] px-6 py-3 border-2 bg-gold text-bg-darkest border-gold-dark shadow-pixel-gold hover:brightness-110 active:shadow-pixel-pressed active:translate-x-[2px] active:translate-y-[2px] cursor-pointer inline-block text-center w-full transition-all"
            >
              DOWNLOAD .EXE
            </a>
          </PixelBorder>

          {/* Mac */}
          <PixelBorder className="p-8 flex flex-col items-center text-center">
            <div className="text-4xl mb-4" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                className="w-12 h-12 inline-block"
                fill="currentColor"
                style={{ color: "#8888aa" }}
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11" />
              </svg>
            </div>
            <h3 className="text-xs text-text-bright text-shadow-pixel mb-2">macOS</h3>
            <p className="text-[8px] text-text-dim mb-1">macOS 12+</p>
            <p className="text-[7px] text-text-dim mb-6">Universal &middot; ~95 MB</p>
            <span
              className="font-pixel text-[10px] px-6 py-3 border-2 bg-transparent text-text-dim border-border-light shadow-pixel cursor-default inline-block text-center w-full opacity-60"
              title="Mac build coming soon"
            >
              COMING SOON
            </span>
          </PixelBorder>
        </div>

        {/* All releases link */}
        <div className="text-center mt-8">
          <a
            href="/download"
            className="text-[9px] text-text-dim hover:text-gold transition-colors"
          >
            View all versions &amp; past releases &#8594;
          </a>
        </div>
      </div>
    </section>
  );
}
