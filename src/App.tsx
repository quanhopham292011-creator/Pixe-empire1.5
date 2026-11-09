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
import { generateWeatherParticles } from './utils/weatherUtils';
import { drawTerrainBuffer, drawTerritoryBuffer } from './utils/canvasRenderer';
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
import { getSkillTreeBonuses } from './utils/skillTreeConfig';
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
  const [weather, setWeather] = useState<WeatherType>('CLOUDY');
  const weatherRef = useRef<WeatherType>('CLOUDY');
  const [weatherEnabled, setWeatherEnabled] = useState<boolean>(true);
  const weatherEnabledRef = useRef<boolean>(true);
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
  const [savedGameInfo, setSavedGameInfo] = useState<{
    timestamp: string;
    gameTimeStr: string;
    playerName: string;
    mode: string;
  } | null>(null);
  const saveGameRef = useRef<() => void>(() => {});
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

  // Giới hạn thu phóng mở rộng: Cho phép thu nhỏ bao quát toàn bộ thế giới và phóng to chi tiết
  const clampZoom = useCallback((targetZoom: number) => {
    const vpW = viewportSizeRef.current.width || 360;
    const vpH = viewportSizeRef.current.height || 560;
    const mapPx = mapSize * TILE_PIXEL_SIZE;
    // Fit zoom: mức zoom vừa vặn để thấy trọn vẹn toàn bộ bản đồ thế giới trong khung nhìn
    const fitZoom = Math.min(vpW / mapPx, vpH / mapPx);
    // Tăng giới hạn thu nhỏ (Zoom Out) để người chơi có thể bao quát toàn bộ thế giới kèm lề
    const minZ = Math.max(0.10, fitZoom * 0.88);
    // Cho phép phóng to đủ gần (Zoom In) để quan sát chi tiết lãnh thổ, công trình, quân lính
    const maxZ = 3.6;
    return Math.min(maxZ, Math.max(minZ, targetZoom));
  }, [mapSize]);

  // Giới hạn camera cho phép khám phá toàn bản đồ, không bị kẹt ở phạm vi quá nhỏ
  const clampCamera = useCallback((camX: number, camY: number, zoom: number) => {
    const vpW = viewportSizeRef.current.width || 360;
    const vpH = viewportSizeRef.current.height || 560;
    const mapPxX = mapSize * TILE_PIXEL_SIZE * zoom;
    const mapPxY = mapSize * TILE_PIXEL_SIZE * zoom;

    let clampedX: number;
    if (mapPxX <= vpW) {
      clampedX = (vpW - mapPxX) / 2;
    } else {
      const margin = 200;
      clampedX = Math.min(margin, Math.max(vpW - mapPxX - margin, camX));
    }

    let clampedY: number;
    if (mapPxY <= vpH) {
      clampedY = (vpH - mapPxY) / 2;
    } else {
      const margin = 200;
      clampedY = Math.min(margin, Math.max(vpH - mapPxY - margin, camY));
    }

    return { x: clampedX, y: clampedY };
  }, [mapSize]);

  // Hàm thu phóng quanh tâm chỉ định
  const zoomAroundPoint = useCallback((screenX: number, screenY: number, targetZoom: number) => {
    const curCam = cameraRef.current;
    const finalZoom = clampZoom(targetZoom);
    if (finalZoom === curCam.zoom) return;

    const worldX = (screenX - curCam.x) / curCam.zoom;
    const worldY = (screenY - curCam.y) / curCam.zoom;

    const newCamX = screenX - worldX * finalZoom;
    const newCamY = screenY - worldY * finalZoom;

    const clamped = clampCamera(newCamX, newCamY, finalZoom);
    cameraRef.current = { x: clamped.x, y: clamped.y, zoom: finalZoom };
  }, [clampZoom, clampCamera]);

  // Hàm di chuyển camera mượt mà đến tọa độ thế giới (Smooth Camera Pan Animation)
  const focusOnCoordinates = useCallback((worldX: number, worldY: number, targetZoom?: number, duration: number = 650) => {
    const vpW = viewportSizeRef.current.width || 360;
    const vpH = viewportSizeRef.current.height || 560;
    const finalZoom = targetZoom ? clampZoom(targetZoom) : Math.max(1.2, cameraRef.current.zoom);

    const rawX = vpW / 2 - worldX * finalZoom;
    const rawY = vpH / 2 - worldY * finalZoom;
    const clamped = clampCamera(rawX, rawY, finalZoom);

    cameraAnimRef.current = {
      startX: cameraRef.current.x,
      startY: cameraRef.current.y,
      startZoom: cameraRef.current.zoom,
      targetX: clamped.x,
      targetY: clamped.y,
      targetZoom: finalZoom,
      startTime: performance.now(),
      duration,
    };
  }, [clampCamera, clampZoom]);

  // Chức năng: Về Vương Quốc Của Tôi (Di chuyển camera mượt mà đến trung tâm lãnh thổ người chơi)
  const focusOnPlayerKingdom = useCallback(() => {
    const player = gameDataRef.current.nations[1];
    if (!player) return;

    // Ưu tiên tâm trung bình của toàn bộ lãnh thổ người chơi, nếu chưa có thì dùng Thủ đô
    const center = nationCentersRef.current[1];
    const targetWorldX = center ? center.px : player.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
    const targetWorldY = center ? center.py : player.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

    focusOnCoordinates(targetWorldX, targetWorldY, Math.max(1.25, cameraRef.current.zoom));
    soundManager.playClick();
  }, [focusOnCoordinates]);

  // Chức năng: Di chuyển camera đến quốc gia chỉ định (dùng khi bấm vào bảng xếp hạng / ngoại giao)
  const focusOnNation = useCallback((nationId: number) => {
    const nation = gameDataRef.current.nations[nationId];
    if (!nation) return;

    const center = nationCentersRef.current[nationId];
    const targetWorldX = center ? center.px : nation.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
    const targetWorldY = center ? center.py : nation.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

    focusOnCoordinates(targetWorldX, targetWorldY, Math.max(1.2, cameraRef.current.zoom));
    soundManager.playClick();
  }, [focusOnCoordinates]);

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

  // Khởi tạo các hạt thời tiết (Mây trôi bồng bềnh, Mưa lất phất)
  const initWeatherParticles = useCallback((dimension: MapDimension, type: WeatherType) => {
    weatherParticlesRef.current = generateWeatherParticles(dimension, type);
  }, []);

  // Chuyển đổi kiểu thời tiết nhanh
  const cycleWeather = useCallback(() => {
    setWeather(prev => {
      const next: WeatherType = prev === 'CLEAR' ? 'CLOUDY' : prev === 'CLOUDY' ? 'RAIN' : 'CLEAR';
      weatherRef.current = next;
      initWeatherParticles(mapSize, next);
      if (next === 'RAIN') {
        nextLightningTimeRef.current = performance.now() + 1500 + Math.random() * 2000;
      }
      soundManager.playClick();
      return next;
    });
  }, [mapSize, initWeatherParticles]);

  // Bật/tắt hiệu ứng thời tiết
  const toggleWeather = useCallback(() => {
    setWeatherEnabled(prev => {
      const next = !prev;
      weatherEnabledRef.current = next;
      soundManager.playClick();
      return next;
    });
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
    if (nations[1] && nations[1].general) {
      const selectedRosterItem = GENERAL_ROSTER.find(g => g.skillId === playerProfileRef.current.selectedGeneral) || GENERAL_ROSTER[0];
      nations[1].general.name = selectedRosterItem.name;
      nations[1].general.skillId = selectedRosterItem.skillId;
      nations[1].general.skillCooldown = 0;
      nations[1].general.skillActiveTimer = 0;
    }
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
  }, [difficulty, mapSize, playerName, currentQuest, questDismissed, hasMetBot, attackPercent, autoExpand, playerGeneralDeployMode, hudStats]);

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

      if (Array.isArray(gameData.nations)) {
        gameData.nations.forEach((n: Nation) => {
          if (n) {
            n.techChoices = n.techChoices || {};
            if (n.techLevels?.economy === 3 && !n.techChoices.economy) n.techChoices.economy = 'A';
            if (n.techLevels?.military === 3 && !n.techChoices.military) n.techChoices.military = 'A';
            if (n.techLevels?.defense === 3 && !n.techChoices.defense) n.techChoices.defense = 'A';

            if (n.general) {
              if (!n.general.skillId) {
                const item = GENERAL_ROSTER[n.id % GENERAL_ROSTER.length];
                n.general.skillId = item.skillId;
                n.general.name = item.name;
              }
              if (n.general.skillCooldown === undefined) n.general.skillCooldown = 0;
              if (n.general.skillActiveTimer === undefined) n.general.skillActiveTimer = 0;
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
  }, [initWeatherParticles]);

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

  // Buffer 1: Render Địa Hình Tĩnh Tối Ưu Đồ Họa Pixel (Biển, Bọt Sóng, Núi Tuyết, Tán Rừng)
  const renderTerrainBuffer = useCallback((size: number) => {
    if (!offscreenTerrainCanvasRef.current) {
      offscreenTerrainCanvasRef.current = document.createElement('canvas');
    }
    drawTerrainBuffer(offscreenTerrainCanvasRef.current, gameDataRef.current.tiles, size);
  }, []);

  // Buffer 2: Render Đồ Họa Chuẩn OpenFront (Đường viền Neon chói & Nét căng, hỗ trợ selective patch)
  const renderTerritoryBuffer = useCallback((size: number) => {
    if (!offscreenTerritoryCanvasRef.current) {
      offscreenTerritoryCanvasRef.current = document.createElement('canvas');
    }
    const { tiles, nations } = gameDataRef.current;
    const dirtyList = dirtyTerritoryTilesRef.current;
    drawTerritoryBuffer(offscreenTerritoryCanvasRef.current, tiles, nations, size, dirtyList.length > 0 ? dirtyList : undefined);
  }, []);

  // Khởi tạo Text Width Cache đơn giản
  const textWidthCache = new Map<string, number>();
  const getCachedWidth = (ctx: CanvasRenderingContext2D, text: string, font: string): number => {
    const key = `${font}:${text}`;
    if (textWidthCache.has(key)) return textWidthCache.get(key)!;
    ctx.font = font;
    const width = ctx.measureText(text).width;
    textWidthCache.set(key, width);
    return width;
  };

  // Vòng lặp Render 60 FPS Render Chuẩn OpenFront
  useEffect(() => {
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
          gameDataRef.current.flyingMissiles.forEach(m => {
            const spd = m.speed || (1 / (MISSILE_SETTINGS.DEFAULT_FLIGHT_DURATION_SECONDS || 12));
            m.progress = Math.min(1.0, m.progress + spd * deltaSec * gameSpeed);
          });
        }

        // Tự động cập nhật tiến trình tàu buôn hải cảng mượt mà 60 FPS
        if (gameDataRef.current.tradeShips) {
          const data = gameDataRef.current;
          data.tradeShips.forEach(ship => {
            const spd = ship.speed || 0.05;
            ship.progress += spd * deltaSec * gameSpeed;

            if (ship.progress >= 1.0) {
              ship.progress = 0;
              const tempX = ship.sourceX;
              const tempY = ship.sourceY;
              ship.sourceX = ship.targetX;
              ship.sourceY = ship.targetY;
              ship.targetX = tempX;
              ship.targetY = tempY;

              const fromN = data.nations[ship.fromNation];
              const toN = data.nations[ship.toNation];
              if (fromN && !fromN.isEliminated) fromN.gold += ship.cargoGold;
              if (toN && !toN.isEliminated) toN.gold += ship.cargoGold;

              data.particles.push({
                x: tempX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                y: tempY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                color: ship.isIntercontinental ? '#38bdf8' : '#fbbf24',
                size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.6,
                type: 'FLOAT_TEXT',
                text: `⛵ +${ship.cargoGold} Vàng Giao Thương Hải Cảng`
              });
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
      if (offscreenTerrainCanvasRef.current) {
        ctx.drawImage(offscreenTerrainCanvasRef.current, 0, 0);
      }
      if (offscreenTerritoryCanvasRef.current) {
        ctx.drawImage(offscreenTerritoryCanvasRef.current, 0, 0);
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


      // 1.5. Xóa bỏ hiệu ứng thời tiết và bóng mây

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
            if (t.building === 'AIR_DEFENSE') return 7.5;
            if (t.building === 'MISSILE_SILO' || t.building === 'LASER') return 6.5;
            if (t.building === 'ARTILLERY') return 6.0;
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

      // 3. (Xóa bỏ aura và chiến hào)

      // 4. Vẽ Vùng Đất Cháy & Công Trình trong màn hình
      for (let y = minTileY; y <= maxTileY; y++) {
        for (let x = minTileX; x <= maxTileX; x++) {
          const t = tiles[y]?.[x];
          if (!t) continue;
          const px = x * TILE_PIXEL_SIZE;
          const py = y * TILE_PIXEL_SIZE;

          // 4.1. (Đã xóa bỏ hiệu ứng Vùng Đất Cháy)

          // 4.2. Vẽ Công Trình (Icon tròn nhỏ, nền màu phe, viền sáng, icon trắng ở giữa)
          if (t.building !== 'NONE') {
            const cx = px + TILE_PIXEL_SIZE / 2;
            const cy = py + TILE_PIXEL_SIZE / 2;
            const radius = 9;
            const nationColor = (t.owner > 0 && nations[t.owner]) ? nations[t.owner].color : '#1e293b';

            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = nationColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Vẽ icon trắng nhỏ ở giữa
            ctx.strokeStyle = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const bType = t.building;
            if (bType === 'CITY') {
              ctx.fillRect(cx - 3, cy - 4, 6, 8);
            } else if (bType === 'BARRACKS') {
              ctx.fillRect(cx - 4, cy - 2, 8, 5);
              ctx.fillRect(cx + 1, cy - 5, 2, 3);
            } else if (bType === 'PORT') {
              ctx.beginPath();
              ctx.arc(cx, cy - 3, 2, 0, Math.PI * 2);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(cx, cy - 1);
              ctx.lineTo(cx, cy + 5);
              ctx.moveTo(cx - 3, cy + 3);
              ctx.lineTo(cx + 3, cy + 3);
              ctx.stroke();
            } else if (bType === 'MISSILE_SILO') {
              ctx.beginPath();
              ctx.moveTo(cx, cy - 5);
              ctx.lineTo(cx - 3, cy + 4);
              ctx.lineTo(cx + 3, cy + 4);
              ctx.closePath();
              ctx.fill();
            } else if (bType === 'AIR_DEFENSE') {
              ctx.beginPath();
              ctx.moveTo(cx - 4, cy + 4);
              ctx.lineTo(cx, cy - 4);
              ctx.lineTo(cx + 4, cy + 4);
              ctx.closePath();
              ctx.stroke();
            } else if (bType === 'FORTRESS') {
              ctx.beginPath();
              ctx.moveTo(cx, cy - 5);
              ctx.lineTo(cx - 4, cy - 2);
              ctx.lineTo(cx - 4, cy + 3);
              ctx.quadraticCurveTo(cx, cy + 6, cx, cy + 6);
              ctx.quadraticCurveTo(cx, cy + 6, cx + 4, cy + 3);
              ctx.lineTo(cx + 4, cy - 2);
              ctx.closePath();
              ctx.fill();
            } else if (bType === 'ARTILLERY') {
              ctx.beginPath();
              ctx.arc(cx - 2, cy + 2, 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.moveTo(cx - 2, cy + 2);
              ctx.lineTo(cx + 5, cy - 4);
              ctx.lineWidth = 2;
              ctx.stroke();
            } else if (bType === 'LASER') {
              ctx.fillStyle = '#ec4899';
              ctx.strokeStyle = '#f472b6';
              ctx.beginPath();
              ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx + 4, cy + 4);
              ctx.moveTo(cx - 4, cy + 4); ctx.lineTo(cx + 4, cy - 4);
              ctx.lineWidth = 1.3;
              ctx.stroke();
            }
            ctx.restore();

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
          }
        }
      }

      // 4.5. Vẽ Vùng Chọn Ô Đất (Selection Highlight) sắc nét, định vị 4 góc & Vòng tròn hiệu lực Pháo Đài
      if (selectedTileRef.current) {
        const st = selectedTileRef.current;
        const spx = st.x * TILE_PIXEL_SIZE;
        const spy = st.y * TILE_PIXEL_SIZE;
        const pulse = 0.5 + 0.5 * Math.sin(timestamp * 0.007);

        // Nếu ô được chọn là Pháo Đài (FORTRESS), vẽ vòng tròn hiệu lực bán kính 4 ô màu trắng mờ
        if (st.building === 'FORTRESS') {
          const fcx = spx + TILE_PIXEL_SIZE / 2;
          const fcy = spy + TILE_PIXEL_SIZE / 2;
          const radiusPx = 4.0 * TILE_PIXEL_SIZE;

          ctx.save();
          ctx.beginPath();
          ctx.arc(fcx, fcy, radiusPx, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 1.5;
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
        nations.forEach(nation => {
          if (nation.id === 0 || nation.isEliminated) return;
          const pos = centers[nation.id];
          if (!pos) return;

          const screenPxX = pos.px * zoom + currentCamera.x;
          const screenPxY = pos.py * zoom + currentCamera.y;
          if (screenPxX < -120 || screenPxX > vpW + 120 || screenPxY < -60 || screenPxY > vpH + 60) {
            return;
          }

          const isMajorNation = nation.isPlayer || nation.tier === 'BOSS';
          let iconPrefix = '⛺ ';
          if (isMajorNation) {
            iconPrefix = '👑 ';
          } else if (nation.colonyCategory === 'FOREST') {
            iconPrefix = '🌲 ';
          } else if (nation.colonyCategory === 'TRIBE') {
            iconPrefix = '⛺ ';
          } else if (nation.colonyCategory === 'ETHNIC') {
            iconPrefix = '🛡️ ';
          }

          const nameStr = nation.name;
          const popStr = `${formatPopulation(nation.population || 0)}`;

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(nameStr, pos.px, pos.py - 5);

          ctx.fillStyle = '#e2e8f0';
          ctx.font = '9px sans-serif';
          ctx.fillText(popStr, pos.px, pos.py + 6);
        });
      }

      // 6. Render Mô hình Tướng (CHỈ hiện khi Ra Trận / Gần chiến trường, KHÔNG hiện khi nhàn rỗi) & Đợt tiến công
      nations.forEach(nation => {
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
        }
      });

      // Hoạt ảnh (Animation) Đợt quân di chuyển Mượt mà (OpenFront Laser / Chevron Trail)
      attackWaves.forEach(wave => {
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
        gameDataRef.current.flyingMissiles.forEach(m => {
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
          const cfg = MISSILE_CONFIG[m.type];

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

          // 3. Quầng sáng & Đầu đạn tên lửa
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(curX, arcY, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = cfg.color;
          ctx.lineWidth = 2;
          ctx.stroke();

          // 4. Nhãn đếm ngược thời gian bay (vd: 12s, 11s... 1s)
          const flightDuration = MISSILE_SETTINGS.DEFAULT_FLIGHT_DURATION_SECONDS || 12;
          const remainingSec = Math.max(0, Math.ceil((1.0 - prog) * flightDuration));
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`🚀 ${remainingSec}s`, curX, arcY - 10);
        });
      }

      // 6.5. Render Tà Thần Cổ Đại (Hỗ trợ nhiều Tà Thần khi Spam trong Creative Mode)
      const titansToRender = (gameDataRef.current.darkTitans && gameDataRef.current.darkTitans.length > 0)
        ? gameDataRef.current.darkTitans.filter(t => t.isActive)
        : (gameDataRef.current.darkTitan && gameDataRef.current.darkTitan.isActive ? [gameDataRef.current.darkTitan] : []);

      titansToRender.forEach(titan => {
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

        // 1. Nếu titan.ultCharge > 0: vẽ vòng tròn đỏ nhấp nháy, bán kính 6 ô, tâm ở (ultX, ultY), kèm số giây
        if (titan.ultCharge && titan.ultCharge > 0) {
          const ux = (titan.ultX ?? titan.x) * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const uy = (titan.ultY ?? titan.y) * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
          const uRadius = DARK_TITAN_CONFIG.ULT_RADIUS * TILE_PIXEL_SIZE;
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(ux, uy, uRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`☄️ ${titan.ultCharge}s`, ux, uy);
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
      });

      // 6.8. Render Tuyến Đường Giao Thương Biển (Sea Trade Routes) & Tàu Buôn Hải Cảng (Sea Trade Ships)
      if (gameDataRef.current.tradeRoutes && gameDataRef.current.tradeRoutes.length > 0) {
        ctx.save();
        gameDataRef.current.tradeRoutes.forEach(route => {
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
        gameDataRef.current.tradeShips.forEach(ship => {
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

          // Nhãn hiển thị lượng Vàng Hàng Hóa (vd: 💰120 Vàng liên lục địa)
          const cargoLabel = `💰${ship.cargoGold}`;
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

      // 7. Particles & Floating Texts (Nhỏ, nền tối mờ, tự biến mất, xếp lệch nhau)
      particles.forEach((p, idx) => {
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
          ctx.roundRect(drawX - textW / 2, drawY - textH / 2, textW, textH, 6);
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
  }, [renderTerrainBuffer, renderTerritoryBuffer, clampCamera]);

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
                  color: '#94a3b8', size: 0, life: 40, maxLife: 40, vx: 0, vy: -0.6,
                  type: 'FLOAT_TEXT',
                  text: `🕊️ Hết hạn đình chiến 45s (${other.name})`
                });
              }
            }
          }
        });
      });

      // Kích hoạt Sự Kiện Ngẫu Nhiên & Thảm Họa Thiên Nhiên theo mùa mỗi 50 giây
      if (data.gameTimeSeconds > 0 && data.gameTimeSeconds % 50 === 0 && !data.activeSeasonEvent) {
        const eventTypes: Array<{ type: 'BLIZZARD' | 'PLAGUE' | 'GOLDEN_HARVEST' | 'DROUGHT'; name: string; duration: number; desc: string }> = [
          { type: 'BLIZZARD', name: '❄️ Bão Tuyết Càn Quét', duration: 20, desc: 'Bão tuyết cực đoan! Toàn bộ quân đội và đợt hành quân bị đóng băng tạm thời.' },
          { type: 'PLAGUE', name: '🦠 Đại Dịch Bùng Phát', duration: 15, desc: 'Dịch bệnh lan rộng! Lực lượng quân sự toàn cầu suy giảm 15% tạm thời.' },
          { type: 'GOLDEN_HARVEST', name: '🌾 Mùa Màng Bội Thu', duration: 25, desc: 'Thời tiết ôn hòa! Sản lượng thu nhập vàng toàn cầu được nhân đôi (+100%).' },
          { type: 'DROUGHT', name: '☀️ Hạn Hán Khắc Nghiệt', duration: 20, desc: 'Hạn hán kéo dài! Sản lượng thu nhập vàng suy giảm 50%.' },
        ];
        const chosen = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        data.activeSeasonEvent = {
          type: chosen.type,
          name: chosen.name,
          remainingTime: chosen.duration,
          duration: chosen.duration,
          desc: chosen.desc,
        };

        if (chosen.type === 'PLAGUE') {
          data.nations.forEach(n => {
            if (!n.isEliminated) {
              n.troops = Math.max(5, Math.floor(n.troops * 0.85));
            }
          });
        }

        soundManager.playThunder();
        data.events.unshift({
          id: Math.random().toString(),
          title: chosen.name,
          description: chosen.desc,
          type: chosen.type === 'GOLDEN_HARVEST' ? 'HARVEST' : chosen.type === 'DROUGHT' ? 'CROP_FAILURE' : 'PLAGUE',
          targetNationId: 0,
          timestamp: formatGameTime(data.gameTimeSeconds),
        });

        data.particles.push({
          x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
          y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
          color: chosen.type === 'GOLDEN_HARVEST' ? '#10b981' : chosen.type === 'BLIZZARD' ? '#38bdf8' : '#ef4444',
          size: 0, life: 50, maxLife: 50, vx: 0, vy: -0.7,
          type: 'FLOAT_TEXT',
          text: `⚠️ SỰ KIỆN: ${chosen.name}!`
        });
      }

      if (data.activeSeasonEvent) {
        data.activeSeasonEvent.remainingTime -= 1;
        if (data.activeSeasonEvent.remainingTime <= 0) {
          data.activeSeasonEvent = null;
        }
      }

      // Chu kỳ chuyển dịch thời tiết tự nhiên mỗi 80s (Nắng nhẹ -> Mây trôi -> Mưa lất phất)
      if (weatherEnabledRef.current && data.gameTimeSeconds > 0 && data.gameTimeSeconds % 80 === 0) {
        setWeather(prev => {
          const next: WeatherType = prev === 'CLEAR' ? 'CLOUDY' : prev === 'CLOUDY' ? 'RAIN' : 'CLEAR';
          weatherRef.current = next;
          initWeatherParticles(size as MapDimension, next);
          if (next === 'RAIN') {
            nextLightningTimeRef.current = performance.now() + 2000 + Math.random() * 3000;
          }
          return next;
        });
      }

      // Quyền năng God Mode (Khóa Bất Tử): Tự động hồi phục 999.999 vàng và 99.999 quân
      if (godModeLockedRef.current && nations[1]) {
        nations[1].gold = 999999;
        nations[1].troops = 99999;
        nations[1].maxTroops = Math.max(nations[1].maxTroops, 100000);
      }

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
      data.darkTitans.forEach(titan => {
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
              data.attackWaves = data.attackWaves.filter(w => Math.hypot(w.targetX - ux, w.targetY - uy) > DARK_TITAN_CONFIG.ULT_RADIUS);
              say('☄️ THIÊN THẠCH HẮC ÁM!', '#f97316');
            }
          } else {
            const near = nearestOwned(10);
            const wavesNear = data.attackWaves.filter(w => Math.hypot(w.targetX - titan.x, w.targetY - titan.y) <= 7);
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
              wavesNear.forEach(w => { w.troops = Math.floor(w.troops * 0.85); });
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
                  text: `💥 Tà Thần phá hoại ${BUILDING_INFO[oldBuilding].name}!`,
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
      data.darkTitans = data.darkTitans.filter(t => t.isActive);
      data.darkTitan = data.darkTitans[0] || null;

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

        // Quản lý Tướng đại diện quốc gia & Đếm ngược kỹ năng chủ động
        if (n.general) {
          if (n.general.skillCooldown && n.general.skillCooldown > 0) {
            n.general.skillCooldown -= 1;
          }
          if (n.general.skillActiveTimer && n.general.skillActiveTimer > 0) {
            n.general.skillActiveTimer -= 1;
          }

          if (n.general.status === 'RECOVERING') {
            n.general.reviveTimer -= 1;
            if (n.general.reviveTimer <= 0) {
              n.general.status = 'IDLE';
              n.general.x = n.capitalX;
              n.general.y = n.capitalY;
              if (n.isPlayer) {
                data.particles.push({
                  x: n.capitalX * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  y: n.capitalY * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                  color: '#fbbf24', size: 0, life: 35, maxLife: 35, vx: 0, vy: -0.6,
                  type: 'FLOAT_TEXT', text: `⚔️ ${n.general.name} đã bình phục!`
                });
              }
            }
          } else if (n.general && n.general.status === 'MARCHING') {
            const gen = n.general;
            const activeWave = gen.marchingWaveId 
              ? data.attackWaves.find(w => w.id === gen.marchingWaveId)
              : data.attackWaves.find(w => w.fromNation === n.id && w.hasGeneral);
            if (!activeWave) {
              gen.status = 'IDLE';
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
      if (isEightSec) {
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
        data.tradeShips = data.tradeShips.filter(ship => updatedRoutes.some(r => r.id === ship.routeId));

        updatedRoutes.forEach(route => {
          const countOnRoute = data.tradeShips.filter(s => s.routeId === route.id).length;
          const targetShips = route.isIntercontinental ? 2 : 1;
          if (countOnRoute < targetShips) {
            const cargoGold = route.isIntercontinental ? 120 : 40;
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
      }

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
      const finishedWaves: number[] = [];
      data.attackWaves.forEach((wave, idx) => {
        const isBlizzard = data.activeSeasonEvent?.type === 'BLIZZARD';
        const waveSpeedMult = isBlizzard ? 0 : (gameSpeed * 0.14);

        // Kỹ năng "Hào Quang Khích Lệ" & Công nghệ Quân sự cấp 1 (+10% tốc độ di chuyển quân)
        let generalSpeedMult = 1.0;
        const waveAttacker = data.nations[wave.fromNation];
        if (waveAttacker?.techLevels?.military >= 1) {
          generalSpeedMult *= 1.10;
        }
        if (waveAttacker?.general?.skillId === 'INSPIRE_AURA' && (waveAttacker.general.skillActiveTimer || 0) > 0) {
          const power = getSkillPower(waveAttacker);
          generalSpeedMult += 0.50 * power;
        }

        wave.progress += wave.speed * waveSpeedMult * generalSpeedMult;

        // Kiểm tra va chạm chiến đấu với Tà Thần
        const wavePxX = wave.sourceX + (wave.targetX - wave.sourceX) * wave.progress;
        const wavePxY = wave.sourceY + (wave.targetY - wave.sourceY) * wave.progress;

        data.darkTitans.forEach(titan => {
          if (!titan.isActive) return;
          const distToTitan = Math.hypot(wavePxX - titan.x, wavePxY - titan.y);

          if (distToTitan <= 1.2) {
            const attackerNation = data.nations[wave.fromNation];
            const titanBuff = (attackerNation?.titanBuffTimer && attackerNation.titanBuffTimer > 0) ? 1.30 : 1.0;
            const damageToTitan = Math.floor(wave.troops * 2.2 * titanBuff);

            titan.hp = Math.max(0, (titan.hp ?? DARK_TITAN_CONFIG.MAX_HP) - damageToTitan);

            data.particles.push({
              x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#f43f5e',
              size: 0, life: 25, maxLife: 25, vx: (Math.random() - 0.5) * 0.5, vy: -0.8,
              type: 'FLOAT_TEXT',
              text: `💥 -${damageToTitan} HP`
            });

            wave.troops = Math.max(0, wave.troops - 10);

            // Kiểm tra ĐÁNH GỤC TÀ THẦN
            if (titan.hp <= 0) {
              titan.isActive = false;
              soundManager.playGeneralHorn();

              if (attackerNation) {
                attackerNation.gold += DARK_TITAN_CONFIG.BOUNTY_GOLD;
                attackerNation.titanBuffTimer = DARK_TITAN_CONFIG.BUFF_DURATION_SECONDS;

                data.events.unshift({
                  id: Math.random().toString(),
                  title: '⚔️ TRẢM TÀ THẦN THÀNH CÔNG',
                  description: `👑 Quân đội ${attackerNation.name} đã ĐÁNH GỤC TÀ THẦN CỔ ĐẠI! Nhận +${formatPopulation(DARK_TITAN_CONFIG.BOUNTY_GOLD)} Vàng & Buff Sức Mạnh +30% toàn diện trong 3 phút!`,
                  type: 'HARVEST',
                  targetNationId: attackerNation.id,
                  timestamp: formatGameTime(data.gameTimeSeconds),
                });

                if (attackerNation.isPlayer && !unlockedAchievementsRef.current.has('KILL_TITAN')) {
                  unlockedAchievementsRef.current.add('KILL_TITAN');
                  soundManager.playAchievement();
                  data.particles.push({
                    x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
                    y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
                    color: '#fbbf24', size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.9,
                    type: 'FLOAT_TEXT',
                    text: '🏆 THÀNH TỰU: Diệt Tà Thần Cổ Đại!',
                  });
                }
              }
            }
          }
        });

        if (wave.progress >= 1.0) {
          finishedWaves.push(idx);
          resolveAttackCapture(wave);
        }
      });
      data.attackWaves = data.attackWaves.filter((_, idx) => !finishedWaves.includes(idx));

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

  // --- CÁC HÀM ĐIỀU KHIỂN CHẾ ĐỘ SÁNG TẠO (CREATIVE SANDBOX) ---
  const handleSetGold = (amount: number) => {
    const player = gameDataRef.current.nations[1];
    if (player) {
      player.gold = Math.max(0, amount);
      setHudStats(prev => ({ ...prev, gold: player.gold }));
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
      setHudStats(prev => ({ ...prev, troops: player.troops, maxTroops: player.maxTroops }));
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

  const handleMapTap = (mapX: number, mapY: number, screenX: number, screenY: number) => {
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
    if (data.tradeShips && data.tradeShips.length > 0) {
      let lootedShipIdx = -1;
      for (let i = 0; i < data.tradeShips.length; i++) {
        const ship = data.tradeShips[i];
        const curShipX = ship.sourceX + (ship.targetX - ship.sourceX) * ship.progress;
        const curShipY = ship.sourceY + (ship.targetY - ship.sourceY) * ship.progress;
        const dist = Math.hypot(curShipX - mapX, curShipY - mapY);
        if (dist <= 1.8) {
          lootedShipIdx = i;
          break;
        }
      }

      if (lootedShipIdx >= 0) {
        const ship = data.tradeShips[lootedShipIdx];
        const player = nations[1];
        const lootGold = Math.round(ship.cargoGold * 1.5);
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
        return;
      }
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

    // Tướng xuất chiến dẫn dắt đợt quân (Tướng chiếm 30% sức mạnh)
    let hasGeneral = false;
    if (attacker.general && (attacker.general.status === 'IDLE' || attacker.general.status === 'MARCHING')) {
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

      // Xử lý thương vong của Tướng
      if (wave.hasGeneral && attacker.general && Math.random() < 0.12) {
        attacker.general.status = 'RECOVERING';
        attacker.general.reviveTimer = 15;
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
    }
    if (!continued && wave.troops > 0) {
      attacker.troops += wave.troops; // quân còn dư quay về nhà
      wave.troops = 0;
    }
    offscreenTerritoryDirtyRef.current = true;
  };

  // Pointer Handlers: Thu phóng và di chuyển mượt mà trên điện thoại, triệt tiêu chọn nhầm ô đất
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. Nếu người dùng chạm vào các nút UI, bảng thông tin, minimap, ticker, banner (không phải canvas)
    // thì bỏ qua không xử lý map touch/drag để các nút bấm trên màn hình nhận click 100%.
    if (e.target !== canvasRef.current) {
      return;
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    // Dừng chuyển động camera tự động nếu người chơi chủ động chạm vào màn hình
    cameraAnimRef.current = null;
    const map = pointersMapRef.current;
    map.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (map.size === 1) {
      pointerStartRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, time: Date.now() };
      startCamRef.current = { ...cameraRef.current };
      isDraggingRef.current = false;
      isMultiTouchActiveRef.current = false;
      totalDragDistRef.current = 0;
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    } else if (map.size >= 2) {
      isMultiTouchActiveRef.current = true;
      isDraggingRef.current = true;
      const pts = Array.from(map.values());
      lastPinchDistRef.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      lastPinchMidRef.current = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const map = pointersMapRef.current;
    if (!map.has(e.pointerId)) return;
    map.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (map.size >= 2 && lastPinchDistRef.current !== null && lastPinchDistRef.current > 0) {
      isMultiTouchActiveRef.current = true;
      isDraggingRef.current = true;
      const pts = Array.from(map.values());
      const currentDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const currentMid = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      };

      const prevDist = lastPinchDistRef.current;
      const prevMid = lastPinchMidRef.current || currentMid;

      if (prevDist > 0 && currentDist > 0) {
        // Damping factor: giảm tốc độ zoom để điều khiển mượt mà, không giật tỷ lệ đột ngột
        const deltaDist = currentDist - prevDist;
        const zoomDamping = 0.50;
        const zoomMultiplier = 1 + (deltaDist / prevDist) * zoomDamping;

        const curCam = cameraRef.current;
        const targetZoom = clampZoom(curCam.zoom * zoomMultiplier);

        // Công thức chuẩn chống nhảy camera: giữ tọa độ thế giới tại prevMid khớp với currentMid dưới zoom mới
        const worldX = (prevMid.x - curCam.x) / curCam.zoom;
        const worldY = (prevMid.y - curCam.y) / curCam.zoom;

        const newCamX = currentMid.x - worldX * targetZoom;
        const newCamY = currentMid.y - worldY * targetZoom;

        const clamped = clampCamera(newCamX, newCamY, targetZoom);
        cameraRef.current = { x: clamped.x, y: clamped.y, zoom: targetZoom };
      }

      lastPinchDistRef.current = currentDist;
      lastPinchMidRef.current = currentMid;
    } else if (map.size === 1 && pointerStartRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dist = Math.hypot(dx, dy);

      totalDragDistRef.current += Math.hypot(e.movementX || 0, e.movementY || 0);

      if (dist > 8 || totalDragDistRef.current > 10) {
        isDraggingRef.current = true;
      }

      if (isDraggingRef.current) {
        const newX = startCamRef.current.x + dx;
        const newY = startCamRef.current.y + dy;
        const clamped = clampCamera(newX, newY, cameraRef.current.zoom);
        cameraRef.current = { ...cameraRef.current, x: clamped.x, y: clamped.y };
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const map = pointersMapRef.current;

    // Chỉ nhận tap khi ngón duy nhất, không di chuyển, không đa điểm và thời gian chạm ngắn gọn
    const canTap = map.size === 1 && 
      pointerStartRef.current && 
      pointerStartRef.current.id === e.pointerId && 
      !isDraggingRef.current && 
      !isMultiTouchActiveRef.current &&
      totalDragDistRef.current < 10;

    if (canTap && pointerStartRef.current) {
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dist = Math.hypot(dx, dy);
      const duration = Date.now() - pointerStartRef.current.time;

      if (dist < 8 && duration < 280) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;

          const curCam = cameraRef.current;
          const worldX = (screenX - curCam.x) / curCam.zoom;
          const worldY = (screenY - curCam.y) / curCam.zoom;

          const mapX = Math.floor(worldX / TILE_PIXEL_SIZE);
          const mapY = Math.floor(worldY / TILE_PIXEL_SIZE);

          const size = gameDataRef.current.tiles.length;
          if (mapX >= 0 && mapX < size && mapY >= 0 && mapY < size) {
            handleMapTap(mapX, mapY, e.clientX, e.clientY);
          }
        }
      }
    }

    map.delete(e.pointerId);

    // Chống văng camera khi thả 1 trong 2 ngón: Neo lại vị trí ngón còn lại với vị trí camera hiện tại
    if (map.size === 1) {
      const remaining = Array.from(map.values())[0];
      if (remaining) {
        pointerStartRef.current = {
          id: remaining.id,
          x: remaining.x,
          y: remaining.y,
          time: Date.now()
        };
        startCamRef.current = { ...cameraRef.current };
      }
      isDraggingRef.current = true; // Ngón còn lại sau zoom không thể biến thành click ô đất
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    } else if (map.size === 0) {
      pointerStartRef.current = null;
      isDraggingRef.current = false;
      isMultiTouchActiveRef.current = false;
      totalDragDistRef.current = 0;
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const map = pointersMapRef.current;
    map.delete(e.pointerId);
    if (map.size === 0) {
      pointerStartRef.current = null;
      isDraggingRef.current = false;
      isMultiTouchActiveRef.current = false;
      totalDragDistRef.current = 0;
      lastPinchDistRef.current = null;
      lastPinchMidRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    zoomAroundPoint(screenX, screenY, cameraRef.current.zoom * factor);
  };

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
      
      {/* 1. MÀN HÌNH BẮT ĐẦU VỚI ĐỔI TÊN NGƯỜI CHƠI */}
      {gameState === 'TITLE' && (
        <div 
          className="flex flex-col items-center justify-center flex-1 p-4 text-center bg-gradient-to-b from-slate-900 via-slate-950 to-black overflow-y-auto"
          style={{ 
            paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))', 
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          <div className="max-w-md w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md my-auto">
            <div className="flex justify-center mb-3 text-amber-400">
              <Crown className="w-16 h-16 animate-pulse" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">PIXEL EMPIRE</h1>
            <p className="text-xs sm:text-sm text-slate-400 mb-4 leading-relaxed">
              Bản đồ Trái Đất chuẩn OpenFront. Xuất phát tại Việt Nam, thu phục thuộc địa & chinh phục thế giới!
            </p>

            {/* HỆ THỐNG TÀI KHOẢN CLOUD & ADMIN PANEL */}
            <div className="mb-4">
              <UserAccountBadge
                currentUser={currentUser}
                playerProfile={playerProfile}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
                onSignOut={async () => {
                  await fbSignOut(auth);
                  setCurrentUser(null);
                }}
              />
            </div>

            {/* NÚT ADMIN PANEL (CHỈ HIỂN THỊ KHI ĐĂNG NHẬP ADMIN) */}
            {isUserAdmin(currentUser) && (
              <button
                type="button"
                onClick={() => setIsAdminPanelOpen(true)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-600 text-white font-black rounded-2xl border border-amber-400/80 shadow-xl shadow-amber-950/60 mb-3 flex items-center justify-between text-xs active:scale-95 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>BẢNG ĐIỀU KHIỂN ADMIN (ADMIN PANEL)</span>
                </div>
                <span className="text-[10px] bg-black/40 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold">
                  ⚡ Mở Panel
                </span>
              </button>
            )}

            {/* THẺ HỒ SƠ NGƯỜI CHƠI: CẤP ĐỘ, TIẾN TRÌNH EXP VÀ TIỀN XU PIXEL */}
            {(() => {
              const reqExp = getRequiredExpForNextLevel(playerProfile.level);
              const isMaxLevel = playerProfile.level >= MAX_PLAYER_LEVEL;
              const expPercent = isMaxLevel ? 100 : Math.min(100, Math.floor((playerProfile.exp / (reqExp || 1)) * 100));

              return (
                <div className="mb-5 p-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-2xl border border-amber-500/40 shadow-lg text-left">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-black text-sm shadow">
                        Lv.{playerProfile.level}
                      </div>
                      <div>
                        <div className="text-xs font-black text-amber-300 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>Cấp {playerProfile.level} {isMaxLevel ? '(MAX)' : ''}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {isMaxLevel ? '⭐ Đã đạt cấp độ tối đa' : `${playerProfile.exp} / ${reqExp} EXP`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/40 rounded-xl shadow-inner">
                      <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-black text-amber-300 font-mono">
                        {playerProfile.pixelCoins}
                      </span>
                      <span className="text-[10px] text-amber-400/90 font-bold">Xu</span>
                    </div>
                  </div>

                  {/* Thanh tiến trình EXP */}
                  <div className="w-full bg-slate-800/90 rounded-full h-2 overflow-hidden border border-slate-700/60">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500 shadow-sm shadow-amber-400/50"
                      style={{ width: `${expPercent}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            <div className="space-y-4 mb-6 text-left">
              {/* ĐỔI TÊN NGƯỜI CHƠI */}
              <div>
                <label className="text-xs font-bold text-amber-400 block mb-1.5 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Tên Đế Quốc / Quốc Gia của bạn:
                </label>
                <input
                  type="text"
                  maxLength={24}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Nhập tên quốc gia (vd: Việt Nam)..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-sm focus:border-amber-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Kích thước thế giới:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[64, 96, 128].map(sz => (
                    <button
                      key={sz}
                      onClick={() => setMapSize(sz as MapDimension)}
                      className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        mapSize === sz
                          ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400'
                      }`}
                    >
                      {sz}x{sz} {sz === 96 ? '(Chuẩn)' : sz === 64 ? '(Nhỏ)' : '(Lớn)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* TÁCH BIỆT CHẾ ĐỘ CHƠI: CHIẾN DỊCH & SÁNG TẠO */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Chọn chế độ chơi:</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setGameMode('STANDARD')}
                    className={`py-2.5 px-1 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                      gameMode === 'STANDARD'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>Chiến Thuật Chuẩn</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGameMode('CREATIVE')}
                    className={`py-2.5 px-1 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                      gameMode === 'CREATIVE'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
                    <span>🎨 Sáng Tạo (Sandbox)</span>
                  </button>
                </div>
              </div>

              {gameMode === 'CREATIVE' ? (
                <div className="bg-gradient-to-r from-purple-950/60 to-pink-950/60 border border-purple-500/60 p-3 rounded-2xl space-y-1 shadow-inner">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Đặc Quyền Chế Độ Sáng Tạo:</span>
                  </div>
                  <ul className="text-[11px] text-purple-200/90 list-disc list-inside space-y-0.5">
                    <li>Khởi đầu với 999,999 Vàng & 50,000 Quân đội.</li>
                    <li>Tự do tăng giảm Vàng & Quân tùy thích.</li>
                    <li>Spam và đổi thời tiết: Nắng, Mây, Giông Sét tức thì.</li>
                    <li>Spam và triệu hồi nhiều Tà Thần Cổ Đại càn quét bản đồ.</li>
                    <li>Có nút mở Bảng Điều Khiển Sáng Tạo (God Panel) ngay trên màn hình.</li>
                  </ul>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">Độ khó thử thách:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['EASY', 'NORMAL', 'HARD'] as GameDifficulty[]).map(diff => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setDifficulty(diff)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                          difficulty === diff
                            ? 'bg-amber-600 border-amber-400 text-white shadow-md'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400'
                        }`}
                      >
                        {diff === 'EASY' ? 'Dễ (Khuyên dùng)' : diff === 'NORMAL' ? 'Vừa' : 'Khó'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* NÚT CHỌN TƯỚNG SẢNH CHÍNH */}
            <button
              type="button"
              onClick={() => setIsGeneralSelectOpen(true)}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-600/90 via-amber-700/90 to-amber-800/90 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded-2xl border border-amber-500/50 shadow-lg shadow-amber-950/40 transition-all flex items-center justify-between gap-2 text-sm active:scale-95 mb-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="bg-amber-950/80 p-1.5 rounded-xl border border-amber-500/40 shrink-0">
                  <GeneralModel skillId={playerProfile.selectedGeneral} size={30} />
                </div>
                <div className="text-left truncate">
                  <div className="text-xs text-amber-200 font-bold">🎖️ Chọn Tướng</div>
                  <div className="text-xs text-amber-100/90 truncate">
                    Đang chọn: <span className="font-bold text-white">{GENERAL_ROSTER.find(g => g.skillId === playerProfile.selectedGeneral)?.name || 'Đại Tướng Hắc Phong'}</span>
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold bg-amber-500/30 text-amber-200 px-2.5 py-1 rounded-xl border border-amber-500/40 shrink-0">
                Đổi Tướng ❯
              </span>
            </button>

            {/* NÚT CÂY KỸ NĂNG ĐẾ CHẾ (SẢNH CHÍNH) */}
            <button
              type="button"
              onClick={() => {
                setIsSkillTreeOpen(true);
                soundManager.playClick();
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-700/90 via-teal-700/90 to-cyan-800/90 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-2xl border border-emerald-500/50 shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-between gap-2 text-sm active:scale-95 mb-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="bg-emerald-950/80 p-2 rounded-xl border border-emerald-500/40 shrink-0 text-lg">
                  🌳
                </div>
                <div className="text-left truncate">
                  <div className="text-xs text-emerald-200 font-bold flex items-center gap-1.5">
                    <span>Cây Kỹ Năng Đế Chế</span>
                    {playerProfile.skillPoints > 0 && (
                      <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full font-black animate-pulse">
                        +{playerProfile.skillPoints} Điểm
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-emerald-100/80 truncate">
                    Nâng cấp 3 nhánh: Kinh Tế, Quân Đội, Anh Hùng
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold bg-emerald-500/30 text-emerald-200 px-2.5 py-1 rounded-xl border border-emerald-500/40 shrink-0">
                Mở Cây ❯
              </span>
            </button>

            {savedGameInfo ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={loadGame}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-between min-h-[50px] active:scale-95 border border-emerald-400/40"
                >
                  <div className="flex items-center gap-3 text-left">
                    <RotateCcw className="w-5 h-5 text-emerald-200 shrink-0 animate-spin-slow" />
                    <div>
                      <div className="text-sm font-black leading-tight flex items-center gap-2">
                        Tiếp Tục Ván Cũ
                        <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          {savedGameInfo.mode}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-100/90 font-normal mt-0.5">
                        {savedGameInfo.playerName} • Lưu: {savedGameInfo.timestamp} ({savedGameInfo.gameTimeStr})
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-emerald-200 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmNewGame(true)}
                  className="w-full py-3 px-4 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold rounded-2xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-sm active:scale-95 shadow"
                >
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                  Chơi Mới (Xóa ván cũ)
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startNewGame(difficulty, mapSize, playerName, gameMode)}
                className={`w-full py-4 text-white font-extrabold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-base min-h-[48px] active:scale-95 ${
                  gameMode === 'CREATIVE'
                    ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/40'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/30'
                }`}
              >
                {gameMode === 'CREATIVE' ? (
                  <Wand2 className="w-5 h-5 text-amber-300 animate-pulse" />
                ) : (
                  <Play className="w-5 h-5 fill-current" />
                )}
                {gameMode === 'CREATIVE' ? 'Bắt Đầu Chế Độ Sáng Tạo' : 'Khởi Đầu Chinh Phục'}
              </button>
            )}

            {/* NÚT TẠO / VÀO PHÒNG CHƠI VỚI BẠN BÈ (MULTIPLAYER LOBBY) */}
            <div className="pt-3 border-t border-slate-800/80 mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setIsMultiplayerModalOpen(true)}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 text-sm border border-indigo-400/40 transition-all min-h-[48px]"
              >
                <Users className="w-5 h-5 text-amber-300 animate-pulse" />
                <span>🎮 Tạo & Vào Phòng Chơi Với Bạn Bè</span>
              </button>

              {/* NÚT CÀI ĐẶT APP VỀ MÁY ĐỂ CHƠI OFFLINE (PWA) */}
              <PWAInstallButton />
            </div>
          </div>
        </div>
      )}

      {/* 2. MÀN HÌNH CHƠI CHÍNH */}
      {(gameState === 'PLAYING' || gameState === 'VICTORY' || gameState === 'DEFEAT') && (
        <>
          {/* THANH ĐIỀU HÀNH & NÚT CỐ ĐỊNH GÓC TRÊN */}
          <header 
            className="flex flex-wrap items-center justify-between px-2 py-1.5 sm:px-3 sm:py-2 bg-slate-900/95 border-b border-slate-800 z-40 shrink-0 gap-2"
            style={{ 
              paddingTop: 'max(0.375rem, env(safe-area-inset-top, 0px))',
              paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))'
            }}
          >
            {/* THỐNG KÊ TÀI NGUYÊN (TỰ CO CO GIÃN HỢP LÝ TRÊN MÀN HÌNH NHỎ) */}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg sm:rounded-xl border border-slate-800 shrink-0">
                <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-300">{hudStats.gold}</span>
                <span className="text-[10px] text-emerald-400 font-mono hidden xs:inline">+{hudStats.goldIncome}/s</span>
              </div>

              <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg sm:rounded-xl border border-slate-800 shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
                <span className="text-xs font-bold text-blue-300">{hudStats.troops}</span>
                <span className="text-[10px] text-slate-400 font-mono hidden xs:inline">/{hudStats.maxTroops}</span>
              </div>

              <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg sm:rounded-xl border border-slate-800 shrink-0">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-emerald-300">{hudStats.landPercent}%</span>
              </div>

              {/* CẤP ĐỘ (LEVEL) & TIỀN XU PIXEL CỦA NGƯỜI CHƠI */}
              <div 
                className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg sm:rounded-xl border border-amber-500/30 shrink-0 cursor-default"
                title={`Cấp ${playerProfile.level} • ${playerProfile.level >= MAX_PLAYER_LEVEL ? 'MAX CẤP' : `${playerProfile.exp}/${getRequiredExpForNextLevel(playerProfile.level)} EXP`}`}
              >
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-300">Lv.{playerProfile.level}</span>
              </div>

              <div 
                className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg sm:rounded-xl border border-amber-500/30 shrink-0 cursor-default"
                title={`${playerProfile.pixelCoins} Tiền xu Pixel`}
              >
                <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-mono font-bold text-amber-300">{playerProfile.pixelCoins}</span>
                <span className="text-[10px] text-amber-400/80 font-bold hidden sm:inline">Xu</span>
              </div>

              {hudStats.titanBuffTimer > 0 && (
                <div className="flex items-center gap-1 bg-amber-950/90 px-2 py-1 rounded-lg sm:rounded-xl border border-amber-500/60 shadow-lg shadow-amber-500/20 shrink-0 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="text-xs font-black text-amber-300">
                    🔥 Buff Tà Thần (+30%): {Math.floor(hudStats.titanBuffTimer / 60)}:{(hudStats.titanBuffTimer % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}

              {isMultiplayer && multiplayerRoom && (
                <div className="flex items-center gap-1 bg-indigo-950/90 px-2 py-1 rounded-lg sm:rounded-xl border border-indigo-500/50 shrink-0">
                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-xs font-mono font-bold text-indigo-200">Phòng: {multiplayerRoom.code}</span>
                </div>
              )}
            </div>

            {/* BANNER THÔNG BÁO NHIỀU NGƯỜI CHƠI (NGƯỜI CHƠI RỜI PHÒNG / BOT TIẾP QUẢN) */}
            {multiplayerBanner && (
              <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-xs animate-in slide-in-from-top border border-amber-300">
                <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
                <span>{multiplayerBanner}</span>
              </div>
            )}

            {/* CỤM ĐIỀU KHIỂN CỐ ĐỊNH GÓC PHẢI - LUÔN HIỂN THỊ, KHÔNG BỊ TRÀN HAY CHE KHUẤT */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1.5">
              {/* NÚT MỞ BẢNG ĐIỀU KHIỂN SÁNG TẠO (CHỈ XUẤT HIỆN TRONG CHẾ ĐỘ CREATIVE) */}
              {gameMode === 'CREATIVE' && (
                <button
                  onClick={() => {
                    setIsCreativeOpen(true);
                    soundManager.playClick();
                  }}
                  className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-pink-500 active:scale-95 text-white font-extrabold rounded-lg text-xs flex items-center gap-1 shadow-lg shadow-purple-500/40 border border-purple-400/60 min-h-[36px]"
                  title="Mở Bảng Điều Khiển Sáng Tạo (Sandbox)"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
                  <span className="font-mono text-[11px]">Sáng Tạo</span>
                </button>
              )}

              {/* NÚT ADMIN PANEL TRONG TRẬN ĐẤU (CHỈ ADMIN THẤY) */}
              {isUserAdmin(currentUser) && (
                <button
                  onClick={() => {
                    setIsAdminPanelOpen(true);
                    soundManager.playClick();
                  }}
                  className="px-2 py-1.5 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-white font-black rounded-lg text-xs flex items-center gap-1 border border-amber-400/80 shadow-md shadow-amber-950/40 min-h-[36px]"
                  title="Mở Bảng Điều Khiển Admin (Chỉ Admin thấy)"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span className="font-mono text-[11px] hidden xs:inline">Admin</span>
                </button>
              )}


              <button
                onClick={() => setGameSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1)}
                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-lg text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1 min-h-[36px]"
                title="Tốc độ trận đấu"
              >
                <FastForward className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-mono">{gameSpeed}x</span>
              </button>

              {/* NÚT THỜI TIẾT (MÂY TRÔI / MƯA RÀO / NẮNG NHẸ) */}
              <button
                onClick={cycleWeather}
                title={`Thời tiết: ${weather === 'RAIN' ? 'Mưa lất phất' : weather === 'CLOUDY' ? 'Mây bồng bềnh' : 'Nắng nhẹ'} (Bấm để đổi)`}
                className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-lg border border-slate-700 min-h-[36px] min-w-[36px] flex items-center justify-center transition-all shadow"
              >
                {weather === 'RAIN' ? (
                  <CloudRain className="w-4 h-4 text-sky-400 animate-pulse" />
                ) : weather === 'CLOUDY' ? (
                  <Cloud className="w-4 h-4 text-indigo-300" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-400" />
                )}
              </button>

              <button
                onClick={() => {
                  setIsPaused(prev => {
                    const next = !prev;
                    if (next) saveGameRef.current();
                    return next;
                  });
                  soundManager.playClick();
                }}
                title={isPaused ? "Tiếp tục" : "Tạm dừng"}
                className={`p-2 active:scale-95 rounded-lg border min-h-[36px] min-w-[36px] flex items-center justify-center transition-all shadow ${
                  isPaused 
                    ? 'bg-emerald-600 border-emerald-400 text-white animate-pulse' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                {isPaused ? <Play className="w-4 h-4 fill-current text-white" /> : <Pause className="w-4 h-4" />}
              </button>

              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  soundManager.playClick();
                }}
                title="Cài đặt trận đấu"
                className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-lg text-amber-400 border border-slate-700 min-h-[36px] min-w-[36px] flex items-center justify-center shadow"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* NÚT MỞ BỆ PHÓNG TÊN LỬA LỚN, DỄ CHẠM TRÊN ĐIỆN THOẠI */}
              <button
                onClick={() => {
                  setIsMissileOpen(true);
                  soundManager.playClick();
                }}
                className="px-2.5 py-1.5 bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/40 border border-rose-400/60 min-h-[38px] animate-pulse"
                title="Bệ Phóng Tên Lửa Hạt Nhân"
              >
                <Rocket className="w-4 h-4 text-amber-300" />
                <span className="font-mono text-xs">🚀 Tên Lửa</span>
              </button>
            </div>
          </header>

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

            {/* THẺ THÔNG TIN LÃNH THỔ CỐ ĐỊNH PHÍA DƯỚI (DẠNG LƯỚI TỐI ƯU CỰC KỲ GỌN GÀNG) */}
            {selectedTile && (
              <div 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-2 left-2 right-2 sm:left-auto sm:right-3 sm:w-80 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md z-30 animate-in fade-in slide-in-from-bottom duration-150"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1 truncate">
                      {selectedTile.owner === 1 ? (
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                      <span className="truncate">
                        {selectedTile.owner === 1 
                          ? `${playerName} (Chủ quyền)` 
                          : selectedTile.owner > 1 
                          ? gameDataRef.current.nations[selectedTile.owner]?.name || 'Vùng đất'
                          : 'Đất hoang trung lập'}
                      </span>
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedTile(null);
                      selectedTileRef.current = null;
                    }} 
                    className="p-1 text-slate-400 hover:text-white rounded-lg active:bg-slate-800 shrink-0 ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* THÔNG SỐ BẢNG LƯỚI CỰC KỲ GỌN GÀNG CHỐNG TRÀN */}
                <div className="grid grid-cols-2 gap-1 my-1.5 p-1.5 bg-slate-950/70 rounded-xl border border-slate-800 text-[10px] sm:text-[11px]">
                  <div>
                    <span className="text-slate-400">Tọa độ: </span>
                    <strong className="text-white font-mono">({selectedTile.x}, {selectedTile.y})</strong>
                  </div>
                  <div className="truncate">
                    <span className="text-slate-400">Địa hình: </span>
                    <strong className="text-white">
                      {selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng' : 'Núi'}
                    </strong>
                    {selectedTile.hasHarborAccess && <span className="text-cyan-400 font-semibold ml-0.5">(Biển)</span>}
                  </div>
                  <div>
                    <span className="text-slate-400">Công trình: </span>
                    <strong className="text-amber-400">
                      {selectedTile.building !== 'NONE' 
                        ? `${BUILDING_INFO[selectedTile.building].name} (${(selectedTile.buildingLevel || 1) > 1 ? `Cấp ${selectedTile.buildingLevel}` : 'Lv.1'})` 
                        : 'Trống'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Dân số: </span>
                    <strong className="text-slate-200">
                      {formatPopulation(gameDataRef.current.nations[selectedTile.owner]?.population || 0)}
                    </strong>
                  </div>
                </div>

                {/* THAO TÁC THEO CHỦ QUYỀN */}
                <>
                {selectedTile.owner === 1 && (
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Chủ sở hữu: <strong className="text-amber-300">Bạn</strong></span>

                      <button
                        onClick={() => setIsBuildOpen(true)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{selectedTile.building !== 'NONE' ? `🏢 Xây Chồng Cấp ${(selectedTile.buildingLevel || 1) + 1}` : 'Xây Gộp Công Trình'}</span>
                      </button>
                    </div>

                    {selectedTile.building === 'ARTILLERY' && (
                      <button
                        onClick={() => {
                          const player = gameDataRef.current.nations[1];
                          const cost = 25;
                          if (player.gold >= cost) {
                            player.gold -= cost;
                            const gunnerLvl = selectedTile.buildingLevel || 1;
                            const artilleryDamage = 25 * gunnerLvl;
                            const maxRange = 6.5 + Math.min(3, gunnerLvl - 1);

                            // Tìm kẻ địch gần nhất trong tầm ngắm để pháo kích mục tiêu
                            let targetTile: Tile | null = null;
                            let minDist = Infinity;
                            const tiles = gameDataRef.current.tiles;
                            const size = tiles.length;

                            for (let y = 0; y < size; y++) {
                              for (let x = 0; x < size; x++) {
                                const candidate = tiles[y][x];
                                if (candidate.owner > 0 && candidate.owner !== 1) {
                                  const dist = Math.hypot(candidate.x - selectedTile.x, candidate.y - selectedTile.y);
                                  if (dist <= maxRange && dist < minDist) {
                                    minDist = dist;
                                    targetTile = candidate;
                                  }
                                }
                              }
                            }

                            if (targetTile) {
                              const enemyNat = gameDataRef.current.nations[targetTile.owner];
                              if (enemyNat) {
                                enemyNat.troops = Math.max(0, enemyNat.troops - artilleryDamage);
                              }
                              targetTile.scorchedTimer = 35;

                              // Hiệu ứng hạt đường đạn neon (Neon Projectile Tracer Particle) bắn từ Artillery đến mục tiêu
                              const startPxX = selectedTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                              const startPxY = selectedTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                              const endPxX = targetTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                              const endPxY = targetTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

                              for (let step = 0; step < 12; step++) {
                                const ratio = step / 12;
                                gameDataRef.current.particles.push({
                                  x: startPxX + (endPxX - startPxX) * ratio,
                                  y: startPxY + (endPxY - startPxY) * ratio,
                                  color: '#38bdf8',
                                  size: 3.5,
                                  life: 25 + step * 2,
                                  maxLife: 45,
                                  vx: 0,
                                  vy: 0,
                                  type: 'SPARK',
                                });
                              }

                              // HIỆU ỨNG VỤ NỔ HÌNH BÁN CẦU TỎA RA (Hemispherical Explosion Particle Burst) tại vị trí trúng đạn
                              for (let p = 0; p < 24; p++) {
                                const angle = Math.PI + Math.random() * Math.PI; // Nửa bán cầu trên tỏa ra kịch tính
                                const speed = 1.5 + Math.random() * 3.5;
                                gameDataRef.current.particles.push({
                                  x: endPxX,
                                  y: endPxY,
                                  color: p % 2 === 0 ? '#f97316' : '#ef4444',
                                  size: 3 + Math.random() * 3,
                                  life: 30 + Math.floor(Math.random() * 15),
                                  maxLife: 45,
                                  vx: Math.cos(angle) * speed,
                                  vy: Math.sin(angle) * speed - 0.8, // Tạo vòm bán cầu bay lên
                                  type: 'SPARK',
                                });
                              }

                              gameDataRef.current.particles.push({
                                x: endPxX,
                                y: endPxY,
                                color: '#fbbf24',
                                size: 0,
                                life: 40,
                                maxLife: 40,
                                vx: 0,
                                vy: -0.8,
                                type: 'FLOAT_TEXT',
                                text: `💥 -${artilleryDamage} Pháo Kích Trúng Đích!`
                              });

                              soundManager.playAttack();
                            } else {
                              gameDataRef.current.particles.push({
                                x: selectedTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                                y: selectedTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                                color: '#ef4444',
                                size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
                                type: 'FLOAT_TEXT',
                                text: '⚠️ Không có mục tiêu địch trong tầm ngắm!'
                              });
                            }
                          }
                        }}
                        className="w-full py-2.5 px-3 bg-gradient-to-r from-red-600 via-amber-600 to-yellow-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-red-500/40 border-2 border-amber-300 animate-pulse"
                      >
                        <Crosshair className="w-5 h-5 text-amber-200 animate-spin-slow shrink-0" />
                        <span>🎯 KHAI HỎA PHÁO KÍCH (25 Vàng)</span>
                      </button>
                    )}
                  </div>
                  )}
                  {(() => {
                    const playerNation = gameDataRef.current.nations[1];
                    const ownerNation = gameDataRef.current.nations[selectedTile.owner];
                    const isTribe = ownerNation && ownerNation.colonyCategory === 'TRIBE';
                    const neighborTiles = [
                      [selectedTile.x + 1, selectedTile.y], [selectedTile.x - 1, selectedTile.y], 
                      [selectedTile.x, selectedTile.y + 1], [selectedTile.x, selectedTile.y - 1]
                    ];
                    const isAdjacent = neighborTiles.some(([nx, ny]) => gameDataRef.current.tiles[ny]?.[nx]?.owner === 1);

                    if (isTribe && isAdjacent) {
                      return (
                        <div className="pt-1 border-t border-slate-800 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-amber-300 truncate">Bộ lạc lân cận</span>
                          <button
                            onClick={() => {
                              const player = gameDataRef.current.nations[1];
                              if (player.gold >= 80) {
                                player.gold -= 80;
                                selectedTile.owner = 1;
                                player.population += 10;
                                soundManager.playCapture();
                                setSelectedTile({ ...selectedTile, owner: 1 });
                                selectedTileRef.current = { ...selectedTile, owner: 1 };
                                offscreenTerritoryDirtyRef.current = true;
                              }
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow shrink-0"
                          >
                            <span>⛺ Thu Phục (80 Vàng)</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-800/80 flex items-center justify-between gap-1">
                        <span className="truncate">
                          Chủ quản: <strong className="text-slate-200">
                            {selectedTile.owner === 1 
                              ? 'Lãnh thổ của bạn 👑' 
                              : (ownerNation?.name || 'Đất hoang')}
                          </strong>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* CHỈ HIỂN THỊ NGOẠI GIAO TRÊN ĐẤT CỦA BOT / QUỐC GIA KHÁC (owner > 1). KHÔNG HIỂN THỊ TRÊN ĐẤT CỦA MÌNH HOẶC ĐẤT HOANG */}
                          {selectedTile.owner > 1 && ownerNation && !ownerNation.colonyCategory && (
                            <button
                              onClick={() => {
                                setIsDiplomacyOpen(true);
                                soundManager.playClick();
                              }}
                              className="px-2 py-1 bg-blue-600/90 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow"
                            >
                              <Handshake className="w-3 h-3" />
                              <span>Ngoại Giao</span>
                            </button>
                          )}

                          {/* NÚT XÂY DỰNG NHANH TRÊN ĐẤT CỦA MÌNH */}
                          {selectedTile.owner === 1 && (
                            <button
                              onClick={() => {
                                setIsBuildOpen(true);
                                soundManager.playClick();
                              }}
                              className="px-2 py-1 bg-amber-600/90 hover:bg-amber-500 active:scale-95 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow"
                            >
                              <Building2 className="w-3 h-3" />
                              <span>Xây Dựng</span>
                            </button>
                          )}

                          {/* TRẠNG THÁI LIÊN MINH SẮT SON: HOÀN TOÀN KHÔNG HIỆN NÚT TẤN CÔNG */}
                          {selectedTile.owner > 1 && playerNation?.diplomacy[selectedTile.owner]?.status === 'ALLIANCE' && (
                            <div className="px-2 py-1 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold rounded-lg text-[11px] flex items-center gap-1 shadow">
                              <Handshake className="w-3 h-3 text-emerald-400" />
                              <span>Đồng Minh Sắt Son 🤝</span>
                            </div>
                          )}

                          {/* TRẠNG THÁI HIỆP ƯỚC ĐÌNH CHIẾN: ĐÓNG BĂNG GIAO TRANH 45S */}
                          {selectedTile.owner > 1 && playerNation?.diplomacy[selectedTile.owner]?.status === 'TRUCE' && (
                            <div className="px-2 py-1 bg-blue-950/80 border border-blue-500/50 text-blue-300 font-bold rounded-lg text-[11px] flex items-center gap-1 shadow">
                              <Shield className="w-3 h-3 text-blue-400" />
                              <span>Đang Đình Chiến ({Math.ceil(playerNation.diplomacy[selectedTile.owner]?.truceTimer || 45)}s)</span>
                            </div>
                          )}

                          {/* NÚT TẤN CÔNG / MỞ RỘNG: CHỈ HIỂN THỊ KHI ĐẤT HOANG (owner === 0) HOẶC ĐANG CHIẾN TRANH (status === 'WAR') */}
                          {selectedTile.owner !== 1 && (selectedTile.owner === 0 || playerNation?.diplomacy[selectedTile.owner]?.status === 'WAR') && (
                            <button
                              onClick={() => {
                                const player = gameDataRef.current.nations[1];
                                if (player.troops >= 5) {
                                  const neighborTiles = [
                                    [selectedTile.x + 1, selectedTile.y], [selectedTile.x - 1, selectedTile.y],
                                    [selectedTile.x, selectedTile.y + 1], [selectedTile.x, selectedTile.y - 1]
                                  ];
                                  const isAdjacent = neighborTiles.some(([nx, ny]) => gameDataRef.current.tiles[ny]?.[nx]?.owner === 1);
                                  if (!isAdjacent && (!player.hasPort || !selectedTile.hasHarborAccess)) {
                                    soundManager.playClick();
                                    return;
                                  }

                                  const isNeutral = selectedTile.owner === 0;
                                  let customQueue: { x: number; y: number }[] | undefined = undefined;

                                  if (isNeutral) {
                                    const tiles = gameDataRef.current.tiles;
                                    const size = tiles.length;
                                    const q: { x: number; y: number }[] = [];
                                    const visited = new Set<string>();

                                    visited.add(`${selectedTile.x},${selectedTile.y}`);
                                    q.push({ x: selectedTile.x, y: selectedTile.y });

                                    let head = 0;
                                    while (head < q.length && q.length < 25) {
                                      const cur = q[head++];
                                      const nb = [
                                        { x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y },
                                        { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 },
                                      ];
                                      for (const n of nb) {
                                        if (n.x >= 0 && n.x < size && n.y >= 0 && n.y < size) {
                                          const k = `${n.x},${n.y}`;
                                          const t = tiles[n.y][n.x];
                                          if (!visited.has(k) && t.owner === 0 && t.terrain !== 'WATER') {
                                            visited.add(k);
                                            q.push(n);
                                            if (q.length >= 25) break;
                                          }
                                        }
                                      }
                                    }
                                    customQueue = q;
                                  }

                                  let bestSource: Tile | null = null;
                                  let minDistance = Infinity;
                                  const tiles = gameDataRef.current.tiles;
                                  for (let y = 0; y < tiles.length; y++) {
                                    for (let x = 0; x < tiles.length; x++) {
                                      const t = tiles[y][x];
                                      if (t.owner === 1) {
                                        const dist = Math.hypot(t.x - selectedTile.x, t.y - selectedTile.y);
                                        if (dist < minDistance) {
                                          minDistance = dist;
                                          bestSource = t;
                                        }
                                      }
                                    }
                                  }
                                  if (bestSource) {
                                    const troopsToSend = Math.max(5, Math.floor(player.troops * (attackPercent / 100)));
                                    launchAttackWave(1, selectedTile.owner, bestSource, selectedTile, troopsToSend, customQueue);
                                  }
                                }
                              }}
                              className={`px-2 py-1 font-bold rounded-lg text-[11px] flex items-center gap-1 shadow active:scale-95 text-white ${
                                selectedTile.owner === 0 ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
                              }`}
                            >
                              <Swords className="w-3 h-3" />
                              <span>
                                {selectedTile.owner === 0 
                                  ? `Mở Rộng Đất Hoang (${actualAttackTroops} Quân)` 
                                  : `Tấn Công (${actualAttackTroops} Quân)`}
                              </span>
                            </button>
                          )}
                        </div>

                      {/* NÚT BẮN PHÁO KÍCH TRỰC TIẾP TẠI BẢNG MỤC TIÊU ĐỊCH / TRUNG LẬP */}
                        {(() => {
                          const player = gameDataRef.current.nations[1];
                          const isAllyOrTruce = selectedTile.owner > 1 && 
                            (player.diplomacy[selectedTile.owner]?.status === 'ALLIANCE' || player.diplomacy[selectedTile.owner]?.status === 'TRUCE');
                          if (selectedTile.owner === 1 || isAllyOrTruce) return null;

                          const tiles = gameDataRef.current.tiles;
                          let nearestArtillery: Tile | null = null;
                          let minArtDist = Infinity;

                          for (let y = 0; y < tiles.length; y++) {
                            for (let x = 0; x < tiles.length; x++) {
                              const t = tiles[y][x];
                              if (t.owner === 1 && t.building === 'ARTILLERY') {
                                const dist = Math.hypot(t.x - selectedTile.x, t.y - selectedTile.y);
                                const maxRange = 6.5 + Math.min(3, (t.buildingLevel || 1) - 1);
                                if (dist <= maxRange && dist < minArtDist) {
                                  minArtDist = dist;
                                  nearestArtillery = t;
                                }
                              }
                            }
                          }

                          if (!nearestArtillery) return null;

                          return (
                            <button
                              onClick={() => {
                                const cost = 25;
                                if (player.gold >= cost && nearestArtillery) {
                                  player.gold -= cost;
                                  const gunnerLvl = nearestArtillery.buildingLevel || 1;
                                  const artilleryDamage = 25 * gunnerLvl;

                                  const enemyNat = selectedTile.owner > 0 ? gameDataRef.current.nations[selectedTile.owner] : null;
                                  if (enemyNat) {
                                    enemyNat.troops = Math.max(0, enemyNat.troops - artilleryDamage);
                                  }
                                  selectedTile.scorchedTimer = 35;

                                  const startPxX = nearestArtillery.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                                  const startPxY = nearestArtillery.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                                  const endPxX = selectedTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;
                                  const endPxY = selectedTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2;

                                  // Đường đạn neon tracer
                                  for (let step = 0; step < 12; step++) {
                                    const ratio = step / 12;
                                    gameDataRef.current.particles.push({
                                      x: startPxX + (endPxX - startPxX) * ratio,
                                      y: startPxY + (endPxY - startPxY) * ratio,
                                      color: '#38bdf8',
                                      size: 3.5,
                                      life: 25 + step * 2,
                                      maxLife: 45,
                                      vx: 0,
                                      vy: 0,
                                      type: 'SPARK',
                                    });
                                  }

                                  // Vụ nổ bán cầu
                                  for (let p = 0; p < 24; p++) {
                                    const angle = Math.PI + Math.random() * Math.PI;
                                    const speed = 1.5 + Math.random() * 3.5;
                                    gameDataRef.current.particles.push({
                                      x: endPxX,
                                      y: endPxY,
                                      color: p % 2 === 0 ? '#f97316' : '#ef4444',
                                      size: 3 + Math.random() * 3,
                                      life: 30 + Math.floor(Math.random() * 15),
                                      maxLife: 45,
                                      vx: Math.cos(angle) * speed,
                                      vy: Math.sin(angle) * speed - 0.8,
                                      type: 'SPARK',
                                    });
                                  }

                                  gameDataRef.current.particles.push({
                                    x: endPxX,
                                    y: endPxY,
                                    color: '#fbbf24',
                                    size: 0,
                                    life: 40,
                                    maxLife: 40,
                                    vx: 0,
                                    vy: -0.8,
                                    type: 'FLOAT_TEXT',
                                    text: `💥 -${artilleryDamage} Pháo Kích Trúng Đích!`
                                  });

                                  soundManager.playAttack();
                                } else {
                                  gameDataRef.current.particles.push({
                                    x: selectedTile.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                                    y: selectedTile.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
                                    color: '#ef4444',
                                    size: 0, life: 30, maxLife: 30, vx: 0, vy: -0.6,
                                    type: 'FLOAT_TEXT',
                                    text: nearestArtillery ? '⚠️ Không đủ 25 Vàng!' : '⚠️ Không có Đại Pháo trong tầm ngắm (6.5 ô)!'
                                  });
                                }
                              }}
                              className="w-full mt-1.5 py-2 px-3 bg-gradient-to-r from-red-600 via-amber-600 to-yellow-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg border-2 border-amber-300 animate-pulse"
                            >
                              <Crosshair className="w-4 h-4 text-amber-200 animate-spin-slow shrink-0" />
                              <span>🎯 Bắn Pháo Kích Vào Ô Này (25 Vàng)</span>
                            </button>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </>

                {/* NÚT TIẾN CÔNG TÀ THẦN NẾU ĐANG CÓ TÀ THẦN Ở Ô NÀY */}
                {(() => {
                  const titanOnTile = (gameDataRef.current.darkTitans || []).find(
                    t => t.isActive && t.x === selectedTile.x && t.y === selectedTile.y
                  ) || (
                    gameDataRef.current.darkTitan?.isActive &&
                    gameDataRef.current.darkTitan.x === selectedTile.x &&
                    gameDataRef.current.darkTitan.y === selectedTile.y
                      ? gameDataRef.current.darkTitan
                      : null
                  );

                  if (!titanOnTile) return null;

                  return (
                    <div className="mt-1.5 pt-1.5 border-t border-purple-800/80">
                      <button
                        onClick={() => {
                          const player = gameDataRef.current.nations[1];
                          if (player.troops >= 5) {
                            let bestSource: Tile | null = null;
                            let minDistance = Infinity;
                            const tiles = gameDataRef.current.tiles;
                            for (let y = 0; y < tiles.length; y++) {
                              for (let x = 0; x < tiles.length; x++) {
                                const t = tiles[y][x];
                                if (t.owner === 1) {
                                  const dist = Math.hypot(t.x - selectedTile.x, t.y - selectedTile.y);
                                  if (dist < minDistance) {
                                    minDistance = dist;
                                    bestSource = t;
                                  }
                                }
                              }
                            }
                            if (bestSource) {
                              const troopsToSend = Math.max(5, Math.floor(player.troops * (attackPercent / 100)));
                              launchAttackWave(1, 0, bestSource, selectedTile, troopsToSend);
                              soundManager.playGeneralHorn();
                            }
                          }
                        }}
                        className="w-full py-1.5 px-2 bg-gradient-to-r from-red-600 via-purple-600 to-amber-600 hover:from-red-500 hover:to-amber-500 active:scale-95 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/30 border border-purple-400/50"
                      >
                        <Swords className="w-4 h-4 text-amber-300" />
                        <span>⚔️ Diệt Tà Thần ({actualAttackTroops} Quân) — HP: {titanOnTile.hp ?? 1200}/{titanOnTile.maxHp ?? 1200}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>


          {/* THANH DƯỚI CÙNG: THANH TRƯỢT ĐIỀU QUÂN & CÔNG CỤ TINH GỌN */}
          <footer 
            className="bg-slate-900/95 border-t border-slate-800 p-2 sm:p-2.5 z-20 shrink-0"
            style={{ 
              paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))'
            }}
          >
            {/* HÀNG SLIDER CHỈNH QUÂN ĐỘI & TRẠNG THÁI TƯỚNG GỌN GÀNG */}
            <div className="bg-slate-950/80 px-2.5 py-2 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-300 flex items-center gap-1">
                  <Swords className="w-4 h-4 text-amber-400" /> Tỉ lệ xuất quân:
                </span>
                <span className="text-amber-400 font-mono text-[11px]">
                  {attackPercent}% → <strong className="text-white font-extrabold">{actualAttackTroops} Quân</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={attackPercent}
                  onChange={(e) => setAttackPercent(Number(e.target.value))}
                  className="w-full h-4 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />

                {/* Các nút bấm nhanh 25%, 50%, 75%, 100% - Tăng touch target */}
                <div className="flex items-center gap-1 shrink-0">
                  {[25, 50, 75, 100].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setAttackPercent(pct)}
                      className={`px-2.5 py-1.5 rounded text-[10px] font-bold border transition-all ${
                        attackPercent === pct
                          ? 'bg-amber-500 border-amber-300 text-slate-950 font-extrabold'
                          : 'bg-slate-800 border-slate-700/80 text-slate-400'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* TRẠNG THÁI TƯỚNG & KỸ NĂNG CHỦ ĐỘNG */}
              {(() => {
                const pGen = gameDataRef.current.nations[1]?.general;
                if (!pGen) return null;
                const isMarching = pGen.status === 'MARCHING';
                const isInjured = pGen.status === 'RECOVERING';
                const rosterItem = GENERAL_ROSTER.find(r => r.skillId === pGen.skillId) || GENERAL_ROSTER[0];
                const isSkillActive = (pGen.skillActiveTimer || 0) > 0;
                const isSkillOnCooldown = (pGen.skillCooldown || 0) > 0;
                const canUseSkill = !isInjured && !isSkillOnCooldown;

                return (
                  <div className="flex flex-col gap-1.5 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-slate-300 shadow">
                    <div className="flex items-center justify-between text-[11px] gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-400 truncate">
                        <GeneralModel skillId={pGen.skillId} size={24} />
                        <span className="truncate">{pGen.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          isMarching 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse' 
                            : isInjured 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {isMarching ? '⚔️ Ra Trận' : isInjured ? `🤕 Hồi (${pGen.reviveTimer}s)` : '🛡️ Thủ Đô'}
                        </span>

                        {!isInjured && (
                          <button
                            onClick={() => {
                              setPlayerGeneralDeployMode(prev => !prev);
                              soundManager.playClick();
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              playerGeneralDeployMode 
                                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' 
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            {playerGeneralDeployMode ? '⚔️ Xuất Kèm' : '🛡️ Giữ Thủ'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* NÚT KỸ NĂNG CHỦ ĐỘNG: ĐỦ LỚN CHO NGÓN TAY TRÊN ĐIỆN THOẠI */}
                    <button
                      onClick={() => {
                        if (canUseSkill) {
                          activateGeneralSkill(1);
                        } else {
                          soundManager.playClick();
                        }
                      }}
                      disabled={!canUseSkill}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between transition-all border shadow active:scale-98 min-h-[38px] ${
                        isInjured
                          ? 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                          : isSkillActive
                          ? 'bg-gradient-to-r from-amber-600/30 via-yellow-600/40 to-amber-600/30 border-amber-400/90 text-amber-200 animate-pulse shadow-amber-500/20'
                          : isSkillOnCooldown
                          ? 'bg-slate-800/90 border-slate-700/80 text-slate-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:brightness-110 border-amber-400 text-slate-950 font-black shadow-lg shadow-amber-900/30'
                      }`}
                      title={rosterItem.description}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-base leading-none shrink-0">{rosterItem.emoji}</span>
                        <div className="flex flex-col text-left truncate">
                          <span className="truncate leading-tight font-extrabold">{rosterItem.skillName}</span>
                          <span className="text-[9px] font-normal opacity-85 truncate">{rosterItem.description}</span>
                        </div>
                      </div>

                      <div className="shrink-0 pl-2 text-right">
                        {isInjured ? (
                          <span className="text-[10px] text-red-400 font-semibold">🔒 Bị Thương</span>
                        ) : isSkillActive ? (
                          <span className="text-[10px] text-amber-200 font-bold bg-amber-950/80 px-2 py-0.5 rounded border border-amber-400/50">
                            ⚡ {pGen.skillActiveTimer}s
                          </span>
                        ) : isSkillOnCooldown ? (
                          <span className="text-[10px] text-slate-400 font-mono bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                            ⏳ {pGen.skillCooldown}s
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-950/80 text-amber-300 font-black px-2 py-0.5 rounded border border-amber-400/60 shadow">
                            KÍCH HOẠT 🔥
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* 4 NÚT HÀNH ĐỘNG GỌN GÀNG, TIẾT KIỆM KHÔNG GIAN BẢN ĐỒ */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => setAutoExpand(!autoExpand)}
                className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 min-h-[38px] ${
                  autoExpand
                    ? 'bg-emerald-700 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <span>🤖 {autoExpand ? 'Tự Động' : 'Tắt'}</span>
              </button>

              <button
                onClick={() => {
                  if (!selectedTile) {
                    const player = gameDataRef.current.nations[1];
                    if (player) {
                      const cap = gameDataRef.current.tiles[player.capitalY]?.[player.capitalX];
                      if (cap) {
                        setSelectedTile(cap);
                        selectedTileRef.current = cap;
                      }
                    }
                  }
                  setIsBuildOpen(true);
                }}
                className="py-2 px-1 bg-amber-600 hover:bg-amber-500 border border-amber-400 text-slate-950 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 shadow active:scale-95 min-h-[38px]"
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Xây Dựng</span>
              </button>

              <button
                disabled={!canTech}
                onClick={() => setIsTechOpen(true)}
                className={`py-2 px-1 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 border transition-all active:scale-95 min-h-[38px] ${
                  canTech
                    ? 'bg-blue-600 hover:bg-blue-500 border-blue-400 text-white shadow'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Công Nghệ</span>
              </button>

              <button
                disabled={!hasMetBot}
                onClick={() => setIsDiplomacyOpen(true)}
                className={`py-2 px-1 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 border transition-all active:scale-95 min-h-[38px] ${
                  hasMetBot
                    ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-400 text-white shadow'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Flag className="w-3.5 h-3.5 shrink-0" />
                <span>Ngoại Giao</span>
              </button>
            </div>
          </footer>
        </>
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

          // Thiết lập Liên Minh Sắt Son 2 chiều (Mutual Alliance - Không bao giờ tấn công sau lưng)
          player.diplomacy[id] = { status: 'ALLIANCE', relation: 100, truceTimer: 0 };
          targetNat.diplomacy[1] = { status: 'ALLIANCE', relation: 100, truceTimer: 0 };

          // Xóa ngay bất kỳ đợt quân tấn công nào đang di chuyển giữa 2 bên
          data.attackWaves = data.attackWaves.filter(w => 
            !( (w.fromNation === 1 && w.toNation === id) || (w.fromNation === id && w.toNation === 1) )
          );

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

      {/* MÀN HÌNH KẾT THÚC */}
      {gameState === 'VICTORY' && (
        <>
          <VictoryConfettiCanvas />
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in">
            <div className="bg-slate-900/95 border border-amber-500/50 rounded-3xl p-5 sm:p-7 max-w-md w-full text-center shadow-2xl shadow-amber-500/20 max-h-[92vh] overflow-y-auto">
              <Award className="w-14 h-14 text-amber-400 mx-auto mb-2 animate-bounce" />
              <h2 className="text-2xl sm:text-3xl font-black text-amber-300 mb-1 tracking-tight">🎉 ĐẠI THỐNG NHẤT!</h2>
              <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                Chúc mừng! Bạn đã chinh phục thành công <strong className="text-amber-400 font-mono text-sm">{hudStats.landPercent}%</strong> bản đồ và xưng bá thiên hạ!
              </p>

              {/* PHẦN THƯỞNG CHIẾN THẮNG: EXP, CẤP ĐỘ VÀ TIỀN XU PIXEL */}
              {victoryReward && (
                <div className="mb-3 p-3.5 bg-gradient-to-br from-amber-950/70 via-slate-900/90 to-amber-950/70 border border-amber-500/60 rounded-2xl text-left shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                      Phần Thưởng Chiến Thắng
                    </span>
                    {victoryReward.isCreative ? (
                      <span className="text-[10px] text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/40">
                        Chế Độ Sáng Tạo
                      </span>
                    ) : victoryReward.isMultiplayer ? (
                      <span className="text-[10px] text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/40">
                        Tạo Phòng (-50%)
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                        Độ Khó: {difficulty === 'EASY' ? 'Dễ' : difficulty === 'NORMAL' ? 'Vừa' : 'Khó'}
                      </span>
                    )}
                  </div>

                  {victoryReward.isCreative ? (
                    <p className="text-[11px] text-slate-400 italic">
                      ⚠️ Chế độ Sáng Tạo (Sandbox) không nhận được EXP và Tiền xu Pixel.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-2.5">
                        <div className="bg-slate-950/80 border border-amber-500/30 p-2 rounded-xl flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                            <Star className="w-4 h-4 fill-amber-400" />
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">Kinh Nghiệm</div>
                            <div className="text-xs font-black text-amber-300">+{victoryReward.expGained} EXP</div>
                          </div>
                        </div>

                        <div className="bg-slate-950/80 border border-amber-500/30 p-2 rounded-xl flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                            <Coins className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400">Tiền Xu Pixel</div>
                            <div className="text-xs font-black text-amber-300 font-mono">+{victoryReward.coinsGained} Xu 🪙</div>
                          </div>
                        </div>
                      </div>

                      {/* THÔNG BÁO LÊN CẤP ĐẶC BIỆT */}
                      {victoryReward.leveledUp && (
                        <div className="mb-2 p-2 bg-gradient-to-r from-amber-500/30 via-yellow-500/40 to-amber-500/30 border border-amber-400 rounded-xl text-center animate-bounce shadow">
                          <div className="text-xs font-black text-amber-200 flex items-center justify-center gap-1.5">
                            <Crown className="w-4 h-4 text-amber-300" />
                            <span>🎉 CHÚC MỪNG BẠN ĐÃ LÊN CẤP {victoryReward.newLevel}!</span>
                          </div>
                        </div>
                      )}

                      {/* THANH EXP MỚI */}
                      <div>
                        <div className="flex justify-between text-[10px] mb-1 text-slate-300 font-medium">
                          <span>Cấp độ hiện tại: <strong className="text-amber-300 font-bold">Lv.{playerProfile.level}</strong></span>
                          <span>
                            {playerProfile.level >= MAX_PLAYER_LEVEL 
                              ? '⭐ ĐẠT CẤP TỐI ĐA (MAX)' 
                              : `${playerProfile.exp} / ${getRequiredExpForNextLevel(playerProfile.level)} EXP`}
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-700/60">
                          <div 
                            className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500 shadow-sm shadow-amber-400/50"
                            style={{ 
                              width: playerProfile.level >= MAX_PLAYER_LEVEL 
                                ? '100%' 
                                : `${Math.min(100, Math.floor((playerProfile.exp / (getRequiredExpForNextLevel(playerProfile.level) || 1)) * 100))}%` 
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* BẢNG XẾP HẠNG LÃNH THỔ CÁC QUỐC GIA */}
              <MatchLeaderboard
                nations={gameDataRef.current.nations}
                myNationId={myNationIdRef.current || 1}
                totalLand={totalLandCountRef.current || 1}
                isVictory={true}
              />

              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={() => {
                    if (isMultiplayer) {
                      setGameState('TITLE');
                      setIsMultiplayerModalOpen(true);
                    } else {
                      startNewGame(difficulty, mapSize, playerName, gameMode);
                    }
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-black rounded-2xl shadow-xl text-sm min-h-[48px] active:scale-95 transition-all"
                >
                  {isMultiplayer ? 'Quay Lại Phòng Chờ' : 'Chơi Ván Mới Chinh Phục'}
                </button>
                {isMultiplayer && (
                  <button
                    onClick={() => {
                      setIsMultiplayer(false);
                      multiplayerClient.leaveRoom();
                      setGameState('TITLE');
                    }}
                    className="w-full py-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 min-h-[44px]"
                  >
                    Thoát Về Màn Hình Chính
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {gameState === 'DEFEAT' && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-md w-full text-center shadow-2xl max-h-[92vh] overflow-y-auto">
            <AlertTriangle className="w-14 h-14 text-red-500 mx-auto mb-2 animate-pulse" />
            <h2 className="text-2xl font-black text-white mb-1">ĐẾ CHẾ SỤP ĐỔ!</h2>
            <p className="text-xs text-slate-300 mb-2">Lãnh thổ của bạn đã hoàn toàn thất thủ.</p>

            {/* BẢNG XẾP HẠNG LÃNH THỔ CÁC QUỐC GIA */}
            <MatchLeaderboard
              nations={gameDataRef.current.nations}
              myNationId={myNationIdRef.current || 1}
              totalLand={totalLandCountRef.current || 1}
              isVictory={false}
            />

            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={() => {
                  if (isMultiplayer) {
                    setGameState('TITLE');
                    setIsMultiplayerModalOpen(true);
                  } else {
                    startNewGame(difficulty, mapSize, playerName, gameMode);
                  }
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg text-sm min-h-[48px] active:scale-95"
              >
                {isMultiplayer ? 'Quay Lại Phòng Chờ' : 'Thử Lại Ngay'}
              </button>
              {isMultiplayer && (
                <button
                  onClick={() => {
                    setIsMultiplayer(false);
                    multiplayerClient.leaveRoom();
                    setGameState('TITLE');
                  }}
                  className="w-full py-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 min-h-[44px]"
                >
                  Thoát Về Màn Hình Chính
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PHÒNG CHƠI NHIỀU NGƯỜI (MULTIPLAYER LOBBY) */}
      <MultiplayerModal
        isOpen={isMultiplayerModalOpen}
        onClose={() => setIsMultiplayerModalOpen(false)}
        defaultPlayerName={playerName}
        initialRoomCode={urlRoomCode}
        onStartMultiplayerGame={handleStartMultiplayerGame}
      />

      {/* POPUP XÁC NHẬN CHƠI MỚI / XÓA VÁN CŨ (HOẠT ĐỘNG 100% TRÊN ĐIỆN THOẠI & IFRAME) */}
      {showConfirmNewGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-lg font-black text-white mb-2">Bắt Đầu Ván Mới?</h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Ván chơi đã lưu trước đây của bạn sẽ bị xóa vĩnh viễn để bắt đầu trận đấu mới từ đầu.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  deleteSavedGame();
                  setShowConfirmNewGame(false);
                  startNewGame(difficulty, mapSize, playerName, gameMode);
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg min-h-[46px]"
              >
                <RotateCcw className="w-4 h-4" />
                Xóa Ván Cũ & Bắt Đầu Chơi Mới
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmNewGame(false)}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold rounded-2xl text-xs border border-slate-700 min-h-[44px]"
              >
                Hủy Bỏ (Giữ Lại Ván Cũ)
              </button>
            </div>
          </div>
        </div>
      )}

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
