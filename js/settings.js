// settings.js — Settings panel

const Settings = (() => {
  let currentSettings = null;

  async function render(container) {
    currentSettings = await synchronAPI.getSettings();

    container.innerHTML = `
      <div class="settings-page">
        <h2 class="page-title">Settings</h2>

        <div class="settings-section glass">
          <h3 class="section-title">Projects Folder</h3>
          <div class="setting-row">
            <input type="text" id="setting-projects-folder" class="input-pixel" value="${escapeAttr(currentSettings.projectsFolder)}" readonly>
            <button class="btn-pixel" id="btn-browse-folder">Browse</button>
          </div>
        </div>

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

        <div class="settings-section glass">
          <h3 class="section-title">Categories</h3>
          <div id="categories-editor"></div>
          <button class="btn-pixel btn-sm" id="btn-add-category" style="margin-top:8px">+ Add Category</button>
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

        <div class="settings-section glass">
          <h3 class="section-title">Data Management</h3>
          <div class="setting-row" style="gap:8px">
            <button class="btn-pixel" id="btn-export-data">Export Data</button>
            <button class="btn-pixel btn-danger" id="btn-clear-history">Clear History</button>
          </div>
        </div>

        <div class="settings-section glass">
          <h3 class="section-title">Account</h3>
          <div id="account-info"></div>
          <div class="setting-row" style="gap:8px;margin-top:8px">
            <button class="btn-pixel" id="btn-sync-now">Sync Now</button>
            <button class="btn-pixel btn-danger" id="btn-logout">Logout</button>
          </div>
        </div>

        <div class="settings-section glass">
          <h3 class="section-title">About</h3>
          <p class="about-text">Synchron v1.0.0 — Desktop Activity Tracker & Project Dashboard</p>
        </div>
      </div>
    `;

    renderBlockedApps();
    renderCategoriesEditor();
    renderAccountInfo();
    wireEvents(container);
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
      });
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
        ${name !== 'other' ? `<button class="btn-icon btn-remove-cat" title="Remove">✕</button>` : ''}
      </div>
    `).join('');

    // Wire pattern/color changes
    editor.querySelectorAll('.category-row').forEach(row => {
      const catName = row.dataset.cat;

      row.querySelector('.cat-patterns')?.addEventListener('change', (e) => {
        currentSettings.categories[catName].patterns = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
        saveCurrentSettings();
      });

      row.querySelector('.cat-color-picker')?.addEventListener('change', (e) => {
        currentSettings.categories[catName].color = e.target.value;
        row.querySelector('.cat-color-dot').style.background = e.target.value;
        saveCurrentSettings();
      });

      row.querySelector('.btn-remove-cat')?.addEventListener('click', () => {
        delete currentSettings.categories[catName];
        saveCurrentSettings();
        renderCategoriesEditor();
      });
    });
  }

  async function renderAccountInfo() {
    const el = document.getElementById('account-info');
    if (!el) return;
    try {
      const { user } = await synchronAPI.getUser();
      if (user && user.email) {
        const name = user.profile?.display_name || user.email;
        el.innerHTML = `
          <div class="setting-row">
            <label>Signed in as</label>
            <span class="about-text" style="color:var(--gold)">${escapeHtml(name)}</span>
          </div>
          <div class="setting-row">
            <label>Email</label>
            <span class="about-text">${escapeHtml(user.email)}</span>
          </div>
        `;
      } else {
        el.innerHTML = '<p class="about-text">Not signed in — using offline mode</p>';
      }
    } catch (e) {
      el.innerHTML = '<p class="about-text">Not signed in — using offline mode</p>';
    }
  }

  function wireEvents(container) {
    container.querySelector('#btn-browse-folder')?.addEventListener('click', async () => {
      const result = await synchronAPI.openFolder();
      if (result.success) {
        currentSettings.projectsFolder = result.path;
        document.getElementById('setting-projects-folder').value = result.path;
        saveCurrentSettings();
      }
    });

    container.querySelector('#setting-poll-interval')?.addEventListener('change', (e) => {
      currentSettings.pollIntervalMs = parseInt(e.target.value);
      saveCurrentSettings();
    });

    container.querySelector('#setting-idle-timeout')?.addEventListener('change', (e) => {
      currentSettings.idleTimeoutMs = parseInt(e.target.value);
      saveCurrentSettings();
    });

    container.querySelector('#setting-start-minimized')?.addEventListener('change', (e) => {
      currentSettings.startMinimized = e.target.checked;
      saveCurrentSettings();
    });

    // Blocked apps: add
    container.querySelector('#btn-add-blocked')?.addEventListener('click', () => {
      const input = document.getElementById('blocked-app-input');
      const val = (input.value || '').trim().toLowerCase();
      if (!val) return;
      if (!currentSettings.blockedApps) currentSettings.blockedApps = [];
      if (currentSettings.blockedApps.includes(val)) return;
      currentSettings.blockedApps.push(val);
      input.value = '';
      saveCurrentSettings();
      renderBlockedApps();
    });

    // Allow Enter key to add blocked app
    container.querySelector('#blocked-app-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        container.querySelector('#btn-add-blocked')?.click();
      }
    });

    container.querySelector('#btn-add-category')?.addEventListener('click', () => {
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

    container.querySelector('#btn-export-data')?.addEventListener('click', async () => {
      const result = await synchronAPI.exportData();
      if (result.success) alert('Data exported to ' + result.path);
    });

    container.querySelector('#btn-clear-history')?.addEventListener('click', async () => {
      if (confirm('Are you sure? This will delete ALL activity history.')) {
        await synchronAPI.clearHistory();
        alert('History cleared.');
      }
    });

    container.querySelector('#btn-sync-now')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btn-sync-now');
      btn.textContent = 'Syncing...';
      btn.disabled = true;
      try {
        await synchronAPI.syncNow();
        btn.textContent = 'Synced!';
        setTimeout(() => { btn.textContent = 'Sync Now'; btn.disabled = false; }, 2000);
      } catch (e) {
        btn.textContent = 'Sync Now';
        btn.disabled = false;
        alert('Sync failed: ' + (e.message || 'Unknown error'));
      }
    });

    container.querySelector('#btn-logout')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to logout?')) {
        await synchronAPI.logout();
        window.location.reload();
      }
    });
  }

  async function saveCurrentSettings() {
    await synchronAPI.setSettings(currentSettings);
  }

  function escapeAttr(s) {
    return (s || '').replace(/"/g, '&quot;');
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { render };
})();
