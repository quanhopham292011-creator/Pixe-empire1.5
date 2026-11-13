import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  GameDifficulty, GameMode, MapDimension, Nation, General,
  PlayerProfile, QuestStep, Tile, VictoryReward, WeatherType 
} from '../types';
import { soundManager } from '../utils/audio';
import { formatGameTime } from '../utils/constants';
import { migrateGeneralData, calculateGeneralStats } from '../utils/generalCombat';

export interface SavedGameInfo {
  timestamp: string;
  gameTimeStr: string;
  playerName: string;
  mode: string;
}

interface UseSaveGameParams {
  isMultiplayerRef: React.MutableRefObject<boolean>;
  gameDataRef: React.MutableRefObject<any>;
  difficulty: GameDifficulty;
  setDifficulty: (diff: GameDifficulty) => void;
  mapSize: MapDimension;
  setMapSize: (size: MapDimension) => void;
  gameModeRef: React.MutableRefObject<GameMode>;
  setGameMode: (mode: GameMode) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  weatherRef: React.MutableRefObject<WeatherType>;
  setWeather: (weather: WeatherType) => void;
  godModeLockedRef: React.MutableRefObject<boolean>;
  setGodModeLocked: (locked: boolean) => void;
  currentQuest: QuestStep;
  setCurrentQuest: (quest: QuestStep) => void;
  questDismissed: boolean;
  setQuestDismissed: (dismissed: boolean) => void;
  hasMetBot: boolean;
  setHasMetBot: (met: boolean) => void;
  attackPercent: number;
  setAttackPercent: (percent: number) => void;
  autoExpand: boolean;
  setAutoExpand: (expand: boolean) => void;
  playerGeneralDeployMode: boolean;
  setPlayerGeneralDeployMode: (deploy: boolean) => void;
  hudStats: any;
  setHudStats: React.Dispatch<React.SetStateAction<any>>;
  setLoadErrorToast: (msg: string | null) => void;
  playerProfileRef: React.MutableRefObject<PlayerProfile>;
  totalLandCountRef: React.MutableRefObject<number>;
  offscreenTerrainDirtyRef: React.MutableRefObject<boolean>;
  offscreenTerritoryDirtyRef: React.MutableRefObject<boolean>;
  fogBaseDirtyRef: React.MutableRefObject<boolean>;
  dirtyTerritoryTilesRef: React.MutableRefObject<{ x: number; y: number }[]>;
  setSelectedTile: (tile: Tile | null) => void;
  selectedTileRef: React.MutableRefObject<Tile | null>;
  needsCenterCameraRef: React.MutableRefObject<boolean>;
  initWeatherParticles: (dimension: MapDimension, type: WeatherType) => void;
  victoryAwardedRef: React.MutableRefObject<boolean>;
  setVictoryReward: (reward: VictoryReward | null) => void;
  setGameState: (state: 'TITLE' | 'PLAYING' | 'VICTORY' | 'DEFEAT') => void;
  setIsPaused: (paused: boolean) => void;
}

export function useSaveGame({
  isMultiplayerRef,
  gameDataRef,
  difficulty,
  setDifficulty,
  mapSize,
  setMapSize,
  gameModeRef,
  setGameMode,
  playerName,
  setPlayerName,
  weatherRef,
  setWeather,
  godModeLockedRef,
  setGodModeLocked,
  currentQuest,
  setCurrentQuest,
  questDismissed,
  setQuestDismissed,
  hasMetBot,
  setHasMetBot,
  attackPercent,
  setAttackPercent,
  autoExpand,
  setAutoExpand,
  playerGeneralDeployMode,
  setPlayerGeneralDeployMode,
  hudStats,
  setHudStats,
  setLoadErrorToast,
  playerProfileRef,
  totalLandCountRef,
  offscreenTerrainDirtyRef,
  offscreenTerritoryDirtyRef,
  fogBaseDirtyRef,
  dirtyTerritoryTilesRef,
  setSelectedTile,
  selectedTileRef,
  needsCenterCameraRef,
  initWeatherParticles,
  victoryAwardedRef,
  setVictoryReward,
  setGameState,
  setIsPaused,
}: UseSaveGameParams) {
  const [savedGameInfo, setSavedGameInfo] = useState<SavedGameInfo | null>(null);
  const saveGameRef = useRef<() => void>(() => {});

  const saveGame = useCallback(() => {
    try {
      if (isMultiplayerRef.current) return; // Không ghi đè ván chơi đơn bằng dữ liệu phòng online
      const data = gameDataRef.current;
      if (!data || !data.tiles || data.tiles.length === 0) return;

      const nowStr = new Date().toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      });

      const payload = {
        version: 1,
        savedAt: nowStr,
        difficulty,
        mapSize,
        gameMode: gameModeRef.current,
        playerName,
        weather: weatherRef.current,
        godModeLocked: godModeLockedRef.current,
        currentQuest,
        questDismissed,
        hasMetBot,
        attackPercent,
        autoExpand,
        playerGeneralDeployMode,
        hudStats,
        gameData: {
          tiles: data.tiles,
          nations: data.nations,
          attackWaves: data.attackWaves || [],
          events: data.events || [],
          researching: data.researching || null,
          gameTimeSeconds: data.gameTimeSeconds || 0,
          hasMetBot: data.hasMetBot || false,
          darkTitan: data.darkTitan || null,
          darkTitans: data.darkTitans || [],
          flyingMissiles: data.flyingMissiles || [],
          tradeRoutes: data.tradeRoutes || [],
          tradeShips: data.tradeShips || [],
          activeSeasonEvent: data.activeSeasonEvent || null,
          stats: data.stats || { battlesCount: 0, buildingsCount: 0 }
        }
      };

      localStorage.setItem('pixel_empire_save_v1', JSON.stringify(payload));
      setSavedGameInfo({
        timestamp: nowStr,
        gameTimeStr: formatGameTime(data.gameTimeSeconds || 0),
        playerName,
        mode: gameModeRef.current === 'CREATIVE' ? 'Sáng Tạo' : 'Chiến Thuật'
      });
    } catch (err) {
      console.error('Lỗi khi lưu game:', err);
    }
  }, [
    isMultiplayerRef, gameDataRef, difficulty, mapSize, gameModeRef, 
    playerName, weatherRef, godModeLockedRef, currentQuest, questDismissed, 
    hasMetBot, attackPercent, autoExpand, playerGeneralDeployMode, hudStats
  ]);

  const loadGame = useCallback(() => {
    try {
      const raw = localStorage.getItem('pixel_empire_save_v1');
      if (!raw) {
        setLoadErrorToast('Không đọc được ván cũ');
        setTimeout(() => setLoadErrorToast(null), 3500);
        return;
      }
      const payload = JSON.parse(raw);
      if (!payload || !payload.gameData || !payload.gameData.tiles || !Array.isArray(payload.gameData.tiles)) {
        setLoadErrorToast('Không đọc được ván cũ');
        setTimeout(() => setLoadErrorToast(null), 3500);
        return;
      }

      const { gameData } = payload;

      setDifficulty(payload.difficulty || 'EASY');
      setMapSize(payload.mapSize || 96);
      setGameMode(payload.gameMode || 'STANDARD');
      gameModeRef.current = payload.gameMode || 'STANDARD';
      if (payload.playerName) setPlayerName(payload.playerName);
      if (payload.weather) {
        setWeather(payload.weather);
        weatherRef.current = payload.weather;
      }
      if (payload.godModeLocked !== undefined) {
        setGodModeLocked(payload.godModeLocked);
        godModeLockedRef.current = payload.godModeLocked;
      }
      if (payload.currentQuest !== undefined) setCurrentQuest(payload.currentQuest);
      if (payload.questDismissed !== undefined) setQuestDismissed(payload.questDismissed);
      if (payload.hasMetBot !== undefined) setHasMetBot(payload.hasMetBot);
      if (payload.attackPercent !== undefined) setAttackPercent(payload.attackPercent);
      if (payload.autoExpand !== undefined) setAutoExpand(payload.autoExpand);
      if (payload.playerGeneralDeployMode !== undefined) setPlayerGeneralDeployMode(payload.playerGeneralDeployMode);
      if (payload.hudStats) setHudStats(payload.hudStats);

      // Đại Pháo đã bị xoá: đổi công trình cũ thành đất trống
      if (Array.isArray(gameData.tiles)) {
        gameData.tiles.forEach((row: Tile[]) => {
          if (Array.isArray(row)) {
            row.forEach((tile: Tile) => {
              if (tile && (tile.building as string) === 'ARTILLERY') {
                tile.building = 'NONE';
                tile.buildingLevel = 0;
              }
            });
          }
        });
      }

      if (Array.isArray(gameData.nations)) {
        gameData.nations.forEach((n: Nation) => {
          if (n) {
            n.techChoices = n.techChoices || {};
            if (n.techLevels?.economy === 3 && !n.techChoices.economy) n.techChoices.economy = 'A';
            if (n.techLevels?.military === 3 && !n.techChoices.military) n.techChoices.military = 'A';
            if (n.techLevels?.defense === 3 && !n.techChoices.defense) n.techChoices.defense = 'A';

            if (n.general) {
              // Di chuyển và khôi phục dữ liệu Đại Tướng an toàn
              n.general = migrateGeneralData(n.general, n.id, n.capitalX, n.capitalY);
              n.general.role = 'ACTIVE';
              calculateGeneralStats(n.general, n, n.isPlayer ? playerProfileRef.current : null);
            }
            if (!Array.isArray(n.reserveGenerals)) {
              n.reserveGenerals = [];
            } else {
              const seenIds = new Set<string>();
              if (n.general?.id) seenIds.add(n.general.id);
              const validReserves: General[] = [];
              for (const rg of n.reserveGenerals) {
                if (!rg) continue;
                const migrated = migrateGeneralData(rg, n.id, n.capitalX, n.capitalY);
                if (seenIds.has(migrated.id)) continue; // Chống trùng ID
                seenIds.add(migrated.id);
                migrated.role = 'RESERVE';
                calculateGeneralStats(migrated, n, n.isPlayer ? playerProfileRef.current : null);
                validReserves.push(migrated);
              }
              n.reserveGenerals = validReserves;
            }
          }
        });
      }

      gameDataRef.current = {
        tiles: gameData.tiles,
        nations: gameData.nations,
        attackWaves: gameData.attackWaves || [],
        particles: [],
        events: gameData.events || [],
        researching: gameData.researching || null,
        gameTimeSeconds: gameData.gameTimeSeconds || 0,
        hasMetBot: gameData.hasMetBot || false,
        darkTitan: gameData.darkTitan || null,
        darkTitans: gameData.darkTitans || [],
        flyingMissiles: gameData.flyingMissiles || [],
        tradeRoutes: gameData.tradeRoutes || [],
        tradeShips: gameData.tradeShips || [],
        activeSeasonEvent: gameData.activeSeasonEvent || null,
        stats: gameData.stats || { battlesCount: 0, buildingsCount: 0 }
      };

      totalLandCountRef.current = gameData.tiles.flat().filter((t: Tile) => t.terrain !== 'WATER').length;
      offscreenTerrainDirtyRef.current = true;
      offscreenTerritoryDirtyRef.current = true;
      fogBaseDirtyRef.current = true;
      dirtyTerritoryTilesRef.current = [];
      setSelectedTile(null);
      selectedTileRef.current = null;
      needsCenterCameraRef.current = true;
      initWeatherParticles(payload.mapSize || 96, weatherRef.current);
      victoryAwardedRef.current = false;
      setVictoryReward(null);

      setGameState('PLAYING');
      setIsPaused(false);
      soundManager.playClick();
    } catch (err) {
      console.error('Lỗi khi nạp ván cũ:', err);
      setLoadErrorToast('Không đọc được ván cũ');
      setTimeout(() => setLoadErrorToast(null), 3500);
    }
  }, [
    setLoadErrorToast, setDifficulty, setMapSize, setGameMode, gameModeRef, 
    setPlayerName, setWeather, weatherRef, setGodModeLocked, godModeLockedRef, 
    setCurrentQuest, setQuestDismissed, setHasMetBot, setAttackPercent, 
    setAutoExpand, setPlayerGeneralDeployMode, setHudStats, playerProfileRef, 
    gameDataRef, totalLandCountRef, offscreenTerrainDirtyRef, offscreenTerritoryDirtyRef, 
    fogBaseDirtyRef, dirtyTerritoryTilesRef, setSelectedTile, selectedTileRef, 
    needsCenterCameraRef, initWeatherParticles, victoryAwardedRef, setVictoryReward, 
    setGameState, setIsPaused
  ]);

  const deleteSavedGame = useCallback(() => {
    try {
      localStorage.removeItem('pixel_empire_save_v1');
      setSavedGameInfo(null);
    } catch (err) {
      console.error('Lỗi khi xóa ván cũ:', err);
    }
  }, []);

  const checkSavedGame = useCallback(() => {
    try {
      const raw = localStorage.getItem('pixel_empire_save_v1');
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload && payload.gameData && payload.gameData.tiles) {
          setSavedGameInfo({
            timestamp: payload.savedAt || 'Đã lưu',
            gameTimeStr: formatGameTime(payload.gameData.gameTimeSeconds || 0),
            playerName: payload.playerName || 'Việt Nam',
            mode: payload.gameMode === 'CREATIVE' ? 'Sáng Tạo' : 'Chiến Thuật'
          });
          return;
        }
      }
    } catch (err) {
      console.error('Lỗi kiểm tra ván lưu:', err);
    }
    setSavedGameInfo(null);
  }, []);

  useEffect(() => {
    saveGameRef.current = saveGame;
  }, [saveGame]);

  return {
    savedGameInfo,
    setSavedGameInfo,
    saveGame,
    loadGame,
    deleteSavedGame,
    checkSavedGame,
    saveGameRef,
  };
}
