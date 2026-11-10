import React from 'react';
import { WeatherType, DarkTitan, Tile, MapDimension } from '../types';
import { soundManager } from '../utils/audio';
import { formatPopulation, formatGameTime, DARK_TITAN_CONFIG, TILE_PIXEL_SIZE } from '../utils/constants';

interface UseAdminToolsParams {
  gameDataRef: React.MutableRefObject<any>;
  mapSize: MapDimension;
  selectedTileRef: React.MutableRefObject<Tile | null>;
  setHudStats: React.Dispatch<React.SetStateAction<any>>;
  setWeather: (weather: WeatherType) => void;
  weatherRef: React.MutableRefObject<WeatherType>;
  initWeatherParticles: (dimension: MapDimension, type: WeatherType) => void;
  nextLightningTimeRef: React.MutableRefObject<number>;
  lightningFlashRef: React.MutableRefObject<{ startTime: number; duration: number } | null>;
  cameraRef: React.MutableRefObject<{ x: number; y: number; zoom: number }>;
  setSelectedTile: React.Dispatch<React.SetStateAction<Tile | null>>;
  setGodModeLocked: React.Dispatch<React.SetStateAction<boolean>>;
  godModeLockedRef: React.MutableRefObject<boolean>;
  offscreenTerritoryDirtyRef: React.MutableRefObject<boolean>;
}

export function useAdminTools({
  gameDataRef,
  mapSize,
  selectedTileRef,
  setHudStats,
  setWeather,
  weatherRef,
  initWeatherParticles,
  nextLightningTimeRef,
  lightningFlashRef,
  cameraRef,
  setSelectedTile,
  setGodModeLocked,
  godModeLockedRef,
  offscreenTerritoryDirtyRef,
}: UseAdminToolsParams) {
  const handleSetGold = (amount: number) => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      player.gold = Math.max(0, amount);
      setHudStats((prev: any) => ({ ...prev, gold: player.gold }));
      gameDataRef.current.particles.push({
        x: player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#fbbf24', size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT', text: `✨ Vàng: ${formatPopulation(player.gold)}`
      });
      soundManager.playBuild();
    }
  };

  const handleAddGold = (amount: number) => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      handleSetGold(player.gold + amount);
    }
  };

  const handleSetTroops = (amount: number) => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      player.troops = Math.max(0, amount);
      player.maxTroops = Math.max(player.maxTroops, player.troops + 1000);
      setHudStats((prev: any) => ({ ...prev, troops: player.troops, maxTroops: player.maxTroops }));
      gameDataRef.current.particles.push({
        x: player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#38bdf8', size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT', text: `⚔️ Quân: ${formatPopulation(player.troops)}`
      });
      soundManager.playClick();
    }
  };

  const handleAddTroops = (amount: number) => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      handleSetTroops(player.troops + amount);
    }
  };

  const handleChangeWeather = (newWeather: WeatherType) => {
    setWeather(newWeather);
    weatherRef.current = newWeather;
    initWeatherParticles(mapSize, newWeather);
    if (newWeather === 'RAIN') {
      nextLightningTimeRef.current = performance.now() + 500;
    }
    soundManager.playClick();
  };

  const handleTriggerLightningSpam = () => {
    setWeather('RAIN');
    weatherRef.current = 'RAIN';
    initWeatherParticles(mapSize, 'RAIN');
    lightningFlashRef.current = { startTime: performance.now(), duration: 800 };
    soundManager.playThunder();
    gameDataRef.current.events.unshift({
      id: Math.random().toString(),
      title: '⚡ BÃO SÉT TOÀN CẦU',
      description: 'Đấng Sáng Tạo đã giáng sấm sét giông bão khắp toàn bộ thế giới!',
      type: 'DIPLOMACY',
      targetNationId: 0,
      timestamp: formatGameTime(gameDataRef.current.gameTimeSeconds),
    });
  };

  const handleSpawnDarkTitan = (count = 1) => {
    const data = gameDataRef.current;
    const size = mapSize;
    const landTiles: { x: number; y: number }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data.tiles[y][x].terrain !== 'WATER') {
          landTiles.push({ x, y });
        }
      }
    }
    if (landTiles.length === 0) return;

    data.darkTitans = data.darkTitans || [];

    for (let i = 0; i < count; i++) {
      const spawnTile = (i === 0 && selectedTileRef.current && selectedTileRef.current.terrain !== 'WATER')
        ? selectedTileRef.current
        : landTiles[Math.floor(Math.random() * landTiles.length)];

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
      data.darkTitan = data.darkTitans[0];

      data.particles.push({
        x: spawnTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: spawnTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#dc2626',
        size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.9,
        type: 'FLOAT_TEXT',
        text: '⚠️ TÀ THẦN TRIỆU HỒI!',
      });
    }

    soundManager.playThunder();
    data.events.unshift({
      id: Math.random().toString(),
      title: '⚠️ TÀ THẦN GIÁNG LÂM',
      description: `Đã triệu hồi ${count} Tà Thần Cổ Đại xuất hiện trên thế giới!`,
      type: 'PLAGUE',
      targetNationId: 0,
      timestamp: formatGameTime(data.gameTimeSeconds),
    });
  };

  const handleClearDarkTitans = () => {
    const data = gameDataRef.current;
    data.darkTitans = [];
    data.darkTitan = null;
    soundManager.playCapture();
    data.particles.push({
      x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
      y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
      color: '#a855f7', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
      type: 'FLOAT_TEXT', text: '✨ Đã xua tan toàn bộ Tà Thần!'
    });
  };

  const handleUnlockAllTech = () => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      player.techLevels = { economy: 3, military: 3, defense: 3 };
      player.techChoices = { economy: 'A', military: 'A', defense: 'A' };
      soundManager.playBuild();
      gameDataRef.current.particles.push({
        x: player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#6366f1', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT', text: '🧪 Mở Khóa Toàn Bộ Công Nghệ!'
      });
    }
  };

  const handleClearAllScorched = () => {
    const data = gameDataRef.current;
    for (let y = 0; y < mapSize; y++) {
      for (let x = 0; x < mapSize; x++) {
        if (data.tiles[y][x].scorchedTimer) {
          data.tiles[y][x].scorchedTimer = 0;
        }
      }
    }
    soundManager.playTruce();
    data.particles.push({
      x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
      y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
      color: '#10b981', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
      type: 'FLOAT_TEXT', text: '🌿 Thanh Lọc Toàn Bộ Đất Cháy!'
    });
  };

  const handleClaimSelectedTile = () => {
    if (!selectedTileRef.current) return;
    const st = selectedTileRef.current;
    const data = gameDataRef.current;
    const t = data.tiles[st.y]?.[st.x];
    if (t && t.terrain !== 'WATER') {
      t.owner = 1;
      setSelectedTile({ ...t });
      selectedTileRef.current = { ...t };
      offscreenTerritoryDirtyRef.current = true;
      soundManager.playCapture();
    }
  };

  const handleToggleGodModeLocked = () => {
    setGodModeLocked(prev => {
      const next = !prev;
      godModeLockedRef.current = next;
      soundManager.playClick();
      return next;
    });
  };

  return {
    handleSetGold,
    handleAddGold,
    handleSetTroops,
    handleAddTroops,
    handleChangeWeather,
    handleTriggerLightningSpam,
    handleSpawnDarkTitan,
    handleClearDarkTitans,
    handleUnlockAllTech,
    handleClearAllScorched,
    handleClaimSelectedTile,
    handleToggleGodModeLocked,
  };
}
