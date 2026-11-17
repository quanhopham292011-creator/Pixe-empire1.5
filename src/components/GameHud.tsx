import React, { useState, useEffect } from 'react';
import { Tile, Nation, PlayerProfile, GeneralStyle, DiplomacyStatus, AirUnitType, MissileType, TradeOffer, InspectedShipRef, NavalShip, SeaTradeShip, NavalAimingState } from '../types';
import { formatPopulation, BUILDING_INFO, GENERAL_ROSTER, AIR_SYSTEM_CONFIG, AIR_UNIT_SPECS, MISSILE_CONFIG, TILE_PIXEL_SIZE } from '../utils/constants';
import { isLandConnected } from '../utils/landConnectivity';
import { pushFeedbackText } from '../utils/floatFeedback';
import { canDeployGeneral, getLoyaltyState, appointReserveGeneral, calculateGeneralStats } from '../utils/generalCombat';
import { GENERAL_STYLE_INFO } from '../utils/generalEvolution';
import { areResourcesEnabled, formatResource, getRepairCost, repairExtractor, isExtractor, depositName } from '../utils/resources';
import { issueWarshipOrder, startWarshipSeaRepair, loadTroopsOnWarship, unloadTroopsAtCoast, isShipNearOwnedCoast } from '../utils/navalSystem';
import { getTruceAvailability } from '../utils/truceSystem';
import {
  isSuperBuilding,
  getSuperBuildingState,
  getSuperBuildingStateLabel,
  getSuperRepairInfo,
  startSuperRepair,
  SUPER_BUILDING_CONFIG,
} from '../utils/superBuildings';
import {
  ADVANCED_EXTRACTOR_MINERAL_COST,
  countAdvancedExtractors,
  getMaxAdvancedExtractors,
} from '../utils/supremeTech';
import {
  canProduceAirUnit,
  canUseAirType1,
  canUseAirType23,
  getAirProduceCost,
  getNationAirSummary,
  hasAnyAirUnlocked,
} from '../utils/aircraftSystem';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { GeneralModel } from './GeneralModel';
import { MemeLayer } from './MemeLayer';
import { 
  Coins, Users, Building2, Swords, Play, Pause, Settings, X, Shield, Handshake, Crown, Rocket, Cpu, Trophy, Wand2, Plane, Info, AlertTriangle, Check, WifiOff
} from 'lucide-react';

interface GameHudProps {
  hudStats: {
    gold: number;
    goldIncome: number;
    troops: number;
    maxTroops: number;
    population?: number;
    landPercent: number;
    titanBuffTimer: number;
  };
  playerProfile: PlayerProfile;
  playerName: string;
  gameSpeed: number;
  setGameSpeed: (s: number | ((prev: number) => number)) => void;
  isPaused: boolean;
  setIsPaused: (paused: boolean | ((prev: boolean) => boolean)) => void;
  setIsSettingsOpen: (open: boolean) => void;
  selectedTile: Tile | null;
  setSelectedTile: (tile: Tile | null) => void;
  gameDataRef: React.MutableRefObject<any>;
  setIsBuildOpen: (open: boolean) => void;
  setIsTechOpen: (open: boolean) => void;
  setIsDiplomacyOpen: (open: boolean) => void;
  setIsLeaderboardOpen: (open: boolean) => void;
  setIsMissileOpen: (open: boolean) => void;
  autoExpand: boolean;
  setAutoExpand: (auto: boolean | ((prev: boolean) => boolean)) => void;
  attackPercent: number;
  setAttackPercent: (pct: number) => void;
  actualAttackTroops: number;
  launchAttackWave: (fromN: number, toN: number, src: Tile, tgt: Tile, troops: number, queue?: any[]) => boolean | void;
  playerGeneralDeployMode: boolean;
  setPlayerGeneralDeployMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
  activateGeneralSkill: (nationId: number) => void;
  canTech: boolean;
  hasMetBot: boolean;
  soundManager: { playClick: () => void; playAttack: () => void; playCapture: () => void };
  onProposeTruce?: (id: number) => void;
  onProposeAlliance?: (id: number) => void;
  onDeclareWar?: (id: number) => void;
  onSendGoldAid?: (id: number) => void;
  onSendTroopAid?: (id: number) => void;
  gameMode?: string;
  setIsCreativeOpen?: (open: boolean) => void;
  setIsMarketOpen?: (open: boolean) => void;
  playerNationId?: number;
  airAimingMode?: 'FIGHTER' | 'SQUADRON' | 'BOMBER_START' | 'BOMBER_END' | null;
  onToggleAirAiming?: (type: AirUnitType) => void;
  onCancelAirAiming?: () => void;
  missileAimingMode?: MissileType | null;
  onCancelMissileAiming?: () => void;
  onProduceAirUnit?: (type: AirUnitType) => void;
  onLaunchAirAtTile?: (tile: Tile, type: 'FIGHTER' | 'SQUADRON') => void;
  onUpgradeAdvancedExtractor?: (tile: Tile) => void;
  currentQuest?: number;
  questDismissed?: boolean;
  onDismissQuest?: () => void;
  activeSeasonEvent?: { name: string; remainingTime: number } | null;
  incomingMissileWarning?: { missileName: string; targetX: number; targetY: number; secondsLeft: number } | null;
  missileFeedbackToast?: string | null;
  loadErrorToast?: string | null;
  pendingTradeOffer?: TradeOffer | null;
  offerGoldAmount?: number;
  onRespondTradeOffer?: (accept: boolean) => void;
  onOpenEventLog?: () => void;
  showMinimap?: boolean;
  minimapNode?: React.ReactNode;
  inspectedShip?: InspectedShipRef | null;
  setInspectedShip?: (ship: InspectedShipRef | null) => void;
  showSeaControl?: boolean;
  onToggleSeaControl?: () => void;
  navalAimingMode?: NavalAimingState | null;
  onCancelNavalAiming?: () => void;
  onOpenNavalManager?: () => void;
  onStartNavalAiming?: (aim: NavalAimingState) => void;
  onNotify?: (msg: string) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hudStats,
  playerProfile,
  playerName,
  gameSpeed,
  setGameSpeed,
  isPaused,
  setIsPaused,
  setIsSettingsOpen,
  selectedTile,
  setSelectedTile,
  gameDataRef,
  setIsBuildOpen,
  setIsTechOpen,
  setIsDiplomacyOpen,
  setIsLeaderboardOpen,
  setIsMissileOpen,
  autoExpand,
  setAutoExpand,
  attackPercent,
  setAttackPercent,
  actualAttackTroops,
  launchAttackWave,
  playerGeneralDeployMode,
  setPlayerGeneralDeployMode,
  activateGeneralSkill,
  canTech,
  hasMetBot: _hasMetBot,
  soundManager,
  onProposeTruce,
  onProposeAlliance,
  onDeclareWar,
  onSendGoldAid,
  onSendTroopAid,
  gameMode,
  setIsCreativeOpen,
  setIsMarketOpen,
  playerNationId = 1,
  airAimingMode,
  onToggleAirAiming: _onToggleAirAiming,
  onCancelAirAiming,
  missileAimingMode,
  onCancelMissileAiming,
  onProduceAirUnit: _onProduceAirUnit,
  onLaunchAirAtTile,
  onUpgradeAdvancedExtractor,
  currentQuest,
  questDismissed,
  onDismissQuest,
  activeSeasonEvent,
  incomingMissileWarning,
  missileFeedbackToast,
  loadErrorToast,
  pendingTradeOffer,
  offerGoldAmount,
  onRespondTradeOffer,
  onOpenEventLog,
  showMinimap,
  minimapNode,
  inspectedShip,
  setInspectedShip,
  showSeaControl,
  onToggleSeaControl,
  navalAimingMode,
  onCancelNavalAiming,
  onOpenNavalManager,
  onStartNavalAiming,
  onNotify,
}) => {
  void _hasMetBot;
  void _onToggleAirAiming;
  void _onProduceAirUnit;
  const [showReserves, setShowReserves] = useState(false);
  const [showGenInfo, setShowGenInfo] = useState(false);
  const [, setForceUpdate] = useState(0);
  const [latestEventText, setLatestEventText] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  // Auto-hide event ticker after 3 seconds when new event arrives
  useEffect(() => {
    const events = gameDataRef.current?.events;
    if (events && events.length > 0) {
      setLatestEventText(events[0].title + ': ' + events[0].description);
      const timer = setTimeout(() => {
        setLatestEventText(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [gameDataRef.current?.events?.length]);

  // Auto-hide selected tile card after 4 seconds
  useEffect(() => {
    if (!selectedTile) return;
    const timer = setTimeout(() => {
      setSelectedTile(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [selectedTile?.x, selectedTile?.y, selectedTile?.owner, setSelectedTile]);

  // Auto-hide inspected ship card after 6 seconds
  useEffect(() => {
    if (!inspectedShip || !setInspectedShip) return;
    const timer = setTimeout(() => {
      setInspectedShip(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [inspectedShip?.id, inspectedShip?.kind, setInspectedShip]);

  const playerNation: Nation | undefined = gameDataRef.current?.nations?.[playerNationId];
  const pGen = playerNation?.general;
  const reserveGenerals = playerNation?.reserveGenerals || [];
  const loyaltyState = pGen ? getLoyaltyState(pGen) : 'TRUNG_THANH';
  const styleInfo = pGen?.style && pGen.style in GENERAL_STYLE_INFO ? GENERAL_STYLE_INFO[pGen.style as GeneralStyle] : null;
  const rosterItem = pGen ? GENERAL_ROSTER.find(r => r.skillId === pGen.skillId) || GENERAL_ROSTER[0] : null;
  const isMarching = pGen?.status === 'MARCHING';
  const isInjured = pGen?.status === 'INJURED' || pGen?.healthState === 'INJURED';
  const isRecovering = pGen?.healthState === 'RECOVERING';
  const canDeploy = canDeployGeneral(pGen);
  const hpPercent = pGen ? Math.round(((pGen.hp ?? 1000) / (pGen.maxHp || 1000)) * 100) : 100;
  const isSkillActive = (pGen?.skillActiveTimer || 0) > 0;
  const isSkillOnCooldown = (pGen?.skillCooldown || 0) > 0;
  const canUseSkill = pGen && !isInjured && !isSkillOnCooldown;
  const airType1Unlocked = canUseAirType1(playerNation);
  const airType23Unlocked = canUseAirType23(playerNation);
  const airSummary = getNationAirSummary(gameDataRef.current?.airUnits, playerNationId);
  const maxAdvancedExtractors = getMaxAdvancedExtractors(playerNation);
  const currentAdvancedExtractors = playerNation && gameDataRef.current?.tiles
    ? countAdvancedExtractors(gameDataRef.current.tiles, playerNation.id)
    : 0;

  // Lấy thông tin quốc gia sở hữu ô đất đang chọn
  const targetNation: Nation | null = selectedTile && selectedTile.owner > 1 ? gameDataRef.current?.nations?.[selectedTile.owner] || null : null;
  const dipStatus: DiplomacyStatus = targetNation ? (targetNation.diplomacy?.[1]?.status || 'WAR') : 'WAR';

  // Hàm xử lý tấn công ô đất đang chọn
  const handleAttackTile = () => {
    if (!selectedTile) return;
    const player = gameDataRef.current.nations[1];
    if (player && player.troops >= 5) {
      let bestSource: Tile | null = null;
      let minDistance = Infinity;
      const tiles = gameDataRef.current.tiles;
      const size = tiles.length;
      const { x: sx, y: sy } = selectedTile;

      // Tối ưu: Kiểm tra 8 ô lân cận trực tiếp trước (phổ biến nhất)
      const DX = [1, -1, 0, 0, 1, 1, -1, -1];
      const DY = [0, 0, 1, -1, 1, -1, 1, -1];
      for (let i = 0; i < 8; i++) {
        const nx = sx + DX[i];
        const ny = sy + DY[i];
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          const nt = tiles[ny][nx];
          if (nt.owner === 1) {
            const dist = Math.hypot(nx - sx, ny - sy);
            if (dist < minDistance) {
              minDistance = dist;
              bestSource = nt;
            }
          }
        }
      }

      // Nếu không có ô lân cận trực tiếp mới quét các ô xa hơn (chỉ xét ô nối liền đất liền)
      if (!bestSource) {
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const t = tiles[y][x];
            if (t.owner === 1) {
              if (!isLandConnected(tiles, x, y, sx, sy)) continue;
              const dist = Math.hypot(x - sx, y - sy);
              if (dist < minDistance) {
                minDistance = dist;
                bestSource = t;
              }
            }
          }
        }
      }

      if (bestSource) {
        const troopsToSend = Math.max(5, Math.floor(player.troops * (attackPercent / 100)));
        const success = launchAttackWave(1, selectedTile.owner, bestSource, selectedTile, troopsToSend);
        if (success !== false) {
          soundManager.playAttack();
        }
      } else {
        if (!isLandConnected(tiles, player.capitalX, player.capitalY, sx, sy)) {
          pushFeedbackText(gameDataRef.current.particles, {
            x: sx * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            y: sy * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
            color: '#f87171',
            text: '🚢 Cần Tàu Chiến để đưa quân qua biển (Tấn Công → Tàu Thuyền → Đổ bộ)'
          });
        }
      }
    }
  };

  // Chọn duy nhất 1 thanh trên cùng (không bao giờ chồng lấn, chữ tự xuống dòng, không cắt)
  const renderSingleTopBar = () => {
    if (loadErrorToast) {
      return (
        <div className="pointer-events-none mx-2 mt-1.5 max-w-xl sm:mx-auto bg-rose-700 text-white font-bold px-3.5 py-2 rounded-2xl shadow-2xl text-sm flex items-start gap-2 border border-rose-300">
          <AlertTriangle className="w-5 h-5 shrink-0 text-white mt-0.5" />
          <span className="whitespace-normal break-words leading-snug">{loadErrorToast}</span>
        </div>
      );
    }

    if (incomingMissileWarning) {
      return (
        <div className="pointer-events-none mx-2 mt-1.5 max-w-xl sm:mx-auto bg-red-900/95 border-2 border-red-400 px-3 py-2 rounded-2xl flex items-center justify-between gap-2 text-sm text-white shadow-2xl animate-pulse">
          <span className="font-bold text-white whitespace-normal break-words leading-snug">
            🚨 Radar: {incomingMissileWarning.missileName} tới ({incomingMissileWarning.targetX}, {incomingMissileWarning.targetY})
          </span>
          <span className="font-mono text-amber-200 font-black text-sm shrink-0 bg-slate-950/90 px-2.5 py-1 rounded-lg border border-red-400">
            💥 {incomingMissileWarning.secondsLeft}s
          </span>
        </div>
      );
    }

    if (missileFeedbackToast) {
      return (
        <div className="pointer-events-none mx-2 mt-1.5 max-w-xl sm:mx-auto bg-slate-950/95 border-2 border-rose-400 text-rose-100 font-bold px-3.5 py-2 rounded-2xl shadow-2xl text-sm flex items-start gap-2 backdrop-blur-md">
          <Rocket className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
          <span className="whitespace-normal break-words leading-snug">{missileFeedbackToast}</span>
        </div>
      );
    }

    if (pendingTradeOffer && onRespondTradeOffer) {
      return (
        <div className="pointer-events-auto mx-2 mt-1.5 max-w-xl sm:mx-auto p-3 bg-slate-950/95 border-2 border-sky-400 rounded-2xl shadow-2xl backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-black text-sky-200 whitespace-normal break-words">
              📦 {pendingTradeOffer.nationName}:{' '}
              {pendingTradeOffer.mode === 'AI_SELL' ? 'bán' : 'mua'}{' '}
              <strong className="text-white">
                {pendingTradeOffer.qty} {pendingTradeOffer.resource === 'OIL' ? '🛢️ Dầu' : '⛏️ Khoáng'}
              </strong>
              {typeof offerGoldAmount === 'number' && (
                <span className="text-amber-300 font-mono">
                  {' '}({pendingTradeOffer.mode === 'AI_SELL' ? `-${offerGoldAmount}` : `+${offerGoldAmount}`} 💰)
                </span>
              )}
            </span>
            <span className="font-mono font-bold text-amber-200 shrink-0">
              {Math.ceil(pendingTradeOffer.remainingTimer)}s
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onRespondTradeOffer(true)}
              className="min-h-[44px] py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Chấp nhận
            </button>
            <button
              onClick={() => onRespondTradeOffer(false)}
              className="min-h-[44px] py-2 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white border border-slate-500 font-bold rounded-xl text-sm flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" /> Từ chối
            </button>
          </div>
        </div>
      );
    }

    if (activeSeasonEvent) {
      return (
        <div className="pointer-events-none mx-2 mt-1.5 max-w-xl sm:mx-auto flex items-center justify-between gap-2 px-3.5 py-2 bg-indigo-950/95 border border-indigo-400 rounded-2xl shadow-lg backdrop-blur-md text-sm text-white">
          <span className="font-extrabold text-amber-200 whitespace-normal break-words leading-snug">
            {activeSeasonEvent.name}
          </span>
          <span className="font-mono text-cyan-200 font-bold shrink-0">
            ⏳ {activeSeasonEvent.remainingTime}s
          </span>
        </div>
      );
    }

    if (latestEventText) {
      return (
        <button
          type="button"
          onClick={() => onOpenEventLog?.()}
          className="pointer-events-auto mx-2 mt-1.5 max-w-xl sm:mx-auto w-[calc(100%-1rem)] min-h-[44px] bg-slate-950/95 border border-amber-400 text-amber-100 text-sm font-semibold px-3.5 py-2 rounded-2xl shadow-lg backdrop-blur-md text-left whitespace-normal break-words leading-snug active:scale-98"
        >
          {latestEventText}
        </button>
      );
    }

    if (!questDismissed && currentQuest && currentQuest <= 5) {
      const questText =
        currentQuest === 1 ? 'Chiếm 12 ô đất xung quanh Việt Nam' :
        currentQuest === 2 ? 'Xây dựng 1 Doanh Trại (Barracks)' :
        currentQuest === 3 ? 'Chinh phục 25 ô đất thế giới' :
        currentQuest === 4 ? 'Mở bảng Công Nghệ & nâng cấp' :
        'Tiếp tục mở rộng đế quốc!';

      return (
        <div className="pointer-events-auto mx-2 mt-1.5 max-w-xl sm:mx-auto flex items-center justify-between gap-2 pl-3 pr-1 py-1 bg-slate-950/95 border border-blue-400 rounded-2xl shadow-lg backdrop-blur-md">
          <div className="flex items-start gap-2 text-sm text-white min-w-0 flex-1 leading-snug py-1">
            <span className="shrink-0">🎯</span>
            <span className="whitespace-normal break-words">
              <strong className="text-amber-300">{currentQuest}/5:</strong> {questText}
            </span>
          </div>
          {onDismissQuest && (
            <button
              onClick={onDismissQuest}
              className="min-w-[44px] min-h-[44px] p-2 text-slate-100 hover:text-white hover:bg-slate-800 rounded-xl shrink-0 flex items-center justify-center"
              aria-label="Đóng nhiệm vụ"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      );
    }

    if (!isOnline) {
      return (
        <div className="pointer-events-none mx-2 mt-1.5 max-w-xl sm:mx-auto flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950/95 border border-amber-400 text-amber-200 text-sm font-bold shadow-lg">
          <WifiOff className="w-4 h-4 text-amber-300 shrink-0" />
          <span>Đang chơi offline</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-20 overflow-hidden">
      
      {/* 1. THANH TRÊN CÙNG + 1 THANH NHIỆM VỤ / THÔNG BÁO DUY NHẤT */}
      <div className="shrink-0 flex flex-col">
        <header className="hud-header pointer-events-auto bg-slate-950/95 border-b border-slate-700 px-1.5 py-0.5 md:px-2 md:py-1 flex items-center justify-between gap-1 md:gap-1.5 text-xs md:text-sm backdrop-blur-md shadow-lg overflow-x-auto no-scrollbar whitespace-nowrap">
          <div className="flex items-center gap-1 md:gap-1.5 min-w-0 flex-nowrap shrink-0">
            {/* Xu */}
            <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-400/60 px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shrink-0">
              <Coins className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-300 shrink-0" />
              <span className="font-black text-amber-200 font-mono text-xs md:text-sm">{hudStats.gold}</span>
              <span className="text-xs md:text-sm text-emerald-300 font-mono font-bold">+{hudStats.goldIncome}</span>
            </div>

            {/* Dân số */}
            <div className="flex items-center gap-1 bg-blue-500/20 border border-blue-400/60 px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shrink-0">
              <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-300 shrink-0" />
              <span className="font-bold text-blue-100 font-mono text-xs md:text-sm">{formatPopulation(hudStats.population ?? (gameDataRef.current?.nations?.[1]?.population || 0))}</span>
            </div>

            {/* % Đất */}
            <div className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/60 px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shrink-0">
              <span className="text-xs md:text-sm shrink-0">🗺️</span>
              <span className="font-bold text-emerald-100 font-mono text-xs md:text-sm">{hudStats.landPercent}%</span>
            </div>

            {/* Level */}
            <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-400/60 px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shrink-0">
              <Crown className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-300 shrink-0" />
              <span className="font-bold text-purple-100 font-mono text-xs md:text-sm">Lv.{playerProfile.level}</span>
            </div>

            {/* Dầu & Khoáng sản (Bấm để mở Chợ Tài Nguyên) */}
            {areResourcesEnabled() && playerNation && (
              <button
                onClick={() => {
                  soundManager.playClick();
                  setIsMarketOpen?.(true);
                }}
                className="flex items-center gap-1 md:gap-1.5 bg-slate-800 hover:bg-slate-700 border border-sky-400/70 px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-lg shrink-0 min-h-[34px] md:min-h-[44px] active:scale-95 transition-all text-xs md:text-sm"
                title="Mở Chợ Tài Nguyên (Dầu & Khoáng sản)"
              >
                <span className="font-bold text-sky-200 font-mono">🛢️ {formatResource(playerNation.oil)}</span>
                <span className="font-bold text-violet-200 font-mono">⛏️ {formatResource(playerNation.minerals)}</span>
              </button>
            )}
          </div>

          {/* Nút ngoại giao, tốc độ, tạm dừng, cài đặt */}
          <div className="flex items-center gap-1 md:gap-1.5 shrink-0 ml-auto">
            <button
              onClick={() => {
                soundManager.playClick();
                setIsDiplomacyOpen(true);
              }}
              className="px-2 py-0.5 md:px-2.5 md:py-1 bg-slate-800 hover:bg-slate-700 text-emerald-200 font-bold rounded-xl text-xs md:text-sm border border-emerald-400/60 min-h-[36px] min-w-[36px] md:min-h-[44px] md:min-w-[44px] flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              title="Mở Ngoại Giao & Giao thương"
            >
              <Handshake className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">Ngoại Giao</span>
            </button>

            <button
              onClick={() => {
                soundManager.playClick();
                setGameSpeed(s => (s === 1 ? 2 : s === 2 ? 4 : 1));
              }}
              className="px-2 py-0.5 md:px-2.5 md:py-1 bg-slate-800 hover:bg-slate-700 text-amber-200 font-black rounded-xl text-xs md:text-sm border border-slate-500 min-h-[36px] min-w-[36px] md:min-h-[44px] md:min-w-[44px] flex items-center justify-center"
              title="Đổi tốc độ game"
            >
              {gameSpeed}x
            </button>

            <button
              onClick={() => {
                soundManager.playClick();
                setIsPaused(p => !p);
              }}
              className={`p-1.5 md:p-2 rounded-xl border min-h-[36px] min-w-[36px] md:min-h-[44px] md:min-w-[44px] flex items-center justify-center ${
                isPaused ? 'bg-amber-500 border-amber-300 text-slate-950' : 'bg-slate-800 border-slate-500 text-white'
              }`}
              title="Tạm dừng / Tiếp tục"
            >
              {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={() => {
                soundManager.playClick();
                setIsSettingsOpen(true);
              }}
              className="p-1.5 md:p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-500 min-h-[36px] min-w-[36px] md:min-h-[44px] md:min-w-[44px] flex items-center justify-center"
              title="Cài đặt trận đấu"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* CHỈ 1 THANH NHIỆM VỤ / THÔNG BÁO DUY NHẤT BÊN DƯỚI HEADER */}
        {renderSingleTopBar()}
      </div>

      {/* Khu vực giữa màn hình dành cho Bản đồ (Minimap & Meme gọn ở góc trên, không che giữa) */}
      <div className="flex-1 pointer-events-none relative">
        <MemeLayer className="absolute top-1.5 left-1.5 md:top-2 md:left-2 max-w-[calc(100%-5.25rem)] md:max-w-[calc(100%-6.5rem)] z-20 pointer-events-none flex flex-col items-start gap-1.5 md:gap-2 animate-in fade-in duration-200" />
        <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 z-20 pointer-events-auto flex flex-col items-end gap-1 md:gap-1.5">
          {showMinimap && minimapNode && (
            <div className="animate-in fade-in duration-150">
              {minimapNode}
            </div>
          )}
          {onToggleSeaControl && (
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onToggleSeaControl();
              }}
              className={`min-h-[28px] md:min-h-[34px] px-2 py-0.5 md:px-2.5 md:py-1 rounded-xl text-[10px] md:text-[11px] font-bold border shadow-md backdrop-blur-md active:scale-95 transition-all flex items-center gap-1 ${
                showSeaControl
                  ? 'bg-sky-900/90 border-sky-400 text-sky-100'
                  : 'bg-slate-900/85 border-slate-600 text-slate-300 hover:text-white'
              }`}
              title="Bật/tắt lớp hiển thị Vùng Kiểm Soát Biển"
            >
              <span>🌊</span>
              <span>Vùng biển {showSeaControl ? 'Bật' : 'Tắt'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4a. BẢNG THÔNG TIN TÀU HẢI QUÂN / TÀU THƯƠNG (MÁY CHỦ & CHE THÔNG TIN TÀU ĐỊCH) */}
      {!selectedTile && inspectedShip && (() => {
        const nationsList: Nation[] = gameDataRef.current?.nations || [];
        if (inspectedShip.kind === 'NAVAL') {
          const ns: NavalShip | undefined = (gameDataRef.current?.navalShips || []).find(
            (s: NavalShip) => s && s.id === inspectedShip.id && s.hp > 0
          );
          if (!ns) return null;
          const isMine = ns.nationId === playerNationId;
          const shipLabel = ns.type === 'WARSHIP' ? '⚓ Tàu Chiến' : '🛢️ Tàu Khai Thác';
          const ownerNation = ns.nationId > 0 ? nationsList[ns.nationId] : null;
          const ownerLabel = ns.nationId === 0 ? 'Vô chủ (Có thể chiếm)' : isMine ? `${playerName} (Của bạn)` : ownerNation?.name || 'Quốc gia khác';
          const foreignDip: DiplomacyStatus = ownerNation ? (ownerNation.diplomacy?.[playerNationId]?.status || 'WAR') : 'WAR';

          const stateLabel =
            ns.state === 'EXTRACTING' ? 'Đang hút dầu' :
            ns.state === 'MOVING' ? 'Đang di chuyển' :
            ns.state === 'PATROL' ? 'Đang tuần tra' :
            ns.state === 'ESCORT' ? 'Đang hộ tống' :
            ns.state === 'ATTACKING' ? 'Đang chiến đấu' :
            ns.state === 'RETREATING' ? 'Đang rút về cảng' :
            ns.state === 'REPAIRING' ? 'Đang sửa chữa' :
            ns.state === 'TRANSPORTING' ? 'Đang chở quân' :
            ns.state === 'LANDING' ? 'Đang đổ bộ' : 'Chờ lệnh';

          return (
            <div className="pointer-events-auto left-2 right-2 mx-2 sm:mx-auto mb-1.5 max-w-lg w-auto box-border bg-slate-950/95 border border-sky-500/70 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between pb-1 border-b border-slate-700 text-xs gap-2">
                <div className="flex items-center flex-wrap gap-1.5 font-bold text-white min-w-0 flex-1">
                  <span>{shipLabel}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-sky-200 truncate">{ownerLabel}</span>
                  {!isMine && ns.nationId > 0 && (
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border shrink-0 ${
                      foreignDip === 'ALLIANCE' ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400' :
                      foreignDip === 'TRUCE' ? 'bg-amber-500/25 text-amber-200 border-amber-400' :
                      'bg-red-500/25 text-red-200 border-red-400'
                    }`}>
                      {foreignDip === 'ALLIANCE' ? '🤝 Đồng minh' : foreignDip === 'TRUCE' ? '🕊️ Đình chiến' : '⚔️ Chiến tranh'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setInspectedShip?.(null)}
                  className="min-w-[40px] min-h-[40px] p-1.5 text-slate-100 hover:text-white hover:bg-slate-800 rounded-xl shrink-0 flex items-center justify-center"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {isMine ? (
                <div className="flex flex-col gap-2 mt-2 text-xs text-slate-200">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-2">
                    <span>❤️ HP: <strong className="text-emerald-300 font-mono">{Math.round(ns.hp)}/{ns.maxHp}</strong></span>
                    <span>Quy mô: <strong className="text-cyan-200">{ns.scaleTier === 3 ? 'Lớn' : ns.scaleTier === 2 ? 'Vừa' : 'Nhỏ'}</strong></span>
                    <span className="truncate">Trạng thái: <strong className="text-amber-200">{stateLabel}</strong></span>
                    {ns.type === 'WARSHIP' && (
                      <>
                        <span>⚔️ Sức mạnh: <strong className="text-rose-300 font-mono">{ns.dps || 30}/s</strong></span>
                        <span>👥 Chở quân: <strong className="text-sky-200 font-mono">{ns.carriedTroops || 0}/{ns.maxTroopCapacity || 0}</strong></span>
                      </>
                    )}
                    {ns.type === 'EXTRACTOR' && typeof ns.assignedDepositX === 'number' && (
                      <span>🛢️ Mỏ: <strong className="text-sky-200 font-mono">({ns.assignedDepositX},{ns.assignedDepositY})</strong></span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ns.type === 'WARSHIP' && isShipNearOwnedCoast(gameDataRef.current?.tiles || [], playerNationId, ns.x, ns.y, 2.8) && (ns.carriedTroops || 0) < (ns.maxTroopCapacity || 0) && (
                      <button
                        onClick={() => {
                          const res = loadTroopsOnWarship(gameDataRef.current, ns);
                          if (res.ok) onNotify?.(`${res.reason} Bấm "🏖️ Đổ bộ: chạm vào đất địch"!`);
                          else onNotify?.(res.reason);
                          soundManager.playClick();
                          setForceUpdate(v => v + 1);
                        }}
                        className="min-h-[40px] px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs"
                      >
                        🪖 Nạp quân
                      </button>
                    )}
                    {ns.type === 'WARSHIP' && (
                      <button
                        onClick={() => {
                          const near = isShipNearOwnedCoast(gameDataRef.current?.tiles || [], playerNationId, ns.x, ns.y, 2.8);
                          if ((ns.carriedTroops || 0) <= 0 && !near) {
                            onNotify?.('Hãy đưa tàu về gần Cảng/bờ phe mình để nạp quân.');
                            soundManager.playClick();
                            return;
                          }
                          setInspectedShip?.(null);
                          onStartNavalAiming?.({ mode: 'LANDING', shipId: ns.id });
                          soundManager.playClick();
                        }}
                        className="min-h-[40px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
                      >
                        {(ns.carriedTroops || 0) > 0 ? '🏖️ Đổ bộ: chạm vào đất địch' : '🏖️ Đổ bộ'}
                      </button>
                    )}
                    {ns.type === 'WARSHIP' && isShipNearOwnedCoast(gameDataRef.current?.tiles || [], playerNationId, ns.x, ns.y, 2.8) && (ns.carriedTroops || 0) > 0 && (
                      <button
                        onClick={() => {
                          const res = unloadTroopsAtCoast(gameDataRef.current, ns);
                          onNotify?.(res.reason);
                          soundManager.playClick();
                          setForceUpdate(v => v + 1);
                        }}
                        className="min-h-[40px] px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs"
                      >
                        ↩️ Trả quân
                      </button>
                    )}
                    {ns.type === 'WARSHIP' && ns.hp < ns.maxHp && !ns.isRepairing && (
                      <button
                        onClick={() => {
                          const res = startWarshipSeaRepair(ns);
                          onNotify?.(res.reason);
                          soundManager.playClick();
                          setForceUpdate(v => v + 1);
                        }}
                        className="min-h-[40px] px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs"
                      >
                        🔧 Sửa trên biển (2💰/HP)
                      </button>
                    )}
                    {ns.type === 'WARSHIP' && ns.state !== 'RETREATING' && ns.state !== 'REPAIRING' && (
                      <button
                        onClick={() => {
                          const res = issueWarshipOrder(gameDataRef.current, ns, 'RETREAT');
                          onNotify?.(res.reason);
                          soundManager.playClick();
                          setForceUpdate(v => v + 1);
                        }}
                        className="min-h-[40px] px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs"
                      >
                        ⚓ Rút về cảng
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setInspectedShip?.(null);
                        if (onOpenNavalManager) onOpenNavalManager();
                        else setIsMissileOpen(true);
                      }}
                      className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-500 text-white font-bold rounded-xl text-xs"
                    >
                      🚢 Quản lý Hải Quân
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 text-xs text-slate-300">
                  {ns.nationId === 0
                    ? 'Tàu bỏ hoang vô chủ. Điều Tàu Chiến lại gần để chiếm giữ.'
                    : 'Tàu hoạt động của quốc gia khác (chi tiết kỹ thuật được ẩn).'}
                </div>
              )}
            </div>
          );
        }

        const ts: SeaTradeShip | undefined = (gameDataRef.current?.tradeShips || []).find(
          (s: SeaTradeShip) => s && s.id === inspectedShip.id
        );
        if (!ts) return null;
        const nFrom = nationsList[ts.fromNation];
        const nTo = nationsList[ts.toNation];
        const isMineTrade = ts.fromNation === playerNationId || ts.toNation === playerNationId;
        const ownerLabel = isMineTrade
          ? `${playerName} ↔ ${ts.fromNation === playerNationId ? (nTo?.name || 'Nội địa') : (nFrom?.name || 'Nội địa')}`
          : `${nFrom?.name || 'Quốc gia khác'}${nTo && nTo.id !== ts.fromNation ? ` ↔ ${nTo.name}` : ''}`;

        return (
          <div className="pointer-events-auto left-2 right-2 mx-2 sm:mx-auto mb-1.5 max-w-lg w-auto box-border bg-slate-950/95 border border-amber-500/60 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center flex-wrap gap-1.5 font-bold text-white min-w-0 flex-1">
                <span>⛵ Tàu Thương</span>
                <span className="text-slate-300">•</span>
                <span className="text-amber-200 truncate">{ownerLabel}</span>
              </div>
              <button
                onClick={() => setInspectedShip?.(null)}
                className="min-w-[40px] min-h-[40px] p-1.5 text-slate-100 hover:text-white hover:bg-slate-800 rounded-xl shrink-0 flex items-center justify-center"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })()}

      {/* 4. BẢNG THÔNG TIN Ô ĐẤT: Hiện chi tiết theo trạng thái Ngoại giao */}
      {selectedTile && (
        <div 
          className="pointer-events-auto left-2 right-2 mx-1.5 md:mx-2 sm:mx-auto mb-1 md:mb-1.5 max-w-lg w-auto box-border bg-slate-950/95 border border-slate-600 rounded-2xl p-2 md:p-2.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-150 max-h-[18vh] md:max-h-[22vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-700 text-xs gap-2">
            <div className="flex items-center flex-wrap gap-1.5 font-bold text-white min-w-0 flex-1">
              {selectedTile.owner === 1 ? <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" /> : <Shield className="w-3.5 h-3.5 text-blue-300 shrink-0" />}
              <span className="whitespace-normal break-words">
                {selectedTile.owner === 1 
                  ? `${playerName} (Lãnh thổ của bạn)` 
                  : selectedTile.owner > 1 
                  ? targetNation?.name || 'Đất địch'
                  : 'Đất hoang trung lập'}
              </span>
              {selectedTile.owner > 1 && (
                <span className={`px-1.5 py-0.5 rounded-lg text-xs font-bold border shrink-0 ${
                  dipStatus === 'ALLIANCE' ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400' :
                  dipStatus === 'TRUCE' ? 'bg-amber-500/25 text-amber-200 border-amber-400' :
                  'bg-red-500/25 text-red-200 border-red-400'
                }`}>
                  {dipStatus === 'ALLIANCE' ? '🤝 Đồng minh' : dipStatus === 'TRUCE' ? '🕊️ Đình chiến' : '⚔️ Chiến tranh'}
                </span>
              )}
            </div>
            <button 
              onClick={() => setSelectedTile(null)}
              className="min-w-[40px] min-h-[40px] p-1.5 text-slate-100 hover:text-white hover:bg-slate-800 rounded-xl shrink-0 flex items-center justify-center"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5 mt-1.5 text-xs">
            <div className="text-slate-100 flex flex-wrap items-center gap-1.5 leading-snug">
              <span>
                📍 ({selectedTile.x}, {selectedTile.y}) • <strong className="text-white">{selectedTile.terrain === 'WATER' ? 'Biển' : selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng' : 'Núi'}</strong>
              </span>
              {selectedTile.building !== 'NONE' && (
                <span className="text-amber-300 font-bold">
                  [{BUILDING_INFO[selectedTile.building].name}]
                </span>
              )}
              {isSuperBuilding(selectedTile.building) && (
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-amber-400/60 text-xs font-bold text-amber-200">
                  {getSuperBuildingStateLabel(selectedTile)}
                </span>
              )}
              {areResourcesEnabled() && selectedTile.deposit && selectedTile.discovered && (
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-xs font-mono text-sky-200">
                  {selectedTile.terrain === 'WATER' ? '🛢️ Mỏ Dầu Biển' : `${selectedTile.deposit === 'OIL' ? '🛢️' : '⛏️'} ${depositName(selectedTile.deposit)}`} ({(selectedTile.reserve || 0) <= 0 && selectedTile.seaOilRegenTimer ? `Hồi phục ${Math.ceil(selectedTile.seaOilRegenTimer)}s` : formatResource(selectedTile.reserve)})
                  {isExtractor(selectedTile.building) && ` • Độ bền ${Math.round(selectedTile.condition ?? 100)}%`}
                </span>
              )}
              {isExtractor(selectedTile.building) && selectedTile.isAdvancedExtractor && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400 text-xs font-bold text-amber-200">
                  ⭐ Cao Cấp (x1.5)
                </span>
              )}
              {selectedTile.burnZoneTimer && selectedTile.burnZoneTimer > 0 ? (
                <span className="px-1.5 py-0.5 rounded bg-orange-500/25 border border-orange-400 text-xs font-bold text-orange-200">
                  🔥 Vùng Cháy ({Math.ceil(selectedTile.burnZoneTimer)}s)
                </span>
              ) : null}
              {selectedTile.radiationTimer && selectedTile.radiationTimer > 0 ? (
                <span className="px-1.5 py-0.5 rounded bg-lime-500/25 border border-lime-400 text-xs font-bold text-lime-200">
                  ☢️ Phóng Xạ ({Math.ceil(selectedTile.radiationTimer)}s)
                </span>
              ) : null}
              {isSuperBuilding(selectedTile.building) && (getSuperBuildingState(selectedTile) === 'BUILDING' || getSuperBuildingState(selectedTile) === 'REPAIRING') && (() => {
                const total = Math.max(1, selectedTile.superBuildTotal || SUPER_BUILDING_CONFIG.BUILD_TIME_SECONDS);
                const left = Math.max(0, selectedTile.superBuildTimeLeft || 0);
                const pct = Math.min(100, Math.max(0, ((total - left) / total) * 100));
                const isRep = getSuperBuildingState(selectedTile) === 'REPAIRING';
                return (
                  <div className="mt-1 h-2 w-full max-w-[240px] bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${isRep ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                );
              })()}
            </div>

            {/* Các nút hành động chính theo trạng thái */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {selectedTile.owner === 1 ? (
                <>
                  {isSuperBuilding(selectedTile.building) && getSuperBuildingState(selectedTile) === 'DAMAGED' && (() => {
                    const sr = getSuperRepairInfo(selectedTile);
                    const canAffordRepair = (playerNation?.gold || 0) >= sr.goldCost;
                    return (
                      <button
                        disabled={!canAffordRepair}
                        onClick={() => {
                          if (playerNation) {
                            const res = startSuperRepair(selectedTile, playerNation);
                            if (res.ok) {
                              soundManager.playClick();
                              setForceUpdate(v => v + 1);
                            }
                          }
                        }}
                        className={`min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs flex items-center gap-1 shadow ${
                          canAffordRepair
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-300 border border-slate-600 cursor-not-allowed opacity-70'
                        }`}
                        title={`Sửa Siêu Công Trình (${sr.goldCost.toLocaleString()} Vàng, ${sr.durationSec}s)`}
                      >
                        <span>🔧 Sửa ({formatPopulation(sr.goldCost)}💰)</span>
                      </button>
                    );
                  })()}
                  {areResourcesEnabled() && isExtractor(selectedTile.building) && (selectedTile.condition ?? 100) < 100 && (() => {
                    const rc = getRepairCost(selectedTile);
                    return (
                      <button
                        onClick={() => {
                          if (playerNation) {
                            const res = repairExtractor(selectedTile, playerNation);
                            if (res.ok) {
                              soundManager.playClick();
                              setForceUpdate(v => v + 1);
                            }
                          }
                        }}
                        className="min-h-[40px] px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow"
                        title={`Sửa chữa (${rc.gold} Vàng, ${rc.minerals} Khoáng)`}
                      >
                        <span>🔧 Sửa ({rc.gold}💰{rc.minerals > 0 ? ` ${rc.minerals}⛏️` : ''})</span>
                      </button>
                    );
                  })()}
                  {isExtractor(selectedTile.building) && !selectedTile.isAdvancedExtractor && maxAdvancedExtractors > 0 && !(selectedTile.inactiveTimer && selectedTile.inactiveTimer > 0) && (() => {
                    const atLimit = currentAdvancedExtractors >= maxAdvancedExtractors;
                    const canAffordAdv = !atLimit && (playerNation?.minerals || 0) >= ADVANCED_EXTRACTOR_MINERAL_COST;
                    return (
                      <button
                        disabled={!canAffordAdv}
                        onClick={() => {
                          onUpgradeAdvancedExtractor?.(selectedTile);
                          setForceUpdate(v => v + 1);
                        }}
                        className={`min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs flex items-center gap-1 shadow ${
                          canAffordAdv
                            ? 'bg-gradient-to-r from-violet-600 to-amber-500 hover:brightness-110 text-white'
                            : 'bg-slate-800 text-slate-300 border border-slate-600 cursor-not-allowed opacity-70'
                        }`}
                        title={`Nâng cấp Cao Cấp x1.5 sản lượng (tốn ${ADVANCED_EXTRACTOR_MINERAL_COST} Khoáng sản)`}
                      >
                        <span>
                          {atLimit
                            ? `⭐ Đạt giới hạn (${currentAdvancedExtractors}/${maxAdvancedExtractors})`
                            : `⭐ Cao Cấp (${ADVANCED_EXTRACTOR_MINERAL_COST}⛏️) • ${currentAdvancedExtractors}/${maxAdvancedExtractors}`}
                        </span>
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => setIsBuildOpen(true)}
                    className="min-h-[40px] px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Xây Dựng</span>
                  </button>
                </>
              ) : selectedTile.owner === 0 ? (
                selectedTile.terrain === 'WATER' ? (
                  <span className="px-2.5 py-1.5 rounded-xl bg-sky-950/80 border border-sky-500/40 text-xs font-bold text-sky-200">
                    🛢️ Dùng Tàu Khai Thác từ Hải Cảng để hút dầu
                  </span>
                ) : (
                  <button
                    onClick={handleAttackTile}
                    className="min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs text-white shadow bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>Mở Rộng ({actualAttackTroops}q)</span>
                  </button>
                )
              ) : (
                /* selectedTile.owner > 1 */
                <>
                  {dipStatus === 'WAR' && (
                    <>
                      <button
                        onClick={handleAttackTile}
                        className="min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs text-white shadow bg-red-600 hover:bg-red-500 flex items-center gap-1.5"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>Tấn Công ({actualAttackTroops}q)</span>
                      </button>
                      {airType1Unlocked && airSummary.fighterReady > 0 && onLaunchAirAtTile && (
                        <button
                          onClick={() => onLaunchAirAtTile(selectedTile, 'FIGHTER')}
                          className="min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs text-white bg-sky-700 hover:bg-sky-600 border border-sky-400 flex items-center gap-1.5 shadow"
                          title="Xuất kích Máy Bay Chiến Đấu (L1) tới mục tiêu này (0 Dầu, 1 lượt xuất kích)"
                        >
                          <Plane className="w-3.5 h-3.5" />
                          <span>Không Kích L1</span>
                        </button>
                      )}
                      {airType23Unlocked && airSummary.squadronReady > 0 && onLaunchAirAtTile && (
                        <button
                          onClick={() => onLaunchAirAtTile(selectedTile, 'SQUADRON')}
                          className="min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs text-white bg-amber-700 hover:bg-amber-600 border border-amber-400 flex items-center gap-1.5 shadow"
                          title="Xuất kích Tiểu Đội 3 chiếc (L2) tới mục tiêu này (0 Dầu, 1 lượt xuất kích)"
                        >
                          <Plane className="w-3.5 h-3.5" />
                          <span>Tiểu Đội L2</span>
                        </button>
                      )}
                      <button
                        onClick={() => onProposeAlliance?.(selectedTile.owner)}
                        className="min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs text-emerald-100 bg-emerald-900 hover:bg-emerald-800 border border-emerald-400 flex items-center gap-1.5"
                      >
                        <Handshake className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Kết Minh</span>
                      </button>
                      {(() => {
                        const truceCheck = getTruceAvailability(
                          playerNation,
                          targetNation || undefined,
                          gameDataRef.current?.gameTimeSeconds || 0
                        );
                        const remUses = Math.max(0, truceCheck.maxAllowed - truceCheck.usedCount);
                        const label = truceCheck.ok
                          ? `🕊️ Đình Chiến (${remUses}/${truceCheck.maxAllowed})`
                          : truceCheck.reason === 'LIMIT'
                            ? `🕊️ Hết Đình Chiến (${truceCheck.usedCount}/${truceCheck.maxAllowed})`
                            : `⏳ Đình Chiến (${truceCheck.cooldownRemaining}s)`;
                        return (
                          <button
                            onClick={() => onProposeTruce?.(selectedTile.owner)}
                            className={`min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs border flex items-center gap-1.5 ${
                              truceCheck.ok
                                ? 'text-amber-100 bg-amber-900 hover:bg-amber-800 border-amber-400'
                                : 'text-slate-300 bg-slate-800/90 border-slate-600 opacity-75'
                            }`}
                          >
                            <span>{label}</span>
                          </button>
                        );
                      })()}
                    </>
                  )}

                  {dipStatus === 'TRUCE' && (
                    <>
                      <button
                        onClick={() => onProposeAlliance?.(selectedTile.owner)}
                        className="min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs text-emerald-100 bg-emerald-900 hover:bg-emerald-800 border border-emerald-400 flex items-center gap-1.5"
                      >
                        <Handshake className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Kết Minh</span>
                      </button>
                      <button
                        onClick={() => onDeclareWar?.(selectedTile.owner)}
                        className="min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs text-red-100 bg-red-900 hover:bg-red-800 border border-red-400 flex items-center gap-1.5"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>Tuyên Chiến</span>
                      </button>
                    </>
                  )}

                  {dipStatus === 'ALLIANCE' && (
                    <>
                      <button
                        onClick={() => onSendGoldAid?.(selectedTile.owner)}
                        className="min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs text-amber-100 bg-amber-900 hover:bg-amber-800 border border-amber-400 flex items-center gap-1.5"
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-300" />
                        <span>Tặng 30% Vàng</span>
                      </button>
                      <button
                        onClick={() => onSendTroopAid?.(selectedTile.owner)}
                        className="min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs text-blue-100 bg-blue-900 hover:bg-blue-800 border border-blue-400 flex items-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-300" />
                        <span>Tặng 30% Quân</span>
                      </button>
                      <button
                        onClick={() => onDeclareWar?.(selectedTile.owner)}
                        className="min-h-[40px] px-3 py-1.5 font-bold rounded-xl text-xs text-rose-100 bg-rose-900 hover:bg-rose-800 border border-rose-400 flex items-center gap-1.5"
                      >
                        <span>🗡️ Huỷ Minh</span>
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HỘP HƯỚNG DẪN XUẤT KÍCH / NGẮM BẮN: SÁT PHÍA TRÊN THANH DƯỚI CÙNG, GỌN GÀNG, KHÔNG CHE GIỮA BẢN ĐỒ */}
      {airAimingMode && (
        <div className="pointer-events-auto mx-2 mb-1.5 max-w-xl sm:mx-auto bg-slate-950/95 border-2 border-sky-400 text-white px-3 py-2 rounded-2xl shadow-2xl flex items-center justify-between gap-2.5 backdrop-blur-md">
          <div className="text-left min-w-0 flex-1">
            <div className="text-sm font-black text-sky-200 leading-snug">
              {airAimingMode === 'BOMBER_START'
                ? '💣 Ném Bom (1/2): Chạm ĐIỂM ĐẦU'
                : airAimingMode === 'BOMBER_END'
                  ? `💣 Ném Bom (2/2): Chạm ĐIỂM CUỐI (≤${AIR_SYSTEM_CONFIG.BOMBER_MAX_CORRIDOR_TILES} ô)`
                  : `✈️ Xuất kích ${airAimingMode === 'FIGHTER' ? 'Tiêm Kích L1' : 'Tiểu Đội L2'}: Chạm mục tiêu`}
            </div>
          </div>
          {onCancelAirAiming && (
            <button
              onClick={onCancelAirAiming}
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl border border-slate-500 active:scale-95 shrink-0"
            >
              Hủy
            </button>
          )}
        </div>
      )}

      {!airAimingMode && missileAimingMode && (
        <div className="pointer-events-auto mx-2 mb-1.5 max-w-xl sm:mx-auto bg-slate-950/95 border-2 border-rose-400 text-white px-3 py-2 rounded-2xl shadow-2xl flex items-center justify-between gap-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Rocket className="w-5 h-5 text-rose-300 shrink-0" />
            <div className="text-sm font-black text-amber-200 leading-snug">
              Ngắm {MISSILE_CONFIG[missileAimingMode].name}: Chạm đất địch để phóng
            </div>
          </div>
          {onCancelMissileAiming && (
            <button
              onClick={onCancelMissileAiming}
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl border border-slate-500 active:scale-95 shrink-0"
            >
              Hủy
            </button>
          )}
        </div>
      )}

      {!airAimingMode && !missileAimingMode && navalAimingMode && (
        <div className="pointer-events-auto mx-2 mb-1.5 max-w-xl sm:mx-auto bg-slate-950/95 border-2 border-cyan-400 text-white px-3 py-2 rounded-2xl shadow-2xl flex items-center justify-between gap-2.5 backdrop-blur-md">
          <div className="text-left min-w-0 flex-1">
            <div className="text-sm font-black text-cyan-200 leading-snug">
              {navalAimingMode.mode === 'MOVE' || navalAimingMode.mode === 'FLEET_MOVE'
                ? '📍 Điều động Hải Quân: Chạm vùng BIỂN cần di chuyển tới'
                : navalAimingMode.mode === 'PATROL' || navalAimingMode.mode === 'FLEET_PATROL'
                  ? '🛡️ Tuần tra Hải Quân: Chạm vùng BIỂN làm tâm tuần tra'
                  : navalAimingMode.mode === 'ATTACK'
                    ? '⚔️ Tấn công Hải Quân: Chạm tàu địch hoặc vùng biển mục tiêu'
                    : '🏖️ Đổ bộ Đường Biển: Chạm đất địch hoặc đất trống (trong 6 ô ven bờ)'}
            </div>
          </div>
          {onCancelNavalAiming && (
            <button
              onClick={onCancelNavalAiming}
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl border border-slate-500 active:scale-95 shrink-0"
            >
              Hủy
            </button>
          )}
        </div>
      )}

      {/* THANH DƯỚI CÙNG (5 NÚT ICON + BẢNG XUẤT QUÂN & TƯỚNG) */}
      <footer
        className="hud-footer pointer-events-auto bg-slate-950/95 border-t border-slate-700 px-1.5 md:px-2 pt-1 z-20 shrink-0 flex flex-col gap-1 backdrop-blur-md max-h-[42dvh] md:max-h-[55dvh]"
        style={{ paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {/* BẢNG XUẤT QUÂN GỌN 1 HÀNG */}
          <div className="bg-slate-900 px-2 py-1 md:px-2.5 md:py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 md:gap-2">
            <input
              type="range"
              min="1"
              max="100"
              value={attackPercent}
              onChange={(e) => setAttackPercent(Number(e.target.value))}
              className="flex-1 min-w-[52px] md:min-w-[60px] h-3.5 md:h-4 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex items-center gap-1 shrink-0">
              {[25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => setAttackPercent(pct)}
                  className={`min-h-[32px] min-w-[36px] md:min-h-[38px] md:min-w-[44px] px-1 md:px-1.5 py-0.5 md:py-1 rounded-lg text-xs md:text-sm font-bold border ${
                    attackPercent === pct ? 'bg-amber-400 border-amber-200 text-slate-950 font-black' : 'bg-slate-800 border-slate-600 text-slate-100'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <span className="text-amber-200 font-mono font-bold text-xs md:text-sm shrink-0 min-w-[2.6rem] md:min-w-[3.2rem] text-right">
              {actualAttackTroops}q
            </span>
          </div>

          {/* TƯỚNG VÀ KỸ NĂNG */}
          {(pGen || reserveGenerals.length > 0) && (
            <div className="relative flex flex-col bg-slate-900 rounded-xl border border-slate-700 text-sm shadow-lg backdrop-blur-md">
              {pGen && rosterItem && (
                <>
                  {showGenInfo && (
                    <div className="relative mb-1.5 max-h-[30vh] overflow-y-auto bg-slate-950/95 border border-slate-600 rounded-xl p-3 text-sm text-slate-100 space-y-1.5 shadow-2xl backdrop-blur-md">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300">Thông tin Đại Tướng</span>
                        <button
                          onClick={() => setShowGenInfo(false)}
                          className="min-w-[44px] min-h-[44px] p-2 text-slate-100 hover:text-white rounded-xl flex items-center justify-center"
                          aria-label="Đóng"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div>Kỹ năng: <b className="text-amber-200">{rosterItem.emoji} {rosterItem.skillName}</b></div>
                      {styleInfo && <div>{styleInfo.icon} {styleInfo.name}: <span className="text-slate-200">{styleInfo.desc}</span></div>}
                      <div>Giáp {Math.round((pGen.armor || 0.20) * 100)}% • Sát thương {pGen.attack || 90} • HP {pGen.hp ?? 1000}/{pGen.maxHp || 1000}</div>
                      <div className={(pGen.loyalty ?? 100) < 10 ? 'text-red-300 font-bold' : loyaltyState === 'TRUNG_THANH' ? 'text-emerald-300' : loyaltyState === 'BAT_MAN' ? 'text-amber-300' : 'text-red-300'}>
                        {(pGen.loyalty ?? 100) < 10 ? '⚠️ Sắp rời bỏ' : loyaltyState === 'TRUNG_THANH' ? '🤝 Trung thành' : loyaltyState === 'BAT_MAN' ? '⚠️ Bất mãn' : '🚨 Nguy cơ phản bội'} ({pGen.loyalty ?? 100})
                      </div>
                      <div>
                        {isMarching ? '⚔️ Đang xuất trận' : isInjured ? '🚨 Trọng thương (Hồi 3%/s)' : isRecovering ? `⏳ Hồi phục (${hpPercent}% • Cần 60%)` : '🛡️ Đang ở thủ đô'}
                      </div>
                      <div className="text-slate-200">⚔️ = tướng xuất kèm khi tấn công • 🛡️ = giữ ở thủ đô</div>
                      {!canDeploy && (
                        <div className="text-red-200 font-semibold">
                          {(pGen.loyalty ?? 100) < 30 ? 'Tướng có nguy cơ phản bội, từ chối xuất quân' : 'Cần ít nhất 60% HP để xuất trận'}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 md:gap-2 px-1.5 py-0.5 md:px-2 md:py-1">
                    <div className="shrink-0 [&>svg]:w-6 [&>svg]:h-6 md:[&>svg]:w-[30px] md:[&>svg]:h-[30px]"><GeneralModel skillId={pGen.skillId} size={30} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 md:gap-1.5 text-xs md:text-sm font-bold text-amber-200 min-w-0">
                        <span className="truncate max-w-full font-bold">{pGen.name}</span>
                        <span className="px-1 md:px-1.5 bg-amber-500/25 border border-amber-400/60 rounded text-[11px] md:text-xs font-mono shrink-0">Lv.{pGen.level || 1}</span>
                        {(isMarching || isInjured || isRecovering) && (
                          <span className="text-xs shrink-0">{isMarching ? '⚔️' : isInjured ? '🚨' : '⏳'}</span>
                        )}
                        {(pGen.loyalty ?? 100) < 30 && <span className="text-xs shrink-0 animate-pulse">⚠️</span>}
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 md:h-2 mt-1 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${hpPercent >= 60 ? 'bg-emerald-500' : hpPercent > 20 ? 'bg-amber-400' : 'bg-red-500 animate-pulse'}`}
                          style={{ width: `${Math.min(100, Math.max(0, hpPercent))}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (canUseSkill) activateGeneralSkill(1);
                        else soundManager.playClick();
                      }}
                      disabled={!canUseSkill}
                      className={`min-w-[50px] min-h-[36px] md:min-w-[60px] md:min-h-[44px] px-1.5 md:px-2 shrink-0 rounded-xl border flex flex-col items-center justify-center ${
                        isInjured ? 'bg-slate-900 text-slate-400 border-slate-700' :
                        isSkillActive ? 'bg-amber-600 text-white border-amber-300 animate-pulse' :
                        isSkillOnCooldown ? 'bg-slate-800 text-slate-200 border-slate-600' :
                        'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 border-amber-300 shadow'
                      }`}
                    >
                      <span className="text-xs md:text-sm leading-none">{rosterItem.emoji}</span>
                      <span className="text-xs md:text-sm font-mono font-bold leading-tight">
                        {isSkillActive ? `${pGen.skillActiveTimer}s` : isSkillOnCooldown ? `${pGen.skillCooldown}s` : 'Dùng'}
                      </span>
                    </button>

                    <button
                      onClick={() => setShowGenInfo(v => !v)}
                      className="min-w-[36px] min-h-[36px] md:min-w-[44px] md:min-h-[44px] shrink-0 rounded-xl bg-slate-800 border border-slate-600 text-sky-200 flex items-center justify-center"
                      aria-label="Thông tin Đại Tướng"
                    >
                      <Info className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </div>
                </>
              )}

              {/* Mục thu gọn: Danh sách Dự bị */}
              {reserveGenerals.length > 0 && (
                <div className="border-t border-slate-700 bg-slate-900 px-2.5 py-1 rounded-b-xl">
                  <button
                    type="button"
                    onClick={() => setShowReserves(prev => !prev)}
                    className="flex items-center justify-between w-full min-h-[36px] text-sm font-bold text-slate-100 hover:text-amber-200 transition-colors py-0"
                  >
                    <span className="flex items-center gap-1">
                      <span>📋 Dự bị ({reserveGenerals.length})</span>
                    </span>
                    <span className="text-sm text-slate-200 font-mono">
                      {showReserves ? '▲ Thu gọn' : '▼ Mở rộng'}
                    </span>
                  </button>

                  {showReserves && (
                    <div className="max-h-[160px] overflow-y-auto no-scrollbar space-y-1.5 mt-1 pt-1.5 border-t border-slate-700">
                      {reserveGenerals.map(rg => {
                        const rgLoyaltyState = getLoyaltyState(rg);
                        const rgHpPercent = Math.round(((rg.hp ?? 1000) / (rg.maxHp || 1000)) * 100);
                        const rgIsMarching = rg.status === 'MARCHING' || pGen?.status === 'MARCHING';
                        return (
                          <div 
                            key={rg.id}
                            className="flex items-center justify-between bg-slate-950/95 p-2 rounded-xl border border-slate-700 text-sm gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="shrink-0">
                                <GeneralModel skillId={rg.skillId} size={24} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center flex-wrap gap-1 font-bold text-amber-200 text-sm">
                                  <span className="break-words">{rg.name}</span>
                                  <span className="px-1.5 bg-amber-500/25 text-amber-200 rounded text-sm font-mono shrink-0">
                                    Lv.{rg.level || 1}
                                  </span>
                                  <span className="text-sm text-slate-200 font-mono shrink-0">
                                    {rgHpPercent}%
                                  </span>
                                </div>
                                <div className="text-sm mt-0.5">
                                  <span className={
                                    (rg.loyalty ?? 100) < 10 ? 'text-red-300 font-bold' :
                                    rgLoyaltyState === 'TRUNG_THANH' ? 'text-emerald-300' :
                                    rgLoyaltyState === 'BAT_MAN' ? 'text-amber-300' : 'text-red-300'
                                  }>
                                    {(rg.loyalty ?? 100) < 10 
                                      ? '⚠️ Sắp rời bỏ' 
                                      : (rgLoyaltyState === 'TRUNG_THANH' ? '🤝 Trung thành' : rgLoyaltyState === 'BAT_MAN' ? '⚠️ Bất mãn' : '🚨 Nguy cơ')}{' '}
                                    ({rg.loyalty ?? 100})
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (playerNation) {
                                  const ok = appointReserveGeneral(playerNation, rg.id);
                                  if (ok) {
                                    if (playerNation.general) {
                                      calculateGeneralStats(playerNation.general, playerNation, playerProfile);
                                    }
                                    soundManager.playClick();
                                    setForceUpdate(v => v + 1);
                                  }
                                }
                              }}
                              disabled={rgIsMarching}
                              title={rgIsMarching ? 'Không thể bổ nhiệm khi đang hành quân' : 'Bổ nhiệm làm Đại Tướng chỉ huy chính thức'}
                              className={`min-h-[44px] px-3 py-2 rounded-xl text-sm font-bold border transition-colors shrink-0 flex items-center justify-center ${
                                rgIsMarching 
                                  ? 'bg-slate-900 border-slate-700 text-slate-400 cursor-not-allowed' 
                                  : 'bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 border-amber-400 active:scale-95'
                              }`}
                            >
                              ⭐ Bổ nhiệm
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 7. THANH DƯỚI CÙNG: 5 hoặc 6 nút */}
        <div className={`grid ${gameMode === 'CREATIVE' ? 'grid-cols-6' : 'grid-cols-5'} gap-1 shrink-0`}>
          {/* Nút 1: Tấn Công */}
          <button
            onClick={() => setIsMissileOpen(true)}
            className="flex flex-col items-center justify-center py-0.5 md:py-1 px-0.5 bg-red-950/90 hover:bg-red-900 active:scale-95 border border-red-400/80 rounded-xl text-white transition-all min-h-[36px] md:min-h-[40px]"
          >
            <Rocket className="w-3 h-3 text-red-300 mb-0 shrink-0" />
            <span className="text-[10px] md:text-[11px] font-bold leading-none text-center whitespace-nowrap">Tấn Công</span>
          </button>

          {/* Nút 2: Xây Dựng */}
          <button
            onClick={() => {
              if (!selectedTile) {
                const player = gameDataRef.current.nations[1];
                if (player) {
                  const cap = gameDataRef.current.tiles[player.capitalY]?.[player.capitalX];
                  if (cap) setSelectedTile(cap);
                }
              }
              setIsBuildOpen(true);
            }}
            className="flex flex-col items-center justify-center py-0.5 md:py-1 px-0.5 bg-amber-950/90 hover:bg-amber-900 active:scale-95 border border-amber-400/80 rounded-xl text-white transition-all min-h-[36px] md:min-h-[40px]"
          >
            <Building2 className="w-3 h-3 text-amber-300 mb-0 shrink-0" />
            <span className="text-[10px] md:text-[11px] font-bold leading-none text-center whitespace-nowrap">Xây Dựng</span>
          </button>

          {/* Nút 3: Công Nghệ */}
          <button
            disabled={!canTech}
            onClick={() => setIsTechOpen(true)}
            className={`flex flex-col items-center justify-center py-0.5 md:py-1 px-0.5 rounded-xl transition-all min-h-[36px] md:min-h-[40px] border ${
              canTech ? 'bg-blue-950/90 hover:bg-blue-900 border-blue-400/80 text-white active:scale-95' : 'bg-slate-900 border-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Cpu className="w-3 h-3 text-blue-300 mb-0 shrink-0" />
            <span className="text-[10px] md:text-[11px] font-bold leading-none text-center whitespace-nowrap">Công Nghệ</span>
          </button>

          {/* Nút 4: Xếp Hạng */}
          <button
            onClick={() => {
              soundManager.playClick();
              setIsLeaderboardOpen(true);
            }}
            className="flex flex-col items-center justify-center py-0.5 md:py-1 px-0.5 bg-amber-950/90 hover:bg-amber-900 active:scale-95 border border-amber-400/80 rounded-xl text-white transition-all min-h-[36px] md:min-h-[40px]"
          >
            <Trophy className="w-3 h-3 text-amber-300 mb-0 shrink-0" />
            <span className="text-[10px] md:text-[11px] font-bold leading-none text-center whitespace-nowrap">Xếp Hạng</span>
          </button>

          {/* Nút Sáng Tạo (Chỉ hiển thị khi gameMode === 'CREATIVE') */}
          {gameMode === 'CREATIVE' && setIsCreativeOpen && (
            <button
              onClick={() => {
                soundManager.playClick();
                setIsCreativeOpen(true);
              }}
              className="flex flex-col items-center justify-center py-0.5 md:py-1 px-0.5 bg-purple-950/90 hover:bg-purple-900 active:scale-95 border border-purple-400 rounded-xl text-white transition-all min-h-[36px] md:min-h-[40px] shadow-md"
              title="Mở Bảng Sáng Tạo"
            >
              <Wand2 className="w-3 h-3 text-purple-300 mb-0 shrink-0" />
              <span className="text-[10px] md:text-[11px] font-bold leading-none text-center whitespace-nowrap">Sáng Tạo</span>
            </button>
          )}

          {/* Nút 5: Tự Động */}
          <button
            onClick={() => setAutoExpand(!autoExpand)}
            className={`flex flex-col items-center justify-center py-0.5 md:py-1 px-0.5 rounded-xl transition-all min-h-[36px] md:min-h-[40px] border ${
              autoExpand ? 'bg-emerald-700 border-emerald-400 text-white' : 'bg-slate-800 border-slate-500 text-slate-100'
            }`}
          >
            <span className="text-xs md:text-sm mb-0 leading-none">🤖</span>
            <span className="text-[10px] md:text-[11px] font-bold leading-none text-center whitespace-nowrap">{autoExpand ? 'Tự Động' : 'Tắt'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
