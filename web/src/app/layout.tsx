import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import CookieBanner from "@/components/CookieBanner";
import "./globals.css";

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
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
    <html lang="en" className={pixelFont.variable}>
      <body className="font-pixel text-text-default antialiased">
        <AuthProvider>
          {children}
          <CookieBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
