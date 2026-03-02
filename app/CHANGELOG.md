# Spiros Changelog

All notable changes to Spiros are documented here.
Format: [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH

## v2.0.0 — 2026-03-02
**MAJOR** — Core Product Pivot: Activity Tracking Focus
### Removed
- Removed Projects tab — project scanning, git integration, project cards, detail popups, and all related backend
- Removed Community tab — community project submissions, voting, and comments
- Removed Guilds system — guild creation, browsing, membership, roles, and analytics
- Removed sidebar online counter widget
- Removed Projects Folder setting from General settings

### New: Tracking Credits System
- Tiered credit pools: Free (500/window, 2k/week), Starter (2.5k/window, 12k/week), Pro (10k/window, 50k/week), Max (100k/window, 500k/week)
- 8-hour credit windows (midnight–8am, 8am–4pm, 4pm–midnight) with weekly Monday reset
- Credits scale with input intensity (1–5 per poll based on clicks, keys, scrolls, mouse, controller)
- Sidebar credits meter with window and weekly progress bars
- Full-screen "Credits Exhausted" overlay when capped, auto-clears on new window/week/tier upgrade
- Social and cloud features also consume credits (friends, chat, leaderboard, sync)

### New: Timezone Support
- Full IANA timezone picker in new Settings > Timezone tab with live clock preview
- All date calculations across the entire app now respect configured timezone
- Fixes off-by-one date bugs for users outside UTC

### New: Chart Enhancements
- Category chart style picker: switch between Donut, Pie, and Bar views
- Interactive donut/pie tooltips on hover (colored dot, label, hours, percentage)
- Bar chart logarithmic scale toggle
- Timeline zoom: mouse wheel zoom, draggable range slider, adaptive tick spacing
- Theme-aware font scaling for all canvas-rendered text

### New: Competition Leaderboard
- New "Competition" scope tab — centers the view around your rank (~10th in a 100-player window)
- Leaderboard redesigned as sortable table: Rank, Name, Level, XP, Streak, Weekly columns
- Click column headers to sort ascending/descending
- Pagination (25 per page) with page navigation controls
- New "Weekly" column shows weekly active time synced to cloud

### New: Sidebar Clock
- Live date and time display in sidebar footer, respects configured timezone

### UI/UX
- Chat channels simplified from 7 to 4: General, Coding, Creative, Off-Topic
- Secondary nav (Profile, Changelog, Settings) redesigned as compact icon-only row
- Subscription tab redesigned with plan overview card, feature grid, and credit usage bars
- Font sizes increased across the entire app for readability (neutral +50%, matrix +30%)
- Activity log dividers thinned and softened
- Dashboard stat cards visually unified into merged rows
- Settings default tab changed from Account to General
- About description updated to "Desktop Activity Tracker"

### Website
- Added Changelog page with full version history
- Updated tier descriptions with credit limits
- Replaced guild references with team references
- "EQUIPPED FOR BATTLE" heading changed to "YOUR TOOLKIT"
- Removed village references from FAQ

## v1.4.1 — 2026-02-27
**PATCH** — Security Hardening & Performance Fixes
- Fixed: profile update now whitelists allowed fields only (avatar_color, custom_title, profile_frame, bio)
- Fixed: friend request accept/decline now requires auth + verifies you are the addressee
- Fixed: friend removal now scoped to your own friendships only
- Fixed: search wildcards (% and _) escaped in user search and guild search
- Fixed: UUID validation on all direct message and friend request endpoints
- Fixed: XSS — all unescaped app names, categories, and site names in dashboard now use escapeHtml()
- Fixed: referral signup no longer exposes referrer UUID — code resolved server-side in DB trigger
- Fixed: claim-referral-reward uses idempotent upsert (race condition safe)
- Fixed: XP fallback bug in referral reward claiming removed
- Fixed: shell injection — removed shell:true from VS Code and Terminal launch commands
- Fixed: validate-referral, claim-referral-reward, stripe-webhook, create-checkout-session return generic error messages
- Fixed: stripe-webhook returns 200 on handler errors to prevent Stripe retry loops
- Fixed: name change rate limit (2/month) now enforced on website account page (was only in desktop app)
- Security: game state values capped (xp ≤ 10M, level ≤ 100, streak ≤ 3,650)
- Security: settings validation — poll interval 3-60s, idle timeout 1-60min
- Security: tracker date range capped to 365 days max
- Security: project scan restricted to configured projects folder
- Security: app:openExternal restricted to whitelisted domains (spiros.app, getspiros.com, github.com, stripe.com, supabase.com)
- Security: admin tier check uses UUID instead of display name
- Security: deleteAccount now cleans referral_rewards and referrals tables
- Performance: cloud sync only uploads today's data (was 7 days per interval)
- Performance: pullCloudToLocal limited to 90 days (was unbounded)
- Performance: leaderboard no longer pre-syncs profile on every load
- Performance: cached user ID for presence, online friends, search, and leaderboard (5-min TTL)
- Performance: profile page uses game state stats instead of unbounded getRange('2020-01-01')
- Password minimum increased from 6 to 8 characters (desktop + website)
- SQL migration: handle_new_user trigger resolves referral codes server-side
- SQL migration: added indexes for presence, level, xp, and streak queries

## v1.4.0 — 2026-02-27
**MINOR** — Referral Program + Presence Optimization
- Referral system: invite friends with your unique 8-character code, earn milestone rewards
- 6 referral milestones: XP bonuses, exclusive "Referral Blue" avatar color, profile frames, free subscription months, Ambassador title
- Referred users get a 7-day free Starter trial (card required, auto-charges if not cancelled)
- Referral code input on signup (desktop app + website), auto-fills from ?ref= share links
- Profile page: referral code display, copy/share buttons, progress bar, milestone tracker with claim buttons
- Website account page: referral section with code, stats, and milestone preview
- Website signup: live referral code validation with "Referred by [name]" confirmation
- Trial checkout flow: referred users redirected to start 7-day Starter trial after email confirmation
- 6 new referral achievements: Recruiter, Squad Builder, Team Captain, Commander, Ambassador, Legend Recruiter
- "Recruiter" and "Legend" profile frames added to customization options
- Anti-abuse: server-generated codes, server-side validation, one referral per account, completes only after Stripe subscription
- Replaced Realtime Presence WebSocket with DB-based presence (online/afk/offline status)
- Replaced Realtime subscription-changes channel with 5-minute polling
- Presence updates on activity state changes instead of constant heartbeats — massive reduction in database calls

## v1.3.1 — 2026-02-26
**PATCH** — 4-Tier Pricing + 3-Theme System
- Restructured pricing: Free / Starter ($3.99/mo) / Pro ($9.99/mo) / Max ($19.99/mo) with 25% annual discount
- New Starter tier: unlimited projects, cloud sync, data export, all chat channels, community submissions, friend comparison
- Pro tier: DMs + reactions, advanced analytics, global leaderboard, weekly challenges, streak freeze, profile customization
- Max tier: guild creation, profile frames, 1.5x XP bonus, 2-year data retention
- Added 3-theme system: AAA Neutral (default), Pixel Game, Matrix Hacker
- AAA Neutral: Inter font, rounded corners, soft shadows, muted gold palette
- Pixel Game: Press Start 2P, beveled borders, scanlines, classic RPG aesthetic
- Matrix Hacker: JetBrains Mono, green-on-black terminal, glow effects
- Theme picker in Settings with live preview cards
- Free users locked to AAA Neutral; Starter+ unlock all 3 themes
- Theme persists across app restarts
- Refactored ~37 hardcoded font declarations to CSS variables for theme support
- Website: 4-column pricing grid, theme picker in header, ThemeProvider context
- Fixed account page tier display (was showing wrong tier names)
- Database migration script for tier restructure (team → max)

## v1.3.0 — 2026-02-26
**MINOR** — 3-Tier Subscription System (Free / Pro / Team)
- Stripe-powered subscriptions with monthly and yearly billing
- Upgrade modal and subscription management in Settings
- Pro features: global leaderboard, weekly challenges, advanced analytics, data export, cloud sync, unlimited projects, all chat channels + DMs, reactions, friend stat comparison, community submissions, profile customization
- Team features: guild creation + management, guild analytics, profile frames, 1.5x XP bonus
- Pro gets 1.25x XP bonus, streak freeze (1/week)
- Free tier: 1 project, 50 chat messages/day, friends leaderboard only
- Peak hours heatmap and 4-week productivity trend (Pro)
- CSV export option alongside JSON
- Bug fixes: chat reaction error handling, emoji picker cleanup, duplicate CSS

## v1.2.1 — 2026-02-26
**PATCH** — Rebrand Synchron to Spiros, remove unused village code

## v1.2.0 — 2026-02-26
**MINOR** — Forgot password, auto-update toggle, cookie banner, CI release fixes

## v1.1.0 — 2026-02-26
**MINOR** — Changelog tab, auto-release CI/CD pipeline

## v1.0.0 — 2026-02-25
**MAJOR** — Initial production release
- Activity tracking with privacy controls
- Gamification system with XP, levels, and achievements
- Dashboard, Projects, Friends, Achievements, Settings tabs
- Supabase cloud sync + offline support
- Semantic versioning system
