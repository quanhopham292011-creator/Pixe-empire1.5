/**
 * Utilities & Helper functions cho tính năng Tự Chọn Vị Trí Khởi Đầu
 */

import { Tile, TerrainType } from '../types';

export interface SpawnValidation {
  isValid: boolean;
  reason?: string;
  terrainType: TerrainType;
  hasHarborAccess: boolean;
  defenseBonus: number;
  nearbyForests: number;
  nearbyMountains: number;
  nearestEnemyDist: number;
  initialLandCount: number;
}

/**
 * Kiểm tra vị trí khởi đầu dự kiến có hợp lệ hay không
 */
export function validateSpawnLocation(
  tiles: Tile[][],
  x: number,
  y: number,
  otherSpawns: { x: number; y: number }[] = []
): SpawnValidation {
  const size = tiles.length;
  const isOutOfBounds = x < 1 || x >= size - 1 || y < 1 || y >= size - 1;

  if (isOutOfBounds) {
    return {
      isValid: false,
      reason: 'Vị trí quá sát rìa thế giới!',
      terrainType: 'WATER',
      hasHarborAccess: false,
      defenseBonus: 1.0,
      nearbyForests: 0,
      nearbyMountains: 0,
      nearestEnemyDist: 0,
      initialLandCount: 0,
    };
  }

  const targetTile = tiles[y][x];

  if (targetTile.terrain === 'WATER') {
    return {
      isValid: false,
      reason: 'Không thể đặt thủ đô dưới lòng biển! Hãy chạm vào đất liền.',
      terrainType: 'WATER',
      hasHarborAccess: true,
      defenseBonus: 1.0,
      nearbyForests: 0,
      nearbyMountains: 0,
      nearestEnemyDist: 0,
      initialLandCount: 0,
    };
  }

  // Kiểm tra khoảng cách với thủ đô các nước khác (ngoại trừ Player at index 0)
  let nearestEnemyDist = 999;
  for (let i = 1; i < otherSpawns.length; i++) {
    const s = otherSpawns[i];
    if (!s) continue;
    const dist = Math.hypot(s.x - x, s.y - y);
    if (dist < nearestEnemyDist) nearestEnemyDist = dist;
  }

  if (nearestEnemyDist < 3.5) {
    return {
      isValid: false,
      reason: `Quá gần thủ đô quốc gia khác (${nearestEnemyDist.toFixed(1)} ô)! Cần cách ít nhất 3.5 ô.`,
      terrainType: targetTile.terrain,
      hasHarborAccess: targetTile.hasHarborAccess,
      defenseBonus: targetTile.defenseBonus,
      nearbyForests: 0,
      nearbyMountains: 0,
      nearestEnemyDist,
      initialLandCount: 0,
    };
  }

  // Đếm ô đất liền trong bán kính khởi đầu (radius ~2.2 ô)
  const initRadius = 2.2;
  let landCount = 0;
  let nearbyForests = 0;
  let nearbyMountains = 0;

  for (let dy = -Math.ceil(initRadius); dy <= Math.ceil(initRadius); dy++) {
    for (let dx = -Math.ceil(initRadius); dx <= Math.ceil(initRadius); dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        const t = tiles[ny][nx];
        if (t.terrain !== 'WATER' && Math.hypot(dx, dy) <= initRadius) {
          landCount++;
          if (t.terrain === 'FOREST') nearbyForests++;
          if (t.terrain === 'MOUNTAIN') nearbyMountains++;
        }
      }
    }
  }

  if (landCount < 4) {
    return {
      isValid: false,
      reason: 'Dải đất quá hẹp (dưới 4 ô), không đủ không gian phát triển ban đầu.',
      terrainType: targetTile.terrain,
      hasHarborAccess: targetTile.hasHarborAccess,
      defenseBonus: targetTile.defenseBonus,
      nearbyForests,
      nearbyMountains,
      nearestEnemyDist,
      initialLandCount: landCount,
    };
  }

  return {
    isValid: true,
    terrainType: targetTile.terrain,
    hasHarborAccess: targetTile.hasHarborAccess,
    defenseBonus: targetTile.defenseBonus,
    nearbyForests,
    nearbyMountains,
    nearestEnemyDist,
    initialLandCount: landCount,
  };
}

/**
 * Tìm một vị trí khởi đầu hợp lệ ngẫu nhiên trên bản đồ
 */
export function findRandomValidSpawn(
  tiles: Tile[][],
  otherSpawns: { x: number; y: number }[] = []
): { x: number; y: number } {
  const size = tiles.length;
  const candidates: { x: number; y: number; landCount: number }[] = [];

  for (let attempt = 0; attempt < 1000; attempt++) {
    const rx = 2 + Math.floor(Math.random() * (size - 4));
    const ry = 2 + Math.floor(Math.random() * (size - 4));
    const val = validateSpawnLocation(tiles, rx, ry, otherSpawns);
    if (val.isValid) {
      candidates.push({ x: rx, y: ry, landCount: val.initialLandCount });
      if (candidates.length >= 10) break;
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.landCount - a.landCount);
    return candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
  }

  // Dự phòng: tìm ô đất liền bất kỳ
  for (let y = 2; y < size - 2; y++) {
    for (let x = 2; x < size - 2; x++) {
      if (tiles[y][x].terrain !== 'WATER') return { x, y };
    }
  }

  return { x: Math.floor(size / 2), y: Math.floor(size / 2) };
}
