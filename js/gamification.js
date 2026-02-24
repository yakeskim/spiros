// gamification.js — XP, levels, achievements, streaks, resources

const Gamification = (() => {
  // XP thresholds double each level
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

  const ACHIEVEMENTS = [
    { id: 'first_hour', name: 'First Hour', desc: 'Track 1 hour of activity', icon: '⏱', check: (s) => s.totalMs >= 3600000 },
    { id: 'half_day', name: 'Half Day Warrior', desc: 'Track 4 hours in one day', icon: '🌗', check: (s) => s.dayMs >= 14400000 },
    { id: 'full_day', name: 'Marathon Runner', desc: 'Track 8+ hours in one day', icon: '🏃', check: (s) => s.dayMs >= 28800000 },
    { id: 'night_owl', name: 'Night Owl', desc: 'Code past midnight', icon: '🦉', check: (s) => s.codedPastMidnight },
    { id: 'early_bird', name: 'Early Bird', desc: 'Start tracking before 7 AM', icon: '🐦', check: (s) => s.startedBefore7 },
    { id: 'streak_3', name: 'Getting Consistent', desc: '3-day tracking streak', icon: '🔥', check: (s) => s.streak >= 3 },
    { id: 'streak_7', name: 'Streak Master', desc: '7-day tracking streak', icon: '💪', check: (s) => s.streak >= 7 },
    { id: 'streak_14', name: 'Unstoppable', desc: '14-day tracking streak', icon: '⚡', check: (s) => s.streak >= 14 },
    { id: 'streak_30', name: 'Monthly Legend', desc: '30-day tracking streak', icon: '👑', check: (s) => s.streak >= 30 },
    { id: 'music_10h', name: 'Music Maker', desc: 'Spend 10 hours in music apps', icon: '🎵', check: (s) => (s.catTotals.music || 0) >= 36000000 },
    { id: 'code_10h', name: 'Code Warrior', desc: 'Spend 10 hours coding', icon: '💻', check: (s) => (s.catTotals.coding || 0) >= 36000000 },
    { id: 'code_50h', name: 'Code Master', desc: 'Spend 50 hours coding', icon: '🖥', check: (s) => (s.catTotals.coding || 0) >= 180000000 },
    { id: 'polyglot', name: 'Polyglot', desc: 'Work on 5+ different projects', icon: '📚', check: (s) => s.projectCount >= 5 },
    { id: 'focus_30', name: 'Deep Focus', desc: '30 min uninterrupted session', icon: '🧘', check: (s) => s.longestFocus >= 1800000 },
    { id: 'focus_60', name: 'Flow State', desc: '60 min uninterrupted session', icon: '🌊', check: (s) => s.longestFocus >= 3600000 },
    { id: 'level_5', name: 'Rising Star', desc: 'Reach level 5', icon: '⭐', check: (s) => s.level >= 5 },
    { id: 'level_10', name: 'Veteran', desc: 'Reach level 10', icon: '🌟', check: (s) => s.level >= 10 },
    { id: 'level_20', name: 'Grandmaster', desc: 'Reach level 20', icon: '💎', check: (s) => s.level >= 20 },
    { id: 'all_cats', name: 'Jack of All Trades', desc: 'Use all 6 categories in one day', icon: '🎭', check: (s) => s.dayCatCount >= 6 },
    { id: 'weekend', name: 'Weekend Warrior', desc: 'Track on a weekend', icon: '🏖', check: (s) => s.trackedWeekend }
  ];

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

  // Calculate XP earned from an activity entry
  function calcEntryXP(entry) {
    // Base: 1 XP per minute
    const minutes = entry.dur / 60000;
    const multiplier = XP_MULTIPLIERS[entry.cat] || 0.5;
    return Math.round(minutes * multiplier);
  }

  // Calculate resources from an activity entry
  function calcEntryResources(entry) {
    const minutes = entry.dur / 60000;
    const res = { gold: 0, gems: 0, wood: 0, stone: 0 };

    // Gold from any activity
    res.gold += Math.round(minutes * 0.5);

    // Wood from coding
    if (entry.cat === 'coding') {
      res.wood += Math.round(minutes * 0.8);
    }

    // Stone from sustained focus (tracked externally)
    // Gems only from achievements

    return res;
  }

  // Update streak based on today's activity
  function updateStreak(gameState, todayMs) {
    const today = new Date().toISOString().split('T')[0];
    const streak = gameState.streak || { current: 0, best: 0, lastDate: null };

    if (todayMs < 3600000) return streak; // Need 1h+ to count

    if (streak.lastDate === today) return streak; // Already counted today

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

  // Check for new achievements
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

  // Process a full day's data into gamification updates
  function processDayActivity(gameState, dayData, allTimeCatTotals) {
    if (!dayData || !dayData.entries || !dayData.entries.length) return { xpGained: 0, newAchievements: [], leveledUp: false };

    let xpGained = 0;
    const resGained = { gold: 0, gems: 0, wood: 0, stone: 0 };

    for (const entry of dayData.entries) {
      xpGained += calcEntryXP(entry);
      const entryRes = calcEntryResources(entry);
      resGained.gold += entryRes.gold;
      resGained.wood += entryRes.wood;
      resGained.stone += entryRes.stone;
    }

    const oldLevel = gameState.level;
    gameState.xp += xpGained;
    gameState.level = getLevelForXP(gameState.xp);
    gameState.title = getTitle(gameState.level);

    // Resources
    gameState.resources = gameState.resources || { gold: 0, gems: 0, wood: 0, stone: 0 };
    gameState.resources.gold += resGained.gold;
    gameState.resources.wood += resGained.wood;
    gameState.resources.stone += resGained.stone;

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

    // Stone from focus sessions
    if (longestFocus >= 1800000) {
      gameState.resources.stone += Math.round(longestFocus / 1800000) * 5;
    }

    // Check achievements
    const dayCatCount = Object.keys(dayData.summary.byCategory || {}).length;
    const hasNightCoding = dayData.entries.some(e => {
      const h = new Date(e.ts).getHours();
      return e.cat === 'coding' && (h >= 0 && h < 5);
    });
    const startedBefore7 = dayData.entries.some(e => new Date(e.ts).getHours() < 7);
    const isWeekend = [0, 6].includes(new Date(dayData.date).getDay());

    const stats = {
      totalMs: gameState.xp * 60000 / 1.0, // rough
      dayMs: dayData.summary.totalMs,
      streak: gameState.streak.current,
      catTotals: allTimeCatTotals || {},
      projectCount: 0, // set externally
      longestFocus,
      level: gameState.level,
      dayCatCount,
      codedPastMidnight: hasNightCoding,
      startedBefore7,
      trackedWeekend: isWeekend && dayData.summary.totalMs > 0
    };

    const newAchievements = checkAchievements(gameState, stats);

    // Gems from achievements
    if (newAchievements.length > 0) {
      gameState.resources.gems += newAchievements.length * 5;
    }

    const leveledUp = gameState.level > oldLevel;

    return { xpGained, newAchievements, leveledUp, resGained };
  }

  return {
    ACHIEVEMENTS,
    TITLES,
    XP_MULTIPLIERS,
    getLevelForXP,
    getXPForLevel,
    getXPForNextLevel,
    getTitle,
    calcEntryXP,
    calcEntryResources,
    updateStreak,
    checkAchievements,
    processDayActivity
  };
})();
