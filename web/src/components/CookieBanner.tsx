"use client";

import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie-consent")) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-border-dark bg-bg-darkest/95 backdrop-blur px-4 py-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-[10px] text-text-dim leading-relaxed">
          This site uses essential cookies for basic functionality (e.g. remembering this preference). We do not use tracking cookies or analytics.{" "}
          <a href="/privacy" className="text-gold hover:underline">
            Privacy Policy
          </a>
        </p>
        <button
          onClick={accept}
          className="shrink-0 px-4 py-2 text-[11px] text-bg-darkest bg-gold hover:bg-gold/80 transition-colors cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
