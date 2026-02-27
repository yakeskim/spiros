// settings.js — Settings panel with sidebar tabbed layout

const Settings = (() => {
  let currentSettings = null;
  let activeTab = 'account';

  const TABS = [
    { id: 'account',      icon: '◈', label: 'Account' },
    { id: 'subscription', icon: '★', label: 'Subscription' },
    { id: 'theme',        icon: '◐', label: 'Theme' },
    { id: 'updates',      icon: '↻', label: 'Updates' },
    { id: 'tracking',     icon: '◎', label: 'Tracking' },
    { id: 'categories',   icon: '▣', label: 'Categories' },
    { id: 'privacy',      icon: '◆', label: 'Privacy' },
    { id: 'general',      icon: '⊞', label: 'General' },
    { id: 'about',        icon: 'ⓘ', label: 'About' }
  ];

  async function render(container) {
    currentSettings = await spirosAPI.getSettings();

    container.innerHTML = `
      <div class="settings-page">
        <h2 class="page-title">Settings</h2>
        <div class="settings-layout">
          <div class="settings-sidebar">
            ${TABS.map(t => `
              <button class="settings-sidebar-btn ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">
                <span class="settings-sidebar-icon">${t.icon}</span>
                <span>${t.label}</span>
              </button>
            `).join('')}
          </div>
          <div class="settings-content" id="settings-tab-content"></div>
        </div>
      </div>
    `;

    // Wire sidebar tab buttons
    container.querySelectorAll('.settings-sidebar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        container.querySelectorAll('.settings-sidebar-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
        renderTab();
      });
    });

    renderTab();
  }

  async function renderTab() {
    const content = document.getElementById('settings-tab-content');
    if (!content) return;

    switch (activeTab) {
      case 'account':      await renderAccount(content); break;
      case 'subscription': await renderSubscription(content); break;
      case 'theme':        renderTheme(content); break;
      case 'updates':      await renderUpdates(content); break;
      case 'tracking':     renderTracking(content); break;
      case 'categories':   renderCategories(content); break;
      case 'privacy':      await renderPrivacy(content); break;
      case 'general':      renderGeneral(content); break;
      case 'about':        renderAbout(content); break;
    }
  }

  // ===== Account Tab =====
  async function renderAccount(el) {
    el.innerHTML = '<div class="settings-section glass"><div class="loading-state">Loading...</div></div>';

    try {
      const { user } = await spirosAPI.getUser();

      if (user && user.email) {
        const name = user.profile?.display_name || user.email;
        const memberSince = user.created_at ? formatDate(user.created_at) : 'Unknown';
        const changesUsed = user.profile?.display_name_changed_count || 0;
        const changesMonth = user.profile?.display_name_changed_month || '';
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const effectiveChanges = changesMonth === currentMonth ? changesUsed : 0;
        const changesRemaining = Math.max(0, 2 - effectiveChanges);
        el.innerHTML = `
          <div class="settings-section glass">
            <h3 class="section-title">Account</h3>
            <div class="setting-row">
              <label>Signed in as</label>
              <span class="about-text" style="color:var(--gold)">${escapeHtml(name)}</span>
            </div>
            <div class="setting-row">
              <label>Email</label>
              <span class="about-text">${escapeHtml(user.email)}</span>
            </div>
            <div class="setting-row">
              <label>Member Since</label>
              <span class="about-text">${memberSince}</span>
            </div>
            <div class="setting-row" style="gap:8px;margin-top:12px">
              <button class="btn-pixel" id="btn-sync-now">Sync Now</button>
              <button class="btn-pixel btn-danger" id="btn-logout">Logout</button>
              <button class="btn-pixel btn-danger" id="btn-delete-account">Delete Account</button>
            </div>
          </div>

          <div class="settings-section glass">
            <h3 class="section-title">Display Name</h3>
            <div class="setting-row" id="settings-name-display">
              <label>Name</label>
              <span class="about-text" id="settings-name-text">${escapeHtml(name)}</span>
              <button class="btn-pixel btn-sm" id="btn-edit-name" style="margin-left:8px">Edit</button>
            </div>
            <div class="setting-row" id="settings-name-editor" style="display:none;gap:6px">
              <input type="text" id="settings-name-input" class="input-pixel" value="${escapeHtml(name)}" maxlength="24" style="flex:1">
              <button class="btn-pixel btn-sm" id="btn-save-name">Save</button>
              <button class="btn-pixel btn-sm btn-secondary" id="btn-cancel-name">Cancel</button>
            </div>
            <div class="setting-hint" id="settings-name-limit" style="margin-top:4px">${changesRemaining} name change${changesRemaining !== 1 ? 's' : ''} remaining this month</div>
          </div>

          <div class="settings-section glass">
            <h3 class="section-title">Cloud Profile</h3>
            <p class="setting-hint" style="margin-bottom:10px">Your stats must be synced to the cloud for leaderboards, public profile, and guilds to display correctly. Sync runs automatically every 5 minutes, or you can sync manually.</p>
            <div id="cloud-profile-stats" class="cloud-profile-stats">
              <div class="cloud-profile-loading">Loading stats...</div>
            </div>
            <div class="setting-row" style="margin-top:10px">
              <button class="btn-pixel" id="btn-sync-profile">Sync Profile to Cloud</button>
            </div>
            <div id="cloud-profile-status" class="setting-hint" style="margin-top:6px"></div>
          </div>
        `;
        wireAccountEvents(el);
        loadCloudProfileStats();
      } else {
        el.innerHTML = `
          <div class="settings-section glass">
            <h3 class="section-title">Account</h3>
            <p class="about-text">Not signed in — using offline mode</p>
            <button class="btn-pixel" id="btn-sign-in" style="margin-top:12px">Sign In</button>
          </div>
        `;
        el.querySelector('#btn-sign-in')?.addEventListener('click', () => window.showAuth());
      }
    } catch (_) {
      el.innerHTML = `
        <div class="settings-section glass">
          <h3 class="section-title">Account</h3>
          <p class="about-text">Not signed in — using offline mode</p>
          <button class="btn-pixel" id="btn-sign-in" style="margin-top:12px">Sign In</button>
        </div>
      `;
      el.querySelector('#btn-sign-in')?.addEventListener('click', () => window.showAuth());
    }
  }

  function wireAccountEvents(el) {
    // Name editing
    const editBtn = el.querySelector('#btn-edit-name');
    const saveBtn = el.querySelector('#btn-save-name');
    const cancelBtn = el.querySelector('#btn-cancel-name');
    const nameDisplay = el.querySelector('#settings-name-display');
    const nameEditor = el.querySelector('#settings-name-editor');
    const nameInput = el.querySelector('#settings-name-input');
    const limitEl = el.querySelector('#settings-name-limit');

    editBtn?.addEventListener('click', () => {
      nameDisplay.style.display = 'none';
      nameEditor.style.display = 'flex';
      nameInput.focus();
      nameInput.select();
    });

    cancelBtn?.addEventListener('click', () => {
      nameEditor.style.display = 'none';
      nameDisplay.style.display = 'flex';
    });

    saveBtn?.addEventListener('click', async () => {
      const newName = nameInput.value.trim();
      if (!newName || newName.length < 1 || newName.length > 24) {
        limitEl.textContent = 'Name must be 1-24 characters';
        limitEl.style.color = 'var(--red)';
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const result = await spirosAPI.changeDisplayName(newName);

      if (result.success) {
        renderAccount(el);
      } else {
        limitEl.textContent = result.error || 'Failed to change name';
        limitEl.style.color = 'var(--red)';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });

    nameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn?.click();
      if (e.key === 'Escape') cancelBtn?.click();
    });

    el.querySelector('#btn-sync-profile')?.addEventListener('click', async () => {
      const btn = el.querySelector('#btn-sync-profile');
      const status = el.querySelector('#cloud-profile-status');
      btn.textContent = 'Syncing...';
      btn.disabled = true;
      try {
        const result = await spirosAPI.syncProfile();
        if (result.success) {
          if (status) { status.textContent = 'Profile synced successfully!'; status.style.color = 'var(--green)'; }
          setTimeout(() => { if (status) { status.textContent = ''; } }, 3000);
        } else {
          if (status) { status.textContent = 'Sync failed: ' + (result.error || 'Unknown error'); status.style.color = 'var(--red)'; }
        }
      } catch (e) {
        if (status) { status.textContent = 'Sync failed'; status.style.color = 'var(--red)'; }
      }
      btn.textContent = 'Sync Profile to Cloud';
      btn.disabled = false;
    });

    el.querySelector('#btn-sync-now')?.addEventListener('click', async () => {
      const btn = el.querySelector('#btn-sync-now');
      btn.textContent = 'Syncing...';
      btn.disabled = true;
      try {
        await spirosAPI.syncNow();
        btn.textContent = 'Synced!';
        setTimeout(() => { btn.textContent = 'Sync Now'; btn.disabled = false; }, 2000);
      } catch (e) {
        btn.textContent = 'Sync Now';
        btn.disabled = false;
        await showConfirm('Sync failed: ' + (e.message || 'Unknown error'));
      }
    });

    el.querySelector('#btn-logout')?.addEventListener('click', async () => {
      if (await showConfirm('Are you sure you want to logout?')) {
        await spirosAPI.logout();
        window.showAuth();
      }
    });

    el.querySelector('#btn-delete-account')?.addEventListener('click', async () => {
      if (await showConfirm('DELETE YOUR ACCOUNT?\n\nThis will permanently delete ALL your data from Spiros servers and locally. This cannot be undone.')) {
        if (await showConfirm('Are you REALLY sure?')) {
          const btn = el.querySelector('#btn-delete-account');
          btn.textContent = 'Deleting...';
          btn.disabled = true;
          const result = await spirosAPI.deleteAccount();
          if (result.success) {
            await showConfirm('Account data deleted.');
            window.showAuth();
          } else {
            btn.textContent = 'Delete Account';
            btn.disabled = false;
            await showConfirm('Failed to delete account: ' + (result.error || 'Unknown error'));
          }
        }
      }
    });
  }

  async function loadCloudProfileStats() {
    const container = document.getElementById('cloud-profile-stats');
    if (!container) return;
    try {
      const stats = await spirosAPI.getLocalStats();
      container.innerHTML = `
        <div class="cloud-profile-grid">
          <div class="cloud-stat">
            <div class="cloud-stat-value">Lv. ${stats.level}</div>
            <div class="cloud-stat-label">Level</div>
          </div>
          <div class="cloud-stat">
            <div class="cloud-stat-value">${(stats.xp || 0).toLocaleString()}</div>
            <div class="cloud-stat-label">XP</div>
          </div>
          <div class="cloud-stat">
            <div class="cloud-stat-value">${stats.streak}</div>
            <div class="cloud-stat-label">Streak</div>
          </div>
          <div class="cloud-stat">
            <div class="cloud-stat-value">${stats.bestStreak}</div>
            <div class="cloud-stat-label">Best Streak</div>
          </div>
          <div class="cloud-stat">
            <div class="cloud-stat-value">${escapeHtml(stats.title)}</div>
            <div class="cloud-stat-label">Title</div>
          </div>
        </div>
      `;
    } catch (_) {
      container.innerHTML = '<div class="cloud-profile-loading">Could not load stats</div>';
    }
  }

  // ===== Updates Tab =====
  async function renderUpdates(el) {
    let version = 'v1.0.0';
    if (spirosAPI.getAppVersion) {
      try {
        const info = await spirosAPI.getAppVersion();
        if (info && info.version) version = 'v' + info.version;
      } catch (_) {}
    }

    el.innerHTML = `
      <div class="settings-section glass">
        <h3 class="section-title">Updates</h3>
        <div class="setting-row">
          <label>Current Version</label>
          <span class="about-text" id="update-current-version">${version}</span>
        </div>
        <div class="setting-row">
          <label class="checkbox-label">
            <input type="checkbox" id="setting-auto-update" ${currentSettings.autoUpdate !== false ? 'checked' : ''}>
            Auto-download updates
          </label>
          <span class="setting-hint" style="margin-left:24px;display:block">Automatically download new versions in the background and install on next restart</span>
        </div>
        <div id="update-status" class="update-status"></div>
        <div class="setting-row" style="gap:8px;margin-top:8px">
          <button class="btn-pixel" id="btn-check-updates">Check for Updates</button>
          <button class="btn-pixel" id="btn-download-update" style="display:none">Download Update</button>
          <button class="btn-pixel" id="btn-install-update" style="display:none">Install & Restart</button>
        </div>
      </div>
    `;

    el.querySelector('#setting-auto-update')?.addEventListener('change', (e) => {
      currentSettings.autoUpdate = e.target.checked;
      saveCurrentSettings();
    });

    el.querySelector('#btn-check-updates')?.addEventListener('click', async () => {
      if (spirosAPI.checkForUpdates) await spirosAPI.checkForUpdates();
    });

    el.querySelector('#btn-download-update')?.addEventListener('click', async () => {
      if (spirosAPI.downloadUpdate) await spirosAPI.downloadUpdate();
    });

    el.querySelector('#btn-install-update')?.addEventListener('click', () => {
      if (spirosAPI.installUpdate) spirosAPI.installUpdate();
    });

    // Listen for update status events
    if (spirosAPI.onUpdateStatus) {
      spirosAPI.onUpdateStatus((data) => {
        const statusEl = document.getElementById('update-status');
        const btnCheck = document.getElementById('btn-check-updates');
        const btnDownload = document.getElementById('btn-download-update');
        const btnInstall = document.getElementById('btn-install-update');
        if (!statusEl) return;

        switch (data.status) {
          case 'checking':
            statusEl.innerHTML = '<span class="update-msg">Checking for updates...</span>';
            if (btnCheck) { btnCheck.textContent = 'Checking...'; btnCheck.disabled = true; }
            break;
          case 'available':
            statusEl.innerHTML = `<span class="update-msg update-available">Update available: v${data.version}</span>`;
            if (btnCheck) { btnCheck.textContent = 'Check for Updates'; btnCheck.disabled = false; btnCheck.style.display = 'none'; }
            if (btnDownload) btnDownload.style.display = '';
            break;
          case 'up-to-date':
            statusEl.innerHTML = '<span class="update-msg update-current">You\'re up to date!</span>';
            if (btnCheck) { btnCheck.textContent = 'Check for Updates'; btnCheck.disabled = false; }
            break;
          case 'downloading':
            statusEl.innerHTML = `<span class="update-msg">Downloading... ${data.percent}%</span><div class="update-progress"><div class="update-progress-fill" style="width:${data.percent}%"></div></div>`;
            if (btnDownload) { btnDownload.textContent = 'Downloading...'; btnDownload.disabled = true; }
            break;
          case 'ready':
            statusEl.innerHTML = `<span class="update-msg update-available">v${data.version} ready to install</span>`;
            if (btnDownload) btnDownload.style.display = 'none';
            if (btnInstall) btnInstall.style.display = '';
            break;
          case 'error':
            statusEl.innerHTML = `<span class="update-msg update-error">${data.message}</span>`;
            if (btnCheck) { btnCheck.textContent = 'Check for Updates'; btnCheck.disabled = false; }
            if (btnDownload) { btnDownload.textContent = 'Download Update'; btnDownload.disabled = false; }
            break;
        }
      });
    }
  }

  // ===== Tracking Tab =====
  function renderTracking(el) {
    el.innerHTML = `
      <div class="settings-section glass">
        <h3 class="section-title">Tracking</h3>
        <div class="setting-row">
          <label>Poll Interval</label>
          <select id="setting-poll-interval" class="select-pixel">
            <option value="3000" ${currentSettings.pollIntervalMs === 3000 ? 'selected' : ''}>3 seconds</option>
            <option value="5000" ${currentSettings.pollIntervalMs === 5000 ? 'selected' : ''}>5 seconds</option>
            <option value="10000" ${currentSettings.pollIntervalMs === 10000 ? 'selected' : ''}>10 seconds</option>
            <option value="15000" ${currentSettings.pollIntervalMs === 15000 ? 'selected' : ''}>15 seconds</option>
            <option value="30000" ${currentSettings.pollIntervalMs === 30000 ? 'selected' : ''}>30 seconds</option>
          </select>
        </div>
        <div class="setting-row">
          <label>Idle Timeout</label>
          <select id="setting-idle-timeout" class="select-pixel">
            <option value="120000" ${currentSettings.idleTimeoutMs === 120000 ? 'selected' : ''}>2 minutes</option>
            <option value="300000" ${currentSettings.idleTimeoutMs === 300000 ? 'selected' : ''}>5 minutes</option>
            <option value="600000" ${currentSettings.idleTimeoutMs === 600000 ? 'selected' : ''}>10 minutes</option>
            <option value="900000" ${currentSettings.idleTimeoutMs === 900000 ? 'selected' : ''}>15 minutes</option>
          </select>
        </div>
      </div>

      <div class="settings-section glass">
        <h3 class="section-title">Blocked Apps</h3>
        <p class="setting-hint">Apps in this list will be ignored by the tracker.</p>
        <div id="blocked-apps-list" class="blocked-apps-list"></div>
        <div class="setting-row" style="margin-top:8px">
          <input type="text" id="blocked-app-input" class="input-pixel" placeholder="Process name (e.g. notepad)" style="flex:1">
          <button class="btn-pixel btn-sm" id="btn-add-blocked">+ Add</button>
        </div>
      </div>
    `;

    renderBlockedApps();

    el.querySelector('#setting-poll-interval')?.addEventListener('change', (e) => {
      currentSettings.pollIntervalMs = parseInt(e.target.value);
      saveCurrentSettings();
      if (window.showToast) window.showToast('Tracking interval updated', 'success');
    });

    el.querySelector('#setting-idle-timeout')?.addEventListener('change', (e) => {
      currentSettings.idleTimeoutMs = parseInt(e.target.value);
      saveCurrentSettings();
      if (window.showToast) window.showToast('Idle timeout updated', 'success');
    });

    el.querySelector('#btn-add-blocked')?.addEventListener('click', () => {
      const input = document.getElementById('blocked-app-input');
      const val = (input.value || '').trim().toLowerCase();
      if (!val) return;
      if (!currentSettings.blockedApps) currentSettings.blockedApps = [];
      if (currentSettings.blockedApps.includes(val)) return;
      currentSettings.blockedApps.push(val);
      input.value = '';
      saveCurrentSettings();
      renderBlockedApps();
      if (window.showToast) window.showToast('App blocked', 'success');
    });

    el.querySelector('#blocked-app-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') el.querySelector('#btn-add-blocked')?.click();
    });
  }

  function renderBlockedApps() {
    const list = document.getElementById('blocked-apps-list');
    if (!list) return;
    const apps = currentSettings.blockedApps || [];

    if (apps.length === 0) {
      list.innerHTML = '<div class="blocked-app-empty">No blocked apps</div>';
      return;
    }

    list.innerHTML = apps.map((appName, i) => `
      <div class="blocked-app-item">
        <span class="blocked-app-name">${escapeHtml(appName)}</span>
        <button class="btn-icon btn-remove-blocked" data-index="${i}" title="Remove">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.btn-remove-blocked').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        currentSettings.blockedApps.splice(idx, 1);
        saveCurrentSettings();
        renderBlockedApps();
        if (window.showToast) window.showToast('App unblocked', 'success');
      });
    });
  }

  // ===== Categories Tab =====
  function renderCategories(el) {
    el.innerHTML = `
      <div class="settings-section glass">
        <h3 class="section-title">Categories</h3>
        <div id="categories-editor"></div>
        <button class="btn-pixel btn-sm" id="btn-add-category" style="margin-top:8px">+ Add Category</button>
      </div>
    `;

    renderCategoriesEditor();

    el.querySelector('#btn-add-category')?.addEventListener('click', () => {
      const name = prompt('Category name:');
      if (!name || currentSettings.categories[name.toLowerCase()]) return;
      currentSettings.categories[name.toLowerCase()] = {
        patterns: [],
        icon: 'box',
        color: '#78909c'
      };
      saveCurrentSettings();
      renderCategoriesEditor();
    });
  }

  function renderCategoriesEditor() {
    const editor = document.getElementById('categories-editor');
    if (!editor) return;

    editor.innerHTML = Object.entries(currentSettings.categories).map(([name, cat]) => `
      <div class="category-row" data-cat="${name}">
        <span class="cat-color-dot" style="background:${cat.color}"></span>
        <span class="cat-name">${name}</span>
        <input type="text" class="input-pixel input-sm cat-patterns" value="${(cat.patterns || []).join(', ')}" placeholder="Patterns (comma separated)">
        <input type="color" class="cat-color-picker" value="${cat.color}">
        ${name !== 'other' ? '<button class="btn-icon btn-remove-cat" title="Remove">✕</button>' : ''}
      </div>
    `).join('');

    editor.querySelectorAll('.category-row').forEach(row => {
      const catName = row.dataset.cat;

      row.querySelector('.cat-patterns')?.addEventListener('change', (e) => {
        currentSettings.categories[catName].patterns = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
        saveCurrentSettings();
        if (window.showToast) window.showToast('Category updated', 'success');
      });

      row.querySelector('.cat-color-picker')?.addEventListener('change', (e) => {
        currentSettings.categories[catName].color = e.target.value;
        row.querySelector('.cat-color-dot').style.background = e.target.value;
        saveCurrentSettings();
        if (window.showToast) window.showToast('Category updated', 'success');
      });

      row.querySelector('.btn-remove-cat')?.addEventListener('click', () => {
        delete currentSettings.categories[catName];
        saveCurrentSettings();
        renderCategoriesEditor();
      });
    });
  }

  // ===== Privacy Tab =====
  async function renderPrivacy(el) {
    el.innerHTML = '<div class="settings-section glass"><div class="loading-state">Loading...</div></div>';

    const privacy = await spirosAPI.getPrivacySettings();

    const toggles = [
      { key: 'trackWindowTitles', label: 'Track window titles', desc: 'Store the title of each window (e.g. document names, web page titles)' },
      { key: 'trackKeystrokes', label: 'Track keystroke counts', desc: 'Count key presses per session (not what you type)' },
      { key: 'trackDomains', label: 'Track browser domains', desc: 'Extract website domains from browser window titles' },
      { key: 'syncKeystrokesToCloud', label: 'Sync keystroke stats to cloud', desc: 'Include keystroke counts when syncing to your Spiros account' },
      { key: 'syncEntriesToCloud', label: 'Sync activity entries to cloud', desc: 'Upload detailed activity log entries (not just summaries)' },
      { key: 'shareDetailedStats', label: 'Share detailed stats with friends', desc: 'Let friends see app names and keystroke counts in comparisons' }
    ];

    const retentionOptions = [
      { value: 0, label: 'Keep forever' },
      { value: 30, label: '30 days' },
      { value: 60, label: '60 days' },
      { value: 90, label: '90 days' },
      { value: 180, label: '180 days' },
      { value: 365, label: '1 year' }
    ];

    el.innerHTML = `
      <div class="settings-section glass">
        <h3 class="section-title">Privacy</h3>
        <p class="setting-hint">Control what data Spiros collects and shares.</p>
        ${toggles.map(t => `
          <div class="setting-row">
            <label class="checkbox-label">
              <input type="checkbox" class="privacy-toggle" data-key="${t.key}" ${privacy[t.key] ? 'checked' : ''}>
              ${escapeHtml(t.label)}
            </label>
            <span class="setting-hint" style="margin-left:24px;display:block">${escapeHtml(t.desc)}</span>
          </div>
        `).join('')}
        <div class="setting-row" style="margin-top:8px">
          <label>Data retention</label>
          <select id="privacy-retention" class="select-pixel">
            ${retentionOptions.map(o => `<option value="${o.value}" ${privacy.dataRetentionDays === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="settings-section glass">
        <h3 class="section-title">Data Management</h3>
        <div class="setting-row" style="gap:8px">
          <button class="btn-pixel" id="btn-export-data">Export Data</button>
          <button class="btn-pixel btn-danger" id="btn-clear-history">Clear History</button>
        </div>
      </div>
    `;

    el.querySelectorAll('.privacy-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', async () => {
        const updated = {};
        updated[checkbox.dataset.key] = checkbox.checked;
        await spirosAPI.setPrivacySettings(updated);
        if (window.showToast) window.showToast('Privacy setting saved', 'success');
      });
    });

    el.querySelector('#privacy-retention')?.addEventListener('change', async (e) => {
      await spirosAPI.setPrivacySettings({ dataRetentionDays: parseInt(e.target.value) });
    });

    el.querySelector('#btn-export-data')?.addEventListener('click', async () => {
      if (window.requiresTier && !window.requiresTier('starter')) {
        if (window.showUpgradeModal) window.showUpgradeModal('Data Export', 'starter');
        return;
      }
      const result = await spirosAPI.exportData();
      if (result.success) alert('Data exported to ' + result.path);
    });

    el.querySelector('#btn-clear-history')?.addEventListener('click', async () => {
      if (await showConfirm('Are you sure? This will delete ALL activity history.')) {
        await spirosAPI.clearHistory();
        await showConfirm('History cleared.');
      }
    });
  }

  // ===== General Tab =====
  function renderGeneral(el) {
    el.innerHTML = `
      <div class="settings-section glass">
        <h3 class="section-title">Projects Folder</h3>
        <div class="setting-row">
          <input type="text" id="setting-projects-folder" class="input-pixel" value="${escapeAttr(currentSettings.projectsFolder)}" readonly>
          <button class="btn-pixel" id="btn-browse-folder">Browse</button>
        </div>
      </div>

      <div class="settings-section glass">
        <h3 class="section-title">Startup</h3>
        <div class="setting-row">
          <label class="checkbox-label">
            <input type="checkbox" id="setting-start-minimized" ${currentSettings.startMinimized ? 'checked' : ''}>
            Start minimized to tray
          </label>
        </div>
      </div>
    `;

    el.querySelector('#btn-browse-folder')?.addEventListener('click', async () => {
      const result = await spirosAPI.openFolder();
      if (result.success) {
        currentSettings.projectsFolder = result.path;
        document.getElementById('setting-projects-folder').value = result.path;
        saveCurrentSettings();
      }
    });

    el.querySelector('#setting-start-minimized')?.addEventListener('change', (e) => {
      currentSettings.startMinimized = e.target.checked;
      saveCurrentSettings();
    });
  }

  // ===== Subscription Tab =====
  async function renderSubscription(el) {
    const tier = window._currentTier || 'free';
    let details = null;
    try {
      details = await spirosAPI.getSubscriptionDetails();
    } catch (_) {}

    const TIER_PLANS = [
      {
        id: 'starter', label: 'STARTER', cssClass: 'tier-starter',
        monthly: '$3.99', yearly: '$35.88',
        features: [
          'Unlimited projects',
          'Cloud sync & backup',
          'All chat channels (unlimited)',
          'Data export (CSV/JSON)',
          'Community submissions',
          'Friend stat comparison',
          'All 3 themes'
        ]
      },
      {
        id: 'pro', label: 'PRO', cssClass: 'tier-pro',
        monthly: '$9.99', yearly: '$89.88',
        features: [
          'Everything in Starter',
          'Advanced analytics & trends',
          '1.25x XP bonus',
          'DMs + chat reactions',
          'Global leaderboard',
          'Weekly challenges',
          'Avatar color & custom title',
          'Streak freeze (1/week)'
        ]
      },
      {
        id: 'max', label: 'MAX', cssClass: 'tier-max',
        monthly: '$19.99', yearly: '$179.88',
        features: [
          'Everything in Pro',
          '1.5x XP bonus',
          'Create & manage guilds',
          'Profile frames',
          '2-year data retention'
        ]
      }
    ];

    const tierOrder = { free: 0, starter: 1, pro: 2, max: 3 };
    const currentOrder = tierOrder[tier] || 0;

    function buildPlanCard(p, ctaLabel) {
      return `
        <div class="subscription-plan-card glass">
          <div class="sub-plan-header ${p.cssClass}">${p.label}</div>
          <div class="sub-plan-price">${p.monthly}<span class="sub-plan-period">/mo</span></div>
          <div class="sub-plan-yearly">${p.yearly}/yr</div>
          <ul class="sub-plan-features">
            ${p.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
          </ul>
          <button class="btn-pixel upgrade-btn" data-upgrade-tier="${p.id}">${ctaLabel}</button>
        </div>
      `;
    }

    let html = '';

    if (tier === 'free') {
      // Free plan: full 3-column comparison grid
      html = `
        <div class="settings-section glass">
          <h3 class="section-title">Choose Your Plan</h3>
          <p class="setting-hint">You're currently on the <strong>Free</strong> plan</p>
          <div class="subscription-plans-grid">
            ${TIER_PLANS.map(p => buildPlanCard(p, 'Get ' + p.label.charAt(0) + p.label.slice(1).toLowerCase())).join('')}
          </div>
        </div>
      `;
    } else {
      // Paid plan: current plan info + manage link
      const statusText = details?.cancel_at_period_end ? 'Cancels at period end' : (details?.status || 'Active');
      const renewLabel = details?.cancel_at_period_end ? 'Expires' : 'Renews';
      const renewDate = details?.current_period_end
        ? new Date(details.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Unknown';
      const planInfo = TIER_PLANS.find(p => p.id === tier);
      const planLabel = planInfo ? planInfo.label : tier.toUpperCase();
      const planClass = planInfo ? planInfo.cssClass : 'tier-starter';

      html = `
        <div class="settings-section glass sub-current-plan-card">
          <h3 class="section-title">Your Plan</h3>
          <div class="sub-current-plan-info">
            <span class="tier-badge ${planClass}">${planLabel}</span>
            <span class="sub-current-status">Status: ${escapeHtml(statusText)}</span>
          </div>
          <div class="sub-current-renew">${renewLabel}: ${escapeHtml(renewDate)}</div>
          <button class="btn-pixel sub-manage-link" id="btn-manage-external">Manage on spiros.app &rarr;</button>
        </div>
      `;

      // Show upgrade cards for tiers above current
      const upgradePlans = TIER_PLANS.filter(p => (tierOrder[p.id] || 0) > currentOrder);
      if (upgradePlans.length > 0) {
        html += `
          <div class="subscription-plans-grid" style="margin-top:16px">
            ${upgradePlans.map(p => buildPlanCard(p, 'Upgrade to ' + p.label.charAt(0) + p.label.slice(1).toLowerCase())).join('')}
          </div>
        `;
      }
    }

    el.innerHTML = html;

    // Wire "Manage on spiros.app" button (paid users)
    el.querySelector('#btn-manage-external')?.addEventListener('click', () => {
      spirosAPI.openExternalLink('https://spiros.app/settings/subscription');
    });

    // Wire upgrade/get buttons
    el.querySelectorAll('[data-upgrade-tier]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTier = btn.dataset.upgradeTier;
        const label = targetTier.charAt(0).toUpperCase() + targetTier.slice(1);
        showUpgradeModal(label, targetTier);
      });
    });
  }

  // ===== Theme Tab =====
  function renderTheme(el) {
    const currentTheme = currentSettings.theme || 'neutral';
    const canSwitch = window.requiresTier && window.requiresTier('starter');

    const THEMES = [
      { id: 'neutral', name: 'AAA Neutral', desc: 'Clean, modern interface with Inter font and soft shadows', preview: '◈', previewBg: '#1a1a2e', previewColor: '#d4a843' },
      { id: 'pixel', name: 'Pixel Game', desc: 'Classic pixel art RPG with Press Start 2P font and scanlines', preview: '⚔', previewBg: '#0f0e17', previewColor: '#f5c542' },
      { id: 'matrix', name: 'Matrix Hacker', desc: 'Green-on-black terminal aesthetic with JetBrains Mono', preview: '▓', previewBg: '#0a0a0a', previewColor: '#00ff41' }
    ];

    el.innerHTML = `
      <div class="settings-section glass">
        <h3 class="section-title">Theme</h3>
        <p class="setting-hint">Choose your visual style</p>
        <div class="theme-picker-grid">
          ${THEMES.map(t => {
            const isActive = currentTheme === t.id;
            const isLocked = !canSwitch && t.id !== 'neutral';
            return `
              <div class="theme-card${isActive ? ' active' : ''}${isLocked ? ' locked' : ''}" data-theme-id="${t.id}">
                <div class="theme-card-preview" style="background:${t.previewBg};color:${t.previewColor}">${t.preview}</div>
                <div class="theme-card-name">${t.name}</div>
                <div class="theme-card-desc">${t.desc}</div>
                ${isLocked ? '<div class="theme-card-lock">&#x1F512; Starter+</div>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    el.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', async () => {
        const themeId = card.dataset.themeId;
        if (card.classList.contains('locked')) {
          if (window.showUpgradeModal) window.showUpgradeModal('Theme: ' + themeId, 'starter');
          return;
        }
        currentSettings.theme = themeId;
        document.documentElement.dataset.theme = themeId;
        await saveCurrentSettings();
        renderTheme(el);
        if (window.showToast) window.showToast('Theme applied', 'success');
      });
    });
  }

  // ===== About Tab =====
  function renderAbout(el) {
    el.innerHTML = `
      <div class="settings-section glass">
        <h3 class="section-title">About</h3>
        <p class="about-text">Spiros — Desktop Activity Tracker & Project Dashboard</p>
        <p class="about-text" style="margin-top:8px;color:var(--text-dim)">Track your digital quest. Level up by staying productive.</p>
      </div>
    `;
  }

  // ===== Helpers =====
  async function saveCurrentSettings() {
    await spirosAPI.setSettings(currentSettings);
  }

  function formatDate(iso) {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function escapeAttr(s) {
    return (s || '').replace(/"/g, '&quot;');
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { render };
})();
