// friends.js — Friends list, search, requests, stat comparison

const Friends = (() => {
  let friendsData = null;

  function formatHours(ms) {
    if (!ms || ms < 60000) return '0m';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function render(container) {
    container.innerHTML = `
      <div class="friends-page">
        <h2 class="page-title">Friends</h2>

        <div class="settings-section glass">
          <h3 class="section-title">Add Friends</h3>
          <div class="setting-row">
            <input type="text" id="friend-search-input" class="input-pixel" placeholder="Search by display name..." style="flex:1">
            <button class="btn-pixel btn-sm" id="btn-friend-search">Search</button>
          </div>
          <div id="friend-search-results" class="friend-search-results"></div>
        </div>

        <div id="friend-requests-section" class="settings-section glass" style="display:none">
          <h3 class="section-title">Friend Requests</h3>
          <div id="friend-requests-list"></div>
        </div>

        <div id="friend-pending-section" class="settings-section glass" style="display:none">
          <h3 class="section-title">Pending Sent</h3>
          <div id="friend-pending-list"></div>
        </div>

        <div class="settings-section glass">
          <h3 class="section-title">Your Friends</h3>
          <div id="friends-list" class="friends-list">
            <div class="loading-state">Loading...</div>
          </div>
        </div>

        <div id="friend-compare" class="settings-section glass" style="display:none">
          <h3 class="section-title" id="compare-title">Compare Stats</h3>
          <div id="compare-content"></div>
        </div>
      </div>
    `;

    // Wire search
    document.getElementById('btn-friend-search')?.addEventListener('click', doSearch);
    document.getElementById('friend-search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });

    await loadFriends();
  }

  async function doSearch() {
    const query = document.getElementById('friend-search-input')?.value?.trim();
    if (!query || query.length < 2) return;

    const results = await synchronAPI.searchUsers(query);
    const el = document.getElementById('friend-search-results');
    if (!el) return;

    if (results.length === 0) {
      el.innerHTML = '<div class="empty-state">No users found</div>';
      return;
    }

    // Filter out existing friends/pending
    const existingIds = new Set();
    if (friendsData) {
      for (const f of [...friendsData.friends, ...friendsData.pending, ...friendsData.requests]) {
        existingIds.add(f.profile?.id);
      }
    }

    el.innerHTML = results.map(user => {
      const alreadyFriend = existingIds.has(user.id);
      return `
        <div class="friend-search-item">
          <div class="friend-info">
            <span class="friend-name">${escapeHtml(user.display_name)}</span>
            <span class="friend-level">Lv.${user.level} ${escapeHtml(user.title || '')}</span>
          </div>
          ${alreadyFriend ?
            '<span class="friend-status-tag">Already added</span>' :
            `<button class="btn-pixel btn-sm btn-add-friend" data-id="${user.id}">+ Add</button>`
          }
        </div>
      `;
    }).join('');

    el.querySelectorAll('.btn-add-friend').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Sent!';
        await synchronAPI.sendFriendRequest(btn.dataset.id);
        await loadFriends();
      });
    });
  }

  async function loadFriends() {
    friendsData = await synchronAPI.getFriends();
    renderFriendsList();
    renderRequests();
    renderPending();
  }

  function renderFriendsList() {
    const el = document.getElementById('friends-list');
    if (!el) return;

    const { friends } = friendsData;
    if (friends.length === 0) {
      el.innerHTML = '<div class="empty-state">No friends yet — search to add some!</div>';
      return;
    }

    el.innerHTML = friends.map(f => `
      <div class="friend-card glass">
        <div class="friend-info">
          <span class="friend-name">${escapeHtml(f.profile.display_name)}</span>
          <span class="friend-level">Lv.${f.profile.level || 1} ${escapeHtml(f.profile.title || 'Novice')}</span>
          ${f.profile.streak_current ? `<span class="friend-streak">🔥 ${f.profile.streak_current}</span>` : ''}
        </div>
        <div class="friend-actions">
          <button class="btn-pixel btn-sm btn-compare" data-id="${f.profile.id}" data-name="${escapeHtml(f.profile.display_name)}">Compare</button>
          <button class="btn-icon btn-remove-friend" data-fid="${f.id}" title="Remove">✕</button>
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.btn-compare').forEach(btn => {
      btn.addEventListener('click', () => showComparison(btn.dataset.id, btn.dataset.name));
    });

    el.querySelectorAll('.btn-remove-friend').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Remove this friend?')) {
          await synchronAPI.removeFriend(btn.dataset.fid);
          await loadFriends();
        }
      });
    });
  }

  function renderRequests() {
    const section = document.getElementById('friend-requests-section');
    const list = document.getElementById('friend-requests-list');
    if (!section || !list) return;

    const { requests } = friendsData;
    if (requests.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = requests.map(r => `
      <div class="friend-request-item">
        <div class="friend-info">
          <span class="friend-name">${escapeHtml(r.profile.display_name)}</span>
          <span class="friend-level">Lv.${r.profile.level || 1}</span>
        </div>
        <div class="friend-actions">
          <button class="btn-pixel btn-sm btn-accept" data-fid="${r.id}">Accept</button>
          <button class="btn-pixel btn-sm btn-danger btn-decline" data-fid="${r.id}">Decline</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.btn-accept').forEach(btn => {
      btn.addEventListener('click', async () => {
        await synchronAPI.respondFriendRequest(btn.dataset.fid, true);
        await loadFriends();
      });
    });

    list.querySelectorAll('.btn-decline').forEach(btn => {
      btn.addEventListener('click', async () => {
        await synchronAPI.respondFriendRequest(btn.dataset.fid, false);
        await loadFriends();
      });
    });
  }

  function renderPending() {
    const section = document.getElementById('friend-pending-section');
    const list = document.getElementById('friend-pending-list');
    if (!section || !list) return;

    const { pending } = friendsData;
    if (pending.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = pending.map(p => `
      <div class="friend-request-item">
        <div class="friend-info">
          <span class="friend-name">${escapeHtml(p.profile.display_name)}</span>
        </div>
        <span class="friend-status-tag">Pending</span>
      </div>
    `).join('');
  }

  async function showComparison(friendId, friendName) {
    const section = document.getElementById('friend-compare');
    const title = document.getElementById('compare-title');
    const content = document.getElementById('compare-content');
    if (!section || !content) return;

    section.style.display = 'block';
    title.textContent = `You vs ${friendName}`;
    content.innerHTML = '<div class="loading-state">Loading...</div>';

    // Get today's date and last 7 days
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    // Fetch friend's last 7 days
    const friendStats = await synchronAPI.getFriendStats(friendId, weekAgo, today);

    // Fetch own last 7 days
    const myStats = await synchronAPI.getRange(weekAgo, today);

    // Aggregate
    let myTotal = 0, friendTotal = 0;
    let myEvents = 0, friendEvents = 0;
    let myApps = new Set(), friendApps = new Set();

    for (const day of myStats) {
      myTotal += (day.summary?.totalMs || 0);
      myEvents += (day.summary?.totalEvents || 0);
      for (const app of Object.keys(day.summary?.byApp || {})) myApps.add(app);
    }

    for (const day of friendStats) {
      friendTotal += (day.summary?.totalMs || 0);
      friendEvents += (day.summary?.totalEvents || 0);
      for (const app of Object.keys(day.summary?.byApp || {})) friendApps.add(app);
    }

    content.innerHTML = `
      <div class="compare-grid">
        <div class="compare-header">
          <span class="compare-label">This Week</span>
          <span class="compare-you">You</span>
          <span class="compare-them">${escapeHtml(friendName)}</span>
        </div>
        <div class="compare-row">
          <span class="compare-label">Active Time</span>
          <span class="compare-you ${myTotal >= friendTotal ? 'compare-win' : ''}">${formatHours(myTotal)}</span>
          <span class="compare-them ${friendTotal >= myTotal ? 'compare-win' : ''}">${formatHours(friendTotal)}</span>
        </div>
        <div class="compare-row">
          <span class="compare-label">Events</span>
          <span class="compare-you ${myEvents >= friendEvents ? 'compare-win' : ''}">${myEvents}</span>
          <span class="compare-them ${friendEvents >= myEvents ? 'compare-win' : ''}">${friendEvents}</span>
        </div>
        <div class="compare-row">
          <span class="compare-label">Apps Used</span>
          <span class="compare-you">${myApps.size}</span>
          <span class="compare-them">${friendApps.size}</span>
        </div>
        <div class="compare-row">
          <span class="compare-label">Active Days</span>
          <span class="compare-you">${myStats.filter(d => (d.summary?.totalMs || 0) > 3600000).length}/7</span>
          <span class="compare-them">${friendStats.filter(d => (d.summary?.totalMs || 0) > 3600000).length}/7</span>
        </div>
      </div>
    `;
  }

  return { render };
})();
