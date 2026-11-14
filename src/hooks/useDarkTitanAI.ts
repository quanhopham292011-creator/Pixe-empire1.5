import React, { useCallback } from 'react';
import { DarkTitan, PendingTitanSpawn } from '../types';
import { applyCasualties } from '../utils/casualties';
import { soundManager } from '../utils/audio';
import { 
  TILE_PIXEL_SIZE, DARK_TITAN_CONFIG, formatGameTime, BUILDING_INFO 
} from '../utils/constants';

export interface UseDarkTitanAIParams {
  gameDataRef: React.MutableRefObject<any>;
  offscreenTerritoryDirtyRef: React.MutableRefObject<boolean>;
  difficultyRef: React.MutableRefObject<string>;
  screenShakeRef?: React.MutableRefObject<{ intensity: number; duration: number }>;
  isMultiplayerRef?: React.MutableRefObject<boolean>;
  myNationIdRef?: React.MutableRefObject<number>;
  onTitanSyncNeeded?: () => void;
}

export function computeThreat(data: any): number {
  const list: number[] = [];
  Object.values(data.nations || {}).forEach((n: any) => {
    if (n && n.id > 0 && !n.isEliminated) list.push(n.troops || 0);
  });
  list.sort((a, b) => b - a);
  const top = list.slice(0, 5);
  const avg = top.length ? top.reduce((s, v) => s + v, 0) / top.length : 0;
  const powerF = Math.min(1, avg / DARK_TITAN_CONFIG.POWER_REF);
  const timeF = Math.min(1, Math.max(0, (data.gameTimeSeconds - DARK_TITAN_CONFIG.SPAWN_TIME_SECONDS) / DARK_TITAN_CONFIG.TIME_REF_SECONDS));
  return 0.5 * powerF + 0.5 * timeF; // 0..1, có trần
}

export function buildDarkTitan(params: {
  id?: string;
  x: number;
  y: number;
  gameTimeSeconds: number;
  hp: number;
  tier?: number;
  dmgScale?: number;
  cdScale?: number;
  moveBonus?: number;
  ultBonus?: number;
}): DarkTitan {
  return {
    id: params.id || Math.random().toString(),
    isActive: true,
    spawnTimestamp: params.gameTimeSeconds,
    remainingTime: DARK_TITAN_CONFIG.DURATION_SECONDS,
    x: params.x,
    y: params.y,
    hp: params.hp,
    maxHp: params.hp,
    moveTimer: 0,
    hasWarnedDespawn: false,
    cd: {
      q: Math.round(DARK_TITAN_CONFIG.Q_COOLDOWN * 0.7),
      w: Math.round(DARK_TITAN_CONFIG.W_COOLDOWN * 0.75),
      e: Math.round(DARK_TITAN_CONFIG.E_COOLDOWN),
      r: Math.round(DARK_TITAN_CONFIG.ULT_COOLDOWN),
    },
    tier: params.tier ?? 1,
    dmgScale: params.dmgScale ?? 1,
    cdScale: params.cdScale ?? 1,
    moveBonus: params.moveBonus ?? 0,
    ultBonus: params.ultBonus ?? 0,
    postUltPauseTimer: 0,
  };
}

export function triggerTitanArrivalEffects(
  data: any,
  x: number,
  y: number,
  screenShakeRef?: React.MutableRefObject<{ intensity: number; duration: number }>
) {
  const TS = TILE_PIXEL_SIZE;
  const cx = x * TS + TS / 2;
  const cy = y * TS + TS / 2;

  data.titanFx = data.titanFx || [];
  if (data.titanFx.length > 30) data.titanFx.shift();
  data.titanFx.push({
    kind: 'PORTAL',
    x,
    y,
    radius: 3.8,
    duration: 1300,
    color: '#a855f7',
    start: Date.now(),
  });

  data.particles = data.particles || [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.2;
    const spd = 0.8 + Math.random() * 1.4;
    data.particles.push({
      x: cx,
      y: cy,
      color: i % 2 === 0 ? '#dc2626' : '#a855f7',
      size: i % 3 === 0 ? 4 : 3,
      life: 40,
      maxLife: 40,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      type: i % 2 === 0 ? 'SPARK' : 'AURA',
    });
  }

  if (screenShakeRef) {
    screenShakeRef.current = { intensity: 14, duration: 28 };
  }
  soundManager.playTitanRoar();
}

export function stepDarkTitanSystem({
  data,
  offscreenTerritoryDirtyRef,
  difficultyRef,
  screenShakeRef,
  isMultiplayerClientNonHost = false,
  onSyncNeeded,
}: {
  data: any;
  offscreenTerritoryDirtyRef: React.MutableRefObject<boolean>;
  difficultyRef: React.MutableRefObject<string>;
  screenShakeRef?: React.MutableRefObject<{ intensity: number; duration: number }>;
  isMultiplayerClientNonHost?: boolean;
  onSyncNeeded?: () => void;
}) {
  if (!data || !data.tiles || !data.nations) return;

  const { tiles, nations } = data;
  const size = tiles.length;
  const TS = TILE_PIXEL_SIZE;

  data.darkTitans = data.darkTitans || [];
  data.particles = data.particles || [];
  data.events = data.events || [];
  if (data.nextTitanSpawnAt === undefined) {
    data.nextTitanSpawnAt = DARK_TITAN_CONFIG.SPAWN_TIME_SECONDS;
  }

  // --- 1. CẢNH BÁO TRƯỚC 10 GIÂY & CỔNG KHÔNG GIAN CỐ ĐỊNH VỊ TRÍ ---
  if (!isMultiplayerClientNonHost && !data.darkTitan && data.darkTitans.length === 0 && !data.pendingTitanSpawn && data.gameTimeSeconds >= data.nextTitanSpawnAt) {
    const landTiles: { x: number; y: number }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (tiles[y]?.[x]?.terrain !== 'WATER') {
          landTiles.push({ x, y });
        }
      }
    }

    if (landTiles.length > 0) {
      const spawnTile = landTiles[Math.floor(Math.random() * landTiles.length)];
      const diff = difficultyRef.current || 'EASY';
      const threat = computeThreat(data);
      const tier = threat >= 0.66 ? 3 : threat >= 0.33 ? 2 : 1;
      const scaledHp = Math.round(DARK_TITAN_CONFIG.MAX_HP * (1 + threat * (DARK_TITAN_CONFIG.HP_GROW[diff] ?? 2)));
      const warnSec = DARK_TITAN_CONFIG.SPAWN_WARNING_SECONDS;

      const pending: PendingTitanSpawn = {
        id: Math.random().toString(),
        x: spawnTile.x,
        y: spawnTile.y,
        remainingSeconds: warnSec,
        totalSeconds: warnSec,
        tier,
        hp: scaledHp,
        dmgScale: 1 + threat * (DARK_TITAN_CONFIG.DMG_GROW[diff] ?? 0.5),
        cdScale: tier >= 3 ? 1.2 : 1,
        moveBonus: tier >= 2 ? 1 : 0,
        ultBonus: tier >= 3 ? 2 : tier >= 2 ? 1 : 0,
      };
      data.pendingTitanSpawn = pending;

      soundManager.playWarningSiren();
      data.events.unshift({
        id: Math.random().toString(),
        title: '🌀 CẢNH BÁO: CỔNG TÀ THẦN MỞ RA',
        description: `Cổng không gian hắc ám đã mở tại (${spawnTile.x}, ${spawnTile.y})! Tà Thần [Cấp ${tier}: ${DARK_TITAN_CONFIG.TIER_NAMES[tier - 1]} – ${scaledHp} HP] sẽ giáng lâm sau ${warnSec} giây!`,
        type: 'PLAGUE',
        targetNationId: 0,
        timestamp: formatGameTime(data.gameTimeSeconds),
      });
      if (data.events.length > 50) data.events.length = 50;

      data.particles.push({
        x: spawnTile.x * TS + TS / 2,
        y: spawnTile.y * TS + TS / 2,
        color: '#a855f7',
        size: 0,
        life: 60,
        maxLife: 60,
        vx: 0,
        vy: -0.7,
        type: 'FLOAT_TEXT',
        text: `🌀 CỔNG TÀ THẦN (${warnSec}s)!`,
      });

      onSyncNeeded?.();
    }
  } else if (data.pendingTitanSpawn) {
    const pending: PendingTitanSpawn = data.pendingTitanSpawn;
    // Giữ nguyên tọa độ (x, y) đã chọn, chỉ đếm ngược & tạo hạt năng lượng nhẹ quanh cổng
    const px = pending.x * TS + TS / 2;
    const py = pending.y * TS + TS / 2;
    for (let k = 0; k < 4; k++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 14;
      data.particles.push({
        x: px + Math.cos(ang) * dist,
        y: py + Math.sin(ang) * dist,
        color: k % 2 === 0 ? '#a855f7' : '#ef4444',
        size: 2.5,
        life: 25,
        maxLife: 25,
        vx: -Math.cos(ang) * 0.45,
        vy: -Math.sin(ang) * 0.45,
        type: 'AURA',
      });
    }

    pending.remainingSeconds = Math.max(0, pending.remainingSeconds - 1);

    if (pending.remainingSeconds <= 0 && !isMultiplayerClientNonHost) {
      const newTitan = buildDarkTitan({
        x: pending.x,
        y: pending.y,
        gameTimeSeconds: data.gameTimeSeconds,
        hp: pending.hp,
        tier: pending.tier,
        dmgScale: pending.dmgScale,
        cdScale: pending.cdScale,
        moveBonus: pending.moveBonus,
        ultBonus: pending.ultBonus,
      });

      data.pendingTitanSpawn = null;
      data.darkTitans.push(newTitan);
      data.darkTitan = newTitan;

      triggerTitanArrivalEffects(data, newTitan.x, newTitan.y, screenShakeRef);

      data.events.unshift({
        id: Math.random().toString(),
        title: '⚠️ TÀ THẦN GIÁNG LÂM',
        description: `Tà Thần cổ đại đã thức tỉnh từ cổng không gian tại (${newTitan.x}, ${newTitan.y})! [Cấp ${pending.tier}: ${DARK_TITAN_CONFIG.TIER_NAMES[(pending.tier || 1) - 1]} – ${pending.hp} HP]`,
        type: 'PLAGUE',
        targetNationId: 0,
        timestamp: formatGameTime(data.gameTimeSeconds),
      });
      if (data.events.length > 50) data.events.length = 50;

      data.particles.push({
        x: newTitan.x * TS + TS / 2,
        y: newTitan.y * TS + TS / 2,
        color: '#dc2626',
        size: 0,
        life: 60,
        maxLife: 60,
        vx: 0,
        vy: -0.8,
        type: 'FLOAT_TEXT',
        text: '⚠️ TÀ THẦN GIÁNG LÂM ⚠️',
      });

      onSyncNeeded?.();
    }
  }

  // Trong Multiplayer, máy khách (non-host) nhận trạng thái Tà Thần đồng bộ từ Host
  if (isMultiplayerClientNonHost) {
    return;
  }

  // --- 2. CẬP NHẬT TẤT CẢ TÀ THẦN ĐANG HOẠT ĐỘNG ---
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
        x: titan.x * TS + TS / 2,
        y: titan.y * TS + TS / 2,
        color: '#a855f7',
        size: 0,
        life: 50,
        maxLife: 50,
        vx: 0,
        vy: -0.7,
        type: 'FLOAT_TEXT',
        text: '✨ Tà Thần Tan Biến',
      });

      titan.isActive = false;
      return;
    }

    // ===== KỸ NĂNG & CHIẾN ĐẤU TÀ THẦN =====
    const cd = (titan.cd = titan.cd || {
      q: Math.round(DARK_TITAN_CONFIG.Q_COOLDOWN * 0.7),
      w: Math.round(DARK_TITAN_CONFIG.W_COOLDOWN * 0.75),
      e: Math.round(DARK_TITAN_CONFIG.E_COOLDOWN),
      r: Math.round(DARK_TITAN_CONFIG.ULT_COOLDOWN),
    });

    if (titan.slowTimer && titan.slowTimer > 0) titan.slowTimer -= 1;

    if (!titan.rage && titan.hp / titan.maxHp <= DARK_TITAN_CONFIG.RAGE_HP_RATIO) {
      titan.rage = true;
      soundManager.playTitanRoar();
      data.events.unshift({
        id: Math.random().toString(),
        title: '🔥 TÀ THẦN CUỒNG NỘ',
        description: 'Tà Thần dưới 50% máu: di chuyển nhanh hơn, hồi chiêu nhanh hơn, sát thương +50%!',
        type: 'PLAGUE',
        targetNationId: 0,
        timestamp: formatGameTime(data.gameTimeSeconds),
      });
    }

    // Khoảng nghỉ hồi chiêu chuẩn (+10-12.5% ở cả trạng thái thường và cuồng nộ)
    const cdStep = (titan.rage ? 1.5 : 1) * (titan.cdScale ?? 1);
    cd.q -= cdStep;
    cd.w -= cdStep;
    cd.e -= cdStep;
    cd.r -= cdStep;

    // Khoảng nghỉ ngắn sau chiêu lớn R để đối thủ phản công
    if (titan.postUltPauseTimer && titan.postUltPauseTimer > 0) {
      titan.postUltPauseTimer -= 1;
      return;
    }

    const dmgMul = (titan.rage ? 1.5 : 1) * (titan.dmgScale ?? 1);
    const say = (text: string, color: string) => {
      data.particles.push({
        x: titan.x * TS + TS / 2,
        y: titan.y * TS + TS / 2,
        color,
        size: 0,
        life: 45,
        maxLife: 45,
        vx: 0,
        vy: -0.8,
        type: 'FLOAT_TEXT',
        text,
      });
    };

    const addFx = (
      kind: 'CLAW' | 'CHAIN' | 'TELEPORT' | 'METEOR' | 'PORTAL',
      fx: number,
      fy: number,
      radius: number,
      duration: number,
      color: string
    ) => {
      data.titanFx = data.titanFx || [];
      if (data.titanFx.length > 30) data.titanFx.shift();
      data.titanFx.push({ kind, x: fx, y: fy, radius, duration, color, start: Date.now() });
    };

    const hitArea = (
      cx: number,
      cy: number,
      radius: number,
      loss: number,
      isPercent: boolean,
      destroyAll: boolean,
      eat: number = 0
    ) => {
      const victims = new Set<number>();
      for (let yy = Math.max(0, cy - radius); yy <= Math.min(size - 1, cy + radius); yy++) {
        for (let xx = Math.max(0, cx - radius); xx <= Math.min(size - 1, cx + radius); xx++) {
          if (Math.hypot(xx - cx, yy - cy) > radius) continue;
          const t = tiles[yy][xx];
          if (t.owner > 0) {
            victims.add(t.owner);
            if (t.building !== 'NONE') {
              t.building = (!destroyAll && t.building === 'FORTRESS') ? 'CITY' : 'NONE';
            }
            if (destroyAll) t.scorchedTimer = 25;
            if (eat > 0 && Math.random() < eat) {
              t.owner = 0;
              t.building = 'NONE';
              t.scorchedTimer = 25;
            }
          }
        }
      }
      victims.forEach(id => {
        const n = nations[id];
        if (!n) return;
        const l = isPercent ? Math.floor(n.troops * loss) : Math.round(loss);
        n.troops = Math.max(0, n.troops - l);
        applyCasualties(n, l);
        data.particles.push({
          x: cx * TS + TS / 2,
          y: cy * TS + TS / 2,
          color: '#dc2626',
          size: 0,
          life: 35,
          maxLife: 35,
          vx: 0,
          vy: -0.5,
          type: 'FLOAT_TEXT',
          text: `☠️ -${l} Quân (${n.name})`,
        });
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
            if (d <= radius && d < bd) {
              bd = d;
              best = { x: xx, y: yy };
            }
          }
        }
      }
      return best;
    };

    let didCastSkill = false;

    if (titan.ultCharge && titan.ultCharge > 0) {
      titan.ultCharge -= 1;
      if (titan.ultCharge <= 0) {
        const ux = titan.ultX ?? titan.x;
        const uy = titan.ultY ?? titan.y;
        const ultR = DARK_TITAN_CONFIG.ULT_RADIUS + (titan.ultBonus ?? 0);
        soundManager.playTitanRoar();
        if (screenShakeRef) {
          screenShakeRef.current = { intensity: 10, duration: 20 };
        }
        const ultLossRatio = Math.min(
          DARK_TITAN_CONFIG.ULT_MAX_TROOP_LOSS_RATIO,
          DARK_TITAN_CONFIG.ULT_TROOP_LOSS_RATIO * dmgMul
        );
        hitArea(ux, uy, ultR, ultLossRatio, true, true, 0.55);
        addFx('METEOR', ux, uy, ultR, 950, '#f97316');
        data.attackWaves = (data.attackWaves || []).filter(
          (w: any) => Math.hypot(w.targetX - ux, w.targetY - uy) > ultR
        );
        titan.postUltPauseTimer = DARK_TITAN_CONFIG.POST_ULT_PAUSE_SECONDS;
        titan.ultX = undefined;
        titan.ultY = undefined;
        say('☄️ THIÊN THẠCH HẮC ÁM!', '#f97316');
        data.particles.push({
          x: titan.x * TS + TS / 2,
          y: titan.y * TS + TS / 2 - 14,
          color: '#fbbf24',
          size: 0,
          life: 55,
          maxLife: 55,
          vx: 0,
          vy: -0.6,
          type: 'FLOAT_TEXT',
          text: '💫 Tà Thần sơ hở — Hãy phản công!',
        });
      }
    } else {
      const near = nearestOwned(10);
      const wavesNear = (data.attackWaves || []).filter(
        (w: any) => Math.hypot(w.targetX - titan.x, w.targetY - titan.y) <= 7
      );

      if (cd.r <= 0 && near) {
        titan.ultCharge = DARK_TITAN_CONFIG.ULT_CHARGE_SECONDS;
        titan.ultX = near.x;
        titan.ultY = near.y;
        cd.r = DARK_TITAN_CONFIG.ULT_COOLDOWN;
        soundManager.playWarningSiren();
        say('☄️ CẢNH BÁO: Thiên Thạch sắp rơi!', '#f97316');
        didCastSkill = true;
      } else if (cd.q <= 0 && nearestOwned(2)) {
        hitArea(titan.x, titan.y, 3, DARK_TITAN_CONFIG.Q_DAMAGE_TROOPS * dmgMul, false, false, 0.25);
        addFx('CLAW', titan.x, titan.y, 3, 600, '#ef4444');
        titan.hp = Math.min(titan.maxHp, titan.hp + Math.floor(titan.maxHp * 0.02));
        cd.q = DARK_TITAN_CONFIG.Q_COOLDOWN;
        say('🩸 Móng Vuốt Hủy Diệt', '#ef4444');
        didCastSkill = true;
      } else if (cd.w <= 0 && wavesNear.length > 0) {
        wavesNear.forEach((w: any) => {
          w.troops = Math.max(0, Math.floor(w.troops * (1 - DARK_TITAN_CONFIG.W_WAVE_LOSS_RATIO)));
        });
        titan.slowTimer = 6;
        addFx('CHAIN', titan.x, titan.y, 7, 800, '#a855f7');
        cd.w = DARK_TITAN_CONFIG.W_COOLDOWN;
        say('⛓️ Xiềng Xích Bóng Tối', '#a855f7');
        didCastSkill = true;
      } else if (cd.e <= 0) {
        const spots: { x: number; y: number }[] = [];
        for (let yy = Math.max(0, titan.y - 10); yy <= Math.min(size - 1, titan.y + 10); yy++) {
          for (let xx = Math.max(0, titan.x - 10); xx <= Math.min(size - 1, titan.x + 10); xx++) {
            const d = Math.hypot(xx - titan.x, yy - titan.y);
            if (d >= 3 && d <= 10 && tiles[yy][xx].owner > 0 && tiles[yy][xx].building !== 'NONE') {
              spots.push({ x: xx, y: yy });
            }
          }
        }
        if (spots.length > 0) {
          const spot = spots[Math.floor(Math.random() * spots.length)];
          addFx('TELEPORT', titan.x, titan.y, 2.5, 700, '#8b5cf6');
          titan.x = spot.x;
          titan.y = spot.y;
          titan.moveTimer = 0;
          addFx('TELEPORT', titan.x, titan.y, 2.5, 700, '#8b5cf6');
          cd.e = DARK_TITAN_CONFIG.E_COOLDOWN;
          say('🌀 Dịch Chuyển Bóng Đêm', '#8b5cf6');
          hitArea(titan.x, titan.y, 2, DARK_TITAN_CONFIG.E_DAMAGE_TROOPS * dmgMul, false, false, 0.2);
          didCastSkill = true;
        }
      }
    }

    // Di chuyển theo chu kỳ cấu hình (không di chuyển khi đang tụ chiêu R hoặc vừa tung chiêu)
    if (!(titan.ultCharge && titan.ultCharge > 0) && !didCastSkill) {
      titan.moveTimer += 1;
    }
    const baseMoveInterval = titan.rage
      ? Math.max(2, DARK_TITAN_CONFIG.MOVE_INTERVAL_SECONDS - 2)
      : DARK_TITAN_CONFIG.MOVE_INTERVAL_SECONDS;
    const moveInterval = Math.max(2, baseMoveInterval - (titan.moveBonus ?? 0));

    if (!didCastSkill && !(titan.ultCharge && titan.ultCharge > 0) && titan.moveTimer >= moveInterval) {
      titan.moveTimer = 0;

      const neighbors = [
        [titan.x + 1, titan.y], [titan.x - 1, titan.y],
        [titan.x, titan.y + 1], [titan.x, titan.y - 1],
        [titan.x + 1, titan.y + 1], [titan.x - 1, titan.y - 1],
        [titan.x + 1, titan.y - 1], [titan.x - 1, titan.y + 1],
      ].filter(([nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size && tiles[ny][nx].terrain !== 'WATER');

      if (neighbors.length > 0) {
        const targetOption =
          neighbors.find(([nx, ny]) => tiles[ny][nx].building !== 'NONE' || tiles[ny][nx].owner > 0) ||
          neighbors[Math.floor(Math.random() * neighbors.length)];

        titan.x = targetOption[0];
        titan.y = targetOption[1];

        const currentTile = tiles[titan.y][titan.x];

        // Chỉ tác động lên ô Tà Thần vừa bước vào (tránh gây sát thương kép & xóa cả vùng bán kính 2 liên tục mỗi nhịp di chuyển)
        if (currentTile.building !== 'NONE') {
          const oldBuilding = currentTile.building;
          if (oldBuilding === 'FORTRESS') {
            currentTile.building = 'CITY'; // Hạ cấp Pháo Đài
          } else {
            currentTile.building = 'NONE';
          }
          currentTile.scorchedTimer = Math.max(currentTile.scorchedTimer || 0, 15);
          offscreenTerritoryDirtyRef.current = true;
          data.particles.push({
            x: titan.x * TS + TS / 2,
            y: titan.y * TS + TS / 2,
            color: '#ef4444',
            size: 0,
            life: 40,
            maxLife: 40,
            vx: 0,
            vy: -0.7,
            type: 'FLOAT_TEXT',
            text: `💥 Tà Thần phá hoại ${BUILDING_INFO[oldBuilding as keyof typeof BUILDING_INFO]?.name || oldBuilding}!`,
          });
        }

        if (currentTile.owner > 0) {
          const victim = nations[currentTile.owner];
          if (victim) {
            const dmgTroops = Math.round(DARK_TITAN_CONFIG.DAMAGE_TROOPS * dmgMul);
            victim.troops = Math.max(0, victim.troops - dmgTroops);
            applyCasualties(victim, dmgTroops);
            data.particles.push({
              x: titan.x * TS + TS / 2,
              y: titan.y * TS + TS / 2,
              color: '#dc2626',
              size: 0,
              life: 35,
              maxLife: 35,
              vx: 0,
              vy: -0.5,
              type: 'FLOAT_TEXT',
              text: `☠️ -${dmgTroops} Quân (${victim.name})`,
            });
          }
        }
      }
    }
  });

  if (data.darkTitans.some((t: DarkTitan) => !t.isActive)) {
    data.nextTitanSpawnAt = data.gameTimeSeconds + DARK_TITAN_CONFIG.RESPAWN_COOLDOWN_SECONDS;
  }

  // Lọc bỏ Tà Thần đã hết giờ hoặc bị tiêu diệt
  data.darkTitans = data.darkTitans.filter((t: DarkTitan) => t.isActive);
  data.darkTitan = data.darkTitans[0] || null;
}

export function useDarkTitanAI({
  gameDataRef,
  offscreenTerritoryDirtyRef,
  difficultyRef,
  screenShakeRef,
  isMultiplayerRef,
  myNationIdRef,
  onTitanSyncNeeded,
}: UseDarkTitanAIParams) {
  const updateDarkTitans = useCallback(() => {
    const isClientNonHost = Boolean(
      isMultiplayerRef?.current && myNationIdRef && myNationIdRef.current !== 1
    );
    stepDarkTitanSystem({
      data: gameDataRef.current,
      offscreenTerritoryDirtyRef,
      difficultyRef,
      screenShakeRef,
      isMultiplayerClientNonHost: isClientNonHost,
      onSyncNeeded: onTitanSyncNeeded,
    });
  }, [
    gameDataRef,
    offscreenTerritoryDirtyRef,
    difficultyRef,
    screenShakeRef,
    isMultiplayerRef,
    myNationIdRef,
    onTitanSyncNeeded,
  ]);

  return { updateDarkTitans };
}
