// gamification.js — XP, levels, achievements, streaks (tracking-focused)

const Gamification = (() => {
  const LEVEL_THRESHOLDS = [
    0, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600,
    51200, 102400, 150000, 200000, 260000, 330000, 410000, 500000, 600000, 720000,
    850000, 1000000, 1200000, 1450000, 1700000
  ];

  const TITLES = {
    1: 'Novice', 2: 'Novice', 3: 'Apprentice', 4: 'Apprentice',
    5: 'Journeyman', 6: 'Journeyman', 7: 'Journeyman',
    8: 'Code Knight', 9: 'Code Knight', 10: 'Code Knight', 11: 'Code Knight',
    12: 'Architect', 13: 'Architect', 14: 'Architect', 15: 'Architect',
    16: 'Master Builder', 17: 'Master Builder', 18: 'Master Builder', 19: 'Master Builder',
    20: 'Grandmaster', 21: 'Grandmaster', 22: 'Grandmaster', 23: 'Grandmaster', 24: 'Grandmaster',
    25: 'Legend'
  };

  const XP_MULTIPLIERS = {
    coding: 1.5,
    music: 1.2,
    design: 1.1,
    browsing: 0.8,
    gaming: 0.7,
    communication: 0.6,
    other: 0.5
  };

  // ===== Achievement Categories =====
  const ACHIEVEMENT_CATEGORIES = [
    { id: 'time',       name: 'Time Tracked',   icon: '⏱' },
    { id: 'streak',     name: 'Streaks',         icon: '🔥' },
    { id: 'focus',      name: 'Focus',           icon: '🧘' },
    { id: 'coding',     name: 'Coding',          icon: '💻' },
    { id: 'music',      name: 'Music',           icon: '🎵' },
    { id: 'design',     name: 'Design',          icon: '🎨' },
    { id: 'browsing',   name: 'Browsing',        icon: '🌐' },
    { id: 'gaming',     name: 'Gaming',          icon: '🎮' },
    { id: 'communication', name: 'Communication', icon: '💬' },
    { id: 'schedule',   name: 'Schedule',        icon: '🕐' },
    { id: 'variety',    name: 'Variety',         icon: '🎭' },
    { id: 'level',      name: 'Leveling',        icon: '⭐' },
    { id: 'input',      name: 'Input',           icon: '⌨' },
    { id: 'milestones', name: 'Milestones',      icon: '🏆' },
  ];

  // Helper: ms to hours
  const h = (hours) => hours * 3600000;
  const m = (mins) => mins * 60000;

  // ===== 200+ Achievements =====
  const ACHIEVEMENTS = [
    // ── Time Tracked (25) ──
    { id: 'time_1h',      cat: 'time', name: 'Getting Started',     desc: 'Track 1 hour total',             icon: '⏱', check: s => s.totalMs >= h(1) },
    { id: 'time_5h',      cat: 'time', name: 'Warming Up',          desc: 'Track 5 hours total',            icon: '⏱', check: s => s.totalMs >= h(5) },
    { id: 'time_10h',     cat: 'time', name: 'Double Digits',       desc: 'Track 10 hours total',           icon: '⏱', check: s => s.totalMs >= h(10) },
    { id: 'time_25h',     cat: 'time', name: 'Quarter Century',     desc: 'Track 25 hours total',           icon: '⏱', check: s => s.totalMs >= h(25) },
    { id: 'time_50h',     cat: 'time', name: 'Halfway There',       desc: 'Track 50 hours total',           icon: '⏱', check: s => s.totalMs >= h(50) },
    { id: 'time_100h',    cat: 'time', name: 'Century Club',        desc: 'Track 100 hours total',          icon: '💯', check: s => s.totalMs >= h(100) },
    { id: 'time_200h',    cat: 'time', name: 'Bicentennial',        desc: 'Track 200 hours total',          icon: '🕰', check: s => s.totalMs >= h(200) },
    { id: 'time_500h',    cat: 'time', name: 'Half a Grand',        desc: 'Track 500 hours total',          icon: '🕰', check: s => s.totalMs >= h(500) },
    { id: 'time_1000h',   cat: 'time', name: 'Thousand Hour Club',  desc: 'Track 1,000 hours total',        icon: '🏅', check: s => s.totalMs >= h(1000) },
    { id: 'time_2500h',   cat: 'time', name: 'Time Lord',           desc: 'Track 2,500 hours total',        icon: '👑', check: s => s.totalMs >= h(2500) },
    { id: 'time_5000h',   cat: 'time', name: 'Eternal Tracker',     desc: 'Track 5,000 hours total',        icon: '💎', check: s => s.totalMs >= h(5000) },
    { id: 'day_1h',       cat: 'time', name: 'Daily Dip',           desc: 'Track 1 hour in a single day',   icon: '📅', check: s => s.dayMs >= h(1) },
    { id: 'day_2h',       cat: 'time', name: 'Solid Session',       desc: 'Track 2 hours in a single day',  icon: '📅', check: s => s.dayMs >= h(2) },
    { id: 'day_4h',       cat: 'time', name: 'Half Day Warrior',    desc: 'Track 4 hours in a single day',  icon: '🌗', check: s => s.dayMs >= h(4) },
    { id: 'day_6h',       cat: 'time', name: 'Six Pack',            desc: 'Track 6 hours in a single day',  icon: '💪', check: s => s.dayMs >= h(6) },
    { id: 'day_8h',       cat: 'time', name: 'Full Workday',        desc: 'Track 8 hours in a single day',  icon: '🏃', check: s => s.dayMs >= h(8) },
    { id: 'day_10h',      cat: 'time', name: 'Overtime',            desc: 'Track 10 hours in a single day', icon: '⚡', check: s => s.dayMs >= h(10) },
    { id: 'day_12h',      cat: 'time', name: 'Marathon Runner',     desc: 'Track 12 hours in a single day', icon: '🏅', check: s => s.dayMs >= h(12) },
    { id: 'day_14h',      cat: 'time', name: 'Iron Will',           desc: 'Track 14 hours in a single day', icon: '🔩', check: s => s.dayMs >= h(14) },
    { id: 'day_16h',      cat: 'time', name: 'No Sleep Needed',     desc: 'Track 16 hours in a single day', icon: '☕', check: s => s.dayMs >= h(16) },
    { id: 'days_7',       cat: 'time', name: 'Week Tracker',        desc: 'Track on 7 different days',       icon: '📆', check: s => s.totalDays >= 7 },
    { id: 'days_30',      cat: 'time', name: 'Monthly Tracker',     desc: 'Track on 30 different days',      icon: '📆', check: s => s.totalDays >= 30 },
    { id: 'days_100',     cat: 'time', name: 'Centurion',           desc: 'Track on 100 different days',     icon: '📆', check: s => s.totalDays >= 100 },
    { id: 'days_365',     cat: 'time', name: 'Year-Round Tracker',  desc: 'Track on 365 different days',     icon: '🗓', check: s => s.totalDays >= 365 },
    { id: 'days_500',     cat: 'time', name: 'Dedicated Soul',      desc: 'Track on 500 different days',     icon: '🗓', check: s => s.totalDays >= 500 },

    // ── Streaks (22) ──
    { id: 'streak_2',     cat: 'streak', name: 'Back Again',          desc: '2-day streak',                icon: '🔥', check: s => s.streak >= 2 },
    { id: 'streak_3',     cat: 'streak', name: 'Getting Consistent',  desc: '3-day streak',                icon: '🔥', check: s => s.streak >= 3 },
    { id: 'streak_5',     cat: 'streak', name: 'On a Roll',           desc: '5-day streak',                icon: '🔥', check: s => s.streak >= 5 },
    { id: 'streak_7',     cat: 'streak', name: 'Week Warrior',        desc: '7-day streak',                icon: '💪', check: s => s.streak >= 7 },
    { id: 'streak_10',    cat: 'streak', name: 'Tenacious',           desc: '10-day streak',               icon: '💪', check: s => s.streak >= 10 },
    { id: 'streak_14',    cat: 'streak', name: 'Unstoppable',         desc: '14-day streak',               icon: '⚡', check: s => s.streak >= 14 },
    { id: 'streak_21',    cat: 'streak', name: 'Habit Formed',        desc: '21-day streak',               icon: '🧠', check: s => s.streak >= 21 },
    { id: 'streak_30',    cat: 'streak', name: 'Monthly Legend',      desc: '30-day streak',               icon: '👑', check: s => s.streak >= 30 },
    { id: 'streak_45',    cat: 'streak', name: 'Relentless',          desc: '45-day streak',               icon: '🔱', check: s => s.streak >= 45 },
    { id: 'streak_60',    cat: 'streak', name: 'Two Months Strong',   desc: '60-day streak',               icon: '🛡', check: s => s.streak >= 60 },
    { id: 'streak_90',    cat: 'streak', name: 'Quarter Year',        desc: '90-day streak',               icon: '🏆', check: s => s.streak >= 90 },
    { id: 'streak_120',   cat: 'streak', name: 'Unshakeable',         desc: '120-day streak',              icon: '🏆', check: s => s.streak >= 120 },
    { id: 'streak_150',   cat: 'streak', name: 'Iron Discipline',     desc: '150-day streak',              icon: '🔩', check: s => s.streak >= 150 },
    { id: 'streak_180',   cat: 'streak', name: 'Half Year Hero',      desc: '180-day streak',              icon: '💎', check: s => s.streak >= 180 },
    { id: 'streak_240',   cat: 'streak', name: 'Consistency King',    desc: '240-day streak',              icon: '💎', check: s => s.streak >= 240 },
    { id: 'streak_300',   cat: 'streak', name: 'Legendary Streak',    desc: '300-day streak',              icon: '🌟', check: s => s.streak >= 300 },
    { id: 'streak_365',   cat: 'streak', name: 'Year of Devotion',    desc: '365-day streak',              icon: '🌟', check: s => s.streak >= 365 },
    { id: 'streak_500',   cat: 'streak', name: 'Eternal Flame',       desc: '500-day streak',              icon: '🌟', check: s => s.streak >= 500 },
    { id: 'best_streak_7',  cat: 'streak', name: 'Personal Best: Week',  desc: 'Best streak reaches 7 days',   icon: '📊', check: s => s.bestStreak >= 7 },
    { id: 'best_streak_30', cat: 'streak', name: 'Personal Best: Month', desc: 'Best streak reaches 30 days',  icon: '📊', check: s => s.bestStreak >= 30 },
    { id: 'best_streak_100',cat: 'streak', name: 'Personal Best: 100',   desc: 'Best streak reaches 100 days', icon: '📊', check: s => s.bestStreak >= 100 },
    { id: 'best_streak_365',cat: 'streak', name: 'Personal Best: Year',  desc: 'Best streak reaches 365 days', icon: '📊', check: s => s.bestStreak >= 365 },

    // ── Focus (20) ──
    { id: 'focus_10m',    cat: 'focus', name: 'Baby Steps',           desc: '10 min uninterrupted session',    icon: '🧘', check: s => s.longestFocus >= m(10) },
    { id: 'focus_15m',    cat: 'focus', name: 'Quarter Hour',         desc: '15 min uninterrupted session',    icon: '🧘', check: s => s.longestFocus >= m(15) },
    { id: 'focus_30m',    cat: 'focus', name: 'Deep Focus',           desc: '30 min uninterrupted session',    icon: '🧘', check: s => s.longestFocus >= m(30) },
    { id: 'focus_45m',    cat: 'focus', name: 'Pomodoro Plus',        desc: '45 min uninterrupted session',    icon: '🍅', check: s => s.longestFocus >= m(45) },
    { id: 'focus_60m',    cat: 'focus', name: 'Flow State',           desc: '60 min uninterrupted session',    icon: '🌊', check: s => s.longestFocus >= m(60) },
    { id: 'focus_90m',    cat: 'focus', name: 'Ultra Focus',          desc: '90 min uninterrupted session',    icon: '🌊', check: s => s.longestFocus >= m(90) },
    { id: 'focus_120m',   cat: 'focus', name: 'Two Hour Tunnel',      desc: '2 hour uninterrupted session',    icon: '🔮', check: s => s.longestFocus >= m(120) },
    { id: 'focus_180m',   cat: 'focus', name: 'Hyperfocus',           desc: '3 hour uninterrupted session',    icon: '🔮', check: s => s.longestFocus >= m(180) },
    { id: 'focus_240m',   cat: 'focus', name: 'Zen Master',           desc: '4 hour uninterrupted session',    icon: '💎', check: s => s.longestFocus >= m(240) },
    { id: 'focus_300m',   cat: 'focus', name: 'Transcendence',        desc: '5 hour uninterrupted session',    icon: '💎', check: s => s.longestFocus >= m(300) },
    { id: 'focus_total_1h',  cat: 'focus', name: 'Focused Hour',      desc: '1 hr total focus (30m+ sessions)',  icon: '⏳', check: s => s.totalFocusMs >= h(1) },
    { id: 'focus_total_10h', cat: 'focus', name: 'Focused Tenner',    desc: '10 hrs total focus (30m+ sessions)', icon: '⏳', check: s => s.totalFocusMs >= h(10) },
    { id: 'focus_total_50h', cat: 'focus', name: 'Focus Addict',      desc: '50 hrs total focus (30m+ sessions)', icon: '⏳', check: s => s.totalFocusMs >= h(50) },
    { id: 'focus_total_100h',cat: 'focus', name: 'Focus Legend',      desc: '100 hrs total focus (30m+ sessions)', icon: '⏳', check: s => s.totalFocusMs >= h(100) },
    { id: 'focus_sessions_10',  cat: 'focus', name: 'Repeat Focuser',   desc: '10 focus sessions (30m+)',  icon: '🔁', check: s => s.focusSessions >= 10 },
    { id: 'focus_sessions_50',  cat: 'focus', name: 'Focus Veteran',    desc: '50 focus sessions (30m+)',  icon: '🔁', check: s => s.focusSessions >= 50 },
    { id: 'focus_sessions_100', cat: 'focus', name: 'Focus Machine',    desc: '100 focus sessions (30m+)', icon: '🔁', check: s => s.focusSessions >= 100 },
    { id: 'focus_sessions_250', cat: 'focus', name: 'Focus Grandmaster', desc: '250 focus sessions (30m+)', icon: '🔁', check: s => s.focusSessions >= 250 },
    { id: 'focus_sessions_500', cat: 'focus', name: 'Eternal Focus',    desc: '500 focus sessions (30m+)', icon: '🔁', check: s => s.focusSessions >= 500 },
    { id: 'focus_no_switch',    cat: 'focus', name: 'Laser Beam',       desc: 'Use only 1 app for 60+ min', icon: '🎯', check: s => s.singleAppFocus >= m(60) },

    // ── Coding (22) ──
    { id: 'code_1h',      cat: 'coding', name: 'Hello World',         desc: 'Code for 1 hour total',          icon: '💻', check: s => (s.catTotals.coding || 0) >= h(1) },
    { id: 'code_5h',      cat: 'coding', name: 'Script Kiddie',       desc: 'Code for 5 hours total',         icon: '💻', check: s => (s.catTotals.coding || 0) >= h(5) },
    { id: 'code_10h',     cat: 'coding', name: 'Code Warrior',        desc: 'Code for 10 hours total',        icon: '💻', check: s => (s.catTotals.coding || 0) >= h(10) },
    { id: 'code_25h',     cat: 'coding', name: 'Bug Hunter',          desc: 'Code for 25 hours total',        icon: '🐛', check: s => (s.catTotals.coding || 0) >= h(25) },
    { id: 'code_50h',     cat: 'coding', name: 'Code Master',         desc: 'Code for 50 hours total',        icon: '🖥', check: s => (s.catTotals.coding || 0) >= h(50) },
    { id: 'code_100h',    cat: 'coding', name: 'Centurion Coder',     desc: 'Code for 100 hours total',       icon: '🏅', check: s => (s.catTotals.coding || 0) >= h(100) },
    { id: 'code_250h',    cat: 'coding', name: 'Senior Dev',          desc: 'Code for 250 hours total',       icon: '🏅', check: s => (s.catTotals.coding || 0) >= h(250) },
    { id: 'code_500h',    cat: 'coding', name: 'Code Legend',         desc: 'Code for 500 hours total',       icon: '👑', check: s => (s.catTotals.coding || 0) >= h(500) },
    { id: 'code_1000h',   cat: 'coding', name: '10x Engineer',        desc: 'Code for 1,000 hours total',     icon: '💎', check: s => (s.catTotals.coding || 0) >= h(1000) },
    { id: 'code_2000h',   cat: 'coding', name: 'Code Deity',          desc: 'Code for 2,000 hours total',     icon: '🌟', check: s => (s.catTotals.coding || 0) >= h(2000) },
    { id: 'code_day_1h',  cat: 'coding', name: 'Quick Fix',           desc: 'Code 1 hour in a single day',    icon: '⚙', check: s => (s.dayCatMs.coding || 0) >= h(1) },
    { id: 'code_day_2h',  cat: 'coding', name: 'Productive Session',  desc: 'Code 2 hours in a single day',   icon: '⚙', check: s => (s.dayCatMs.coding || 0) >= h(2) },
    { id: 'code_day_4h',  cat: 'coding', name: 'Deep Dive',           desc: 'Code 4 hours in a single day',   icon: '🔧', check: s => (s.dayCatMs.coding || 0) >= h(4) },
    { id: 'code_day_6h',  cat: 'coding', name: 'Hackathon Mode',      desc: 'Code 6 hours in a single day',   icon: '🔧', check: s => (s.dayCatMs.coding || 0) >= h(6) },
    { id: 'code_day_8h',  cat: 'coding', name: 'Full Stack Day',      desc: 'Code 8 hours in a single day',   icon: '🏗', check: s => (s.dayCatMs.coding || 0) >= h(8) },
    { id: 'code_day_10h', cat: 'coding', name: 'Code Marathon',       desc: 'Code 10 hours in a single day',  icon: '🏗', check: s => (s.dayCatMs.coding || 0) >= h(10) },
    { id: 'code_streak_3',  cat: 'coding', name: 'Code Habit',        desc: 'Code 3 days in a row',           icon: '🔥', check: s => s.codeStreak >= 3 },
    { id: 'code_streak_7',  cat: 'coding', name: 'Code Week',         desc: 'Code 7 days in a row',           icon: '🔥', check: s => s.codeStreak >= 7 },
    { id: 'code_streak_14', cat: 'coding', name: 'Code Fortnight',    desc: 'Code 14 days in a row',          icon: '⚡', check: s => s.codeStreak >= 14 },
    { id: 'code_streak_30', cat: 'coding', name: 'Code Month',        desc: 'Code 30 days in a row',          icon: '👑', check: s => s.codeStreak >= 30 },
    { id: 'code_apps_3',    cat: 'coding', name: 'Multi-Editor',      desc: 'Use 3 different code editors',   icon: '📝', check: s => s.codeApps >= 3 },
    { id: 'code_apps_5',    cat: 'coding', name: 'Editor Hopper',     desc: 'Use 5 different code editors',   icon: '📝', check: s => s.codeApps >= 5 },

    // ── Music (15) ──
    { id: 'music_1h',     cat: 'music', name: 'First Note',           desc: 'Spend 1 hour in music apps',      icon: '🎵', check: s => (s.catTotals.music || 0) >= h(1) },
    { id: 'music_5h',     cat: 'music', name: 'Warm Up Act',          desc: 'Spend 5 hours in music apps',     icon: '🎵', check: s => (s.catTotals.music || 0) >= h(5) },
    { id: 'music_10h',    cat: 'music', name: 'Music Maker',          desc: 'Spend 10 hours in music apps',    icon: '🎵', check: s => (s.catTotals.music || 0) >= h(10) },
    { id: 'music_25h',    cat: 'music', name: 'Beat Crafter',         desc: 'Spend 25 hours in music apps',    icon: '🎶', check: s => (s.catTotals.music || 0) >= h(25) },
    { id: 'music_50h',    cat: 'music', name: 'Sound Designer',       desc: 'Spend 50 hours in music apps',    icon: '🎶', check: s => (s.catTotals.music || 0) >= h(50) },
    { id: 'music_100h',   cat: 'music', name: 'Producer',             desc: 'Spend 100 hours in music apps',   icon: '🎧', check: s => (s.catTotals.music || 0) >= h(100) },
    { id: 'music_250h',   cat: 'music', name: 'Virtuoso',             desc: 'Spend 250 hours in music apps',   icon: '🎧', check: s => (s.catTotals.music || 0) >= h(250) },
    { id: 'music_500h',   cat: 'music', name: 'Music Legend',         desc: 'Spend 500 hours in music apps',   icon: '🎸', check: s => (s.catTotals.music || 0) >= h(500) },
    { id: 'music_1000h',  cat: 'music', name: 'Maestro',              desc: 'Spend 1,000 hours in music apps', icon: '🎸', check: s => (s.catTotals.music || 0) >= h(1000) },
    { id: 'music_day_1h', cat: 'music', name: 'Quick Jam',            desc: 'Music for 1 hour in a day',       icon: '🎹', check: s => (s.dayCatMs.music || 0) >= h(1) },
    { id: 'music_day_2h', cat: 'music', name: 'Studio Session',       desc: 'Music for 2 hours in a day',      icon: '🎹', check: s => (s.dayCatMs.music || 0) >= h(2) },
    { id: 'music_day_4h', cat: 'music', name: 'Full Session',         desc: 'Music for 4 hours in a day',      icon: '🎤', check: s => (s.dayCatMs.music || 0) >= h(4) },
    { id: 'music_day_8h', cat: 'music', name: 'Album Day',            desc: 'Music for 8 hours in a day',      icon: '🎤', check: s => (s.dayCatMs.music || 0) >= h(8) },
    { id: 'music_streak_7',  cat: 'music', name: 'Daily Beats',       desc: 'Music 7 days in a row',           icon: '🔥', check: s => s.musicStreak >= 7 },
    { id: 'music_streak_30', cat: 'music', name: 'Monthly Musician',  desc: 'Music 30 days in a row',          icon: '👑', check: s => s.musicStreak >= 30 },

    // ── Design (14) ──
    { id: 'design_1h',    cat: 'design', name: 'First Sketch',        desc: 'Spend 1 hour in design apps',     icon: '🎨', check: s => (s.catTotals.design || 0) >= h(1) },
    { id: 'design_5h',    cat: 'design', name: 'Color Picker',        desc: 'Spend 5 hours in design apps',    icon: '🎨', check: s => (s.catTotals.design || 0) >= h(5) },
    { id: 'design_10h',   cat: 'design', name: 'Pixel Pusher',        desc: 'Spend 10 hours in design apps',   icon: '🎨', check: s => (s.catTotals.design || 0) >= h(10) },
    { id: 'design_25h',   cat: 'design', name: 'Visual Thinker',      desc: 'Spend 25 hours in design apps',   icon: '🖌', check: s => (s.catTotals.design || 0) >= h(25) },
    { id: 'design_50h',   cat: 'design', name: 'UI Architect',        desc: 'Spend 50 hours in design apps',   icon: '🖌', check: s => (s.catTotals.design || 0) >= h(50) },
    { id: 'design_100h',  cat: 'design', name: 'Design Master',       desc: 'Spend 100 hours in design apps',  icon: '🖼', check: s => (s.catTotals.design || 0) >= h(100) },
    { id: 'design_250h',  cat: 'design', name: 'Creative Director',   desc: 'Spend 250 hours in design apps',  icon: '🖼', check: s => (s.catTotals.design || 0) >= h(250) },
    { id: 'design_500h',  cat: 'design', name: 'Design Legend',       desc: 'Spend 500 hours in design apps',  icon: '👑', check: s => (s.catTotals.design || 0) >= h(500) },
    { id: 'design_day_1h',  cat: 'design', name: 'Design Sprint',     desc: 'Design for 1 hour in a day',      icon: '✏', check: s => (s.dayCatMs.design || 0) >= h(1) },
    { id: 'design_day_2h',  cat: 'design', name: 'Mockup Marathon',   desc: 'Design for 2 hours in a day',     icon: '✏', check: s => (s.dayCatMs.design || 0) >= h(2) },
    { id: 'design_day_4h',  cat: 'design', name: 'Pixel Perfect Day', desc: 'Design for 4 hours in a day',     icon: '🖍', check: s => (s.dayCatMs.design || 0) >= h(4) },
    { id: 'design_day_8h',  cat: 'design', name: 'Design Immersion',  desc: 'Design for 8 hours in a day',     icon: '🖍', check: s => (s.dayCatMs.design || 0) >= h(8) },
    { id: 'design_streak_7',  cat: 'design', name: 'Design Week',     desc: 'Design 7 days in a row',          icon: '🔥', check: s => s.designStreak >= 7 },
    { id: 'design_streak_30', cat: 'design', name: 'Design Month',    desc: 'Design 30 days in a row',         icon: '👑', check: s => s.designStreak >= 30 },

    // ── Browsing (12) ──
    { id: 'browse_1h',    cat: 'browsing', name: 'Web Wanderer',      desc: 'Browse for 1 hour total',         icon: '🌐', check: s => (s.catTotals.browsing || 0) >= h(1) },
    { id: 'browse_10h',   cat: 'browsing', name: 'Research Mode',     desc: 'Browse for 10 hours total',       icon: '🌐', check: s => (s.catTotals.browsing || 0) >= h(10) },
    { id: 'browse_50h',   cat: 'browsing', name: 'Internet Explorer', desc: 'Browse for 50 hours total',       icon: '🔍', check: s => (s.catTotals.browsing || 0) >= h(50) },
    { id: 'browse_100h',  cat: 'browsing', name: 'Web Archaeologist', desc: 'Browse for 100 hours total',      icon: '🔍', check: s => (s.catTotals.browsing || 0) >= h(100) },
    { id: 'browse_250h',  cat: 'browsing', name: 'Digital Nomad',     desc: 'Browse for 250 hours total',      icon: '🗺', check: s => (s.catTotals.browsing || 0) >= h(250) },
    { id: 'browse_500h',  cat: 'browsing', name: 'Web Legend',        desc: 'Browse for 500 hours total',      icon: '🗺', check: s => (s.catTotals.browsing || 0) >= h(500) },
    { id: 'browse_day_1h',  cat: 'browsing', name: 'Quick Surf',      desc: 'Browse 1 hour in a day',          icon: '🏄', check: s => (s.dayCatMs.browsing || 0) >= h(1) },
    { id: 'browse_day_2h',  cat: 'browsing', name: 'Deep Research',   desc: 'Browse 2 hours in a day',         icon: '🏄', check: s => (s.dayCatMs.browsing || 0) >= h(2) },
    { id: 'browse_day_4h',  cat: 'browsing', name: 'Rabbit Hole',     desc: 'Browse 4 hours in a day',         icon: '🐇', check: s => (s.dayCatMs.browsing || 0) >= h(4) },
    { id: 'browse_day_8h',  cat: 'browsing', name: 'Web Marathon',    desc: 'Browse 8 hours in a day',         icon: '🐇', check: s => (s.dayCatMs.browsing || 0) >= h(8) },
    { id: 'browse_streak_7',  cat: 'browsing', name: 'Daily Surfer',  desc: 'Browse 7 days in a row',          icon: '🔥', check: s => s.browseStreak >= 7 },
    { id: 'browse_streak_30', cat: 'browsing', name: 'Web Warrior',   desc: 'Browse 30 days in a row',         icon: '👑', check: s => s.browseStreak >= 30 },

    // ── Gaming (12) ──
    { id: 'game_1h',      cat: 'gaming', name: 'Player One',          desc: 'Game for 1 hour total',           icon: '🎮', check: s => (s.catTotals.gaming || 0) >= h(1) },
    { id: 'game_10h',     cat: 'gaming', name: 'Casual Gamer',        desc: 'Game for 10 hours total',         icon: '🎮', check: s => (s.catTotals.gaming || 0) >= h(10) },
    { id: 'game_50h',     cat: 'gaming', name: 'Dedicated Gamer',     desc: 'Game for 50 hours total',         icon: '🕹', check: s => (s.catTotals.gaming || 0) >= h(50) },
    { id: 'game_100h',    cat: 'gaming', name: 'Pro Gamer',           desc: 'Game for 100 hours total',        icon: '🕹', check: s => (s.catTotals.gaming || 0) >= h(100) },
    { id: 'game_250h',    cat: 'gaming', name: 'Elite Gamer',         desc: 'Game for 250 hours total',        icon: '🏆', check: s => (s.catTotals.gaming || 0) >= h(250) },
    { id: 'game_500h',    cat: 'gaming', name: 'Gaming Legend',       desc: 'Game for 500 hours total',        icon: '🏆', check: s => (s.catTotals.gaming || 0) >= h(500) },
    { id: 'game_day_1h',  cat: 'gaming', name: 'Quick Match',         desc: 'Game for 1 hour in a day',        icon: '🎲', check: s => (s.dayCatMs.gaming || 0) >= h(1) },
    { id: 'game_day_2h',  cat: 'gaming', name: 'Game Session',        desc: 'Game for 2 hours in a day',       icon: '🎲', check: s => (s.dayCatMs.gaming || 0) >= h(2) },
    { id: 'game_day_4h',  cat: 'gaming', name: 'LAN Party',           desc: 'Game for 4 hours in a day',       icon: '🎯', check: s => (s.dayCatMs.gaming || 0) >= h(4) },
    { id: 'game_day_8h',  cat: 'gaming', name: 'Gaming Marathon',     desc: 'Game for 8 hours in a day',       icon: '🎯', check: s => (s.dayCatMs.gaming || 0) >= h(8) },
    { id: 'game_streak_7',  cat: 'gaming', name: 'Daily Gamer',       desc: 'Game 7 days in a row',            icon: '🔥', check: s => s.gameStreak >= 7 },
    { id: 'game_streak_30', cat: 'gaming', name: 'Monthly Gamer',     desc: 'Game 30 days in a row',           icon: '👑', check: s => s.gameStreak >= 30 },

    // ── Communication (12) ──
    { id: 'comm_1h',      cat: 'communication', name: 'Ping!',           desc: 'Communicate for 1 hour total',   icon: '💬', check: s => (s.catTotals.communication || 0) >= h(1) },
    { id: 'comm_10h',     cat: 'communication', name: 'Chatty',          desc: 'Communicate for 10 hours total',  icon: '💬', check: s => (s.catTotals.communication || 0) >= h(10) },
    { id: 'comm_50h',     cat: 'communication', name: 'Social Butterfly', desc: 'Communicate for 50 hours total', icon: '🦋', check: s => (s.catTotals.communication || 0) >= h(50) },
    { id: 'comm_100h',    cat: 'communication', name: 'Networker',       desc: 'Communicate for 100 hours total', icon: '🤝', check: s => (s.catTotals.communication || 0) >= h(100) },
    { id: 'comm_250h',    cat: 'communication', name: 'Community Leader', desc: 'Communicate for 250 hours total', icon: '📣', check: s => (s.catTotals.communication || 0) >= h(250) },
    { id: 'comm_500h',    cat: 'communication', name: 'Social Legend',   desc: 'Communicate for 500 hours total', icon: '📣', check: s => (s.catTotals.communication || 0) >= h(500) },
    { id: 'comm_day_1h',  cat: 'communication', name: 'Meeting Mode',    desc: 'Communicate 1 hour in a day',     icon: '📞', check: s => (s.dayCatMs.communication || 0) >= h(1) },
    { id: 'comm_day_2h',  cat: 'communication', name: 'Call Day',        desc: 'Communicate 2 hours in a day',    icon: '📞', check: s => (s.dayCatMs.communication || 0) >= h(2) },
    { id: 'comm_day_4h',  cat: 'communication', name: 'Talk-a-thon',     desc: 'Communicate 4 hours in a day',    icon: '📱', check: s => (s.dayCatMs.communication || 0) >= h(4) },
    { id: 'comm_day_8h',  cat: 'communication', name: 'Meeting Marathon', desc: 'Communicate 8 hours in a day',   icon: '📱', check: s => (s.dayCatMs.communication || 0) >= h(8) },
    { id: 'comm_streak_7',  cat: 'communication', name: 'Weekly Chat',   desc: 'Communicate 7 days in a row',     icon: '🔥', check: s => s.commStreak >= 7 },
    { id: 'comm_streak_30', cat: 'communication', name: 'Social Month',  desc: 'Communicate 30 days in a row',    icon: '👑', check: s => s.commStreak >= 30 },

    // ── Schedule / Time of Day (22) ──
    { id: 'early_5am',    cat: 'schedule', name: 'Crack of Dawn',     desc: 'Start tracking before 5 AM',      icon: '🌅', check: s => s.startedBefore5 },
    { id: 'early_6am',    cat: 'schedule', name: 'Early Riser',       desc: 'Start tracking before 6 AM',      icon: '🌅', check: s => s.startedBefore6 },
    { id: 'early_7am',    cat: 'schedule', name: 'Early Bird',        desc: 'Start tracking before 7 AM',      icon: '🐦', check: s => s.startedBefore7 },
    { id: 'night_11pm',   cat: 'schedule', name: 'Night Shift',       desc: 'Track past 11 PM',                icon: '🌙', check: s => s.trackedPast11 },
    { id: 'night_midnight', cat: 'schedule', name: 'Night Owl',       desc: 'Track past midnight',             icon: '🦉', check: s => s.trackedPastMidnight },
    { id: 'night_2am',    cat: 'schedule', name: 'Witching Hour',     desc: 'Track past 2 AM',                 icon: '🦇', check: s => s.trackedPast2am },
    { id: 'night_4am',    cat: 'schedule', name: 'All-Nighter',       desc: 'Track past 4 AM',                 icon: '☠', check: s => s.trackedPast4am },
    { id: 'weekend_track', cat: 'schedule', name: 'Weekend Warrior',  desc: 'Track on a weekend',              icon: '🏖', check: s => s.trackedWeekend },
    { id: 'weekend_5',    cat: 'schedule', name: 'Weekend Regular',   desc: 'Track on 5 different weekends',    icon: '🏖', check: s => s.weekendDays >= 5 },
    { id: 'weekend_20',   cat: 'schedule', name: 'Weekend Devotee',   desc: 'Track on 20 different weekends',   icon: '🏖', check: s => s.weekendDays >= 20 },
    { id: 'weekend_50',   cat: 'schedule', name: 'No Days Off',       desc: 'Track on 50 different weekends',   icon: '💪', check: s => s.weekendDays >= 50 },
    { id: 'morning_1h',   cat: 'schedule', name: 'Morning Person',    desc: 'Track 1 hour before noon',        icon: '☀', check: s => s.morningMs >= h(1) },
    { id: 'morning_total_50h', cat: 'schedule', name: 'Dawn Warrior', desc: '50 hrs tracked before noon',      icon: '☀', check: s => s.totalMorningMs >= h(50) },
    { id: 'evening_1h',   cat: 'schedule', name: 'Evening Grinder',   desc: 'Track 1 hour after 6 PM',         icon: '🌆', check: s => s.eveningMs >= h(1) },
    { id: 'evening_total_50h', cat: 'schedule', name: 'Night Worker', desc: '50 hrs tracked after 6 PM',       icon: '🌆', check: s => s.totalEveningMs >= h(50) },
    { id: 'monday_4h',    cat: 'schedule', name: 'Monday Motivation', desc: 'Track 4 hours on a Monday',       icon: '📅', check: s => s.mondayMs >= h(4) },
    { id: 'friday_4h',    cat: 'schedule', name: 'Friday Finisher',   desc: 'Track 4 hours on a Friday',       icon: '📅', check: s => s.fridayMs >= h(4) },
    { id: 'sunday_4h',    cat: 'schedule', name: 'Sunday Scholar',    desc: 'Track 4 hours on a Sunday',       icon: '📅', check: s => s.sundayMs >= h(4) },
    { id: 'all_weekdays',   cat: 'schedule', name: 'Full Work Week',  desc: 'Track on all 5 weekdays in one week', icon: '✅', check: s => s.fullWorkWeek },
    { id: 'full_week',      cat: 'schedule', name: 'Perfect Week',    desc: 'Track all 7 days in one week',    icon: '✅', check: s => s.fullWeek },
    { id: 'every_hour',     cat: 'schedule', name: 'Around the Clock', desc: 'Track during all 24 hours (across days)', icon: '🕐', check: s => s.hoursTracked >= 24 },
    { id: 'lunch_coder',    cat: 'schedule', name: 'Lunch Coder',     desc: 'Code between 12-1 PM',            icon: '🥪', check: s => s.codedAtLunch },

    // ── Variety (18) ──
    { id: 'cats_2',        cat: 'variety', name: 'Dabbler',            desc: 'Use 2 categories in one day',     icon: '🎭', check: s => s.dayCatCount >= 2 },
    { id: 'cats_3',        cat: 'variety', name: 'Multi-Tasker',       desc: 'Use 3 categories in one day',     icon: '🎭', check: s => s.dayCatCount >= 3 },
    { id: 'cats_4',        cat: 'variety', name: 'Versatile',          desc: 'Use 4 categories in one day',     icon: '🎭', check: s => s.dayCatCount >= 4 },
    { id: 'cats_5',        cat: 'variety', name: 'Renaissance',        desc: 'Use 5 categories in one day',     icon: '🎭', check: s => s.dayCatCount >= 5 },
    { id: 'cats_6',        cat: 'variety', name: 'Polymath',           desc: 'Use 6 categories in one day',     icon: '🎭', check: s => s.dayCatCount >= 6 },
    { id: 'cats_7',        cat: 'variety', name: 'Jack of All Trades', desc: 'Use 7 categories in one day',     icon: '🃏', check: s => s.dayCatCount >= 7 },
    { id: 'cats_all',      cat: 'variety', name: 'Master of All',     desc: 'Use every category in one day',    icon: '🃏', check: s => s.dayCatCount >= 8 },
    { id: 'apps_5',        cat: 'variety', name: 'App Juggler',       desc: 'Use 5 different apps in a day',    icon: '🔀', check: s => s.dayAppCount >= 5 },
    { id: 'apps_10',       cat: 'variety', name: 'App Connoisseur',   desc: 'Use 10 different apps in a day',   icon: '🔀', check: s => s.dayAppCount >= 10 },
    { id: 'apps_15',       cat: 'variety', name: 'App Collector',     desc: 'Use 15 different apps in a day',   icon: '🔀', check: s => s.dayAppCount >= 15 },
    { id: 'apps_20',       cat: 'variety', name: 'App Hoarder',       desc: 'Use 20 different apps in a day',   icon: '📦', check: s => s.dayAppCount >= 20 },
    { id: 'total_apps_10', cat: 'variety', name: 'Explorer',          desc: 'Use 10 unique apps all time',      icon: '🧭', check: s => s.totalApps >= 10 },
    { id: 'total_apps_25', cat: 'variety', name: 'Software Sampler',  desc: 'Use 25 unique apps all time',      icon: '🧭', check: s => s.totalApps >= 25 },
    { id: 'total_apps_50', cat: 'variety', name: 'Tool Collector',    desc: 'Use 50 unique apps all time',      icon: '🧰', check: s => s.totalApps >= 50 },
    { id: 'total_apps_100',cat: 'variety', name: 'App Encyclopedia',  desc: 'Use 100 unique apps all time',     icon: '🧰', check: s => s.totalApps >= 100 },
    { id: 'switch_50',     cat: 'variety', name: 'Quick Switcher',    desc: '50 app switches in a day',         icon: '⚡', check: s => s.daySwitches >= 50 },
    { id: 'switch_100',    cat: 'variety', name: 'Context Master',    desc: '100 app switches in a day',        icon: '⚡', check: s => s.daySwitches >= 100 },
    { id: 'switch_200',    cat: 'variety', name: 'Chaos Agent',       desc: '200 app switches in a day',        icon: '🌪', check: s => s.daySwitches >= 200 },

    // ── Leveling (18) ──
    { id: 'level_2',      cat: 'level', name: 'Level Up!',            desc: 'Reach level 2',                   icon: '⭐', check: s => s.level >= 2 },
    { id: 'level_3',      cat: 'level', name: 'Getting There',        desc: 'Reach level 3',                   icon: '⭐', check: s => s.level >= 3 },
    { id: 'level_5',      cat: 'level', name: 'Rising Star',          desc: 'Reach level 5',                   icon: '⭐', check: s => s.level >= 5 },
    { id: 'level_7',      cat: 'level', name: 'Skilled',              desc: 'Reach level 7',                   icon: '🌟', check: s => s.level >= 7 },
    { id: 'level_10',     cat: 'level', name: 'Veteran',              desc: 'Reach level 10',                  icon: '🌟', check: s => s.level >= 10 },
    { id: 'level_12',     cat: 'level', name: 'Experienced',          desc: 'Reach level 12',                  icon: '🌟', check: s => s.level >= 12 },
    { id: 'level_15',     cat: 'level', name: 'Elite',                desc: 'Reach level 15',                  icon: '💫', check: s => s.level >= 15 },
    { id: 'level_17',     cat: 'level', name: 'Master',               desc: 'Reach level 17',                  icon: '💫', check: s => s.level >= 17 },
    { id: 'level_20',     cat: 'level', name: 'Grandmaster',          desc: 'Reach level 20',                  icon: '💎', check: s => s.level >= 20 },
    { id: 'level_22',     cat: 'level', name: 'Ascended',             desc: 'Reach level 22',                  icon: '💎', check: s => s.level >= 22 },
    { id: 'level_25',     cat: 'level', name: 'Legend',               desc: 'Reach level 25 (max)',            icon: '👑', check: s => s.level >= 25 },
    { id: 'xp_1000',      cat: 'level', name: 'First Thousand',       desc: 'Earn 1,000 XP',                   icon: '✨', check: s => s.totalXP >= 1000 },
    { id: 'xp_5000',      cat: 'level', name: 'XP Hunter',            desc: 'Earn 5,000 XP',                   icon: '✨', check: s => s.totalXP >= 5000 },
    { id: 'xp_10000',     cat: 'level', name: 'XP Hoarder',           desc: 'Earn 10,000 XP',                  icon: '✨', check: s => s.totalXP >= 10000 },
    { id: 'xp_50000',     cat: 'level', name: 'XP Millionaire',       desc: 'Earn 50,000 XP',                  icon: '💰', check: s => s.totalXP >= 50000 },
    { id: 'xp_100000',    cat: 'level', name: 'XP Legend',            desc: 'Earn 100,000 XP',                 icon: '💰', check: s => s.totalXP >= 100000 },
    { id: 'xp_500000',    cat: 'level', name: 'XP Titan',             desc: 'Earn 500,000 XP',                 icon: '🏛', check: s => s.totalXP >= 500000 },
    { id: 'xp_1000000',   cat: 'level', name: 'XP God',               desc: 'Earn 1,000,000 XP',              icon: '🏛', check: s => s.totalXP >= 1000000 },

    // ── Input / Keystrokes (16) ──
    { id: 'keys_1k',      cat: 'input', name: 'First Keystrokes',     desc: '1,000 keystrokes total',          icon: '⌨', check: s => s.totalKeys >= 1000 },
    { id: 'keys_10k',     cat: 'input', name: 'Typist',               desc: '10,000 keystrokes total',         icon: '⌨', check: s => s.totalKeys >= 10000 },
    { id: 'keys_50k',     cat: 'input', name: 'Fast Fingers',         desc: '50,000 keystrokes total',         icon: '⌨', check: s => s.totalKeys >= 50000 },
    { id: 'keys_100k',    cat: 'input', name: 'Keyboard Warrior',     desc: '100,000 keystrokes total',        icon: '🗡', check: s => s.totalKeys >= 100000 },
    { id: 'keys_500k',    cat: 'input', name: 'Lightning Fingers',    desc: '500,000 keystrokes total',        icon: '⚡', check: s => s.totalKeys >= 500000 },
    { id: 'keys_1m',      cat: 'input', name: 'Million Keys',         desc: '1,000,000 keystrokes total',      icon: '💎', check: s => s.totalKeys >= 1000000 },
    { id: 'keys_5m',      cat: 'input', name: 'Key Master',           desc: '5,000,000 keystrokes total',      icon: '👑', check: s => s.totalKeys >= 5000000 },
    { id: 'keys_day_5k',  cat: 'input', name: 'Busy Fingers',         desc: '5,000 keystrokes in a day',       icon: '🔤', check: s => s.dayKeys >= 5000 },
    { id: 'keys_day_10k', cat: 'input', name: 'Typing Frenzy',        desc: '10,000 keystrokes in a day',      icon: '🔤', check: s => s.dayKeys >= 10000 },
    { id: 'keys_day_25k', cat: 'input', name: 'Keyboard on Fire',     desc: '25,000 keystrokes in a day',      icon: '🔥', check: s => s.dayKeys >= 25000 },
    { id: 'clicks_1k',    cat: 'input', name: 'Clicker',              desc: '1,000 clicks total',              icon: '🖱', check: s => s.totalClicks >= 1000 },
    { id: 'clicks_10k',   cat: 'input', name: 'Click Machine',        desc: '10,000 clicks total',             icon: '🖱', check: s => s.totalClicks >= 10000 },
    { id: 'clicks_50k',   cat: 'input', name: 'Click Master',         desc: '50,000 clicks total',             icon: '🖱', check: s => s.totalClicks >= 50000 },
    { id: 'clicks_100k',  cat: 'input', name: 'Click Legend',          desc: '100,000 clicks total',            icon: '🖱', check: s => s.totalClicks >= 100000 },
    { id: 'scrolls_10k',  cat: 'input', name: 'Scroller',             desc: '10,000 scroll events total',      icon: '📜', check: s => s.totalScrolls >= 10000 },
    { id: 'scrolls_100k', cat: 'input', name: 'Infinite Scroll',      desc: '100,000 scroll events total',     icon: '📜', check: s => s.totalScrolls >= 100000 },

    // ── Milestones / Special (20) ──
    { id: 'first_day',    cat: 'milestones', name: 'Day One',          desc: 'Complete your first day of tracking', icon: '🏁', check: s => s.totalDays >= 1 },
    { id: 'ach_10',       cat: 'milestones', name: 'Collector',        desc: 'Unlock 10 achievements',          icon: '🏆', check: s => s.achCount >= 10 },
    { id: 'ach_25',       cat: 'milestones', name: 'Trophy Case',      desc: 'Unlock 25 achievements',          icon: '🏆', check: s => s.achCount >= 25 },
    { id: 'ach_50',       cat: 'milestones', name: 'Half Century',     desc: 'Unlock 50 achievements',          icon: '🏆', check: s => s.achCount >= 50 },
    { id: 'ach_75',       cat: 'milestones', name: 'Overachiever',     desc: 'Unlock 75 achievements',          icon: '🏆', check: s => s.achCount >= 75 },
    { id: 'ach_100',      cat: 'milestones', name: 'Centurion',        desc: 'Unlock 100 achievements',         icon: '💯', check: s => s.achCount >= 100 },
    { id: 'ach_150',      cat: 'milestones', name: 'Achievement Hunter', desc: 'Unlock 150 achievements',       icon: '🔍', check: s => s.achCount >= 150 },
    { id: 'ach_200',      cat: 'milestones', name: 'Completionist',    desc: 'Unlock 200 achievements',         icon: '💎', check: s => s.achCount >= 200 },
    { id: 'ach_all',      cat: 'milestones', name: 'Perfectionist',    desc: 'Unlock ALL achievements',         icon: '👑', check: s => s.achCount >= ACHIEVEMENTS.length - 1 },
    { id: 'code_and_music', cat: 'milestones', name: 'Code & Beats',   desc: 'Code and make music in same day', icon: '🎛', check: s => (s.dayCatMs.coding || 0) >= m(30) && (s.dayCatMs.music || 0) >= m(30) },
    { id: 'code_and_design', cat: 'milestones', name: 'Full Stack Creative', desc: 'Code and design in same day', icon: '🛠', check: s => (s.dayCatMs.coding || 0) >= m(30) && (s.dayCatMs.design || 0) >= m(30) },
    { id: 'triple_threat', cat: 'milestones', name: 'Triple Threat',   desc: 'Code, design, and music in same day', icon: '🔱', check: s => (s.dayCatMs.coding || 0) >= m(30) && (s.dayCatMs.design || 0) >= m(30) && (s.dayCatMs.music || 0) >= m(30) },
    { id: 'balanced_day',  cat: 'milestones', name: 'Balanced Day',    desc: 'No single category over 50% of day', icon: '⚖', check: s => s.balancedDay },
    { id: 'productive_day', cat: 'milestones', name: 'Productive Day', desc: '6+ hrs with coding/design/music > 70%', icon: '📈', check: s => s.productiveDay },
    { id: 'zero_gaming',   cat: 'milestones', name: 'All Business',    desc: '8+ hr day with no gaming',         icon: '💼', check: s => s.dayMs >= h(8) && !(s.dayCatMs.gaming || 0) },
    { id: 'zero_browse',   cat: 'milestones', name: 'Offline Mode',    desc: '4+ hr day with no browsing',       icon: '📵', check: s => s.dayMs >= h(4) && !(s.dayCatMs.browsing || 0) },
    { id: 'new_year',      cat: 'milestones', name: 'New Year Tracker', desc: 'Track on January 1st',            icon: '🎆', check: s => s.isNewYear },
    { id: 'halloween',     cat: 'milestones', name: 'Spooky Coder',    desc: 'Track on October 31st',            icon: '🎃', check: s => s.isHalloween },
    { id: 'friday_13',     cat: 'milestones', name: 'Fearless',         desc: 'Track on a Friday the 13th',       icon: '🖤', check: s => s.isFriday13 },
    { id: 'leap_day',      cat: 'milestones', name: 'Leap Day Logger',  desc: 'Track on February 29th',           icon: '🐸', check: s => s.isLeapDay },
  ];

  // ===== Core Functions =====
  function getLevelForXP(xp) {
    let level = 1;
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
      else break;
    }
    return Math.min(level, 25);
  }

  function getXPForLevel(level) {
    return LEVEL_THRESHOLDS[Math.min(level - 1, LEVEL_THRESHOLDS.length - 1)] || 0;
  }

  function getXPForNextLevel(level) {
    const idx = Math.min(level, LEVEL_THRESHOLDS.length - 1);
    return LEVEL_THRESHOLDS[idx] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  }

  function getTitle(level) {
    return TITLES[Math.min(level, 25)] || 'Legend';
  }

  function calcEntryXP(entry) {
    const minutes = entry.dur / 60000;
    const multiplier = XP_MULTIPLIERS[entry.cat] || 0.5;
    return Math.round(minutes * multiplier);
  }

  function updateStreak(gameState, todayMs) {
    const today = new Date().toISOString().split('T')[0];
    const streak = gameState.streak || { current: 0, best: 0, lastDate: null };

    if (todayMs < 3600000) return streak;
    if (streak.lastDate === today) return streak;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (streak.lastDate === yesterdayStr) {
      streak.current += 1;
    } else if (streak.lastDate !== today) {
      streak.current = 1;
    }

    streak.best = Math.max(streak.best, streak.current);
    streak.lastDate = today;
    return streak;
  }

  function checkAchievements(gameState, stats) {
    const earned = gameState.achievements || [];
    const newOnes = [];

    for (const ach of ACHIEVEMENTS) {
      if (earned.includes(ach.id)) continue;
      if (ach.check(stats)) {
        newOnes.push(ach);
        earned.push(ach.id);
      }
    }

    gameState.achievements = earned;
    return newOnes;
  }

  function processDayActivity(gameState, dayData, allTimeCatTotals) {
    if (!dayData || !dayData.entries || !dayData.entries.length) return { xpGained: 0, newAchievements: [], leveledUp: false };

    let xpGained = 0;
    for (const entry of dayData.entries) {
      xpGained += calcEntryXP(entry);
    }

    // Tier XP multiplier: Free/Starter=1x, Pro=1.25x, Max=1.5x
    const tier = window._currentTier || 'free';
    if (tier === 'max') xpGained = Math.round(xpGained * 1.5);
    else if (tier === 'pro') xpGained = Math.round(xpGained * 1.25);

    const oldLevel = gameState.level;
    gameState.xp += xpGained;
    gameState.level = getLevelForXP(gameState.xp);
    gameState.title = getTitle(gameState.level);

    // Streak
    gameState.streak = updateStreak(gameState, dayData.summary.totalMs);

    // Focus check (longest uninterrupted same-app session)
    let longestFocus = 0;
    let currentFocus = 0;
    let lastApp = null;
    for (const entry of dayData.entries) {
      if (entry.app === lastApp) {
        currentFocus += entry.dur;
      } else {
        longestFocus = Math.max(longestFocus, currentFocus);
        currentFocus = entry.dur;
        lastApp = entry.app;
      }
    }
    longestFocus = Math.max(longestFocus, currentFocus);

    // Day category breakdown
    const dayCatMs = {};
    const dayApps = new Set();
    let daySwitches = 0;
    let dayKeys = 0;
    let dayClicks = 0;
    let dayScrolls = 0;
    let morningMs = 0;
    let eveningMs = 0;
    let prevApp = null;
    const hoursSet = new Set();

    for (const entry of dayData.entries) {
      dayCatMs[entry.cat] = (dayCatMs[entry.cat] || 0) + entry.dur;
      dayApps.add(entry.app);
      dayKeys += (entry.keys || 0);
      dayClicks += (entry.clicks || 0);
      dayScrolls += (entry.scrolls || 0);
      if (entry.app !== prevApp && prevApp !== null) daySwitches++;
      prevApp = entry.app;

      const hr = new Date(entry.ts).getHours();
      hoursSet.add(hr);
      if (hr < 12) morningMs += entry.dur;
      if (hr >= 18) eveningMs += entry.dur;
    }

    const dayCatCount = Object.keys(dayCatMs).length;
    const dayAppCount = dayApps.size;

    // Time of day checks
    const hasTrackedPast11 = dayData.entries.some(e => new Date(e.ts).getHours() >= 23);
    const hasTrackedPastMidnight = dayData.entries.some(e => { const hr = new Date(e.ts).getHours(); return hr >= 0 && hr < 5; });
    const hasTrackedPast2am = dayData.entries.some(e => { const hr = new Date(e.ts).getHours(); return hr >= 2 && hr < 5; });
    const hasTrackedPast4am = dayData.entries.some(e => { const hr = new Date(e.ts).getHours(); return hr >= 4 && hr < 5; });
    const startedBefore5 = dayData.entries.some(e => new Date(e.ts).getHours() < 5);
    const startedBefore6 = dayData.entries.some(e => new Date(e.ts).getHours() < 6);
    const startedBefore7 = dayData.entries.some(e => new Date(e.ts).getHours() < 7);
    const codedAtLunch = dayData.entries.some(e => e.cat === 'coding' && new Date(e.ts).getHours() === 12);

    const dayDate = new Date(dayData.date);
    const dayOfWeek = dayDate.getDay();
    const isWeekend = [0, 6].includes(dayOfWeek);
    const month = dayDate.getMonth();
    const date = dayDate.getDate();
    const isNewYear = month === 0 && date === 1;
    const isHalloween = month === 9 && date === 31;
    const isFriday13 = dayOfWeek === 5 && date === 13;
    const isLeapDay = month === 1 && date === 29;

    // Balanced day: no single category over 50%
    const totalDayMs = dayData.summary.totalMs || 1;
    const balancedDay = totalDayMs >= h(2) && Object.values(dayCatMs).every(v => v / totalDayMs <= 0.5);

    // Productive day: 6+ hrs, coding+design+music > 70%
    const productiveMs = (dayCatMs.coding || 0) + (dayCatMs.design || 0) + (dayCatMs.music || 0);
    const productiveDay = totalDayMs >= h(6) && productiveMs / totalDayMs > 0.7;

    // Tracking stats (persisted)
    gameState.stats = gameState.stats || {};
    gameState.stats.totalMs = (gameState.stats.totalMs || 0) + dayData.summary.totalMs;
    gameState.stats.totalDays = (gameState.stats.totalDays || 0) + 1;
    gameState.stats.totalKeys = (gameState.stats.totalKeys || 0) + dayKeys;
    gameState.stats.totalClicks = (gameState.stats.totalClicks || 0) + dayClicks;
    gameState.stats.totalScrolls = (gameState.stats.totalScrolls || 0) + dayScrolls;
    gameState.stats.totalMorningMs = (gameState.stats.totalMorningMs || 0) + morningMs;
    gameState.stats.totalEveningMs = (gameState.stats.totalEveningMs || 0) + eveningMs;
    gameState.stats.weekendDays = (gameState.stats.weekendDays || 0) + (isWeekend ? 1 : 0);
    gameState.stats.totalFocusMs = (gameState.stats.totalFocusMs || 0) + (longestFocus >= m(30) ? longestFocus : 0);
    gameState.stats.focusSessions = (gameState.stats.focusSessions || 0) + (longestFocus >= m(30) ? 1 : 0);
    gameState.stats.hoursTracked = Array.from(new Set([...(gameState.stats.hoursTrackedSet || []), ...hoursSet]));
    gameState.stats.hoursTrackedSet = gameState.stats.hoursTracked;
    gameState.stats.totalApps = Array.from(new Set([...(gameState.stats.totalAppsSet || []), ...dayApps]));
    gameState.stats.totalAppsSet = gameState.stats.totalApps;

    // Build full stats object for achievement checks
    const stats = {
      totalMs: gameState.stats.totalMs,
      dayMs: dayData.summary.totalMs,
      totalDays: gameState.stats.totalDays,
      streak: gameState.streak.current,
      bestStreak: gameState.streak.best,
      catTotals: allTimeCatTotals || {},
      dayCatMs,
      dayCatCount,
      dayAppCount,
      daySwitches,
      dayKeys,
      totalKeys: gameState.stats.totalKeys,
      totalClicks: gameState.stats.totalClicks,
      totalScrolls: gameState.stats.totalScrolls,
      longestFocus,
      totalFocusMs: gameState.stats.totalFocusMs,
      focusSessions: gameState.stats.focusSessions,
      singleAppFocus: longestFocus,
      level: gameState.level,
      totalXP: gameState.xp,
      achCount: (gameState.achievements || []).length,
      morningMs,
      eveningMs,
      totalMorningMs: gameState.stats.totalMorningMs,
      totalEveningMs: gameState.stats.totalEveningMs,
      weekendDays: gameState.stats.weekendDays,
      totalApps: (gameState.stats.totalApps || []).length,
      hoursTracked: (gameState.stats.hoursTracked || []).length,
      mondayMs: dayOfWeek === 1 ? totalDayMs : 0,
      fridayMs: dayOfWeek === 5 ? totalDayMs : 0,
      sundayMs: dayOfWeek === 0 ? totalDayMs : 0,
      startedBefore5,
      startedBefore6,
      startedBefore7,
      trackedPast11: hasTrackedPast11,
      trackedPastMidnight: hasTrackedPastMidnight,
      trackedPast2am: hasTrackedPast2am,
      trackedPast4am: hasTrackedPast4am,
      trackedWeekend: isWeekend && dayData.summary.totalMs > 0,
      codedAtLunch,
      fullWorkWeek: false, // TODO: track across the week
      fullWeek: false,     // TODO: track across the week
      balancedDay,
      productiveDay,
      isNewYear,
      isHalloween,
      isFriday13,
      isLeapDay,
      codeStreak: 0,   // TODO: per-category streak tracking
      musicStreak: 0,
      designStreak: 0,
      browseStreak: 0,
      gameStreak: 0,
      commStreak: 0,
      codeApps: 0,      // TODO: unique code editor tracking
      codedPastMidnight: hasTrackedPastMidnight && (dayCatMs.coding || 0) > 0,
    };

    const newAchievements = checkAchievements(gameState, stats);

    const leveledUp = gameState.level > oldLevel;

    return { xpGained, newAchievements, leveledUp };
  }

  return {
    ACHIEVEMENTS,
    ACHIEVEMENT_CATEGORIES,
    TITLES,
    XP_MULTIPLIERS,
    getLevelForXP,
    getXPForLevel,
    getXPForNextLevel,
    getTitle,
    calcEntryXP,
    updateStreak,
    checkAchievements,
    processDayActivity
  };
})();
