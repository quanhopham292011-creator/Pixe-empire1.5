import React, { useRef, useEffect, useState } from 'react';
import { Tile, Nation, DarkTitan, FlyingMissile, PendingTitanSpawn, AttackWave } from '../types';
import { getNationColor } from '../utils/buildingSprites';
import { getDepositTiles } from '../utils/resources';

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
  attackWaves?: AttackWave[];
  borderAlertKey?: string;
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
  attackWaves = [],
  borderAlertKey = '',
  fogOfWarEnabled = true,
  playerNationId = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visibleMapRef = useRef<Uint8Array | null>(null);
  const lastTouchTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const [alertBlink, setAlertBlink] = useState(true);
  const [pingMarker, setPingMarker] = useState<{ x: number; y: number; kind: 'PREVIEW' | 'JUMP' } | null>(null);

  useEffect(() => {
    return () => {
      if (pingTimerRef.current !== null) {
        window.clearTimeout(pingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!borderAlertKey) {
      setAlertBlink(true);
      return;
    }
    const timer = setInterval(() => {
      setAlertBlink(prev => !prev);
    }, 350);
    return () => clearInterval(timer);
  }, [borderAlertKey]);

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
            const rad =
              t.building === 'SUPREME_FORTRESS' ? 9.0
              : (t.building === 'GRAND_ACADEMY' || t.building === 'GRAND_ARSENAL') ? 7.0
              : t.building === 'AIR_DEFENSE' ? 7.5
              : t.building === 'MISSILE_SILO' ? 6.5
              : 4.5;
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

    visibleMapRef.current = visibleMap;
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

    // Vẽ Mỏ Dầu Biển đã phát hiện (tôn trọng sương mù chiến tranh)
    if (tiles && tiles.length > 0) {
      const vis = visibleMapRef.current;
      const deposits = getDepositTiles(tiles);
      for (let i = 0; i < deposits.length; i++) {
        const d = deposits[i];
        if (!d || d.terrain !== 'WATER' || d.deposit !== 'OIL' || !d.discovered) continue;
        if (vis && vis[d.y * mapSize + d.x] !== 1) continue;
        const dx = d.x * tileSize + tileSize / 2;
        const dy = d.y * tileSize + tileSize / 2;
        ctx.fillStyle = (d.reserve || 0) > 0 ? '#f59e0b' : '#64748b';
        ctx.beginPath();
        ctx.arc(dx, dy, Math.max(1.4, tileSize * 0.9), 0, Math.PI * 2);
        ctx.fill();
      }
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

    // Điểm đánh dấu biên giới người chơi đang bị địch tấn công (chấm đỏ nhấp nháy)
    if (attackWaves.length > 0 && playerNationId > 0) {
      const drawnAlertCoords = new Set<string>();
      for (let i = 0; i < attackWaves.length; i++) {
        const w = attackWaves[i];
        if (!w || w.troops <= 0 || w.fromNation <= 0 || w.fromNation === playerNationId) continue;
        const tgt = tiles[w.targetY]?.[w.targetX];
        if (!tgt || tgt.owner !== playerNationId) continue;
        const coordKey = `${w.targetX},${w.targetY}`;
        if (drawnAlertCoords.has(coordKey)) continue;
        drawnAlertCoords.add(coordKey);

        const ax = w.targetX * tileSize + tileSize / 2;
        const ay = w.targetY * tileSize + tileSize / 2;
        ctx.fillStyle = alertBlink ? '#ef4444' : 'rgba(239, 68, 68, 0.45)';
        ctx.beginPath();
        ctx.arc(ax, ay, alertBlink ? 3.2 : 2.2, 0, Math.PI * 2);
        ctx.fill();

        if (alertBlink) {
          ctx.strokeStyle = '#fecaca';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(ax, ay, 5.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

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

    // Điểm đánh dấu vùng vừa nhấn / nhấn đúp trên Minimap
    if (pingMarker) {
      const pmx = pingMarker.x * tileSize + tileSize / 2;
      const pmy = pingMarker.y * tileSize + tileSize / 2;
      ctx.save();
      if (pingMarker.kind === 'JUMP') {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(pmx, pmy, 6.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pmx - 9, pmy);
        ctx.lineTo(pmx + 9, pmy);
        ctx.moveTo(pmx, pmy - 9);
        ctx.lineTo(pmx, pmy + 9);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(pmx, pmy, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

  }, [camera, darkTitan, darkTitans, pendingTitanSpawn, flyingMissiles, attackWaves, borderAlertKey, alertBlink, pingMarker, tiles, nations, mapSize, playerNationId]);

  const getMapCoords = (clientX: number, clientY: number): { mapX: number; mapY: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;
    const mapX = Math.max(0, Math.min(mapSize - 1, Math.floor((clickX / rect.width) * mapSize)));
    const mapY = Math.max(0, Math.min(mapSize - 1, Math.floor((clickY / rect.height) * mapSize)));
    return { mapX, mapY };
  };

  const showPing = (mapX: number, mapY: number, kind: 'PREVIEW' | 'JUMP') => {
    if (pingTimerRef.current !== null) {
      window.clearTimeout(pingTimerRef.current);
    }
    setPingMarker({ x: mapX, y: mapY, kind });
    pingTimerRef.current = window.setTimeout(() => {
      setPingMarker(null);
      pingTimerRef.current = null;
    }, kind === 'JUMP' ? 900 : 1200);
  };

  const triggerQuickJump = (clientX: number, clientY: number) => {
    const coords = getMapCoords(clientX, clientY);
    if (!coords) return;
    showPing(coords.mapX, coords.mapY, 'JUMP');
    onNavigate(coords.mapX, coords.mapY);
  };

  return (
    <div
      className="relative border-2 border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl bg-slate-950/90 backdrop-blur-md"
      title="Nhấn đúp vào khu vực bất kỳ để di chuyển camera nhanh"
    >
      <canvas
        ref={canvasRef}
        width={100}
        height={100}
        onClick={(e) => {
          e.stopPropagation();
          if (e.detail === 1) {
            const coords = getMapCoords(e.clientX, e.clientY);
            if (coords) showPing(coords.mapX, coords.mapY, 'PREVIEW');
          }
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          triggerQuickJump(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const touch = e.touches[0];
          if (!touch) return;
          const now = performance.now();
          const prev = lastTouchTapRef.current;
          if (prev && now - prev.time <= 350 && Math.hypot(touch.clientX - prev.x, touch.clientY - prev.y) <= 28) {
            lastTouchTapRef.current = null;
            triggerQuickJump(touch.clientX, touch.clientY);
          } else {
            lastTouchTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
            const coords = getMapCoords(touch.clientX, touch.clientY);
            if (coords) showPing(coords.mapX, coords.mapY, 'PREVIEW');
          }
        }}
        className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 cursor-pointer block image-rendering-pixelated touch-none"
      />
      {pingMarker?.kind === 'PREVIEW' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-950/85 text-amber-200 text-[9px] font-bold text-center py-0.5 leading-none">
          Nhấn đúp để tới
        </div>
      )}
    </div>
  );
});
