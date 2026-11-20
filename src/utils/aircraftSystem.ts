import {
  AirUnit,
  AirUnitState,
  AirUnitType,
  AttackWave,
  DarkTitan,
  GameEvent,
  Nation,
  SeaTradeRoute,
  SeaTradeShip,
  NavalShip,
  Tile,
} from '../types';
import { AIR_SYSTEM_CONFIG, AIR_UNIT_SPECS, BUILDING_INFO } from '../data/gameData';
import { TILE_PIXEL_SIZE, formatGameTime } from './constants';
import { damageSuperBuilding, isSuperBuilding } from './superBuildings';
import { getSupremeBranchLevel } from './supremeTech';
import { damageDarkTitan } from './titanCombat';
import { getTradeShipPosition } from './seaPathfinding';
import { damageNavalShip, isEnemyNavalShip } from './navalSystem';
import { soundManager } from './audio';

export interface AirBaseLocation {
  x: number;
  y: number;
}

export interface AirSamLocation {
  x: number;
  y: number;
  nationId: number;
}

export interface CachedAirContext {
  basesByNation: Map<number, AirBaseLocation[]>;
  sams: AirSamLocation[];
  arsenalReadyByNation: Map<number, boolean>;
  arsenalExistsByNation: Map<number, boolean>;
}

export interface AirTickCallbacks {
  applyCasualties: (nation: Nation | undefined, loss: number) => void;
  markTerritoryDirty: () => void;
  playAttackSound?: () => void;
  playExplosionSound?: () => void;
  localHudNationId?: number;
}

export function isAirBaseBuilding(building?: string | null): boolean {
  return (
    building === 'SUPREME_FORTRESS' ||
    building === 'GRAND_ACADEMY' ||
    building === 'GRAND_ARSENAL' ||
    building === 'PORT'
  );
}

export function isValidAirBaseTile(tile: Tile | undefined | null, nationId: number): boolean {
  if (!tile || tile.owner !== nationId || !isAirBaseBuilding(tile.building)) return false;
  if (tile.inactiveTimer && tile.inactiveTimer > 0) return false;
  if (isSuperBuilding(tile.building) && tile.superState === 'BUILDING') return false;
  return true;
}

export function canUseAirType1(nation?: Nation | null): boolean {
  return getSupremeBranchLevel(nation, 'military') >= 3;
}

export function canUseAirType23(nation?: Nation | null): boolean {
  return Boolean(nation?.airAdvancedUnlocked) && canUseAirType1(nation);
}

export function canUseAirType(nation: Nation | null | undefined, type: AirUnitType): boolean {
  if (!nation || nation.isEliminated) return false;
  return type === 'FIGHTER' ? canUseAirType1(nation) : canUseAirType23(nation);
}

export function hasAnyAirUnlocked(nation?: Nation | null): boolean {
  return canUseAirType1(nation) || canUseAirType23(nation);
}

export function ensureNationAirFields(nation?: Nation | null): void {
  if (!nation) return;
  if (typeof nation.airSorties !== 'number' || !Number.isFinite(nation.airSorties)) {
    nation.airSorties = AIR_SYSTEM_CONFIG.MAX_SORTIES;
  }
  nation.airSorties = Math.max(0, Math.min(AIR_SYSTEM_CONFIG.MAX_SORTIES, Math.floor(nation.airSorties)));
  if (typeof nation.airSortieRegenTimer !== 'number' || !Number.isFinite(nation.airSortieRegenTimer)) {
    nation.airSortieRegenTimer = 0;
  }
  if (typeof nation.grandArsenalTimer !== 'number' || !Number.isFinite(nation.grandArsenalTimer)) {
    nation.grandArsenalTimer = 0;
  }
  if (typeof nation.grandArsenalDestroyed !== 'boolean') {
    nation.grandArsenalDestroyed = false;
  }
  if (typeof nation.airAdvancedUnlocked !== 'boolean') {
    nation.airAdvancedUnlocked = false;
  }
}

export interface GrandArsenalCountdownState {
  show: boolean;
  remainingSeconds: number;
  destroyed: boolean;
}

export function getGrandArsenalCountdownState(
  nation?: Nation | null,
  hasArsenalReady?: boolean
): GrandArsenalCountdownState {
  if (!nation || nation.airAdvancedUnlocked || canUseAirType23(nation)) {
    return { show: false, remainingSeconds: 0, destroyed: false };
  }
  if (nation.grandArsenalDestroyed) {
    return { show: true, remainingSeconds: 0, destroyed: true };
  }
  const timer = Math.max(0, nation.grandArsenalTimer || 0);
  if (timer > 0 || hasArsenalReady) {
    const remainingSeconds = Math.max(0, AIR_SYSTEM_CONFIG.GRAND_ARSENAL_UNLOCK_SECONDS - timer);
    return { show: true, remainingSeconds, destroyed: false };
  }
  return { show: false, remainingSeconds: 0, destroyed: false };
}

export function getAirTechBonuses(nation?: Nation | null): {
  dmgMult: number;
  hpMult: number;
  speedMult: number;
} {
  const sup = nation?.supremeTechLevels;
  const mil = Math.max(0, Math.min(3, sup?.military || 0));
  const def = Math.max(0, Math.min(3, sup?.defense || 0));
  const eco = Math.max(0, Math.min(3, sup?.economy || 0));
  return {
    dmgMult: 1 + mil * 0.15,
    hpMult: 1 + def * 0.15,
    speedMult: 1 + eco * 0.10,
  };
}

export function getAirProduceCost(
  type: AirUnitType,
  resourcesEnabled: boolean = true
): { goldCost: number; oilCost: number; troopCost: number; planesPerUnit: number } {
  const spec = AIR_UNIT_SPECS[type];
  return {
    goldCost: spec.goldCost,
    oilCost: resourcesEnabled ? spec.oilCost : 0,
    troopCost: spec.troopCost,
    planesPerUnit: spec.planesPerUnit,
  };
}

export function isFlyingAirState(state?: AirUnitState): boolean {
  return state === 'EN_ROUTE' || state === 'COMBAT' || state === 'PATROL' || state === 'RETURNING';
}

export function countFlyingAirUnits(airUnits?: AirUnit[] | null): number {
  if (!Array.isArray(airUnits)) return 0;
  let count = 0;
  for (let i = 0; i < airUnits.length; i++) {
    if (airUnits[i] && isFlyingAirState(airUnits[i].state)) count++;
  }
  return count;
}

export function getNationUsedAirTroops(airUnits: AirUnit[] | undefined | null, nationId: number): number {
  if (!Array.isArray(airUnits) || nationId <= 0) return 0;
  let total = 0;
  for (let i = 0; i < airUnits.length; i++) {
    const u = airUnits[i];
    if (u && u.nationId === nationId) total += u.troopCost || 0;
  }
  return total;
}

export interface NationAirSummary {
  ownedPlanes: number;
  usedTroops: number;
  flyingGlobal: number;
  fighterReady: number;
  fighterRecovering: number;
  fighterFlying: number;
  squadronReady: number;
  squadronRecovering: number;
  squadronFlying: number;
  bomberReady: number;
  bomberRecovering: number;
  bomberFlying: number;
}

export function getNationAirSummary(airUnits: AirUnit[] | undefined | null, nationId: number): NationAirSummary {
  const summary: NationAirSummary = {
    ownedPlanes: 0,
    usedTroops: 0,
    flyingGlobal: 0,
    fighterReady: 0,
    fighterRecovering: 0,
    fighterFlying: 0,
    squadronReady: 0,
    squadronRecovering: 0,
    squadronFlying: 0,
    bomberReady: 0,
    bomberRecovering: 0,
    bomberFlying: 0,
  };
  if (!Array.isArray(airUnits)) return summary;

  const readySq = new Set<string>();
  const recoveringSq = new Set<string>();
  const flyingSq = new Set<string>();

  for (let i = 0; i < airUnits.length; i++) {
    const u = airUnits[i];
    if (!u) continue;
    if (isFlyingAirState(u.state)) summary.flyingGlobal++;
    if (u.nationId !== nationId) continue;

    summary.ownedPlanes++;
    summary.usedTroops += u.troopCost || 0;

    if (u.type === 'FIGHTER') {
      if (u.state === 'HANGAR') summary.fighterReady++;
      else if (u.state === 'RECOVERING') summary.fighterRecovering++;
      else summary.fighterFlying++;
    } else if (u.type === 'BOMBER') {
      if (u.state === 'HANGAR') summary.bomberReady++;
      else if (u.state === 'RECOVERING') summary.bomberRecovering++;
      else summary.bomberFlying++;
    } else if (u.type === 'SQUADRON') {
      const sqKey = u.squadronId || u.id;
      if (u.state === 'HANGAR') readySq.add(sqKey);
      else if (u.state === 'RECOVERING') recoveringSq.add(sqKey);
      else flyingSq.add(sqKey);
    }
  }

  summary.squadronReady = readySq.size;
  summary.squadronRecovering = recoveringSq.size;
  summary.squadronFlying = flyingSq.size;
  return summary;
}

export function findNearestAirBase(
  basesByNation: Map<number, AirBaseLocation[]>,
  nationId: number,
  x: number,
  y: number
): AirBaseLocation | null {
  const list = basesByNation.get(nationId);
  if (!list || list.length === 0) return null;
  let best = list[0];
  let bestDistSq = (best.x - x) ** 2 + (best.y - y) ** 2;
  for (let i = 1; i < list.length; i++) {
    const b = list[i];
    const dSq = (b.x - x) ** 2 + (b.y - y) ** 2;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = b;
    }
  }
  return best;
}

export function canProduceAirUnit(
  nation: Nation | null | undefined,
  airUnits: AirUnit[] | undefined | null,
  type: AirUnitType,
  resourcesEnabled: boolean = true
): { ok: boolean; reason?: string } {
  if (!nation || nation.isEliminated) return { ok: false, reason: 'Quốc gia không hợp lệ.' };
  if (!canUseAirType(nation, type)) {
    return {
      ok: false,
      reason:
        type === 'FIGHTER'
          ? 'Cần Quân Sự Tối Thượng Cấp 3 để mở khóa!'
          : 'Cần Đại Công Xưởng tồn tại đủ 60 giây và Quân Sự Tối Thượng Cấp 3 để mở khóa!',
    };
  }
  const summary = getNationAirSummary(airUnits, nation.id);
  const cost = getAirProduceCost(type, resourcesEnabled);
  if (summary.ownedPlanes + cost.planesPerUnit > AIR_SYSTEM_CONFIG.MAX_OWNED_PER_NATION) {
    return {
      ok: false,
      reason: `Kho chứa đã đạt tối đa ${AIR_SYSTEM_CONFIG.MAX_OWNED_PER_NATION} máy bay!`,
    };
  }
  const maxCommitTroops = Math.floor((nation.troops || 0) * AIR_SYSTEM_CONFIG.TROOP_COMMIT_MAX_RATIO);
  if (nation.troops < cost.troopCost || summary.usedTroops + cost.troopCost > maxCommitTroops) {
    const reqTotalTroops = Math.ceil((summary.usedTroops + cost.troopCost) / AIR_SYSTEM_CONFIG.TROOP_COMMIT_MAX_RATIO);
    return {
      ok: false,
      reason: `Thiếu quân số biên chế không quân (cần tối thiểu ${reqTotalTroops} quân)!`,
    };
  }
  if (nation.gold < cost.goldCost) {
    return { ok: false, reason: `Thiếu ${Math.ceil(cost.goldCost - nation.gold)} Vàng!` };
  }
  if (resourcesEnabled && (nation.oil || 0) < cost.oilCost) {
    return { ok: false, reason: `Thiếu ${Math.ceil(cost.oilCost - (nation.oil || 0))} Dầu!` };
  }
  return { ok: true };
}

export function produceAirUnit(
  nation: Nation,
  airUnits: AirUnit[],
  type: AirUnitType,
  basesByNation: Map<number, AirBaseLocation[]>,
  resourcesEnabled: boolean = true
): { ok: boolean; message: string; created: AirUnit[] } {
  ensureNationAirFields(nation);
  const chk = canProduceAirUnit(nation, airUnits, type, resourcesEnabled);
  if (!chk.ok) {
    return { ok: false, message: chk.reason || 'Không thể sản xuất máy bay.', created: [] };
  }

  const cost = getAirProduceCost(type, resourcesEnabled);
  nation.gold = Math.max(0, nation.gold - cost.goldCost);
  if (resourcesEnabled && cost.oilCost > 0) {
    nation.oil = Math.max(0, (nation.oil || 0) - cost.oilCost);
  }

  const spec = AIR_UNIT_SPECS[type];
  const bonuses = getAirTechBonuses(nation);
  const maxHp = Math.round(spec.hp * bonuses.hpMult);
  const spawnBase = findNearestAirBase(basesByNation, nation.id, nation.capitalX, nation.capitalY) || {
    x: nation.capitalX,
    y: nation.capitalY,
  };

  const created: AirUnit[] = [];
  if (type === 'SQUADRON') {
    const sqId = `sq_${nation.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    for (let m = 0; m < 3; m++) {
      const unit: AirUnit = {
        id: `${sqId}_${m}`,
        nationId: nation.id,
        type: 'SQUADRON',
        state: 'HANGAR',
        squadronId: sqId,
        memberIndex: m,
        x: spawnBase.x,
        y: spawnBase.y,
        hp: maxHp,
        maxHp,
        troopCost: AIR_UNIT_SPECS.SQUADRON.troopCostPerPlane,
        salvosLeft: spec.salvosPerSortie,
        maxSalvos: spec.salvosPerSortie,
        attackCooldown: 0,
        baseX: spawnBase.x,
        baseY: spawnBase.y,
      };
      airUnits.push(unit);
      created.push(unit);
    }
  } else {
    const unit: AirUnit = {
      id: `air_${type}_${nation.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      nationId: nation.id,
      type,
      state: 'HANGAR',
      x: spawnBase.x,
      y: spawnBase.y,
      hp: maxHp,
      maxHp,
      troopCost: spec.troopCostPerPlane,
      salvosLeft: spec.salvosPerSortie,
      maxSalvos: spec.salvosPerSortie,
      attackCooldown: 0,
      baseX: spawnBase.x,
      baseY: spawnBase.y,
    };
    airUnits.push(unit);
    created.push(unit);
  }

  return {
    ok: true,
    message: `Đã sản xuất ${spec.name}!`,
    created,
  };
}

export interface LaunchAirParams {
  targetX?: number;
  targetY?: number;
  targetKind?: 'TILE' | 'TITAN' | 'SHIP' | 'WAVE';
  targetId?: string;
  bomberStartX?: number;
  bomberStartY?: number;
  bomberEndX?: number;
  bomberEndY?: number;
  useSavedBomberRoute?: boolean;
}

export interface BomberRoute {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function getSavedBomberRoute(
  airUnits: AirUnit[] | undefined | null,
  nation?: Nation | null
): BomberRoute | null {
  if (Array.isArray(airUnits) && nation) {
    const readyWithRoute = airUnits.find(
      (u) =>
        u &&
        u.nationId === nation.id &&
        u.type === 'BOMBER' &&
        u.state === 'HANGAR' &&
        typeof u.bomberStartX === 'number' &&
        typeof u.bomberStartY === 'number' &&
        typeof u.bomberEndX === 'number' &&
        typeof u.bomberEndY === 'number'
    );
    if (readyWithRoute) {
      return {
        startX: readyWithRoute.bomberStartX!,
        startY: readyWithRoute.bomberStartY!,
        endX: readyWithRoute.bomberEndX!,
        endY: readyWithRoute.bomberEndY!,
      };
    }
  }
  const lr = nation?.lastBomberRoute;
  if (
    lr &&
    typeof lr.startX === 'number' &&
    typeof lr.startY === 'number' &&
    typeof lr.endX === 'number' &&
    typeof lr.endY === 'number'
  ) {
    return { startX: lr.startX, startY: lr.startY, endX: lr.endX, endY: lr.endY };
  }
  if (Array.isArray(airUnits) && nation) {
    const anyWithRoute = airUnits.find(
      (u) =>
        u &&
        u.nationId === nation.id &&
        u.type === 'BOMBER' &&
        typeof u.bomberStartX === 'number' &&
        typeof u.bomberStartY === 'number' &&
        typeof u.bomberEndX === 'number' &&
        typeof u.bomberEndY === 'number'
    );
    if (anyWithRoute) {
      return {
        startX: anyWithRoute.bomberStartX!,
        startY: anyWithRoute.bomberStartY!,
        endX: anyWithRoute.bomberEndX!,
        endY: anyWithRoute.bomberEndY!,
      };
    }
  }
  return null;
}

export function getBomberRecoveryRemainingSeconds(
  airUnits: AirUnit[] | undefined | null,
  nation?: Nation | null
): number {
  if (!Array.isArray(airUnits) || !nation) return 0;
  const bombers = airUnits.filter((u) => u && u.nationId === nation.id && u.type === 'BOMBER');
  if (bombers.length === 0) return 0;
  if (bombers.some((u) => u.state === 'HANGAR')) return 0;

  let minSec = Infinity;
  const bonuses = getAirTechBonuses(nation);
  const speed = Math.max(1, AIR_UNIT_SPECS.BOMBER.speed * bonuses.speedMult);

  for (let i = 0; i < bombers.length; i++) {
    const b = bombers[i];
    if (b.state === 'RECOVERING') {
      const sec = Math.max(1, Math.ceil(b.recoveryTimer ?? AIR_SYSTEM_CONFIG.BASE_RECOVERY_SECONDS));
      if (sec < minSec) minSec = sec;
    } else if (b.state === 'RETURNING') {
      const bx = b.baseX ?? nation.capitalX;
      const by = b.baseY ?? nation.capitalY;
      const travelSec = Math.ceil(Math.hypot(bx - b.x, by - b.y) / speed);
      const sec = Math.max(1, travelSec + AIR_SYSTEM_CONFIG.BASE_RECOVERY_SECONDS);
      if (sec < minSec) minSec = sec;
    } else {
      const sec = AIR_SYSTEM_CONFIG.BASE_RECOVERY_SECONDS;
      if (sec < minSec) minSec = sec;
    }
  }

  return Number.isFinite(minSec) ? minSec : AIR_SYSTEM_CONFIG.BASE_RECOVERY_SECONDS;
}

export function clampBomberCorridor(
  sx: number,
  sy: number,
  ex: number,
  ey: number
): { startX: number; startY: number; endX: number; endY: number } {
  const dx = ex - sx;
  const dy = ey - sy;
  const dist = Math.hypot(dx, dy);
  const maxLen = AIR_SYSTEM_CONFIG.BOMBER_MAX_CORRIDOR_TILES;
  if (dist > maxLen && dist > 0) {
    const ratio = maxLen / dist;
    return {
      startX: sx,
      startY: sy,
      endX: Math.round(sx + dx * ratio),
      endY: Math.round(sy + dy * ratio),
    };
  }
  return { startX: sx, startY: sy, endX: ex, endY: ey };
}

export function launchAirUnit(
  nation: Nation,
  airUnits: AirUnit[],
  type: AirUnitType,
  basesByNation: Map<number, AirBaseLocation[]>,
  params: LaunchAirParams = {}
): { ok: boolean; message: string; launched: AirUnit[] } {
  ensureNationAirFields(nation);
  if (!canUseAirType(nation, type)) {
    return { ok: false, message: 'Chưa mở khóa loại máy bay này!', launched: [] };
  }
  if ((nation.airSorties || 0) < 1) {
    const waitSec = Math.max(1, AIR_SYSTEM_CONFIG.SORTIE_RECHARGE_SECONDS - Math.floor(nation.airSortieRegenTimer || 0));
    return { ok: false, message: `Hết lượt xuất kích (0/${AIR_SYSTEM_CONFIG.MAX_SORTIES})! Hồi 1 lượt sau ${waitSec}s.`, launched: [] };
  }

  // Tìm máy bay đang sẵn sàng trong kho (HANGAR)
  let candidates: AirUnit[] = [];
  if (type === 'SQUADRON') {
    const firstReady = airUnits.find(u => u && u.nationId === nation.id && u.type === 'SQUADRON' && u.state === 'HANGAR');
    if (firstReady) {
      const sqId = firstReady.squadronId || firstReady.id;
      candidates = airUnits.filter(
        u => u && u.nationId === nation.id && u.type === 'SQUADRON' && u.state === 'HANGAR' && (u.squadronId || u.id) === sqId
      );
    }
  } else if (type === 'BOMBER' && params.useSavedBomberRoute) {
    const readyWithRoute = airUnits.find(
      (u) =>
        u &&
        u.nationId === nation.id &&
        u.type === 'BOMBER' &&
        u.state === 'HANGAR' &&
        typeof u.bomberStartX === 'number' &&
        typeof u.bomberStartY === 'number' &&
        typeof u.bomberEndX === 'number' &&
        typeof u.bomberEndY === 'number'
    );
    const firstReady = readyWithRoute || airUnits.find(u => u && u.nationId === nation.id && u.type === 'BOMBER' && u.state === 'HANGAR');
    if (firstReady) candidates = [firstReady];
  } else {
    const firstReady = airUnits.find(u => u && u.nationId === nation.id && u.type === type && u.state === 'HANGAR');
    if (firstReady) candidates = [firstReady];
  }

  if (candidates.length === 0) {
    return { ok: false, message: `Không có ${AIR_UNIT_SPECS[type].name} sẵn sàng trong căn cứ!`, launched: [] };
  }

  const currentFlying = countFlyingAirUnits(airUnits);
  if (currentFlying + candidates.length > AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL) {
    return {
      ok: false,
      message: `Bầu trời đã đầy (${currentFlying}/${AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL} máy bay đang hoạt động)!`,
      launched: [],
    };
  }

  let rawBomberStartX = params.bomberStartX;
  let rawBomberStartY = params.bomberStartY;
  let rawBomberEndX = params.bomberEndX;
  let rawBomberEndY = params.bomberEndY;

  if (type === 'BOMBER') {
    const hasExplicitRoute =
      typeof rawBomberStartX === 'number' &&
      typeof rawBomberStartY === 'number' &&
      typeof rawBomberEndX === 'number' &&
      typeof rawBomberEndY === 'number';
    if (!hasExplicitRoute && params.useSavedBomberRoute) {
      const saved =
        typeof candidates[0].bomberStartX === 'number' &&
        typeof candidates[0].bomberStartY === 'number' &&
        typeof candidates[0].bomberEndX === 'number' &&
        typeof candidates[0].bomberEndY === 'number'
          ? {
              startX: candidates[0].bomberStartX,
              startY: candidates[0].bomberStartY,
              endX: candidates[0].bomberEndX,
              endY: candidates[0].bomberEndY,
            }
          : getSavedBomberRoute(airUnits, nation);
      if (saved) {
        rawBomberStartX = saved.startX;
        rawBomberStartY = saved.startY;
        rawBomberEndX = saved.endX;
        rawBomberEndY = saved.endY;
      }
    }
    if (
      typeof rawBomberStartX !== 'number' ||
      typeof rawBomberStartY !== 'number' ||
      typeof rawBomberEndX !== 'number' ||
      typeof rawBomberEndY !== 'number'
    ) {
      return {
        ok: false,
        message: params.useSavedBomberRoute
          ? 'Chưa có tuyến bay cũ để bay lại!'
          : 'Cần chọn 2 điểm đầu và cuối đường ném bom!',
        launched: [],
      };
    }
  }

  // Xuất kích tốn 1 lượt, 0 Dầu
  nation.airSorties = Math.max(0, (nation.airSorties || 0) - 1);
  if (nation.isPlayer) soundManager.playAirLaunch();

  const spec = AIR_UNIT_SPECS[type];
  const bonuses = getAirTechBonuses(nation);
  const spawnBase = findNearestAirBase(
    basesByNation,
    nation.id,
    params.targetX ?? rawBomberStartX ?? nation.capitalX,
    params.targetY ?? rawBomberStartY ?? nation.capitalY
  ) || { x: nation.capitalX, y: nation.capitalY };

  const clampedCorridor =
    type === 'BOMBER'
      ? clampBomberCorridor(rawBomberStartX!, rawBomberStartY!, rawBomberEndX!, rawBomberEndY!)
      : null;

  if (clampedCorridor) {
    nation.lastBomberRoute = {
      startX: clampedCorridor.startX,
      startY: clampedCorridor.startY,
      endX: clampedCorridor.endX,
      endY: clampedCorridor.endY,
    };
  }

  candidates.forEach((u, idx) => {
    const maxHp = Math.round(spec.hp * bonuses.hpMult);
    u.maxHp = maxHp;
    u.hp = maxHp;
    u.salvosLeft = spec.salvosPerSortie;
    u.maxSalvos = spec.salvosPerSortie;
    u.attackCooldown = 0;
    u.sortieActiveSeconds = 0;
    u.baseX = spawnBase.x;
    u.baseY = spawnBase.y;

    const offsetAngle = (idx - 1) * 0.7;
    u.x = spawnBase.x + (type === 'SQUADRON' ? Math.cos(offsetAngle) * 0.7 : 0);
    u.y = spawnBase.y + (type === 'SQUADRON' ? Math.sin(offsetAngle) * 0.7 : 0);
    u.state = 'EN_ROUTE';

    if (type === 'BOMBER' && clampedCorridor) {
      u.bomberStartX = clampedCorridor.startX;
      u.bomberStartY = clampedCorridor.startY;
      u.bomberEndX = clampedCorridor.endX;
      u.bomberEndY = clampedCorridor.endY;
      u.bomberStartedRun = false;
      u.bomberDroppedTerminal = false;
      u.bomberNextDropDist = AIR_SYSTEM_CONFIG.BOMBER_SMALL_BOMB_SPACING;
      u.targetX = clampedCorridor.startX;
      u.targetY = clampedCorridor.startY;
    } else {
      u.priorityTargetX = params.targetX;
      u.priorityTargetY = params.targetY;
      u.priorityTargetKind = params.targetKind;
      u.priorityTargetId = params.targetId;
      u.targetX = params.targetX ?? nation.capitalX;
      u.targetY = params.targetY ?? nation.capitalY;
    }
  });

  return {
    ok: true,
    message: `✈️ ${AIR_UNIT_SPECS[type].name} đã xuất kích!`,
    launched: candidates,
  };
}

export function tickNationAirUnlocksAndSorties(
  nations: Nation[],
  arsenalExistsByNation: Map<number, boolean>,
  events: GameEvent[],
  gameTimeSeconds: number,
  localHudNationId: number = 1
): void {
  for (let i = 0; i < nations.length; i++) {
    const n = nations[i];
    if (!n || n.id === 0 || n.isEliminated) continue;
    ensureNationAirFields(n);

    // 1. Đại Công Xưởng tồn tại đủ 60 giây -> mở vĩnh viễn Loại 2 & Loại 3
    if (!n.airAdvancedUnlocked) {
      const hasArsenal = Boolean(arsenalExistsByNation.get(n.id));
      if (hasArsenal) {
        n.grandArsenalDestroyed = false;
        n.grandArsenalTimer = (n.grandArsenalTimer || 0) + 1;
        if (n.grandArsenalTimer >= AIR_SYSTEM_CONFIG.GRAND_ARSENAL_UNLOCK_SECONDS) {
          n.airAdvancedUnlocked = true;
          n.grandArsenalDestroyed = false;
          if (n.id === localHudNationId) {
            const fullyUnlocked23 = canUseAirType1(n);
            events.unshift({
              id: Math.random().toString(),
              title: fullyUnlocked23 ? '✈️ Đã mở khóa Loại 2 & Loại 3' : '🏭 Đại Công Xưởng đủ 60 giây',
              description: fullyUnlocked23
                ? 'Đã mở khóa Loại 2 & Loại 3! Đại Công Xưởng đã tồn tại đủ 60 giây và đã đạt Quân Sự Tối Thượng Cấp 3, mở Tiểu Đội & Ném Bom.'
                : 'Đại Công Xưởng đã tồn tại đủ 60 giây! Hãy đạt Quân Sự Tối Thượng Cấp 3 để mở khóa Tiểu Đội & Ném Bom.',
              type: 'DIPLOMACY',
              targetNationId: n.id,
              timestamp: formatGameTime(gameTimeSeconds),
            });
          }
        }
      } else {
        // Bị phá trước 60 giây -> KHÔNG mở, reset bộ đếm về 0 và đánh dấu bị phá
        if ((n.grandArsenalTimer || 0) > 0) {
          n.grandArsenalDestroyed = true;
        }
        n.grandArsenalTimer = 0;
      }
    } else {
      n.grandArsenalDestroyed = false;
    }

    // 2. Hồi lượt xuất kích (1 lượt / 25s, tối đa 5)
    if (hasAnyAirUnlocked(n)) {
      if ((n.airSorties || 0) < AIR_SYSTEM_CONFIG.MAX_SORTIES) {
        n.airSortieRegenTimer = (n.airSortieRegenTimer || 0) + 1;
        if (n.airSortieRegenTimer >= AIR_SYSTEM_CONFIG.SORTIE_RECHARGE_SECONDS) {
          n.airSortieRegenTimer = 0;
          n.airSorties = Math.min(AIR_SYSTEM_CONFIG.MAX_SORTIES, (n.airSorties || 0) + 1);
        }
      } else {
        n.airSortieRegenTimer = 0;
      }
    }
  }
}

function isAtWar(attacker: Nation | undefined, targetId: number): boolean {
  if (!attacker || targetId <= 0 || attacker.id === targetId) return false;
  const dip = attacker.diplomacy?.[targetId]?.status || 'WAR';
  return dip === 'WAR';
}

export function isEnemyTradeShipForNation(attacker: Nation | undefined, ship: SeaTradeShip): boolean {
  if (!attacker || !ship || ship.isEnclosedLocal || ship.derelict) return false;
  if (ship.fromNation === attacker.id || ship.toNation === attacker.id) return false;
  const dipFrom = attacker.diplomacy?.[ship.fromNation]?.status || 'WAR';
  const dipTo = attacker.diplomacy?.[ship.toNation]?.status || 'WAR';
  if (dipFrom === 'ALLIANCE' || dipTo === 'ALLIANCE') return false;
  return dipFrom === 'WAR' || dipTo === 'WAR';
}

function getFormationOffset(unit: AirUnit): { dx: number; dy: number } {
  if (unit.type !== 'SQUADRON') return { dx: 0, dy: 0 };
  const idx = unit.memberIndex ?? 0;
  if (idx === 0) return { dx: 0, dy: 0 };
  if (idx === 1) return { dx: -0.9, dy: 0.7 };
  return { dx: 0.9, dy: 0.7 };
}

function shootDownAirUnit(
  unit: AirUnit,
  nations: Nation[],
  data: any,
  callbacks: AirTickCallbacks,
  reasonText: string
): void {
  const owner = nations[unit.nationId];
  if (owner && !owner.isEliminated && unit.troopCost > 0) {
    const troopLoss = Math.min(owner.troops, unit.troopCost);
    owner.troops = Math.max(0, owner.troops - troopLoss);
    callbacks.applyCasualties(owner, troopLoss);
  }
  data.particles = data.particles || [];
  data.particles.push({
    x: unit.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
    y: unit.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
    color: '#ef4444',
    size: 0,
    life: 40,
    maxLife: 40,
    vx: 0,
    vy: -0.7,
    type: 'FLOAT_TEXT',
    text: `${reasonText} (-${unit.troopCost} quân)`,
  });
  for (let p = 0; p < 6; p++) {
    data.particles.push({
      x: unit.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      y: unit.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      color: p % 2 === 0 ? '#f97316' : '#fde047',
      size: 3,
      life: 20,
      maxLife: 20,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      type: 'SPARK',
    });
  }
  callbacks.playExplosionSound?.();
}

function applyAirStrikeImpact(
  cx: number,
  cy: number,
  attacker: Nation,
  data: any,
  callbacks: AirTickCallbacks,
  impact: {
    aoeRadius: number;
    troopDamage: number;
    waveDamageRatio: number;
    minWaveDamage: number;
    normalBuildingDamage: number;
    superBuildingDamage: number;
    shipDamage: number;
    titanDamage: number;
    scorchSeconds: number;
    blastKind: 'FIGHTER' | 'BOMB_SMALL' | 'BOMB_LARGE';
    titanDmgMultiplier?: number;
  }
): void {
  const tiles: Tile[][] = data.tiles || [];
  const nations: Nation[] = data.nations || [];
  const size = tiles.length;
  const rx = Math.round(cx);
  const ry = Math.round(cy);

  data.blasts = data.blasts || [];
  data.blasts.push({
    x: cx * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
    y: cy * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
    radiusPx: impact.aoeRadius * TILE_PIXEL_SIZE,
    kind: impact.blastKind,
    start: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    duration: impact.blastKind === 'BOMB_LARGE' ? 1100 : 750,
  });

  // 1. Đánh trúng các đợt quân địch (AttackWaves)
  if (Array.isArray(data.attackWaves) && data.attackWaves.length > 0) {
    for (let wi = 0; wi < data.attackWaves.length; wi++) {
      const w: AttackWave = data.attackWaves[wi];
      if (!w || w.troops <= 0 || !isAtWar(attacker, w.fromNation)) continue;
      const wx = w.sourceX + (w.targetX - w.sourceX) * w.progress;
      const wy = w.sourceY + (w.targetY - w.sourceY) * w.progress;
      if (Math.hypot(wx - cx, wy - cy) <= impact.aoeRadius + 1.0) {
        const waveLoss = Math.max(impact.minWaveDamage, Math.floor(w.troops * impact.waveDamageRatio));
        w.troops = Math.max(0, w.troops - waveLoss);
        callbacks.applyCasualties(nations[w.fromNation], waveLoss);
      }
    }
    data.attackWaves = data.attackWaves.filter((w: AttackWave) => w.troops > 0);
  }

  // 2. Đánh trúng Tàu (SeaTradeShip của phe địch đang chiến tranh)
  if (Array.isArray(data.tradeShips) && data.tradeShips.length > 0) {
    const routeMap = new Map<string, SeaTradeRoute>();
    if (Array.isArray(data.tradeRoutes)) {
      data.tradeRoutes.forEach((r: SeaTradeRoute) => {
        if (r?.id) routeMap.set(r.id, r);
      });
    }
    const sunkIds = new Set<string>();
    for (let si = 0; si < data.tradeShips.length; si++) {
      const ship: SeaTradeShip = data.tradeShips[si];
      if (!ship || !isEnemyTradeShipForNation(attacker, ship)) continue;
      const pos = getTradeShipPosition(ship, routeMap);
      const sx = pos.x;
      const sy = pos.y;
      if (Math.hypot(sx - cx, sy - cy) <= impact.aoeRadius + 1.2) {
        const maxHp = ship.maxHp ?? AIR_SYSTEM_CONFIG.SHIP_BASE_HP;
        const curHp = ship.hp ?? maxHp;
        const nextHp = Math.max(0, curHp - impact.shipDamage);
        ship.maxHp = maxHp;
        ship.hp = nextHp;
        if (nextHp <= 0) {
          sunkIds.add(ship.id);
          const bounty = Math.max(10, Math.round((ship.cargoGold || 20) * 0.5));
          attacker.gold += bounty;
          data.particles.push({
            x: sx * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: sy * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#fbbf24',
            size: 0,
            life: 45,
            maxLife: 45,
            vx: 0,
            vy: -0.7,
            type: 'FLOAT_TEXT',
            text: `⛵💥 Đánh chìm tàu địch! +${bounty}💰`,
          });
        }
      }
    }
    if (sunkIds.size > 0) {
      data.tradeShips = data.tradeShips.filter((s: SeaTradeShip) => !sunkIds.has(s.id));
    }
  }

  // 2b. Đánh trúng Tàu Hải Quân (Tàu Khai Thác / Tàu Chiến địch)
  if (Array.isArray(data.navalShips) && data.navalShips.length > 0) {
    for (let ni = data.navalShips.length - 1; ni >= 0; ni--) {
      const ns: NavalShip = data.navalShips[ni];
      if (!ns || !isEnemyNavalShip(attacker, ns)) continue;
      if (Math.hypot(ns.x - cx, ns.y - cy) <= impact.aoeRadius + 1.2) {
        const sunk = damageNavalShip(ns, impact.shipDamage, attacker, data);
        if (sunk) {
          data.navalShips.splice(ni, 1);
        }
      }
    }
  }

  // 3. Đánh trúng ô lãnh thổ địch, quân đồn trú, công trình thường & siêu công trình
  const hitEnemyIds = new Set<number>();
  const rCeil = Math.ceil(impact.aoeRadius);
  const rSq = impact.aoeRadius * impact.aoeRadius;
  let buildingDamagedOrDestroyed = false;

  for (let dy = -rCeil; dy <= rCeil; dy++) {
    const ty = ry + dy;
    if (ty < 0 || ty >= size) continue;
    const row = tiles[ty];
    if (!row) continue;
    for (let dx = -rCeil; dx <= rCeil; dx++) {
      const tx = rx + dx;
      if (tx < 0 || tx >= size) continue;
      if (dx * dx + dy * dy > rSq) continue;
      const ht = row[tx];
      if (!ht || ht.terrain === 'WATER') continue;
      if (ht.owner > 0 && isAtWar(attacker, ht.owner)) {
        hitEnemyIds.add(ht.owner);
        ht.scorchedTimer = Math.max(ht.scorchedTimer || 0, impact.scorchSeconds);

        if (isSuperBuilding(ht.building)) {
          const res = damageSuperBuilding(ht, impact.superBuildingDamage);
          if (res === 'DESTROYED') {
            ht.owner = 0;
            ht.scorchedTimer = 90;
            data.particles.push({
              x: ht.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: ht.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#ef4444',
              size: 0,
              life: 55,
              maxLife: 55,
              vx: 0,
              vy: -0.8,
              type: 'FLOAT_TEXT',
              text: '💥 Siêu Công Trình bị phá hủy!',
            });
          }
          buildingDamagedOrDestroyed = true;
        } else if (ht.building !== 'NONE') {
          const curHp = ht.buildingHp ?? AIR_SYSTEM_CONFIG.NORMAL_BUILDING_BASE_HP;
          const nextHp = curHp - impact.normalBuildingDamage;
          if (nextHp <= 0) {
            const bName = BUILDING_INFO[ht.building]?.name || ht.building;
            ht.building = 'NONE';
            ht.buildingLevel = 1;
            ht.isAdvancedExtractor = false;
            ht.buildingHp = undefined;
            data.particles.push({
              x: ht.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: ht.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#f97316',
              size: 0,
              life: 35,
              maxLife: 35,
              vx: 0,
              vy: -0.7,
              type: 'FLOAT_TEXT',
              text: `💥 Phá hủy ${bName}!`,
            });
          } else {
            ht.buildingHp = nextHp;
          }
          buildingDamagedOrDestroyed = true;
        }
      }
    }
  }

  hitEnemyIds.forEach((eid) => {
    const en = nations[eid];
    if (en && !en.isEliminated) {
      const loss = Math.min(en.troops, impact.troopDamage);
      en.troops = Math.max(0, en.troops - loss);
      callbacks.applyCasualties(en, loss);
    }
  });

  if (buildingDamagedOrDestroyed) {
    callbacks.markTerritoryDirty();
  }

  // 4. Đánh trúng Tà Thần (Dark Titans)
  const activeTitans: DarkTitan[] =
    Array.isArray(data.darkTitans) && data.darkTitans.length > 0
      ? data.darkTitans
      : data.darkTitan && data.darkTitan.isActive
        ? [data.darkTitan]
        : [];
  const titanMult = impact.titanDmgMultiplier ?? 1.0;
  for (let ti = 0; ti < activeTitans.length; ti++) {
    const titan = activeTitans[ti];
    if (!titan || !titan.isActive) continue;
    if (Math.hypot(titan.x - cx, titan.y - cy) <= impact.aoeRadius + 0.8) {
      const finalTitanDmg = Math.max(1, Math.round(impact.titanDamage * titanMult));
      damageDarkTitan(titan, finalTitanDmg, attacker, data);
    }
  }
}

function validatePriorityTarget(
  unit: AirUnit,
  attacker: Nation,
  data: any
): { x: number; y: number; stillValid: boolean } {
  const tiles: Tile[][] = data.tiles || [];
  const nations: Nation[] = data.nations || [];
  if (typeof unit.priorityTargetX !== 'number' || typeof unit.priorityTargetY !== 'number') {
    return { x: unit.x, y: unit.y, stillValid: false };
  }

  if (unit.priorityTargetKind === 'TITAN') {
    const activeTitans: DarkTitan[] =
      Array.isArray(data.darkTitans) && data.darkTitans.length > 0
        ? data.darkTitans
        : data.darkTitan
          ? [data.darkTitan]
          : [];
    const found = activeTitans.find(
      (t) => t && t.isActive && (!unit.priorityTargetId || t.id === unit.priorityTargetId)
    );
    if (found) {
      unit.priorityTargetX = found.x;
      unit.priorityTargetY = found.y;
      return { x: found.x, y: found.y, stillValid: true };
    }
    return { x: unit.priorityTargetX, y: unit.priorityTargetY, stillValid: false };
  }

  if (unit.priorityTargetKind === 'SHIP' && unit.priorityTargetId) {
    const foundShip = (data.tradeShips || []).find((s: SeaTradeShip) => s && s.id === unit.priorityTargetId);
    if (foundShip && isEnemyTradeShipForNation(attacker, foundShip)) {
      const routeMap = new Map<string, SeaTradeRoute>();
      if (Array.isArray(data.tradeRoutes)) {
        data.tradeRoutes.forEach((r: SeaTradeRoute) => {
          if (r?.id) routeMap.set(r.id, r);
        });
      }
      const pos = getTradeShipPosition(foundShip, routeMap);
      unit.priorityTargetX = pos.x;
      unit.priorityTargetY = pos.y;
      return { x: pos.x, y: pos.y, stillValid: true };
    }
    const foundNaval = (data.navalShips || []).find((s: NavalShip) => s && s.id === unit.priorityTargetId);
    if (foundNaval && isEnemyNavalShip(attacker, foundNaval)) {
      unit.priorityTargetX = foundNaval.x;
      unit.priorityTargetY = foundNaval.y;
      return { x: foundNaval.x, y: foundNaval.y, stillValid: true };
    }
    return { x: unit.priorityTargetX, y: unit.priorityTargetY, stillValid: false };
  }

  const px = Math.round(unit.priorityTargetX);
  const py = Math.round(unit.priorityTargetY);
  const pt = tiles[py]?.[px];
  if (pt && pt.owner > 0 && isAtWar(attacker, pt.owner)) {
    const ownerNat = nations[pt.owner];
    if (ownerNat && !ownerNat.isEliminated && (pt.building !== 'NONE' || ownerNat.troops > 0)) {
      return { x: unit.priorityTargetX, y: unit.priorityTargetY, stillValid: true };
    }
  }
  return { x: unit.priorityTargetX, y: unit.priorityTargetY, stillValid: false };
}

type ScannedAirTarget = { x: number; y: number; kind: 'TILE' | 'TITAN' | 'SHIP' | 'WAVE'; id?: string };

function scanBestLocalTarget(
  originX: number,
  originY: number,
  scanRadius: number,
  attacker: Nation,
  data: any
): ScannedAirTarget | null {
  const tiles: Tile[][] = data.tiles || [];
  const nations: Nation[] = data.nations || [];
  const size = tiles.length;
  const rCeil = Math.ceil(scanRadius);
  const rSq = scanRadius * scanRadius;

  const candidates: Array<{ target: ScannedAirTarget; dist: number }> = [];

  // 1. Tà Thần gần nhất trong tầm quét
  const activeTitans: DarkTitan[] =
    Array.isArray(data.darkTitans) && data.darkTitans.length > 0
      ? data.darkTitans
      : data.darkTitan && data.darkTitan.isActive
        ? [data.darkTitan]
        : [];
  let nearestTitan: DarkTitan | null = null;
  let nearestTitanDist = Infinity;
  for (let i = 0; i < activeTitans.length; i++) {
    const titan = activeTitans[i];
    if (!titan || !titan.isActive) continue;
    const d = Math.hypot(titan.x - originX, titan.y - originY);
    if (d <= scanRadius && d < nearestTitanDist) {
      nearestTitanDist = d;
      nearestTitan = titan;
    }
  }
  if (nearestTitan) {
    candidates.push({
      target: { x: nearestTitan.x, y: nearestTitan.y, kind: 'TITAN', id: nearestTitan.id },
      dist: nearestTitanDist,
    });
  }

  // 2. Tàu địch gần nhất đang chiến tranh trong tầm quét
  if (Array.isArray(data.tradeShips) && data.tradeShips.length > 0) {
    const routeMap = new Map<string, SeaTradeRoute>();
    if (Array.isArray(data.tradeRoutes)) {
      data.tradeRoutes.forEach((r: SeaTradeRoute) => {
        if (r?.id) routeMap.set(r.id, r);
      });
    }
    let bestShip: { x: number; y: number; id: string; d: number } | null = null;
    for (let i = 0; i < data.tradeShips.length; i++) {
      const s: SeaTradeShip = data.tradeShips[i];
      if (!s || !isEnemyTradeShipForNation(attacker, s)) continue;
      const pos = getTradeShipPosition(s, routeMap);
      const sx = pos.x;
      const sy = pos.y;
      const d = Math.hypot(sx - originX, sy - originY);
      if (d <= scanRadius && (!bestShip || d < bestShip.d)) {
        bestShip = { x: sx, y: sy, id: s.id, d };
      }
    }
    if (bestShip) {
      candidates.push({
        target: { x: bestShip.x, y: bestShip.y, kind: 'SHIP', id: bestShip.id },
        dist: bestShip.d,
      });
    }
  }
  if (Array.isArray(data.navalShips) && data.navalShips.length > 0) {
    let bestNav: { x: number; y: number; id: string; d: number } | null = null;
    for (let i = 0; i < data.navalShips.length; i++) {
      const ns: NavalShip = data.navalShips[i];
      if (!ns || !isEnemyNavalShip(attacker, ns)) continue;
      const d = Math.hypot(ns.x - originX, ns.y - originY);
      if (d <= scanRadius && (!bestNav || d < bestNav.d)) {
        bestNav = { x: ns.x, y: ns.y, id: ns.id, d };
      }
    }
    if (bestNav) {
      candidates.push({
        target: { x: bestNav.x, y: bestNav.y, kind: 'SHIP', id: bestNav.id },
        dist: bestNav.d,
      });
    }
  }

  // 3. Đợt quân địch gần nhất hành quân trong tầm quét
  if (Array.isArray(data.attackWaves)) {
    let bestWave: { x: number; y: number; id: string; d: number } | null = null;
    for (let i = 0; i < data.attackWaves.length; i++) {
      const w: AttackWave = data.attackWaves[i];
      if (!w || w.troops <= 0 || !isAtWar(attacker, w.fromNation)) continue;
      const wx = w.sourceX + (w.targetX - w.sourceX) * w.progress;
      const wy = w.sourceY + (w.targetY - w.sourceY) * w.progress;
      const d = Math.hypot(wx - originX, wy - originY);
      if (d <= scanRadius && (!bestWave || d < bestWave.d)) {
        bestWave = { x: wx, y: wy, id: w.id, d };
      }
    }
    if (bestWave) {
      candidates.push({
        target: { x: bestWave.x, y: bestWave.y, kind: 'WAVE', id: bestWave.id },
        dist: bestWave.d,
      });
    }
  }

  // 4. Ô lãnh thổ / công trình / quân địch / Boss trong tầm quét (step = 1 để không bỏ sót công trình đơn lẻ)
  let bestTile: Tile | null = null;
  let bestTileDist = Infinity;
  let bestScore = -Infinity;
  const cx = Math.round(originX);
  const cy = Math.round(originY);
  for (let dy = -rCeil; dy <= rCeil; dy++) {
    const ty = cy + dy;
    if (ty < 0 || ty >= size) continue;
    const row = tiles[ty];
    if (!row) continue;
    for (let dx = -rCeil; dx <= rCeil; dx++) {
      if (dx * dx + dy * dy > rSq) continue;
      const tx = cx + dx;
      if (tx < 0 || tx >= size) continue;
      const t = row[tx];
      if (!t || t.terrain === 'WATER' || t.owner <= 0 || !isAtWar(attacker, t.owner)) continue;
      const en = nations[t.owner];
      if (!en || en.isEliminated) continue;
      if (t.building === 'NONE' && en.troops <= 0) continue;
      const d = Math.hypot(t.x - originX, t.y - originY);
      if (d > scanRadius) continue;
      let score = -d;
      if (en.tier === 'BOSS') score += 3;
      if (isSuperBuilding(t.building)) score += 10;
      else if (t.building === 'MISSILE_SILO' || t.building === 'AIR_DEFENSE') score += 7;
      else if (t.building !== 'NONE') score += 4;
      if (score > bestScore) {
        bestScore = score;
        bestTile = t;
        bestTileDist = d;
      }
    }
  }

  if (bestTile) {
    candidates.push({
      target: { x: bestTile.x, y: bestTile.y, kind: 'TILE' },
      dist: bestTileDist,
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0].target;
}

function findNextTargetForUnit(u: AirUnit, owner: Nation, data: any): ScannedAirTarget | null {
  const fSpec = u.type === 'FIGHTER' ? AIR_UNIT_SPECS.FIGHTER : AIR_UNIT_SPECS.SQUADRON;
  const mapSize = Array.isArray(data.tiles) ? data.tiles.length : 60;
  const wideRadius = Math.max(38, Math.ceil(mapSize * 0.65));
  return (
    scanBestLocalTarget(u.x, u.y, fSpec.scanRadius, owner, data) ||
    scanBestLocalTarget(u.x, u.y, wideRadius, owner, data)
  );
}

function pickPatrolWaypoint(
  originX: number,
  originY: number,
  mapSize: number
): { x: number; y: number } {
  const size = Math.max(20, mapSize || 60);
  const margin = Math.min(4, Math.max(1, Math.floor(size * 0.1)));
  const span = Math.max(4, size - margin * 2);
  let wx = margin + Math.random() * span;
  let wy = margin + Math.random() * span;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (Math.hypot(wx - originX, wy - originY) >= Math.min(14, span * 0.45)) break;
    wx = margin + Math.random() * span;
    wy = margin + Math.random() * span;
  }
  return {
    x: Math.round(wx * 10) / 10,
    y: Math.round(wy * 10) / 10,
  };
}

function transitionToReturnOrPatrol(
  unit: AirUnit,
  basesByNation: Map<number, AirBaseLocation[]>,
  _nation: Nation
): void {
  const base = findNearestAirBase(basesByNation, unit.nationId, unit.x, unit.y);
  if (base) {
    unit.baseX = base.x;
    unit.baseY = base.y;
    unit.state = 'RETURNING';
    unit.targetX = base.x;
    unit.targetY = base.y;
    unit.patrolAnchorX = undefined;
    unit.patrolAnchorY = undefined;
  } else if (unit.type === 'BOMBER') {
    // Nếu không có căn cứ hợp lệ: vẫn về HANGAR tại vị trí hiện tại, không đứng yên ngoài bản đồ (giữ tuyến cũ)
    unit.baseX = undefined;
    unit.baseY = undefined;
    unit.vx = 0;
    unit.vy = 0;
    unit.state = 'HANGAR';
    unit.hp = unit.maxHp;
    unit.salvosLeft = unit.maxSalvos;
    unit.recoveryTimer = 0;
    unit.attackCooldown = 0;
    unit.sortieActiveSeconds = 0;
    unit.bomberStartedRun = false;
    unit.bomberDroppedTerminal = false;
    unit.bomberNextDropDist = undefined;
    unit.targetX = undefined;
    unit.targetY = undefined;
    unit.patrolAnchorX = undefined;
    unit.patrolAnchorY = undefined;
    unit.patrolAngle = undefined;
  } else {
    unit.baseX = undefined;
    unit.baseY = undefined;
    unit.state = 'PATROL';
    unit.patrolAnchorX = undefined;
    unit.patrolAnchorY = undefined;
    unit.patrolAngle = undefined;
  }
}

export function tickAirUnits(
  data: any,
  ctx: CachedAirContext,
  callbacks: AirTickCallbacks
): void {
  const nations: Nation[] = data.nations || [];
  const tiles: Tile[][] = data.tiles || [];
  if (!tiles || tiles.length === 0) return;

  tickNationAirUnlocksAndSorties(
    nations,
    ctx.arsenalExistsByNation,
    data.events || [],
    data.gameTimeSeconds || 0,
    callbacks.localHudNationId ?? 1
  );

  data.airUnits = data.airUnits || [];
  const units: AirUnit[] = data.airUnits;
  if (units.length === 0) return;

  const destroyedIds = new Set<string>();
  const squadronShouldReturn = new Set<string>();
  const recoveredFightersReady: AirUnit[] = [];
  const recoveredSquadronIds = new Set<string>();

  // Giai đoạn 1: Hồi phục tại căn cứ & Di chuyển / Kiểm tra căn cứ / Đánh nhau trên không
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u || destroyedIds.has(u.id)) continue;
    const owner = nations[u.nationId];
    if (!owner || owner.isEliminated) {
      destroyedIds.add(u.id);
      continue;
    }

    const bonuses = getAirTechBonuses(owner);
    const spec = AIR_UNIT_SPECS[u.type];
    const scaledMaxHp = Math.round(spec.hp * bonuses.hpMult);
    if (u.maxHp !== scaledMaxHp) {
      const ratio = u.maxHp > 0 ? u.hp / u.maxHp : 1;
      u.maxHp = scaledMaxHp;
      u.hp = Math.min(scaledMaxHp, Math.max(1, Math.round(scaledMaxHp * ratio)));
    }

    if (u.state === 'HANGAR') {
      u.hp = u.maxHp;
      u.salvosLeft = u.maxSalvos;
      u.vx = 0;
      u.vy = 0;
      continue;
    }

    if (u.state === 'RECOVERING') {
      u.vx = 0;
      u.vy = 0;
      u.recoveryTimer = Math.max(0, (u.recoveryTimer ?? AIR_SYSTEM_CONFIG.BASE_RECOVERY_SECONDS) - 1);
      if (u.recoveryTimer <= 0) {
        u.hp = u.maxHp;
        u.salvosLeft = u.maxSalvos;
        u.recoveryTimer = 0;
        u.attackCooldown = 0;
        u.sortieActiveSeconds = 0;
        u.priorityTargetX = undefined;
        u.priorityTargetY = undefined;
        u.priorityTargetKind = undefined;
        u.priorityTargetId = undefined;
        u.patrolAnchorX = undefined;
        u.patrolAnchorY = undefined;

        if (u.type === 'BOMBER') {
          // Loại 3 (Ném bom): sau khi hồi xong quay về HANGAR sẵn sàng, giữ nguyên tuyến cũ (bomberStartX/EndX)
          u.state = 'HANGAR';
          u.bomberStartedRun = false;
          u.bomberDroppedTerminal = false;
          u.bomberNextDropDist = undefined;
          u.targetX = undefined;
          u.targetY = undefined;
        } else if (u.type === 'SQUADRON') {
          recoveredSquadronIds.add(u.squadronId || u.id);
        } else {
          recoveredFightersReady.push(u);
        }
      }
      continue;
    }

    // Máy bay đang bay
    u.sortieActiveSeconds = (u.sortieActiveSeconds || 0) + 1;
    if (u.attackCooldown && u.attackCooldown > 0) u.attackCooldown = Math.max(0, u.attackCooldown - 1);

    // Kiểm tra rút lui < 30% HP
    if (u.state !== 'RETURNING' && u.hp < u.maxHp * AIR_SYSTEM_CONFIG.RETREAT_HP_RATIO) {
      if (u.type === 'SQUADRON' && u.squadronId) {
        squadronShouldReturn.add(u.squadronId);
      } else {
        transitionToReturnOrPatrol(u, ctx.basesByNation, owner);
      }
    }

    // Kiểm tra căn cứ khi đang RETURNING (nếu bị phá -> đổi căn cứ khác; hết căn cứ -> tuần tra)
    if (u.state === 'RETURNING') {
      const baseTile =
        typeof u.baseX === 'number' && typeof u.baseY === 'number'
          ? tiles[Math.round(u.baseY)]?.[Math.round(u.baseX)]
          : undefined;
      if (!isValidAirBaseTile(baseTile, u.nationId)) {
        transitionToReturnOrPatrol(u, ctx.basesByNation, owner);
      }
    }

    // Nếu đang PATROL mà là BOMBER hoặc chủ sở hữu đã xây lại căn cứ và máy bay cần hồi phục/hết đạn -> về căn cứ (hoặc HANGAR)
    if (u.state === 'PATROL') {
      if (u.type === 'BOMBER') {
        transitionToReturnOrPatrol(u, ctx.basesByNation, owner);
      } else {
        const newBase = findNearestAirBase(ctx.basesByNation, u.nationId, u.x, u.y);
        if (
          newBase &&
          (u.hp < u.maxHp * AIR_SYSTEM_CONFIG.RETREAT_HP_RATIO ||
            u.salvosLeft <= 0 ||
            ((u.sortieActiveSeconds || 0) >= AIR_SYSTEM_CONFIG.MAX_PATROL_SECONDS &&
              (u.hp < u.maxHp || u.salvosLeft < u.maxSalvos)))
        ) {
          u.baseX = newBase.x;
          u.baseY = newBase.y;
          u.state = 'RETURNING';
          u.targetX = newBase.x;
          u.targetY = newBase.y;
          u.patrolAnchorX = undefined;
          u.patrolAnchorY = undefined;
        }
      }
    }
  }

  // Sau khi hồi phục xong 45s: Loại 1 (FIGHTER) tự tìm mục tiêu mới gần nhất hoặc tuần tra
  for (let i = 0; i < recoveredFightersReady.length; i++) {
    const u = recoveredFightersReady[i];
    const owner = nations[u.nationId];
    if (!owner || owner.isEliminated) continue;
    if (countFlyingAirUnits(units) + 1 > AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL) {
      u.state = 'HANGAR';
      continue;
    }
    const scanned = findNextTargetForUnit(u, owner, data);
    if (scanned) {
      u.priorityTargetX = scanned.x;
      u.priorityTargetY = scanned.y;
      u.priorityTargetKind = scanned.kind;
      u.priorityTargetId = scanned.id;
      u.targetX = scanned.x;
      u.targetY = scanned.y;
      u.state = 'EN_ROUTE';
    } else {
      const wp = pickPatrolWaypoint(u.x, u.y, tiles.length);
      u.state = 'PATROL';
      u.patrolAnchorX = wp.x;
      u.patrolAnchorY = wp.y;
      u.targetX = wp.x;
      u.targetY = wp.y;
    }
  }

  // Sau khi hồi phục xong 45s: Loại 2 (SQUADRON) đồng bộ cả Tiểu đội nhận mục tiêu mới hoặc cùng tuần tra
  recoveredSquadronIds.forEach((sqId) => {
    const members = units.filter(
      (m) => m && !destroyedIds.has(m.id) && m.type === 'SQUADRON' && (m.squadronId || m.id) === sqId
    );
    if (members.length === 0) return;
    const allReady = members.every((m) => m.state === 'RECOVERING' && (m.recoveryTimer ?? 0) <= 0);
    if (!allReady) return;

    const leader = members[0];
    const owner = nations[leader.nationId];
    if (!owner || owner.isEliminated) return;

    if (countFlyingAirUnits(units) + members.length > AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL) {
      members.forEach((m) => {
        m.state = 'HANGAR';
      });
      return;
    }

    const scanned = findNextTargetForUnit(leader, owner, data);
    if (scanned) {
      members.forEach((m) => {
        const offset = getFormationOffset(m);
        m.priorityTargetX = scanned.x;
        m.priorityTargetY = scanned.y;
        m.priorityTargetKind = scanned.kind;
        m.priorityTargetId = scanned.id;
        m.targetX = scanned.x + offset.dx;
        m.targetY = scanned.y + offset.dy;
        m.patrolAnchorX = undefined;
        m.patrolAnchorY = undefined;
        m.state = 'EN_ROUTE';
      });
    } else {
      const wp = pickPatrolWaypoint(leader.x, leader.y, tiles.length);
      members.forEach((m) => {
        const offset = getFormationOffset(m);
        m.state = 'PATROL';
        m.patrolAnchorX = wp.x;
        m.patrolAnchorY = wp.y;
        m.targetX = wp.x + offset.dx;
        m.targetY = wp.y + offset.dy;
      });
    }
  });

  // Đồng bộ rút về căn cứ cho cả Tiểu đội (Type 2)
  if (squadronShouldReturn.size > 0) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u && u.squadronId && squadronShouldReturn.has(u.squadronId) && isFlyingAirState(u.state) && u.state !== 'RETURNING') {
        const owner = nations[u.nationId];
        if (owner) transitionToReturnOrPatrol(u, ctx.basesByNation, owner);
      }
    }
  }

  // Giai đoạn 2: Di chuyển, Chiến đấu (Mặt đất/Biển/Tà Thần + Không đối Không), Phòng Không (SAM)
  const samFired = ctx.sams.length > 0 ? new Uint8Array(ctx.sams.length) : null;
  const activeTitans: DarkTitan[] =
    Array.isArray(data.darkTitans) && data.darkTitans.length > 0
      ? data.darkTitans.filter((t: DarkTitan) => t && t.isActive)
      : data.darkTitan && data.darkTitan.isActive
        ? [data.darkTitan]
        : [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u || destroyedIds.has(u.id) || !isFlyingAirState(u.state)) continue;
    const owner = nations[u.nationId];
    if (!owner || owner.isEliminated) continue;

    const bonuses = getAirTechBonuses(owner);
    const spec = AIR_UNIT_SPECS[u.type];
    const speed = spec.speed * bonuses.speedMult;

    // 2a. Xử lý riêng cho Oanh Tạc Cơ (Type 3 - BOMBER): bay 2 điểm start -> end thẳng
    if (u.type === 'BOMBER') {
      if (u.state === 'EN_ROUTE' || u.state === 'COMBAT') {
        const hasValidRoute =
          typeof u.bomberStartX === 'number' &&
          typeof u.bomberStartY === 'number' &&
          typeof u.bomberEndX === 'number' &&
          typeof u.bomberEndY === 'number';
        if (!hasValidRoute || u.bomberDroppedTerminal || u.salvosLeft <= 0) {
          transitionToReturnOrPatrol(u, ctx.basesByNation, owner);
        } else {
        const sx = u.bomberStartX!;
        const sy = u.bomberStartY!;
        const ex = u.bomberEndX!;
        const ey = u.bomberEndY!;

        if (!u.bomberStartedRun) {
          const distStart = Math.hypot(sx - u.x, sy - u.y);
          if (distStart <= speed * 0.9) {
            u.x = sx;
            u.y = sy;
            u.bomberStartedRun = true;
            u.state = 'COMBAT';
            u.targetX = ex;
            u.targetY = ey;
          } else {
            const ang = Math.atan2(sy - u.y, sx - u.x);
            u.vx = Math.cos(ang) * speed;
            u.vy = Math.sin(ang) * speed;
            u.angle = ang;
            u.x += u.vx;
            u.y += u.vy;
          }
        } else {
          // Đang bay thẳng trên đoạn start -> end và rải bom
          const prevDistFromStart = Math.hypot(u.x - sx, u.y - sy);
          const distToEnd = Math.hypot(ex - u.x, ey - u.y);
          const totalLen = Math.hypot(ex - sx, ey - sy);
          const ang = totalLen > 0 ? Math.atan2(ey - sy, ex - sx) : 0;

          if (distToEnd <= speed * 1.05) {
            u.x = ex;
            u.y = ey;
            u.vx = 0;
            u.vy = 0;
            u.angle = ang;
            if (!u.bomberDroppedTerminal) {
              u.bomberDroppedTerminal = true;
              u.salvosLeft = 0;
              const tb = AIR_UNIT_SPECS.BOMBER.terminalBomb;
              applyAirStrikeImpact(ex, ey, owner, data, callbacks, {
                aoeRadius: tb.aoeRadius,
                troopDamage: Math.round(tb.troopDamage * bonuses.dmgMult),
                waveDamageRatio: tb.waveDamageRatio,
                minWaveDamage: Math.round(tb.minWaveDamage * bonuses.dmgMult),
                normalBuildingDamage: Math.round(tb.normalBuildingDamage * bonuses.dmgMult),
                superBuildingDamage: Math.round(tb.superBuildingDamage * bonuses.dmgMult),
                shipDamage: Math.round(tb.shipDamage * bonuses.dmgMult),
                titanDamage: Math.round(tb.titanDamage * bonuses.dmgMult),
                scorchSeconds: tb.scorchSeconds,
                blastKind: 'BOMB_LARGE',
                titanDmgMultiplier: AIR_SYSTEM_CONFIG.BOMBER_TITAN_DAMAGE_MULT,
              });
              callbacks.playExplosionSound?.();
            }
            transitionToReturnOrPatrol(u, ctx.basesByNation, owner);
          } else {
            u.vx = Math.cos(ang) * speed;
            u.vy = Math.sin(ang) * speed;
            u.angle = ang;
            u.x += u.vx;
            u.y += u.vy;

            const newDistFromStart = prevDistFromStart + speed;
            let nextDrop = u.bomberNextDropDist ?? AIR_SYSTEM_CONFIG.BOMBER_SMALL_BOMB_SPACING;
            let smallCount = 0;
            while (newDistFromStart >= nextDrop && nextDrop < totalLen - 1.2 && smallCount < 2) {
              const frac = totalLen > 0 ? nextDrop / totalLen : 0;
              const bx = sx + (ex - sx) * frac;
              const by = sy + (ey - sy) * frac;
              const sb = AIR_UNIT_SPECS.BOMBER.smallBomb;
              applyAirStrikeImpact(bx, by, owner, data, callbacks, {
                aoeRadius: sb.aoeRadius,
                troopDamage: Math.round(sb.troopDamage * bonuses.dmgMult),
                waveDamageRatio: sb.waveDamageRatio,
                minWaveDamage: Math.round(sb.minWaveDamage * bonuses.dmgMult),
                normalBuildingDamage: Math.round(sb.normalBuildingDamage * bonuses.dmgMult),
                superBuildingDamage: Math.round(sb.superBuildingDamage * bonuses.dmgMult),
                shipDamage: Math.round(sb.shipDamage * bonuses.dmgMult),
                titanDamage: Math.round(sb.titanDamage * bonuses.dmgMult),
                scorchSeconds: sb.scorchSeconds,
                blastKind: 'BOMB_SMALL',
                titanDmgMultiplier: AIR_SYSTEM_CONFIG.BOMBER_TITAN_DAMAGE_MULT,
              });
              nextDrop += AIR_SYSTEM_CONFIG.BOMBER_SMALL_BOMB_SPACING;
              smallCount++;
              callbacks.playAttackSound?.();
            }
            u.bomberNextDropDist = nextDrop;
          }
        }
        }
      }
    } else {
      // 2b. Type 1 (FIGHTER) & Type 2 (SQUADRON)
      const fSpec = u.type === 'FIGHTER' ? AIR_UNIT_SPECS.FIGHTER : AIR_UNIT_SPECS.SQUADRON;
      const offset = getFormationOffset(u);

      if (u.state === 'EN_ROUTE' || u.state === 'COMBAT' || u.state === 'PATROL') {
        // Ưu tiên 1: Đánh chặn máy bay địch đang bay trong tầm airAttackRange
        let engagedAirEnemy: AirUnit | null = null;
        let bestAirDist = Infinity;
        for (let j = 0; j < units.length; j++) {
          const other = units[j];
          if (!other || other.id === u.id || destroyedIds.has(other.id) || !isFlyingAirState(other.state)) continue;
          if (!isAtWar(owner, other.nationId)) continue;
          const d = Math.hypot(other.x - u.x, other.y - u.y);
          if (d <= fSpec.airAttackRange && d < bestAirDist) {
            bestAirDist = d;
            engagedAirEnemy = other;
          }
        }

        if (engagedAirEnemy && (!u.attackCooldown || u.attackCooldown <= 0)) {
          const a2aDmg = Math.round(fSpec.airToAirDamage * bonuses.dmgMult);
          engagedAirEnemy.hp = Math.max(0, engagedAirEnemy.hp - a2aDmg);
          u.attackCooldown = fSpec.attackCooldown;
          u.angle = Math.atan2(engagedAirEnemy.y - u.y, engagedAirEnemy.x - u.x);
          data.particles = data.particles || [];
          data.particles.push({
            x: u.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: u.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            targetX: engagedAirEnemy.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            targetY: engagedAirEnemy.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#38bdf8',
            size: 2,
            life: 10,
            maxLife: 10,
            vx: 0,
            vy: 0,
            type: 'LASER_BEAM',
          });
          callbacks.playAttackSound?.();
          if (engagedAirEnemy.hp <= 0) {
            destroyedIds.add(engagedAirEnemy.id);
            shootDownAirUnit(engagedAirEnemy, nations, data, callbacks, '✈️💥 Bị máy bay chiến đấu bắn hạ!');
          } else if (
            engagedAirEnemy.state !== 'RETURNING' &&
            engagedAirEnemy.hp < engagedAirEnemy.maxHp * AIR_SYSTEM_CONFIG.RETREAT_HP_RATIO
          ) {
            const enemyOwner = nations[engagedAirEnemy.nationId];
            if (engagedAirEnemy.type === 'SQUADRON' && engagedAirEnemy.squadronId) {
              for (let k = 0; k < units.length; k++) {
                const ally = units[k];
                if (ally && ally.squadronId === engagedAirEnemy.squadronId && isFlyingAirState(ally.state) && ally.state !== 'RETURNING' && enemyOwner) {
                  transitionToReturnOrPatrol(ally, ctx.basesByNation, enemyOwner);
                }
              }
            } else if (enemyOwner) {
              transitionToReturnOrPatrol(engagedAirEnemy, ctx.basesByNation, enemyOwner);
            }
          }
        }

        // Tìm/kiểm tra mục tiêu mặt đất / biển / Tà Thần / Boss (kể cả khi đang PATROL)
        const canScanWhilePatrol =
          u.state === 'PATROL' &&
          u.salvosLeft > 0 &&
          u.hp >= u.maxHp * AIR_SYSTEM_CONFIG.RETREAT_HP_RATIO &&
          !(
            u.type === 'SQUADRON' &&
            u.squadronId &&
            units.some(
              (m) =>
                m &&
                m.squadronId === u.squadronId &&
                (m.hp < m.maxHp * AIR_SYSTEM_CONFIG.RETREAT_HP_RATIO || m.salvosLeft <= 0)
            )
          );

        if (u.state !== 'PATROL' || canScanWhilePatrol) {
          const pCheck = u.state === 'PATROL' ? { x: u.x, y: u.y, stillValid: false } : validatePriorityTarget(u, owner, data);
          let aimX = pCheck.x;
          let aimY = pCheck.y;
          let hasTarget = pCheck.stillValid;

          if (!hasTarget) {
            u.priorityTargetX = undefined;
            u.priorityTargetY = undefined;
            u.priorityTargetKind = undefined;
            u.priorityTargetId = undefined;

            const scanned = findNextTargetForUnit(u, owner, data);
            if (scanned) {
              aimX = scanned.x;
              aimY = scanned.y;
              u.priorityTargetX = scanned.x;
              u.priorityTargetY = scanned.y;
              u.priorityTargetKind = scanned.kind;
              u.priorityTargetId = scanned.id;
              u.patrolAnchorX = undefined;
              u.patrolAnchorY = undefined;
              if (u.state === 'PATROL') u.state = 'EN_ROUTE';
              hasTarget = true;

              // Nếu là Tiểu Đội (Loại 2), đồng bộ mục tiêu cho cả đội hình
              if (u.type === 'SQUADRON' && u.squadronId) {
                for (let k = 0; k < units.length; k++) {
                  const ally = units[k];
                  if (
                    ally &&
                    ally.id !== u.id &&
                    ally.squadronId === u.squadronId &&
                    isFlyingAirState(ally.state) &&
                    ally.state !== 'RETURNING'
                  ) {
                    ally.priorityTargetX = scanned.x;
                    ally.priorityTargetY = scanned.y;
                    ally.priorityTargetKind = scanned.kind;
                    ally.priorityTargetId = scanned.id;
                    ally.patrolAnchorX = undefined;
                    ally.patrolAnchorY = undefined;
                    if (ally.state === 'PATROL') ally.state = 'EN_ROUTE';
                  }
                }
              }
            }
          }

          if (hasTarget && u.salvosLeft > 0) {
            const destX = aimX + offset.dx;
            const destY = aimY + offset.dy;
            u.targetX = destX;
            u.targetY = destY;
            const dToTarget = Math.hypot(aimX - u.x, aimY - u.y);

            if (dToTarget <= fSpec.attackRange) {
              u.state = 'COMBAT';
              u.vx = 0;
              u.vy = 0;
              u.angle = Math.atan2(aimY - u.y, aimX - u.x);
              if ((!u.attackCooldown || u.attackCooldown <= 0) && u.salvosLeft > 0) {
                u.salvosLeft -= 1;
                u.attackCooldown = fSpec.attackCooldown;
                applyAirStrikeImpact(aimX, aimY, owner, data, callbacks, {
                  aoeRadius: fSpec.aoeRadius,
                  troopDamage: Math.round(fSpec.troopDamage * bonuses.dmgMult),
                  waveDamageRatio: fSpec.waveDamageRatio,
                  minWaveDamage: Math.round(fSpec.minWaveDamage * bonuses.dmgMult),
                  normalBuildingDamage: Math.round(fSpec.normalBuildingDamage * bonuses.dmgMult),
                  superBuildingDamage: Math.round(fSpec.superBuildingDamage * bonuses.dmgMult),
                  shipDamage: Math.round(fSpec.shipDamage * bonuses.dmgMult),
                  titanDamage: Math.round(fSpec.titanDamage * bonuses.dmgMult),
                  scorchSeconds: fSpec.scorchSeconds,
                  blastKind: 'FIGHTER',
                });
                callbacks.playAttackSound?.();
                if (u.salvosLeft <= 0) {
                  if (u.type === 'SQUADRON' && u.squadronId) {
                    for (let k = 0; k < units.length; k++) {
                      const ally = units[k];
                      if (ally && ally.squadronId === u.squadronId && isFlyingAirState(ally.state)) {
                        transitionToReturnOrPatrol(ally, ctx.basesByNation, owner);
                      }
                    }
                  } else {
                    transitionToReturnOrPatrol(u, ctx.basesByNation, owner);
                  }
                }
              }
            } else {
              u.state = 'EN_ROUTE';
              const ang = Math.atan2(destY - u.y, destX - u.x);
              const moveLen = Math.min(speed, Math.hypot(destX - u.x, destY - u.y));
              u.vx = Math.cos(ang) * moveLen;
              u.vy = Math.sin(ang) * moveLen;
              u.angle = ang;
              u.x += u.vx;
              u.y += u.vy;
            }
          } else if (u.state !== 'PATROL') {
            if (u.type === 'SQUADRON' && u.squadronId) {
              for (let k = 0; k < units.length; k++) {
                const ally = units[k];
                if (ally && ally.squadronId === u.squadronId && isFlyingAirState(ally.state)) {
                  transitionToReturnOrPatrol(ally, ctx.basesByNation, owner);
                }
              }
            } else {
              transitionToReturnOrPatrol(u, ctx.basesByNation, owner);
            }
          }
        }

        if (u.state === 'PATROL') {
          // Tuần tra tự do trên bản đồ (không bay vòng quanh công trình cố định)
          const needNewWp =
            typeof u.patrolAnchorX !== 'number' ||
            typeof u.patrolAnchorY !== 'number' ||
            Math.hypot(u.patrolAnchorX - u.x, u.patrolAnchorY - u.y) <= Math.max(2.5, speed * 1.1);

          if (needNewWp) {
            const wp = pickPatrolWaypoint(u.x, u.y, tiles.length);
            u.patrolAnchorX = wp.x;
            u.patrolAnchorY = wp.y;
            if (u.type === 'SQUADRON' && u.squadronId) {
              for (let k = 0; k < units.length; k++) {
                const ally = units[k];
                if (ally && ally.id !== u.id && ally.squadronId === u.squadronId && ally.state === 'PATROL') {
                  ally.patrolAnchorX = wp.x;
                  ally.patrolAnchorY = wp.y;
                }
              }
            }
          }

          const wpX = (u.patrolAnchorX ?? u.x) + offset.dx;
          const wpY = (u.patrolAnchorY ?? u.y) + offset.dy;
          const distWp = Math.hypot(wpX - u.x, wpY - u.y);
          const ang = distWp > 0.01 ? Math.atan2(wpY - u.y, wpX - u.x) : (u.angle ?? 0);
          const moveLen = Math.min(speed * 0.85, distWp);
          u.vx = Math.cos(ang) * moveLen;
          u.vy = Math.sin(ang) * moveLen;
          u.angle = ang;
          u.x += u.vx;
          u.y += u.vy;
          u.targetX = wpX;
          u.targetY = wpY;
        }
      }
    }

    // 2c. Di chuyển về căn cứ (RETURNING) cho cả 3 loại
    if (u.state === 'RETURNING') {
      const bx = u.baseX ?? owner.capitalX;
      const by = u.baseY ?? owner.capitalY;
      const dBase = Math.hypot(bx - u.x, by - u.y);
      if (dBase <= speed * 1.05) {
        u.x = bx;
        u.y = by;
        u.vx = 0;
        u.vy = 0;
        u.state = 'RECOVERING';
        u.recoveryTimer = AIR_SYSTEM_CONFIG.BASE_RECOVERY_SECONDS;
        u.priorityTargetX = undefined;
        u.priorityTargetY = undefined;
        u.priorityTargetKind = undefined;
        u.priorityTargetId = undefined;
      } else {
        const ang = Math.atan2(by - u.y, bx - u.x);
        u.vx = Math.cos(ang) * speed;
        u.vy = Math.sin(ang) * speed;
        u.angle = ang;
        u.x += u.vx;
        u.y += u.vy;
        u.targetX = bx;
        u.targetY = by;
      }
    }

    // 3. Phòng Không (SAM / AIR_DEFENSE) đánh chặn máy bay đang bay qua (mỗi SAM bắn tối đa 1 phát/giây, bỏ giới hạn 2 phát/máy bay)
    if (isFlyingAirState(u.state) && samFired && ctx.sams.length > 0) {
      for (let si = 0; si < ctx.sams.length; si++) {
        if (samFired[si]) continue;
        const sam = ctx.sams[si];
        if (!isAtWar(owner, sam.nationId)) continue;
        const samOwner = nations[sam.nationId];
        const hasTech3B = samOwner?.techLevels?.defense === 3 && samOwner?.techChoices?.defense === 'B';
        const samRange = hasTech3B ? 6.0 : 5.0;
        const dSam = Math.hypot(sam.x - u.x, sam.y - u.y);
        if (dSam <= samRange) {
          samFired[si] = 1;
          const hitChance = hasTech3B ? AIR_SYSTEM_CONFIG.SAM_HIT_CHANCE_3B : AIR_SYSTEM_CONFIG.SAM_HIT_CHANCE_BASE;
          if (Math.random() < hitChance) {
            const samDmg = hasTech3B ? AIR_SYSTEM_CONFIG.SAM_TECH3B_DAMAGE : AIR_SYSTEM_CONFIG.SAM_BASE_DAMAGE;
            u.hp = Math.max(0, u.hp - samDmg);
            data.particles = data.particles || [];
            data.particles.push({
              x: sam.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: sam.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              targetX: u.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              targetY: u.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#10b981',
              size: 2,
              life: 12,
              maxLife: 12,
              vx: 0,
              vy: 0,
              type: 'LASER_BEAM',
            });
            if (u.hp <= 0) {
              destroyedIds.add(u.id);
              shootDownAirUnit(u, nations, data, callbacks, '🛡️ Bị Phòng Không (SAM) bắn hạ!');
              break;
            } else if (u.state !== 'RETURNING' && u.hp < u.maxHp * AIR_SYSTEM_CONFIG.RETREAT_HP_RATIO) {
              if (u.type === 'SQUADRON' && u.squadronId) {
                for (let k = 0; k < units.length; k++) {
                  const ally = units[k];
                  if (ally && ally.squadronId === u.squadronId && isFlyingAirState(ally.state) && ally.state !== 'RETURNING') {
                    transitionToReturnOrPatrol(ally, ctx.basesByNation, owner);
                  }
                }
              } else {
                transitionToReturnOrPatrol(u, ctx.basesByNation, owner);
              }
            }
          }
        }
      }
    }

    // 4. Vùng sát khí của Tà Thần (Dark Titan): bán kính 5 ô gây mất 14% máu tối đa/giây cho máy bay đang bay
    if (isFlyingAirState(u.state) && !destroyedIds.has(u.id) && activeTitans.length > 0) {
      let inTitanAura = false;
      for (let ti = 0; ti < activeTitans.length; ti++) {
        const titan = activeTitans[ti];
        if (!titan || !titan.isActive) continue;
        if (Math.hypot(titan.x - u.x, titan.y - u.y) <= 5) {
          inTitanAura = true;
          break;
        }
      }
      if (inTitanAura) {
        const auraDmg = Math.max(1, Math.round(u.maxHp * 0.10));
        u.hp = Math.max(0, u.hp - auraDmg);
        if (u.hp <= 0) {
          destroyedIds.add(u.id);
          shootDownAirUnit(u, nations, data, callbacks, 'Bị Tà Thần nghiền nát!');
        } else if (u.state !== 'RETURNING' && u.hp < u.maxHp * AIR_SYSTEM_CONFIG.RETREAT_HP_RATIO) {
          if (u.type === 'SQUADRON' && u.squadronId) {
            for (let k = 0; k < units.length; k++) {
              const ally = units[k];
              if (ally && ally.squadronId === u.squadronId && isFlyingAirState(ally.state) && ally.state !== 'RETURNING') {
                transitionToReturnOrPatrol(ally, ctx.basesByNation, owner);
              }
            }
          } else {
            transitionToReturnOrPatrol(u, ctx.basesByNation, owner);
          }
        }
      }
    }
  }

  if (destroyedIds.size > 0) {
    data.airUnits = units.filter((u) => !destroyedIds.has(u.id));
  }
}
