import React, { useRef, useEffect } from 'react';
import { Tile, Nation, DarkTitan, FlyingMissile, PendingTitanSpawn } from '../types';
import { getNationColor } from '../utils/buildingSprites';

interface MinimapProps {
  tiles: Tile[][];
  nations: Nation[];
  mapSize: number;
  camera: { x: number; y: number; zoom: number };
  onNavigate: (mapX: number, mapY: number) => void;
  darkTitan?: DarkTitan | null;
  darkTitans?: DarkTitan[];
  pendingTitanSpawn?: PendingTitanSpawn | null;
  flyingMissiles?: FlyingMissile[];
  fogOfWarEnabled?: boolean;
  playerNationId?: number;
}

function hexToAbgr(hex: string, defaultColor: number = 0xFFCBD5E1): number {
  if (!hex || hex[0] !== '#') return defaultColor;
  let h = hex.slice(1);
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (h.length !== 6) return defaultColor;
  const num = parseInt(h, 16);
  if (isNaN(num)) return defaultColor;
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

export const Minimap: React.FC<MinimapProps> = React.memo(({
  tiles,
  nations,
  mapSize,
  camera,
  onNavigate,
  darkTitan,
  darkTitans,
  pendingTitanSpawn,
  flyingMissiles = [],
  fogOfWarEnabled = true,
  playerNationId = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Offscreen Cache: Chỉ vẽ lại toàn bộ lưới ô vuông khi tiles hoặc nations thay đổi (Fast ImageData)
  useEffect(() => {
    if (!tiles || tiles.length === 0) return;

    if (!offscreenCanvasRef.current || offscreenCanvasRef.current.width !== mapSize) {
      offscreenCanvasRef.current = document.createElement('canvas');
      offscreenCanvasRef.current.width = mapSize;
      offscreenCanvasRef.current.height = mapSize;
    }

    const offCanvas = offscreenCanvasRef.current;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    const imgData = offCtx.createImageData(mapSize, mapSize);
    const data32 = new Uint32Array(imgData.data.buffer);

    // Tính toán vùng tầm nhìn người chơi cho Minimap
    const visibleMap: Uint8Array | null = fogOfWarEnabled
      ? new Uint8Array(mapSize * mapSize)
      : null;

    if (visibleMap) {
      for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
          const t = tiles[y]?.[x];
          if (t && t.owner === playerNationId) {
            const rad = t.building === 'AIR_DEFENSE' ? 7.5 : t.building === 'MISSILE_SILO' ? 6.5 : 4.5;
            const radSq = rad * rad;
            const rCeil = Math.ceil(rad);
            for (let dy = -rCeil; dy <= rCeil; dy++) {
              for (let dx = -rCeil; dx <= rCeil; dx++) {
                if (dx * dx + dy * dy <= radSq) {
                  const vx = x + dx;
                  const vy = y + dy;
                  if (vx >= 0 && vx < mapSize && vy >= 0 && vy < mapSize) {
                    visibleMap[vy * mapSize + vx] = 1;
                  }
                }
              }
            }
          }
        }
      }
    }

    const nationColorMap: number[] = [];
    nations.forEach(n => {
      if (n) nationColorMap[n.id] = hexToAbgr(getNationColor(n));
    });

    const FOG_COLOR = 0xFF20110B;
    const WATER_COLOR = 0xFF8A3A1E;
    const MOUNTAIN_COLOR = 0xFF695547;
    const FOREST_COLOR = 0xFF2D5314;
    const LAND_COLOR = 0xFF8B7464;

    for (let y = 0; y < mapSize; y++) {
      const rowOffset = y * mapSize;
      const row = tiles[y];
      if (!row) continue;
      for (let x = 0; x < mapSize; x++) {
        const t = row[x];
        if (!t) continue;
        const idx = rowOffset + x;
        const isVisible = !visibleMap || visibleMap[idx] === 1;

        if (!isVisible) {
          data32[idx] = FOG_COLOR;
        } else if (t.terrain === 'WATER') {
          data32[idx] = WATER_COLOR;
        } else if (t.owner > 0) {
          data32[idx] = nationColorMap[t.owner] || 0xFFE1D5CB;
        } else if (t.terrain === 'MOUNTAIN') {
          data32[idx] = MOUNTAIN_COLOR;
        } else if (t.terrain === 'FOREST') {
          data32[idx] = FOREST_COLOR;
        } else {
          data32[idx] = LAND_COLOR;
        }
      }
    }

    offCtx.putImageData(imgData, 0, 0);
  }, [tiles, nations, mapSize, fogOfWarEnabled, playerNationId]);

  // 2. Main Render: Vẽ cache lên canvas chính và render Viewport Box, Boss & Đồng minh nhanh gọn (60fps)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const tileSize = size / mapSize;

    ctx.clearRect(0, 0, size, size);

    // Vẽ nền địa hình từ offscreen cache
    if (offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0, size, size);
    }

    // Điểm sáng Thủ đô của Người chơi, Đồng minh & Boss
    const playerNation = nations.find(n => n.isPlayer);
    nations.forEach(nation => {
      if (nation.id === 0 || nation.isEliminated) return;
      const isPlayer = nation.isPlayer;
      const isBoss = nation.tier === 'BOSS';
      const isAlly = playerNation?.diplomacy[nation.id]?.status === 'ALLIANCE';

      if (isPlayer || isBoss || isAlly) {
        const cx = nation.capitalX * tileSize;
        const cy = nation.capitalY * tileSize;
        
        ctx.fillStyle = isPlayer ? '#38bdf8' : isAlly ? '#10b981' : '#ef4444';
        ctx.beginPath();
        ctx.arc(cx, cy, isPlayer ? 2.5 : isAlly ? 2.2 : 2.0, 0, Math.PI * 2);
        ctx.fill();

        // Vòng phát sáng cho đồng minh và người chơi
        if (isAlly || isPlayer) {
          ctx.strokeStyle = isPlayer ? 'rgba(56, 189, 248, 0.6)' : 'rgba(16, 185, 129, 0.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    });

    // Cổng cảnh báo Tà Thần sắp xuất hiện
    if (pendingTitanSpawn && pendingTitanSpawn.remainingSeconds > 0) {
      const px = pendingTitanSpawn.x * tileSize + tileSize / 2;
      const py = pendingTitanSpawn.y * tileSize + tileSize / 2;
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Điểm đánh dấu Tà Thần Cổ Đại (Pulsing Dark Crimson Beacon cho tất cả Tà Thần)
    const activeTitans = darkTitans && darkTitans.length > 0
      ? darkTitans.filter(t => t.isActive)
      : (darkTitan && darkTitan.isActive ? [darkTitan] : []);

    activeTitans.forEach(titan => {
      const dtx = titan.x * tileSize + tileSize / 2;
      const dty = titan.y * tileSize + tileSize / 2;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(dtx, dty, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Điểm đánh dấu Tên lửa đang bay hướng tới lãnh thổ người chơi (Radar Warning Siren)
    const incomingToPlayer = flyingMissiles.filter(m => {
      const tgt = tiles[m.targetY]?.[m.targetX];
      return m.fromNation !== playerNationId && tgt && tgt.owner === playerNationId;
    });

    incomingToPlayer.forEach(m => {
      const mx = m.targetX * tileSize + tileSize / 2;
      const my = m.targetY * tileSize + tileSize / 2;

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();

      // Vòng tròn radar đỏ nhấp nháy
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, 7, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Khung nhìn Camera thực tế (Viewport Box)
    const TILE_PIXEL_SIZE = 24;
    const vpW = window.innerWidth || 360;
    const vpH = window.innerHeight || 560;

    const leftWorld = (-camera.x) / (TILE_PIXEL_SIZE * camera.zoom);
    const topWorld = (-camera.y) / (TILE_PIXEL_SIZE * camera.zoom);
    const widthWorld = vpW / (TILE_PIXEL_SIZE * camera.zoom);
    const heightWorld = vpH / (TILE_PIXEL_SIZE * camera.zoom);

    const boxX = Math.max(0, Math.min(size, leftWorld * tileSize));
    const boxY = Math.max(0, Math.min(size, topWorld * tileSize));
    const boxW = Math.max(4, Math.min(size - boxX, widthWorld * tileSize));
    const boxH = Math.max(4, Math.min(size - boxY, heightWorld * tileSize));

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

  }, [camera, darkTitan, darkTitans, pendingTitanSpawn, flyingMissiles, nations, mapSize]);

  const handleInteract = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    const mapX = Math.max(0, Math.min(mapSize - 1, Math.floor((clickX / rect.width) * mapSize)));
    const mapY = Math.max(0, Math.min(mapSize - 1, Math.floor((clickY / rect.height) * mapSize)));
    onNavigate(mapX, mapY);
  };

  return (
    <div className="relative border-2 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl bg-slate-950/90 backdrop-blur-md">
      <canvas
        ref={canvasRef}
        width={100}
        height={100}
        onClick={(e) => handleInteract(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          if (e.touches[0]) {
            handleInteract(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        className="w-20 h-20 sm:w-24 sm:h-24 cursor-pointer block image-rendering-pixelated touch-none"
      />
    </div>
  );
});
