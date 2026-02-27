// app.js — Main renderer: routing, state, init, auth

// ===== Global Tier State =====
let currentTier = 'free';
window._currentTier = 'free';

function requiresTier(tier) {
  const order = { free: 0, starter: 1, pro: 2, max: 3 };
  return (order[currentTier] || 0) >= (order[tier] || 0);
}
window.requiresTier = requiresTier;

function showUpgradeModal(featureName, requiredTier) {
  const modal = document.getElementById('upgrade-modal');
  if (!modal) return;
  const titleEl = document.getElementById('upgrade-modal-title');
  const descEl = document.getElementById('upgrade-modal-desc');

  const tier = requiredTier || 'starter';
  const tierLabels = { starter: 'Starter', pro: 'Pro', max: 'Max' };
  const tierLabel = tierLabels[tier] || 'Starter';

  if (titleEl) titleEl.textContent = 'Subscribe Now';
  if (descEl) descEl.textContent = featureName ? `"${featureName}" requires ${tierLabel}` : `Unlock ${tierLabel} features`;

  // Store required tier
  modal.dataset.requiredTier = tier;

  // Update plan card states
  const tierOrder = { free: 0, starter: 1, pro: 2, max: 3 };
  const currentOrder = tierOrder[currentTier] || 0;
  const requiredOrder = tierOrder[tier] || 1;

  document.querySelectorAll('.upgrade-plan-card').forEach(card => {
    const cardTier = card.dataset.tier;
    const cardOrder = tierOrder[cardTier] || 0;

    card.classList.remove('selected', 'recommended', 'disabled');

    if (cardOrder <= currentOrder) {
      card.classList.add('disabled');
    } else if (cardOrder === requiredOrder) {
      card.classList.add('selected', 'recommended');
    }
  });

  // Reset billing toggle to monthly
  document.querySelectorAll('.upgrade-billing-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.billing === 'monthly');
  });
  document.querySelectorAll('.upgrade-plan-price').forEach(el => {
    if (el.dataset.monthly) el.textContent = el.dataset.monthly;
  });

  modal.classList.remove('hidden');
}
window.showUpgradeModal = showUpgradeModal;

// ===== General Toast =====
let _toastTimer = null;
function showToast(message, type = 'info') {
  const el = document.getElementById('general-toast');
  if (!el) return;
  clearTimeout(_toastTimer);
  el.classList.remove('hidden', 'show', 'toast-success', 'toast-error', 'toast-warning', 'toast-info');
  el.textContent = message;
  el.classList.add('toast-' + type);
  // Force reflow then show
  void el.offsetWidth;
  el.classList.add('show');
  _toastTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 200);
  }, 3500);
}
window.showToast = showToast;

function updateTierBadge() {
  let badge = document.getElementById('tier-badge');
  if (currentTier === 'free') {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'tier-badge';
    const footer = document.querySelector('.sidebar-footer');
    if (footer) footer.insertAdjacentElement('beforebegin', badge);
  }
  const tierClasses = { starter: 'tier-starter', pro: 'tier-pro', max: 'tier-max' };
  const tierLabels = { starter: 'STARTER', pro: 'PRO', max: 'MAX' };
  const tierClass = tierClasses[currentTier] || 'tier-starter';
  const tierLabel = tierLabels[currentTier] || 'STARTER';
  badge.className = `tier-badge ${tierClass}`;
  badge.textContent = tierLabel;
}

// Global confirm modal (replaces native confirm())
function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-modal');
    const msg = document.getElementById('confirm-modal-msg');
    const btnYes = document.getElementById('confirm-modal-yes');
    const btnNo = document.getElementById('confirm-modal-no');
    msg.textContent = message;
    overlay.classList.remove('hidden');

    function cleanup(result) {
      overlay.classList.add('hidden');
      btnYes.removeEventListener('click', onYes);
      btnNo.removeEventListener('click', onNo);
      resolve(result);
    }
    function onYes() { cleanup(true); }
    function onNo() { cleanup(false); }
    btnYes.addEventListener('click', onYes);
    btnNo.addEventListener('click', onNo);
  });
}

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
  const forgotForm = document.getElementById('forgot-form');
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
    // Reset forms to login state
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    forgotForm.style.display = 'none';
    authError.style.display = 'none';
    // Reset input values
    loginForm.reset();
    // Fix Electron focus issue after returning to auth
    setTimeout(() => {
      const emailInput = document.getElementById('login-email');
      if (emailInput) emailInput.focus();
    }, 100);
  }
  // Expose for settings.js
  window.showAuth = showAuth;

  function showConsent() {
    authScreen.style.display = 'none';
    consentScreen.style.display = 'flex';
    appEl.style.display = 'none';
  }

  // Check consent and show consent screen or proceed to app
  async function checkConsentThenShowApp() {
    const { consentAccepted } = await spirosAPI.getConsent();
    if (consentAccepted) {
      showApp();
      initApp();
    } else {
      showConsent();
    }
  }

  // Consent screen handlers
  document.getElementById('consent-accept')?.addEventListener('click', async () => {
    await spirosAPI.acceptConsent();
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
    spirosAPI.openExternalLink('https://spiros.app/privacy');
  });

  document.getElementById('consent-terms-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    spirosAPI.openExternalLink('https://spiros.app/terms');
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
    forgotForm.style.display = 'none';
    loginForm.style.display = 'block';
    authError.style.display = 'none';
  });

  document.getElementById('show-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    forgotForm.style.display = 'block';
    authError.style.display = 'none';
  });

  document.getElementById('show-login-from-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    forgotForm.style.display = 'none';
    loginForm.style.display = 'block';
    authError.style.display = 'none';
  });

  forgotForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const btn = document.getElementById('forgot-btn');
    btn.textContent = 'Sending...';
    btn.disabled = true;

    const result = await spirosAPI.resetPassword(email);
    btn.textContent = 'Send Reset Link';
    btn.disabled = false;

    if (result.success) {
      showAuthError('Reset link sent! Check your email.');
      forgotForm.style.display = 'none';
      loginForm.style.display = 'block';
    } else {
      showAuthError(result.error);
    }
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

    const result = await spirosAPI.login(email, password);
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
    const referralCode = document.getElementById('signup-referral').value.trim().toUpperCase();
    const btn = document.getElementById('signup-btn');
    btn.textContent = 'Creating...';
    btn.disabled = true;

    const result = await spirosAPI.signUp(email, password, name, referralCode || undefined);
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

    try {
      await renderView(view);
    } catch (e) {
      console.error('renderView error:', e);
      showToast('Failed to load view', 'error');
    }

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
      case 'guilds':
        await Guilds.render(container);
        break;
      case 'chat':
        await Chat.render(container);
        break;
      case 'friends':
        await Friends.render(container);
        break;
      case 'leaderboard':
        await Leaderboard.render(container);
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
      case 'changelog':
        await Changelog.render(container);
        break;
    }
  }

  // ===== Achievements View =====
  let achFilter = 'all';

  async function renderAchievements(container) {
    gameState = await spirosAPI.getGameState();
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
          ${window.requiresTier && window.requiresTier('pro') ? `
          <div class="stat-card glass" style="cursor:pointer" id="btn-streak-freeze" title="Use a streak freeze to protect your streak (1/week)">
            <div class="stat-value">&#x2744;</div>
            <div class="stat-label">Streak Freeze</div>
          </div>` : ''}
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

    // Wire streak freeze button
    const freezeBtn = container.querySelector('#btn-streak-freeze');
    if (freezeBtn) {
      freezeBtn.addEventListener('click', async () => {
        const result = await spirosAPI.useStreakFreeze();
        if (result.success) {
          alert('Streak freeze activated! Your streak is protected for today.');
        } else {
          alert(result.error || 'Could not use streak freeze.');
        }
      });
    }
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
    const status = await spirosAPI.getTrackingStatus();
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
      const stats = await spirosAPI.getCommunityStats();
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

  spirosAPI.onActivityUpdate(async (entry) => {
    if (!entry || !entry.dur) return;
    try {
      pendingXP += Gamification.calcEntryXP(entry);

      const now = Date.now();
      if (now - lastGameProcess < 30000) {
        Dashboard.refreshIfDaily();
        return;
      }
      lastGameProcess = now;

      // Re-read fresh state so we don't overwrite concurrent changes
      gameState = await spirosAPI.getGameState();

      const todayData = await spirosAPI.getToday();
      const oldLevel = gameState.level;

      const catTotals = { ...(todayData.summary.byCategory || {}) };
      const result = Gamification.processDayActivity(gameState, todayData, catTotals);

      await spirosAPI.setGameState(gameState);

      updateXPBar();
      updateStreak();

      for (const ach of result.newAchievements) {
        showAchievementToast(ach);
      }

      if (result.leveledUp) {
        showLevelUp(gameState.level, gameState.title);
      }

      Dashboard.refreshIfDaily();
    } catch (e) {
      console.error('onActivityUpdate error:', e);
      showToast('Activity update failed', 'error');
    }
  });

  // ===== Upgrade Modal Wiring =====
  (function wireUpgradeModal() {
    const modal = document.getElementById('upgrade-modal');
    const closeBtn = document.getElementById('upgrade-modal-close');
    const subscribeBtn = document.getElementById('upgrade-modal-subscribe');

    closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

    // Billing toggle (monthly/yearly)
    document.querySelectorAll('.upgrade-billing-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const billing = btn.dataset.billing;
        document.querySelectorAll('.upgrade-billing-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.upgrade-plan-price').forEach(el => {
          if (el.dataset[billing]) el.textContent = el.dataset[billing];
        });
      });
    });

    // Plan card selection
    document.querySelectorAll('.upgrade-plan-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) return;
        document.querySelectorAll('.upgrade-plan-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    subscribeBtn?.addEventListener('click', async () => {
      const selectedCard = document.querySelector('.upgrade-plan-card.selected');
      if (!selectedCard) return;
      const tier = selectedCard.dataset.tier;
      const activeBilling = document.querySelector('.upgrade-billing-btn.active');
      const billing = activeBilling?.dataset.billing || 'monthly';
      const planKey = `${tier}_${billing}`;

      subscribeBtn.textContent = 'Opening checkout...';
      subscribeBtn.disabled = true;

      const result = await spirosAPI.createCheckout(planKey);
      subscribeBtn.textContent = 'Subscribe';
      subscribeBtn.disabled = false;

      if (result.success) {
        modal?.classList.add('hidden');
      } else {
        subscribeBtn.textContent = result.error || 'Failed';
        setTimeout(() => { subscribeBtn.textContent = 'Subscribe'; }, 3000);
      }
    });
  })();

  // ===== Init App (after auth) =====
  async function initApp() {
    gameState = await spirosAPI.getGameState();
    settings = await spirosAPI.getSettings();

    // Apply theme from settings
    document.documentElement.dataset.theme = settings.theme || 'neutral';

    // Initialize tier state
    try {
      currentTier = await spirosAPI.getTier() || 'free';
    } catch (_) { currentTier = 'free'; }
    window._currentTier = currentTier;
    updateTierBadge();

    // Listen for tier changes via Realtime
    if (spirosAPI.onTierChanged) {
      spirosAPI.onTierChanged((tier) => {
        currentTier = tier;
        window._currentTier = tier;
        updateTierBadge();
      });
    }

    updateXPBar();
    updateStreak();
    updateTrackingStatus();

    // Display app version in sidebar
    if (spirosAPI.getAppVersion) {
      spirosAPI.getAppVersion().then(info => {
        const el = document.getElementById('app-version');
        if (el && info && info.version) el.textContent = 'v' + info.version;
      }).catch(() => {});
    }

    // Sidebar online count
    updateSidebarOnline();
    if (spirosAPI.onPresenceSync) {
      spirosAPI.onPresenceSync(() => updateSidebarOnline());
    }
    if (spirosAPI.onPresenceJoin) {
      spirosAPI.onPresenceJoin(() => updateSidebarOnline());
    }
    if (spirosAPI.onPresenceLeave) {
      spirosAPI.onPresenceLeave(() => updateSidebarOnline());
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
    const { user } = await spirosAPI.getUser();
    if (user) {
      currentUser = user;
      await checkConsentThenShowApp();
    } else {
      showAuth();
    }
  }

  startup();
})();
