# Spiros Changelog

All notable changes to Spiros are documented here.
Format: [Semantic Versioning](https://semver.org/) — MAJOR.MINOR.PATCH

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
