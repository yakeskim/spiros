// village-data.js — All static definitions for the Village metagame
// Buildings, troops, raiders, Nexus gates, resource caps

const VillageData = (() => {

  // ===== Building Categories =====
  const CATEGORIES = {
    resource: { name: 'Resource', color: '#2ee67a', icon: '⛏' },
    storage:  { name: 'Storage',  color: '#4488ff', icon: '🗄' },
    defense:  { name: 'Defense',  color: '#ff4455', icon: '▓' },
    military: { name: 'Military', color: '#cc44ff', icon: '⚙' },
    utility:  { name: 'Utility',  color: '#f5c542', icon: '✦' }
  };

  // ===== 20 Buildings =====
  // Each building: id, name, icon, category, size (tiles), maxLevel,
  //   costs per level (arrays), production/effect per level, nexusReq, desc
  const BUILDINGS = {
    // --- Resource (5) ---
    data_mine: {
      id: 'data_mine', name: 'Data Mine', icon: '⛏', category: 'resource',
      size: 2, maxLevel: 10, nexusReq: 1,
      desc: 'Generates gold passively over time.',
      costs: [
        { gold: 50, wood: 20 },
        { gold: 120, wood: 50 },
        { gold: 250, wood: 100, stone: 30 },
        { gold: 500, wood: 200, stone: 80 },
        { gold: 900, wood: 350, stone: 150 },
        { gold: 1500, wood: 550, stone: 250 },
        { gold: 2200, wood: 800, stone: 400 },
        { gold: 3200, wood: 1100, stone: 600 },
        { gold: 4500, wood: 1500, stone: 850 },
        { gold: 6000, wood: 2000, stone: 1100 }
      ],
      production: [3, 6, 10, 15, 22, 30, 40, 52, 66, 82] // gold/hr
    },
    code_forge: {
      id: 'code_forge', name: 'Code Forge', icon: '🔨', category: 'resource',
      size: 2, maxLevel: 10, nexusReq: 1,
      desc: 'Generates wood passively over time.',
      costs: [
        { gold: 40, wood: 10 },
        { gold: 100, wood: 40 },
        { gold: 220, wood: 90, stone: 20 },
        { gold: 440, wood: 180, stone: 60 },
        { gold: 800, wood: 300, stone: 120 },
        { gold: 1300, wood: 480, stone: 200 },
        { gold: 2000, wood: 700, stone: 340 },
        { gold: 2900, wood: 1000, stone: 520 },
        { gold: 4000, wood: 1350, stone: 720 },
        { gold: 5500, wood: 1800, stone: 950 }
      ],
      production: [2, 5, 8, 12, 18, 25, 34, 44, 56, 70] // wood/hr
    },
    hashery: {
      id: 'hashery', name: 'Hashery', icon: '#', category: 'resource',
      size: 2, maxLevel: 8, nexusReq: 2,
      desc: 'Generates stone passively over time.',
      costs: [
        { gold: 100, wood: 60 },
        { gold: 250, wood: 140, stone: 40 },
        { gold: 500, wood: 280, stone: 100 },
        { gold: 900, wood: 450, stone: 200 },
        { gold: 1500, wood: 700, stone: 350 },
        { gold: 2300, wood: 1000, stone: 550 },
        { gold: 3400, wood: 1400, stone: 800 },
        { gold: 4800, wood: 1900, stone: 1100 }
      ],
      production: [2, 4, 7, 11, 16, 22, 30, 40] // stone/hr
    },
    crypto_mint: {
      id: 'crypto_mint', name: 'Crypto Mint', icon: '◆', category: 'resource',
      size: 3, maxLevel: 5, nexusReq: 7,
      desc: 'Slowly generates gems over time. Very rare resource.',
      costs: [
        { gold: 3000, wood: 1500, stone: 800 },
        { gold: 5000, wood: 2500, stone: 1400 },
        { gold: 8000, wood: 4000, stone: 2200 },
        { gold: 12000, wood: 6000, stone: 3500 },
        { gold: 18000, wood: 9000, stone: 5000 }
      ],
      production: [0.2, 0.5, 0.8, 1.2, 2] // gems/hr
    },
    amplifier_node: {
      id: 'amplifier_node', name: 'Amplifier Node', icon: '◉', category: 'resource',
      size: 2, maxLevel: 5, nexusReq: 4,
      desc: 'Boosts resource gain from PC activity by a percentage.',
      costs: [
        { gold: 800, wood: 400, stone: 200 },
        { gold: 1600, wood: 800, stone: 400 },
        { gold: 3000, wood: 1500, stone: 800 },
        { gold: 5000, wood: 2500, stone: 1400 },
        { gold: 8000, wood: 4000, stone: 2200 }
      ],
      production: [5, 10, 16, 23, 30] // % boost to activity resources
    },

    // --- Storage (3) ---
    data_vault: {
      id: 'data_vault', name: 'Data Vault', icon: '🗄', category: 'storage',
      size: 2, maxLevel: 8, nexusReq: 2,
      desc: 'Increases gold and wood storage caps.',
      costs: [
        { gold: 80, wood: 50 },
        { gold: 200, wood: 120 },
        { gold: 400, wood: 250, stone: 60 },
        { gold: 750, wood: 450, stone: 150 },
        { gold: 1200, wood: 700, stone: 300 },
        { gold: 1900, wood: 1100, stone: 500 },
        { gold: 2800, wood: 1600, stone: 750 },
        { gold: 4000, wood: 2200, stone: 1050 }
      ],
      production: [200, 400, 650, 950, 1300, 1700, 2200, 2800] // +cap gold & wood each
    },
    cache_array: {
      id: 'cache_array', name: 'Cache Array', icon: '📦', category: 'storage',
      size: 2, maxLevel: 6, nexusReq: 3,
      desc: 'Increases stone storage cap.',
      costs: [
        { gold: 150, wood: 80, stone: 50 },
        { gold: 350, wood: 200, stone: 120 },
        { gold: 700, wood: 400, stone: 250 },
        { gold: 1200, wood: 700, stone: 450 },
        { gold: 2000, wood: 1100, stone: 700 },
        { gold: 3200, wood: 1700, stone: 1050 }
      ],
      production: [150, 300, 500, 750, 1050, 1400] // +cap stone
    },
    quantum_safe: {
      id: 'quantum_safe', name: 'Quantum Safe', icon: '🔒', category: 'storage',
      size: 2, maxLevel: 5, nexusReq: 5,
      desc: 'Protects a percentage of resources from raid losses.',
      costs: [
        { gold: 1000, wood: 500, stone: 300, gems: 5 },
        { gold: 2000, wood: 1000, stone: 600, gems: 10 },
        { gold: 3500, wood: 1800, stone: 1000, gems: 15 },
        { gold: 5500, wood: 2800, stone: 1600, gems: 25 },
        { gold: 8000, wood: 4000, stone: 2400, gems: 40 }
      ],
      production: [10, 20, 35, 50, 70] // % protected from raids
    },

    // --- Defense (5) ---
    firewall: {
      id: 'firewall', name: 'Firewall', icon: '▓', category: 'defense',
      size: 1, maxLevel: 1, nexusReq: 1,
      desc: 'Blocks raider pathfinding. Place multiple walls to create barriers. Limit based on player level.',
      costs: [
        { gold: 30, stone: 15 }
      ],
      production: [50] // HP
    },
    turret_node: {
      id: 'turret_node', name: 'Turret Node', icon: '⊕', category: 'defense',
      size: 2, maxLevel: 8, nexusReq: 2,
      desc: 'Fires at nearby raiders. Single-target, medium range.',
      costs: [
        { gold: 100, wood: 30, stone: 40 },
        { gold: 250, wood: 80, stone: 100 },
        { gold: 500, wood: 160, stone: 200 },
        { gold: 900, wood: 300, stone: 380 },
        { gold: 1500, wood: 480, stone: 600 },
        { gold: 2300, wood: 720, stone: 900 },
        { gold: 3400, wood: 1050, stone: 1300 },
        { gold: 4800, wood: 1450, stone: 1750 }
      ],
      production: [8, 14, 22, 32, 44, 58, 75, 95] // dmg per shot
    },
    emp_tower: {
      id: 'emp_tower', name: 'EMP Tower', icon: '⚡', category: 'defense',
      size: 2, maxLevel: 6, nexusReq: 4,
      desc: 'Slows all raiders in range. AoE debuff.',
      costs: [
        { gold: 600, wood: 200, stone: 300 },
        { gold: 1200, wood: 450, stone: 600 },
        { gold: 2200, wood: 800, stone: 1050 },
        { gold: 3600, wood: 1300, stone: 1650 },
        { gold: 5500, wood: 1900, stone: 2400 },
        { gold: 8000, wood: 2700, stone: 3400 }
      ],
      production: [20, 30, 40, 50, 60, 70] // % slow, range 3
    },
    honeypot: {
      id: 'honeypot', name: 'Honeypot', icon: '🍯', category: 'defense',
      size: 2, maxLevel: 6, nexusReq: 3,
      desc: 'Lures nearby raiders to attack it instead of other buildings.',
      costs: [
        { gold: 200, wood: 100, stone: 80 },
        { gold: 450, wood: 220, stone: 180 },
        { gold: 850, wood: 420, stone: 340 },
        { gold: 1500, wood: 720, stone: 600 },
        { gold: 2400, wood: 1100, stone: 950 },
        { gold: 3800, wood: 1650, stone: 1400 }
      ],
      production: [100, 200, 350, 550, 800, 1100] // HP (decoy)
    },
    killswitch_mine: {
      id: 'killswitch_mine', name: 'Killswitch Mine', icon: '💣', category: 'defense',
      size: 1, maxLevel: 6, nexusReq: 4,
      desc: 'Explodes on contact, dealing AoE damage. One use per raid.',
      costs: [
        { gold: 150, stone: 100 },
        { gold: 350, stone: 220 },
        { gold: 700, stone: 440 },
        { gold: 1200, stone: 750 },
        { gold: 2000, stone: 1200 },
        { gold: 3200, stone: 1800 }
      ],
      production: [40, 70, 110, 160, 220, 300] // explosion dmg, radius 2
    },
    sniper_tower: {
      id: 'sniper_tower', name: 'Sniper Tower', icon: '🎯', category: 'defense',
      size: 1, maxLevel: 10, nexusReq: 3,
      desc: 'Long-range single-target tower. Prioritizes highest-HP attacker.',
      costs: [
        { gold: 200, wood: 80, stone: 120 },
        { gold: 450, wood: 180, stone: 260 },
        { gold: 850, wood: 340, stone: 500 },
        { gold: 1400, wood: 560, stone: 820 },
        { gold: 2200, wood: 880, stone: 1300 },
        { gold: 3400, wood: 1350, stone: 2000 },
        { gold: 5000, wood: 2000, stone: 3000 },
        { gold: 7200, wood: 2900, stone: 4300 },
        { gold: 10000, wood: 4000, stone: 6000 },
        { gold: 14000, wood: 5600, stone: 8400 }
      ],
      production: [15, 25, 38, 54, 72, 94, 120, 150, 185, 225], // dmg per shot
      defenseStats: [
        { damage: 15, range: 6, fireRate: 4, splashRadius: 0, special: 'snipe_highest' },
        { damage: 25, range: 6, fireRate: 4, splashRadius: 0, special: 'snipe_highest' },
        { damage: 38, range: 7, fireRate: 4, splashRadius: 0, special: 'snipe_highest' },
        { damage: 54, range: 7, fireRate: 3, splashRadius: 0, special: 'snipe_highest' },
        { damage: 72, range: 7, fireRate: 3, splashRadius: 0, special: 'snipe_highest' },
        { damage: 94, range: 8, fireRate: 3, splashRadius: 0, special: 'snipe_highest' },
        { damage: 120, range: 8, fireRate: 3, splashRadius: 0, special: 'snipe_highest' },
        { damage: 150, range: 8, fireRate: 2, splashRadius: 0, special: 'snipe_highest' },
        { damage: 185, range: 9, fireRate: 2, splashRadius: 0, special: 'snipe_highest' },
        { damage: 225, range: 9, fireRate: 2, splashRadius: 0, special: 'snipe_highest' }
      ]
    },
    plasma_turret: {
      id: 'plasma_turret', name: 'Plasma Turret', icon: '⚡', category: 'defense',
      size: 1, maxLevel: 10, nexusReq: 4,
      desc: 'Fast-firing energy turret for close defense.',
      costs: [
        { gold: 250, wood: 100, stone: 150 },
        { gold: 550, wood: 220, stone: 330 },
        { gold: 1000, wood: 400, stone: 600 },
        { gold: 1700, wood: 680, stone: 1000 },
        { gold: 2700, wood: 1080, stone: 1600 },
        { gold: 4000, wood: 1600, stone: 2400 },
        { gold: 5800, wood: 2300, stone: 3500 },
        { gold: 8200, wood: 3300, stone: 5000 },
        { gold: 11500, wood: 4600, stone: 6900 },
        { gold: 16000, wood: 6400, stone: 9600 }
      ],
      production: [6, 10, 15, 21, 28, 37, 48, 61, 76, 94], // dmg per shot
      defenseStats: [
        { damage: 6, range: 3, fireRate: 1, splashRadius: 0, special: null },
        { damage: 10, range: 3, fireRate: 1, splashRadius: 0, special: null },
        { damage: 15, range: 3, fireRate: 1, splashRadius: 0, special: null },
        { damage: 21, range: 4, fireRate: 1, splashRadius: 0, special: null },
        { damage: 28, range: 4, fireRate: 1, splashRadius: 0, special: null },
        { damage: 37, range: 4, fireRate: 1, splashRadius: 0, special: null },
        { damage: 48, range: 5, fireRate: 1, splashRadius: 0, special: null },
        { damage: 61, range: 5, fireRate: 1, splashRadius: 0, special: null },
        { damage: 76, range: 5, fireRate: 1, splashRadius: 0, special: null },
        { damage: 94, range: 5, fireRate: 1, splashRadius: 0, special: null }
      ]
    },
    space_cannon: {
      id: 'space_cannon', name: 'Space Cannon', icon: '🛸', category: 'defense',
      size: 2, maxLevel: 10, nexusReq: 6,
      desc: 'Heavy orbital strike — slow but devastating area damage.',
      costs: [
        { gold: 1500, wood: 600, stone: 900 },
        { gold: 3000, wood: 1200, stone: 1800 },
        { gold: 5000, wood: 2000, stone: 3000 },
        { gold: 8000, wood: 3200, stone: 4800 },
        { gold: 12000, wood: 4800, stone: 7200 },
        { gold: 17000, wood: 6800, stone: 10200 },
        { gold: 23000, wood: 9200, stone: 13800 },
        { gold: 30000, wood: 12000, stone: 18000 },
        { gold: 40000, wood: 16000, stone: 24000 },
        { gold: 52000, wood: 20800, stone: 31200 }
      ],
      production: [80, 120, 170, 230, 300, 380, 470, 570, 680, 800], // dmg per shot
      defenseStats: [
        { damage: 80, range: 10, fireRate: 12, splashRadius: 2, special: 'orbital_delay' },
        { damage: 120, range: 10, fireRate: 12, splashRadius: 2, special: 'orbital_delay' },
        { damage: 170, range: 11, fireRate: 11, splashRadius: 2, special: 'orbital_delay' },
        { damage: 230, range: 11, fireRate: 11, splashRadius: 2.5, special: 'orbital_delay' },
        { damage: 300, range: 12, fireRate: 10, splashRadius: 2.5, special: 'orbital_delay' },
        { damage: 380, range: 12, fireRate: 10, splashRadius: 3, special: 'orbital_delay' },
        { damage: 470, range: 13, fireRate: 9, splashRadius: 3, special: 'orbital_delay' },
        { damage: 570, range: 13, fireRate: 9, splashRadius: 3, special: 'orbital_delay' },
        { damage: 680, range: 14, fireRate: 8, splashRadius: 3.5, special: 'orbital_delay' },
        { damage: 800, range: 14, fireRate: 8, splashRadius: 3.5, special: 'orbital_delay' }
      ]
    },
    ion_beam: {
      id: 'ion_beam', name: 'Ion Beam', icon: '💠', category: 'defense',
      size: 1, maxLevel: 10, nexusReq: 8,
      desc: 'Continuous beam that chains between nearby targets.',
      costs: [
        { gold: 3000, wood: 1200, stone: 1800, gems: 5 },
        { gold: 5500, wood: 2200, stone: 3300, gems: 8 },
        { gold: 9000, wood: 3600, stone: 5400, gems: 12 },
        { gold: 14000, wood: 5600, stone: 8400, gems: 18 },
        { gold: 20000, wood: 8000, stone: 12000, gems: 25 },
        { gold: 28000, wood: 11200, stone: 16800, gems: 35 },
        { gold: 38000, wood: 15200, stone: 22800, gems: 45 },
        { gold: 50000, wood: 20000, stone: 30000, gems: 60 },
        { gold: 65000, wood: 26000, stone: 39000, gems: 80 },
        { gold: 85000, wood: 34000, stone: 51000, gems: 100 }
      ],
      production: [20, 32, 46, 62, 80, 102, 128, 158, 192, 230], // dmg per tick
      defenseStats: [
        { damage: 20, range: 5, fireRate: 2, splashRadius: 0, special: 'chain' },
        { damage: 32, range: 5, fireRate: 2, splashRadius: 0, special: 'chain' },
        { damage: 46, range: 5, fireRate: 2, splashRadius: 0, special: 'chain' },
        { damage: 62, range: 6, fireRate: 2, splashRadius: 0, special: 'chain' },
        { damage: 80, range: 6, fireRate: 2, splashRadius: 0, special: 'chain' },
        { damage: 102, range: 6, fireRate: 2, splashRadius: 0, special: 'chain' },
        { damage: 128, range: 7, fireRate: 2, splashRadius: 0, special: 'chain' },
        { damage: 158, range: 7, fireRate: 1, splashRadius: 0, special: 'chain' },
        { damage: 192, range: 7, fireRate: 1, splashRadius: 0, special: 'chain' },
        { damage: 230, range: 8, fireRate: 1, splashRadius: 0, special: 'chain' }
      ]
    },

    // --- Military (2) ---
    barracks: {
      id: 'barracks', name: 'Barracks', icon: '🏕', category: 'military',
      size: 2, maxLevel: 10, nexusReq: 1,
      desc: 'Open-air troop camp. Houses your troops — watch them live in your village! Each level increases capacity.',
      costs: [
        { gold: 500, wood: 250, stone: 150 },
        { gold: 1000, wood: 500, stone: 300 },
        { gold: 1800, wood: 900, stone: 550 },
        { gold: 3000, wood: 1500, stone: 900 },
        { gold: 4800, wood: 2400, stone: 1450 },
        { gold: 7200, wood: 3600, stone: 2200 },
        { gold: 10000, wood: 5000, stone: 3100 },
        { gold: 14000, wood: 7000, stone: 4400 },
        { gold: 18000, wood: 9000, stone: 5800 },
        { gold: 23000, wood: 11500, stone: 7500 }
      ],
      production: [5, 10, 15, 20, 25, 30, 40, 50, 60, 75], // housing capacity per level
      housingCapacity: (level) => level * 5
    },
    training_ground: {
      id: 'training_ground', name: 'Training Ground', icon: '⚔', category: 'military',
      size: 2, maxLevel: 10, nexusReq: 1,
      desc: 'Train troops here. Higher levels unlock stronger unit types.',
      costs: [
        { gold: 300, wood: 150, stone: 100 },
        { gold: 650, wood: 350, stone: 220 },
        { gold: 1200, wood: 650, stone: 420 },
        { gold: 2100, wood: 1100, stone: 720 },
        { gold: 3500, wood: 1800, stone: 1150 },
        { gold: 5500, wood: 2800, stone: 1750 },
        { gold: 8000, wood: 4000, stone: 2500 },
        { gold: 11000, wood: 5500, stone: 3500 },
        { gold: 15000, wood: 7500, stone: 5000, gems: 10 },
        { gold: 20000, wood: 10000, stone: 6500, gems: 25 }
      ],
      production: [1, 1.2, 1.5, 1.8, 2.2, 2.6, 3.0, 3.5, 4.0, 5.0] // training speed multiplier
    },

    // --- Utility (4) ---
    nexus: {
      id: 'nexus', name: 'Nexus', icon: '✦', category: 'utility',
      size: 3, maxLevel: 10, nexusReq: 0,
      desc: 'Core building. Leveling up unlocks new buildings. Destroying it loses the raid.',
      costs: [
        { gold: 0 }, // Free — auto-placed
        { gold: 200, wood: 100, stone: 50 },
        { gold: 500, wood: 250, stone: 150 },
        { gold: 1000, wood: 500, stone: 300 },
        { gold: 2000, wood: 1000, stone: 600 },
        { gold: 4000, wood: 2000, stone: 1200, gems: 5 },
        { gold: 7000, wood: 3500, stone: 2100, gems: 10 },
        { gold: 11000, wood: 5500, stone: 3300, gems: 20 },
        { gold: 16000, wood: 8000, stone: 5000, gems: 35 },
        { gold: 22000, wood: 11000, stone: 7000, gems: 50 }
      ],
      production: [200, 400, 600, 1000, 1500, 2200, 3000, 4000, 5200, 6500] // Nexus HP
      // Also gates all other buildings
    },
    overclock_pylon: {
      id: 'overclock_pylon', name: 'Overclock Pylon', icon: '↑', category: 'utility',
      size: 1, maxLevel: 5, nexusReq: 5,
      desc: 'Boosts adjacent buildings by a percentage.',
      costs: [
        { gold: 800, wood: 400, stone: 250 },
        { gold: 1600, wood: 800, stone: 500 },
        { gold: 3000, wood: 1500, stone: 950 },
        { gold: 5000, wood: 2500, stone: 1600 },
        { gold: 8000, wood: 4000, stone: 2500 }
      ],
      production: [10, 18, 27, 37, 50] // % boost to adjacent buildings
    },
    repair_drone_bay: {
      id: 'repair_drone_bay', name: 'Repair Drone Bay', icon: '🔧', category: 'utility',
      size: 2, maxLevel: 5, nexusReq: 7,
      desc: 'Auto-repairs buildings damaged in raids.',
      costs: [
        { gold: 2000, wood: 1000, stone: 600 },
        { gold: 3800, wood: 1900, stone: 1150 },
        { gold: 6500, wood: 3200, stone: 2000 },
        { gold: 10000, wood: 5000, stone: 3200 },
        { gold: 15000, wood: 7500, stone: 5000 }
      ],
      production: [10, 20, 35, 55, 80] // HP repaired per minute after raid
    },
    builder_hut: {
      id: 'builder_hut', name: 'Builder Hut', icon: '🔨', category: 'utility',
      size: 1, maxLevel: 1, nexusReq: 1,
      desc: 'Each hut provides 1 builder. Builders are needed to construct and upgrade buildings.',
      costs: [
        { gold: 100 }
      ],
      production: [1] // 1 builder
    },
    beacon_tower: {
      id: 'beacon_tower', name: 'Beacon Tower', icon: '📡', category: 'utility',
      size: 2, maxLevel: 5, nexusReq: 6,
      desc: 'Increases raid early warning. More prep time = better defense.',
      costs: [
        { gold: 1200, wood: 600, stone: 400 },
        { gold: 2400, wood: 1200, stone: 800 },
        { gold: 4200, wood: 2100, stone: 1400 },
        { gold: 6800, wood: 3400, stone: 2200 },
        { gold: 10000, wood: 5000, stone: 3300 }
      ],
      production: [10, 20, 35, 50, 70] // % bonus to defense during raids
    }
  };

  // ===== Nexus Level Unlock Gates =====
  const NEXUS_GATES = {
    1: ['data_mine', 'firewall', 'code_forge', 'builder_hut', 'barracks', 'training_ground'],
    2: ['data_vault', 'turret_node', 'hashery'],
    3: ['cache_array', 'honeypot', 'sniper_tower'],
    4: ['emp_tower', 'killswitch_mine', 'amplifier_node', 'plasma_turret'],
    5: ['quantum_safe', 'overclock_pylon'],
    6: ['beacon_tower', 'space_cannon'],
    7: ['repair_drone_bay', 'crypto_mint'],
    8: ['ion_beam']
  };

  // Player level requirement for each Nexus level
  const NEXUS_LEVEL_REQ = {
    1: 1, 2: 3, 3: 5, 4: 7, 5: 10, 6: 13, 7: 16, 8: 19, 9: 22, 10: 25
  };

  // ===== Wall Level Gates =====
  const WALL_GATES = [
    { level: 2, walls: 20 },
    { level: 5, walls: 40 },
    { level: 8, walls: 50 },
    { level: 10, walls: 75 },
    { level: 13, walls: 100 },
    { level: 16, walls: 130 },
    { level: 20, walls: 170 }
  ];

  function getMaxWalls(playerLevel) {
    let max = 0;
    for (const gate of WALL_GATES) {
      if (playerLevel >= gate.level) max = gate.walls;
    }
    return max;
  }

  function getWallCount(villageState) {
    if (!villageState || !villageState.buildings) return 0;
    return villageState.buildings.filter(b => b.id === 'firewall').length;
  }

  // ===== Resource Caps =====
  const BASE_CAPS = { gold: 500, wood: 300, stone: 200, gems: 9999, chronos: 9999 };

  function getResourceCaps(villageState) {
    const caps = { ...BASE_CAPS };
    if (!villageState || !villageState.buildings) return caps;
    for (const b of villageState.buildings) {
      const def = BUILDINGS[b.id];
      if (!def) continue;
      if (b.id === 'data_vault') {
        const bonus = def.production[b.level - 1] || 0;
        caps.gold += bonus;
        caps.wood += bonus;
      } else if (b.id === 'cache_array') {
        caps.stone += (def.production[b.level - 1] || 0);
      }
    }
    return caps;
  }

  // ===== Training Tiers (Training Ground level → unlocked tier) =====
  const TRAINING_TIERS = {
    1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5
  };

  function getMaxTrainTier(villageState) {
    let maxTier = 0;
    if (!villageState || !villageState.buildings) return maxTier;
    for (const b of villageState.buildings) {
      if (b.id === 'training_ground') {
        const tier = TRAINING_TIERS[b.level] || 1;
        if (tier > maxTier) maxTier = tier;
      }
    }
    return maxTier;
  }

  // ===== 10 Troop Types (5 tiers) =====
  const TROOPS = {
    // --- Tier 1 (Training Ground lv 1-2) ---
    script_kiddie: {
      id: 'script_kiddie', name: 'Script Kiddie', icon: '👾', tier: 1,
      role: 'Swarm DPS', housing: 1,
      hp: 30, atk: 8, speed: 2, range: 1,
      trait: 'Cheap and expendable',
      trainTime: 15,
      cost: { gold: 10 },
      trainer: 'training_ground'
    },
    probe_drone: {
      id: 'probe_drone', name: 'Probe Drone', icon: '🔍', tier: 1,
      role: 'Scout', housing: 1,
      hp: 20, atk: 4, speed: 3.5, range: 2,
      trait: 'Fast scout — reveals enemy traps',
      trainTime: 10,
      cost: { gold: 8 },
      trainer: 'training_ground'
    },
    // --- Tier 2 (Training Ground lv 3-4) ---
    packet_warrior: {
      id: 'packet_warrior', name: 'Packet Warrior', icon: '⚔', tier: 2,
      role: 'Melee DPS', housing: 2,
      hp: 60, atk: 14, speed: 1.8, range: 1,
      trait: 'Reliable frontline fighter',
      trainTime: 25,
      cost: { gold: 25, wood: 10 },
      trainer: 'training_ground'
    },
    logic_bomb: {
      id: 'logic_bomb', name: 'Logic Bomb', icon: '💣', tier: 2,
      role: 'Splash DPS', housing: 2,
      hp: 35, atk: 20, speed: 1.5, range: 2,
      trait: 'AoE splash damage (1.5-tile radius)',
      trainTime: 30,
      cost: { gold: 30, stone: 15 },
      trainer: 'training_ground'
    },
    // --- Tier 3 (Training Ground lv 5-6) ---
    cipher_knight: {
      id: 'cipher_knight', name: 'Cipher Knight', icon: '🛡', tier: 3,
      role: 'Tank', housing: 3,
      hp: 180, atk: 12, speed: 1, range: 1,
      trait: 'Absorbs first 50 dmg per hit',
      trainTime: 50,
      cost: { gold: 60, wood: 30, stone: 20 },
      trainer: 'training_ground'
    },
    malware_wolf: {
      id: 'malware_wolf', name: 'Malware Wolf', icon: '🐺', tier: 3,
      role: 'Fast Melee', housing: 3,
      hp: 70, atk: 22, speed: 3, range: 1,
      trait: 'Ignores walls, fast flanker',
      trainTime: 45,
      cost: { gold: 55, wood: 25, stone: 15 },
      trainer: 'training_ground'
    },
    // --- Tier 4 (Training Ground lv 7-8) ---
    rootkit_assassin: {
      id: 'rootkit_assassin', name: 'Rootkit Assassin', icon: '🕷', tier: 4,
      role: 'Debuffer', housing: 4,
      hp: 90, atk: 18, speed: 2, range: 2,
      trait: '-30% ATK aura to enemies in range',
      trainTime: 75,
      cost: { gold: 100, wood: 50, stone: 35, gems: 1 },
      trainer: 'training_ground'
    },
    quantum_golem: {
      id: 'quantum_golem', name: 'Quantum Golem', icon: '🤖', tier: 4,
      role: 'Heavy Tank', housing: 5,
      hp: 300, atk: 15, speed: 0.8, range: 1,
      trait: 'Massive HP pool, draws aggro',
      trainTime: 90,
      cost: { gold: 120, wood: 60, stone: 45, gems: 2 },
      trainer: 'training_ground'
    },
    // --- Tier 5 (Training Ground lv 9-10) ---
    zero_day_titan: {
      id: 'zero_day_titan', name: 'Zero-Day Titan', icon: '💀', tier: 5,
      role: 'Ultimate', housing: 8,
      hp: 250, atk: 50, speed: 1.2, range: 2,
      trait: 'Devastating AoE slam every 5 attacks',
      trainTime: 180,
      cost: { gold: 300, wood: 150, stone: 100, gems: 8 },
      trainer: 'training_ground'
    },
    phantom_zero: {
      id: 'phantom_zero', name: 'Phantom Zero', icon: '⟐', tier: 5,
      role: 'Elite Assassin', housing: 6,
      hp: 120, atk: 40, speed: 2.5, range: 1,
      trait: 'Duplicates on death (half stats)',
      trainTime: 150,
      cost: { gold: 250, wood: 120, stone: 80, gems: 5 },
      trainer: 'training_ground'
    }
  };

  // ===== 7 Raider Types =====
  const RAIDERS = {
    adware_swarm: {
      id: 'adware_swarm', name: 'Adware Swarm', icon: '🪲',
      hp: 20, atk: 5, speed: 2, range: 1,
      special: 'Spawns in groups of 5-8',
      minNexus: 1, groupSize: [5, 8]
    },
    trojan_horse: {
      id: 'trojan_horse', name: 'Trojan Horse', icon: '🐴',
      hp: 120, atk: 25, speed: 1, range: 1,
      special: '+100% damage vs buildings',
      minNexus: 2, groupSize: [1, 3]
    },
    worm: {
      id: 'worm', name: 'Worm', icon: '🐛',
      hp: 60, atk: 12, speed: 1.5, range: 1,
      special: 'Splits into 2 at 50% HP',
      minNexus: 3, groupSize: [3, 6]
    },
    ransomware: {
      id: 'ransomware', name: 'Ransomware', icon: '🔐',
      hp: 150, atk: 15, speed: 1, range: 1,
      special: 'Disables a building for the raid',
      minNexus: 4, groupSize: [1, 3]
    },
    rootkit_boss: {
      id: 'rootkit_boss', name: 'Rootkit Boss', icon: '🕸',
      hp: 300, atk: 20, speed: 0.8, range: 1,
      special: 'Spawns 2 adware minions every 10s',
      minNexus: 5, groupSize: [1, 2]
    },
    ddos_wave: {
      id: 'ddos_wave', name: 'DDoS Wave', icon: '🌊',
      hp: 80, atk: 8, speed: 2.5, range: 1,
      special: 'Massive numbers, overwhelm defenses',
      minNexus: 6, groupSize: [15, 20]
    },
    apt: {
      id: 'apt', name: 'APT', icon: '💀',
      hp: 500, atk: 35, speed: 1, range: 1,
      special: 'Regenerates 5 HP/s, immune to slow',
      minNexus: 8, groupSize: [1, 2]
    }
  };

  // ===== Building Sprite Definitions =====
  // Each returns an array of {x, y, w, h, color} rects relative to tile origin
  // s = tile size in px (24), level determines visual tier (Basic/Advanced/Elite)
  function getBuildingSprite(buildingId, level) {
    const s = 24;
    const lv = level || 1;
    const def = BUILDINGS[buildingId];
    const maxLv = def ? def.maxLevel : 10;
    // Tier: 1=Basic(small/dim), 2=Advanced(medium/bright), 3=Elite(full/gold)
    const t = maxLv <= 1 ? 1 : lv <= Math.ceil(maxLv * 0.3) ? 1 : lv <= Math.ceil(maxLv * 0.6) ? 2 : 3;

    const sprites = {

      // ——— NEXUS (3×3, utility) ———
      nexus: () => {
        const sz = s * 3;
        if (t === 1) return [
          // Small stone pedestal with dim gold core
          { x: 14, y: 14, w: sz-28, h: sz-28, c: '#232946' },
          { x: 18, y: 18, w: sz-36, h: sz-36, c: '#2d334a' },
          { x: sz/2-4, y: sz/2-4, w: 8, h: 8, c: '#c4a532' },
          { x: sz/2-2, y: sz/2-2, w: 4, h: 4, c: '#ddc044' }
        ];
        if (t === 2) return [
          // Taller structure, bright crystal, corner pillars
          { x: 6, y: 6, w: sz-12, h: sz-12, c: '#232946' },
          { x: 8, y: 8, w: sz-16, h: sz-16, c: '#2d334a' },
          { x: sz/2-6, y: sz/2-6, w: 12, h: 12, c: '#f5c542' },
          { x: sz/2-4, y: sz/2-4, w: 8, h: 8, c: '#ffe066' },
          { x: sz/2-2, y: sz/2-2, w: 4, h: 4, c: '#fff' },
          { x: 8, y: 8, w: 4, h: 4, c: '#f5c542' },
          { x: sz-12, y: 8, w: 4, h: 4, c: '#f5c542' },
          { x: 8, y: sz-12, w: 4, h: 4, c: '#f5c542' },
          { x: sz-12, y: sz-12, w: 4, h: 4, c: '#f5c542' }
        ];
        return [
          // Full fortress, blazing crystal, gold borders, energy particles
          { x: 2, y: 2, w: sz-4, h: sz-4, c: '#232946' },
          { x: 2, y: 2, w: sz-4, h: 2, c: '#f5c542' },
          { x: 2, y: sz-4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 2, y: 2, w: 2, h: sz-4, c: '#f5c542' },
          { x: sz-4, y: 2, w: 2, h: sz-4, c: '#f5c542' },
          { x: 4, y: 4, w: sz-8, h: sz-8, c: '#2d334a' },
          { x: sz/2-8, y: sz/2-8, w: 16, h: 16, c: '#f5c542' },
          { x: sz/2-6, y: sz/2-6, w: 12, h: 12, c: '#ffe066' },
          { x: sz/2-3, y: sz/2-3, w: 6, h: 6, c: '#fff' },
          { x: 4, y: 4, w: 6, h: 6, c: '#f5c542' },
          { x: sz-10, y: 4, w: 6, h: 6, c: '#f5c542' },
          { x: 4, y: sz-10, w: 6, h: 6, c: '#f5c542' },
          { x: sz-10, y: sz-10, w: 6, h: 6, c: '#f5c542' },
          { x: 12, y: 4, w: 2, h: 2, c: '#88ffff' },
          { x: sz-14, y: 4, w: 2, h: 2, c: '#88ffff' },
          { x: 12, y: sz-6, w: 2, h: 2, c: '#88ffff' },
          { x: sz-14, y: sz-6, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— DATA MINE (2×2, resource) ———
      data_mine: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Small pit with pickaxe stuck in dirt
          { x: 10, y: 14, w: sz-20, h: sz-18, c: '#1a3a2a' },
          { x: 12, y: 16, w: sz-24, h: sz-22, c: '#2a5e3a' },
          { x: sz/2-1, y: 14, w: 2, h: 12, c: '#8d6e52' },
          { x: sz/2-4, y: 12, w: 8, h: 3, c: '#6e7788' },
          { x: 8, y: sz-8, w: 3, h: 3, c: '#c4a532' }
        ];
        if (t === 2) return [
          // Wooden scaffold over mine, gold ore visible
          { x: 4, y: 8, w: sz-8, h: sz-10, c: '#1a3a2a' },
          { x: 6, y: 10, w: sz-12, h: sz-14, c: '#2a5e3a' },
          { x: 6, y: 6, w: 2, h: sz-10, c: '#8d6e52' },
          { x: sz-8, y: 6, w: 2, h: sz-10, c: '#8d6e52' },
          { x: 6, y: 6, w: sz-12, h: 2, c: '#8d6e52' },
          { x: sz/2-1, y: 10, w: 2, h: 14, c: '#6e7788' },
          { x: sz/2-4, y: 8, w: 8, h: 3, c: '#8899aa' },
          { x: 10, y: sz-10, w: 3, h: 3, c: '#f5c542' },
          { x: sz-14, y: sz-12, w: 3, h: 3, c: '#f5c542' }
        ];
        return [
          // Full mining rig, glowing ore veins, gold nuggets
          { x: 2, y: 4, w: sz-4, h: sz-6, c: '#1a3a2a' },
          { x: 4, y: 6, w: sz-8, h: sz-10, c: '#2a5e3a' },
          { x: 2, y: 4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 4, y: 2, w: 2, h: sz-4, c: '#8d6e52' },
          { x: sz-6, y: 2, w: 2, h: sz-4, c: '#8d6e52' },
          { x: 4, y: 2, w: sz-8, h: 2, c: '#8d6e52' },
          { x: sz/2-3, y: 2, w: 6, h: 4, c: '#8899aa' },
          { x: sz/2-1, y: 6, w: 2, h: 8, c: '#6e7788' },
          { x: 8, y: sz-14, w: 4, h: 2, c: '#f5c542' },
          { x: sz-14, y: sz-12, w: 4, h: 2, c: '#ffe066' },
          { x: 6, y: sz-8, w: 4, h: 3, c: '#f5c542' },
          { x: sz-12, y: sz-8, w: 4, h: 3, c: '#f5c542' },
          { x: sz/2-2, y: sz-7, w: 4, h: 3, c: '#ffe066' }
        ];
      },

      // ——— CODE FORGE (2×2, resource) ———
      code_forge: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Campfire + small anvil
          { x: 10, y: 14, w: sz-20, h: sz-18, c: '#2e1a1a' },
          { x: 12, y: 16, w: sz-24, h: sz-22, c: '#4a2020' },
          { x: sz/2-4, y: sz/2+2, w: 8, h: 3, c: '#6e7788' },
          { x: sz/2-2, y: sz/2+5, w: 4, h: 4, c: '#555' },
          { x: sz/2-1, y: sz/2-3, w: 2, h: 3, c: '#ff8844' }
        ];
        if (t === 2) return [
          // Furnace with visible fire, chimney
          { x: 4, y: 8, w: sz-8, h: sz-10, c: '#2e1a1a' },
          { x: 6, y: 10, w: sz-12, h: sz-14, c: '#4a2020' },
          { x: sz/2-8, y: 10, w: 16, h: 16, c: '#553333' },
          { x: sz/2-4, y: 16, w: 8, h: 6, c: '#ff6633' },
          { x: sz/2-2, y: 14, w: 4, h: 4, c: '#ff8844' },
          { x: sz/2-1, y: 12, w: 2, h: 3, c: '#f5c542' },
          { x: sz/2+4, y: 6, w: 4, h: 6, c: '#553333' },
          { x: sz/2-6, y: sz-10, w: 12, h: 3, c: '#6e7788' }
        ];
        return [
          // Blazing forge with sparks, large anvil
          { x: 2, y: 4, w: sz-4, h: sz-6, c: '#2e1a1a' },
          { x: 4, y: 6, w: sz-8, h: sz-10, c: '#4a2020' },
          { x: 2, y: 4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 6, y: 8, w: sz-12, h: sz-14, c: '#663333' },
          { x: sz/2-6, y: 14, w: 12, h: 10, c: '#ff4422' },
          { x: sz/2-4, y: 12, w: 8, h: 8, c: '#ff6633' },
          { x: sz/2-2, y: 10, w: 4, h: 6, c: '#ff8844' },
          { x: sz/2-1, y: 8, w: 2, h: 4, c: '#f5c542' },
          { x: sz-10, y: 4, w: 4, h: 8, c: '#553333' },
          { x: sz/2-8, y: sz-10, w: 16, h: 4, c: '#8899aa' },
          { x: 8, y: 6, w: 2, h: 2, c: '#ff8844' },
          { x: sz-12, y: 8, w: 2, h: 2, c: '#f5c542' },
          { x: sz/2, y: 4, w: 2, h: 2, c: '#ffe066' }
        ];
      },

      // ——— HASHERY (2×2, resource) ———
      hashery: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Small stone bowl with hash marks
          { x: 10, y: 12, w: sz-20, h: sz-16, c: '#1a1a2e' },
          { x: 14, y: 14, w: sz-28, h: sz-22, c: '#2d334a' },
          { x: sz/2-4, y: sz/2-1, w: 8, h: 2, c: '#6e7788' },
          { x: sz/2-1, y: sz/2-4, w: 2, h: 8, c: '#6e7788' }
        ];
        if (t === 2) return [
          // Column mill with spinning hash
          { x: 4, y: 6, w: sz-8, h: sz-8, c: '#1a1a2e' },
          { x: 6, y: 8, w: sz-12, h: sz-12, c: '#2d334a' },
          { x: sz/2-6, y: sz/2-2, w: 12, h: 2, c: '#8899aa' },
          { x: sz/2-6, y: sz/2+2, w: 12, h: 2, c: '#8899aa' },
          { x: sz/2-2, y: sz/2-6, w: 2, h: 12, c: '#8899aa' },
          { x: sz/2+2, y: sz/2-6, w: 2, h: 12, c: '#8899aa' },
          { x: 6, y: sz-10, w: sz-12, h: 4, c: '#3a3f5c' }
        ];
        return [
          // Crystalline processor, bright hash, energy glow
          { x: 2, y: 4, w: sz-4, h: sz-6, c: '#1a1a2e' },
          { x: 4, y: 6, w: sz-8, h: sz-10, c: '#2d334a' },
          { x: 2, y: 4, w: sz-4, h: 2, c: '#f5c542' },
          { x: sz/2-8, y: sz/2-2, w: 16, h: 2, c: '#aabbee' },
          { x: sz/2-8, y: sz/2+2, w: 16, h: 2, c: '#aabbee' },
          { x: sz/2-2, y: sz/2-8, w: 2, h: 16, c: '#aabbee' },
          { x: sz/2+2, y: sz/2-8, w: 2, h: 16, c: '#aabbee' },
          { x: sz/2-1, y: sz/2-1, w: 2, h: 2, c: '#fff' },
          { x: 4, y: sz-10, w: sz-8, h: 4, c: '#3a3f5c' },
          { x: 6, y: 6, w: 2, h: 2, c: '#88ffff' },
          { x: sz-8, y: 6, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— CRYPTO MINT (3×3, resource) ———
      crypto_mint: () => {
        const sz = s * 3;
        if (t === 1) return [
          // Small pedestal with dim gem
          { x: 16, y: 18, w: sz-32, h: sz-30, c: '#1a1a2e' },
          { x: 20, y: 20, w: sz-40, h: sz-36, c: '#232946' },
          { x: sz/2-4, y: sz/2-4, w: 8, h: 8, c: '#9933cc' },
          { x: sz/2-2, y: sz/2-2, w: 4, h: 4, c: '#bb55dd' }
        ];
        if (t === 2) return [
          // Gem pedestal with glow
          { x: 8, y: 10, w: sz-16, h: sz-14, c: '#1a1a2e' },
          { x: 10, y: 12, w: sz-20, h: sz-18, c: '#232946' },
          { x: sz/2-6, y: sz/2-6, w: 12, h: 12, c: '#cc44ff' },
          { x: sz/2-4, y: sz/2-4, w: 8, h: 8, c: '#dd66ff' },
          { x: sz/2-2, y: sz/2-2, w: 4, h: 4, c: '#fff' },
          { x: sz/2-8, y: sz/2+6, w: 16, h: 4, c: '#3a3f5c' }
        ];
        return [
          // Vault with gem crown, gold accents
          { x: 2, y: 4, w: sz-4, h: sz-6, c: '#1a1a2e' },
          { x: 4, y: 6, w: sz-8, h: sz-10, c: '#232946' },
          { x: 2, y: 4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 2, y: sz-4, w: sz-4, h: 2, c: '#f5c542' },
          { x: sz/2-8, y: sz/2-8, w: 16, h: 16, c: '#cc44ff' },
          { x: sz/2-6, y: sz/2-6, w: 12, h: 12, c: '#dd66ff' },
          { x: sz/2-3, y: sz/2-3, w: 6, h: 6, c: '#fff' },
          { x: 4, y: 4, w: 4, h: 4, c: '#f5c542' },
          { x: sz-8, y: 4, w: 4, h: 4, c: '#f5c542' },
          { x: sz/2-10, y: sz/2+8, w: 20, h: 4, c: '#3a3f5c' },
          { x: 8, y: 6, w: 2, h: 2, c: '#88ffff' },
          { x: sz-10, y: 6, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— AMPLIFIER NODE (2×2, resource) ———
      amplifier_node: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Single small ring
          { x: 12, y: 12, w: sz-24, h: sz-24, c: '#1a2e22' },
          { x: 14, y: 14, w: sz-28, h: sz-28, c: '#2a4e3a' },
          { x: sz/2-3, y: sz/2-3, w: 6, h: 6, c: '#2ee67a' },
          { x: sz/2-1, y: sz/2-1, w: 2, h: 2, c: '#1a2e22' }
        ];
        if (t === 2) return [
          // Stacked rings on tower
          { x: 6, y: 6, w: sz-12, h: sz-12, c: '#1a2e22' },
          { x: 8, y: 8, w: sz-16, h: sz-16, c: '#2a4e3a' },
          { x: sz/2-5, y: sz/2-5, w: 10, h: 10, c: '#2ee67a' },
          { x: sz/2-3, y: sz/2-3, w: 6, h: 6, c: '#1a2e22' },
          { x: sz/2-1, y: sz/2-1, w: 2, h: 2, c: '#2ee67a' },
          { x: sz/2-4, y: 8, w: 8, h: 2, c: '#2ee67a' },
          { x: sz/2-4, y: sz-10, w: 8, h: 2, c: '#2ee67a' }
        ];
        return [
          // Pulsing tower with glow, gold trim
          { x: 2, y: 2, w: sz-4, h: sz-4, c: '#1a2e22' },
          { x: 4, y: 4, w: sz-8, h: sz-8, c: '#2a4e3a' },
          { x: 2, y: 2, w: sz-4, h: 2, c: '#f5c542' },
          { x: sz/2-6, y: sz/2-6, w: 12, h: 12, c: '#2ee67a' },
          { x: sz/2-4, y: sz/2-4, w: 8, h: 8, c: '#1a2e22' },
          { x: sz/2-2, y: sz/2-2, w: 4, h: 4, c: '#2ee67a' },
          { x: sz/2-1, y: sz/2-1, w: 2, h: 2, c: '#fff' },
          { x: sz/2-5, y: 6, w: 10, h: 2, c: '#66ffaa' },
          { x: sz/2-5, y: sz-8, w: 10, h: 2, c: '#66ffaa' },
          { x: 4, y: 4, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: 4, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— DATA VAULT (2×2, storage) ———
      data_vault: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Small chest
          { x: 10, y: 12, w: sz-20, h: sz-18, c: '#1a1a2e' },
          { x: 12, y: 14, w: sz-24, h: sz-22, c: '#2d334a' },
          { x: sz/2-3, y: sz/2, w: 6, h: 6, c: '#4488ff' },
          { x: sz/2-1, y: sz/2+1, w: 2, h: 2, c: '#f5c542' }
        ];
        if (t === 2) return [
          // Reinforced chest with lock
          { x: 4, y: 6, w: sz-8, h: sz-8, c: '#1a1a2e' },
          { x: 6, y: 8, w: sz-12, h: sz-12, c: '#2d334a' },
          { x: sz/2-6, y: sz/2-2, w: 12, h: sz/2-2, c: '#4488ff' },
          { x: sz/2-4, y: sz/2, w: 8, h: sz/2-6, c: '#2266cc' },
          { x: sz/2-1, y: sz/2+1, w: 2, h: 2, c: '#f5c542' },
          { x: 6, y: 8, w: sz-12, h: 2, c: '#6e7788' },
          { x: 6, y: sz-6, w: sz-12, h: 2, c: '#6e7788' }
        ];
        return [
          // Massive vault door, gold trim
          { x: 2, y: 4, w: sz-4, h: sz-6, c: '#1a1a2e' },
          { x: 4, y: 6, w: sz-8, h: sz-10, c: '#2d334a' },
          { x: 2, y: 4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 2, y: sz-4, w: sz-4, h: 2, c: '#f5c542' },
          { x: sz/2-8, y: sz/2-4, w: 16, h: sz/2, c: '#4488ff' },
          { x: sz/2-6, y: sz/2-2, w: 12, h: sz/2-4, c: '#2266cc' },
          { x: sz/2-2, y: sz/2, w: 4, h: 4, c: '#f5c542' },
          { x: sz/2-1, y: sz/2+1, w: 2, h: 2, c: '#ffe066' },
          { x: 4, y: 6, w: sz-8, h: 2, c: '#6e7788' },
          { x: 4, y: 4, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: 4, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— CACHE ARRAY (2×2, storage) ———
      cache_array: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Single box
          { x: 10, y: 12, w: sz-20, h: sz-18, c: '#1a1a2e' },
          { x: 12, y: 14, w: sz-24, h: sz-22, c: '#2d334a' },
          { x: sz/2-6, y: sz/2-2, w: 12, h: 8, c: '#4488ff' },
          { x: sz/2-4, y: sz/2, w: 8, h: 4, c: '#3366cc' }
        ];
        if (t === 2) return [
          // 3 stacked boxes
          { x: 4, y: 6, w: sz-8, h: sz-8, c: '#1a1a2e' },
          { x: 6, y: 8, w: sz-12, h: sz-12, c: '#2d334a' },
          { x: 8, y: 10, w: sz-16, h: 6, c: '#4488ff' },
          { x: 8, y: 18, w: sz-16, h: 6, c: '#3366cc' },
          { x: 8, y: 26, w: sz-16, h: 6, c: '#2255aa' }
        ];
        return [
          // Full warehouse rack, gold trim
          { x: 2, y: 4, w: sz-4, h: sz-6, c: '#1a1a2e' },
          { x: 4, y: 6, w: sz-8, h: sz-10, c: '#2d334a' },
          { x: 2, y: 4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 6, y: 8, w: sz-12, h: 6, c: '#4488ff' },
          { x: 6, y: 16, w: sz-12, h: 6, c: '#3366cc' },
          { x: 6, y: 24, w: sz-12, h: 6, c: '#2255aa' },
          { x: 6, y: 32, w: sz-12, h: 6, c: '#4488ff' },
          { x: 4, y: 8, w: 2, h: sz-14, c: '#6e7788' },
          { x: sz-6, y: 8, w: 2, h: sz-14, c: '#6e7788' },
          { x: 4, y: 4, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: 4, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— QUANTUM SAFE (2×2, storage) ———
      quantum_safe: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Small lockbox
          { x: 10, y: 12, w: sz-20, h: sz-18, c: '#1a2244' },
          { x: 12, y: 14, w: sz-24, h: sz-22, c: '#223366' },
          { x: sz/2-4, y: sz/2-2, w: 8, h: 6, c: '#4466aa' },
          { x: sz/2-1, y: sz/2, w: 2, h: 2, c: '#aabbee' }
        ];
        if (t === 2) return [
          // Safe with door and dial
          { x: 4, y: 6, w: sz-8, h: sz-8, c: '#1a2244' },
          { x: 6, y: 8, w: sz-12, h: sz-12, c: '#223366' },
          { x: 8, y: 10, w: sz-16, h: sz-18, c: '#4466aa' },
          { x: sz/2-3, y: sz/2-3, w: 6, h: 6, c: '#6688cc' },
          { x: sz/2-1, y: sz/2-1, w: 2, h: 2, c: '#aabbee' },
          { x: sz-12, y: sz/2-1, w: 3, h: 2, c: '#8899bb' }
        ];
        return [
          // Armored vault with dial, gold border
          { x: 2, y: 4, w: sz-4, h: sz-6, c: '#1a2244' },
          { x: 4, y: 6, w: sz-8, h: sz-10, c: '#223366' },
          { x: 2, y: 4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 2, y: sz-4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 6, y: 8, w: sz-12, h: sz-14, c: '#4466aa' },
          { x: sz/2-4, y: sz/2-4, w: 8, h: 8, c: '#6688cc' },
          { x: sz/2-2, y: sz/2-2, w: 4, h: 4, c: '#aabbee' },
          { x: sz/2-1, y: sz/2-1, w: 2, h: 2, c: '#fff' },
          { x: sz-10, y: sz/2-1, w: 4, h: 2, c: '#f5c542' },
          { x: 4, y: 4, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: 4, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— FIREWALL (1×1, defense) ———
      firewall: () => {
        // maxLevel 1 — always tier 1, tiers 2-3 for future use
        if (t === 1) return [
          // Low brick stack (3 rows)
          { x: 1, y: 6, w: s-2, h: s-8, c: '#4a3020' },
          { x: 2, y: 8, w: s-4, h: s-12, c: '#6e4e32' },
          { x: 3, y: 8, w: s/2-2, h: 3, c: '#8d6e52' },
          { x: s/2+1, y: 8, w: s/2-3, h: 3, c: '#7a5e42' },
          { x: 5, y: 12, w: s/2-2, h: 3, c: '#7a5e42' },
          { x: 2, y: 12, w: 4, h: 3, c: '#8d6e52' },
          { x: 3, y: 16, w: s/2-2, h: 3, c: '#8d6e52' },
          { x: s/2+1, y: 16, w: s/2-3, h: 3, c: '#7a5e42' }
        ];
        if (t === 2) return [
          // Taller wall, torch on top
          { x: 1, y: 4, w: s-2, h: s-6, c: '#4a3020' },
          { x: 2, y: 5, w: s-4, h: s-8, c: '#6e4e32' },
          { x: 3, y: 5, w: s/2-2, h: 3, c: '#8d6e52' },
          { x: s/2+1, y: 5, w: s/2-3, h: 3, c: '#7a5e42' },
          { x: 5, y: 9, w: s/2-2, h: 3, c: '#7a5e42' },
          { x: 2, y: 9, w: 4, h: 3, c: '#8d6e52' },
          { x: 3, y: 13, w: s/2-2, h: 3, c: '#8d6e52' },
          { x: s/2+1, y: 13, w: s/2-3, h: 3, c: '#7a5e42' },
          { x: 5, y: 17, w: s/2-2, h: 3, c: '#7a5e42' },
          { x: 2, y: 17, w: 4, h: 3, c: '#8d6e52' },
          { x: s/2-1, y: 2, w: 2, h: 4, c: '#8d6e52' },
          { x: s/2-1, y: 1, w: 2, h: 2, c: '#ff8844' }
        ];
        return [
          // Fortress wall, flame crest, gold mortar
          { x: 1, y: 2, w: s-2, h: s-3, c: '#5a3828' },
          { x: 1, y: 2, w: s-2, h: 2, c: '#f5c542' },
          { x: 2, y: 4, w: s-4, h: s-7, c: '#6e4e32' },
          { x: 3, y: 4, w: s/2-2, h: 3, c: '#8d6e52' },
          { x: s/2+1, y: 4, w: s/2-3, h: 3, c: '#7a5e42' },
          { x: 5, y: 8, w: s/2-2, h: 3, c: '#7a5e42' },
          { x: 2, y: 8, w: 4, h: 3, c: '#8d6e52' },
          { x: 3, y: 12, w: s/2-2, h: 3, c: '#8d6e52' },
          { x: s/2+1, y: 12, w: s/2-3, h: 3, c: '#7a5e42' },
          { x: 5, y: 16, w: s/2-2, h: 3, c: '#7a5e42' },
          { x: 2, y: 16, w: 4, h: 3, c: '#8d6e52' },
          { x: s/2-2, y: 1, w: 4, h: 3, c: '#ff6633' },
          { x: s/2-1, y: 0, w: 2, h: 2, c: '#f5c542' },
          { x: 2, y: s-3, w: s-4, h: 2, c: '#f5c542' }
        ];
      },

      // ——— TURRET NODE (2×2, defense) ———
      turret_node: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Simple post with barrel
          { x: sz/2-4, y: sz/2, w: 8, h: sz/2-4, c: '#2d334a' },
          { x: sz/2-2, y: sz/2+2, w: 4, h: sz/2-6, c: '#3a3f5c' },
          { x: sz/2-1, y: 8, w: 2, h: sz/2-4, c: '#6e7788' },
          { x: sz/2-2, y: 6, w: 4, h: 3, c: '#8899aa' }
        ];
        if (t === 2) return [
          // Mounted turret on base
          { x: 6, y: sz-14, w: sz-12, h: 12, c: '#2d334a' },
          { x: 8, y: sz-10, w: sz-16, h: 8, c: '#3a3f5c' },
          { x: sz/2-3, y: 6, w: 6, h: sz/2, c: '#6e7788' },
          { x: sz/2-4, y: 4, w: 8, h: 4, c: '#8899aa' },
          { x: sz/2-1, y: 2, w: 2, h: 3, c: '#ff4455' },
          { x: 8, y: sz-6, w: sz-16, h: 2, c: '#6e7788' }
        ];
        return [
          // Armored turret, muzzle flash, gold accents
          { x: 4, y: sz-14, w: sz-8, h: 12, c: '#2d334a' },
          { x: 4, y: sz-14, w: sz-8, h: 2, c: '#f5c542' },
          { x: 6, y: sz-12, w: sz-12, h: 10, c: '#3a3f5c' },
          { x: sz/2-4, y: 4, w: 8, h: sz/2+2, c: '#6e7788' },
          { x: sz/2-5, y: 2, w: 10, h: 4, c: '#8899aa' },
          { x: sz/2-2, y: 0, w: 4, h: 4, c: '#ff4455' },
          { x: sz/2-1, y: 0, w: 2, h: 2, c: '#ffe066' },
          { x: 6, y: sz-6, w: sz-12, h: 2, c: '#f5c542' },
          { x: 4, y: sz-4, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: sz-4, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— EMP TOWER (2×2, defense) ———
      emp_tower: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Simple rod
          { x: sz/2-3, y: 10, w: 6, h: sz-14, c: '#1a1a2e' },
          { x: sz/2-2, y: 12, w: 4, h: sz-18, c: '#2d334a' },
          { x: sz/2-3, y: 8, w: 6, h: 3, c: '#44ddee' },
          { x: sz/2-1, y: 10, w: 2, h: 4, c: '#44ddee' }
        ];
        if (t === 2) return [
          // Tall antenna with lightning
          { x: sz/2-5, y: 6, w: 10, h: sz-8, c: '#1a1a2e' },
          { x: sz/2-3, y: 8, w: 6, h: sz-12, c: '#2d334a' },
          { x: sz/2-4, y: 4, w: 8, h: 4, c: '#44ddee' },
          { x: sz/2-2, y: 10, w: 4, h: 4, c: '#44ddee' },
          { x: sz/2, y: 14, w: 2, h: 6, c: '#44ddee' },
          { x: sz/2-3, y: 20, w: 6, h: 2, c: '#44ddee' },
          { x: sz/2-1, y: 2, w: 2, h: 4, c: '#66eeff' }
        ];
        return [
          // Crackling spire, energy arcs, gold cap
          { x: sz/2-6, y: 4, w: 12, h: sz-6, c: '#1a1a2e' },
          { x: sz/2-4, y: 6, w: 8, h: sz-10, c: '#2d334a' },
          { x: sz/2-6, y: 2, w: 12, h: 4, c: '#f5c542' },
          { x: sz/2-2, y: 10, w: 4, h: 4, c: '#44ddee' },
          { x: sz/2, y: 14, w: 2, h: 6, c: '#44ddee' },
          { x: sz/2-3, y: 20, w: 6, h: 3, c: '#44ddee' },
          { x: sz/2-1, y: 24, w: 2, h: 6, c: '#44ddee' },
          { x: 4, y: 10, w: sz/2-6, h: 2, c: '#66eeff' },
          { x: sz/2+2, y: 14, w: sz/2-6, h: 2, c: '#66eeff' },
          { x: sz/2-1, y: 0, w: 2, h: 4, c: '#fff' },
          { x: 4, y: sz-6, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: sz-6, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— HONEYPOT (2×2, defense) ———
      honeypot: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Small jar
          { x: 12, y: 14, w: sz-24, h: sz-20, c: '#4a3a10' },
          { x: 14, y: 16, w: sz-28, h: sz-24, c: '#6e5520' },
          { x: sz/2-2, y: 12, w: 4, h: 3, c: '#f5c542' },
          { x: 12, y: 12, w: sz-24, h: 2, c: '#8d6e52' }
        ];
        if (t === 2) return [
          // Glowing pot with drip
          { x: 6, y: 10, w: sz-12, h: sz-12, c: '#4a3a10' },
          { x: 8, y: 12, w: sz-16, h: sz-16, c: '#6e5520' },
          { x: sz/2-4, y: 8, w: 8, h: 4, c: '#f5c542' },
          { x: sz/2-1, y: 6, w: 2, h: 4, c: '#f5c542' },
          { x: 6, y: 8, w: sz-12, h: 3, c: '#8d6e52' },
          { x: sz/2+2, y: sz-10, w: 2, h: 3, c: '#ddb030' }
        ];
        return [
          // Elaborate trap, dripping gold, golden rim
          { x: 2, y: 6, w: sz-4, h: sz-8, c: '#4a3a10' },
          { x: 4, y: 8, w: sz-8, h: sz-12, c: '#6e5520' },
          { x: 2, y: 6, w: sz-4, h: 2, c: '#f5c542' },
          { x: sz/2-6, y: 4, w: 12, h: 4, c: '#f5c542' },
          { x: sz/2-4, y: 2, w: 8, h: 4, c: '#ffe066' },
          { x: sz/2-2, y: 0, w: 4, h: 3, c: '#f5c542' },
          { x: 2, y: sz-4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 6, y: sz-10, w: 2, h: 3, c: '#ddb030' },
          { x: sz/2+4, y: sz-8, w: 2, h: 3, c: '#ddb030' },
          { x: sz-10, y: sz-12, w: 2, h: 4, c: '#ddb030' },
          { x: 4, y: 4, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: 4, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— KILLSWITCH MINE (1×1, defense) ———
      killswitch_mine: () => {
        if (t === 1) return [
          // Small dot
          { x: s/2-4, y: s/2-4, w: 8, h: 8, c: '#4a2020' },
          { x: s/2-2, y: s/2-2, w: 4, h: 4, c: '#6e2020' },
          { x: s/2-1, y: s/2-1, w: 2, h: 2, c: '#ff4455' },
          { x: s/2, y: s/2-6, w: 2, h: 3, c: '#8d6e52' }
        ];
        if (t === 2) return [
          // Visible mine with danger markings
          { x: s/2-6, y: s/2-6, w: 12, h: 12, c: '#4a2020' },
          { x: s/2-4, y: s/2-4, w: 8, h: 8, c: '#6e2020' },
          { x: s/2-2, y: s/2-2, w: 4, h: 4, c: '#ff4455' },
          { x: s/2-1, y: s/2-1, w: 2, h: 2, c: '#ff8866' },
          { x: s/2, y: s/2-8, w: 2, h: 4, c: '#8d6e52' },
          { x: s/2-7, y: s/2-1, w: 2, h: 2, c: '#f5c542' },
          { x: s/2+5, y: s/2-1, w: 2, h: 2, c: '#f5c542' }
        ];
        return [
          // Pulsing danger dome, gold border
          { x: s/2-8, y: s/2-8, w: 16, h: 16, c: '#4a2020' },
          { x: s/2-8, y: s/2-8, w: 16, h: 2, c: '#f5c542' },
          { x: s/2-6, y: s/2-6, w: 12, h: 12, c: '#6e2020' },
          { x: s/2-4, y: s/2-4, w: 8, h: 8, c: '#ff4455' },
          { x: s/2-2, y: s/2-2, w: 4, h: 4, c: '#ff8866' },
          { x: s/2-1, y: s/2-1, w: 2, h: 2, c: '#fff' },
          { x: s/2, y: s/2-10, w: 2, h: 4, c: '#8d6e52' },
          { x: s/2-9, y: s/2-1, w: 2, h: 2, c: '#88ffff' },
          { x: s/2+7, y: s/2-1, w: 2, h: 2, c: '#88ffff' },
          { x: s/2-1, y: s/2+7, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— SNIPER TOWER (1×1, defense) ———
      sniper_tower: () => {
        if (t === 1) return [
          // Short wooden post with small lens
          { x: s/2-3, y: 6, w: 6, h: s-8, c: '#445566' },
          { x: s/2-2, y: 8, w: 4, h: s-12, c: '#556677' },
          { x: s/2-2, y: 6, w: 4, h: 3, c: '#ff6677' },
          { x: s/2-1, y: 7, w: 2, h: 2, c: '#fff' }
        ];
        if (t === 2) return [
          // Metal tower, visible barrel, red scope dot
          { x: s/2-4, y: 4, w: 8, h: s-6, c: '#445566' },
          { x: s/2-2, y: 6, w: 4, h: s-10, c: '#556677' },
          { x: s/2-1, y: 2, w: 2, h: 8, c: '#6e7788' },
          { x: s/2-3, y: 4, w: 6, h: 4, c: '#ff6677' },
          { x: s/2-1, y: 5, w: 2, h: 2, c: '#fff' },
          { x: s/2-4, y: s-4, w: 8, h: 2, c: '#6e7788' }
        ];
        return [
          // Tall reinforced tower, long barrel, golden scope, muzzle glow
          { x: s/2-5, y: 2, w: 10, h: s-3, c: '#445566' },
          { x: s/2-5, y: 2, w: 10, h: 2, c: '#f5c542' },
          { x: s/2-3, y: 4, w: 6, h: s-7, c: '#556677' },
          { x: s/2-1, y: 0, w: 2, h: 8, c: '#8899aa' },
          { x: s/2-4, y: 2, w: 8, h: 5, c: '#f5c542' },
          { x: s/2-2, y: 3, w: 4, h: 3, c: '#ff6677' },
          { x: s/2-1, y: 4, w: 2, h: 2, c: '#fff' },
          { x: s/2-1, y: 0, w: 2, h: 2, c: '#ffe066' },
          { x: s/2-5, y: s-3, w: 10, h: 2, c: '#f5c542' },
          { x: 2, y: s/2, w: 2, h: 2, c: '#88ffff' },
          { x: s-4, y: s/2, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— PLASMA TURRET (1×1, defense) ———
      plasma_turret: () => {
        if (t === 1) return [
          // Base plate only
          { x: s/2-5, y: s/2, w: 10, h: s/2-2, c: '#553344' },
          { x: s/2-3, y: s/2+2, w: 6, h: s/2-4, c: '#664455' },
          { x: s/2-1, y: s/2-2, w: 2, h: 4, c: '#ff8844' }
        ];
        if (t === 2) return [
          // Turret + ring
          { x: s/2-6, y: s/2-2, w: 12, h: s/2, c: '#553344' },
          { x: s/2-4, y: s/2, w: 8, h: s/2-4, c: '#664455' },
          { x: s/2-5, y: s/2-4, w: 10, h: 3, c: '#ff8844' },
          { x: s/2-1, y: 4, w: 2, h: s/2-2, c: '#ff8844' },
          { x: 4, y: s/2-1, w: 4, h: 2, c: '#ff8844' },
          { x: s-8, y: s/2-1, w: 4, h: 2, c: '#ff8844' }
        ];
        return [
          // Quad barrels + blazing ring, gold accents
          { x: s/2-7, y: s/2-2, w: 14, h: s/2+1, c: '#553344' },
          { x: s/2-7, y: s/2-2, w: 14, h: 2, c: '#f5c542' },
          { x: s/2-5, y: s/2, w: 10, h: s/2-3, c: '#664455' },
          { x: s/2-6, y: s/2-5, w: 12, h: 3, c: '#ff8844' },
          { x: s/2-1, y: 2, w: 2, h: s/2-2, c: '#ff6633' },
          { x: 2, y: s/2-1, w: 4, h: 2, c: '#ff6633' },
          { x: s-6, y: s/2-1, w: 4, h: 2, c: '#ff6633' },
          { x: s/2-4, y: 4, w: 2, h: s/2-4, c: '#ff8844' },
          { x: s/2+2, y: 4, w: 2, h: s/2-4, c: '#ff8844' },
          { x: s/2-1, y: 1, w: 2, h: 2, c: '#ffe066' },
          { x: 1, y: s/2-1, w: 2, h: 2, c: '#ffe066' },
          { x: s-3, y: s/2-1, w: 2, h: 2, c: '#ffe066' }
        ];
      },

      // ——— SPACE CANNON (2×2, defense) ———
      space_cannon: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Flat dish
          { x: 10, y: 12, w: sz-20, h: sz-20, c: '#334455' },
          { x: 14, y: 14, w: sz-28, h: sz-24, c: '#44aaff' },
          { x: sz/2-3, y: sz/2-3, w: 6, h: 6, c: '#2288dd' },
          { x: sz/2-1, y: sz/2-1, w: 2, h: 2, c: '#88ccff' }
        ];
        if (t === 2) return [
          // Dome + barrel
          { x: 6, y: 8, w: sz-12, h: sz-10, c: '#334455' },
          { x: sz/2-6, y: sz/2-6, w: 12, h: 12, c: '#44aaff' },
          { x: sz/2-4, y: sz/2-4, w: 8, h: 8, c: '#2288dd' },
          { x: sz/2-2, y: 6, w: 4, h: sz/2, c: '#556677' },
          { x: sz/2-1, y: 4, w: 2, h: 4, c: '#44aaff' },
          { x: 6, y: sz-6, w: sz-12, h: 2, c: '#556677' }
        ];
        return [
          // Full cannon, orbital glow, gold trim
          { x: 2, y: 6, w: sz-4, h: sz-8, c: '#334455' },
          { x: 2, y: 6, w: sz-4, h: 2, c: '#f5c542' },
          { x: sz/2-8, y: sz/2-6, w: 16, h: 14, c: '#44aaff' },
          { x: sz/2-6, y: sz/2-4, w: 12, h: 10, c: '#2288dd' },
          { x: sz/2-3, y: 4, w: 6, h: sz/2+2, c: '#556677' },
          { x: sz/2-2, y: 2, w: 4, h: 4, c: '#44aaff' },
          { x: sz/2-1, y: 0, w: 2, h: 3, c: '#88ccff' },
          { x: 4, y: sz-6, w: sz-8, h: 2, c: '#f5c542' },
          { x: sz/2-1, y: sz/2-1, w: 2, h: 2, c: '#fff' },
          { x: 4, y: 8, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: 8, w: 2, h: 2, c: '#88ffff' },
          { x: sz/2-1, y: sz-8, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— ION BEAM (1×1, defense) ———
      ion_beam: () => {
        if (t === 1) return [
          // Small crystal
          { x: s/2-4, y: 6, w: 8, h: s-8, c: '#335544' },
          { x: s/2-2, y: 8, w: 4, h: s-12, c: '#446655' },
          { x: s/2-2, y: 6, w: 4, h: 5, c: '#44ffaa' },
          { x: s/2-1, y: 8, w: 2, h: 2, c: '#88ffcc' }
        ];
        if (t === 2) return [
          // Crystal spire
          { x: s/2-5, y: 4, w: 10, h: s-6, c: '#335544' },
          { x: s/2-3, y: 6, w: 6, h: s-10, c: '#446655' },
          { x: s/2-3, y: 3, w: 6, h: 8, c: '#44ffaa' },
          { x: s/2-1, y: 5, w: 2, h: 4, c: '#88ffcc' },
          { x: s/2-2, y: 2, w: 4, h: 3, c: '#aaffdd' },
          { x: s/2-5, y: s-4, w: 10, h: 2, c: '#6e7788' }
        ];
        return [
          // Tall spire, orbiting shards, glow
          { x: s/2-6, y: 2, w: 12, h: s-3, c: '#335544' },
          { x: s/2-6, y: 2, w: 12, h: 2, c: '#f5c542' },
          { x: s/2-4, y: 4, w: 8, h: s-7, c: '#446655' },
          { x: s/2-4, y: 2, w: 8, h: 10, c: '#44ffaa' },
          { x: s/2-2, y: 4, w: 4, h: 6, c: '#88ffcc' },
          { x: s/2-1, y: 2, w: 2, h: 3, c: '#fff' },
          { x: 1, y: s/2-2, w: 3, h: 3, c: '#44ffaa' },
          { x: s-4, y: s/2+1, w: 3, h: 3, c: '#44ffaa' },
          { x: s/2-2, y: s-6, w: 4, h: 2, c: '#44ffaa' },
          { x: s/2-6, y: s-3, w: 12, h: 2, c: '#f5c542' },
          { x: 2, y: s/2-4, w: 2, h: 2, c: '#88ffff' },
          { x: s-4, y: s/2+3, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— BARRACKS (2×2, military) ———
      barracks: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Campfire ring with a figure
          { x: 10, y: 10, w: sz-20, h: sz-20, c: '#3a2a3a' },
          { x: 14, y: 14, w: sz-28, h: sz-28, c: '#4a3a4a' },
          { x: sz/2-2, y: sz/2-2, w: 4, h: 4, c: '#ff8844' },
          { x: sz/2-1, y: sz/2-1, w: 2, h: 2, c: '#f5c542' },
          { x: sz/2+4, y: sz/2-1, w: 2, h: 4, c: '#cc44ff' }
        ];
        if (t === 2) return [
          // Walled yard with figures, banner
          { x: 4, y: 4, w: sz-8, h: sz-8, c: '#3a2a3a' },
          { x: 6, y: 6, w: sz-12, h: sz-12, c: '#4a3a4a' },
          { x: 4, y: 4, w: 3, h: 3, c: '#cc44ff' },
          { x: sz-7, y: 4, w: 3, h: 3, c: '#cc44ff' },
          { x: 4, y: sz-7, w: 3, h: 3, c: '#cc44ff' },
          { x: sz-7, y: sz-7, w: 3, h: 3, c: '#cc44ff' },
          { x: 12, y: 12, w: 2, h: 4, c: '#cc44ff' },
          { x: 20, y: 16, w: 2, h: 4, c: '#aa55ee' },
          { x: sz/2-1, y: sz/2, w: 2, h: 4, c: '#bb33dd' },
          { x: 8, y: 8, w: 1, h: 8, c: '#6e5520' },
          { x: 9, y: 8, w: 4, h: 3, c: '#cc44ff' }
        ];
        return [
          // Full courtyard, banner, many troops, gold trim
          { x: 2, y: 2, w: sz-4, h: sz-4, c: '#3a2a3a' },
          { x: 2, y: 2, w: sz-4, h: 2, c: '#f5c542' },
          { x: 4, y: 4, w: sz-8, h: sz-8, c: '#4a3a4a' },
          { x: 2, y: 2, w: 4, h: 4, c: '#f5c542' },
          { x: sz-6, y: 2, w: 4, h: 4, c: '#f5c542' },
          { x: 2, y: sz-6, w: 4, h: 4, c: '#f5c542' },
          { x: sz-6, y: sz-6, w: 4, h: 4, c: '#f5c542' },
          { x: 10, y: 10, w: 2, h: 4, c: '#cc44ff' },
          { x: 16, y: 14, w: 2, h: 4, c: '#aa55ee' },
          { x: sz/2-1, y: sz/2, w: 2, h: 4, c: '#bb33dd' },
          { x: 22, y: 10, w: 2, h: 4, c: '#dd55ff' },
          { x: 28, y: 14, w: 2, h: 4, c: '#cc44ff' },
          { x: 14, y: 20, w: 2, h: 4, c: '#aa55ee' },
          { x: 6, y: 6, w: 1, h: 10, c: '#6e5520' },
          { x: 7, y: 6, w: 5, h: 3, c: '#cc44ff' },
          { x: 6, y: sz-6, w: 2, h: 2, c: '#88ffff' },
          { x: sz-8, y: sz-6, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— TRAINING GROUND (2×2, military) ———
      training_ground: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Mat on floor
          { x: 10, y: 12, w: sz-20, h: sz-18, c: '#1a1a2e' },
          { x: 12, y: 14, w: sz-24, h: sz-22, c: '#2d334a' },
          { x: sz/2-6, y: sz/2, w: 12, h: 3, c: '#6e7788' },
          { x: sz/2-1, y: sz/2-3, w: 2, h: 8, c: '#cc44ff' }
        ];
        if (t === 2) return [
          // Platform with ring and crossed swords
          { x: 4, y: 6, w: sz-8, h: sz-8, c: '#1a1a2e' },
          { x: 6, y: 8, w: sz-12, h: sz-12, c: '#2d334a' },
          { x: 8, y: sz/2, w: sz-16, h: 4, c: '#6e7788' },
          { x: sz/2-1, y: 10, w: 2, h: sz-20, c: '#cc44ff' },
          { x: sz/2-6, y: sz/2-1, w: 12, h: 2, c: '#cc44ff' },
          { x: sz/2-4, y: sz/2-4, w: 8, h: 8, c: '#8866cc' },
          { x: sz/2-2, y: sz/2-2, w: 4, h: 4, c: '#2d334a' }
        ];
        return [
          // Arena with crossed swords, gold trim
          { x: 2, y: 4, w: sz-4, h: sz-6, c: '#1a1a2e' },
          { x: 4, y: 6, w: sz-8, h: sz-10, c: '#2d334a' },
          { x: 2, y: 4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 6, y: sz/2, w: sz-12, h: 4, c: '#6e7788' },
          { x: sz/2-1, y: 8, w: 2, h: sz-16, c: '#cc44ff' },
          { x: sz/2-8, y: sz/2-1, w: 16, h: 2, c: '#cc44ff' },
          { x: sz/2-6, y: sz/2-6, w: 12, h: 12, c: '#8866cc' },
          { x: sz/2-4, y: sz/2-4, w: 8, h: 8, c: '#2d334a' },
          { x: sz/2-2, y: sz/2-2, w: 4, h: 4, c: '#f5c542' },
          { x: sz/2-1, y: sz/2-1, w: 2, h: 2, c: '#fff' },
          { x: 4, y: 4, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: 4, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— OVERCLOCK PYLON (1×1, utility) ———
      overclock_pylon: () => {
        if (t === 1) return [
          // Short rod
          { x: s/2-3, y: 8, w: 6, h: s-10, c: '#1a2e44' },
          { x: s/2-2, y: 10, w: 4, h: s-14, c: '#2a4e66' },
          { x: s/2-2, y: 8, w: 4, h: 3, c: '#44ddee' },
          { x: s/2-1, y: 9, w: 2, h: 2, c: '#fff' }
        ];
        if (t === 2) return [
          // Pylon with energy pulse
          { x: s/2-4, y: 4, w: 8, h: s-6, c: '#1a2e44' },
          { x: s/2-2, y: 6, w: 4, h: s-10, c: '#2a4e66' },
          { x: s/2-3, y: s/2-3, w: 6, h: 6, c: '#44ddee' },
          { x: s/2-1, y: s/2-1, w: 2, h: 2, c: '#fff' },
          { x: s/2-3, y: 4, w: 6, h: 3, c: '#44ddee' },
          { x: s/2-1, y: 2, w: 2, h: 4, c: '#66eeff' }
        ];
        return [
          // Tall glowing obelisk, gold cap
          { x: s/2-5, y: 2, w: 10, h: s-3, c: '#1a2e44' },
          { x: s/2-5, y: 2, w: 10, h: 2, c: '#f5c542' },
          { x: s/2-3, y: 4, w: 6, h: s-7, c: '#2a4e66' },
          { x: s/2-4, y: s/2-4, w: 8, h: 8, c: '#44ddee' },
          { x: s/2-2, y: s/2-2, w: 4, h: 4, c: '#66eeff' },
          { x: s/2-1, y: s/2-1, w: 2, h: 2, c: '#fff' },
          { x: s/2-4, y: 4, w: 8, h: 3, c: '#44ddee' },
          { x: s/2-1, y: 1, w: 2, h: 3, c: '#ffe066' },
          { x: s/2-5, y: s-3, w: 10, h: 2, c: '#f5c542' },
          { x: 2, y: s/2, w: 2, h: 2, c: '#88ffff' },
          { x: s-4, y: s/2, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— REPAIR DRONE BAY (2×2, utility) ———
      repair_drone_bay: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Toolbox
          { x: 10, y: 12, w: sz-20, h: sz-18, c: '#1a2e22' },
          { x: 14, y: 14, w: sz-28, h: sz-22, c: '#2a4e3a' },
          { x: sz/2-4, y: sz/2-1, w: 8, h: 4, c: '#6e7788' },
          { x: sz/2-1, y: sz/2, w: 2, h: 2, c: '#2ee67a' }
        ];
        if (t === 2) return [
          // Bay with drone shape
          { x: 4, y: 6, w: sz-8, h: sz-8, c: '#1a2e22' },
          { x: 6, y: 8, w: sz-12, h: sz-12, c: '#2a4e3a' },
          { x: sz/2-6, y: sz/2-2, w: 12, h: 6, c: '#3a3f5c' },
          { x: sz/2-4, y: 10, w: 8, h: 4, c: '#6e7788' },
          { x: sz/2-6, y: 12, w: 4, h: 2, c: '#6e7788' },
          { x: sz/2+2, y: 12, w: 4, h: 2, c: '#6e7788' },
          { x: sz/2-1, y: 10, w: 2, h: 2, c: '#2ee67a' }
        ];
        return [
          // Hangar with multiple drones, gold trim
          { x: 2, y: 4, w: sz-4, h: sz-6, c: '#1a2e22' },
          { x: 4, y: 6, w: sz-8, h: sz-10, c: '#2a4e3a' },
          { x: 2, y: 4, w: sz-4, h: 2, c: '#f5c542' },
          { x: 6, y: sz/2+2, w: sz-12, h: 6, c: '#3a3f5c' },
          // Drone 1
          { x: 10, y: 8, w: 6, h: 3, c: '#6e7788' },
          { x: 8, y: 9, w: 3, h: 2, c: '#6e7788' },
          { x: 15, y: 9, w: 3, h: 2, c: '#6e7788' },
          { x: 12, y: 8, w: 2, h: 2, c: '#2ee67a' },
          // Drone 2
          { x: sz/2+4, y: 12, w: 6, h: 3, c: '#6e7788' },
          { x: sz/2+2, y: 13, w: 3, h: 2, c: '#6e7788' },
          { x: sz/2+9, y: 13, w: 3, h: 2, c: '#6e7788' },
          { x: sz/2+6, y: 12, w: 2, h: 2, c: '#2ee67a' },
          // Bay doors
          { x: 6, y: sz-8, w: sz-12, h: 2, c: '#f5c542' },
          { x: 4, y: 4, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: 4, w: 2, h: 2, c: '#88ffff' }
        ];
      },

      // ——— BUILDER HUT (1×1, utility) ———
      builder_hut: () => {
        // maxLevel 1 — always tier 1
        if (t === 1) return [
          // Small tent with hammer
          { x: 2, y: 6, w: s-4, h: s-8, c: '#4a3a10' },
          { x: 4, y: 8, w: s-8, h: s-12, c: '#6e5520' },
          { x: s/2-2, y: 6, w: 4, h: 8, c: '#8d6e52' },
          { x: s/2-4, y: 5, w: 8, h: 3, c: '#6e7788' },
          { x: s/2-3, y: s-8, w: 6, h: 5, c: '#3a2a0a' }
        ];
        if (t === 2) return [
          // Small hut with door
          { x: 2, y: 4, w: s-4, h: s-6, c: '#4a3a10' },
          { x: 3, y: 5, w: s-6, h: s-8, c: '#6e5520' },
          { x: 2, y: 2, w: s-4, h: 4, c: '#8d6e52' },
          { x: s/2-1, y: 2, w: 2, h: 2, c: '#6e7788' },
          { x: s/2-2, y: s-8, w: 4, h: 5, c: '#3a2a0a' },
          { x: s/2-1, y: s-6, w: 2, h: 2, c: '#f5c542' }
        ];
        return [
          // Workshop with chimney, gold trim
          { x: 1, y: 2, w: s-2, h: s-3, c: '#4a3a10' },
          { x: 1, y: 2, w: s-2, h: 2, c: '#f5c542' },
          { x: 2, y: 4, w: s-4, h: s-7, c: '#6e5520' },
          { x: 2, y: 1, w: s-4, h: 3, c: '#8d6e52' },
          { x: s-6, y: 0, w: 3, h: 3, c: '#553333' },
          { x: s/2-2, y: s-7, w: 4, h: 5, c: '#3a2a0a' },
          { x: s/2-1, y: s-5, w: 2, h: 2, c: '#f5c542' },
          { x: 4, y: 7, w: 3, h: 3, c: '#6e7788' },
          { x: s-7, y: 0, w: 2, h: 2, c: '#ff8844' },
          { x: 2, y: s-3, w: s-4, h: 2, c: '#f5c542' }
        ];
      },

      // ——— BEACON TOWER (2×2, utility) ———
      beacon_tower: () => {
        const sz = s * 2;
        if (t === 1) return [
          // Short pole
          { x: sz/2-3, y: 12, w: 6, h: sz-16, c: '#1a1a2e' },
          { x: sz/2-2, y: 14, w: 4, h: sz-20, c: '#2d334a' },
          { x: sz/2-1, y: 10, w: 2, h: 6, c: '#6e7788' },
          { x: sz/2-3, y: 10, w: 2, h: 2, c: '#44ddee' },
          { x: sz/2+1, y: 10, w: 2, h: 2, c: '#44ddee' }
        ];
        if (t === 2) return [
          // Tower with antenna
          { x: sz/2-5, y: 6, w: 10, h: sz-8, c: '#1a1a2e' },
          { x: sz/2-3, y: 8, w: 6, h: sz-12, c: '#2d334a' },
          { x: sz/2-1, y: 2, w: 2, h: 8, c: '#6e7788' },
          { x: sz/2-6, y: 4, w: 2, h: 2, c: '#44ddee' },
          { x: sz/2+4, y: 4, w: 2, h: 2, c: '#44ddee' },
          { x: sz/2-8, y: 6, w: 2, h: 2, c: '#2299aa' },
          { x: sz/2+6, y: 6, w: 2, h: 2, c: '#2299aa' },
          { x: sz/2-1, y: 2, w: 2, h: 2, c: '#66eeff' }
        ];
        return [
          // Tall tower, signal waves, light, gold trim
          { x: sz/2-6, y: 4, w: 12, h: sz-6, c: '#1a1a2e' },
          { x: sz/2-6, y: 4, w: 12, h: 2, c: '#f5c542' },
          { x: sz/2-4, y: 6, w: 8, h: sz-10, c: '#2d334a' },
          { x: sz/2-1, y: 0, w: 2, h: 8, c: '#6e7788' },
          { x: sz/2-1, y: 0, w: 2, h: 2, c: '#fff' },
          { x: sz/2-8, y: 2, w: 2, h: 2, c: '#44ddee' },
          { x: sz/2+6, y: 2, w: 2, h: 2, c: '#44ddee' },
          { x: sz/2-10, y: 4, w: 2, h: 2, c: '#2299aa' },
          { x: sz/2+8, y: 4, w: 2, h: 2, c: '#2299aa' },
          { x: sz/2-12, y: 6, w: 2, h: 2, c: '#115566' },
          { x: sz/2+10, y: 6, w: 2, h: 2, c: '#115566' },
          { x: sz/2-6, y: sz-4, w: 12, h: 2, c: '#f5c542' },
          { x: sz/2-4, y: 8, w: 8, h: 2, c: '#44ddee' },
          { x: 4, y: sz-6, w: 2, h: 2, c: '#88ffff' },
          { x: sz-6, y: sz-6, w: 2, h: 2, c: '#88ffff' }
        ];
      }
    };

    const fn = sprites[buildingId];
    return fn ? fn() : [{ x: 2, y: 2, w: s - 4, h: s - 4, c: '#ff00ff' }];
  }


  // ===== Save State Migration =====
  function migrateState(state) {
    if (!state) return state;
    let changed = false;
    // Rename war_room → barracks, boot_loader/compiler_bay → training_ground
    if (state.buildings) {
      state.buildings = state.buildings.map(b => {
        if (b.id === 'war_room') { changed = true; return { ...b, id: 'barracks' }; }
        if (b.id === 'boot_loader' || b.id === 'compiler_bay') { changed = true; return { ...b, id: 'training_ground' }; }
        return b;
      });
    }
    if (state.buildQueue) {
      state.buildQueue = state.buildQueue.map(q => {
        if (q.buildingId === 'war_room') { changed = true; return { ...q, buildingId: 'barracks' }; }
        if (q.buildingId === 'boot_loader' || q.buildingId === 'compiler_bay') { changed = true; return { ...q, buildingId: 'training_ground' }; }
        return q;
      });
    }
    // Migrate old troop IDs
    if (state.troops) {
      state.troops = state.troops.map(t => {
        if (t.id === 'ping_tank') { changed = true; return { ...t, id: 'cipher_knight' }; }
        if (t.id === 'packet_sniper') { changed = true; return { ...t, id: 'packet_warrior' }; }
        if (t.id === 'daemon') { changed = true; return { ...t, id: 'malware_wolf' }; }
        if (t.id === 'rootkit') { changed = true; return { ...t, id: 'rootkit_assassin' }; }
        if (t.id === 'siege_breaker') { changed = true; return { ...t, id: 'quantum_golem' }; }
        if (t.id === 'quantum_ghost') { changed = true; return { ...t, id: 'phantom_zero' }; }
        if (t.id === 'zero_day') { changed = true; return { ...t, id: 'zero_day_titan' }; }
        return t;
      });
    }
    if (state.trainingQueue) {
      state.trainingQueue = state.trainingQueue.map(q => {
        if (q.troopId === 'ping_tank') { changed = true; return { ...q, troopId: 'cipher_knight' }; }
        if (q.troopId === 'packet_sniper') { changed = true; return { ...q, troopId: 'packet_warrior' }; }
        if (q.troopId === 'daemon') { changed = true; return { ...q, troopId: 'malware_wolf' }; }
        if (q.troopId === 'rootkit') { changed = true; return { ...q, troopId: 'rootkit_assassin' }; }
        if (q.troopId === 'siege_breaker') { changed = true; return { ...q, troopId: 'quantum_golem' }; }
        if (q.troopId === 'quantum_ghost') { changed = true; return { ...q, troopId: 'phantom_zero' }; }
        if (q.troopId === 'zero_day') { changed = true; return { ...q, troopId: 'zero_day_titan' }; }
        return q;
      });
    }
    return state;
  }

  // ===== Default Village State =====
  function getDefaultVillageState() {
    return {
      buildings: [],       // [{id, level, x, y, hp}]
      troops: [],          // [{id, count}]
      trainingQueue: [],   // [{troopId, startTime, endTime}]
      raidLog: [],         // [{timestamp, result, details}]
      inventory: [],       // [{id, level}] — stored buildings
      buildQueue: [],      // [{buildingId, level, x, y, startTime, endTime, type}]
      lastResourceTick: Date.now(),
      lastRaidCheck: 0,
      lastRaidTime: 0,
      totalRaidsWon: 0,
      totalRaidsLost: 0,
      housingUsed: 0
    };
  }

  // ===== Helpers =====
  function getUnlockedBuildings(nexusLevel) {
    const unlocked = new Set();
    // Nexus always available
    unlocked.add('nexus');
    for (let lv = 1; lv <= nexusLevel; lv++) {
      if (NEXUS_GATES[lv]) {
        for (const id of NEXUS_GATES[lv]) unlocked.add(id);
      }
    }
    return unlocked;
  }

  function getBuildingCost(buildingId, level) {
    const def = BUILDINGS[buildingId];
    if (!def) return null;
    const idx = Math.max(0, Math.min(level - 1, def.costs.length - 1));
    return def.costs[idx];
  }

  function canAfford(resources, cost) {
    if (!cost) return false;
    for (const [res, amount] of Object.entries(cost)) {
      if ((resources[res] || 0) < amount) return false;
    }
    return true;
  }

  function deductCost(resources, cost) {
    for (const [res, amount] of Object.entries(cost)) {
      resources[res] = (resources[res] || 0) - amount;
    }
  }

  function getNexusLevel(villageState) {
    if (!villageState || !villageState.buildings) return 0;
    const nexus = villageState.buildings.find(b => b.id === 'nexus');
    return nexus ? nexus.level : 0;
  }

  function getHousingCapacity(villageState) {
    let cap = 5; // base
    if (!villageState || !villageState.buildings) return cap;
    for (const b of villageState.buildings) {
      if (b.id === 'barracks') {
        const def = BUILDINGS.barracks;
        cap += def.production[b.level - 1] || 0;
      }
    }
    return cap;
  }

  function getHousingUsed(villageState) {
    if (!villageState || !villageState.troops) return 0;
    let used = 0;
    for (const t of villageState.troops) {
      const def = TROOPS[t.id];
      if (def) used += def.housing * t.count;
    }
    return used;
  }

  function getAvailableRaiders(nexusLevel) {
    return Object.values(RAIDERS).filter(r => nexusLevel >= r.minNexus);
  }

  // ===== Build Time =====
  function getBuildTime(buildingId, level) {
    const def = BUILDINGS[buildingId];
    if (!def) return 30;
    if (buildingId === 'firewall') return 10; // Walls: flat 10s
    const base = def.size * 30;
    if (level <= 1) return base;
    return Math.round(base * level * 1.5);
  }

  function getBuilderCount(villageState) {
    if (!villageState || !villageState.buildings) return 0;
    return villageState.buildings.filter(b => b.id === 'builder_hut').length;
  }

  return {
    CATEGORIES,
    BUILDINGS,
    TROOPS,
    RAIDERS,
    NEXUS_GATES,
    NEXUS_LEVEL_REQ,
    TRAINING_TIERS,
    BASE_CAPS,
    WALL_GATES,
    getResourceCaps,
    getBuildingSprite,
    getDefaultVillageState,
    getUnlockedBuildings,
    getBuildingCost,
    canAfford,
    deductCost,
    getNexusLevel,
    getHousingCapacity,
    getHousingUsed,
    getAvailableRaiders,
    getMaxWalls,
    getWallCount,
    getBuildTime,
    getBuilderCount,
    getMaxTrainTier,
    migrateState
  };
})();
