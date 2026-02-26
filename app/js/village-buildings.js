// village-buildings.js — 3D model loading, caching, fallback geometry, level variants
// Depends on: THREE (global), THREE.GLTFLoader, VillageData

const VillageBuildings = (() => {
  console.log('[VillageBuildings] 3-tier system loaded');
  const loader = new THREE.GLTFLoader();
  const modelCache = new Map();   // id → THREE.Group (template)
  const loadPromises = new Map(); // id → Promise
  let loaded = false;

  // Sprite texture caches (2D sprite rendering — PNG → canvas → 3D fallback)
  const spriteTextureCache = new Map(); // "id_tN" → THREE.Texture
  const spriteLoadPromises = new Map(); // "id_tN" → Promise<THREE.Texture|null>
  const pngLoader = new THREE.TextureLoader();

  // Category accent colors for material overrides
  const CATEGORY_COLORS = {
    resource: 0x2ee67a,
    storage:  0x4488ff,
    defense:  0xff4455,
    military: 0xcc44ff,
    utility:  0xf5c542
  };

  // Building top-face colors from ISO_STYLES (used for fallback geometry)
  const BUILDING_COLORS = {
    nexus:            0xf5c542,
    data_mine:        0x2ee67a,
    code_forge:       0xe8753a,
    hashery:          0x7799bb,
    crypto_mint:      0xcc44ff,
    amplifier_node:   0x44ddee,
    data_vault:       0x4488ff,
    cache_array:      0x3366cc,
    quantum_safe:     0x6688cc,
    firewall:         0x8d6e52,
    turret_node:      0x778899,
    emp_tower:        0x33bbcc,
    honeypot:         0xdda030,
    killswitch_mine:  0xdd3344,
    barracks:         0x884466,
    training_ground:  0x8866cc,
    sniper_tower:     0x445566,
    plasma_turret:    0x553344,
    space_cannon:     0x334455,
    ion_beam:         0x335544,
    overclock_pylon:  0x44ddee,
    repair_drone_bay: 0x44aa66,
    beacon_tower:     0x5577aa,
    builder_hut:      0xaa8844
  };

  // Tier thresholds — same formula as 2D system (village-data.js line 674)
  function getBuildingTier(id, level) {
    const def = VillageData.BUILDINGS[id];
    const maxLv = def ? def.maxLevel : 10;
    if (maxLv <= 1) return 1;
    if (level <= Math.ceil(maxLv * 0.3)) return 1;
    if (level <= Math.ceil(maxLv * 0.6)) return 2;
    return 3;
  }

  // Fixed heights per tier [tier1, tier2, tier3] — all tiers are substantial
  const TIER_HEIGHTS = {
    nexus:            [1.8, 2.5, 3.3],
    data_mine:        [0.9, 1.3, 1.8],
    code_forge:       [1.0, 1.4, 1.9],
    hashery:          [0.9, 1.3, 1.7],
    crypto_mint:      [1.4, 1.9, 2.5],
    amplifier_node:   [0.8, 1.2, 1.6],
    data_vault:       [1.1, 1.5, 2.0],
    cache_array:      [1.0, 1.4, 1.8],
    quantum_safe:     [1.2, 1.6, 2.1],
    firewall:         [0.7, 0.7, 0.7],
    turret_node:      [1.2, 1.7, 2.3],
    emp_tower:        [1.4, 1.9, 2.5],
    honeypot:         [0.8, 1.2, 1.6],
    killswitch_mine:  [0.4, 0.6, 0.8],
    barracks:         [0.5, 0.55, 0.6],
    training_ground:  [1.0, 1.4, 1.9],
    sniper_tower:     [1.8, 2.5, 3.2],
    plasma_turret:    [1.2, 1.7, 2.2],
    space_cannon:     [1.4, 2.0, 2.7],
    ion_beam:         [1.5, 2.1, 2.8],
    overclock_pylon:  [0.9, 1.3, 1.7],
    repair_drone_bay: [1.0, 1.4, 1.9],
    beacon_tower:     [1.5, 2.0, 2.6],
    builder_hut:      [0.7, 0.7, 0.7]
  };

  // Tier color/material palettes
  const TIER_PALETTES = {
    1: { // Wooden — warm rustic
      body: 0x8d6e52,     // warm wood brown
      accent: 0xaa8844,   // lighter wood
      trim: 0x6e5520,     // dark wood
      glow: 0xff8833,     // torch/campfire orange
      glowIntensity: 0.2,
      metalness: 0.1, roughness: 0.85
    },
    2: { // Reinforced — industrial iron
      body: 0x556677,     // iron grey
      accent: 0x778899,   // lighter steel
      trim: 0x445566,     // dark iron
      glow: 0x88bbff,     // forge blue-white
      glowIntensity: 0.35,
      metalness: 0.5, roughness: 0.45
    },
    3: { // Energized — high-tech plasma
      body: 0x2a2a3e,     // dark tech metal
      accent: 0x4a4a6e,   // tech grey-purple
      trim: 0xf5c542,     // gold
      glow: 0x44eeff,     // electric cyan
      glowIntensity: 0.6,
      metalness: 0.7, roughness: 0.2
    }
  };

  function getBuildingHeight(id, level) {
    const tier = getBuildingTier(id, level);
    const heights = TIER_HEIGHTS[id] || [0.8, 1.2, 1.6];
    return heights[tier - 1];
  }

  // Attempt to load a .glb model; returns promise
  function loadModel(id) {
    if (loadPromises.has(id)) return loadPromises.get(id);

    const promise = new Promise((resolve) => {
      const url = `assets/models/${id}.glb`;
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          // Normalize: center on XZ, scale to fit grid size
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const def = VillageData.BUILDINGS[id];
          const targetSize = def ? def.size : 1;
          const maxDim = Math.max(size.x, size.z) || 1;
          const scale = (targetSize * 0.85) / maxDim;
          model.scale.setScalar(scale);

          // Center on origin
          model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

          // Enable shadows on all meshes
          model.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          modelCache.set(id, model);
          resolve(model);
        },
        undefined,
        () => {
          // Failed to load — resolve with null (will use fallback)
          resolve(null);
        }
      );
    });

    loadPromises.set(id, promise);
    return promise;
  }

  // Create fallback procedural geometry for a building
  function createFallbackGeometry(id, level) {
    const def = VillageData.BUILDINGS[id];
    const sz = def ? def.size : 1;
    const height = getBuildingHeight(id, level);
    const color = BUILDING_COLORS[id] || 0xff00ff;
    const category = def ? def.category : 'utility';
    const accent = CATEGORY_COLORS[category] || 0xffffff;
    const tier = getBuildingTier(id, level);
    const pal = TIER_PALETTES[tier];
    console.log(`[VillageBuildings] createFallback: ${id} lv${level} → tier ${tier}`);

    const group = new THREE.Group();

    // Barracks: open courtyard — skip the default solid box
    if (id === 'barracks') {
      createBarracksGeometry(group, level, sz, height, color, accent, tier);
      return group;
    }

    // Main body — box with tier-appropriate materials
    const bodyGeo = new THREE.BoxGeometry(sz * 0.85, height, sz * 0.85);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: pal.body,
      metalness: pal.metalness,
      roughness: pal.roughness
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    body.name = 'bodyMesh';
    group.add(body);

    // Roof accent — tier-colored
    const roofGeo = new THREE.BoxGeometry(sz * 0.9, 0.08, sz * 0.9);
    const roofMat = new THREE.MeshStandardMaterial({
      color: pal.accent,
      metalness: pal.metalness + 0.15,
      roughness: Math.max(0.1, pal.roughness - 0.2),
      emissive: pal.glow,
      emissiveIntensity: pal.glowIntensity * 0.5
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = height + 0.04;
    roof.castShadow = true;
    roof.name = 'roofMesh';
    group.add(roof);

    // Vertical edge trims (4 corners) — tier-styled
    const trimMat = new THREE.MeshStandardMaterial({
      color: pal.trim,
      metalness: pal.metalness + 0.1,
      roughness: Math.max(0.1, pal.roughness - 0.1),
      emissive: pal.glow,
      emissiveIntensity: pal.glowIntensity * 0.3
    });
    const trimGeo = new THREE.BoxGeometry(0.04, height, 0.04);
    const halfSz = sz * 0.425;
    const offsets = [
      [-halfSz, -halfSz], [-halfSz, halfSz],
      [halfSz, -halfSz], [halfSz, halfSz]
    ];
    for (const [ox, oz] of offsets) {
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(ox, height / 2, oz);
      trim.castShadow = true;
      trim.name = 'trimMesh';
      group.add(trim);
    }

    // Special details per building type
    addBuildingDetails(group, id, level, sz, height, color, accent, tier);

    return group;
  }

  // ===== Barracks: Open Courtyard with visible troops =====
  function createBarracksGeometry(group, level, sz, height, color, accent, tier) {
    const halfSz = sz * 0.42;
    const pal = TIER_PALETTES[tier];

    // Ground platform
    const floorColor = tier === 1 ? 0x5a4a30 : tier === 2 ? 0x3a3a4a : 0x1a1a2e;
    const floorGeo = new THREE.BoxGeometry(sz * 0.88, 0.06, sz * 0.88);
    const floorMat = new THREE.MeshStandardMaterial({
      color: floorColor, metalness: pal.metalness * 0.5, roughness: pal.roughness
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = 0.03;
    floor.receiveShadow = true;
    group.add(floor);

    // Inner floor
    const innerColor = tier === 1 ? 0x6e5a3a : tier === 2 ? 0x4a4a5a : 0x2a2a3e;
    const innerFloorGeo = new THREE.BoxGeometry(sz * 0.72, 0.065, sz * 0.72);
    const innerFloorMat = new THREE.MeshStandardMaterial({
      color: innerColor, metalness: pal.metalness * 0.4, roughness: pal.roughness
    });
    const innerFloor = new THREE.Mesh(innerFloorGeo, innerFloorMat);
    innerFloor.position.y = 0.033;
    innerFloor.receiveShadow = true;
    group.add(innerFloor);

    // Wall height and materials vary by tier
    const wallH = tier === 1 ? 0.22 : tier === 2 ? 0.28 : 0.32;
    const wallColor = tier === 1 ? 0x8d6e52 : tier === 2 ? 0x556677 : 0x2a2a3e;
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColor, metalness: pal.metalness, roughness: pal.roughness
    });

    // Back wall
    const backWallGeo = new THREE.BoxGeometry(sz * 0.88, wallH, 0.06);
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, wallH / 2, -halfSz);
    backWall.castShadow = true;
    group.add(backWall);

    // Side walls
    const sideWallGeo = new THREE.BoxGeometry(0.06, wallH, sz * 0.88);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.position.set(-halfSz, wallH / 2, 0);
    leftWall.castShadow = true;
    group.add(leftWall);
    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.position.set(halfSz, wallH / 2, 0);
    rightWall.castShadow = true;
    group.add(rightWall);

    // Front wall — two half-walls with gap
    const frontHalfGeo = new THREE.BoxGeometry(sz * 0.3, wallH, 0.06);
    const frontLeft = new THREE.Mesh(frontHalfGeo, wallMat);
    frontLeft.position.set(-halfSz + sz * 0.15, wallH / 2, halfSz);
    frontLeft.castShadow = true;
    group.add(frontLeft);
    const frontRight = new THREE.Mesh(frontHalfGeo, wallMat);
    frontRight.position.set(halfSz - sz * 0.15, wallH / 2, halfSz);
    frontRight.castShadow = true;
    group.add(frontRight);

    // Corner posts — style varies by tier
    const postH = wallH + 0.2;
    const postColor = tier === 1 ? 0x6e5520 : tier === 2 ? 0x778899 : 0xf5c542;
    const postGlow = tier === 1 ? 0xff8833 : tier === 2 ? 0x88bbff : 0x44eeff;
    const postGeo = new THREE.BoxGeometry(0.08, postH, 0.08);
    const postMat = new THREE.MeshStandardMaterial({
      color: postColor, metalness: pal.metalness + 0.1, roughness: pal.roughness - 0.1,
      emissive: postGlow, emissiveIntensity: pal.glowIntensity * 0.5
    });
    const corners = [
      [-halfSz, -halfSz], [-halfSz, halfSz],
      [halfSz, -halfSz], [halfSz, halfSz]
    ];
    for (const [cx, cz] of corners) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(cx, postH / 2, cz);
      post.castShadow = true;
      post.name = 'accentMesh';
      group.add(post);

      // Orb on top — tier-styled
      const orbGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const orbMat = new THREE.MeshStandardMaterial({
        color: postGlow, emissive: postGlow, emissiveIntensity: pal.glowIntensity
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(cx, postH + 0.04, cz);
      group.add(orb);
    }

    // Banner pole
    const poleH = 0.8;
    const poleColor = tier === 1 ? 0x6e5520 : tier === 2 ? 0x556677 : 0xf5c542;
    const poleGeo = new THREE.CylinderGeometry(0.015, 0.015, poleH, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: poleColor, roughness: pal.roughness });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(-halfSz + 0.15, poleH / 2, -halfSz + 0.15);
    pole.castShadow = true;
    group.add(pole);

    // Banner flag
    const flagColor = tier === 1 ? 0xaa4422 : tier === 2 ? accent : 0xf5c542;
    const flagGeo = new THREE.BoxGeometry(0.2, 0.15, 0.01);
    const flagMat = new THREE.MeshStandardMaterial({
      color: flagColor, emissive: flagColor, emissiveIntensity: pal.glowIntensity * 0.5,
      metalness: pal.metalness, roughness: pal.roughness
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(-halfSz + 0.25, poleH - 0.1, -halfSz + 0.15);
    flag.castShadow = true;
    group.add(flag);

    // Tier-specific interior details
    if (tier === 1) {
      // Campfire in center
      const fireBaseGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.04, 8);
      const fireBaseMat = new THREE.MeshStandardMaterial({ color: 0x555544, roughness: 0.9 });
      const fireBase = new THREE.Mesh(fireBaseGeo, fireBaseMat);
      fireBase.position.y = 0.08;
      group.add(fireBase);
      const flameGeo = new THREE.ConeGeometry(0.05, 0.12, 6);
      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xff6622, emissive: 0xff6622, emissiveIntensity: 0.6
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 0.16;
      group.add(flame);

      // Simple tent
      const tentGeo = new THREE.BoxGeometry(sz * 0.35, 0.03, sz * 0.25);
      const tentMat = new THREE.MeshStandardMaterial({ color: 0x8d6e52, roughness: 0.85 });
      const tent = new THREE.Mesh(tentGeo, tentMat);
      tent.position.set(halfSz * 0.3, wallH + 0.18, -halfSz + sz * 0.15);
      tent.rotation.x = -0.15;
      tent.castShadow = true;
      group.add(tent);
    } else if (tier === 2) {
      // Armory tent (iron-colored)
      const tentGeo = new THREE.BoxGeometry(sz * 0.35, 0.04, sz * 0.25);
      const tentMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.4, roughness: 0.5 });
      const tent = new THREE.Mesh(tentGeo, tentMat);
      tent.position.set(halfSz * 0.3, wallH + 0.22, -halfSz + sz * 0.15);
      tent.rotation.x = -0.15;
      tent.castShadow = true;
      group.add(tent);

      // Weapon rack
      const rackGeo = new THREE.BoxGeometry(0.18, 0.2, 0.04);
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.5, roughness: 0.4 });
      const rack = new THREE.Mesh(rackGeo, rackMat);
      rack.position.set(-halfSz + 0.2, 0.16, halfSz * 0.3);
      rack.castShadow = true;
      group.add(rack);

      // Second banner (opposite corner)
      const pole2 = new THREE.Mesh(poleGeo, poleMat);
      pole2.position.set(halfSz - 0.15, poleH / 2, -halfSz + 0.15);
      pole2.castShadow = true;
      group.add(pole2);
    } else {
      // Tier 3: plasma torches at entrance
      const torchPositions = [[-sz * 0.14, halfSz], [sz * 0.14, halfSz]];
      for (const [tx, tz] of torchPositions) {
        const torchGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6);
        const torchMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, metalness: 0.7, roughness: 0.2 });
        const torch = new THREE.Mesh(torchGeo, torchMat);
        torch.position.set(tx, 0.24, tz);
        torch.castShadow = true;
        group.add(torch);
        const flameGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const flameMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.7
        });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(tx, 0.44, tz);
        group.add(flame);
      }

      // Energy barrier shimmer at gate
      const barrierGeo = new THREE.BoxGeometry(sz * 0.24, wallH * 0.8, 0.02);
      const barrierMat = new THREE.MeshStandardMaterial({
        color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.4,
        transparent: true, opacity: 0.25
      });
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(0, wallH * 0.4, halfSz);
      group.add(barrier);

      // Watchtower on back-right corner
      const towerGeo = new THREE.BoxGeometry(0.15, 0.3, 0.15);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, metalness: 0.7, roughness: 0.2 });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(halfSz - 0.08, wallH + 0.15, -halfSz + 0.08);
      tower.castShadow = true;
      group.add(tower);

      // Gold-trimmed second banner
      const pole2Geo = new THREE.CylinderGeometry(0.018, 0.018, poleH, 6);
      const pole2Mat = new THREE.MeshStandardMaterial({
        color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.2, metalness: 0.8, roughness: 0.15
      });
      const pole2 = new THREE.Mesh(pole2Geo, pole2Mat);
      pole2.position.set(halfSz - 0.15, poleH / 2, -halfSz + 0.15);
      pole2.castShadow = true;
      group.add(pole2);
      const flag2 = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({
        color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.15
      }));
      flag2.position.set(halfSz - 0.05, poleH - 0.1, -halfSz + 0.15);
      flag2.castShadow = true;
      group.add(flag2);
    }

    // Troop container group (populated dynamically in syncBuildings)
    const troopContainer = new THREE.Group();
    troopContainer.name = 'troopContainer';
    group.add(troopContainer);

    // Place initial placeholder troops
    populateBarracksTroops(troopContainer, Math.min(8, level + 1), sz);
  }

  // Populate troop figures inside a barracks courtyard
  function populateBarracksTroops(container, count, sz) {
    // Clear existing
    while (container.children.length > 0) {
      container.remove(container.children[0]);
    }

    const troopColors = [0xcc44ff, 0xaa55ee, 0xbb33dd, 0xdd55ff, 0x9944cc];
    const halfSz = sz * 0.32; // area inside the walls

    for (let i = 0; i < count; i++) {
      const figGroup = new THREE.Group();

      // Body (cylinder, r135 has no CapsuleGeometry)
      const bodyGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.14, 6);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: troopColors[i % troopColors.length],
        emissive: troopColors[i % troopColors.length],
        emissiveIntensity: 0.15,
        metalness: 0.3,
        roughness: 0.6
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.12;
      body.castShadow = true;
      figGroup.add(body);

      // Head sphere
      const headGeo = new THREE.SphereGeometry(0.035, 8, 6);
      const headMat = new THREE.MeshStandardMaterial({
        color: 0xddbbdd, metalness: 0.2, roughness: 0.7
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 0.24;
      head.castShadow = true;
      figGroup.add(head);

      // Tiny weapon (stick) — thin box
      const wpnGeo = new THREE.BoxGeometry(0.015, 0.1, 0.015);
      const wpnMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.6, roughness: 0.3 });
      const wpn = new THREE.Mesh(wpnGeo, wpnMat);
      wpn.position.set(0.05, 0.14, 0);
      wpn.rotation.z = -0.3;
      figGroup.add(wpn);

      // Distribute troops in a loose grid inside the courtyard
      const cols = Math.ceil(Math.sqrt(count));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const spacing = (halfSz * 2) / Math.max(cols, 1);
      const fx = -halfSz + spacing * 0.5 + col * spacing + (Math.random() - 0.5) * spacing * 0.3;
      const fz = -halfSz + spacing * 0.5 + row * spacing + (Math.random() - 0.5) * spacing * 0.3;

      figGroup.position.set(fx, 0.06, fz);
      // Random facing direction
      figGroup.rotation.y = Math.random() * Math.PI * 2;

      container.add(figGroup);
    }
  }

  function addBuildingDetails(group, id, level, sz, height, color, accent, tier) {
    const pal = TIER_PALETTES[tier];
  
    // ===== 1. NEXUS (3x3, utility) =====
    if (id === 'nexus') {
      if (tier === 1) {
        // Wooden pedestal
        const pedestalGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 8);
        const pedestalMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
        pedestal.position.y = height + 0.175;
        pedestal.castShadow = true;
        group.add(pedestal);
  
        // Warm glowing lantern sphere on top
        const lanternGeo = new THREE.SphereGeometry(0.12, 10, 10);
        const lanternMat = new THREE.MeshStandardMaterial({
          color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.4,
          metalness: 0.1, roughness: 0.5
        });
        const lantern = new THREE.Mesh(lanternGeo, lanternMat);
        lantern.position.y = height + 0.42;
        lantern.castShadow = true;
        group.add(lantern);
  
        // Rope detail boxes at base (4 around pedestal)
        const ropeMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.0, roughness: 0.95
        });
        for (let i = 0; i < 4; i++) {
          const ropeGeo = new THREE.BoxGeometry(0.04, 0.12, 0.18);
          const rope = new THREE.Mesh(ropeGeo, ropeMat);
          const angle = (i / 4) * Math.PI * 2;
          rope.position.set(
            Math.cos(angle) * 0.22,
            height + 0.08,
            Math.sin(angle) * 0.22
          );
          rope.rotation.y = angle;
          rope.castShadow = true;
          group.add(rope);
        }
      } else if (tier === 2) {
        // Iron-bound pillar
        const pillarGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8);
        const pillarMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.y = height + 0.25;
        pillar.castShadow = true;
        group.add(pillar);
  
        // Crystal begins forming
        const crystalGeo = new THREE.OctahedronGeometry(0.1, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
          color: 0xaaddff, emissive: 0xaaddff, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.85, metalness: 0.6, roughness: 0.2
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.y = height + 0.58;
        crystal.castShadow = true;
        group.add(crystal);
  
        // Forge-blue glow sphere
        const glowGeo = new THREE.SphereGeometry(0.2, 12, 12);
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.35,
          transparent: true, opacity: 0.2
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = height + 0.55;
        group.add(glow);
      } else {
        // Tier 3: Dark metal fortress pillar
        const pillarGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.6, 8);
        const pillarMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.y = height + 0.3;
        pillar.castShadow = true;
        group.add(pillar);
  
        // Blazing crystal
        const crystalGeo = new THREE.OctahedronGeometry(0.15, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
          color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7,
          transparent: true, opacity: 0.9, metalness: 0.8, roughness: 0.1
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.y = height + 0.72;
        crystal.castShadow = true;
        group.add(crystal);
  
        // Gold orbiting shards (3)
        for (let i = 0; i < 3; i++) {
          const shardGeo = new THREE.OctahedronGeometry(0.05, 0);
          const shardMat = new THREE.MeshStandardMaterial({
            color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.4,
            metalness: 0.8, roughness: 0.15
          });
          const shard = new THREE.Mesh(shardGeo, shardMat);
          const angle = (i / 3) * Math.PI * 2;
          shard.position.set(
            Math.cos(angle) * 0.25,
            height + 0.65,
            Math.sin(angle) * 0.25
          );
          shard.castShadow = true;
          group.add(shard);
        }
  
        // Electric arc torus
        const torusGeo = new THREE.TorusGeometry(0.3, 0.02, 8, 24);
        const torusMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.6,
          transparent: true, opacity: 0.7
        });
        const torus = new THREE.Mesh(torusGeo, torusMat);
        torus.position.y = height + 0.5;
        torus.rotation.x = Math.PI / 2;
        group.add(torus);
      }
    }
  
    // ===== 2. DATA_MINE (1x1, resource) =====
    if (id === 'data_mine') {
      if (tier === 1) {
        // Wooden mineshaft frame: 2 posts + crossbeam
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const postGeo = new THREE.BoxGeometry(0.06, 0.45, 0.06);
        const postL = new THREE.Mesh(postGeo, postMat);
        postL.position.set(-0.15, height + 0.225, 0);
        postL.castShadow = true;
        group.add(postL);
  
        const postR = new THREE.Mesh(postGeo, postMat);
        postR.position.set(0.15, height + 0.225, 0);
        postR.castShadow = true;
        group.add(postR);
  
        // Crossbeam
        const beamGeo = new THREE.BoxGeometry(0.36, 0.05, 0.06);
        const beam = new THREE.Mesh(beamGeo, postMat);
        beam.position.set(0, height + 0.46, 0);
        beam.castShadow = true;
        group.add(beam);
  
        // Pickaxe (thin box angled)
        const pickGeo = new THREE.BoxGeometry(0.03, 0.25, 0.03);
        const pickMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.2, roughness: 0.8
        });
        const pick = new THREE.Mesh(pickGeo, pickMat);
        pick.position.set(0.22, height + 0.15, 0.15);
        pick.rotation.z = 0.5;
        pick.castShadow = true;
        group.add(pick);
  
        // Dirt pile (flattened sphere)
        const dirtGeo = new THREE.SphereGeometry(0.12, 8, 6);
        const dirtMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.0, roughness: 0.95
        });
        const dirt = new THREE.Mesh(dirtGeo, dirtMat);
        dirt.position.set(-0.12, height + 0.04, 0.2);
        dirt.scale.set(1, 0.4, 1);
        dirt.castShadow = true;
        group.add(dirt);
  
        // Lantern sphere
        const lanternGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const lanternMat = new THREE.MeshStandardMaterial({
          color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.4,
          metalness: 0.1, roughness: 0.5
        });
        const lantern = new THREE.Mesh(lanternGeo, lanternMat);
        lantern.position.set(0, height + 0.5, 0);
        group.add(lantern);
      } else if (tier === 2) {
        // Iron rail scaffold: 4 posts
        const ironMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const postGeo = new THREE.BoxGeometry(0.05, 0.5, 0.05);
        const corners = [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]];
        for (const [cx, cz] of corners) {
          const post = new THREE.Mesh(postGeo, ironMat);
          post.position.set(cx, height + 0.25, cz);
          post.castShadow = true;
          group.add(post);
        }
  
        // Ore cart (small box)
        const cartGeo = new THREE.BoxGeometry(0.14, 0.08, 0.1);
        const cartMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.45, roughness: 0.5
        });
        const cart = new THREE.Mesh(cartGeo, cartMat);
        cart.position.set(0, height + 0.06, 0);
        cart.castShadow = true;
        group.add(cart);
  
        // Reinforced beam boxes (2 horizontal)
        const beamGeo = new THREE.BoxGeometry(0.42, 0.04, 0.05);
        for (let i = 0; i < 2; i++) {
          const beam = new THREE.Mesh(beamGeo, ironMat);
          beam.position.set(0, height + 0.2 + i * 0.25, i === 0 ? -0.18 : 0.18);
          beam.castShadow = true;
          group.add(beam);
        }
      } else {
        // Tier 3: Drill rig cylinder on top
        const drillGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.35, 8);
        const drillMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const drill = new THREE.Mesh(drillGeo, drillMat);
        drill.position.y = height + 0.175;
        drill.castShadow = true;
        group.add(drill);
  
        // Plasma-lit vein lines (thin boxes)
        const veinMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5
        });
        for (let i = 0; i < 3; i++) {
          const veinGeo = new THREE.BoxGeometry(0.35, 0.02, 0.02);
          const vein = new THREE.Mesh(veinGeo, veinMat);
          vein.position.set(0, height * 0.3 + i * 0.2, sz * 0.43);
          vein.castShadow = true;
          group.add(vein);
        }
  
        // Conveyor glow torus
        const torusGeo = new THREE.TorusGeometry(0.15, 0.02, 8, 16);
        const torusMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.6
        });
        const torus = new THREE.Mesh(torusGeo, torusMat);
        torus.position.y = height + 0.4;
        torus.rotation.x = Math.PI / 2;
        group.add(torus);
  
        // Gold ore sparks (small spheres)
        for (let i = 0; i < 3; i++) {
          const sparkGeo = new THREE.SphereGeometry(0.03, 6, 6);
          const sparkMat = new THREE.MeshStandardMaterial({
            color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.5,
            metalness: 0.8, roughness: 0.15
          });
          const spark = new THREE.Mesh(sparkGeo, sparkMat);
          const a = (i / 3) * Math.PI * 2;
          spark.position.set(
            Math.cos(a) * 0.12,
            height + 0.15 + i * 0.08,
            Math.sin(a) * 0.12
          );
          group.add(spark);
        }
      }
    }
  
    // ===== 3. CODE_FORGE (1x1, resource) =====
    if (id === 'code_forge') {
      if (tier === 1) {
        // Stone hearth box
        const hearthGeo = new THREE.BoxGeometry(0.35, 0.2, 0.35);
        const hearthMat = new THREE.MeshStandardMaterial({
          color: 0x777777, metalness: 0.15, roughness: 0.9
        });
        const hearth = new THREE.Mesh(hearthGeo, hearthMat);
        hearth.position.set(0, height + 0.1, 0);
        hearth.castShadow = true;
        group.add(hearth);
  
        // Wooden anvil box
        const anvilGeo = new THREE.BoxGeometry(0.15, 0.1, 0.1);
        const anvilMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.1, roughness: 0.85
        });
        const anvil = new THREE.Mesh(anvilGeo, anvilMat);
        anvil.position.set(0.12, height + 0.25, 0);
        anvil.castShadow = true;
        group.add(anvil);
  
        // Campfire ember glow sphere
        const emberGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const emberMat = new THREE.MeshStandardMaterial({
          color: 0xff6622, emissive: 0xff6622, emissiveIntensity: 0.4,
          metalness: 0.0, roughness: 0.5
        });
        const ember = new THREE.Mesh(emberGeo, emberMat);
        ember.position.set(-0.05, height + 0.28, 0.05);
        group.add(ember);
      } else if (tier === 2) {
        // Iron forge box
        const forgeGeo = new THREE.BoxGeometry(0.38, 0.25, 0.38);
        const forgeMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const forge = new THREE.Mesh(forgeGeo, forgeMat);
        forge.position.set(0, height + 0.125, 0);
        forge.castShadow = true;
        group.add(forge);
  
        // Metal chimney cylinder
        const chimneyGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.3, 6);
        const chimneyMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
        chimney.position.set(-0.1, height + 0.4, -0.1);
        chimney.castShadow = true;
        group.add(chimney);
  
        // Hammer box detail
        const hammerGeo = new THREE.BoxGeometry(0.04, 0.18, 0.04);
        const hammerMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const hammer = new THREE.Mesh(hammerGeo, hammerMat);
        hammer.position.set(0.18, height + 0.3, 0.05);
        hammer.rotation.z = -0.4;
        hammer.castShadow = true;
        group.add(hammer);
  
        // Blue-hot coals sphere
        const coalsGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const coalsMat = new THREE.MeshStandardMaterial({
          color: 0x4488ff, emissive: 0x4488ff, emissiveIntensity: 0.4
        });
        const coals = new THREE.Mesh(coalsGeo, coalsMat);
        coals.position.set(0, height + 0.3, 0);
        group.add(coals);
      } else {
        // Tier 3: Plasma forge
        const forgeGeo = new THREE.BoxGeometry(0.4, 0.28, 0.4);
        const forgeMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const forge = new THREE.Mesh(forgeGeo, forgeMat);
        forge.position.set(0, height + 0.14, 0);
        forge.castShadow = true;
        group.add(forge);
  
        // Energy anvil
        const anvilGeo = new THREE.BoxGeometry(0.18, 0.12, 0.12);
        const anvilMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.4,
          metalness: 0.6, roughness: 0.2
        });
        const anvil = new THREE.Mesh(anvilGeo, anvilMat);
        anvil.position.set(0.08, height + 0.34, 0);
        anvil.castShadow = true;
        group.add(anvil);
  
        // Electric spark small spheres (3)
        for (let i = 0; i < 3; i++) {
          const sparkGeo = new THREE.SphereGeometry(0.025, 6, 6);
          const sparkMat = new THREE.MeshStandardMaterial({
            color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.6
          });
          const spark = new THREE.Mesh(sparkGeo, sparkMat);
          const a = (i / 3) * Math.PI * 2;
          spark.position.set(
            Math.cos(a) * 0.1,
            height + 0.42,
            Math.sin(a) * 0.1
          );
          group.add(spark);
        }
  
        // Gold-tipped tool boxes (2 tools)
        const toolMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.2,
          metalness: 0.8, roughness: 0.15
        });
        for (let i = 0; i < 2; i++) {
          const toolGeo = new THREE.BoxGeometry(0.03, 0.14, 0.03);
          const tool = new THREE.Mesh(toolGeo, toolMat);
          tool.position.set(
            -0.12 + i * 0.24,
            height + 0.35,
            0.15
          );
          tool.rotation.z = -0.3 + i * 0.6;
          tool.castShadow = true;
          group.add(tool);
        }
      }
    }
  
    // ===== 4. HASHERY (1x1, resource) =====
    if (id === 'hashery') {
      if (tier === 1) {
        // Wooden water wheel (torus)
        const wheelGeo = new THREE.TorusGeometry(0.14, 0.025, 8, 16);
        const wheelMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(0.2, height + 0.2, 0);
        wheel.rotation.y = Math.PI / 2;
        wheel.castShadow = true;
        group.add(wheel);
  
        // Stone grinding bowl (cylinder)
        const bowlGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.08, 10);
        const bowlMat = new THREE.MeshStandardMaterial({
          color: 0x888888, metalness: 0.15, roughness: 0.85
        });
        const bowl = new THREE.Mesh(bowlGeo, bowlMat);
        bowl.position.set(-0.05, height + 0.04, 0.05);
        bowl.castShadow = true;
        group.add(bowl);
      } else if (tier === 2) {
        // Iron gear mechanism (thicker torus)
        const gearGeo = new THREE.TorusGeometry(0.16, 0.035, 8, 16);
        const gearMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const gear = new THREE.Mesh(gearGeo, gearMat);
        gear.position.set(0, height + 0.25, 0);
        gear.rotation.x = Math.PI / 4;
        gear.castShadow = true;
        group.add(gear);
  
        // Pipe system (2 cylinders)
        const pipeMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.45, roughness: 0.5
        });
        const pipe1Geo = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 6);
        const pipe1 = new THREE.Mesh(pipe1Geo, pipeMat);
        pipe1.position.set(0.18, height + 0.15, 0.1);
        pipe1.castShadow = true;
        group.add(pipe1);
  
        const pipe2Geo = new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6);
        const pipe2 = new THREE.Mesh(pipe2Geo, pipeMat);
        pipe2.position.set(-0.15, height + 0.12, -0.1);
        pipe2.rotation.z = Math.PI / 3;
        pipe2.castShadow = true;
        group.add(pipe2);
  
        // Blue steam sphere (transparent)
        const steamGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const steamMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.2,
          transparent: true, opacity: 0.3
        });
        const steam = new THREE.Mesh(steamGeo, steamMat);
        steam.position.set(0.18, height + 0.35, 0.1);
        group.add(steam);
      } else {
        // Tier 3: Crystalline processor core
        const coreGeo = new THREE.OctahedronGeometry(0.12, 0);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.85, metalness: 0.7, roughness: 0.15
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = height + 0.3;
        core.castShadow = true;
        group.add(core);
  
        // Energy pipes (2 cylinders with glow)
        const pipeMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, emissive: 0x44eeff, emissiveIntensity: 0.15,
          metalness: 0.7, roughness: 0.2
        });
        for (let i = 0; i < 2; i++) {
          const pipeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6);
          const pipe = new THREE.Mesh(pipeGeo, pipeMat);
          pipe.position.set(
            i === 0 ? 0.18 : -0.18,
            height + 0.15,
            i === 0 ? 0.08 : -0.08
          );
          pipe.castShadow = true;
          group.add(pipe);
        }
  
        // Cyan circuit glow ring
        const ringGeo = new THREE.TorusGeometry(0.18, 0.015, 8, 24);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.6
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = height + 0.15;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
  
        // Floating data mote spheres (3)
        for (let i = 0; i < 3; i++) {
          const moteGeo = new THREE.SphereGeometry(0.025, 6, 6);
          const moteMat = new THREE.MeshStandardMaterial({
            color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.6
          });
          const mote = new THREE.Mesh(moteGeo, moteMat);
          const a = (i / 3) * Math.PI * 2;
          mote.position.set(
            Math.cos(a) * 0.14,
            height + 0.42 + Math.sin(a * 2) * 0.04,
            Math.sin(a) * 0.14
          );
          group.add(mote);
        }
      }
    }
  
    // ===== 5. CRYPTO_MINT (2x2, resource) =====
    if (id === 'crypto_mint') {
      if (tier === 1) {
        // Wooden treasure chest (body box + lid box angled)
        const chestMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const chestGeo = new THREE.BoxGeometry(0.35, 0.18, 0.22);
        const chest = new THREE.Mesh(chestGeo, chestMat);
        chest.position.set(0, height + 0.09, 0.1);
        chest.castShadow = true;
        group.add(chest);
  
        // Lid (angled open)
        const lidGeo = new THREE.BoxGeometry(0.35, 0.04, 0.22);
        const lid = new THREE.Mesh(lidGeo, chestMat);
        lid.position.set(0, height + 0.2, 0.0);
        lid.rotation.x = -0.35;
        lid.castShadow = true;
        group.add(lid);
  
        // Small gem
        const gemGeo = new THREE.OctahedronGeometry(0.04, 0);
        const gemMat = new THREE.MeshStandardMaterial({
          color: 0xcc44ff, emissive: 0xcc44ff, emissiveIntensity: 0.2,
          metalness: 0.6, roughness: 0.2
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.position.set(0, height + 0.24, 0.1);
        gem.castShadow = true;
        group.add(gem);
  
        // Torch post (cylinder + sphere)
        const postGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.35, 6);
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.1, roughness: 0.85
        });
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(0.3, height + 0.175, -0.2);
        post.castShadow = true;
        group.add(post);
  
        const flameGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const flameMat = new THREE.MeshStandardMaterial({
          color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.4
        });
        const flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(0.3, height + 0.38, -0.2);
        group.add(flame);
      } else if (tier === 2) {
        // Iron-bound vault box
        const vaultGeo = new THREE.BoxGeometry(0.5, 0.35, 0.4);
        const vaultMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const vault = new THREE.Mesh(vaultGeo, vaultMat);
        vault.position.set(0, height + 0.175, 0);
        vault.castShadow = true;
        group.add(vault);
  
        // Gem pedestal (cylinder + larger octahedron)
        const pedestalGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.15, 6);
        const pedestalMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
        pedestal.position.set(0, height + 0.42, 0);
        pedestal.castShadow = true;
        group.add(pedestal);
  
        const gemGeo = new THREE.OctahedronGeometry(0.07, 0);
        const gemMat = new THREE.MeshStandardMaterial({
          color: 0xcc44ff, emissive: 0xcc44ff, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.85, metalness: 0.6, roughness: 0.2
        });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.position.set(0, height + 0.55, 0);
        gem.castShadow = true;
        group.add(gem);
  
        // Blue key glow sphere
        const glowGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.6
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(0.28, height + 0.2, 0.2);
        group.add(glow);
      } else {
        // Tier 3: Plasma vault
        const vaultGeo = new THREE.BoxGeometry(0.55, 0.4, 0.45);
        const vaultMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const vault = new THREE.Mesh(vaultGeo, vaultMat);
        vault.position.set(0, height + 0.2, 0);
        vault.castShadow = true;
        group.add(vault);
  
        // Hovering gem crown (3 octahedrons orbiting)
        for (let i = 0; i < 3; i++) {
          const gemGeo = new THREE.OctahedronGeometry(0.06, 0);
          const gemMat = new THREE.MeshStandardMaterial({
            color: 0xcc44ff, emissive: 0xcc44ff, emissiveIntensity: 0.6,
            transparent: true, opacity: 0.9, metalness: 0.7, roughness: 0.15
          });
          const gem = new THREE.Mesh(gemGeo, gemMat);
          const a = (i / 3) * Math.PI * 2;
          gem.position.set(
            Math.cos(a) * 0.2,
            height + 0.55,
            Math.sin(a) * 0.2
          );
          gem.castShadow = true;
          group.add(gem);
        }
  
        // Energy shield ring
        const shieldGeo = new THREE.TorusGeometry(0.28, 0.02, 8, 24);
        const shieldMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.5
        });
        const shield = new THREE.Mesh(shieldGeo, shieldMat);
        shield.position.y = height + 0.5;
        shield.rotation.x = Math.PI / 2;
        group.add(shield);
  
        // Gold lightning arc boxes (2 thin)
        const arcMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.4,
          metalness: 0.8, roughness: 0.15
        });
        for (let i = 0; i < 2; i++) {
          const arcGeo = new THREE.BoxGeometry(0.02, 0.3, 0.02);
          const arc = new THREE.Mesh(arcGeo, arcMat);
          arc.position.set(
            i === 0 ? 0.22 : -0.22,
            height + 0.35,
            i === 0 ? 0.1 : -0.1
          );
          arc.rotation.z = i === 0 ? 0.25 : -0.25;
          arc.castShadow = true;
          group.add(arc);
        }
      }
    }
  
    // ===== 6. AMPLIFIER_NODE (1x1, utility) =====
    if (id === 'amplifier_node') {
      if (tier === 1) {
        // Wooden pole
        const poleGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.45, 6);
        const poleMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = height + 0.225;
        pole.castShadow = true;
        group.add(pole);
  
        // Copper wire coil (small torus)
        const coilGeo = new THREE.TorusGeometry(0.06, 0.015, 6, 12);
        const coilMat = new THREE.MeshStandardMaterial({
          color: 0xcc8844, metalness: 0.4, roughness: 0.5
        });
        const coil = new THREE.Mesh(coilGeo, coilMat);
        coil.position.y = height + 0.3;
        coil.rotation.x = Math.PI / 2;
        coil.castShadow = true;
        group.add(coil);
  
        // Lantern sphere on top
        const lanternGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const lanternMat = new THREE.MeshStandardMaterial({
          color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.4
        });
        const lantern = new THREE.Mesh(lanternGeo, lanternMat);
        lantern.position.y = height + 0.48;
        group.add(lantern);
      } else if (tier === 2) {
        // Iron tower cylinder
        const towerGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.5, 8);
        const towerMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = height + 0.25;
        tower.castShadow = true;
        group.add(tower);
  
        // Dish (flattened cone)
        const dishGeo = new THREE.ConeGeometry(0.12, 0.06, 8);
        const dishMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const dish = new THREE.Mesh(dishGeo, dishMat);
        dish.position.set(0.08, height + 0.4, 0);
        dish.rotation.z = -Math.PI / 4;
        dish.castShadow = true;
        group.add(dish);
  
        // Blue signal ring
        const ringGeo = new THREE.TorusGeometry(0.1, 0.015, 8, 16);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.6
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = height + 0.52;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
      } else {
        // Tier 3: Energy spire (cone)
        const spireGeo = new THREE.ConeGeometry(0.08, 0.55, 8);
        const spireMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.y = height + 0.275;
        spire.castShadow = true;
        group.add(spire);
  
        // 4 plasma dish cones around it
        const dishMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.3,
          metalness: 0.6, roughness: 0.2
        });
        for (let i = 0; i < 4; i++) {
          const dishGeo = new THREE.ConeGeometry(0.05, 0.04, 6);
          const dish = new THREE.Mesh(dishGeo, dishMat);
          const a = (i / 4) * Math.PI * 2;
          dish.position.set(
            Math.cos(a) * 0.18,
            height + 0.35,
            Math.sin(a) * 0.18
          );
          dish.rotation.z = Math.cos(a) * 0.5;
          dish.rotation.x = Math.sin(a) * 0.5;
          dish.castShadow = true;
          group.add(dish);
        }
  
        // Electric field ring
        const fieldGeo = new THREE.TorusGeometry(0.18, 0.015, 8, 24);
        const fieldMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.5
        });
        const field = new THREE.Mesh(fieldGeo, fieldMat);
        field.position.y = height + 0.35;
        field.rotation.x = Math.PI / 2;
        group.add(field);
  
        // Cyan pulse wave (large transparent sphere)
        const pulseGeo = new THREE.SphereGeometry(0.3, 12, 12);
        const pulseMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.1,
          transparent: true, opacity: 0.1
        });
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.position.y = height + 0.35;
        group.add(pulse);
      }
    }
  
    // ===== 7. DATA_VAULT (1x1, storage) =====
    if (id === 'data_vault') {
      if (tier === 1) {
        // Wooden door box on front face
        const doorGeo = new THREE.BoxGeometry(0.3, 0.4, 0.04);
        const doorMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, height * 0.45, sz * 0.43);
        door.castShadow = true;
        group.add(door);
  
        // Iron band boxes (2 thin strips)
        const bandMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.2, roughness: 0.8
        });
        for (let i = 0; i < 2; i++) {
          const bandGeo = new THREE.BoxGeometry(0.34, 0.03, 0.05);
          const band = new THREE.Mesh(bandGeo, bandMat);
          band.position.set(0, height * 0.3 + i * 0.25, sz * 0.44);
          band.castShadow = true;
          group.add(band);
        }
  
        // Padlock sphere
        const lockGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const lockMat = new THREE.MeshStandardMaterial({
          color: 0xaa8844, metalness: 0.4, roughness: 0.5
        });
        const lock = new THREE.Mesh(lockGeo, lockMat);
        lock.position.set(0, height * 0.4, sz * 0.46);
        lock.castShadow = true;
        group.add(lock);
      } else if (tier === 2) {
        // Reinforced steel door
        const doorGeo = new THREE.BoxGeometry(0.35, 0.5, 0.05);
        const doorMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, height * 0.45, sz * 0.43);
        door.castShadow = true;
        group.add(door);
  
        // Dial lock cylinder
        const dialGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12);
        const dialMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.6, roughness: 0.3
        });
        const dial = new THREE.Mesh(dialGeo, dialMat);
        dial.position.set(0.08, height * 0.45, sz * 0.46);
        dial.rotation.x = Math.PI / 2;
        dial.castShadow = true;
        group.add(dial);
  
        // Bolted edge boxes (4 small cubes)
        const boltMat = new THREE.MeshStandardMaterial({
          color: 0x445566, metalness: 0.5, roughness: 0.4
        });
        const boltPositions = [
          [-0.14, height * 0.25], [0.14, height * 0.25],
          [-0.14, height * 0.65], [0.14, height * 0.65]
        ];
        for (const [bx, by] of boltPositions) {
          const boltGeo = new THREE.BoxGeometry(0.035, 0.035, 0.035);
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          bolt.position.set(bx, by, sz * 0.44);
          bolt.castShadow = true;
          group.add(bolt);
        }
      } else {
        // Tier 3: Energy barrier door (transparent emissive)
        const barrierGeo = new THREE.BoxGeometry(0.35, 0.55, 0.03);
        const barrierMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.6, metalness: 0.3, roughness: 0.2
        });
        const barrier = new THREE.Mesh(barrierGeo, barrierMat);
        barrier.position.set(0, height * 0.45, sz * 0.43);
        group.add(barrier);
  
        // Plasma lock sphere
        const lockGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const lockMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.6,
          metalness: 0.6, roughness: 0.2
        });
        const lock = new THREE.Mesh(lockGeo, lockMat);
        lock.position.set(0, height * 0.45, sz * 0.47);
        group.add(lock);
  
        // Floating security drone spheres (2)
        const droneMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, emissive: 0x44eeff, emissiveIntensity: 0.15,
          metalness: 0.7, roughness: 0.2
        });
        for (let i = 0; i < 2; i++) {
          const droneGeo = new THREE.SphereGeometry(0.035, 8, 8);
          const drone = new THREE.Mesh(droneGeo, droneMat);
          drone.position.set(
            i === 0 ? -0.22 : 0.22,
            height + 0.15,
            0
          );
          drone.castShadow = true;
          group.add(drone);
        }
  
        // Gold frame glow boxes (4 edges)
        const frameMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.3,
          metalness: 0.8, roughness: 0.15
        });
        const frameEdges = [
          [0, height * 0.18, sz * 0.44, 0.38, 0.025, 0.025],
          [0, height * 0.72, sz * 0.44, 0.38, 0.025, 0.025],
          [-0.18, height * 0.45, sz * 0.44, 0.025, 0.55, 0.025],
          [0.18, height * 0.45, sz * 0.44, 0.025, 0.55, 0.025]
        ];
        for (const [fx, fy, fz, fw, fh, fd] of frameEdges) {
          const frameGeo = new THREE.BoxGeometry(fw, fh, fd);
          const frame = new THREE.Mesh(frameGeo, frameMat);
          frame.position.set(fx, fy, fz);
          frame.castShadow = true;
          group.add(frame);
        }
      }
    }
  
    // ===== 8. CACHE_ARRAY (1x1, storage) =====
    if (id === 'cache_array') {
      if (tier === 1) {
        // Wooden shelving boxes (3 horizontal thin boxes)
        const shelfMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        for (let i = 0; i < 3; i++) {
          const shelfGeo = new THREE.BoxGeometry(sz * 0.7, 0.025, sz * 0.5);
          const shelf = new THREE.Mesh(shelfGeo, shelfMat);
          shelf.position.set(0, height * 0.25 + i * (height * 0.3), 0);
          shelf.castShadow = true;
          group.add(shelf);
        }
  
        // Crate stack (2 small boxes)
        const crateMat = new THREE.MeshStandardMaterial({
          color: 0xaa8844, metalness: 0.15, roughness: 0.8
        });
        const crate1Geo = new THREE.BoxGeometry(0.12, 0.1, 0.1);
        const crate1 = new THREE.Mesh(crate1Geo, crateMat);
        crate1.position.set(0.08, height + 0.05, 0.08);
        crate1.castShadow = true;
        group.add(crate1);
  
        const crate2Geo = new THREE.BoxGeometry(0.1, 0.08, 0.1);
        const crate2 = new THREE.Mesh(crate2Geo, crateMat);
        crate2.position.set(0.06, height + 0.14, 0.08);
        crate2.castShadow = true;
        group.add(crate2);
  
        // Rope binding thin box
        const ropeGeo = new THREE.BoxGeometry(0.02, 0.12, 0.02);
        const ropeMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.0, roughness: 0.95
        });
        const rope = new THREE.Mesh(ropeGeo, ropeMat);
        rope.position.set(-0.15, height * 0.5, sz * 0.38);
        rope.castShadow = true;
        group.add(rope);
      } else if (tier === 2) {
        // Metal rack (3 thin boxes)
        const rackMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        for (let i = 0; i < 3; i++) {
          const rackGeo = new THREE.BoxGeometry(sz * 0.7, 0.02, sz * 0.5);
          const rack = new THREE.Mesh(rackGeo, rackMat);
          rack.position.set(0, height * 0.25 + i * (height * 0.3), 0);
          rack.castShadow = true;
          group.add(rack);
        }
  
        // Server boxes (2 boxes)
        const serverMat = new THREE.MeshStandardMaterial({
          color: 0x445566, metalness: 0.5, roughness: 0.4
        });
        for (let i = 0; i < 2; i++) {
          const serverGeo = new THREE.BoxGeometry(0.14, 0.12, 0.1);
          const server = new THREE.Mesh(serverGeo, serverMat);
          server.position.set(
            i === 0 ? -0.06 : 0.06,
            height + 0.06,
            i === 0 ? 0.05 : -0.05
          );
          server.castShadow = true;
          group.add(server);
        }
  
        // Blue status light spheres (2)
        for (let i = 0; i < 2; i++) {
          const lightGeo = new THREE.SphereGeometry(0.025, 6, 6);
          const lightMat = new THREE.MeshStandardMaterial({
            color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.5
          });
          const light = new THREE.Mesh(lightGeo, lightMat);
          light.position.set(
            i === 0 ? -0.06 : 0.06,
            height + 0.14,
            sz * 0.4
          );
          group.add(light);
        }
      } else {
        // Tier 3: Energy grid (3 thin boxes)
        const gridMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, emissive: 0x44eeff, emissiveIntensity: 0.1,
          metalness: 0.7, roughness: 0.2
        });
        for (let i = 0; i < 3; i++) {
          const gridGeo = new THREE.BoxGeometry(sz * 0.7, 0.02, sz * 0.5);
          const grid = new THREE.Mesh(gridGeo, gridMat);
          grid.position.set(0, height * 0.25 + i * (height * 0.3), 0);
          grid.castShadow = true;
          group.add(grid);
        }
  
        // Holographic data columns (2 transparent boxes)
        const holoMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.4, metalness: 0.3, roughness: 0.2
        });
        for (let i = 0; i < 2; i++) {
          const holoGeo = new THREE.BoxGeometry(0.08, height * 0.6, 0.08);
          const holo = new THREE.Mesh(holoGeo, holoMat);
          holo.position.set(
            i === 0 ? -0.1 : 0.1,
            height * 0.5,
            0
          );
          group.add(holo);
        }
  
        // Cyan light stream torus
        const streamGeo = new THREE.TorusGeometry(0.15, 0.012, 8, 20);
        const streamMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.5
        });
        const stream = new THREE.Mesh(streamGeo, streamMat);
        stream.position.y = height + 0.08;
        stream.rotation.x = Math.PI / 2;
        group.add(stream);
  
        // Gold frame boxes (4 vertical corners)
        const frameMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.25,
          metalness: 0.8, roughness: 0.15
        });
        const halfSz = sz * 0.38;
        const frameCorners = [
          [-halfSz, -halfSz], [-halfSz, halfSz],
          [halfSz, -halfSz], [halfSz, halfSz]
        ];
        for (const [fx, fz] of frameCorners) {
          const frameGeo = new THREE.BoxGeometry(0.025, height * 0.8, 0.025);
          const frame = new THREE.Mesh(frameGeo, frameMat);
          frame.position.set(fx, height * 0.5, fz);
          frame.castShadow = true;
          group.add(frame);
        }
      }
    }
  
    // ===== 9. QUANTUM_SAFE (1x1, storage) =====
    if (id === 'quantum_safe') {
      if (tier === 1) {
        // Wooden strongbox (slightly smaller than body)
        const boxGeo = new THREE.BoxGeometry(sz * 0.65, height * 0.7, sz * 0.65);
        const boxMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const strongbox = new THREE.Mesh(boxGeo, boxMat);
        strongbox.position.y = height * 0.35 + 0.02;
        strongbox.castShadow = true;
        group.add(strongbox);
  
        // Chain boxes (2 thin strips wrapping)
        const chainMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.2, roughness: 0.8
        });
        for (let i = 0; i < 2; i++) {
          const chainGeo = new THREE.BoxGeometry(sz * 0.7, 0.025, 0.025);
          const chain = new THREE.Mesh(chainGeo, chainMat);
          chain.position.set(0, height * 0.25 + i * height * 0.35, sz * 0.33);
          chain.castShadow = true;
          group.add(chain);
        }
  
        // Padlock sphere
        const lockGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const lockMat = new THREE.MeshStandardMaterial({
          color: 0xaa8844, metalness: 0.4, roughness: 0.5
        });
        const lock = new THREE.Mesh(lockGeo, lockMat);
        lock.position.set(0, height * 0.4, sz * 0.36);
        lock.castShadow = true;
        group.add(lock);
      } else if (tier === 2) {
        // Iron safe box
        const safeGeo = new THREE.BoxGeometry(sz * 0.68, height * 0.75, sz * 0.68);
        const safeMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const safe = new THREE.Mesh(safeGeo, safeMat);
        safe.position.y = height * 0.38;
        safe.castShadow = true;
        group.add(safe);
  
        // Combination dial cylinder
        const dialGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12);
        const dialMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.6, roughness: 0.3
        });
        const dial = new THREE.Mesh(dialGeo, dialMat);
        dial.position.set(0.1, height * 0.4, sz * 0.35);
        dial.rotation.x = Math.PI / 2;
        dial.castShadow = true;
        group.add(dial);
  
        // Reinforced corner boxes (4)
        const cornerMat = new THREE.MeshStandardMaterial({
          color: 0x445566, metalness: 0.55, roughness: 0.4
        });
        const halfBox = sz * 0.34;
        const cornerPositions = [
          [-halfBox, -halfBox], [-halfBox, halfBox],
          [halfBox, -halfBox], [halfBox, halfBox]
        ];
        for (const [cx, cz] of cornerPositions) {
          const cornerGeo = new THREE.BoxGeometry(0.05, height * 0.75, 0.05);
          const corner = new THREE.Mesh(cornerGeo, cornerMat);
          corner.position.set(cx, height * 0.38, cz);
          corner.castShadow = true;
          group.add(corner);
        }
      } else {
        // Tier 3: Plasma containment field (transparent sphere)
        const fieldGeo = new THREE.SphereGeometry(sz * 0.3, 12, 12);
        const fieldMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.2
        });
        const field = new THREE.Mesh(fieldGeo, fieldMat);
        field.position.y = height * 0.5;
        group.add(field);
  
        // Energy shield bubble (larger transparent sphere)
        const bubbleGeo = new THREE.SphereGeometry(sz * 0.4, 16, 16);
        const bubbleMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.1,
          transparent: true, opacity: 0.08
        });
        const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
        bubble.position.y = height * 0.5;
        group.add(bubble);
  
        // Floating guard orb spheres (2) with glow
        const orbMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, emissive: 0x44eeff, emissiveIntensity: 0.2,
          metalness: 0.7, roughness: 0.2
        });
        for (let i = 0; i < 2; i++) {
          const orbGeo = new THREE.SphereGeometry(0.04, 8, 8);
          const orb = new THREE.Mesh(orbGeo, orbMat);
          orb.position.set(
            i === 0 ? -0.25 : 0.25,
            height + 0.12,
            i === 0 ? 0.1 : -0.1
          );
          orb.castShadow = true;
          group.add(orb);
        }
  
        // Gold trim boxes (horizontal strips)
        const trimMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.25,
          metalness: 0.8, roughness: 0.15
        });
        for (let i = 0; i < 3; i++) {
          const trimGeo = new THREE.BoxGeometry(sz * 0.75, 0.02, 0.02);
          const trim = new THREE.Mesh(trimGeo, trimMat);
          trim.position.set(0, height * 0.2 + i * height * 0.3, sz * 0.42);
          trim.castShadow = true;
          group.add(trim);
        }
      }
    }
  
    // ===== 10. FIREWALL (1x1, defense, maxLevel=1, always tier 1) =====
    if (id === 'firewall') {
      // Tier 1 only (maxLevel = 1)
      // Brick wall pattern (3 horizontal thin boxes on front)
      const brickMat = new THREE.MeshStandardMaterial({
        color: 0x6e4e32, metalness: 0.1, roughness: 0.9
      });
      for (let row = 0; row < 3; row++) {
        const brickGeo = new THREE.BoxGeometry(sz * 0.75, 0.03, 0.04);
        const brick = new THREE.Mesh(brickGeo, brickMat);
        brick.position.set(0, height * 0.2 + row * height * 0.28, sz * 0.43);
        brick.castShadow = true;
        group.add(brick);
      }
  
      // Wooden support posts (2 vertical thin boxes)
      const postMat = new THREE.MeshStandardMaterial({
        color: 0x8d6e52, metalness: 0.1, roughness: 0.85
      });
      for (let i = 0; i < 2; i++) {
        const postGeo = new THREE.BoxGeometry(0.05, height * 0.85, 0.05);
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(
          i === 0 ? -sz * 0.3 : sz * 0.3,
          height * 0.42,
          sz * 0.38
        );
        post.castShadow = true;
        group.add(post);
      }
  
      // Torch on top (cylinder + sphere)
      const torchPostGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.2, 6);
      const torchPostMat = new THREE.MeshStandardMaterial({
        color: 0x6e5520, metalness: 0.1, roughness: 0.85
      });
      const torchPost = new THREE.Mesh(torchPostGeo, torchPostMat);
      torchPost.position.set(0, height + 0.1, 0);
      torchPost.castShadow = true;
      group.add(torchPost);
  
      const flameGeo = new THREE.SphereGeometry(0.04, 6, 6);
      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.4
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(0, height + 0.22, 0);
      group.add(flame);
    }
  
    // ===== 11. TURRET_NODE (1x1, defense) =====
    if (id === 'turret_node') {
      if (tier === 1) {
        // Wooden mount box
        const mountGeo = new THREE.BoxGeometry(0.3, 0.12, 0.3);
        const mountMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const mount = new THREE.Mesh(mountGeo, mountMat);
        mount.position.y = height + 0.06;
        mount.castShadow = true;
        group.add(mount);
  
        // Crossbow mechanism (2 angled thin boxes)
        const bowMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.15, roughness: 0.8
        });
        const arm1Geo = new THREE.BoxGeometry(0.03, 0.03, 0.25);
        const arm1 = new THREE.Mesh(arm1Geo, bowMat);
        arm1.position.set(-0.06, height + 0.16, 0);
        arm1.rotation.y = 0.3;
        arm1.castShadow = true;
        group.add(arm1);
  
        const arm2Geo = new THREE.BoxGeometry(0.03, 0.03, 0.25);
        const arm2 = new THREE.Mesh(arm2Geo, bowMat);
        arm2.position.set(0.06, height + 0.16, 0);
        arm2.rotation.y = -0.3;
        arm2.castShadow = true;
        group.add(arm2);
  
        // Rope pulley (small torus)
        const pulleyGeo = new THREE.TorusGeometry(0.03, 0.008, 6, 10);
        const pulleyMat = new THREE.MeshStandardMaterial({
          color: 0xaa8844, metalness: 0.3, roughness: 0.6
        });
        const pulley = new THREE.Mesh(pulleyGeo, pulleyMat);
        pulley.position.set(0, height + 0.2, -0.12);
        pulley.rotation.x = Math.PI / 2;
        pulley.castShadow = true;
        group.add(pulley);
      } else if (tier === 2) {
        // Iron turret base cylinder
        const baseGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.1, 10);
        const baseMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = height + 0.05;
        base.castShadow = true;
        group.add(base);
  
        // Metal barrel cylinder
        const barrelGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.4, 8);
        const barrelMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.55, roughness: 0.4
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, height + 0.12, 0.12);
        barrel.rotation.x = Math.PI / 2.5;
        barrel.castShadow = true;
        group.add(barrel);
  
        // Ammo box (small box)
        const ammoGeo = new THREE.BoxGeometry(0.1, 0.06, 0.08);
        const ammoMat = new THREE.MeshStandardMaterial({
          color: 0x445566, metalness: 0.5, roughness: 0.4
        });
        const ammo = new THREE.Mesh(ammoGeo, ammoMat);
        ammo.position.set(-0.12, height + 0.03, -0.08);
        ammo.castShadow = true;
        group.add(ammo);
      } else {
        // Tier 3: Plasma cannon mount cylinder
        const mountGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.12, 10);
        const mountMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const mount = new THREE.Mesh(mountGeo, mountMat);
        mount.position.y = height + 0.06;
        mount.castShadow = true;
        group.add(mount);
  
        // Energy barrel cylinder
        const barrelGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.45, 8);
        const barrelMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.3,
          metalness: 0.6, roughness: 0.2
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, height + 0.14, 0.14);
        barrel.rotation.x = Math.PI / 2.5;
        barrel.castShadow = true;
        group.add(barrel);
  
        // Muzzle flame sphere
        const muzzleGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const muzzleMat = new THREE.MeshStandardMaterial({
          color: 0xff4422, emissive: 0xff4422, emissiveIntensity: 0.6
        });
        const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
        muzzle.position.set(0, height + 0.28, 0.32);
        group.add(muzzle);
  
        // Electric targeting ring torus
        const targetGeo = new THREE.TorusGeometry(0.12, 0.012, 8, 20);
        const targetMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.6
        });
        const target = new THREE.Mesh(targetGeo, targetMat);
        target.position.set(0, height + 0.3, 0.28);
        target.rotation.x = Math.PI / 2;
        group.add(target);
      }
    }
  
    // ===== 12. EMP_TOWER (2x2, defense) =====
    if (id === 'emp_tower') {
      if (tier === 1) {
        // Wooden framework: 4 post cylinders
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const postH = height * 0.6;
        const postOffset = sz * 0.3;
        const postCorners = [
          [-postOffset, -postOffset], [-postOffset, postOffset],
          [postOffset, -postOffset], [postOffset, postOffset]
        ];
        for (const [px, pz] of postCorners) {
          const postGeo = new THREE.CylinderGeometry(0.03, 0.04, postH, 6);
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(px, height + postH / 2, pz);
          post.castShadow = true;
          group.add(post);
        }
  
        // 2 crossbeam boxes
        const beamMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const beamGeo = new THREE.BoxGeometry(sz * 0.65, 0.04, 0.04);
        const beam1 = new THREE.Mesh(beamGeo, beamMat);
        beam1.position.set(0, height + postH * 0.5, -postOffset);
        beam1.castShadow = true;
        group.add(beam1);
  
        const beam2 = new THREE.Mesh(beamGeo, beamMat);
        beam2.position.set(0, height + postH * 0.5, postOffset);
        beam2.castShadow = true;
        group.add(beam2);
  
        // Copper coil torus on top
        const coilGeo = new THREE.TorusGeometry(0.14, 0.025, 8, 16);
        const coilMat = new THREE.MeshStandardMaterial({
          color: 0xcc8844, metalness: 0.4, roughness: 0.5
        });
        const coil = new THREE.Mesh(coilGeo, coilMat);
        coil.position.y = height + postH + 0.03;
        coil.rotation.x = Math.PI / 2;
        coil.castShadow = true;
        group.add(coil);
  
        // Spark glow sphere
        const sparkGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const sparkMat = new THREE.MeshStandardMaterial({
          color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.3
        });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.y = height + postH + 0.08;
        group.add(spark);
      } else if (tier === 2) {
        // Iron pylon (thicker cylinder)
        const pylonGeo = new THREE.CylinderGeometry(0.08, 0.12, height * 0.7, 8);
        const pylonMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const pylon = new THREE.Mesh(pylonGeo, pylonMat);
        pylon.position.y = height + height * 0.35;
        pylon.castShadow = true;
        group.add(pylon);
  
        // Larger coil torus
        const coilGeo = new THREE.TorusGeometry(0.22, 0.03, 8, 20);
        const coilMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const coil = new THREE.Mesh(coilGeo, coilMat);
        coil.position.y = height + height * 0.55;
        coil.rotation.x = Math.PI / 2;
        coil.castShadow = true;
        group.add(coil);
  
        // Blue discharge sphere
        const dischargeGeo = new THREE.SphereGeometry(0.1, 10, 10);
        const dischargeMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.6
        });
        const discharge = new THREE.Mesh(dischargeGeo, dischargeMat);
        discharge.position.y = height + height * 0.72;
        group.add(discharge);
      } else {
        // Tier 3: Dark metal spire cone
        const spireGeo = new THREE.ConeGeometry(0.12, height * 0.8, 8);
        const spireMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.y = height + height * 0.4;
        spire.castShadow = true;
        group.add(spire);
  
        // Plasma rings (2 torus)
        for (let i = 0; i < 2; i++) {
          const ringGeo = new THREE.TorusGeometry(0.25 - i * 0.06, 0.02, 8, 24);
          const ringMat = new THREE.MeshStandardMaterial({
            color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
            transparent: true, opacity: 0.6
          });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.y = height + height * 0.3 + i * height * 0.35;
          ring.rotation.x = Math.PI / 2;
          group.add(ring);
        }
  
        // Lightning arc rod cylinders (3 thin)
        const arcMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.4,
          metalness: 0.8, roughness: 0.15
        });
        for (let i = 0; i < 3; i++) {
          const arcGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4);
          const arc = new THREE.Mesh(arcGeo, arcMat);
          const a = (i / 3) * Math.PI * 2;
          arc.position.set(
            Math.cos(a) * 0.18,
            height + height * 0.5,
            Math.sin(a) * 0.18
          );
          arc.rotation.z = Math.cos(a) * 0.4;
          arc.rotation.x = Math.sin(a) * 0.4;
          arc.castShadow = true;
          group.add(arc);
        }
  
        // Electric storm particles (4 small spheres)
        for (let i = 0; i < 4; i++) {
          const particleGeo = new THREE.SphereGeometry(0.025, 6, 6);
          const particleMat = new THREE.MeshStandardMaterial({
            color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.6
          });
          const particle = new THREE.Mesh(particleGeo, particleMat);
          const a = (i / 4) * Math.PI * 2;
          particle.position.set(
            Math.cos(a) * 0.22,
            height + height * 0.4 + Math.sin(a * 2) * 0.1,
            Math.sin(a) * 0.22
          );
          group.add(particle);
        }
      }
    }

    // ===== 13. HONEYPOT (1x1, defense) =====
    if (id === 'honeypot') {
      if (tier === 1) {
        // Wooden barrel
        const barrelGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.22, 8);
        const barrelMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.8
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.y = height + 0.11;
        barrel.castShadow = true;
        group.add(barrel);
  
        // Honey drip (small sphere at side)
        const dripGeo = new THREE.SphereGeometry(0.035, 6, 6);
        const dripMat = new THREE.MeshStandardMaterial({
          color: 0xdda030, emissive: 0xdda030, emissiveIntensity: 0.2,
          metalness: 0.2, roughness: 0.4
        });
        const drip = new THREE.Mesh(dripGeo, dripMat);
        drip.position.set(0.13, height + 0.06, 0.04);
        drip.castShadow = true;
        group.add(drip);
  
        // Warm glow sphere
        const glowGeo = new THREE.SphereGeometry(0.18, 10, 10);
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.15,
          transparent: true, opacity: 0.15
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = height + 0.14;
        group.add(glow);
      } else if (tier === 2) {
        // Iron cauldron (wider top)
        const cauldronGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.22, 10);
        const cauldronMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const cauldron = new THREE.Mesh(cauldronGeo, cauldronMat);
        cauldron.position.y = height + 0.11;
        cauldron.castShadow = true;
        group.add(cauldron);
  
        // Bubbling lure spheres (3x)
        const lureMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.3,
          metalness: 0.3, roughness: 0.3
        });
        for (let i = 0; i < 3; i++) {
          const lureGeo = new THREE.SphereGeometry(0.03, 6, 6);
          const lure = new THREE.Mesh(lureGeo, lureMat);
          const a = (i / 3) * Math.PI * 2;
          lure.position.set(
            Math.cos(a) * 0.08,
            height + 0.26 + Math.sin(a * 2) * 0.02,
            Math.sin(a) * 0.08
          );
          group.add(lure);
        }
  
        // Blue mist sphere
        const mistGeo = new THREE.SphereGeometry(0.22, 10, 10);
        const mistMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.1,
          transparent: true, opacity: 0.1
        });
        const mist = new THREE.Mesh(mistGeo, mistMat);
        mist.position.y = height + 0.16;
        group.add(mist);
      } else {
        // Tier 3: Energy trap dome (half-sphere)
        const domeGeo = new THREE.SphereGeometry(0.2, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.5, metalness: 0.4, roughness: 0.2
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = height + 0.02;
        group.add(dome);
  
        // Plasma tendril thin boxes (3x angled)
        const tendrilMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          metalness: 0.5, roughness: 0.2
        });
        for (let i = 0; i < 3; i++) {
          const tendrilGeo = new THREE.BoxGeometry(0.02, 0.22, 0.02);
          const tendril = new THREE.Mesh(tendrilGeo, tendrilMat);
          const a = (i / 3) * Math.PI * 2;
          tendril.position.set(
            Math.cos(a) * 0.1,
            height + 0.14,
            Math.sin(a) * 0.1
          );
          tendril.rotation.z = Math.cos(a) * 0.4;
          tendril.rotation.x = Math.sin(a) * 0.4;
          tendril.castShadow = true;
          group.add(tendril);
        }
  
        // Electric lure beacon cone
        const beaconGeo = new THREE.ConeGeometry(0.06, 0.14, 6);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.5,
          metalness: 0.6, roughness: 0.2
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = height + 0.32;
        beacon.castShadow = true;
        group.add(beacon);
  
        // Gold drip particle spheres (3x)
        for (let i = 0; i < 3; i++) {
          const particleGeo = new THREE.SphereGeometry(0.025, 6, 6);
          const particleMat = new THREE.MeshStandardMaterial({
            color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.4
          });
          const particle = new THREE.Mesh(particleGeo, particleMat);
          const a = (i / 3) * Math.PI * 2;
          particle.position.set(
            Math.cos(a) * 0.14,
            height + 0.08 + i * 0.06,
            Math.sin(a) * 0.14
          );
          group.add(particle);
        }
      }
    }
  
    // ===== 14. KILLSWITCH_MINE (1x1, defense) =====
    if (id === 'killswitch_mine') {
      if (tier === 1) {
        // Wooden casing box
        const casingGeo = new THREE.BoxGeometry(0.22, 0.12, 0.22);
        const casingMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const casing = new THREE.Mesh(casingGeo, casingMat);
        casing.position.y = height + 0.06;
        casing.castShadow = true;
        group.add(casing);
  
        // Fuse rope (thin cylinder angled)
        const fuseGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6);
        const fuseMat = new THREE.MeshStandardMaterial({
          color: 0xaa8844, metalness: 0.1, roughness: 0.8
        });
        const fuse = new THREE.Mesh(fuseGeo, fuseMat);
        fuse.position.set(0.08, height + 0.16, 0);
        fuse.rotation.z = -0.5;
        fuse.castShadow = true;
        group.add(fuse);
  
        // Red warning flag (thin box on small pole)
        const poleGeo = new THREE.CylinderGeometry(0.012, 0.015, 0.2, 6);
        const poleMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.1, roughness: 0.85
        });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(-0.1, height + 0.16, -0.08);
        pole.castShadow = true;
        group.add(pole);
  
        const flagGeo = new THREE.BoxGeometry(0.08, 0.05, 0.015);
        const flagMat = new THREE.MeshStandardMaterial({
          color: 0xff4444, metalness: 0.1, roughness: 0.6
        });
        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(-0.06, height + 0.27, -0.08);
        flag.castShadow = true;
        group.add(flag);
      } else if (tier === 2) {
        // Iron dome (half-sphere)
        const domeGeo = new THREE.SphereGeometry(0.16, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = height + 0.02;
        dome.castShadow = true;
        group.add(dome);
  
        // Pressure plate (flat cylinder)
        const plateGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12);
        const plateMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.y = height + 0.015;
        plate.castShadow = true;
        group.add(plate);
  
        // Red warning light sphere
        const lightGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const lightMat = new THREE.MeshStandardMaterial({
          color: 0xff4455, emissive: 0xff4455, emissiveIntensity: 0.6,
          metalness: 0.3, roughness: 0.3
        });
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.y = height + 0.18;
        group.add(light);
      } else {
        // Tier 3: Plasma dome (half-sphere)
        const domeGeo = new THREE.SphereGeometry(0.18, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = height + 0.02;
        dome.castShadow = true;
        group.add(dome);
  
        // Energy pulse core sphere
        const coreGeo = new THREE.SphereGeometry(0.08, 10, 10);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.6,
          metalness: 0.5, roughness: 0.2
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = height + 0.16;
        core.castShadow = true;
        group.add(core);
  
        // Electric danger field ring (torus)
        const ringGeo = new THREE.TorusGeometry(0.22, 0.015, 8, 24);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0xff4422, emissive: 0xff4422, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.7
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = height + 0.1;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
  
        // Gold detonator cap cylinders (2x small)
        const capMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.3,
          metalness: 0.8, roughness: 0.15
        });
        for (let i = 0; i < 2; i++) {
          const capGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.06, 6);
          const cap = new THREE.Mesh(capGeo, capMat);
          cap.position.set(
            i === 0 ? 0.08 : -0.08,
            height + 0.22,
            i === 0 ? 0.04 : -0.04
          );
          cap.castShadow = true;
          group.add(cap);
        }
      }
    }
  
    // ===== 15. SNIPER_TOWER (1x1, military) =====
    if (id === 'sniper_tower') {
      if (tier === 1) {
        // Wooden watchtower posts (2 posts on top)
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        for (let i = 0; i < 2; i++) {
          const postGeo = new THREE.BoxGeometry(0.04, 0.25, 0.04);
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(
            i === 0 ? -0.08 : 0.08,
            height + 0.125,
            0
          );
          post.castShadow = true;
          group.add(post);
        }
  
        // Crossbeam
        const beamGeo = new THREE.BoxGeometry(0.22, 0.03, 0.04);
        const beam = new THREE.Mesh(beamGeo, postMat);
        beam.position.y = height + 0.22;
        beam.castShadow = true;
        group.add(beam);
  
        // Simple scope lens sphere
        const scopeGeo = new THREE.SphereGeometry(0.03, 6, 6);
        const scopeMat = new THREE.MeshStandardMaterial({
          color: 0xaa8844, metalness: 0.3, roughness: 0.5
        });
        const scope = new THREE.Mesh(scopeGeo, scopeMat);
        scope.position.set(0, height + 0.26, 0.06);
        scope.castShadow = true;
        group.add(scope);
      } else if (tier === 2) {
        // Iron-reinforced tower posts (2 cylinders)
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        for (let i = 0; i < 2; i++) {
          const postGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.3, 6);
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(
            i === 0 ? -0.08 : 0.08,
            height + 0.15,
            0
          );
          post.castShadow = true;
          group.add(post);
        }
  
        // Rifled barrel cylinder (longer)
        const barrelGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.28, 8);
        const barrelMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, height + 0.26, 0.06);
        barrel.rotation.x = Math.PI / 2;
        barrel.castShadow = true;
        group.add(barrel);
  
        // Targeting scope sphere
        const scopeGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const scopeMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.3,
          metalness: 0.4, roughness: 0.3
        });
        const scope = new THREE.Mesh(scopeGeo, scopeMat);
        scope.position.set(0, height + 0.3, 0.22);
        scope.castShadow = true;
        group.add(scope);
      } else {
        // Tier 3: Dark metal fortress tower box on top
        const towerGeo = new THREE.BoxGeometry(0.2, 0.22, 0.2);
        const towerMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = height + 0.11;
        tower.castShadow = true;
        group.add(tower);
  
        // Plasma-charged barrel cylinder
        const barrelGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.32, 8);
        const barrelMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.3,
          metalness: 0.5, roughness: 0.2
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0, height + 0.2, 0.08);
        barrel.rotation.x = Math.PI / 2;
        barrel.castShadow = true;
        group.add(barrel);
  
        // Energy scope sphere
        const scopeGeo = new THREE.SphereGeometry(0.045, 8, 8);
        const scopeMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          metalness: 0.5, roughness: 0.2
        });
        const scope = new THREE.Mesh(scopeGeo, scopeMat);
        scope.position.set(0, height + 0.2, 0.26);
        scope.castShadow = true;
        group.add(scope);
  
        // Flame muzzle glow sphere
        const muzzleGeo = new THREE.SphereGeometry(0.035, 8, 8);
        const muzzleMat = new THREE.MeshStandardMaterial({
          color: 0xff4422, emissive: 0xff4422, emissiveIntensity: 0.5
        });
        const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
        muzzle.position.set(0, height + 0.2, 0.38);
        group.add(muzzle);
      }
    }
  
    // ===== 16. PLASMA_TURRET (1x1, military) =====
    if (id === 'plasma_turret') {
      if (tier === 1) {
        // Wooden base box on top
        const baseGeo = new THREE.BoxGeometry(0.24, 0.1, 0.24);
        const baseMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = height + 0.05;
        base.castShadow = true;
        group.add(base);
  
        // 2 crossbow arm thin boxes (angled)
        const armMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.15, roughness: 0.8
        });
        for (let i = 0; i < 2; i++) {
          const armGeo = new THREE.BoxGeometry(0.03, 0.03, 0.22);
          const arm = new THREE.Mesh(armGeo, armMat);
          arm.position.set(
            i === 0 ? -0.06 : 0.06,
            height + 0.14,
            0.04
          );
          arm.rotation.y = i === 0 ? 0.3 : -0.3;
          arm.castShadow = true;
          group.add(arm);
        }
      } else if (tier === 2) {
        // Iron pedestal cylinder
        const pedestalGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.18, 8);
        const pedestalMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
        pedestal.position.y = height + 0.09;
        pedestal.castShadow = true;
        group.add(pedestal);
  
        // 4 metal barrel cylinders in cross pattern
        const barrelMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        for (let i = 0; i < 4; i++) {
          const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6);
          const barrel = new THREE.Mesh(barrelGeo, barrelMat);
          const a = (i / 4) * Math.PI * 2;
          barrel.position.set(
            Math.cos(a) * 0.07,
            height + 0.22,
            Math.sin(a) * 0.07
          );
          barrel.castShadow = true;
          group.add(barrel);
        }
  
        // Targeting ring torus
        const ringGeo = new THREE.TorusGeometry(0.12, 0.012, 8, 16);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.2,
          transparent: true, opacity: 0.7
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = height + 0.28;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
      } else {
        // Tier 3: Plasma core sphere on top
        const coreGeo = new THREE.SphereGeometry(0.1, 12, 12);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          metalness: 0.5, roughness: 0.2
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.y = height + 0.3;
        core.castShadow = true;
        group.add(core);
  
        // 4 energy cannon cylinders (dark metal + emissive tips)
        const cannonMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const tipMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5
        });
        for (let i = 0; i < 4; i++) {
          const cannonGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.2, 6);
          const cannon = new THREE.Mesh(cannonGeo, cannonMat);
          const a = (i / 4) * Math.PI * 2;
          cannon.position.set(
            Math.cos(a) * 0.1,
            height + 0.18,
            Math.sin(a) * 0.1
          );
          cannon.castShadow = true;
          group.add(cannon);
  
          // Emissive tip
          const tipGeo = new THREE.SphereGeometry(0.018, 6, 6);
          const tip = new THREE.Mesh(tipGeo, tipMat);
          tip.position.set(
            Math.cos(a) * 0.1,
            height + 0.3,
            Math.sin(a) * 0.1
          );
          group.add(tip);
        }
  
        // Fire ring torus
        const fireRingGeo = new THREE.TorusGeometry(0.16, 0.015, 8, 20);
        const fireRingMat = new THREE.MeshStandardMaterial({
          color: 0xff4422, emissive: 0xff4422, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.6
        });
        const fireRing = new THREE.Mesh(fireRingGeo, fireRingMat);
        fireRing.position.y = height + 0.12;
        fireRing.rotation.x = Math.PI / 2;
        group.add(fireRing);
  
        // Electric bolt particle spheres (4x small)
        for (let i = 0; i < 4; i++) {
          const boltGeo = new THREE.SphereGeometry(0.02, 6, 6);
          const boltMat = new THREE.MeshStandardMaterial({
            color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.6
          });
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          const a = (i / 4) * Math.PI * 2 + 0.4;
          bolt.position.set(
            Math.cos(a) * 0.2,
            height + 0.25 + Math.sin(a * 2) * 0.05,
            Math.sin(a) * 0.2
          );
          group.add(bolt);
        }
      }
    }
  
    // ===== 17. SPACE_CANNON (1x1, military) =====
    if (id === 'space_cannon') {
      if (tier === 1) {
        // Wooden platform box (flat)
        const platGeo = new THREE.BoxGeometry(0.28, 0.06, 0.28);
        const platMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const plat = new THREE.Mesh(platGeo, platMat);
        plat.position.y = height + 0.03;
        plat.castShadow = true;
        group.add(plat);
  
        // Bronze tube cylinder (angled 45 degrees)
        const tubeGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.28, 8);
        const tubeMat = new THREE.MeshStandardMaterial({
          color: 0xcc8844, metalness: 0.4, roughness: 0.5
        });
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        tube.position.set(0, height + 0.16, 0);
        tube.rotation.z = Math.PI / 4;
        tube.castShadow = true;
        group.add(tube);
  
        // Rope rigging thin boxes (2x)
        const ropeMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.0, roughness: 0.95
        });
        for (let i = 0; i < 2; i++) {
          const ropeGeo = new THREE.BoxGeometry(0.02, 0.18, 0.02);
          const rope = new THREE.Mesh(ropeGeo, ropeMat);
          rope.position.set(
            i === 0 ? -0.1 : 0.1,
            height + 0.12,
            i === 0 ? 0.06 : -0.06
          );
          rope.rotation.z = i === 0 ? 0.3 : -0.3;
          rope.castShadow = true;
          group.add(rope);
        }
      } else if (tier === 2) {
        // Iron dome housing (half-sphere)
        const domeGeo = new THREE.SphereGeometry(0.16, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = height + 0.02;
        dome.castShadow = true;
        group.add(dome);
  
        // Steel barrel cylinder at 45 degrees
        const barrelGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.32, 8);
        const barrelMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0.04, height + 0.2, 0);
        barrel.rotation.z = Math.PI / 4;
        barrel.castShadow = true;
        group.add(barrel);
  
        // Strut support boxes (2x)
        const strutMat = new THREE.MeshStandardMaterial({
          color: 0x445566, metalness: 0.5, roughness: 0.45
        });
        for (let i = 0; i < 2; i++) {
          const strutGeo = new THREE.BoxGeometry(0.03, 0.14, 0.03);
          const strut = new THREE.Mesh(strutGeo, strutMat);
          strut.position.set(
            i === 0 ? -0.1 : 0.1,
            height + 0.08,
            i === 0 ? 0.06 : -0.06
          );
          strut.rotation.z = i === 0 ? 0.2 : -0.2;
          strut.castShadow = true;
          group.add(strut);
        }
      } else {
        // Tier 3: Plasma dome (half-sphere)
        const domeGeo = new THREE.SphereGeometry(0.18, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = height + 0.02;
        dome.castShadow = true;
        group.add(dome);
  
        // Energy cannon cylinder (angled)
        const cannonGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.36, 8);
        const cannonMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.3,
          metalness: 0.5, roughness: 0.2
        });
        const cannon = new THREE.Mesh(cannonGeo, cannonMat);
        cannon.position.set(0.04, height + 0.22, 0);
        cannon.rotation.z = Math.PI / 4;
        cannon.castShadow = true;
        group.add(cannon);
  
        // Orbital tracking glow torus
        const orbitGeo = new THREE.TorusGeometry(0.2, 0.015, 8, 24);
        const orbitMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.5
        });
        const orbit = new THREE.Mesh(orbitGeo, orbitMat);
        orbit.position.y = height + 0.18;
        orbit.rotation.x = Math.PI / 2;
        group.add(orbit);
  
        // Flame exhaust sphere at barrel base
        const exhaustGeo = new THREE.SphereGeometry(0.045, 8, 8);
        const exhaustMat = new THREE.MeshStandardMaterial({
          color: 0xff4422, emissive: 0xff4422, emissiveIntensity: 0.5
        });
        const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
        exhaust.position.set(-0.08, height + 0.08, 0);
        group.add(exhaust);
  
        // Gold plating trim boxes
        const trimMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.3,
          metalness: 0.8, roughness: 0.15
        });
        for (let i = 0; i < 2; i++) {
          const trimGeo = new THREE.BoxGeometry(0.16, 0.02, 0.03);
          const trim = new THREE.Mesh(trimGeo, trimMat);
          trim.position.set(
            0,
            height + (i === 0 ? 0.04 : 0.16),
            i === 0 ? 0.18 : -0.18
          );
          trim.castShadow = true;
          group.add(trim);
        }
      }
    }
  
    // ===== 18. ION_BEAM (1x1, military) =====
    if (id === 'ion_beam') {
      if (tier === 1) {
        // Wooden frame (4 small post boxes around top)
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        for (let i = 0; i < 4; i++) {
          const postGeo = new THREE.BoxGeometry(0.03, 0.16, 0.03);
          const post = new THREE.Mesh(postGeo, postMat);
          const a = (i / 4) * Math.PI * 2;
          post.position.set(
            Math.cos(a) * 0.1,
            height + 0.08,
            Math.sin(a) * 0.1
          );
          post.castShadow = true;
          group.add(post);
        }
  
        // Raw crystal cone on top
        const crystalGeo = new THREE.ConeGeometry(0.05, 0.12, 6);
        const crystalMat = new THREE.MeshStandardMaterial({
          color: 0x44ffaa, emissive: 0x44ffaa, emissiveIntensity: 0.2,
          metalness: 0.4, roughness: 0.3
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.y = height + 0.22;
        crystal.castShadow = true;
        group.add(crystal);
  
        // Faint glow sphere
        const glowGeo = new THREE.SphereGeometry(0.14, 10, 10);
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0x44ffaa, emissive: 0x44ffaa, emissiveIntensity: 0.1,
          transparent: true, opacity: 0.1
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.y = height + 0.18;
        group.add(glow);
      } else if (tier === 2) {
        // Iron crystal holder cylinder
        const holderGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.2, 8);
        const holderMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const holder = new THREE.Mesh(holderGeo, holderMat);
        holder.position.y = height + 0.1;
        holder.castShadow = true;
        group.add(holder);
  
        // Focused beam lens (flattened cylinder)
        const lensGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12);
        const lensMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.7, metalness: 0.4, roughness: 0.2
        });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.y = height + 0.24;
        lens.castShadow = true;
        group.add(lens);
  
        // Energy ring torus
        const ringGeo = new THREE.TorusGeometry(0.14, 0.015, 8, 20);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.6
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = height + 0.22;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
      } else {
        // Tier 3: Plasma crystal spire cone (tall)
        const spireGeo = new THREE.ConeGeometry(0.08, 0.4, 8);
        const spireMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          metalness: 0.5, roughness: 0.2
        });
        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.y = height + 0.28;
        spire.castShadow = true;
        group.add(spire);
  
        // 5 orbiting shards (OctahedronGeo)
        const shardMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.5,
          metalness: 0.7, roughness: 0.15
        });
        for (let i = 0; i < 5; i++) {
          const shardGeo = new THREE.OctahedronGeometry(0.04, 0);
          const shard = new THREE.Mesh(shardGeo, shardMat);
          const a = (i / 5) * Math.PI * 2;
          shard.position.set(
            Math.cos(a) * 0.16,
            height + 0.2 + Math.sin(a * 2) * 0.04,
            Math.sin(a) * 0.16
          );
          shard.castShadow = true;
          group.add(shard);
        }
  
        // Electric beam column cylinder (tall thin, transparent)
        const beamGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
        const beamMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.6
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = height + 0.35;
        group.add(beam);
  
        // Gold base ring torus
        const baseRingGeo = new THREE.TorusGeometry(0.14, 0.02, 8, 20);
        const baseRingMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.3,
          metalness: 0.8, roughness: 0.15
        });
        const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
        baseRing.position.y = height + 0.05;
        baseRing.rotation.x = Math.PI / 2;
        group.add(baseRing);
  
        // Energy vortex (transparent sphere)
        const vortexGeo = new THREE.SphereGeometry(0.22, 12, 12);
        const vortexMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.08,
          transparent: true, opacity: 0.12
        });
        const vortex = new THREE.Mesh(vortexGeo, vortexMat);
        vortex.position.y = height + 0.28;
        group.add(vortex);
      }
    }
  
    // ===== 19. TRAINING_GROUND (2x2, military) =====
    if (id === 'training_ground') {
      if (tier === 1) {
        // Wooden practice dummy (cylinder body + sphere head + crossbeam arms)
        const dummyMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const bodyGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.22, 6);
        const body = new THREE.Mesh(bodyGeo, dummyMat);
        body.position.set(0.1, height + 0.11, 0.1);
        body.castShadow = true;
        group.add(body);
  
        const headGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const head = new THREE.Mesh(headGeo, dummyMat);
        head.position.set(0.1, height + 0.26, 0.1);
        head.castShadow = true;
        group.add(head);
  
        const armsGeo = new THREE.BoxGeometry(0.2, 0.03, 0.03);
        const arms = new THREE.Mesh(armsGeo, dummyMat);
        arms.position.set(0.1, height + 0.18, 0.1);
        arms.castShadow = true;
        group.add(arms);
  
        // Dirt ring (flat torus)
        const dirtGeo = new THREE.TorusGeometry(0.28, 0.04, 6, 20);
        const dirtMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.0, roughness: 0.95
        });
        const dirt = new THREE.Mesh(dirtGeo, dirtMat);
        dirt.position.y = height + 0.02;
        dirt.rotation.x = Math.PI / 2;
        group.add(dirt);
  
        // Torch post cylinders (2x + flame spheres)
        const torchMat = new THREE.MeshStandardMaterial({
          color: 0x6e5520, metalness: 0.1, roughness: 0.85
        });
        const flameMat = new THREE.MeshStandardMaterial({
          color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.4
        });
        for (let i = 0; i < 2; i++) {
          const postGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.3, 6);
          const post = new THREE.Mesh(postGeo, torchMat);
          post.position.set(
            i === 0 ? -0.28 : 0.28,
            height + 0.15,
            i === 0 ? -0.2 : 0.2
          );
          post.castShadow = true;
          group.add(post);
  
          const flameGeo = new THREE.SphereGeometry(0.035, 6, 6);
          const flame = new THREE.Mesh(flameGeo, flameMat);
          flame.position.set(
            i === 0 ? -0.28 : 0.28,
            height + 0.33,
            i === 0 ? -0.2 : 0.2
          );
          group.add(flame);
        }
      } else if (tier === 2) {
        // Iron training platform (flat cylinder)
        const platGeo = new THREE.CylinderGeometry(0.35, 0.38, 0.06, 12);
        const platMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const plat = new THREE.Mesh(platGeo, platMat);
        plat.position.y = height + 0.03;
        plat.castShadow = true;
        group.add(plat);
  
        // Sparring ring torus
        const ringGeo = new THREE.TorusGeometry(0.3, 0.02, 8, 24);
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = height + 0.08;
        ring.rotation.x = Math.PI / 2;
        ring.castShadow = true;
        group.add(ring);
  
        // Weapon rack (box frame + thin stick boxes)
        const rackMat = new THREE.MeshStandardMaterial({
          color: 0x445566, metalness: 0.5, roughness: 0.45
        });
        const frameGeo = new THREE.BoxGeometry(0.22, 0.18, 0.04);
        const frame = new THREE.Mesh(frameGeo, rackMat);
        frame.position.set(-0.22, height + 0.15, -0.22);
        frame.castShadow = true;
        group.add(frame);
  
        // Weapon sticks
        const stickMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        for (let i = 0; i < 3; i++) {
          const stickGeo = new THREE.BoxGeometry(0.015, 0.16, 0.015);
          const stick = new THREE.Mesh(stickGeo, stickMat);
          stick.position.set(
            -0.22 + (i - 1) * 0.06,
            height + 0.15,
            -0.2
          );
          stick.castShadow = true;
          group.add(stick);
        }
      } else {
        // Tier 3: Energy arena platform (flat cylinder)
        const arenaGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.06, 16);
        const arenaMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const arena = new THREE.Mesh(arenaGeo, arenaMat);
        arena.position.y = height + 0.03;
        arena.castShadow = true;
        group.add(arena);
  
        // Holographic target spheres (3x)
        const targetMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.5
        });
        for (let i = 0; i < 3; i++) {
          const targetGeo = new THREE.SphereGeometry(0.05, 8, 8);
          const target = new THREE.Mesh(targetGeo, targetMat);
          const a = (i / 3) * Math.PI * 2;
          target.position.set(
            Math.cos(a) * 0.2,
            height + 0.2 + Math.sin(a * 3) * 0.04,
            Math.sin(a) * 0.2
          );
          group.add(target);
        }
  
        // Plasma ring torus
        const plasmaRingGeo = new THREE.TorusGeometry(0.32, 0.02, 8, 28);
        const plasmaRingMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.6
        });
        const plasmaRing = new THREE.Mesh(plasmaRingGeo, plasmaRingMat);
        plasmaRing.position.y = height + 0.1;
        plasmaRing.rotation.x = Math.PI / 2;
        group.add(plasmaRing);
  
        // Electric field (large transparent sphere)
        const fieldGeo = new THREE.SphereGeometry(0.4, 14, 14);
        const fieldMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.05,
          transparent: true, opacity: 0.08
        });
        const field = new THREE.Mesh(fieldGeo, fieldMat);
        field.position.y = height + 0.2;
        group.add(field);
  
        // Gold trophy (cone + sphere)
        const trophyConeMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.3,
          metalness: 0.8, roughness: 0.15
        });
        const trophyConeGeo = new THREE.ConeGeometry(0.04, 0.1, 6);
        const trophyCone = new THREE.Mesh(trophyConeGeo, trophyConeMat);
        trophyCone.position.set(0, height + 0.14, 0);
        trophyCone.castShadow = true;
        group.add(trophyCone);
  
        const trophySphereGeo = new THREE.SphereGeometry(0.035, 8, 8);
        const trophySphere = new THREE.Mesh(trophySphereGeo, trophyConeMat);
        trophySphere.position.set(0, height + 0.22, 0);
        trophySphere.castShadow = true;
        group.add(trophySphere);
      }
    }
  
    // ===== 20. REPAIR_DRONE_BAY (1x1, utility) =====
    if (id === 'repair_drone_bay') {
      if (tier === 1) {
        // Wooden workbench box (flat)
        const benchGeo = new THREE.BoxGeometry(0.26, 0.06, 0.18);
        const benchMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const bench = new THREE.Mesh(benchGeo, benchMat);
        bench.position.y = height + 0.03;
        bench.castShadow = true;
        group.add(bench);
  
        // Simple tool rack (thin box frame)
        const rackGeo = new THREE.BoxGeometry(0.14, 0.14, 0.02);
        const rackMat = new THREE.MeshStandardMaterial({
          color: 0xaa8844, metalness: 0.3, roughness: 0.6
        });
        const rack = new THREE.Mesh(rackGeo, rackMat);
        rack.position.set(-0.08, height + 0.13, -0.08);
        rack.castShadow = true;
        group.add(rack);
  
        // Lantern sphere
        const lanternGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const lanternMat = new THREE.MeshStandardMaterial({
          color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.3
        });
        const lantern = new THREE.Mesh(lanternGeo, lanternMat);
        lantern.position.set(0.1, height + 0.12, 0.06);
        group.add(lantern);
      } else if (tier === 2) {
        // Iron hangar frame (4 post cylinders + roof box)
        const postMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const postCorners = [
          [-0.1, -0.1], [-0.1, 0.1], [0.1, -0.1], [0.1, 0.1]
        ];
        for (const [px, pz] of postCorners) {
          const postGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.2, 6);
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(px, height + 0.1, pz);
          post.castShadow = true;
          group.add(post);
        }
  
        // Roof box
        const roofGeo = new THREE.BoxGeometry(0.26, 0.03, 0.26);
        const roofMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = height + 0.215;
        roof.castShadow = true;
        group.add(roof);
  
        // Single drone sphere + small rotor boxes
        const droneGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const droneMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const drone = new THREE.Mesh(droneGeo, droneMat);
        drone.position.set(0, height + 0.28, 0);
        drone.castShadow = true;
        group.add(drone);
  
        // Rotor boxes
        const rotorMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        for (let i = 0; i < 2; i++) {
          const rotorGeo = new THREE.BoxGeometry(0.1, 0.008, 0.02);
          const rotor = new THREE.Mesh(rotorGeo, rotorMat);
          rotor.position.set(0, height + 0.32, 0);
          rotor.rotation.y = i * Math.PI / 2;
          rotor.castShadow = true;
          group.add(rotor);
        }
  
        // Green status ring torus
        const statusGeo = new THREE.TorusGeometry(0.08, 0.01, 6, 16);
        const statusMat = new THREE.MeshStandardMaterial({
          color: 0x44aa66, emissive: 0x44aa66, emissiveIntensity: 0.3,
          transparent: true, opacity: 0.6
        });
        const status = new THREE.Mesh(statusGeo, statusMat);
        status.position.y = height + 0.26;
        status.rotation.x = Math.PI / 2;
        group.add(status);
      } else {
        // Tier 3: Plasma launch pad (flat cylinder with glow ring)
        const padGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.04, 12);
        const padMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.y = height + 0.02;
        pad.castShadow = true;
        group.add(pad);
  
        // Pad glow ring
        const padRingGeo = new THREE.TorusGeometry(0.18, 0.012, 8, 20);
        const padRingMat = new THREE.MeshStandardMaterial({
          color: 0x44aa66, emissive: 0x44aa66, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.5
        });
        const padRing = new THREE.Mesh(padRingGeo, padRingMat);
        padRing.position.y = height + 0.045;
        padRing.rotation.x = Math.PI / 2;
        group.add(padRing);
  
        // Multiple drone spheres (3x with green emissive)
        const droneMat = new THREE.MeshStandardMaterial({
          color: 0x445566, emissive: 0x44aa66, emissiveIntensity: 0.3,
          metalness: 0.6, roughness: 0.3
        });
        for (let i = 0; i < 3; i++) {
          const droneGeo = new THREE.SphereGeometry(0.035, 8, 8);
          const drone = new THREE.Mesh(droneGeo, droneMat);
          const a = (i / 3) * Math.PI * 2;
          drone.position.set(
            Math.cos(a) * 0.12,
            height + 0.2 + i * 0.06,
            Math.sin(a) * 0.12
          );
          drone.castShadow = true;
          group.add(drone);
        }
  
        // Energy repair beam cylinders (thin, green emissive)
        const beamMat = new THREE.MeshStandardMaterial({
          color: 0x44aa66, emissive: 0x44aa66, emissiveIntensity: 0.5,
          transparent: true, opacity: 0.7
        });
        for (let i = 0; i < 3; i++) {
          const beamGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6);
          const beam = new THREE.Mesh(beamGeo, beamMat);
          const a = (i / 3) * Math.PI * 2;
          beam.position.set(
            Math.cos(a) * 0.12,
            height + 0.12,
            Math.sin(a) * 0.12
          );
          beam.rotation.z = Math.cos(a) * 0.3;
          beam.rotation.x = Math.sin(a) * 0.3;
          group.add(beam);
        }
  
        // Gold service ring torus
        const serviceGeo = new THREE.TorusGeometry(0.14, 0.015, 8, 20);
        const serviceMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.3,
          metalness: 0.8, roughness: 0.15
        });
        const serviceRing = new THREE.Mesh(serviceGeo, serviceMat);
        serviceRing.position.y = height + 0.08;
        serviceRing.rotation.x = Math.PI / 2;
        group.add(serviceRing);
      }
    }
  
    // ===== 21. BUILDER_HUT (1x1, utility, maxLevel=1 always tier 1) =====
    if (id === 'builder_hut') {
      // Tier 1 only (maxLevel = 1)
      // Wooden shed roof (angled box, slightly wider)
      const roofGeo = new THREE.BoxGeometry(sz * 0.9, 0.04, sz * 0.7);
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x8d6e52, metalness: 0.1, roughness: 0.85
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = height + 0.06;
      roof.rotation.z = 0.15;
      roof.castShadow = true;
      group.add(roof);
  
      // Hammer (thin cylinder handle + small box head)
      const handleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6);
      const handleMat = new THREE.MeshStandardMaterial({
        color: 0x6e5520, metalness: 0.1, roughness: 0.85
      });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(0.12, height + 0.1, 0.06);
      handle.rotation.z = 0.4;
      handle.castShadow = true;
      group.add(handle);
  
      const hammerHeadGeo = new THREE.BoxGeometry(0.06, 0.04, 0.04);
      const hammerHeadMat = new THREE.MeshStandardMaterial({
        color: 0x888888, metalness: 0.4, roughness: 0.5
      });
      const hammerHead = new THREE.Mesh(hammerHeadGeo, hammerHeadMat);
      hammerHead.position.set(0.16, height + 0.18, 0.06);
      hammerHead.castShadow = true;
      group.add(hammerHead);
  
      // Sawhorse (2 angled thin boxes + crossbeam)
      const sawMat = new THREE.MeshStandardMaterial({
        color: 0xaa8844, metalness: 0.2, roughness: 0.7
      });
      for (let i = 0; i < 2; i++) {
        const legGeo = new THREE.BoxGeometry(0.02, 0.12, 0.02);
        const leg = new THREE.Mesh(legGeo, sawMat);
        leg.position.set(
          -0.1,
          height + 0.06,
          i === 0 ? -0.04 : 0.04
        );
        leg.rotation.z = i === 0 ? 0.2 : -0.2;
        leg.castShadow = true;
        group.add(leg);
      }
  
      const sawBeamGeo = new THREE.BoxGeometry(0.02, 0.02, 0.12);
      const sawBeam = new THREE.Mesh(sawBeamGeo, sawMat);
      sawBeam.position.set(-0.1, height + 0.12, 0);
      sawBeam.castShadow = true;
      group.add(sawBeam);
  
      // Lantern sphere
      const lanternGeo = new THREE.SphereGeometry(0.035, 6, 6);
      const lanternMat = new THREE.MeshStandardMaterial({
        color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.3
      });
      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.set(0, height + 0.14, -0.08);
      group.add(lantern);
    }
  
    // ===== 22. OVERCLOCK_PYLON (1x1, utility) =====
    if (id === 'overclock_pylon') {
      if (tier === 1) {
        // Wooden pole top (cylinder extension above building)
        const poleGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.28, 6);
        const poleMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = height + 0.14;
        pole.castShadow = true;
        group.add(pole);
  
        // Copper winding torus
        const windingGeo = new THREE.TorusGeometry(0.06, 0.012, 6, 14);
        const windingMat = new THREE.MeshStandardMaterial({
          color: 0xcc8844, metalness: 0.4, roughness: 0.5
        });
        const winding = new THREE.Mesh(windingGeo, windingMat);
        winding.position.y = height + 0.2;
        winding.rotation.x = Math.PI / 2;
        winding.castShadow = true;
        group.add(winding);
  
        // Warm glow orb sphere
        const orbGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const orbMat = new THREE.MeshStandardMaterial({
          color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.4
        });
        const orb = new THREE.Mesh(orbGeo, orbMat);
        orb.position.y = height + 0.32;
        group.add(orb);
      } else if (tier === 2) {
        // Iron pylon extension cylinder
        const pylonGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.35, 8);
        const pylonMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const pylon = new THREE.Mesh(pylonGeo, pylonMat);
        pylon.position.y = height + 0.175;
        pylon.castShadow = true;
        group.add(pylon);
  
        // Energy coil torus
        const coilGeo = new THREE.TorusGeometry(0.08, 0.015, 8, 18);
        const coilMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const coil = new THREE.Mesh(coilGeo, coilMat);
        coil.position.y = height + 0.24;
        coil.rotation.x = Math.PI / 2;
        coil.castShadow = true;
        group.add(coil);
  
        // Blue pulse ring torus
        const pulseGeo = new THREE.TorusGeometry(0.12, 0.012, 8, 20);
        const pulseMat = new THREE.MeshStandardMaterial({
          color: 0x88bbff, emissive: 0x88bbff, emissiveIntensity: 0.4,
          transparent: true, opacity: 0.5
        });
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.position.y = height + 0.3;
        pulse.rotation.x = Math.PI / 2;
        group.add(pulse);
      } else {
        // Tier 3: Plasma obelisk cone (tall narrow)
        const obeliskGeo = new THREE.ConeGeometry(0.06, 0.45, 6);
        const obeliskMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const obelisk = new THREE.Mesh(obeliskGeo, obeliskMat);
        obelisk.position.y = height + 0.225;
        obelisk.castShadow = true;
        group.add(obelisk);
  
        // Electric storm core sphere
        const stormGeo = new THREE.SphereGeometry(0.07, 10, 10);
        const stormMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.6,
          metalness: 0.5, roughness: 0.2
        });
        const storm = new THREE.Mesh(stormGeo, stormMat);
        storm.position.y = height + 0.48;
        storm.castShadow = true;
        group.add(storm);
  
        // Floating energy shard octahedrons (3x)
        const shardMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.5,
          metalness: 0.6, roughness: 0.2
        });
        for (let i = 0; i < 3; i++) {
          const shardGeo = new THREE.OctahedronGeometry(0.04, 0);
          const shard = new THREE.Mesh(shardGeo, shardMat);
          const a = (i / 3) * Math.PI * 2;
          shard.position.set(
            Math.cos(a) * 0.14,
            height + 0.35 + Math.sin(a * 2) * 0.04,
            Math.sin(a) * 0.14
          );
          shard.castShadow = true;
          group.add(shard);
        }
  
        // Gold lightning trim boxes (2x thin)
        const trimMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.3,
          metalness: 0.8, roughness: 0.15
        });
        for (let i = 0; i < 2; i++) {
          const trimGeo = new THREE.BoxGeometry(0.02, 0.2, 0.02);
          const trim = new THREE.Mesh(trimGeo, trimMat);
          trim.position.set(
            i === 0 ? 0.08 : -0.08,
            height + 0.22,
            i === 0 ? 0.06 : -0.06
          );
          trim.rotation.z = i === 0 ? 0.15 : -0.15;
          trim.castShadow = true;
          group.add(trim);
        }
      }
    }
  
    // ===== 23. BEACON_TOWER (2x2, utility) =====
    if (id === 'beacon_tower') {
      if (tier === 1) {
        // Wooden watchtower extension (box frame on top)
        const frameMat = new THREE.MeshStandardMaterial({
          color: 0x8d6e52, metalness: 0.1, roughness: 0.85
        });
        const frameGeo = new THREE.BoxGeometry(0.2, 0.25, 0.2);
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.y = height + 0.125;
        frame.castShadow = true;
        group.add(frame);
  
        // Lantern top sphere
        const lanternGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const lanternMat = new THREE.MeshStandardMaterial({
          color: 0xff8833, emissive: 0xff8833, emissiveIntensity: 0.5
        });
        const lantern = new THREE.Mesh(lanternGeo, lanternMat);
        lantern.position.y = height + 0.3;
        group.add(lantern);
  
        // Rope guy-wire thin boxes (2x angled)
        const ropeMat = new THREE.MeshStandardMaterial({
          color: 0xaa8844, metalness: 0.2, roughness: 0.7
        });
        for (let i = 0; i < 2; i++) {
          const ropeGeo = new THREE.BoxGeometry(0.015, 0.3, 0.015);
          const rope = new THREE.Mesh(ropeGeo, ropeMat);
          rope.position.set(
            i === 0 ? -0.18 : 0.18,
            height + 0.1,
            i === 0 ? 0.12 : -0.12
          );
          rope.rotation.z = i === 0 ? 0.35 : -0.35;
          rope.castShadow = true;
          group.add(rope);
        }
      } else if (tier === 2) {
        // Iron tower cylinder
        const towerGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.4, 8);
        const towerMat = new THREE.MeshStandardMaterial({
          color: 0x556677, metalness: 0.5, roughness: 0.45
        });
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = height + 0.2;
        tower.castShadow = true;
        group.add(tower);
  
        // Signal dish cone
        const dishGeo = new THREE.ConeGeometry(0.1, 0.08, 8);
        const dishMat = new THREE.MeshStandardMaterial({
          color: 0x778899, metalness: 0.5, roughness: 0.4
        });
        const dish = new THREE.Mesh(dishGeo, dishMat);
        dish.position.set(0.08, height + 0.38, 0);
        dish.rotation.z = -Math.PI / 4;
        dish.castShadow = true;
        group.add(dish);
  
        // Red warning blinker sphere
        const blinkerGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const blinkerMat = new THREE.MeshStandardMaterial({
          color: 0xff4455, emissive: 0xff4455, emissiveIntensity: 0.6
        });
        const blinker = new THREE.Mesh(blinkerGeo, blinkerMat);
        blinker.position.y = height + 0.44;
        group.add(blinker);
      } else {
        // Tier 3: Dark metal spire cone
        const spireGeo = new THREE.ConeGeometry(0.1, 0.5, 8);
        const spireMat = new THREE.MeshStandardMaterial({
          color: 0x2a2a3e, metalness: 0.7, roughness: 0.2
        });
        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.y = height + 0.25;
        spire.castShadow = true;
        group.add(spire);
  
        // Plasma antenna cylinder
        const antennaGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.28, 6);
        const antennaMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.3,
          metalness: 0.5, roughness: 0.2
        });
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.y = height + 0.54;
        antenna.castShadow = true;
        group.add(antenna);
  
        // Signal wave particle spheres (4x, spread outward)
        const waveMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.4
        });
        for (let i = 0; i < 4; i++) {
          const waveGeo = new THREE.SphereGeometry(0.025, 6, 6);
          const wave = new THREE.Mesh(waveGeo, waveMat);
          const a = (i / 4) * Math.PI * 2;
          const spread = 0.15 + i * 0.04;
          wave.position.set(
            Math.cos(a) * spread,
            height + 0.52 - i * 0.03,
            Math.sin(a) * spread
          );
          group.add(wave);
        }
  
        // Electric beacon glow sphere
        const beaconGeo = new THREE.SphereGeometry(0.06, 10, 10);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: 0x44eeff, emissive: 0x44eeff, emissiveIntensity: 0.6,
          metalness: 0.5, roughness: 0.2
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = height + 0.7;
        beacon.castShadow = true;
        group.add(beacon);
  
        // Gold band torus
        const bandGeo = new THREE.TorusGeometry(0.12, 0.018, 8, 20);
        const bandMat = new THREE.MeshStandardMaterial({
          color: 0xf5c542, emissive: 0xf5c542, emissiveIntensity: 0.3,
          metalness: 0.8, roughness: 0.15
        });
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.y = height + 0.35;
        band.rotation.x = Math.PI / 2;
        group.add(band);
      }
    }
  }

  // Apply tier-based visual modifications (replaces old linear progression)
  function applyLevelMods(group, id, level) {
    if (group.userData.isSprite) return; // Sprites use pre-rendered textures
    const tier = getBuildingTier(id, level);
    const pal = TIER_PALETTES[tier];

    // Subtle scale: all tiers are HQ, just slightly different mass
    const scaleMap = { 1: 0.92, 2: 1.0, 3: 1.06 };
    group.scale.y = scaleMap[tier];

    // Tier-based material overrides
    group.traverse(child => {
      if (!child.isMesh || !child.material) return;
      const mat = child.material;

      if (tier === 1) {
        // Warm woodsy — high roughness, low metalness, orange-tinted emissive
        mat.roughness = Math.max(mat.roughness, 0.75);
        mat.metalness = Math.min(mat.metalness, 0.15);
        if (mat.emissive) {
          mat.emissive.lerp(new THREE.Color(0xff8833), 0.3);
          mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, 0.1);
        }
      } else if (tier === 2) {
        // Iron industrial — medium metalness, forge-blue emissive boost
        mat.metalness = Math.max(mat.metalness, 0.35);
        mat.roughness = Math.min(mat.roughness, 0.55);
        if (mat.emissive) {
          mat.emissive.lerp(new THREE.Color(0x88bbff), 0.25);
          mat.emissiveIntensity = (mat.emissiveIntensity || 0) + 0.1;
        }
      } else {
        // Tier 3 — electric/plasma: high metalness, low roughness, cyan/gold glow
        mat.metalness = Math.max(mat.metalness, 0.55);
        mat.roughness = Math.min(mat.roughness, 0.3);
        if (mat.emissive) {
          mat.emissive.lerp(new THREE.Color(0x44eeff), 0.3);
          mat.emissiveIntensity = (mat.emissiveIntensity || 0) + 0.2;
        }
        // Gold trim on accent/trim meshes
        if (child.name === 'trimMesh' || child.name === 'accentMesh') {
          mat.color.set(0xf5c542);
          mat.emissive = new THREE.Color(0xf5c542);
          mat.emissiveIntensity = 0.25;
          mat.metalness = 0.8;
          mat.roughness = 0.15;
        }
      }
    });
  }

  // ===== 2D Sprite Rendering System =====
  // Renders building sprites from VillageData.getBuildingSprite() onto canvas textures,
  // with PNG file override support (assets/sprites/{id}_t{tier}.png)

  // Render a canvas-based sprite texture from the pixel-art definitions
  function renderCanvasSprite(id, tier) {
    const def = VillageData.BUILDINGS[id];
    const sz = def ? def.size : 1;
    const maxLv = def ? def.maxLevel : 10;

    // Compute a representative level for this tier
    let level;
    if (maxLv <= 1) {
      level = 1;
    } else if (tier === 1) {
      level = 1;
    } else if (tier === 2) {
      level = Math.ceil(maxLv * 0.5);
    } else {
      level = maxLv;
    }

    const rects = VillageData.getBuildingSprite(id, level);
    if (!rects || rects.length === 0) return null;

    // 128px per grid tile
    const pxPerTile = 128;
    const canvasSize = sz * pxPerTile;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    // Scale factor: sprite coords are based on s=24 per tile, canvas is pxPerTile per tile
    const scale = pxPerTile / 24;

    for (const r of rects) {
      ctx.fillStyle = r.c;
      ctx.fillRect(
        Math.round(r.x * scale),
        Math.round(r.y * scale),
        Math.round(r.w * scale),
        Math.round(r.h * scale)
      );
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  // Ensure sprite texture exists in cache (synchronous — canvas fallback)
  function ensureSpriteTexture(id, tier) {
    const key = `${id}_t${tier}`;
    if (spriteTextureCache.has(key)) return spriteTextureCache.get(key);

    // Render canvas sprite immediately (synchronous)
    const canvasTex = renderCanvasSprite(id, tier);
    if (canvasTex) {
      spriteTextureCache.set(key, canvasTex);
    }
    return canvasTex;
  }

  // Try to upgrade a sprite texture from PNG file (async, background)
  function tryPngUpgrade(id, tier) {
    const key = `${id}_t${tier}`;
    if (spriteLoadPromises.has(key)) return;

    spriteLoadPromises.set(key, true); // mark attempted
    pngLoader.load(
      `assets/sprites/${key}.png`,
      (texture) => {
        // PNG found — upgrade the cached texture
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        spriteTextureCache.set(key, texture);
        console.log(`[VillageBuildings] PNG upgrade: ${key}`);
      },
      undefined,
      () => { /* PNG not found — canvas sprite already in cache, nothing to do */ }
    );
  }

  // Create a 2D sprite building (flat billboard in the 3D scene)
  function createSpriteBuilding(id, level) {
    // Barracks always use 3D (troops visible in courtyard)
    if (id === 'barracks') return null;

    const tier = getBuildingTier(id, level);
    const texture = ensureSpriteTexture(id, tier);
    if (!texture) return null;

    const def = VillageData.BUILDINGS[id];
    const sz = def ? def.size : 1;
    const tierHeight = getBuildingHeight(id, level);

    const group = new THREE.Group();
    group.userData.isSprite = true;

    // Sprite billboard
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.01
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.center.set(0.5, 0.0); // anchor at bottom-center

    const spriteW = sz * 1.1;
    const spriteH = Math.max(spriteW, tierHeight * 1.2);
    sprite.scale.set(spriteW, spriteH, 1);
    sprite.name = 'buildingSprite';
    group.add(sprite);

    // Shadow disc (sprites can't cast real shadows)
    const shadowGeo = new THREE.CircleGeometry(sz * 0.45, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.01;
    shadow.name = 'spriteShadow';
    group.add(shadow);

    return group;
  }

  // Create a building mesh — 3-level fallback: sprite → .glb model → procedural 3D
  function createBuilding(id, level) {
    let group;

    // 1. Try 2D sprite (PNG or canvas-rendered)
    group = createSpriteBuilding(id, level);

    // 2. Try .glb model clone
    if (!group) {
      const template = modelCache.get(id);
      if (template) {
        group = template.clone();
        // Deep clone materials so level mods don't affect template
        group.traverse(child => {
          if (child.isMesh && child.material) {
            child.material = child.material.clone();
          }
        });
      }
    }

    // 3. Procedural 3D fallback
    if (!group) {
      group = createFallbackGeometry(id, level);
    }

    applyLevelMods(group, id, level);

    // Store metadata
    group.userData.buildingId = id;
    group.userData.level = level;
    group.userData.tier = getBuildingTier(id, level);

    return group;
  }

  // Create transparent ghost for placement preview
  function createGhost(id, level) {
    const group = createBuilding(id, level);

    // Make all materials transparent
    group.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.45;
        child.material.depthWrite = false;
        child.castShadow = false;
        child.receiveShadow = false;
      }
      if (child.isSprite && child.material) {
        child.material = child.material.clone();
        child.material.opacity = 0.45;
      }
    });

    return group;
  }

  // Create scaffold (under construction) model
  function createScaffold(buildingId, level, progress) {
    const def = VillageData.BUILDINGS[buildingId];
    const sz = def ? def.size : 1;
    const targetH = getBuildingHeight(buildingId, level) * 0.6;

    const group = new THREE.Group();

    // Scaffold frame (wooden posts)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8d6e52, roughness: 0.8, metalness: 0.1 });
    const postGeo = new THREE.BoxGeometry(0.06, targetH, 0.06);
    const halfSz = sz * 0.4;
    const corners = [
      [-halfSz, -halfSz], [-halfSz, halfSz],
      [halfSz, -halfSz], [halfSz, halfSz]
    ];
    for (const [ox, oz] of corners) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(ox, targetH / 2, oz);
      post.castShadow = true;
      group.add(post);
    }

    // Cross beams
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xaa8855, roughness: 0.7, metalness: 0.1 });
    // Diagonal beams on two faces
    for (let face = 0; face < 2; face++) {
      const beamGeo = new THREE.BoxGeometry(0.03, Math.sqrt(targetH * targetH + (sz * 0.8) * (sz * 0.8)), 0.03);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      const angle = Math.atan2(targetH, sz * 0.8);
      beam.position.y = targetH / 2;
      if (face === 0) {
        beam.position.z = halfSz;
        beam.rotation.z = angle;
      } else {
        beam.position.x = halfSz;
        beam.rotation.z = angle;
        beam.rotation.y = Math.PI / 2;
      }
      beam.castShadow = true;
      group.add(beam);
    }

    // Progress bar at base
    const barW = sz * 0.8;
    const barBg = new THREE.Mesh(
      new THREE.BoxGeometry(barW, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x333333 })
    );
    barBg.position.set(0, 0.03, halfSz + 0.08);
    group.add(barBg);

    const fillW = Math.max(0.01, barW * progress);
    const barFill = new THREE.Mesh(
      new THREE.BoxGeometry(fillW, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x2ee67a })
    );
    barFill.position.set((-barW + fillW) / 2, 0.03, halfSz + 0.08);
    barFill.name = 'progressBar';
    group.add(barFill);

    // Gear icon billboard (sprite)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const c = canvas.getContext('2d');
    c.font = '48px serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('\u2699', 32, 32); // gear icon
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, color: 0xf5c542 });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.y = targetH + 0.2;
    sprite.scale.set(0.3, 0.3, 1);
    group.add(sprite);

    group.userData.isScaffold = true;
    group.userData.buildingId = buildingId;

    return group;
  }

  // Preload all sprite textures (sync canvas) and models
  async function loadAll() {
    if (loaded) return;

    const allIds = Object.keys(VillageData.BUILDINGS);

    // Populate canvas sprite cache synchronously for all buildings × all tiers
    for (const id of allIds) {
      const maxTier = (VillageData.BUILDINGS[id].maxLevel <= 1) ? 1 : 3;
      for (let t = 1; t <= maxTier; t++) {
        ensureSpriteTexture(id, t);
      }
    }
    console.log(`[VillageBuildings] ${spriteTextureCache.size} canvas sprite textures cached`);

    // Try PNG upgrades in background (non-blocking)
    for (const id of allIds) {
      const maxTier = (VillageData.BUILDINGS[id].maxLevel <= 1) ? 1 : 3;
      for (let t = 1; t <= maxTier; t++) {
        tryPngUpgrade(id, t);
      }
    }

    // Also try .glb models in background (for barracks and future use)
    const priority = ['nexus', 'firewall', 'data_mine', 'code_forge', 'hashery', 'builder_hut'];
    const rest = allIds.filter(id => !priority.includes(id));
    await Promise.all(priority.map(id => loadModel(id)));
    Promise.all(rest.map(id => loadModel(id)));

    loaded = true;
  }

  function dispose() {
    modelCache.forEach((model) => {
      model.traverse(child => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      });
    });
    modelCache.clear();
    loadPromises.clear();

    // Dispose sprite textures
    spriteTextureCache.forEach((texture) => {
      texture.dispose();
    });
    spriteTextureCache.clear();
    spriteLoadPromises.clear();

    loaded = false;
  }

  return { loadAll, createBuilding, createGhost, createScaffold, getBuildingHeight, getBuildingTier, populateBarracksTroops, dispose };
})();
