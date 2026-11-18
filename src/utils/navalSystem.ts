import { NAVAL_CONFIG, RESOURCE_CONFIG } from '../data/gameData';
import {
  Nation,
  NavalShip,
  NavalShipType,
  PortBuildQueueItem,
  SeaControlGrid,
  SeaTradeRoute,
  SeaTradeShip,
  Tile,
} from '../types';
import { AIR_SYSTEM_CONFIG } from '../data/gameData';
import { TILE_PIXEL_SIZE } from './constants';
import { getDepositTiles, hasActiveMineralMine } from './resources';
import {
  findSeaPath,
  getPortWaterAccess,
  getShipPopulationScale,
  getTradeShipPosition,
  SeaWaypoint,
} from './seaPathfinding';

export interface NavalTickCallbacks {
  applyCasualties?: (nation: Nation, loss: number) => void;
  markTerritoryDirty?: () => void;
  launchLandingWave?: (
    fromNation: number,
    toNation: number,
    sourceTile: Tile,
    targetTile: Tile,
    troops: number
  ) => boolean | void;
  playExplosionSound?: () => void;
  notifyPlayer?: (msg: string) => void;
  playerNationId?: number;
}

function pushNavalToast(data: any, nationId: number, msg: string): void {
  if (!data || nationId <= 0 || !msg) return;
  if (!Array.isArray(data._navalToasts)) data._navalToasts = [];
  if (data._navalToasts.length < 10) {
    data._navalToasts.push({ nationId, msg });
  }
}

export function findNearestWaterTile(
  tiles: Tile[][],
  startX: number,
  startY: number,
  maxRadius = 24
): { x: number; y: number } | null {
  if (!Array.isArray(tiles) || tiles.length === 0) return null;
  const size = tiles.length;
  const sx = Math.max(0, Math.min(size - 1, Math.round(startX)));
  const sy = Math.max(0, Math.min(size - 1, Math.round(startY)));
  if (tiles[sy]?.[sx]?.terrain === 'WATER') return { x: sx, y: sy };

  let bestX = -1;
  let bestY = -1;
  let bestDistSq = Infinity;
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      const ny = sy + dy;
      if (ny < 0 || ny >= size) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = sx + dx;
        if (nx < 0 || nx >= size) continue;
        if (tiles[ny]?.[nx]?.terrain === 'WATER') {
          const distSq = dx * dx + dy * dy;
          if (distSq < bestDistSq) {
            bestX = nx;
            bestY = ny;
            bestDistSq = distSq;
          }
        }
      }
    }
    if (bestX >= 0) return { x: bestX, y: bestY };
  }
  return null;
}

export function ensureNavalData(data: any): void {
  if (!data) return;
  if (!Array.isArray(data.navalShips)) data.navalShips = [];
  if (!Array.isArray(data.portBuildQueues)) data.portBuildQueues = [];
}

export function getShipScaleStats(nation?: Nation | null, type: NavalShipType = 'WARSHIP') {
  const scale = getShipPopulationScale(nation);
  if (type === 'EXTRACTOR') {
    return {
      tier: scale.tier,
      maxHp: Math.round(NAVAL_CONFIG.EXTRACTOR.BASE_HP * scale.hpAndCapMult),
      oilCapacity: Math.round(NAVAL_CONFIG.EXTRACTOR.BASE_OIL_CAPACITY * scale.hpAndCapMult),
      extractRate: Number((NAVAL_CONFIG.EXTRACTOR.OIL_RATE_PER_SEC * scale.extractMult).toFixed(2)),
      speed: NAVAL_CONFIG.EXTRACTOR.SPEED_TILES_PER_SEC, // Tốc độ không đổi theo quy mô
      visualScale: scale.visualScale,
    };
  }
  const currentTroops = nation?.troops || 0;
  const baseCarry = Math.max(25, Math.floor(currentTroops * NAVAL_CONFIG.WARSHIP.TROOP_CARRY_RATIO));
  return {
    tier: scale.tier,
    maxHp: Math.round(NAVAL_CONFIG.WARSHIP.BASE_HP * scale.hpAndCapMult),
    dps: Math.round(NAVAL_CONFIG.WARSHIP.DPS * scale.combatMult),
    maxTroopCapacity: Math.round(baseCarry * scale.hpAndCapMult),
    speed: NAVAL_CONFIG.WARSHIP.SPEED_TILES_PER_SEC, // Tốc độ không đổi theo quy mô
    visualScale: scale.visualScale,
  };
}

export function countPortShipsAndQueue(
  data: any,
  portX: number,
  portY: number,
  nationId: number
): {
  extractorsActive: number;
  extractorsQueued: number;
  warshipsActive: number;
  warshipsQueued: number;
  totalNationWarships: number;
  totalNationExtractors: number;
  totalGlobalShips: number;
} {
  ensureNavalData(data);
  const ships: NavalShip[] = data.navalShips;
  const queues: PortBuildQueueItem[] = data.portBuildQueues;

  let extractorsActive = 0;
  let extractorsQueued = 0;
  let warshipsActive = 0;
  let warshipsQueued = 0;
  let totalNationWarships = 0;
  let totalNationExtractors = 0;

  for (const s of ships) {
    if (!s || s.hp <= 0) continue;
    if (s.nationId === nationId) {
      if (s.type === 'EXTRACTOR') {
        totalNationExtractors++;
        if (s.homePortX === portX && s.homePortY === portY) extractorsActive++;
      } else if (s.type === 'WARSHIP') {
        totalNationWarships++;
        if (s.homePortX === portX && s.homePortY === portY) warshipsActive++;
      }
    }
  }

  for (const q of queues) {
    if (!q || q.nationId !== nationId) continue;
    if (q.shipType === 'EXTRACTOR') {
      totalNationExtractors++;
      if (q.portX === portX && q.portY === portY) extractorsQueued++;
    } else if (q.shipType === 'WARSHIP') {
      totalNationWarships++;
      if (q.portX === portX && q.portY === portY) warshipsQueued++;
    }
  }

  return {
    extractorsActive,
    extractorsQueued,
    warshipsActive,
    warshipsQueued,
    totalNationWarships,
    totalNationExtractors,
    totalGlobalShips: ships.length + queues.length,
  };
}

export function canQueueNavalShip(
  data: any,
  nation: Nation | undefined,
  portX: number,
  portY: number,
  shipType: NavalShipType
): { ok: boolean; reason: string } {
  if (!data || !nation || nation.isEliminated || nation.id <= 0) {
    return { ok: false, reason: 'Quốc gia không hợp lệ.' };
  }
  const tiles: Tile[][] = data.tiles || [];
  const portTile = tiles[portY]?.[portX];
  if (!portTile || portTile.building !== 'PORT' || portTile.owner !== nation.id) {
    return { ok: false, reason: 'Hải Cảng không hợp lệ.' };
  }
  if (portTile.inactiveTimer && portTile.inactiveTimer > 0) {
    return { ok: false, reason: 'Hải Cảng vừa chiếm chưa hoạt động.' };
  }
  const access = getPortWaterAccess(tiles, portX, portY);
  if (access.isEnclosed || access.openCompIds.length === 0) {
    return { ok: false, reason: 'Hải Cảng nằm ở hồ kín, không thể xuất tàu ra biển.' };
  }

  const counts = countPortShipsAndQueue(data, portX, portY, nation.id);
  if (counts.totalGlobalShips >= NAVAL_CONFIG.MAX_GLOBAL_NAVAL_SHIPS) {
    return { ok: false, reason: 'Bản đồ đã đạt giới hạn tàu hải quân.' };
  }

  const cfg = shipType === 'EXTRACTOR' ? NAVAL_CONFIG.EXTRACTOR : NAVAL_CONFIG.WARSHIP;
  if (shipType === 'EXTRACTOR') {
    if (counts.extractorsActive + counts.extractorsQueued >= cfg.MAX_PER_PORT) {
      return { ok: false, reason: `Cảng đã đạt tối đa ${cfg.MAX_PER_PORT} Tàu Khai Thác.` };
    }
    if (counts.totalNationExtractors >= cfg.MAX_PER_NATION) {
      return { ok: false, reason: `Quốc gia đã đạt tối đa ${cfg.MAX_PER_NATION} Tàu Khai Thác.` };
    }
  } else {
    if (counts.warshipsActive + counts.warshipsQueued >= cfg.MAX_PER_PORT) {
      return { ok: false, reason: `Cảng đã đạt tối đa ${cfg.MAX_PER_PORT} Tàu Chiến.` };
    }
    if (counts.totalNationWarships >= NAVAL_CONFIG.WARSHIP.MAX_PER_NATION) {
      return { ok: false, reason: `Quốc gia đã đạt tối đa ${NAVAL_CONFIG.WARSHIP.MAX_PER_NATION} Tàu Chiến.` };
    }
  }

  if (nation.gold < cfg.GOLD_COST) {
    return { ok: false, reason: `Thiếu Vàng (cần ${cfg.GOLD_COST}).` };
  }
  if ((nation.oil || 0) < cfg.OIL_COST) {
    return { ok: false, reason: `Thiếu Dầu (cần ${cfg.OIL_COST}).` };
  }
  if ((nation.minerals || 0) < cfg.MINERAL_COST) {
    return { ok: false, reason: `Thiếu Khoáng sản (cần ${cfg.MINERAL_COST}).` };
  }
  if (nation.id > 1) {
    const minReserve = hasActiveMineralMine(data.tiles, nation.id) ? 0 : 25;
    if ((nation.minerals || 0) - cfg.MINERAL_COST < minReserve) {
      return { ok: false, reason: 'Bot cần giữ ít nhất 25 khoáng sản dự trữ.' };
    }
  }

  return { ok: true, reason: '' };
}

export function enqueueNavalShip(
  data: any,
  nation: Nation | undefined,
  portX: number,
  portY: number,
  shipType: NavalShipType
): { ok: boolean; reason: string; item?: PortBuildQueueItem } {
  const chk = canQueueNavalShip(data, nation, portX, portY, shipType);
  if (!chk.ok || !nation) return chk;
  ensureNavalData(data);

  const cfg = shipType === 'EXTRACTOR' ? NAVAL_CONFIG.EXTRACTOR : NAVAL_CONFIG.WARSHIP;
  nation.gold -= cfg.GOLD_COST;
  nation.oil = Math.max(0, (nation.oil || 0) - cfg.OIL_COST);
  nation.minerals = Math.max(0, (nation.minerals || 0) - cfg.MINERAL_COST);

  const item: PortBuildQueueItem = {
    id: `nbq_${nation.id}_${shipType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    nationId: nation.id,
    portX,
    portY,
    shipType,
    remainingTime: cfg.BUILD_TIME_SECONDS,
    totalTime: cfg.BUILD_TIME_SECONDS,
    paidGold: cfg.GOLD_COST,
    paidOil: cfg.OIL_COST,
    paidMinerals: cfg.MINERAL_COST,
  };
  data.portBuildQueues.push(item);
  return { ok: true, reason: `Đang đóng ${cfg.NAME}...`, item };
}

export function cancelNavalQueueItem(
  data: any,
  nation: Nation | undefined,
  queueId: string
): { ok: boolean; reason: string } {
  ensureNavalData(data);
  if (!nation) return { ok: false, reason: 'Không tìm thấy quốc gia.' };
  const idx = data.portBuildQueues.findIndex(
    (q: PortBuildQueueItem) => q && q.id === queueId && q.nationId === nation.id
  );
  if (idx < 0) return { ok: false, reason: 'Không tìm thấy đơn đóng tàu.' };

  const item: PortBuildQueueItem = data.portBuildQueues[idx];
  data.portBuildQueues.splice(idx, 1);

  const ratio = item.shipType === 'EXTRACTOR'
    ? NAVAL_CONFIG.EXTRACTOR.CANCEL_REFUND_RATIO
    : NAVAL_CONFIG.WARSHIP.CANCEL_REFUND_RATIO;

  const refGold = Math.round(item.paidGold * ratio);
  const refOil = Math.round(item.paidOil * ratio);
  const refMin = Math.round(item.paidMinerals * ratio);

  nation.gold += refGold;
  nation.oil = Math.min(RESOURCE_CONFIG.STORAGE_CAP, (nation.oil || 0) + refOil);
  nation.minerals = Math.min(RESOURCE_CONFIG.STORAGE_CAP, (nation.minerals || 0) + refMin);

  return { ok: true, reason: `Đã hủy đóng tàu, hoàn ${refGold} Vàng, ${refOil} Dầu, ${refMin} Khoáng.` };
}

export function isDepositClaimedByOtherExtractor(
  data: any,
  depX: number,
  depY: number,
  ignoreShipId?: string
): boolean {
  const ships: NavalShip[] = data?.navalShips || [];
  for (const s of ships) {
    if (!s || s.hp <= 0 || s.type !== 'EXTRACTOR') continue;
    if (ignoreShipId && s.id === ignoreShipId) continue;
    if (s.assignedDepositX === depX && s.assignedDepositY === depY) {
      return true;
    }
  }
  return false;
}

export function getSeaControlOwner(grid: SeaControlGrid | undefined, tileX: number, tileY: number): number {
  if (!grid || !Array.isArray(grid.owners) || grid.owners.length === 0) return 0;
  const col = Math.floor(tileX / grid.cellSize);
  const row = Math.floor(tileY / grid.cellSize);
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return 0;
  return grid.owners[row * grid.cols + col] || 0;
}

export function updateSeaControlGrid(data: any): void {
  if (!data || !Array.isArray(data.tiles) || data.tiles.length === 0) return;
  const tiles: Tile[][] = data.tiles;
  const size = tiles.length;
  const cellSize = NAVAL_CONFIG.SEA_CONTROL.CELL_SIZE;
  const cols = Math.ceil(size / cellSize);
  const rows = Math.ceil(size / cellSize);
  const totalCells = cols * rows;
  const radius = NAVAL_CONFIG.SEA_CONTROL.RADIUS_TILES;

  let grid: SeaControlGrid | undefined = data.seaControlGrid;
  if (!grid || grid.cols !== cols || grid.rows !== rows || grid.cellSize !== cellSize) {
    grid = {
      cellSize,
      cols,
      rows,
      owners: new Array<number>(totalCells).fill(0),
      strengths: new Array<number>(totalCells).fill(0),
      updatedAtSec: data.gameTimeSeconds || 0,
    };
    data.seaControlGrid = grid;
  } else {
    grid.owners.fill(0);
    grid.strengths.fill(0);
    grid.updatedAtSec = data.gameTimeSeconds || 0;
  }

  const ships: NavalShip[] = data.navalShips || [];
  if (ships.length === 0) return;

  // Gom sức mạnh kiểm soát biển theo từng quốc gia trên từng ô lưới thô 4x4
  const nationWarships = new Map<number, NavalShip[]>();
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    if (!s || s.type !== 'WARSHIP' || s.hp <= 0 || s.nationId <= 0) continue;
    if (s.isRepairing || s.state === 'REPAIRING') continue;
    let list = nationWarships.get(s.nationId);
    if (!list) {
      list = [];
      nationWarships.set(s.nationId, list);
    }
    list.push(s);
  }

  if (nationWarships.size === 0) return;

  // Với mỗi quốc gia có tàu chiến, cộng dồn ảnh hưởng vào các ô 4x4 rồi chọn phe mạnh hơn
  const tempStrength = new Float32Array(totalCells);
  nationWarships.forEach((wList, nationId) => {
    tempStrength.fill(0);
    for (let wi = 0; wi < wList.length; wi++) {
      const s = wList[wi];
      const hpRatio = 0.5 + 0.5 * (s.hp / Math.max(1, s.maxHp));
      const shipPower = (s.dps || NAVAL_CONFIG.WARSHIP.DPS) * hpRatio;
      const minC = Math.max(0, Math.floor((s.x - radius) / cellSize));
      const maxC = Math.min(cols - 1, Math.floor((s.x + radius) / cellSize));
      const minR = Math.max(0, Math.floor((s.y - radius) / cellSize));
      const maxR = Math.min(rows - 1, Math.floor((s.y + radius) / cellSize));

      for (let r = minR; r <= maxR; r++) {
        const cy = r * cellSize + cellSize * 0.5;
        for (let c = minC; c <= maxC; c++) {
          const cx = c * cellSize + cellSize * 0.5;
          const d = Math.hypot(cx - s.x, cy - s.y);
          if (d <= radius) {
            const inf = shipPower * (1 - d / (radius + 1.5));
            if (inf > 0) {
              tempStrength[r * cols + c] += inf;
            }
          }
        }
      }
    }

    for (let idx = 0; idx < totalCells; idx++) {
      const val = tempStrength[idx];
      if (val > 0 && val > grid!.strengths[idx]) {
        grid!.strengths[idx] = Number(val.toFixed(2));
        grid!.owners[idx] = nationId;
      }
    }
  });
}

/**
 * Kiểm tra quyền khai thác tại mỏ dầu biển:
 * - Lúc đầu mở cho mọi tàu nếu chưa có vùng kiểm soát biển của nước khác.
 * - Khi có Vùng Kiểm Soát Biển (Part 5): chỉ được khai thác nếu vùng đó trống, thuộc phe mình, hoặc đồng minh.
 */
export function hasSeaOilExtractionRight(data: any, nationId: number, depX: number, depY: number): boolean {
  if (nationId <= 0) return false;
  const ctrlOwner = getSeaControlOwner(data?.seaControlGrid, depX, depY);
  if (ctrlOwner === 0 || ctrlOwner === nationId) return true;
  const nations: Nation[] = data?.nations || [];
  const dip = nations[nationId]?.diplomacy?.[ctrlOwner]?.status;
  return dip === 'ALLIANCE';
}

export function findNearestFreeSeaOilDeposit(
  data: any,
  ship: NavalShip
): Tile | null {
  const tiles: Tile[][] = data?.tiles || [];
  if (tiles.length === 0) return null;
  const deposits = getDepositTiles(tiles);
  let bestTile: Tile | null = null;
  let bestDist = Infinity;

  for (const t of deposits) {
    if (!t || t.terrain !== 'WATER' || t.deposit !== 'OIL' || !t.discovered) continue;
    if ((t.reserve || 0) <= 0) continue;
    if (isDepositClaimedByOtherExtractor(data, t.x, t.y, ship.id)) continue;
    if (!hasSeaOilExtractionRight(data, ship.nationId, t.x, t.y)) continue;

    const d = Math.hypot(t.x - ship.x, t.y - ship.y);
    if (d < bestDist) {
      const path = findSeaPath(tiles, ship.x, ship.y, t.x, t.y, false);
      if (path && path.waypoints.length >= 1) {
        bestDist = d;
        bestTile = t;
      }
    }
  }
  return bestTile;
}

export function assignExtractorDeposit(
  data: any,
  ship: NavalShip,
  depX: number,
  depY: number
): { ok: boolean; reason: string } {
  if (!data || !ship || ship.type !== 'EXTRACTOR' || ship.nationId <= 0) {
    return { ok: false, reason: 'Tàu Khai Thác không hợp lệ.' };
  }
  const tiles: Tile[][] = data.tiles || [];
  const depTile = tiles[depY]?.[depX];
  if (!depTile || depTile.terrain !== 'WATER' || depTile.deposit !== 'OIL' || !depTile.discovered) {
    return { ok: false, reason: 'Không tìm thấy Mỏ Dầu Biển hợp lệ.' };
  }
  if ((depTile.reserve || 0) <= 0) {
    return { ok: false, reason: 'Mỏ dầu này đang cạn kiệt, chờ hồi phục.' };
  }
  if (isDepositClaimedByOtherExtractor(data, depX, depY, ship.id)) {
    return { ok: false, reason: 'Mỏ dầu này đã có Tàu Khai Thác khác chiếm giữ.' };
  }
  if (!hasSeaOilExtractionRight(data, ship.nationId, depX, depY)) {
    return { ok: false, reason: 'Mỏ dầu nằm trong Vùng Kiểm Soát Biển của đối phương.' };
  }

  const path = findSeaPath(tiles, ship.x, ship.y, depX, depY, false);
  if (!path) {
    return { ok: false, reason: 'Không có đường biển tới mỏ dầu này.' };
  }

  ship.assignedDepositX = depX;
  ship.assignedDepositY = depY;
  ship.targetX = depX;
  ship.targetY = depY;
  ship.waypoints = path.waypoints;
  ship.waypointIdx = 0;
  ship.state = 'MOVING';
  return { ok: true, reason: `Đã điều Tàu Khai Thác tới mỏ (${depX}, ${depY}).` };
}

function setShipSeaPath(
  tiles: Tile[][],
  ship: NavalShip,
  tx: number,
  ty: number,
  allowEnclosedFallback = false
): boolean {
  let path = findSeaPath(tiles, ship.x, ship.y, tx, ty, false);
  if ((!path || path.waypoints.length === 0) && allowEnclosedFallback) {
    path = findSeaPath(tiles, ship.x, ship.y, tx, ty, true);
  }
  if (!path || path.waypoints.length === 0) return false;

  // Tàu hải quân chỉ đi qua ô WATER (loại bỏ điểm đầu/cuối là đất liền hoặc ô Cảng)
  const waterWaypoints = path.waypoints.filter((wp) => tiles[wp.y]?.[wp.x]?.terrain === 'WATER');
  if (waterWaypoints.length === 0) return false;

  const endWp = waterWaypoints[waterWaypoints.length - 1];
  ship.targetX = endWp.x;
  ship.targetY = endWp.y;
  ship.waypoints = waterWaypoints;
  ship.waypointIdx = 0;
  return true;
}

function findNearestOwnedOpenPort(tiles: Tile[][], nationId: number, fromX: number, fromY: number): { x: number; y: number } | null {
  let best: { x: number; y: number; dist: number } | null = null;
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const t = row[x];
      if (!t || t.owner !== nationId || t.building !== 'PORT') continue;
      if (t.inactiveTimer && t.inactiveTimer > 0) continue;
      const access = getPortWaterAccess(tiles, x, y);
      if (access.isEnclosed || access.adjacentWater.length === 0) continue;
      const d = Math.hypot(x - fromX, y - fromY);
      if (!best || d < best.dist) {
        best = { x, y, dist: d };
      }
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

function spawnShipAtPort(data: any, item: PortBuildQueueItem): NavalShip | null {
  const tiles: Tile[][] = data.tiles || [];
  const nations: Nation[] = data.nations || [];
  const nation = nations[item.nationId];
  if (!nation || nation.isEliminated) return null;

  const access = getPortWaterAccess(tiles, item.portX, item.portY);
  const openTile = access.adjacentWater.find((w) => w.isOpen) || access.adjacentWater[0];
  if (!openTile) return null;

  const stats = getShipScaleStats(nation, item.shipType);
  const id = `nav_${item.shipType.toLowerCase()}_${item.nationId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  if (item.shipType === 'EXTRACTOR') {
    const extStats = stats as ReturnType<typeof getShipScaleStats> & { oilCapacity: number };
    const ship: NavalShip = {
      id,
      type: 'EXTRACTOR',
      nationId: item.nationId,
      x: openTile.x,
      y: openTile.y,
      angle: 0,
      hp: extStats.maxHp,
      maxHp: extStats.maxHp,
      speed: extStats.speed,
      state: 'IDLE',
      scaleTier: extStats.tier,
      homePortX: item.portX,
      homePortY: item.portY,
      oilCapacity: extStats.oilCapacity,
      extractedTotal: 0,
      vision: NAVAL_CONFIG.EXTRACTOR.VISION,
    };
    const dep = findNearestFreeSeaOilDeposit(data, ship);
    if (dep) {
      assignExtractorDeposit(data, ship, dep.x, dep.y);
    }
    data.navalShips.push(ship);
    return ship;
  }

  const warStats = stats as ReturnType<typeof getShipScaleStats> & { dps: number; maxTroopCapacity: number };
  const ship: NavalShip = {
    id,
    type: 'WARSHIP',
    nationId: item.nationId,
    x: openTile.x,
    y: openTile.y,
    angle: 0,
    hp: warStats.maxHp,
    maxHp: warStats.maxHp,
    speed: warStats.speed,
    state: 'PATROL',
    scaleTier: warStats.tier,
    homePortX: item.portX,
    homePortY: item.portY,
    dps: warStats.dps,
    range: NAVAL_CONFIG.WARSHIP.RANGE_TILES,
    vision: NAVAL_CONFIG.WARSHIP.VISION_TILES,
    order: 'AUTO',
    patrolX: openTile.x,
    patrolY: openTile.y,
    carriedTroops: 0,
    maxTroopCapacity: warStats.maxTroopCapacity,
    attackCooldown: 0,
  };
  data.navalShips.push(ship);
  return ship;
}

export function isEnemyNavalShip(attacker: Nation | undefined, ship: NavalShip): boolean {
  if (!attacker || !ship || ship.hp <= 0) return false;
  if (ship.nationId <= 0 || ship.nationId === attacker.id) return false;
  const dip = attacker.diplomacy?.[ship.nationId]?.status || 'WAR';
  return dip === 'WAR';
}

export function isEnemyTradeShipForWarship(attacker: Nation | undefined, ship: SeaTradeShip): boolean {
  if (!attacker || !ship || ship.isEnclosedLocal || ship.derelict) return false;
  if (ship.fromNation === attacker.id || ship.toNation === attacker.id) return false;
  const dipFrom = attacker.diplomacy?.[ship.fromNation]?.status || 'WAR';
  const dipTo = attacker.diplomacy?.[ship.toNation]?.status || 'WAR';
  if (dipFrom === 'ALLIANCE' || dipTo === 'ALLIANCE') return false;
  return dipFrom === 'WAR' || dipTo === 'WAR';
}

export function issueWarshipOrder(
  data: any,
  ship: NavalShip,
  order: NonNullable<NavalShip['order']>,
  params?: { x?: number; y?: number; targetShipId?: string; escortShipId?: string }
): { ok: boolean; reason: string } {
  if (!data || !ship || ship.type !== 'WARSHIP' || ship.hp <= 0) {
    return { ok: false, reason: 'Tàu Chiến không hợp lệ.' };
  }
  const tiles: Tile[][] = data.tiles || [];
  ship.order = order;
  ship.isRepairing = false;
  ship.captureProgress = 0;
  ship.captureTargetShipId = undefined;

  if (order === 'MOVE' || order === 'PATROL') {
    const tx = Math.round(params?.x ?? ship.x);
    const ty = Math.round(params?.y ?? ship.y);
    if (order === 'PATROL') {
      ship.patrolX = tx;
      ship.patrolY = ty;
      ship.state = 'PATROL';
    } else {
      ship.state = 'MOVING';
    }
    ship.escortShipId = undefined;
    ship.targetShipId = undefined;
    if (Math.hypot(tx - ship.x, ty - ship.y) > 0.8) {
      if (!setShipSeaPath(tiles, ship, tx, ty)) {
        return { ok: false, reason: 'Không tìm được đường biển tới điểm đã chọn.' };
      }
    }
    return { ok: true, reason: order === 'PATROL' ? `Tuần tra quanh (${tx}, ${ty}).` : `Đang di chuyển tới (${tx}, ${ty}).` };
  }

  if (order === 'ATTACK') {
    ship.targetShipId = params?.targetShipId;
    ship.escortShipId = undefined;
    ship.state = 'ATTACKING';
    if (typeof params?.x === 'number' && typeof params?.y === 'number') {
      setShipSeaPath(tiles, ship, Math.round(params.x), Math.round(params.y));
    }
    return { ok: true, reason: 'Tàu Chiến đang truy kích mục tiêu.' };
  }

  if (order === 'ESCORT') {
    ship.escortShipId = params?.escortShipId;
    ship.targetShipId = undefined;
    ship.state = 'ESCORT';
    return { ok: true, reason: 'Tàu Chiến đang hộ tống tàu đồng đội.' };
  }

  if (order === 'RETREAT') {
    const port = findNearestOwnedOpenPort(tiles, ship.nationId, ship.x, ship.y);
    ship.state = 'RETREATING';
    ship.targetShipId = undefined;
    ship.escortShipId = undefined;
    if (port) {
      setShipSeaPath(tiles, ship, port.x, port.y);
      return { ok: true, reason: `Đang rút về cảng (${port.x}, ${port.y}) để sửa chữa.` };
    }
    ship.state = 'REPAIRING';
    ship.isRepairing = true;
    ship.waypoints = undefined;
    return { ok: true, reason: 'Không có cảng, bắt đầu sửa chữa trên biển (2 Vàng/HP).' };
  }

  ship.state = 'PATROL';
  ship.targetShipId = undefined;
  ship.escortShipId = undefined;
  return { ok: true, reason: 'Chế độ tự động tuần tra.' };
}

export function startWarshipSeaRepair(ship: NavalShip): { ok: boolean; reason: string } {
  if (!ship || ship.type !== 'WARSHIP' || ship.hp <= 0) {
    return { ok: false, reason: 'Tàu Chiến không hợp lệ.' };
  }
  if (ship.hp >= ship.maxHp) {
    return { ok: false, reason: 'Tàu Chiến đã đầy máu.' };
  }
  ship.state = 'REPAIRING';
  ship.isRepairing = true;
  ship.waypoints = undefined;
  ship.waypointIdx = undefined;
  ship.targetShipId = undefined;
  return { ok: true, reason: 'Đang sửa chữa trên biển (0.5% HP/s, 2 Vàng/HP).' };
}

export function isShipNearOwnedCoast(tiles: Tile[][], nationId: number, x: number, y: number, radiusTiles = 2.8): boolean {
  if (!Array.isArray(tiles) || tiles.length === 0 || nationId <= 0) return false;
  const size = tiles.length;
  const cx = Math.round(x);
  const cy = Math.round(y);
  const r = Math.ceil(radiusTiles);
  for (let dy = -r; dy <= r; dy++) {
    const ny = cy + dy;
    if (ny < 0 || ny >= size) continue;
    for (let dx = -r; dx <= r; dx++) {
      const nx = cx + dx;
      if (nx < 0 || nx >= size) continue;
      if (dx * dx + dy * dy > radiusTiles * radiusTiles) continue;
      const t = tiles[ny]?.[nx];
      if (t && t.owner === nationId && (t.terrain !== 'WATER' || t.building === 'PORT')) {
        return true;
      }
    }
  }
  return false;
}

export function findLandingApproach(
  tiles: Tile[][],
  fromX: number,
  fromY: number,
  targetLandX: number,
  targetLandY: number,
  forNation?: Nation
): { coastWaterX: number; coastWaterY: number; landTileX: number; landTileY: number; waypoints: SeaWaypoint[] } | null {
  if (!Array.isArray(tiles) || tiles.length === 0) return null;
  const size = tiles.length;
  const tx = Math.round(targetLandX);
  const ty = Math.round(targetLandY);
  const centerTile = tiles[ty]?.[tx];
  if (!centerTile) return null;

  const isTargetableLand = (lt: Tile | undefined): lt is Tile => {
    if (!lt || lt.terrain === 'WATER') return false;
    if (forNation) {
      if (lt.owner === forNation.id) return false;
      if (lt.owner > 0) {
        const dip = forNation.diplomacy?.[lt.owner]?.status;
        if (dip === 'ALLIANCE' || dip === 'TRUCE') return false;
      }
    }
    return true;
  };

  const DIRS4 = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  const DIRS8 = [
    ...DIRS4,
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];

  let bestResult: {
    coastWaterX: number;
    coastWaterY: number;
    landTileX: number;
    landTileY: number;
    waypoints: SeaWaypoint[];
    score: number;
  } | null = null;

  const tryLandTile = (lt: Tile) => {
    const landOffset = Math.hypot(lt.x - tx, lt.y - ty);
    for (let di = 0; di < DIRS8.length; di++) {
      const wx = lt.x + DIRS8[di].dx;
      const wy = lt.y + DIRS8[di].dy;
      if (wx < 0 || wx >= size || wy < 0 || wy >= size) continue;
      if (tiles[wy]?.[wx]?.terrain !== 'WATER') continue;
      // Thử biển mở trước; nếu thất bại thì thử cùng vùng nước kín (2c)
      let path = findSeaPath(tiles, fromX, fromY, wx, wy, false);
      if (!path || path.waypoints.length === 0) {
        path = findSeaPath(tiles, fromX, fromY, wx, wy, true);
      }
      if (!path || path.waypoints.length === 0) continue;
      const diagPenalty = di >= 4 ? 1.5 : 0;
      const score = path.length + landOffset * 4 + diagPenalty;
      if (!bestResult || score < bestResult.score) {
        bestResult = {
          coastWaterX: wx,
          coastWaterY: wy,
          landTileX: lt.x,
          landTileY: lt.y,
          waypoints: path.waypoints,
          score,
        };
      }
    }
  };

  // Kiểm tra chính ô được chạm trước, sau đó mở rộng bán kính ven biển lên tối đa 6 ô
  if (isTargetableLand(centerTile)) {
    tryLandTile(centerTile);
  }
  if (!bestResult) {
    for (let r = 1; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = tx + dx;
          const ny = ty + dy;
          const lt = tiles[ny]?.[nx];
          if (isTargetableLand(lt)) {
            tryLandTile(lt);
          }
        }
      }
      if (bestResult) break;
    }
  }

  if (!bestResult) return null;
  const found: {
    coastWaterX: number;
    coastWaterY: number;
    landTileX: number;
    landTileY: number;
    waypoints: SeaWaypoint[];
  } = bestResult;
  return {
    coastWaterX: found.coastWaterX,
    coastWaterY: found.coastWaterY,
    landTileX: found.landTileX,
    landTileY: found.landTileY,
    waypoints: found.waypoints,
  };
}

export function loadTroopsOnWarship(
  data: any,
  ship: NavalShip,
  requestedAmount?: number
): { ok: boolean; reason: string; loaded: number } {
  if (!data || !ship || ship.type !== 'WARSHIP' || ship.hp <= 0 || ship.nationId <= 0) {
    return { ok: false, reason: 'Tàu Chiến không hợp lệ.', loaded: 0 };
  }
  const nations: Nation[] = data.nations || [];
  const tiles: Tile[][] = data.tiles || [];
  const nation = nations[ship.nationId];
  if (!nation || nation.isEliminated) {
    return { ok: false, reason: 'Quốc gia không hợp lệ.', loaded: 0 };
  }
  if (ship.isRepairing || ship.state === 'REPAIRING') {
    return { ok: false, reason: 'Tàu Chiến đang sửa chữa, không thể nạp quân.', loaded: 0 };
  }
  if (!isShipNearOwnedCoast(tiles, ship.nationId, ship.x, ship.y, 2.8)) {
    return { ok: false, reason: 'Tàu phải ở gần Cảng hoặc bờ biển phe mình để nạp quân.', loaded: 0 };
  }

  const wStats = getShipScaleStats(nation, 'WARSHIP') as ReturnType<typeof getShipScaleStats> & {
    maxTroopCapacity: number;
  };
  ship.maxTroopCapacity = Math.max(ship.maxTroopCapacity || 0, wStats.maxTroopCapacity);

  const curCarried = ship.carriedTroops || 0;
  const spaceLeft = Math.max(0, ship.maxTroopCapacity - curCarried);
  if (spaceLeft <= 0) {
    return { ok: false, reason: 'Khoang chở quân trên tàu đã đầy.', loaded: 0 };
  }

  const availableTroops = Math.max(0, Math.floor(nation.troops) - 5);
  if (availableTroops <= 0) {
    return { ok: false, reason: 'Quân đội dự trữ quá ít (cần giữ tối thiểu 5 quân).', loaded: 0 };
  }

  const maxLoadCap = Math.max(1, Math.min(spaceLeft, Math.floor(nation.troops * 0.5), availableTroops));
  const amount = requestedAmount !== undefined
    ? Math.max(0, Math.min(maxLoadCap, Math.floor(requestedAmount)))
    : maxLoadCap;

  if (amount <= 0) {
    return { ok: false, reason: 'Không đủ quân để nạp lên tàu.', loaded: 0 };
  }

  nation.troops -= amount;
  ship.carriedTroops = curCarried + amount;
  if (ship.state !== 'ATTACKING' && ship.state !== 'RETREATING') {
    ship.state = 'TRANSPORTING';
  }
  return {
    ok: true,
    reason: `Đã nạp ${amount} quân lên Tàu Chiến (${ship.carriedTroops}/${ship.maxTroopCapacity}).`,
    loaded: amount,
  };
}

export function unloadTroopsAtCoast(data: any, ship: NavalShip): { ok: boolean; reason: string; unloaded: number } {
  if (!data || !ship || ship.type !== 'WARSHIP' || ship.hp <= 0 || ship.nationId <= 0) {
    return { ok: false, reason: 'Tàu Chiến không hợp lệ.', unloaded: 0 };
  }
  const carried = ship.carriedTroops || 0;
  if (carried <= 0) {
    return { ok: false, reason: 'Tàu không có quân trên khoang.', unloaded: 0 };
  }
  const nations: Nation[] = data.nations || [];
  const tiles: Tile[][] = data.tiles || [];
  const nation = nations[ship.nationId];
  if (!nation || nation.isEliminated) {
    return { ok: false, reason: 'Quốc gia không hợp lệ.', unloaded: 0 };
  }
  if (!isShipNearOwnedCoast(tiles, ship.nationId, ship.x, ship.y, 2.8)) {
    return { ok: false, reason: 'Cần đưa tàu về gần bờ biển/cảng phe mình để trả quân.', unloaded: 0 };
  }

  nation.troops = Math.min(nation.maxTroops || 999999999, nation.troops + carried);
  ship.carriedTroops = 0;
  ship.landingCoastX = undefined;
  ship.landingCoastY = undefined;
  ship.landingTargetX = undefined;
  ship.landingTargetY = undefined;
  if (ship.order === 'LANDING') {
    ship.order = 'AUTO';
    ship.state = 'PATROL';
  }
  return { ok: true, reason: `Đã đưa ${carried} quân trở lại bờ an toàn.`, unloaded: carried };
}

export function orderAmphibiousLanding(
  data: any,
  ship: NavalShip,
  targetLandX: number,
  targetLandY: number,
  autoLoadIfNearCoast = true
): { ok: boolean; reason: string } {
  if (!data || !ship || ship.type !== 'WARSHIP' || ship.hp <= 0 || ship.nationId <= 0) {
    return { ok: false, reason: 'Tàu Chiến không hợp lệ.' };
  }
  const tiles: Tile[][] = data.tiles || [];
  const nations: Nation[] = data.nations || [];
  const nation = nations[ship.nationId];
  const tx = Math.round(targetLandX);
  const ty = Math.round(targetLandY);
  const tgtTile = tiles[ty]?.[tx];
  if (!tgtTile || !nation || nation.isEliminated) {
    return { ok: false, reason: 'Mục tiêu đổ bộ không hợp lệ.' };
  }
  if (tgtTile.terrain === 'WATER') {
    return { ok: false, reason: 'Hãy chạm vào ô đất địch hoặc đất trống để đổ bộ.' };
  }
  if (tgtTile.owner === ship.nationId) {
    return { ok: false, reason: 'Ô đất này đã thuộc chủ quyền của bạn.' };
  }
  if (tgtTile.owner > 0) {
    const dip = nation.diplomacy?.[tgtTile.owner]?.status;
    if (dip === 'ALLIANCE' || dip === 'TRUCE') {
      return { ok: false, reason: 'Không thể đổ bộ vào lãnh thổ Đồng Minh hoặc đang Đình Chiến.' };
    }
  }

  if ((ship.carriedTroops || 0) <= 0) {
    if (autoLoadIfNearCoast && isShipNearOwnedCoast(tiles, ship.nationId, ship.x, ship.y, 2.8)) {
      const loadRes = loadTroopsOnWarship(data, ship);
      if (!loadRes.ok) {
        return { ok: false, reason: loadRes.reason };
      }
    } else {
      return { ok: false, reason: 'Hãy đưa tàu về gần Cảng/bờ phe mình để nạp quân.' };
    }
  }
  if ((ship.carriedTroops || 0) <= 0) {
    return { ok: false, reason: 'Hãy đưa tàu về gần Cảng/bờ phe mình để nạp quân.' };
  }

  const approach = findLandingApproach(tiles, ship.x, ship.y, tx, ty, nation);
  if (!approach) {
    return { ok: false, reason: 'Không tìm được bãi biển đổ bộ (bờ quá xa hoặc đường biển bị chặn).' };
  }

  const finalTarget = tiles[approach.landTileY]?.[approach.landTileX];
  if (finalTarget && finalTarget.owner === ship.nationId) {
    return { ok: false, reason: 'Bờ biển tiếp cận đã thuộc phe mình.' };
  }
  if (finalTarget && finalTarget.owner > 0) {
    const fDip = nation.diplomacy?.[finalTarget.owner]?.status;
    if (fDip === 'ALLIANCE' || fDip === 'TRUCE') {
      return { ok: false, reason: 'Bãi biển tiếp cận thuộc Đồng Minh / Đình Chiến.' };
    }
  }

  const waterWps = approach.waypoints.filter((wp) => tiles[wp.y]?.[wp.x]?.terrain === 'WATER');
  ship.order = 'LANDING';
  ship.state = 'TRANSPORTING';
  ship.isRepairing = false;
  ship.targetShipId = undefined;
  ship.escortShipId = undefined;
  ship.landingCoastX = approach.coastWaterX;
  ship.landingCoastY = approach.coastWaterY;
  ship.landingTargetX = approach.landTileX;
  ship.landingTargetY = approach.landTileY;
  ship.targetX = approach.coastWaterX;
  ship.targetY = approach.coastWaterY;
  ship.waypoints = waterWps.length > 0 ? waterWps : approach.waypoints;
  ship.waypointIdx = 0;

  return {
    ok: true,
    reason: `Xuất kích đổ bộ ${ship.carriedTroops} quân tới bờ (${approach.landTileX}, ${approach.landTileY})!`,
  };
}

export function damageNavalShip(
  ship: NavalShip,
  damage: number,
  attacker: Nation | undefined,
  data: any,
  reasonLabel?: string,
  applyCasualtiesFn?: (nation: Nation, loss: number) => void
): boolean {
  if (!ship || ship.hp <= 0 || damage <= 0) return false;
  ship.hp = Math.max(0, ship.hp - damage);
  // Bị bắn thì ngắt tiến trình chiếm tàu vô chủ nếu đang chiếm
  if (ship.captureProgress && ship.captureProgress > 0) {
    ship.captureProgress = 0;
    ship.captureTargetShipId = undefined;
  }
  if (ship.hp <= 0) {
    const bounty = ship.type === 'WARSHIP' ? 90 : 40;
    if (attacker && !attacker.isEliminated) {
      attacker.gold += bounty;
    }
    const lostTroops = ship.type === 'WARSHIP' ? (ship.carriedTroops || 0) : 0;
    if (lostTroops > 0 && ship.nationId > 0 && data?.nations?.[ship.nationId]) {
      applyCasualtiesFn?.(data.nations[ship.nationId], lostTroops);
      pushNavalToast(data, ship.nationId, `🚨 Tàu Chiến chở ${lostTroops} quân đã bị đánh chìm!`);
    }
    ship.carriedTroops = 0;
    data.particles = data.particles || [];
    data.particles.push({
      x: ship.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      y: ship.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      color: '#f97316',
      size: 0,
      life: 45,
      maxLife: 45,
      vx: 0,
      vy: -0.7,
      type: 'FLOAT_TEXT',
      text: reasonLabel || (lostTroops > 0
        ? `⚓💥 Đánh chìm tàu chở ${lostTroops} quân!`
        : `⚓💥 Đánh chìm ${ship.type === 'WARSHIP' ? 'Tàu Chiến' : 'Tàu Khai Thác'}!`),
    });
    return true;
  }
  return false;
}

export function getFleetMembers(data: any, fleetId: string): NavalShip[] {
  if (!data || !fleetId || !Array.isArray(data.navalShips)) return [];
  return (data.navalShips as NavalShip[]).filter(
    (s) => s && s.hp > 0 && s.type === 'WARSHIP' && s.nationId > 0 && s.fleetId === fleetId
  );
}

export function createOrJoinFleet(
  data: any,
  nationId: number,
  shipIds: string[],
  targetFleetId?: string
): { ok: boolean; fleetId?: string; reason: string } {
  ensureNavalData(data);
  const ships: NavalShip[] = data.navalShips;
  const fleetId = targetFleetId || `flt_${nationId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const existingCount = targetFleetId ? getFleetMembers(data, fleetId).length : 0;
  let added = 0;

  for (const sid of shipIds) {
    if (existingCount + added >= NAVAL_CONFIG.FLEET.MAX_SHIPS) break;
    const s = ships.find((x) => x && x.id === sid && x.hp > 0 && x.type === 'WARSHIP' && x.nationId === nationId);
    if (!s || s.fleetId === fleetId) continue;
    s.fleetId = fleetId;
    added++;
  }

  if (added === 0 && existingCount === 0) {
    return { ok: false, reason: 'Không có Tàu Chiến hợp lệ để lập hạm đội.' };
  }
  const total = getFleetMembers(data, fleetId).length;
  return {
    ok: true,
    fleetId,
    reason: `Hạm đội (${total}/${NAVAL_CONFIG.FLEET.MAX_SHIPS} tàu) đã sẵn sàng (+2 tầm nhìn).`,
  };
}

export function leaveFleet(data: any, shipId: string): void {
  const ships: NavalShip[] = data?.navalShips || [];
  const s = ships.find((x) => x && x.id === shipId);
  if (s) s.fleetId = undefined;
}

export function disbandFleet(data: any, nationId: number, fleetId: string): void {
  const ships: NavalShip[] = data?.navalShips || [];
  for (const s of ships) {
    if (s && s.nationId === nationId && s.fleetId === fleetId) {
      s.fleetId = undefined;
    }
  }
}

export function issueFleetOrder(
  data: any,
  nationId: number,
  fleetId: string,
  order: NonNullable<NavalShip['order']>,
  params?: { x?: number; y?: number; targetShipId?: string; escortShipId?: string }
): { ok: boolean; reason: string } {
  const members = getFleetMembers(data, fleetId).filter((s) => s.nationId === nationId);
  if (members.length === 0) {
    return { ok: false, reason: 'Hạm đội không còn tàu hoạt động.' };
  }
  let okCount = 0;
  let lastFailReason = '';
  for (let i = 0; i < members.length; i++) {
    const s = members[i];
    if (s.isRepairing || s.state === 'REPAIRING') {
      lastFailReason = 'Tàu trong hạm đội đang sửa chữa.';
      continue;
    }
    if (order === 'LANDING' && typeof params?.x === 'number' && typeof params?.y === 'number') {
      const res = orderAmphibiousLanding(data, s, params.x, params.y, true);
      if (res.ok) okCount++;
      else lastFailReason = res.reason;
    } else {
      const res = issueWarshipOrder(data, s, order, params);
      if (res.ok) okCount++;
      else lastFailReason = res.reason;
    }
  }
  return {
    ok: okCount > 0,
    reason:
      okCount > 0
        ? `Đã phát lệnh cho ${okCount}/${members.length} tàu trong hạm đội.`
        : (lastFailReason || 'Không thể phát lệnh cho hạm đội.'),
  };
}

export function convertEliminatedNationShipsToDerelict(data: any, eliminatedNationId: number): void {
  if (!data || eliminatedNationId <= 0) return;
  ensureNavalData(data);
  const tiles: Tile[][] = data.tiles || [];
  const size = tiles.length;
  const ships: NavalShip[] = data.navalShips;

  // Hủy đơn đóng tàu đang dở ở cảng
  data.portBuildQueues = (data.portBuildQueues || []).filter(
    (q: PortBuildQueueItem) => q && q.nationId !== eliminatedNationId
  );

  // Chuyển toàn bộ Tàu Hải Quân còn sống của nước bị loại thành tàu vô chủ (nationId = 0) & trôi nhẹ ra vùng nước an toàn
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    if (!s || s.hp <= 0 || s.nationId !== eliminatedNationId) continue;
    s.prevNationId = eliminatedNationId;
    s.nationId = 0;
    s.fleetId = undefined;
    s.assignedDepositX = undefined;
    s.assignedDepositY = undefined;
    s.targetShipId = undefined;
    s.escortShipId = undefined;
    s.landingCoastX = undefined;
    s.landingCoastY = undefined;
    s.landingTargetX = undefined;
    s.landingTargetY = undefined;
    s.carriedTroops = 0;
    s.isRepairing = false;
    s.order = 'AUTO';
    s.state = 'IDLE';
    s.captureProgress = 0;
    s.captureTargetShipId = undefined;
    s.derelictTimer = 0;
    s.speed = 1.25;
    s.waypoints = undefined;
    s.waypointIdx = undefined;

    // Rút nhẹ ra 1-2 ô biển gần đó nếu có nước để tránh đứng đè mép bờ
    if (size > 0) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const nx = Math.max(0, Math.min(size - 1, Math.round(s.x) + dx));
        const ny = Math.max(0, Math.min(size - 1, Math.round(s.y) + dy));
        if (tiles[ny]?.[nx]?.terrain === 'WATER') {
          s.waypoints = [{ x: nx, y: ny }];
          s.waypointIdx = 0;
          break;
        }
      }
    }
  }

  // Chuyển tối đa 2 tàu thương đường biển (không thuộc hồ kín) của nước bị loại thành tàu vô chủ có thể chiếm
  if (Array.isArray(data.tradeShips) && data.tradeShips.length > 0 && ships.length < NAVAL_CONFIG.MAX_GLOBAL_NAVAL_SHIPS) {
    const routeMap = new Map<string, SeaTradeRoute>();
    if (Array.isArray(data.tradeRoutes)) {
      data.tradeRoutes.forEach((r: SeaTradeRoute) => {
        if (r?.id) routeMap.set(r.id, r);
      });
    }
    let converted = 0;
    for (let ti = 0; ti < data.tradeShips.length && converted < 2 && ships.length < NAVAL_CONFIG.MAX_GLOBAL_NAVAL_SHIPS; ti++) {
      const ts: SeaTradeShip = data.tradeShips[ti];
      if (!ts || ts.isEnclosedLocal || ts.derelict) continue;
      if (ts.fromNation !== eliminatedNationId && ts.toNation !== eliminatedNationId) continue;
      const pos = getTradeShipPosition(ts, routeMap);
      const tx = Math.max(0, Math.min(size - 1, Math.round(pos.x)));
      const ty = Math.max(0, Math.min(size - 1, Math.round(pos.y)));
      if (tiles[ty]?.[tx]?.terrain !== 'WATER') continue;
      const derelictShip: NavalShip = {
        id: `nav_der_${eliminatedNationId}_${Date.now().toString(36)}_${ti}`,
        type: 'EXTRACTOR',
        nationId: 0,
        prevNationId: eliminatedNationId,
        x: pos.x,
        y: pos.y,
        angle: 0,
        hp: Math.max(80, Math.round(ts.hp ?? NAVAL_CONFIG.EXTRACTOR.BASE_HP)),
        maxHp: NAVAL_CONFIG.EXTRACTOR.BASE_HP,
        speed: 1.25,
        state: 'IDLE',
        scaleTier: ts.scaleTier || 1,
        oilCapacity: NAVAL_CONFIG.EXTRACTOR.BASE_OIL_CAPACITY,
        vision: NAVAL_CONFIG.EXTRACTOR.VISION,
        derelictTimer: 0,
        captureProgress: 0,
      };
      ships.push(derelictShip);
      converted++;
    }
  }
}

/**
 * Cập nhật di chuyển mượt 60 FPS trên mặt nước cho toàn bộ Tàu Hải Quân + tách va chạm nhẹ giữa Tàu Chiến.
 */
export function tickNavalFrame(data: any, deltaSec: number): void {
  if (!data || !Array.isArray(data.navalShips) || data.navalShips.length === 0) return;
  const ships: NavalShip[] = data.navalShips;
  const tiles: Tile[][] = data.tiles || [];
  const size = tiles.length;

  const isNavalTilePassable = (gx: number, gy: number, prevGx: number, prevGy: number): boolean => {
    if (size === 0 || gx < 0 || gx >= size || gy < 0 || gy >= size) return false;
    if (tiles[gy]?.[gx]?.terrain !== 'WATER') return false;
    if (gx !== prevGx && gy !== prevGy) {
      if (tiles[prevGy]?.[gx]?.terrain !== 'WATER' || tiles[gy]?.[prevGx]?.terrain !== 'WATER') {
        return false;
      }
    }
    return true;
  };

  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    if (!s || s.hp <= 0) continue;
    if (s.repathCooldown && s.repathCooldown > 0) {
      s.repathCooldown = Math.max(0, s.repathCooldown - deltaSec);
    }

    const wps: SeaWaypoint[] | undefined = s.waypoints;
    if (!wps || wps.length === 0) continue;

    let idx = s.waypointIdx ?? 0;
    if (idx >= wps.length) {
      s.waypoints = undefined;
      s.waypointIdx = undefined;
      continue;
    }

    let remainMove = Math.max(0.5, s.speed) * deltaSec;
    while (remainMove > 0 && idx < wps.length) {
      const wp = wps[idx];
      const dx = wp.x - s.x;
      const dy = wp.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0.001) {
        idx++;
        continue;
      }
      s.angle = Math.atan2(dy, dx);
      const stepDist = Math.min(remainMove, dist);
      const nx = dist <= remainMove ? wp.x : s.x + (dx / dist) * stepDist;
      const ny = dist <= remainMove ? wp.y : s.y + (dy / dist) * stepDist;
      const curGx = Math.round(s.x);
      const curGy = Math.round(s.y);
      const gx = Math.round(nx);
      const gy = Math.round(ny);

      if (isNavalTilePassable(gx, gy, curGx, curGy)) {
        s.x = nx;
        s.y = ny;
        if (dist <= remainMove) {
          remainMove -= dist;
          idx++;
        } else {
          remainMove = 0;
        }
      } else {
        // Bước kế tiếp bị chặn bởi đất: không đi xuyên đất, giới hạn tối đa 1 lần tính lại đường mỗi 2 giây
        remainMove = 0;
        if ((s.repathCooldown || 0) <= 0) {
          s.repathCooldown = 2.0;
          let repathed = false;
          if (typeof s.targetX === 'number' && typeof s.targetY === 'number') {
            repathed = setShipSeaPath(tiles, s, s.targetX, s.targetY, true);
          }
          if (repathed) {
            idx = s.waypointIdx ?? 0;
          } else {
            s.waypoints = undefined;
            s.waypointIdx = undefined;
            idx = wps.length;
            if (s.order === 'MOVE') {
              s.order = 'AUTO';
              s.state = 'PATROL';
              s.targetX = undefined;
              s.targetY = undefined;
              s.patrolX = curGx;
              s.patrolY = curGy;
              pushNavalToast(data, s.nationId, '⚓ Không tìm được đường biển tới mục tiêu, đã hủy lệnh di chuyển.');
            } else if (s.order === 'LANDING') {
              s.order = 'AUTO';
              s.state = (s.carriedTroops || 0) > 0 ? 'IDLE' : 'PATROL';
              s.landingCoastX = undefined;
              s.landingCoastY = undefined;
              s.landingTargetX = undefined;
              s.landingTargetY = undefined;
              s.targetX = undefined;
              s.targetY = undefined;
              pushNavalToast(data, s.nationId, '🏖️ Đường biển tới bãi đổ bộ bị chặn, đã hủy lệnh (quân vẫn giữ trên tàu).');
            } else {
              s.state = s.type === 'EXTRACTOR' ? 'IDLE' : 'PATROL';
              s.targetX = undefined;
              s.targetY = undefined;
              if (s.type === 'WARSHIP' && s.order === 'ATTACK') {
                s.targetShipId = undefined;
                s.order = 'AUTO';
              }
            }
          }
        }
        break;
      }
    }

    if (s.waypoints) {
      if (idx >= s.waypoints.length) {
        s.waypoints = undefined;
        s.waypointIdx = undefined;
      } else {
        s.waypointIdx = idx;
      }
    }
  }

  // Va chạm chỉ áp dụng giữa Tàu Chiến với nhau (tàu buôn & khai thác đi xuyên qua bình thường)
  const warshipIndices: number[] = [];
  for (let i = 0; i < ships.length; i++) {
    const s = ships[i];
    if (s && s.hp > 0 && s.type === 'WARSHIP') warshipIndices.push(i);
  }
  const minSep = 0.72;
  for (let a = 0; a < warshipIndices.length; a++) {
    const sa = ships[warshipIndices[a]];
    for (let b = a + 1; b < warshipIndices.length; b++) {
      const sb = ships[warshipIndices[b]];
      const dx = sb.x - sa.x;
      const dy = sb.y - sa.y;
      const dist = Math.hypot(dx, dy);
      if (dist < minSep) {
        const push = (minSep - Math.max(0.05, dist)) * 0.35;
        const ux = dist > 0.01 ? dx / dist : (a % 2 === 0 ? 1 : -1);
        const uy = dist > 0.01 ? dy / dist : 0;
        const nax = sa.x - ux * push;
        const nay = sa.y - uy * push;
        const nbx = sb.x + ux * push;
        const nby = sb.y + uy * push;
        if (tiles[Math.round(nay)]?.[Math.round(nax)]?.terrain === 'WATER') {
          sa.x = nax;
          sa.y = nay;
        }
        if (tiles[Math.round(nby)]?.[Math.round(nbx)]?.terrain === 'WATER') {
          sb.x = nbx;
          sb.y = nby;
        }
      }
    }
  }
}

/**
 * Tick logic 1 giây cho hàng đợi đóng tàu tại Cảng & Tàu Khai Thác (và các hệ thống hải quân khác ở các phần tiếp theo).
 */
export function tickNavalSystem(data: any, difficulty: string, _callbacks?: NavalTickCallbacks): void {
  if (!data) return;
  ensureNavalData(data);

  const tiles: Tile[][] = data.tiles || [];
  const nations: Nation[] = data.nations || [];
  const queues: PortBuildQueueItem[] = data.portBuildQueues;
  const ships: NavalShip[] = data.navalShips;
  const deposits = getDepositTiles(tiles);

  // Phát thông báo cho người chơi từ hàng đợi khung hình (không gọi React state trực tiếp từ rAF)
  if (Array.isArray(data._navalToasts) && data._navalToasts.length > 0) {
    const pId = _callbacks?.playerNationId ?? 1;
    const toasts: { nationId: number; msg: string }[] = data._navalToasts.splice(0, data._navalToasts.length);
    for (const tItem of toasts) {
      if (tItem && tItem.nationId === pId) {
        _callbacks?.notifyPlayer?.(tItem.msg);
      }
    }
  }

  // 0. Cập nhật Vùng Kiểm Soát Biển theo chu kỳ 2 giây (không chạy mỗi frame để chống lag)
  if (!data.seaControlGrid || ((data.gameTimeSeconds || 0) % NAVAL_CONFIG.SEA_CONTROL.UPDATE_INTERVAL_SEC === 0)) {
    updateSeaControlGrid(data);
  }

  // 1. Tiến trình đóng tàu tại các Hải Cảng
  for (let i = queues.length - 1; i >= 0; i--) {
    const q = queues[i];
    if (!q) {
      queues.splice(i, 1);
      continue;
    }
    const nat = nations[q.nationId];
    const pTile = tiles[q.portY]?.[q.portX];
    if (!nat || nat.isEliminated || !pTile || pTile.owner !== q.nationId || pTile.building !== 'PORT') {
      queues.splice(i, 1);
      continue;
    }
    q.remainingTime -= 1;
    if (q.remainingTime <= 0) {
      queues.splice(i, 1);
      const spawned = spawnShipAtPort(data, q);
      if (spawned && q.nationId === (_callbacks?.playerNationId ?? 1)) {
        data.particles = data.particles || [];
        data.particles.push({
          x: spawned.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          y: spawned.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          color: '#38bdf8',
          size: 0,
          life: 45,
          maxLife: 45,
          vx: 0,
          vy: -0.7,
          type: 'FLOAT_TEXT',
          text: `🚢 Hoàn thành ${q.shipType === 'EXTRACTOR' ? 'Tàu Khai Thác' : 'Tàu Chiến'}!`,
        });
      }
    }
  }

  // 2. Xử lý Tàu Hải Quân đang hoạt động
  const diffMult = difficulty === 'EXTREME' ? 1.15 : difficulty === 'HARD' ? 1.08 : difficulty === 'EASY' ? 0.9 : 1.0;

  for (let i = ships.length - 1; i >= 0; i--) {
    const ship = ships[i];
    if (!ship || ship.hp <= 0) {
      ships.splice(i, 1);
      continue;
    }

    const owner = ship.nationId > 0 ? nations[ship.nationId] : undefined;

    // Nếu quốc gia đã bị loại mà tàu vẫn chưa chuyển vô chủ -> chuyển ngay thành tàu vô chủ
    if (ship.nationId > 0 && (!owner || owner.isEliminated)) {
      convertEliminatedNationShipsToDerelict(data, ship.nationId);
      continue;
    }

    // Cơ chế "gỡ kẹt" mỗi giây: tàu không bao giờ được đứng trên ô không phải WATER và không phải Cảng của chính mình
    // (kể cả khi Cảng vừa bị địch chiếm hoặc tàu bị đẩy lên bờ)
    const curGx = Math.round(ship.x);
    const curGy = Math.round(ship.y);
    const curTile = tiles[curGy]?.[curGx];
    const isOnOwnPort = Boolean(
      curTile && ship.nationId > 0 && curTile.building === 'PORT' && curTile.owner === ship.nationId
    );
    if (!curTile || (curTile.terrain !== 'WATER' && !isOnOwnPort)) {
      const safeWater = findNearestWaterTile(tiles, curGx, curGy, 28);
      if (safeWater) {
        ship.x = safeWater.x;
        ship.y = safeWater.y;
      }
      ship.waypoints = undefined;
      ship.waypointIdx = undefined;
      if (ship.nationId > 0) {
        const ownPort = findNearestOwnedOpenPort(tiles, ship.nationId, ship.x, ship.y);
        if (ownPort) {
          ship.homePortX = ownPort.x;
          ship.homePortY = ownPort.y;
          if (ship.order !== 'LANDING' && ship.order !== 'ATTACK') {
            setShipSeaPath(tiles, ship, ownPort.x, ownPort.y, true);
            if (ship.state === 'REPAIRING') ship.state = 'RETREATING';
          }
        }
      }
    }

    // Tàu vô chủ (nationId === 0): chỉ giữ lại đứng chờ Tàu Chiến lại gần chiếm
    if (ship.nationId === 0) {
      ship.derelictTimer = (ship.derelictTimer || 0) + 1;
      ship.state = 'IDLE';
      continue;
    }

    // Kiểm tra cảng gốc còn thuộc phe mình không -> mất cảng thì tìm cảng khác thuộc phe hoặc rút về cảng phe mình
    if (ship.nationId > 0 && typeof ship.homePortX === 'number' && typeof ship.homePortY === 'number') {
      const hpTile = tiles[ship.homePortY]?.[ship.homePortX];
      if (!hpTile || hpTile.owner !== ship.nationId || hpTile.building !== 'PORT') {
        const altPort = findNearestOwnedOpenPort(tiles, ship.nationId, ship.x, ship.y);
        if (altPort) {
          ship.homePortX = altPort.x;
          ship.homePortY = altPort.y;
          // Nếu tàu đang sửa miễn phí ở cảng cũ vừa bị chiếm -> rời cảng bị mất ngay
          if (ship.state === 'REPAIRING' && ship.type === 'WARSHIP') {
            ship.isRepairing = false;
            ship.state = 'RETREATING';
            setShipSeaPath(tiles, ship, altPort.x, altPort.y, true);
          }
        } else {
          ship.homePortX = undefined;
          ship.homePortY = undefined;
        }
      }
    }

    // Tàu đang hoạt động giúp phát hiện Mỏ Dầu Biển ẩn trong tầm nhìn
    const vis = (ship.vision || NAVAL_CONFIG.EXTRACTOR.VISION) + (ship.fleetId ? NAVAL_CONFIG.FLEET.VISION_BONUS : 0);
    if (ship.nationId > 0) {
      for (let dIdx = 0; dIdx < deposits.length; dIdx++) {
        const dt = deposits[dIdx];
        if (!dt || dt.terrain !== 'WATER' || dt.deposit !== 'OIL' || dt.discovered) continue;
        if (Math.hypot(dt.x - ship.x, dt.y - ship.y) <= vis) {
          dt.discovered = true;
          if (ship.nationId === 1) {
            data.particles = data.particles || [];
            data.particles.push({
              x: dt.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: dt.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#38bdf8',
              size: 0,
              life: 45,
              maxLife: 45,
              vx: 0,
              vy: -0.6,
              type: 'FLOAT_TEXT',
              text: '🛢️ Phát hiện Mỏ Dầu Biển!',
            });
          }
        }
      }
    }

    // Logic Tàu Khai Thác (Part 3)
    if (ship.type === 'EXTRACTOR') {
      if (ship.nationId <= 0 || !owner || owner.isEliminated) continue;

      // Đồng bộ scale theo dân số (tốc độ luôn giữ cố định)
      const scale = getShipScaleStats(owner, 'EXTRACTOR') as ReturnType<typeof getShipScaleStats> & {
        oilCapacity: number;
        extractRate: number;
      };
      if (ship.scaleTier !== scale.tier) {
        const ratio = ship.hp / Math.max(1, ship.maxHp);
        ship.scaleTier = scale.tier;
        ship.maxHp = scale.maxHp;
        ship.hp = Math.max(1, Math.round(scale.maxHp * ratio));
        ship.oilCapacity = scale.oilCapacity;
      }

      // Kiểm tra mỏ đang được giao
      let depTile: Tile | undefined =
        typeof ship.assignedDepositX === 'number' && typeof ship.assignedDepositY === 'number'
          ? tiles[ship.assignedDepositY]?.[ship.assignedDepositX]
          : undefined;

      const depositInvalid =
        !depTile ||
        depTile.terrain !== 'WATER' ||
        depTile.deposit !== 'OIL' ||
        !depTile.discovered ||
        (depTile.reserve || 0) <= 0 ||
        !hasSeaOilExtractionRight(data, ship.nationId, depTile.x, depTile.y);

      if (depositInvalid) {
        // Mất vùng kiểm soát biển hoặc mỏ cạn -> bỏ mỏ hiện tại & tìm mỏ khác khả dụng
        ship.assignedDepositX = undefined;
        ship.assignedDepositY = undefined;
        const nextDep = findNearestFreeSeaOilDeposit(data, ship);
        if (nextDep) {
          assignExtractorDeposit(data, ship, nextDep.x, nextDep.y);
        } else {
          ship.state = 'IDLE';
          // Nếu mất quyền kiểm soát biển tại chỗ đứng, lùi về gần cảng nhà nếu có
          if (
            depTile &&
            !hasSeaOilExtractionRight(data, ship.nationId, depTile.x, depTile.y) &&
            typeof ship.homePortX === 'number' &&
            typeof ship.homePortY === 'number' &&
            !ship.waypoints
          ) {
            setShipSeaPath(tiles, ship, ship.homePortX, ship.homePortY);
          }
        }
        continue;
      }

      const distToDep = Math.hypot(ship.x - depTile!.x, ship.y - depTile!.y);
      if (distToDep <= 0.85) {
        ship.waypoints = undefined;
        ship.waypointIdx = undefined;
        ship.state = 'EXTRACTING';

        const ecoLvl = owner.techLevels?.economy || 0;
        const techBoost = 1 + ecoLvl * 0.04;
        const rawRate = scale.extractRate * techBoost * (owner.isPlayer ? 1 : diffMult);
        const got = Math.min(rawRate, depTile!.reserve || 0);
        if (got > 0) {
          depTile!.reserve = Math.max(0, (depTile!.reserve || 0) - got);
          owner.oil = Math.min(RESOURCE_CONFIG.STORAGE_CAP, (owner.oil || 0) + got);
          owner.oilIncome = (owner.oilIncome || 0) + got;
          ship.extractedTotal = (ship.extractedTotal || 0) + got;

          if (depTile!.reserve <= 0) {
            depTile!.reserve = 0;
            depTile!.seaOilRegenTimer = RESOURCE_CONFIG.SEA_OIL_REGEN_SECONDS;
            ship.assignedDepositX = undefined;
            ship.assignedDepositY = undefined;
            ship.state = 'IDLE';
          }
        }
      } else {
        ship.state = 'MOVING';
        if (!ship.waypoints || ship.waypoints.length === 0) {
          setShipSeaPath(tiles, ship, depTile!.x, depTile!.y);
        }
      }
      continue;
    }

    // Logic Tàu Chiến (Part 4, 6, 7)
    if (ship.type === 'WARSHIP') {
      if (ship.nationId <= 0 || !owner || owner.isEliminated) continue;

      // Đồng bộ quy mô dân số (giữ tốc độ cố định)
      const wScale = getShipScaleStats(owner, 'WARSHIP') as ReturnType<typeof getShipScaleStats> & {
        dps: number;
        maxTroopCapacity: number;
      };
      if (ship.scaleTier !== wScale.tier) {
        const ratio = ship.hp / Math.max(1, ship.maxHp);
        ship.scaleTier = wScale.tier;
        ship.maxHp = wScale.maxHp;
        ship.hp = Math.max(1, Math.round(wScale.maxHp * ratio));
        ship.dps = wScale.dps;
        ship.maxTroopCapacity = wScale.maxTroopCapacity;
      }

      // Kiểm tra ngưỡng rút lui < 30% HP
      const lowHp = ship.hp < ship.maxHp * NAVAL_CONFIG.WARSHIP.RETREAT_HP_RATIO;
      if (lowHp && ship.state !== 'RETREATING' && ship.state !== 'REPAIRING') {
        if (ship.order === 'LANDING') {
          ship.order = 'AUTO';
          ship.landingCoastX = undefined;
          ship.landingCoastY = undefined;
          ship.landingTargetX = undefined;
          ship.landingTargetY = undefined;
          if ((ship.carriedTroops || 0) > 0 && ship.nationId === (_callbacks?.playerNationId ?? 1)) {
            _callbacks?.notifyPlayer?.('⚠️ Tàu Chiến hư hại nặng, hủy đổ bộ để rút về cảng (quân vẫn giữ trên tàu).');
          }
        }
        ship.state = 'RETREATING';
        ship.targetShipId = undefined;
        ship.waypoints = undefined;
      }

      // Đang rút lui về cảng gần nhất
      if (ship.state === 'RETREATING') {
        const nearPort = findNearestOwnedOpenPort(tiles, ship.nationId, ship.x, ship.y);
        if (nearPort) {
          const distPort = Math.hypot(nearPort.x - ship.x, nearPort.y - ship.y);
          if (distPort <= 1.8) {
            ship.state = 'REPAIRING';
            ship.isRepairing = true;
            ship.waypoints = undefined;
          } else if (!ship.waypoints || ship.waypoints.length === 0) {
            setShipSeaPath(tiles, ship, nearPort.x, nearPort.y);
          }
        } else {
          // Không có cảng -> chuyển sang sửa trên biển nếu còn vàng
          ship.state = 'REPAIRING';
          ship.isRepairing = true;
          ship.waypoints = undefined;
        }
        continue;
      }

      // Đang sửa chữa: không chiến đấu!
      if (ship.state === 'REPAIRING' || ship.isRepairing) {
        if (ship.hp >= ship.maxHp) {
          ship.hp = ship.maxHp;
          ship.isRepairing = false;
          ship.state = ship.order === 'ESCORT' ? 'ESCORT' : 'PATROL';
          continue;
        }
        const nearPort = findNearestOwnedOpenPort(tiles, ship.nationId, ship.x, ship.y);
        const atPort = Boolean(nearPort && Math.hypot(nearPort.x - ship.x, nearPort.y - ship.y) <= 1.85);
        if (atPort) {
          const heal = Math.max(1, ship.maxHp * NAVAL_CONFIG.WARSHIP.REPAIR_PORT_PCT_PER_SEC);
          ship.hp = Math.min(ship.maxHp, ship.hp + heal);
          if (ship.hp >= ship.maxHp * 0.98) {
            ship.hp = ship.maxHp;
            ship.isRepairing = false;
            ship.state = ship.order === 'ESCORT' ? 'ESCORT' : 'PATROL';
            // Nếu thuộc hạm đội, hội quân lại quanh đồng đội còn khỏe
            if (ship.fleetId) {
              const mate = ships.find((m) => m && m.id !== ship.id && m.hp > 0 && m.nationId === ship.nationId && m.fleetId === ship.fleetId && !m.isRepairing && m.state !== 'RETREATING');
              if (mate) {
                ship.patrolX = Math.round(mate.x);
                ship.patrolY = Math.round(mate.y);
                setShipSeaPath(tiles, ship, mate.x, mate.y);
              }
            }
          }
        } else {
          // Sửa trên biển: 0.5% HP/s, tốn 2 Vàng/HP
          const desiredHeal = Math.min(ship.maxHp - ship.hp, ship.maxHp * NAVAL_CONFIG.WARSHIP.REPAIR_SEA_PCT_PER_SEC);
          const goldCost = Math.ceil(desiredHeal * NAVAL_CONFIG.WARSHIP.REPAIR_SEA_GOLD_PER_HP);
          if (desiredHeal > 0 && owner.gold >= goldCost) {
            owner.gold -= goldCost;
            ship.hp = Math.min(ship.maxHp, ship.hp + desiredHeal);
            if (ship.hp >= ship.maxHp) {
              ship.isRepairing = false;
              ship.state = ship.order === 'ESCORT' ? 'ESCORT' : 'PATROL';
            }
          } else if (owner.gold < goldCost) {
            ship.isRepairing = false;
            ship.state = 'PATROL';
          }
        }
        continue;
      }

      // Tìm mục tiêu tàu địch trong tầm nhìn (NavalShip địch + SeaTradeShip địch)
      const visionRad = (ship.vision || NAVAL_CONFIG.WARSHIP.VISION_TILES) + (ship.fleetId ? NAVAL_CONFIG.FLEET.VISION_BONUS : 0);
      const fireRange = ship.range || NAVAL_CONFIG.WARSHIP.RANGE_TILES;
      let targetNav: NavalShip | null = null;
      let targetNavDist = Infinity;

      // Nếu đang có lệnh ATTACK chỉ định mục tiêu
      if (ship.targetShipId) {
        const pinned = ships.find((s) => s && s.id === ship.targetShipId && s.hp > 0 && isEnemyNavalShip(owner, s));
        if (pinned) {
          targetNav = pinned;
          targetNavDist = Math.hypot(pinned.x - ship.x, pinned.y - ship.y);
        } else {
          ship.targetShipId = undefined;
        }
      }

      if (!targetNav) {
        for (let k = 0; k < ships.length; k++) {
          const cand = ships[k];
          if (!cand || cand.hp <= 0 || !isEnemyNavalShip(owner, cand)) continue;
          const d = Math.hypot(cand.x - ship.x, cand.y - ship.y);
          if (d <= visionRad && d < targetNavDist) {
            targetNav = cand;
            targetNavDist = d;
          }
        }
      }

      let targetTrade: { ship: SeaTradeShip; x: number; y: number; dist: number } | null = null;
      if (!targetNav && Array.isArray(data.tradeShips) && data.tradeShips.length > 0) {
        const routeMap = new Map<string, SeaTradeRoute>();
        if (Array.isArray(data.tradeRoutes)) {
          data.tradeRoutes.forEach((r: SeaTradeRoute) => {
            if (r?.id) routeMap.set(r.id, r);
          });
        }
        for (let ti = 0; ti < data.tradeShips.length; ti++) {
          const ts: SeaTradeShip = data.tradeShips[ti];
          if (!ts || !isEnemyTradeShipForWarship(owner, ts)) continue;
          const pos = getTradeShipPosition(ts, routeMap);
          const d = Math.hypot(pos.x - ship.x, pos.y - ship.y);
          if (d <= visionRad && (!targetTrade || d < targetTrade.dist)) {
            targetTrade = { ship: ts, x: pos.x, y: pos.y, dist: d };
          }
        }
      }

      const warshipDps = Math.round((ship.dps || NAVAL_CONFIG.WARSHIP.DPS) * (owner.isPlayer ? 1 : diffMult));

      if (targetNav) {
        if (targetNavDist <= fireRange) {
          // Bắn Tàu Chiến / Tàu Khai Thác địch (khi đang đổ bộ vẫn vừa đi vừa bắn trong tầm, không dừng lại đuổi xa)
          if (ship.order !== 'LANDING' && ship.order !== 'MOVE') {
            ship.waypoints = undefined;
            ship.state = 'ATTACKING';
          }
          ship.angle = Math.atan2(targetNav.y - ship.y, targetNav.x - ship.x);

          data.particles = data.particles || [];
          data.particles.push({
            x: ship.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: ship.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            targetX: targetNav.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            targetY: targetNav.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#f59e0b',
            size: 2.5,
            life: 12,
            maxLife: 12,
            vx: 0,
            vy: 0,
            type: 'LASER_BEAM',
          });
          damageNavalShip(targetNav, warshipDps, owner, data, undefined, _callbacks?.applyCasualties);
          if (ship.order !== 'LANDING') continue;
        } else if (ship.order !== 'MOVE' && ship.order !== 'LANDING') {
          // Áp sát mục tiêu
          ship.state = 'ATTACKING';
          if (!ship.waypoints || ship.waypoints.length === 0 || (data.gameTimeSeconds % 2 === 0)) {
            setShipSeaPath(tiles, ship, targetNav.x, targetNav.y);
          }
          continue;
        }
      }

      if (targetTrade && ship.order !== 'LANDING') {
        if (targetTrade.dist <= fireRange) {
          ship.waypoints = undefined;
          ship.state = 'ATTACKING';
          ship.angle = Math.atan2(targetTrade.y - ship.y, targetTrade.x - ship.x);
          data.particles = data.particles || [];
          data.particles.push({
            x: ship.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: ship.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            targetX: targetTrade.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            targetY: targetTrade.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#fb923c',
            size: 2,
            life: 10,
            maxLife: 10,
            vx: 0,
            vy: 0,
            type: 'LASER_BEAM',
          });
          const ts = targetTrade.ship;
          const maxHp = ts.maxHp ?? AIR_SYSTEM_CONFIG.SHIP_BASE_HP;
          ts.maxHp = maxHp;
          ts.hp = Math.max(0, (ts.hp ?? maxHp) - warshipDps);
          if (ts.hp <= 0) {
            const bounty = Math.max(10, Math.round((ts.cargoGold || 20) * 0.5));
            owner.gold += bounty;
            data.tradeShips = data.tradeShips.filter((s: SeaTradeShip) => s.id !== ts.id);
            data.particles.push({
              x: targetTrade.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: targetTrade.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#fbbf24',
              size: 0,
              life: 40,
              maxLife: 40,
              vx: 0,
              vy: -0.6,
              type: 'FLOAT_TEXT',
              text: `⚓💥 Bắn chìm tàu thương địch! +${bounty}💰`,
            });
          }
        } else if (ship.order !== 'MOVE') {
          if (!ship.waypoints || ship.waypoints.length === 0 || (data.gameTimeSeconds % 2 === 0)) {
            setShipSeaPath(tiles, ship, targetTrade.x, targetTrade.y);
          }
        }
        continue;
      }

      // Chở quân & Đổ bộ đường biển (Part 6 + Việc 2)
      if (ship.order === 'LANDING' && (ship.carriedTroops || 0) > 0 && typeof ship.landingCoastX === 'number' && typeof ship.landingCoastY === 'number' && typeof ship.landingTargetX === 'number' && typeof ship.landingTargetY === 'number') {
        ship.state = 'TRANSPORTING';
        const distCoast = Math.hypot(ship.landingCoastX - ship.x, ship.landingCoastY - ship.y);
        if (distCoast <= 1.45) {
          const waterSrc = tiles[ship.landingCoastY]?.[ship.landingCoastX];
          let landTgt: Tile | undefined = tiles[ship.landingTargetY]?.[ship.landingTargetX];

          // Nếu ô mục tiêu ban đầu vừa bị chiếm bởi chính mình/đồng minh, tìm ô đất địch/trống lân cận
          if (!landTgt || landTgt.terrain === 'WATER' || landTgt.owner === ship.nationId || (landTgt.owner > 0 && (owner.diplomacy?.[landTgt.owner]?.status === 'ALLIANCE' || owner.diplomacy?.[landTgt.owner]?.status === 'TRUCE'))) {
            let fallback: Tile | undefined;
            const D8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
            for (const [dx, dy] of D8) {
              const cand = tiles[ship.landingCoastY + dy]?.[ship.landingCoastX + dx];
              if (!cand || cand.terrain === 'WATER' || cand.owner === ship.nationId) continue;
              const cDip = cand.owner > 0 ? owner.diplomacy?.[cand.owner]?.status : 'WAR';
              if (cDip !== 'ALLIANCE' && cDip !== 'TRUCE') {
                fallback = cand;
                break;
              }
            }
            landTgt = fallback;
          }

          let landingSucceeded = false;
          if (waterSrc && landTgt && _callbacks?.launchLandingWave) {
            const troopsToLand = ship.carriedTroops || 0;
            ship.state = 'LANDING';
            const launched = _callbacks.launchLandingWave(ship.nationId, landTgt.owner, waterSrc, landTgt, troopsToLand);
            if (launched !== false) {
              landingSucceeded = true;
              ship.carriedTroops = 0;
              data.particles = data.particles || [];
              data.particles.push({
                x: landTgt.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                y: landTgt.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                color: '#38bdf8',
                size: 0,
                life: 45,
                maxLife: 45,
                vx: 0,
                vy: -0.7,
                type: 'FLOAT_TEXT',
                text: `⚓🪖 Đổ bộ ${troopsToLand} quân!`,
              });
            }
          }

          if (!landingSucceeded && ship.nationId === (_callbacks?.playerNationId ?? 1)) {
            _callbacks?.notifyPlayer?.('🏖️ Không thể đổ bộ vào bãi biển đã chọn (Đồng minh/Đình chiến/không hợp lệ) — quân vẫn được giữ trên tàu.');
          }
          ship.patrolX = ship.landingCoastX ?? Math.round(ship.x);
          ship.patrolY = ship.landingCoastY ?? Math.round(ship.y);
          ship.landingCoastX = undefined;
          ship.landingCoastY = undefined;
          ship.landingTargetX = undefined;
          ship.landingTargetY = undefined;
          ship.order = 'AUTO';
          ship.state = landingSucceeded || (ship.carriedTroops || 0) <= 0 ? 'PATROL' : 'IDLE';
          ship.waypoints = undefined;
        } else if (!ship.waypoints || ship.waypoints.length === 0) {
          const okRoute = setShipSeaPath(tiles, ship, ship.landingCoastX, ship.landingCoastY, true);
          if (!okRoute) {
            ship.order = 'AUTO';
            ship.state = 'IDLE';
            ship.landingCoastX = undefined;
            ship.landingCoastY = undefined;
            ship.landingTargetX = undefined;
            ship.landingTargetY = undefined;
            ship.targetX = undefined;
            ship.targetY = undefined;
            if (ship.nationId === (_callbacks?.playerNationId ?? 1)) {
              _callbacks?.notifyPlayer?.('🏖️ Tàu không tìm được đường tới bãi đổ bộ, đã hủy lệnh (quân vẫn trên tàu).');
            }
          }
        }
        continue;
      }

      // Không có địch trong tầm -> thực hiện lệnh Hộ Tống / Di Chuyển / Tuần Tra
      if (ship.order === 'ESCORT' && ship.escortShipId) {
        let ex: number | undefined;
        let ey: number | undefined;
        const friendlyNav = ships.find((s) => s && s.id === ship.escortShipId && s.hp > 0);
        if (friendlyNav) {
          ex = friendlyNav.x;
          ey = friendlyNav.y;
        } else if (Array.isArray(data.tradeShips)) {
          const ts = data.tradeShips.find((s: SeaTradeShip) => s && s.id === ship.escortShipId);
          if (ts) {
            const pos = getTradeShipPosition(ts);
            ex = pos.x;
            ey = pos.y;
          }
        }
        if (typeof ex === 'number' && typeof ey === 'number') {
          ship.state = 'ESCORT';
          if (Math.hypot(ex - ship.x, ey - ship.y) > 2.2 && (!ship.waypoints || ship.waypoints.length === 0 || data.gameTimeSeconds % 2 === 0)) {
            setShipSeaPath(tiles, ship, ex, ey);
          }
        } else {
          ship.order = 'AUTO';
          ship.escortShipId = undefined;
          ship.state = 'PATROL';
        }
        continue;
      }

      if (ship.order === 'MOVE') {
        if (!ship.waypoints || ship.waypoints.length === 0) {
          ship.order = 'PATROL';
          ship.patrolX = Math.round(ship.x);
          ship.patrolY = Math.round(ship.y);
          ship.state = 'PATROL';
        } else {
          ship.state = 'MOVING';
        }
        continue;
      }

      // Chiếm tàu vô chủ (nationId === 0): CHỈ chiếm tàu của nước đã bị loại, tuyệt đối không chiếm tàu nước đang tồn tại!
      if (ship.order !== 'LANDING' && ship.order !== 'ESCORT') {
        let derelictTarget: NavalShip | null = null;
        let derelictDist = Infinity;
        for (let k = 0; k < ships.length; k++) {
          const cand = ships[k];
          if (!cand || cand.hp <= 0 || cand.nationId !== 0) continue;
          const d = Math.hypot(cand.x - ship.x, cand.y - ship.y);
          if (d <= visionRad && d < derelictDist) {
            derelictDist = d;
            derelictTarget = cand;
          }
        }

        if (derelictTarget) {
          if (derelictDist <= NAVAL_CONFIG.WARSHIP.DERELICT_CAPTURE_RANGE) {
            ship.waypoints = undefined;
            ship.captureTargetShipId = derelictTarget.id;
            ship.captureProgress = (ship.captureProgress || 0) + 1;
            derelictTarget.captureProgress = ship.captureProgress;

            if (ship.captureProgress >= NAVAL_CONFIG.WARSHIP.DERELICT_CAPTURE_SECONDS) {
              derelictTarget.nationId = ship.nationId;
              derelictTarget.prevNationId = undefined;
              derelictTarget.derelictTimer = undefined;
              derelictTarget.captureProgress = 0;
              derelictTarget.hp = Math.max(Math.round(derelictTarget.maxHp * 0.6), derelictTarget.hp);
              derelictTarget.speed = derelictTarget.type === 'WARSHIP'
                ? NAVAL_CONFIG.WARSHIP.SPEED_TILES_PER_SEC
                : NAVAL_CONFIG.EXTRACTOR.SPEED_TILES_PER_SEC;
              const homePort = findNearestOwnedOpenPort(tiles, ship.nationId, derelictTarget.x, derelictTarget.y);
              if (homePort) {
                derelictTarget.homePortX = homePort.x;
                derelictTarget.homePortY = homePort.y;
              }
              if (derelictTarget.type === 'WARSHIP') {
                derelictTarget.order = 'AUTO';
                derelictTarget.state = 'PATROL';
                derelictTarget.patrolX = Math.round(derelictTarget.x);
                derelictTarget.patrolY = Math.round(derelictTarget.y);
              } else {
                derelictTarget.state = 'IDLE';
                const freeDep = findNearestFreeSeaOilDeposit(data, derelictTarget);
                if (freeDep) assignExtractorDeposit(data, derelictTarget, freeDep.x, freeDep.y);
              }
              ship.captureProgress = 0;
              ship.captureTargetShipId = undefined;
              data.particles = data.particles || [];
              data.particles.push({
                x: derelictTarget.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                y: derelictTarget.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                color: '#10b981',
                size: 0,
                life: 48,
                maxLife: 48,
                vx: 0,
                vy: -0.7,
                type: 'FLOAT_TEXT',
                text: `⚓🏴 Đã chiếm tàu vô chủ (${derelictTarget.type === 'WARSHIP' ? 'Tàu Chiến' : 'Tàu Khai Thác'})!`,
              });
            }
            continue;
          } else if (ship.order === 'AUTO' || ship.order === 'PATROL') {
            if (!ship.waypoints || ship.waypoints.length === 0 || (data.gameTimeSeconds % 2 === 0)) {
              setShipSeaPath(tiles, ship, derelictTarget.x, derelictTarget.y);
            }
            ship.state = 'MOVING';
            continue;
          }
        } else if (ship.captureProgress && ship.captureProgress > 0) {
          ship.captureProgress = 0;
          ship.captureTargetShipId = undefined;
        }
      }

      // Hỗ trợ đồng đội trong cùng Hạm Đội nếu có tàu cùng hạm đội đang giao chiến gần đó
      if (ship.fleetId && (ship.order === 'AUTO' || ship.order === 'PATROL')) {
        const fightingMate = ships.find(
          (m) => m && m.id !== ship.id && m.hp > 0 && m.nationId === ship.nationId && m.fleetId === ship.fleetId && m.state === 'ATTACKING' && Math.hypot(m.x - ship.x, m.y - ship.y) <= 18
        );
        if (fightingMate) {
          if (!ship.waypoints || ship.waypoints.length === 0 || (data.gameTimeSeconds % 2 === 0)) {
            setShipSeaPath(tiles, ship, fightingMate.x, fightingMate.y);
          }
          ship.state = 'MOVING';
          continue;
        }
      }

      // Tuần tra quanh điểm patrol hoặc cảng nhà
      ship.state = 'PATROL';
      const anchorX = ship.patrolX ?? ship.homePortX ?? Math.round(ship.x);
      const anchorY = ship.patrolY ?? ship.homePortY ?? Math.round(ship.y);
      if ((!ship.waypoints || ship.waypoints.length === 0) && data.gameTimeSeconds % 4 === 0) {
        // Chọn điểm nước lân cận trong bán kính 5 ô quanh mỏ neo tuần tra
        for (let attempt = 0; attempt < 6; attempt++) {
          const ox = Math.round(anchorX + (Math.random() - 0.5) * 9);
          const oy = Math.round(anchorY + (Math.random() - 0.5) * 9);
          if (tiles[oy]?.[ox]?.terrain === 'WATER' && Math.hypot(ox - ship.x, oy - ship.y) >= 2) {
            if (setShipSeaPath(tiles, ship, ox, oy)) break;
          }
        }
      }
    }
  }
}

export function autoExecuteOverseasAttack(
  data: any,
  nationId: number,
  targetLandX: number,
  targetLandY: number,
  onNotify?: (msg: string) => void
): boolean {
  if (!data || nationId <= 0) return false;
  const tiles: Tile[][] = data.tiles || [];
  const nations: Nation[] = data.nations || [];
  const nation = nations[nationId];
  const tx = Math.round(targetLandX);
  const ty = Math.round(targetLandY);
  const tgtTile = tiles[ty]?.[tx];
  if (!tgtTile || !nation || nation.isEliminated || tgtTile.terrain === 'WATER' || tgtTile.owner === nationId) {
    onNotify?.('Mục tiêu tấn công qua biển không hợp lệ.');
    return false;
  }
  if (tgtTile.owner > 0) {
    const dip = nation.diplomacy?.[tgtTile.owner]?.status;
    if (dip === 'ALLIANCE' || dip === 'TRUCE') {
      onNotify?.('Không thể tấn công Đồng Minh hoặc đang Đình Chiến.');
      return false;
    }
  }

  const ships: NavalShip[] = data.navalShips || [];
  let bestShip: NavalShip | null = null;
  let bestDist = Infinity;

  for (const s of ships) {
    if (!s || s.hp <= 0 || s.type !== 'WARSHIP' || s.nationId !== nationId) continue;
    if (s.order === 'LANDING' || s.state === 'TRANSPORTING' || s.order === 'ATTACK') continue;

    const approach = findLandingApproach(tiles, s.x, s.y, tx, ty, nation);
    if (!approach) continue;

    const dist = Math.hypot(s.x - tx, s.y - ty);
    if (dist < bestDist) {
      bestDist = dist;
      bestShip = s;
    }
  }

  if (!bestShip) {
    onNotify?.('Không có Tàu Chiến rảnh hoặc không tìm được đường biển đến mục tiêu.');
    return false;
  }

  if ((bestShip.carriedTroops || 0) <= 0) {
    if (isShipNearOwnedCoast(tiles, nationId, bestShip.x, bestShip.y, 2.8)) {
      const loadRes = loadTroopsOnWarship(data, bestShip);
      if (!loadRes.ok) {
        onNotify?.(loadRes.reason);
        return false;
      }
    } else {
      const nearestPort = findNearestOwnedOpenPort(tiles, nationId, bestShip.x, bestShip.y);
      if (nearestPort) {
        issueWarshipOrder(data, bestShip, 'MOVE', { x: nearestPort.x, y: nearestPort.y });
        onNotify?.('🚢 Tàu Chiến đang tự động di chuyển về cảng để nạp quân.');
        return false;
      } else {
        onNotify?.('Tàu Chiến cần ở gần Cảng hoặc bờ biển phe mình để nạp quân.');
        return false;
      }
    }
  }

  if ((bestShip.carriedTroops || 0) <= 0) {
    onNotify?.('Không đủ quân hoặc không thể nạp quân lên tàu.');
    return false;
  }

  const res = orderAmphibiousLanding(data, bestShip, tx, ty, true);
  onNotify?.(res.reason);
  return res.ok;
}
