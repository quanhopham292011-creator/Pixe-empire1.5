/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BuildingType, MapDimension, GameDifficulty, GameMode, Tile, Nation, 
  AttackWave, GameParticle, GameEvent, ResearchingTech, TechNode, QuestStep, General, GeneralSkillId,
  WeatherType, WeatherParticle, WeatherCloudPuff, DarkTitan, MissileType, FlyingMissile,
  SeaTradeRoute, SeaTradeShip, PlayerProfile, VictoryReward
} from './types';
import { generateWorldMap } from './utils/mapGenerator';
import { soundManager } from './utils/audio';
import { 
  TILE_PIXEL_SIZE, BUILDING_INFO, TECH_TREE, formatPopulation, DARK_TITAN_CONFIG, formatGameTime,
  MISSILE_CONFIG, MISSILE_SETTINGS, GENERAL_ROSTER, getSkillPower
} from './utils/constants';
import { 
  loadPlayerProfile, savePlayerProfile, calculateVictoryReward, 
  getRequiredExpForNextLevel, MAX_PLAYER_LEVEL,
  isGeneralUnlocked, purchaseGeneral, selectGeneral
} from './utils/progression';
import { BuildModal } from './components/BuildModal';
import { TechModal } from './components/TechModal';
import { MissileModal } from './components/MissileModal';
import { DiplomacyModal } from './components/DiplomacyModal';
import { Minimap } from './components/Minimap';
import { EventTicker, EventLogModal } from './components/EventTicker';
import { SettingsModal } from './components/SettingsModal';
import { CreativeModal } from './components/CreativeModal';
import { VictoryConfettiCanvas } from './components/VictoryConfettiCanvas';
import { MatchLeaderboard } from './components/MatchLeaderboard';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { MultiplayerModal } from './components/MultiplayerModal';
import { GeneralSelectModal } from './components/GeneralSelectModal';
import { GeneralModel } from './components/GeneralModel';
import { AuthModal } from './components/AuthModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { UserAccountBadge } from './components/UserAccountBadge';
import { SkillTreeModal } from './components/SkillTreeModal';
import { VictoryModal } from './components/modals/VictoryModal';
import { DefeatModal } from './components/modals/DefeatModal';
import { ConfirmNewGameModal } from './components/modals/ConfirmNewGameModal';
import { TitleMenu } from './components/TitleMenu';
import { GameHud } from './components/GameHud';
import { useAdminTools } from './hooks/useAdminTools';
import { useMapCamera } from './hooks/useMapCamera';
import { useSaveGame } from './hooks/useSaveGame';
import { useGameRenderer } from './hooks/useGameRenderer';
import { useTradeRoutes } from './hooks/useTradeRoutes';
import { useDarkTitanAI } from './hooks/useDarkTitanAI';
import { useSeasonEvents } from './hooks/useSeasonEvents';
import { useAttackWaves } from './hooks/useAttackWaves';
import { getSkillTreeBonuses } from './utils/skillTreeConfig';
import { 
  GENERAL_CONSTANTS, calculateGeneralStats, applyGeneralDamage, 
  processGeneralRecoveryTick, canDeployGeneral, migrateGeneralData 
} from './utils/generalCombat';
import { 
  auth, 
  onAuthStateChanged, 
  fbSignOut, 
  loadProfileFromFirestore, 
  syncProfileToFirestore, 
  isUserAdmin,
  ADMIN_EMAIL 
} from './firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { multiplayerClient } from './multiplayer/multiplayerClient';
import { RoomState } from './multiplayer/types';

import { 
  Shield, Castle, Coins, Users, Play, Pause, FastForward, 
  RotateCcw, ZoomIn, ZoomOut, Swords, Building2, Award, 
  TrendingUp, AlertTriangle, Volume2, VolumeX, HelpCircle, 
  Sparkles, Flag, Crown, Check, Lock, ChevronRight, X, Anchor, Edit3, Settings,
  Cloud, CloudRain, Sun, Wand2, Handshake, Crosshair, Rocket, ShieldAlert, Star
} from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<'TITLE' | 'PLAYING' | 'VICTORY' | 'DEFEAT'>('TITLE');
  const gameStateRef = useRef<'TITLE' | 'PLAYING' | 'VICTORY' | 'DEFEAT'>('TITLE');
  gameStateRef.current = gameState;
  const [gameSpeed, setGameSpeed] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('EASY');
  const [mapSize, setMapSize] = useState<MapDimension>(96); // Mặc định 96x96
  const [gameMode, setGameMode] = useState<GameMode>('STANDARD');
  const gameModeRef = useRef<GameMode>('STANDARD');
  const [isCreativeOpen, setIsCreativeOpen] = useState<boolean>(false);
  const [isGeneralSelectOpen, setIsGeneralSelectOpen] = useState<boolean>(false);
  const [isSkillTreeOpen, setIsSkillTreeOpen] = useState<boolean>(false);
  const [godModeLocked, setGodModeLocked] = useState<boolean>(false);
  const godModeLockedRef = useRef<boolean>(false);

  // Hệ Thống Tài Khoản Firebase & Quyền Quản Trị Viên (Admin)
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState<boolean>(false);
  const [infiniteResources, setInfiniteResources] = useState<boolean>(false);
  const infiniteResourcesRef = useRef<boolean>(false);
  infiniteResourcesRef.current = infiniteResources;
  const [noCooldown, setNoCooldown] = useState<boolean>(false);
  const noCooldownRef = useRef<boolean>(false);
  noCooldownRef.current = noCooldown;

  // Hệ Thống Cấp Độ (Level), Điểm EXP & Tiền Xu Pixel
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(() => loadPlayerProfile());
  const playerProfileRef = useRef<PlayerProfile>(playerProfile);
  playerProfileRef.current = playerProfile;
  const [victoryReward, setVictoryReward] = useState<VictoryReward | null>(null);
  const victoryAwardedRef = useRef<boolean>(false);

  // Lắng nghe đăng nhập Firebase và đồng bộ tiến trình tự động
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const { profile } = await loadProfileFromFirestore(user, playerProfileRef.current);
          setPlayerProfile(profile);
          playerProfileRef.current = profile;
          savePlayerProfile(profile);
        } catch (err) {
          console.error('Lỗi tải tiến trình từ Firestore:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  // Hệ Thống Thời Tiết (Mây trôi bồng bềnh, Mưa lất phất)
  const weatherParticlesRef = useRef<WeatherParticle[]>([]);
  // Hiệu ứng chớp nháy toàn màn hình giả lập tia chớp (Lightning Flash) khi trời Mưa (RAIN)
  const lightningFlashRef = useRef<{ startTime: number; duration: number } | null>(null);
  const nextLightningTimeRef = useRef<number>(0);

  // Trạng thái Minimap & Settings Modal & Sương Mù Chiến Tranh (Fog of War)
  const [showMinimap, setShowMinimap] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pixel_empire_show_minimap') !== 'false';
    } catch {
      return true;
    }
  });
  const [fogOfWarEnabled, setFogOfWarEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pixel_empire_fog_of_war') !== 'false';
    } catch {
      return true;
    }
  });
  const fogOfWarEnabledRef = useRef<boolean>(fogOfWarEnabled);
  fogOfWarEnabledRef.current = fogOfWarEnabled;
  const fogGridRef = useRef<Uint8Array | null>(null);

  const handleToggleFogOfWar = useCallback(() => {
    setFogOfWarEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('pixel_empire_fog_of_war', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Đổi tên Người chơi
  const [playerName, setPlayerName] = useState<string>('Việt Nam');

  // Tấn công & Tự động mở rộng & Điều Tướng
  const [attackPercent, setAttackPercent] = useState<number>(50);
  const [autoExpand, setAutoExpand] = useState<boolean>(true);
  const [playerGeneralDeployMode, setPlayerGeneralDeployMode] = useState<boolean>(true); // Tướng tham chiến theo đợt quân

  // Ô đất đang được chọn để xem thông tin / chuẩn bị xây dựng (Tách biệt hoàn toàn việc chọn ô và xây dựng)
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const selectedTileRef = useRef<Tile | null>(null);
  const totalLandCountRef = useRef<number>(0);

  // Modals
  const [isBuildOpen, setIsBuildOpen] = useState<boolean>(false);
  const [isTechOpen, setIsTechOpen] = useState<boolean>(false);
  const [isDiplomacyOpen, setIsDiplomacyOpen] = useState<boolean>(false);
  const [isEventLogOpen, setIsEventLogOpen] = useState<boolean>(false);
  const [isMissileOpen, setIsMissileOpen] = useState<boolean>(false);
  const [missileAimingMode, setMissileAimingMode] = useState<MissileType | null>(null);
  const missileAimingModeRef = useRef<MissileType | null>(null);
  missileAimingModeRef.current = missileAimingMode;
  const [missileFeedbackToast, setMissileFeedbackToast] = useState<string | null>(null);
  const flyingMissilesRef = useRef<FlyingMissile[]>([]);

  const showMissileToast = useCallback((msg: string) => {
    setMissileFeedbackToast(msg);
    setTimeout(() => {
      setMissileFeedbackToast(prev => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const tapRipplesRef = useRef<{x: number, y: number, startTime: number}[]>([]);
  const captureFlashRef = useRef<{x: number, y: number, color: string, startTime: number}[]>([]);
  const lastTapRef = useRef({ x: -1, y: -1, time: 0 });

  // Nhiệm vụ trong game
  const [currentQuest, setCurrentQuest] = useState<QuestStep>(1);
  const [questDismissed, setQuestDismissed] = useState<boolean>(false);

  // Trạng thái mở khóa ngoại giao
  const [hasMetBot, setHasMetBot] = useState<boolean>(false);

  // Trạng thái lưu ván chơi (Save Game System)
  const [showConfirmNewGame, setShowConfirmNewGame] = useState<boolean>(false);
  const [loadErrorToast, setLoadErrorToast] = useState<string | null>(null);

  // Trạng thái Phòng chơi Nhiều người (Multiplayer Private Room)
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);
  const [multiplayerRoom, setMultiplayerRoom] = useState<RoomState | null>(null);
  const [myPlayerNationId, setMyPlayerNationId] = useState<number>(1);
  const myNationIdRef = useRef<number>(1);
  const isMultiplayerRef = useRef<boolean>(false);
  const [isMultiplayerModalOpen, setIsMultiplayerModalOpen] = useState<boolean>(false);
  const [urlRoomCode, setUrlRoomCode] = useState<string | null>(null);
  const [multiplayerBanner, setMultiplayerBanner] = useState<string | null>(null);

  // HUD stats
  const [hudStats, setHudStats] = useState({
    gold: 50,
    goldIncome: 1,
    troops: 20,
    maxTroops: 30,
    landPercent: 5,
    territoryCount: 12,
    titanBuffTimer: 0,
  });

  // Camera & Interaction Refs
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1.25 });
  const needsCenterCameraRef = useRef<boolean>(false);
  // Ref điều khiển chuyển động camera mượt mà (Smooth Camera Animation)
  const cameraAnimRef = useRef<{
    startX: number;
    startY: number;
    startZoom: number;
    targetX: number;
    targetY: number;
    targetZoom: number;
    startTime: number;
    duration: number;
  } | null>(null);

  // Pointers & Viewport
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Offscreen Canvas Cache Layers cho Tối ưu FPS & Đồ họa Neon OpenFront
  const offscreenTerrainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenTerritoryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenTerrainDirtyRef = useRef<boolean>(true);
  const offscreenTerritoryDirtyRef = useRef<boolean>(true);
  const dirtyTerritoryTilesRef = useRef<{ x: number; y: number }[]>([]);

  // Tối ưu Fog of War: Cache tầm nhìn tĩnh từ lãnh thổ & công trình (chỉ cập nhật khi đổi ô đất/công trình)
  const fogBaseGridRef = useRef<Uint8Array | null>(null);
  const fogBaseDirtyRef = useRef<boolean>(true);

  // Cache vị trí trung tâm các quốc gia
  const nationCentersRef = useRef<Record<number, { px: number; py: number }>>({});

  const viewportSizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const pointersMapRef = useRef<Map<number, { id: number; x: number; y: number }>>(new Map());
  const pointerStartRef = useRef<{ id: number; x: number; y: number; time: number } | null>(null);
  const startCamRef = useRef({ x: 0, y: 0, zoom: 1.25 });
  
  // Pinch-to-zoom mượt mà với damping factor chống nhảy/giật & chống chọn nhầm ô đất
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPinchMidRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const isMultiTouchActiveRef = useRef<boolean>(false);
  const totalDragDistRef = useRef<number>(0);

  // Hiệu ứng rung màn hình, AI Coalition & Thành tựu
  const screenShakeRef = useRef<{ intensity: number; duration: number }>({ intensity: 0, duration: 0 });
  const tileCountCacheRef = useRef<{ t: number; counts: number[] }>({ t: -1, counts: [] });
  const coalitionFormedRef = useRef<boolean>(false);
  const unlockedAchievementsRef = useRef<Set<string>>(new Set());

  const gameDataRef = useRef<{
    tiles: Tile[][];
    nations: Nation[];
    attackWaves: AttackWave[];
    particles: GameParticle[];
    events: GameEvent[];
    researching: ResearchingTech | null;
    gameTimeSeconds: number;
    hasMetBot: boolean;
    darkTitan: DarkTitan | null;
    darkTitans: DarkTitan[];
    flyingMissiles: FlyingMissile[];
    tradeRoutes: SeaTradeRoute[];
    tradeShips: SeaTradeShip[];
    activeSeasonEvent: {
      type: 'BLIZZARD' | 'PLAGUE' | 'GOLDEN_HARVEST' | 'DROUGHT';
      name: string;
      remainingTime: number;
      duration: number;
      desc: string;
    } | null;
    stats: {
      battlesCount: number;
      buildingsCount: number;
    };
  }>({
    tiles: [],
    nations: [],
    attackWaves: [],
    particles: [],
    events: [],
    researching: null,
    gameTimeSeconds: 0,
    hasMetBot: false,
    darkTitan: null,
    darkTitans: [],
    flyingMissiles: [],
    tradeRoutes: [],
    tradeShips: [],
    activeSeasonEvent: null,
    stats: { battlesCount: 0, buildingsCount: 0 },
  });

  useEffect(() => {
    soundManager.enabled = soundEnabled;
  }, [soundEnabled]);

  const handleMapTapRef = useRef<(mapX: number, mapY: number, screenX: number, screenY: number) => void>(() => {});

  const {
    clampZoom,
    clampCamera,
    zoomAroundPoint,
    focusOnCoordinates,
    focusOnPlayerKingdom,
    focusOnNation,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handleWheel,
  } = useMapCamera({
    mapSize,
    cameraRef,
    cameraAnimRef,
    viewportSizeRef,
    canvasRef,
    pointersMapRef,
    pointerStartRef,
    startCamRef,
    lastPinchDistRef,
    lastPinchMidRef,
    isDraggingRef,
    isMultiTouchActiveRef,
    totalDragDistRef,
    gameDataRef,
    nationCentersRef,
    handleMapTap: (mapX, mapY, screenX, screenY) => handleMapTapRef.current(mapX, mapY, screenX, screenY),
  });

  const initWeatherParticlesRef = useRef<((size: MapDimension, weather: WeatherType) => void) | null>(null);

  const {
    weather,
    setWeather,
    weatherRef,
    weatherEnabled,
    setWeatherEnabled,
    weatherEnabledRef,
    cycleWeather,
    toggleWeather,
    updateSeasonEventsAndWeather,
  } = useSeasonEvents({
    gameDataRef,
    cameraRef,
    mapSize,
    initWeatherParticlesRef,
    nextLightningTimeRef,
  });

  const { initWeatherParticles, renderTerrainBuffer, renderTerritoryBuffer } = useGameRenderer({
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
  });

  initWeatherParticlesRef.current = initWeatherParticles;

  // Viện trợ tài chính / tặng quân đồng minh
  const handleSendGoldAid = useCallback((botId: number) => {
    const data = gameDataRef.current;
    const player = data.nations[1];
    const bot = data.nations[botId];
    if (!player || !bot || bot.isEliminated) return;

    if (player.gold < 100) {
      data.particles.push({
        x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
        y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
        color: '#ef4444', size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
        type: 'FLOAT_TEXT', text: '⚠️ Không đủ 100 Vàng để viện trợ!'
      });
      return;
    }

    player.gold -= 100;
    bot.gold += 100;
    soundManager.playCapture();

    if (player.diplomacy[botId]) {
      player.diplomacy[botId].relation = Math.min(100, player.diplomacy[botId].relation + 15);
    }

    data.events.unshift({
      id: Math.random().toString(),
      title: '💸 Viện Trợ Vàng Đồng Minh',
      description: `Đã viện trợ 100 Vàng cho nước đồng minh ${bot.name}!`,
      type: 'DIPLOMACY',
      targetNationId: botId,
      timestamp: formatGameTime(data.gameTimeSeconds),
    });

    data.particles.push({
      x: bot.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      y: bot.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      color: '#fbbf24', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
      type: 'FLOAT_TEXT', text: `💸 Viện Trợ +100 Vàng cho ${bot.name}!`
    });
  }, []);

  const handleSendTroopAid = useCallback((botId: number) => {
    const data = gameDataRef.current;
    const player = data.nations[1];
    const bot = data.nations[botId];
    if (!player || !bot || bot.isEliminated) return;

    if (player.troops < 50) {
      data.particles.push({
        x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
        y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
        color: '#ef4444', size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
        type: 'FLOAT_TEXT', text: '⚠️ Không đủ 50 Quân để chuyển tiếp viện!'
      });
      return;
    }

    player.troops -= 50;
    bot.troops = Math.min(bot.maxTroops, bot.troops + 50);
    soundManager.playCapture();

    if (player.diplomacy[botId]) {
      player.diplomacy[botId].relation = Math.min(100, player.diplomacy[botId].relation + 15);
    }

    data.events.unshift({
      id: Math.random().toString(),
      title: '🪖 Tiếp Viện Quân Đội Đồng Minh',
      description: `Đã điều chuyển 50 Quân tiếp viện cho đồng minh ${bot.name}!`,
      type: 'DIPLOMACY',
      targetNationId: botId,
      timestamp: formatGameTime(data.gameTimeSeconds),
    });

    data.particles.push({
      x: bot.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      y: bot.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      color: '#38bdf8', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
      type: 'FLOAT_TEXT', text: `🪖 Tiếp Viện +50 Quân cho ${bot.name}!`
    });
  }, []);

  const handleRequestAid = useCallback((botId: number) => {
    const data = gameDataRef.current;
    const player = data.nations[1];
    const bot = data.nations[botId];
    if (!player || !bot || bot.isEliminated) return;

    if (bot.gold >= 150) {
      bot.gold -= 150;
      player.gold += 150;
      soundManager.playCapture();
      data.events.unshift({
        id: Math.random().toString(),
        title: '🤝 Nhận Viện Trợ Đồng Minh',
        description: `Đồng minh ${bot.name} đã chấp thuận viện trợ +150 Vàng cho bạn!`,
        type: 'DIPLOMACY',
        targetNationId: 1,
        timestamp: formatGameTime(data.gameTimeSeconds),
      });
      data.particles.push({
        x: player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#10b981', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT', text: `🤝 ${bot.name} Viện Trợ +150 Vàng!`
      });
    } else {
      data.particles.push({
        x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
        y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
        color: '#ef4444', size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
        type: 'FLOAT_TEXT', text: `⚠️ ${bot.name} hiện không có đủ tài chính dư dả!`
      });
    }
  }, []);



  // Kiểm tra ô tọa độ có nằm trong tầm nhìn của người chơi hay không
  const isTileVisibleToPlayer = useCallback((tx: number, ty: number, data: any): boolean => {
    if (!fogOfWarEnabledRef.current) return true;
    const myNationId = isMultiplayerRef.current ? myNationIdRef.current : 1;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (data.tiles[ny]?.[nx]?.owner === myNationId && Math.hypot(dx, dy) <= 4.5) {
          return true;
        }
      }
    }
    return false;
  }, []);

  // Kích hoạt Kỹ năng Chủ Động của Đại Tướng
  const activateGeneralSkill = useCallback((nationId: number): boolean => {
    const data = gameDataRef.current;
    const nation = data.nations[nationId];
    if (!nation || nation.isEliminated || !nation.general) return false;
    const gen = nation.general;
    if (gen.status === 'RECOVERING' || (gen.skillCooldown && gen.skillCooldown > 0)) return false;

    const rosterItem = GENERAL_ROSTER.find(r => r.skillId === gen.skillId) || GENERAL_ROSTER[0];
    const power = getSkillPower(nation);

    // Kỹ năng 2: Mưa Tên Lửa Chiến Thuật tốn 150 vàng của quốc gia
    if (gen.skillId === 'MISSILE_BARRAGE') {
      if (nation.gold < 150) {
        if (nation.isPlayer) {
          data.particles.push({
            x: gen.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: gen.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#ef4444', size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.6,
            type: 'FLOAT_TEXT', text: '⚠️ Cần 150 Vàng để gọi Mưa Tên Lửa!'
          });
        }
        return false;
      }
      nation.gold -= 150;
    }

    // Thiết lập thời gian hồi chiêu và thời gian hiệu lực kỹ năng theo Cây Kỹ Năng
    const skillBonuses = nation.isPlayer ? getSkillTreeBonuses(playerProfileRef.current.skillTree) : null;
    gen.skillCooldown = Math.max(4, Math.round(rosterItem.cooldown * (skillBonuses ? skillBonuses.generalCooldownMult : 1.0)));
    gen.skillActiveTimer = Math.round(rosterItem.duration * (skillBonuses && playerProfileRef.current.skillTree?.heroLevel >= 5 ? 1.3 : 1.0));

    // Mốc kết hợp Kinh Tế + Anh Hùng: Thưởng ngay 15% kho vàng mỗi khi xuất chiêu
    if (nation.isPlayer && skillBonuses?.isEconomyHeroHybrid) {
      const bonusGold = Math.max(3000, Math.floor(nation.gold * 0.15));
      nation.gold += bonusGold;
      data.particles.push({
        x: nation.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: nation.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#fbbf24', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT', text: `👑 Chiêu Hiền: +${bonusGold.toLocaleString()} Vàng!`
      });
    }

    // Âm thanh kèn xuất kích
    if (nation.isPlayer) {
      soundManager.playGeneralHorn();
    }

    // Thực thi hiệu ứng tức thời cho từng loại kỹ năng
    if (gen.skillId === 'MISSILE_BARRAGE') {
      const missileCount = Math.ceil(5 * power);
      const size = data.tiles.length;
      const enemyBorderTiles: Tile[] = [];

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const t = data.tiles[y][x];
          if (t.owner > 0 && t.owner !== nation.id && t.terrain !== 'WATER') {
            const dip = nation.diplomacy[t.owner]?.status;
            if (dip !== 'ALLIANCE' && dip !== 'TRUCE') {
              if (t.isBorder) {
                enemyBorderTiles.push(t);
              }
            }
          }
        }
      }

      // Ưu tiên các ô biên giới địch gần tướng nhất
      enemyBorderTiles.sort((a, b) => {
        const da = Math.hypot(a.x - gen.x, a.y - gen.y);
        const db = Math.hypot(b.x - gen.x, b.y - gen.y);
        return da - db;
      });

      const targets = enemyBorderTiles.slice(0, missileCount);
      data.flyingMissiles = data.flyingMissiles || [];
      targets.forEach((tgt, mIdx) => {
        data.flyingMissiles.push({
          id: Math.random().toString(),
          type: 'ATOM',
          sourceX: gen.x,
          sourceY: gen.y,
          targetX: tgt.x,
          targetY: tgt.y,
          progress: -(mIdx * 0.08), // Phóng liên hoàn thành đợt
          speed: 1 / 4.5,
          fromNation: nation.id,
        });
      });
    } else if (gen.skillId === 'SUPPLY_REINFORCE') {
      const troopGain = Math.round(nation.maxTroops * 0.20 * power);
      nation.troops = Math.min(nation.maxTroops, nation.troops + troopGain);
      const goldGain = Math.round(nation.gold * 0.10 * power);
      nation.gold += goldGain;
    }

    // Hiệu ứng chữ nổi (FLOAT_TEXT) và hạt hào quang (AURA) quanh Tướng
    const isVisible = nation.isPlayer || isTileVisibleToPlayer(gen.x, gen.y, data);
    if (isVisible) {
      const px = gen.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
      const py = gen.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

      // Chữ nổi thông báo kỹ năng
      data.particles.push({
        x: px,
        y: py,
        color: '#fbbf24',
        size: 0,
        life: 55,
        maxLife: 55,
        vx: 0,
        vy: -0.8,
        type: 'FLOAT_TEXT',
        text: `${rosterItem.emoji} ${gen.name}: ${rosterItem.skillName}!`,
      });

      // Hạt hào quang (AURA) tỏa sáng quanh Tướng
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        data.particles.push({
          x: px + Math.cos(angle) * 12,
          y: py + Math.sin(angle) * 12,
          color: '#f59e0b',
          size: 3.5,
          life: 28,
          maxLife: 28,
          vx: Math.cos(angle) * 0.9,
          vy: Math.sin(angle) * 0.9,
          type: 'AURA',
        });
      }
    }

    if (nation.isPlayer) {
      data.events.unshift({
        id: Math.random().toString(),
        title: `👑 Tướng Khai Mở Kỹ Năng`,
        description: `${gen.name} đã phát động [${rosterItem.skillName}]: ${rosterItem.description}`,
        type: 'DIPLOMACY',
        targetNationId: 1,
        timestamp: formatGameTime(data.gameTimeSeconds),
      });
    }

    return true;
  }, [isTileVisibleToPlayer]);

  // Bot tự động quyết định kích hoạt kỹ năng của Tướng
  const botUseGeneralSkill = useCallback((bot: Nation) => {
    if (!bot.general || bot.isEliminated || bot.general.status === 'RECOVERING') return;
    if (bot.general.skillCooldown && bot.general.skillCooldown > 0) return;

    const data = gameDataRef.current;
    const gen = bot.general;
    let conditionMet = false;

    switch (gen.skillId) {
      case 'INSPIRE_AURA': {
        // Bot đang có ít nhất 1 đợt quân đang hành quân
        const hasMarchingWave = (data.attackWaves || []).some(w => w.fromNation === bot.id);
        if (hasMarchingWave) conditionMet = true;
        break;
      }
      case 'MISSILE_BARRAGE': {
        // Bot đang có chiến tranh (WAR) với ai đó và đủ vàng (>= 150)
        const hasWar = Object.values(bot.diplomacy).some(d => d.status === 'WAR');
        if (hasWar && bot.gold >= 150) conditionMet = true;
        break;
      }
      case 'IRON_BORDER_SHIELD': {
        // Bot đang bị đợt quân của địch tấn công vào ô biên giới
        const incomingToBorder = (data.attackWaves || []).some(w => {
          if (w.fromNation === bot.id) return false;
          const tgt = data.tiles[w.targetY]?.[w.targetX];
          return tgt && tgt.owner === bot.id && tgt.isBorder;
        });
        if (incomingToBorder) conditionMet = true;
        break;
      }
      case 'SUPPLY_REINFORCE': {
        // Quân hiện tại của Bot dưới 50% maxTroops
        if (bot.troops < bot.maxTroops * 0.5) conditionMet = true;
        break;
      }
      case 'SHADOW_RAID': {
        // Bot đang có đợt quân đang tiến công
        const hasMarchingWave = (data.attackWaves || []).some(w => w.fromNation === bot.id);
        if (hasMarchingWave) conditionMet = true;
        break;
      }
    }

    // Để Bot không dùng liên tục: mỗi vòng quyết định chỉ có 35% khả năng dùng khi đủ điều kiện
    if (conditionMet && Math.random() < 0.35) {
      activateGeneralSkill(bot.id);
    }
  }, [activateGeneralSkill]);

  // Bắt đầu game
  const startNewGame = (
    chosenDiff: GameDifficulty = difficulty, 
    chosenSize: MapDimension = mapSize,
    customName: string = playerName,
    chosenMode: GameMode = gameMode
  ) => {
    setGameMode(chosenMode);
    gameModeRef.current = chosenMode;
    const { tiles, nations } = generateWorldMap(chosenSize, chosenDiff, customName);
    nations.forEach((n) => {
      if (n.general) {
        if (n.id === 1) {
          const selectedRosterItem = GENERAL_ROSTER.find(g => g.skillId === playerProfileRef.current.selectedGeneral) || GENERAL_ROSTER[0];
          n.general.name = selectedRosterItem.name;
          n.general.skillId = selectedRosterItem.skillId;
          n.general.skillCooldown = 0;
          n.general.skillActiveTimer = 0;
        }
        calculateGeneralStats(n.general, n, n.isPlayer ? playerProfileRef.current : null);
      }
    });
    setAutoExpand(chosenDiff === 'EASY');
    totalLandCountRef.current = tiles.flat().filter(t => t.terrain !== 'WATER').length;

    // Trong Chế Độ Sáng Tạo: Cung cấp sẵn tài nguyên cực khủng để trải nghiệm ngay
    if (chosenMode === 'CREATIVE' && nations[1]) {
      nations[1].gold = 999999;
      nations[1].troops = 50000;
      nations[1].maxTroops = 100000;
    }

    gameDataRef.current = {
      tiles,
      nations,
      attackWaves: [],
      particles: [],
      events: [
        {
          id: '1',
          title: chosenMode === 'CREATIVE' ? '🎨 KHỞI ĐẦU CHẾ ĐỘ SÁNG TẠO' : 'Khởi Đầu Trái Đất',
          description: chosenMode === 'CREATIVE'
            ? `Chào mừng Đấng Sáng Tạo ${nations[1]?.name}! Tự do tùy biến Vàng, Quân, Thời Tiết & Triệu hồi Tà Thần!`
            : `Chào mừng Đại Đế ${nations[1]?.name}! Xuất phát tại khu vực Việt Nam / Đông Nam Á. Hãy chinh phục các thuộc địa & làm chủ thế giới.`,
          type: 'HARVEST',
          targetNationId: 1,
          timestamp: '00:00',
        }
      ],
      researching: null,
      gameTimeSeconds: 0,
      hasMetBot: false,
      darkTitan: null,
      darkTitans: [],
      flyingMissiles: [],
      tradeRoutes: [],
      tradeShips: [],
      activeSeasonEvent: null,
      stats: { battlesCount: 0, buildingsCount: 0 },
    };

    offscreenTerrainDirtyRef.current = true;
    offscreenTerritoryDirtyRef.current = true;
    fogBaseDirtyRef.current = true;
    dirtyTerritoryTilesRef.current = [];
    coalitionFormedRef.current = false;
    unlockedAchievementsRef.current.clear();
    victoryAwardedRef.current = false;
    setVictoryReward(null);
    setSelectedTile(null);
    selectedTileRef.current = null;
    setCurrentQuest(1);
    setQuestDismissed(false);
    setHasMetBot(false);
    needsCenterCameraRef.current = true;
    initWeatherParticles(chosenSize, weatherRef.current);
    if (weatherRef.current === 'RAIN') {
      nextLightningTimeRef.current = performance.now() + 2000 + Math.random() * 3000;
    }
    setGameState('PLAYING');
    soundManager.playClick();
  };

  // --- HỆ THỐNG LƯU VÀ TIẾP TỤC VÁN CHƠI (SAVE / CONTINUE GAME) ---
  const {
    savedGameInfo,
    saveGame,
    loadGame,
    deleteSavedGame,
    checkSavedGame,
    saveGameRef,
  } = useSaveGame({
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
  });

  const { updateTradeRoutes, lootTradeShip } = useTradeRoutes(gameDataRef);
  const { updateDarkTitans } = useDarkTitanAI({ gameDataRef, offscreenTerritoryDirtyRef });
  const { updateAttackWaves } = useAttackWaves({
    gameDataRef,
    gameSpeed,
    unlockedAchievementsRef,
    cameraRef,
  });

  // Tự động lưu game an toàn khi người chơi chuyển app hoặc đóng trình duyệt trên Android
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && gameStateRef.current === 'PLAYING') {
        saveGameRef.current();
      }
    };
    const handleBeforeUnload = () => {
      if (gameStateRef.current === 'PLAYING') {
        saveGameRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'TITLE') {
      checkSavedGame();
    }
  }, [gameState, checkSavedGame]);

  // --- ADMIN PANEL HANDLERS (ĐẶC QUYỀN QUẢN TRỊ VIÊN) ---
  const refreshHudStats = useCallback(() => {
    const data = gameDataRef.current;
    if (!data || !data.nations?.[1]) return;
    const player = data.nations[1];
    const totalLand = totalLandCountRef.current || 1;
    const landPercent = totalLand > 0 ? Math.round((player.territoryCount / totalLand) * 100) : 0;
    setHudStats(prev => {
      const titanBuffTimer = player.titanBuffTimer || 0;
      if (
        prev.gold === player.gold &&
        prev.goldIncome === player.goldIncome &&
        prev.troops === player.troops &&
        prev.maxTroops === player.maxTroops &&
        prev.landPercent === landPercent &&
        prev.territoryCount === player.territoryCount &&
        prev.titanBuffTimer === titanBuffTimer
      ) {
        return prev;
      }
      return {
        gold: player.gold,
        goldIncome: player.goldIncome,
        troops: player.troops,
        maxTroops: player.maxTroops,
        landPercent,
        territoryCount: player.territoryCount,
        titanBuffTimer,
      };
    });
  }, []);

  const handleResetCooldowns = useCallback(() => {
    const data = gameDataRef.current;
    if (!data || !data.tiles) return;
    const size = data.tiles.length;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data.tiles[y][x]?.missileCooldown) {
          data.tiles[y][x].missileCooldown = 0;
        }
      }
    }
    data.nations?.forEach((n: Nation) => {
      if (n.general) {
        n.general.skillCooldown = 0;
      }
    });
    data.darkTitans?.forEach((titan: any) => {
      titan.cd = { q: 0, w: 0, e: 0, r: 0 };
    });
  }, []);

  const handleAddSilos = useCallback((count: number) => {
    const data = gameDataRef.current;
    if (!data || !data.tiles) return;
    const size = data.tiles.length;
    let added = 0;
    for (let y = 0; y < size && added < count; y++) {
      for (let x = 0; x < size && added < count; x++) {
        const t = data.tiles[y][x];
        if (t && t.owner === 1 && t.terrain === 'LAND' && t.building !== 'MISSILE_SILO') {
          t.building = 'MISSILE_SILO';
          t.missileCooldown = 0;
          added++;
        }
      }
    }
    offscreenTerritoryDirtyRef.current = true;
    soundManager.playBuild();
  }, []);

  const handleAddMissiles = useCallback((type: MissileType, count: number) => {
    const data = gameDataRef.current;
    if (!data || !data.nations?.[1]) return;
    const player = data.nations[1];
    const enemy = data.nations.find((n: Nation) => n && !n.isPlayer && !n.isEliminated);
    if (!enemy) return;

    for (let i = 0; i < count; i++) {
      const targetX = enemy.capitalX + (Math.floor(Math.random() * 5) - 2);
      const targetY = enemy.capitalY + (Math.floor(Math.random() * 5) - 2);
      const boundedX = Math.max(0, Math.min(data.tiles.length - 1, targetX));
      const boundedY = Math.max(0, Math.min(data.tiles.length - 1, targetY));

      data.flyingMissiles.push({
        id: Math.random().toString(),
        type,
        sourceX: player.capitalX,
        sourceY: player.capitalY,
        targetX: boundedX,
        targetY: boundedY,
        progress: 0,
        speed: 1 / 12,
        fromNation: 1,
      });
    }
    soundManager.playMissileLaunch();
  }, []);

  const handleAddBot = useCallback(() => {
    const data = gameDataRef.current;
    if (!data || !data.tiles) return;
    const size = data.tiles.length;
    const neutralLand: { x: number; y: number }[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data.tiles[y][x].owner === 0 && data.tiles[y][x].terrain === 'LAND') {
          neutralLand.push({ x, y });
        }
      }
    }
    if (neutralLand.length === 0) return;
    const spot = neutralLand[Math.floor(Math.random() * neutralLand.length)];
    const newId = data.nations.length;
    const BOT_COLORS = ['#f43f5e', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    const chosenColor = BOT_COLORS[newId % BOT_COLORS.length];

    const newBot: Nation = {
      id: newId,
      name: `Bot Thử Nghiệm #${newId}`,
      color: chosenColor,
      isPlayer: false,
      personality: 'AGGRESSIVE',
      tier: 'TIER_2_TRIBE',
      gold: 5000,
      goldIncome: 20,
      troops: 3000,
      maxTroops: 10000,
      population: 4000,
      territoryCount: 1,
      isEliminated: false,
      capitalX: spot.x,
      capitalY: spot.y,
      hasPort: false,
      techLevels: { economy: 0, military: 0, defense: 0 },
      diplomacy: {},
      allianceInvites: [],
      lastRejectedInviteTimer: {},
      traitorTimer: 0
    };

    data.tiles[spot.y][spot.x].owner = newId;
    data.tiles[spot.y][spot.x].building = 'CITY';

    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
    DIRS.forEach(([dx, dy]) => {
      const nx = spot.x + dx, ny = spot.y + dy;
      if (data.tiles[ny]?.[nx] && data.tiles[ny][nx].owner === 0 && data.tiles[ny][nx].terrain === 'LAND') {
        data.tiles[ny][nx].owner = newId;
        newBot.territoryCount++;
      }
    });

    data.nations.push(newBot);
    offscreenTerritoryDirtyRef.current = true;
    refreshHudStats();
  }, [refreshHudStats]);

  const handleRemoveBot = useCallback((botId: number) => {
    const data = gameDataRef.current;
    if (!data || !data.nations?.[botId]) return;
    const bot = data.nations[botId];
    bot.isEliminated = true;
    bot.troops = 0;
    bot.gold = 0;
    const size = data.tiles.length;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data.tiles[y][x].owner === botId) {
          data.tiles[y][x].owner = 0;
          data.tiles[y][x].building = 'NONE';
        }
      }
    }
    data.attackWaves = data.attackWaves.filter((w: AttackWave) => w.fromNation !== botId && w.toNation !== botId);
    offscreenTerritoryDirtyRef.current = true;
    refreshHudStats();
  }, [refreshHudStats]);

  const handleAdjustBotPower = useCallback((botId: number, multiplier: number) => {
    const data = gameDataRef.current;
    if (!data || !data.nations?.[botId]) return;
    const bot = data.nations[botId];
    bot.troops = Math.max(10, Math.floor(bot.troops * multiplier));
    bot.maxTroops = Math.max(100, Math.floor(bot.maxTroops * multiplier));
    bot.gold = Math.max(0, Math.floor(bot.gold * multiplier));
    if (multiplier >= 2.5) {
      bot.tier = 'BOSS';
      bot.personality = 'AGGRESSIVE';
    }
    refreshHudStats();
  }, [refreshHudStats]);

  // Kiểm tra liên kết phòng từ URL (?room=XXXXXX) khi bạn bè mở link mời
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setUrlRoomCode(roomParam.toUpperCase().trim());
        setIsMultiplayerModalOpen(true);
      }
    } catch (e) {
      console.error('Lỗi đọc tham số URL phòng:', e);
    }
  }, []);

  useEffect(() => {
    isMultiplayerRef.current = isMultiplayer;
  }, [isMultiplayer]);

  useEffect(() => {
    myNationIdRef.current = myPlayerNationId;
  }, [myPlayerNationId]);

  const handleStartMultiplayerGame = useCallback((room: RoomState, myPlayerId: string) => {
    const me = room.players.find(p => p.id === myPlayerId);
    const myNation = me ? me.nationId : 1;
    setIsMultiplayer(true);
    setMultiplayerRoom(room);
    setMyPlayerNationId(myNation);
    myNationIdRef.current = myNation;
    isMultiplayerRef.current = true;
    setIsMultiplayerModalOpen(false);

    // Khởi tạo trận đấu
    startNewGame(room.settings.difficulty, room.settings.mapSize, me ? me.name : playerName, 'STANDARD');

    // Đồng bộ thông tin người chơi vào các quốc gia trên bản đồ
    const data = gameDataRef.current;
    room.players.forEach(p => {
      if (data.nations[p.nationId]) {
        data.nations[p.nationId].name = p.name;
        data.nations[p.nationId].color = p.color;
        data.nations[p.nationId].isPlayer = (p.nationId === myNation);
      }
    });

    data.events.unshift({
      id: Math.random().toString(),
      title: '🌐 PHÒNG CHƠI TRỰC TUYẾN',
      description: `Trận đấu phòng [${room.code}] đã bắt đầu! Có ${room.players.length} người chơi tham chiến.`,
      type: 'DIPLOMACY',
      targetNationId: myNation,
      timestamp: '00:00',
    });

    offscreenTerritoryDirtyRef.current = true;
  }, [playerName]);

  // Vòng lặp Logic Game
  useEffect(() => {
    if (gameState !== 'PLAYING' || isPaused) return;

    const intervalTime = 1000 / gameSpeed;
    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const data = gameDataRef.current;
      const { tiles, nations } = data;
      if (!tiles || tiles.length === 0) return;

      data.gameTimeSeconds += 1;
      const size = tiles.length;

      // Tự động lưu game mỗi 30 giây khi đang chơi
      if (data.gameTimeSeconds > 0 && data.gameTimeSeconds % 30 === 0) {
        saveGameRef.current();
      }

      // ĐẶC QUYỀN ADMIN: Không giới hạn tài nguyên (Infinite Resources)
      if (infiniteResourcesRef.current && nations[1]) {
        nations[1].gold = 9999999;
        nations[1].troops = Math.max(nations[1].troops, nations[1].maxTroops);
      }

      // ĐẶC QUYỀN ADMIN: Khóa không cooldown (No Cooldown Mode)
      if (noCooldownRef.current) {
        nations.forEach((n: Nation) => {
          if (n.general) n.general.skillCooldown = 0;
        });
        data.darkTitans?.forEach((titan: any) => {
          titan.cd = { q: 0, w: 0, e: 0, r: 0 };
        });
      }

      // Đếm ngược Hiệp Ước Đình Chiến (TRUCE 45 giây)
      nations.forEach(n => {
        if (!n.diplomacy) return;
        Object.keys(n.diplomacy).forEach(tKey => {
          const targetId = Number(tKey);
          const dip = n.diplomacy[targetId];
          if (dip && dip.status === 'TRUCE' && dip.truceTimer > 0) {
            dip.truceTimer -= 1;
            if (dip.truceTimer <= 0) {
              dip.status = 'WAR';
              dip.relation = 0;
              if (n.id === 1 && nations[targetId] && !nations[targetId].isEliminated) {
                const other = nations[targetId];
                data.events.unshift({
                  id: Math.random().toString(),
                  title: '🕊️ Hết Hạn Đình Chiến (45s)',
                  description: `Hiệp ước đình chiến 45 giây với ${other.name} đã kết thúc! Hai quốc gia trở lại trạng thái chiến tranh.`,
                  type: 'DIPLOMACY',
                  targetNationId: targetId,
                  timestamp: formatGameTime(data.gameTimeSeconds),
                });
                data.particles.push({
                  x: n.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  y: n.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  type: 'FLOAT_TEXT',
                  color: '#f59e0b', size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.6,
                  text: `🕊️ Hết hạn đình chiến 45s (${other.name})`
                });
              }
            }
          }
        });
        
        // Quản lý trạng thái kẻ phản bội
        if (n.traitorTimer && n.traitorTimer > 0) {
          n.traitorTimer -= 1;
        }
      });

      // Kích hoạt Sự Kiện Ngẫu Nhiên & Thảm Họa Thiên Nhiên theo mùa & Thời tiết
      updateSeasonEventsAndWeather();

      // Quyền năng God Mode (Khóa Bất Tử): Tự động hồi phục 999.999 vàng và 99.999 quân
      if (godModeLockedRef.current && nations[1]) {
        nations[1].gold = 999999;
        nations[1].troops = 99999;
        nations[1].maxTroops = Math.max(nations[1].maxTroops, 100000);
      }

      // --- Quản lý TẤT CẢ Tà Thần Cổ Đại (Hỗ trợ Spam nhiều Tà Thần) ---
      updateDarkTitans();

      // 1. Thống kê & Quét bản đồ 1 lần duy nhất (Single-Pass Grid Optimization)
      const territoryCounts: Record<number, number> = {};
      const buildingCounts: Record<number, Record<BuildingType, number>> = {};
      const centersSum: Record<number, { sumX: number; sumY: number; count: number }> = {};
      let botMetFound = false;
      const checkBotMet = !data.hasMetBot;

      const isEightSec = data.gameTimeSeconds % 8 === 0 || !data.tradeRoutes;
      const isTenSec = data.gameTimeSeconds > 0 && data.gameTimeSeconds % 10 === 0;
      const isFifteenSec = data.gameTimeSeconds > 0 && data.gameTimeSeconds % 15 === 0;

      const portList: { x: number; y: number; owner: number; nation: Nation }[] = [];
      const artilleryList: Tile[] = [];
      const laserList: Tile[] = [];

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const t = tiles[y]?.[x];
          if (!t) continue;

          // Hồi chiêu Tên lửa
          if (noCooldownRef.current && t.missileCooldown) {
            t.missileCooldown = 0;
          } else if (t.missileCooldown && t.missileCooldown > 0) {
            t.missileCooldown -= 1;
          }

          // Đất Cháy
          if (t.scorchedTimer && t.scorchedTimer > 0) {
            t.scorchedTimer -= 1;
            if (Math.random() < 0.2) {
              data.particles.push({
                x: x * TILE_PIXEL_SIZE + Math.random() * TILE_PIXEL_SIZE,
                y: y * TILE_PIXEL_SIZE + Math.random() * TILE_PIXEL_SIZE,
                color: '#475569',
                size: 2, life: 15, maxLife: 15,
                vx: (Math.random() - 0.5) * 0.4, vy: -0.5,
                type: 'SPARK'
              });
            }
          }

          // Thống kê lãnh thổ & công trình
          if (t.owner > 0) {
            territoryCounts[t.owner] = (territoryCounts[t.owner] || 0) + 1;
            if (!centersSum[t.owner]) centersSum[t.owner] = { sumX: 0, sumY: 0, count: 0 };
            centersSum[t.owner].sumX += x;
            centersSum[t.owner].sumY += y;
            centersSum[t.owner].count += 1;

            if (t.building !== 'NONE') {
              if (!buildingCounts[t.owner]) buildingCounts[t.owner] = { NONE: 0, CITY: 0, BARRACKS: 0, FORTRESS: 0, PORT: 0, ARTILLERY: 0, MISSILE_SILO: 0, AIR_DEFENSE: 0, LASER: 0 };
              const levelWeight = t.buildingLevel || 1;
              buildingCounts[t.owner][t.building] = (buildingCounts[t.owner][t.building] || 0) + levelWeight;

              if (t.building === 'PORT' && isEightSec && nations[t.owner] && !nations[t.owner].isEliminated) {
                portList.push({ x, y, owner: t.owner, nation: nations[t.owner] });
              } else if (t.building === 'ARTILLERY' && isFifteenSec) {
                artilleryList.push(t);
              } else if (t.building === 'LASER' && isTenSec) {
                laserList.push(t);
              }
            }
          }

          // Gặp bot
          if (checkBotMet && !botMetFound && t.owner === 1) {
            const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
            if (neighbors.some(([nx, ny]) => tiles[ny]?.[nx]?.owner > 1)) {
              botMetFound = true;
            }
          }
        }
      }

      if (checkBotMet && botMetFound) {
        data.hasMetBot = true;
        setHasMetBot(true);
      }

      nations.forEach(n => {
        if (n.id === 0 || n.isEliminated) return;
        if (n.titanBuffTimer && n.titanBuffTimer > 0) {
          n.titanBuffTimer -= 1;
        }
        const titanBuff = (n.titanBuffTimer && n.titanBuffTimer > 0) ? 1.30 : 1.0;

        n.territoryCount = territoryCounts[n.id] || 0;
        const b = buildingCounts[n.id];
        const cityCount = b?.CITY || 0;
        const barracksCount = b?.BARRACKS || 0;
        n.hasPort = (b?.PORT || 0) > 0;

        // 1. TRẦN DÂN SỐ & TĂNG TRƯỞNG DÂN SỐ MỖI GIÂY (THEO CÂY KỸ NĂNG)
        const skillBonuses = n.isPlayer ? getSkillTreeBonuses(playerProfileRef.current.skillTree) : null;
        const botSkillMult = n.isPlayer ? 1.0 : (difficulty === 'HARD' ? 1.15 : difficulty === 'NORMAL' ? 1.08 : 1.03);

        const basePopCap = 20 + (n.territoryCount * 6) + (cityCount * 30);
        const popCap = Math.round(basePopCap * (skillBonuses ? skillBonuses.popCapMult : botSkillMult));
        n.populationCap = popCap;

        if (n.population < popCap) {
          const popRatio = Math.min(1, n.population / popCap);
          const basePopGrowth = (n.territoryCount * 0.03 + cityCount * 0.6) * (1 - popRatio);
          const popGrowthSec = Math.max(0, basePopGrowth * titanBuff * (skillBonuses ? skillBonuses.popGrowthMult : 1.0));
          n.popRemainder = (n.popRemainder || 0) + popGrowthSec;
          if (n.popRemainder >= 1) {
            const addedPop = Math.floor(n.popRemainder);
            n.population = Math.min(popCap, n.population + addedPop);
            n.popRemainder -= addedPop;
          }
        }

        // 2. QUÂN ĐỘI & VÀNG (THEO CÂY KĨ NĂNG & CÔNG NGHỆ)
        const diffMult = difficulty === 'HARD' ? 1.3 : difficulty === 'NORMAL' ? 1.15 : 1.0;
        const isMil3B = n.techLevels?.military === 3 && n.techChoices?.military === 'B';
        const milTechTroopBonus = isMil3B ? 60 : (n.techLevels?.military >= 2 ? 30 : 0);
        const baseMaxTroops = n.population * 1.5 + n.territoryCount * 4 + barracksCount * 40 + milTechTroopBonus;
        n.maxTroops = Math.max(15, Math.floor(baseMaxTroops * (n.id > 1 ? diffMult * botSkillMult : skillBonuses ? skillBonuses.troopsMaxMult : 1.0) * titanBuff));
        
        // Hiệu ứng mốc kết hợp Kinh Tế + Quân Đội: Thành thị cấp quân đội (+6 quân/s)
        const hybridCityTroops = (n.isPlayer && skillBonuses?.isEconomyMilitaryHybrid) ? (cityCount * 6) : 0;
        const milTechRegenMult = isMil3B ? 1.10 : 1.0;
        const growth = Math.max(1, Math.floor(((n.population * 0.04 + barracksCount * 3 + hybridCityTroops) * milTechRegenMult * (n.id > 1 ? diffMult * botSkillMult : skillBonuses ? skillBonuses.troopsRegenMult : 1.0) * titanBuff)));
        if (n.troops < n.maxTroops) {
          n.troops = Math.min(n.maxTroops, Math.round(n.troops + growth));
        }

        // Hiệu ứng mốc kết hợp Kinh Tế + Quân Đội: Doanh trại hỗ trợ ngân khố (+20 vàng/s)
        const hybridBarracksGold = (n.isPlayer && skillBonuses?.isEconomyMilitaryHybrid) ? (barracksCount * 20) : 0;
        const ecoLvl = n.techLevels?.economy || 0;
        const ecoChoice = n.techChoices?.economy;
        const ecoMult = (ecoLvl === 3 && ecoChoice === 'A') ? 1.25 : (ecoLvl >= 2) ? 1.15 : (ecoLvl >= 1) ? 1.08 : 1.0;
        const isEco3B = ecoLvl === 3 && ecoChoice === 'B';
        const cityGold = cityCount * 2 * (isEco3B ? 1.15 : 1.0);
        const seasonMult = data.activeSeasonEvent?.type === 'GOLDEN_HARVEST' ? 2.0 : data.activeSeasonEvent?.type === 'DROUGHT' ? 0.5 : 1.0;
        const baseGold = n.population * 0.05 + n.territoryCount * 0.05 + cityGold + hybridBarracksGold;
        n.goldIncome = Math.max(1, Math.floor(baseGold * (n.id > 1 ? diffMult * botSkillMult : ecoMult * (skillBonuses ? skillBonuses.goldMult : 1.0)) * titanBuff * seasonMult));
        n.gold += n.goldIncome;

        // Quản lý Đại Tướng quốc gia: Kỹ năng, Hồi phục sinh tồn v1.1
        if (n.general) {
          if (n.general.skillCooldown && n.general.skillCooldown > 0) {
            n.general.skillCooldown -= 1;
          }
          if (n.general.skillActiveTimer && n.general.skillActiveTimer > 0) {
            n.general.skillActiveTimer -= 1;
          }

          // Kiểm tra vị trí an toàn (O(1) lookup trực tiếp tọa độ không quét toàn bản đồ)
          const curTile = data.tiles[n.general.y]?.[n.general.x];
          const isSafeZone = Boolean(curTile && curTile.owner === n.id && n.general.status !== 'MARCHING');

          // Hồi phục 3% HP tối đa mỗi giây khi ở vùng an toàn
          const rec = processGeneralRecoveryTick(n.general, n, isSafeZone);
          if (rec.stateChanged && n.general.healthState === 'HEALTHY' && n.isPlayer) {
            data.particles.push({
              x: n.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: n.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#34d399', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
              type: 'FLOAT_TEXT', text: `✨ ${n.general.name} đã hồi phục đủ sức khỏe (>= 60% HP)!`
            });
          }

          if (n.general.status === 'MARCHING') {
            const gen = n.general;
            const activeWave = gen.marchingWaveId 
              ? data.attackWaves.find(w => w.id === gen.marchingWaveId)
              : data.attackWaves.find(w => w.fromNation === n.id && w.hasGeneral);
            if (!activeWave) {
              gen.status = gen.healthState === 'INJURED' ? 'INJURED' : 'IDLE';
              gen.marchingWaveId = undefined;
              gen.x = n.capitalX;
              gen.y = n.capitalY;
            }
          }
        }

        // Quản lý Tiến Hóa Thuộc Địa: Dân Tộc -> Đế Quốc Độc Lập
        if (n.colonyCategory === 'ETHNIC' && n.colonyEvolveTimer !== undefined && n.colonyEvolveTimer > 0) {
          n.colonyEvolveTimer -= 1;
          if (n.colonyEvolveTimer <= 0 && n.population >= 12) {
            n.tier = 'BOSS';
            n.colonyCategory = undefined;
            const cleanName = n.name.replace(/\[Dân Tộc\]|\[Thuộc Địa\]/g, '').trim();
            n.name = `${cleanName} (Đế Quốc)`;
            n.gold += 150;
            n.troops += 25;
            data.events.unshift({
              id: Math.random().toString(),
              title: 'Trỗi Dậy Độc Lập',
              description: `👑 Cộng đồng Sắc Tộc ${cleanName} đã lớn mạnh và chính thức tuyên bố thành lập Đế Quốc độc lập!`,
              type: 'DIPLOMACY',
              targetNationId: n.id,
              timestamp: formatGameTime(data.gameTimeSeconds),
            });
            offscreenTerritoryDirtyRef.current = true;
          }
        }

        if (n.territoryCount === 0 && n.id > 1) {
          n.isEliminated = true;
        }
      });

      // 2.5. ĐỒNG BỘ TRẠNG THÁI PHÒNG CHƠI MULTIPLAYER (HOST phát sóng cho các máy khác mỗi 3 giây)
      if (isMultiplayerRef.current && myNationIdRef.current === 1 && data.gameTimeSeconds % 3 === 0) {
        const syncNations = nations.map(n => ({
          id: n.id,
          gold: n.gold,
          goldIncome: n.goldIncome,
          troops: n.troops,
          maxTroops: n.maxTroops,
          population: n.population,
          territoryCount: n.territoryCount,
          isEliminated: n.isEliminated,
        }));
        multiplayerClient.sendStateSync(syncNations, data.darkTitans, data.gameTimeSeconds);
      }

      // 3. Nghiên cứu công nghệ
      if (data.researching) {
        data.researching.remainingTime -= 1;
        if (data.researching.remainingTime <= 0) {
          const tech = TECH_TREE.find(t => t.id === data.researching?.techId);
          if (tech) {
            const player = nations[1];
            if (!player.techChoices) player.techChoices = {};
            if (tech.branch === 'ECONOMY') {
              player.techLevels.economy = tech.level;
              if (tech.choice) player.techChoices.economy = tech.choice;
            }
            if (tech.branch === 'MILITARY') {
              player.techLevels.military = tech.level;
              if (tech.choice) player.techChoices.military = tech.choice;
            }
            if (tech.branch === 'DEFENSE') {
              player.techLevels.defense = tech.level;
              if (tech.choice) player.techChoices.defense = tech.choice;
            }
            if (player.general) {
              calculateGeneralStats(player.general, player, playerProfileRef.current);
            }
            soundManager.playBuild();
            if (currentQuest === 4) setCurrentQuest(5);
          }
          data.researching = null;
        }
      }

      // 3.5. Xử lý Vùng Đất Cháy & Pháo Kích Tầm Xa & Giao Thương Đồng Minh
      const playerNation = nations[1];

      // Tính năng 3: Giao thương kinh tế Đồng Minh Sắt Son (+20% vàng từ đồng minh mỗi chu kỳ)
      if (playerNation && !playerNation.isEliminated) {
        let tradeIncome = 0;
        nations.forEach(bot => {
          if (bot.id > 1 && !bot.isEliminated && playerNation.diplomacy[bot.id]?.status === 'ALLIANCE') {
            tradeIncome += Math.max(5, Math.floor(bot.goldIncome * 0.20));
          }
        });
        if (tradeIncome > 0) {
          playerNation.gold += tradeIncome;
          if (data.gameTimeSeconds % 8 === 0) {
            data.particles.push({
              x: playerNation.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: playerNation.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#10b981',
              size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.6,
              type: 'FLOAT_TEXT', text: `🤝 +${tradeIncome} Vàng Đồng Minh Sắt Son`
            });
          }
        }
      }

      // Tính năng 3.6: Tuyến Đường Giao Thương Biển Giữa Các Hải Cảng (Maritime Sea Trade Routes & Intercontinental Shipping Lanes)
      updateTradeRoutes(isEightSec, portList);

      // Tính năng 5: Đại Pháo Tầm Xa (Siege Artillery) tự động nã pháo plasma mỗi 15s
      if (isFifteenSec && artilleryList.length > 0) {
        artilleryList.forEach(t => {
          if (t.owner > 0) {
            const gunnerNation = nations[t.owner];
            if (!gunnerNation || gunnerNation.isEliminated) return;

            const x = t.x;
            const y = t.y;
            const gunnerLvl = t.buildingLevel || 1;
            const artilleryDamage = 15 * gunnerLvl;
            const maxRange = 5.5 + Math.min(3, gunnerLvl - 1);

            // Quét ô địch trong phạm vi thích ứng theo cấp độ pháo
            let bestTarget: Tile | null = null;
            let bestDist = 999;
            for (let dy = -6; dy <= 6; dy++) {
              for (let dx = -6; dx <= 6; dx++) {
                const tx = x + dx;
                const ty = y + dy;
                if (tx >= 0 && tx < size && ty >= 0 && ty < size) {
                  const dist = Math.hypot(dx, dy);
                  if (dist > 0 && dist <= maxRange) {
                    const candidate = tiles[ty][tx];
                    if (candidate.owner > 0 && candidate.owner !== t.owner) {
                      const dip = gunnerNation.diplomacy[candidate.owner]?.status;
                      if (dip !== 'ALLIANCE' && dip !== 'TRUCE' && dist < bestDist) {
                        bestDist = dist;
                        bestTarget = candidate;
                      }
                    }
                  }
                }
              }
            }

            if (bestTarget) {
              const enemyNat = nations[bestTarget.owner];
              if (enemyNat) {
                enemyNat.troops = Math.max(0, enemyNat.troops - artilleryDamage);
              }
              // Hiệu ứng đạn pháo nổ plasma
              data.particles.push({
                x: bestTarget.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                y: bestTarget.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                color: '#ef4444',
                size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.7,
                type: 'FLOAT_TEXT', text: `💥 -${artilleryDamage} Pháo Kích (${gunnerLvl > 1 ? `Cấp ${gunnerLvl}` : 'Lv.1'})!`
              });
              for (let p = 0; p < 5; p++) {
                data.particles.push({
                  x: bestTarget.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  y: bestTarget.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  color: '#f97316',
                  size: 3, life: 18, maxLife: 18,
                  vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
                  type: 'SPARK'
                });
              }
              if (t.owner === 1 || bestTarget.owner === 1) {
                soundManager.playAttack();
              }
            }
          }
        });
      }

      // Tính năng 5.5: Tháp Laser Pink Tự Động Bắn Xung Quanh Trong Phạm Vi Tương Tự Pháo Đại
      if (isTenSec && laserList.length > 0) {
        laserList.forEach(t => {
          if (t.owner > 0) {
            const shooterNation = nations[t.owner];
            if (!shooterNation || shooterNation.isEliminated) return;

            const x = t.x;
            const y = t.y;
            const laserLvl = t.buildingLevel || 1;
            const laserDamage = 25 * laserLvl;
            const maxRange = 6.5 + Math.min(3.5, laserLvl - 1);

            let bestTarget: Tile | null = null;
            let bestDist = 999;
            for (let dy = -7; dy <= 7; dy++) {
              for (let dx = -7; dx <= 7; dx++) {
                const tx = x + dx;
                const ty = y + dy;
                if (tx >= 0 && tx < size && ty >= 0 && ty < size) {
                  const dist = Math.hypot(dx, dy);
                  if (dist > 0 && dist <= maxRange) {
                    const candidate = tiles[ty][tx];
                    if (candidate.owner > 0 && candidate.owner !== t.owner) {
                      const dip = shooterNation.diplomacy[candidate.owner]?.status;
                      if (dip !== 'ALLIANCE' && dip !== 'TRUCE' && dist < bestDist) {
                        bestDist = dist;
                        bestTarget = candidate;
                      }
                    }
                  }
                }
              }
            }

            if (bestTarget) {
              const enemyNat = nations[bestTarget.owner];
              if (enemyNat) {
                enemyNat.troops = Math.max(0, enemyNat.troops - laserDamage);
              }

              const srcPxX = x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
              const srcPxY = y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
              const tgtPxX = bestTarget.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
              const tgtPxY = bestTarget.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

              // Tia Laser Hồng rực sáng nối từ Tháp đến mục tiêu
              data.particles.push({
                x: srcPxX,
                y: srcPxY,
                targetX: tgtPxX,
                targetY: tgtPxY,
                color: '#ec4899',
                size: 4, life: 18, maxLife: 18,
                vx: 0, vy: 0,
                type: 'LASER_BEAM'
              });

              // Chữ nổi thông báo sát thương Laser Pink
              data.particles.push({
                x: tgtPxX,
                y: tgtPxY,
                color: '#f472b6',
                size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.7,
                type: 'FLOAT_TEXT',
                text: `⚡ -${laserDamage} Laser Pink (${laserLvl > 1 ? `Cấp ${laserLvl}` : 'Lv.1'})!`
              });

              // Hạt tia lửa hồng bùng nổ tại điểm trúng đạn
              for (let p = 0; p < 6; p++) {
                data.particles.push({
                  x: tgtPxX,
                  y: tgtPxY,
                  color: '#f472b6',
                  size: 3, life: 16, maxLife: 16,
                  vx: (Math.random() - 0.5) * 2.5, vy: (Math.random() - 0.5) * 2.5,
                  type: 'SPARK'
                });
              }

              if (t.owner === 1 || bestTarget.owner === 1) {
                soundManager.playAttack();
              }
            }
          }
        });
      }

      // 11. AI Bot tự động dùng bệ phóng tên lửa nếu đủ vàng (tối đa 1 lần mỗi 15 giây mỗi nước)
      if (data.gameTimeSeconds > 0 && data.gameTimeSeconds % 15 === 0) {
        nations.forEach(bot => {
          if (bot.id <= 1 || bot.isEliminated || bot.colonyCategory === 'FOREST' || bot.gold < 3500) return;
          if (isMultiplayerRef.current && (myNationIdRef.current !== 1 || (multiplayerRoom && multiplayerRoom.players.some(p => p.connected && p.nationId === bot.id)))) return;
          // Kiểm tra xem bot có bệ phóng nào sẵn sàng không
          let botSilo: Tile | null = null;
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const t = tiles[y][x];
              if (t.owner === bot.id && t.building === 'MISSILE_SILO' && (!t.missileCooldown || t.missileCooldown <= 0)) {
                botSilo = t;
                break;
              }
            }
            if (botSilo) break;
          }

          if (botSilo && bot.gold >= 3500) {
            // Tìm mục tiêu kẻ thù gần nhất
            let bestEnemyTile: Tile | null = null;
            let minDist = 999;
            for (let dy = -8; dy <= 8; dy++) {
              for (let dx = -8; dx <= 8; dx++) {
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

            if (bestEnemyTile) {
              const missileType: MissileType = bot.gold >= 50000 ? (Math.random() < 0.4 ? 'MIRV' : 'HYDRO') : bot.gold >= 7000 ? 'HYDRO' : 'ATOM';
              const cfg = MISSILE_CONFIG[missileType];
              if (bot.gold >= cfg.cost) {
                bot.gold -= cfg.cost;
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
      }

      // 4. AI Bot & Thuộc Địa nhỏ phát triển (Tối ưu đơn nhịp quét + tra cứu O(1))
      const canBotsAct = data.gameTimeSeconds >= 4 && (!isMultiplayerRef.current || myNationIdRef.current === 1);
      if (canBotsAct) {
        const totalLand = totalLandCountRef.current || 1;
        const playerLandPct = totalLand > 0 ? (nations[1]?.territoryCount / totalLand) : 0;

        // Xây dựng bản đồ tra cứu đợt tấn công O(1) thay vì filter mảng lặp
        const incomingWaveTargetMap = new Map<number, number>();
        if (data.attackWaves && data.attackWaves.length > 0) {
          for (let wi = 0; wi < data.attackWaves.length; wi++) {
            const w = data.attackWaves[wi];
            const k = w.targetY * size + w.targetX;
            incomingWaveTargetMap.set(k, (incomingWaveTargetMap.get(k) || 0) + w.troops);
          }
        }

        // Xác định các quốc gia do con người điều khiển trong phòng nhiều người
        const humanNationIds = new Set<number>();
        if (isMultiplayerRef.current && multiplayerRoom) {
          multiplayerRoom.players.forEach(p => {
            if (p.connected) humanNationIds.add(p.nationId);
          });
        } else {
          humanNationIds.add(1);
        }

        nations.forEach(bot => {
          if (bot.id <= 1 || bot.isEliminated || humanNationIds.has(bot.id)) return;

          // Rừng hoang dã ([Rừng]) hoàn toàn tĩnh lặng, không tham chiến hay đi xâm chiếm
          if (bot.colonyCategory === 'FOREST') return;

          // Bot tự động dùng kỹ năng chủ động của Tướng
          botUseGeneralSkill(bot);

          // --- 1. ĐÁNH GIÁ MỨC ĐỘ ĐE DỌA & GIÁ TRỊ CHIẾN LƯỢC TRONG 1 LẦN QUÉT DUY NHẤT ---
          const borderThreats: { 
            tile: Tile; 
            threatScore: number; 
            strategicScore: number; 
            enemySource: Tile | null; 
            isCapital: boolean;
            hasKeyBuilding: boolean;
          }[] = [];
          const neutralTargets: { source: Tile; target: Tile; isPlayer: boolean; priority: number }[] = [];

          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const t = tiles[y][x];
              if (t.owner === bot.id) {
                const isCapital = (t.x === bot.capitalX && t.y === bot.capitalY);
                const hasKeyBuilding = t.building !== 'NONE';
                const buildingLvl = t.buildingLevel || 1;

                const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
                let threat = 0;
                let enemySrc: Tile | null = null;

                for (let ni = 0; ni < 4; ni++) {
                  const [nx, ny] = neighbors[ni];
                  if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                    const neighborTile = tiles[ny][nx];
                    if (neighborTile.terrain !== 'WATER') {
                      if (neighborTile.owner === 0) {
                        neutralTargets.push({ source: t, target: neighborTile, isPlayer: false, priority: 10 });
                      } else if (neighborTile.owner !== bot.id) {
                        const dip = bot.diplomacy[neighborTile.owner]?.status;
                        if (dip !== 'ALLIANCE' && dip !== 'TRUCE') {
                          if (neighborTile.owner === 1) {
                            threat += (difficulty === 'HARD' ? 45 : 25);
                            enemySrc = neighborTile;
                          } else if (neighborTile.owner > 1 && dip === 'WAR') {
                            threat += 20;
                            if (!enemySrc) enemySrc = neighborTile;
                          }
                        }
                      }
                    }
                  }
                }

                // Tra cứu O(1) đợt tấn công từ Map
                const incomingTroops = incomingWaveTargetMap.get(y * size + x);
                if (incomingTroops !== undefined && incomingTroops > 0) {
                  threat += 65 + incomingTroops;
                }

                // Tính điểm giá trị chiến lược của ô đất
                let strategicValue = 0;
                if (isCapital) strategicValue += 130; // Thủ đô có độ ưu tiên bảo vệ số 1
                if (t.building === 'FORTRESS') strategicValue += 50 * buildingLvl;
                if (t.building === 'CITY') strategicValue += 35 * buildingLvl;
                if (t.building === 'PORT' || t.building === 'BARRACKS') strategicValue += 30 * buildingLvl;
                if (t.building === 'ARTILLERY' || t.building === 'MISSILE_SILO' || t.building === 'AIR_DEFENSE') strategicValue += 45 * buildingLvl;

                if (bot.personality === 'DEFENSIVE') strategicValue *= 1.4;

                const totalStrategicThreat = threat * 1.5 + strategicValue;

                if (threat > 0 || isCapital || (bot.personality === 'DEFENSIVE' && hasKeyBuilding)) {
                  borderThreats.push({ 
                    tile: t, 
                    threatScore: threat, 
                    strategicScore: totalStrategicThreat,
                    enemySource: enemySrc,
                    isCapital,
                    hasKeyBuilding
                  });
                }
              }
            }
          }

          borderThreats.sort((a, b) => b.strategicScore - a.strategicScore);

          // --- 2. ĐIỀU TƯỚNG TRỰC TIẾP BẢO VỆ CÁC Ô CHIẾN LƯỢC TRỌNG ĐIỂM ---
          const topStrategicThreat = borderThreats[0];
          if (topStrategicThreat && topStrategicThreat.strategicScore >= 30 && bot.general && bot.general.status === 'IDLE') {
            bot.general.status = 'MARCHING';
            bot.general.x = topStrategicThreat.tile.x;
            bot.general.y = topStrategicThreat.tile.y;
          }

          // --- 3. AI TẬP TRUNG XÂY DỰNG & NÂNG CẤP PHÒNG THỦ TẠI CÁC Ô CHIẾN LƯỢC ---
          if (bot.gold >= 80 && Math.random() < (difficulty === 'HARD' ? 0.75 : 0.45)) {
            const targetForDefense = borderThreats.find(b => b.isCapital || b.strategicScore >= 45 || b.tile.building === 'NONE');
            if (targetForDefense) {
              const tileToBuild = targetForDefense.tile;
              if (tileToBuild.building === 'NONE') {
                const buildType: BuildingType = (tileToBuild.x === bot.capitalX && tileToBuild.y === bot.capitalY) || targetForDefense.strategicScore >= 60
                  ? 'FORTRESS'
                  : (Math.random() < 0.65 ? 'FORTRESS' : 'BARRACKS');

                const bCost = BUILDING_INFO[buildType as Exclude<BuildingType, 'NONE'>].baseCost;
                if (bot.gold >= bCost) {
                  bot.gold -= bCost;
                  tileToBuild.building = buildType;
                  tileToBuild.buildingLevel = 1;
                  offscreenTerritoryDirtyRef.current = true;
                  fogBaseDirtyRef.current = true;
                  dirtyTerritoryTilesRef.current.push({ x: tileToBuild.x, y: tileToBuild.y });
                }
              } else if (tileToBuild.building === 'FORTRESS' || tileToBuild.building === 'BARRACKS') {
                // Nâng cấp cấp độ pháo đài/trại quân để tăng hiệu quả phòng thủ
                const upgradeCost = Math.floor(BUILDING_INFO[tileToBuild.building].baseCost * 0.8);
                if (bot.gold >= upgradeCost && (tileToBuild.buildingLevel || 1) < 5) {
                  bot.gold -= upgradeCost;
                  tileToBuild.buildingLevel = (tileToBuild.buildingLevel || 1) + 1;
                  offscreenTerritoryDirtyRef.current = true;
                  fogBaseDirtyRef.current = true;
                  dirtyTerritoryTilesRef.current.push({ x: tileToBuild.x, y: tileToBuild.y });
                }
              }
            }
          }

          // --- 4. PHẢN CÔNG VÀ ĐIỀU QUÂN BẢO VỆ CHIẾN LƯỢC ---
          const minTroopsReq = difficulty === 'HARD' ? 8 : (bot.colonyCategory === 'TRIBE' ? 15 : 10);
          const attackProb = difficulty === 'HARD' ? 0.88 : (bot.personality === 'DEFENSIVE' ? 0.45 : 0.65);

          if (bot.troops >= minTroopsReq && Math.random() < attackProb) {
            const validTargets: { source: Tile; target: Tile; isPlayer: boolean; priority: number }[] = [];

            // Ưu tiên 1: Đánh trả kẻ địch đang đe dọa các ô chiến lược quan trọng
            borderThreats.forEach(bt => {
              if (bt.enemySource) {
                let priority = bt.strategicScore;
                if (bt.isCapital) priority += 100; // Bảo vệ Thủ đô là ưu tiên tuyệt đối
                if (bt.enemySource.owner === 1) priority += (difficulty === 'HARD' ? 50 : 25);

                validTargets.push({
                  source: bt.tile,
                  target: bt.enemySource,
                  isPlayer: bt.enemySource.owner === 1,
                  priority: priority,
                });
              }
            });

            // Ưu tiên 2: Mở rộng sang ô trung lập ven biên đã thu thập sẵn trong cùng nhịp quét
            if (validTargets.length === 0 || (bot.personality !== 'DEFENSIVE' && Math.random() < 0.35)) {
              if (neutralTargets.length > 0) {
                validTargets.push(...neutralTargets);
              }
            }

            if (validTargets.length > 0) {
              validTargets.sort((a, b) => b.priority - a.priority);
              const selected = validTargets[0];

              if (selected) {
                // Giữ lại một lượng quân dự phòng tại căn cứ nếu đang bị đe dọa ô trọng điểm
                const defenseReserve = selected.priority >= 100 ? 0.40 : 0.20;
                const availableTroops = Math.max(5, Math.floor(bot.troops * (1 - defenseReserve)));
                const pct = difficulty === 'HARD' ? (playerLandPct >= 0.15 ? 0.70 : 0.55) : 0.40;
                const troopsToSend = Math.max(5, Math.floor(availableTroops * pct));

                if (troopsToSend >= 5) {
                  launchAttackWave(bot.id, selected.target.owner, selected.source, selected.target, troopsToSend);
                }
              }
            }
          }
        });
      }

      // 5. Tự động mở rộng cho Người chơi (Lỗi 3: Đảm bảo đợt quân tối thiểu 5 quân và người chơi có đủ lính)
      const player = nations[1];
      if (autoExpand && player.troops >= 12 && Math.random() < 0.6) {
        const neutralTargets: { source: Tile; target: Tile }[] = [];
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const src = tiles[y][x];
            if (src.owner === 1) {
              const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
              neighbors.forEach(([nx, ny]) => {
                if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                  const tgt = tiles[ny][nx];
                  if (tgt.terrain !== 'WATER' && tgt.owner === 0) {
                    neutralTargets.push({ source: src, target: tgt });
                  }
                }
              });
            }
          }
        }
        if (neutralTargets.length > 0) {
          const chosen = neutralTargets[Math.floor(Math.random() * neutralTargets.length)];
          const troopsToSend = Math.max(5, Math.floor(player.troops * (attackPercent / 100)));
          if (player.troops >= troopsToSend && troopsToSend >= 5) {
            launchAttackWave(1, 0, chosen.source, chosen.target, troopsToSend);
          }
        }
      }

      // Cập nhật tên lửa đang bay (Flying Missiles)
      const finishedMissiles: number[] = [];
      data.flyingMissiles = data.flyingMissiles || [];
      data.flyingMissiles.forEach((m, idx) => {
        // Tiến trình m.progress được cập nhật mượt mà 60 FPS ở RAF render loop
        if (m.progress >= 1.0) {
          finishedMissiles.push(idx);

          // Xử lý nổ tên lửa khi tới mục tiêu
          const cfg = MISSILE_CONFIG[m.type];
          const targetTile = tiles[m.targetY]?.[m.targetX];
          if (!targetTile || targetTile.terrain === 'WATER') return;

          // Kiểm tra Phòng Không (SAM) cho Atom và Hydro (Cấp 3B Phòng Thủ tăng bán kính 6 và tỉ lệ 90%)
          let intercepted = false;
          if (m.type !== 'MIRV') {
            const ownerNation = data.nations[targetTile.owner];
            const hasTech3B = ownerNation?.techLevels?.defense === 3 && ownerNation?.techChoices?.defense === 'B';
            const samRadius = hasTech3B ? 6 : 5;
            const interceptChance = hasTech3B ? 0.90 : MISSILE_SETTINGS.SAM_INTERCEPT_CHANCE;
            for (let ady = -samRadius; ady <= samRadius; ady++) {
              for (let adx = -samRadius; adx <= samRadius; adx++) {
                const adtx = targetTile.x + adx;
                const adty = targetTile.y + ady;
                if (adtx >= 0 && adtx < size && adty >= 0 && adty < size) {
                  const adTile = tiles[adty][adtx];
                  if (adTile.owner === targetTile.owner && adTile.building === 'AIR_DEFENSE') {
                    if (Math.random() < interceptChance) {
                      intercepted = true;
                      break;
                    }
                  }
                }
              }
              if (intercepted) break;
            }
          }

          if (intercepted) {
            soundManager.playThunder();
            data.particles.push({
              x: targetTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: targetTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#10b981', size: 0, life: 45, maxLife: 45, vx: 0, vy: -0.8,
              type: 'FLOAT_TEXT',
              text: '🛡️ Tên lửa bị Phòng Không (SAM) bắn hạ!'
            });
            return;
          }

          // Hàm nổ vụ nổ hạt nhân chuẩn 4 bước: (1) Lưu chủ đất -> (2) Trừ quân -> (3) Xóa/Cập nhật chủ đất -> (4) Kích hoạt vẽ lại bản đồ
          const triggerExplosion = (cx: number, cy: number, radius: number, isMirvSub: boolean = false) => {
            soundManager.playThunder();

            // Bước 1: Lưu thông tin các ô và chủ đất (owner) của các ô bị ảnh hưởng TRƯỚC KHI bị xóa
            const affectedTiles: { tile: Tile; oldOwner: number }[] = [];
            const affectedNationIds = new Set<number>();

            for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
              for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
                const tx = cx + dx;
                const ty = cy + dy;
                if (tx >= 0 && tx < size && ty >= 0 && ty < size) {
                  const hitTile = tiles[ty][tx];
                  const dist = Math.hypot(dx, dy);
                  if (dist <= radius && hitTile.terrain !== 'WATER') {
                    affectedTiles.push({ tile: hitTile, oldOwner: hitTile.owner });
                    if (hitTile.owner > 0) {
                      affectedNationIds.add(hitTile.owner);
                    }
                  }
                }
              }
            }

            // Đảm bảo quốc gia bị nhắm mục tiêu (targetTile) nhận sát thương quân sự đầy đủ
            if (targetTile && targetTile.owner > 0) {
              affectedNationIds.add(targetTile.owner);
            }

            // Bước 2: Thực hiện trừ quân bị thiệt hại của các quốc gia bị trúng bom TRƯỚC KHI xóa chủ đất
            const troopLoss = m.type === 'HYDRO' ? 800 : m.type === 'MIRV' ? 200 : 350;
            affectedNationIds.forEach(nationId => {
              const hitNation = nations[nationId];
              if (hitNation && !hitNation.isEliminated) {
                hitNation.troops = Math.max(0, hitNation.troops - troopLoss);
              }
            });

            // Bước 3: Cập nhật trạng thái các ô bị nổ (xóa chủ đất thành 0, phá công trình, tạo đất cháy)
            affectedTiles.forEach(({ tile }) => {
              tile.building = 'NONE';
              tile.buildingLevel = 1;
              tile.owner = 0; // Trở thành đất hoang trung lập
              tile.scorchedTimer = 90; // Vùng nhiễm phóng xạ 90s
            });

            // Bước 4: Kích hoạt vẽ lại toàn bộ bản đồ ngay lập tức & Rung màn hình + SFX
            offscreenTerrainDirtyRef.current = true;
            offscreenTerritoryDirtyRef.current = true;
            screenShakeRef.current = { intensity: m.type === 'HYDRO' ? 18 : m.type === 'MIRV' ? 14 : 12, duration: 35 };
            soundManager.playNukeExplosion();

            // Hiệu ứng vụ nổ lan ra
            data.particles.push({
              x: cx * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: cy * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: cfg.color, size: 0, life: 60, maxLife: 60, vx: 0, vy: -1.0,
              type: 'FLOAT_TEXT',
              text: isMirvSub ? `💥 MIRV ĐẦU ĐẠN NỔ!` : `💥 VỤ NỔ ${cfg.name}!`
            });
          };

          if (m.type === 'MIRV') {
            // MIRV rải 12 đầu đạn con phân tán ngẫu nhiên trong bán kính
            triggerExplosion(targetTile.x, targetTile.y, cfg.radius, false);
            const subCount = cfg.mirvCount || 12;
            const spread = cfg.mirvSpreadRadius || 9.0;
            for (let s = 0; s < subCount; s++) {
              const angle = Math.random() * Math.PI * 2;
              const r = (0.3 + Math.random() * 0.7) * spread;
              const subX = Math.round(targetTile.x + Math.cos(angle) * r);
              const subY = Math.round(targetTile.y + Math.sin(angle) * r);
              if (subX >= 0 && subX < size && subY >= 0 && subY < size) {
                const subTile = tiles[subY][subX];
                if (subTile && subTile.terrain !== 'WATER') {
                  triggerExplosion(subTile.x, subTile.y, cfg.radius, true);
                }
              }
            }
          } else {
            triggerExplosion(targetTile.x, targetTile.y, cfg.radius, false);
          }

          // Đánh dấu redraw canvas sau vụ nổ
          offscreenTerrainDirtyRef.current = true;
          offscreenTerritoryDirtyRef.current = true;

          // Kiểm tra nếu quốc gia bị mất hết đất / bị loại
          nations.forEach(n => {
            if (n.id > 1 && !n.isEliminated) {
              let ownedCount = 0;
              for (let yy = 0; yy < size; yy++) {
                for (let xx = 0; xx < size; xx++) {
                  if (tiles[yy][xx].owner === n.id) ownedCount++;
                }
              }
              if (ownedCount === 0) {
                n.isEliminated = true;
              }
            }
          });
        }
      });
      data.flyingMissiles = data.flyingMissiles.filter((_, idx) => !finishedMissiles.includes(idx));

      // 6. Cập nhật Attack Waves & Va chạm Đại chiến Tà Thần
      updateAttackWaves(resolveAttackCapture, gameSpeed);

      // 7. Cập nhật particles (Floating text giảm nhanh hơn để biến mất sau ~1.5 - 2s)
      data.particles.forEach(p => {
        p.life -= (p.type === 'FLOAT_TEXT' ? 20 : 5);
        p.x += p.vx;
        p.y += p.vy;
      });
      data.particles = data.particles.filter(p => p.life > 0);

      // 8. Cập nhật HUD (Lỗi 1: Dùng totalLandCountRef thay flat() filter)
      const totalLand = totalLandCountRef.current || 1;
      const landPercent = totalLand > 0 ? Math.round((player.territoryCount / totalLand) * 100) : 0;

      setHudStats(prev => {
        const titanBuffTimer = player.titanBuffTimer || 0;
        if (
          prev.gold === player.gold &&
          prev.goldIncome === player.goldIncome &&
          prev.troops === player.troops &&
          prev.maxTroops === player.maxTroops &&
          prev.landPercent === landPercent &&
          prev.territoryCount === player.territoryCount &&
          prev.titanBuffTimer === titanBuffTimer
        ) {
          return prev;
        }
        return {
          gold: player.gold,
          goldIncome: player.goldIncome,
          troops: player.troops,
          maxTroops: player.maxTroops,
          landPercent,
          territoryCount: player.territoryCount,
          titanBuffTimer,
        };
      });

      // Cảnh báo sớm: Phát tiếng còi báo động Siren nếu có tên lửa nhắm tới lãnh thổ người chơi
      const myNationId = isMultiplayerRef.current ? myNationIdRef.current : 1;
      const incomingToPlayer = (data.flyingMissiles || []).filter(m => {
        const tgt = tiles[m.targetY]?.[m.targetX];
        return m.fromNation !== myNationId && tgt && tgt.owner === myNationId;
      });
      if (incomingToPlayer.length > 0 && data.gameTimeSeconds % 2 === 0) {
        soundManager.playWarningSiren();
      }

      // Trí Tuệ Nhân Tạo: Liên Minh Toàn Cầu (Coalition) tự động kích hoạt khi người chơi chiếm >= 50% bản đồ
      if (landPercent >= 50 && !coalitionFormedRef.current) {
        coalitionFormedRef.current = true;
        soundManager.playWarningSiren();
        data.nations.forEach(bot => {
          if (bot.id !== myNationId && !bot.isEliminated) {
            if (player.diplomacy[bot.id]) {
              player.diplomacy[bot.id] = { status: 'WAR', relation: -100, truceTimer: 0 };
            }
          }
        });
        data.events.unshift({
          id: Math.random().toString(),
          title: '⚔️ LIÊN MINH TOÀN CẦU CHỐNG ĐẾ QUỐC',
          description: `⚠️ Quốc gia của bạn chiếm ${landPercent}% thế giới! Các đại quốc gia đã lập Liên Minh Toàn Cầu (Coalition) cùng tuyên chiến với bạn!`,
          type: 'DIPLOMACY',
          targetNationId: myNationId,
          timestamp: formatGameTime(data.gameTimeSeconds),
        });
        data.particles.push({
          x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
          y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
          color: '#ef4444', size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.9,
          type: 'FLOAT_TEXT',
          text: '⚔️ BÁ CHỦ THẾ GIỚI: LIÊN MINH TOÀN CẦU TUYÊN CHIẾN!',
        });
      }

      // Mốc Thành Tựu (Achievements): 50 ô đất & 100 ô đất
      if (player.territoryCount >= 50 && !unlockedAchievementsRef.current.has('TILES_50')) {
        unlockedAchievementsRef.current.add('TILES_50');
        soundManager.playAchievement();
        data.events.unshift({
          id: Math.random().toString(),
          title: '🏆 MỐC THÀNH TỰU MỚI',
          description: '🏰 Khai Quốc Độc Lập: Đã mở rộng bờ cõi đạt mốc 50 lãnh thổ đất đai!',
          type: 'HARVEST',
          targetNationId: myNationId,
          timestamp: formatGameTime(data.gameTimeSeconds),
        });
        data.particles.push({
          x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
          y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
          color: '#38bdf8', size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.9,
          type: 'FLOAT_TEXT',
          text: '🏆 THÀNH TỰU: Khai Quốc Độc Lập (50 ô)!',
        });
      }

      if (player.territoryCount >= 100 && !unlockedAchievementsRef.current.has('TILES_100')) {
        unlockedAchievementsRef.current.add('TILES_100');
        soundManager.playAchievement();
        data.events.unshift({
          id: Math.random().toString(),
          title: '🏆 MỐC THÀNH TỰU MỚI',
          description: '👑 Bá Chủ Đại Lục: Đã mở rộng quy mô đế quốc vượt mốc 100 ô đất!',
          type: 'HARVEST',
          targetNationId: myNationId,
          timestamp: formatGameTime(data.gameTimeSeconds),
        });
        data.particles.push({
          x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
          y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
          color: '#fbbf24', size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.9,
          type: 'FLOAT_TEXT',
          text: '🏆 THÀNH TỰU: Bá Chủ Đại Lục (100 ô)!',
        });
      }

      if (currentQuest === 1 && player.territoryCount > 15) setCurrentQuest(2);
      if (currentQuest === 2 && player.territoryCount >= 25) setCurrentQuest(3);

      if (landPercent >= 70) {
        setGameState('VICTORY');
        soundManager.playVictory();
        if (!victoryAwardedRef.current) {
          victoryAwardedRef.current = true;
          const { reward, updatedProfile } = calculateVictoryReward(
            difficulty,
            gameModeRef.current,
            isMultiplayerRef.current,
            playerProfileRef.current
          );
          setPlayerProfile(updatedProfile);
          playerProfileRef.current = updatedProfile;
          savePlayerProfile(updatedProfile);
          if (auth.currentUser) {
            syncProfileToFirestore(auth.currentUser, updatedProfile).catch(console.error);
          }
          setVictoryReward(reward);
          if (reward.leveledUp) {
            soundManager.playGeneralHorn();
          }
        }
      } else if (player.territoryCount === 0 && player.troops <= 2) {
        setGameState('DEFEAT');
        soundManager.playDefeat();
      }

    }, intervalTime);

    return () => clearInterval(interval);
  }, [gameState, isPaused, gameSpeed, autoExpand, currentQuest, attackPercent, difficulty]);

  const {
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
  } = useAdminTools({
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
  });

  // Xử lý chạm trên bản đồ:
  // Luôn lập tức hiển thị bảng thông tin ô đất bên dưới.
  // Xóa hoàn toàn việc đi chiếm đất khi click lần 2 trên bản đồ!
  function quickAttackTile(tile: Tile): boolean {
    const data = gameDataRef.current;
    const player = data.nations[1];
    if (player.troops < 5) return false;

    // Điều kiện tấn công
    if (tile.owner === 1) return false;
    const status = player.diplomacy[tile.owner]?.status;
    if (tile.owner !== 0 && status !== 'WAR') return false;

    // Tìm nguồn quân gần nhất
    let bestSource: Tile | null = null;
    let minDistance = Infinity;
    const tiles = data.tiles;
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles.length; x++) {
        const t = tiles[y][x];
        if (t.owner === 1) {
          const dist = Math.hypot(t.x - tile.x, t.y - tile.y);
          if (dist < minDistance) {
            minDistance = dist;
            bestSource = t;
          }
        }
      }
    }

    if (bestSource) {
      // Logic attack: check adjacency or port
      const neighborTiles = [
        [tile.x + 1, tile.y], [tile.x - 1, tile.y],
        [tile.x, tile.y + 1], [tile.x, tile.y - 1]
      ];
      const isAdjacent = neighborTiles.some(([nx, ny]) => tiles[ny]?.[nx]?.owner === 1);
      
      if (!isAdjacent && (!player.hasPort || !tile.hasHarborAccess)) return false;

      const troopsToSend = Math.max(5, Math.floor(player.troops * (attackPercent / 100)));
      launchAttackWave(1, tile.owner, bestSource, tile, troopsToSend);
      return true;
    }
    return false;
  }

  function smartAttackTile(tile: Tile): boolean {
    const data = gameDataRef.current;
    const tiles = data.tiles;
    const player = data.nations[1];
    const size = tiles.length;
    const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
    const say = (text: string) => {
      data.particles.push({ x: tile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2, y: tile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2, color: '#f87171', size: 0, life: 55, maxLife: 55, vx: 0, vy: -0.7, type: 'FLOAT_TEXT', text });
    };
    if (tile.owner === 1 || tile.terrain === 'WATER') return false;
    if (player.troops < 5) { say('Không đủ quân (cần ít nhất 5)'); return false; }
    if (tile.owner !== 0 && player.diplomacy[tile.owner]?.status !== 'WAR') { say('Chưa tuyên chiến với nước này'); return false; }
    let launch: Tile | null = null;
    let best = Infinity;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = tiles[y][x];
        if (t.owner !== tile.owner || t.terrain === 'WATER') continue;
        if (!DIRS.some(([dx, dy]) => tiles[y + dy]?.[x + dx]?.owner === 1)) continue;
        const d = Math.hypot(x - tile.x, y - tile.y);
        if (d < best) { best = d; launch = t; }
      }
    }
    if (launch && tile.owner === 0 && best > 12) launch = null;
    if (!launch) {
      if (player.hasPort && tile.hasHarborAccess) launch = tile;
      else { say(tile.owner === 0 ? 'Đất hoang quá xa biên giới' : 'Chưa giáp biên giới (cần cảng để đánh qua biển)'); return false; }
    }
    let source: Tile | null = null;
    for (const [dx, dy] of DIRS) {
      const t = tiles[launch.y + dy]?.[launch.x + dx];
      if (t && t.owner === 1) { source = t; break; }
    }
    if (!source) {
      let md = Infinity;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (tiles[y][x].owner === 1) {
            const d = Math.hypot(x - launch.x, y - launch.y);
            if (d < md) { md = d; source = tiles[y][x]; }
          }
        }
      }
    }
    if (!source) return false;
    const troopsToSend = Math.max(5, Math.floor(player.troops * (attackPercent / 100)));
    launchAttackWave(1, tile.owner, source, launch, troopsToSend);
    const w = data.attackWaves[data.attackWaves.length - 1];
    if (w && w.fromNation === 1 && w.targetX === launch.x && w.targetY === launch.y) { w.focusX = tile.x; w.focusY = tile.y; }
    return true;
  }

  handleMapTapRef.current = (mapX: number, mapY: number, screenX: number, screenY: number) => {
    tapRipplesRef.current.push({
      x: mapX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      y: mapY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
      startTime: performance.now()
    });

    const data = gameDataRef.current;
    const { tiles, nations } = data;
    const targetTile = tiles[mapY]?.[mapX];
    if (!targetTile) return;

    // Double tap attack
    const now = Date.now();
    const last = lastTapRef.current;
    const isDouble = (now - last.time < 500) && Math.max(Math.abs(last.x - mapX), Math.abs(last.y - mapY)) <= 2;
    if (isDouble && targetTile.owner !== 1 && targetTile.terrain !== 'WATER' && !missileAimingModeRef.current) {
      if (smartAttackTile(targetTile)) {
        setSelectedTile(null);
        selectedTileRef.current = null;
        lastTapRef.current = { x: -1, y: -1, time: 0 };
        return;
      }
    }
    lastTapRef.current = { x: mapX, y: mapY, time: now };

    // Kiểm tra cướp bóc Tàu Buôn Hải Cảng nếu chạm vào vị trí tàu đang giăng buồm trên biển
    if (lootTradeShip(mapX, mapY)) {
      return;
    }

    // Nếu đang ở chế độ ngắm bắn tên lửa
    const aimingType = missileAimingModeRef.current;
    if (aimingType) {
      const cfg = MISSILE_CONFIG[aimingType];
      const player = nations[1];

      // 1. Kiểm tra đủ vàng không
      if (player.gold < cfg.cost) {
        showMissileToast(`Thiếu ${formatPopulation(cfg.cost - player.gold)} Vàng để phóng ${cfg.name}!`);
        return;
      }

      // 2. Kiểm tra ô mục tiêu có phải là nước hoặc đất của mình không
      if (targetTile.terrain === 'WATER') {
        showMissileToast('Không thể phóng tên lửa xuống biển!');
        return;
      }
      if (targetTile.owner === 1) {
        showMissileToast('Không thể phóng tên lửa vào lãnh thổ của chính mình!');
        return;
      }

      // 3. Tìm bệ phóng (Silo) sẵn sàng gần mục tiêu nhất của người chơi
      let bestSilo: Tile | null = null;
      let minSiloDist = 999999;
      for (let y = 0; y < tiles.length; y++) {
        for (let x = 0; x < tiles.length; x++) {
          const t = tiles[y][x];
          if (t.owner === 1 && t.building === 'MISSILE_SILO' && (!t.missileCooldown || t.missileCooldown <= 0)) {
            const dist = Math.hypot(t.x - targetTile.x, t.y - targetTile.y);
            if (dist < minSiloDist) {
              minSiloDist = dist;
              bestSilo = t;
            }
          }
        }
      }

      if (!bestSilo) {
        showMissileToast('Không có Bệ Phóng (Silo) nào sẵn sàng hoặc tất cả đang hồi chiêu!');
        return;
      }

      // 4. Đúng điều kiện: Trừ vàng, đặt hồi chiêu bệ phóng, tạo tên lửa bay
      player.gold -= cfg.cost;
      bestSilo.missileCooldown = MISSILE_SETTINGS.COOLDOWN_SECONDS;

      data.flyingMissiles = data.flyingMissiles || [];
      data.flyingMissiles.push({
        id: Math.random().toString(),
        type: aimingType,
        sourceX: bestSilo.x,
        sourceY: bestSilo.y,
        targetX: targetTile.x,
        targetY: targetTile.y,
        progress: 0,
        speed: 1 / (MISSILE_SETTINGS.DEFAULT_FLIGHT_DURATION_SECONDS || 8),
        fromNation: 1,
      });

      // Thoát chế độ ngắm bắn
      setMissileAimingMode(null);
      missileAimingModeRef.current = null;
      soundManager.playThunder();
      showMissileToast(`🚀 Đã khai hỏa ${cfg.name} hướng tới tọa độ (${targetTile.x}, ${targetTile.y})!`);
      return;
    }

    if (targetTile.terrain === 'WATER') {
      setSelectedTile(null);
      selectedTileRef.current = null;
      return;
    }

    setSelectedTile(targetTile);
    selectedTileRef.current = targetTile;
    soundManager.playClick();
  };

  // Xuất đợt tấn công OpenFront
  const launchAttackWave = (
    from: number, 
    to: number, 
    source: Tile, 
    target: Tile, 
    troops: number,
    customQueue?: { x: number; y: number }[]
  ) => {
    const data = gameDataRef.current;
    const attacker = data.nations[from];
    if (attacker.troops < troops) return;

    // Ngăn chặn hoàn toàn việc tấn công Đồng Minh Sắt Son hoặc nước đang Đình Chiến
    if (to > 0 && attacker.diplomacy) {
      const dip = attacker.diplomacy[to]?.status;
      if (dip === 'ALLIANCE') {
        if (from === 1) {
          data.particles.push({
            x: target.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: target.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#10b981', size: 0, life: 45, maxLife: 45, vx: 0, vy: -0.7,
            type: 'FLOAT_TEXT', text: '🤝 Không thể tấn công Đồng Minh Sắt Son!'
          });
        }
        return;
      }
      if (dip === 'TRUCE') {
        if (from === 1) {
          const rem = Math.ceil(attacker.diplomacy[to]?.truceTimer || 45);
          data.particles.push({
            x: target.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: target.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#38bdf8', size: 0, life: 45, maxLife: 45, vx: 0, vy: -0.7,
            type: 'FLOAT_TEXT', text: `🕊️ Đang trong Hiệp Ước Đình Chiến (${rem}s)!`
          });
        }
        return;
      }
    }

    attacker.troops -= troops;
    data.stats.battlesCount += 1;

    // Nếu đang trong phòng nhiều người và đợt quân do chính người chơi phát động hoặc do Host AI phát động -> gửi qua WebSocket
    if (isMultiplayerRef.current && (from === myNationIdRef.current || (myNationIdRef.current === 1 && from > 1))) {
      multiplayerClient.sendAttack(from, to, source.x, source.y, target.x, target.y, troops);
    }

    const waveId = Math.random().toString();

    // Tướng xuất chiến dẫn dắt đợt quân (Tướng chiếm 30% sức mạnh - yêu cầu >= 60% HP)
    let hasGeneral = false;
    if (attacker.general && canDeployGeneral(attacker.general)) {
      if ((from === 1 && playerGeneralDeployMode) || (from > 1 && (attacker.tier === 'BOSS' || troops >= 10))) {
        hasGeneral = true;
        attacker.general.status = 'MARCHING';
        attacker.general.marchingWaveId = waveId;
        attacker.general.x = source.x;
        attacker.general.y = source.y;
        if (from === 1) {
          soundManager.playGeneralHorn();
        }
      }
    }

    const queue: { x: number; y: number }[] = customQueue && customQueue.length > 0 
      ? customQueue 
      : [{ x: target.x, y: target.y }];

    if (!customQueue) {
      const neighbors = [
        { x: target.x + 1, y: target.y },
        { x: target.x - 1, y: target.y },
        { x: target.x, y: target.y + 1 },
        { x: target.x, y: target.y - 1 },
      ];
      neighbors.forEach(n => {
        if (n.x >= 0 && n.x < data.tiles.length && n.y >= 0 && n.y < data.tiles.length) {
          const nbTile = data.tiles[n.y][n.x];
          if (nbTile.terrain !== 'WATER' && nbTile.owner !== from) {
            const nbDip = nbTile.owner > 0 && attacker.diplomacy ? attacker.diplomacy[nbTile.owner]?.status : 'WAR';
            if (nbDip !== 'ALLIANCE' && nbDip !== 'TRUCE') {
              queue.push(n);
            }
          }
        }
      });
    }

    // Tính năng 1: Phòng Tuyến Chiến Hào & Tiếp Tế (+20% tốc độ hành quân nội địa/chiến hào)
    const isSupplyRoute = source.owner === from && (target.owner === from || source.building !== 'NONE' || target.building !== 'NONE');
    const waveSpeed = isSupplyRoute ? 0.46 : 0.38;

    data.attackWaves.push({
      id: waveId,
      fromNation: from,
      toNation: to,
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      troops,
      progress: Math.hypot(source.x - target.x, source.y - target.y) <= 1.5 ? 0.97 : 0,
      speed: waveSpeed,
      hasGeneral,
      targetsQueue: queue,
      focusX: target.x,
      focusY: target.y,
    });

    if ((from === 1 || from === myNationIdRef.current) && !hasGeneral) soundManager.playAttack();
  };

  // Lắng nghe các sự kiện hành động nhiều người chơi theo thời gian thực
  useEffect(() => {
    if (!isMultiplayer) return;

    multiplayerClient.onActionAttack = (action) => {
      const data = gameDataRef.current;
      const src = data.tiles[action.sourceY]?.[action.sourceX];
      const tgt = data.tiles[action.targetY]?.[action.targetX];
      if (src && tgt) {
        launchAttackWave(action.fromNation, action.toNation, src, tgt, action.troops);
      }
    };

    multiplayerClient.onActionBuild = (action) => {
      const data = gameDataRef.current;
      const tgt = data.tiles[action.targetY]?.[action.targetX];
      if (tgt) {
        tgt.building = action.buildingType;
        tgt.buildingLevel = (tgt.buildingLevel || 1) + (action.count || 1);
        offscreenTerritoryDirtyRef.current = true;
        fogBaseDirtyRef.current = true;
        dirtyTerritoryTilesRef.current.push({ x: tgt.x, y: tgt.y });
      }
    };

    multiplayerClient.onStateSync = (syncData) => {
      if (myNationIdRef.current === 1) return; // Host has authoritative state
      const data = gameDataRef.current;
      if (!data || !data.nations) return;

      syncData.nations.forEach(nSync => {
        const n = data.nations[nSync.id];
        if (n) {
          n.gold = nSync.gold;
          n.goldIncome = nSync.goldIncome;
          n.troops = nSync.troops;
          n.maxTroops = nSync.maxTroops;
          n.population = nSync.population;
          n.territoryCount = nSync.territoryCount;
          n.isEliminated = nSync.isEliminated;
        }
      });

      if (syncData.darkTitans && data.darkTitans) {
        data.darkTitans = syncData.darkTitans;
      }
      if (typeof syncData.gameTimeSeconds === 'number') {
        data.gameTimeSeconds = syncData.gameTimeSeconds;
      }
      refreshHudStats();
    };

    multiplayerClient.onRoomUpdated = (updatedRoom) => {
      setMultiplayerRoom(updatedRoom);
    };

    multiplayerClient.onConnectionChange = (connected) => {
      if (!connected) {
        setMultiplayerBanner('⚠️ Mất kết nối tới máy chủ phòng. Đang tự động kết nối lại...');
      } else {
        setMultiplayerBanner('Đã kết nối lại thành công!');
        setTimeout(() => setMultiplayerBanner(null), 3000);
      }
    };

    multiplayerClient.onPlayerDisconnected = (info) => {
      setMultiplayerBanner(info.message);
      setTimeout(() => setMultiplayerBanner(null), 6000);
    };

    return () => {
      multiplayerClient.onActionAttack = null;
      multiplayerClient.onActionBuild = null;
      multiplayerClient.onStateSync = null;
      multiplayerClient.onRoomUpdated = null;
      multiplayerClient.onConnectionChange = null;
      multiplayerClient.onPlayerDisconnected = null;
    };
  }, [isMultiplayer]);

  // Giải quyết đợt tấn công
  const resolveAttackCapture = (wave: AttackWave, depth: number = 0) => {
    let continued = false;
    const data = gameDataRef.current;
    const tgt = data.tiles[wave.targetY]?.[wave.targetX];
    if (!tgt) return;

    const attacker = data.nations[wave.fromNation];
    const defender = data.nations[tgt.owner];

    let cost = tgt.terrain === 'MOUNTAIN' ? 12 : 5;
    if (tgt.building === 'FORTRESS') {
      cost = 18 + ((tgt.buildingLevel || 1) - 1) * 8;
    }

    if (tgt.scorchedTimer && tgt.scorchedTimer > 0) {
      cost += 5;
    }

    // Kiểm tra kỹ năng "Đột Kích Bóng Đêm" của Đại Tướng Dạ Ảnh (bỏ qua phòng thủ địch, tốn ít hơn 50% quân)
    const attackerHasShadowRaid = attacker?.general?.skillId === 'SHADOW_RAID' && (attacker.general.skillActiveTimer || 0) > 0;

    // Hiệu ứng Pháo Đài (FORTRESS) xung quanh trong bán kính 4 ô (Bỏ qua nếu kẻ địch có Đột Kích Bóng Đêm)
    if (!attackerHasShadowRaid && tgt.owner > 0) {
      const fortressBonuses: number[] = [];
      const size = data.tiles.length;
      const fortressRadius = 4.0;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const ft = data.tiles[y][x];
          if (ft && ft.owner === tgt.owner && ft.building === 'FORTRESS') {
            const dist = Math.hypot(ft.x - tgt.x, ft.y - tgt.y);
            if (dist <= fortressRadius) {
              const fLvl = ft.buildingLevel || 1;
              fortressBonuses.push(0.20 * fLvl);
            }
          }
        }
      }

      if (fortressBonuses.length > 0) {
        fortressBonuses.sort((a, b) => b - a);
        let totalMultiplier = 1.0;
        let currentWeight = 1.0;
        for (let i = 0; i < fortressBonuses.length; i++) {
          totalMultiplier += fortressBonuses[i] * currentWeight;
          currentWeight *= 0.5;
        }
        cost = Math.round(cost * totalMultiplier);
      }
    }

    // Công nghệ quân sự cấp 3A: Giảm 20% thủ Núi khi tiến công (chỉ khi chọn A)
    if (attacker?.techLevels?.military === 3 && attacker?.techChoices?.military === 'A' && tgt.terrain === 'MOUNTAIN') {
      cost = Math.max(3, Math.round(cost * 0.80));
    }

    // Công nghệ quân sự cấp 2 (-8% quân) & cấp 3A (giảm thêm 5% quân chiếm ô)
    if (attacker?.techLevels?.military >= 2) {
      let milCostMult = 0.92;
      if (attacker.techLevels.military === 3 && attacker.techChoices?.military === 'A') {
        milCostMult *= 0.95;
      }
      cost = Math.max(1, Math.round(cost * milCostMult));
    }

    // Đặc tính phòng thủ của Thuộc địa Bộ Lạc (+50% tổn thất cho kẻ tấn công)
    if (!attackerHasShadowRaid && defender?.colonyCategory === 'TRIBE') {
      cost = Math.round(cost * 1.5);
    }

    // Tướng phòng thủ có mặt giúp tăng 30% thủ
    if (!attackerHasShadowRaid && defender?.general && defender.general.status === 'MARCHING') {
      cost = Math.round(cost * 1.3);
    }

    // Công nghệ phòng thủ: Level 1 (+10%), Level 2 (+18%), Level 3A (+25%), Level 3B (+18%)
    if (!attackerHasShadowRaid && defender && defender.techLevels?.defense >= 1) {
      const defLvl = defender.techLevels.defense;
      const defChoice = defender.techChoices?.defense;
      const defMult = (defLvl === 3 && defChoice === 'A') ? 1.25 : (defLvl >= 2) ? 1.18 : 1.10;
      cost = Math.round(cost * defMult);
    }
    if (defender && tgt.owner > 0) {
      const cache = tileCountCacheRef.current;
      if (cache.t !== data.gameTimeSeconds) {
        const counts: number[] = [];
        for (const row of data.tiles) for (const t of row) counts[t.owner] = (counts[t.owner] || 0) + 1;
        cache.t = data.gameTimeSeconds; cache.counts = counts;
      }
      const density = defender.troops / Math.max(1, cache.counts[tgt.owner] || 1);
      cost = Math.round(cost * Math.min(3, Math.max(0.7, 0.7 + density / 10)));
    }

    // Kỹ năng 3: "Khiên Sắt Biên Giới" của Đại Tướng Thiết Bích (+40% phòng thủ ô biên giới, Boss +50%)
    if (!attackerHasShadowRaid && defender?.general?.skillId === 'IRON_BORDER_SHIELD' && (defender.general.skillActiveTimer || 0) > 0 && tgt.isBorder) {
      const defPower = getSkillPower(defender);
      cost = Math.round(cost * (1.0 + 0.40 * defPower));
    }

    // Tướng tiến công (hasGeneral) chiếm 30% sức mạnh -> giảm 30% chi phí chiếm ô!
    if (wave.hasGeneral) {
      cost = Math.max(2, Math.floor(cost * 0.70));
    }

    // Kỹ năng 5: "Đột Kích Bóng Đêm" của Đại Tướng Dạ Ảnh: chiếm ô tốn ít hơn 50% quân (Boss 62.5%)
    if (attackerHasShadowRaid) {
      const atkPower = getSkillPower(attacker);
      const discount = 0.50 * atkPower;
      cost = Math.max(1, Math.floor(cost * (1.0 - discount)));
    }

    if (wave.troops >= cost) {
      wave.troops -= cost;
      const prevOwner = tgt.owner;
      tgt.owner = wave.fromNation;
      tgt.building = 'NONE';
      tgt.buildingLevel = 1;
      if (defender && prevOwner > 0) defender.troops = Math.max(0, defender.troops - Math.round(cost * 0.5));
      offscreenTerritoryDirtyRef.current = true;
      fogBaseDirtyRef.current = true;
      dirtyTerritoryTilesRef.current.push({ x: tgt.x, y: tgt.y });
      
      captureFlashRef.current.push({
        x: tgt.x,
        y: tgt.y,
        color: attacker.color,
        startTime: performance.now()
      });
      if (captureFlashRef.current.length > 150) captureFlashRef.current.shift();

      // Công nghệ kinh tế cấp 3A: Thưởng +20 vàng khi chiếm ô đất
      if (attacker && attacker.techLevels?.economy === 3 && attacker.techChoices?.economy === 'A') {
        attacker.gold += 20;
      }

      if (cost >= 15 || wave.troops >= 25) {
        tgt.scorchedTimer = 30;
      }

      // Thu hoạch tài nguyên & dân số đặc thù từng loại Thuộc địa khi chiếm đóng
      if (defender && prevOwner > 0) {
        if (defender.colonyCategory === 'FOREST') {
          attacker.gold += 100;
          attacker.population += 15;
        } else if (defender.colonyCategory === 'TRIBE') {
          attacker.gold += 50;
          attacker.population += 10;
        } else if (defender.colonyCategory === 'ETHNIC') {
          attacker.gold += 80;
          attacker.population += 20;
        }
      }

      // Xử lý sát thương & sinh tồn của Đại Tướng theo General System 1.1
      if (wave.hasGeneral && attacker.general) {
        const rawDmg = Math.min(220, Math.max(25, Math.round(cost * 0.75)));
        const res = applyGeneralDamage(attacker.general, attacker, rawDmg);

        data.particles.push({
          x: tgt.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          y: tgt.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
          color: '#ef4444', size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.5,
          type: 'FLOAT_TEXT',
          text: `🛡️ -${res.damageTaken} HP`
        });

        if (res.injured) {
          wave.hasGeneral = false;
          if (attacker.isPlayer) {
            data.particles.push({
              x: attacker.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: attacker.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#f87171', size: 0, life: 50, maxLife: 50, vx: 0, vy: -0.8,
              type: 'FLOAT_TEXT',
              text: `🚨 ${attacker.general.name} bị trọng thương (HP: 0)! Rút về thủ đô.`
            });
          }
        } else if (res.retreated) {
          wave.hasGeneral = false;
          if (attacker.isPlayer) {
            data.particles.push({
              x: attacker.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: attacker.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#fbbf24', size: 0, life: 50, maxLife: 50, vx: 0, vy: -0.8,
              type: 'FLOAT_TEXT',
              text: `⚠️ ${attacker.general.name} còn <= 20% HP, đã rút lui an toàn!`
            });
          }
        }
      }

      // Nếu tướng địch đang đồn trú hoặc xuất trận tại ô bị tấn công, nhận sát thương phản kích
      if (defender?.general && (defender.general.status === 'MARCHING' || (tgt.x === defender.capitalX && tgt.y === defender.capitalY))) {
        const defRawDmg = Math.min(200, Math.max(30, Math.round((attacker.general?.attack || 90) * 0.8)));
        applyGeneralDamage(defender.general, defender, defRawDmg);
      }

      if (wave.fromNation === 1) {
        soundManager.playCapture();
      }

      if (wave.targetsQueue && (attacker.isPlayer || wave.troops >= 5)) {
        if (data.attackWaves.length < 60 || attacker.isPlayer) {
          const limit = attacker.isPlayer ? 80 : (attacker.tier === 'BOSS' ? 60 : 30);
          const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
          const fx = wave.focusX ?? tgt.x;
          const fy = wave.focusY ?? tgt.y;
          const size2 = data.tiles.length;
          // điểm càng thấp càng được ưu tiên: nhiều đất mình bao quanh (lan tròn, lấp đầy), gần điểm chạm
          const score = (x: number, y: number) => {
            let own = 0;
            for (const [dx, dy] of DIRS) {
              const t = data.tiles[y + dy]?.[x + dx];
              if (t && t.owner === wave.fromNation) own++;
            }
            return 0.3 * Math.hypot(x - fx, y - fy) - 1.5 * own + Math.random() * 0.6;
          };
          const blocked = (owner: number) => {
            if (owner > 0) {
              const st = attacker.diplomacy?.[owner]?.status;
              return st === 'ALLIANCE' || st === 'TRUCE';
            }
            return false;
          };
          const canHit = (t: Tile | undefined) =>
            !!t && t.terrain !== 'WATER' && t.owner !== wave.fromNation && t.owner === wave.toNation && !blocked(t.owner);

          wave.targetsQueue = wave.targetsQueue.filter(q => !(q.x === tgt.x && q.y === tgt.y));
          for (const [dx, dy] of DIRS) {
            const nx = tgt.x + dx, ny = tgt.y + dy;
            if (!canHit(data.tiles[ny]?.[nx])) continue;
            if (wave.targetsQueue.some(q => q.x === nx && q.y === ny)) continue;
            if (wave.targetsQueue.length >= limit) {
              let worst = -1, worstScore = -Infinity;
              wave.targetsQueue.forEach((q, i) => {
                const s = score(q.x, q.y);
                if (s > worstScore) { worstScore = s; worst = i; }
              });
              if (worst >= 0 && score(nx, ny) < worstScore) wave.targetsQueue[worst] = { x: nx, y: ny };
              continue;
            }
            wave.targetsQueue.push({ x: nx, y: ny });
          }
          const pickBest = () => {
            let idx = -1, best = Infinity;
            wave.targetsQueue!.forEach((q, i) => {
              if (!canHit(data.tiles[q.y]?.[q.x])) return;
              const s = score(q.x, q.y);
              if (s < best) { best = s; idx = i; }
            });
            return idx;
          };
          let bestIdx = pickBest();

          // QUÂN TỰ ĐÁNH CÁC VÙNG KHÁC CỦA ĐỊCH: hết ô kề thì quét cả bản đồ tìm mọi ô của đúng nước địch đang giáp đất mình
          if (bestIdx < 0 && wave.toNation > 0 && !blocked(wave.toNation)) {
            const found: { x: number; y: number }[] = [];
            for (let yy = 0; yy < size2; yy++) {
              for (let xx = 0; xx < size2; xx++) {
                if (!canHit(data.tiles[yy][xx])) continue;
                let touch = false;
                for (const [dx, dy] of DIRS) {
                  if (data.tiles[yy + dy]?.[xx + dx]?.owner === wave.fromNation) { touch = true; break; }
                }
                if (touch) found.push({ x: xx, y: yy });
              }
            }
            found.sort((a, b) => score(a.x, a.y) - score(b.x, b.y));
            wave.targetsQueue = found.slice(0, limit);
            bestIdx = pickBest();
          }

          if (bestIdx >= 0) {
            const next = wave.targetsQueue[bestIdx];
            let src = { x: tgt.x, y: tgt.y };
            for (const [dx, dy] of DIRS) {
              const t = data.tiles[next.y + dy]?.[next.x + dx];
              if (t && t.owner === wave.fromNation) { src = { x: t.x, y: t.y }; break; }
            }
            const playerSkillBonuses = attacker.isPlayer ? getSkillTreeBonuses(playerProfileRef.current.skillTree) : null;
            wave.speed = attacker.isPlayer ? (1.1 * (playerSkillBonuses?.marchSpeedMult || 1.0)) : (attacker.tier === 'BOSS' ? 0.9 : 0.7);
            wave.sourceX = src.x;
            wave.sourceY = src.y;
            wave.targetX = next.x;
            wave.targetY = next.y;
            wave.progress = 0;
            const burst = attacker.isPlayer ? (12 + (playerSkillBonuses?.burstCaptureBonus || 0)) : (attacker.tier === 'BOSS' ? 6 : 3);
            continued = true;
            if (depth + 1 < burst && wave.troops > 0) {
              resolveAttackCapture(wave, depth + 1);
            } else {
              data.attackWaves.push(wave);
            }
          }
        }
      }
    } else {
      // Đợt công không đủ quân vượt qua phòng thủ: Đại Tướng nhận sát thương từ phòng tuyến địch
      if (wave.hasGeneral && attacker.general) {
        const repelledDmg = Math.min(250, Math.max(30, Math.round(cost * 0.85)));
        const res = applyGeneralDamage(attacker.general, attacker, repelledDmg);
        if (res.retreated || res.injured) {
          wave.hasGeneral = false;
        }
      }
    }
    if (!continued && wave.troops > 0) {
      attacker.troops += wave.troops; // quân còn dư quay về nhà
      wave.troops = 0;
    }
    offscreenTerritoryDirtyRef.current = true;
  };

  // Pointer Handlers provided by useMapCamera hook

  // Xây dựng công trình gộp & xây chồng tăng cấp (Building Stacking & Level Up)
  const executeBuild = (targetTile: Tile | null, buildingType: BuildingType, count: number = 1) => {
    if (buildingType === 'NONE') return;
    const data = gameDataRef.current;
    const myNation = myNationIdRef.current || 1;
    const player = data.nations[myNation];
    if (!player) return;

    const baseCost = BUILDING_INFO[buildingType as Exclude<BuildingType, 'NONE'>].baseCost;
    // Giảm chi phí xây dựng: Kinh tế Cấp 2 (0.92) và Cấp 3B Thợ Xây (giảm thêm 20%: 0.92 * 0.80 = 0.736)
    let discount = 1.0;
    if (player.techLevels?.economy >= 2) discount *= 0.92;
    if (player.techLevels?.economy === 3 && player.techChoices?.economy === 'B') discount *= 0.80;
    const isPort = buildingType === 'PORT';

    const size = data.tiles.length;
    const eligibleTiles: Tile[] = [];

    // 1. Ưu tiên ô đang chọn nếu thuộc sở hữu người chơi
    if (targetTile && targetTile.owner === myNation) {
      if (!isPort || targetTile.hasHarborAccess) {
        eligibleTiles.push(targetTile);
      }
    }

    // 2. Quét các ô đất thuộc sở hữu người chơi
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = data.tiles[y][x];
        if (t.owner === myNation && t !== targetTile) {
          if (!isPort || t.hasHarborAccess) {
            eligibleTiles.push(t);
          }
        }
      }
    }

    if (eligibleTiles.length === 0) {
      data.particles.push({
        x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
        y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
        color: '#ef4444', size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
        type: 'FLOAT_TEXT', text: isPort ? 'Không có ô giáp biển thuộc sở hữu!' : 'Không có ô đất thuộc sở hữu!'
      });
      return;
    }

    // Sắp xếp ưu tiên: ô đang chọn -> ô đã có cùng loại công trình (để xây chồng) -> ô trống
    eligibleTiles.sort((a, b) => {
      if (a === targetTile) return -1;
      if (b === targetTile) return 1;
      if (a.building === buildingType && b.building !== buildingType) return -1;
      if (a.building !== buildingType && b.building === buildingType) return 1;
      if (a.building === 'NONE' && b.building !== 'NONE') return -1;
      if (a.building !== 'NONE' && b.building === 'NONE') return 1;
      return 0;
    });

    // Tính tổng cấp độ công trình loại này hiện có
    let currentExistingCount = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data.tiles[y][x].owner === 1 && data.tiles[y][x].building === buildingType) {
          currentExistingCount += (data.tiles[y][x].buildingLevel || 1);
        }
      }
    }

    let totalCost = 0;
    let actualBuiltCount = 0;

    for (let i = 0; i < count; i++) {
      const singleCost = Math.floor(baseCost * Math.pow(1.15, currentExistingCount + i) * discount);
      if (player.gold >= totalCost + singleCost) {
        totalCost += singleCost;
        actualBuiltCount++;
      } else {
        break;
      }
    }

    if (actualBuiltCount === 0) {
      data.particles.push({
        x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
        y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
        color: '#ef4444', size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
        type: 'FLOAT_TEXT', text: 'Không đủ Vàng để xây / nâng cấp!'
      });
      return;
    }

    // Trừ vàng
    player.gold -= totalCost;

    // Phân bổ xây mới hoặc xây chồng tăng cấp
    let remainingToPlace = actualBuiltCount;
    for (let i = 0; i < eligibleTiles.length && remainingToPlace > 0; i++) {
      const t = eligibleTiles[i];
      if (t.building === buildingType) {
        // Tăng cấp xây chồng công trình
        const stacksToAdd = remainingToPlace;
        t.buildingLevel = (t.buildingLevel || 1) + stacksToAdd;
        remainingToPlace = 0;
      } else {
        // Đặt công trình mới
        t.building = buildingType;
        t.buildingLevel = 1;
        remainingToPlace--;

        if (remainingToPlace > 0 && t === targetTile) {
          t.buildingLevel += remainingToPlace;
          remainingToPlace = 0;
        }
      }
      if (isPort) player.hasPort = true;
    }

    data.stats.buildingsCount += actualBuiltCount;
    soundManager.playBuild();
    setIsBuildOpen(false);
    offscreenTerritoryDirtyRef.current = true;

    // Gửi thông báo xây dựng qua WebSocket cho các người chơi khác
    if (isMultiplayerRef.current && (targetTile || eligibleTiles[0])) {
      const builtOn = targetTile || eligibleTiles[0];
      multiplayerClient.sendBuild(builtOn.x, builtOn.y, buildingType, actualBuiltCount);
    }

    if (targetTile) {
      const targetLvl = targetTile.buildingLevel || 1;
      setSelectedTile({ ...targetTile, buildingLevel: targetLvl });
      selectedTileRef.current = { ...targetTile, buildingLevel: targetLvl };

      data.particles.push({
        x: targetTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        y: targetTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
        color: '#fbbf24', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.7,
        type: 'FLOAT_TEXT',
        text: `🏢 +x${actualBuiltCount} ${BUILDING_INFO[buildingType as Exclude<BuildingType, 'NONE'>].name} (Cấp ${targetLvl})!`
      });
    }

    if (currentQuest === 3 && buildingType === 'CITY') {
      setCurrentQuest(4);
    }
  };

  const canBuild = hudStats.gold >= 90;
  const canTech = hudStats.territoryCount >= 15;

  // Tính số quân thực tế sẽ xuất trận theo Thanh trượt Slider
  const actualAttackTroops = Math.max(1, Math.floor((hudStats.troops * attackPercent) / 100));

  return (
    <div className="flex flex-col h-full h-dvh h-[100dvh] w-full max-w-full overflow-hidden bg-slate-950 text-slate-100 select-none font-sans">
      {/* THÔNG BÁO CHƠI OFFLINE KHI MẤT MẠNG */}
      <OfflineIndicator />
      
      {/* 1. MÀN HÌNH BẮT ĐẦU VỚI TỔ HỢP TITLE MENU MỚI */}
      {gameState === 'TITLE' && (
        <TitleMenu
          currentUser={currentUser}
          playerProfile={playerProfile}
          playerName={playerName}
          setPlayerName={setPlayerName}
          mapSize={mapSize}
          setMapSize={setMapSize}
          gameMode={gameMode}
          setGameMode={setGameMode}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          savedGameInfo={savedGameInfo}
          loadGame={loadGame}
          startNewGame={startNewGame}
          setShowConfirmNewGame={setShowConfirmNewGame}
          setIsAuthModalOpen={setIsAuthModalOpen}
          setIsAdminPanelOpen={setIsAdminPanelOpen}
          setIsGeneralSelectOpen={setIsGeneralSelectOpen}
          setIsSkillTreeOpen={setIsSkillTreeOpen}
          setIsTechOpen={setIsTechOpen}
          setIsMultiplayerModalOpen={setIsMultiplayerModalOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          isUserAdmin={isUserAdmin}
          fbSignOut={fbSignOut}
          auth={auth}
          soundManager={soundManager}
        />
      )}

      {/* 2. MÀN HÌNH CHƠI CHÍNH */}
      {(gameState === 'PLAYING' || gameState === 'VICTORY' || gameState === 'DEFEAT') && (
        <div className="relative flex-1 flex flex-col overflow-hidden w-full h-full">


          {/* BANNER HIỂN THỊ SỰ KIỆN / THẢM HỌA THIÊN NHIÊN ĐANG DIỄN RA */}
          {(() => {
            const ev = gameDataRef.current.activeSeasonEvent;
            if (!ev) return null;
            return (
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-500/50 px-3 py-1.5 flex items-center justify-between text-xs text-white z-30 shrink-0 shadow-lg animate-pulse">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-extrabold text-amber-300 shrink-0">{ev.name}</span>
                  <span className="text-[11px] text-slate-300 truncate hidden xs:inline">{ev.desc}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-cyan-300 font-bold shrink-0 ml-2">
                  <span>⏳ {ev.remainingTime}s</span>
                </div>
              </div>
            );
          })()}

          {/* BANNER CẢNH BÁO SỚM: TÊN LỬA HƯỚNG TỚI LÃNH THỔ */}
          {(() => {
            const data = gameDataRef.current;
            const myId = isMultiplayer ? myPlayerNationId : 1;
            const incomingToPlayer = (data.flyingMissiles || []).filter(m => {
              const tgt = data.tiles[m.targetY]?.[m.targetX];
              return m.fromNation !== myId && tgt && tgt.owner === myId;
            });

            if (incomingToPlayer.length === 0) return null;

            const nearest = incomingToPlayer[0];
            const cfg = MISSILE_CONFIG[nearest.type];
            const spd = nearest.speed || (1 / (MISSILE_SETTINGS.DEFAULT_FLIGHT_DURATION_SECONDS || 8));
            const secondsLeft = Math.max(1, Math.ceil((1.0 - nearest.progress) / (spd * (gameSpeed || 1))));

            return (
              <div className="bg-gradient-to-r from-red-950 via-rose-900 to-red-950 border-b-2 border-red-500 px-3 py-2 flex items-center justify-between text-xs text-white z-40 shrink-0 shadow-2xl animate-pulse">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="p-1 bg-red-600 rounded-lg text-white font-extrabold text-[10px] animate-bounce shrink-0">🚨 CẢNH BÁO SỚM RADAR</span>
                  <span className="font-bold text-red-100 text-xs truncate">
                    ⚠️ Tên lửa {cfg.name} hướng tới Tọa độ ({nearest.targetX}, {nearest.targetY})!
                  </span>
                </div>
                <div className="flex items-center gap-1 font-mono text-amber-300 font-extrabold text-xs shrink-0 ml-2 bg-black/50 px-2 py-0.5 rounded-lg border border-red-500/60">
                  <span>💥 NỔ SAU: {secondsLeft}s</span>
                </div>
              </div>
            );
          })()}

          {/* BANNER THÔNG BÁO TẠM DỪNG */}
          {isPaused && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] z-35 flex flex-col items-center justify-center pointer-events-auto p-4 animate-in fade-in duration-150">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl">
                <Pause className="w-12 h-12 text-amber-400 mx-auto mb-2 animate-pulse" />
                <h3 className="text-lg font-black text-white mb-1">TRẬN ĐẤU TẠM DỪNG</h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">Thời gian và các đợt hành quân đang được giữ nguyên.</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setIsPaused(false);
                      soundManager.playClick();
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-current" /> Tiếp Tục Trận Đấu
                  </button>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      soundManager.playClick();
                    }}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <Settings className="w-4 h-4 text-amber-400" /> Cài Đặt Trận Đấu
                  </button>
                  {isUserAdmin(currentUser) && (
                    <button
                      onClick={() => {
                        setIsAdminPanelOpen(true);
                        soundManager.playClick();
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-amber-400/60 shadow-lg active:scale-95 transition-all"
                    >
                      <Crown className="w-4 h-4 text-amber-300" /> Bảng Điều Khiển Admin
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* THANH NHIỆM VỤ THU GỌN - CHỐNG TRÀN MÀN HÌNH DI ĐỘNG */}
          {!questDismissed && currentQuest <= 5 && (
            <div className="absolute top-12 left-2 right-2 sm:left-3 sm:right-3 z-30 flex items-center justify-between px-3 py-1.5 bg-blue-950/90 border border-blue-500/40 rounded-xl shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-xs text-blue-100 min-w-0 flex-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                <span className="font-bold text-amber-300 text-[11px] shrink-0">Nhiệm vụ {currentQuest}/5:</span>
                <span className="text-[11px] text-slate-200 truncate">
                  {currentQuest === 1 && 'Khởi đầu: Chiếm 15 ô đất xung quanh Việt Nam'}
                  {currentQuest === 2 && 'Mở rộng: Chinh phục 25 ô đất thế giới'}
                  {currentQuest === 3 && 'Kinh tế: Mở bảng Xây Dựng & lập 1 Thành Phố'}
                  {currentQuest === 4 && 'Công nghệ: Mở bảng Công Nghệ & nâng cấp'}
                  {currentQuest === 5 && 'Bá chủ: Tiếp tục mở rộng đế quốc!'}
                </span>
              </div>
              <button
                onClick={() => setQuestDismissed(true)}
                className="p-1 text-slate-400 hover:text-white rounded-lg shrink-0 ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* SỰ KIỆN & MINIMAP */}
          <div className="absolute top-24 left-2.5 z-20 pointer-events-auto max-w-[200px] sm:max-w-xs">
            <EventTicker
              events={gameDataRef.current.events}
              onOpenLog={() => setIsEventLogOpen(true)}
            />
          </div>

          {showMinimap && (
            <div className="absolute top-24 right-2.5 z-20 pointer-events-auto animate-in fade-in duration-150">
              <Minimap
                tiles={gameDataRef.current.tiles}
                nations={gameDataRef.current.nations}
                mapSize={mapSize}
                camera={cameraRef.current}
                darkTitan={gameDataRef.current.darkTitan}
                darkTitans={gameDataRef.current.darkTitans}
                fogOfWarEnabled={fogOfWarEnabled}
                playerNationId={isMultiplayer ? myPlayerNationId : 1}
                onNavigate={(mapX, mapY) => {
                  const vpW = viewportSizeRef.current.width || 360;
                  const vpH = viewportSizeRef.current.height || 560;
                  const curZoom = cameraRef.current.zoom;
                  const rawX = vpW / 2 - (mapX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2) * curZoom;
                  const rawY = vpH / 2 - (mapY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2) * curZoom;
                  const clamped = clampCamera(rawX, rawY, curZoom);
                  cameraRef.current = { x: clamped.x, y: clamped.y, zoom: curZoom };
                }}
              />
            </div>
          )}

          {/* KHUNG CANVAS BẢN ĐỒ */}
          <div 
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onWheel={handleWheel}
            className="relative flex-1 overflow-hidden bg-slate-950 touch-none select-none cursor-grab active:cursor-grabbing w-full h-full"
          >
            <canvas
              ref={canvasRef}
              className="block w-full h-full"
            />
          </div>


          <GameHud
            hudStats={{
              ...hudStats,
              population: gameDataRef.current?.nations?.[isMultiplayer ? myPlayerNationId : 1]?.population || 0,
            }}
            playerProfile={playerProfile}
            playerName={playerName}
            gameSpeed={gameSpeed}
            setGameSpeed={setGameSpeed}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
            setIsSettingsOpen={setIsSettingsOpen}
            selectedTile={selectedTile}
            setSelectedTile={(t) => {
              setSelectedTile(t);
              selectedTileRef.current = t;
            }}
            gameDataRef={gameDataRef}
            setIsBuildOpen={setIsBuildOpen}
            setIsTechOpen={setIsTechOpen}
            setIsDiplomacyOpen={setIsDiplomacyOpen}
            setIsMissileOpen={setIsMissileOpen}
            autoExpand={autoExpand}
            setAutoExpand={setAutoExpand}
            attackPercent={attackPercent}
            setAttackPercent={setAttackPercent}
            actualAttackTroops={actualAttackTroops}
            launchAttackWave={launchAttackWave}
            playerGeneralDeployMode={playerGeneralDeployMode}
            setPlayerGeneralDeployMode={setPlayerGeneralDeployMode}
            activateGeneralSkill={activateGeneralSkill}
            canTech={canTech}
            hasMetBot={hasMetBot}
            soundManager={soundManager}
          />
        </div>
      )}

      {/* MODALS */}
      {(() => {
        const player = gameDataRef.current.nations[1];
        const activeBuildTarget = selectedTile ||
          (player ? gameDataRef.current.tiles[player.capitalY]?.[player.capitalX] : null);

        const buildingCounts: Record<BuildingType, number> = { NONE: 0, CITY: 0, BARRACKS: 0, FORTRESS: 0, PORT: 0, ARTILLERY: 0, MISSILE_SILO: 0, AIR_DEFENSE: 0, LASER: 0 };
        if (isBuildOpen) {
          const tiles = gameDataRef.current.tiles;
          for (let r = 0; r < tiles.length; r++) {
            const row = tiles[r];
            for (let c = 0; c < row.length; c++) {
              const t = row[c];
              if (t.owner === 1 && t.building !== 'NONE') {
                buildingCounts[t.building] = (buildingCounts[t.building] || 0) + 1;
              }
            }
          }
        }

        return (
          <BuildModal
            isOpen={isBuildOpen}
            onClose={() => setIsBuildOpen(false)}
            selectedTile={activeBuildTarget}
            playerNation={player || {}}
            existingBuildingCounts={buildingCounts}
            onBuild={(type, count) => executeBuild(activeBuildTarget, type, count)}
          />
        );
      })()}

      <TechModal
        isOpen={isTechOpen}
        onClose={() => setIsTechOpen(false)}
        playerNation={gameDataRef.current.nations[1] || {}}
        researching={gameDataRef.current.researching}
        onStartResearch={(tech) => {
          const data = gameDataRef.current;
          const player = data.nations[1];
          const territoryCount = player.territoryCount || 0;
          const actualCost = Math.round(tech.cost * (1 + territoryCount / 150));
          if (player.gold >= actualCost) {
            player.gold -= actualCost;
            data.researching = { techId: tech.id, remainingTime: tech.researchTime, totalTime: tech.researchTime };
            soundManager.playClick();
          }
        }}
      />

      <DiplomacyModal
        isOpen={isDiplomacyOpen}
        onClose={() => setIsDiplomacyOpen(false)}
        playerNation={gameDataRef.current.nations[1] || {}}
        nations={gameDataRef.current.nations}
        totalLandCount={totalLandCountRef.current || 1}
        onFocusNation={focusOnNation}
        onSendGoldAid={handleSendGoldAid}
        onSendTroopAid={handleSendTroopAid}
        onRequestAid={handleRequestAid}
        onProposeTruce={(id) => {
          const data = gameDataRef.current;
          const player = data.nations[1];
          const targetNat = data.nations[id];
          if (!player || !targetNat) return;

          // Thiết lập Hiệp Ước Đình Chiến 45 giây cho cả hai bên (Đóng băng giao tranh)
          player.diplomacy[id] = { status: 'TRUCE', relation: 30, truceTimer: 45 };
          targetNat.diplomacy[1] = { status: 'TRUCE', relation: 30, truceTimer: 45 };

          // Xóa ngay bất kỳ đợt quân tấn công nào đang di chuyển giữa 2 bên
          data.attackWaves = data.attackWaves.filter(w => 
            !( (w.fromNation === 1 && w.toNation === id) || (w.fromNation === id && w.toNation === 1) )
          );

          soundManager.playTruce();
          data.particles.push({
            x: player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#38bdf8', size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.8,
            type: 'FLOAT_TEXT',
            text: `🕊️ ĐÌNH CHIẾN 45 GIÂY: Đóng băng giao tranh!`
          });

          data.events.unshift({
            id: Math.random().toString(),
            title: '🕊️ Hiệp Ước Đình Chiến (45 Giây)',
            description: `Đã ký hiệp ước đình chiến 45 giây với ${targetNat.name}! Giao tranh được đóng băng tạm thời để bạn dồn toàn lực mở rộng lãnh thổ hướng khác.`,
            type: 'DIPLOMACY',
            targetNationId: id,
            timestamp: formatGameTime(data.gameTimeSeconds),
          });
        }}
        onProposeAlliance={(id) => {
          const data = gameDataRef.current;
          const player = data.nations[1];
          const targetNat = data.nations[id];
          if (!player || !targetNat) return;

          // Gửi lời mời liên minh (thêm vào allianceInvites của target)
          targetNat.allianceInvites.push({
            senderNationId: 1,
            expiryTimer: 20
          });
          // Thông báo gửi lời mời thành công
          data.particles.push({
            x: targetNat.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: targetNat.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#10b981', size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.5,
            type: 'FLOAT_TEXT', text: '🤝 Đã gửi lời mời liên minh!'
          });

          // KÍCH HOẠT LUỒNG GIAO THƯƠNG HẢI CẢNG (Sea Trade Route & Ships)
          // Tìm xem player và đồng minh đã có Port chưa; nếu chưa có nhưng có ô bờ biển thì kích hoạt Hải Cảng
          let playerPort = data.tiles.flat().find(t => t.owner === 1 && t.building === 'PORT');
          let allyPort = data.tiles.flat().find(t => t.owner === id && t.building === 'PORT');

          if (!playerPort) {
            const playerCoastal = data.tiles.flat().find(t => t.owner === 1 && t.hasHarborAccess && t.building === 'NONE');
            if (playerCoastal) {
              playerCoastal.building = 'PORT';
              playerCoastal.buildingLevel = 1;
              playerPort = playerCoastal;
              offscreenTerritoryDirtyRef.current = true;
            }
          }

          if (!allyPort) {
            const allyCoastal = data.tiles.flat().find(t => t.owner === id && t.hasHarborAccess && t.building === 'NONE');
            if (allyCoastal) {
              allyCoastal.building = 'PORT';
              allyCoastal.buildingLevel = 1;
              allyPort = allyCoastal;
              offscreenTerritoryDirtyRef.current = true;
            }
          }

          // Thiết lập ngay tuyến đường biển giao thương giữa 2 nước
          data.tradeRoutes = data.tradeRoutes || [];
          data.tradeShips = data.tradeShips || [];

          const pPortX = playerPort ? playerPort.x : player.capitalX;
          const pPortY = playerPort ? playerPort.y : player.capitalY;
          const aPortX = allyPort ? allyPort.x : targetNat.capitalX;
          const aPortY = allyPort ? allyPort.y : targetNat.capitalY;
          const dist = Math.hypot(aPortX - pPortX, aPortY - pPortY);
          const isInter = dist > 10;
          const routeId = `route_1_${pPortX}_${pPortY}_${id}_${aPortX}_${aPortY}`;

          if (!data.tradeRoutes.some(r => r.id === routeId)) {
            data.tradeRoutes.push({
              id: routeId,
              fromNation: 1,
              toNation: id,
              fromPortX: pPortX,
              fromPortY: pPortY,
              toPortX: aPortX,
              toPortY: aPortY,
              distanceTiles: Math.max(5, Math.round(dist)),
              isIntercontinental: isInter,
            });
          }

          // Thả ngay tàu buôn hàng hải liên minh
          data.tradeShips.push({
            id: Math.random().toString(),
            routeId: routeId,
            fromNation: 1,
            toNation: id,
            sourceX: pPortX,
            sourceY: pPortY,
            targetX: aPortX,
            targetY: aPortY,
            progress: 0.1,
            speed: 1 / Math.max(8, dist * 0.6),
            cargoGold: isInter ? 150 : 60,
            isIntercontinental: isInter,
          });

          // Tặng ngay phần thưởng khởi điểm giao thương đồng minh
          player.gold += 150;
          targetNat.gold += 150;

          soundManager.playCapture();
          data.particles.push({
            x: player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#10b981', size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.8,
            type: 'FLOAT_TEXT',
            text: `🤝 LIÊN MINH SẮT SON: Kích hoạt Giao Thương Hải Cảng (+150 Vàng)!`
          });

          data.events.unshift({
            id: Math.random().toString(),
            title: '🤝 Liên Minh Sắt Son Thành Lập',
            description: `Đã kết liên minh sắt son với ${targetNat.name}! Yên tâm tuyệt đối không bị đồng minh tấn công sau lưng và kích hoạt luồng Giao Thương Hải Cảng sinh lợi nhuận vàng khổng lồ!`,
            type: 'DIPLOMACY',
            targetNationId: id,
            timestamp: formatGameTime(data.gameTimeSeconds),
          });
        }}
        onDeclareWar={(id) => {
          const data = gameDataRef.current;
          const player = data.nations[1];
          const targetNat = data.nations[id];
          if (!player || !targetNat) return;

          player.diplomacy[id] = { status: 'WAR', relation: -50, truceTimer: 0 };
          targetNat.diplomacy[1] = { status: 'WAR', relation: -50, truceTimer: 0 };

          // Hủy bỏ các tuyến đường giao thương giữa 2 nước
          if (data.tradeRoutes) {
            data.tradeRoutes = data.tradeRoutes.filter(r => 
              !( (r.fromNation === 1 && r.toNation === id) || (r.fromNation === id && r.toNation === 1) )
            );
          }
          if (data.tradeShips) {
            data.tradeShips = data.tradeShips.filter(s => 
              !( (s.fromNation === 1 && s.toNation === id) || (s.fromNation === id && s.toNation === 1) )
            );
          }

          soundManager.playAttack();
          data.particles.push({
            x: player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#ef4444', size: 0, life: 50, maxLife: 50, vx: 0, vy: -0.8,
            type: 'FLOAT_TEXT',
            text: `⚔️ TUYÊN CHIẾN: ${targetNat.name}!`
          });

          data.events.unshift({
            id: Math.random().toString(),
            title: '⚔️ Tuyên Chiến',
            description: `Đã tuyên chiến với ${targetNat.name}! Mối quan hệ ngoại giao sụp đổ.`,
            type: 'DIPLOMACY',
            targetNationId: id,
            timestamp: formatGameTime(data.gameTimeSeconds),
          });
        }}
      />

      <EventLogModal
        isOpen={isEventLogOpen}
        onClose={() => setIsEventLogOpen(false)}
        events={gameDataRef.current.events}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(prev => !prev)}
        isPaused={isPaused}
        onTogglePause={() => {
          setIsPaused(prev => {
            const next = !prev;
            if (next) saveGameRef.current();
            return next;
          });
        }}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(prev => {
          const next = !prev;
          try {
            localStorage.setItem('pixel_empire_show_minimap', String(next));
          } catch {}
          return next;
        })}
        weatherEnabled={weatherEnabled}
        onToggleWeather={toggleWeather}
        weather={weather}
        onCycleWeather={cycleWeather}
        fogOfWarEnabled={fogOfWarEnabled}
        onToggleFogOfWar={handleToggleFogOfWar}
        onQuitToTitle={() => {
          saveGameRef.current();
          setGameState('TITLE');
          soundManager.playClick();
        }}
      />

      <CreativeModal
        isOpen={isCreativeOpen}
        onClose={() => setIsCreativeOpen(false)}
        playerNation={gameDataRef.current.nations[1] || {}}
        currentWeather={weather}
        darkTitans={gameDataRef.current.darkTitans || []}
        onSetGold={handleSetGold}
        onAddGold={handleAddGold}
        onSetTroops={handleSetTroops}
        onAddTroops={handleAddTroops}
        onChangeWeather={handleChangeWeather}
        onTriggerLightningSpam={handleTriggerLightningSpam}
        onSpawnDarkTitan={handleSpawnDarkTitan}
        onClearDarkTitans={handleClearDarkTitans}
        onUnlockAllTech={handleUnlockAllTech}
        onClearAllScorched={handleClearAllScorched}
        onClaimSelectedTile={handleClaimSelectedTile}
        selectedTileCoords={selectedTile ? { x: selectedTile.x, y: selectedTile.y } : null}
        godModeLocked={godModeLocked}
        onToggleGodModeLocked={handleToggleGodModeLocked}
      />

      <VictoryModal
        isVisible={gameState === 'VICTORY'}
        victoryReward={victoryReward}
        hudStats={hudStats}
        difficulty={difficulty}
        gameMode={gameMode}
        mapSize={mapSize}
        playerName={playerName}
        playerProfile={playerProfile}
        gameDataRef={gameDataRef}
        totalLandCountRef={totalLandCountRef}
        myNationIdRef={myNationIdRef}
        isMultiplayer={isMultiplayer}
        setIsMultiplayer={setIsMultiplayer}
        setGameState={setGameState}
        setIsMultiplayerModalOpen={setIsMultiplayerModalOpen}
        startNewGame={startNewGame}
      />

      <DefeatModal
        isVisible={gameState === 'DEFEAT'}
        isMultiplayer={isMultiplayer}
        difficulty={difficulty}
        mapSize={mapSize}
        playerName={playerName}
        gameMode={gameMode}
        gameDataRef={gameDataRef}
        totalLandCountRef={totalLandCountRef}
        myNationIdRef={myNationIdRef}
        setGameState={setGameState}
        setIsMultiplayer={setIsMultiplayer}
        setIsMultiplayerModalOpen={setIsMultiplayerModalOpen}
        startNewGame={startNewGame}
      />

      {/* MODAL PHÒNG CHƠI NHIỀU NGƯỜI (MULTIPLAYER LOBBY) */}
      <MultiplayerModal
        isOpen={isMultiplayerModalOpen}
        onClose={() => setIsMultiplayerModalOpen(false)}
        defaultPlayerName={playerName}
        initialRoomCode={urlRoomCode}
        onStartMultiplayerGame={handleStartMultiplayerGame}
      />

      <ConfirmNewGameModal
        isVisible={showConfirmNewGame}
        onClose={() => setShowConfirmNewGame(false)}
        deleteSavedGame={deleteSavedGame}
        startNewGame={startNewGame}
        difficulty={difficulty}
        mapSize={mapSize}
        playerName={playerName}
        gameMode={gameMode}
      />

      {/* TOAST THÔNG BÁO LỖI NẠP VÁN */}
      {loadErrorToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white font-bold px-4 py-2.5 rounded-2xl shadow-2xl text-xs flex items-center gap-2 border border-rose-400 animate-in slide-in-from-top pointer-events-none">
          <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
          <span>{loadErrorToast}</span>
        </div>
      )}

      {/* TOAST THÔNG BÁO TÊN LỬA / NGẮM BẮN */}
      {missileFeedbackToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-rose-500 text-rose-300 font-black px-4 py-3 rounded-2xl shadow-2xl text-xs flex items-center gap-2 backdrop-blur-md animate-in slide-in-from-top pointer-events-none">
          <Rocket className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
          <span>{missileFeedbackToast}</span>
        </div>
      )}

      {/* BANNER HƯỚNG DẪN KHI ĐANG Ở CHẾ ĐỘ NGẮM BẮN TÊN LỬA */}
      {missileAimingMode && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-rose-950/90 via-slate-900/95 to-amber-950/90 border border-rose-500/80 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-top pointer-events-none">
          <Rocket className="w-5 h-5 text-rose-400 animate-pulse shrink-0" />
          <div className="text-left">
            <div className="text-xs font-black text-amber-300">
              Đang ngắm bắn: {MISSILE_CONFIG[missileAimingMode].name}
            </div>
            <div className="text-[11px] text-slate-300">
              Chạm vào đất kẻ thù trên bản đồ để phóng!
            </div>
          </div>
          <button
            onClick={() => {
              setMissileAimingMode(null);
              missileAimingModeRef.current = null;
              showMissileToast('Đã hủy ngắm bắn tên lửa.');
            }}
            className="ml-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 active:scale-95"
          >
            Hủy Bỏ
          </button>
        </div>
      )}

      {/* MODAL CHỌN TÊN LỬA */}
      <MissileModal
        isOpen={isMissileOpen}
        onClose={() => setIsMissileOpen(false)}
        playerNation={gameDataRef.current.nations[1] || {}}
        silos={(() => {
          const list: Tile[] = [];
          const tiles = gameDataRef.current.tiles;
          if (tiles) {
            for (let y = 0; y < tiles.length; y++) {
              for (let x = 0; x < tiles.length; x++) {
                const t = tiles[y][x];
                if (t.owner === 1 && t.building === 'MISSILE_SILO') {
                  list.push(t);
                }
              }
            }
          }
          return list;
        })()}
        onSelectMissile={(type) => {
          setMissileAimingMode(type);
          missileAimingModeRef.current = type;
          showMissileToast(`Đã chọn ${MISSILE_CONFIG[type].name}. Hãy chạm vào vùng đất kẻ thù trên bản đồ!`);
        }}
        onOpenBuildModal={() => setIsBuildOpen(true)}
      />

      {/* MODAL CHỌN TƯỚNG SẢNH CHÍNH */}
      <GeneralSelectModal
        isOpen={isGeneralSelectOpen}
        onClose={() => setIsGeneralSelectOpen(false)}
        playerProfile={playerProfile}
        onUpdateProfile={(updated) => {
          setPlayerProfile(updated);
          playerProfileRef.current = updated;
          savePlayerProfile(updated);
          if (auth.currentUser) {
            syncProfileToFirestore(auth.currentUser, updated).catch(console.error);
          }

          // Quy tắc 3.7: Không được hồi phục tức thì khi thay Đại Tướng chính
          if (gameDataRef.current?.nations?.[1]?.general) {
            const pGen = gameDataRef.current.nations[1].general;
            const selectedRosterItem = GENERAL_ROSTER.find(g => g.skillId === updated.selectedGeneral) || GENERAL_ROSTER[0];
            const hpRatio = pGen.maxHp > 0 ? (pGen.hp / pGen.maxHp) : 1.0;
            pGen.name = selectedRosterItem.name;
            pGen.skillId = selectedRosterItem.skillId;
            pGen.skillCooldown = 0;
            pGen.skillActiveTimer = 0;
            calculateGeneralStats(pGen, gameDataRef.current.nations[1], updated);
            // Kế thừa tỷ lệ HP hiện tại, ngăn lợi dụng đổi tướng để hồi đầy máu
            pGen.hp = Math.round(pGen.maxHp * hpRatio);
            if (pGen.hp === 0) {
              pGen.healthState = 'INJURED';
              pGen.status = 'INJURED';
            } else if (pGen.hp < pGen.maxHp * GENERAL_CONSTANTS.DEPLOY_MIN_HP_RATIO) {
              pGen.healthState = 'RECOVERING';
            } else {
              pGen.healthState = 'HEALTHY';
            }
          }
        }}
      />

      {/* MODAL ĐĂNG NHẬP / ĐĂNG KÝ TÀI KHOẢN FIREBASE */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        playerProfile={playerProfile}
        onProfileLoaded={(loadedProfile) => {
          setPlayerProfile(loadedProfile);
          playerProfileRef.current = loadedProfile;
          savePlayerProfile(loadedProfile);
        }}
      />

      {/* MODAL ADMIN PANEL (CHỈ QUẢN TRỊ VIÊN MỚI TRUY CẬP ĐƯỢC) */}
      {isUserAdmin(currentUser) && (
        <AdminPanelModal
          isOpen={isAdminPanelOpen}
          onClose={() => setIsAdminPanelOpen(false)}
          currentUser={currentUser}
          playerProfile={playerProfile}
          onUpdateProfile={(updated) => {
            setPlayerProfile(updated);
            playerProfileRef.current = updated;
            savePlayerProfile(updated);
            if (currentUser) {
              syncProfileToFirestore(currentUser, updated).catch(console.error);
            }
          }}
          gameDataRef={gameDataRef}
          gameSpeed={gameSpeed}
          setGameSpeed={setGameSpeed}
          infiniteResources={infiniteResources}
          setInfiniteResources={setInfiniteResources}
          noCooldown={noCooldown}
          setNoCooldown={setNoCooldown}
          onResetCooldowns={handleResetCooldowns}
          onAddMissiles={handleAddMissiles}
          onAddSilos={handleAddSilos}
          onAddBot={handleAddBot}
          onRemoveBot={handleRemoveBot}
          onAdjustBotPower={handleAdjustBotPower}
          onRefreshGameStats={refreshHudStats}
        />
      )}

      {/* MODAL CÂY KỸ NĂNG ĐẾ CHẾ (SKILL TREE) */}
      <SkillTreeModal
        isOpen={isSkillTreeOpen}
        onClose={() => setIsSkillTreeOpen(false)}
        playerProfile={playerProfile}
        onUpdateProfile={(updated) => {
          setPlayerProfile(updated);
          playerProfileRef.current = updated;
          savePlayerProfile(updated);
          if (currentUser) {
            syncProfileToFirestore(currentUser, updated).catch(console.error);
          }
        }}
      />

    </div>
  );
}
