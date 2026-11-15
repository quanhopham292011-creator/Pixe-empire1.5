import React, { useState, useEffect } from 'react';
import { Rocket, Flame, Sparkles, X, CheckCircle2, Clock, Plus, Plane } from 'lucide-react';
import { Nation, Tile, MissileType, AirUnitType, AirUnit } from '../types';
import { MISSILE_CONFIG, MISSILE_SETTINGS, formatPopulation, AIR_SYSTEM_CONFIG, AIR_UNIT_SPECS } from '../utils/constants';
import { areResourcesEnabled, canAffordMissileResources, getMissileResourceCost, formatResource } from '../utils/resources';
import { getAtomEffectiveStats, getMissileEffectiveCost, hasUpgradedHydro } from '../utils/supremeTech';
import {
  canUseAirType1,
  canUseAirType23,
  hasAnyAirUnlocked,
  getNationAirSummary,
  getAirProduceCost,
  canProduceAirUnit,
  getGrandArsenalCountdownState,
  getSavedBomberRoute,
  getBomberRecoveryRemainingSeconds,
} from '../utils/aircraftSystem';

interface MissileModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  silos: Tile[];
  onSelectMissile: (type: MissileType) => void;
  onOpenBuildModal: () => void;
  airUnits?: AirUnit[];
  airAimingMode?: 'FIGHTER' | 'SQUADRON' | 'BOMBER_START' | 'BOMBER_END' | null;
  onToggleAirAiming?: (type: AirUnitType) => void;
  onProduceAirUnit?: (type: AirUnitType) => void;
  onReplayBomberRoute?: () => void;
  hasArsenalReady?: boolean;
}

const InfoButton: React.FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Xem thông tin"
    className={`min-w-[44px] min-h-[44px] rounded-xl border text-sm font-black flex items-center justify-center shrink-0 active:scale-90 transition-all ${
      active
        ? 'bg-amber-400 text-slate-950 border-amber-200'
        : 'bg-slate-800 text-amber-200 border-slate-500'
    }`}
  >
    !
  </button>
);

export const MissileModal: React.FC<MissileModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  silos,
  onSelectMissile,
  onOpenBuildModal,
  airUnits = [],
  airAimingMode,
  onToggleAirAiming,
  onProduceAirUnit,
  onReplayBomberRoute,
  hasArsenalReady = false,
}) => {
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const arsenalCountdown = getGrandArsenalCountdownState(playerNation, hasArsenalReady);
  const airUnlocked = hasAnyAirUnlocked(playerNation) || arsenalCountdown.show;
  const [activeTab, setActiveTab] = useState<'PLANES' | 'MISSILES'>(airUnlocked ? 'PLANES' : 'MISSILES');

  useEffect(() => {
    if (isOpen) {
      const countdown = getGrandArsenalCountdownState(playerNation, hasArsenalReady);
      const unlocked = hasAnyAirUnlocked(playerNation) || countdown.show;
      setActiveTab(unlocked ? 'PLANES' : 'MISSILES');
    }
  }, [isOpen, playerNation, hasArsenalReady]);

  if (!isOpen) return null;

  const totalSilos = silos.length;
  const readySilos = silos.filter(s => (s.missileCooldown || 0) <= 0);
  const cooldownSilos = silos.filter(s => (s.missileCooldown || 0) > 0);
  const minCooldown = cooldownSilos.length > 0
    ? Math.min(...cooldownSilos.map(s => s.missileCooldown || 0))
    : 0;

  const missiles = (['ATOM', 'HYDRO', 'MIRV'] as MissileType[]).map(key => MISSILE_CONFIG[key]);
  const atomStats = getAtomEffectiveStats(playerNation);
  const upgradedHydro = hasUpgradedHydro(playerNation);
  const airSummary = getNationAirSummary(airUnits, playerNation.id);

  const toggle = (id: string) => setOpenInfo(prev => (prev === id ? null : id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-rose-400/60 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-left">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/95 border-b border-slate-700 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-500/25 border border-rose-400 text-rose-300 flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-white tracking-wide">TẤN CÔNG & QUÂN SỰ</h3>
              <p className="text-sm text-amber-300 font-mono font-bold break-words">
                💰 {formatPopulation(playerNation.gold)}
                {areResourcesEnabled() && (
                  <span className="ml-2 text-sky-200">
                    🛢️ {formatResource(playerNation.oil)}{' '}
                    <span className="text-violet-200">⛏️ {formatResource(playerNation.minerals)}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <InfoButton active={openInfo === 'tip'} onClick={() => toggle('tip')} />
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] p-2 text-slate-100 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl flex items-center justify-center"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TABS: Máy bay & Tên lửa */}
        <div className="flex border-b border-slate-700 bg-slate-950">
          {airUnlocked && (
            <button
              onClick={() => setActiveTab('PLANES')}
              className={`flex-1 min-h-[48px] py-2.5 px-3 text-sm font-black flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'PLANES'
                  ? 'bg-sky-600/30 text-sky-200 border-b-2 border-sky-400'
                  : 'text-slate-200 hover:text-white bg-slate-950'
              }`}
            >
              <Plane className="w-4 h-4 text-sky-300" />
              <span>Máy Bay</span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/30 text-sm text-amber-200 font-mono">
                {airSummary.fighterReady + airSummary.squadronReady + airSummary.bomberReady}
              </span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('MISSILES')}
            className={`flex-1 min-h-[48px] py-2.5 px-3 text-sm font-black flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'MISSILES'
                ? 'bg-rose-600/30 text-rose-200 border-b-2 border-rose-400'
                : 'text-slate-200 hover:text-white bg-slate-950'
            }`}
          >
            <Rocket className="w-4 h-4 text-rose-300" />
            <span>Tên Lửa</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-sm text-emerald-200 font-mono">
              {readySilos.length}/{totalSilos}
            </span>
          </button>
        </div>

        {/* Mẹo (chỉ hiện khi bấm "!" ở header) */}
        {openInfo === 'tip' && (
          <div className="px-4 py-2.5 bg-amber-950/70 border-b border-amber-400/50 text-sm text-amber-100 leading-snug">
            {activeTab === 'PLANES'
              ? 'Sản xuất và xuất kích máy bay chiến đấu, tiểu đội hoặc ném bom tấn công mục tiêu đối phương.'
              : 'Bấm "Khai hỏa", rồi chạm vào đất kẻ thù trên bản đồ. Bệ phóng gần nhất sẽ tự bắn.'}
          </div>
        )}

        {/* NỘI DUNG TAB MÁY BAY */}
        {activeTab === 'PLANES' && (
          <div className="p-3 overflow-y-auto space-y-3 flex-1">
            <div className="bg-sky-950/75 p-3 rounded-2xl border border-sky-400/60 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-sky-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span>⚡ Lượt xuất kích: <strong className="text-amber-300">{playerNation.airSorties ?? AIR_SYSTEM_CONFIG.MAX_SORTIES}/{AIR_SYSTEM_CONFIG.MAX_SORTIES}</strong></span>
                  {(playerNation.airSorties ?? AIR_SYSTEM_CONFIG.MAX_SORTIES) < AIR_SYSTEM_CONFIG.MAX_SORTIES && (
                    <span className="text-sm font-mono text-slate-200">
                      (Hồi sau {Math.max(1, AIR_SYSTEM_CONFIG.SORTIE_RECHARGE_SECONDS - Math.floor(playerNation.airSortieRegenTimer || 0))}s)
                    </span>
                  )}
                </div>
                <span className="text-slate-100 font-mono text-sm">
                  Sở hữu: {airSummary.ownedPlanes}/{AIR_SYSTEM_CONFIG.MAX_OWNED_PER_NATION} • Bay: {airSummary.flyingGlobal}/{AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL}
                </span>
              </div>

              {arsenalCountdown.show && (
                arsenalCountdown.destroyed ? (
                  <div className="px-3 py-2 rounded-xl bg-rose-950/80 border border-rose-400 text-sm text-rose-200 font-bold">
                    💥 Đại Công Xưởng: Bị phá, cần xây lại
                  </div>
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-amber-950/80 border border-amber-400 text-sm text-amber-200 font-bold font-mono">
                    ⏳ Mở khóa Loại 2 &amp; 3 sau: {arsenalCountdown.remainingSeconds} giây
                  </div>
                )
              )}

              {!canUseAirType1(playerNation) && !canUseAirType23(playerNation) && (
                <div className="text-sm text-slate-100 px-1 pt-0.5 leading-snug">
                  {arsenalCountdown.destroyed
                    ? 'Hãy xây lại Đại Công Xưởng và bảo vệ đủ 60 giây để mở khóa Máy Bay Tiểu Đội (Loại 2) & Ném Bom (Loại 3).'
                    : 'Đang chờ Đại Công Xưởng hoàn tất thời gian kích hoạt để mở khóa Máy Bay Tiểu Đội (Loại 2) & Ném Bom (Loại 3).'}
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                {(['FIGHTER', 'SQUADRON', 'BOMBER'] as AirUnitType[]).map((uType) => {
                  const unlocked = uType === 'FIGHTER' ? canUseAirType1(playerNation) : canUseAirType23(playerNation);
                  if (!unlocked) return null;
                  const spec = AIR_UNIT_SPECS[uType];
                  const resOn = areResourcesEnabled();
                  const cost = getAirProduceCost(uType, resOn);
                  const canProd = canProduceAirUnit(playerNation, airUnits, uType, resOn);
                  const readyCount = uType === 'FIGHTER' ? airSummary.fighterReady : uType === 'SQUADRON' ? airSummary.squadronReady : airSummary.bomberReady;
                  const recCount = uType === 'FIGHTER' ? airSummary.fighterRecovering : uType === 'SQUADRON' ? airSummary.squadronRecovering : airSummary.bomberRecovering;
                  const isAimingThis =
                    (uType === 'FIGHTER' && airAimingMode === 'FIGHTER') ||
                    (uType === 'SQUADRON' && airAimingMode === 'SQUADRON') ||
                    (uType === 'BOMBER' && (airAimingMode === 'BOMBER_START' || airAimingMode === 'BOMBER_END'));
                  const savedBomberRoute = uType === 'BOMBER' ? getSavedBomberRoute(airUnits, playerNation) : null;
                  const bomberRecoverySec =
                    uType === 'BOMBER' && readyCount <= 0
                      ? getBomberRecoveryRemainingSeconds(airUnits, playerNation)
                      : 0;
                  const hasOwnedBomber =
                    uType === 'BOMBER' &&
                    airSummary.bomberReady + airSummary.bomberRecovering + airSummary.bomberFlying > 0;
                  const canReplayBomber = Boolean(
                    uType === 'BOMBER' &&
                      savedBomberRoute &&
                      readyCount > 0 &&
                      (playerNation.airSorties ?? 0) > 0 &&
                      airSummary.flyingGlobal + 1 <= AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL
                  );

                  return (
                    <div key={uType} className="p-3 bg-slate-950/95 border border-slate-600 rounded-2xl space-y-2">
                      <div className="flex flex-col gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 font-bold text-white text-sm">
                            <span>{spec.name}</span>
                            <span className="text-emerald-300 font-mono">[{readyCount} sẵn sàng]</span>
                            {recCount > 0 && <span className="text-amber-300 text-sm">⏳{recCount} hồi phục</span>}
                          </div>
                          <div className="text-sm text-amber-300 font-mono font-bold mt-1 flex flex-wrap items-center gap-x-2">
                            <span>💰 {formatPopulation(cost.goldCost)}</span>
                            {cost.oilCost > 0 && <span className="text-sky-200">🛢️ {cost.oilCost} Dầu</span>}
                            <span className="text-slate-200">Biên chế {cost.troopCost}q</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {onProduceAirUnit && (
                            <button
                              onClick={() => onProduceAirUnit(uType)}
                              disabled={!canProd.ok}
                              title={canProd.reason}
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                                canProd.ok
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow'
                                  : 'bg-slate-800 text-slate-300 border-slate-600 cursor-not-allowed opacity-70'
                              }`}
                            >
                              Mua {Math.round(cost.goldCost / 1000)}k💰{cost.oilCost > 0 ? ` ${cost.oilCost}🛢️` : ''}
                            </button>
                          )}
                          {uType === 'BOMBER' && onReplayBomberRoute && (
                            <button
                              onClick={() => { onClose(); onReplayBomberRoute(); }}
                              disabled={!canReplayBomber}
                              title={
                                !savedBomberRoute
                                  ? 'Chưa có tuyến bay cũ'
                                  : readyCount <= 0
                                  ? 'Chưa có máy bay sẵn sàng'
                                  : (playerNation.airSorties ?? 0) <= 0
                                  ? 'Hết lượt xuất kích'
                                  : 'Bay lại tuyến cũ (1 lượt xuất kích, 0 Dầu)'
                              }
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-black border transition-all active:scale-95 ${
                                canReplayBomber
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow'
                                  : 'bg-slate-800 text-slate-300 border-slate-600 cursor-not-allowed opacity-70'
                              }`}
                            >
                              Bay lại tuyến cũ
                            </button>
                          )}
                          {onToggleAirAiming && (
                            <button
                              onClick={() => { onClose(); onToggleAirAiming(uType); }}
                              disabled={!isAimingThis && (readyCount <= 0 || (playerNation.airSorties ?? 0) <= 0)}
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-black border transition-all active:scale-95 ${
                                isAimingThis
                                  ? 'bg-amber-400 text-slate-950 border-amber-200 animate-pulse'
                                  : readyCount > 0 && (playerNation.airSorties ?? 0) > 0
                                  ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 shadow'
                                  : 'bg-slate-800 text-slate-300 border-slate-600 cursor-not-allowed opacity-70'
                              }`}
                            >
                              {isAimingThis ? '🎯 Hủy mục tiêu' : '✈️ Xuất kích'}
                            </button>
                          )}
                        </div>
                      </div>
                      {uType === 'BOMBER' && (
                        readyCount > 0 ? (
                          <div className="text-sm text-sky-200">
                            Chạm Xuất kích, rồi chạm 2 điểm để vẽ tuyến
                          </div>
                        ) : hasOwnedBomber ? (
                          <div className="text-sm text-amber-200 font-mono">
                            Đang về căn cứ, hồi còn {bomberRecoverySec} giây
                          </div>
                        ) : null
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* NỘI DUNG TAB TÊN LỬA */}
        {activeTab === 'MISSILES' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* TRẠNG THÁI BỆ PHÓNG */}
            <div className="px-4 py-2 bg-slate-950/90 border-b border-slate-700 flex flex-wrap items-center justify-between text-sm font-bold gap-2 shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-slate-100">Bệ: <strong className="text-white font-mono">{totalSilos}</strong></span>
                <span className="flex items-center gap-1 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <strong className="font-mono">{readySilos.length}</strong>
                </span>
                {cooldownSilos.length > 0 && (
                  <span className="flex items-center gap-1 text-rose-300">
                    <Clock className="w-4 h-4" />
                    <strong className="font-mono">{cooldownSilos.length}</strong> ({minCooldown}s)
                  </span>
                )}
              </div>
              <button
                onClick={() => { onClose(); onOpenBuildModal(); }}
                className="min-h-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-200 font-bold text-sm rounded-xl border border-slate-600 flex items-center gap-1 active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" /> Xây bệ ({formatPopulation(MISSILE_SETTINGS.SILO_BUILD_COST)})
              </button>
            </div>

            {/* DANH SÁCH TÊN LỬA */}
            <div className="p-3 overflow-y-auto space-y-2.5 flex-1">
              {totalSilos === 0 && (
                <div className="p-3 bg-rose-950/70 border border-rose-400 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-rose-100">Chưa có bệ phóng tên lửa</span>
                  <button
                    onClick={() => { onClose(); onOpenBuildModal(); }}
                    className="min-h-[44px] px-3.5 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Xây ngay
                  </button>
                </div>
              )}

              {missiles.map((m) => {
                const effCost = getMissileEffectiveCost(m.id, playerNation);
                const resCost = getMissileResourceCost(m.id, playerNation);
                const goldCost = effCost.cost;
                const isUpgradedAtom = m.id === 'ATOM' && atomStats.isUpgraded;
                const isUpgradedHydro = m.id === 'HYDRO' && upgradedHydro;
                const effectiveRadius = Number((isUpgradedAtom ? atomStats.radius : m.radius).toFixed(1));
                const hasEnoughRes = canAffordMissileResources(playerNation, m.id);
                const hasEnoughGold = playerNation.gold >= goldCost;
                const canAfford = hasEnoughGold && hasEnoughRes;
                const hasReadySilo = readySilos.length > 0;
                const canLaunch = canAfford && hasReadySilo;

                let iconEl = <Rocket className="w-5 h-5 text-amber-300" />;
                if (m.id === 'HYDRO') iconEl = <Flame className="w-5 h-5 text-orange-300" />;
                if (m.id === 'MIRV') iconEl = <Sparkles className="w-5 h-5 text-pink-300" />;

                const infoText = isUpgradedAtom
                  ? 'Đã nâng cấp: sức công phá ~x10 (bán kính 6.0 ô) và để lại Vùng Phóng Xạ 50 giây, làm suy kiệt quân, vàng và tài nguyên địch.'
                  : isUpgradedHydro
                  ? 'Đã nâng cấp: xóa sổ căn cứ và để lại Vùng Cháy thiêu đốt quân địch trong 15 giây.'
                  : m.description;

                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl border ${
                      m.id === 'MIRV'
                        ? 'bg-gradient-to-r from-pink-950/60 via-slate-900 to-purple-950/60 border-pink-400/70'
                        : m.id === 'HYDRO'
                        ? 'bg-gradient-to-r from-orange-950/60 via-slate-900 to-amber-950/60 border-orange-400/70'
                        : isUpgradedAtom
                        ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-amber-950/60 border-emerald-400/70'
                        : 'bg-slate-900 border-amber-400/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-xl bg-slate-950 border border-slate-700 shrink-0">{iconEl}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-black text-white text-base">{m.name}</h4>
                            {(isUpgradedAtom || isUpgradedHydro) && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400 text-sm font-black text-emerald-200">
                                ⚡ Nâng cấp
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-mono font-bold text-amber-300 flex flex-wrap items-center gap-x-2">
                            <span>💰 {formatPopulation(goldCost)}</span>
                            {areResourcesEnabled() && (resCost.oil > 0 || resCost.minerals > 0) && (
                              <span className="text-sky-200">
                                🛢️ {resCost.oil} <span className="text-violet-200">⛏️ {resCost.minerals}</span>
                              </span>
                            )}
                            <span className="text-slate-100">• ⭕ {effectiveRadius}</span>
                          </div>
                        </div>
                      </div>
                      <InfoButton active={openInfo === m.id} onClick={() => toggle(m.id)} />
                    </div>

                    {openInfo === m.id && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-950/95 border border-slate-600 text-sm text-slate-100 leading-relaxed space-y-1">
                        <p>{infoText}</p>
                        <p className={m.id === 'MIRV' ? 'text-emerald-200 font-bold' : 'text-amber-200 font-bold'}>
                          {m.id === 'MIRV'
                            ? '✅ Không thể bị phòng không (SAM) chặn.'
                            : '🛡️ SAM địch có 75% cơ hội đánh chặn.'}
                        </p>
                      </div>
                    )}

                    <button
                      disabled={!canLaunch}
                      onClick={() => { onClose(); onSelectMissile(m.id); }}
                      className={`mt-2.5 w-full min-h-[46px] py-2.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        canLaunch
                          ? m.id === 'MIRV'
                            ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white'
                            : m.id === 'HYDRO'
                            ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white'
                            : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 border border-slate-600 cursor-not-allowed opacity-70'
                      }`}
                    >
                      <Rocket className="w-4 h-4" />
                      {!hasReadySilo
                        ? 'Đang hồi chiêu'
                        : !hasEnoughGold
                        ? `Thiếu ${formatPopulation(goldCost - playerNation.gold)} Vàng`
                        : !hasEnoughRes
                        ? 'Thiếu Dầu / Khoáng sản'
                        : 'Khai hỏa'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
