// village.js — Village tab: base-building metagame
// 3D WebGL rendering via Three.js, building placement, passive economy, troops, raids

const Village = (() => {
  const GRID = 24;

  let container = null;
  let villageState = null;
  let gameState = null;

  // UI state
  let selectedBuilding = null;   // building def being placed
  let selectedPlaced = null;     // placed building being inspected
  let ghostPos = null;           // {x, y} tile coords for placement ghost
  let activeTab = null;           // null | 'shop' | 'troops' | 'raidlog'
  let animFrame = null;
  let placingFromInventory = null;
  let buildQueueTimer = null;
  let selectedBuildQueueItem = null;
  let wallGhostPositions = [];
  let infoPanelRefreshTimer = null;

  // Grid occupancy: grid[y][x] = buildingIndex or -1
  let grid = [];

  // ===== Public render =====
  async function render(cont) {
    try {
      container = cont;
      gameState = await synchronAPI.getGameState();

      // Initialize village state if needed
      if (!gameState.village) {
        gameState.village = VillageData.getDefaultVillageState();
        // Auto-place Nexus at center
        const cx = Math.floor(GRID / 2) - 1;
        const cy = Math.floor(GRID / 2) - 1;
        gameState.village.buildings.push({
          id: 'nexus', level: 1, x: cx, y: cy,
          hp: VillageData.BUILDINGS.nexus.production[0]
        });
      }

      // Run save state migration (renames old buildings/troops)
      gameState.village = VillageData.migrateState(gameState.village);
      villageState = gameState.village;

      // Migration: ensure new fields exist for existing saves
      if (!villageState.inventory) villageState.inventory = [];
      if (!villageState.buildQueue) villageState.buildQueue = [];
      if (!gameState.resources.chronos && gameState.resources.chronos !== 0) gameState.resources.chronos = 0;

      // Auto-place builder_hut if none exists (for existing saves)
      if (!villageState.buildings.some(b => b.id === 'builder_hut')) {
        // Find empty spot near nexus
        const nexus = villageState.buildings.find(b => b.id === 'nexus');
        if (nexus) {
          const spots = [
            { x: nexus.x - 1, y: nexus.y },
            { x: nexus.x + 3, y: nexus.y },
            { x: nexus.x, y: nexus.y - 1 },
            { x: nexus.x, y: nexus.y + 3 }
          ];
          for (const spot of spots) {
            if (spot.x >= 0 && spot.x < GRID && spot.y >= 0 && spot.y < GRID) {
              // Quick occupancy check (grid not built yet, check buildings)
              const occupied = villageState.buildings.some(b => {
                const def = VillageData.BUILDINGS[b.id];
                if (!def) return false;
                return spot.x >= b.x && spot.x < b.x + def.size && spot.y >= b.y && spot.y < b.y + def.size;
              });
              if (!occupied) {
                villageState.buildings.push({
                  id: 'builder_hut', level: 1, x: spot.x, y: spot.y, hp: 100
                });
                break;
              }
            }
          }
        }
      }

      await saveState();

      // Catch up passive economy
      tickPassiveResources();
      // Process build queue
      processBuildQueue();
      // Process training queue
      processTrainingQueue();
      // Check for raids
      checkRaidTrigger();

      await saveState();

      renderUI();
      buildGrid();
      initCanvas();
      syncAndRender();
      scheduleBuildQueueCheck();
    } catch (err) {
      console.error('Village render error:', err);
      container.innerHTML = `<div class="village-page">
        <h2 class="page-title">Village</h2>
        <div class="glass" style="padding:16px;color:var(--red)">
          Error loading village: ${err.message}<br>
          <pre style="font-size:6px;color:var(--text-dim);margin-top:8px">${err.stack}</pre>
        </div>
      </div>`;
    }
  }

  // ===== Save =====
  async function saveState() {
    gameState.village = villageState;
    await synchronAPI.setGameState(gameState);
  }

  // ===== Build occupancy grid =====
  function buildGrid() {
    grid = [];
    for (let y = 0; y < GRID; y++) {
      grid[y] = [];
      for (let x = 0; x < GRID; x++) grid[y][x] = -1;
    }
    villageState.buildings.forEach((b, i) => {
      const def = VillageData.BUILDINGS[b.id];
      if (!def) return;
      const sz = def.size;
      for (let dy = 0; dy < sz; dy++) {
        for (let dx = 0; dx < sz; dx++) {
          const gx = b.x + dx, gy = b.y + dy;
          if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
            grid[gy][gx] = i;
          }
        }
      }
    });
    // Also mark build queue tiles as occupied (-2 = under construction)
    if (villageState.buildQueue) {
      for (const q of villageState.buildQueue) {
        const def = VillageData.BUILDINGS[q.buildingId];
        if (!def) continue;
        const sz = def.size;
        for (let dy = 0; dy < sz; dy++) {
          for (let dx = 0; dx < sz; dx++) {
            const gx = q.x + dx, gy = q.y + dy;
            if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID && grid[gy][gx] === -1) {
              grid[gy][gx] = -2;
            }
          }
        }
      }
    }
  }

  // ===== UI Layout =====
  // Creates the page shell once, then updates mutable UI parts.
  // The 3D container is NEVER destroyed after initial creation.
  function renderUI() {
    // First render — create the full page structure
    if (!container.querySelector('.village-page')) {
      container.innerHTML = `
        <div class="village-page">
          <div class="village-main">
            <div class="village-canvas-wrap">
              <div id="village-3d-container"></div>
            </div>
            <div class="village-info-overlay glass" id="village-info-panel"></div>
            <div class="village-drawer panel-inset" id="village-drawer"></div>
            <div class="village-bottom-bar" id="village-bottom-bar"></div>
          </div>
        </div>
      `;
    }

    // Update info panel
    const infoPanel = document.getElementById('village-info-panel');
    if (infoPanel) infoPanel.innerHTML = renderInfoPanel();

    // Update drawer
    const drawer = document.getElementById('village-drawer');
    if (drawer) {
      drawer.className = `village-drawer panel-inset ${activeTab ? 'open' : ''}`;
      drawer.innerHTML = `
        <div class="village-drawer-header">
          <span class="village-drawer-title">${activeTab === 'shop' ? '🏪 Shop' : activeTab === 'troops' ? '⚔ Army' : activeTab === 'raidlog' ? '📜 Raids' : ''}</span>
          <button class="village-drawer-close" id="drawer-close-btn">&times;</button>
        </div>
        <div class="village-drawer-content" id="village-tab-content">
          ${activeTab ? renderTabContent() : ''}
        </div>
      `;
    }

    // Update bottom bar
    const bottomBar = document.getElementById('village-bottom-bar');
    if (bottomBar) {
      bottomBar.innerHTML = `
        <button class="village-bubble ${activeTab === 'shop' ? 'active' : ''}" data-vtab="shop">
          <span class="bubble-icon">🏪</span>
          <span class="bubble-label">Shop</span>
        </button>
        <button class="village-bubble ${activeTab === 'troops' ? 'active' : ''}" data-vtab="troops">
          <span class="bubble-icon">⚔</span>
          <span class="bubble-label">Army</span>
        </button>
        <button class="village-bubble ${activeTab === 'raidlog' ? 'active' : ''}" data-vtab="raidlog">
          <span class="bubble-icon">📜</span>
          <span class="bubble-label">Raids</span>
        </button>
      `;
    }

    // Wire bottom bar buttons (toggle drawer)
    container.querySelectorAll('.village-bubble').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.vtab;
        if (activeTab === tab) {
          activeTab = null;
        } else {
          activeTab = tab;
        }
        selectedBuilding = null;
        renderUI();
        syncAndRender();
      });
    });

    // Wire drawer close button
    const closeBtn = document.getElementById('drawer-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        activeTab = null;
        renderUI();
        syncAndRender();
      });
    }

    // Wire shop/catalog/troop events
    wireShopEvents();
  }

  // ===== Tab Content =====
  function renderTabContent() {
    if (activeTab === 'shop') return renderShopPanel();
    if (activeTab === 'troops') return renderTroopPanel();
    if (activeTab === 'raidlog') return renderRaidLog();
    return '';
  }

  function renderShopPanel() {
    let html = '<div class="shop-panel">';

    // Placement mode banner (when a building is selected)
    if (selectedBuilding) {
      html += `<div class="placement-banner">
        <span>${selectedBuilding.icon} Placing ${selectedBuilding.name} — click on the grid</span>
        <button class="cancel-btn" id="cancel-placement-btn">✕ Cancel</button>
      </div>`;
    }

    // Build Queue section (if any active)
    if (villageState.buildQueue && villageState.buildQueue.length > 0) {
      html += '<div class="shop-section"><div class="shop-section-header" style="color:#f5c542">⚙ Build Queue</div>';
      for (let i = 0; i < villageState.buildQueue.length; i++) {
        const q = villageState.buildQueue[i];
        const def = VillageData.BUILDINGS[q.buildingId];
        if (!def) continue;
        const remaining = Math.max(0, Math.ceil((q.endTime - Date.now()) / 1000));
        const chronosCost = Math.max(1, Math.ceil(remaining / 60));
        html += `<div class="build-queue-item">
          <span>${def.icon} ${def.name} Lv.${q.level} (${q.type})</span>
          <span class="queue-time">${formatTime(remaining)}</span>
          <button class="btn-sm btn-chronos-skip" data-queue-idx="${i}" ${(gameState.resources.chronos || 0) >= chronosCost ? '' : 'disabled'}>
            Skip ${chronosCost}⧖
          </button>
        </div>`;
      }
      html += '</div>';
    }

    // Inventory section (tile grid)
    if (villageState.inventory && villageState.inventory.length > 0) {
      html += '<div class="shop-section"><div class="shop-section-header" style="color:#4488ff">📦 Inventory</div>';
      html += '<div class="inventory-grid">';
      for (let i = 0; i < villageState.inventory.length; i++) {
        const item = villageState.inventory[i];
        const def = VillageData.BUILDINGS[item.id];
        if (!def) continue;
        html += `<div class="village-catalog-item inventory-item" data-inv-idx="${i}" data-building-id="${item.id}" data-inv-level="${item.level}">
          <canvas class="catalog-preview" data-sprite-id="${item.id}" data-sprite-level="${item.level}" width="56" height="56"></canvas>
          <span class="catalog-name">${def.name} Lv.${item.level}</span>
          <span class="catalog-cost affordable">FREE</span>
        </div>`;
      }
      html += '</div></div>';
    }

    // Buildings section (tile grid catalog)
    html += '<div class="shop-section"><div class="shop-section-header" style="color:#2ee67a">🏗 Buildings</div>';
    html += renderBuildCatalog();
    html += '</div>';

    // Chronos shop section
    html += `<div class="shop-section"><div class="shop-section-header" style="color:#00e5ff">⧖ Chronos Shop</div>
      <div class="chronos-shop">
        <div class="chronos-deal" data-chronos-deal="10">
          <span>1 ⧖</span>
          <button class="btn-sm btn-buy-chronos" data-gems="10" data-chronos="1" ${(gameState.resources.gems || 0) >= 10 ? '' : 'disabled'}>10 ◆</button>
        </div>
        <div class="chronos-deal" data-chronos-deal="50">
          <span>6 ⧖</span>
          <button class="btn-sm btn-buy-chronos" data-gems="50" data-chronos="6" ${(gameState.resources.gems || 0) >= 50 ? '' : 'disabled'}>50 ◆</button>
        </div>
        <div class="chronos-deal" data-chronos-deal="100">
          <span>15 ⧖</span>
          <button class="btn-sm btn-buy-chronos" data-gems="100" data-chronos="15" ${(gameState.resources.gems || 0) >= 100 ? '' : 'disabled'}>100 ◆</button>
        </div>
      </div>
    </div>`;

    html += '</div>';
    return html;
  }

  function renderBuildCatalog() {
    const nexusLv = VillageData.getNexusLevel(villageState);
    const unlocked = VillageData.getUnlockedBuildings(nexusLv);
    const res = gameState.resources;

    let html = '<div class="village-catalog">';

    for (const [catId, catInfo] of Object.entries(VillageData.CATEGORIES)) {
      const catBuildings = Object.values(VillageData.BUILDINGS).filter(b => b.category === catId);
      const available = catBuildings.filter(b => unlocked.has(b.id));
      const locked = catBuildings.filter(b => !unlocked.has(b.id));

      if (available.length === 0 && locked.length === 0) continue;

      html += `<div class="catalog-category">
        <div class="catalog-cat-header" style="color:${catInfo.color}">${catInfo.icon} ${catInfo.name}</div>
        <div class="catalog-grid">`;

      for (const b of available) {
        const cost = VillageData.getBuildingCost(b.id, 1);
        const affordable = VillageData.canAfford(res, cost);
        const isSelected = selectedBuilding && selectedBuilding.id === b.id;
        html += `
          <div class="village-catalog-item ${affordable ? '' : 'disabled'} ${isSelected ? 'selected' : ''}" data-building-id="${b.id}">
            <canvas class="catalog-preview" data-sprite-id="${b.id}" width="56" height="56"></canvas>
            <span class="catalog-name">${b.name}</span>
            <span class="catalog-cost ${affordable ? 'affordable' : 'too-expensive'}">${formatCost(cost)}</span>
          </div>`;
      }

      for (const b of locked) {
        let reqLv = '?';
        for (const [lv, ids] of Object.entries(VillageData.NEXUS_GATES)) {
          if (ids.includes(b.id)) { reqLv = lv; break; }
        }
        html += `
          <div class="village-catalog-item locked">
            <canvas class="catalog-preview" data-sprite-id="${b.id}" width="56" height="56"></canvas>
            <span class="catalog-name">${b.name}</span>
            <span class="catalog-cost">Nexus Lv${reqLv}</span>
          </div>`;
      }

      html += '</div></div>';
    }

    html += '</div>';
    return html;
  }

  // Render building sprite previews onto canvas elements after DOM insert
  function renderCatalogPreviews() {
    const canvases = document.querySelectorAll('.catalog-preview[data-sprite-id]');
    canvases.forEach(cvs => {
      const id = cvs.dataset.spriteId;
      const lvl = parseInt(cvs.dataset.spriteLevel) || 1;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;
      const w = cvs.width;
      const h = cvs.height;

      // Clear with dark background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);

      // Get sprite rects (level-aware)
      const rects = VillageData.getBuildingSprite(id, lvl);
      const def = VillageData.BUILDINGS[id];
      if (!def) return;

      // Calculate sprite bounds for centering
      const tilePx = 24;
      const spriteSz = tilePx * def.size;

      // Scale to fit in canvas with padding
      const pad = 4;
      const scale = Math.min((w - pad * 2) / spriteSz, (h - pad * 2) / spriteSz);
      const offX = (w - spriteSz * scale) / 2;
      const offY = (h - spriteSz * scale) / 2;

      // Draw each rect
      for (const r of rects) {
        ctx.fillStyle = r.c;
        ctx.fillRect(
          Math.floor(offX + r.x * scale),
          Math.floor(offY + r.y * scale),
          Math.ceil(r.w * scale),
          Math.ceil(r.h * scale)
        );
      }
    });
  }

  // Paint the building sprite preview in the info panel (current level)
  function paintInfoSprite() {
    const cvs = document.querySelector('.info-sprite-preview[data-sprite-id]');
    if (!cvs) return;
    const id = cvs.dataset.spriteId;
    const lvl = parseInt(cvs.dataset.spriteLevel) || 1;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const w = cvs.width;
    const h = cvs.height;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    const rects = VillageData.getBuildingSprite(id, lvl);
    const def = VillageData.BUILDINGS[id];
    if (!def) return;

    const tilePx = 24;
    const spriteSz = tilePx * def.size;
    const pad = 4;
    const scale = Math.min((w - pad * 2) / spriteSz, (h - pad * 2) / spriteSz);
    const offX = (w - spriteSz * scale) / 2;
    const offY = (h - spriteSz * scale) / 2;

    for (const r of rects) {
      ctx.fillStyle = r.c;
      ctx.fillRect(
        Math.floor(offX + r.x * scale),
        Math.floor(offY + r.y * scale),
        Math.ceil(r.w * scale),
        Math.ceil(r.h * scale)
      );
    }
  }

  function renderTroopPanel() {
    const nexusLv = VillageData.getNexusLevel(villageState);
    const cap = VillageData.getHousingCapacity(villageState);
    const used = VillageData.getHousingUsed(villageState);
    const res = gameState.resources;

    // Check training ground + max tier
    const hasTrainingGround = villageState.buildings.some(b => b.id === 'training_ground');
    const maxTier = VillageData.getMaxTrainTier(villageState);

    let html = `<div class="troop-panel">
      <div class="troop-housing">Housing: ${used} / ${cap}</div>`;

    // Current roster
    html += '<div class="troop-roster">';
    if (villageState.troops.length === 0) {
      html += '<div class="troop-empty">No troops trained yet</div>';
    } else {
      for (const t of villageState.troops) {
        const def = VillageData.TROOPS[t.id];
        if (!def) continue;
        html += `<div class="troop-row">
          <span class="troop-icon">${def.icon}</span>
          <span class="troop-name">${def.name}</span>
          <span class="troop-count">×${t.count}</span>
          <span class="troop-housing-cost">(${def.housing * t.count}🏠)</span>
        </div>`;
      }
    }
    html += '</div>';

    // Training queue
    if (villageState.trainingQueue.length > 0) {
      html += '<div class="training-queue-header">Training Queue</div>';
      html += '<div class="training-queue">';
      for (const q of villageState.trainingQueue) {
        const def = VillageData.TROOPS[q.troopId];
        if (!def) continue;
        const remaining = Math.max(0, q.endTime - Date.now());
        const pct = remaining > 0 ? (1 - remaining / (q.endTime - q.startTime)) * 100 : 100;
        html += `<div class="queue-item">
          <span>${def.icon} ${def.name}</span>
          <div class="queue-bar"><div class="queue-bar-fill" style="width:${pct}%"></div></div>
          <span class="queue-time">${remaining > 0 ? Math.ceil(remaining / 1000) + 's' : 'Done'}</span>
        </div>`;
      }
      html += '</div>';
    }

    // Available troops to train
    html += `<div class="troop-train-header">Train Troops ${maxTier > 0 ? `<span style="color:var(--purple)">(Max Tier ${maxTier})</span>` : ''}</div>`;
    html += '<div class="troop-train-list">';

    for (const [id, def] of Object.entries(VillageData.TROOPS)) {
      const tierUnlocked = hasTrainingGround && def.tier <= maxTier;
      const affordable = VillageData.canAfford(res, def.cost);
      const hasSpace = used + def.housing <= cap;
      const enabled = tierUnlocked && affordable && hasSpace;
      const locked = !tierUnlocked;

      html += `<div class="troop-train-row ${enabled ? '' : 'disabled'}">
        <span class="troop-icon">${locked ? '🔒' : def.icon}</span>
        <span class="troop-name">${def.name}</span>
        <span class="troop-tier">T${def.tier}</span>
        <span class="troop-stats">${def.hp}HP ${def.atk}ATK</span>
        <span class="troop-cost">${locked ? 'Need T.Ground Lv' + (def.tier * 2 - 1) : formatCost(def.cost)}</span>
        <button class="btn-sm train-troop-btn" data-troop-id="${id}" ${enabled ? '' : 'disabled'}>Train</button>
      </div>`;
    }

    html += '</div></div>';
    return html;
  }

  function renderRaidLog() {
    let html = '<div class="raid-panel">';

    // Attack section — Search for Target
    html += '<div class="raid-search-section">';
    html += '<div class="shop-section-header" style="color:#ff4455">⚔ Attack</div>';

    const hasTroops = villageState.troops.some(t => t.count > 0);
    if (VillageBattle.isActive()) {
      html += '<div class="raid-search-status" style="color:var(--gold)">Battle in progress...</div>';
    } else if (VillageBattle.getEnemyVillage()) {
      const enemy = VillageBattle.getEnemyVillage();
      const loot = VillageBattle.estimateLoot(enemy);
      html += `<div class="raid-target-preview">
        <div class="target-name">${enemy.name}</div>
        <div class="target-diff">Difficulty: ${'⭐'.repeat(Math.min(5, Math.ceil(enemy.difficulty / 2)))}</div>
        <div class="target-loot">Loot: ${loot.gold.min}-${loot.gold.max}● ${loot.wood.min}-${loot.wood.max}▪ ${loot.stone.min}-${loot.stone.max}■</div>
        <div class="target-defenders">Defenders: ${enemy.troops.length} troops, ${enemy.buildings.filter(b => { const d = VillageData.BUILDINGS[b.id]; return d && d.defenseStats; }).length} weapons</div>
        <div class="target-actions">
          <button class="btn-pixel raid-attack-btn" id="raid-attack-btn" ${hasTroops ? '' : 'disabled'}>⚔ Attack</button>
          <button class="btn-sm raid-search-btn" id="raid-search-btn">🔍 New Target</button>
        </div>
        ${!hasTroops ? '<div class="info-hint" style="color:var(--red)">Train troops first!</div>' : ''}
      </div>`;
    } else {
      html += `<button class="btn-pixel raid-search-btn" id="raid-search-btn" style="width:100%">🔍 Search for Target</button>`;
      if (!hasTroops) html += '<div class="info-hint" style="color:var(--text-dim);margin-top:4px">Train troops at the Training Ground before raiding.</div>';
    }
    html += '</div>';

    // Raid log
    const log = villageState.raidLog || [];
    html += '<div class="shop-section-header" style="color:#f5c542;margin-top:8px">📜 Raid History</div>';
    if (log.length === 0) {
      html += '<div class="raid-log-empty">No raids yet.</div>';
    } else {
      html += '<div class="raid-log">';
      for (const entry of [...log].reverse().slice(0, 10)) {
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const won = entry.result === 'win';
        html += `
          <div class="raid-log-entry ${won ? 'raid-win' : 'raid-loss'}">
            <div class="raid-log-header">
              <span class="raid-result">${won ? '✓ ' + (entry.stars ? '⭐'.repeat(entry.stars) : 'WIN') : '✗ DEFEAT'}</span>
              <span class="raid-time">${timeStr}</span>
            </div>
            <div class="raid-log-details">
              ${entry.enemyName ? entry.enemyName + ' · ' : ''}${entry.raiders || ''} raiders · ${entry.damageDealt || 0} dmg dealt · ${entry.resourcesLost ? formatCost(entry.resourcesLost) + ' lost' : 'No losses'}
              ${won && entry.rewards ? ' · Reward: ' + formatCost(entry.rewards) : ''}
            </div>
          </div>`;
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // ===== Info Panel =====
  function renderInfoPanel() {
    if (selectedBuildQueueItem) return renderBuildQueueInfo();
    if (selectedPlaced) return renderPlacedInfo();
    if (selectedBuilding) return renderPlacementInfo();
    return renderVillageOverview();
  }

  function renderBuildQueueInfo() {
    const q = selectedBuildQueueItem;
    const def = VillageData.BUILDINGS[q.buildingId];
    if (!def) return '';
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((q.endTime - now) / 1000));
    const total = Math.max(1, (q.endTime - q.startTime) / 1000);
    const progress = Math.min(100, ((total - remaining) / total) * 100);
    const chronosCost = Math.max(1, Math.ceil(remaining / 60));
    const queueIdx = (villageState.buildQueue || []).indexOf(q);

    return `
      <div class="info-section">
        <div class="info-title">⚙ ${def.icon} ${def.name} <span style="color:var(--text-dim)">(${q.type === 'upgrade' ? 'Upgrading to' : 'Building'} Lv.${q.level})</span></div>
        <div class="info-desc">${def.desc}</div>
        <div class="info-row"><span class="info-label">Time Left</span><span class="info-value" style="color:var(--gold)">${formatTime(remaining)}</span></div>
        <div class="info-row"><span class="info-label">Progress</span><span class="info-value">${Math.floor(progress)}%</span></div>
        <div class="queue-bar" style="height:6px;background:#333;margin:4px 0;border-radius:2px"><div class="queue-bar-fill" style="width:${progress}%;height:100%;background:#2ee67a;border-radius:2px"></div></div>
      </div>
      <div class="info-actions">
        <button class="btn-pixel" id="btn-skip-build" data-queue-idx="${queueIdx}" ${(gameState.resources.chronos || 0) >= chronosCost ? '' : 'disabled'}>
          Skip (${chronosCost} ⧖)
        </button>
        <div class="info-hint" style="color:#00e5ff">⧖ ${gameState.resources.chronos || 0} Chronos available</div>
      </div>`;
  }

  function renderVillageOverview() {
    const nexusLv = VillageData.getNexusLevel(villageState);
    const caps = VillageData.getResourceCaps(villageState);
    const res = gameState.resources;
    const income = getPassiveIncome();
    const troopCap = VillageData.getHousingCapacity(villageState);
    const troopUsed = VillageData.getHousingUsed(villageState);
    const totalBuilders = VillageData.getBuilderCount(villageState);
    const availBuilders = getAvailableBuilders();
    const wallCount = VillageData.getWallCount(villageState);
    const maxWalls = VillageData.getMaxWalls(gameState.level);

    return `
      <div class="info-section">
        <div class="info-title">Village Overview</div>
        <div class="info-row"><span class="info-label">Nexus Level</span><span class="info-value" style="color:var(--gold)">${nexusLv}</span></div>
        <div class="info-row"><span class="info-label">Buildings</span><span class="info-value">${villageState.buildings.length}</span></div>
        <div class="info-row"><span class="info-label">Builders</span><span class="info-value" style="color:${availBuilders > 0 ? 'var(--green)' : 'var(--red)'}">${availBuilders}/${totalBuilders}</span></div>
        <div class="info-row"><span class="info-label">Walls</span><span class="info-value">${wallCount}/${maxWalls}</span></div>
        <div class="info-row"><span class="info-label">Troops</span><span class="info-value">${troopUsed}/${troopCap}</span></div>
        <div class="info-row"><span class="info-label">Raids Won</span><span class="info-value" style="color:var(--green)">${villageState.totalRaidsWon}</span></div>
        <div class="info-row"><span class="info-label">Raids Lost</span><span class="info-value" style="color:var(--red)">${villageState.totalRaidsLost}</span></div>
      </div>
      <div class="info-section">
        <div class="info-title">Resource Caps</div>
        <div class="info-row"><span class="info-label">● Gold</span><span class="info-value">${res.gold} / ${caps.gold}</span></div>
        <div class="info-row"><span class="info-label">▪ Wood</span><span class="info-value">${res.wood} / ${caps.wood}</span></div>
        <div class="info-row"><span class="info-label">■ Stone</span><span class="info-value">${res.stone} / ${caps.stone}</span></div>
      </div>
      <div class="info-section">
        <div class="info-title">Passive Income / hr</div>
        <div class="info-row"><span class="info-label">● Gold</span><span class="info-value" style="color:var(--gold)">+${income.gold.toFixed(0)}</span></div>
        <div class="info-row"><span class="info-label">▪ Wood</span><span class="info-value" style="color:var(--brown)">+${income.wood.toFixed(0)}</span></div>
        <div class="info-row"><span class="info-label">■ Stone</span><span class="info-value" style="color:var(--stone-color)">+${income.stone.toFixed(0)}</span></div>
        ${income.gems > 0 ? `<div class="info-row"><span class="info-label">◆ Gems</span><span class="info-value" style="color:var(--purple)">+${income.gems.toFixed(1)}</span></div>` : ''}
      </div>`;
  }

  function renderPlacementInfo() {
    const b = selectedBuilding;
    const cost = VillageData.getBuildingCost(b.id, 1);
    return `
      <div class="info-section">
        <div class="info-title">${b.icon} ${b.name}</div>
        <div class="info-desc">${b.desc}</div>
        <div class="info-row"><span class="info-label">Size</span><span class="info-value">${b.size}×${b.size}</span></div>
        <div class="info-row"><span class="info-label">Max Level</span><span class="info-value">${b.maxLevel}</span></div>
        <div class="info-row"><span class="info-label">Cost</span><span class="info-value">${formatCost(cost)}</span></div>
      </div>
      <div class="info-hint">Click on the grid to place this building.<br>Right-click or press Esc to cancel.</div>`;
  }

  function renderPlacedInfo() {
    const b = selectedPlaced;
    const def = VillageData.BUILDINGS[b.id];
    if (!def) return '';
    const prodVal = def.production[b.level - 1] || 0;
    const isMaxLevel = b.level >= def.maxLevel;
    const upgradeCost = isMaxLevel ? null : VillageData.getBuildingCost(b.id, b.level + 1);
    const canUpgrade = upgradeCost && VillageData.canAfford(gameState.resources, upgradeCost);
    const nexusLv = VillageData.getNexusLevel(villageState);

    // Check nexus level req for upgrade
    let needsNexusUpgrade = false;
    if (!isMaxLevel && b.id !== 'nexus') {
      // Higher levels might need higher nexus
    }
    // Nexus upgrade requires player level
    let needsPlayerLevel = false;
    if (b.id === 'nexus' && !isMaxLevel) {
      const reqLv = VillageData.NEXUS_LEVEL_REQ[b.level + 1] || 1;
      if (gameState.level < reqLv) needsPlayerLevel = true;
    }

    let prodLabel = '';
    if (def.category === 'resource') {
      const unit = b.id === 'crypto_mint' ? 'gems' : b.id === 'hashery' ? 'stone' : b.id === 'code_forge' ? 'wood' : b.id === 'amplifier_node' ? '% activity boost' : 'gold';
      prodLabel = `${prodVal} ${unit}/hr`;
    } else if (def.category === 'storage') {
      prodLabel = b.id === 'quantum_safe' ? `${prodVal}% raid protection` : `+${prodVal} cap`;
    } else if (def.category === 'defense') {
      if (b.id === 'firewall') prodLabel = `${prodVal} HP`;
      else if (b.id === 'turret_node') prodLabel = `${prodVal} dmg/shot`;
      else if (b.id === 'emp_tower') prodLabel = `${prodVal}% slow`;
      else if (b.id === 'honeypot') prodLabel = `${prodVal} HP (decoy)`;
      else if (b.id === 'killswitch_mine') prodLabel = `${prodVal} explosion dmg`;
      // Weapon buildings with defenseStats
      if (def.defenseStats && def.defenseStats[b.level - 1]) {
        const ds = def.defenseStats[b.level - 1];
        prodLabel = `${ds.damage} dmg, ${ds.range} range, ${ds.fireRate}t cooldown`;
        if (ds.splashRadius > 0) prodLabel += `, ${ds.splashRadius} splash`;
        if (ds.special) prodLabel += ` [${ds.special}]`;
      }
    } else if (def.category === 'military') {
      if (b.id === 'barracks') prodLabel = `+${prodVal} housing`;
      else if (b.id === 'training_ground') {
        const tier = VillageData.TRAINING_TIERS[b.level] || 1;
        prodLabel = `${prodVal}× speed, Tier ${tier} unlocked`;
      }
      else prodLabel = `${prodVal}× train speed`;
    } else if (def.category === 'utility') {
      if (b.id === 'nexus') prodLabel = `${prodVal} HP`;
      else if (b.id === 'overclock_pylon') prodLabel = `${prodVal}% adj boost`;
      else if (b.id === 'repair_drone_bay') prodLabel = `${prodVal} HP/min repair`;
      else if (b.id === 'beacon_tower') prodLabel = `${prodVal}% defense bonus`;
    }

    return `
      <div class="info-section">
        <div class="info-title">${def.icon} ${def.name} <span style="color:var(--gold)">Lv.${b.level}</span></div>
        <canvas class="info-sprite-preview" data-sprite-id="${b.id}" data-sprite-level="${b.level}" width="56" height="56"></canvas>
        <div class="info-desc">${def.desc}</div>
        <div class="info-row"><span class="info-label">Output</span><span class="info-value">${prodLabel}</span></div>
        <div class="info-row"><span class="info-label">HP</span><span class="info-value">${b.hp}</span></div>
        <div class="info-row"><span class="info-label">Position</span><span class="info-value">(${b.x}, ${b.y})</span></div>
      </div>
      <div class="info-actions">
        ${!isMaxLevel ? (() => {
          const buildTime = VillageData.getBuildTime(b.id, b.level + 1);
          const noBuilders = getAvailableBuilders() <= 0;
          const disabled = !canUpgrade || needsPlayerLevel || noBuilders;
          return `
            <button class="btn-pixel" id="btn-upgrade" ${disabled ? 'disabled' : ''}>
              Upgrade to Lv.${b.level + 1} ${upgradeCost ? '(' + formatCost(upgradeCost) + ')' : ''} [${formatTime(buildTime)}]
            </button>
            ${needsPlayerLevel ? `<div class="info-hint" style="color:var(--red)">Requires player Lv.${VillageData.NEXUS_LEVEL_REQ[b.level + 1]}</div>` : ''}
            ${noBuilders ? '<div class="info-hint" style="color:var(--red)">No builders available</div>' : ''}`;
        })() : '<div class="info-hint" style="color:var(--gold)">MAX LEVEL</div>'}
        ${b.id !== 'nexus' ? '<button class="btn-sm" id="btn-store" style="color:#4488ff">📦 Store</button>' : ''}
      </div>`;
  }

  function updateInfoPanel() {
    const panel = document.getElementById('village-info-panel');
    if (!panel) return;
    panel.innerHTML = renderInfoPanel();
    // Show/hide overlay based on whether something is selected
    if (selectedPlaced || selectedBuilding || selectedBuildQueueItem) {
      panel.classList.add('visible');
    } else {
      panel.classList.remove('visible');
    }
    wireInfoButtons();
    paintInfoSprite();

    // Auto-refresh info panel every second when viewing a build queue item
    if (infoPanelRefreshTimer) clearInterval(infoPanelRefreshTimer);
    if (selectedBuildQueueItem) {
      infoPanelRefreshTimer = setInterval(() => {
        if (!selectedBuildQueueItem) { clearInterval(infoPanelRefreshTimer); return; }
        const panel = document.getElementById('village-info-panel');
        if (panel) { panel.innerHTML = renderInfoPanel(); wireInfoButtons(); }
        syncAndRender(); // refresh progress bars on canvas too
      }, 1000);
    }
  }

  function wireInfoButtons() {
    const btnUpgrade = document.getElementById('btn-upgrade');
    if (btnUpgrade) {
      btnUpgrade.addEventListener('click', () => upgradeBuilding());
    }
    const btnStore = document.getElementById('btn-store');
    if (btnStore) {
      btnStore.addEventListener('click', () => storeBuilding());
    }
    const btnSkipBuild = document.getElementById('btn-skip-build');
    if (btnSkipBuild) {
      btnSkipBuild.addEventListener('click', () => {
        const idx = parseInt(btnSkipBuild.dataset.queueIdx);
        if (!isNaN(idx)) {
          skipBuildWithChronos(idx);
          selectedBuildQueueItem = null;
          updateInfoPanel();
        }
      });
    }
  }

  // ===== 3D Renderer Init =====
  let canvasInited = false;

  function initCanvas() {
    const el = document.getElementById('village-3d-container');
    if (!el) return;

    // Only initialize renderer + wire events ONCE
    if (canvasInited) return;

    VillageRenderer.init(el);
    canvasInited = true;

    // Wire click on the renderer's canvas
    const cvs = el.querySelector('canvas');
    if (cvs) {
      cvs.addEventListener('click', onCanvasClick);
      cvs.addEventListener('mousemove', onCanvasMouseMove);
      cvs.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        selectedBuilding = null;
        selectedPlaced = null;
        selectedBuildQueueItem = null;
        wallGhostPositions = [];
        ghostPos = null;
        updateInfoPanel();
        syncAndRender();
      });
    }

    // ESC to cancel placement
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        selectedBuilding = null;
        selectedPlaced = null;
        selectedBuildQueueItem = null;
        wallGhostPositions = [];
        ghostPos = null;
        updateInfoPanel();
        syncAndRender();
      }
    });

    wireInfoButtons();
  }

  // Helper: sync all 3D state and render
  function syncAndRender() {
    VillageRenderer.syncBuildings(villageState);

    // Ghost preview
    if (selectedBuilding && ghostPos) {
      const valid = canPlaceAt(ghostPos.x, ghostPos.y, selectedBuilding.size);
      VillageRenderer.setGhostPreview(selectedBuilding.id, 1, ghostPos.x, ghostPos.y, valid);
    } else {
      VillageRenderer.clearGhostPreview();
    }

    // Wall ghosts
    if (selectedPlaced && selectedPlaced.id === 'firewall' && !selectedBuilding) {
      VillageRenderer.setWallGhosts(wallGhostPositions);
    } else {
      VillageRenderer.clearWallGhosts();
    }

    // Selection ring
    if (selectedPlaced) {
      const def = VillageData.BUILDINGS[selectedPlaced.id];
      VillageRenderer.setSelection(selectedPlaced.x, selectedPlaced.y, def ? def.size : 1);
    } else {
      VillageRenderer.clearSelection();
    }
  }

  // ===== 3D Events =====
  function onCanvasMouseMove(e) {
    if (selectedBuilding) {
      ghostPos = VillageRenderer.raycastToTile(e);
      syncAndRender();
    }
  }

  function onCanvasClick(e) {
    // Suppress click after camera drag
    if (VillageCamera.wasDragging()) return;

    const tile = VillageRenderer.raycastToTile(e);
    if (!tile) return;

    // Handle battle deploy clicks
    if (VillageBattle.isDeploying()) {
      VillageBattle.onDeployClick(tile.x, tile.y);
      return;
    }

    if (selectedBuilding) {
      placeBuilding(tile.x, tile.y, placingFromInventory || undefined);
      return;
    }

    // Check wall ghost click
    if (wallGhostPositions.length > 0) {
      const ghostHit = VillageRenderer.raycastToWallGhost(e);
      if (ghostHit) {
        placeWallAtGhost(ghostHit.x, ghostHit.y);
        return;
      }
    }

    // Check building click
    if (tile.x >= 0 && tile.x < GRID && tile.y >= 0 && tile.y < GRID) {
      const idx = grid[tile.y][tile.x];
      if (idx >= 0) {
        selectedBuildQueueItem = null;
        selectedPlaced = villageState.buildings[idx];
        wallGhostPositions = selectedPlaced.id === 'firewall' ? getWallGhostSpots(selectedPlaced) : [];
        updateInfoPanel();
        syncAndRender();
      } else if (idx === -2) {
        selectedPlaced = null;
        wallGhostPositions = [];
        const q = (villageState.buildQueue || []).find(q => {
          const def = VillageData.BUILDINGS[q.buildingId];
          if (!def) return false;
          return tile.x >= q.x && tile.x < q.x + def.size && tile.y >= q.y && tile.y < q.y + def.size;
        });
        selectedBuildQueueItem = q || null;
        updateInfoPanel();
        syncAndRender();
      } else {
        selectedPlaced = null;
        selectedBuildQueueItem = null;
        wallGhostPositions = [];
        if (activeTab) {
          activeTab = null;
          renderUI();
        }
        updateInfoPanel();
        syncAndRender();
      }
    }
  }

  // ===== (Drawing moved to village-renderer.js / village-buildings.js) =====



  // ===== Placement Logic =====
  function canPlaceAt(x, y, size) {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const gx = x + dx, gy = y + dy;
        if (gx < 0 || gx >= GRID || gy < 0 || gy >= GRID) return false;
        if (grid[gy][gx] !== -1) return false; // -1 = empty, -2 = under construction, >=0 = building
      }
    }
    return true;
  }

  async function placeBuilding(x, y, fromInventory) {
    if (!selectedBuilding) return;
    const def = selectedBuilding;

    // fromInventory: {id, level, inventoryIndex} — no cost, specific level
    const level = fromInventory ? fromInventory.level : 1;
    const cost = fromInventory ? null : VillageData.getBuildingCost(def.id, 1);

    if (cost && !VillageData.canAfford(gameState.resources, cost)) return;
    if (!canPlaceAt(x, y, def.size)) return;

    // Can't place second nexus
    if (def.id === 'nexus') return;

    // Wall limit check
    if (def.id === 'firewall') {
      const maxWalls = VillageData.getMaxWalls(gameState.level);
      const currentWalls = VillageData.getWallCount(villageState);
      if (currentWalls >= maxWalls) {
        showHint(`Wall limit reached (${currentWalls}/${maxWalls}). Raise player level to unlock more.`);
        return;
      }
    }

    // Builder check (not needed for inventory placements)
    if (!fromInventory) {
      const builders = getAvailableBuilders();
      if (builders <= 0) {
        showHint('No builders available! Build more Builder Huts or wait for builds to finish.');
        return;
      }
    }

    if (cost) VillageData.deductCost(gameState.resources, cost);

    // Remove from inventory if placing from there
    if (fromInventory && fromInventory.inventoryIndex !== undefined) {
      villageState.inventory.splice(fromInventory.inventoryIndex, 1);
    }

    const hp = def.category === 'defense' ? (def.production[level - 1] || 50) :
               def.id === 'nexus' ? def.production[level - 1] : 100;

    // Build queue: non-inventory placements go through build time
    if (!fromInventory) {
      const buildTime = VillageData.getBuildTime(def.id, level);
      const now = Date.now();
      if (!villageState.buildQueue) villageState.buildQueue = [];
      villageState.buildQueue.push({
        buildingId: def.id, level, x, y, hp,
        startTime: now,
        endTime: now + buildTime * 1000,
        type: 'new'
      });
    } else {
      // Inventory placement is instant
      villageState.buildings.push({ id: def.id, level, x, y, hp });
    }

    selectedBuilding = null;
    ghostPos = null;
    placingFromInventory = null;

    await saveState();
    buildGrid();
    updateInfoPanel();
    syncAndRender();
    updateResourceDisplay();
    refreshTabContent();
    scheduleBuildQueueCheck();
  }

  async function upgradeBuilding() {
    if (!selectedPlaced) return;
    const b = selectedPlaced;
    const def = VillageData.BUILDINGS[b.id];
    if (!def || b.level >= def.maxLevel) return;

    // Nexus requires player level
    if (b.id === 'nexus') {
      const reqLv = VillageData.NEXUS_LEVEL_REQ[b.level + 1] || 1;
      if (gameState.level < reqLv) return;
    }

    const cost = VillageData.getBuildingCost(b.id, b.level + 1);
    if (!cost || !VillageData.canAfford(gameState.resources, cost)) return;

    // Builder check
    const builders = getAvailableBuilders();
    if (builders <= 0) {
      showHint('No builders available!');
      return;
    }

    VillageData.deductCost(gameState.resources, cost);

    // Queue the upgrade
    const buildTime = VillageData.getBuildTime(b.id, b.level + 1);
    const now = Date.now();
    if (!villageState.buildQueue) villageState.buildQueue = [];
    villageState.buildQueue.push({
      buildingId: b.id, level: b.level + 1, x: b.x, y: b.y,
      startTime: now,
      endTime: now + buildTime * 1000,
      type: 'upgrade'
    });

    await saveState();
    updateInfoPanel();
    syncAndRender();
    updateResourceDisplay();
    refreshTabContent();
    scheduleBuildQueueCheck();
  }

  async function storeBuilding() {
    if (!selectedPlaced || selectedPlaced.id === 'nexus') return;
    const idx = villageState.buildings.indexOf(selectedPlaced);
    if (idx === -1) return;

    // Store building in inventory (no resource refund — building preserved)
    if (!villageState.inventory) villageState.inventory = [];
    villageState.inventory.push({ id: selectedPlaced.id, level: selectedPlaced.level });

    villageState.buildings.splice(idx, 1);
    selectedPlaced = null;

    await saveState();
    buildGrid();
    updateInfoPanel();
    syncAndRender();
    updateResourceDisplay();
    refreshTabContent();
  }

  // ===== Wall Ghost Placement (CoC-style) =====
  function getWallGhostSpots(wall) {
    // Return empty adjacent tiles up to 2 tiles out in each cardinal direction
    const spots = [];
    const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
    for (const d of dirs) {
      for (let dist = 1; dist <= 2; dist++) {
        const gx = wall.x + d.dx * dist;
        const gy = wall.y + d.dy * dist;
        if (gx < 0 || gx >= GRID || gy < 0 || gy >= GRID) break;
        if (grid[gy][gx] !== -1) break; // stop at first obstacle
        spots.push({ x: gx, y: gy });
      }
    }
    return spots;
  }

  async function placeWallAtGhost(x, y) {
    const cost = VillageData.getBuildingCost('firewall', 1);
    if (!cost || !VillageData.canAfford(gameState.resources, cost)) {
      showHint('Cannot afford wall');
      return;
    }
    const maxWalls = VillageData.getMaxWalls(gameState.level);
    const currentWalls = VillageData.getWallCount(villageState);
    if (currentWalls >= maxWalls) {
      showHint(`Wall limit reached (${currentWalls}/${maxWalls})`);
      return;
    }
    const builders = getAvailableBuilders();
    if (builders <= 0) {
      showHint('No builders available!');
      return;
    }
    if (!canPlaceAt(x, y, 1)) return;

    VillageData.deductCost(gameState.resources, cost);

    // Queue the wall build
    const buildTime = VillageData.getBuildTime('firewall', 1);
    const now = Date.now();
    if (!villageState.buildQueue) villageState.buildQueue = [];
    villageState.buildQueue.push({
      buildingId: 'firewall', level: 1, x, y, hp: 50,
      startTime: now,
      endTime: now + buildTime * 1000,
      type: 'new'
    });

    await saveState();
    buildGrid();

    // Keep the original wall selected and refresh ghosts
    if (selectedPlaced && selectedPlaced.id === 'firewall') {
      wallGhostPositions = getWallGhostSpots(selectedPlaced);
    }
    updateInfoPanel();
    syncAndRender();
    updateResourceDisplay();
    refreshTabContent();
    scheduleBuildQueueCheck();
  }

  // ===== Passive Economy =====
  function getPassiveIncome() {
    const income = { gold: 0, wood: 0, stone: 0, gems: 0 };
    if (!villageState || !villageState.buildings) return income;

    // Collect Overclock Pylon boosts
    const pylonBoosts = new Map(); // buildingIndex -> boost%
    for (const b of villageState.buildings) {
      if (b.id !== 'overclock_pylon') continue;
      const def = VillageData.BUILDINGS.overclock_pylon;
      const boost = def.production[b.level - 1] || 0;
      // Find adjacent buildings
      for (const other of villageState.buildings) {
        if (other === b) continue;
        const otherDef = VillageData.BUILDINGS[other.id];
        if (!otherDef) continue;
        // Check adjacency (within 1 tile of pylon edge)
        const dist = Math.max(
          Math.abs(b.x - other.x - otherDef.size / 2),
          Math.abs(b.y - other.y - otherDef.size / 2)
        );
        if (dist <= 2) {
          const idx = villageState.buildings.indexOf(other);
          pylonBoosts.set(idx, (pylonBoosts.get(idx) || 0) + boost);
        }
      }
    }

    villageState.buildings.forEach((b, i) => {
      const def = VillageData.BUILDINGS[b.id];
      if (!def || def.category !== 'resource') return;
      const base = def.production[b.level - 1] || 0;
      const boost = 1 + (pylonBoosts.get(i) || 0) / 100;

      if (b.id === 'data_mine') income.gold += base * boost;
      else if (b.id === 'code_forge') income.wood += base * boost;
      else if (b.id === 'hashery') income.stone += base * boost;
      else if (b.id === 'crypto_mint') income.gems += base * boost;
    });

    return income;
  }

  function tickPassiveResources() {
    if (!villageState) return;
    const now = Date.now();
    const elapsed = (now - (villageState.lastResourceTick || now)) / 3600000; // hours
    if (elapsed <= 0) { villageState.lastResourceTick = now; return; }

    const income = getPassiveIncome();
    const caps = VillageData.getResourceCaps(villageState);

    gameState.resources.gold = Math.min(caps.gold, (gameState.resources.gold || 0) + Math.floor(income.gold * elapsed));
    gameState.resources.wood = Math.min(caps.wood, (gameState.resources.wood || 0) + Math.floor(income.wood * elapsed));
    gameState.resources.stone = Math.min(caps.stone, (gameState.resources.stone || 0) + Math.floor(income.stone * elapsed));
    gameState.resources.gems = Math.min(caps.gems, (gameState.resources.gems || 0) + income.gems * elapsed);
    // Round gems to integer
    gameState.resources.gems = Math.floor(gameState.resources.gems);

    villageState.lastResourceTick = now;
    updateResourceDisplay();
  }

  // ===== Troop Training =====
  function getTrainSpeedMultiplier(troopDef) {
    // All troops now train at training_ground
    for (const b of villageState.buildings) {
      if (b.id === 'training_ground') {
        const def = VillageData.BUILDINGS.training_ground;
        return def.production[b.level - 1] || 1;
      }
    }
    return 1;
  }

  async function trainTroop(troopId) {
    const def = VillageData.TROOPS[troopId];
    if (!def) return;

    // Check training_ground exists and tier is unlocked
    const maxTier = VillageData.getMaxTrainTier(villageState);
    if (def.tier > maxTier) return;

    // Check cost
    if (!VillageData.canAfford(gameState.resources, def.cost)) return;

    // Check housing
    const cap = VillageData.getHousingCapacity(villageState);
    const used = VillageData.getHousingUsed(villageState);
    if (used + def.housing > cap) return;

    VillageData.deductCost(gameState.resources, def.cost);

    const speedMult = getTrainSpeedMultiplier(def);
    const trainTimeMs = (def.trainTime / speedMult) * 1000;

    villageState.trainingQueue.push({
      troopId,
      startTime: Date.now(),
      endTime: Date.now() + trainTimeMs
    });

    await saveState();
    updateResourceDisplay();
    refreshTabContent();

    // Start checking queue
    scheduleQueueCheck();
  }

  function processTrainingQueue() {
    if (!villageState || !villageState.trainingQueue) return;
    const now = Date.now();
    const completed = [];

    villageState.trainingQueue = villageState.trainingQueue.filter(q => {
      if (q.endTime <= now) {
        completed.push(q.troopId);
        return false;
      }
      return true;
    });

    for (const troopId of completed) {
      const existing = villageState.troops.find(t => t.id === troopId);
      if (existing) {
        existing.count++;
      } else {
        villageState.troops.push({ id: troopId, count: 1 });
      }
    }
  }

  let queueTimer = null;
  function scheduleQueueCheck() {
    if (queueTimer) clearTimeout(queueTimer);
    if (!villageState || villageState.trainingQueue.length === 0) return;

    const nextEnd = Math.min(...villageState.trainingQueue.map(q => q.endTime));
    const delay = Math.max(500, nextEnd - Date.now());

    queueTimer = setTimeout(async () => {
      processTrainingQueue();
      await saveState();
      refreshTabContent();
      scheduleQueueCheck();
    }, delay);
  }

  // ===== Raid System =====
  function checkRaidTrigger() {
    if (!villageState) return;
    const now = Date.now();
    const nexusLv = VillageData.getNexusLevel(villageState);
    if (nexusLv < 1) return;

    // Min 4hr cooldown
    if (now - (villageState.lastRaidTime || 0) < 4 * 3600000) return;
    // Check every 30min
    if (now - (villageState.lastRaidCheck || 0) < 30 * 60000) return;
    villageState.lastRaidCheck = now;

    // 5% base chance, scales with wealth + nexus
    const wealth = (gameState.resources.gold || 0) + (gameState.resources.wood || 0) + (gameState.resources.stone || 0);
    const wealthFactor = Math.min(wealth / 5000, 1) * 5; // up to +5%
    const nexusFactor = nexusLv * 1.5; // +1.5% per nexus level
    const chance = 5 + wealthFactor + nexusFactor;

    if (Math.random() * 100 < chance) {
      executeRaid();
    }
  }

  async function executeRaid() {
    const nexusLv = VillageData.getNexusLevel(villageState);
    const available = VillageData.getAvailableRaiders(nexusLv);
    if (available.length === 0) return;

    // Generate raider wave
    const raiders = [];
    const waveCount = Math.min(3, Math.ceil(nexusLv / 2));
    for (let w = 0; w < waveCount; w++) {
      const type = available[Math.floor(Math.random() * available.length)];
      const count = type.groupSize[0] + Math.floor(Math.random() * (type.groupSize[1] - type.groupSize[0] + 1));
      for (let i = 0; i < count; i++) {
        raiders.push({ ...type, currentHp: type.hp });
      }
    }

    // Calculate defense strength
    let defenseStr = 0;
    let beaconBonus = 0;
    for (const b of villageState.buildings) {
      const def = VillageData.BUILDINGS[b.id];
      if (!def) continue;
      if (b.id === 'turret_node') defenseStr += (def.production[b.level - 1] || 0) * 10;
      if (b.id === 'emp_tower') defenseStr += (def.production[b.level - 1] || 0) * 5;
      if (b.id === 'killswitch_mine') defenseStr += (def.production[b.level - 1] || 0) * 3;
      if (b.id === 'honeypot') defenseStr += (def.production[b.level - 1] || 0) * 0.5;
      if (b.id === 'beacon_tower') beaconBonus += (def.production[b.level - 1] || 0);
    }
    defenseStr *= (1 + beaconBonus / 100);

    // Troop strength
    let troopStr = 0;
    for (const t of villageState.troops) {
      const def = VillageData.TROOPS[t.id];
      if (!def) continue;
      troopStr += (def.hp + def.atk * 5) * t.count;
    }

    // Total defender power
    const totalDefense = defenseStr + troopStr;

    // Raider total power
    let raiderPower = 0;
    for (const r of raiders) {
      raiderPower += r.hp + r.atk * 5;
    }

    // Simulate battle
    const defensePower = totalDefense;
    const won = defensePower >= raiderPower * 0.6; // Defenders have advantage
    const damageDealt = Math.min(raiderPower, defensePower);

    let resourcesLost = null;
    let rewards = null;

    if (!won) {
      // Lose up to 30% of gold/wood/stone
      const qsLevel = villageState.buildings.find(b => b.id === 'quantum_safe');
      const qsDef = qsLevel ? VillageData.BUILDINGS.quantum_safe : null;
      const protection = qsDef && qsLevel ? (qsDef.production[qsLevel.level - 1] || 0) / 100 : 0;
      const lossRate = 0.3 * (1 - protection);

      resourcesLost = {
        gold: Math.floor((gameState.resources.gold || 0) * lossRate),
        wood: Math.floor((gameState.resources.wood || 0) * lossRate),
        stone: Math.floor((gameState.resources.stone || 0) * lossRate)
      };

      gameState.resources.gold -= resourcesLost.gold;
      gameState.resources.wood -= resourcesLost.wood;
      gameState.resources.stone -= resourcesLost.stone;
      villageState.totalRaidsLost++;

      // Troops take losses
      for (const t of villageState.troops) {
        const losses = Math.floor(t.count * 0.3);
        t.count = Math.max(0, t.count - losses);
      }
      villageState.troops = villageState.troops.filter(t => t.count > 0);
    } else {
      // Reward
      const baseGold = 20 + nexusLv * 15;
      const gemChance = nexusLv * 5;
      rewards = { gold: baseGold };
      if (Math.random() * 100 < gemChance) {
        rewards.gems = 1 + Math.floor(nexusLv / 3);
      }
      gameState.resources.gold = (gameState.resources.gold || 0) + rewards.gold;
      if (rewards.gems) gameState.resources.gems = (gameState.resources.gems || 0) + rewards.gems;
      villageState.totalRaidsWon++;

      // Small troop losses even on win
      for (const t of villageState.troops) {
        const losses = Math.floor(t.count * 0.1);
        t.count = Math.max(0, t.count - losses);
      }
      villageState.troops = villageState.troops.filter(t => t.count > 0);
    }

    villageState.lastRaidTime = Date.now();

    // Log
    villageState.raidLog.push({
      timestamp: Date.now(),
      result: won ? 'win' : 'loss',
      raiders: raiders.length,
      raiderTypes: [...new Set(raiders.map(r => r.name))].join(', '),
      damageDealt: Math.floor(damageDealt),
      resourcesLost: resourcesLost || null,
      rewards: rewards || null
    });

    // Keep only 20 most recent
    if (villageState.raidLog.length > 20) {
      villageState.raidLog = villageState.raidLog.slice(-20);
    }

    await saveState();
    updateResourceDisplay();

    // Show raid animation (HTML overlay)
    await playRaidAnimation(raiders, won);
  }

  // ===== Raid Animation (HTML overlay) =====
  async function playRaidAnimation(raiders, won) {
    return new Promise((resolve) => {
      const el = document.getElementById('village-3d-container');
      if (!el) { resolve(); return; }

      const overlay = document.createElement('div');
      overlay.className = 'village-raid-overlay';
      overlay.innerHTML = `
        <div class="raid-raiders">${raiders.slice(0, 8).map(r => `<span class="raid-icon">${r.icon}</span>`).join('')}</div>
        <div class="raid-result" style="opacity:0">
          <div class="raid-result-text" style="color:${won ? '#2ee67a' : '#ff4455'}">${won ? 'RAID DEFENDED!' : 'VILLAGE BREACHED!'}</div>
          <div class="raid-result-sub">${raiders.length} raiders</div>
        </div>
      `;
      el.appendChild(overlay);

      // Flash effect
      el.classList.add('raided');
      setTimeout(() => el.classList.remove('raided'), 1000);

      // Show result after 1.5s
      setTimeout(() => {
        const result = overlay.querySelector('.raid-result');
        if (result) result.style.opacity = '1';
      }, 1500);

      // Remove overlay after 4s
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        syncAndRender();
        resolve();
      }, 4000);
    });
  }

  // ===== Helpers =====
  function formatCost(cost) {
    if (!cost) return '';
    const parts = [];
    if (cost.gold) parts.push(`${cost.gold}●`);
    if (cost.wood) parts.push(`${cost.wood}▪`);
    if (cost.stone) parts.push(`${cost.stone}■`);
    if (cost.gems) parts.push(`${cost.gems}◆`);
    if (cost.chronos) parts.push(`${cost.chronos}⧖`);
    return parts.join(' ');
  }

  function updateResourceDisplay() {
    // Update sidebar resource bar
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = Math.floor(val || 0); };
    set('res-gold', gameState.resources.gold);
    set('res-gems', gameState.resources.gems);
    set('res-wood', gameState.resources.wood);
    set('res-stone', gameState.resources.stone);
    set('res-chronos', gameState.resources.chronos);
  }

  function refreshTabContent() {
    const tabContent = document.getElementById('village-tab-content');
    if (tabContent) {
      tabContent.innerHTML = renderTabContent();
      wireShopEvents(); // also renders catalog previews
    }
  }

  function wireShopEvents() {
    if (!container) return;

    // Render building sprite previews on canvases
    renderCatalogPreviews();

    // Wire build catalog clicks (non-inventory) — select & close drawer for placement
    container.querySelectorAll('.village-catalog-item:not(.inventory-item):not(.locked)').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.buildingId;
        if (!id) return;
        const def = VillageData.BUILDINGS[id];
        if (!def) return;
        // Check affordability
        const cost = VillageData.getBuildingCost(id, 1);
        if (!VillageData.canAfford(gameState.resources, cost)) return;

        selectedBuilding = def;
        placingFromInventory = null;
        selectedPlaced = null;
        ghostPos = null;
        // Close drawer to reveal the grid for placement
        activeTab = null;
        renderUI();
        updateInfoPanel();
        syncAndRender();
      });
    });
    // Wire inventory placement clicks
    container.querySelectorAll('.inventory-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.buildingId;
        const invIdx = parseInt(item.dataset.invIdx);
        const level = parseInt(item.dataset.invLevel);
        if (!id) return;
        selectedBuilding = VillageData.BUILDINGS[id];
        placingFromInventory = { id, level, inventoryIndex: invIdx };
        selectedPlaced = null;
        ghostPos = null;
        // Close drawer
        activeTab = null;
        renderUI();
        updateInfoPanel();
        syncAndRender();
      });
    });
    // Wire cancel placement button
    const cancelBtn = container.querySelector('#cancel-placement-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        selectedBuilding = null;
        placingFromInventory = null;
        ghostPos = null;
        updateInfoPanel();
        refreshTabContent();
        syncAndRender();
      });
    }
    // Wire chronos skip buttons
    container.querySelectorAll('.btn-chronos-skip').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.queueIdx);
        skipBuildWithChronos(idx);
      });
    });
    // Wire buy chronos buttons
    container.querySelectorAll('.btn-buy-chronos').forEach(btn => {
      btn.addEventListener('click', async () => {
        const gemsCost = parseInt(btn.dataset.gems);
        const chronosGain = parseInt(btn.dataset.chronos);
        if ((gameState.resources.gems || 0) < gemsCost) return;
        gameState.resources.gems -= gemsCost;
        gameState.resources.chronos = (gameState.resources.chronos || 0) + chronosGain;
        await saveState();
        updateResourceDisplay();
        refreshTabContent();
      });
    });
    // Wire troop train buttons
    container.querySelectorAll('.train-troop-btn').forEach(btn => {
      btn.addEventListener('click', () => trainTroop(btn.dataset.troopId));
    });

    // Wire raid search button
    const searchBtn = container.querySelector('#raid-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        searchBtn.disabled = true;
        searchBtn.textContent = '🔍 Searching...';
        setTimeout(() => {
          VillageBattle.searchForTarget(villageState);
          refreshTabContent();
        }, 800 + Math.random() * 1200);
      });
    }

    // Wire raid attack button
    const attackBtn = container.querySelector('#raid-attack-btn');
    if (attackBtn) {
      attackBtn.addEventListener('click', () => {
        startPlayerRaid();
      });
    }
  }

  async function startPlayerRaid() {
    if (VillageBattle.isActive()) return;

    // Initialize battle group on the renderer's scene
    const el = document.getElementById('village-3d-container');
    if (el && !el._battleGroup) {
      const scn = VillageRenderer.getScene();
      if (scn) {
        const grp = new THREE.Group();
        grp.name = 'battle';
        scn.add(grp);
        el._battleGroup = grp;
      }
    }

    // Close drawer
    activeTab = null;

    VillageBattle.startDeploy(villageState, async (result) => {
      // Battle complete callback
      if (result && result.result === 'win') {
        // Add loot
        gameState.resources.gold = (gameState.resources.gold || 0) + (result.loot.gold || 0);
        gameState.resources.wood = (gameState.resources.wood || 0) + (result.loot.wood || 0);
        gameState.resources.stone = (gameState.resources.stone || 0) + (result.loot.stone || 0);
        villageState.totalRaidsWon++;
      } else {
        villageState.totalRaidsLost++;
      }

      // Apply troop losses
      for (const [troopId, count] of Object.entries(result.troopLosses || {})) {
        const troop = villageState.troops.find(t => t.id === troopId);
        if (troop) {
          troop.count = Math.max(0, troop.count - count);
        }
      }
      villageState.troops = villageState.troops.filter(t => t.count > 0);

      // Log the raid
      const enemy = VillageBattle.getEnemyVillage();
      villageState.raidLog.push({
        timestamp: Date.now(),
        result: result.result,
        stars: result.stars,
        enemyName: enemy ? enemy.name : 'Unknown',
        raiders: 0,
        damageDealt: Math.floor(result.destructionPct * 100),
        resourcesLost: null,
        rewards: result.result === 'win' ? result.loot : null
      });
      if (villageState.raidLog.length > 20) {
        villageState.raidLog = villageState.raidLog.slice(-20);
      }

      await saveState();
      // Restore player's village view
      buildGrid();
      syncAndRender();
      updateResourceDisplay();
      updateInfoPanel();
    });

    renderUI();
    syncAndRender();
  }

  // ===== Builder System =====
  function getAvailableBuilders() {
    const total = VillageData.getBuilderCount(villageState);
    const busy = (villageState.buildQueue || []).length;
    return Math.max(0, total - busy);
  }

  function formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  function showHint(msg) {
    VillageRenderer.showTooltip(msg);
  }

  function processBuildQueue() {
    if (!villageState || !villageState.buildQueue) return;
    const now = Date.now();
    const completed = [];

    villageState.buildQueue = villageState.buildQueue.filter(q => {
      if (q.endTime <= now) {
        completed.push(q);
        return false;
      }
      return true;
    });

    for (const q of completed) {
      if (q.type === 'upgrade') {
        // Find building at position and upgrade it
        const existing = villageState.buildings.find(b => b.x === q.x && b.y === q.y);
        if (existing) {
          existing.level = q.level;
          const def = VillageData.BUILDINGS[existing.id];
          if (def && (def.category === 'defense' || existing.id === 'nexus')) {
            existing.hp = def.production[existing.level - 1] || existing.hp;
          }
        }
      } else {
        // New building
        villageState.buildings.push({
          id: q.buildingId, level: q.level, x: q.x, y: q.y, hp: q.hp || 100
        });
      }
    }

    if (completed.length > 0) {
      buildGrid();
      syncAndRender();
      refreshTabContent();
    }
  }

  function scheduleBuildQueueCheck() {
    if (buildQueueTimer) clearTimeout(buildQueueTimer);
    if (!villageState || !villageState.buildQueue || villageState.buildQueue.length === 0) {
      // If we were viewing a build queue item, clear it
      if (selectedBuildQueueItem) {
        selectedBuildQueueItem = null;
        updateInfoPanel();
      }
      return;
    }

    const nextEnd = Math.min(...villageState.buildQueue.map(q => q.endTime));
    const delay = Math.max(500, nextEnd - Date.now());

    buildQueueTimer = setTimeout(async () => {
      processBuildQueue();
      await saveState();
      // If the selected build queue item finished, deselect
      if (selectedBuildQueueItem && !(villageState.buildQueue || []).includes(selectedBuildQueueItem)) {
        selectedBuildQueueItem = null;
        updateInfoPanel();
      }
      scheduleBuildQueueCheck();
    }, delay);
  }

  async function skipBuildWithChronos(queueIndex) {
    if (!villageState.buildQueue || !villageState.buildQueue[queueIndex]) return;
    const q = villageState.buildQueue[queueIndex];
    const remaining = Math.max(0, q.endTime - Date.now()) / 1000;
    const cost = Math.max(1, Math.ceil(remaining / 60));
    if ((gameState.resources.chronos || 0) < cost) {
      showHint(`Need ${cost}⧖ Chronos to skip!`);
      return;
    }
    gameState.resources.chronos -= cost;
    q.endTime = Date.now(); // Complete instantly
    processBuildQueue();
    await saveState();
    updateResourceDisplay();
    refreshTabContent();
    syncAndRender();
  }

  // ===== Cleanup =====
  function cleanup() {
    if (animFrame) cancelAnimationFrame(animFrame);
    if (buildQueueTimer) clearTimeout(buildQueueTimer);
    if (infoPanelRefreshTimer) clearInterval(infoPanelRefreshTimer);
    canvasInited = false;
    VillageRenderer.dispose();
  }

  return { render, cleanup };
})();
