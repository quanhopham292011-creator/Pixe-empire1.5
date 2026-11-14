import { useCallback } from 'react';
import { Nation, SeaTradeRoute, SeaTradeShip, Tile } from '../types';
import { soundManager } from '../utils/audio';
import { TILE_PIXEL_SIZE, formatGameTime } from '../utils/constants';

export interface PortInfo {
  x: number;
  y: number;
  owner: number;
  nation: Nation;
}

const MAX_ROUTES_PER_NATION = 4;
const ROUTE_DIMINISHING_MULTS = [1.0, 0.65, 0.42, 0.25];

/**
 * Đếm số đồng minh thực tế còn tồn tại, chưa bị loại và có trạng thái ALLIANCE hợp lệ hai chiều.
 */
export function countActiveAlliances(nation: Nation | undefined, nations: Nation[]): number {
  if (!nation || nation.isEliminated || !nation.diplomacy || !Array.isArray(nations)) return 0;
  let count = 0;
  for (const key of Object.keys(nation.diplomacy)) {
    const otherId = Number(key);
    if (!Number.isFinite(otherId) || otherId <= 0 || otherId === nation.id) continue;
    const dip = nation.diplomacy[otherId];
    if (!dip || dip.status !== 'ALLIANCE') continue;
    const other = nations[otherId];
    if (!other || other.isEliminated) continue;
    if (other.diplomacy?.[nation.id]?.status !== 'ALLIANCE') continue;
    count++;
  }
  return count;
}

/**
 * Đồng bộ và dọn sạch các trạng thái ALLIANCE bị lệch pha hoặc trỏ tới quốc gia đã bị loại.
 */
export function reconcileNationAlliances(nation: Nation | undefined, nations: Nation[]): boolean {
  if (!nation || !nation.diplomacy || !Array.isArray(nations)) return false;
  let changed = false;

  for (const key of Object.keys(nation.diplomacy)) {
    const otherId = Number(key);
    if (!Number.isFinite(otherId) || otherId <= 0 || otherId === nation.id) continue;
    const dip = nation.diplomacy[otherId];
    if (!dip) continue;

    const other = nations[otherId];
    if (nation.isEliminated || !other || other.isEliminated) {
      if (dip.status === 'ALLIANCE' || dip.status === 'TRUCE') {
        nation.diplomacy[otherId] = { status: 'WAR', relation: 0, truceTimer: 0 };
        changed = true;
      }
      if (other && other.diplomacy?.[nation.id] && (other.diplomacy[nation.id].status === 'ALLIANCE' || other.diplomacy[nation.id].status === 'TRUCE')) {
        other.diplomacy[nation.id] = { status: 'WAR', relation: 0, truceTimer: 0 };
        changed = true;
      }
      continue;
    }

    const otherDip = other.diplomacy?.[nation.id];
    if (dip.status === 'ALLIANCE' && otherDip?.status !== 'ALLIANCE') {
      // Mất đồng bộ 1 chiều -> dọn sạch về trạng thái hợp lệ chung
      const fallbackStatus = otherDip?.status === 'TRUCE' && (otherDip.truceTimer || 0) > 0 ? 'TRUCE' : 'WAR';
      const fallbackTimer = fallbackStatus === 'TRUCE' ? otherDip!.truceTimer : 0;
      nation.diplomacy[otherId] = { status: fallbackStatus, relation: fallbackStatus === 'TRUCE' ? 30 : 0, truceTimer: fallbackTimer };
      if (!other.diplomacy) other.diplomacy = {};
      if (fallbackStatus === 'WAR') {
        other.diplomacy[nation.id] = { status: 'WAR', relation: 0, truceTimer: 0 };
      }
      changed = true;
    }
  }

  return changed;
}

/**
 * Khi một quốc gia bị loại, giải phóng ngay toàn bộ suất liên minh/đình chiến,
 * dọn lời mời cũ và xóa các tuyến/tàu buôn gắn với quốc gia đó.
 */
export function cleanupEliminatedNationDiplomacy(eliminatedId: number, nations: Nation[], data?: any): void {
  if (!Array.isArray(nations) || eliminatedId <= 0) return;
  const eliminated = nations[eliminatedId];

  if (eliminated) {
    eliminated.allianceInvites = [];
    if (eliminated.diplomacy) {
      for (const key of Object.keys(eliminated.diplomacy)) {
        const otherId = Number(key);
        if (eliminated.diplomacy[otherId] && eliminated.diplomacy[otherId].status !== 'WAR') {
          eliminated.diplomacy[otherId] = { status: 'WAR', relation: 0, truceTimer: 0 };
        }
      }
    }
  }

  for (const other of nations) {
    if (!other || other.id === eliminatedId) continue;
    if (other.diplomacy?.[eliminatedId] && other.diplomacy[eliminatedId].status !== 'WAR') {
      other.diplomacy[eliminatedId] = { status: 'WAR', relation: 0, truceTimer: 0 };
    }
    if (Array.isArray(other.allianceInvites) && other.allianceInvites.length > 0) {
      other.allianceInvites = other.allianceInvites.filter(inv => inv.senderNationId !== eliminatedId);
    }
  }

  if (data) {
    if (Array.isArray(data.tradeRoutes)) {
      data.tradeRoutes = data.tradeRoutes.filter(
        (r: SeaTradeRoute) => r.fromNation !== eliminatedId && r.toNation !== eliminatedId
      );
    }
    if (Array.isArray(data.tradeShips)) {
      data.tradeShips = data.tradeShips.filter(
        (s: SeaTradeShip) => s.fromNation !== eliminatedId && s.toNation !== eliminatedId
      );
    }
  }
}

export function collectPortList(tiles: Tile[][] | undefined, nations: Nation[] | undefined): PortInfo[] {
  const ports: PortInfo[] = [];
  if (!Array.isArray(tiles) || !Array.isArray(nations)) return ports;
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const t = row[x];
      if (!t || t.building !== 'PORT') continue;
      if (t.inactiveTimer && t.inactiveTimer > 0) continue;
      const nat = nations[t.owner];
      if (nat && !nat.isEliminated && t.owner > 0) {
        ports.push({ x, y, owner: t.owner, nation: nat });
      }
    }
  }
  return ports;
}

export function getTradeRouteEfficiency(routeIndex: number): number {
  if (routeIndex <= 0) return ROUTE_DIMINISHING_MULTS[0];
  if (routeIndex < ROUTE_DIMINISHING_MULTS.length) return ROUTE_DIMINISHING_MULTS[routeIndex];
  return Math.max(0.18, 0.25 * Math.pow(0.75, routeIndex - 3));
}

export function computeShipCargoForNation(
  baseCargo: number,
  nationId: number,
  routeIndex: number,
  gameTimeSeconds: number
): number {
  const eff = getTradeRouteEfficiency(routeIndex);
  // Chỉ giảm nhẹ giai đoạn đầu (< 300s) cho người chơi để tránh cộng dồn quá mạnh; giữa/cuối game giữ nguyên và tăng nhẹ về cuối trận
  const phaseMult =
    gameTimeSeconds >= 600
      ? 1.20
      : nationId === 1 && gameTimeSeconds < 300
        ? 0.62
        : 1.0;
  return Math.max(3, Math.round(baseCargo * phaseMult * eff));
}

export function syncBalancedTradeRoutes(data: any, portList: PortInfo[]): void {
  if (!data) return;
  data.tradeRoutes = data.tradeRoutes || [];
  data.tradeShips = data.tradeShips || [];
  const nations: Nation[] = Array.isArray(data.nations) ? data.nations : [];
  const gameTimeSeconds = data.gameTimeSeconds || 0;

  // 1. Gom tối đa 1 tuyến tốt nhất cho mỗi cặp quốc gia (loại bỏ tự giao thương, nước đã bị loại và trùng lặp nhiều cảng)
  const bestPairMap = new Map<
    string,
    {
      idA: number;
      idB: number;
      pA: PortInfo;
      pB: PortInfo;
      dist: number;
      isAlliance: boolean;
      isIntercontinental: boolean;
    }
  >();

  for (let i = 0; i < portList.length; i++) {
    for (let j = i + 1; j < portList.length; j++) {
      const p1 = portList[i];
      const p2 = portList[j];
      if (!p1 || !p2 || p1.owner <= 0 || p2.owner <= 0 || p1.owner === p2.owner) continue;
      if (!p1.nation || !p2.nation || p1.nation.isEliminated || p2.nation.isEliminated) continue;

      const dip1 = p1.nation?.diplomacy?.[p2.owner]?.status || 'WAR';
      const dip2 = p2.nation?.diplomacy?.[p1.owner]?.status || 'WAR';
      if (dip1 === 'WAR' || dip2 === 'WAR') continue;

      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist < 4) continue;

      const [idA, pA, idB, pB] = p1.owner < p2.owner ? [p1.owner, p1, p2.owner, p2] : [p2.owner, p2, p1.owner, p1];
      const pairKey = `${idA}_${idB}`;
      const isAlliance = dip1 === 'ALLIANCE' && dip2 === 'ALLIANCE';
      const isIntercontinental = dist > 10;

      const existing = bestPairMap.get(pairKey);
      if (!existing || (isAlliance && !existing.isAlliance) || (isAlliance === existing.isAlliance && dist > existing.dist)) {
        bestPairMap.set(pairKey, { idA, idB, pA, pB, dist, isAlliance, isIntercontinental });
      }
    }
  }

  // 2. Ưu tiên tuyến Đồng Minh trước rồi mới tới Đình Chiến, giới hạn mềm số tuyến hiệu lực mỗi nước
  const candidates = Array.from(bestPairMap.values()).sort((a, b) => {
    if (a.isAlliance !== b.isAlliance) return a.isAlliance ? -1 : 1;
    return b.dist - a.dist;
  });

  const routeCountByNation: Record<number, number> = {};
  const updatedRoutes: SeaTradeRoute[] = [];
  const routeMeta = new Map<
    string,
    { fromCargoGold: number; toCargoGold: number; displayCargoGold: number; targetShips: number }
  >();

  for (const cand of candidates) {
    const countA = routeCountByNation[cand.idA] || 0;
    const countB = routeCountByNation[cand.idB] || 0;
    if (countA >= MAX_ROUTES_PER_NATION || countB >= MAX_ROUTES_PER_NATION) continue;

    routeCountByNation[cand.idA] = countA + 1;
    routeCountByNation[cand.idB] = countB + 1;

    const routeId = `route_${cand.idA}_${cand.idB}`;
    const route: SeaTradeRoute = {
      id: routeId,
      fromNation: cand.idA,
      toNation: cand.idB,
      fromPortX: cand.pA.x,
      fromPortY: cand.pA.y,
      toPortX: cand.pB.x,
      toPortY: cand.pB.y,
      distanceTiles: Math.round(cand.dist),
      isIntercontinental: cand.isIntercontinental,
    };
    updatedRoutes.push(route);

    const baseCargo = route.isIntercontinental ? 45 : 15;
    const fromCargoGold = computeShipCargoForNation(baseCargo, cand.idA, countA, gameTimeSeconds);
    const toCargoGold = computeShipCargoForNation(baseCargo, cand.idB, countB, gameTimeSeconds);
    const displayCargoGold =
      cand.idA === 1
        ? fromCargoGold
        : cand.idB === 1
          ? toCargoGold
          : Math.round((fromCargoGold + toCargoGold) / 2);

    const involvesPlayerEarly = (cand.idA === 1 || cand.idB === 1) && gameTimeSeconds < 300;
    const targetShips = route.isIntercontinental && !involvesPlayerEarly ? 2 : 1;

    routeMeta.set(routeId, { fromCargoGold, toCargoGold, displayCargoGold, targetShips });
  }

  data.tradeRoutes = updatedRoutes;

  // 3. Đồng bộ tàu buôn theo tuyến hợp lệ (chống trùng tàu, loại tàu thuộc nước đã bị loại, cập nhật tọa độ cảng và giá trị hàng hóa)
  const validRouteMap = new Map<string, SeaTradeRoute>();
  updatedRoutes.forEach(r => validRouteMap.set(r.id, r));

  const seenShipIds = new Set<string>();
  const keptShipsByRoute = new Map<string, SeaTradeShip[]>();

  for (const ship of data.tradeShips as SeaTradeShip[]) {
    if (!ship || !ship.id || seenShipIds.has(ship.id)) continue;
    if (ship.fromNation === ship.toNation) continue;
    if (nations.length > 0) {
      const fNat = nations[ship.fromNation];
      const tNat = nations[ship.toNation];
      if (!fNat || !tNat || fNat.isEliminated || tNat.isEliminated) continue;
    }

    const minId = Math.min(ship.fromNation, ship.toNation);
    const maxId = Math.max(ship.fromNation, ship.toNation);
    const canonicalRouteId = `route_${minId}_${maxId}`;
    const matchedRoute = validRouteMap.get(ship.routeId) || validRouteMap.get(canonicalRouteId);
    if (!matchedRoute) continue;

    const meta = routeMeta.get(matchedRoute.id);
    if (!meta) continue;

    const list = keptShipsByRoute.get(matchedRoute.id) || [];
    if (list.length >= meta.targetShips) continue;

    const travelDurationSeconds = Math.max(8, Math.min(22, matchedRoute.distanceTiles * 0.7));
    const matchesForward =
      ship.sourceX === matchedRoute.fromPortX &&
      ship.sourceY === matchedRoute.fromPortY &&
      ship.targetX === matchedRoute.toPortX &&
      ship.targetY === matchedRoute.toPortY;
    const matchesReverse =
      ship.sourceX === matchedRoute.toPortX &&
      ship.sourceY === matchedRoute.toPortY &&
      ship.targetX === matchedRoute.fromPortX &&
      ship.targetY === matchedRoute.fromPortY;

    if (!matchesForward && !matchesReverse) {
      ship.fromNation = matchedRoute.fromNation;
      ship.toNation = matchedRoute.toNation;
      ship.sourceX = matchedRoute.fromPortX;
      ship.sourceY = matchedRoute.fromPortY;
      ship.targetX = matchedRoute.toPortX;
      ship.targetY = matchedRoute.toPortY;
    }
    ship.speed = 1 / travelDurationSeconds;
    ship.routeId = matchedRoute.id;
    ship.cargoGold = meta.displayCargoGold;
    if (ship.fromNation === matchedRoute.fromNation) {
      ship.fromCargoGold = meta.fromCargoGold;
      ship.toCargoGold = meta.toCargoGold;
    } else {
      ship.fromCargoGold = meta.toCargoGold;
      ship.toCargoGold = meta.fromCargoGold;
    }
    ship.isIntercontinental = matchedRoute.isIntercontinental;

    seenShipIds.add(ship.id);
    list.push(ship);
    keptShipsByRoute.set(matchedRoute.id, list);
  }

  const nextShips: SeaTradeShip[] = [];
  updatedRoutes.forEach(route => {
    const meta = routeMeta.get(route.id)!;
    const list = keptShipsByRoute.get(route.id) || [];
    const travelDurationSeconds = Math.max(8, Math.min(22, route.distanceTiles * 0.7));

    while (list.length < meta.targetShips) {
      const initialProgress = list.length === 1 ? 0.5 : 0;
      list.push({
        id: `${route.id}_${Date.now()}_${list.length}_${Math.random().toString(36).slice(2, 7)}`,
        routeId: route.id,
        fromNation: route.fromNation,
        toNation: route.toNation,
        sourceX: route.fromPortX,
        sourceY: route.fromPortY,
        targetX: route.toPortX,
        targetY: route.toPortY,
        progress: initialProgress,
        speed: 1 / travelDurationSeconds,
        cargoGold: meta.displayCargoGold,
        fromCargoGold: meta.fromCargoGold,
        toCargoGold: meta.toCargoGold,
        isIntercontinental: route.isIntercontinental,
      });
    }
    nextShips.push(...list);
  });

  data.tradeShips = nextShips;
}

export function useTradeRoutes(gameDataRef: React.MutableRefObject<any>) {
  const updateTradeRoutes = useCallback((isEightSec: boolean, portList: PortInfo[]) => {
    if (!isEightSec) return;
    const data = gameDataRef.current;
    if (!data) return;
    syncBalancedTradeRoutes(data, portList);
  }, [gameDataRef]);

  const lootTradeShip = useCallback((mapX: number, mapY: number): boolean => {
    const data = gameDataRef.current;
    if (!data || !data.tradeShips || data.tradeShips.length === 0) return false;

    let lootedShipIdx = -1;
    for (let i = 0; i < data.tradeShips.length; i++) {
      const ship: SeaTradeShip = data.tradeShips[i];
      const curShipX = ship.sourceX + (ship.targetX - ship.sourceX) * ship.progress;
      const curShipY = ship.sourceY + (ship.targetY - ship.sourceY) * ship.progress;
      const dist = Math.hypot(curShipX - mapX, curShipY - mapY);
      if (dist <= 1.8) {
        lootedShipIdx = i;
        break;
      }
    }

    if (lootedShipIdx >= 0) {
      const ship: SeaTradeShip = data.tradeShips[lootedShipIdx];
      const player = data.nations[1];
      if (!player) return false;

      const lootGold = Math.round((ship.cargoGold || 0) * 1.0);
      player.gold += lootGold;

      soundManager.playCapture();

      const curShipX = ship.sourceX + (ship.targetX - ship.sourceX) * ship.progress;
      const curShipY = ship.sourceY + (ship.targetY - ship.sourceY) * ship.progress;

      data.particles.push({
        x: curShipX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: curShipY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#fbbf24',
        size: 0, life: 55, maxLife: 55, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT',
        text: `🏴‍☠️ CƯỚP TÀU BUÔN! +${lootGold} Vàng`
      });

      for (let p = 0; p < 8; p++) {
        data.particles.push({
          x: curShipX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          y: curShipY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          color: '#fbbf24',
          size: 3, life: 25, maxLife: 25,
          vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
          type: 'SPARK'
        });
      }

      data.events.unshift({
        id: Math.random().toString(),
        title: '🏴‍☠️ Cướp Biển Tấn Công',
        description: `Đã cướp bóc thành công tàu buôn hải cảng, thu giữ ${lootGold} Vàng!`,
        type: 'HARVEST',
        targetNationId: 1,
        timestamp: formatGameTime(data.gameTimeSeconds),
      });

      data.tradeShips.splice(lootedShipIdx, 1);
      return true;
    }

    return false;
  }, [gameDataRef]);

  return { updateTradeRoutes, lootTradeShip };
}
