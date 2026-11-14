import React, { useCallback } from 'react';
import { Tile, MissileType, GameDifficulty } from '../types';
import { RoomState } from '../multiplayer/types';
import { 
  MISSILE_CONFIG, MISSILE_SETTINGS, TILE_PIXEL_SIZE, formatGameTime 
} from '../utils/constants';
import { canAffordMissileResources, payMissileResources } from '../utils/resources';
import { isSuperBuilding } from '../utils/superBuildings';
import { getMissileEffectiveCost } from '../utils/supremeTech';

export interface UseBotMissilesParams {
  gameDataRef: React.MutableRefObject<any>;
  difficulty?: GameDifficulty;
  isMultiplayerRef: React.MutableRefObject<boolean>;
  myNationIdRef: React.MutableRefObject<number>;
  multiplayerRoom: RoomState | null;
}

export function useBotMissiles({
  gameDataRef,
  difficulty = 'NORMAL',
  isMultiplayerRef,
  myNationIdRef,
  multiplayerRoom,
}: UseBotMissilesParams) {
  const updateBotMissiles = useCallback((currentRoom?: RoomState | null) => {
    const data = gameDataRef.current;
    if (!data || !data.tiles || !data.nations) return;
    const intervalSec = difficulty === 'EASY' ? 45 : difficulty === 'NORMAL' ? 25 : difficulty === 'HARD' ? 15 : 12;
    const minMissileGold = difficulty === 'EASY' ? 6000 : difficulty === 'NORMAL' ? 4500 : 3500;
    if (!(data.gameTimeSeconds > 0 && data.gameTimeSeconds % intervalSec === 0)) return;

    const room = currentRoom !== undefined ? currentRoom : multiplayerRoom;
    const { tiles, nations } = data;
    const size = tiles.length;

    const mapSuperTiles: Tile[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = tiles[y][x];
        if (isSuperBuilding(t.building) && t.owner > 0) {
          mapSuperTiles.push(t);
        }
      }
    }

    nations.forEach((bot: any) => {
      if (bot.id <= 1 || bot.isEliminated || bot.colonyCategory === 'FOREST' || bot.gold < minMissileGold) return;
      if (isMultiplayerRef.current && (myNationIdRef.current !== 1 || (room && room.players.some((p: any) => p.connected && p.nationId === bot.id)))) return;
      
      // Kiểm tra xem bot có bệ phóng nào sẵn sàng không
      let botSilo: Tile | null = null;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const t = tiles[y][x];
          if (t.owner === bot.id && t.building === 'MISSILE_SILO' && (!t.missileCooldown || t.missileCooldown <= 0) && !(t.inactiveTimer && t.inactiveTimer > 0)) {
            botSilo = t;
            break;
          }
        }
        if (botSilo) break;
      }

      if (botSilo && bot.gold >= minMissileGold) {
        // Ưu tiên mục tiêu là Siêu Công Trình của kẻ thù đang có chiến tranh
        let bestEnemyTile: Tile | null = null;
        let isTargetingSuper = false;
        let bestSuperDist = 22;
        for (let i = 0; i < mapSuperTiles.length; i++) {
          const st = mapSuperTiles[i];
          if (st.owner > 0 && st.owner !== bot.id && st.terrain !== 'WATER') {
            const dip = bot.diplomacy?.[st.owner]?.status;
            if (dip !== 'ALLIANCE' && dip !== 'TRUCE') {
              const dist = Math.hypot(st.x - botSilo.x, st.y - botSilo.y);
              if (dist < bestSuperDist) {
                bestSuperDist = dist;
                bestEnemyTile = st;
                isTargetingSuper = true;
              }
            }
          }
        }

        // Nếu không có Siêu Công Trình địch gần đó, tìm mục tiêu kẻ thù gần nhất
        if (!bestEnemyTile) {
          let minDist = 999;
          const scanR = 8;
          for (let dy = -scanR; dy <= scanR; dy++) {
            for (let dx = -scanR; dx <= scanR; dx++) {
              const tx = botSilo.x + dx;
              const ty = botSilo.y + dy;
              if (tx >= 0 && tx < size && ty >= 0 && ty < size) {
                const candidate = tiles[ty][tx];
                if (candidate.owner > 0 && candidate.owner !== bot.id && candidate.terrain !== 'WATER') {
                  const dip = bot.diplomacy[candidate.owner]?.status;
                  if (dip !== 'ALLIANCE' && dip !== 'TRUCE') {
                    const dist = Math.hypot(dx, dy);
                    if (dist < minDist) {
                      minDist = dist;
                      bestEnemyTile = candidate;
                    }
                  }
                }
              }
            }
          }
        }

        if (bestEnemyTile) {
          const missileType: MissileType =
            (isTargetingSuper && bot.gold >= 15000 && Math.random() < 0.55)
              ? 'HYDRO'
              : bot.gold >= 50000
              ? (Math.random() < 0.4 ? 'MIRV' : 'HYDRO')
              : bot.gold >= 7000
              ? 'HYDRO'
              : 'ATOM';
          const effCost = getMissileEffectiveCost(missileType, bot);
          const cfg = MISSILE_CONFIG[missileType];
          if (bot.gold >= effCost.cost && canAffordMissileResources(bot, missileType)) {
            bot.gold -= effCost.cost;
            payMissileResources(bot, missileType);
            botSilo.missileCooldown = MISSILE_SETTINGS.COOLDOWN_SECONDS;

            data.flyingMissiles = data.flyingMissiles || [];
            data.flyingMissiles.push({
              id: Math.random().toString(),
              type: missileType,
              sourceX: botSilo.x,
              sourceY: botSilo.y,
              targetX: bestEnemyTile.x,
              targetY: bestEnemyTile.y,
              progress: 0,
              speed: 1 / (MISSILE_SETTINGS.DEFAULT_FLIGHT_DURATION_SECONDS || 12),
              fromNation: bot.id,
            });

            data.events.unshift({
              id: Math.random().toString(),
              title: '🚀 CẢNH BÁO TÊN LỬA',
              description: `${bot.name} đã khai hỏa tên lửa ${cfg.name} hướng tới tọa độ (${bestEnemyTile.x}, ${bestEnemyTile.y})! Tên lửa sẽ chạm đất sau ${MISSILE_SETTINGS.DEFAULT_FLIGHT_DURATION_SECONDS} giây!`,
              type: 'PLAGUE',
              targetNationId: bestEnemyTile.owner,
              timestamp: formatGameTime(data.gameTimeSeconds),
            });

            data.particles.push({
              x: bestEnemyTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: bestEnemyTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: cfg.color, size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.8,
              type: 'FLOAT_TEXT',
              text: `🚀 ${bot.name} Phóng ${cfg.name} (${MISSILE_SETTINGS.DEFAULT_FLIGHT_DURATION_SECONDS}s)!`
            });
          }
        }
      }
    });
  }, [gameDataRef, isMultiplayerRef, myNationIdRef, multiplayerRoom]);

  return { updateBotMissiles };
}
