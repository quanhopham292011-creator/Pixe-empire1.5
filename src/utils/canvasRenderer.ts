import { Tile, Nation } from '../types';
import { TILE_PIXEL_SIZE } from './constants';

const SUB = 6;

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h >>> 0) % 10000) / 10000;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const LAND_RAMP: [number, number, number, number][] = [
  [0.0, 172, 210, 122],
  [0.3, 142, 192, 96],
  [0.5, 226, 206, 156],
  [0.75, 212, 186, 142],
  [1.0, 250, 250, 247],
];

function landColor(h: number): [number, number, number] {
  const v = Math.max(0, Math.min(1, h));
  for (let i = 0; i < LAND_RAMP.length - 1; i++) {
    const a = LAND_RAMP[i];
    const b = LAND_RAMP[i + 1];
    if (v <= b[0]) {
      const t = (v - a[0]) / (b[0] - a[0]);
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    }
  }
  const l = LAND_RAMP[LAND_RAMP.length - 1];
  return [l[1], l[2], l[3]];
}

function waterColor(depth: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, depth));
  return [lerp(96, 40, t), lerp(166, 104, t), lerp(210, 168, t)];
}

export function drawTerrainBuffer(offCanvas: HTMLCanvasElement, tiles: Tile[][], size: number) {
  const targetW = size * TILE_PIXEL_SIZE;
  const targetH = size * TILE_PIXEL_SIZE;
  if (offCanvas.width !== targetW || offCanvas.height !== targetH) {
    offCanvas.width = targetW;
    offCanvas.height = targetH;
  }
  const ctx = offCanvas.getContext('2d');
  if (!ctx) return;

  const dist: number[][] = [];
  const queue: [number, number][] = [];
  for (let y = 0; y < size; y++) {
    dist[y] = [];
    for (let x = 0; x < size; x++) {
      const t = tiles[y]?.[x];
      if (t && t.terrain !== 'WATER') {
        dist[y][x] = 0;
        queue.push([x, y]);
      } else {
        dist[y][x] = 99;
      }
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [qx, qy] = queue[i];
    const d = dist[qy][qx];
    if (d >= 8) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = qx + dx;
      const ny = qy + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && dist[ny][nx] > d + 1) {
        dist[ny][nx] = d + 1;
        queue.push([nx, ny]);
      }
    }
  }

  const hTile: number[][] = [];
  for (let y = 0; y < size; y++) {
    hTile[y] = [];
    for (let x = 0; x < size; x++) {
      const t = tiles[y]?.[x];
      const r = hash(x, y);
      if (!t || t.terrain === 'WATER') {
        hTile[y][x] = -0.15 - Math.min(dist[y][x], 8) / 8;
      } else if (t.terrain === 'MOUNTAIN') {
        hTile[y][x] = 0.72 + r * 0.28;
      } else if (t.terrain === 'FOREST') {
        hTile[y][x] = 0.12 + r * 0.14;
      } else {
        hTile[y][x] = 0.18 + r * 0.3;
      }
    }
  }

  const G = size * SUB;
  const H = new Float32Array(G * G);
  for (let gy = 0; gy < G; gy++) {
    const fy = (gy + 0.5) / SUB - 0.5;
    const y0 = Math.max(0, Math.min(size - 1, Math.floor(fy)));
    const y1 = Math.min(size - 1, y0 + 1);
    const ty = Math.max(0, Math.min(1, fy - y0));
    for (let gx = 0; gx < G; gx++) {
      const fx = (gx + 0.5) / SUB - 0.5;
      const x0 = Math.max(0, Math.min(size - 1, Math.floor(fx)));
      const x1 = Math.min(size - 1, x0 + 1);
      const tx = Math.max(0, Math.min(1, fx - x0));
      const top = lerp(hTile[y0][x0], hTile[y0][x1], tx);
      const bot = lerp(hTile[y1][x0], hTile[y1][x1], tx);
      let h = lerp(top, bot, ty);
      h += (hash(gx, gy) - 0.5) * 0.06;
      H[gy * G + gx] = h;
    }
  }

  const tmp = document.createElement('canvas');
  tmp.width = G;
  tmp.height = G;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;
  const img = tctx.createImageData(G, G);
  const px = img.data;
  for (let gy = 0; gy < G; gy++) {
    for (let gx = 0; gx < G; gx++) {
      const h = H[gy * G + gx];
      let rgb: [number, number, number];
      if (h <= 0) {
        rgb = waterColor((-h - 0.15) / 1.0);
      } else {
        rgb = landColor(h);
        const a = H[Math.max(0, gy - 1) * G + Math.max(0, gx - 1)];
        const b = H[Math.min(G - 1, gy + 1) * G + Math.min(G - 1, gx + 1)];
        if (a > 0 && b > 0) {
          const shade = 1 + Math.max(-0.12, Math.min(0.12, (a - b) * 1.6));
          rgb = [rgb[0] * shade, rgb[1] * shade, rgb[2] * shade];
        }
      }
      const i = (gy * G + gx) * 4;
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = 255;
    }
  }
  tctx.putImageData(img, 0, 0);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, size * TILE_PIXEL_SIZE, size * TILE_PIXEL_SIZE);
}

const darkenedCache: Record<string, string> = {};
function darken(hex: string): string {
  if (darkenedCache[hex]) return darkenedCache[hex];
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#000000';
  const n = parseInt(m[1], 16);
  const r = Math.floor(((n >> 16) & 255) * 0.55);
  const g = Math.floor(((n >> 8) & 255) * 0.55);
  const b = Math.floor((n & 255) * 0.55);
  const res = `rgb(${r},${g},${b})`;
  darkenedCache[hex] = res;
  return res;
}

export function drawTerritoryBuffer(
  offCanvas: HTMLCanvasElement, 
  tiles: Tile[][], 
  nations: Nation[], 
  size: number,
  dirtyTiles?: { x: number; y: number }[]
) {
  const targetW = size * TILE_PIXEL_SIZE;
  const targetH = size * TILE_PIXEL_SIZE;
  let forceFull = false;

  if (offCanvas.width !== targetW || offCanvas.height !== targetH) {
    offCanvas.width = targetW;
    offCanvas.height = targetH;
    forceFull = true;
  }

  const ctx = offCanvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  // Tối ưu cập nhật cục bộ: nếu chỉ có vài ô thay đổi, chỉ vẽ lại các ô đó cùng 4 ô lân cận
  if (!forceFull && dirtyTiles && dirtyTiles.length > 0 && dirtyTiles.length <= 128) {
    const patchMap = new Map<number, { x: number; y: number }>();
    for (let i = 0; i < dirtyTiles.length; i++) {
      const pt = dirtyTiles[i];
      if (pt.x >= 0 && pt.x < size && pt.y >= 0 && pt.y < size) {
        patchMap.set(pt.y * size + pt.x, pt);
        // Cần cập nhật 4 ô lân cận để vẽ lại đường viền tiếp giáp chính xác
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = pt.x + dx;
          const ny = pt.y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            patchMap.set(ny * size + nx, { x: nx, y: ny });
          }
        }
      }
    }

    // 1. Xóa vùng đệm các ô đất thay đổi
    patchMap.forEach(({ x, y }) => {
      ctx.clearRect(x * TILE_PIXEL_SIZE, y * TILE_PIXEL_SIZE, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);
    });

    // 2. Vẽ lại màu nền & viền biên giới chuẩn cho từng ô thay đổi
    patchMap.forEach(({ x, y }) => {
      const t = tiles[y]?.[x];
      if (!t || t.terrain === 'WATER' || t.owner <= 0) return;
      const nation = nations[t.owner];
      if (!nation) return;

      const px = x * TILE_PIXEL_SIZE;
      const py = y * TILE_PIXEL_SIZE;

      // Tô màu lãnh thổ
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = nation.color;
      ctx.fillRect(px, py, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);

      // Vẽ tường biên giới
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = darken(nation.color);
      const e = 2;
      if (y === 0 || tiles[y - 1]?.[x]?.owner !== t.owner) ctx.fillRect(px, py, TILE_PIXEL_SIZE, e);
      if (y === size - 1 || tiles[y + 1]?.[x]?.owner !== t.owner) ctx.fillRect(px, py + TILE_PIXEL_SIZE - e, TILE_PIXEL_SIZE, e);
      if (x === 0 || tiles[y]?.[x - 1]?.owner !== t.owner) ctx.fillRect(px, py, e, TILE_PIXEL_SIZE);
      if (x === size - 1 || tiles[y]?.[x + 1]?.owner !== t.owner) ctx.fillRect(px + TILE_PIXEL_SIZE - e, py, e, TILE_PIXEL_SIZE);
    });

    return;
  }

  // Toàn bộ bản đồ cần vẽ lại (Lần đầu khởi tạo hoặc thay đổi kích thước)
  ctx.clearRect(0, 0, offCanvas.width, offCanvas.height);

  // Nhóm ô đất sở hữu theo từng quốc gia để batch fill 1 lần per nation
  const nationTiles: Map<number, { x: number; y: number }[]> = new Map();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = tiles[y]?.[x];
      if (t && t.terrain !== 'WATER' && t.owner > 0) {
        let list = nationTiles.get(t.owner);
        if (!list) {
          list = [];
          nationTiles.set(t.owner, list);
        }
        list.push({ x, y });
      }
    }
  }

  nationTiles.forEach((list, ownerId) => {
    const nation = nations[ownerId];
    if (!nation) return;

    // 1. Tô màu lãnh thổ quốc gia trong 1 nhịp canvas batch
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = nation.color;
    ctx.beginPath();
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      ctx.rect(p.x * TILE_PIXEL_SIZE, p.y * TILE_PIXEL_SIZE, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);
    }
    ctx.fill();

    // 2. Tường đường viền biên giới quốc gia trong 1 nhịp canvas batch
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = darken(nation.color);
    ctx.beginPath();
    const e = 2;
    for (let i = 0; i < list.length; i++) {
      const { x, y } = list[i];
      const px = x * TILE_PIXEL_SIZE;
      const py = y * TILE_PIXEL_SIZE;
      if (y === 0 || tiles[y - 1]?.[x]?.owner !== ownerId) ctx.rect(px, py, TILE_PIXEL_SIZE, e);
      if (y === size - 1 || tiles[y + 1]?.[x]?.owner !== ownerId) ctx.rect(px, py + TILE_PIXEL_SIZE - e, TILE_PIXEL_SIZE, e);
      if (x === 0 || tiles[y]?.[x - 1]?.owner !== ownerId) ctx.rect(px, py, e, TILE_PIXEL_SIZE);
      if (x === size - 1 || tiles[y]?.[x + 1]?.owner !== ownerId) ctx.rect(px + TILE_PIXEL_SIZE - e, py, e, TILE_PIXEL_SIZE);
    }
    ctx.fill();
  });
}
