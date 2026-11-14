import React, { useState, useEffect } from 'react';
import { Tile, Nation, PlayerProfile, GeneralStyle, DiplomacyStatus } from '../types';
import { formatPopulation, BUILDING_INFO, GENERAL_ROSTER } from '../utils/constants';
import { canDeployGeneral, getLoyaltyState, appointReserveGeneral, calculateGeneralStats } from '../utils/generalCombat';
import { GENERAL_STYLE_INFO } from '../utils/generalEvolution';
import { areResourcesEnabled, formatResource, getRepairCost, repairExtractor, isExtractor, depositName } from '../utils/resources';
import {
  isSuperBuilding,
  getSuperBuildingState,
  getSuperBuildingStateLabel,
  getSuperRepairInfo,
  startSuperRepair,
} from '../utils/superBuildings';
import {
  ADVANCED_EXTRACTOR_MINERAL_COST,
  FIGHTER_PLANE_CONFIG,
  MAX_FIGHTERS_PER_NATION,
  canLaunchFighterPlane,
  countActiveFighterPlanes,
  countAdvancedExtractors,
  getMaxAdvancedExtractors,
} from '../utils/supremeTech';
import { GeneralModel } from './GeneralModel';
import { 
  Coins, Users, Building2, Swords, Play, Pause, Settings, X, Shield, Handshake, Crown, Rocket, Cpu, Trophy, Wand2, Plane
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
  launchAttackWave: (fromN: number, toN: number, src: Tile, tgt: Tile, troops: number, queue?: any[]) => void;
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
  fighterAimingMode?: boolean;
  onToggleFighterAiming?: () => void;
  onLaunchFighterAtTile?: (tile: Tile) => void;
  onUpgradeAdvancedExtractor?: (tile: Tile) => void;
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
  hasMetBot,
  soundManager,
  onProposeTruce,
  onProposeAlliance,
  onDeclareWar,
  onSendGoldAid,
  onSendTroopAid,
  gameMode,
  setIsCreativeOpen,
  setIsMarketOpen,
  fighterAimingMode,
  onToggleFighterAiming,
  onLaunchFighterAtTile,
  onUpgradeAdvancedExtractor,
}) => {
  const [showSkillDesc, setShowSkillDesc] = useState(false);
  const [showReserves, setShowReserves] = useState(false);
  const [, setForceUpdate] = useState(0);
  const [latestEventText, setLatestEventText] = useState<string | null>(null);

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

  const playerNation: Nation | undefined = gameDataRef.current?.nations?.[1];
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
  const fighterUnlocked = canLaunchFighterPlane(playerNation);
  const activeFightersCount = playerNation
    ? countActiveFighterPlanes(gameDataRef.current?.fighterPlanes, playerNation.id)
    : 0;
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

      // Nếu không có ô lân cận trực tiếp mới quét các ô xa hơn
      if (!bestSource) {
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const t = tiles[y][x];
            if (t.owner === 1) {
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
        launchAttackWave(1, selectedTile.owner, bestSource, selectedTile, troopsToSend);
        soundManager.playAttack();
      }
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-20 overflow-hidden">
      
      {/* 1. THANH TRÊN DUY NHẤT: Thu gọn xu, dân số, % chiếm đất, level & tốc độ / tạm dừng / cài đặt */}
      <header className="pointer-events-auto bg-slate-900/95 border-b border-slate-800/80 px-3 py-1.5 flex items-center justify-between text-xs backdrop-blur-md shadow-lg shrink-0">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {/* Xu */}
          <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg shrink-0">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-black text-amber-300 font-mono">{hudStats.gold}</span>
            <span className="text-[10px] text-emerald-400 font-mono">+{hudStats.goldIncome}</span>
          </div>

          {/* Dân số */}
          <div className="flex items-center gap-1 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-lg shrink-0">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-bold text-blue-200 font-mono">{formatPopulation(hudStats.population ?? (gameDataRef.current?.nations?.[1]?.population || 0))}</span>
          </div>

          {/* % Đất */}
          <div className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg shrink-0">
            <span className="text-[11px]">🗺️</span>
            <span className="font-bold text-emerald-200 font-mono">{hudStats.landPercent}%</span>
          </div>

          {/* Level */}
          <div className="flex items-center gap-1 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-lg shrink-0">
            <Crown className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-bold text-purple-200 font-mono">Lv.{playerProfile.level}</span>
          </div>

          {/* Dầu & Khoáng sản (Bấm để mở Chợ Tài Nguyên) */}
          {areResourcesEnabled() && playerNation && (
            <button
              onClick={() => {
                soundManager.playClick();
                setIsMarketOpen?.(true);
              }}
              className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-700/90 border border-sky-500/40 px-2 py-0.5 rounded-lg shrink-0 active:scale-95 transition-all"
              title="Mở Chợ Tài Nguyên (Dầu & Khoáng sản)"
            >
              <span className="font-bold text-sky-300 font-mono">🛢️ {formatResource(playerNation.oil)}</span>
              <span className="font-bold text-violet-300 font-mono">⛏️ {formatResource(playerNation.minerals)}</span>
            </button>
          )}
        </div>

        {/* Nút ngoại giao, tốc độ, tạm dừng, cài đặt */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            onClick={() => {
              soundManager.playClick();
              setIsDiplomacyOpen(true);
            }}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold rounded-lg text-[10px] border border-emerald-500/40 min-h-[32px] min-w-[32px] flex items-center justify-center gap-1 active:scale-95 transition-all"
            title="Mở Ngoại Giao & Giao thương"
          >
            <Handshake className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Ngoại Giao</span>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setGameSpeed(s => (s === 1 ? 2 : s === 2 ? 4 : 1));
            }}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 font-black rounded-lg text-[10px] border border-slate-700 min-h-[32px] min-w-[36px] flex items-center justify-center"
            title="Đổi tốc độ game"
          >
            {gameSpeed}x
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setIsPaused(p => !p);
            }}
            className={`p-1.5 rounded-lg border min-h-[32px] min-w-[32px] flex items-center justify-center ${
              isPaused ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
            title="Tạm dừng / Tiếp tục"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              setIsSettingsOpen(true);
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 min-h-[32px] min-w-[32px] flex items-center justify-center"
            title="Cài đặt trận đấu"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 3. THÔNG BÁO SỰ KIỆN (EventTicker): 1 dòng nhỏ, tự mờ dần */}
      {latestEventText && (
        <div className="mx-3 mt-1.5 pointer-events-none self-center bg-slate-900/90 border border-amber-500/40 text-amber-200 text-[11px] px-3 py-1 rounded-full shadow-lg backdrop-blur-sm animate-in fade-in duration-200 max-w-sm truncate">
          {latestEventText}
        </div>
      )}

      {/* Khu vực giữa màn hình dành cho Bản đồ */}
      <div className="flex-1 pointer-events-none relative" />

      {/* 4. BẢNG THÔNG TIN Ô ĐẤT: Hiện chi tiết theo trạng thái Ngoại giao */}
      {selectedTile && (
        <div 
          className="pointer-events-auto left-2 right-2 mx-auto mb-2 max-w-md w-auto box-border bg-slate-900/95 border border-slate-700 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-150 max-h-[22vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-xs gap-1">
            <div className="flex items-center gap-1.5 font-bold text-white min-w-0 flex-1 truncate">
              {selectedTile.owner === 1 ? <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              <span className="truncate">
                {selectedTile.owner === 1 
                  ? `${playerName} (Lãnh thổ của bạn)` 
                  : selectedTile.owner > 1 
                  ? targetNation?.name || 'Đất địch'
                  : 'Đất hoang trung lập'}
              </span>
              {selectedTile.owner > 1 && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${
                  dipStatus === 'ALLIANCE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                  dipStatus === 'TRUCE' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                  'bg-red-500/20 text-red-300 border-red-500/40'
                }`}>
                  {dipStatus === 'ALLIANCE' ? '🤝 Đồng minh' : dipStatus === 'TRUCE' ? '🕊️ Đình chiến' : '⚔️ Chiến tranh'}
                </span>
              )}
            </div>
            <button 
              onClick={() => setSelectedTile(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg shrink-0 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1.5 text-[11px]">
            <div className="text-slate-300 min-w-0 flex-1 truncate">
              📍 ({selectedTile.x}, {selectedTile.y}) • <strong className="text-white">{selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng' : 'Núi'}</strong>
              {selectedTile.building !== 'NONE' && (
                <span className="text-amber-400 ml-1">
                  [{BUILDING_INFO[selectedTile.building].name}]
                </span>
              )}
              {isSuperBuilding(selectedTile.building) && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 border border-amber-500/40 text-[10px] font-bold text-amber-300">
                  {getSuperBuildingStateLabel(selectedTile)}
                </span>
              )}
              {areResourcesEnabled() && selectedTile.deposit && selectedTile.discovered && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-sky-300">
                  {selectedTile.deposit === 'OIL' ? '🛢️' : '⛏️'} {depositName(selectedTile.deposit)} ({formatResource(selectedTile.reserve)})
                  {isExtractor(selectedTile.building) && ` • Độ bền ${Math.round(selectedTile.condition ?? 100)}%`}
                </span>
              )}
              {isExtractor(selectedTile.building) && selectedTile.isAdvancedExtractor && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-bold text-amber-300">
                  ⭐ Cao Cấp (x1.5)
                </span>
              )}
              {selectedTile.burnZoneTimer && selectedTile.burnZoneTimer > 0 ? (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-400/50 text-[10px] font-bold text-orange-300">
                  🔥 Vùng Cháy ({Math.ceil(selectedTile.burnZoneTimer)}s)
                </span>
              ) : null}
              {selectedTile.radiationTimer && selectedTile.radiationTimer > 0 ? (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-lime-500/20 border border-lime-400/50 text-[10px] font-bold text-lime-300">
                  ☢️ Phóng Xạ ({Math.ceil(selectedTile.radiationTimer)}s)
                </span>
              ) : null}
              {isSuperBuilding(selectedTile.building) && (getSuperBuildingState(selectedTile) === 'BUILDING' || getSuperBuildingState(selectedTile) === 'REPAIRING') && (() => {
                const total = Math.max(1, selectedTile.superBuildTotal || 60);
                const left = Math.max(0, selectedTile.superBuildTimeLeft || 0);
                const pct = Math.min(100, Math.max(0, ((total - left) / total) * 100));
                const isRep = getSuperBuildingState(selectedTile) === 'REPAIRING';
                return (
                  <div className="mt-1 h-1.5 w-full max-w-[220px] bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${isRep ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                );
              })()}
            </div>

            {/* Các nút hành động chính theo trạng thái */}
            <div className="flex items-center gap-1 shrink-0 flex-wrap">
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
                        className={`px-2.5 py-1 font-bold rounded-xl text-xs flex items-center gap-1 shadow ${
                          canAffordRepair
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
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
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow"
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
                        className={`px-2.5 py-1 font-bold rounded-xl text-xs flex items-center gap-1 shadow ${
                          canAffordAdv
                            ? 'bg-gradient-to-r from-violet-600 to-amber-500 hover:brightness-110 text-white'
                            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
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
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Xây Dựng</span>
                  </button>
                </>
              ) : selectedTile.owner === 0 ? (
                <button
                  onClick={handleAttackTile}
                  className="px-3 py-1 font-bold rounded-xl text-xs text-white shadow bg-emerald-600 hover:bg-emerald-500"
                >
                  <Swords className="w-3.5 h-3.5 inline mr-1" />
                  Mở Rộng ({actualAttackTroops}q)
                </button>
              ) : (
                /* selectedTile.owner > 1 */
                <>
                  {dipStatus === 'WAR' && (
                    <>
                      <button
                        onClick={handleAttackTile}
                        className="px-2.5 py-1 font-bold rounded-xl text-xs text-white shadow bg-red-600 hover:bg-red-500 flex items-center gap-1"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>Tấn Công ({actualAttackTroops}q)</span>
                      </button>
                      {fighterUnlocked && onLaunchFighterAtTile && (
                        <button
                          onClick={() => onLaunchFighterAtTile(selectedTile)}
                          className="px-2.5 py-1 font-bold rounded-xl text-xs text-sky-200 bg-sky-700/80 hover:bg-sky-600 border border-sky-400/50 flex items-center gap-1 shadow"
                          title={`Xuất kích Máy Bay Chiến Đấu (${FIGHTER_PLANE_CONFIG.goldCost} Vàng, ${FIGHTER_PLANE_CONFIG.oilCost} Dầu)`}
                        >
                          <Plane className="w-3.5 h-3.5" />
                          <span>Không Kích</span>
                        </button>
                      )}
                      <button
                        onClick={() => onProposeAlliance?.(selectedTile.owner)}
                        className="px-2 py-1 font-bold rounded-xl text-xs text-emerald-300 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/50 flex items-center gap-1"
                      >
                        <Handshake className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Kết Minh</span>
                      </button>
                      <button
                        onClick={() => onProposeTruce?.(selectedTile.owner)}
                        className="px-2 py-1 font-bold rounded-xl text-xs text-amber-300 bg-amber-950/90 hover:bg-amber-900 border border-amber-500/50 flex items-center gap-1"
                      >
                        <span>🕊️ Đình Chiến</span>
                      </button>
                    </>
                  )}

                  {dipStatus === 'TRUCE' && (
                    <>
                      <button
                        onClick={() => onProposeAlliance?.(selectedTile.owner)}
                        className="px-2.5 py-1 font-bold rounded-xl text-xs text-emerald-300 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/50 flex items-center gap-1"
                      >
                        <Handshake className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Kết Minh</span>
                      </button>
                      <button
                        onClick={() => onDeclareWar?.(selectedTile.owner)}
                        className="px-2.5 py-1 font-bold rounded-xl text-xs text-red-300 bg-red-950/90 hover:bg-red-900 border border-red-500/50 flex items-center gap-1"
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
                        className="px-2 py-1 font-bold rounded-xl text-xs text-amber-300 bg-amber-950/90 hover:bg-amber-900 border border-amber-500/50 flex items-center gap-1"
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span>Tặng 30% Vàng</span>
                      </button>
                      <button
                        onClick={() => onSendTroopAid?.(selectedTile.owner)}
                        className="px-2 py-1 font-bold rounded-xl text-xs text-blue-300 bg-blue-950/90 hover:bg-blue-900 border border-blue-500/50 flex items-center gap-1"
                      >
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span>Tặng 30% Quân</span>
                      </button>
                      <button
                        onClick={() => onDeclareWar?.(selectedTile.owner)}
                        className="px-2 py-1 font-bold rounded-xl text-xs text-rose-300 bg-rose-950/90 hover:bg-rose-900 border border-rose-500/50 flex items-center gap-1"
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

      {/* THANH DƯỚI CÙNG (5 NÚT ICON + BẢNG XUẤT QUÂN & TƯỚNG) */}
      <footer 
        className="pointer-events-auto bg-slate-900/95 border-t border-slate-800 p-2 sm:p-2.5 z-20 shrink-0 space-y-2 backdrop-blur-md"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* BẢNG XUẤT QUÂN GỌN 1 HÀNG */}
        <div className="bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
          <input
            type="range"
            min="1"
            max="100"
            value={attackPercent}
            onChange={(e) => setAttackPercent(Number(e.target.value))}
            className="flex-1 h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex items-center gap-1 shrink-0">
            {[25, 50, 75, 100].map(pct => (
              <button
                key={pct}
                onClick={() => setAttackPercent(pct)}
                className={`px-1.5 py-1 rounded text-[10px] font-bold border ${
                  attackPercent === pct ? 'bg-amber-500 border-amber-300 text-slate-950 font-extrabold' : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <span className="text-amber-400 font-mono font-bold text-xs shrink-0 w-12 text-right">
            {actualAttackTroops}q
          </span>
        </div>

        {/* NÚT KHÔNG KÍCH MÁY BAY CHIẾN ĐẤU (MỞ KHI ĐẠT QUÂN SỰ TỐI THƯỢNG 3) */}
        {fighterUnlocked && onToggleFighterAiming && (
          <div className="flex items-center justify-between gap-2 bg-sky-950/50 px-2.5 py-1.5 rounded-xl border border-sky-500/40 text-xs">
            <div className="flex items-center gap-2 text-sky-200 font-bold truncate">
              <Plane className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="truncate">
                Máy Bay Chiến Đấu: <span className="font-mono text-white">{activeFightersCount}/{MAX_FIGHTERS_PER_NATION}</span>
              </span>
              <span className="text-[10px] font-mono text-amber-300 shrink-0">
                ({FIGHTER_PLANE_CONFIG.goldCost}💰 {FIGHTER_PLANE_CONFIG.oilCost}🛢️)
              </span>
            </div>
            <button
              onClick={onToggleFighterAiming}
              className={`px-3 py-1 rounded-lg font-black text-[11px] border transition-all active:scale-95 shrink-0 ${
                fighterAimingMode
                  ? 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse'
                  : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400'
              }`}
            >
              {fighterAimingMode ? '🎯 Đang Chọn Mục Tiêu...' : '✈️ Xuất Kích'}
            </button>
          </div>
        )}

        {/* TƯỚNG VÀ KỸ NĂNG */}
        {(pGen || reserveGenerals.length > 0) && (
          <div className="flex flex-col bg-slate-950/85 rounded-xl border border-slate-800 text-xs shadow-lg overflow-hidden backdrop-blur-md">
            {pGen && rosterItem && (
              <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="shrink-0 scale-90">
                    <GeneralModel skillId={pGen.skillId} size={28} />
                  </div>
                  <div className="text-left truncate min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px] truncate flex-wrap">
                      <span className="truncate">{pGen.name}</span>
                      <span className="px-1 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-mono font-bold shrink-0">
                        Lv.{pGen.level || 1}
                      </span>
                      {styleInfo && (
                        <span 
                          className="px-1 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded text-[9px] font-bold shrink-0"
                          title={styleInfo.desc}
                        >
                          {styleInfo.icon} {styleInfo.name}
                        </span>
                      )}
                      <span 
                        className={`px-1 py-0.5 rounded text-[9px] font-bold border shrink-0 ${
                          (pGen.loyalty ?? 100) < 10
                            ? 'bg-red-950/90 text-red-300 border-red-500 animate-pulse'
                            : loyaltyState === 'TRUNG_THANH'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : loyaltyState === 'BAT_MAN'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                        }`}
                        title={`Lòng trung thành: ${pGen.loyalty ?? 100}/100`}
                      >
                        {(pGen.loyalty ?? 100) < 10
                          ? '⚠️ Sắp rời bỏ'
                          : loyaltyState === 'TRUNG_THANH'
                          ? '🤝 Trung thành'
                          : loyaltyState === 'BAT_MAN'
                          ? '⚠️ Bất mãn'
                          : '🚨 Nguy cơ phản bội'}{' '}
                        ({pGen.loyalty ?? 100})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono font-normal shrink-0">
                        {pGen.hp ?? 1000}/{pGen.maxHp || 1000}
                      </span>
                    </div>
                    {/* Thanh HP */}
                    <div className="w-24 max-w-full bg-slate-800 rounded-full h-1 mt-0.5 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          hpPercent >= 60 ? 'bg-emerald-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-red-500 animate-pulse'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, hpPercent))}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                      {isMarching ? (
                        <span className="text-amber-300 font-semibold">⚔️ Đang Xuất Trận</span>
                      ) : isInjured ? (
                        <span className="text-red-400 font-semibold">🚨 Trọng Thương (0 HP • Hồi 3%/s)</span>
                      ) : isRecovering ? (
                        <span className="text-amber-400 font-semibold">⏳ Hồi Phục ({hpPercent}% • Cần 60%)</span>
                      ) : (
                        <span>🛡️ Thủ Đô (Giáp: {Math.round((pGen.armor || 0.20) * 100)}% • Atk: {pGen.attack || 90})</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {canDeploy ? (
                    <button
                      onClick={() => setPlayerGeneralDeployMode(prev => !prev)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${playerGeneralDeployMode ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                      title={playerGeneralDeployMode ? 'Đang xuất kèm tướng khi tấn công' : 'Đang giữ tướng ở thủ đô'}
                    >
                      {playerGeneralDeployMode ? '⚔️ Xuất Kèm' : '🛡️ Giữ'}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed"
                      title={
                        (pGen.loyalty ?? 100) < 30
                          ? `Tướng có nguy cơ phản bội (Loyalty: ${pGen.loyalty ?? 100} < 30), từ chối xuất quân!`
                          : `Cần ít nhất 60% HP để xuất trận (Hiện tại: ${hpPercent}%)`
                      }
                    >
                      {(pGen.loyalty ?? 100) < 30 ? '🚫 Bất Tuân' : '🔒 <60% HP'}
                    </button>
                  )}

                  {/* Nút kỹ năng */}
                  <button
                    onClick={() => {
                      if (canUseSkill) activateGeneralSkill(1);
                      else soundManager.playClick();
                    }}
                    disabled={!canUseSkill}
                    onClickCapture={() => setShowSkillDesc(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border flex items-center gap-1 ${
                      isInjured ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed' :
                      isSkillActive ? 'bg-amber-600 text-white border-amber-400 animate-pulse' :
                      isSkillOnCooldown ? 'bg-slate-800 text-slate-400 border-slate-700' :
                      'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 border-amber-400 shadow'
                    }`}
                  >
                    <span>{rosterItem.emoji}</span>
                    <span className="truncate max-w-[80px]">{rosterItem.skillName}</span>
                    {isSkillActive && <span className="font-mono">({pGen.skillActiveTimer}s)</span>}
                    {isSkillOnCooldown && <span className="font-mono">({pGen.skillCooldown}s)</span>}
                  </button>
                </div>
              </div>
            )}

            {/* Mục thu gọn: Danh sách Dự bị */}
            {reserveGenerals.length > 0 && (
              <div className="border-t border-slate-800/80 bg-slate-900/70 px-2.5 py-1">
                <button
                  type="button"
                  onClick={() => setShowReserves(prev => !prev)}
                  className="flex items-center justify-between w-full text-[10px] font-bold text-slate-300 hover:text-amber-300 transition-colors py-0.5"
                >
                  <span className="flex items-center gap-1">
                    <span>📋 Dự bị ({reserveGenerals.length})</span>
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {showReserves ? '▲ Thu gọn' : '▼ Mở rộng'}
                  </span>
                </button>

                {showReserves && (
                  <div className="max-h-[140px] overflow-y-auto no-scrollbar space-y-1.5 mt-1 pt-1 border-t border-slate-800/60">
                    {reserveGenerals.map(rg => {
                      const rgLoyaltyState = getLoyaltyState(rg);
                      const rgHpPercent = Math.round(((rg.hp ?? 1000) / (rg.maxHp || 1000)) * 100);
                      const isMarching = rg.status === 'MARCHING' || pGen?.status === 'MARCHING';
                      return (
                        <div 
                          key={rg.id}
                          className="flex items-center justify-between bg-slate-950/90 p-1.5 rounded-lg border border-slate-800 text-[10px] gap-2"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div className="shrink-0 scale-75 -my-1">
                              <GeneralModel skillId={rg.skillId} size={20} />
                            </div>
                            <div className="min-w-0 flex-1 truncate">
                              <div className="flex items-center gap-1 font-bold text-amber-200 text-[10px] truncate">
                                <span className="truncate">{rg.name}</span>
                                <span className="px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[8px] font-mono shrink-0">
                                  Lv.{rg.level || 1}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono shrink-0">
                                  {rgHpPercent}% HP
                                </span>
                              </div>
                              <div className="text-[8px] truncate mt-0.5">
                                <span className={
                                  (rg.loyalty ?? 100) < 10 ? 'text-red-400 font-bold' :
                                  rgLoyaltyState === 'TRUNG_THANH' ? 'text-emerald-400' :
                                  rgLoyaltyState === 'BAT_MAN' ? 'text-amber-400' : 'text-red-400'
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
                            disabled={isMarching}
                            title={isMarching ? 'Không thể bổ nhiệm khi đang hành quân' : 'Bổ nhiệm làm Đại Tướng chỉ huy chính thức'}
                            className={`min-h-[36px] px-3 py-1 rounded-lg text-[10px] font-bold border transition-colors shrink-0 flex items-center justify-center ${
                              isMarching 
                                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-amber-600/30 hover:bg-amber-500/40 text-amber-300 border-amber-500/50 active:scale-95'
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

        {/* 7. THANH DƯỚI CÙNG: 5 hoặc 6 nút icon có nhãn nhỏ */}
        <div className={`grid ${gameMode === 'CREATIVE' ? 'grid-cols-6' : 'grid-cols-5'} gap-1.5 pt-0.5`}>
          {/* Nút 1: Tấn Công */}
          <button
            onClick={() => setIsMissileOpen(true)}
            className="flex flex-col items-center justify-center py-2 px-1 bg-red-950/60 hover:bg-red-900/80 active:scale-95 border border-red-500/50 rounded-xl text-red-200 transition-all min-h-[44px]"
          >
            <Rocket className="w-4 h-4 text-red-400 mb-0.5" />
            <span className="text-[10px] font-bold leading-tight">Tấn Công</span>
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
            className="flex flex-col items-center justify-center py-2 px-1 bg-amber-950/60 hover:bg-amber-900/80 active:scale-95 border border-amber-500/50 rounded-xl text-amber-200 transition-all min-h-[44px]"
          >
            <Building2 className="w-4 h-4 text-amber-400 mb-0.5" />
            <span className="text-[10px] font-bold leading-tight">Xây Dựng</span>
          </button>

          {/* Nút 3: Công Nghệ */}
          <button
            disabled={!canTech}
            onClick={() => setIsTechOpen(true)}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all min-h-[44px] border ${
              canTech ? 'bg-blue-950/60 hover:bg-blue-900/80 border-blue-500/50 text-blue-200 active:scale-95' : 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Cpu className="w-4 h-4 text-blue-400 mb-0.5" />
            <span className="text-[10px] font-bold leading-tight">Công Nghệ</span>
          </button>

          {/* Nút 4: Xếp Hạng */}
          <button
            onClick={() => {
              soundManager.playClick();
              setIsLeaderboardOpen(true);
            }}
            className="flex flex-col items-center justify-center py-2 px-1 bg-amber-950/60 hover:bg-amber-900/80 active:scale-95 border border-amber-500/50 rounded-xl text-amber-200 transition-all min-h-[44px]"
          >
            <Trophy className="w-4 h-4 text-amber-400 mb-0.5" />
            <span className="text-[10px] font-bold leading-tight">Xếp Hạng</span>
          </button>

          {/* Nút Sáng Tạo (Chỉ hiển thị khi gameMode === 'CREATIVE') */}
          {gameMode === 'CREATIVE' && setIsCreativeOpen && (
            <button
              onClick={() => {
                soundManager.playClick();
                setIsCreativeOpen(true);
              }}
              className="flex flex-col items-center justify-center py-2 px-1 bg-purple-950/80 hover:bg-purple-900/90 active:scale-95 border border-purple-500/70 rounded-xl text-purple-200 transition-all min-h-[44px] shadow-md animate-pulse"
              title="Mở Bảng Sáng Tạo"
            >
              <Wand2 className="w-4 h-4 text-purple-400 mb-0.5" />
              <span className="text-[10px] font-bold leading-tight">Sáng Tạo</span>
            </button>
          )}

          {/* Nút 5: Tự Động */}
          <button
            onClick={() => setAutoExpand(!autoExpand)}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all min-h-[44px] border ${
              autoExpand ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <span className="text-base mb-0.5">🤖</span>
            <span className="text-[10px] font-bold leading-tight">{autoExpand ? 'Tự Động' : 'Tắt'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
