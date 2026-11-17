import type { Tile } from '../types';

// Trả về vị trí đặt tên cho mỗi quốc gia: một Ô THẬT thuộc mảnh đất liền LỚN NHẤT của nước đó,
// gần tâm của mảnh đó nhất.
export function computeNationLabelCenters(
  tiles: Tile[][],
  tilePx: number
): Record<number, { px: number; py: number }> {
  const size = tiles.length;
  const visited = new Uint8Array(size * size);
  const queue = new Int32Array(size * size);
  const bestCount: Record<number, number> = {};
  const result: Record<number, { px: number; py: number }> = {};
  const DX = [1, -1, 0, 0];
  const DY = [0, 0, 1, -1];

  for (let sy = 0; sy < size; sy++) {
    for (let sx = 0; sx < size; sx++) {
      const si = sy * size + sx;
      if (visited[si]) continue;
      const st = tiles[sy][sx];
      visited[si] = 1;
      if (!st || st.owner <= 0 || st.terrain === 'WATER') continue;
      const owner = st.owner;

      let head = 0;
      let tail = 0;
      queue[tail++] = si;
      while (head < tail) {
        const cur = queue[head++];
        const cx = cur % size;
        const cy = (cur - cx) / size;
        for (let d = 0; d < 4; d++) {
          const nx = cx + DX[d];
          const ny = cy + DY[d];
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const ni = ny * size + nx;
          if (visited[ni]) continue;
          const nt = tiles[ny][nx];
          if (nt && nt.owner === owner && nt.terrain !== 'WATER') {
            visited[ni] = 1;
            queue[tail++] = ni;
          }
        }
      }

      if (tail > (bestCount[owner] || 0)) {
        bestCount[owner] = tail;
        let sumX = 0;
        let sumY = 0;
        for (let i = 0; i < tail; i++) {
          const c = queue[i];
          const x = c % size;
          sumX += x;
          sumY += (c - x) / size;
        }
        const mx = sumX / tail;
        const my = sumY / tail;
        let bd = Infinity;
        let bx = sx;
        let by = sy;
        for (let i = 0; i < tail; i++) {
          const c = queue[i];
          const x = c % size;
          const y = (c - x) / size;
          const dd = (x - mx) * (x - mx) + (y - my) * (y - my);
          if (dd < bd) { bd = dd; bx = x; by = y; }
        }
        result[owner] = { px: (bx + 0.5) * tilePx, py: (by + 0.5) * tilePx };
      }
    }
  }
  return result;
}
