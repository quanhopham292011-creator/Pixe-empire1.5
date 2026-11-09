import React, { useState, useEffect } from 'react';
import { Tile, Nation, PlayerProfile } from '../types';
import { formatPopulation, BUILDING_INFO, GENERAL_ROSTER } from '../utils/constants';
import { canDeployGeneral } from '../utils/generalCombat';
import { GeneralModel } from './GeneralModel';
import { 
  Coins, Users, Flag, Building2, Sparkles, Swords, Play, Pause, Settings, X, Shield, Crosshair, Handshake, Crown, Rocket, Sliders, Cpu
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
}) => {
  const [showSkillDesc, setShowSkillDesc] = useState(false);
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

  const pGen = gameDataRef.current?.nations?.[1]?.general;
  const rosterItem = pGen ? GENERAL_ROSTER.find(r => r.skillId === pGen.skillId) || GENERAL_ROSTER[0] : null;
  const isMarching = pGen?.status === 'MARCHING';
  const isInjured = pGen?.status === 'INJURED' || pGen?.healthState === 'INJURED';
  const isRecovering = pGen?.healthState === 'RECOVERING';
  const canDeploy = canDeployGeneral(pGen);
  const hpPercent = pGen ? Math.round(((pGen.hp ?? 1000) / (pGen.maxHp || 1000)) * 100) : 100;
  const isSkillActive = (pGen?.skillActiveTimer || 0) > 0;
  const isSkillOnCooldown = (pGen?.skillCooldown || 0) > 0;
  const canUseSkill = pGen && !isInjured && !isSkillOnCooldown;

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
        </div>

        {/* Nút tốc độ, tạm dừng, cài đặt */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
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

      {/* Khu vực giữa màn hình dành cho Bản đồ (chiếm > 60%) */}
      <div className="flex-1 pointer-events-none relative" />

      {/* 4. BẢNG THÔNG TIN Ô ĐẤT: Thẻ gọn 2 dòng phía trên thanh dưới */}
      {selectedTile && (
        <div 
          className="pointer-events-auto left-2 right-2 mx-auto mb-2 max-w-sm w-auto box-border bg-slate-900/95 border border-slate-700 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-150 max-h-[15vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-xs gap-1">
            <div className="flex items-center gap-1.5 font-bold text-white min-w-0 flex-1 truncate">
              {selectedTile.owner === 1 ? <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              <span className="truncate">
                {selectedTile.owner === 1 ? `${playerName} (Lãnh thổ của bạn)` : selectedTile.owner > 1 ? gameDataRef.current.nations[selectedTile.owner]?.name || 'Đất địch' : 'Đất hoang trung lập'}
              </span>
            </div>
            <button 
              onClick={() => setSelectedTile(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg shrink-0 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px]">
            <div className="text-slate-300 min-w-0 flex-1 truncate">
              📍 ({selectedTile.x}, {selectedTile.y}) • <strong className="text-white">{selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng' : 'Núi'}</strong>
              {selectedTile.building !== 'NONE' && <span className="text-amber-400 ml-1">[{BUILDING_INFO[selectedTile.building].name}]</span>}
            </div>

            {/* 1 nút hành động chính gọn gàng */}
            <div className="flex items-center gap-1 shrink-0">
              {selectedTile.owner === 1 ? (
                <button
                  onClick={() => setIsBuildOpen(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Xây Dựng</span>
                </button>
              ) : (
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
                        launchAttackWave(1, selectedTile.owner, bestSource, selectedTile, troopsToSend);
                        soundManager.playAttack();
                      }
                    }
                  }}
                  className={`px-3 py-1 font-bold rounded-xl text-xs text-white shadow ${selectedTile.owner === 0 ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}
                >
                  <Swords className="w-3.5 h-3.5 inline mr-1" />
                  {selectedTile.owner === 0 ? `Mở Rộng (${actualAttackTroops}q)` : `Tấn Công (${actualAttackTroops}q)`}
                </button>
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
        {/* 5. BẢNG XUẤT QUÂN GỌN 1 HÀNG: Slider + 25/50/75/100% + số quân */}
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

        {/* 6. TƯỚNG VÀ KỸ NĂNG: Thu thành 1 hàng nhỏ gọn */}
        {pGen && rosterItem && (
          <div className="flex items-center justify-between bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="shrink-0 scale-90">
                <GeneralModel skillId={pGen.skillId} size={28} />
              </div>
              <div className="text-left truncate min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px] truncate">
                  <span className="truncate">{pGen.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono font-normal shrink-0">
                    {pGen.hp ?? 1000}/{pGen.maxHp || 1000}
                  </span>
                </div>
                {/* Thanh HP mỏng tinh gọn */}
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
                  title={`Cần ít nhất 60% HP để xuất trận (Hiện tại: ${hpPercent}%)`}
                >
                  🔒 &lt;60% HP
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

        {/* 7. THANH DƯỚI CÙNG: 5 nút icon có nhãn nhỏ bên dưới (Tên Lửa, Xây Dựng, Công Nghệ, Ngoại Giao, Tự Động) */}
        <div className="grid grid-cols-5 gap-1.5 pt-0.5">
          {/* Nút 1: Tên Lửa (Chuyển xuống thanh dưới) */}
          <button
            onClick={() => setIsMissileOpen(true)}
            className="flex flex-col items-center justify-center py-2 px-1 bg-red-950/60 hover:bg-red-900/80 active:scale-95 border border-red-500/50 rounded-xl text-red-200 transition-all min-h-[44px]"
          >
            <Rocket className="w-4 h-4 text-red-400 mb-0.5" />
            <span className="text-[10px] font-bold leading-tight">Tên Lửa</span>
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

          {/* Nút 4: Ngoại Giao */}
          <button
            disabled={!hasMetBot}
            onClick={() => setIsDiplomacyOpen(true)}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all min-h-[44px] border ${
              hasMetBot ? 'bg-emerald-950/60 hover:bg-emerald-900/80 border-emerald-500/50 text-emerald-200 active:scale-95' : 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Flag className="w-4 h-4 text-emerald-400 mb-0.5" />
            <span className="text-[10px] font-bold leading-tight">Ngoại Giao</span>
          </button>

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
