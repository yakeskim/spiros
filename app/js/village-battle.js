// village-battle.js — Battle engine, AI village gen, deploy UI, tick simulation, 3D visualization
// Depends on: THREE (global), VillageData, VillageRenderer, VillageCamera, VillageBuildings

const VillageBattle = (() => {
  const GRID = 24;
  const TICK_RATE = 20;
  const TICK_INTERVAL = 50;
  const MAX_TICKS = 2400; // 2 min max battle
  const DEPLOY_TIME = 30; // seconds

  // State
  let active = false;
  let battleScene = null;
  let enemyVillage = null;
  let deployedTroops = [];
  let battleResult = null;
  let playbackTimer = null;
  let deployTimer = null;
  let deployCountdown = DEPLOY_TIME;
  let deployTimerInterval = null;
  let troopsToPlace = {}; // troopId → count remaining to place
  let selectedDeployTroop = null;
  let onBattleComplete = null; // callback

  // 3D battle objects
  let entityMeshes = new Map(); // entityId → mesh
  let projectileMeshes = [];
  let effectMeshes = [];
  let battleGroup = null;

  // ===== Enemy Village Generation =====
  function generateEnemyVillage(difficulty) {
    const d = Math.max(1, Math.min(10, difficulty));
    const buildings = [];
    const grid = [];
    for (let y = 0; y < GRID; y++) {
      grid[y] = [];
      for (let x = 0; x < GRID; x++) grid[y][x] = 0;
    }

    function placeBuilding(id, x, y) {
      const def = VillageData.BUILDINGS[id];
      if (!def) return false;
      const sz = def.size;
      // Bounds check
      if (x < 0 || y < 0 || x + sz > GRID || y + sz > GRID) return false;
      // Occupancy check
      for (let dy = 0; dy < sz; dy++) {
        for (let dx = 0; dx < sz; dx++) {
          if (grid[y + dy][x + dx]) return false;
        }
      }
      // Place
      for (let dy = 0; dy < sz; dy++) {
        for (let dx = 0; dx < sz; dx++) {
          grid[y + dy][x + dx] = 1;
        }
      }
      const level = Math.max(1, Math.min(def.maxLevel,
        Math.floor(d * 0.8) + Math.floor(Math.random() * 3)));
      const hp = def.category === 'defense' ? (def.production[level - 1] || 50) :
                 id === 'nexus' ? (def.production[level - 1] || 200) : 100 + level * 20;
      buildings.push({ id, level, x, y, hp, maxHp: hp });
      return true;
    }

    function tryPlaceNear(id, cx, cy, radius) {
      for (let attempts = 0; attempts < 40; attempts++) {
        const rx = cx + Math.floor(Math.random() * radius * 2) - radius;
        const ry = cy + Math.floor(Math.random() * radius * 2) - radius;
        if (placeBuilding(id, rx, ry)) return true;
      }
      return false;
    }

    // 1. Nexus at center
    const ncx = Math.floor(GRID / 2) - 1;
    const ncy = Math.floor(GRID / 2) - 1;
    placeBuilding('nexus', ncx, ncy);

    // 2. Defense buildings around nexus
    const defenseIds = ['turret_node', 'emp_tower', 'sniper_tower', 'plasma_turret'];
    if (d >= 6) defenseIds.push('space_cannon');
    if (d >= 8) defenseIds.push('ion_beam');
    const defenseCount = Math.min(8, 2 + Math.floor(d * 0.8));
    for (let i = 0; i < defenseCount; i++) {
      const bid = defenseIds[i % defenseIds.length];
      tryPlaceNear(bid, ncx, ncy, 5);
    }

    // 3. Walls around core
    const wallCount = Math.min(30, d * 4);
    for (let i = 0; i < wallCount; i++) {
      const angle = (i / wallCount) * Math.PI * 2;
      const dist = 4 + Math.random() * 2;
      const wx = Math.floor(ncx + 1 + Math.cos(angle) * dist);
      const wy = Math.floor(ncy + 1 + Math.sin(angle) * dist);
      placeBuilding('firewall', wx, wy);
    }

    // 4. Resource buildings in outer zone
    const resourceIds = ['data_mine', 'code_forge', 'hashery', 'data_vault'];
    const resCount = 3 + Math.floor(d * 0.5);
    for (let i = 0; i < resCount; i++) {
      tryPlaceNear(resourceIds[i % resourceIds.length], ncx, ncy, 8);
    }

    // 5. Military buildings
    tryPlaceNear('barracks', ncx, ncy, 6);
    tryPlaceNear('training_ground', ncx, ncy, 6);

    // 6. Defender troops
    const troops = [];
    const troopPool = Object.values(VillageData.TROOPS).filter(t => t.tier <= Math.ceil(d / 2));
    const troopCount = Math.max(3, d * 2);
    for (let i = 0; i < troopCount; i++) {
      const t = troopPool[Math.floor(Math.random() * troopPool.length)];
      troops.push({
        id: t.id,
        hp: t.hp,
        maxHp: t.hp,
        atk: t.atk,
        speed: t.speed,
        range: t.range,
        icon: t.icon,
        name: t.name
      });
    }

    // Generate enemy name
    const prefixes = ['Dark', 'Iron', 'Shadow', 'Neon', 'Void', 'Cyber', 'Ghost', 'Storm', 'Hex', 'Zero'];
    const suffixes = ['Fortress', 'Bastion', 'Citadel', 'Compound', 'Bunker', 'Haven', 'Nexus', 'Core', 'Domain', 'Grid'];
    const name = prefixes[Math.floor(Math.random() * prefixes.length)] + ' ' +
                 suffixes[Math.floor(Math.random() * suffixes.length)];

    return { buildings, troops, grid, name, difficulty: d };
  }

  function estimateLoot(enemy) {
    const baseGold = 100 + enemy.difficulty * 80;
    const baseWood = 60 + enemy.difficulty * 50;
    const baseStone = 40 + enemy.difficulty * 30;
    return {
      gold: { min: Math.floor(baseGold * 0.5), max: baseGold },
      wood: { min: Math.floor(baseWood * 0.5), max: baseWood },
      stone: { min: Math.floor(baseStone * 0.5), max: baseStone }
    };
  }

  // ===== Raid Search / Matchmaking =====
  function searchForTarget(villageState) {
    const nexusLv = VillageData.getNexusLevel(villageState);
    const diffOffset = Math.floor(Math.random() * 3) - 1; // -1 to +1
    const difficulty = Math.max(1, Math.min(10, nexusLv + diffOffset));
    enemyVillage = generateEnemyVillage(difficulty);
    return enemyVillage;
  }

  // ===== Deploy Phase =====
  function startDeploy(villageState, onComplete) {
    if (active) return;
    active = true;
    onBattleComplete = onComplete;
    deployedTroops = [];
    selectedDeployTroop = null;
    deployCountdown = DEPLOY_TIME;

    // Copy player's available troops
    troopsToPlace = {};
    for (const t of villageState.troops) {
      if (t.count > 0) troopsToPlace[t.id] = t.count;
    }

    // Render enemy village on the 3D scene
    renderEnemyVillage();
    showDeployUI();
    startDeployTimer();
  }

  function renderEnemyVillage() {
    if (!enemyVillage) return;
    // Use VillageRenderer's existing sync but with enemy data
    // We pass a fake villageState to syncBuildings
    const fakeState = {
      buildings: enemyVillage.buildings,
      buildQueue: []
    };
    VillageRenderer.syncBuildings(fakeState);
  }

  function showDeployUI() {
    const container = document.getElementById('village-3d-container');
    if (!container) return;

    // Remove any existing battle overlay
    const existing = container.querySelector('#battle-deploy-tray');
    if (existing) existing.remove();

    let troopHtml = '';
    for (const [id, count] of Object.entries(troopsToPlace)) {
      if (count <= 0) continue;
      const def = VillageData.TROOPS[id];
      if (!def) continue;
      troopHtml += `<div class="deploy-troop ${selectedDeployTroop === id ? 'selected' : ''}" data-troop="${id}">
        <span class="troop-icon">${def.icon}</span>
        <span class="troop-name">${def.name}</span>
        <span class="troop-count">x${count}</span>
      </div>`;
    }

    const tray = document.createElement('div');
    tray.id = 'battle-deploy-tray';
    tray.innerHTML = `
      <div class="deploy-header">
        <span class="deploy-title">DEPLOY TROOPS</span>
        <span class="deploy-timer" id="deploy-timer-display">${deployCountdown}s</span>
      </div>
      <div class="deploy-troops-list">${troopHtml}</div>
      <div class="deploy-actions">
        <button class="btn-pixel deploy-start-btn" id="deploy-start-btn">DEPLOY</button>
        <button class="btn-pixel deploy-cancel-btn" id="deploy-cancel-btn">Retreat</button>
      </div>
      <div class="deploy-hint">Select a troop type, then click border tiles to place them.</div>
    `;
    container.appendChild(tray);

    // Wire troop selection
    tray.querySelectorAll('.deploy-troop').forEach(el => {
      el.addEventListener('click', () => {
        selectedDeployTroop = el.dataset.troop;
        showDeployUI(); // refresh selection highlight
      });
    });

    // Wire deploy button
    const startBtn = document.getElementById('deploy-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (deployedTroops.length === 0) return;
        stopDeployTimer();
        beginBattle();
      });
    }

    // Wire cancel button
    const cancelBtn = document.getElementById('deploy-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        cleanup();
      });
    }
  }

  function startDeployTimer() {
    if (deployTimerInterval) clearInterval(deployTimerInterval);
    deployTimerInterval = setInterval(() => {
      deployCountdown--;
      const display = document.getElementById('deploy-timer-display');
      if (display) display.textContent = deployCountdown + 's';
      if (deployCountdown <= 0) {
        stopDeployTimer();
        if (deployedTroops.length > 0) {
          beginBattle();
        } else {
          // Auto-deploy all remaining troops on random border tiles
          autoDeployAll();
          beginBattle();
        }
      }
    }, 1000);
  }

  function stopDeployTimer() {
    if (deployTimerInterval) {
      clearInterval(deployTimerInterval);
      deployTimerInterval = null;
    }
  }

  function autoDeployAll() {
    const borderTiles = getBorderTiles();
    let idx = 0;
    for (const [id, count] of Object.entries(troopsToPlace)) {
      for (let i = 0; i < count; i++) {
        if (idx >= borderTiles.length) idx = 0;
        const tile = borderTiles[idx];
        deployedTroops.push({
          troopId: id,
          x: tile.x + 0.5,
          y: tile.y + 0.5
        });
        idx++;
      }
      troopsToPlace[id] = 0;
    }
  }

  function getBorderTiles() {
    const tiles = [];
    // Top and bottom edges
    for (let x = 0; x < GRID; x++) {
      tiles.push({ x, y: 0 });
      tiles.push({ x, y: GRID - 1 });
    }
    // Left and right edges (excluding corners)
    for (let y = 1; y < GRID - 1; y++) {
      tiles.push({ x: 0, y });
      tiles.push({ x: GRID - 1, y });
    }
    // Shuffle
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
  }

  // Handle click on grid during deploy phase
  function onDeployClick(tileX, tileY) {
    if (!active || !selectedDeployTroop) return false;
    if (!troopsToPlace[selectedDeployTroop] || troopsToPlace[selectedDeployTroop] <= 0) return false;

    // Must be on border (first or last 2 rows/cols)
    const isBorder = tileX <= 1 || tileX >= GRID - 2 || tileY <= 1 || tileY >= GRID - 2;
    if (!isBorder) return false;

    // Don't deploy on occupied tile
    if (enemyVillage && enemyVillage.grid[tileY] && enemyVillage.grid[tileY][tileX]) return false;

    deployedTroops.push({
      troopId: selectedDeployTroop,
      x: tileX + 0.5,
      y: tileY + 0.5
    });
    troopsToPlace[selectedDeployTroop]--;

    // Show deployed troop on scene
    spawnDeployedTroopMesh(deployedTroops.length - 1, selectedDeployTroop, tileX + 0.5, tileY + 0.5);

    showDeployUI(); // refresh counts
    return true;
  }

  function spawnDeployedTroopMesh(entityId, troopId, wx, wz) {
    const def = VillageData.TROOPS[troopId];
    if (!def) return;

    const geo = new THREE.CylinderGeometry(0.08, 0.07, 0.18, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x44ff88,
      emissive: 0x22aa44,
      emissiveIntensity: 0.3
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(wx, 0.15, wz);
    mesh.castShadow = true;

    // Add label sprite
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 64;
    labelCanvas.height = 32;
    const lc = labelCanvas.getContext('2d');
    lc.font = '20px serif';
    lc.textAlign = 'center';
    lc.textBaseline = 'middle';
    lc.fillText(def.icon, 32, 16);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
    const label = new THREE.Sprite(labelMat);
    label.position.y = 0.35;
    label.scale.set(0.3, 0.15, 1);
    mesh.add(label);

    // Access scene via uiGroup parent workaround — just add to the container's scene
    const container = document.getElementById('village-3d-container');
    if (container && container._battleGroup) {
      container._battleGroup.add(mesh);
    }
    entityMeshes.set('deploy_' + entityId, mesh);
  }

  // ===== Battle Simulation =====
  function beginBattle() {
    // Remove deploy UI
    const tray = document.getElementById('battle-deploy-tray');
    if (tray) tray.remove();

    // Build attacker list
    const attackers = deployedTroops.map((d, i) => {
      const def = VillageData.TROOPS[d.troopId];
      return {
        id: 'atk_' + i,
        troopId: d.troopId,
        name: def.name,
        icon: def.icon,
        type: 'attacker',
        hp: def.hp,
        maxHp: def.hp,
        atk: def.atk,
        speed: def.speed * 0.15, // scale to world units per tick
        range: def.range,
        x: d.x,
        y: d.y,
        target: null,
        cooldown: 0,
        alive: true
      };
    });

    // Build defender list
    const defenders = (enemyVillage.troops || []).map((d, i) => {
      // Place defenders near nexus
      const nx = GRID / 2 + (Math.random() * 4 - 2);
      const ny = GRID / 2 + (Math.random() * 4 - 2);
      return {
        id: 'def_' + i,
        troopId: d.id,
        name: d.name,
        icon: d.icon,
        type: 'defender',
        hp: d.hp,
        maxHp: d.maxHp || d.hp,
        atk: d.atk,
        speed: d.speed * 0.15,
        range: d.range,
        x: nx,
        y: ny,
        target: null,
        cooldown: 0,
        alive: true
      };
    });

    // Build defense structures (weapon buildings)
    const defenses = enemyVillage.buildings
      .filter(b => {
        const def = VillageData.BUILDINGS[b.id];
        return def && def.defenseStats;
      })
      .map((b, i) => {
        const def = VillageData.BUILDINGS[b.id];
        const stats = def.defenseStats[b.level - 1] || def.defenseStats[0];
        const sz = def.size;
        return {
          id: 'wep_' + i,
          buildingId: b.id,
          type: 'defense',
          x: b.x + sz / 2,
          y: b.y + sz / 2,
          damage: stats.damage,
          range: stats.range,
          fireRate: stats.fireRate,
          splashRadius: stats.splashRadius,
          special: stats.special,
          cooldown: 0,
          alive: true
        };
      });

    // Build target buildings (for attackers to destroy)
    const targetBuildings = enemyVillage.buildings.map((b, i) => {
      const def = VillageData.BUILDINGS[b.id];
      const sz = def ? def.size : 1;
      return {
        id: 'bld_' + i,
        buildingId: b.id,
        type: 'building',
        x: b.x + sz / 2,
        y: b.y + sz / 2,
        hp: b.hp,
        maxHp: b.maxHp || b.hp,
        alive: true,
        isNexus: b.id === 'nexus'
      };
    });

    // Run tick simulation
    const result = runBattle(attackers, defenders, defenses, targetBuildings);
    battleResult = result;

    // Play back the result
    playBattle(result.ticks, result);
  }

  function runBattle(attackers, defenders, defenses, buildings) {
    const entities = [...attackers, ...defenders];
    const allBuildings = [...buildings];
    const allDefenses = [...defenses];
    const ticks = [];

    let tick = 0;
    while (tick < MAX_TICKS) {
      const tickEvents = simulateTick(tick, entities, allDefenses, allBuildings);
      ticks.push(tickEvents);

      // Check if battle is over
      const liveAttackers = entities.filter(e => e.type === 'attacker' && e.alive);
      const liveBuildings = allBuildings.filter(b => b.alive);

      if (liveAttackers.length === 0 || liveBuildings.length === 0) break;
      tick++;
    }

    // Calculate results
    const totalBuildings = allBuildings.length;
    const destroyedBuildings = allBuildings.filter(b => !b.alive).length;
    const destructionPct = totalBuildings > 0 ? destroyedBuildings / totalBuildings : 0;
    const nexusDestroyed = allBuildings.some(b => b.isNexus && !b.alive);

    let stars = 0;
    if (destructionPct >= 0.5) stars = 1;
    if (nexusDestroyed) stars = Math.max(stars, 2);
    if (destructionPct >= 1.0) stars = 3;

    const resultStr = stars > 0 ? 'win' : 'lose';

    // Calculate loot
    const baseLoot = estimateLoot(enemyVillage);
    const loot = {
      gold: Math.floor(baseLoot.gold.min + (baseLoot.gold.max - baseLoot.gold.min) * destructionPct),
      wood: Math.floor(baseLoot.wood.min + (baseLoot.wood.max - baseLoot.wood.min) * destructionPct),
      stone: Math.floor(baseLoot.stone.min + (baseLoot.stone.max - baseLoot.stone.min) * destructionPct)
    };
    if (stars === 0) { loot.gold = 0; loot.wood = 0; loot.stone = 0; }

    // Troop losses
    const troopLosses = {};
    for (const e of entities) {
      if (e.type === 'attacker' && !e.alive) {
        troopLosses[e.troopId] = (troopLosses[e.troopId] || 0) + 1;
      }
    }

    return { ticks, result: resultStr, stars, loot, troopLosses, destructionPct };
  }

  function simulateTick(tick, entities, defenses, buildings) {
    const events = {
      tick,
      positions: [],
      attacks: [],
      deaths: [],
      projectiles: [],
      buildingDamage: []
    };

    const aliveAttackers = entities.filter(e => e.type === 'attacker' && e.alive);
    const aliveDefenders = entities.filter(e => e.type === 'defender' && e.alive);
    const aliveBuildings = buildings.filter(b => b.alive);

    // 1. Move attackers toward nearest target
    for (const atk of aliveAttackers) {
      // Find nearest target: prefer buildings, then defenders
      let nearestTarget = null;
      let nearestDist = Infinity;

      for (const bld of aliveBuildings) {
        const dist = Math.hypot(atk.x - bld.x, atk.y - bld.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestTarget = bld;
        }
      }

      atk.target = nearestTarget;

      if (nearestTarget && nearestDist > atk.range) {
        // Move toward target
        const dx = nearestTarget.x - atk.x;
        const dy = nearestTarget.y - atk.y;
        const len = Math.hypot(dx, dy) || 1;
        atk.x += (dx / len) * atk.speed;
        atk.y += (dy / len) * atk.speed;
      } else if (nearestTarget && atk.cooldown <= 0) {
        // Attack
        nearestTarget.hp -= atk.atk;
        atk.cooldown = 3; // ticks between attacks
        events.attacks.push({
          from: { x: atk.x, y: atk.y },
          to: { x: nearestTarget.x, y: nearestTarget.y },
          damage: atk.atk,
          targetId: nearestTarget.id
        });

        if (nearestTarget.hp <= 0) {
          nearestTarget.alive = false;
          events.deaths.push({ id: nearestTarget.id, x: nearestTarget.x, y: nearestTarget.y, type: 'building' });
        }
      }
      if (atk.cooldown > 0) atk.cooldown--;
    }

    // 2. Move defenders toward nearest attacker
    for (const def of aliveDefenders) {
      let nearestAtk = null;
      let nearestDist = Infinity;
      for (const atk of aliveAttackers) {
        const dist = Math.hypot(def.x - atk.x, def.y - atk.y);
        if (dist < nearestDist) { nearestDist = dist; nearestAtk = atk; }
      }

      if (nearestAtk && nearestDist > def.range) {
        const dx = nearestAtk.x - def.x;
        const dy = nearestAtk.y - def.y;
        const len = Math.hypot(dx, dy) || 1;
        def.x += (dx / len) * def.speed;
        def.y += (dy / len) * def.speed;
      } else if (nearestAtk && def.cooldown <= 0) {
        nearestAtk.hp -= def.atk;
        def.cooldown = 3;
        events.attacks.push({
          from: { x: def.x, y: def.y },
          to: { x: nearestAtk.x, y: nearestAtk.y },
          damage: def.atk,
          targetId: nearestAtk.id
        });
        if (nearestAtk.hp <= 0) {
          nearestAtk.alive = false;
          events.deaths.push({ id: nearestAtk.id, x: nearestAtk.x, y: nearestAtk.y, type: 'troop' });
        }
      }
      if (def.cooldown > 0) def.cooldown--;
    }

    // 3. Weapon buildings fire at attackers
    for (const wep of defenses) {
      if (!wep.alive) continue;
      if (wep.cooldown > 0) { wep.cooldown--; continue; }

      // Find target based on special behavior
      let target = null;
      let targetDist = Infinity;

      for (const atk of aliveAttackers) {
        const dist = Math.hypot(wep.x - atk.x, wep.y - atk.y);
        if (dist > wep.range) continue;

        if (wep.special === 'snipe_highest') {
          // Target highest HP
          if (!target || atk.hp > target.hp) {
            target = atk;
            targetDist = dist;
          }
        } else {
          // Target nearest
          if (dist < targetDist) {
            target = atk;
            targetDist = dist;
          }
        }
      }

      if (!target) continue;

      wep.cooldown = wep.fireRate;

      // Apply damage
      if (wep.splashRadius > 0) {
        // AoE damage
        for (const atk of aliveAttackers) {
          const dist = Math.hypot(target.x - atk.x, target.y - atk.y);
          if (dist <= wep.splashRadius) {
            const falloff = 1 - (dist / wep.splashRadius) * 0.5;
            atk.hp -= Math.floor(wep.damage * falloff);
            if (atk.hp <= 0) {
              atk.alive = false;
              events.deaths.push({ id: atk.id, x: atk.x, y: atk.y, type: 'troop' });
            }
          }
        }
      } else {
        target.hp -= wep.damage;
        if (target.hp <= 0) {
          target.alive = false;
          events.deaths.push({ id: target.id, x: target.x, y: target.y, type: 'troop' });
        }
      }

      // Chain damage for ion_beam
      if (wep.special === 'chain') {
        let chainTarget = target;
        for (let c = 0; c < 2; c++) {
          let nextTarget = null;
          let nextDist = Infinity;
          for (const atk of aliveAttackers) {
            if (atk === chainTarget || !atk.alive) continue;
            const dist = Math.hypot(chainTarget.x - atk.x, chainTarget.y - atk.y);
            if (dist < nextDist && dist < 3) {
              nextDist = dist;
              nextTarget = atk;
            }
          }
          if (!nextTarget) break;
          const chainDmg = Math.floor(wep.damage * 0.5);
          nextTarget.hp -= chainDmg;
          events.projectiles.push({
            from: { x: chainTarget.x, y: chainTarget.y },
            to: { x: nextTarget.x, y: nextTarget.y },
            color: 'chain'
          });
          if (nextTarget.hp <= 0) {
            nextTarget.alive = false;
            events.deaths.push({ id: nextTarget.id, x: nextTarget.x, y: nextTarget.y, type: 'troop' });
          }
          chainTarget = nextTarget;
        }
      }

      events.projectiles.push({
        from: { x: wep.x, y: wep.y },
        to: { x: target.x, y: target.y },
        color: wep.special === 'chain' ? 'chain' : wep.splashRadius > 0 ? 'aoe' : 'normal'
      });
    }

    // Record positions for all alive entities
    for (const e of entities) {
      if (e.alive) {
        events.positions.push({
          id: e.id,
          x: e.x,
          y: e.y,
          hp: e.hp,
          maxHp: e.maxHp,
          type: e.type,
          icon: e.icon
        });
      }
    }

    return events;
  }

  // ===== 3D Battle Visualization =====
  function playBattle(tickLog, result) {
    if (!tickLog || tickLog.length === 0) {
      showResults(result);
      return;
    }

    // Clear deployed troop meshes
    clearBattleMeshes();

    // Initialize the battle group for dynamic entities
    const container = document.getElementById('village-3d-container');
    if (container && container._battleGroup) {
      // Already exists
    }

    // Show battle HUD
    showBattleHUD(tickLog.length);

    let currentTick = 0;
    playbackTimer = setInterval(() => {
      if (currentTick >= tickLog.length) {
        clearInterval(playbackTimer);
        playbackTimer = null;
        // Slight delay before showing results
        setTimeout(() => showResults(result), 1000);
        return;
      }

      renderBattleTick(tickLog[currentTick]);
      updateBattleHUD(currentTick, tickLog.length);
      currentTick++;
    }, TICK_INTERVAL);
  }

  function showBattleHUD(totalTicks) {
    const container = document.getElementById('village-3d-container');
    if (!container) return;

    const existing = container.querySelector('#battle-hud');
    if (existing) existing.remove();

    const hud = document.createElement('div');
    hud.id = 'battle-hud';
    hud.innerHTML = `
      <div class="battle-hud-bar">
        <span class="battle-hud-label">BATTLE IN PROGRESS</span>
        <span class="battle-hud-tick" id="battle-tick-display">0/${totalTicks}</span>
      </div>
      <div class="battle-progress-bar">
        <div class="battle-progress-fill" id="battle-progress-fill" style="width:0%"></div>
      </div>
    `;
    container.appendChild(hud);
  }

  function updateBattleHUD(tick, total) {
    const display = document.getElementById('battle-tick-display');
    if (display) display.textContent = `${tick}/${total}`;
    const fill = document.getElementById('battle-progress-fill');
    if (fill) fill.style.width = ((tick / total) * 100) + '%';
  }

  function renderBattleTick(tickData) {
    if (!tickData) return;
    const container = document.getElementById('village-3d-container');
    const battleGrp = container ? container._battleGroup : null;
    if (!battleGrp) return;

    // Update/create entity meshes
    const activeIds = new Set();
    for (const pos of tickData.positions) {
      activeIds.add(pos.id);
      let mesh = entityMeshes.get(pos.id);
      if (!mesh) {
        mesh = createEntityMesh(pos);
        battleGrp.add(mesh);
        entityMeshes.set(pos.id, mesh);
      }

      // Lerp position
      mesh.position.x += (pos.x - mesh.position.x) * 0.3;
      mesh.position.z += (pos.y - mesh.position.z) * 0.3;

      // Update HP bar
      const hpBar = mesh.getObjectByName('hpBarFill');
      if (hpBar) {
        const pct = Math.max(0, pos.hp / pos.maxHp);
        hpBar.scale.x = pct;
        hpBar.material.color.setHex(pct > 0.5 ? 0x22ff44 : pct > 0.25 ? 0xffaa00 : 0xff2222);
      }
    }

    // Remove dead entities (not in positions anymore)
    for (const [id, mesh] of entityMeshes) {
      if (!activeIds.has(id) && !id.startsWith('deploy_')) {
        // Death animation: scale to 0
        mesh.scale.multiplyScalar(0.7);
        if (mesh.scale.x < 0.05) {
          battleGrp.remove(mesh);
          entityMeshes.delete(id);
        }
      }
    }

    // Render projectiles
    for (const proj of tickData.projectiles) {
      spawnProjectile(battleGrp, proj);
    }

    // Handle death events with effects
    for (const death of tickData.deaths) {
      if (death.type === 'building') {
        spawnBuildingDestroyEffect(battleGrp, death.x, death.y);
      } else {
        spawnDeathPuff(battleGrp, death.x, death.y);
      }
    }

    // Clean up old effects
    updateEffects(battleGrp);
  }

  function createEntityMesh(pos) {
    const isAttacker = pos.type === 'attacker';
    const color = isAttacker ? 0x44ff88 : 0xff4466;
    const emissive = isAttacker ? 0x22aa44 : 0xaa2233;

    const group = new THREE.Group();

    const geo = new THREE.CylinderGeometry(0.08, 0.07, 0.18, 6);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: 0.3
    });
    const body = new THREE.Mesh(geo, mat);
    body.position.y = 0.15;
    body.castShadow = true;
    group.add(body);

    // HP bar
    const barBg = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.03, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x333333 })
    );
    barBg.position.y = 0.4;
    barBg.name = 'hpBarBg';
    group.add(barBg);

    const barFill = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.03, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x22ff44 })
    );
    barFill.position.y = 0.4;
    barFill.name = 'hpBarFill';
    group.add(barFill);

    // Icon label
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 64;
    labelCanvas.height = 32;
    const lc = labelCanvas.getContext('2d');
    lc.font = '20px serif';
    lc.textAlign = 'center';
    lc.textBaseline = 'middle';
    lc.fillText(pos.icon || '?', 32, 16);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
    const label = new THREE.Sprite(labelMat);
    label.position.y = 0.5;
    label.scale.set(0.25, 0.12, 1);
    group.add(label);

    group.position.set(pos.x, 0, pos.y);
    return group;
  }

  function spawnProjectile(parent, proj) {
    const colorMap = {
      normal: 0xffaa00,
      aoe: 0xff4444,
      chain: 0x44ffaa
    };
    const color = colorMap[proj.color] || 0xffaa00;

    const geo = new THREE.SphereGeometry(0.06, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(proj.from.x, 0.5, proj.from.y);
    mesh.userData.target = new THREE.Vector3(proj.to.x, 0.3, proj.to.y);
    mesh.userData.life = 5; // ticks
    parent.add(mesh);
    projectileMeshes.push(mesh);
  }

  function spawnDeathPuff(parent, x, y) {
    const geo = new THREE.SphereGeometry(0.15, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.6
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.2, y);
    mesh.userData.life = 10;
    mesh.userData.isEffect = true;
    parent.add(mesh);
    effectMeshes.push(mesh);
  }

  function spawnBuildingDestroyEffect(parent, x, y) {
    // Expanding sphere + orange flash
    const geo = new THREE.SphereGeometry(0.3, 12, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff8844, transparent: true, opacity: 0.7
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.3, y);
    mesh.userData.life = 15;
    mesh.userData.isEffect = true;
    mesh.userData.expand = true;
    parent.add(mesh);
    effectMeshes.push(mesh);

    // Debris particles
    for (let i = 0; i < 5; i++) {
      const debrisGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const debrisMat = new THREE.MeshBasicMaterial({
        color: 0x888888, transparent: true, opacity: 0.8
      });
      const debris = new THREE.Mesh(debrisGeo, debrisMat);
      debris.position.set(x + (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.3, y + (Math.random() - 0.5) * 0.5);
      debris.userData.life = 12;
      debris.userData.isEffect = true;
      debris.userData.velocity = { x: (Math.random() - 0.5) * 0.05, y: 0.02 + Math.random() * 0.03, z: (Math.random() - 0.5) * 0.05 };
      parent.add(debris);
      effectMeshes.push(debris);
    }
  }

  function updateEffects(parent) {
    // Update projectiles
    projectileMeshes = projectileMeshes.filter(mesh => {
      if (!mesh.userData.target) { parent.remove(mesh); return false; }
      mesh.userData.life--;
      if (mesh.userData.life <= 0) { parent.remove(mesh); return false; }

      // Lerp toward target
      mesh.position.lerp(mesh.userData.target, 0.3);
      mesh.material.opacity *= 0.9;
      return true;
    });

    // Update effects
    effectMeshes = effectMeshes.filter(mesh => {
      mesh.userData.life--;
      if (mesh.userData.life <= 0) { parent.remove(mesh); return false; }

      mesh.material.opacity *= 0.88;
      if (mesh.userData.expand) {
        mesh.scale.multiplyScalar(1.08);
      }
      if (mesh.userData.velocity) {
        mesh.position.x += mesh.userData.velocity.x;
        mesh.position.y += mesh.userData.velocity.y;
        mesh.position.z += mesh.userData.velocity.z;
        mesh.userData.velocity.y -= 0.003; // gravity
      }
      return true;
    });
  }

  function clearBattleMeshes() {
    const container = document.getElementById('village-3d-container');
    const battleGrp = container ? container._battleGroup : null;
    if (battleGrp) {
      // Remove all entity meshes
      for (const [id, mesh] of entityMeshes) {
        battleGrp.remove(mesh);
      }
      entityMeshes.clear();
      // Remove projectiles
      for (const mesh of projectileMeshes) battleGrp.remove(mesh);
      projectileMeshes = [];
      // Remove effects
      for (const mesh of effectMeshes) battleGrp.remove(mesh);
      effectMeshes = [];
    }
  }

  // ===== Results Overlay =====
  function showResults(result) {
    const container = document.getElementById('village-3d-container');
    if (!container) return;

    // Remove battle HUD
    const hud = container.querySelector('#battle-hud');
    if (hud) hud.remove();

    const starHtml = Array(3).fill(0).map((_, i) =>
      `<span class="result-star ${i < result.stars ? 'earned' : ''}">${i < result.stars ? '⭐' : '☆'}</span>`
    ).join('');

    const won = result.result === 'win';
    let lossHtml = '';
    if (Object.keys(result.troopLosses).length > 0) {
      const losses = Object.entries(result.troopLosses).map(([id, count]) => {
        const def = VillageData.TROOPS[id];
        return `${count} ${def ? def.name : id}`;
      }).join(', ');
      lossHtml = `<div class="result-losses">Lost: ${losses}</div>`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'battle-results';
    overlay.innerHTML = `
      <div class="result-content">
        <div class="result-stars">${starHtml}</div>
        <h2 class="result-title" style="color:${won ? '#2ee67a' : '#ff4455'}">${won ? 'VICTORY' : 'DEFEAT'}</h2>
        <div class="result-destruction">${Math.floor(result.destructionPct * 100)}% Destroyed</div>
        ${won ? `<div class="result-loot">
          <span class="loot-item">+${result.loot.gold} ●</span>
          <span class="loot-item">+${result.loot.wood} ▪</span>
          <span class="loot-item">+${result.loot.stone} ■</span>
        </div>` : ''}
        ${lossHtml}
        <button class="btn-pixel result-return-btn" id="battle-return-btn">Return to Village</button>
      </div>
    `;
    container.appendChild(overlay);

    // Wire return button
    const returnBtn = document.getElementById('battle-return-btn');
    if (returnBtn) {
      returnBtn.addEventListener('click', () => {
        if (onBattleComplete) onBattleComplete(battleResult);
        cleanup();
      });
    }
  }

  // ===== Cleanup =====
  function cleanup() {
    active = false;
    stopDeployTimer();

    if (playbackTimer) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }

    clearBattleMeshes();

    // Remove all battle UI
    const container = document.getElementById('village-3d-container');
    if (container) {
      const tray = container.querySelector('#battle-deploy-tray');
      if (tray) tray.remove();
      const hud = container.querySelector('#battle-hud');
      if (hud) hud.remove();
      const results = container.querySelector('#battle-results');
      if (results) results.remove();

      // Remove battle group
      if (container._battleGroup && container._battleGroup.parent) {
        container._battleGroup.parent.remove(container._battleGroup);
      }
      container._battleGroup = null;
    }

    enemyVillage = null;
    deployedTroops = [];
    troopsToPlace = {};
    selectedDeployTroop = null;
    battleResult = null;
    onBattleComplete = null;
  }

  // Initialize battle group on scene (called from village.js)
  function initBattleGroup(scene) {
    const container = document.getElementById('village-3d-container');
    if (!container) return;

    const grp = new THREE.Group();
    grp.name = 'battle';
    scene.add(grp);
    container._battleGroup = grp;
  }

  function isActive() { return active; }
  function isDeploying() { return active && !playbackTimer && deployTimerInterval !== null; }
  function getEnemyVillage() { return enemyVillage; }

  return {
    searchForTarget,
    startDeploy,
    onDeployClick,
    beginBattle,
    cleanup,
    isActive,
    isDeploying,
    getEnemyVillage,
    estimateLoot,
    initBattleGroup
  };
})();
