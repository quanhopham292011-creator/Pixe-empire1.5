import { useEffect, useCallback } from 'react';
import { 
  MapDimension, WeatherType, WeatherParticle, Tile 
} from '../types';
import { 
  TILE_PIXEL_SIZE, MISSILE_SETTINGS, MISSILE_CONFIG, 
  DARK_TITAN_CONFIG, GENERAL_ROSTER, formatPopulation 
} from '../utils/constants';
import { soundManager } from '../utils/audio';
import { generateWeatherParticles } from '../utils/weatherUtils';
import { drawTerrainBuffer, drawTerritoryBuffer } from '../utils/canvasRenderer';
import { drawBuildingSprite, getNationColor } from '../utils/buildingSprites';
import { isSuperBuilding, getSuperBuildingState, SUPER_BUILDING_CONFIG } from '../utils/superBuildings';
import { getSupremeFortressStats } from '../utils/supremeTech';

function drawRoundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rad = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

interface UseGameRendererParams {
  mapSize: MapDimension;
  gameStateRef: React.MutableRefObject<'TITLE' | 'PLAYING' | 'VICTORY' | 'DEFEAT'>;
  isPaused: boolean;
  gameSpeed: number;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  offscreenTerrainCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  offscreenTerritoryCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  offscreenTerrainDirtyRef: React.MutableRefObject<boolean>;
  offscreenTerritoryDirtyRef: React.MutableRefObject<boolean>;
  dirtyTerritoryTilesRef: React.MutableRefObject<{ x: number; y: number }[]>;
  fogBaseGridRef: React.MutableRefObject<Uint8Array | null>;
  fogBaseDirtyRef: React.MutableRefObject<boolean>;
  fogGridRef: React.MutableRefObject<Uint8Array | null>;
  fogOfWarEnabledRef: React.MutableRefObject<boolean>;
  nationCentersRef: React.MutableRefObject<Record<number, { px: number; py: number }>>;
  viewportSizeRef: React.MutableRefObject<{ width: number; height: number; dpr: number }>;
  cameraRef: React.MutableRefObject<{ x: number; y: number; zoom: number }>;
  cameraAnimRef: React.MutableRefObject<any>;
  needsCenterCameraRef: React.MutableRefObject<boolean>;
  screenShakeRef: React.MutableRefObject<{ intensity: number; duration: number }>;
  weatherRef: React.MutableRefObject<WeatherType>;
  weatherEnabledRef: React.MutableRefObject<boolean>;
  weatherParticlesRef: React.MutableRefObject<WeatherParticle[]>;
  lightningFlashRef: React.MutableRefObject<{ startTime: number; duration: number } | null>;
  nextLightningTimeRef: React.MutableRefObject<number>;
  tapRipplesRef: React.MutableRefObject<{ x: number; y: number; startTime: number }[]>;
  captureFlashRef: React.MutableRefObject<{ x: number; y: number; color: string; startTime: number }[]>;
  selectedTileRef: React.MutableRefObject<Tile | null>;
  isMultiplayerRef: React.MutableRefObject<boolean>;
  myNationIdRef: React.MutableRefObject<number>;
  gameDataRef: React.MutableRefObject<any>;
  clampCamera: (camX: number, camY: number, zoom: number) => { x: number; y: number };
}

export function useGameRenderer({
  mapSize,
  gameStateRef,
  isPaused,
  gameSpeed,
  canvasRef,
  offscreenTerrainCanvasRef,
  offscreenTerritoryCanvasRef,
  offscreenTerrainDirtyRef,
  offscreenTerritoryDirtyRef,
  dirtyTerritoryTilesRef,
  fogBaseGridRef,
  fogBaseDirtyRef,
  fogGridRef,
  fogOfWarEnabledRef,
  nationCentersRef,
  viewportSizeRef,
  cameraRef,
  cameraAnimRef,
  needsCenterCameraRef,
  screenShakeRef,
  weatherRef,
  weatherEnabledRef,
  weatherParticlesRef,
  lightningFlashRef,
  nextLightningTimeRef,
  tapRipplesRef,
  captureFlashRef,
  selectedTileRef,
  isMultiplayerRef,
  myNationIdRef,
  gameDataRef,
  clampCamera,
}: UseGameRendererParams) {
  // Khởi tạo các hạt thời tiết (Mây trôi bồng bềnh, Mưa lất phất)
  const initWeatherParticles = useCallback((dimension: MapDimension, type: WeatherType) => {
    weatherParticlesRef.current = generateWeatherParticles(dimension, type);
  }, [weatherParticlesRef]);

  // Buffer 1: Render Địa Hình Tĩnh Tối Ưu Đồ Họa Pixel (Biển, Bọt Sóng, Núi Tuyết, Tán Rừng)
  const renderTerrainBuffer = useCallback((size: number) => {
    if (!offscreenTerrainCanvasRef.current) {
      offscreenTerrainCanvasRef.current = document.createElement('canvas');
    }
    drawTerrainBuffer(offscreenTerrainCanvasRef.current, gameDataRef.current.tiles, size);
  }, [offscreenTerrainCanvasRef, gameDataRef]);

  // Buffer 2: Render Đồ Họa Chuẩn OpenFront (Đường viền Neon chói & Nét căng, hỗ trợ selective patch)
  const renderTerritoryBuffer = useCallback((size: number) => {
    if (!offscreenTerritoryCanvasRef.current) {
      offscreenTerritoryCanvasRef.current = document.createElement('canvas');
    }
    const { tiles, nations } = gameDataRef.current;
    const dirtyList = dirtyTerritoryTilesRef.current;
    drawTerritoryBuffer(offscreenTerritoryCanvasRef.current, tiles, nations, size, dirtyList.length > 0 ? dirtyList : undefined);
  }, [offscreenTerritoryCanvasRef, gameDataRef, dirtyTerritoryTilesRef]);

  // Vòng lặp Render 60 FPS Render Chuẩn OpenFront
  useEffect(() => {
    // Khởi tạo Text Width Cache đơn giản trong vòng lặp render
    const textWidthCache = new Map<string, number>();
    const getCachedWidth = (ctx: CanvasRenderingContext2D, text: string, font: string): number => {
      const key = `${font}:${text}`;
      if (textWidthCache.has(key)) return textWidthCache.get(key)!;
      ctx.font = font;
      const width = ctx.measureText(text).width;
      textWidthCache.set(key, width);
      return width;
    };

    let animId: number;
    let lastTimestamp = performance.now();

    const render = (timestamp: number) => {
      const deltaSec = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      if (document.visibilityState === 'hidden') {
        animId = requestAnimationFrame(render);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }

      const clientW = canvas.clientWidth;
      const clientH = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      if (clientW > 0 && clientH > 0) {
        viewportSizeRef.current = { width: clientW, height: clientH, dpr };
        const targetW = Math.floor(clientW * dpr);
        const targetH = Math.floor(clientH * dpr);

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
          offscreenTerrainDirtyRef.current = true;
          offscreenTerritoryDirtyRef.current = true;
        }
      }

      // Tự động căn giữa thủ đô
      if (needsCenterCameraRef.current && viewportSizeRef.current.width > 0 && viewportSizeRef.current.height > 0) {
        const vpW = viewportSizeRef.current.width;
        const vpH = viewportSizeRef.current.height;
        const player = gameDataRef.current.nations[1];
        if (player) {
          const initialZoom = 1.25;
          const capPxX = (player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2) * initialZoom;
          const capPxY = (player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2) * initialZoom;
          const rawX = vpW / 2 - capPxX;
          const rawY = vpH / 2 - capPxY;
          const clamped = clampCamera(rawX, rawY, initialZoom);
          cameraRef.current = { x: clamped.x, y: clamped.y, zoom: initialZoom };
        }
        needsCenterCameraRef.current = false;
      }

      // Cập nhật chuyển động lướt Camera mượt mà (Smooth Camera Animation)
      if (cameraAnimRef.current) {
        const anim = cameraAnimRef.current;
        const elapsed = timestamp - anim.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / anim.duration));
        // Ease-out cubic: chuyển động êm dịu, nhẹ nhàng dừng lại ở đích
        const ease = 1 - Math.pow(1 - progress, 3);

        const curX = anim.startX + (anim.targetX - anim.startX) * ease;
        const curY = anim.startY + (anim.targetY - anim.startY) * ease;
        const curZoom = anim.startZoom + (anim.targetZoom - anim.startZoom) * ease;

        cameraRef.current = { x: curX, y: curY, zoom: curZoom };
        if (progress >= 1) {
          cameraAnimRef.current = null;
        }
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const vpW = viewportSizeRef.current.width;
      const vpH = viewportSizeRef.current.height;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(0, 0, vpW, vpH);

      const currentCamera = cameraRef.current;
      const { tiles, nations, attackWaves, particles } = gameDataRef.current;

      if (tiles.length === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Tự động cập nhật tiến trình tên lửa bay mượt mà 60 FPS (Mặc định 12 giây tới nơi)
      if (gameStateRef.current === 'PLAYING' && !isPaused && deltaSec > 0) {
        if (gameDataRef.current.flyingMissiles) {
          gameDataRef.current.flyingMissiles.forEach((m: any) => {
            const spd = m.speed || (1 / (MISSILE_SETTINGS.DEFAULT_FLIGHT_DURATION_SECONDS || 12));
            m.progress = Math.min(1.0, m.progress + spd * deltaSec * gameSpeed);
          });
        }
        if (gameDataRef.current.fighterPlanes) {
          gameDataRef.current.fighterPlanes.forEach((p: any) => {
            const spd = p.speed || 0.16;
            p.progress = Math.min(1.0, (p.progress || 0) + spd * deltaSec * gameSpeed);
          });
        }

        // Tự động cập nhật tiến trình tàu buôn hải cảng mượt mà 60 FPS (chống cộng trùng lặp & cộng khi đang chiến tranh)
        if (gameDataRef.current.tradeShips) {
          const data = gameDataRef.current;
          data.tradeShips.forEach((ship: any) => {
            if (!ship || ship.fromNation === ship.toNation) return;
            const fromN = data.nations[ship.fromNation];
            const toN = data.nations[ship.toNation];
            if (!fromN || !toN || fromN.isEliminated || toN.isEliminated) return;
            const dip1 = fromN.diplomacy?.[toN.id]?.status || 'WAR';
            const dip2 = toN.diplomacy?.[fromN.id]?.status || 'WAR';
            if (dip1 === 'WAR' || dip2 === 'WAR') return;

            const spd = Math.min(0.25, Math.max(0.01, ship.speed || 0.05));
            ship.progress += spd * deltaSec * gameSpeed;

            if (ship.progress >= 1.0) {
              ship.progress = 0;
              const tempX = ship.sourceX;
              const tempY = ship.sourceY;
              ship.sourceX = ship.targetX;
              ship.sourceY = ship.targetY;
              ship.targetX = tempX;
              ship.targetY = tempY;

              if (ship.lastPayoutAt && timestamp - ship.lastPayoutAt < 1500) {
                return;
              }
              ship.lastPayoutAt = timestamp;

              const fromGain = Math.max(0, Math.floor(ship.fromCargoGold ?? ship.cargoGold ?? 0));
              const toGain = Math.max(0, Math.floor(ship.toCargoGold ?? ship.cargoGold ?? 0));
              if (fromGain > 0) fromN.gold += fromGain;
              if (toGain > 0) toN.gold += toGain;

              const displayGain = ship.fromNation === 1 ? fromGain : ship.toNation === 1 ? toGain : Math.round((fromGain + toGain) / 2);
              if (displayGain > 0) {
                data.particles.push({
                  x: tempX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  y: tempY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  color: ship.isIntercontinental ? '#38bdf8' : '#fbbf24',
                  size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.6,
                  type: 'FLOAT_TEXT',
                  text: `⛵ +${displayGain} Vàng Giao Thương Hải Cảng`
                });
              }
            }
          });
        }
      }

      const size = tiles.length;

      if (offscreenTerrainDirtyRef.current || !offscreenTerrainCanvasRef.current) {
        renderTerrainBuffer(size);
        offscreenTerrainDirtyRef.current = false;
      }
      if (offscreenTerritoryDirtyRef.current || !offscreenTerritoryCanvasRef.current) {
        renderTerritoryBuffer(size);
        offscreenTerritoryDirtyRef.current = false;
      }

      let shakeX = 0;
      let shakeY = 0;
      if (screenShakeRef.current.duration > 0) {
        screenShakeRef.current.duration -= 1;
        const intensity = screenShakeRef.current.intensity;
        shakeX = (Math.random() - 0.5) * intensity;
        shakeY = (Math.random() - 0.5) * intensity;
      }

      ctx.save();
      ctx.translate(currentCamera.x + shakeX, currentCamera.y + shakeY);
      ctx.scale(currentCamera.zoom, currentCamera.zoom);

      const zoom = currentCamera.zoom;

      // 1. Draw Offscreen Layer Địa hình & Lãnh thổ
      const fullPx = size * TILE_PIXEL_SIZE;
      if (offscreenTerrainCanvasRef.current) {
        ctx.drawImage(offscreenTerrainCanvasRef.current, 0, 0, fullPx, fullPx);
      }
      if (offscreenTerritoryCanvasRef.current) {
        ctx.drawImage(offscreenTerritoryCanvasRef.current, 0, 0, fullPx, fullPx);
      }

      // Vẽ Tap Ripples
      const now = performance.now();
      tapRipplesRef.current = tapRipplesRef.current.filter(ripple => {
        const elapsed = now - ripple.startTime;
        if (elapsed > 350) return false;
        const progress = elapsed / 350;
        const opacity = 0.8 * (1 - progress);
        const radius = 4 + (24 * progress);
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        return true;
      });

      // Vẽ Capture Flashes
      captureFlashRef.current = captureFlashRef.current.filter(flash => {
        const elapsed = now - flash.startTime;
        if (elapsed > 400) return false;
        const progress = elapsed / 400;
        const opacity = 0.7 * (1 - progress);
        
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fillRect(flash.x * TILE_PIXEL_SIZE, flash.y * TILE_PIXEL_SIZE, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);
        ctx.strokeStyle = flash.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(flash.x * TILE_PIXEL_SIZE, flash.y * TILE_PIXEL_SIZE, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);
        ctx.restore();
        return true;
      });

      // 2. Frustum Culling
      const tileSizePx = TILE_PIXEL_SIZE * zoom;
      const minTileX = Math.max(0, Math.floor(-currentCamera.x / tileSizePx));
      const maxTileX = Math.min(size - 1, Math.ceil((vpW - currentCamera.x) / tileSizePx));
      const minTileY = Math.max(0, Math.floor(-currentCamera.y / tileSizePx));
      const maxTileY = Math.min(size - 1, Math.ceil((vpH - currentCamera.y) / tileSizePx));

      // 2.5. Tính toán Lưới Tầm Nhìn Sương Mù Chiến Tranh (Fog of War) (Tối ưu Caching Tĩnh + Dynamic Stamp)
      let visibleGrid: Uint8Array | null = null;
      if (fogOfWarEnabledRef.current) {
        const totalTiles = size * size;
        const myNationId = isMultiplayerRef.current ? myNationIdRef.current : 1;

        // a. Tầm nhìn tĩnh từ lãnh thổ và công trình (Chỉ tính lại khi có đất/công trình thay đổi, tối đa 1 lần / khung hình)
        if (fogBaseDirtyRef.current || !fogBaseGridRef.current || fogBaseGridRef.current.length !== totalTiles) {
          if (!fogBaseGridRef.current || fogBaseGridRef.current.length !== totalTiles) {
            fogBaseGridRef.current = new Uint8Array(totalTiles);
          } else {
            fogBaseGridRef.current.fill(0);
          }
          const bGrid = fogBaseGridRef.current;

          const getTileVisionRad = (t: Tile): number => {
            if (t.building === 'SUPREME_FORTRESS') return 9.0;
            if (t.building === 'GRAND_ACADEMY' || t.building === 'GRAND_ARSENAL') return 7.0;
            if (t.building === 'AIR_DEFENSE') return 7.5;
            if (t.building === 'MISSILE_SILO' || t.building === 'LASER') return 6.5;
            if (t.building === 'FORTRESS') return 5.5;
            if (t.building === 'CITY' || t.building === 'PORT') return 5.0;
            if (t.building === 'BARRACKS') return 4.5;
            return 3.5;
          };

          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const t = tiles[y]?.[x];
              if (t && t.owner === myNationId) {
                const visionRad = getTileVisionRad(t);
                const radSq = visionRad * visionRad;
                const rCeil = Math.ceil(visionRad);
                for (let dy = -rCeil; dy <= rCeil; dy++) {
                  for (let dx = -rCeil; dx <= rCeil; dx++) {
                    if (dx * dx + dy * dy <= radSq) {
                      const vx = x + dx;
                      const vy = y + dy;
                      if (vx >= 0 && vx < size && vy >= 0 && vy < size) {
                        bGrid[vy * size + vx] = 1;
                      }
                    }
                  }
                }
              }
            }
          }
          fogBaseDirtyRef.current = false;
        }

        // b. Sao chép nhanh bộ đệm tĩnh (C-level memcpy cực nhanh)
        if (!fogGridRef.current || fogGridRef.current.length !== totalTiles) {
          fogGridRef.current = new Uint8Array(totalTiles);
        }
        if (fogBaseGridRef.current) {
          fogGridRef.current.set(fogBaseGridRef.current);
        }
        const vGrid = fogGridRef.current;
        visibleGrid = vGrid;

        // c. Đánh dấu tầm nhìn động từ Tướng người chơi đang di chuyển / trú ngụ
        const playerNat = nations[myNationId];
        if (playerNat && playerNat.general) {
          const gen = playerNat.general;
          const gx = Math.floor(gen.x);
          const gy = Math.floor(gen.y);
          const genRadSq = 25.0; // 5.0 * 5.0
          const rCeil = 5;
          for (let dy = -rCeil; dy <= rCeil; dy++) {
            for (let dx = -rCeil; dx <= rCeil; dx++) {
              if (dx * dx + dy * dy <= genRadSq) {
                const vx = gx + dx;
                const vy = gy + dy;
                if (vx >= 0 && vx < size && vy >= 0 && vy < size) {
                  vGrid[vy * size + vx] = 1;
                }
              }
            }
          }
        }

        // d. Đánh dấu tầm nhìn động từ các đợt tiến công đang di chuyển
        if (attackWaves.length > 0) {
          for (let wi = 0; wi < attackWaves.length; wi++) {
            const wave = attackWaves[wi];
            if (wave.fromNation === myNationId) {
              const wx = Math.floor(wave.sourceX + (wave.targetX - wave.sourceX) * wave.progress);
              const wy = Math.floor(wave.sourceY + (wave.targetY - wave.sourceY) * wave.progress);
              const waveRadSq = 12.25; // 3.5 * 3.5
              for (let dy = -4; dy <= 4; dy++) {
                for (let dx = -4; dx <= 4; dx++) {
                  if (dx * dx + dy * dy <= waveRadSq) {
                    const vx = wx + dx;
                    const vy = wy + dy;
                    if (vx >= 0 && vx < size && vy >= 0 && vy < size) {
                      vGrid[vy * size + vx] = 1;
                    }
                  }
                }
              }
            }
          }
        }
      }
      dirtyTerritoryTilesRef.current = [];

      // 4. Vẽ Vùng Đất Cháy & Công Trình trong màn hình
      for (let y = minTileY; y <= maxTileY; y++) {
        for (let x = minTileX; x <= maxTileX; x++) {
          const t = tiles[y]?.[x];
          if (!t) continue;
          const px = x * TILE_PIXEL_SIZE;
          const py = y * TILE_PIXEL_SIZE;

          // 4.1a. Vẽ Vùng Cháy (Thermobaric) & Vùng Phóng Xạ (ATOM nâng cấp)
          if (t.burnZoneTimer && t.burnZoneTimer > 0) {
            const burnPulse = 0.25 + 0.12 * Math.sin(timestamp * 0.01 + x + y);
            ctx.save();
            ctx.fillStyle = `rgba(249, 115, 22, ${burnPulse.toFixed(3)})`;
            ctx.fillRect(px, py, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);
            ctx.strokeStyle = 'rgba(251, 113, 133, 0.55)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, TILE_PIXEL_SIZE - 1, TILE_PIXEL_SIZE - 1);
            ctx.restore();
          }
          if (t.radiationTimer && t.radiationTimer > 0) {
            const radPulse = 0.28 + 0.14 * Math.sin(timestamp * 0.008 + x * 0.7 + y);
            ctx.save();
            ctx.fillStyle = `rgba(132, 204, 22, ${radPulse.toFixed(3)})`;
            ctx.fillRect(px, py, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);
            ctx.strokeStyle = 'rgba(163, 230, 53, 0.65)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, TILE_PIXEL_SIZE - 1, TILE_PIXEL_SIZE - 1);
            ctx.restore();
          }

          // 4.1b. Vẽ Mỏ Dầu / Khoáng Sản đã phát hiện (khi chưa xây trạm khai thác)
          if (t.building === 'NONE' && t.deposit && t.discovered && (t.reserve || 0) > 0 && zoom >= 0.6) {
            const cx = px + TILE_PIXEL_SIZE / 2;
            const cy = py + TILE_PIXEL_SIZE / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, TILE_PIXEL_SIZE * 0.28, 0, Math.PI * 2);
            ctx.fillStyle = t.deposit === 'OIL' ? 'rgba(14, 165, 233, 0.9)' : 'rgba(168, 85, 247, 0.9)';
            ctx.fill();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t.deposit === 'OIL' ? 'D' : 'K', cx, cy + 0.5);
            ctx.restore();
          }

          // 4.2. Vẽ Công Trình (Icon tròn nhỏ, nền màu phe, viền sáng, icon trắng ở giữa)
          if (t.building !== 'NONE' && (zoom >= 0.6 || t.owner === 1 || isSuperBuilding(t.building))) {
            const cx = px + TILE_PIXEL_SIZE / 2;
            const cy = py + TILE_PIXEL_SIZE / 2;
            const nationColor = (t.owner > 0 && nations[t.owner]) ? getNationColor(nations[t.owner]) : '#1e293b';
            const superType = isSuperBuilding(t.building);
            const superSt = superType ? getSuperBuildingState(t) : null;
            ctx.save();
            const isInactive = !!(t.inactiveTimer && t.inactiveTimer > 0);
            if (isInactive) ctx.globalAlpha = 0.35;
            else if (superSt === 'BUILDING' || superSt === 'REPAIRING') ctx.globalAlpha = 0.55;
            drawBuildingSprite(ctx, t.building, cx, cy, nationColor);
            if (superSt === 'ACTIVE') {
              ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
              ctx.lineWidth = 1.6;
              ctx.strokeRect(px + 1, py + 1, TILE_PIXEL_SIZE - 2, TILE_PIXEL_SIZE - 2);
            } else if ((t.building === 'OIL_RIG' || t.building === 'MINE') && t.isAdvancedExtractor) {
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 1.6;
              ctx.strokeRect(px + 1, py + 1, TILE_PIXEL_SIZE - 2, TILE_PIXEL_SIZE - 2);
              ctx.fillStyle = '#fbbf24';
              ctx.font = 'bold 8px sans-serif';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'top';
              ctx.fillText('★', px + 2, py + 1);
            }
            ctx.restore();

            if (t.inactiveTimer && t.inactiveTimer > 0) {
              ctx.save();
              ctx.fillStyle = '#fbbf24';
              ctx.font = 'bold 9px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`${Math.ceil(t.inactiveTimer)}`, cx, cy);
              ctx.restore();
            }

            if (superType && superSt) {
              if (superSt === 'BUILDING' || superSt === 'REPAIRING') {
                const total = Math.max(1, t.superBuildTotal || SUPER_BUILDING_CONFIG.BUILD_TIME_SECONDS);
                const left = Math.max(0, t.superBuildTimeLeft || 0);
                const ratio = Math.max(0, Math.min(1, (total - left) / total));
                const barW = TILE_PIXEL_SIZE - 4;
                ctx.save();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                ctx.fillRect(px + 2, py + TILE_PIXEL_SIZE - 5, barW, 4);
                ctx.fillStyle = superSt === 'REPAIRING' ? '#22c55e' : '#38bdf8';
                ctx.fillRect(px + 2, py + TILE_PIXEL_SIZE - 5, barW * ratio, 4);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 8px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${Math.ceil(left)}s`, cx, cy);
                ctx.restore();
              } else if (superSt === 'DAMAGED' || (t.superHp ?? SUPER_BUILDING_CONFIG.MAX_HP) < SUPER_BUILDING_CONFIG.MAX_HP) {
                const maxHp = t.superMaxHp ?? SUPER_BUILDING_CONFIG.MAX_HP;
                const hpRatio = Math.max(0, Math.min(1, (t.superHp ?? maxHp) / maxHp));
                const barW = TILE_PIXEL_SIZE - 4;
                ctx.save();
                ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
                ctx.fillRect(px + 2, py + TILE_PIXEL_SIZE - 5, barW, 4);
                ctx.fillStyle = superSt === 'DAMAGED' ? '#ef4444' : '#f59e0b';
                ctx.fillRect(px + 2, py + TILE_PIXEL_SIZE - 5, barW * hpRatio, 4);
                if (superSt === 'DAMAGED') {
                  ctx.fillStyle = '#f97316';
                  ctx.font = 'bold 9px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.fillText('!', px + TILE_PIXEL_SIZE - 5, py + 8);
                }
                ctx.restore();
              }
            }

            // Hiển thị nhãn cấp độ xây chồng (L2, L3...) nhỏ gọn góc ô
            const lvl = t.buildingLevel || 1;
            if (lvl > 1) {
              ctx.save();
              ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
              ctx.fillRect(px + TILE_PIXEL_SIZE - 12, py + 1, 11, 10);
              ctx.fillStyle = '#fbbf24';
              ctx.font = 'bold 8px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(`L${lvl}`, px + TILE_PIXEL_SIZE - 6, py + 9);
              ctx.restore();
            }

            // Thanh độ bền giàn khoan / mỏ khoáng khi bị hư hại (< 100%)
            if ((t.building === 'OIL_RIG' || t.building === 'MINE') && (t.condition ?? 100) < 100) {
              const condRatio = Math.max(0, Math.min(1, (t.condition ?? 100) / 100));
              const barW = TILE_PIXEL_SIZE - 4;
              ctx.save();
              ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
              ctx.fillRect(px + 2, py + TILE_PIXEL_SIZE - 4, barW, 3);
              ctx.fillStyle = condRatio > 0.6 ? '#22c55e' : condRatio > 0.35 ? '#f59e0b' : '#ef4444';
              ctx.fillRect(px + 2, py + TILE_PIXEL_SIZE - 4, barW * condRatio, 3);
              ctx.restore();
            }
          }
        }
      }

      // 4.5. Vẽ Vùng Chọn Ô Đất (Selection Highlight) sắc nét, định vị 4 góc & Vòng tròn hiệu lực Pháo Đài
      if (selectedTileRef.current) {
        const st = selectedTileRef.current;
        const spx = st.x * TILE_PIXEL_SIZE;
        const spy = st.y * TILE_PIXEL_SIZE;
        const pulse = 0.5 + 0.5 * Math.sin(timestamp * 0.007);

        // Nếu ô được chọn là Pháo Đài (FORTRESS) hoặc Pháo Đài Tối Thượng (SUPREME_FORTRESS), vẽ vòng tròn hiệu lực
        if (st.building === 'FORTRESS' || st.building === 'SUPREME_FORTRESS') {
          const fcx = spx + TILE_PIXEL_SIZE / 2;
          const fcy = spy + TILE_PIXEL_SIZE / 2;
          const isSupreme = st.building === 'SUPREME_FORTRESS';
          const supremeRadius = isSupreme ? getSupremeFortressStats(nations[st.owner]).radius : 4.0;
          const radiusPx = supremeRadius * TILE_PIXEL_SIZE;

          ctx.save();
          ctx.beginPath();
          ctx.arc(fcx, fcy, radiusPx, 0, Math.PI * 2);
          ctx.fillStyle = isSupreme ? 'rgba(56, 189, 248, 0.09)' : 'rgba(255, 255, 255, 0.08)';
          ctx.fill();
          ctx.strokeStyle = isSupreme ? 'rgba(56, 189, 248, 0.7)' : 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = isSupreme ? 1.8 : 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.strokeStyle = st.owner === 1 ? `rgba(251, 191, 36, ${0.75 + pulse * 0.25})` : `rgba(56, 189, 248, ${0.75 + pulse * 0.25})`;
        ctx.lineWidth = 2.0;
        ctx.strokeRect(spx + 1, spy + 1, TILE_PIXEL_SIZE - 2, TILE_PIXEL_SIZE - 2);

        // 4 góc định vị sắc nét
        ctx.fillStyle = st.owner === 1 ? '#fbbf24' : '#38bdf8';
        const cLen = 5;
        ctx.fillRect(spx, spy, cLen, 2); ctx.fillRect(spx, spy, 2, cLen);
        ctx.fillRect(spx + TILE_PIXEL_SIZE - cLen, spy, cLen, 2); ctx.fillRect(spx + TILE_PIXEL_SIZE - 2, spy, 2, cLen);
        ctx.fillRect(spx, spy + TILE_PIXEL_SIZE - 2, cLen, 2); ctx.fillRect(spx, spy + TILE_PIXEL_SIZE - cLen, 2, cLen);
        ctx.fillRect(spx + TILE_PIXEL_SIZE - cLen, spy + TILE_PIXEL_SIZE - 2, cLen, 2); ctx.fillRect(spx + TILE_PIXEL_SIZE - 2, spy + TILE_PIXEL_SIZE - cLen, 2, cLen);
        ctx.restore();
      }

      // 4.6. Phủ Lớp Sương Mù Chiến Tranh (Fog of War Overlay) (Batch 1 nhịp canvas)
      if (visibleGrid) {
        ctx.save();
        ctx.fillStyle = 'rgba(10, 15, 29, 0.85)';
        ctx.beginPath();
        for (let y = minTileY; y <= maxTileY; y++) {
          const rowOffset = y * size;
          for (let x = minTileX; x <= maxTileX; x++) {
            if (visibleGrid[rowOffset + x] === 0) {
              ctx.rect(x * TILE_PIXEL_SIZE, y * TILE_PIXEL_SIZE, TILE_PIXEL_SIZE, TILE_PIXEL_SIZE);
            }
          }
        }
        ctx.fill();
        ctx.restore();
      }

      // 4.8. Hiệu ứng Thời tiết (Mây trắng bồng bềnh & Hạt mưa lướt trên không gian)
      if (weatherEnabledRef.current) {
        const pList = weatherParticlesRef.current;
        const pLen = pList.length;

        // Phủ lớp sương lam nhẹ khi trời mưa
        if (weatherRef.current === 'RAIN') {
          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
          ctx.fillRect(0, 0, size * TILE_PIXEL_SIZE, size * TILE_PIXEL_SIZE);
          ctx.restore();
        }

        ctx.save();
        for (let i = 0; i < pLen; i++) {
          const p = pList[i];

          if (p.type === 'CLOUD' && p.puffs) {
            const sx = p.x * zoom + currentCamera.x;
            const sy = p.y * zoom + currentCamera.y;
            if (sx < -140 || sx > vpW + 140 || sy < -100 || sy > vpH + 100) continue;

            const puffs = p.puffs;
            for (let j = 0; j < puffs.length; j++) {
              const puff = puffs[j];
              ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * puff.alpha})`;
              ctx.beginPath();
              ctx.ellipse(p.x + puff.dx, p.y + puff.dy, puff.w, puff.h, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (p.type === 'RAIN_DROP' && weatherRef.current === 'RAIN') {
            const sx = p.x * zoom + currentCamera.x;
            const sy = p.y * zoom + currentCamera.y;
            if (sx < -40 || sx > vpW + 40 || sy < -40 || sy > vpH + 40) continue;

            ctx.strokeStyle = `rgba(186, 230, 253, ${p.opacity})`;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 3.2, p.y - p.height);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 5. Phân biệt rõ Nhãn Quốc Gia (👑 Crown) vs 3 Loại Thuộc Địa (🌲 Rừng, ⛺ Bộ Lạc, 🛡️ Dân Tộc)
      if (currentCamera.zoom >= 0.30) {
        const centers = nationCentersRef.current;
        nations.forEach((nation: any) => {
          if (nation.id === 0 || nation.isEliminated) return;
          const pos = centers[nation.id];
          if (!pos) return;

          const screenPxX = pos.px * zoom + currentCamera.x;
          const screenPxY = pos.py * zoom + currentCamera.y;
          if (screenPxX < -120 || screenPxX > vpW + 120 || screenPxY < -60 || screenPxY > vpH + 60) {
            return;
          }

          const widthOnScreen = Math.sqrt(Math.max(1, nation.territoryCount || 1)) * TILE_PIXEL_SIZE * zoom;
          if (widthOnScreen < 55 && nation.id !== 1) return; // nước nhỏ thì không hiện chữ
          const nameStr = String(nation.name).replace(/\s*\[.*?\]/g, '').replace(/\s*\(.*?\)/g, '').trim();
          const popStr = `${formatPopulation(nation.population || 0)}`;
          const fs = Math.max(7, Math.min(40, 11 / zoom)); // chữ luôn cỡ ~11px trên màn hình
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineJoin = 'round';
          ctx.lineWidth = fs * 0.28;
          ctx.strokeStyle = 'rgba(15,23,42,0.85)';
          ctx.font = `bold ${fs}px sans-serif`;
          ctx.strokeText(nameStr, pos.px, pos.py - fs * 0.5);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(nameStr, pos.px, pos.py - fs * 0.5);
          if (widthOnScreen >= 100) {
            ctx.font = `${fs * 0.85}px sans-serif`;
            ctx.strokeText(popStr, pos.px, pos.py + fs * 0.6);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillText(popStr, pos.px, pos.py + fs * 0.6);
          }

          // Huy hiệu bắt tay xanh: quốc gia đã liên minh với người chơi
          if (nation.id !== 1 && nations[1]?.diplomacy?.[nation.id]?.status === 'ALLIANCE') {
            ctx.fillStyle = '#2563eb';
            ctx.beginPath();
            ctx.arc(pos.px, pos.py + 18, 6.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = '9px sans-serif';
            ctx.fillText('🤝', pos.px, pos.py + 18.5);
          }
        });
      }

      // 6. Render Mô hình Tướng (CHỈ hiện khi Ra Trận / Gần chiến trường, KHÔNG hiện khi nhàn rỗi) & Đợt tiến công
      nations.forEach((nation: any) => {
        if (nation.id === 0 || nation.isEliminated || !nation.general) return;
        const gen = nation.general;

        // TƯỚNG CHỈ HIỂN THỊ KHI RA TRẬN (MARCHING), KHÔNG HIỂN THỊ KHI NHÀN RỖI (IDLE/RECOVERING)
        if (gen.status === 'MARCHING') {
          const gx = gen.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const gy = gen.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

          // Hào quang Tướng Đại Diện
          ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
          ctx.beginPath();
          ctx.arc(gx, gy, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.0;
          ctx.stroke();

          // Sprite Tướng (Biểu tượng Kiếm Vàng)
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(gx, gy, 7.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚔️', gx, gy + 3);

          // Tag Tướng (+30% Sức Mạnh & Kỹ năng chủ động đang hiệu lực)
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.0;
          const isSkillActive = (gen.skillActiveTimer || 0) > 0;
          const rItem = GENERAL_ROSTER.find(r => r.skillId === gen.skillId);
          const skillTag = isSkillActive && rItem ? ` [${rItem.emoji} ${gen.skillActiveTimer}s]` : '';
          const tagText = `⚔️ ${gen.name}${skillTag} (+30%)`;
          const font = 'bold 9px sans-serif';
          const tw = getCachedWidth(ctx, tagText, font) + 8;
          ctx.fillRect(gx - tw / 2, gy - 20, tw, 14);
          ctx.strokeRect(gx - tw / 2, gy - 20, tw, 14);

          ctx.fillStyle = isSkillActive ? '#fef08a' : '#fbbf24';
          ctx.fillText(tagText, gx, gy - 13);

          // Thanh máu nhỏ của Đại Tướng trên chiến trường
          const hpRatio = Math.max(0, Math.min(1, (gen.hp || 1000) / (gen.maxHp || 1000)));
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(gx - tw / 2, gy - 5, tw, 3);
          ctx.fillStyle = hpRatio >= 0.6 ? '#22c55e' : hpRatio > 0.2 ? '#eab308' : '#ef4444';
          ctx.fillRect(gx - tw / 2, gy - 5, tw * hpRatio, 3);
        }
      });

      // Hoạt ảnh (Animation) Đợt quân di chuyển Mượt mà (OpenFront Laser / Chevron Trail)
      attackWaves.forEach((wave: any) => {
        const curX = (wave.sourceX + (wave.targetX - wave.sourceX) * wave.progress) * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const curY = (wave.sourceY + (wave.targetY - wave.sourceY) * wave.progress) * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const nation = nations[wave.fromNation];

        // Nếu đợt quân được Tướng trực tiếp chỉ huy, cập nhật vị trí Tướng theo đợt quân!
        if (wave.hasGeneral && nation?.general && nation.general.status === 'MARCHING' && (!nation.general.marchingWaveId || nation.general.marchingWaveId === wave.id)) {
          nation.general.x = wave.sourceX + (wave.targetX - wave.sourceX) * wave.progress;
          nation.general.y = wave.sourceY + (wave.targetY - wave.sourceY) * wave.progress;
        }

        // Vệt di chuyển Neon
        ctx.strokeStyle = wave.hasGeneral ? '#f59e0b' : (nation?.color || '#ffffff');
        ctx.lineWidth = wave.hasGeneral ? 4.2 : 2.8;
        ctx.beginPath();
        ctx.moveTo(wave.sourceX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2, wave.sourceY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2);
        ctx.lineTo(curX, curY);
        ctx.stroke();
      });

      // Vẽ Tên Lửa Đang Bay (Flying Missiles)
      if (gameDataRef.current.flyingMissiles) {
        gameDataRef.current.flyingMissiles.forEach((m: any) => {
          const startX = m.sourceX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const startY = m.sourceY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const endX = m.targetX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const endY = m.targetY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

          const prog = Math.min(1.0, Math.max(0.0, m.progress));
          const curX = startX + (endX - startX) * prog;
          const linearY = startY + (endY - startY) * prog;

          // Độ vồng đạn đạo (Ballistic Arc)
          const distPx = Math.hypot(endX - startX, endY - startY);
          const maxArcHeight = Math.min(90, Math.max(25, distPx * 0.3));
          const arcY = linearY - Math.sin(prog * Math.PI) * maxArcHeight;
          const cfg = MISSILE_CONFIG[m.type as keyof typeof MISSILE_CONFIG];

          // 1. Bóng tên lửa dưới mặt đất
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          ctx.ellipse(curX, linearY, 7, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();

          // 2. Vệt khói & quỹ đạo đạn đạo
          ctx.strokeStyle = cfg.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          const midX = startX + (curX - startX) * 0.5;
          const midY = startY + (arcY - startY) * 0.5 - (maxArcHeight * Math.sin(prog * Math.PI * 0.5));
          ctx.quadraticCurveTo(midX, midY, curX, arcY);
          ctx.stroke();

          // 3. Hiệu ứng riêng cho từng loại tên lửa (đơn giản)
          const tt = timestamp * 0.01;
          if (m.type === 'ATOM') {
            // ATOM: đầu đạn nhỏ màu vàng + quầng nhấp nháy
            ctx.fillStyle = 'rgba(234, 179, 8, 0.35)';
            ctx.beginPath();
            ctx.arc(curX, arcY, 8 + Math.sin(tt) * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(curX, arcY, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (m.type === 'HYDRO') {
            // HYDRO: đầu đạn to, quầng lửa cam đập mạnh
            const pulseH = 1 + Math.sin(tt * 1.5) * 0.25;
            ctx.fillStyle = 'rgba(249, 115, 22, 0.3)';
            ctx.beginPath();
            ctx.arc(curX, arcY, 15 * pulseH, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
            ctx.beginPath();
            ctx.arc(curX, arcY, 10 * pulseH, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(curX, arcY, 6.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = 3;
            ctx.stroke();
          } else {
            // MIRV: đầu đạn chính + 3 đầu đạn con xoay quanh
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(curX, arcY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = cfg.color;
            ctx.lineWidth = 2;
            ctx.stroke();
            for (let k = 0; k < 3; k++) {
              const ang = tt * 0.6 + (k * Math.PI * 2) / 3;
              const sx = curX + Math.cos(ang) * 11;
              const sy = arcY + Math.sin(ang) * 11;
              ctx.fillStyle = cfg.color;
              ctx.beginPath();
              ctx.arc(sx, sy, 2.8, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // 4. Nhãn đếm ngược thời gian bay (vd: 12s, 11s... 1s)
          const flightDuration = MISSILE_SETTINGS.DEFAULT_FLIGHT_DURATION_SECONDS || 12;
          const remainingSec = Math.max(0, Math.ceil((1.0 - prog) * flightDuration));
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`🚀 ${remainingSec}s`, curX, arcY - 10);
        });
      }

      // 6.3b. Vẽ Máy Bay Chiến Đấu (Fighter Planes)
      if (gameDataRef.current.fighterPlanes && gameDataRef.current.fighterPlanes.length > 0) {
        gameDataRef.current.fighterPlanes.forEach((p: any) => {
          const sx = p.sourceX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const sy = p.sourceY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const ex = p.targetX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const ey = p.targetY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const prog = Math.min(1.0, Math.max(0.0, p.progress || 0));
          const cx = sx + (ex - sx) * prog;
          const cy = sy + (ey - sy) * prog;
          const ang = Math.atan2(ey - sy, ex - sx);
          const nColor = nations[p.nationId] ? getNationColor(nations[p.nationId]) : '#38bdf8';

          ctx.save();
          // Đường bay mờ
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          ctx.setLineDash([]);

          // Bóng máy bay
          ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
          ctx.beginPath();
          ctx.ellipse(cx + 4, cy + 7, 6, 3, ang, 0, Math.PI * 2);
          ctx.fill();

          // Thân tiêm kích (Delta Wing)
          ctx.translate(cx, cy);
          ctx.rotate(ang);
          ctx.fillStyle = nColor;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(9, 0);
          ctx.lineTo(-6, -6.5);
          ctx.lineTo(-3, 0);
          ctx.lineTo(-6, 6.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Đuôi lửa phản lực
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(-5, 0, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      // 6.4. Render Cổng Không Gian Tà Thần (Cảnh báo trước 10 giây)
      const pendingSpawn = gameDataRef.current.pendingTitanSpawn;
      if (pendingSpawn && pendingSpawn.remainingSeconds > 0) {
        const px = pendingSpawn.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const py = pendingSpawn.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const tPulse = 0.5 + 0.5 * Math.sin(timestamp * 0.008);
        const rot = timestamp * 0.004;
        const totalSec = Math.max(1, pendingSpawn.totalSeconds || DARK_TITAN_CONFIG.SPAWN_WARNING_SECONDS || 10);
        const progress = Math.max(0, Math.min(1, 1 - pendingSpawn.remainingSeconds / totalSec));
        const baseR = 22 + progress * 10 + tPulse * 4;

        ctx.save();
        // Vùng cảnh báo đỏ/tím nhấp nháy
        const portalGrad = ctx.createRadialGradient(px, py, 3, px, py, baseR + 14);
        portalGrad.addColorStop(0, 'rgba(15, 7, 32, 0.95)');
        portalGrad.addColorStop(0.45, 'rgba(147, 51, 234, 0.72)');
        portalGrad.addColorStop(0.75, 'rgba(220, 38, 38, 0.45)');
        portalGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = portalGrad;
        ctx.beginPath();
        ctx.arc(px, py, baseR + 14, 0, Math.PI * 2);
        ctx.fill();

        // Vòng xoáy không gian ngoài (tím + đỏ)
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2.6;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.arc(px, py, baseR, rot, rot + Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.arc(px, py, baseR * 0.72, -rot * 1.4, -rot * 1.4 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Lõi cổng tối
        ctx.fillStyle = '#1e0b36';
        ctx.beginPath();
        ctx.arc(px, py, 9 + tPulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Nhãn cảnh báo & bộ đếm ngược
        const secLeft = Math.max(0, Math.ceil(pendingSpawn.remainingSeconds));
        const portalLabel = `🌀 CỔNG TÀ THẦN: ${secLeft}s`;
        const font = 'bold 10px sans-serif';
        const lw = getCachedWidth(ctx, portalLabel, font) + 12;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.4;
        ctx.fillRect(px - lw / 2, py - baseR - 22, lw, 16);
        ctx.strokeRect(px - lw / 2, py - baseR - 22, lw, 16);
        ctx.fillStyle = '#f5d0fe';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(portalLabel, px, py - baseR - 14);
        ctx.restore();
      }

      // 6.5. Render Tà Thần Cổ Đại (Hỗ trợ nhiều Tà Thần khi Spam trong Creative Mode)
      const titansToRender = (gameDataRef.current.darkTitans && gameDataRef.current.darkTitans.length > 0)
        ? gameDataRef.current.darkTitans.filter((t: any) => t.isActive)
        : (gameDataRef.current.darkTitan && gameDataRef.current.darkTitan.isActive ? [gameDataRef.current.darkTitan] : []);

      titansToRender.forEach((titan: any) => {
        const tx = titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const ty = titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
        const pulse = Math.sin(timestamp * 0.006);

        ctx.save();
        // Hào quang ma thuật hắc ám Đỏ Rực (Dark Red & Crimson Aura)
        const auraGrad = ctx.createRadialGradient(tx, ty, 4, tx, ty, 24 + pulse * 4);
        auraGrad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
        auraGrad.addColorStop(0.5, 'rgba(153, 27, 27, 0.5)');
        auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(tx, ty, 28 + pulse * 4, 0, Math.PI * 2);
        ctx.fill();

        // ICON VẼ BẰNG VECTOR SVG TÀ THẦN: LỚN, ĐỎ ĐEN, ĐƯỜNG NÉT DÀY, ĐƠN GIẢN, RÕ NÉT KHU THU NHỎ
        const scale = 1.35;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);

        // Nền Đen Tối Thần Ác Quỷ (Solid Deep Black Fill)
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(-7, -5);
        ctx.lineTo(-7, 2);
        ctx.lineTo(0, 10);
        ctx.lineTo(7, 2);
        ctx.lineTo(7, -5);
        ctx.closePath();
        ctx.fillStyle = '#000000';
        ctx.fill();

        // Viền Đỏ Rực Nét Dày (Heavy Crimson Outline Stroke 2.8px)
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Sừng Ác Ma Đỏ Rực Nét Dày (Thick Red Horns)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-9, -10); ctx.lineTo(-5, -4);
        ctx.moveTo(9, -10); ctx.lineTo(5, -4);
        ctx.stroke();

        // Mắt Quỷ Đỏ Hỏa Diệm (Glowing Red Eye Slots)
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-4.5, -2, 3, 2.5);
        ctx.fillRect(1.5, -2, 3, 2.5);

        // Hàm Răng & Vảy Ác Ma (Demon Teeth / Jaw Line)
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-3, 3);
        ctx.lineTo(0, 5);
        ctx.lineTo(3, 3);
        ctx.stroke();

        // Quầng Vương Miện Ác Ma (Crest Line)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(0, -6);
        ctx.stroke();

        ctx.restore();

        // Biển tên & Đồng hồ đếm ngược tồn tại
        const remMin = Math.floor(titan.remainingTime / 60);
        const remSec = titan.remainingTime % 60;
        const titanLabel = `👿 TÀ THẦN [${remMin}:${remSec.toString().padStart(2, '0')}]`;

        const font = 'bold 9px sans-serif';
        const tlw = getCachedWidth(ctx, titanLabel, font) + 10;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.2;
        ctx.fillRect(tx - tlw / 2, ty - 28, tlw, 14);
        ctx.strokeRect(tx - tlw / 2, ty - 28, tlw, 14);

        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'center';
        ctx.fillText(titanLabel, tx, ty - 21);

        // Thanh Máu HP Tà Thần
        const currentHp = titan.hp ?? DARK_TITAN_CONFIG.MAX_HP;
        const maxHp = titan.maxHp ?? DARK_TITAN_CONFIG.MAX_HP;
        const hpRatio = Math.max(0, Math.min(1, currentHp / maxHp));

        const barW = 38;
        const barH = 5;
        const barX = tx - barW / 2;
        const barY = ty + 14;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${currentHp}/${maxHp} HP`, tx, barY + 11);

        // Kỹ năng Tà Thần: Q W E R dots
        const c = titan.cd || { q: 10, w: 16, e: 22, r: 40 };
        const skills = [
          { key: 'Q', ready: c.q <= 0 },
          { key: 'W', ready: c.w <= 0 },
          { key: 'E', ready: c.e <= 0 },
          { key: 'R', ready: c.r <= 0 },
        ];
        let dotX = tx - 15;
        const dotY = barY + 22;
        skills.forEach(s => {
          ctx.fillStyle = s.ready ? '#ef4444' : 'rgba(239, 68, 68, 0.3)';
          ctx.beginPath();
          ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = '6px sans-serif';
          ctx.fillText(s.key, dotX, dotY + 8);
          dotX += 10;
        });

        ctx.restore();

        // 1. Nếu titan.ultCharge > 0: vẽ cảnh báo trực quan rõ ràng trên bản đồ đúng bán kính chiêu lớn
        if (titan.ultCharge && titan.ultCharge > 0) {
          const ux = (titan.ultX ?? titan.x) * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const uy = (titan.ultY ?? titan.y) * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const uRadius = (DARK_TITAN_CONFIG.ULT_RADIUS + (titan.ultBonus ?? 0)) * TILE_PIXEL_SIZE;
          const ultPulse = 0.5 + 0.5 * Math.sin(timestamp * 0.015);
          const chargeRatio = Math.max(0, Math.min(1, titan.ultCharge / (DARK_TITAN_CONFIG.ULT_CHARGE_SECONDS || 3)));

          ctx.save();
          // Tia ngắm nối từ Tà Thần tới tâm thiên thạch
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.55)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(ux, uy);
          ctx.stroke();

          // Vùng nguy hiểm nhấp nháy
          ctx.fillStyle = `rgba(239, 68, 68, ${0.14 + ultPulse * 0.14})`;
          ctx.beginPath();
          ctx.arc(ux, uy, uRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.8;
          ctx.setLineDash([7, 4]);
          ctx.beginPath();
          ctx.arc(ux, uy, uRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Vòng thu hẹp theo thời gian đếm ngược
          ctx.setLineDash([]);
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(ux, uy, Math.max(8, uRadius * chargeRatio), 0, Math.PI * 2);
          ctx.stroke();

          // Tâm điểm nổ
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(ux - 10, uy); ctx.lineTo(ux + 10, uy);
          ctx.moveTo(ux, uy - 10); ctx.lineTo(ux, uy + 10);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`☄️ THIÊN THẠCH: ${Math.ceil(titan.ultCharge)}s`, ux, uy - 14);
          ctx.restore();
        }

        // 2. Nếu titan.rage: vẽ quầng đỏ nhấp nháy quanh Tà Thần
        if (titan.rage) {
          ctx.save();
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 3.0;
          ctx.beginPath();
          ctx.arc(tx, ty, 34 + Math.sin(timestamp * 0.012) * 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // 3. Nếu titan.postUltPauseTimer > 0: hiển thị vòng nghỉ sơ hở để người chơi / bot phản công
        if (titan.postUltPauseTimer && titan.postUltPauseTimer > 0) {
          ctx.save();
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(tx, ty, 28, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`💫 SƠ HỞ (${Math.ceil(titan.postUltPauseTimer)}s)`, tx, ty - 35);
          ctx.restore();
        }
      });

      // Hiệu ứng chiêu thức Tà Thần (vẽ đơn giản, tự biến mất sau vài trăm ms)
      const titanFxList = gameDataRef.current.titanFx as any[] | undefined;
      if (titanFxList && titanFxList.length > 0) {
        const nowMs = Date.now();
        for (let i = titanFxList.length - 1; i >= 0; i--) {
          const fx = titanFxList[i];
          const t = (nowMs - fx.start) / fx.duration;
          if (t >= 1) { titanFxList.splice(i, 1); continue; }
          const fcx = fx.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const fcy = fx.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const fr = fx.radius * TILE_PIXEL_SIZE;
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = fx.color;
          ctx.fillStyle = fx.color;
          ctx.lineWidth = 3;
          if (fx.kind === 'METEOR') {
            ctx.globalAlpha = (1 - t) * 0.45;
            ctx.beginPath(); ctx.arc(fcx, fcy, fr * (0.4 + 0.6 * t), 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1 - t;
            ctx.beginPath(); ctx.arc(fcx, fcy, fr * (0.4 + 0.6 * t), 0, Math.PI * 2); ctx.stroke();
          } else if (fx.kind === 'PORTAL') {
            ctx.globalAlpha = (1 - t) * 0.4;
            ctx.fillStyle = '#9333ea';
            ctx.beginPath(); ctx.arc(fcx, fcy, fr * (0.25 + 0.75 * t), 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 3.2;
            ctx.beginPath(); ctx.arc(fcx, fcy, fr * (0.2 + 0.85 * t), 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2.0;
            ctx.beginPath(); ctx.arc(fcx, fcy, fr * (0.1 + 0.55 * t), 0, Math.PI * 2); ctx.stroke();
          } else if (fx.kind === 'CLAW') {
            ctx.lineWidth = 3.5;
            for (let k = -1; k <= 1; k++) {
              ctx.beginPath();
              ctx.moveTo(fcx - fr * 0.7 + k * 8, fcy - fr * 0.7);
              ctx.lineTo(fcx + fr * 0.7 + k * 8, fcy + fr * 0.7);
              ctx.stroke();
            }
          } else if (fx.kind === 'CHAIN') {
            ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.arc(fcx, fcy, fr * (1 - 0.6 * t), 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
          } else if (fx.kind === 'TELEPORT') {
            ctx.beginPath(); ctx.arc(fcx, fcy, fr * (0.3 + 0.7 * t), 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(fcx, fcy, fr * (0.15 + 0.4 * t), 0, Math.PI * 2); ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 6.8. Render Tuyến Đường Giao Thương Biển (Sea Trade Routes) & Tàu Buôn Hải Cảng (Sea Trade Ships)
      if (gameDataRef.current.tradeRoutes && gameDataRef.current.tradeRoutes.length > 0) {
        ctx.save();
        gameDataRef.current.tradeRoutes.forEach((route: any) => {
          const p1x = route.fromPortX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const p1y = route.fromPortY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const p2x = route.toPortX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const p2y = route.toPortY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.setLineDash(route.isIntercontinental ? [8, 5] : [5, 4]);
          ctx.strokeStyle = route.isIntercontinental ? 'rgba(56, 189, 248, 0.55)' : 'rgba(251, 191, 36, 0.45)';
          ctx.lineWidth = route.isIntercontinental ? 2.2 : 1.4;
          ctx.stroke();

          // Hạt hiệu ứng chuyển động lăn tăn dọc theo hải trình
          const pulseOffset = ((timestamp * 0.002) + (route.distanceTiles % 5) * 0.2) % 1;
          const dotX = p1x + (p2x - p1x) * pulseOffset;
          const dotY = p1y + (p2y - p1y) * pulseOffset;
          ctx.fillStyle = route.isIntercontinental ? '#38bdf8' : '#fbbf24';
          ctx.beginPath();
          ctx.arc(dotX, dotY, route.isIntercontinental ? 2.5 : 2.0, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      if (gameDataRef.current.tradeShips && gameDataRef.current.tradeShips.length > 0) {
        gameDataRef.current.tradeShips.forEach((ship: any) => {
          const startX = ship.sourceX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const startY = ship.sourceY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const endX = ship.targetX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const endY = ship.targetY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

          const prog = Math.min(1.0, Math.max(0.0, ship.progress));
          const curX = startX + (endX - startX) * prog;
          const curY = startY + (endY - startY) * prog;

          ctx.save();
          // Bóng tàu lướt trên bọt sóng
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          ctx.ellipse(curX, curY + 4, ship.isIntercontinental ? 10 : 8, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          // Hào quang quầng sáng Tàu Buôn Hải Cảng
          ctx.fillStyle = ship.isIntercontinental ? 'rgba(14, 165, 233, 0.85)' : 'rgba(245, 158, 11, 0.85)';
          ctx.beginPath();
          ctx.arc(curX, curY, ship.isIntercontinental ? 9.5 : 7.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Icon Tàu Buôn ⛵
          ctx.fillStyle = '#ffffff';
          ctx.font = ship.isIntercontinental ? 'bold 11px sans-serif' : 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⛵', curX, curY);

          // Nhãn hiển thị lượng Vàng Hàng Hóa
          const labelAmt = ship.fromNation === 1 ? (ship.fromCargoGold ?? ship.cargoGold) : ship.toNation === 1 ? (ship.toCargoGold ?? ship.cargoGold) : ship.cargoGold;
          const cargoLabel = `💰${labelAmt}`;
          const fontStr = 'bold 8px sans-serif';
          const tagW = getCachedWidth(ctx, cargoLabel, fontStr) + 6;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = ship.isIntercontinental ? '#38bdf8' : '#fbbf24';
          ctx.lineWidth = 1.0;
          ctx.fillRect(curX - tagW / 2, curY - 18, tagW, 11);
          ctx.strokeRect(curX - tagW / 2, curY - 18, tagW, 11);

          ctx.fillStyle = ship.isIntercontinental ? '#7dd3fc' : '#fef08a';
          ctx.fillText(cargoLabel, curX, curY - 12);
          ctx.restore();
        });
      }

      // 6.9. Hiệu ứng nổ tên lửa (Atom / Hydro / MIRV)
      if (gameDataRef.current.blasts && gameDataRef.current.blasts.length > 0) {
        const nowMs = performance.now();
        gameDataRef.current.blasts = gameDataRef.current.blasts.filter((b: any) => nowMs - b.start < b.duration);
        gameDataRef.current.blasts.forEach((b: any) => {
          const t = Math.min(1, Math.max(0, (nowMs - b.start) / b.duration)); // 0 -> 1
          const R = b.radiusPx;
          ctx.save();
          if (b.kind === 'ATOM') {
            // ATOM: chớp sáng + 1 vòng sóng cam
            ctx.globalAlpha = (1 - t) * 0.9;
            ctx.fillStyle = '#fde68a';
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * (0.4 + t * 0.6), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * (0.3 + t * 1.1), 0, Math.PI * 2);
            ctx.stroke();
          } else if (b.kind === 'HYDRO') {
            // HYDRO: quả cầu lửa to + 2 vòng sóng xung kích
            ctx.globalAlpha = (1 - t) * 0.85;
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * (0.5 + t * 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fb923c';
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * (0.3 + t * 0.4), 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = Math.max(0, 1 - t * 2.5);
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * (0.4 + t * 1.3), 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * (0.2 + t * 0.9), 0, Math.PI * 2);
            ctx.stroke();
          } else if (b.kind === 'FIGHTER') {
            ctx.globalAlpha = (1 - t) * 0.82;
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * (0.3 + t * 0.55), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * (0.25 + t * 1.05), 0, Math.PI * 2);
            ctx.stroke();
          } else {
            // MIRV: chớp hồng nhỏ + vòng sóng hồng (mỗi đầu đạn con)
            ctx.globalAlpha = (1 - t) * 0.85;
            ctx.fillStyle = '#f9a8d4';
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * (0.4 + t * 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(b.x, b.y, R * (0.3 + t * 1.0), 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        });
      }

      // 7. Particles & Floating Texts (Nhỏ, nền tối mờ, tự biến mất, xếp lệch nhau)
      particles.forEach((p: any, idx: number) => {
        if (p.type === 'FLOAT_TEXT' && p.text) {
          ctx.save();
          ctx.font = 'bold 11px sans-serif';
          if ((p as any).textWidth === undefined) {
            (p as any).textWidth = ctx.measureText(p.text).width;
          }
          const textW = (p as any).textWidth + 16;
          const textH = 20;
          
          const offsetY = idx * 22;
          const drawX = p.x;
          const drawY = p.y - offsetY;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          drawRoundRectPath(ctx, drawX - textW / 2, drawY - textH / 2, textW, textH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = p.color || '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.globalAlpha = Math.max(0.1, p.life / p.maxLife);
          ctx.fillText(p.text, drawX, drawY);
          ctx.restore();
        } else if (p.type === 'LASER_BEAM' && p.targetX !== undefined && p.targetY !== undefined) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.targetX, p.targetY);

          // Hào quang hồng chói neon (Neon Pink Glow)
          ctx.strokeStyle = p.color || '#ec4899';
          ctx.lineWidth = 3.6;
          ctx.globalAlpha = Math.max(0.1, p.life / p.maxLife);
          ctx.shadowColor = '#f472b6';
          ctx.shadowBlur = 12;
          ctx.stroke();

          // Lõi tia laser trắng sáng ở giữa
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          ctx.restore();
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life / p.maxLife;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      });
      ctx.globalAlpha = 1.0;

      ctx.restore();

      // 8. Hiệu ứng chớp nháy toàn màn hình giả lập Tia Chớp (Lightning Flash) khi trời MƯA (RAIN)
      if (weatherEnabledRef.current && weatherRef.current === 'RAIN') {
        // Kiểm tra kích hoạt tia chớp tiếp theo
        if (timestamp >= nextLightningTimeRef.current) {
          lightningFlashRef.current = { startTime: timestamp, duration: 280 };
          // Chu kỳ chớp tiếp theo ngẫu nhiên sau 5 - 11 giây
          nextLightningTimeRef.current = timestamp + 5000 + Math.random() * 6000;
          soundManager.playThunder();
        }

        if (lightningFlashRef.current) {
          const elapsed = timestamp - lightningFlashRef.current.startTime;
          const dur = lightningFlashRef.current.duration;
          if (elapsed < dur) {
            // Hiệu ứng chớp giật 2 nhịp kịch tính (Double-pulse lightning)
            let flashAlpha = 0;
            if (elapsed < 45) {
              flashAlpha = 0.42 * (elapsed / 45); // Nhịp 1: Bừng sáng rực rỡ
            } else if (elapsed < 85) {
              flashAlpha = 0.42 - 0.28 * ((elapsed - 45) / 40); // Nháy thụt nhẹ tự nhiên
            } else if (elapsed < 140) {
              flashAlpha = 0.38 * (1 - (elapsed - 85) / 55); // Nhịp 2: Bật sáng trở lại
            } else {
              flashAlpha = 0.16 * (1 - (elapsed - 140) / (dur - 140)); // Tan dần êm dịu
            }

            if (flashAlpha > 0.01) {
              ctx.save();
              ctx.fillStyle = `rgba(224, 242, 254, ${flashAlpha})`;
              ctx.fillRect(0, 0, vpW, vpH);
              ctx.restore();
            }
          } else {
            lightningFlashRef.current = null;
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    renderTerrainBuffer, renderTerritoryBuffer, clampCamera, canvasRef, 
    offscreenTerrainCanvasRef, offscreenTerritoryCanvasRef, offscreenTerrainDirtyRef, 
    offscreenTerritoryDirtyRef, dirtyTerritoryTilesRef, fogBaseGridRef, fogBaseDirtyRef, 
    fogGridRef, fogOfWarEnabledRef, nationCentersRef, viewportSizeRef, cameraRef, 
    cameraAnimRef, needsCenterCameraRef, screenShakeRef, weatherRef, weatherEnabledRef, 
    weatherParticlesRef, lightningFlashRef, nextLightningTimeRef, tapRipplesRef, 
    captureFlashRef, selectedTileRef, isMultiplayerRef, myNationIdRef, gameDataRef, 
    gameStateRef, isPaused, gameSpeed
  ]);

  return {
    initWeatherParticles,
    renderTerrainBuffer,
    renderTerritoryBuffer,
  };
}
