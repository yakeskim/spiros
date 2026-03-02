// profile.js — Profile page: avatar, display name, activity heatmap, achievement showcase, enhanced stats

const Profile = (() => {
  let editing = false;

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

  async function render(container) {
    const { user } = await spirosAPI.getUser();
    const gameState = await spirosAPI.getGameState();

    if (!user) {
      container.innerHTML = `
        <div class="profile-page">
          <h2 class="page-title">Profile</h2>
          <div class="settings-section glass" style="text-align:center;padding:40px">
            <p style="color:var(--text-dim);margin-bottom:12px">Log in to view your profile</p>
          </div>
        </div>
      `;
      return;
    }

    const profile = user.profile || {};
    const displayName = profile.display_name || user.user_metadata?.display_name || 'Unknown';
    const initial = displayName.charAt(0).toUpperCase();
    const level = gameState.level || 1;
    const title = profile.custom_title || gameState.title || 'Novice';
    const xp = gameState.xp || 0;
    const streak = gameState.streak?.current || 0;
    const bestStreak = gameState.streak?.best || 0;
    const achievements = gameState.achievements || [];
    // Fetch activity data for heatmap (last 84 days / 12 weeks)
    const heatmapEnd = new Date();
    const heatmapStart = new Date(heatmapEnd);
    heatmapStart.setDate(heatmapStart.getDate() - 83);
    const startStr = localDateStr(heatmapStart);
    const endStr = localDateStr(heatmapEnd);

    let rangeData = [];
    let totalHoursTracked = 0;
    let daysTracked = 0;
    try {
      rangeData = await spirosAPI.getRange(startStr, endStr);
      // Use game state stats if available, else fall back to last 365 days
      const gs = await spirosAPI.getGameState();
      if (gs.stats?.totalTrackedMs) {
        totalHoursTracked = gs.stats.totalTrackedMs;
        daysTracked = gs.stats.daysTracked || 0;
      } else {
        const statsStart = new Date(heatmapEnd);
        statsStart.setDate(statsStart.getDate() - 364);
        const allData = await spirosAPI.getRange(localDateStr(statsStart), endStr);
        for (const day of allData) {
          const ms = day.summary?.totalMs || 0;
          totalHoursTracked += ms;
          if (ms >= 3600000) daysTracked++;
        }
      }
    } catch (_) {}

    // Build heatmap grid data (7 rows x 12 cols)
    const heatmapMap = {};
    for (const day of rangeData) {
      heatmapMap[day.date] = day.summary?.totalMs || 0;
    }

    const heatmapCells = [];
    const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
    for (let i = 0; i < 84; i++) {
      const d = new Date(heatmapStart);
      d.setDate(d.getDate() + i);
      const dateStr = localDateStr(d);
      const ms = heatmapMap[dateStr] || 0;
      let lvl = 0;
      if (ms >= 28800000) lvl = 4;      // 8h+ gold
      else if (ms >= 14400000) lvl = 3;  // 4h+ bright
      else if (ms >= 3600000) lvl = 2;   // 1h+ medium
      else if (ms > 0) lvl = 1;          // any activity
      heatmapCells.push({ date: dateStr, level: lvl, ms });
    }

    // Build heatmap grid HTML (col-major: 12 columns of 7 rows)
    let heatmapGridHtml = '';
    for (let col = 0; col < 12; col++) {
      for (let row = 0; row < 7; row++) {
        const idx = col * 7 + row;
        const cell = heatmapCells[idx];
        if (cell) {
          const tip = `${cell.date}: ${formatHours(cell.ms)}`;
          heatmapGridHtml += `<div class="heatmap-cell" data-level="${cell.level}" title="${tip}"></div>`;
        }
      }
    }

    // Achievement showcase: pinned or most recent
    const pinnedIds = gameState.pinnedAchievements || [];
    const allAch = (typeof Gamification !== 'undefined') ? Gamification.ACHIEVEMENTS : [];
    let showcaseAchs = [];
    if (pinnedIds.length > 0) {
      showcaseAchs = pinnedIds.slice(0, 5).map(id => allAch.find(a => a.id === id)).filter(Boolean);
    }
    if (showcaseAchs.length < 5) {
      // Fill with most recently earned
      const earned = [...achievements].reverse();
      for (const id of earned) {
        if (showcaseAchs.length >= 5) break;
        if (showcaseAchs.find(a => a.id === id)) continue;
        const ach = allAch.find(a => a.id === id);
        if (ach) showcaseAchs.push(ach);
      }
    }

    container.innerHTML = `
      <div class="profile-page">
        <h2 class="page-title">Profile</h2>

        <div class="profile-identity-card glass">
          <div class="profile-avatar"${profile.avatar_color ? ` style="background:${profile.avatar_color}"` : ''}>${escapeHtml(initial)}</div>
          <div class="profile-identity-info">
            <div class="profile-display-name" id="profile-name-display">
              <span id="profile-name-text">${escapeHtml(displayName)}</span>
            </div>
            <div class="profile-title-line">
              <span class="profile-level">Lv. ${level}</span>
              <span class="profile-title">${escapeHtml(title)}</span>
            </div>
          </div>
        </div>

        <div class="dash-stats-row" style="margin-top:16px">
          <div class="stat-card glass">
            <div class="stat-value">${Math.round(totalHoursTracked / 3600000)}h</div>
            <div class="stat-label">Total Hours</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">${daysTracked}</div>
            <div class="stat-label">Days Tracked</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">${bestStreak}</div>
            <div class="stat-label">Best Streak</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">${achievements.length}</div>
            <div class="stat-label">Achievements</div>
          </div>
        </div>

        <div class="settings-section glass" style="margin-top:16px">
          <h3 class="card-title">Activity (Last 12 Weeks)</h3>
          <div class="profile-heatmap">
            <div class="heatmap-labels">
              ${dayLabels.map(l => `<div class="heatmap-label">${l}</div>`).join('')}
            </div>
            <div class="heatmap-grid">
              ${heatmapGridHtml}
            </div>
          </div>
          <div class="heatmap-legend">
            <span>Less</span>
            <div class="heatmap-cell" data-level="0"></div>
            <div class="heatmap-cell" data-level="1"></div>
            <div class="heatmap-cell" data-level="2"></div>
            <div class="heatmap-cell" data-level="3"></div>
            <div class="heatmap-cell" data-level="4"></div>
            <span>More</span>
          </div>
        </div>

        ${showcaseAchs.length > 0 ? `
        <div class="settings-section glass" style="margin-top:16px">
          <h3 class="card-title">Achievement Showcase</h3>
          <div class="profile-showcase">
            ${showcaseAchs.map(ach => {
              const isPinned = pinnedIds.includes(ach.id);
              return `
                <div class="showcase-ach" data-ach-id="${ach.id}">
                  <div class="showcase-ach-icon">${ach.icon}</div>
                  <div class="showcase-ach-name">${escapeHtml(ach.name)}</div>
                  <button class="btn-pin ${isPinned ? 'pinned' : ''}" data-ach-id="${ach.id}" title="${isPinned ? 'Unpin' : 'Pin'}">
                    ${isPinned ? '★' : '☆'}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}

        <div class="dash-stats-row" style="margin-top:16px">
          <div class="stat-card glass">
            <div class="stat-value">Lv. ${level}</div>
            <div class="stat-label">Level</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">${xp.toLocaleString()}</div>
            <div class="stat-label">Total XP</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">${streak}</div>
            <div class="stat-label">Current Streak</div>
          </div>
        </div>

        ${(function() {
          const isPro = window.requiresTier && window.requiresTier('pro');
          const isMax = window.requiresTier && window.requiresTier('max');
          if (!isPro) {
            return '<div class="settings-section glass" style="margin-top:16px"><h3 class="card-title">Customize Profile</h3><div class="empty-state" style="text-align:center;padding:16px"><p>&#x1F512; Profile customization requires Pro</p><button class="btn-pixel btn-sm" id="btn-upgrade-profile" style="margin-top:8px">Upgrade to Pro</button></div></div>';
          }
          const AVATAR_COLORS = ['#f5c542', '#ff5252', '#00e676', '#448aff', '#e040fb', '#ff6e40', '#26c6da', '#ffd740'];
          const PROFILE_FRAMES = ['none', 'gold', 'diamond', 'flame', 'frost', 'neon', 'recruiter', 'legend'];
          const currentColor = profile.avatar_color || '';
          const currentCustomTitle = profile.custom_title || '';
          const currentFrame = profile.profile_frame || 'none';
          return '<div class="settings-section glass" style="margin-top:16px">' +
            '<h3 class="card-title">Customize Profile</h3>' +
            '<div class="profile-form-field"><label>Avatar Color</label><div class="profile-color-picker" id="profile-color-picker">' +
            AVATAR_COLORS.map(c => '<button class="color-swatch' + (currentColor === c ? ' active' : '') + '" data-color="' + c + '" style="background:' + c + '"></button>').join('') +
            '</div></div>' +
            '<div class="profile-form-field"><label>Custom Title</label><input type="text" id="profile-custom-title" class="input-pixel" placeholder="Enter custom title..." maxlength="30" value="' + escapeHtml(currentCustomTitle) + '"></div>' +
            (isMax ? '<div class="profile-form-field"><label>Profile Frame</label><div class="profile-frame-picker" id="profile-frame-picker">' +
            PROFILE_FRAMES.map(f => '<button class="frame-option' + (currentFrame === f ? ' active' : '') + '" data-frame="' + f + '">' + f + '</button>').join('') +
            '</div></div>' : '') +
            '<button class="btn-pixel" id="btn-save-profile-custom" style="margin-top:8px">Save</button>' +
            '<div id="profile-custom-msg" style="font-size:var(--font-size-base);margin-top:4px;display:none"></div>' +
            '</div>';
        })()}

        <div class="settings-section glass" style="margin-top:16px" id="referral-section">
          <h3 class="card-title">Referral Program</h3>
          <div id="referral-content" style="text-align:center;padding:8px">
            <p style="color:var(--text-dim);font-size:var(--font-size-base)">Loading referral info...</p>
          </div>
        </div>
      </div>
    `;

    wireProfileEvents(container);
    loadReferralSection();
  }

  const REFERRAL_MILESTONES = [
    { count: 1, icon: '🤝', label: 'Recruiter', reward: '500 XP + "Recruiter" achievement' },
    { count: 3, icon: '🎨', label: 'Squad Builder', reward: '"Referral Blue" avatar color (#00bfff)' },
    { count: 5, icon: '🖼', label: 'Team Captain', reward: '"Recruiter" frame + 1,000 XP' },
    { count: 10, icon: '⭐', label: 'Commander', reward: '1 month free Starter' },
    { count: 25, icon: '👑', label: 'Ambassador', reward: '1 month free Pro + "Ambassador" title' },
    { count: 50, icon: '🏆', label: 'Legend', reward: '"Legend" frame + permanent badge' },
  ];

  async function loadReferralSection() {
    const content = document.getElementById('referral-content');
    if (!content) return;

    try {
      const stats = await spirosAPI.getReferralStats();
      const code = stats.referral_code;
      const count = stats.referral_count || 0;
      const claimedMilestones = new Set((stats.rewards || []).map(r => r.milestone));

      // Update game state with referral count for achievement checks
      try {
        const gs = await spirosAPI.getGameState();
        if (gs) {
          gs.stats = gs.stats || {};
          if (gs.stats.referralCount !== count) {
            gs.stats.referralCount = count;
            await spirosAPI.setGameState(gs);
          }
        }
      } catch (_) {}

      const nextMilestone = REFERRAL_MILESTONES.find(m => count < m.count);
      const nextNeeded = nextMilestone ? nextMilestone.count - count : 0;
      const progressPercent = nextMilestone
        ? Math.min(100, Math.round((count / nextMilestone.count) * 100))
        : 100;

      content.innerHTML = `
        <div class="referral-code-box">
          <span class="referral-code-label">Your Code</span>
          <span class="referral-code-value">${code || '---'}</span>
          <div class="referral-code-actions">
            <button class="btn-pixel btn-sm" id="btn-copy-referral">Copy Code</button>
            <button class="btn-pixel btn-sm btn-outline" id="btn-share-referral">Share Link</button>
          </div>
        </div>

        <div class="referral-stats-row">
          <div class="referral-stat">
            <div class="stat-value" style="color:var(--gold)">${count}</div>
            <div class="stat-label">Total Referrals</div>
          </div>
          ${nextMilestone ? `
          <div class="referral-stat">
            <div class="stat-value" style="color:var(--text-bright)">${nextNeeded}</div>
            <div class="stat-label">Until ${escapeHtml(nextMilestone.label)}</div>
          </div>
          ` : `
          <div class="referral-stat">
            <div class="stat-value" style="color:var(--green)">MAX</div>
            <div class="stat-label">All Claimed!</div>
          </div>
          `}
        </div>

        <div class="referral-progress-bar">
          <div class="referral-progress-fill" style="width:${progressPercent}%"></div>
        </div>

        <div class="referral-milestones">
          ${REFERRAL_MILESTONES.map(m => {
            const reached = count >= m.count;
            const claimed = claimedMilestones.has(m.count);
            const stateClass = claimed ? 'claimed' : reached ? 'reached' : '';
            const statusText = claimed ? 'Claimed' : reached ? 'Claim' : 'Locked';
            return `
              <div class="referral-milestone ${stateClass}">
                <span class="milestone-icon">${m.icon}</span>
                <div class="milestone-info">
                  <span class="milestone-label">${m.count} - ${escapeHtml(m.label)}</span>
                  <span class="milestone-reward">${escapeHtml(m.reward)}</span>
                </div>
                <span class="milestone-status ${stateClass}"${reached && !claimed ? ' data-milestone="' + m.count + '"' : ''}>${statusText}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Wire copy/share buttons
      content.querySelector('#btn-copy-referral')?.addEventListener('click', async () => {
        if (!code) return;
        try {
          await navigator.clipboard.writeText(code);
          const btn = content.querySelector('#btn-copy-referral');
          if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Code'; }, 2000); }
        } catch (_) {}
      });

      content.querySelector('#btn-share-referral')?.addEventListener('click', async () => {
        if (!code) return;
        const link = 'https://spiros.app/signup?ref=' + code;
        try {
          await navigator.clipboard.writeText(link);
          const btn = content.querySelector('#btn-share-referral');
          if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Share Link'; }, 2000); }
        } catch (_) {}
      });

      // Wire claim buttons
      content.querySelectorAll('.milestone-status.reached').forEach(btn => {
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', async () => {
          btn.textContent = '...';
          const result = await spirosAPI.claimReferralRewards();
          if (result.newly_claimed && result.newly_claimed.length > 0) {
            loadReferralSection(); // Refresh
          } else {
            btn.textContent = 'Claim';
          }
        });
      });
    } catch (_) {
      content.innerHTML = '<p style="color:var(--text-dim);font-size:var(--font-size-base)">Could not load referral data</p>';
    }
  }

  function wireProfileEvents(container) {
    // Upgrade CTA for free users
    container.querySelector('#btn-upgrade-profile')?.addEventListener('click', () => {
      if (window.showUpgradeModal) window.showUpgradeModal('Profile Customization', 'pro');
    });

    // Profile customization (Pro+)
    let selectedColor = '';
    let selectedFrame = 'none';
    container.querySelectorAll('#profile-color-picker .color-swatch').forEach(btn => {
      if (btn.classList.contains('active')) selectedColor = btn.dataset.color;
      btn.addEventListener('click', () => {
        container.querySelectorAll('#profile-color-picker .color-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedColor = btn.dataset.color;
      });
    });
    container.querySelectorAll('#profile-frame-picker .frame-option').forEach(btn => {
      if (btn.classList.contains('active')) selectedFrame = btn.dataset.frame;
      btn.addEventListener('click', () => {
        container.querySelectorAll('#profile-frame-picker .frame-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedFrame = btn.dataset.frame;
      });
    });
    container.querySelector('#btn-save-profile-custom')?.addEventListener('click', async () => {
      const customTitle = container.querySelector('#profile-custom-title')?.value.trim() || '';
      const msgEl = container.querySelector('#profile-custom-msg');
      const updates = { avatar_color: selectedColor, custom_title: customTitle };
      if (window.requiresTier && window.requiresTier('max')) updates.profile_frame = selectedFrame;
      const result = await spirosAPI.updateProfile(updates);
      if (msgEl) {
        msgEl.textContent = result.success ? 'Saved!' : (result.error || 'Failed to save');
        msgEl.style.color = result.success ? 'var(--green)' : 'var(--red)';
        msgEl.style.display = 'block';
        setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
      }
    });

    // Pin/unpin achievement buttons
    container.querySelectorAll('.btn-pin').forEach(btn => {
      btn.addEventListener('click', async () => {
        const achId = btn.dataset.achId;
        const gameState = await spirosAPI.getGameState();
        const pinned = gameState.pinnedAchievements || [];

        if (pinned.includes(achId)) {
          gameState.pinnedAchievements = pinned.filter(id => id !== achId);
        } else {
          if (pinned.length >= 5) pinned.shift();
          pinned.push(achId);
          gameState.pinnedAchievements = pinned;
        }

        await spirosAPI.setGameState(gameState);
        render(container);
      });
    });
  }

  return { render };
})();
