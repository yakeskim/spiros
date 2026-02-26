"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { isPro } from "@/lib/tiers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PixelBorder from "@/components/PixelBorder";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface Release {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  html_url: string;
  assets: ReleaseAsset[];
  prerelease: boolean;
  draft: boolean;
}

const GITHUB_API = "https://api.github.com/repos/yakeskim/spiros/releases";

function findWindowsAsset(assets: ReleaseAsset[]): ReleaseAsset | null {
  return (
    assets.find((a) => a.name.endsWith(".exe")) ??
    assets.find((a) => a.name.endsWith(".msi")) ??
    null
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function excerptChangelog(body: string, maxLines = 5): string {
  if (!body) return "";
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const excerpt = lines.slice(0, maxLines);
  if (lines.length > maxLines) excerpt.push("...");
  return excerpt.join("\n");
}

export default function DownloadPage() {
  const { profile } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const userTier = profile?.tier ?? "free";
  const hasPro = isPro(userTier);

  useEffect(() => {
    fetch(GITHUB_API)
      .then((res) => {
        if (!res.ok) throw new Error("Rate limited or unavailable");
        return res.json();
      })
      .then((data: Release[]) => {
        const published = data.filter((r) => !r.draft);
        setReleases(published);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const latest = releases[0] ?? null;
  const pastReleases = releases.slice(1);

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-16 space-y-12">
        {/* Section header */}
        <div className="text-center">
          <span className="text-[9px] text-gold border border-gold/40 bg-gold/10 px-3 py-1">
            &#9876; ARMORY
          </span>
          <h1 className="text-lg sm:text-xl text-text-bright mt-6 text-shadow-pixel">
            DOWNLOAD SPIROS
          </h1>
          <p className="text-[10px] text-text-dim mt-4 max-w-md mx-auto leading-loose">
            Grab the latest version or browse past releases.
            Auto-update keeps you current once installed.
          </p>
        </div>

        {loading && (
          <p className="text-[9px] text-text-dim text-center">Loading releases...</p>
        )}

        {error && (
          <div className="text-center space-y-4">
            <p className="text-[9px] text-text-dim">
              Could not fetch releases. You can download directly from GitHub.
            </p>
            <a
              href="https://github.com/yakeskim/spiros/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="font-pixel text-[10px] px-6 py-3 border-2 bg-gold text-bg-darkest border-gold-dark shadow-pixel-gold hover:brightness-110 active:shadow-pixel-pressed active:translate-x-[2px] active:translate-y-[2px] cursor-pointer inline-block transition-all"
            >
              VIEW ON GITHUB
            </a>
          </div>
        )}

        {/* Latest Release */}
        {latest && (
          <PixelBorder highlight className="p-8 border-gold/50">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[8px] text-bg-darkest bg-gold px-2 py-0.5 animate-pixel-blink">
                LATEST
              </span>
              <span className="text-xs text-gold text-shadow-pixel">
                {latest.tag_name}
              </span>
            </div>

            <p className="text-[9px] text-text-dim mb-4">
              Released {formatDate(latest.published_at)}
            </p>

            {/* Changelog excerpt */}
            {latest.body && (
              <pre className="text-[8px] text-text-dim bg-bg-darkest border-2 border-border-dark p-4 mb-6 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {excerptChangelog(latest.body, 8)}
              </pre>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              {/* Windows download */}
              {(() => {
                const win = findWindowsAsset(latest.assets);
                return win ? (
                  <a
                    href={win.browser_download_url}
                    className="font-pixel text-[10px] px-6 py-3 border-2 bg-gold text-bg-darkest border-gold-dark shadow-pixel-gold hover:brightness-110 active:shadow-pixel-pressed active:translate-x-[2px] active:translate-y-[2px] cursor-pointer inline-block text-center transition-all"
                  >
                    DOWNLOAD FOR WINDOWS
                    <span className="block text-[7px] text-bg-darkest/70 mt-1">
                      {win.name} &middot; {formatSize(win.size)}
                    </span>
                  </a>
                ) : (
                  <a
                    href={latest.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-pixel text-[10px] px-6 py-3 border-2 bg-gold text-bg-darkest border-gold-dark shadow-pixel-gold hover:brightness-110 active:shadow-pixel-pressed active:translate-x-[2px] active:translate-y-[2px] cursor-pointer inline-block text-center transition-all"
                  >
                    VIEW RELEASE
                  </a>
                );
              })()}

              {/* macOS placeholder */}
              <span className="font-pixel text-[10px] px-6 py-3 border-2 bg-transparent text-text-dim border-border-light shadow-pixel cursor-default inline-block text-center opacity-60">
                macOS COMING SOON
              </span>
            </div>
          </PixelBorder>
        )}

        {/* Past Releases */}
        {pastReleases.length > 0 && (
          <section>
            <h2 className="text-xs text-text-bright text-shadow-pixel mb-6">
              PAST VERSIONS
            </h2>
            <div className="space-y-4">
              {pastReleases.map((release) => {
                const win = findWindowsAsset(release.assets);
                return (
                  <PixelBorder
                    key={release.tag_name}
                    className={`p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                      !hasPro ? "opacity-75" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] text-text-bright">
                          {release.tag_name}
                        </span>
                        {release.prerelease && (
                          <span className="text-[7px] text-orange border border-orange/40 px-1.5 py-0.5">
                            PRE
                          </span>
                        )}
                      </div>
                      <p className="text-[8px] text-text-dim">
                        {formatDate(release.published_at)}
                        {win && <> &middot; {formatSize(win.size)}</>}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {hasPro ? (
                        win ? (
                          <a
                            href={win.browser_download_url}
                            className="font-pixel text-[9px] px-4 py-2 border-2 bg-transparent text-text-bright border-border-light shadow-pixel hover:border-gold hover:text-gold cursor-pointer inline-block text-center transition-all"
                          >
                            DOWNLOAD
                          </a>
                        ) : (
                          <a
                            href={release.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-pixel text-[9px] px-4 py-2 border-2 bg-transparent text-text-bright border-border-light shadow-pixel hover:border-gold hover:text-gold cursor-pointer inline-block text-center transition-all"
                          >
                            VIEW
                          </a>
                        )
                      ) : (
                        <div className="relative inline-block">
                          <span className="font-pixel text-[9px] px-4 py-2 border-2 bg-transparent text-text-dim border-border-dark shadow-pixel cursor-default inline-block text-center opacity-50">
                            DOWNLOAD
                          </span>
                          <span className="absolute -top-2 -right-2 text-[7px] text-bg-darkest bg-gold px-1.5 py-0.5">
                            PRO
                          </span>
                        </div>
                      )}
                    </div>
                  </PixelBorder>
                );
              })}
            </div>

            {!hasPro && (
              <p className="text-center mt-6">
                <a
                  href="/subscribe"
                  className="text-[9px] text-gold hover:underline transition-colors"
                >
                  Upgrade to Champion or Guild to unlock past versions &#8594;
                </a>
              </p>
            )}
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
