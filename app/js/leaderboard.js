// leaderboard.js — Leaderboard with Friends / Global scope toggle

const Leaderboard = (() => {
  let activeFilter = 'level';
  let activeScope = 'friends'; // 'friends' | 'global'
  let weeklyTimeCache = null; // { ts, data: Map<userId, ms> }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatHours(ms) {
    if (!ms || ms < 60000) return '0m';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  let _container = null;
  let _friendPlayers = [];
  let _user = null;

  async function render(container) {
    _container = container;
    const friendsData = await spirosAPI.getFriends();
    const gameState = await spirosAPI.getGameState();
    const { user } = await spirosAPI.getUser();
    _user = user;

    const friends = (friendsData && friendsData.friends) ? friendsData.friends : [];

    if (!user) {
      container.innerHTML = `
        <div class="leaderboard-page">
          <h2 class="page-title">Leaderboard</h2>
          <div class="lb-empty">
            <p>Log in to see leaderboards</p>
          </div>
        </div>
      `;
      return;
    }

    // Build friend player entries: self + friends
    const me = {
      id: user.id || '_self',
      name: user.profile?.display_name || user.user_metadata?.display_name || 'You',
      level: gameState.level || 1,
      title: gameState.title || 'Novice',
      xp: gameState.xp || 0,
      streak: gameState.streak?.current || 0,
      isYou: true
    };

    _friendPlayers = [me];
    for (const f of friends) {
      _friendPlayers.push({
        id: f.profile.id,
        name: f.profile.display_name || 'Unknown',
        level: f.profile.level || 1,
        title: f.profile.title || 'Novice',
        xp: f.profile.xp || 0,
        streak: f.profile.streak_current || 0,
        isYou: false
      });
    }

    // If no friends and scope is friends, suggest adding or switch to global
    const hasFriends = friends.length > 0;

    container.innerHTML = `
      <div class="leaderboard-page">
        <h2 class="page-title">Leaderboard</h2>

        <div class="lb-scope-toggle">
          <button class="lb-scope-btn ${activeScope === 'friends' ? 'active' : ''}" data-scope="friends">Friends</button>
          <button class="lb-scope-btn ${activeScope === 'global' ? 'active' : ''}${!(window.requiresTier && window.requiresTier('pro')) ? ' btn-locked' : ''}" data-scope="global">${!(window.requiresTier && window.requiresTier('pro')) ? '&#x1F512; ' : ''}Global</button>
        </div>

        <div class="ach-filters" id="lb-filters">
          <button class="ach-filter-btn ${activeFilter === 'level' ? 'active' : ''}" data-filter="level">Level</button>
          <button class="ach-filter-btn ${activeFilter === 'xp' ? 'active' : ''}" data-filter="xp">XP</button>
          <button class="ach-filter-btn ${activeFilter === 'streak' ? 'active' : ''}" data-filter="streak">Streak</button>
          ${activeScope === 'friends' ? `<button class="ach-filter-btn ${activeFilter === 'weekly' ? 'active' : ''}" data-filter="weekly">Weekly Time</button>` : ''}
        </div>

        <div id="lb-rank-banner" class="lb-my-rank-banner" style="display:none"></div>
        <div id="lb-list" class="leaderboard-list"></div>

        ${!hasFriends && activeScope === 'friends' ? `
          <div class="lb-empty">
            <p>No friends yet — add friends to see friend rankings!</p>
            <div class="lb-empty-cta"><button class="btn-pixel" id="lb-add-friends">Add Friends</button></div>
          </div>
        ` : ''}
      </div>
    `;

    // Wire scope toggle
    container.querySelectorAll('.lb-scope-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.scope === 'global' && !(window.requiresTier && window.requiresTier('pro'))) {
          if (window.showUpgradeModal) window.showUpgradeModal('Global Leaderboard', 'pro');
          return;
        }
        activeScope = btn.dataset.scope;
        // Reset filter if switching to global with weekly selected
        if (activeScope === 'global' && activeFilter === 'weekly') activeFilter = 'level';
        render(container);
      });
    });

    // Wire filter buttons
    container.querySelectorAll('.ach-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        container.querySelectorAll('.ach-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === activeFilter));
        if (activeScope === 'friends') {
          renderFriendsList();
        } else {
          renderGlobalList();
        }
      });
    });

    container.querySelector('#lb-add-friends')?.addEventListener('click', () => {
      document.querySelector('.nav-item[data-view="friends"]')?.click();
    });

    if (activeScope === 'friends' && hasFriends) {
      renderFriendsList();
    } else if (activeScope === 'global') {
      renderGlobalList();
    }
  }

  async function renderFriendsList() {
    const list = document.getElementById('lb-list');
    const banner = document.getElementById('lb-rank-banner');
    if (!list) return;
    if (banner) banner.style.display = 'none';

    if (activeFilter === 'weekly') {
      list.innerHTML = '<div class="lb-loading">Loading weekly stats...</div>';
      await loadWeeklyTime(_friendPlayers);
    }

    const sorted = [..._friendPlayers];
    switch (activeFilter) {
      case 'level': sorted.sort((a, b) => b.level - a.level || b.xp - a.xp); break;
      case 'xp': sorted.sort((a, b) => b.xp - a.xp); break;
      case 'streak': sorted.sort((a, b) => b.streak - a.streak); break;
      case 'weekly': sorted.sort((a, b) => (b.weeklyMs || 0) - (a.weeklyMs || 0)); break;
    }

    list.innerHTML = renderPlayerRows(sorted);
  }

  async function renderGlobalList() {
    const list = document.getElementById('lb-list');
    const banner = document.getElementById('lb-rank-banner');
    if (!list) return;

    list.innerHTML = '<div class="lb-loading">Loading global rankings...</div>';

    const metricMap = { level: 'level', xp: 'xp', streak: 'streak_current' };
    const metric = metricMap[activeFilter] || 'level';
    const result = await spirosAPI.getGlobalLeaderboard(metric, 50);

    const players = (result.players || []).map(p => ({
      ...p,
      isYou: p.isYou || false
    }));

    list.innerHTML = renderPlayerRows(players);

    // Show rank banner if user is not in top 50
    if (banner) {
      const inList = players.some(p => p.isYou);
      if (!inList && result.myRank) {
        banner.innerHTML = `Your rank: <strong>#${result.myRank}</strong>`;
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
      }
    }
  }

  function renderPlayerRows(sorted) {
    if (sorted.length === 0) return '<div class="lb-loading">No players found</div>';

    return sorted.map((p, i) => {
      const rank = p.rank || (i + 1);
      const initial = (p.name || '?').charAt(0).toUpperCase();
      const rankClass = rank <= 3 ? ` lb-rank-${rank}` : '';
      const youClass = p.isYou ? ' lb-you' : '';

      let value;
      switch (activeFilter) {
        case 'level': value = `Lv. ${p.level}`; break;
        case 'xp': value = (p.xp || 0).toLocaleString(); break;
        case 'streak': value = `${p.streak || 0}d`; break;
        case 'weekly': value = formatHours(p.weeklyMs || 0); break;
      }

      return `
        <div class="lb-row${rankClass}${youClass}">
          <span class="lb-rank">${rank}</span>
          <span class="lb-avatar">${escapeHtml(initial)}</span>
          <span class="lb-name">${escapeHtml(p.isYou ? p.name + ' (You)' : p.name)}</span>
          <span class="lb-title">${escapeHtml(p.title || '')}</span>
          <span class="lb-value">${value}</span>
        </div>
      `;
    }).join('');
  }

  async function loadWeeklyTime(players) {
    if (weeklyTimeCache && Date.now() - weeklyTimeCache.ts < 120000) {
      for (const p of players) {
        p.weeklyMs = weeklyTimeCache.data.get(p.id) || 0;
      }
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const cache = new Map();

    try {
      const myStats = await spirosAPI.getRange(weekAgo, today);
      let myTotal = 0;
      for (const day of myStats) myTotal += (day.summary?.totalMs || 0);
      const me = players.find(p => p.isYou);
      if (me) { me.weeklyMs = myTotal; cache.set(me.id, myTotal); }
    } catch (_) {}

    for (const p of players) {
      if (p.isYou) continue;
      try {
        const stats = await spirosAPI.getFriendStats(p.id, weekAgo, today);
        let total = 0;
        for (const day of stats) total += (day.summary?.totalMs || 0);
        p.weeklyMs = total;
        cache.set(p.id, total);
      } catch (_) {
        p.weeklyMs = 0;
        cache.set(p.id, 0);
      }
    }

    weeklyTimeCache = { ts: Date.now(), data: cache };
  }

  return { render };
})();
