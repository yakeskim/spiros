// profile.js — Profile page: avatar, display name editing, stats

const Profile = (() => {
  let editing = false;

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return 'Unknown';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  async function render(container) {
    const { user } = await synchronAPI.getUser();
    const gameState = await synchronAPI.getGameState();

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
    const email = user.email || '';
    const memberSince = formatDate(user.created_at);
    const level = gameState.level || 1;
    const title = gameState.title || 'Novice';
    const xp = gameState.xp || 0;
    const streak = gameState.streak?.current || 0;
    const achievements = (gameState.achievements || []).length;
    const changesUsed = profile.display_name_changed_count || 0;
    const changesMonth = profile.display_name_changed_month || '';
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const effectiveChanges = changesMonth === currentMonth ? changesUsed : 0;
    const changesRemaining = Math.max(0, 2 - effectiveChanges);

    container.innerHTML = `
      <div class="profile-page">
        <h2 class="page-title">Profile</h2>

        <div class="profile-identity-card glass">
          <div class="profile-avatar">${escapeHtml(initial)}</div>
          <div class="profile-identity-info">
            <div class="profile-display-name" id="profile-name-display">
              <span id="profile-name-text">${escapeHtml(displayName)}</span>
              <button class="btn-pixel btn-sm profile-edit-btn" id="btn-edit-name">Edit Name</button>
            </div>
            <div class="profile-name-editor" id="profile-name-editor" style="display:none">
              <input type="text" id="profile-name-input" class="input-pixel" value="${escapeHtml(displayName)}" maxlength="24" style="flex:1">
              <button class="btn-pixel btn-sm" id="btn-save-name">Save</button>
              <button class="btn-pixel btn-sm btn-secondary" id="btn-cancel-name">Cancel</button>
            </div>
            <div class="profile-title-line">
              <span class="profile-level">Lv. ${level}</span>
              <span class="profile-title">${escapeHtml(title)}</span>
            </div>
            <div class="profile-name-limit" id="profile-name-limit">${changesRemaining} name change${changesRemaining !== 1 ? 's' : ''} remaining this month</div>
          </div>
        </div>

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
          <div class="stat-card glass">
            <div class="stat-value">${achievements}</div>
            <div class="stat-label">Achievements</div>
          </div>
        </div>

        <div class="settings-section glass" style="margin-top:16px">
          <h3 class="section-title">Account</h3>
          <div class="setting-row">
            <span class="setting-label">Email</span>
            <span class="setting-value">${escapeHtml(email)}</span>
          </div>
          <div class="setting-row">
            <span class="setting-label">Member Since</span>
            <span class="setting-value">${memberSince}</span>
          </div>
        </div>
      </div>
    `;

    wireProfileEvents(container);
  }

  function wireProfileEvents(container) {
    const editBtn = container.querySelector('#btn-edit-name');
    const saveBtn = container.querySelector('#btn-save-name');
    const cancelBtn = container.querySelector('#btn-cancel-name');
    const display = container.querySelector('#profile-name-display');
    const editor = container.querySelector('#profile-name-editor');
    const input = container.querySelector('#profile-name-input');
    const limitEl = container.querySelector('#profile-name-limit');

    editBtn?.addEventListener('click', () => {
      display.style.display = 'none';
      editor.style.display = 'flex';
      input.focus();
      input.select();
    });

    cancelBtn?.addEventListener('click', () => {
      editor.style.display = 'none';
      display.style.display = 'flex';
    });

    saveBtn?.addEventListener('click', async () => {
      const newName = input.value.trim();
      if (!newName || newName.length < 1 || newName.length > 24) {
        limitEl.textContent = 'Name must be 1-24 characters';
        limitEl.style.color = 'var(--red)';
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const result = await synchronAPI.changeDisplayName(newName);

      if (result.success) {
        render(container);
      } else {
        limitEl.textContent = result.error || 'Failed to change name';
        limitEl.style.color = 'var(--red)';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn?.click();
      if (e.key === 'Escape') cancelBtn?.click();
    });
  }

  return { render };
})();
