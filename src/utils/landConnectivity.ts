import type { Tile } from '../types';

// Kiểm tra 2 ô có nối liền nhau bằng đất liền (các ô không phải WATER, đi 4 hướng) hay không.
// Dùng khi bắn quân từ ô xa; giới hạn số ô duyệt để không gây lag.
export function isLandConnected(
  tiles: Tile[][],
  ax: number, ay: number,
  bx: number, by: number,
  maxVisit: number = 60000
): boolean {
  const size = tiles.length;
  if (ax === bx && ay === by) return true;
  const visited = new Uint8Array(size * size);
  const queue = new Int32Array(Math.min(size * size, maxVisit + 8));
  let head = 0;
  let tail = 0;
  const startTile = tiles[ay]?.[ax];
  const endTile = tiles[by]?.[bx];
  if (!startTile || !endTile || endTile.terrain === 'WATER') return false;
  // Ô nguồn là nước (tàu) thì không tính ở đây, đã được cho phép riêng
  if (startTile.terrain === 'WATER') return false;
  const startIdx = ay * size + ax;
  visited[startIdx] = 1;
  queue[tail++] = startIdx;
  const DX = [1, -1, 0, 0];
  const DY = [0, 0, 1, -1];
  let visits = 0;
  while (head < tail && visits < maxVisit) {
    const cur = queue[head++];
    visits++;
    const cx = cur % size;
    const cy = (cur - cx) / size;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (nx === bx && ny === by) return true;
      const ni = ny * size + nx;
      if (visited[ni]) continue;
      const nt = tiles[ny][nx];
      if (!nt || nt.terrain === 'WATER') continue;
      visited[ni] = 1;
      if (tail < queue.length) queue[tail++] = ni;
    }
  }
  return false;
}
