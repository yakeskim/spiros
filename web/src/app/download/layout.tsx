import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spiros — Download",
  description: "Download Spiros for Windows. Browse past versions and changelogs.",
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
