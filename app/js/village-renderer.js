// village-renderer.js — Three.js scene, lighting, render loop, building sync
// Depends on: THREE (global), VillageCamera, VillageBuildings, VillageData

const VillageRenderer = (() => {
  const GRID = 24;
  const BORDER = 3;

  let container = null;
  let scene = null;
  let camera = null;
  let renderer = null;
  let raycaster = null;
  let mouse = new THREE.Vector2();

  // Scene groups
  let groundGroup = null;
  let buildingGroup = null;
  let decorGroup = null;
  let uiGroup = null; // selection rings, ghosts, etc.

  // Managed objects
  let buildingMeshes = new Map(); // key "x,y" → THREE.Group
  let queueMeshes = new Map();    // key "x,y" → THREE.Group
  let timerSprites = new Map();   // key "x,y" → { sprite, canvas, ctx, texture }
  let selectionRing = null;
  let ghostMesh = null;
  let wallGhostMeshes = [];
  let hoverTarget = null;
  let hoverOriginalEmissive = new Map();
  let lastTimerUpdate = 0;

  // Render loop
  let animFrameId = null;
  let lastTime = 0;
  let running = false;

  // Tooltip
  let tooltipEl = null;

  // Particles
  let particles = null;

  function init(cont) {
    container = cont;
    if (!container) return;

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;

    // Scene — sky background
    scene = new THREE.Scene();
    scene.background = createSkyGradient();
    scene.fog = new THREE.FogExp2(0xc8dff5, 0.008);

    // Orthographic Camera — true isometric
    const aspect = w / h;
    const frustumW = 30;
    const frustumH = frustumW / aspect;
    camera = new THREE.OrthographicCamera(
      -frustumW / 2, frustumW / 2,
      frustumH / 2, -frustumH / 2,
      0.1, 200
    );
    // Isometric camera position: 35.264° X rotation, 45° Y rotation
    const camDist = 50;
    camera.position.set(
      GRID / 2 + camDist * Math.cos(Math.PI / 4),
      camDist * Math.sin(Math.atan(Math.sqrt(2))),
      GRID / 2 + camDist * Math.sin(Math.PI / 4)
    );
    camera.lookAt(GRID / 2, 0, GRID / 2);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    // Raycaster
    raycaster = new THREE.Raycaster();

    // Scene groups
    groundGroup = new THREE.Group();
    groundGroup.name = 'ground';
    scene.add(groundGroup);

    buildingGroup = new THREE.Group();
    buildingGroup.name = 'buildings';
    scene.add(buildingGroup);

    decorGroup = new THREE.Group();
    decorGroup.name = 'decor';
    scene.add(decorGroup);

    uiGroup = new THREE.Group();
    uiGroup.name = 'ui';
    scene.add(uiGroup);

    // Lights
    setupLights();

    // Ground + grid + clouds
    createGround();
    createGridLines();
    createClouds();
    createParticles();

    // Tooltip element
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'village-3d-tooltip';
    tooltipEl.style.display = 'none';
    container.appendChild(tooltipEl);

    // Camera controller
    VillageCamera.init(camera, renderer.domElement, {
      minX: -BORDER, maxX: GRID + BORDER,
      minZ: -BORDER, maxZ: GRID + BORDER
    });

    // Hover tracking
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    // Resize observer
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => resize());
      ro.observe(container);
    }

    // Load building models in background
    VillageBuildings.loadAll();

    // Start render loop
    startLoop();
  }

  function setupLights() {
    // Directional sun — warm white, upper-left
    const sun = new THREE.DirectionalLight(0xfff8e7, 1.0);
    sun.position.set(-15, 25, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    // Ambient light — dark blue-gray
    const ambient = new THREE.AmbientLight(0x334466, 0.4);
    scene.add(ambient);

    // Hemisphere light — sky blue / warm ground
    const hemi = new THREE.HemisphereLight(0x88bbff, 0x886644, 0.35);
    scene.add(hemi);
  }

  // ===== Sky Gradient Background =====
  function createSkyGradient() {
    const cvs = document.createElement('canvas');
    cvs.width = 2;
    cvs.height = 256;
    const ctx = cvs.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#1a2e55');    // deep blue top
    grad.addColorStop(0.3, '#4488cc');  // mid blue
    grad.addColorStop(0.6, '#88bbee');  // light blue
    grad.addColorStop(0.85, '#c8dff5'); // pale horizon
    grad.addColorStop(1, '#e8f0fa');    // white-ish bottom
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
    const tex = new THREE.CanvasTexture(cvs);
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  // ===== Floating Island Ground =====
  // Deterministic hash for per-pixel variation
  function tileHash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
    h = ((h ^ (h >> 13)) * 1103515245 + 12345) | 0;
    return (h & 0x7fffffff) / 0x7fffffff; // 0..1
  }

  function createGround() {
    // 16-bit pixel art grass texture — per-pixel painting
    const texSize = 1024;
    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = texSize;
    grassCanvas.height = texSize;
    const gc = grassCanvas.getContext('2d');

    // Palette — lush 16-bit grassland
    const BASE_GREENS = [
      [58, 138, 58],   // #3a8a3a mid grass
      [63, 146, 64],   // #3f9240 bright grass
      [50, 120, 50],   // #327832 shadow grass
      [72, 155, 72],   // #489b48 highlight
      [45, 105, 45],   // #2d692d dark grass
      [80, 165, 80],   // #50a550 light patch
    ];
    const DIRT = [
      [90, 70, 45],    // #5a462d
      [100, 80, 52],   // #645034
      [78, 60, 38],    // #4e3c26
    ];
    const FLOWERS = [
      [255, 230, 100], // yellow daisy
      [200, 180, 255], // lavender
      [255, 180, 180], // pink
    ];
    const EDGE_COLORS = [
      [75, 100, 65],   // mossy edge
      [60, 85, 55],    // dark edge
      [85, 110, 70],   // light edge
    ];

    const totalTiles = GRID + BORDER * 2;
    const tilePixels = texSize / totalTiles;
    const px = Math.max(1, Math.floor(tilePixels / 8)); // pixel size within each tile

    // Paint per-pixel
    const imgData = gc.createImageData(texSize, texSize);
    const d = imgData.data;

    for (let py = 0; py < texSize; py++) {
      for (let px2 = 0; px2 < texSize; px2++) {
        const tileX = Math.floor(px2 / tilePixels);
        const tileY = Math.floor(py / tilePixels);
        const gx = tileX - BORDER;
        const gy = tileY - BORDER;
        const distX = gx < 0 ? -gx : (gx >= GRID ? gx - GRID + 1 : 0);
        const distY = gy < 0 ? -gy : (gy >= GRID ? gy - GRID + 1 : 0);
        const dist = Math.max(distX, distY);

        // Skip beyond island edge (transparent)
        if (dist > 1) continue;

        // Sub-pixel coords within tile (0..7 range for 8x8 pixel blocks)
        const subX = Math.floor(((px2 % tilePixels) / tilePixels) * 8);
        const subY = Math.floor(((py % tilePixels) / tilePixels) * 8);
        const h = tileHash(gx * 8 + subX, gy * 8 + subY, 0);
        const h2 = tileHash(gx * 8 + subX, gy * 8 + subY, 1);
        const h3 = tileHash(gx, gy, 2);

        let r, g, b;

        if (dist === 1) {
          // Island edge — mossy/earthy
          const ec = EDGE_COLORS[Math.floor(h * EDGE_COLORS.length)];
          const shade = 0.85 + h2 * 0.3;
          r = Math.floor(ec[0] * shade);
          g = Math.floor(ec[1] * shade);
          b = Math.floor(ec[2] * shade);
        } else {
          // Main grass area
          // Choose base color with subtle tile-level bias
          const tileBase = Math.floor(h3 * BASE_GREENS.length);
          const pixBase = h < 0.7 ? tileBase : Math.floor(h * BASE_GREENS.length);
          const base = BASE_GREENS[pixBase % BASE_GREENS.length];

          // Per-pixel shade variation
          const shade = 0.88 + h2 * 0.24;
          r = Math.floor(base[0] * shade);
          g = Math.floor(base[1] * shade);
          b = Math.floor(base[2] * shade);

          // Grass blade highlights — thin vertical streaks
          if (h > 0.85 && subY <= 2) {
            g = Math.min(255, g + 30);
            r = Math.max(0, r - 8);
          }

          // Small dirt patches (~5% of pixels, clustered)
          const dirtNoise = tileHash(Math.floor(gx / 2), Math.floor(gy / 2), 3);
          if (dirtNoise > 0.88 && h < 0.15) {
            const dc = DIRT[Math.floor(h2 * DIRT.length)];
            r = dc[0]; g = dc[1]; b = dc[2];
          }

          // Rare flowers (~1% of tiles, 1 pixel each)
          if (h3 > 0.96 && subX === 4 && subY === 3) {
            const fc = FLOWERS[Math.floor(h2 * FLOWERS.length)];
            r = fc[0]; g = fc[1]; b = fc[2];
          }

          // Subtle shadow around edges of each tile (grid lines feel)
          if (subX === 0 || subY === 0) {
            r = Math.floor(r * 0.92);
            g = Math.floor(g * 0.92);
            b = Math.floor(b * 0.92);
          }
        }

        const idx = (py * texSize + px2) * 4;
        d[idx] = Math.min(255, Math.max(0, r));
        d[idx + 1] = Math.min(255, Math.max(0, g));
        d[idx + 2] = Math.min(255, Math.max(0, b));
        d[idx + 3] = 255;
      }
    }

    gc.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(grassCanvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;

    // Top surface
    const planeSize = GRID + BORDER * 2;
    const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    planeGeo.rotateX(-Math.PI / 2);

    const planeMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.0,
      transparent: true
    });

    const ground = new THREE.Mesh(planeGeo, planeMat);
    ground.receiveShadow = true;
    ground.position.set(GRID / 2, 0, GRID / 2);
    ground.name = 'groundPlane';
    groundGroup.add(ground);

    // Island underside — rocky cliff
    createIslandCliff();
  }

  function createIslandCliff() {
    const halfGrid = GRID / 2;
    const topR = (GRID + BORDER * 2) / 2; // top radius matches ground plane
    const depth = 4;
    const segments = 32;

    // Cone-like underside using a custom cylinder
    const cliffGeo = new THREE.CylinderGeometry(topR * 1.1, topR * 0.15, depth, segments, 4, true);
    // Randomize vertices for rocky look
    const pos = cliffGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Only jitter lower vertices (not the very top ring)
      if (y < depth / 2 - 0.1) {
        const factor = 1 - (y + depth / 2) / depth; // 0 at top, 1 at bottom
        const jitter = factor * 0.6;
        pos.setX(i, x + (Math.sin(i * 7.3) * jitter));
        pos.setZ(i, z + (Math.cos(i * 11.1) * jitter));
      }
    }
    cliffGeo.computeVertexNormals();

    // Dirt/rock texture canvas
    const rockCvs = document.createElement('canvas');
    rockCvs.width = 128;
    rockCvs.height = 128;
    const rc = rockCvs.getContext('2d');
    const ROCK_COLORS = ['#5a4e3a', '#6e5e44', '#4a3e2a', '#7a6a50', '#3e3424'];
    for (let ry = 0; ry < 32; ry++) {
      for (let rx = 0; rx < 32; rx++) {
        rc.fillStyle = ROCK_COLORS[(rx * 7 + ry * 13) % ROCK_COLORS.length];
        rc.fillRect(rx * 4, ry * 4, 4, 4);
      }
    }
    const rockTex = new THREE.CanvasTexture(rockCvs);
    rockTex.wrapS = THREE.RepeatWrapping;
    rockTex.wrapT = THREE.RepeatWrapping;
    rockTex.repeat.set(4, 2);
    rockTex.magFilter = THREE.NearestFilter;

    const cliffMat = new THREE.MeshStandardMaterial({
      map: rockTex,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.BackSide // render inside of cylinder = outside of inverted cone
    });

    const cliff = new THREE.Mesh(cliffGeo, cliffMat);
    cliff.position.set(GRID / 2, -depth / 2, GRID / 2);
    cliff.receiveShadow = true;
    cliff.name = 'islandCliff';
    groundGroup.add(cliff);

    // Bottom cap — small circle at the tip
    const capGeo = new THREE.CircleGeometry(topR * 0.15, segments);
    capGeo.rotateX(Math.PI / 2); // face downward
    const capMat = new THREE.MeshStandardMaterial({ color: 0x3e3424, roughness: 1.0 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(GRID / 2, -depth, GRID / 2);
    groundGroup.add(cap);
  }

  // ===== Grid Lines =====
  function createGridLines() {
    const gridHelper = new THREE.GridHelper(GRID, GRID, 0xffffff, 0xffffff);
    gridHelper.position.set(GRID / 2, 0.005, GRID / 2);
    gridHelper.material.opacity = 0.06;
    gridHelper.material.transparent = true;
    groundGroup.add(gridHelper);
  }

  // ===== Clouds =====
  let cloudMeshes = [];

  function createClouds() {
    const cloudCount = 18;
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.7
    });

    for (let i = 0; i < cloudCount; i++) {
      const seed = Math.abs((i * 37 + i * i * 11) % 1000);
      const cloudGroup = new THREE.Group();

      // Each cloud = cluster of 3-6 spheres
      const blobCount = 3 + (seed % 4);
      for (let b = 0; b < blobCount; b++) {
        const r = 0.6 + (((seed + b * 17) % 100) / 100) * 1.2;
        const blobGeo = new THREE.SphereGeometry(r, 8, 6);
        const blob = new THREE.Mesh(blobGeo, cloudMat);
        blob.position.set(
          (b - blobCount / 2) * r * 0.9 + ((seed + b * 7) % 30 - 15) * 0.04,
          ((seed + b * 13) % 20 - 10) * 0.03,
          ((seed + b * 23) % 20 - 10) * 0.06
        );
        blob.scale.y = 0.4 + ((seed + b) % 30) / 100; // flatten vertically
        cloudGroup.add(blob);
      }

      // Position clouds around and below the island
      const angle = (i / cloudCount) * Math.PI * 2 + (seed % 100) / 200;
      const radius = 12 + (seed % 40);
      const yPos = -2 - (seed % 60) / 10; // below island, varying depths

      cloudGroup.position.set(
        GRID / 2 + Math.cos(angle) * radius,
        yPos,
        GRID / 2 + Math.sin(angle) * radius
      );
      cloudGroup.scale.setScalar(0.8 + (seed % 50) / 100);
      cloudGroup.userData.baseY = yPos;
      cloudGroup.userData.driftSpeed = 0.1 + (seed % 50) / 200;
      cloudGroup.userData.driftAngle = angle;
      cloudGroup.userData.driftRadius = radius;

      decorGroup.add(cloudGroup);
      cloudMeshes.push(cloudGroup);
    }
  }

  function animateClouds(time) {
    const t = time * 0.001;
    for (const cloud of cloudMeshes) {
      const ud = cloud.userData;
      // Slow circular drift
      const a = ud.driftAngle + t * ud.driftSpeed * 0.02;
      cloud.position.x = GRID / 2 + Math.cos(a) * ud.driftRadius;
      cloud.position.z = GRID / 2 + Math.sin(a) * ud.driftRadius;
      // Gentle vertical bob
      cloud.position.y = ud.baseY + Math.sin(t * 0.3 + ud.driftAngle * 5) * 0.3;
    }
  }

  // ===== Atmospheric Particles =====
  function createParticles() {
    const count = 60;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = Math.random() * GRID;
      positions[i * 3 + 1] = 0.5 + Math.random() * 4;
      positions[i * 3 + 2] = Math.random() * GRID;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffeebb,
      size: 0.07,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true
    });
    particles = new THREE.Points(geo, mat);
    decorGroup.add(particles);
  }

  function animateParticles(time) {
    if (!particles) return;
    const pos = particles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const baseY = 1 + ((i * 37) % 100) / 33;
      pos.setY(i, baseY + Math.sin(time * 0.001 + i * 0.7) * 0.3);
    }
    pos.needsUpdate = true;
  }

  // ===== Build Timer Sprites =====
  function createTimerSprite(endTime, buildingSize) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(mat);
    // Scale sprite to a reasonable size above the building
    sprite.scale.set(1.2, 0.3, 1);
    sprite.userData.endTime = endTime;
    sprite.userData.canvas = canvas;
    sprite.userData.ctx = ctx;
    sprite.userData.texture = texture;

    // Initial draw
    drawTimerText(ctx, canvas, texture, endTime);

    return sprite;
  }

  function drawTimerText(ctx, canvas, texture, endTime) {
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    let timeStr;
    if (remaining < 60) {
      timeStr = remaining + 's';
    } else if (remaining < 3600) {
      timeStr = Math.floor(remaining / 60) + 'm ' + (remaining % 60) + 's';
    } else {
      timeStr = Math.floor(remaining / 3600) + 'h ' + Math.floor((remaining % 3600) / 60) + 'm';
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const textWidth = Math.max(60, timeStr.length * 9 + 16);
    const x = (canvas.width - textWidth) / 2;
    ctx.beginPath();
    ctx.roundRect(x, 2, textWidth, 28, 4);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(245, 197, 66, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, 2, textWidth, 28, 4);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#f5c542';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, canvas.width / 2, 16);

    texture.needsUpdate = true;
  }

  function updateTimerSprites() {
    const now = Date.now();
    // Only update once per second
    if (now - lastTimerUpdate < 1000) return;
    lastTimerUpdate = now;

    for (const [key, timerData] of timerSprites) {
      const sprite = timerData;
      if (!sprite.userData.endTime) continue;
      drawTimerText(
        sprite.userData.ctx,
        sprite.userData.canvas,
        sprite.userData.texture,
        sprite.userData.endTime
      );
    }
  }

  // ===== Barracks Troop Figure Sync =====
  let lastBarracksTroopCount = -1;

  function updateBarracksTroops(mesh, villageState) {
    // Count total troops housed
    let troopCount = 0;
    if (villageState && villageState.troops) {
      for (const t of villageState.troops) {
        troopCount += t.count || 0;
      }
    }

    // Only rebuild figures if count changed
    if (mesh.userData._troopCount === troopCount) return;
    mesh.userData._troopCount = troopCount;

    const container = mesh.getObjectByName('troopContainer');
    if (!container) return;

    const def = VillageData.BUILDINGS.barracks;
    const sz = def ? def.size : 2;
    // Show up to 12 figures — proportional to actual troop count vs housing cap
    const cap = VillageData.getHousingCapacity(villageState);
    const visibleCount = cap > 0 ? Math.min(12, Math.ceil((troopCount / cap) * 12)) : 0;

    VillageBuildings.populateBarracksTroops(container, visibleCount, sz);
  }

  // ===== Building Sync =====
  function syncBuildings(villageState) {
    if (!villageState || !scene) return;

    // Track which positions are still valid
    const validKeys = new Set();
    const validQueueKeys = new Set();

    // Sync placed buildings
    villageState.buildings.forEach((b, idx) => {
      const def = VillageData.BUILDINGS[b.id];
      if (!def) return;
      const key = `${b.x},${b.y}`;
      validKeys.add(key);

      const existing = buildingMeshes.get(key);
      const newTier = VillageBuildings.getBuildingTier(b.id, b.level);
      if (existing && existing.userData.buildingId === b.id && existing.userData.tier === newTier) {
        // Still update barracks troop figures (troop count may have changed)
        if (b.id === 'barracks') {
          updateBarracksTroops(existing, villageState);
        }
        return;
      }

      // Remove old mesh if exists
      if (existing) {
        buildingGroup.remove(existing);
      }

      // Create new building mesh
      const mesh = VillageBuildings.createBuilding(b.id, b.level);
      // Position: grid coords → world coords (1 unit per tile, centered in tile)
      const sz = def.size;
      mesh.position.set(b.x + sz / 2, 0, b.y + sz / 2);
      mesh.userData.buildingIndex = idx;
      mesh.userData.buildingId = b.id;
      mesh.userData.level = b.level;
      mesh.userData.key = key;

      buildingGroup.add(mesh);
      buildingMeshes.set(key, mesh);
    });

    // Sync build queue items
    const validTimerKeys = new Set();
    if (villageState.buildQueue) {
      const now = Date.now();
      for (const q of villageState.buildQueue) {
        const def = VillageData.BUILDINGS[q.buildingId];
        if (!def) continue;
        const key = `q${q.x},${q.y}`;
        validQueueKeys.add(key);
        validTimerKeys.add(key);

        const progress = Math.min(1, (now - q.startTime) / (q.endTime - q.startTime));
        const existing = queueMeshes.get(key);

        if (existing) {
          // Update progress bar
          const bar = existing.getObjectByName('progressBar');
          if (bar) {
            const barW = def.size * 0.8;
            const fillW = Math.max(0.01, barW * progress);
            bar.scale.x = fillW / (def.size * 0.8);
            bar.position.x = (-barW + fillW) / 2;
          }
          // Update timer endTime in case it changed (e.g. chronos skip)
          const timer = timerSprites.get(key);
          if (timer) timer.userData.endTime = q.endTime;
          continue;
        }

        // Create scaffold
        const scaffold = VillageBuildings.createScaffold(q.buildingId, q.level, progress);
        const sz = def.size;
        scaffold.position.set(q.x + sz / 2, 0, q.y + sz / 2);
        scaffold.userData.key = key;
        buildingGroup.add(scaffold);
        queueMeshes.set(key, scaffold);

        // Create timer sprite above scaffold
        const timerSprite = createTimerSprite(q.endTime, sz);
        timerSprite.position.set(q.x + sz / 2, sz * 0.8 + 0.6, q.y + sz / 2);
        uiGroup.add(timerSprite);
        timerSprites.set(key, timerSprite);
      }
    }

    // Remove buildings no longer in state
    for (const [key, mesh] of buildingMeshes) {
      if (!validKeys.has(key)) {
        buildingGroup.remove(mesh);
        buildingMeshes.delete(key);
      }
    }
    for (const [key, mesh] of queueMeshes) {
      if (!validQueueKeys.has(key)) {
        buildingGroup.remove(mesh);
        queueMeshes.delete(key);
      }
    }
    // Remove timer sprites for completed/removed queue items
    for (const [key, sprite] of timerSprites) {
      if (!validTimerKeys.has(key)) {
        uiGroup.remove(sprite);
        timerSprites.delete(key);
      }
    }
  }

  // ===== Ghost Preview =====
  function setGhostPreview(id, level, x, y, valid) {
    clearGhostPreview();

    const def = VillageData.BUILDINGS[id];
    if (!def) return;
    const sz = def.size;

    ghostMesh = VillageBuildings.createGhost(id, level);

    // Tint based on validity
    const tintColor = valid ? 0x2ee67a : 0xff4455;
    ghostMesh.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.color.set(tintColor);
        child.material.opacity = 0.4;
      }
      if (child.isSprite && child.material) {
        child.material.color.set(tintColor);
        child.material.opacity = 0.4;
      }
    });

    ghostMesh.position.set(x + sz / 2, 0, y + sz / 2);
    uiGroup.add(ghostMesh);

    // Footprint outline
    const outlineGeo = new THREE.PlaneGeometry(sz, sz);
    outlineGeo.rotateX(-Math.PI / 2);
    const outlineMat = new THREE.MeshBasicMaterial({
      color: valid ? 0x2ee67a : 0xff4455,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    const outline = new THREE.Mesh(outlineGeo, outlineMat);
    outline.position.set(x + sz / 2, 0.01, y + sz / 2);
    outline.name = 'ghostOutline';
    uiGroup.add(outline);
  }

  function clearGhostPreview() {
    if (ghostMesh) {
      uiGroup.remove(ghostMesh);
      ghostMesh = null;
    }
    // Remove outline
    const outline = uiGroup.getObjectByName('ghostOutline');
    if (outline) uiGroup.remove(outline);
  }

  // ===== Wall Ghost Spots =====
  function setWallGhosts(positions) {
    clearWallGhosts();
    for (const pos of positions) {
      const geo = new THREE.PlaneGeometry(0.8, 0.8);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x8d6e52,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x + 0.5, 0.02, pos.y + 0.5);
      mesh.userData.wallGhost = true;
      mesh.userData.gx = pos.x;
      mesh.userData.gy = pos.y;
      uiGroup.add(mesh);
      wallGhostMeshes.push(mesh);
    }
  }

  function clearWallGhosts() {
    for (const mesh of wallGhostMeshes) {
      uiGroup.remove(mesh);
    }
    wallGhostMeshes = [];
  }

  // ===== Selection Ring =====
  function setSelection(x, y, size) {
    clearSelection();

    const sz = size || 1;
    const ringGeo = new THREE.RingGeometry(sz * 0.45, sz * 0.52, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf5c542,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.position.set(x + sz / 2, 0.02, y + sz / 2);
    selectionRing.name = 'selectionRing';
    uiGroup.add(selectionRing);

    // Glow outline on selected building (skip for sprites — ring is sufficient)
    const key = `${x},${y}`;
    const building = buildingMeshes.get(key);
    if (building && !building.userData.isSprite) {
      const outlineGroup = new THREE.Group();
      outlineGroup.name = 'selectionGlow';
      building.traverse(child => {
        if (child.isMesh) {
          const clone = child.clone();
          clone.material = new THREE.MeshBasicMaterial({
            color: 0xf5c542,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
          });
          clone.scale.multiplyScalar(1.06);
          outlineGroup.add(clone);
        }
      });
      outlineGroup.position.copy(building.position);
      uiGroup.add(outlineGroup);
    }
  }

  function clearSelection() {
    if (selectionRing) {
      uiGroup.remove(selectionRing);
      selectionRing = null;
    }
    const glow = uiGroup.getObjectByName('selectionGlow');
    if (glow) uiGroup.remove(glow);
  }

  // ===== Selection Ring Pulse Animation =====
  function animateSelectionRing(time) {
    if (!selectionRing) return;
    const pulse = 1.0 + Math.sin(time * 0.003) * 0.05;
    selectionRing.scale.set(pulse, 1, pulse);
  }

  // ===== Hover Highlight =====
  function setHover(mesh) {
    if (hoverTarget === mesh) return;
    clearHover();
    if (!mesh) return;
    hoverTarget = mesh;

    // Find the parent building group
    let group = mesh;
    while (group.parent && group.parent !== buildingGroup) {
      group = group.parent;
    }

    // Detect sprite buildings vs mesh buildings
    if (group.userData.isSprite) {
      group.traverse(child => {
        if (child.isSprite && child.material) {
          hoverOriginalEmissive.set(child, child.material.color.getHex());
          child.material.color.set(0xddddff);
        }
      });
    } else {
      group.traverse(child => {
        if (child.isMesh && child.material && child.material.emissive) {
          hoverOriginalEmissive.set(child, child.material.emissiveIntensity);
          child.material.emissiveIntensity = (child.material.emissiveIntensity || 0) + 0.15;
        }
      });
    }
  }

  function clearHover() {
    if (!hoverTarget) return;
    let group = hoverTarget;
    while (group.parent && group.parent !== buildingGroup) {
      group = group.parent;
    }
    if (group.userData.isSprite) {
      group.traverse(child => {
        if (child.isSprite && hoverOriginalEmissive.has(child)) {
          child.material.color.set(hoverOriginalEmissive.get(child));
        }
      });
    } else {
      group.traverse(child => {
        if (child.isMesh && hoverOriginalEmissive.has(child)) {
          child.material.emissiveIntensity = hoverOriginalEmissive.get(child);
        }
      });
    }
    hoverOriginalEmissive.clear();
    hoverTarget = null;
  }

  function onMouseMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast for hover
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(buildingGroup.children, true);
    if (hits.length > 0) {
      setHover(hits[0].object);
      renderer.domElement.style.cursor = 'pointer';
    } else {
      clearHover();
      renderer.domElement.style.cursor = 'grab';
    }
  }

  // ===== Raycasting =====
  function raycastToTile(event) {
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

    // Intersect ground plane (Y = 0)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);

    if (intersection) {
      const gx = Math.floor(intersection.x);
      const gy = Math.floor(intersection.z);
      return {
        x: Math.max(0, Math.min(gx, GRID - 1)),
        y: Math.max(0, Math.min(gy, GRID - 1))
      };
    }
    return null;
  }

  function raycastToBuilding(event) {
    if (!renderer || !camera) return -1;
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
    const hits = raycaster.intersectObjects(buildingGroup.children, true);

    for (const hit of hits) {
      // Walk up to find the building group
      let obj = hit.object;
      while (obj && obj.parent !== buildingGroup) {
        obj = obj.parent;
      }
      if (obj && obj.userData.buildingIndex !== undefined) {
        return obj.userData.buildingIndex;
      }
    }
    return -1;
  }

  function raycastToWallGhost(event) {
    if (!renderer || !camera || wallGhostMeshes.length === 0) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
    const hits = raycaster.intersectObjects(wallGhostMeshes, false);
    if (hits.length > 0) {
      const obj = hits[0].object;
      if (obj.userData.wallGhost) {
        return { x: obj.userData.gx, y: obj.userData.gy };
      }
    }
    return null;
  }

  // ===== Tooltip =====
  function showTooltip(msg) {
    if (!tooltipEl) return;
    tooltipEl.textContent = msg;
    tooltipEl.style.display = 'block';
    clearTimeout(tooltipEl._hideTimer);
    tooltipEl._hideTimer = setTimeout(() => {
      tooltipEl.style.display = 'none';
    }, 3000);
  }

  // ===== Render Loop =====
  function renderFrame(time) {
    if (!running) return;
    animFrameId = requestAnimationFrame(renderFrame);

    const deltaTime = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;

    VillageCamera.update(deltaTime);
    animateSelectionRing(time);
    animateParticles(time);
    animateClouds(time);
    updateTimerSprites();

    // Scale timer sprites inversely with zoom so they stay readable
    const zoom = VillageCamera.getZoom();
    const invZoom = 1 / Math.max(zoom, 0.5);
    for (const [key, sprite] of timerSprites) {
      sprite.scale.set(1.2 * invZoom, 0.3 * invZoom, 1);
    }

    renderer.render(scene, camera);
  }

  function startLoop() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    animFrameId = requestAnimationFrame(renderFrame);
  }

  function stopLoop() {
    running = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function resize() {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    VillageCamera.resize();
  }

  function dispose() {
    stopLoop();
    VillageCamera.dispose();
    VillageBuildings.dispose();

    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
    if (tooltipEl && tooltipEl.parentNode) {
      tooltipEl.parentNode.removeChild(tooltipEl);
    }

    buildingMeshes.clear();
    queueMeshes.clear();
    timerSprites.clear();
    wallGhostMeshes = [];

    scene = null;
    camera = null;
    renderer = null;
    container = null;
  }

  function getScene() { return scene; }

  return {
    init,
    syncBuildings,
    setGhostPreview,
    clearGhostPreview,
    setWallGhosts,
    clearWallGhosts,
    setSelection,
    clearSelection,
    raycastToTile,
    raycastToBuilding,
    raycastToWallGhost,
    showTooltip,
    startLoop,
    stopLoop,
    resize,
    dispose,
    getScene
  };
})();
