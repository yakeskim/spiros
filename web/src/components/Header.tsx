"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useTheme } from "./ThemeProvider";
import PixelButton from "./PixelButton";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-step-1" },
  { label: "Download", href: "/download" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const THEME_OPTIONS = [
  { id: "neutral" as const, label: "Neutral", icon: "◈" },
  { id: "pixel" as const, label: "Pixel", icon: "⚔" },
  { id: "matrix" as const, label: "Matrix", icon: "▓" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const { user, profile, loading } = useAuth();
  const { theme, setTheme } = useTheme();

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
              className="text-text-dim text-[12px] hover:text-gold transition-colors"
            >
              {link.label}
            </a>
          ))}

          {/* Theme Picker */}
          <div className="relative">
            <button
              onClick={() => setThemeOpen(!themeOpen)}
              className="text-text-dim text-[12px] hover:text-gold transition-colors cursor-pointer p-1"
              title="Switch theme"
            >
              ◐
            </button>
            {themeOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setThemeOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 bg-bg-dark border-2 border-border-light p-2 min-w-[120px]">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setTheme(opt.id);
                        setThemeOpen(false);
                      }}
                      className={`block w-full text-left text-[11px] px-3 py-2 cursor-pointer transition-colors ${
                        theme === opt.id
                          ? "text-gold bg-bg-panel"
                          : "text-text-dim hover:text-text-bright hover:bg-bg-panel"
                      }`}
                    >
                      <span className="mr-2">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {!loading && (
            user ? (
              <a
                href="/account"
                className="text-[11px] text-bg-darkest bg-gold px-3 py-1 border-2 border-gold-dark shadow-pixel-gold hover:brightness-110 transition-all"
              >
                {profile?.display_name ?? user.email?.split("@")[0] ?? "Account"}
              </a>
            ) : (
              <a
                href="/login"
                className="text-text-dim text-[12px] hover:text-gold transition-colors"
              >
                Login
              </a>
            )
          )}
          <PixelButton href="/signup" className="text-[11px] px-4 py-2">
            SIGN UP
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
              className="text-text-dim text-[12px] hover:text-gold"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}

          {/* Mobile theme picker */}
          <div className="flex items-center gap-3">
            <span className="text-text-dim text-[11px]">Theme:</span>
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                className={`text-[12px] px-2 py-1 border cursor-pointer ${
                  theme === opt.id
                    ? "text-gold border-gold"
                    : "text-text-dim border-border-dark hover:text-gold"
                }`}
              >
                {opt.icon}
              </button>
            ))}
          </div>

          {!loading && (
            user ? (
              <a
                href="/account"
                className="text-gold text-[12px] hover:underline"
                onClick={() => setMenuOpen(false)}
              >
                {profile?.display_name ?? "Account"}
              </a>
            ) : (
              <a
                href="/login"
                className="text-text-dim text-[12px] hover:text-gold"
                onClick={() => setMenuOpen(false)}
              >
                Login
              </a>
            )
          )}
          <PixelButton href="/signup" className="text-[11px] w-full">
            SIGN UP
          </PixelButton>
        </nav>
      )}
    </header>
  );
}
