"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorksStep1 from "@/components/HowItWorksStep1";
import HowItWorksStep2 from "@/components/HowItWorksStep2";
import HowItWorksStep3 from "@/components/HowItWorksStep3";
import Download from "@/components/Download";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

const SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "features", label: "Features" },
  { id: "how-step-1", label: "Step 1" },
  { id: "how-step-2", label: "Step 2" },
  { id: "how-step-3", label: "Step 3" },
  { id: "download", label: "Download" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
];

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  /* Track active section via IntersectionObserver */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sectionEls = container.querySelectorAll<HTMLElement>("[data-snap]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.snap ?? 0
            );
            setActive(idx);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /* Hash link interceptor — scroll snap container instead of page */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a[href^='#']");
      if (!anchor) return;
      const hash = anchor.getAttribute("href");
      if (!hash || hash === "#") return;

      const target = container!.querySelector(hash);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  function scrollTo(idx: number) {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-snap="${idx}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <Header />

      {/* Scroll indicator dots */}
      <div className="scroll-indicator hidden md:flex">
        {SECTIONS.map((sec, i) => (
          <button
            key={i}
            className={`scroll-indicator-dot${i === active ? " active" : ""}`}
            onClick={() => scrollTo(i)}
            aria-label={`Go to ${sec.label}`}
          >
            <span className="scroll-indicator-label">{sec.label}</span>
          </button>
        ))}
      </div>

      <div ref={containerRef} className="snap-container flex-1">
        {/* 1. Hero */}
        <div className="snap-section" data-snap="0">
          <Hero />
        </div>

        {/* 2. Features */}
        <div className="snap-section" data-snap="1">
          <Features />
        </div>

        {/* 3. How It Works — Step 1 */}
        <div className="snap-section" data-snap="2">
          <HowItWorksStep1 />
        </div>

        {/* 4. How It Works — Step 2 */}
        <div className="snap-section" data-snap="3">
          <HowItWorksStep2 />
        </div>

        {/* 5. How It Works — Step 3 */}
        <div className="snap-section" data-snap="4">
          <HowItWorksStep3 />
        </div>

        {/* 6. Download */}
        <div className="snap-section" data-snap="5">
          <Download />
        </div>

        {/* 7. Pricing */}
        <div className="snap-section" data-snap="6">
          <Pricing />
        </div>

        {/* 8. FAQ + Footer (combined last section) */}
        <div className="snap-section-end" data-snap="7">
          <FAQ />
          <Footer />
        </div>
      </div>
    </div>
  );
}
