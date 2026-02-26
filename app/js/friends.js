// friends.js — Friends list, search, requests, stat comparison, online presence

const Friends = (() => {
  let friendsData = null;
  let onlineUsers = {}; // { userId: presenceData }

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

  function timeAgo(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
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

        <div id="friend-online-section" class="settings-section glass" style="display:none">
          <h3 class="section-title">Online Now <span id="online-friends-count" class="online-friends-count">0</span></h3>
          <div id="friend-online-list" class="friends-list"></div>
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

    // Set up presence listeners
    setupPresenceListeners();

    // Load initial online state
    try {
      onlineUsers = await synchronAPI.getOnlineFriends() || {};
    } catch (_) {}

    await loadFriends();
  }

  function setupPresenceListeners() {
    synchronAPI.onPresenceSync((data) => {
      onlineUsers = data || {};
      renderOnlineSection();
      updateOnlineDots();
    });
    synchronAPI.onPresenceJoin(({ key, data }) => {
      if (key && data) onlineUsers[key] = data;
      renderOnlineSection();
      updateOnlineDots();
    });
    synchronAPI.onPresenceLeave(({ key }) => {
      delete onlineUsers[key];
      renderOnlineSection();
      updateOnlineDots();
    });
  }

  function isOnline(userId) {
    return !!onlineUsers[userId];
  }

  function renderOnlineSection() {
    const section = document.getElementById('friend-online-section');
    const list = document.getElementById('friend-online-list');
    const count = document.getElementById('online-friends-count');
    if (!section || !list || !friendsData) return;

    const onlineFriends = friendsData.friends.filter(f => isOnline(f.profile.id));

    if (onlineFriends.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    if (count) count.textContent = onlineFriends.length;

    list.innerHTML = onlineFriends.map(f => {
      const presence = onlineUsers[f.profile.id];
      const actState = presence?.activity_state || '';
      return `
        <div class="friend-card glass friend-card-online">
          <div class="friend-info">
            <span class="friend-online-dot online"></span>
            <span class="friend-name">${escapeHtml(f.profile.display_name)}</span>
            <span class="friend-level">Lv.${f.profile.level || 1} ${escapeHtml(f.profile.title || 'Novice')}</span>
            ${actState && actState !== 'idle' ? `<span class="friend-activity-state">${escapeHtml(actState)}</span>` : ''}
          </div>
          <div class="friend-actions">
            <button class="btn-pixel btn-sm btn-compare" data-id="${f.profile.id}" data-name="${escapeHtml(f.profile.display_name)}">Compare</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.btn-compare').forEach(btn => {
      btn.addEventListener('click', () => showComparison(btn.dataset.id, btn.dataset.name));
    });
  }

  function updateOnlineDots() {
    document.querySelectorAll('#friends-list .friend-online-dot').forEach(dot => {
      const userId = dot.dataset.uid;
      if (userId) {
        dot.classList.toggle('online', isOnline(userId));
        dot.classList.toggle('offline', !isOnline(userId));
      }
    });
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
        btn.textContent = 'Sending...';
        const result = await synchronAPI.sendFriendRequest(btn.dataset.id);
        if (result && result.success === false) {
          btn.textContent = 'Failed';
          btn.classList.add('btn-danger');
          setTimeout(() => {
            btn.textContent = '+ Add';
            btn.classList.remove('btn-danger');
            btn.disabled = false;
          }, 2000);
          return;
        }
        btn.textContent = 'Sent!';
        await loadFriends();
      });
    });
  }

  async function loadFriends() {
    friendsData = await synchronAPI.getFriends();
    renderOnlineSection();
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

    el.innerHTML = friends.map(f => {
      const online = isOnline(f.profile.id);
      const lastSeen = !online && f.profile.last_seen_at ? timeAgo(f.profile.last_seen_at) : '';
      return `
        <div class="friend-card glass">
          <div class="friend-info">
            <span class="friend-online-dot ${online ? 'online' : 'offline'}" data-uid="${f.profile.id}"></span>
            <span class="friend-name">${escapeHtml(f.profile.display_name)}</span>
            <span class="friend-level">Lv.${f.profile.level || 1} ${escapeHtml(f.profile.title || 'Novice')}</span>
            ${f.profile.streak_current ? `<span class="friend-streak">\u{1F525} ${f.profile.streak_current}</span>` : ''}
            ${lastSeen ? `<span class="friend-last-seen">${lastSeen}</span>` : ''}
          </div>
          <div class="friend-actions">
            <button class="btn-pixel btn-sm btn-compare" data-id="${f.profile.id}" data-name="${escapeHtml(f.profile.display_name)}">Compare</button>
            <button class="btn-icon btn-remove-friend" data-fid="${f.id}" title="Remove">\u2715</button>
          </div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('.btn-compare').forEach(btn => {
      btn.addEventListener('click', () => showComparison(btn.dataset.id, btn.dataset.name));
    });

    el.querySelectorAll('.btn-remove-friend').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Remove this friend?')) {
          const result = await synchronAPI.removeFriend(btn.dataset.fid);
          if (result && result.success === false) {
            btn.title = 'Failed to remove';
            btn.style.color = 'var(--orange)';
            setTimeout(() => { btn.title = 'Remove'; btn.style.color = ''; }, 2000);
            return;
          }
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
        btn.disabled = true;
        btn.textContent = 'Accepting...';
        const result = await synchronAPI.respondFriendRequest(btn.dataset.fid, true);
        if (result && result.success === false) {
          btn.textContent = 'Failed';
          btn.classList.add('btn-danger');
          setTimeout(() => { btn.textContent = 'Accept'; btn.classList.remove('btn-danger'); btn.disabled = false; }, 2000);
          return;
        }
        await loadFriends();
      });
    });

    list.querySelectorAll('.btn-decline').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const result = await synchronAPI.respondFriendRequest(btn.dataset.fid, false);
        if (result && result.success === false) {
          btn.textContent = 'Failed';
          setTimeout(() => { btn.textContent = 'Decline'; btn.disabled = false; }, 2000);
          return;
        }
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

    // Fetch friend's last 7 days (sanitized server-side — only totalMs, totalEvents, byCategory)
    const friendStats = await synchronAPI.getFriendStats(friendId, weekAgo, today);

    // Fetch own last 7 days
    const myStats = await synchronAPI.getRange(weekAgo, today);

    // Aggregate totals and category breakdowns
    let myTotal = 0, friendTotal = 0;
    const myCats = {}, friendCats = {};

    for (const day of myStats) {
      myTotal += (day.summary?.totalMs || 0);
      for (const [cat, ms] of Object.entries(day.summary?.byCategory || {})) {
        myCats[cat] = (myCats[cat] || 0) + ms;
      }
    }

    for (const day of friendStats) {
      friendTotal += (day.summary?.totalMs || 0);
      for (const [cat, ms] of Object.entries(day.summary?.byCategory || {})) {
        friendCats[cat] = (friendCats[cat] || 0) + ms;
      }
    }

    // Get all unique categories
    const allCats = [...new Set([...Object.keys(myCats), ...Object.keys(friendCats)])];
    allCats.sort((a, b) => {
      const total = (myCats[b] || 0) + (friendCats[b] || 0) - (myCats[a] || 0) - (friendCats[a] || 0);
      return total;
    });

    const categoryRows = allCats.map(cat => {
      const myMs = myCats[cat] || 0;
      const fMs = friendCats[cat] || 0;
      return `
        <div class="compare-row">
          <span class="compare-label">${escapeHtml(cat)}</span>
          <span class="compare-you ${myMs >= fMs ? 'compare-win' : ''}">${formatHours(myMs)}</span>
          <span class="compare-them ${fMs >= myMs ? 'compare-win' : ''}">${formatHours(fMs)}</span>
        </div>
      `;
    }).join('');

    content.innerHTML = `
      <div class="compare-grid">
        <div class="compare-header">
          <span class="compare-label">This Week</span>
          <span class="compare-you">You</span>
          <span class="compare-them">${escapeHtml(friendName)}</span>
        </div>
        <div class="compare-row">
          <span class="compare-label">Total Time</span>
          <span class="compare-you ${myTotal >= friendTotal ? 'compare-win' : ''}">${formatHours(myTotal)}</span>
          <span class="compare-them ${friendTotal >= myTotal ? 'compare-win' : ''}">${formatHours(friendTotal)}</span>
        </div>
        <div class="compare-row">
          <span class="compare-label">Active Days</span>
          <span class="compare-you">${myStats.filter(d => (d.summary?.totalMs || 0) > 3600000).length}/7</span>
          <span class="compare-them">${friendStats.filter(d => (d.summary?.totalMs || 0) > 3600000).length}/7</span>
        </div>
        ${categoryRows}
      </div>
    `;
  }

  return { render };
})();
