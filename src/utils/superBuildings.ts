import { BuildingType, Nation, SuperBuildingState, SuperBuildingType, Tile } from '../types';
import { BUILDING_INFO } from '../data/gameData';
import { getSupremeFortressStats } from './supremeTech';

export const SUPER_BUILDING_TYPES: SuperBuildingType[] = [
  'SUPREME_FORTRESS',
  'GRAND_ACADEMY',
  'GRAND_ARSENAL',
];

export const SUPER_BUILDING_CONFIG = {
  BUILD_TIME_SECONDS: 60,
  MAX_PER_TYPE: 1,
  MAX_TOTAL_PER_NATION: 2,
  MAX_HP: 100,
  DAMAGED_THRESHOLD: 80, // < 80 HP chuyển sang trạng thái hư hại
  FORTRESS_RADIUS: 8,
  FORTRESS_MISSILE_REDUCTION_ACTIVE: 0.80,
  FORTRESS_MISSILE_REDUCTION_DAMAGED: 0.30,
  ACADEMY_SPEED_ACTIVE: 2.0,
  ACADEMY_SPEED_DAMAGED: 1.25,
  ARSENAL_REGEN_BONUS_ACTIVE: 0.40,
  ARSENAL_REGEN_BONUS_DAMAGED: 0.15,
  ARSENAL_MAX_TROOP_BONUS_ACTIVE: 0.25,
  ARSENAL_MAX_TROOP_BONUS_DAMAGED: 0.10,
  HARD_MAX_TROOPS_CAP: 250_000,
  HARD_MAX_TROOP_REGEN_CAP: 12_000,
};

export function isSuperBuilding(b?: BuildingType | string | null): b is SuperBuildingType {
  return b === 'SUPREME_FORTRESS' || b === 'GRAND_ACADEMY' || b === 'GRAND_ARSENAL';
}

export function createEmptyBuildingCounts(): Record<BuildingType, number> {
  return {
    NONE: 0,
    CITY: 0,
    BARRACKS: 0,
    FORTRESS: 0,
    PORT: 0,
    MISSILE_SILO: 0,
    AIR_DEFENSE: 0,
    LASER: 0,
    OIL_RIG: 0,
    MINE: 0,
    BUNKER: 0,
    SUPREME_FORTRESS: 0,
    GRAND_ACADEMY: 0,
    GRAND_ARSENAL: 0,
  };
}

/**
 * Điều kiện mở khóa: đã nghiên cứu xong cấp 3 của cả 3 nhánh công nghệ hiện có.
 */
export function hasUnlockedSuperBuildings(nation?: Nation | null): boolean {
  if (!nation || !nation.techLevels) return false;
  return (
    (nation.techLevels.economy || 0) >= 3 &&
    (nation.techLevels.military || 0) >= 3 &&
    (nation.techLevels.defense || 0) >= 3
  );
}

export function getSuperBuildingState(tile: Tile): SuperBuildingState {
  if (tile.superState === 'BUILDING' || tile.superState === 'REPAIRING') {
    return tile.superState;
  }
  const hp = tile.superHp ?? SUPER_BUILDING_CONFIG.MAX_HP;
  if (tile.superState === 'DAMAGED' || hp < SUPER_BUILDING_CONFIG.DAMAGED_THRESHOLD) {
    return 'DAMAGED';
  }
  return 'ACTIVE';
}

export function getSuperBuildingStateLabel(tile: Tile): string {
  const st = getSuperBuildingState(tile);
  const left = Math.max(0, Math.ceil(tile.superBuildTimeLeft || 0));
  const hp = Math.round(tile.superHp ?? SUPER_BUILDING_CONFIG.MAX_HP);
  switch (st) {
    case 'BUILDING':
      return `🏗️ Đang xây (${left}s)`;
    case 'REPAIRING':
      return `🔧 Đang sửa (${left}s)`;
    case 'DAMAGED':
      return `⚠️ Hư hại (${hp}%)`;
    case 'ACTIVE':
      return `✨ Hoạt động (${hp}%)`;
  }
}

export function countSuperBuildingsFromCounts(counts?: Partial<Record<BuildingType, number>> | null): number {
  if (!counts) return 0;
  return (
    (counts.SUPREME_FORTRESS ? 1 : 0) +
    (counts.GRAND_ACADEMY ? 1 : 0) +
    (counts.GRAND_ARSENAL ? 1 : 0)
  );
}

export function countNationSuperBuildings(
  tiles: Tile[][],
  nationId: number,
  excludeTile?: Tile | null
): {
  total: number;
  byType: Record<SuperBuildingType, number>;
  list: Tile[];
} {
  const byType: Record<SuperBuildingType, number> = {
    SUPREME_FORTRESS: 0,
    GRAND_ACADEMY: 0,
    GRAND_ARSENAL: 0,
  };
  const list: Tile[] = [];
  if (!tiles || nationId <= 0) return { total: 0, byType, list };

  const size = tiles.length;
  for (let y = 0; y < size; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const t = row[x];
      if (!t || t === excludeTile) continue;
      if (t.owner === nationId && isSuperBuilding(t.building)) {
        byType[t.building] = (byType[t.building] || 0) + 1;
        list.push(t);
      }
    }
  }

  return { total: list.length, byType, list };
}

export function canBuildSuperBuilding(
  nation: Nation | null | undefined,
  type: SuperBuildingType,
  counts: Partial<Record<BuildingType, number>>
): { ok: boolean; reason?: string } {
  if (!nation || !hasUnlockedSuperBuildings(nation)) {
    return { ok: false, reason: 'Chưa mở khóa cấp 3 cả 3 nhánh công nghệ.' };
  }
  if ((counts[type] || 0) >= SUPER_BUILDING_CONFIG.MAX_PER_TYPE) {
    return { ok: false, reason: 'Mỗi loại Siêu Công Trình chỉ được xây tối đa 1.' };
  }
  const totalSuper =
    (counts.SUPREME_FORTRESS || 0) +
    (counts.GRAND_ACADEMY || 0) +
    (counts.GRAND_ARSENAL || 0);
  if (totalSuper >= SUPER_BUILDING_CONFIG.MAX_TOTAL_PER_NATION) {
    return { ok: false, reason: `Mỗi nước chỉ được sở hữu tối đa ${SUPER_BUILDING_CONFIG.MAX_TOTAL_PER_NATION} Siêu Công Trình.` };
  }
  const cost = BUILDING_INFO[type].baseCost;
  if ((nation.gold || 0) < cost) {
    return { ok: false, reason: `Cần ${cost.toLocaleString()} Vàng.` };
  }
  return { ok: true };
}

export function initSuperBuildingOnTile(tile: Tile, type: SuperBuildingType): void {
  tile.building = type;
  tile.buildingLevel = 1;
  tile.inactiveTimer = 0;
  tile.superState = 'BUILDING';
  tile.superBuildTimeLeft = SUPER_BUILDING_CONFIG.BUILD_TIME_SECONDS;
  tile.superBuildTotal = SUPER_BUILDING_CONFIG.BUILD_TIME_SECONDS;
  tile.superHp = SUPER_BUILDING_CONFIG.MAX_HP;
  tile.superMaxHp = SUPER_BUILDING_CONFIG.MAX_HP;
}

export function clearSuperBuildingFromTile(tile: Tile): void {
  if (isSuperBuilding(tile.building)) {
    tile.building = 'NONE';
    tile.buildingLevel = 1;
  }
  tile.superState = undefined;
  tile.superBuildTimeLeft = undefined;
  tile.superBuildTotal = undefined;
  tile.superHp = undefined;
  tile.superMaxHp = undefined;
}

export function getSuperRepairInfo(tile: Tile): { goldCost: number; durationSec: number } {
  if (!isSuperBuilding(tile.building)) return { goldCost: 0, durationSec: 0 };
  const maxHp = tile.superMaxHp ?? SUPER_BUILDING_CONFIG.MAX_HP;
  const hp = Math.max(0, Math.min(maxHp, tile.superHp ?? maxHp));
  const missing = Math.max(0, maxHp - hp);
  if (missing <= 0) return { goldCost: 0, durationSec: 0 };
  return {
    goldCost: Math.max(500, Math.round(missing * 120)),
    durationSec: Math.max(10, Math.ceil(missing * 0.3)),
  };
}

export function startSuperRepair(
  tile: Tile,
  nation: Nation
): { ok: boolean; message: string; goldCost: number; durationSec: number } {
  if (!isSuperBuilding(tile.building) || tile.owner !== nation.id) {
    return { ok: false, message: 'Không thể sửa công trình này.', goldCost: 0, durationSec: 0 };
  }
  const st = getSuperBuildingState(tile);
  if (st !== 'DAMAGED') {
    return { ok: false, message: 'Siêu công trình không ở trạng thái hư hại.', goldCost: 0, durationSec: 0 };
  }
  const { goldCost, durationSec } = getSuperRepairInfo(tile);
  if ((nation.gold || 0) < goldCost) {
    return { ok: false, message: `Thiếu ${Math.ceil(goldCost - (nation.gold || 0))} Vàng để sửa chữa.`, goldCost, durationSec };
  }
  nation.gold -= goldCost;
  tile.superState = 'REPAIRING';
  tile.superBuildTimeLeft = durationSec;
  tile.superBuildTotal = durationSec;
  return {
    ok: true,
    message: `🔧 Đang sửa ${BUILDING_INFO[tile.building].name} (${durationSec}s)...`,
    goldCost,
    durationSec,
  };
}

/**
 * Gây sát thương lên Siêu Công Trình. Nếu HP <= 0 thì bị phá hủy hoàn toàn (biến mất).
 */
export function damageSuperBuilding(tile: Tile, damage: number): 'NONE' | 'DAMAGED' | 'DESTROYED' {
  if (!isSuperBuilding(tile.building)) return 'NONE';
  const maxHp = tile.superMaxHp ?? SUPER_BUILDING_CONFIG.MAX_HP;
  const curHp = tile.superHp ?? maxHp;
  const nextHp = Math.max(0, Math.round(curHp - damage));

  if (nextHp <= 0) {
    clearSuperBuildingFromTile(tile);
    return 'DESTROYED';
  }

  tile.superHp = nextHp;
  tile.superMaxHp = maxHp;
  if (tile.superState === 'REPAIRING') {
    tile.superState = 'DAMAGED';
    tile.superBuildTimeLeft = 0;
    tile.superBuildTotal = 0;
  } else if (tile.superState !== 'BUILDING' && nextHp < SUPER_BUILDING_CONFIG.DAMAGED_THRESHOLD) {
    tile.superState = 'DAMAGED';
  }
  return getSuperBuildingState(tile) === 'DAMAGED' ? 'DAMAGED' : 'NONE';
}

/**
 * Xử lý khi ô đất chứa Siêu Công Trình bị chiếm bởi phe mới.
 * - Nếu chủ mới chưa vượt giới hạn (<= 1 cùng loại, <= 2 tổng cộng): chuyển quyền sở hữu & hiệu ứng thuộc chủ mới.
 * - Nếu chủ mới đã đạt giới hạn: công trình sụp đổ (biến mất).
 */
export function handleSuperBuildingCapture(
  tile: Tile,
  newOwnerId: number,
  tiles: Tile[][],
  combatDamage: number = 15
): 'TRANSFERRED' | 'DESTROYED_LIMIT' | 'DESTROYED_HP' {
  if (!isSuperBuilding(tile.building)) return 'DESTROYED_HP';
  if (newOwnerId <= 0) {
    clearSuperBuildingFromTile(tile);
    return 'DESTROYED_HP';
  }

  const owned = countNationSuperBuildings(tiles, newOwnerId, tile);
  if (
    owned.byType[tile.building] >= SUPER_BUILDING_CONFIG.MAX_PER_TYPE ||
    owned.total >= SUPER_BUILDING_CONFIG.MAX_TOTAL_PER_NATION
  ) {
    clearSuperBuildingFromTile(tile);
    return 'DESTROYED_LIMIT';
  }

  tile.owner = newOwnerId;
  tile.inactiveTimer = 0;
  tile.buildingLevel = 1;

  if (tile.superState === 'BUILDING') {
    return 'TRANSFERRED';
  }

  if (combatDamage > 0) {
    const res = damageSuperBuilding(tile, combatDamage);
    if (res === 'DESTROYED') return 'DESTROYED_HP';
  }
  if (tile.superState === 'REPAIRING') {
    tile.superState = (tile.superHp ?? 100) < SUPER_BUILDING_CONFIG.DAMAGED_THRESHOLD ? 'DAMAGED' : 'ACTIVE';
    tile.superBuildTimeLeft = 0;
    tile.superBuildTotal = 0;
  }
  return 'TRANSFERRED';
}

/**
 * Tính mức giảm sát thương tên lửa (0..0.80 hoặc 0..0.90 khi nâng cấp Phòng Thủ Tối Thượng 2) tại tọa độ (tx, ty) cho quốc gia ownerId.
 * Không cộng dồn: lấy mức bảo vệ cao nhất từ 1 Pháo Đài Tối Thượng trong bán kính hiệu lực (8 hoặc 11 ô).
 */
export function getSuperMissileProtectionForTile(
  tiles: Tile[][],
  tx: number,
  ty: number,
  ownerId: number,
  ownerNation?: Nation | null
): number {
  if (!tiles || ownerId <= 0) return 0;
  const size = tiles.length;
  const stats = getSupremeFortressStats(ownerNation);
  const R = stats.radius;
  let bestReduction = 0;

  for (let dy = -R; dy <= R; dy++) {
    const yy = ty + dy;
    if (yy < 0 || yy >= size) continue;
    const row = tiles[yy];
    for (let dx = -R; dx <= R; dx++) {
      const xx = tx + dx;
      if (xx < 0 || xx >= size) continue;
      if (dx * dx + dy * dy > R * R) continue;
      const ft = row[xx];
      if (ft && ft.owner === ownerId && ft.building === 'SUPREME_FORTRESS' && !(ft.inactiveTimer && ft.inactiveTimer > 0)) {
        const st = getSuperBuildingState(ft);
        if (st === 'ACTIVE') {
          return stats.activeReduction;
        }
        if (st === 'DAMAGED') {
          bestReduction = Math.max(bestReduction, stats.damagedReduction);
        }
      }
    }
  }
  return bestReduction;
}

/**
 * Hệ số tốc độ nghiên cứu của Đại Học Viện cho 1 quốc gia (không cộng dồn).
 */
export function getAcademyResearchSpeedMult(tiles: Tile[][], nationId: number): number {
  if (!tiles || nationId <= 0) return 1.0;
  const size = tiles.length;
  let best = 1.0;
  for (let y = 0; y < size; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const t = row[x];
      if (t && t.owner === nationId && t.building === 'GRAND_ACADEMY' && !(t.inactiveTimer && t.inactiveTimer > 0)) {
        const st = getSuperBuildingState(t);
        if (st === 'ACTIVE') return SUPER_BUILDING_CONFIG.ACADEMY_SPEED_ACTIVE;
        if (st === 'DAMAGED') best = Math.max(best, SUPER_BUILDING_CONFIG.ACADEMY_SPEED_DAMAGED);
      }
    }
  }
  return best;
}

/**
 * Hệ số Đại Công Xưởng từ trạng thái thu thập được (không cộng dồn).
 */
export function getArsenalBonusesFromState(state: 'ACTIVE' | 'DAMAGED' | null): {
  regenMult: number;
  maxTroopsMult: number;
} {
  if (state === 'ACTIVE') {
    return {
      regenMult: 1 + SUPER_BUILDING_CONFIG.ARSENAL_REGEN_BONUS_ACTIVE,
      maxTroopsMult: 1 + SUPER_BUILDING_CONFIG.ARSENAL_MAX_TROOP_BONUS_ACTIVE,
    };
  }
  if (state === 'DAMAGED') {
    return {
      regenMult: 1 + SUPER_BUILDING_CONFIG.ARSENAL_REGEN_BONUS_DAMAGED,
      maxTroopsMult: 1 + SUPER_BUILDING_CONFIG.ARSENAL_MAX_TROOP_BONUS_DAMAGED,
    };
  }
  return { regenMult: 1.0, maxTroopsMult: 1.0 };
}
