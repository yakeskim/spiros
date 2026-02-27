// guilds.js — Guilds: browse, detail, create, my-guild views

const Guilds = (() => {
  let currentView = 'browse'; // 'browse' | 'detail' | 'create' | 'my-guild'
  let currentGuildId = null;
  let _container = null;

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function render(container) {
    _container = container;

    switch (currentView) {
      case 'browse': await renderBrowse(container); break;
      case 'detail': await renderDetail(container); break;
      case 'create': renderCreateForm(container); break;
      case 'my-guild': await renderMyGuild(container); break;
      default: await renderBrowse(container);
    }
  }

  // ===== Browse View =====
  async function renderBrowse(container) {
    container.innerHTML = `
      <div class="guilds-page">
        <div class="projects-header">
          <h2 class="page-title">Guilds</h2>
          <div class="projects-controls">
            <button class="btn-pixel" id="btn-my-guild">My Guild</button>
            <button class="btn-pixel${!(window.requiresTier && window.requiresTier('max')) ? ' btn-locked' : ''}" id="btn-create-guild">${!(window.requiresTier && window.requiresTier('max')) ? '&#x1F512; ' : ''}+ Create Guild</button>
          </div>
        </div>
        <div class="guild-search-bar">
          <input type="text" id="guild-search" class="input-pixel" placeholder="Search guilds..." style="flex:1">
          <select id="guild-sort" class="select-pixel">
            <option value="members">Most Members</option>
            <option value="xp">Most XP</option>
          </select>
        </div>
        <div id="guilds-grid" class="projects-grid">
          <div class="lb-loading">Loading guilds...</div>
        </div>
      </div>
    `;

    container.querySelector('#btn-my-guild').addEventListener('click', () => {
      currentView = 'my-guild';
      render(container);
    });
    container.querySelector('#btn-create-guild').addEventListener('click', () => {
      if (!(window.requiresTier && window.requiresTier('max'))) {
        if (window.showUpgradeModal) window.showUpgradeModal('Create Guild', 'max');
        return;
      }
      currentView = 'create';
      render(container);
    });

    const searchInput = container.querySelector('#guild-search');
    const sortSelect = container.querySelector('#guild-sort');
    let searchTimer = null;

    async function refreshList() {
      const grid = document.getElementById('guilds-grid');
      if (!grid) return;
      grid.innerHTML = '<div class="lb-loading">Loading guilds...</div>';
      const guilds = await spirosAPI.getGuilds(sortSelect.value, searchInput.value.trim());
      renderGuildGrid(grid, guilds);
    }

    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(refreshList, 300);
    });
    sortSelect.addEventListener('change', refreshList);

    // Initial load
    const guilds = await spirosAPI.getGuilds('members', '');
    const grid = document.getElementById('guilds-grid');
    if (grid) renderGuildGrid(grid, guilds);
  }

  function renderGuildGrid(grid, guilds) {
    if (!guilds || guilds.length === 0) {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">🏰</div>
        <p>No guilds found</p>
        <p class="empty-state-hint">Be the first to create a guild and recruit members!</p>
      </div>`;
      return;
    }

    grid.innerHTML = guilds.map(g => `
      <div class="guild-card glass" data-guild-id="${g.id}">
        <div class="guild-card-header">
          <span class="guild-card-icon" style="color:${g.color || '#f5c542'}">${g.icon || '⚔'}</span>
          <div class="guild-card-info">
            <h3 class="guild-card-name">${escapeHtml(g.name)}</h3>
            <div class="guild-card-desc">${escapeHtml((g.description || '').slice(0, 80))}</div>
          </div>
        </div>
        <div class="guild-card-stats">
          <span>${g.member_count || 1} member${(g.member_count || 1) !== 1 ? 's' : ''}</span>
          <span>${(g.total_xp || 0).toLocaleString()} XP</span>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.guild-card').forEach(card => {
      card.addEventListener('click', () => {
        currentGuildId = card.dataset.guildId;
        currentView = 'detail';
        render(_container);
      });
    });
  }

  // ===== Detail View =====
  async function renderDetail(container) {
    if (!currentGuildId) { currentView = 'browse'; return render(container); }

    container.innerHTML = '<div class="guilds-page"><div class="lb-loading">Loading guild...</div></div>';

    const [guild, members] = await Promise.all([
      spirosAPI.getGuild(currentGuildId),
      spirosAPI.getGuildMembers(currentGuildId)
    ]);

    if (!guild) {
      container.innerHTML = '<div class="guilds-page"><div class="empty-state">Guild not found</div></div>';
      return;
    }

    const { user } = await spirosAPI.getUser();
    const userId = user?.id;
    const isMember = members.some(m => m.user_id === userId);
    const myMembership = members.find(m => m.user_id === userId);
    const isOwner = guild.owner_id === userId;

    container.innerHTML = `
      <div class="guilds-page">
        <button class="btn-pixel btn-sm" id="btn-back-guilds" style="margin-bottom:12px">← Back</button>

        <div class="guild-header glass">
          <div class="guild-header-icon" style="color:${guild.color || '#f5c542'};font-size:36px">${guild.icon || '⚔'}</div>
          <div class="guild-header-info">
            <h2 class="guild-header-name">${escapeHtml(guild.name)}</h2>
            <div class="guild-header-desc">${escapeHtml(guild.description || 'No description')}</div>
            <div class="guild-header-stats">
              <span>${guild.member_count || 1} members</span>
              <span>${(guild.total_xp || 0).toLocaleString()} XP</span>
            </div>
          </div>
          <div class="guild-header-actions">
            ${!isMember ? `<button class="btn-pixel" id="btn-join-guild">Join Guild</button>` : ''}
            ${isMember && !isOwner ? `<button class="btn-pixel btn-muted" id="btn-leave-guild">Leave</button>` : ''}
          </div>
        </div>

        <div class="settings-section glass" style="margin-top:12px">
          <h3 class="card-title">Members (${members.length})</h3>
          <div class="guild-members-list">
            ${members.map(m => {
              const roleClass = m.role === 'owner' ? 'role-owner' : m.role === 'officer' ? 'role-officer' : '';
              const initial = (m.display_name || '?').charAt(0).toUpperCase();
              const isMe = m.user_id === userId;
              let roleActions = '';
              if (isOwner && !isMe) {
                if (m.role === 'member') {
                  roleActions = `<button class="btn-sm btn-role" data-uid="${m.user_id}" data-role="officer">Promote</button>`;
                } else if (m.role === 'officer') {
                  roleActions = `<button class="btn-sm btn-role" data-uid="${m.user_id}" data-role="member">Demote</button>`;
                }
              }
              return `
                <div class="guild-member-row">
                  <span class="lb-avatar">${escapeHtml(initial)}</span>
                  <span class="guild-member-name">${escapeHtml(m.display_name)}${isMe ? ' (You)' : ''}</span>
                  <span class="guild-role-badge ${roleClass}">${m.role}</span>
                  <span class="guild-member-level">Lv. ${m.level}</span>
                  ${roleActions}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        ${isOwner && (window.requiresTier && window.requiresTier('max')) ? `
        <div class="settings-section glass" style="margin-top:12px">
          <h3 class="card-title">Guild Analytics (Max)</h3>
          <div id="guild-analytics" class="lb-loading">Loading analytics...</div>
        </div>
        ` : ''}
      </div>
    `;

    // Load guild analytics for Team owners
    if (isOwner && (window.requiresTier && window.requiresTier('max'))) {
      renderGuildAnalytics(guild, members);
    }

    container.querySelector('#btn-back-guilds').addEventListener('click', () => {
      currentView = 'browse';
      render(container);
    });

    container.querySelector('#btn-join-guild')?.addEventListener('click', async () => {
      const result = await spirosAPI.joinGuild(currentGuildId);
      if (result.success) {
        render(container);
      } else {
        alert(result.error || 'Failed to join guild');
      }
    });

    container.querySelector('#btn-leave-guild')?.addEventListener('click', async () => {
      const result = await spirosAPI.leaveGuild(currentGuildId);
      if (result.success) {
        currentView = 'browse';
        render(container);
      } else {
        alert(result.error || 'Failed to leave guild');
      }
    });

    container.querySelectorAll('.btn-role').forEach(btn => {
      btn.addEventListener('click', async () => {
        const result = await spirosAPI.updateGuildMemberRole(currentGuildId, btn.dataset.uid, btn.dataset.role);
        if (result.success) render(container);
      });
    });
  }

  // ===== Create Form =====
  function renderCreateForm(container) {
    const GUILD_ICONS = ['⚔', '🛡', '🏰', '🐉', '🦅', '🔥', '💎', '⚡', '🌟', '🎯', '🏆', '👑'];
    const GUILD_COLORS = ['#f5c542', '#ff5252', '#00e676', '#448aff', '#e040fb', '#ff6e40', '#26c6da', '#ffd740'];

    container.innerHTML = `
      <div class="guilds-page">
        <button class="btn-pixel btn-sm" id="btn-back-guilds" style="margin-bottom:12px">← Back</button>
        <h2 class="page-title">Create Guild</h2>

        <div class="guild-create-form glass">
          <div class="guild-form-field">
            <label>Guild Name</label>
            <input type="text" id="guild-name" class="input-pixel" placeholder="Enter guild name" maxlength="30">
            <span class="char-count" id="guild-name-count">0/30</span>
          </div>
          <div class="guild-form-field">
            <label>Description</label>
            <input type="text" id="guild-desc" class="input-pixel" placeholder="What is your guild about?" maxlength="200">
          </div>
          <div class="guild-form-field">
            <label>Icon</label>
            <div class="guild-icon-picker" id="guild-icon-picker">
              ${GUILD_ICONS.map((ic, i) =>
                `<button class="guild-icon-btn ${i === 0 ? 'active' : ''}" data-icon="${ic}">${ic}</button>`
              ).join('')}
            </div>
          </div>
          <div class="guild-form-field">
            <label>Color</label>
            <div class="guild-color-picker" id="guild-color-picker">
              ${GUILD_COLORS.map((c, i) =>
                `<button class="guild-color-btn ${i === 0 ? 'active' : ''}" data-color="${c}" style="background:${c}"></button>`
              ).join('')}
            </div>
          </div>
          <div id="guild-create-error" style="color:var(--red);font-size:7px;margin-top:6px;display:none"></div>
          <button class="btn-pixel" id="btn-submit-guild" style="margin-top:12px;width:100%">Create Guild</button>
        </div>

        <div class="settings-section glass" style="margin-top:12px">
          <h3 class="section-title">Preview</h3>
          <div class="guild-preview-card" id="guild-preview">
            <span class="guild-preview-icon" id="guild-preview-icon" style="font-size:24px">${GUILD_ICONS[0]}</span>
            <div>
              <div class="guild-preview-name" id="guild-preview-name" style="font-size:9px;color:var(--text-bright);font-family:var(--pixel-font)">Guild Name</div>
              <div class="guild-preview-desc" id="guild-preview-desc" style="font-size:7px;color:var(--text-dim);margin-top:2px">Description goes here</div>
            </div>
          </div>
        </div>
      </div>
    `;

    let selectedIcon = GUILD_ICONS[0];
    let selectedColor = GUILD_COLORS[0];

    function updatePreview() {
      const nameEl = container.querySelector('#guild-preview-name');
      const descEl = container.querySelector('#guild-preview-desc');
      const iconEl = container.querySelector('#guild-preview-icon');
      const card = container.querySelector('#guild-preview');
      if (nameEl) nameEl.textContent = container.querySelector('#guild-name')?.value.trim() || 'Guild Name';
      if (descEl) descEl.textContent = container.querySelector('#guild-desc')?.value.trim() || 'Description goes here';
      if (iconEl) iconEl.textContent = selectedIcon;
      if (card) card.style.borderColor = selectedColor;
      if (nameEl) nameEl.style.color = selectedColor;
    }

    container.querySelector('#guild-name')?.addEventListener('input', (e) => {
      const cnt = container.querySelector('#guild-name-count');
      if (cnt) cnt.textContent = `${e.target.value.length}/30`;
      updatePreview();
    });
    container.querySelector('#guild-desc')?.addEventListener('input', () => updatePreview());

    container.querySelector('#btn-back-guilds').addEventListener('click', () => {
      currentView = 'browse';
      render(container);
    });

    container.querySelectorAll('.guild-icon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.guild-icon-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedIcon = btn.dataset.icon;
        updatePreview();
      });
    });

    container.querySelectorAll('.guild-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.guild-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedColor = btn.dataset.color;
        updatePreview();
      });
    });

    container.querySelector('#btn-submit-guild').addEventListener('click', async () => {
      const name = container.querySelector('#guild-name').value.trim();
      const desc = container.querySelector('#guild-desc').value.trim();
      const errEl = container.querySelector('#guild-create-error');
      const submitBtn = container.querySelector('#btn-submit-guild');

      if (!name || name.length < 2) {
        errEl.textContent = 'Guild name must be at least 2 characters';
        errEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      const result = await spirosAPI.createGuild(name, desc, selectedIcon, selectedColor);

      if (result.success) {
        currentGuildId = result.guild.id;
        currentView = 'detail';
        render(container);
      } else {
        errEl.textContent = result.error || 'Failed to create guild';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Guild';
      }
    });
  }

  // ===== My Guild View =====
  async function renderMyGuild(container) {
    container.innerHTML = '<div class="guilds-page"><div class="lb-loading">Loading your guild...</div></div>';

    const myGuild = await spirosAPI.getMyGuild();

    if (!myGuild) {
      container.innerHTML = `
        <div class="guilds-page">
          <button class="btn-pixel btn-sm" id="btn-back-guilds" style="margin-bottom:12px">← Back</button>
          <div class="empty-state" style="text-align:center;padding:40px">
            <p>You are not in a guild yet.</p>
            <div style="margin-top:12px">
              <button class="btn-pixel" id="btn-browse-guilds">Browse Guilds</button>
              <button class="btn-pixel" id="btn-create-from-empty" style="margin-left:8px">Create Guild</button>
            </div>
          </div>
        </div>
      `;
      container.querySelector('#btn-back-guilds').addEventListener('click', () => {
        currentView = 'browse';
        render(container);
      });
      container.querySelector('#btn-browse-guilds').addEventListener('click', () => {
        currentView = 'browse';
        render(container);
      });
      container.querySelector('#btn-create-from-empty').addEventListener('click', () => {
        currentView = 'create';
        render(container);
      });
      return;
    }

    // Redirect to detail view for own guild
    currentGuildId = myGuild.id;
    currentView = 'detail';
    render(container);
  }

  async function renderGuildAnalytics(guild, members) {
    const el = document.getElementById('guild-analytics');
    if (!el) return;
    try {
      const totalXP = members.reduce((s, m) => s + (m.xp || 0), 0);
      const avgLevel = members.length > 0 ? (members.reduce((s, m) => s + (m.level || 1), 0) / members.length).toFixed(1) : 0;
      const activeLast7 = members.filter(m => {
        if (!m.last_seen_at) return false;
        return (Date.now() - new Date(m.last_seen_at).getTime()) < 7 * 86400000;
      }).length;

      el.innerHTML = `
        <div class="dash-stats-row">
          <div class="stat-card glass">
            <div class="stat-value">${totalXP.toLocaleString()}</div>
            <div class="stat-label">Total Guild XP</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">${avgLevel}</div>
            <div class="stat-label">Avg Level</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">${activeLast7}/${members.length}</div>
            <div class="stat-label">Active (7d)</div>
          </div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = '<div style="color:var(--text-dim);font-size:7px">Could not load analytics</div>';
    }
  }

  return { render };
})();
