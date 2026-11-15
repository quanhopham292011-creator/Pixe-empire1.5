import React, { useState } from 'react';
import { Nation, WeatherType, DarkTitan } from '../types';
import { formatPopulation } from '../utils/constants';
import { 
  Wand2, X, Sparkles, Coins, Users, Cloud, Sun, CloudRain, 
  Zap, Skull, Flame, ShieldAlert, Check, RefreshCw, Trash2, Award
} from 'lucide-react';

interface CreativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  currentWeather: WeatherType;
  darkTitans: DarkTitan[];
  onSetGold: (amount: number) => void;
  onAddGold: (amount: number) => void;
  onSetTroops: (amount: number) => void;
  onAddTroops: (amount: number) => void;
  onChangeWeather: (weather: WeatherType) => void;
  onTriggerLightningSpam: () => void;
  onSpawnDarkTitan: (count?: number) => void;
  onClearDarkTitans: () => void;
  onUnlockAllTech: () => void;
  onClearAllScorched: () => void;
  onClaimSelectedTile?: () => void;
  selectedTileCoords?: { x: number; y: number } | null;
  godModeLocked: boolean;
  onToggleGodModeLocked: () => void;
  onTriggerCoalition?: () => void;
  gameMode?: string;
  onAddReserveGeneral?: () => void;
}

export const CreativeModal: React.FC<CreativeModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  currentWeather,
  darkTitans,
  onSetGold,
  onAddGold,
  onSetTroops,
  onAddTroops,
  onChangeWeather,
  onTriggerLightningSpam,
  onSpawnDarkTitan,
  onClearDarkTitans,
  onUnlockAllTech,
  onClearAllScorched,
  onClaimSelectedTile,
  selectedTileCoords,
  godModeLocked,
  onToggleGodModeLocked,
  onTriggerCoalition,
  gameMode,
  onAddReserveGeneral,
}) => {
  const [customGold, setCustomGold] = useState<string>('999999');
  const [customTroops, setCustomTroops] = useState<string>('50000');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg max-h-[92vh] bg-slate-950 border-2 border-purple-400/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
        
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border-b border-purple-600/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-purple-600 rounded-xl text-white shadow-lg shrink-0">
              <Wand2 className="w-5 h-5 animate-spin-slow" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black tracking-wide text-purple-100">
                CHẾ ĐỘ SÁNG TẠO (SANDBOX)
              </h2>
              <p className="text-sm text-purple-200">Quyền năng Thần Thánh tùy biến thế giới</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-white border border-slate-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NỘI DUNG CUỘN CHÍNH */}
        <div className="p-3 sm:p-4 space-y-3.5 overflow-y-auto flex-1 text-sm">

          {/* 1. KHÓA BẤT TỬ / GOD MODE */}
          <div className="bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border border-purple-500/70 p-3 rounded-2xl flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white block">Khóa Bất Tử (God Mode)</span>
                <span className="text-sm text-slate-200">Tự động giữ 999,999 Vàng & 99,999 Quân, không hao hụt</span>
              </div>
            </div>
            <button
              onClick={onToggleGodModeLocked}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-1 shrink-0 ${
                godModeLocked 
                  ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30' 
                  : 'bg-slate-800 text-slate-100 border border-slate-600'
              }`}
            >
              {godModeLocked ? <Check className="w-4 h-4" /> : null}
              {godModeLocked ? 'Đang Bật' : 'Tắt'}
            </button>
          </div>

          {/* 2. TÙY BIẾN VÀNG & QUÂN ĐỘI */}
          <div className="bg-slate-900 border border-slate-700 p-3 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-amber-300 font-bold border-b border-slate-700 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-300" /> Vàng Hiện Có: <strong className="text-white font-mono text-base">{formatPopulation(playerNation.gold)}</strong>
              </span>
            </div>

            {/* Phím tắt cộng Vàng nhanh */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onAddGold(10000)}
                className="min-h-[44px] py-2 bg-amber-950 hover:bg-amber-900 border border-amber-500/70 active:scale-95 text-amber-200 font-bold rounded-xl transition-all"
              >
                +10,000 Vàng
              </button>
              <button
                onClick={() => onAddGold(100000)}
                className="min-h-[44px] py-2 bg-amber-950 hover:bg-amber-900 border border-amber-500/70 active:scale-95 text-amber-200 font-bold rounded-xl transition-all"
              >
                +100,000 Vàng
              </button>
              <button
                onClick={() => onSetGold(999999)}
                className="min-h-[44px] py-2 bg-gradient-to-r from-amber-500 to-yellow-400 active:scale-95 text-slate-950 font-extrabold rounded-xl shadow-md transition-all"
              >
                MAX (999k)
              </button>
            </div>

            {/* Nhập số vàng cụ thể */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                value={customGold}
                onChange={(e) => setCustomGold(e.target.value)}
                placeholder="Nhập số vàng..."
                className="flex-1 min-h-[44px] px-3 py-2 bg-slate-950 border border-slate-600 rounded-xl text-white font-mono font-bold outline-none focus:border-amber-400"
              />
              <button
                onClick={() => {
                  const val = parseInt(customGold, 10);
                  if (!isNaN(val) && val >= 0) onSetGold(val);
                }}
                className="min-h-[44px] px-4 py-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold rounded-xl"
              >
                Đặt Vàng
              </button>
            </div>
          </div>

          {/* 3. TÙY BIẾN QUÂN LÍNH */}
          <div className="bg-slate-900 border border-slate-700 p-3 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-blue-300 font-bold border-b border-slate-700 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-300" /> Quân Số Hiện Có: <strong className="text-white font-mono text-base">{formatPopulation(playerNation.troops)}</strong>
              </span>
            </div>

            {/* Phím tắt cộng Quân nhanh */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onAddTroops(500)}
                className="min-h-[44px] py-2 bg-blue-950 hover:bg-blue-900 border border-blue-500/70 active:scale-95 text-blue-200 font-bold rounded-xl transition-all"
              >
                +500 Quân
              </button>
              <button
                onClick={() => onAddTroops(5000)}
                className="min-h-[44px] py-2 bg-blue-950 hover:bg-blue-900 border border-blue-500/70 active:scale-95 text-blue-200 font-bold rounded-xl transition-all"
              >
                +5,000 Quân
              </button>
              <button
                onClick={() => onSetTroops(99999)}
                className="min-h-[44px] py-2 bg-gradient-to-r from-blue-500 to-cyan-400 active:scale-95 text-slate-950 font-extrabold rounded-xl shadow-md transition-all"
              >
                MAX (99k)
              </button>
            </div>

            {/* Nhập số quân cụ thể */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                value={customTroops}
                onChange={(e) => setCustomTroops(e.target.value)}
                placeholder="Nhập số quân..."
                className="flex-1 min-h-[44px] px-3 py-2 bg-slate-950 border border-slate-600 rounded-xl text-white font-mono font-bold outline-none focus:border-blue-400"
              />
              <button
                onClick={() => {
                  const val = parseInt(customTroops, 10);
                  if (!isNaN(val) && val >= 0) onSetTroops(val);
                }}
                className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl"
              >
                Đặt Quân
              </button>
            </div>
          </div>

          {/* 4. SPAM CÁC LOẠI THỜI TIẾT */}
          <div className="bg-slate-900 border border-slate-700 p-3 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-cyan-200 font-bold border-b border-slate-700 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-cyan-300" /> Spam & Đổi Thời Tiết (Hiện tại: <strong className="text-white uppercase">{currentWeather}</strong>)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => onChangeWeather('CLEAR')}
                className={`min-h-[48px] py-2 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
                  currentWeather === 'CLEAR'
                    ? 'bg-amber-500/35 border-amber-400 text-amber-100'
                    : 'bg-slate-950 border-slate-700 text-slate-200'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-300" />
                <span>Nắng Đẹp</span>
              </button>

              <button
                onClick={() => onChangeWeather('CLOUDY')}
                className={`min-h-[48px] py-2 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
                  currentWeather === 'CLOUDY'
                    ? 'bg-slate-600/60 border-slate-300 text-white'
                    : 'bg-slate-950 border-slate-700 text-slate-200'
                }`}
              >
                <Cloud className="w-4 h-4 text-slate-200" />
                <span>Mây Trôi</span>
              </button>

              <button
                onClick={() => onChangeWeather('RAIN')}
                className={`min-h-[48px] py-2 px-1 rounded-xl font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
                  currentWeather === 'RAIN'
                    ? 'bg-blue-600/40 border-blue-400 text-blue-100'
                    : 'bg-slate-950 border-slate-700 text-slate-200'
                }`}
              >
                <CloudRain className="w-4 h-4 text-blue-300" />
                <span>Mưa Giông</span>
              </button>
            </div>

            {/* Spam tia chớp / sấm sét */}
            <button
              onClick={onTriggerLightningSpam}
              className="w-full min-h-[44px] py-2 bg-gradient-to-r from-amber-600/50 via-yellow-600/50 to-amber-600/50 hover:from-amber-600/70 hover:to-yellow-600/70 border border-amber-400 active:scale-95 text-amber-100 font-bold rounded-xl flex items-center justify-center gap-2 shadow"
            >
              <Zap className="w-4 h-4 text-yellow-300 animate-bounce" />
              <span>⚡ Spam Giông Sét Toàn Bản Đồ (5 Tia Chớp)</span>
            </button>
          </div>

          {/* 5. SPAM TÀ THẦN CỔ ĐẠI */}
          <div className="bg-slate-900 border border-purple-500/60 p-3 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-red-300 font-bold border-b border-purple-700/60 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Skull className="w-4 h-4 text-red-400" /> Spam Tà Thần Cổ Đại (Đang sống: <strong className="text-white font-mono text-base">{darkTitans.length}</strong>)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSpawnDarkTitan(1)}
                className="min-h-[44px] py-2.5 bg-gradient-to-r from-red-900 to-purple-900 hover:from-red-800 hover:to-purple-800 border border-red-400 active:scale-95 text-red-100 font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Skull className="w-4 h-4 text-red-300" />
                <span>Triệu Hồi 1 Tà Thần</span>
              </button>

              <button
                onClick={() => onSpawnDarkTitan(3)}
                className="min-h-[44px] py-2.5 bg-gradient-to-r from-purple-800 to-red-800 hover:from-purple-700 hover:to-red-700 border border-purple-400 active:scale-95 text-white font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Flame className="w-4 h-4 text-orange-300" />
                <span>Spam 3 Tà Thần 🔥</span>
              </button>
            </div>

            {darkTitans.length > 0 && (
              <button
                onClick={onClearDarkTitans}
                className="w-full min-h-[44px] py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 active:scale-95 text-slate-100 font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4 text-slate-200" />
                <span>Dọn Sạch Toàn Bộ Tà Thần ({darkTitans.length})</span>
              </button>
            )}
          </div>

          {/* 6. TIỆN ÍCH SÁNG TẠO BỔ SUNG */}
          <div className="bg-slate-900 border border-slate-700 p-3 rounded-2xl space-y-2">
            <span className="font-bold text-slate-100 block border-b border-slate-700 pb-1.5">
              Quyền Năng Hỗ Trợ Nhanh
            </span>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={onUnlockAllTech}
                className="min-h-[44px] py-2 px-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-400/70 active:scale-95 text-indigo-100 font-bold rounded-xl flex items-center justify-center gap-1 text-center"
              >
                <Award className="w-4 h-4" />
                <span>Mở Cây Công Nghệ</span>
              </button>

              <button
                onClick={onClearAllScorched}
                className="min-h-[44px] py-2 px-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-400/70 active:scale-95 text-emerald-100 font-bold rounded-xl flex items-center justify-center gap-1 text-center"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Thanh Lọc Đất Cháy</span>
              </button>
            </div>

            {/* Pixel Empire 1.7: Nút thêm tướng dự bị chỉ hiện khi gameMode === 'CREATIVE' */}
            {gameMode === 'CREATIVE' && onAddReserveGeneral && (
              <button
                onClick={onAddReserveGeneral}
                className="w-full min-h-[44px] py-2 bg-gradient-to-r from-amber-950 via-yellow-950 to-amber-950 hover:from-amber-900 hover:to-yellow-900 border border-amber-400 active:scale-95 text-amber-100 font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-md"
              >
                <span>➕ Thêm tướng dự bị</span>
              </button>
            )}

            {onTriggerCoalition && (
              <button
                onClick={onTriggerCoalition}
                className="w-full min-h-[44px] py-2 bg-gradient-to-r from-red-950 via-rose-950 to-amber-950 hover:from-red-900 hover:to-amber-900 border border-red-400 active:scale-95 text-red-100 font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-md"
              >
                <Flame className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>🚨 Thử Nghiệm: Kích Hoạt Liên Minh Toàn Cầu (&gt;50% Đất)</span>
              </button>
            )}

            {selectedTileCoords && onClaimSelectedTile && (
              <button
                onClick={onClaimSelectedTile}
                className="w-full min-h-[44px] py-2 bg-blue-950 hover:bg-blue-900 border border-blue-400 active:scale-95 text-blue-100 font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <ShieldAlert className="w-4 h-4 text-blue-300" />
                <span>Chiếm Ngay Ô ({selectedTileCoords.x}, {selectedTileCoords.y})</span>
              </button>
            )}
          </div>

        </div>

        {/* FOOTER */}
        <div className="p-3 bg-slate-950 border-t border-slate-700 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full min-h-[46px] py-3 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-extrabold rounded-2xl text-sm shadow-lg transition-all"
          >
            Đóng Bảng Sáng Tạo
          </button>
        </div>

      </div>
    </div>
  );
};
