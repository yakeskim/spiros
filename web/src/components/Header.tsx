"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import PixelButton from "./PixelButton";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Download", href: "/download" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, profile, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-bg-darkest/95 border-b-2 border-border-dark backdrop-blur-none">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 text-gold text-sm text-shadow-pixel">
          <span className="text-lg">&#9876;</span>
          <span>SPIROS</span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-text-dim text-[10px] hover:text-gold transition-colors"
            >
              {link.label}
            </a>
          ))}
          {!loading && (
            user ? (
              <a
                href="/account"
                className="text-[9px] text-bg-darkest bg-gold px-3 py-1 border-2 border-gold-dark shadow-pixel-gold hover:brightness-110 transition-all"
              >
                {profile?.display_name ?? user.email?.split("@")[0] ?? "Account"}
              </a>
            ) : (
              <a
                href="/login"
                className="text-text-dim text-[10px] hover:text-gold transition-colors"
              >
                Login
              </a>
            )
          )}
          <PixelButton href="/download" className="text-[9px] px-4 py-2">
            DOWNLOAD FREE
          </PixelButton>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-text-bright text-lg p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Nav */}
      {menuOpen && (
        <nav className="md:hidden bg-bg-dark border-t-2 border-border-dark px-4 py-4 flex flex-col gap-4">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-text-dim text-[10px] hover:text-gold"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {!loading && (
            user ? (
              <a
                href="/account"
                className="text-gold text-[10px] hover:underline"
                onClick={() => setMenuOpen(false)}
              >
                {profile?.display_name ?? "Account"}
              </a>
            ) : (
              <a
                href="/login"
                className="text-text-dim text-[10px] hover:text-gold"
                onClick={() => setMenuOpen(false)}
              >
                Login
              </a>
            )
          )}
          <PixelButton href="/download" className="text-[9px] w-full">
            DOWNLOAD FREE
          </PixelButton>
        </nav>
      )}
    </header>
  );
}
