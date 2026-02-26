import type { Metadata } from "next";
import { Press_Start_2P, Inter, JetBrains_Mono } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import ThemeProvider from "@/components/ThemeProvider";
import CookieBanner from "@/components/CookieBanner";
import "./globals.css";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

const interFont = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://spiros.app"),
  title: "Spiros — Your Screen Time Is Now An Adventure",
  description:
    "Spiros tracks every app you use, turns your activity into XP, and levels you up like an RPG character. Compete with friends. Unlock achievements.",
  openGraph: {
    title: "Spiros — Your Screen Time Is Now An Adventure",
    description:
      "Spiros tracks every app you use, turns your activity into XP, and levels you up like an RPG character.",
    url: "https://spiros.app",
    siteName: "Spiros",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spiros — Your Screen Time Is Now An Adventure",
    description:
      "Spiros tracks every app you use, turns your activity into XP, and levels you up like an RPG character.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="neutral"
      className={`${pixelFont.variable} ${interFont.variable} ${jetbrainsFont.variable}`}
    >
      <body className="font-primary text-text-default antialiased">
        <AuthProvider>
          <ThemeProvider>
            {children}
            <CookieBanner />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
