// app.js — Main renderer: routing, state, init, auth

(async function() {
  let currentView = 'dashboard';
  let gameState = null;
  let settings = null;
  let currentUser = null;

  // ===== Auth Flow =====
  const authScreen = document.getElementById('auth-screen');
  const consentScreen = document.getElementById('consent-screen');
  const appEl = document.getElementById('app');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authError = document.getElementById('auth-error');

  function showAuthError(msg) {
    authError.textContent = msg;
    authError.style.display = 'block';
    setTimeout(() => { authError.style.display = 'none'; }, 5000);
  }

  function showApp() {
    authScreen.style.display = 'none';
    consentScreen.style.display = 'none';
    appEl.style.display = 'flex';
    // Show loader immediately while the first view loads
    const loader = document.getElementById('content-loader');
    if (loader) { loader.classList.remove('fade-out'); loader.classList.add('active'); }
  }

  function showAuth() {
    authScreen.style.display = 'flex';
    consentScreen.style.display = 'none';
    appEl.style.display = 'none';
  }

  function showConsent() {
    authScreen.style.display = 'none';
    consentScreen.style.display = 'flex';
    appEl.style.display = 'none';
  }

  // Check consent and show consent screen or proceed to app
  async function checkConsentThenShowApp() {
    const { consentAccepted } = await synchronAPI.getConsent();
    if (consentAccepted) {
      showApp();
      initApp();
    } else {
      showConsent();
    }
  }

  // Consent screen handlers
  document.getElementById('consent-accept')?.addEventListener('click', async () => {
    await synchronAPI.acceptConsent();
    showApp();
    initApp();
  });

  document.getElementById('consent-skip')?.addEventListener('click', (e) => {
    e.preventDefault();
    showApp();
    initApp();
  });

  document.getElementById('consent-privacy-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    synchronAPI.openExternalLink('https://spiros.app/privacy');
  });

  document.getElementById('consent-terms-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    synchronAPI.openExternalLink('https://spiros.app/terms');
  });

  // Toggle login/signup forms
  document.getElementById('show-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    authError.style.display = 'none';
  });

  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.style.display = 'none';
    loginForm.style.display = 'block';
    authError.style.display = 'none';
  });

  // Skip auth (use offline)
  document.getElementById('skip-auth')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await checkConsentThenShowApp();
  });

  // Login
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    btn.textContent = 'Logging in...';
    btn.disabled = true;

    const result = await synchronAPI.login(email, password);
    btn.textContent = 'Login';
    btn.disabled = false;

    if (result.success) {
      currentUser = result.user;
      await checkConsentThenShowApp();
    } else {
      showAuthError(result.error);
    }
  });

  // Signup
  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const btn = document.getElementById('signup-btn');
    btn.textContent = 'Creating...';
    btn.disabled = true;

    const result = await synchronAPI.signUp(email, password, name);
    btn.textContent = 'Create Account';
    btn.disabled = false;

    if (result.success) {
      if (result.session) {
        currentUser = result.user;
        await checkConsentThenShowApp();
      } else {
        showAuthError('Check your email to confirm your account, then log in.');
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
      }
    } else {
      showAuthError(result.error);
    }
  });

  // ===== Content Loader =====
  const contentLoader = document.getElementById('content-loader');

  function showLoader() {
    if (!contentLoader) return;
    contentLoader.classList.remove('fade-out');
    contentLoader.classList.add('active');
  }

  function hideLoader() {
    if (!contentLoader) return;
    contentLoader.classList.add('fade-out');
    contentLoader.addEventListener('animationend', () => {
      contentLoader.classList.remove('active', 'fade-out');
    }, { once: true });
  }

  // ===== Navigation =====
  async function navigateTo(view) {
    currentView = view;

    showLoader();

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(el => {
      el.classList.toggle('active', el.id === `view-${view}`);
    });

    await renderView(view);

    hideLoader();
  }

  async function renderView(view) {
    const container = document.getElementById(`view-${view}`);
    if (!container) return;

    switch (view) {
      case 'dashboard':
        await Dashboard.render(container);
        break;
      case 'projects':
        await Projects.render(container);
        break;
      case 'community':
        await Community.render(container);
        break;
      case 'chat':
        await Chat.render(container);
        break;
      case 'friends':
        await Friends.render(container);
        break;
      case 'achievements':
        await renderAchievements(container);
        break;
      case 'profile':
        await Profile.render(container);
        break;
      case 'settings':
        await Settings.render(container);
        break;
    }
  }

  // ===== Achievements View =====
  let achFilter = 'all';

  async function renderAchievements(container) {
    gameState = await synchronAPI.getGameState();
    const earned = gameState.achievements || [];
    const allAch = Gamification.ACHIEVEMENTS;
    const categories = Gamification.ACHIEVEMENT_CATEGORIES;

    // Filter
    const filtered = achFilter === 'all' ? allAch
      : achFilter === 'unlocked' ? allAch.filter(a => earned.includes(a.id))
      : achFilter === 'locked' ? allAch.filter(a => !earned.includes(a.id))
      : allAch.filter(a => a.cat === achFilter);

    // Group by category
    const grouped = {};
    for (const ach of filtered) {
      if (!grouped[ach.cat]) grouped[ach.cat] = [];
      grouped[ach.cat].push(ach);
    }

    const pct = allAch.length ? Math.round((earned.length / allAch.length) * 100) : 0;

    container.innerHTML = `
      <div class="achievements-page">
        <h2 class="page-title">Achievements</h2>

        <div class="dash-stats-row">
          <div class="stat-card glass">
            <div class="stat-value">${earned.length}/${allAch.length}</div>
            <div class="stat-label">Unlocked (${pct}%)</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">Lv. ${gameState.level}</div>
            <div class="stat-label">${gameState.title}</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">${gameState.streak.current}</div>
            <div class="stat-label">Current Streak</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">${gameState.streak.best}</div>
            <div class="stat-label">Best Streak</div>
          </div>
        </div>

        <div class="ach-filters">
          <button class="ach-filter-btn ${achFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
          <button class="ach-filter-btn ${achFilter === 'unlocked' ? 'active' : ''}" data-filter="unlocked">Unlocked</button>
          <button class="ach-filter-btn ${achFilter === 'locked' ? 'active' : ''}" data-filter="locked">Locked</button>
          ${categories.map(c => `<button class="ach-filter-btn ${achFilter === c.id ? 'active' : ''}" data-filter="${c.id}">${c.icon} ${c.name}</button>`).join('')}
        </div>

        ${Object.entries(grouped).map(([catId, achs]) => {
          const cat = categories.find(c => c.id === catId) || { name: catId, icon: '?' };
          const catEarned = achs.filter(a => earned.includes(a.id)).length;
          return `
            <div class="ach-category-section">
              <div class="ach-category-header">
                <span>${cat.icon} ${cat.name}</span>
                <span class="ach-category-count">${catEarned}/${achs.length}</span>
              </div>
              <div class="achievements-grid">
                ${achs.map(ach => {
                  const unlocked = earned.includes(ach.id);
                  return `
                    <div class="achievement-card glass ${unlocked ? 'unlocked' : 'locked'}">
                      <div class="ach-icon">${ach.icon}</div>
                      <div class="ach-info">
                        <div class="ach-name">${ach.name}</div>
                        <div class="ach-desc">${ach.desc}</div>
                      </div>
                      ${unlocked ? '<div class="ach-check">✓</div>' : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}

        ${filtered.length === 0 ? '<div class="ach-empty">No achievements in this category yet.</div>' : ''}
      </div>
    `;

    // Wire filter buttons
    container.querySelectorAll('.ach-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        achFilter = btn.dataset.filter;
        renderAchievements(container);
      });
    });
  }

  // ===== XP Bar =====
  function updateXPBar() {
    if (!gameState) return;
    const level = gameState.level;
    const currentLevelXP = Gamification.getXPForLevel(level);
    const nextLevelXP = Gamification.getXPForNextLevel(level);
    const progress = nextLevelXP > currentLevelXP ?
      ((gameState.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100 : 100;

    const lvlEl = document.getElementById('xp-level');
    const titleEl = document.getElementById('xp-title');
    const fillEl = document.getElementById('xp-fill');
    const currentEl = document.getElementById('xp-current');
    const neededEl = document.getElementById('xp-needed');

    if (lvlEl) lvlEl.textContent = `Lv. ${level}`;
    if (titleEl) titleEl.textContent = gameState.title;
    if (fillEl) fillEl.style.width = `${Math.min(progress, 100)}%`;
    if (currentEl) currentEl.textContent = gameState.xp;
    if (neededEl) neededEl.textContent = nextLevelXP;
  }


  // ===== Streak =====
  function updateStreak() {
    if (!gameState) return;
    const badge = document.getElementById('streak-badge');
    if (badge) badge.textContent = `🔥 ${gameState.streak.current}`;
  }

  // ===== Tracking Status =====
  async function updateTrackingStatus() {
    const status = await synchronAPI.getTrackingStatus();
    const dot = document.getElementById('tracking-dot');
    const label = document.getElementById('tracking-label');
    if (dot) {
      dot.classList.remove('active', 'bg');
      if (status.isTracking && status.activityState === 'active') {
        dot.classList.add('active');
      } else if (status.isTracking && status.activityState === 'bg') {
        dot.classList.add('bg');
      }
      // idle or paused = no class (grey default)
    }
    if (label) {
      if (!status.isTracking) label.textContent = 'Paused';
      else if (status.activityState === 'active') label.textContent = 'Active';
      else if (status.activityState === 'bg') label.textContent = 'BG';
      else label.textContent = 'Idle';
    }
  }

  // ===== Sidebar Online Count =====
  let _cachedTotalUsers = 0;
  async function updateSidebarOnline() {
    try {
      const stats = await synchronAPI.getCommunityStats();
      if (!stats) return;
      const container = document.getElementById('sidebar-online');
      const countEl = document.getElementById('sidebar-online-count');
      const pctEl = document.getElementById('sidebar-online-pct');
      if (!container) return;

      container.style.display = '';
      if (stats.totalUsers) _cachedTotalUsers = stats.totalUsers;
      const online = stats.onlineCount || 0;
      const total = _cachedTotalUsers || 1;
      const pct = Math.round((online / total) * 100);

      if (countEl) countEl.textContent = online;
      if (pctEl) pctEl.textContent = pct + '%';
    } catch (_) {}
  }

  // ===== Achievement Toast =====
  function showAchievementToast(achievement) {
    const toast = document.getElementById('achievement-toast');
    if (!toast) return;
    toast.querySelector('.toast-name').textContent = `${achievement.icon} ${achievement.name}`;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hidden');
    }, 4000);
  }

  // ===== Level Up Modal =====
  function showLevelUp(level, title) {
    const modal = document.getElementById('levelup-modal');
    if (!modal) return;
    document.getElementById('levelup-level').textContent = `Level ${level}`;
    document.getElementById('levelup-title').textContent = title;
    modal.classList.remove('hidden');
  }

  const levelupContinueBtn = document.getElementById('levelup-continue');
  if (levelupContinueBtn) {
    levelupContinueBtn.addEventListener('click', () => {
      document.getElementById('levelup-modal').classList.add('hidden');
    });
  }

  // ===== Activity Update Handler =====
  let pendingXP = 0;
  let lastGameProcess = 0;

  synchronAPI.onActivityUpdate(async (entry) => {
    pendingXP += Gamification.calcEntryXP(entry);

    const now = Date.now();
    if (now - lastGameProcess < 30000) {
      Dashboard.refreshIfDaily();
      return;
    }
    lastGameProcess = now;

    // Re-read fresh state so we don't overwrite village/other changes
    gameState = await synchronAPI.getGameState();

    const todayData = await synchronAPI.getToday();
    const oldLevel = gameState.level;

    const catTotals = { ...(todayData.summary.byCategory || {}) };
    const result = Gamification.processDayActivity(gameState, todayData, catTotals);

    await synchronAPI.setGameState(gameState);

    updateXPBar();
    updateStreak();

    for (const ach of result.newAchievements) {
      showAchievementToast(ach);
    }

    if (result.leveledUp) {
      showLevelUp(gameState.level, gameState.title);
    }

    Dashboard.refreshIfDaily();
  });

  // ===== Init App (after auth) =====
  async function initApp() {
    gameState = await synchronAPI.getGameState();
    settings = await synchronAPI.getSettings();

    updateXPBar();
    updateStreak();
    updateTrackingStatus();

    // Display app version in sidebar
    if (synchronAPI.getAppVersion) {
      synchronAPI.getAppVersion().then(info => {
        const el = document.getElementById('app-version');
        if (el && info && info.version) el.textContent = 'v' + info.version;
      }).catch(() => {});
    }

    // Sidebar online count
    updateSidebarOnline();
    if (synchronAPI.onPresenceSync) {
      synchronAPI.onPresenceSync(() => updateSidebarOnline());
    }
    if (synchronAPI.onPresenceJoin) {
      synchronAPI.onPresenceJoin(() => updateSidebarOnline());
    }
    if (synchronAPI.onPresenceLeave) {
      synchronAPI.onPresenceLeave(() => updateSidebarOnline());
    }

    // Wire nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.view));
    });

    navigateTo('dashboard');
    setInterval(updateTrackingStatus, 3000);
  }

  // ===== Startup: check auth =====
  async function startup() {
    const { user } = await synchronAPI.getUser();
    if (user) {
      currentUser = user;
      await checkConsentThenShowApp();
    } else {
      showAuth();
    }
  }

  startup();
})();
