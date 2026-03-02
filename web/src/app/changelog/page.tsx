import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PixelBorder from "@/components/PixelBorder";

export const metadata = {
  title: "Changelog — Spiros",
  description: "Release notes and version history for Spiros.",
};

interface ChangelogEntry {
  version: string;
  date: string;
  type: "MAJOR" | "MINOR" | "PATCH";
  description: string;
  items: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.1",
    date: "2026-02-27",
    type: "PATCH",
    description: "Security Hardening & Performance Fixes",
    items: [
      "Fixed: profile update now whitelists allowed fields only (avatar_color, custom_title, profile_frame, bio)",
      "Fixed: friend request accept/decline now requires auth + verifies you are the addressee",
      "Fixed: friend removal now scoped to your own friendships only",
      "Fixed: search wildcards (% and _) escaped in user search and guild search",
      "Fixed: UUID validation on all direct message and friend request endpoints",
      "Fixed: XSS \u2014 all unescaped app names, categories, and site names in dashboard now use escapeHtml()",
      "Fixed: referral signup no longer exposes referrer UUID \u2014 code resolved server-side in DB trigger",
      "Fixed: claim-referral-reward uses idempotent upsert (race condition safe)",
      "Fixed: XP fallback bug in referral reward claiming removed",
      "Fixed: shell injection \u2014 removed shell:true from VS Code and Terminal launch commands",
      "Fixed: validate-referral, claim-referral-reward, stripe-webhook, create-checkout-session return generic error messages",
      "Fixed: stripe-webhook returns 200 on handler errors to prevent Stripe retry loops",
      "Fixed: name change rate limit (2/month) now enforced on website account page (was only in desktop app)",
      "Security: game state values capped (xp \u2264 10M, level \u2264 100, streak \u2264 3,650)",
      "Security: settings validation \u2014 poll interval 3-60s, idle timeout 1-60min",
      "Security: tracker date range capped to 365 days max",
      "Security: project scan restricted to configured projects folder",
      "Security: app:openExternal restricted to whitelisted domains (spiros.app, getspiros.com, github.com, stripe.com, supabase.com)",
      "Security: admin tier check uses UUID instead of display name",
      "Security: deleteAccount now cleans referral_rewards and referrals tables",
      "Performance: cloud sync only uploads today\u2019s data (was 7 days per interval)",
      "Performance: pullCloudToLocal limited to 90 days (was unbounded)",
      "Performance: leaderboard no longer pre-syncs profile on every load",
      "Performance: cached user ID for presence, online friends, search, and leaderboard (5-min TTL)",
      "Performance: profile page uses game state stats instead of unbounded getRange('2020-01-01')",
      "Password minimum increased from 6 to 8 characters (desktop + website)",
      "SQL migration: handle_new_user trigger resolves referral codes server-side",
      "SQL migration: added indexes for presence, level, xp, and streak queries",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-02-27",
    type: "MINOR",
    description: "Referral Program + Presence Optimization",
    items: [
      "Referral system: invite friends with your unique 8-character code, earn milestone rewards",
      "6 referral milestones: XP bonuses, exclusive \u201cReferral Blue\u201d avatar color, profile frames, free subscription months, Ambassador title",
      "Referred users get a 7-day free Starter trial (card required, auto-charges if not cancelled)",
      "Referral code input on signup (desktop app + website), auto-fills from ?ref= share links",
      "Profile page: referral code display, copy/share buttons, progress bar, milestone tracker with claim buttons",
      "Website account page: referral section with code, stats, and milestone preview",
      "Website signup: live referral code validation with \u201cReferred by [name]\u201d confirmation",
      "Trial checkout flow: referred users redirected to start 7-day Starter trial after email confirmation",
      "6 new referral achievements: Recruiter, Squad Builder, Team Captain, Commander, Ambassador, Legend Recruiter",
      "\u201cRecruiter\u201d and \u201cLegend\u201d profile frames added to customization options",
      "Anti-abuse: server-generated codes, server-side validation, one referral per account, completes only after Stripe subscription",
      "Replaced Realtime Presence WebSocket with DB-based presence (online/afk/offline status)",
      "Replaced Realtime subscription-changes channel with 5-minute polling",
      "Presence updates on activity state changes instead of constant heartbeats \u2014 massive reduction in database calls",
    ],
  },
  {
    version: "1.3.1",
    date: "2026-02-26",
    type: "PATCH",
    description: "4-Tier Pricing + 3-Theme System",
    items: [
      "Restructured pricing: Free / Starter ($3.99/mo) / Pro ($9.99/mo) / Max ($19.99/mo) with 25% annual discount",
      "New Starter tier: unlimited projects, cloud sync, data export, all chat channels, community submissions, friend comparison",
      "Pro tier: DMs + reactions, advanced analytics, global leaderboard, weekly challenges, streak freeze, profile customization",
      "Max tier: guild creation, profile frames, 1.5x XP bonus, 2-year data retention",
      "Added 3-theme system: AAA Neutral (default), Pixel Game, Matrix Hacker",
      "AAA Neutral: Inter font, rounded corners, soft shadows, muted gold palette",
      "Pixel Game: Press Start 2P, beveled borders, scanlines, classic RPG aesthetic",
      "Matrix Hacker: JetBrains Mono, green-on-black terminal, glow effects",
      "Theme picker in Settings with live preview cards",
      "Free users locked to AAA Neutral; Starter+ unlock all 3 themes",
      "Theme persists across app restarts",
      "Refactored ~37 hardcoded font declarations to CSS variables for theme support",
      "Website: 4-column pricing grid, theme picker in header, ThemeProvider context",
      "Fixed account page tier display (was showing wrong tier names)",
      "Database migration script for tier restructure (team \u2192 max)",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-02-26",
    type: "MINOR",
    description: "3-Tier Subscription System (Free / Pro / Team)",
    items: [
      "Stripe-powered subscriptions with monthly and yearly billing",
      "Upgrade modal and subscription management in Settings",
      "Pro features: global leaderboard, weekly challenges, advanced analytics, data export, cloud sync, unlimited projects, all chat channels + DMs, reactions, friend stat comparison, community submissions, profile customization",
      "Team features: guild creation + management, guild analytics, profile frames, 1.5x XP bonus",
      "Pro gets 1.25x XP bonus, streak freeze (1/week)",
      "Free tier: 1 project, 50 chat messages/day, friends leaderboard only",
      "Peak hours heatmap and 4-week productivity trend (Pro)",
      "CSV export option alongside JSON",
      "Bug fixes: chat reaction error handling, emoji picker cleanup, duplicate CSS",
    ],
  },
  {
    version: "1.2.1",
    date: "2026-02-26",
    type: "PATCH",
    description: "Rebrand Synchron to Spiros, remove unused village code",
    items: [],
  },
  {
    version: "1.2.0",
    date: "2026-02-26",
    type: "MINOR",
    description: "Forgot password, auto-update toggle, cookie banner, CI release fixes",
    items: [],
  },
  {
    version: "1.1.0",
    date: "2026-02-26",
    type: "MINOR",
    description: "Changelog tab, auto-release CI/CD pipeline",
    items: [],
  },
  {
    version: "1.0.0",
    date: "2026-02-25",
    type: "MAJOR",
    description: "Initial production release",
    items: [
      "Activity tracking with privacy controls",
      "Gamification system with XP, levels, and achievements",
      "Dashboard, Projects, Friends, Achievements, Settings tabs",
      "Supabase cloud sync + offline support",
      "Semantic versioning system",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <span className="inline-block text-[10px] text-gold border border-gold/30 px-3 py-1 mb-4 tracking-widest">
            &#9672; CHANGELOG
          </span>
          <h1 className="text-gold text-lg text-shadow-pixel">RELEASE NOTES</h1>
        </div>

        <div className="space-y-6">
          {CHANGELOG.map((entry) => (
            <PixelBorder key={entry.version} className="p-6">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="text-gold text-[13px] text-shadow-pixel">
                  v{entry.version}
                </span>
                <span className="text-text-dim text-[10px]">
                  {entry.date}
                </span>
              </div>

              <p className="text-cyan text-[10px] uppercase tracking-widest font-pixel mb-3">
                {entry.type} &mdash; {entry.description}
              </p>

              {entry.items.length > 0 && (
                <ul className="space-y-1.5">
                  {entry.items.map((item, i) => (
                    <li
                      key={i}
                      className="text-[11px] text-text-dim leading-relaxed pl-4 relative"
                    >
                      <span className="absolute left-0 text-gold">&#9656;</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </PixelBorder>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
