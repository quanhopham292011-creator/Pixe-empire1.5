import React, { useState } from 'react';
import { Rocket, Flame, Sparkles, X, CheckCircle2, Clock, Plus } from 'lucide-react';
import { Nation, Tile, MissileType } from '../types';
import { MISSILE_CONFIG, MISSILE_SETTINGS, formatPopulation } from '../utils/constants';
import { areResourcesEnabled, canAffordMissileResources, getMissileResourceCost, formatResource } from '../utils/resources';
import { getAtomEffectiveStats, getMissileEffectiveCost, hasUpgradedHydro } from '../utils/supremeTech';

interface MissileModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  silos: Tile[];
  onSelectMissile: (type: MissileType) => void;
  onOpenBuildModal: () => void;
}

// Nút "!" nhỏ ở góc, bấm vào mới hiện thông tin
const InfoButton: React.FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Xem thông tin"
    className={`w-6 h-6 rounded-full border text-[12px] font-black flex items-center justify-center shrink-0 active:scale-90 transition-all ${
      active
        ? 'bg-amber-400 text-slate-900 border-amber-300'
        : 'bg-slate-800 text-amber-300 border-slate-600'
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
}) => {
  const [openInfo, setOpenInfo] = useState<string | null>(null);
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

  const toggle = (id: string) => setOpenInfo(prev => (prev === id ? null : id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-left">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
              <Rocket className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white tracking-wide">TẤN CÔNG</h3>
              <p className="text-[11px] text-amber-400 font-mono font-bold truncate">
                💰 {formatPopulation(playerNation.gold)}
                {areResourcesEnabled() && (
                  <span className="ml-2 text-sky-300">
                    🛢️ {formatResource(playerNation.oil)}{' '}
                    <span className="text-violet-300">⛏️ {formatResource(playerNation.minerals)}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InfoButton active={openInfo === 'tip'} onClick={() => toggle('tip')} />
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl active:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mẹo (chỉ hiện khi bấm "!" ở header) */}
        {openInfo === 'tip' && (
          <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-500/30 text-[11px] text-amber-100">
            Bấm "Khai hỏa", rồi chạm vào đất kẻ thù trên bản đồ. Bệ phóng gần nhất sẽ tự bắn.
          </div>
        )}

        {/* TRẠNG THÁI BỆ PHÓNG */}
        <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-bold gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-300">Bệ: <strong className="text-white font-mono">{totalSilos}</strong></span>
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <strong className="font-mono">{readySilos.length}</strong>
            </span>
            {cooldownSilos.length > 0 && (
              <span className="flex items-center gap-1 text-rose-400">
                <Clock className="w-3.5 h-3.5" />
                <strong className="font-mono">{cooldownSilos.length}</strong> ({minCooldown}s)
              </span>
            )}
          </div>
          <button
            onClick={() => { onClose(); onOpenBuildModal(); }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[10px] rounded-lg border border-slate-700 flex items-center gap-1 active:scale-95 shrink-0"
          >
            <Plus className="w-3 h-3" /> Xây bệ ({formatPopulation(MISSILE_SETTINGS.SILO_BUILD_COST)})
          </button>
        </div>

        {/* DANH SÁCH */}
        <div className="p-3 overflow-y-auto space-y-2.5 flex-1">
          {totalSilos === 0 && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-2xl flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-rose-300">Chưa có bệ phóng</span>
              <button
                onClick={() => { onClose(); onOpenBuildModal(); }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Xây ngay
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

            let iconEl = <Rocket className="w-5 h-5 text-amber-400" />;
            if (m.id === 'HYDRO') iconEl = <Flame className="w-5 h-5 text-orange-400" />;
            if (m.id === 'MIRV') iconEl = <Sparkles className="w-5 h-5 text-pink-400" />;

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
                    ? 'bg-gradient-to-r from-pink-950/30 via-slate-900 to-purple-950/30 border-pink-500/50'
                    : m.id === 'HYDRO'
                    ? 'bg-gradient-to-r from-orange-950/30 via-slate-900 to-amber-950/30 border-orange-500/50'
                    : isUpgradedAtom
                    ? 'bg-gradient-to-r from-emerald-950/30 via-slate-900 to-amber-950/30 border-emerald-500/60'
                    : 'bg-slate-900 border-amber-500/40'
                }`}
              >
                {/* Hàng trên: icon + tên + giá + bán kính + nút "!" */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0">{iconEl}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-black text-white text-sm">{m.name}</h4>
                        {(isUpgradedAtom || isUpgradedHydro) && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/50 text-[9px] font-black text-emerald-300">
                            ⚡ Nâng cấp
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono font-bold text-amber-400 truncate">
                        💰 {formatPopulation(goldCost)}
                        {areResourcesEnabled() && (resCost.oil > 0 || resCost.minerals > 0) && (
                          <span className="text-sky-300">
                            {' '}🛢️ {resCost.oil} <span className="text-violet-300">⛏️ {resCost.minerals}</span>
                          </span>
                        )}
                        <span className="text-slate-400"> • ⭕ {effectiveRadius}</span>
                      </div>
                    </div>
                  </div>
                  <InfoButton active={openInfo === m.id} onClick={() => toggle(m.id)} />
                </div>

                {/* Thông tin chi tiết: chỉ hiện khi bấm "!" */}
                {openInfo === m.id && (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-[11px] text-slate-300 leading-relaxed space-y-1">
                    <p>{infoText}</p>
                    <p className={m.id === 'MIRV' ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                      {m.id === 'MIRV'
                        ? '✅ Không thể bị phòng không (SAM) chặn.'
                        : '🛡️ SAM địch có 75% cơ hội đánh chặn.'}
                    </p>
                  </div>
                )}

                {/* Nút khai hỏa */}
                <button
                  disabled={!canLaunch}
                  onClick={() => { onClose(); onSelectMissile(m.id); }}
                  className={`mt-2.5 w-full py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 min-h-[42px] transition-all active:scale-95 ${
                    canLaunch
                      ? m.id === 'MIRV'
                        ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white'
                        : m.id === 'HYDRO'
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
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
    </div>
  );
};
