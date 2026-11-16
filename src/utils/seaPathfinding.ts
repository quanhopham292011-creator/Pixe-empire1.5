import { Nation, SeaTradeRoute, SeaTradeShip, Tile } from '../types';

export interface SeaWaypoint {
  x: number;
  y: number;
}

export interface PopulationShipScale {
  tier: 1 | 2 | 3;
  label: 'Nhỏ' | 'Vừa' | 'Lớn';
  hpAndCapMult: number; // 1.0, 1.25, 1.50 (capped at +50%)
  extractMult: number;  // 1.0, 1.08, 1.15
  combatMult: number;   // 1.0, 1.12, 1.25
  visualScale: number;  // 1.0, 1.12, 1.24
}

/**
 * Quy mô tàu theo dân số quốc gia (3 bậc: Nhỏ / Vừa / Lớn).
 * Mỗi bậc +25% HP & sức chứa (tối đa +50%), tốc độ KHÔNG đổi.
 */
export function getShipPopulationScale(nation?: Nation | null): PopulationShipScale {
  const pop = nation?.population || 0;
  if (pop >= 350) {
    return {
      tier: 3,
      label: 'Lớn',
      hpAndCapMult: 1.5,
      extractMult: 1.15,
      combatMult: 1.25,
      visualScale: 1.22,
    };
  }
  if (pop >= 120) {
    return {
      tier: 2,
      label: 'Vừa',
      hpAndCapMult: 1.25,
      extractMult: 1.08,
      combatMult: 1.12,
      visualScale: 1.11,
    };
  }
  return {
    tier: 1,
    label: 'Nhỏ',
    hpAndCapMult: 1.0,
    extractMult: 1.0,
    combatMult: 1.0,
    visualScale: 1.0,
  };
}

export interface WaterMapInfo {
  size: number;
  compGrid: Int32Array; // -1 nếu là đất, >= 0 là ID vùng nước liên thông
  compSizes: number[];  // số lượng ô nước của từng vùng
  minOpenOceanTiles: number;
  pathCache: Map<string, { waypoints: SeaWaypoint[]; length: number } | null>;
}

const waterInfoCache = new WeakMap<Tile[][], WaterMapInfo>();

export function invalidateWaterMapCache(tiles: Tile[][] | undefined): void {
  if (tiles) waterInfoCache.delete(tiles);
}

const D4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

const D8 = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const;

export function getWaterMapInfo(tiles: Tile[][]): WaterMapInfo {
  const cached = waterInfoCache.get(tiles);
  if (cached && cached.size === tiles.length) return cached;

  const size = tiles.length;
  const total = size * size;
  const compGrid = new Int32Array(total);
  compGrid.fill(-1);
  const compSizes: number[] = [];
  const queue = new Int32Array(total);

  for (let y = 0; y < size; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (compGrid[idx] !== -1) continue;
      const t = row[x];
      if (!t || t.terrain !== 'WATER') continue;

      const compId = compSizes.length;
      let head = 0;
      let tail = 0;
      queue[tail++] = idx;
      compGrid[idx] = compId;

      while (head < tail) {
        const cur = queue[head++];
        const cx = cur % size;
        const cy = (cur - cx) / size;
        for (let k = 0; k < 4; k++) {
          const nx = cx + D4[k][0];
          const ny = cy + D4[k][1];
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          const nIdx = ny * size + nx;
          if (compGrid[nIdx] !== -1) continue;
          if (tiles[ny]?.[nx]?.terrain === 'WATER') {
            compGrid[nIdx] = compId;
            queue[tail++] = nIdx;
          }
        }
      }

      compSizes.push(tail);
    }
  }

  // Biển mở phải đủ rộng; ao/hồ kín trong đất liền có diện tích nhỏ hơn ngưỡng sẽ bị coi là vùng nước kín
  const minOpenOceanTiles = Math.max(25, Math.floor(size * 0.45));
  const info: WaterMapInfo = {
    size,
    compGrid,
    compSizes,
    minOpenOceanTiles,
    pathCache: new Map(),
  };
  waterInfoCache.set(tiles, info);
  return info;
}

export interface PortWaterAccess {
  adjacentWater: { x: number; y: number; compId: number; isOpen: boolean }[];
  openCompIds: number[];
  isEnclosed: boolean;
  localLoop: SeaWaypoint[] | null;
}

/**
 * Kiểm tra cảng có tiếp giáp biển mở hay nằm ở hồ/ao kín không thông biển.
 */
export function getPortWaterAccess(tiles: Tile[][], portX: number, portY: number): PortWaterAccess {
  const info = getWaterMapInfo(tiles);
  const { size, compGrid, compSizes, minOpenOceanTiles } = info;
  const adjacentWater: { x: number; y: number; compId: number; isOpen: boolean }[] = [];
  const openSet = new Set<number>();

  // Kiểm tra 4 hướng trực tiếp trước
  for (let k = 0; k < 4; k++) {
    const nx = portX + D4[k][0];
    const ny = portY + D4[k][1];
    if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
    const cid = compGrid[ny * size + nx];
    if (cid >= 0) {
      const isOpen = (compSizes[cid] || 0) >= minOpenOceanTiles;
      adjacentWater.push({ x: nx, y: ny, compId: cid, isOpen });
      if (isOpen) openSet.add(cid);
    }
  }

  // Fallback 8 hướng nếu cảng chéo góc biển
  if (adjacentWater.length === 0) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = portX + dx;
        const ny = portY + dy;
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        const cid = compGrid[ny * size + nx];
        if (cid >= 0) {
          const isOpen = (compSizes[cid] || 0) >= minOpenOceanTiles;
          adjacentWater.push({ x: nx, y: ny, compId: cid, isOpen });
          if (isOpen) openSet.add(cid);
        }
      }
    }
  }

  const openCompIds = Array.from(openSet);
  const isEnclosed = openCompIds.length === 0;

  let localLoop: SeaWaypoint[] | null = null;
  if (isEnclosed && adjacentWater.length > 0) {
    // Tạo vòng lặp nhỏ trên mặt nước kín cho tàu địa phương chạy quanh (không thu vàng)
    const cid = adjacentWater[0].compId;
    const pts: SeaWaypoint[] = [{ x: adjacentWater[0].x, y: adjacentWater[0].y }];
    const visited = new Set<number>([adjacentWater[0].y * size + adjacentWater[0].x]);
    for (let i = 0; i < pts.length && pts.length < 6; i++) {
      const p = pts[i];
      for (let k = 0; k < 4; k++) {
        const nx = p.x + D4[k][0];
        const ny = p.y + D4[k][1];
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        const nIdx = ny * size + nx;
        if (!visited.has(nIdx) && compGrid[nIdx] === cid) {
          visited.add(nIdx);
          pts.push({ x: nx, y: ny });
          if (pts.length >= 6) break;
        }
      }
    }
    if (pts.length >= 2) {
      localLoop = [...pts, pts[0]];
    }
  }

  return { adjacentWater, openCompIds, isEnclosed, localLoop };
}

/**
 * Kiểm tra đoạn thẳng nối từ (x0,y0) đến (x1,y1) có đi hoàn toàn qua ô WATER không (chặt chẽ, không cắt góc đất).
 */
function hasWaterLineOfSight(
  tiles: Tile[][],
  size: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(4, Math.ceil(dist * 8));
  if (dist === 0) return tiles[Math.round(y0)]?.[Math.round(x0)]?.terrain === 'WATER';

  let prevGx = Math.round(x0);
  let prevGy = Math.round(y0);
  if (prevGx < 0 || prevGx >= size || prevGy < 0 || prevGy >= size) return false;
  if (tiles[prevGy]?.[prevGx]?.terrain !== 'WATER') return false;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const fx = x0 + (x1 - x0) * t;
    const fy = y0 + (y1 - y0) * t;
    const gx = Math.round(fx);
    const gy = Math.round(fy);
    if (gx < 0 || gx >= size || gy < 0 || gy >= size) return false;
    if (tiles[gy]?.[gx]?.terrain !== 'WATER') return false;

    // Nếu bước sang ô chéo, cả 2 ô góc vuông kề phải đều là WATER (chống cắt góc qua đất)
    if (gx !== prevGx && gy !== prevGy) {
      if (tiles[prevGy]?.[gx]?.terrain !== 'WATER' || tiles[gy]?.[prevGx]?.terrain !== 'WATER') {
        return false;
      }
    }

    // Khi nằm giữa ranh giới 2 trục (đoạn chéo), kiểm tra cả 4 ô bao quanh để tránh sượt góc đất
    const fracX = Math.abs(fx - Math.round(fx));
    const fracY = Math.abs(fy - Math.round(fy));
    if (fracX > 0.24 && fracY > 0.24) {
      const fxFloor = Math.floor(fx);
      const fxCeil = Math.ceil(fx);
      const fyFloor = Math.floor(fy);
      const fyCeil = Math.ceil(fy);
      if (
        tiles[fyFloor]?.[fxFloor]?.terrain !== 'WATER' ||
        tiles[fyFloor]?.[fxCeil]?.terrain !== 'WATER' ||
        tiles[fyCeil]?.[fxFloor]?.terrain !== 'WATER' ||
        tiles[fyCeil]?.[fxCeil]?.terrain !== 'WATER'
      ) {
        return false;
      }
    }

    prevGx = gx;
    prevGy = gy;
  }
  return true;
}

/**
 * Thu gọn danh sách ô nước thành các điểm rẽ mượt mà nhưng vẫn bảo đảm đi 100% trên WATER.
 */
function smoothWaterWaypoints(tiles: Tile[][], rawWaterPath: SeaWaypoint[]): SeaWaypoint[] {
  if (rawWaterPath.length <= 2) return rawWaterPath;
  const size = tiles.length;
  const result: SeaWaypoint[] = [rawWaterPath[0]];
  let anchorIdx = 0;

  while (anchorIdx < rawWaterPath.length - 1) {
    let furthest = anchorIdx + 1;
    // Tìm điểm xa nhất còn nhìn thấy thẳng qua WATER
    for (let test = rawWaterPath.length - 1; test > anchorIdx + 1; test--) {
      if (
        hasWaterLineOfSight(
          tiles,
          size,
          rawWaterPath[anchorIdx].x,
          rawWaterPath[anchorIdx].y,
          rawWaterPath[test].x,
          rawWaterPath[test].y
        )
      ) {
        furthest = test;
        break;
      }
    }
    result.push(rawWaterPath[furthest]);
    anchorIdx = furthest;
  }

  return result;
}

/**
 * Tìm đường đi trên biển (WATER) giữa 2 điểm bất kỳ (điểm đầu/cuối có thể là cảng ven biển hoặc ô nước).
 * Dùng Min-Heap A* trên ô WATER + string-pulling + cache theo cặp tọa độ.
 */
export function findSeaPath(
  tiles: Tile[][],
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  allowEnclosed: boolean = false
): { waypoints: SeaWaypoint[]; length: number } | null {
  if (!Array.isArray(tiles) || tiles.length === 0) return null;
  const size = tiles.length;
  const sx = Math.max(0, Math.min(size - 1, Math.round(startX)));
  const sy = Math.max(0, Math.min(size - 1, Math.round(startY)));
  const ex = Math.max(0, Math.min(size - 1, Math.round(endX)));
  const ey = Math.max(0, Math.min(size - 1, Math.round(endY)));

  if (sx === ex && sy === ey) {
    return { waypoints: [{ x: sx, y: sy }], length: 0 };
  }

  const info = getWaterMapInfo(tiles);
  const cacheKey = `${sx},${sy}->${ex},${ey}:${allowEnclosed ? 1 : 0}`;
  if (info.pathCache.has(cacheKey)) {
    return info.pathCache.get(cacheKey) || null;
  }

  // Xác định các ô nước xuất phát và ô nước cập bến
  const collectWaterStarts = (cx: number, cy: number): number[] => {
    const t = tiles[cy]?.[cx];
    if (t && t.terrain === 'WATER') {
      return [cy * size + cx];
    }
    const list: number[] = [];
    for (let k = 0; k < 8; k++) {
      const nx = cx + D8[k][0];
      const ny = cy + D8[k][1];
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        if (tiles[ny]?.[nx]?.terrain === 'WATER') {
          list.push(ny * size + nx);
        }
      }
    }
    return list;
  };

  const startWaters = collectWaterStarts(sx, sy);
  const endWaters = collectWaterStarts(ex, ey);
  if (startWaters.length === 0 || endWaters.length === 0) {
    info.pathCache.set(cacheKey, null);
    return null;
  }

  // Kiểm tra 2 đầu có chung vùng nước liên thông (và vùng nước đó là biển mở nếu !allowEnclosed)
  const validComps = new Set<number>();
  for (const sw of startWaters) {
    const sc = info.compGrid[sw];
    if (sc < 0) continue;
    if (!allowEnclosed && (info.compSizes[sc] || 0) < info.minOpenOceanTiles) continue;
    for (const ew of endWaters) {
      if (info.compGrid[ew] === sc) {
        validComps.add(sc);
      }
    }
  }
  if (validComps.size === 0) {
    info.pathCache.set(cacheKey, null);
    return null;
  }

  const endWaterSet = new Set<number>();
  let bestEndWater = endWaters[0];
  for (const ew of endWaters) {
    if (validComps.has(info.compGrid[ew])) {
      endWaterSet.add(ew);
      bestEndWater = ew;
    }
  }
  const endWx = bestEndWater % size;
  const endWy = (bestEndWater - endWx) / size;

  const total = size * size;
  const gScore = new Float32Array(total);
  gScore.fill(1e9);
  const parent = new Int32Array(total);
  parent.fill(-1);
  const closed = new Uint8Array(total);

  // Min-heap lưu (nodeIdx, fScore)
  const heapNode: number[] = [];
  const heapF: number[] = [];
  const pushHeap = (idx: number, f: number) => {
    let pos = heapNode.length;
    heapNode.push(idx);
    heapF.push(f);
    while (pos > 0) {
      const p = (pos - 1) >> 1;
      if (heapF[p] <= heapF[pos]) break;
      const tn = heapNode[p]; heapNode[p] = heapNode[pos]; heapNode[pos] = tn;
      const tf = heapF[p]; heapF[p] = heapF[pos]; heapF[pos] = tf;
      pos = p;
    }
  };
  const popHeap = (): number => {
    const top = heapNode[0];
    const lastN = heapNode.pop()!;
    const lastF = heapF.pop()!;
    if (heapNode.length > 0) {
      heapNode[0] = lastN;
      heapF[0] = lastF;
      let pos = 0;
      const len = heapNode.length;
      while (true) {
        let smallest = pos;
        const l = pos * 2 + 1;
        const r = pos * 2 + 2;
        if (l < len && heapF[l] < heapF[smallest]) smallest = l;
        if (r < len && heapF[r] < heapF[smallest]) smallest = r;
        if (smallest === pos) break;
        const tn = heapNode[pos]; heapNode[pos] = heapNode[smallest]; heapNode[smallest] = tn;
        const tf = heapF[pos]; heapF[pos] = heapF[smallest]; heapF[smallest] = tf;
        pos = smallest;
      }
    }
    return top;
  };

  for (const sw of startWaters) {
    if (!validComps.has(info.compGrid[sw])) continue;
    const wx = sw % size;
    const wy = (sw - wx) / size;
    const initCost = Math.hypot(wx - sx, wy - sy);
    gScore[sw] = initCost;
    const h = Math.hypot(endWx - wx, endWy - wy);
    pushHeap(sw, initCost + h);
  }

  let foundEndWater = -1;
  while (heapNode.length > 0) {
    const cur = popHeap();
    if (closed[cur]) continue;
    closed[cur] = 1;

    if (endWaterSet.has(cur)) {
      foundEndWater = cur;
      break;
    }

    const cx = cur % size;
    const cy = (cur - cx) / size;
    const curG = gScore[cur];

    for (let k = 0; k < 8; k++) {
      const dx = D8[k][0];
      const dy = D8[k][1];
      const stepCost = D8[k][2];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
      const nIdx = ny * size + nx;
      if (closed[nIdx]) continue;
      if (!validComps.has(info.compGrid[nIdx])) continue;

      // Chặn cắt góc qua ô đất khi đi chéo
      if (dx !== 0 && dy !== 0) {
        if (tiles[cy]?.[nx]?.terrain !== 'WATER' || tiles[ny]?.[cx]?.terrain !== 'WATER') {
          continue;
        }
      }

      const ng = curG + stepCost;
      if (ng < gScore[nIdx]) {
        gScore[nIdx] = ng;
        parent[nIdx] = cur;
        const h = Math.hypot(endWx - nx, endWy - ny);
        pushHeap(nIdx, ng + h);
      }
    }
  }

  if (foundEndWater === -1) {
    info.pathCache.set(cacheKey, null);
    return null;
  }

  // Truy ngược đường ô WATER
  const rawWater: SeaWaypoint[] = [];
  let trace = foundEndWater;
  while (trace !== -1) {
    const tx = trace % size;
    const ty = (trace - tx) / size;
    rawWater.push({ x: tx, y: ty });
    trace = parent[trace];
  }
  rawWater.reverse();

  const smoothedWater = smoothWaterWaypoints(tiles, rawWater);
  const waypoints: SeaWaypoint[] = [];
  if (tiles[sy]?.[sx]?.terrain !== 'WATER') {
    waypoints.push({ x: sx, y: sy });
  }
  for (const p of smoothedWater) {
    const last = waypoints[waypoints.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) {
      waypoints.push(p);
    }
  }
  if (tiles[ey]?.[ex]?.terrain !== 'WATER') {
    const last = waypoints[waypoints.length - 1];
    if (!last || last.x !== ex || last.y !== ey) {
      waypoints.push({ x: ex, y: ey });
    }
  }

  const length = computePolylineLength(waypoints);
  const res = { waypoints, length };
  if (info.pathCache.size > 800) info.pathCache.clear();
  info.pathCache.set(cacheKey, res);
  return res;
}

export function computePolylineLength(waypoints: SeaWaypoint[]): number {
  if (!waypoints || waypoints.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += Math.hypot(waypoints[i].x - waypoints[i - 1].x, waypoints[i].y - waypoints[i - 1].y);
  }
  return total;
}

export function sampleWaypoints(
  waypoints: SeaWaypoint[],
  progress: number,
  reverse: boolean = false
): { x: number; y: number; angle: number } {
  const n = waypoints.length;
  if (n === 0) return { x: 0, y: 0, angle: 0 };
  if (n === 1) return { x: waypoints[0].x, y: waypoints[0].y, angle: 0 };

  const p = Math.max(0, Math.min(1, progress));
  const totalLen = computePolylineLength(waypoints);
  if (totalLen <= 0.0001) {
    const pt = reverse ? waypoints[n - 1] : waypoints[0];
    return { x: pt.x, y: pt.y, angle: 0 };
  }

  const targetDist = (reverse ? 1 - p : p) * totalLen;
  let accum = 0;
  for (let i = 1; i < n; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (accum + segLen >= targetDist || i === n - 1) {
      const localT = segLen > 0.0001 ? Math.max(0, Math.min(1, (targetDist - accum) / segLen)) : 0;
      const x = a.x + (b.x - a.x) * localT;
      const y = a.y + (b.y - a.y) * localT;
      const dx = reverse ? a.x - b.x : b.x - a.x;
      const dy = reverse ? a.y - b.y : b.y - a.y;
      return { x, y, angle: Math.atan2(dy, dx) };
    }
    accum += segLen;
  }

  const endPt = reverse ? waypoints[0] : waypoints[n - 1];
  return { x: endPt.x, y: endPt.y, angle: 0 };
}

/**
 * Lấy vị trí hiện tại (trên biển theo waypoints nếu có, tương thích ngược nếu save cũ chưa có waypoints).
 */
export function getTradeShipPosition(
  ship: SeaTradeShip,
  routeMap?: Map<string, SeaTradeRoute>
): { x: number; y: number; angle: number } {
  const wps = ship.waypoints && ship.waypoints.length >= 2
    ? ship.waypoints
    : routeMap?.get(ship.routeId)?.waypoints;

  if (wps && wps.length >= 2) {
    const first = wps[0];
    const last = wps[wps.length - 1];
    const isRev = typeof ship.reverseDir === 'boolean'
      ? ship.reverseDir
      : (Math.abs(ship.sourceX - last.x) <= 0.5 && Math.abs(ship.sourceY - last.y) <= 0.5 &&
         (Math.abs(ship.sourceX - first.x) > 0.5 || Math.abs(ship.sourceY - first.y) > 0.5));
    return sampleWaypoints(wps, ship.progress || 0, isRev);
  }

  const prog = Math.max(0, Math.min(1, ship.progress || 0));
  const x = ship.sourceX + (ship.targetX - ship.sourceX) * prog;
  const y = ship.sourceY + (ship.targetY - ship.sourceY) * prog;
  const angle = Math.atan2(ship.targetY - ship.sourceY, ship.targetX - ship.sourceX);
  return { x, y, angle };
}
