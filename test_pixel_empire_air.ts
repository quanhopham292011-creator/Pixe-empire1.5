import {
  AirUnit,
  DarkTitan,
  GameEvent,
  Nation,
  SeaTradeShip,
  Tile,
} from './src/types';
import { AIR_SYSTEM_CONFIG, AIR_UNIT_SPECS } from './src/data/gameData';
import {
  AirBaseLocation,
  CachedAirContext,
  canProduceAirUnit,
  canUseAirType1,
  canUseAirType23,
  clampBomberCorridor,
  countFlyingAirUnits,
  ensureNationAirFields,
  getAirProduceCost,
  getAirTechBonuses,
  getBomberRecoveryRemainingSeconds,
  getGrandArsenalCountdownState,
  getNationAirSummary,
  getSavedBomberRoute,
  isEnemyTradeShipForNation,
  launchAirUnit,
  produceAirUnit,
  tickAirUnits,
  tickNationAirUnlocksAndSorties,
} from './src/utils/aircraftSystem';
import { initSuperBuildingOnTile, SUPER_BUILDING_CONFIG } from './src/utils/superBuildings';
import { startSupremeResearchForNation } from './src/utils/supremeTech';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`[ASSERTION FAILED]: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function makeTile(x: number, y: number, owner = 0, terrain: Tile['terrain'] = 'LAND'): Tile {
  return {
    x,
    y,
    terrain,
    owner,
    building: 'NONE',
    buildingLevel: 1,
    defenseBonus: 0,
    isBorder: false,
    hasHarborAccess: false,
  };
}

function makeGrid(size = 40): Tile[][] {
  const grid: Tile[][] = [];
  for (let y = 0; y < size; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < size; x++) {
      row.push(makeTile(x, y, 0, 'LAND'));
    }
    grid.push(row);
  }
  return grid;
}

function makeNation(id: number, name: string, capX: number, capY: number): Nation {
  const n: Nation = {
    id,
    name,
    color: id === 1 ? '#3b82f6' : '#ef4444',
    isPlayer: id === 1,
    personality: 'DEFENSIVE',
    tier: id === 3 ? 'BOSS' : undefined,
    gold: 100000,
    goldIncome: 100,
    oil: 5000,
    minerals: 5000,
    troops: 20000,
    maxTroops: 50000,
    population: 30000,
    territoryCount: 30,
    isEliminated: false,
    capitalX: capX,
    capitalY: capY,
    hasPort: false,
    techLevels: { economy: 1, military: 1, defense: 1 },
    supremeTechUnlocked: false,
    supremeTechLevels: { economy: 0, military: 0, defense: 0 },
    diplomacy: {},
    allianceInvites: [],
    lastRejectedInviteTimer: {},
    traitorTimer: 0,
  };
  ensureNationAirFields(n);
  return n;
}

function makeContext(
  nations: Nation[],
  tiles: Tile[][],
  arsenalExists: Record<number, boolean> = {}
): CachedAirContext {
  const basesByNation = new Map<number, AirBaseLocation[]>();
  const sams: { x: number; y: number; nationId: number }[] = [];
  const arsenalReadyByNation = new Map<number, boolean>();
  const arsenalExistsByNation = new Map<number, boolean>();

  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const t = tiles[y][x];
      if (!t || t.owner <= 0) continue;
      if (
        t.building === 'SUPREME_FORTRESS' ||
        t.building === 'GRAND_ACADEMY' ||
        t.building === 'GRAND_ARSENAL' ||
        t.building === 'PORT'
      ) {
        if (!basesByNation.has(t.owner)) basesByNation.set(t.owner, []);
        basesByNation.get(t.owner)!.push({ x, y });
      }
      if (t.building === 'AIR_DEFENSE') {
        sams.push({ x, y, nationId: t.owner });
      }
    }
  }
  for (const n of nations) {
    if (!n || n.id === 0) continue;
    if (arsenalExists[n.id]) {
      arsenalExistsByNation.set(n.id, true);
      arsenalReadyByNation.set(n.id, true);
    }
  }
  return { basesByNation, sams, arsenalReadyByNation, arsenalExistsByNation };
}

console.log('=== TEST HỆ THỐNG KHÔNG QUÂN 3 LOẠI (PIXEL EMPIRE) ===');

// 1. Mở khóa độc lập
console.log('\n[1] Kiểm tra mở khóa độc lập Loại 1 & Loại 2/3:');
{
  const p = makeNation(1, 'Đại Việt', 5, 5);
  const events: GameEvent[] = [];
  assert(!canUseAirType1(p), 'Chưa có Quân sự tối thượng 3 -> chưa mở Loại 1');
  assert(!canUseAirType23(p), 'Chưa có Đại Công Xưởng 60s -> chưa mở Loại 2 & 3');

  assert(AIR_SYSTEM_CONFIG.GRAND_ARSENAL_UNLOCK_SECONDS === 60, 'GRAND_ARSENAL_UNLOCK_SECONDS = 60 giây');
  assert(AIR_SYSTEM_CONFIG.BASE_RECOVERY_SECONDS === 20, 'BASE_RECOVERY_SECONDS = 20 giây');
  assert(SUPER_BUILDING_CONFIG.BUILD_TIME_SECONDS === 45, 'Siêu công trình BUILD_TIME_SECONDS = 45 giây');

  // Chưa xây Đại Công Xưởng -> không hiện bộ đếm
  assert(!getGrandArsenalCountdownState(p).show, 'Chưa xây Đại Công Xưởng -> không hiện bộ đếm ngược');

  // Quân sự tối thượng cấp 3 mở độc lập Loại 1
  p.supremeTechUnlocked = true;
  p.supremeTechLevels!.military = 3;
  assert(canUseAirType1(p), 'Quân sự tối thượng cấp 3 -> mở Loại 1 độc lập');
  assert(!canUseAirType23(p), 'Vẫn chưa mở Loại 2 & 3 khi chưa đủ 60s Đại Công Xưởng');

  // Xây xong Đại Công Xưởng -> bộ đếm hiện đúng 60s và giảm dần theo thời gian
  const cdStart = getGrandArsenalCountdownState(p, true);
  assert(cdStart.show && !cdStart.destroyed && cdStart.remainingSeconds === 60, 'Ngay sau khi xây xong Đại Công Xưởng -> bộ đếm hiện 60 giây');

  const mapExists = new Map<number, boolean>([[1, true]]);
  for (let s = 1; s <= 30; s++) {
    tickNationAirUnlocksAndSorties([makeNation(0, '', 0, 0), p], mapExists, events, s, 1);
  }
  const cdHalf = getGrandArsenalCountdownState(p, true);
  assert(p.grandArsenalTimer === 30 && !canUseAirType23(p), 'Đủ 30s vẫn chưa mở Loại 2/3');
  assert(cdHalf.show && !cdHalf.destroyed && cdHalf.remainingSeconds === 30, 'Sau 30s bộ đếm ngược hiển thị còn 30 giây');

  // Đại Công Xưởng bị phá trước 60s -> bộ đếm về 0 và hiện "Bị phá, cần xây lại"
  tickNationAirUnlocksAndSorties([makeNation(0, '', 0, 0), p], new Map<number, boolean>(), events, 31, 1);
  const cdDestroyed = getGrandArsenalCountdownState(p, false);
  assert(p.grandArsenalTimer === 0 && !canUseAirType23(p), 'Mất Đại Công Xưởng trước 60s -> reset bộ đếm về 0');
  assert(cdDestroyed.show && cdDestroyed.destroyed && cdDestroyed.remainingSeconds === 0, 'Bị phá trước 60s -> bộ đếm chuyển trạng thái Bị phá, cần xây lại');

  // Xây lại và tồn tại đủ 60s -> mở vĩnh viễn, hiện thông báo và bộ đếm biến mất
  for (let s = 1; s <= 60; s++) {
    tickNationAirUnlocksAndSorties([makeNation(0, '', 0, 0), p], mapExists, events, 31 + s, 1);
  }
  const cdDone = getGrandArsenalCountdownState(p, true);
  assert(canUseAirType23(p), 'Đại Công Xưởng tồn tại đủ 60s -> mở khóa Loại 2 & 3');
  assert(!cdDone.show, 'Sau khi đã mở khóa Loại 2 & 3 -> bộ đếm biến mất');
  assert(
    events.some(ev => ev.title.includes('Đã mở khóa Loại 2 & Loại 3')),
    'Khi đủ 60s -> phát thông báo "Đã mở khóa Loại 2 & Loại 3"'
  );
  tickNationAirUnlocksAndSorties([makeNation(0, '', 0, 0), p], new Map<number, boolean>(), events, 120, 1);
  assert(canUseAirType23(p) && !getGrandArsenalCountdownState(p, false).show, 'Phá Đại Công Xưởng sau khi đã mở -> Loại 2 & 3 vẫn mở vĩnh viễn và không hiện bộ đếm');

  // Kiểm tra giảm 10% thời gian nghiên cứu công nghệ tối thượng (sup_eco_1: 60 * 0.9 = 54s)
  const supRes = startSupremeResearchForNation(p, 'sup_eco_1', null);
  assert(supRes.ok && supRes.researching?.totalTime === 54, 'Nghiên cứu Công nghệ Tối Thượng giảm 10% thời gian (60s -> 54s)');
}

// 2. Sản xuất, giới hạn quân (50/150/120), giới hạn sở hữu 12 chiếc, dầu = 0 khi tắt tài nguyên & 0 dầu khi xuất kích
console.log('\n[2] Kiểm tra chi phí, giới hạn quân số (50/150/120), sở hữu 12 chiếc & lượt xuất kích:');
{
  const tiles = makeGrid(40);
  const p = makeNation(1, 'Đại Việt', 5, 5);
  p.supremeTechLevels!.military = 3;
  p.airAdvancedUnlocked = true;
  p.troops = 550; // 60% = 330 quân biên chế tối đa
  tiles[5][6].owner = 1;
  tiles[5][6].building = 'PORT';
  const nations = [makeNation(0, '', 0, 0), p];
  const ctx = makeContext(nations, tiles, { 1: true });
  const airUnits: AirUnit[] = [];

  assert(AIR_SYSTEM_CONFIG.MAX_OWNED_PER_NATION === 12, 'Giới hạn sở hữu mỗi nước = 12 máy bay (bằng MAX_FLYING_GLOBAL)');
  assert(AIR_UNIT_SPECS.FIGHTER.troopCost === 50, 'Loại 1 (Chiến Đấu) tốn 50 quân');
  assert(
    AIR_UNIT_SPECS.SQUADRON.troopCost === 150 && AIR_UNIT_SPECS.SQUADRON.troopCostPerPlane === 50,
    'Loại 2 (Tiểu Đội) tốn 150 quân (3 chiếc × 50)'
  );
  assert(AIR_UNIT_SPECS.BOMBER.troopCost === 120, 'Loại 3 (Ném Bom) tốn 120 quân');

  // Multiplayer (resourcesEnabled = false) -> oilCost = 0
  const mpCost = getAirProduceCost('FIGHTER', false);
  assert(mpCost.oilCost === 0 && mpCost.goldCost === AIR_UNIT_SPECS.FIGHTER.goldCost, 'Multiplayer tắt tài nguyên -> oilCost = 0');

  const prod1 = produceAirUnit(p, airUnits, 'FIGHTER', ctx.basesByNation, true);
  assert(prod1.ok && airUnits.length === 1, 'Sản xuất Loại 1 thành công (50/330 quân biên chế)');

  // Sản xuất Squadron (150 quân): 50 + 150 = 200 <= 330 -> OK
  const prod2 = produceAirUnit(p, airUnits, 'SQUADRON', ctx.basesByNation, true);
  assert(prod2.ok && airUnits.length === 4, 'Sản xuất Loại 2 tạo 3 chiếc thành công (200/330 quân biên chế)');

  // Sản xuất Bomber (120 quân): 200 + 120 = 320 <= 330 -> OK
  const prodBomber = produceAirUnit(p, airUnits, 'BOMBER', ctx.basesByNation, true);
  assert(prodBomber.ok && airUnits.length === 5, 'Sản xuất Loại 3 thành công (320/330 quân biên chế)');

  // Thử sản xuất thêm Fighter (50 quân): 320 + 50 = 370 > 330 -> từ chối
  const prod3 = produceAirUnit(p, airUnits, 'FIGHTER', ctx.basesByNation, true);
  assert(!prod3.ok, 'Chặn sản xuất khi vượt giới hạn quân số biên chế không quân (60%)');

  // Kiểm tra xuất kích Tiểu đội tốn 1 lượt, 0 Dầu
  const oilBefore = p.oil!;
  const sortiesBefore = p.airSorties!;
  const launchSq = launchAirUnit(p, airUnits, 'SQUADRON', ctx.basesByNation, { targetX: 25, targetY: 25, targetKind: 'TILE' });
  assert(launchSq.ok && launchSq.launched.length === 3, 'Xuất kích Tiểu đội phóng cả 3 chiếc');
  assert(p.airSorties === sortiesBefore - 1, 'Tiểu đội chỉ tốn đúng 1 lượt xuất kích');
  assert(p.oil === oilBefore, 'Xuất kích tốn 0 Dầu');

  // Kiểm tra giới hạn tối đa 12 máy bay mỗi quốc gia (kể cả đang bay) - KHÔNG khóa ở 9
  p.troops = 50000;
  p.gold = 500000;
  p.oil = 50000;
  p.airSorties = 5;
  // Hiện đã có 5 chiếc (3 chiếc SQUADRON đang bay + 1 FIGHTER + 1 BOMBER ở hangar). Mua thêm 4 -> 9 chiếc
  for (let i = 0; i < 4; i++) produceAirUnit(p, airUnits, 'FIGHTER', ctx.basesByNation, true);
  assert(airUnits.length === 9 && canProduceAirUnit(p, airUnits, 'FIGHTER', true).ok, 'Đủ 9 máy bay vẫn KHÔNG bị khóa nút Mua');
  // Mua tiếp chiếc thứ 10, 11, 12
  for (let i = 0; i < 3; i++) {
    const r = produceAirUnit(p, airUnits, 'FIGHTER', ctx.basesByNation, true);
    assert(r.ok, `Mua thành công máy bay thứ ${airUnits.length}/12`);
  }
  const overOwned = canProduceAirUnit(p, airUnits, 'FIGHTER', true);
  assert(airUnits.length === 12 && !overOwned.ok, 'Chỉ khóa nút Mua khi đã đủ 12 máy bay mỗi quốc gia');

  // Kiểm tra giới hạn tối đa 12 máy bay đang bay trên bản đồ
  const p2 = makeNation(1, 'TestGlobal', 5, 5);
  p2.supremeTechLevels!.military = 3;
  p2.airAdvancedUnlocked = true;
  const skyList: AirUnit[] = [];
  for (let i = 0; i < 10; i++) {
    skyList.push({ id: `f_${i}`, nationId: 2, type: 'FIGHTER', state: 'COMBAT', x: 20, y: 20, hp: 300, maxHp: 300, troopCost: 50, salvosLeft: 3, maxSalvos: 5 });
  }
  assert(countFlyingAirUnits(skyList) === 10, 'Đang có 10 máy bay trên bầu trời');
  produceAirUnit(p2, skyList, 'SQUADRON', ctx.basesByNation, true);
  const blockLaunch = launchAirUnit(p2, skyList, 'SQUADRON', ctx.basesByNation, { targetX: 25, targetY: 25 });
  assert(!blockLaunch.ok, 'Chặn xuất kích Tiểu đội khi tổng máy bay đang bay vượt quá 12 chiếc');

  // Kiểm tra hồi lượt xuất kích 25s
  p.airSorties = 0;
  p.airSortieRegenTimer = 0;
  for (let s = 1; s <= AIR_SYSTEM_CONFIG.SORTIE_RECHARGE_SECONDS; s++) {
    tickNationAirUnlocksAndSorties([makeNation(0, '', 0, 0), p], new Map(), [], s, 1);
  }
  assert(p.airSorties === 1, `Sau ${AIR_SYSTEM_CONFIG.SORTIE_RECHARGE_SECONDS}s hồi lại đúng 1 lượt xuất kích`);
}

// 3. Mục tiêu hợp lệ: lính, công trình thường, siêu công trình, tàu buôn địch (không đánh đồng minh), Tà Thần & Ném Bom kháng 50%
console.log('\n[3] Kiểm tra mục tiêu hợp lệ, Ném Bom 2 điểm & kháng 50% Tà Thần:');
{
  const tiles = makeGrid(45);
  const p = makeNation(1, 'Đại Việt', 5, 5);
  p.supremeTechLevels!.military = 3;
  p.airAdvancedUnlocked = true;
  p.diplomacy[2] = { status: 'WAR', relation: 0, truceTimer: 0 };
  p.diplomacy[3] = { status: 'ALLIANCE', relation: 80, truceTimer: 0 };

  const enemy = makeNation(2, 'Địch', 22, 20);
  enemy.troops = 5000;
  const ally = makeNation(3, 'Đồng Minh', 35, 35);
  ally.troops = 5000;

  tiles[5][6].owner = 1;
  tiles[5][6].building = 'GRAND_ARSENAL';
  initSuperBuildingOnTile(tiles[5][6], 'GRAND_ARSENAL');
  tiles[5][6].superState = 'ACTIVE';

  tiles[20][20].owner = 2;
  tiles[20][20].building = 'BARRACKS';
  tiles[20][20].buildingHp = 60;

  const enemyShip: SeaTradeShip = {
    id: 'ship_enemy',
    routeId: 'r1',
    fromNation: 2,
    toNation: 2,
    sourceX: 16,
    sourceY: 20,
    targetX: 16,
    targetY: 20,
    progress: 0,
    speed: 0.05,
    cargoGold: 100,
    isIntercontinental: false,
    hp: 200,
    maxHp: 200,
  };
  const allyShip: SeaTradeShip = {
    id: 'ship_ally',
    routeId: 'r2',
    fromNation: 3,
    toNation: 1,
    sourceX: 20,
    sourceY: 20,
    targetX: 20,
    targetY: 20,
    progress: 0,
    speed: 0.05,
    cargoGold: 100,
    isIntercontinental: false,
    hp: 200,
    maxHp: 200,
  };
  assert(isEnemyTradeShipForNation(p, enemyShip), 'Tàu của phe đang chiến tranh là mục tiêu hợp lệ');
  assert(!isEnemyTradeShipForNation(p, allyShip), 'Tàu của đồng minh KHÔNG phải mục tiêu hợp lệ');

  // Test kẹp độ dài đường ném bom tối đa 22 ô
  const clamped = clampBomberCorridor(10, 20, 44, 20);
  assert(Math.hypot(clamped.endX - clamped.startX, clamped.endY - clamped.startY) <= AIR_SYSTEM_CONFIG.BOMBER_MAX_CORRIDOR_TILES + 1, 'Đường bay ném bom được giới hạn tối đa 22 ô');

  const titan: DarkTitan = {
    id: 'titan_1',
    x: 26,
    y: 20,
    hp: 5000,
    maxHp: 5000,
    isActive: true,
    spawnTimestamp: 100,
    remainingTime: 180,
    moveTimer: 5,
  };

  const data: any = {
    tiles,
    nations: [makeNation(0, '', 0, 0), p, enemy, ally],
    attackWaves: [
      { id: 'w1', fromNation: 2, toNation: 1, troops: 400, sourceX: 18, sourceY: 20, targetX: 18, targetY: 20, progress: 0 },
    ],
    tradeShips: [enemyShip, allyShip],
    darkTitans: [titan],
    darkTitan: titan,
    particles: [],
    events: [],
    blasts: [],
    airUnits: [],
    gameTimeSeconds: 200,
  };

  const ctx = makeContext(data.nations, tiles, { 1: true });
  produceAirUnit(p, data.airUnits, 'BOMBER', ctx.basesByNation, true);
  const lb = launchAirUnit(p, data.airUnits, 'BOMBER', ctx.basesByNation, {
    bomberStartX: 15,
    bomberStartY: 20,
    bomberEndX: 26,
    bomberEndY: 20,
  });
  assert(lb.ok, 'Ném bom (Loại 3) xuất kích theo 2 điểm thành công');

  let casualtiesTotal = 0;
  for (let tick = 0; tick < 15; tick++) {
    tickAirUnits(data, ctx, {
      applyCasualties: (_nat, loss) => {
        casualtiesTotal += loss;
      },
      markTerritoryDirty: () => {},
      localHudNationId: 1,
    });
  }

  assert((tiles[20][20].building as string) === 'NONE', 'Bom phá hủy được công trình thường (Doanh trại)');
  assert(enemy.troops < 5000 && casualtiesTotal > 0, 'Bom gây sát thương quân địch và đợt quân');
  assert(!data.tradeShips.some((s: SeaTradeShip) => s.id === 'ship_enemy') || (enemyShip.hp ?? 200) < 200, 'Bom gây sát thương / đánh chìm tàu địch');
  assert(allyShip.hp === 200, 'Tàu đồng minh hoàn toàn an toàn');

  // Kiểm tra kháng 50% Tà Thần: Tà Thần chỉ nhận đúng 50% sát thương từ Ném Bom
  const expectedTerminalTitanDmg = Math.round(
    Math.round(AIR_UNIT_SPECS.BOMBER.terminalBomb.titanDamage * getAirTechBonuses(p).dmgMult) *
      AIR_SYSTEM_CONFIG.BOMBER_TITAN_DAMAGE_MULT
  );
  const titanLost = titan.maxHp - titan.hp;
  assert(
    titanLost >= expectedTerminalTitanDmg && titanLost < AIR_UNIT_SPECS.BOMBER.terminalBomb.titanDamage * getAirTechBonuses(p).dmgMult,
    `Tà Thần chỉ nhận 50% sát thương từ bom Loại 3 (đã mất ${titanLost} HP, terminal=${expectedTerminalTitanDmg})`
  );
}

// 4. Rút lui <30% HP, Tiểu đội rút cùng lúc, Đổi căn cứ khi căn cứ bị phá, Tuần tra khi hết căn cứ, Hồi phục 20s, SAM/Đánh chặn bắn rụng trừ quân
console.log('\n[4] Kiểm tra rút lui <30% HP, đồng bộ Tiểu đội, tuần tra, hồi 20s & bắn hạ trừ quân:');
{
  const tiles = makeGrid(35);
  const p = makeNation(1, 'Đại Việt', 5, 5);
  p.supremeTechLevels!.military = 3;
  p.airAdvancedUnlocked = true;
  p.diplomacy[2] = { status: 'WAR', relation: 0, truceTimer: 0 };
  const enemy = makeNation(2, 'Địch', 28, 28);

  tiles[5][5].owner = 1;
  tiles[5][5].building = 'PORT';
  tiles[10][10].owner = 1;
  tiles[10][10].building = 'PORT';

  const nations = [makeNation(0, '', 0, 0), p, enemy];
  const data: any = {
    tiles,
    nations,
    attackWaves: [],
    tradeShips: [],
    darkTitans: [],
    particles: [],
    events: [],
    blasts: [],
    airUnits: [],
    gameTimeSeconds: 50,
  };
  const ctx = makeContext(nations, tiles, {});
  produceAirUnit(p, data.airUnits, 'SQUADRON', ctx.basesByNation, true);
  launchAirUnit(p, data.airUnits, 'SQUADRON', ctx.basesByNation, { targetX: 28, targetY: 28 });

  // Đưa tiểu đội ra ngoài chiến trường (22, 22) cách xa căn cứ (5, 5)
  data.airUnits.forEach((u: AirUnit) => {
    u.x = 22;
    u.y = 22;
  });

  // Ép 1 chiếc trong Tiểu đội xuống 20% HP (< 30%) -> cả 3 chiếc phải cùng chuyển RETURNING
  data.airUnits[0].hp = Math.floor(data.airUnits[0].maxHp * 0.2);
  tickAirUnits(data, ctx, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  assert(
    data.airUnits.every((u: AirUnit) => u.state === 'RETURNING'),
    '1 chiếc < 30% HP -> toàn bộ Tiểu đội cùng rút về căn cứ'
  );

  // Phá căn cứ (5,5) & (10,10) -> phải chuyển sang PATROL
  tiles[5][5].building = 'NONE';
  tiles[10][10].building = 'NONE';
  const ctxNoBase = makeContext(nations, tiles, {});
  tickAirUnits(data, ctxNoBase, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  assert(
    data.airUnits.every((u: AirUnit) => u.state === 'PATROL'),
    'Không còn căn cứ nào -> chuyển sang tuần tra (PATROL)'
  );

  // Xây lại căn cứ ở (5,5) và cho hồi phục 20s (lúc này chưa có mục tiêu địch trên bản đồ -> sang tuần tra tự do)
  tiles[5][5].building = 'PORT';
  const ctxRestored = makeContext(nations, tiles, {});
  data.airUnits[0].x = 5;
  data.airUnits[0].y = 5;
  data.airUnits[1].x = 5;
  data.airUnits[1].y = 5;
  data.airUnits[2].x = 5;
  data.airUnits[2].y = 5;
  // Tick 1: PATROL/RETURNING -> RECOVERING (với recoveryTimer = 20)
  tickAirUnits(data, ctxRestored, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  // Tick 2..20 (19 giây): vẫn đang RECOVERING
  for (let s = 0; s < 19; s++) {
    tickAirUnits(data, ctxRestored, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  }
  assert(
    data.airUnits.every((u: AirUnit) => u.state === 'RECOVERING'),
    'Sau 19s hồi phục vẫn đang RECOVERING'
  );
  // Tick 21 (đủ 20 giây) khi không có mục tiêu nào -> chuyển PATROL (không bay quanh công trình cố định)
  tickAirUnits(data, ctxRestored, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  assert(
    data.airUnits.every((u: AirUnit) => u.state === 'PATROL' && u.hp === u.maxHp && u.salvosLeft === u.maxSalvos),
    'Hồi đủ 20s khi không có mục tiêu -> chuyển tuần tra (PATROL) đầy HP & đạn'
  );
  const patrolAnchor = { x: data.airUnits[0].patrolAnchorX, y: data.airUnits[0].patrolAnchorY };
  assert(
    typeof patrolAnchor.x === 'number' &&
      typeof patrolAnchor.y === 'number' &&
      Math.hypot(patrolAnchor.x - 5, patrolAnchor.y - 5) >= 8,
    'Tuần tra chọn điểm bay tự do trên bản đồ, không quay vòng quanh căn cứ/công trình cố định'
  );

  // Khi đang PATROL mà có mục tiêu địch mới xuất hiện -> lập tức ngắt tuần tra và cả 3 chiếc cùng bay tới đánh
  tiles[21][21].owner = 2;
  tiles[21][21].building = 'BARRACKS';
  tickAirUnits(data, ctxRestored, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  assert(
    data.airUnits.every(
      (u: AirUnit) =>
        (u.state === 'EN_ROUTE' || u.state === 'COMBAT') &&
        u.priorityTargetX === 21 &&
        u.priorityTargetY === 21
    ),
    'Đang PATROL thấy mục tiêu địch mới -> cả 3 chiếc Tiểu đội lập tức chuyển mục tiêu tới đánh'
  );

  // Kiểm tra hồi phục xong 20s KHI ĐÃ CÓ MỤC TIÊU MỚI: cả Fighter (L1) & Squadron (L2) tự động nhận mục tiêu mới ngay; Bomber (L3) về HANGAR chờ tuyến mới
  const autoUnits: AirUnit[] = [
    {
      id: 'f_rec',
      nationId: 1,
      type: 'FIGHTER',
      state: 'RECOVERING',
      x: 5,
      y: 5,
      hp: 50,
      maxHp: 300,
      troopCost: 50,
      salvosLeft: 0,
      maxSalvos: 5,
      recoveryTimer: 1,
      baseX: 5,
      baseY: 5,
    },
    {
      id: 'sq_rec_0',
      nationId: 1,
      type: 'SQUADRON',
      squadronId: 'sq_rec',
      memberIndex: 0,
      state: 'RECOVERING',
      x: 5,
      y: 5,
      hp: 50,
      maxHp: 260,
      troopCost: 50,
      salvosLeft: 0,
      maxSalvos: 4,
      recoveryTimer: 1,
      baseX: 5,
      baseY: 5,
    },
    {
      id: 'sq_rec_1',
      nationId: 1,
      type: 'SQUADRON',
      squadronId: 'sq_rec',
      memberIndex: 1,
      state: 'RECOVERING',
      x: 5,
      y: 5,
      hp: 50,
      maxHp: 260,
      troopCost: 50,
      salvosLeft: 0,
      maxSalvos: 4,
      recoveryTimer: 1,
      baseX: 5,
      baseY: 5,
    },
    {
      id: 'sq_rec_2',
      nationId: 1,
      type: 'SQUADRON',
      squadronId: 'sq_rec',
      memberIndex: 2,
      state: 'RECOVERING',
      x: 5,
      y: 5,
      hp: 50,
      maxHp: 260,
      troopCost: 50,
      salvosLeft: 0,
      maxSalvos: 4,
      recoveryTimer: 1,
      baseX: 5,
      baseY: 5,
    },
    {
      id: 'b_rec',
      nationId: 1,
      type: 'BOMBER',
      state: 'RECOVERING',
      x: 5,
      y: 5,
      hp: 100,
      maxHp: 420,
      troopCost: 120,
      salvosLeft: 0,
      maxSalvos: 1,
      recoveryTimer: 1,
      baseX: 5,
      baseY: 5,
      bomberStartX: 10,
      bomberStartY: 10,
      bomberEndX: 20,
      bomberEndY: 20,
    },
  ];
  const savedUnits = data.airUnits;
  data.airUnits = autoUnits;
  tickAirUnits(data, ctxRestored, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  const recFighter = autoUnits.find((u) => u.id === 'f_rec')!;
  const recSq = autoUnits.filter((u) => u.squadronId === 'sq_rec');
  const recBomber = autoUnits.find((u) => u.id === 'b_rec')!;
  assert(
    recFighter.state === 'EN_ROUTE' && recFighter.priorityTargetX === 21 && recFighter.priorityTargetY === 21,
    'Loại 1 hồi xong 20s tự động tìm được mục tiêu mới gần nhất (21,21) và bay tới đánh'
  );
  assert(
    recSq.every((m) => m.state === 'EN_ROUTE' && m.priorityTargetX === 21 && m.priorityTargetY === 21),
    'Loại 2 (Tiểu đội) hồi xong 20s cả 3 chiếc cùng nhận mục tiêu mới và bay tới đánh'
  );
  assert(
    recBomber.state === 'HANGAR' && recBomber.bomberStartX === 10 && recBomber.bomberEndX === 20,
    'Loại 3 (Ném bom) hồi xong 20s quay về trạng thái chờ (HANGAR) và giữ nguyên tuyến cũ'
  );
  data.airUnits = savedUnits;

  // Kiểm tra bắn hạ máy bay trừ đúng số quân chiếc bị mất (50 quân)
  p.troops = 5000;
  enemy.supremeTechLevels!.military = 1; // 75 * 1.15 = 86 airToAirDamage
  data.airUnits[0].x = 20;
  data.airUnits[0].y = 20;
  data.airUnits[0].hp = 80; // >= 30% maxHp (78) nên chưa rút lui, bị tiêm kích địch (86 dmg) bắn rụng ngay
  data.airUnits[1].x = 5;
  data.airUnits[1].y = 5;
  data.airUnits[1].hp = data.airUnits[1].maxHp;
  data.airUnits[2].x = 5;
  data.airUnits[2].y = 5;
  data.airUnits[2].hp = data.airUnits[2].maxHp;
  data.airUnits.push({
    id: 'enemy_interceptor',
    nationId: 2,
    type: 'FIGHTER',
    state: 'COMBAT',
    x: 20.5,
    y: 20.5,
    hp: 300,
    maxHp: 300,
    troopCost: 50,
    salvosLeft: 5,
    maxSalvos: 5,
    attackCooldown: 0,
  });
  tickAirUnits(data, ctxRestored, {
    applyCasualties: () => {},
    markTerritoryDirty: () => {},
  });
  assert(
    data.airUnits.filter((u: AirUnit) => u.nationId === 1).length === 2,
    'Tiểu đội mất 1 chiếc còn lại 2 chiếc'
  );
  assert(
    p.troops === 5000 - AIR_UNIT_SPECS.SQUADRON.troopCostPerPlane,
    `Mất 1 chiếc trong Tiểu đội trừ đúng ${AIR_UNIT_SPECS.SQUADRON.troopCostPerPlane} quân (50)`
  );
}

// 5. Kiểm tra nâng cấp Công nghệ tối thượng
console.log('\n[5] Kiểm tra nâng cấp Công nghệ tối thượng (+15% Dmg/cấp, +15% HP/cấp, +10% Tốc độ/cấp):');
{
  const n = makeNation(1, 'Đại Việt', 5, 5);
  n.supremeTechLevels = { economy: 2, military: 3, defense: 2 };
  const b = getAirTechBonuses(n);
  assert(Math.abs(b.dmgMult - 1.45) < 1e-6, 'Military lv3 -> +45% Sát thương');
  assert(Math.abs(b.hpMult - 1.30) < 1e-6, 'Defense lv2 -> +30% HP tối đa');
  assert(Math.abs(b.speedMult - 1.20) < 1e-6, 'Economy lv2 -> +20% Tốc độ');
}

// 6. Kiểm tra máy bay Loại 1 & 2 bám theo Tà Thần di chuyển, Loại 3 KHÔNG bám theo
console.log('\n[6] Kiểm tra bám theo Tà Thần (Loại 1 & 2 bám theo, Loại 3 không bám, Tà Thần biến mất -> chuyển mục tiêu/về căn cứ):');
{
  const tiles = makeGrid(60);
  const p = makeNation(1, 'Đại Việt', 5, 5);
  p.supremeTechLevels!.military = 3;
  p.airAdvancedUnlocked = true;
  p.diplomacy[2] = { status: 'WAR', relation: 0, truceTimer: 0 };
  const enemy = makeNation(2, 'Địch', 50, 50);

  tiles[5][5].owner = 1;
  tiles[5][5].building = 'PORT';

  const titan: DarkTitan = {
    id: 'titan_moving',
    x: 25,
    y: 10,
    hp: 4000,
    maxHp: 4000,
    isActive: true,
    spawnTimestamp: 10,
    remainingTime: 180,
    moveTimer: 0,
  };

  const nations = [makeNation(0, '', 0, 0), p, enemy];
  const data: any = {
    tiles,
    nations,
    attackWaves: [],
    tradeShips: [],
    darkTitans: [titan],
    darkTitan: titan,
    particles: [],
    events: [],
    blasts: [],
    airUnits: [],
    gameTimeSeconds: 100,
  };
  const ctx = makeContext(nations, tiles, {});

  // 6a. Phóng Loại 1 và Loại 2 vào Tà Thần lúc đang ở (25, 10)
  produceAirUnit(p, data.airUnits, 'FIGHTER', ctx.basesByNation, true);
  produceAirUnit(p, data.airUnits, 'SQUADRON', ctx.basesByNation, true);
  launchAirUnit(p, data.airUnits, 'FIGHTER', ctx.basesByNation, {
    targetX: titan.x,
    targetY: titan.y,
    targetKind: 'TITAN',
    targetId: titan.id,
  });
  launchAirUnit(p, data.airUnits, 'SQUADRON', ctx.basesByNation, {
    targetX: titan.x,
    targetY: titan.y,
    targetKind: 'TITAN',
    targetId: titan.id,
  });

  // Tà Thần di chuyển/dịch chuyển sang vị trí MỚI (32, 32) — rất xa ô cũ (25, 10)
  titan.x = 32;
  titan.y = 32;
  tickAirUnits(data, ctx, { applyCasualties: () => {}, markTerritoryDirty: () => {} });

  const fighter = data.airUnits.find((u: AirUnit) => u.type === 'FIGHTER')!;
  const sq0 = data.airUnits.find((u: AirUnit) => u.type === 'SQUADRON' && u.memberIndex === 0)!;
  assert(
    fighter.priorityTargetX === 32 && fighter.priorityTargetY === 32 && sq0.priorityTargetX === 32 && sq0.priorityTargetY === 32,
    'Loại 1 & Loại 2 tự cập nhật hướng bay theo tọa độ MỚI NHẤT (32, 32) của Tà Thần'
  );

  // Bay thêm nhiều tick tới nơi và đánh trúng Tà Thần tại (32, 32)
  for (let s = 0; s < 7; s++) {
    tickAirUnits(data, ctx, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  }
  assert(
    titan.hp < 4000,
    `Loại 1 & Loại 2 bay tới vị trí mới và gây sát thương chuẩn lên Tà Thần (HP còn ${titan.hp}/4000)`
  );

  // 6b. Nếu Tà Thần biến mất và có mục tiêu địch gần nhất ở (36, 32) -> chuyển mục tiêu sang (36, 32)
  tiles[32][36].owner = 2;
  tiles[32][36].building = 'BARRACKS';
  titan.isActive = false;
  data.darkTitans = [];
  data.darkTitan = null;
  tickAirUnits(data, ctx, { applyCasualties: () => {}, markTerritoryDirty: () => {} });

  const sqMembersAfter = data.airUnits.filter((u: AirUnit) => u.type === 'SQUADRON');
  assert(
    fighter.priorityTargetKind === 'TILE' && fighter.priorityTargetX === 36 && fighter.priorityTargetY === 32,
    'Khi Tà Thần biến mất, Loại 1 chuyển sang mục tiêu gần nhất (36, 32)'
  );
  assert(
    sqMembersAfter.every((m: AirUnit) => m.priorityTargetKind === 'TILE' && m.priorityTargetX === 36 && m.priorityTargetY === 32),
    'Khi Tà Thần biến mất, cả Tiểu Đội Loại 2 đồng bộ chuyển sang mục tiêu gần nhất (36, 32)'
  );

  // 6c. Nếu không còn mục tiêu nào khác trên bản đồ -> tự quay về căn cứ (RETURNING)
  tiles[32][36].owner = 0;
  tiles[32][36].building = 'NONE';
  tickAirUnits(data, ctx, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  assert(
    fighter.state === 'RETURNING' && sqMembersAfter.every((m: AirUnit) => m.state === 'RETURNING'),
    'Khi Tà Thần biến mất và không còn mục tiêu khác -> Loại 1 & Loại 2 về căn cứ'
  );

  // 6d. Loại 3 (BOMBER) KHÔNG bám theo Tà Thần: Tà Thần né ra khỏi đường bay -> KHÔNG bị đánh trúng
  const titanAvoid: DarkTitan = {
    id: 'titan_avoid',
    x: 20,
    y: 20,
    hp: 3000,
    maxHp: 3000,
    isActive: true,
    spawnTimestamp: 100,
    remainingTime: 180,
    moveTimer: 0,
  };
  data.darkTitans = [titanAvoid];
  data.darkTitan = titanAvoid;
  produceAirUnit(p, data.airUnits, 'BOMBER', ctx.basesByNation, true);
  launchAirUnit(p, data.airUnits, 'BOMBER', ctx.basesByNation, {
    bomberStartX: 10,
    bomberStartY: 20,
    bomberEndX: 25,
    bomberEndY: 20,
  });
  // Tà Thần rời xa đường bay thẳng y=20 lên y=35
  titanAvoid.x = 22;
  titanAvoid.y = 35;
  for (let s = 0; s < 10; s++) {
    tickAirUnits(data, ctx, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  }
  assert(
    titanAvoid.hp === 3000,
    'Loại 3 (Ném Bom) KHÔNG bám theo Tà Thần: bay thẳng đúng tuyến đã chọn, Tà Thần né ra ngoài vùng nổ thì không mất máu'
  );
}

// 7. Kiểm tra BOMBER về căn cứ, hồi 20s thành sẵn sàng, giữ & bay lại tuyến cũ, vẽ tuyến mới, và không có căn cứ vẫn về HANGAR
console.log('\n[7] Kiểm tra BOMBER về căn cứ, hồi 20s -> sẵn sàng, Bay lại tuyến cũ & vẽ tuyến mới:');
{
  const tiles = makeGrid(45);
  const p = makeNation(1, 'Đại Việt', 5, 5);
  p.airAdvancedUnlocked = true;
  p.airSorties = 5;
  p.oil = 5000;
  p.gold = 100000;
  tiles[5][5].owner = 1;
  tiles[5][5].building = 'PORT';

  const nations = [makeNation(0, '', 0, 0), p];
  const data: any = {
    tiles,
    nations,
    attackWaves: [],
    tradeShips: [],
    darkTitans: [],
    particles: [],
    events: [],
    blasts: [],
    airUnits: [],
    gameTimeSeconds: 100,
  };
  const ctx = makeContext(nations, tiles, {});

  produceAirUnit(p, data.airUnits, 'BOMBER', ctx.basesByNation, true);
  assert(getSavedBomberRoute(data.airUnits, p) === null, 'Chưa từng bay -> chưa có tuyến cũ');

  const launch1 = launchAirUnit(p, data.airUnits, 'BOMBER', ctx.basesByNation, {
    bomberStartX: 10,
    bomberStartY: 15,
    bomberEndX: 25,
    bomberEndY: 15,
  });
  assert(launch1.ok, 'Xuất kích BOMBER theo 2 điểm mới (10,15)->(25,15)');
  const bomber = data.airUnits[0] as AirUnit;

  // Cho bomber bay hoàn thành ném bom -> phải chuyển RETURNING về căn cứ (5,5)
  for (let s = 0; s < 15 && bomber.state !== 'RETURNING' && bomber.state !== 'RECOVERING'; s++) {
    tickAirUnits(data, ctx, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  }
  assert(
    bomber.state === 'RETURNING' || bomber.state === 'RECOVERING',
    'BOMBER ném xong tự bay về căn cứ gần nhất (RETURNING/RECOVERING)'
  );
  assert(getBomberRecoveryRemainingSeconds(data.airUnits, p) > 0, 'Hiển thị thời gian hồi phục khi chưa có bomber sẵn sàng');

  // Bay tiếp cho tới khi chạm căn cứ và bắt đầu RECOVERING (20s)
  for (let s = 0; s < 15 && bomber.state !== 'RECOVERING'; s++) {
    tickAirUnits(data, ctx, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  }
  assert(bomber.state === 'RECOVERING', 'BOMBER về đến căn cứ chuyển sang RECOVERING');
  assert(getNationAirSummary(data.airUnits, 1).bomberReady === 0, 'Trong lúc đang hồi -> bomberReady = 0');

  // Đếm đủ 20s hồi phục -> về HANGAR, bomberReady = 1, giữ nguyên tuyến cũ
  for (let s = 0; s < 25 && bomber.state !== 'HANGAR'; s++) {
    tickAirUnits(data, ctx, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  }
  assert(
    bomber.state === 'HANGAR' && getNationAirSummary(data.airUnits, 1).bomberReady === 1,
    'Hồi xong 20s -> BOMBER về HANGAR và tăng số sẵn sàng lên 1'
  );
  assert(
    bomber.bomberStartX === 10 && bomber.bomberStartY === 15 && bomber.bomberEndX === 25 && bomber.bomberEndY === 15,
    'Không xóa tuyến cũ (bomberStartX/EndX) khi BOMBER về HANGAR'
  );

  // Bay lại tuyến cũ -> tốn 1 lượt xuất kích, 0 Dầu, đúng tuyến (10,15)->(25,15)
  const oilBeforeReplay = p.oil!;
  const sortiesBeforeReplay = p.airSorties!;
  const replayRes = launchAirUnit(p, data.airUnits, 'BOMBER', ctx.basesByNation, { useSavedBomberRoute: true });
  assert(replayRes.ok, 'Bấm "Bay lại tuyến cũ" xuất kích thành công');
  assert(
    bomber.state === 'EN_ROUTE' &&
      bomber.bomberStartX === 10 &&
      bomber.bomberStartY === 15 &&
      bomber.bomberEndX === 25 &&
      bomber.bomberEndY === 15,
    'BOMBER bay đúng lại tuyến cũ (10,15)->(25,15)'
  );
  assert(p.airSorties === sortiesBeforeReplay - 1 && p.oil === oilBeforeReplay, 'Bay lại tuyến cũ tốn 1 lượt xuất kích, 0 Dầu');

  // Kiểm tra trường hợp BOMBER không còn tuyến hoặc không có căn cứ hợp lệ -> về HANGAR tại chỗ
  bomber.bomberStartX = undefined;
  bomber.bomberEndX = undefined;
  tiles[5][5].building = 'NONE';
  const ctxNoBase = makeContext(nations, tiles, {});
  tickAirUnits(data, ctxNoBase, { applyCasualties: () => {}, markTerritoryDirty: () => {} });
  assert(
    bomber.state === 'HANGAR' && getNationAirSummary(data.airUnits, 1).bomberReady === 1,
    'BOMBER không còn tuyến và không có căn cứ -> vẫn về HANGAR tại vị trí hiện tại, không đứng yên ngoài map'
  );

  // Vẽ 2 điểm tuyến mới sau khi đã về HANGAR -> xuất kích tuyến mới bình thường, tốn 1 lượt, 0 Dầu
  const sortiesBeforeNew = p.airSorties!;
  const oilBeforeNew = p.oil!;
  const launchNew = launchAirUnit(p, data.airUnits, 'BOMBER', ctxNoBase.basesByNation, {
    bomberStartX: 12,
    bomberStartY: 22,
    bomberEndX: 28,
    bomberEndY: 22,
  });
  assert(
    launchNew.ok && bomber.bomberStartX === 12 && bomber.bomberEndX === 28 && bomber.bomberEndY === 22,
    'Nút Xuất kích vẽ 2 điểm tuyến mới vẫn hoạt động bình thường'
  );
  assert(p.airSorties === sortiesBeforeNew - 1 && p.oil === oilBeforeNew, 'Vẽ tuyến mới tốn 1 lượt xuất kích, 0 Dầu');
}

console.log('\n🎉 TẤT CẢ CÁC BÀI TEST HỆ THỐNG KHÔNG QUÂN 3 LOẠI ĐỀU PASS 100%!');

