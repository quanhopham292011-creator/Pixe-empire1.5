import { useCallback } from 'react';
import { Nation, SeaTradeRoute, SeaTradeShip } from '../types';
import { soundManager } from '../utils/audio';
import { TILE_PIXEL_SIZE, formatGameTime } from '../utils/constants';

export interface PortInfo {
  x: number;
  y: number;
  owner: number;
  nation: Nation;
}

export function useTradeRoutes(gameDataRef: React.MutableRefObject<any>) {
  const updateTradeRoutes = useCallback((isEightSec: boolean, portList: PortInfo[]) => {
    if (!isEightSec) return;
    const data = gameDataRef.current;
    if (!data) return;

    data.tradeRoutes = data.tradeRoutes || [];
    data.tradeShips = data.tradeShips || [];

    const updatedRoutes: SeaTradeRoute[] = [];
    for (let i = 0; i < portList.length; i++) {
      for (let j = i + 1; j < portList.length; j++) {
        const p1 = portList[i];
        const p2 = portList[j];

        const dip1 = p1.nation.diplomacy[p2.owner]?.status;
        const dip2 = p2.nation.diplomacy[p1.owner]?.status;
        if (dip1 === 'WAR' || dip2 === 'WAR') continue;

        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (dist < 4) continue;

        const isIntercontinental = dist > 10;
        const routeId = `route_${p1.owner}_${p1.x}_${p1.y}_${p2.owner}_${p2.x}_${p2.y}`;

        updatedRoutes.push({
          id: routeId,
          fromNation: p1.owner,
          toNation: p2.owner,
          fromPortX: p1.x,
          fromPortY: p1.y,
          toPortX: p2.x,
          toPortY: p2.y,
          distanceTiles: Math.round(dist),
          isIntercontinental,
        });
      }
    }

    data.tradeRoutes = updatedRoutes;
    data.tradeShips = data.tradeShips.filter((ship: SeaTradeShip) => updatedRoutes.some(r => r.id === ship.routeId));

    updatedRoutes.forEach(route => {
      const countOnRoute = data.tradeShips.filter((s: SeaTradeShip) => s.routeId === route.id).length;
      const targetShips = route.isIntercontinental ? 2 : 1;
      if (countOnRoute < targetShips) {
        const cargoGold = route.isIntercontinental ? 45 : 15;
        const travelDurationSeconds = Math.max(8, Math.min(22, route.distanceTiles * 0.7));

        data.tradeShips.push({
          id: Math.random().toString(),
          routeId: route.id,
          fromNation: route.fromNation,
          toNation: route.toNation,
          sourceX: route.fromPortX,
          sourceY: route.fromPortY,
          targetX: route.toPortX,
          targetY: route.toPortY,
          progress: 0,
          speed: 1 / travelDurationSeconds,
          cargoGold,
          isIntercontinental: route.isIntercontinental,
        });
      }
    });
  }, [gameDataRef]);

  const lootTradeShip = useCallback((mapX: number, mapY: number): boolean => {
    const data = gameDataRef.current;
    if (!data || !data.tradeShips || data.tradeShips.length === 0) return false;

    let lootedShipIdx = -1;
    for (let i = 0; i < data.tradeShips.length; i++) {
      const ship: SeaTradeShip = data.tradeShips[i];
      const curShipX = ship.sourceX + (ship.targetX - ship.sourceX) * ship.progress;
      const curShipY = ship.sourceY + (ship.targetY - ship.sourceY) * ship.progress;
      const dist = Math.hypot(curShipX - mapX, curShipY - mapY);
      if (dist <= 1.8) {
        lootedShipIdx = i;
        break;
      }
    }

    if (lootedShipIdx >= 0) {
      const ship: SeaTradeShip = data.tradeShips[lootedShipIdx];
      const player = data.nations[1];
      if (!player) return false;

      const lootGold = Math.round(ship.cargoGold * 1.0);
      player.gold += lootGold;

      soundManager.playCapture();

      const curShipX = ship.sourceX + (ship.targetX - ship.sourceX) * ship.progress;
      const curShipY = ship.sourceY + (ship.targetY - ship.sourceY) * ship.progress;

      data.particles.push({
        x: curShipX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: curShipY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#fbbf24',
        size: 0, life: 55, maxLife: 55, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT',
        text: `🏴‍☠️ CƯỚP TÀU BUÔN! +${lootGold} Vàng`
      });

      for (let p = 0; p < 8; p++) {
        data.particles.push({
          x: curShipX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          y: curShipY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          color: '#fbbf24',
          size: 3, life: 25, maxLife: 25,
          vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
          type: 'SPARK'
        });
      }

      data.events.unshift({
        id: Math.random().toString(),
        title: '🏴‍☠️ Cướp Biển Tấn Công',
        description: `Đã cướp bóc thành công tàu buôn hải cảng, thu giữ ${lootGold} Vàng!`,
        type: 'HARVEST',
        targetNationId: 1,
        timestamp: formatGameTime(data.gameTimeSeconds),
      });

      data.tradeShips.splice(lootedShipIdx, 1);
      return true;
    }

    return false;
  }, [gameDataRef]);

  return { updateTradeRoutes, lootTradeShip };
}
