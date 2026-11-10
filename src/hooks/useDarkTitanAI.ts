import { useCallback } from 'react';
import { DarkTitan } from '../types';
import { soundManager } from '../utils/audio';
import { 
  TILE_PIXEL_SIZE, DARK_TITAN_CONFIG, formatGameTime, BUILDING_INFO 
} from '../utils/constants';

export interface UseDarkTitanAIParams {
  gameDataRef: React.MutableRefObject<any>;
  offscreenTerritoryDirtyRef: React.MutableRefObject<boolean>;
}

export function useDarkTitanAI({ gameDataRef, offscreenTerritoryDirtyRef }: UseDarkTitanAIParams) {
  const updateDarkTitans = useCallback(() => {
    const data = gameDataRef.current;
    if (!data || !data.tiles || !data.nations) return;

    const { tiles, nations } = data;
    const size = tiles.length;

    // --- Quản lý TẤT CẢ Tà Thần Cổ Đại (Hỗ trợ Spam nhiều Tà Thần) ---
    data.darkTitans = data.darkTitans || [];
    if (!data.darkTitan && data.darkTitans.length === 0 && data.gameTimeSeconds >= DARK_TITAN_CONFIG.SPAWN_TIME_SECONDS) {
      const landTiles: { x: number; y: number }[] = [];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (tiles[y][x].terrain !== 'WATER') {
            landTiles.push({ x, y });
          }
        }
      }
      if (landTiles.length > 0) {
        const spawnTile = landTiles[Math.floor(Math.random() * landTiles.length)];
        const newTitan: DarkTitan = {
          id: Math.random().toString(),
          isActive: true,
          spawnTimestamp: data.gameTimeSeconds,
          remainingTime: DARK_TITAN_CONFIG.DURATION_SECONDS,
          x: spawnTile.x,
          y: spawnTile.y,
          hp: DARK_TITAN_CONFIG.MAX_HP,
          maxHp: DARK_TITAN_CONFIG.MAX_HP,
          moveTimer: 0,
          hasWarnedDespawn: false,
        };
        data.darkTitans.push(newTitan);
        data.darkTitan = newTitan;

        soundManager.playThunder();
        data.events.unshift({
          id: Math.random().toString(),
          title: '⚠️ TÀ THẦN GIÁNG LÂM',
          description: `Tà Thần cổ đại đã thức tỉnh tại (${spawnTile.x}, ${spawnTile.y})! Bất kỳ quốc gia hay công trình nào trên đường đi sẽ bị hủy diệt!`,
          type: 'PLAGUE',
          targetNationId: 0,
          timestamp: formatGameTime(data.gameTimeSeconds),
        });

        data.particles.push({
          x: spawnTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          y: spawnTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          color: '#dc2626',
          size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.8,
          type: 'FLOAT_TEXT',
          text: '⚠️ TÀ THẦN GIÁNG LÂM ⚠️',
        });
      }
    }

    // Cập nhật tất cả các Tà Thần đang sống
    data.darkTitans.forEach((titan: DarkTitan) => {
      if (!titan.isActive) return;
      titan.remainingTime -= 1;

      // Cảnh báo trước khi biến mất
      if (titan.remainingTime === DARK_TITAN_CONFIG.WARNING_BEFORE_DESPAWN && !titan.hasWarnedDespawn) {
        titan.hasWarnedDespawn = true;
        data.events.unshift({
          id: Math.random().toString(),
          title: '⏳ TÀ THẦN SUY YẾU',
          description: `Năng lượng hắc ám tiêu tán, Tà Thần sẽ biến mất sau ${DARK_TITAN_CONFIG.WARNING_BEFORE_DESPAWN} giây nữa!`,
          type: 'PLAGUE',
          targetNationId: 0,
          timestamp: formatGameTime(data.gameTimeSeconds),
        });
      }

      // Hết thời gian -> Biến mất
      if (titan.remainingTime <= 0) {
        soundManager.playCapture();
        data.events.unshift({
          id: Math.random().toString(),
          title: '✨ TÀ THẦN BIẾN MẤT',
          description: 'Tà Thần đã cạn kiệt nguyên khí và tan biến vào hư không. Các quốc gia tạm thời bình yên!',
          type: 'HARVEST',
          targetNationId: 0,
          timestamp: formatGameTime(data.gameTimeSeconds),
        });

        data.particles.push({
          x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          color: '#a855f7',
          size: 0, life: 50, maxLife: 50, vx: 0, vy: -0.7,
          type: 'FLOAT_TEXT',
          text: '✨ Tà Thần Tan Biến',
        });

        titan.isActive = false;
      } else {
        // ===== KỸ NĂNG TÀ THẦN (kiểu Liên Quân) =====
        const TS = TILE_PIXEL_SIZE;
        const cd = (titan.cd = titan.cd || { q: 4, w: 8, e: 14, r: 25 });
        if (titan.slowTimer && titan.slowTimer > 0) titan.slowTimer -= 1;
        if (!titan.rage && titan.hp / titan.maxHp <= DARK_TITAN_CONFIG.RAGE_HP_RATIO) {
          titan.rage = true;
          soundManager.playThunder();
          data.events.unshift({ id: Math.random().toString(), title: '🔥 TÀ THẦN CUỒNG NỘ', description: 'Tà Thần dưới 50% máu: di chuyển nhanh hơn, hồi chiêu nhanh hơn, sát thương +50%!', type: 'PLAGUE', targetNationId: 0, timestamp: formatGameTime(data.gameTimeSeconds) });
        }
        const cdStep = titan.rage ? 1.5 : 1;
        cd.q -= cdStep; cd.w -= cdStep; cd.e -= cdStep; cd.r -= cdStep;
        const dmgMul = titan.rage ? 1.5 : 1;
        const say = (text: string, color: string) => {
          data.particles.push({ x: titan.x * TS + TS / 2, y: titan.y * TS + TS / 2, color, size: 0, life: 45, maxLife: 45, vx: 0, vy: -0.8, type: 'FLOAT_TEXT', text });
        };
        const hitArea = (cx: number, cy: number, radius: number, loss: number, isPercent: boolean, destroyAll: boolean, eat: number = 0) => {
          const victims = new Set<number>();
          for (let yy = Math.max(0, cy - radius); yy <= Math.min(size - 1, cy + radius); yy++) {
            for (let xx = Math.max(0, cx - radius); xx <= Math.min(size - 1, cx + radius); xx++) {
              if (Math.hypot(xx - cx, yy - cy) > radius) continue;
              const t = tiles[yy][xx];
              if (t.owner > 0) {
                victims.add(t.owner);
                if (t.building !== 'NONE') t.building = (!destroyAll && t.building === 'FORTRESS') ? 'CITY' : 'NONE';
                if (destroyAll) t.scorchedTimer = 30;
                if (eat > 0 && Math.random() < eat) { t.owner = 0; t.building = 'NONE'; t.scorchedTimer = 30; }
              }
            }
          }
          victims.forEach(id => {
            const n = nations[id];
            if (!n) return;
            const l = isPercent ? Math.floor(n.troops * loss) : Math.round(loss);
            n.troops = Math.max(0, n.troops - l);
            data.particles.push({ x: cx * TS + TS / 2, y: cy * TS + TS / 2, color: '#dc2626', size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.5, type: 'FLOAT_TEXT', text: `☠️ -${l} Quân (${n.name})` });
          });
          offscreenTerritoryDirtyRef.current = true;
        };
        const nearestOwned = (radius: number) => {
          let best: { x: number; y: number } | null = null;
          let bd = Infinity;
          for (let yy = Math.max(0, titan.y - radius); yy <= Math.min(size - 1, titan.y + radius); yy++) {
            for (let xx = Math.max(0, titan.x - radius); xx <= Math.min(size - 1, titan.x + radius); xx++) {
              if (tiles[yy][xx].owner > 0) {
                const d = Math.hypot(xx - titan.x, yy - titan.y);
                if (d <= radius && d < bd) { bd = d; best = { x: xx, y: yy }; }
              }
            }
          }
          return best;
        };

        if (titan.ultCharge && titan.ultCharge > 0) {
          titan.ultCharge -= 1;
          if (titan.ultCharge <= 0) {
            const ux = titan.ultX ?? titan.x, uy = titan.ultY ?? titan.y;
            soundManager.playThunder();
            hitArea(ux, uy, DARK_TITAN_CONFIG.ULT_RADIUS, 0.4 * dmgMul, true, true, 1);
            data.attackWaves = data.attackWaves.filter((w: any) => Math.hypot(w.targetX - ux, w.targetY - uy) > DARK_TITAN_CONFIG.ULT_RADIUS);
            say('☄️ THIÊN THẠCH HẮC ÁM!', '#f97316');
          }
        } else {
          const near = nearestOwned(10);
          const wavesNear = data.attackWaves.filter((w: any) => Math.hypot(w.targetX - titan.x, w.targetY - titan.y) <= 7);
          if (cd.r <= 0 && near) {
            titan.ultCharge = DARK_TITAN_CONFIG.ULT_CHARGE_SECONDS;
            titan.ultX = near.x; titan.ultY = near.y;
            cd.r = DARK_TITAN_CONFIG.ULT_COOLDOWN;
            soundManager.playThunder();
            say('☄️ Thiên Thạch sắp giáng xuống!', '#f97316');
          } else if (cd.q <= 0 && nearestOwned(2)) {
            hitArea(titan.x, titan.y, 3, 80 * dmgMul, false, true, 0.4);
            titan.hp = Math.min(titan.maxHp, titan.hp + Math.floor(titan.maxHp * 0.02));
            cd.q = DARK_TITAN_CONFIG.Q_COOLDOWN;
            say('🩸 Móng Vuốt Hủy Diệt', '#ef4444');
          } else if (cd.w <= 0 && wavesNear.length > 0) {
            wavesNear.forEach((w: any) => { w.troops = Math.floor(w.troops * 0.85); });
            titan.slowTimer = 6;
            cd.w = DARK_TITAN_CONFIG.W_COOLDOWN;
            say('⛓️ Xiềng Xích Bóng Tối', '#a855f7');
          } else if (cd.e <= 0) {
            const spots: { x: number; y: number }[] = [];
            for (let yy = Math.max(0, titan.y - 10); yy <= Math.min(size - 1, titan.y + 10); yy++) {
              for (let xx = Math.max(0, titan.x - 10); xx <= Math.min(size - 1, titan.x + 10); xx++) {
                const d = Math.hypot(xx - titan.x, yy - titan.y);
                if (d >= 3 && d <= 10 && tiles[yy][xx].owner > 0 && tiles[yy][xx].building !== 'NONE') spots.push({ x: xx, y: yy });
              }
            }
            if (spots.length > 0) {
              const spot = spots[Math.floor(Math.random() * spots.length)];
              titan.x = spot.x; titan.y = spot.y; titan.moveTimer = 0;
              cd.e = DARK_TITAN_CONFIG.E_COOLDOWN;
              say('🌀 Dịch Chuyển Bóng Đêm', '#8b5cf6');
              hitArea(titan.x, titan.y, 2, 60 * dmgMul, false, true, 0.5);
            }
          }
        }

        // Di chuyển theo chu kỳ cấu hình (mặc định 8 giây / ô)
        if (!(titan.ultCharge && titan.ultCharge > 0)) titan.moveTimer += 1;
        const moveInterval = titan.rage ? Math.max(2, DARK_TITAN_CONFIG.MOVE_INTERVAL_SECONDS - 2) : DARK_TITAN_CONFIG.MOVE_INTERVAL_SECONDS;
        if (titan.moveTimer >= moveInterval) {
          titan.moveTimer = 0;

          const neighbors = [
            [titan.x + 1, titan.y], [titan.x - 1, titan.y],
            [titan.x, titan.y + 1], [titan.x, titan.y - 1],
            [titan.x + 1, titan.y + 1], [titan.x - 1, titan.y - 1],
            [titan.x + 1, titan.y - 1], [titan.x - 1, titan.y + 1],
          ].filter(([nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size && tiles[ny][nx].terrain !== 'WATER');

          if (neighbors.length > 0) {
            const targetOption = neighbors.find(([nx, ny]) => tiles[ny][nx].building !== 'NONE' || tiles[ny][nx].owner > 0) ||
              neighbors[Math.floor(Math.random() * neighbors.length)];

            titan.x = targetOption[0];
            titan.y = targetOption[1];

            const currentTile = tiles[titan.y][titan.x];

            // Phá hoặc hạ cấp công trình
            if (currentTile.building !== 'NONE') {
              const oldBuilding = currentTile.building;
              if (oldBuilding === 'FORTRESS') {
                currentTile.building = 'CITY'; // Hạ cấp
              } else {
                currentTile.building = 'NONE'; // Phá hủy hoàn toàn
              }
              offscreenTerritoryDirtyRef.current = true;
              data.particles.push({
                x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                color: '#ef4444',
                size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
                type: 'FLOAT_TEXT',
                text: `💥 Tà Thần phá hoại ${BUILDING_INFO[oldBuilding as keyof typeof BUILDING_INFO]?.name || oldBuilding}!`,
              });
            }

            // Giảm quân đội của quốc gia ở ô đó (không phân biệt người chơi hay bot)
            if (currentTile.owner > 0) {
              const victim = nations[currentTile.owner];
              if (victim) {
                const dmgTroops = Math.round(DARK_TITAN_CONFIG.DAMAGE_TROOPS * dmgMul);
                victim.troops = Math.max(0, victim.troops - dmgTroops);
                data.particles.push({
                  x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  color: '#dc2626',
                  size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.5,
                  type: 'FLOAT_TEXT',
                  text: `☠️ -${dmgTroops} Quân (${victim.name})`,
                });
              }
            }
            hitArea(titan.x, titan.y, 2, Math.round(DARK_TITAN_CONFIG.DAMAGE_TROOPS * dmgMul), false, true, 0.5);
          }
        }
      }
    });

    // Lọc bỏ Tà Thần đã hết giờ
    data.darkTitans = data.darkTitans.filter((t: DarkTitan) => t.isActive);
    data.darkTitan = data.darkTitans[0] || null;
  }, [gameDataRef, offscreenTerritoryDirtyRef]);

  return { updateDarkTitans };
}
