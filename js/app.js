// app.js — Main renderer: routing, state, init, auth

(async function() {
  let currentView = 'dashboard';
  let gameState = null;
  let settings = null;
  let currentUser = null;

  // ===== Auth Flow =====
  const authScreen = document.getElementById('auth-screen');
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
    appEl.style.display = 'flex';
  }

  function showAuth() {
    authScreen.style.display = 'flex';
    appEl.style.display = 'none';
  }

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
  document.getElementById('skip-auth')?.addEventListener('click', (e) => {
    e.preventDefault();
    showApp();
    initApp();
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
      showApp();
      initApp();
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
        showApp();
        initApp();
      } else {
        showAuthError('Check your email to confirm your account, then log in.');
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
      }
    } else {
      showAuthError(result.error);
    }
  });

  // ===== Navigation =====
  function navigateTo(view) {
    currentView = view;
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(el => {
      el.classList.toggle('active', el.id === `view-${view}`);
    });
    renderView(view);
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
      case 'friends':
        await Friends.render(container);
        break;
      case 'achievements':
        await renderAchievements(container);
        break;
      case 'settings':
        await Settings.render(container);
        break;
    }
  }

  // ===== Achievements View =====
  async function renderAchievements(container) {
    gameState = await synchronAPI.getGameState();
    const earned = gameState.achievements || [];

    container.innerHTML = `
      <div class="achievements-page">
        <h2 class="page-title">Achievements</h2>

        <div class="dash-stats-row">
          <div class="stat-card glass">
            <div class="stat-value">${earned.length}/${Gamification.ACHIEVEMENTS.length}</div>
            <div class="stat-label">Unlocked</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">Lv. ${gameState.level}</div>
            <div class="stat-label">${gameState.title}</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">🔥 ${gameState.streak.current}</div>
            <div class="stat-label">Current Streak</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-value">🏆 ${gameState.streak.best}</div>
            <div class="stat-label">Best Streak</div>
          </div>
        </div>

        <div class="achievements-grid">
          ${Gamification.ACHIEVEMENTS.map(ach => {
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

        <h3 class="page-subtitle">Resources</h3>
        <div class="resources-display">
          <div class="resource-card glass">
            <span class="resource-big-icon gold">●</span>
            <div class="resource-amount">${gameState.resources.gold}</div>
            <div class="resource-name">Gold</div>
          </div>
          <div class="resource-card glass">
            <span class="resource-big-icon gems">◆</span>
            <div class="resource-amount">${gameState.resources.gems}</div>
            <div class="resource-name">Gems</div>
          </div>
          <div class="resource-card glass">
            <span class="resource-big-icon wood">▪</span>
            <div class="resource-amount">${gameState.resources.wood}</div>
            <div class="resource-name">Wood</div>
          </div>
          <div class="resource-card glass">
            <span class="resource-big-icon stone">■</span>
            <div class="resource-amount">${gameState.resources.stone}</div>
            <div class="resource-name">Stone</div>
          </div>
        </div>
      </div>
    `;
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

  // ===== Resource Bar =====
  function updateResourceBar() {
    if (!gameState) return;
    const res = gameState.resources || {};
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || 0; };
    set('res-gold', res.gold);
    set('res-gems', res.gems);
    set('res-wood', res.wood);
    set('res-stone', res.stone);
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
    if (dot) dot.classList.toggle('active', status.isTracking);
    if (label) label.textContent = status.isTracking ? 'Tracking' : 'Paused';
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

    const todayData = await synchronAPI.getToday();
    const oldLevel = gameState.level;

    const catTotals = { ...(todayData.summary.byCategory || {}) };
    const result = Gamification.processDayActivity(gameState, todayData, catTotals);

    await synchronAPI.setGameState(gameState);

    updateXPBar();
    updateResourceBar();
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
    updateResourceBar();
    updateStreak();
    updateTrackingStatus();

    // Wire nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.view));
    });

    navigateTo('dashboard');
    setInterval(updateTrackingStatus, 10000);
  }

  // ===== Startup: check auth =====
  async function startup() {
    const { user } = await synchronAPI.getUser();
    if (user) {
      currentUser = user;
      showApp();
      initApp();
    } else {
      showAuth();
    }
  }

  startup();
})();
