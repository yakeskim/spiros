// leaderboard.js — Leaderboard with Global / Competition / Friends tabs, table layout, pagination

const Leaderboard = (() => {
  const PAGE_SIZE = 25;

  let activeScope = 'global'; // 'global' | 'competition' | 'friends'
  let sortCol = 'level';      // 'level' | 'xp' | 'streak' | 'weekly'
  let sortDir = 'desc';
  let currentPage = 1;
  let allRows = [];
  let competitionOffset = 0;
  let weeklyTimeCache = null;

  let _container = null;
  let _friendPlayers = [];
  let _user = null;
  let _myRank = null;

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

  function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Map sort column to Supabase metric name
  function colToMetric(col) {
    return { level: 'level', xp: 'xp', streak: 'streak_current', weekly: 'weekly_ms' }[col] || 'level';
  }

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
          <div class="lb-empty"><p>Log in to see leaderboards</p></div>
        </div>
      `;
      return;
    }

    // Build friend player entries
    const me = {
      id: user.id || '_self',
      name: user.profile?.display_name || user.user_metadata?.display_name || 'You',
      level: gameState.level || 1,
      xp: gameState.xp || 0,
      streak: gameState.streak?.current || 0,
      weeklyMs: 0,
      isYou: true
    };
    _friendPlayers = [me];
    for (const f of friends) {
      _friendPlayers.push({
        id: f.profile.id,
        name: f.profile.display_name || 'Unknown',
        level: f.profile.level || 1,
        xp: f.profile.xp || 0,
        streak: f.profile.streak_current || 0,
        weeklyMs: f.profile.weekly_ms || 0,
        isYou: false
      });
    }

    container.innerHTML = `
      <div class="leaderboard-page">
        <h2 class="page-title">Leaderboard</h2>

        <div class="lb-scope-toggle">
          <button class="lb-scope-btn ${activeScope === 'global' ? 'active' : ''}" data-scope="global">Global</button>
          <button class="lb-scope-btn ${activeScope === 'competition' ? 'active' : ''}" data-scope="competition">Competition</button>
          <button class="lb-scope-btn ${activeScope === 'friends' ? 'active' : ''}" data-scope="friends">Friends</button>
        </div>

        <div id="lb-rank-banner" class="lb-my-rank-banner" style="display:none"></div>
        <div id="lb-table-area" class="lb-table-wrapper"></div>
        <div id="lb-pagination" class="lb-pagination"></div>

        ${friends.length === 0 && activeScope === 'friends' ? `
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
        activeScope = btn.dataset.scope;
        currentPage = 1;
        render(container);
      });
    });

    container.querySelector('#lb-add-friends')?.addEventListener('click', () => {
      document.querySelector('.nav-item[data-view="friends"]')?.click();
    });

    // Load data for active scope
    await loadScope();
  }

  async function loadScope() {
    const tableArea = document.getElementById('lb-table-area');
    if (!tableArea) return;
    tableArea.innerHTML = '<div class="lb-loading">Loading...</div>';

    if (activeScope === 'global') await loadGlobalData();
    else if (activeScope === 'competition') await loadCompetitionData();
    else await loadFriendsData();

    renderTable();
  }

  async function loadGlobalData() {
    const metric = colToMetric(sortCol);
    const result = await spirosAPI.getGlobalLeaderboard(metric, 100);
    allRows = result.players || [];
    _myRank = result.myRank;
    competitionOffset = 0;
  }

  async function loadCompetitionData() {
    const metric = colToMetric(sortCol);
    const result = await spirosAPI.getCompetitionLeaderboard(metric);
    allRows = result.players || [];
    _myRank = result.myRank;
    competitionOffset = result.offset || 0;
  }

  async function loadFriendsData() {
    // Load weekly time for self
    if (_friendPlayers.length > 0) {
      await loadWeeklyTime(_friendPlayers);
    }

    const sorted = [..._friendPlayers];
    sortRows(sorted);

    // Assign ranks after sorting
    allRows = sorted.map((p, i) => ({ ...p, rank: i + 1 }));
    _myRank = null;
    competitionOffset = 0;
  }

  function sortRows(rows) {
    const dir = sortDir === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'level': va = a.level; vb = b.level; break;
        case 'xp': va = a.xp; vb = b.xp; break;
        case 'streak': va = a.streak; vb = b.streak; break;
        case 'weekly': va = a.weeklyMs || 0; vb = b.weeklyMs || 0; break;
        default: va = a.level; vb = b.level;
      }
      return (vb - va) * dir || (b.xp - a.xp) * dir;
    });
  }

  function renderTable() {
    const tableArea = document.getElementById('lb-table-area');
    const paginationArea = document.getElementById('lb-pagination');
    const banner = document.getElementById('lb-rank-banner');
    if (!tableArea) return;

    if (allRows.length === 0) {
      tableArea.innerHTML = '<div class="lb-loading">No players found</div>';
      if (paginationArea) paginationArea.innerHTML = '';
      if (banner) banner.style.display = 'none';
      return;
    }

    // Pagination
    const totalPages = Math.ceil(allRows.length / PAGE_SIZE);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = allRows.slice(start, start + PAGE_SIZE);

    // Column headers
    const cols = [
      { key: 'rank', label: '#', cls: 'lb-col-rank' },
      { key: 'name', label: 'Name', cls: 'lb-col-name' },
      { key: 'level', label: 'Lv', cls: 'lb-col-stat' },
      { key: 'xp', label: 'XP', cls: 'lb-col-stat' },
      { key: 'streak', label: 'Streak', cls: 'lb-col-stat' },
      { key: 'weekly', label: 'Weekly', cls: 'lb-col-stat' }
    ];

    const headerCells = cols.map(c => {
      const sortable = c.key !== 'rank' && c.key !== 'name';
      const isActive = sortable && sortCol === c.key;
      const arrow = isActive ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';
      const activeClass = isActive ? ' lb-sort-active' : '';
      const sortableClass = sortable ? ' lb-sortable' : '';
      return `<span class="${c.cls}${activeClass}${sortableClass}" ${sortable ? `data-sort="${c.key}"` : ''}>${escapeHtml(c.label)}${arrow}</span>`;
    }).join('');

    const rows = pageRows.map(p => {
      const rankClass = p.rank <= 3 ? ` lb-rank-${p.rank}` : '';
      const youClass = p.isYou ? ' lb-you' : '';
      const nameDisplay = p.isYou ? escapeHtml(p.name) + ' (You)' : escapeHtml(p.name);

      return `<div class="lb-row${rankClass}${youClass}">
        <span class="lb-col-rank">${p.rank}</span>
        <span class="lb-col-name">${nameDisplay}</span>
        <span class="lb-col-stat">${p.level}</span>
        <span class="lb-col-stat">${(p.xp || 0).toLocaleString()}</span>
        <span class="lb-col-stat">${p.streak || 0}d</span>
        <span class="lb-col-stat">${formatHours(p.weeklyMs || 0)}</span>
      </div>`;
    }).join('');

    tableArea.innerHTML = `
      <div class="lb-header">${headerCells}</div>
      ${rows}
    `;

    // Wire sortable column headers
    tableArea.querySelectorAll('.lb-sortable').forEach(el => {
      el.addEventListener('click', async () => {
        const col = el.dataset.sort;
        if (sortCol === col) {
          sortDir = sortDir === 'desc' ? 'asc' : 'desc';
        } else {
          sortCol = col;
          sortDir = 'desc';
        }
        currentPage = 1;

        if (activeScope === 'friends') {
          sortRows(allRows);
          allRows.forEach((p, i) => p.rank = i + 1);
          renderTable();
        } else {
          await loadScope();
        }
      });
    });

    // Rank banner
    if (banner) {
      if (activeScope !== 'friends' && _myRank) {
        const inList = allRows.some(p => p.isYou);
        if (!inList) {
          banner.innerHTML = `Your rank: <strong>#${_myRank}</strong>`;
          banner.style.display = 'block';
        } else {
          banner.innerHTML = `Your rank: <strong>#${_myRank}</strong>`;
          banner.style.display = 'block';
        }
      } else {
        banner.style.display = 'none';
      }
    }

    // Pagination
    if (paginationArea) {
      if (totalPages <= 1) {
        paginationArea.innerHTML = '';
      } else {
        let phtml = '';
        phtml += `<button class="lb-page-btn${currentPage === 1 ? ' disabled' : ''}" data-page="prev">‹</button>`;
        for (let i = 1; i <= totalPages; i++) {
          phtml += `<button class="lb-page-btn${i === currentPage ? ' active' : ''}" data-page="${i}">${i}</button>`;
        }
        phtml += `<button class="lb-page-btn${currentPage === totalPages ? ' disabled' : ''}" data-page="next">›</button>`;
        paginationArea.innerHTML = phtml;

        paginationArea.querySelectorAll('.lb-page-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.classList.contains('disabled')) return;
            const pg = btn.dataset.page;
            if (pg === 'prev') currentPage = Math.max(1, currentPage - 1);
            else if (pg === 'next') currentPage = Math.min(totalPages, currentPage + 1);
            else currentPage = parseInt(pg);
            renderTable();
          });
        });
      }
    }
  }

  async function loadWeeklyTime(players) {
    if (weeklyTimeCache && Date.now() - weeklyTimeCache.ts < 120000) {
      for (const p of players) {
        p.weeklyMs = weeklyTimeCache.data.get(p.id) || p.weeklyMs || 0;
      }
      return;
    }

    const today = localDateStr(new Date());
    const weekAgo = localDateStr(new Date(Date.now() - 7 * 86400000));
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
        cache.set(p.id, p.weeklyMs || 0);
      }
    }

    weeklyTimeCache = { ts: Date.now(), data: cache };
  }

  return { render };
})();
