# Spiros Changelog

All notable changes to Spiros are documented here.
Format: [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH

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
- Village metagame with 3D WebGL rendering (Three.js)
- Military expansion: barracks, training ground, 4 weapon buildings, 5 troop tiers
- Full deploy + watch raid system with tick-based battle simulation
- Floating island sky theme with clouds
- Tile-based shop UI with building previews
- Dashboard, Projects, Friends, Achievements, Settings tabs
- Supabase cloud sync + offline support
- Semantic versioning system
