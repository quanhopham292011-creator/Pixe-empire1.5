import { Tile } from '../types';

// Công trình miễn kiểm tra khoảng cách (phải đặt đúng chỗ)
const SPACING_EXEMPT = new Set(['NONE', 'OIL_RIG', 'MINE', 'PORT', 'SUPREME_FORTRESS', 'GRAND_ACADEMY', 'GRAND_ARSENAL']);

export function isSpacingExempt(building: string): boolean {
  return SPACING_EXEMPT.has(building);
}

// Trả về true nếu có công trình thường nào trong 8 ô xung quanh (x, y)
export function hasBuildingNearby(tiles: Tile[][], x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const t = tiles[y + dy]?.[x + dx];
      if (t && !SPACING_EXEMPT.has(t.building)) return true;
    }
  }
  return false;
}
