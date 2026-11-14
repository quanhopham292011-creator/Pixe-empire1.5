/**
 * Bộ sinh bản đồ Trái Đất (Earth Map) & khởi tạo Quốc gia / Thuộc địa cho Pixel Empire
 */

import { Tile, TerrainType, MapDimension, Nation, NationPersonality, GameDifficulty, SettlementTier } from '../types';
import { REAL_NATION_NAMES, FOREST_COLONY_NAMES, GENERAL_ROSTER } from './constants';
import { createDefaultGeneral } from './generalCombat';
import { earthLandRatio, lonLatToTile } from './earthMask';
import { WORLD_COUNTRIES } from './worldCountries';
import { generateDeposits, initNationResources } from './resources';

function pseudoNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number, scale: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;

  const v00 = pseudoNoise(x0, y0, seed);
  const v10 = pseudoNoise(x0 + 1, y0, seed);
  const v01 = pseudoNoise(x0, y0 + 1, seed);
  const v11 = pseudoNoise(x0 + 1, y0 + 1, seed);

  const i1 = v00 * (1 - fx) + v10 * fx;
  const i2 = v01 * (1 - fx) + v11 * fx;
  return i1 * (1 - fy) + i2 * fy;
}


function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

export function getNationColor(i: number): string {
  if (i === 0) return '#64748b';
  if (i === 1) return '#2563eb';
  if (i === 2) return '#dc2626';
  const k = i - 2;
  let hue = (k * 137.508) % 360;
  let tries = 0;
  while (tries < 20 && ((hue >= 195 && hue <= 245) || hue >= 345 || hue <= 15)) {
    tries++;
    hue = (hue + 53.7) % 360;
  }
  const sat = [75, 85, 70][i % 3];
  const light = [55, 48, 62][i % 3];
  return hslToHex(hue, sat, light);
}

/**
 * Sinh bản đồ Trái Đất mặc định
 */
export function generateWorldMap(
  size: MapDimension = 96, 
  difficulty: GameDifficulty = 'EASY',
  customPlayerName: string = 'Việt Nam',
  seed: number = Math.random() * 1000,
  customPlayerPos?: { x: number; y: number }
): {
  tiles: Tile[][];
  nations: Nation[];
} {
  const tiles: Tile[][] = [];

  for (let y = 0; y < size; y++) {
    tiles[y] = [];
    for (let x = 0; x < size; x++) {
      // Tỉ lệ đất liền thật của Trái Đất tại ô này
      const landRatio = earthLandRatio(x, y, size);

      // Noise chỉ dùng để chia Núi / Rừng / Đồng bằng trên đất liền
      const n1 = smoothNoise(x, y, seed, size * 0.30);
      const n2 = smoothNoise(x, y, seed + 20, size * 0.12) * 0.4;
      const n3 = smoothNoise(x, y, seed + 40, size * 0.05) * 0.2;
      const h = (n1 + n2 + n3) / 1.6;

      let terrain: TerrainType = 'WATER';
      if (landRatio >= 0.5) {
        if (h > 0.70) terrain = 'MOUNTAIN';
        else if (h > 0.54) terrain = 'FOREST';
        else terrain = 'LAND';
      }

      tiles[y][x] = {
        x,
        y,
        terrain,
        owner: 0,
        building: 'NONE',
        defenseBonus: terrain === 'MOUNTAIN' ? 2.0 : terrain === 'FOREST' ? 1.3 : 1.0,
        isBorder: false,
        hasHarborAccess: false,
      };
    }
  }

  // Mật độ quốc gia và thuộc địa theo kích thước bản đồ
  const baseMinorCount = size === 64 ? 14 : size === 96 ? 24 : size === 128 ? 36 : 48;
  // Thêm các bản làng dân tộc Việt Nam rải dày đặc hơn trên bản đồ
  const ethnicExtraCount = size === 64 ? 10 : size === 96 ? 18 : size === 128 ? 30 : 44;
  const minorCount = baseMinorCount + ethnicExtraCount;

  // Màu quốc gia & thuộc địa được cấp tự động qua getNationColor(i) (tươi sáng, không lặp)

  const cleanPlayerName = (customPlayerName && customPlayerName.trim()) ? customPlayerName.trim() : 'Việt Nam';
  const officialCountryNameSet = new Set(
    [...REAL_NATION_NAMES, ...WORLD_COUNTRIES.map(c => c.name)].map(n => n.trim().toLowerCase())
  );

  // Danh sách tên riêng biệt cho Thuộc địa rừng (lọc bỏ toàn bộ tên trùng quốc gia chính thức)
  const shuffledForestNames = FOREST_COLONY_NAMES.filter(
    name => !officialCountryNameSet.has(name.trim().toLowerCase())
  );
  for (let i = shuffledForestNames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledForestNames[i], shuffledForestNames[j]] = [shuffledForestNames[j], shuffledForestNames[i]];
  }
  let forestNameIdx = 0;
  const nextForestName = (): string => {
    const pool = shuffledForestNames.length > 0 ? shuffledForestNames : ['Rừng Nguyên Sinh'];
    const name = pool[forestNameIdx % pool.length];
    const round = Math.floor(forestNameIdx / pool.length);
    forestNameIdx++;
    return round === 0 ? name : `${name} ${round + 1}`;
  };

  // Tên bản làng theo các dân tộc Việt Nam (lọc trùng tên quốc gia chính thức) + vài tên "bản" vui
  const ETHNIC_NAME_POOL: string[] = [
    ...['Mông','Dao','Tày','Thái','Nùng','Giáy','Hà Nhì','Lô Lô','Pà Thẻn','Si La','Sán Chay','Sán Dìu','La Chí','Pu Péo','Phù Lá','La Hủ','Lự','Kháng','Khơ Mú','Xinh Mun','Cống','Mảng','Bố Y','Cờ Lao','La Ha','Thổ','Ơ Đu','Chứt','Hoa'].map(n => `Bản ${n}`),
    'Bản Mèo', 'Bản Chuột', 'Bản Gấu', 'Bản Hổ', 'Bản Voi', 'Bản Cú', 'Bản Rùa',
    'Bản Tuất', 'Bản Gà',
  ].filter(name => !officialCountryNameSet.has(name.trim().toLowerCase()));
  for (let i = ETHNIC_NAME_POOL.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ETHNIC_NAME_POOL[i], ETHNIC_NAME_POOL[j]] = [ETHNIC_NAME_POOL[j], ETHNIC_NAME_POOL[i]];
  }
  let ethnicNameIdx = 0;
  const nextEthnicName = (): string => {
    const name = ETHNIC_NAME_POOL[ethnicNameIdx % ETHNIC_NAME_POOL.length];
    const round = Math.floor(ethnicNameIdx / ETHNIC_NAME_POOL.length);
    ethnicNameIdx++;
    return round === 0 ? name : `${name} ${round + 1}`;
  };

  const spawnLocations: { x: number; y: number }[] = [];

  // Tìm ô đất liền gần nhất (nếu ô đang là biển)
  const snapToLand = (px: number, py: number, maxR = 14): { x: number; y: number } => {
    if (tiles[py][px].terrain !== 'WATER') return { x: px, y: py };
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = px + dx;
          const ny = py + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size && tiles[ny][nx].terrain !== 'WATER') {
            return { x: nx, y: ny };
          }
        }
      }
    }
    tiles[py][px].terrain = 'LAND'; // dự phòng
    return { x: px, y: py };
  };

  // 1. NGƯỜI CHƠI: Việt Nam (kinh độ 106, vĩ độ 16) hoặc vị trí tùy chọn
  const playerTarget = customPlayerPos
    ? snapToLand(Math.max(1, Math.min(size - 2, customPlayerPos.x)), Math.max(1, Math.min(size - 2, customPlayerPos.y)))
    : snapToLand(lonLatToTile(106, 16, size).x, lonLatToTile(106, 16, size).y);
  spawnLocations.push(playerTarget); // Index 0 -> Player (ID 1)

  // 2. QUỐC GIA AI THẬT: đặt đúng vị trí ngoài đời thực (bao gồm Đức, không trùng tên người chơi)
  const spawnInfo: ({ name: string; dev: boolean; isCountry: boolean } | null)[] = [
    { name: cleanPlayerName, dev: true, isCountry: true }, // Player
  ];
  const eligibleWorldCountries = WORLD_COUNTRIES.filter(
    c => c.name.trim().toLowerCase() !== cleanPlayerName.toLowerCase()
  );
  const devList = eligibleWorldCountries.filter(c => c.dev);
  const otherList = eligibleWorldCountries.filter(c => !c.dev);
  const shuffleArr = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const candidates = [...shuffleArr(devList), ...shuffleArr(otherList)];

  const isFarEnough = (px: number, py: number, minDist = 3.5) =>
    !spawnLocations.some(loc => Math.hypot(loc.x - px, loc.y - py) < minDist);

  const aiCountryTarget = baseMinorCount + 1;
  const aiTotalTarget = minorCount + 1;
  let placed = 0;
  for (let c = 0; c < candidates.length && placed < aiCountryTarget; c++) {
    const country = candidates[c];
    const base = lonLatToTile(country.lon, country.lat, size);
    for (let attempt = 0; attempt < 12; attempt++) {
      const jx = Math.max(1, Math.min(size - 2, base.x + Math.floor(Math.random() * 5 - 2)));
      const jy = Math.max(1, Math.min(size - 2, base.y + Math.floor(Math.random() * 5 - 2)));
      if (tiles[jy][jx].terrain === 'WATER') continue;
      if (!isFarEnough(jx, jy)) continue;
      spawnLocations.push({ x: jx, y: jy });
      spawnInfo.push({ name: country.name, dev: country.dev, isCountry: true });
      placed++;
      break;
    }
  }

  // Nếu còn thiếu (thuộc địa rừng / bộ lạc / bản làng), chọn ô đất ngẫu nhiên với tên tách biệt
  let guard = 0;
  while (placed < aiTotalTarget && guard < 3000) {
    guard++;
    const rx = 2 + Math.floor(Math.random() * (size - 4));
    const ry = 2 + Math.floor(Math.random() * (size - 4));
    if (tiles[ry][rx].terrain === 'WATER' || !isFarEnough(rx, ry, 3.3)) continue;
    spawnLocations.push({ x: rx, y: ry });
    spawnInfo.push({ name: nextEthnicName(), dev: false, isCountry: false });
    placed++;
  }

  // 3. CHỌN NGẪU NHIÊN 1 QUỐC GIA AI LÀM BOSS (không cố định Đức, không trùng người chơi)
  const bossCountryIndices: number[] = [];
  const fallbackAiIndices: number[] = [];
  for (let idx = 2; idx <= spawnLocations.length; idx++) {
    const meta = spawnInfo[idx - 1];
    fallbackAiIndices.push(idx);
    if (meta?.isCountry && meta.name.trim().toLowerCase() !== cleanPlayerName.toLowerCase()) {
      bossCountryIndices.push(idx);
    }
  }
  const bossPool = bossCountryIndices.length > 0 ? bossCountryIndices : fallbackAiIndices;
  const bossNationId = bossPool.length > 0
    ? bossPool[Math.floor(Math.random() * bossPool.length)]
    : -1;

  // Cập nhật giáp biển
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (tiles[y][x].terrain !== 'WATER') {
        const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        tiles[y][x].hasHarborAccess = neighbors.some(([nx, ny]) => 
          nx >= 0 && nx < size && ny >= 0 && ny < size && tiles[ny][nx].terrain === 'WATER'
        );
      }
    }
  }

  // Khởi tạo danh sách Quốc gia & Thuộc địa
  const nations: Nation[] = [];

  // Nation 0: Trung lập
  nations.push({
    id: 0,
    name: "Vùng Tự Do",
    color: "#64748b",
    isPlayer: false,
    personality: 'DEFENSIVE',
    gold: 0,
    goldIncome: 0,
    troops: 0,
    maxTroops: 0,
    population: 0,
    territoryCount: 0,
    isEliminated: false,
    capitalX: 0,
    capitalY: 0,
    hasPort: false,
    techLevels: { economy: 0, military: 0, defense: 0 },
    supremeTechUnlocked: false,
    supremeTechLevels: { economy: 0, military: 0, defense: 0 },
    diplomacy: {},
    allianceInvites: [],
    lastRejectedInviteTimer: {},
    traitorTimer: 0
  });

  const personalities: NationPersonality[] = ['DEFENSIVE', 'AGGRESSIVE', 'MERCHANT', 'OPPORTUNIST'];

  const actualTotalNations = spawnLocations.length;

  for (let i = 1; i <= actualTotalNations; i++) {
    const isPlayer = i === 1;
    const isBoss = i === bossNationId;
    const spawn = spawnLocations[i - 1] || { x: Math.floor(size / 2), y: Math.floor(size / 2) };

    const defaultDiplomacy: Nation['diplomacy'] = {};
    for (let j = 1; j <= actualTotalNations; j++) {
      if (j !== i) {
        defaultDiplomacy[j] = { status: 'WAR', relation: 0, truceTimer: 0 };
      }
    }

    let tier: SettlementTier = 'TIER_1_FOREST';
    let colonyCategory: 'FOREST' | 'TRIBE' | 'ETHNIC' | undefined = undefined;
    let initPop = 3;
    let initTroops = 6;
    let initGold = 50;
    let initLandRadius = 1.4;

    const spawnMeta = spawnInfo[i - 1];

    if (isPlayer) {
      tier = 'PLAYER';
      initPop = difficulty === 'EASY' ? 16 : difficulty === 'NORMAL' ? 13 : 10;
      initTroops = difficulty === 'EASY' ? 34 : difficulty === 'NORMAL' ? 26 : 20;
      initGold = difficulty === 'EASY' ? 180 : difficulty === 'NORMAL' ? 120 : 75; // Tăng ~1.5 lần
      initLandRadius = difficulty === 'EASY' ? 2.8 : difficulty === 'NORMAL' ? 2.5 : 2.2;
    } else if (isBoss) {
      tier = 'BOSS';
      initPop = difficulty === 'EASY' ? 14 : difficulty === 'NORMAL' ? 18 : difficulty === 'HARD' ? 24 : 28;
      initTroops = difficulty === 'EASY' ? 24 : difficulty === 'NORMAL' ? 34 : difficulty === 'HARD' ? 44 : 50;
      initGold = difficulty === 'EASY' ? 90 : difficulty === 'NORMAL' ? 150 : difficulty === 'HARD' ? 240 : 300;
      initLandRadius = difficulty === 'EASY' ? 2.8 : difficulty === 'NORMAL' ? 2.5 : 2.2;
    } else if (spawnMeta?.isCountry) {
      // Quốc gia chính thức (từ WORLD_COUNTRIES): không bao giờ bị biến thành thuộc địa rừng
      tier = 'TIER_3_ETHNIC';
      colonyCategory = 'ETHNIC';
      if (spawnMeta.dev) {
        initPop = difficulty === 'EASY' ? 10 : difficulty === 'NORMAL' ? 13 : 16;
        initTroops = difficulty === 'EASY' ? 18 : difficulty === 'NORMAL' ? 25 : 32;
        initGold = difficulty === 'EASY' ? 80 : difficulty === 'NORMAL' ? 120 : 160;
        initLandRadius = difficulty === 'EASY' ? 2.2 : difficulty === 'NORMAL' ? 2.5 : 2.8;
      } else {
        initPop = difficulty === 'EASY' ? 8 : difficulty === 'NORMAL' ? 11 : 13;
        initTroops = difficulty === 'EASY' ? 15 : difficulty === 'NORMAL' ? 20 : 25;
        initGold = difficulty === 'EASY' ? 70 : difficulty === 'NORMAL' ? 100 : 130;
        initLandRadius = difficulty === 'EASY' ? 2.0 : difficulty === 'NORMAL' ? 2.2 : 2.4;
      }
    } else {
      const randTier = Math.random();
      if (randTier < 0.50) {
        tier = 'TIER_1_FOREST';
        colonyCategory = 'FOREST';
        initPop = 3;
        initTroops = 6;
        initGold = 40;
        initLandRadius = 1.2;
      } else if (randTier < 0.85) {
        tier = 'TIER_2_TRIBE';
        colonyCategory = 'TRIBE';
        initPop = 6;
        initTroops = 14;
        initGold = 70;
        initLandRadius = 1.8;
      } else {
        tier = 'TIER_3_ETHNIC';
        colonyCategory = 'ETHNIC';
        initPop = 10;
        initTroops = 20;
        initGold = 100;
        initLandRadius = 2.2;
      }
      if (difficulty === 'EASY') {
        initPop = Math.max(2, Math.round(initPop * 0.75));
        initTroops = Math.max(4, Math.round(initTroops * 0.75));
        initGold = Math.max(30, Math.round(initGold * 0.75));
      }
    }

    // Chế độ CỰC KHÓ (Ác mộng): Bot AI & Boss khởi đầu mạnh tạo áp lực cao
    if (!isPlayer && difficulty === 'EXTREME') {
      initPop = Math.round(initPop * 1.25);
      initTroops = Math.round(initTroops * 1.45);
      initGold = Math.round(initGold * 1.5);
      if (!isBoss) initLandRadius += 0.5;
    }

    // Tách biệt tên: Thuộc địa rừng luôn dùng FOREST_COLONY_NAMES, tuyệt đối không lấy tên quốc gia chính thức
    let colonyBaseName = spawnMeta?.name ?? nextEthnicName();
    if (colonyCategory === 'FOREST') {
      colonyBaseName = nextForestName();
    } else if (colonyCategory === 'TRIBE' && officialCountryNameSet.has(colonyBaseName.trim().toLowerCase())) {
      colonyBaseName = nextEthnicName();
    }

    let nationName = "";
    let generalName = "";

    if (isPlayer) {
      nationName = `${cleanPlayerName} (Bạn)`;
      generalName = `Tướng Trần Hưng Đạo`;
    } else if (isBoss) {
      const bossCountryName = spawnMeta?.name || 'Đế Chế';
      nationName = `${bossCountryName} (Boss)`;
      generalName = `Thống Chế ${bossCountryName}`;
    } else {
      if (spawnMeta?.dev) {
        nationName = `${colonyBaseName} [Phát Triển]`;
        generalName = `Đại Tướng ${colonyBaseName}`;
      } else if (colonyCategory === 'FOREST') {
        nationName = `${colonyBaseName} [Rừng]`;
        generalName = `Vệ Binh ${colonyBaseName}`;
      } else if (colonyCategory === 'TRIBE') {
        nationName = `${colonyBaseName} [Bộ Lạc]`;
        generalName = `Tù Trưởng ${colonyBaseName}`;
      } else {
        nationName = `${colonyBaseName} [Dân Tộc]`;
        generalName = `Chủ Tướng ${colonyBaseName}`;
      }
    }

    const colorIdx = isPlayer ? 1 : isBoss ? 2 : (i === 2 ? actualTotalNations + 2 : i);
    const nColor = getNationColor(colorIdx);

    // Chọn ngẫu nhiên 1 trong 5 Đại Tướng từ GENERAL_ROSTER cho quốc gia
    const rosterItem = GENERAL_ROSTER[Math.floor(Math.random() * GENERAL_ROSTER.length)];

    // Tạo Đại Tướng đại diện duy nhất (ACTIVE) cho quốc gia chuẩn General System 1.1
    const generalObj = createDefaultGeneral(`gen_${i}`, i, rosterItem.name, rosterItem.skillId, spawn.x, spawn.y);

    nations.push({
      id: i,
      name: nationName,
      color: nColor,
      isPlayer,
      tier,
      colonyCategory,
      colonyEvolveTimer: colonyCategory === 'ETHNIC' ? (difficulty === 'EASY' ? 140 : difficulty === 'NORMAL' ? 95 : difficulty === 'HARD' ? 70 : 55) : undefined, // Thời gian Dân tộc tiến hóa thành Quốc gia theo độ khó
      personality: isPlayer ? 'DEFENSIVE' : isBoss ? 'AGGRESSIVE' : colonyCategory === 'FOREST' ? 'DEFENSIVE' : colonyCategory === 'TRIBE' ? 'DEFENSIVE' : personalities[(i - 1) % personalities.length],
      gold: initGold,
      goldIncome: Math.max(2, Math.floor(initPop * 0.4)),
      troops: initTroops,
      maxTroops: Math.max(15, initPop * 3),
      population: initPop,
      territoryCount: 0,
      isEliminated: false,
      capitalX: spawn.x,
      capitalY: spawn.y,
      hasPort: false,
      general: generalObj,
      reserveGenerals: [],
      techLevels: { economy: 0, military: 0, defense: 0 },
      supremeTechUnlocked: false,
      supremeTechLevels: { economy: 0, military: 0, defense: 0 },
      diplomacy: defaultDiplomacy,
      allianceInvites: [],
      lastRejectedInviteTimer: {},
      traitorTimer: 0
    });

    // Tạo lãnh thổ ban đầu
    const cx = spawn.x;
    const cy = spawn.y;
    tiles[cy][cx].owner = i;
    tiles[cy][cx].building = 'CITY';

    for (let dy = -Math.ceil(initLandRadius); dy <= Math.ceil(initLandRadius); dy++) {
      for (let dx = -Math.ceil(initLandRadius); dx <= Math.ceil(initLandRadius); dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          const t = tiles[ny][nx];
          if (t.terrain !== 'WATER' && Math.hypot(dx, dy) <= initLandRadius) {
            t.owner = i;
          }
        }
      }
    }
  }

  generateDeposits(tiles, nations);
  initNationResources(nations);

  return { tiles, nations };
}
