import React from 'react';
import { Rocket, Flame, Sparkles, AlertTriangle, X, ShieldAlert, CheckCircle2, Clock, Plus } from 'lucide-react';
import { Nation, Tile, MissileType } from '../types';
import { MISSILE_CONFIG, MISSILE_SETTINGS, formatPopulation } from '../utils/constants';

interface MissileModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  silos: Tile[];
  onSelectMissile: (type: MissileType) => void;
  onOpenBuildModal: () => void;
}

export const MissileModal: React.FC<MissileModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  silos,
  onSelectMissile,
  onOpenBuildModal,
}) => {
  if (!isOpen) return null;

  const totalSilos = silos.length;
  const readySilos = silos.filter(s => (s.missileCooldown || 0) <= 0);
  const cooldownSilos = silos.filter(s => (s.missileCooldown || 0) > 0);
  const minCooldown = cooldownSilos.length > 0 
    ? Math.min(...cooldownSilos.map(s => s.missileCooldown || 0))
    : 0;

  const missiles = (['ATOM', 'HYDRO', 'MIRV'] as MissileType[]).map(key => MISSILE_CONFIG[key]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-rose-500/40 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-left">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                BỆ PHÓNG TÊN LỬA CHIẾN LƯỢC
              </h3>
              <p className="text-[11px] text-amber-400 font-mono font-bold">
                💰 Vàng của bạn: {formatPopulation(playerNation.gold)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl active:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TRẠNG THÁI BỆ PHÓNG (SILOS) */}
        <div className="px-4 py-2.5 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-3">
            <span className="text-slate-300">
              Bệ phóng: <strong className="text-white font-mono">{totalSilos}</strong>
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Sẵn sàng: <strong className="font-mono">{readySilos.length}</strong>
            </span>
            {cooldownSilos.length > 0 && (
              <span className="flex items-center gap-1 text-rose-400 animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                Hồi chiêu: <strong className="font-mono">{cooldownSilos.length}</strong> ({minCooldown}s)
              </span>
            )}
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenBuildModal();
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[10px] rounded-lg border border-slate-700 flex items-center gap-1 active:scale-95 transition-all"
          >
            <Plus className="w-3 h-3" /> Xây thêm ({formatPopulation(MISSILE_SETTINGS.SILO_BUILD_COST)}đ)
          </button>
        </div>

        {/* NỘI DUNG CUỘN CHÍNH */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 flex-1">
          {/* CẢNH BÁO NẾU CHƯA CÓ BỆ PHÓNG */}
          {totalSilos === 0 && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/50 rounded-2xl flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-rose-300">Bạn chưa có Bệ Phóng Tên Lửa nào!</div>
                <div className="text-slate-300 mt-0.5 leading-relaxed">
                  Để bắn tên lửa, hãy xây Bệ Tên Lửa (Silo) trên đất của bạn với giá {formatPopulation(MISSILE_SETTINGS.SILO_BUILD_COST)} vàng.
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenBuildModal();
                  }}
                  className="mt-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" /> Xây Bệ Phóng Ngay
                </button>
              </div>
            </div>
          )}

          {/* DANH SÁCH 3 LOẠI TÊN LỬA */}
          {missiles.map((m) => {
            const canAfford = playerNation.gold >= m.cost;
            const hasReadySilo = readySilos.length > 0;
            const canLaunch = canAfford && hasReadySilo;

            let iconEl = <Rocket className="w-5 h-5 text-amber-400" />;
            if (m.id === 'HYDRO') iconEl = <Flame className="w-5 h-5 text-orange-400" />;
            if (m.id === 'MIRV') iconEl = <Sparkles className="w-5 h-5 text-pink-400" />;

            return (
              <div
                key={m.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  m.id === 'MIRV'
                    ? 'bg-gradient-to-r from-pink-950/30 via-slate-900 to-purple-950/30 border-pink-500/50'
                    : m.id === 'HYDRO'
                    ? 'bg-gradient-to-r from-orange-950/30 via-slate-900 to-amber-950/30 border-orange-500/50'
                    : 'bg-slate-900 border-amber-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                      {iconEl}
                    </div>
                    <div>
                      <h4 className="font-black text-white text-sm">{m.name}</h4>
                      <span className="text-[10px] font-mono font-bold text-amber-400">
                        Giá: {formatPopulation(m.cost)} Vàng
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                      Bán kính: {m.radius} ô
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                  {m.description}
                </p>

                {/* THẺ ĐÁNH GIÁ PHÒNG THỦ SAM */}
                <div className="flex items-center gap-2 mb-3 text-[10px]">
                  {m.id === 'MIRV' ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Miễn nhiễm phòng không (Không thể bị SAM chặn)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> SAM địch có 75% cơ hội đánh chặn
                    </span>
                  )}
                </div>

                {/* NÚT KHAI HỎA */}
                <button
                  disabled={!canLaunch}
                  onClick={() => {
                    onClose();
                    onSelectMissile(m.id);
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 min-h-[46px] transition-all shadow-lg active:scale-95 ${
                    canLaunch
                      ? m.id === 'MIRV'
                        ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white hover:brightness-110 shadow-pink-500/30'
                        : m.id === 'HYDRO'
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:brightness-110 shadow-orange-500/30'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 hover:brightness-110 shadow-amber-500/30'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                  }`}
                >
                  <Rocket className="w-4 h-4" />
                  {!hasReadySilo
                    ? 'Bệ Phóng Đang Hồi Chiêu'
                    : !canAfford
                    ? `Thiếu ${formatPopulation(m.cost - playerNation.gold)} Vàng`
                    : `Chọn Mục Tiêu & Khai Hỏa ${m.name}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            💡 <strong>Mẹo:</strong> Sau khi bấm, hãy chạm vào bất kỳ vùng đất của kẻ thù trên bản đồ để bệ phóng gần nhất tự khai hỏa!
          </p>
        </div>
      </div>
    </div>
  );
};
