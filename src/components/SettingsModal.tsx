import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Pause, Play, Map, LogOut, X, AlertTriangle, Settings, Cloud, CloudRain, Sun, EyeOff, Eye } from 'lucide-react';
import { WeatherType } from '../types';
import { soundManager } from '../utils/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
  weatherEnabled: boolean;
  onToggleWeather: () => void;
  weather: WeatherType;
  onCycleWeather: () => void;
  fogOfWarEnabled: boolean;
  onToggleFogOfWar: () => void;
  onSaveAndContinue: () => void;
  onSaveAndQuit: () => void;
  onQuitWithoutSaving: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
  onToggleSound,
  isPaused,
  onTogglePause,
  showMinimap,
  onToggleMinimap,
  weatherEnabled,
  onToggleWeather,
  weather,
  onCycleWeather,
  fogOfWarEnabled,
  onToggleFogOfWar,
  onSaveAndContinue,
  onSaveAndQuit,
  onQuitWithoutSaving,
}) => {
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [vol, setVol] = useState(Math.round(soundManager.volume * 100));
  const [uiScale] = useState(() => {
    const saved = localStorage.getItem('uiScale');
    return !saved || saved === '95%' ? '100%' : saved;
  });

  useEffect(() => {
    document.documentElement.style.fontSize = uiScale;
    localStorage.setItem('uiScale', uiScale);
  }, [uiScale]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2 text-amber-300">
            <Settings className="w-5 h-5 animate-spin-slow" />
            <h3 className="font-extrabold text-base text-white">CÀI ĐẶT TRẬN ĐẤU</h3>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2 rounded-xl bg-slate-800 text-slate-100 hover:text-white hover:bg-slate-700 border border-slate-600 flex items-center justify-center transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung xác nhận thoát không lưu */}
        {showQuitConfirm ? (
          <div className="bg-red-950/70 border border-red-400/60 rounded-2xl p-4 text-center space-y-3 animate-in zoom-in-95 duration-150">
            <AlertTriangle className="w-10 h-10 text-red-300 mx-auto animate-bounce" />
            <h4 className="font-bold text-base text-red-100">THOÁT KHÔNG LƯU?</h4>
            <p className="text-sm text-slate-100 leading-relaxed">
              Bạn có chắc chắn muốn thoát mà không lưu? Tiến trình chưa lưu sẽ bị mất.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowQuitConfirm(false)}
                className="flex-1 min-h-[44px] py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl border border-slate-600"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  setShowQuitConfirm(false);
                  onClose();
                  onQuitWithoutSaving();
                }}
                className="flex-1 min-h-[44px] py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl shadow-lg"
              >
                Thoát Không Lưu
              </button>
            </div>
          </div>
        ) : (
          /* Cài đặt chính */
          <div className="space-y-3">
            {/* 1. Âm thanh */}
            <div className="flex items-center justify-between gap-2 p-3 bg-slate-950/90 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-2.5 min-w-0">
                {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-300 shrink-0" /> : <VolumeX className="w-5 h-5 text-slate-300 shrink-0" />}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">Âm Thanh Game</div>
                  <div className="text-sm text-slate-200">Hiệu ứng chiến đấu & âm báo</div>
                </div>
              </div>
              <button
                onClick={onToggleSound}
                className={`min-h-[44px] min-w-[64px] px-3 py-2 rounded-xl text-sm font-bold border transition-all shrink-0 ${
                  soundEnabled
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                    : 'bg-slate-800 border-slate-600 text-slate-100'
                }`}
              >
                {soundEnabled ? 'BẬT' : 'TẮT'}
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-950/90 rounded-2xl border border-slate-700">
              <Volume2 className="w-5 h-5 text-emerald-300 shrink-0" />
              <input
                type="range" min={0} max={100} step={5}
                value={vol}
                disabled={!soundEnabled}
                onChange={(e) => { const v = Number(e.target.value); setVol(v); soundManager.setVolume(v / 100); }}
                className="w-full h-8 accent-emerald-400 disabled:opacity-40"
              />
              <span className="text-sm font-bold text-white w-10 text-right shrink-0">{vol}%</span>
            </div>

            {/* 2. Tạm dừng trận đấu */}
            <div className="flex items-center justify-between gap-2 p-3 bg-slate-950/90 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-2.5 min-w-0">
                {isPaused ? <Play className="w-5 h-5 text-amber-300 shrink-0" /> : <Pause className="w-5 h-5 text-blue-300 shrink-0" />}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">Trạng Thái Trận Đấu</div>
                  <div className="text-sm text-slate-200">{isPaused ? 'Đang tạm dừng' : 'Đang diễn ra bình thường'}</div>
                </div>
              </div>
              <button
                onClick={onTogglePause}
                className={`min-h-[44px] min-w-[84px] px-3 py-2 rounded-xl text-sm font-bold border transition-all shrink-0 ${
                  isPaused
                    ? 'bg-amber-600 border-amber-400 text-white shadow'
                    : 'bg-slate-800 border-slate-600 text-white'
                }`}
              >
                {isPaused ? 'TIẾP TỤC' : 'TẠM DƯNG'}
              </button>
            </div>

            {/* 3. Hiển thị Mini Map */}
            <div className="flex items-center justify-between gap-2 p-3 bg-slate-950/90 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-2.5 min-w-0">
                <Map className="w-5 h-5 text-cyan-300 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">Hiển Thị Bản Đồ Nhỏ</div>
                  <div className="text-sm text-slate-200">Minimap ở góc trên màn hình</div>
                </div>
              </div>
              <button
                onClick={onToggleMinimap}
                className={`min-h-[44px] min-w-[64px] px-3 py-2 rounded-xl text-sm font-bold border transition-all shrink-0 ${
                  showMinimap
                    ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow'
                    : 'bg-slate-800 border-slate-600 text-slate-100'
                }`}
              >
                {showMinimap ? 'HIỆN' : 'ẨN'}
              </button>
            </div>

            {/* 4. Hiệu ứng Thời tiết */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/90 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-2.5 min-w-0">
                {weather === 'RAIN' ? (
                  <CloudRain className="w-5 h-5 text-sky-300 shrink-0" />
                ) : weather === 'CLOUDY' ? (
                  <Cloud className="w-5 h-5 text-indigo-300 shrink-0" />
                ) : (
                  <Sun className="w-5 h-5 text-amber-300 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">Hiệu Ứng Thời Tiết</div>
                  <div className="text-sm text-slate-200">
                    {weather === 'RAIN' ? 'Mưa lất phất' : weather === 'CLOUDY' ? 'Mây trôi bồng bềnh' : 'Nắng nhẹ'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {weatherEnabled && (
                  <button
                    onClick={onCycleWeather}
                    className="min-h-[44px] px-3 py-2 rounded-xl text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 transition-colors"
                  >
                    Đổi kiểu
                  </button>
                )}
                <button
                  onClick={onToggleWeather}
                  className={`min-h-[44px] min-w-[64px] px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                    weatherEnabled
                      ? 'bg-sky-600 border-sky-400 text-white shadow'
                      : 'bg-slate-800 border-slate-600 text-slate-100'
                  }`}
                >
                  {weatherEnabled ? 'BẬT' : 'TẮT'}
                </button>
              </div>
            </div>

            {/* 5. Sương Mù Chiến Tranh */}
            <div className="flex items-center justify-between gap-2 p-3 bg-slate-950/90 rounded-2xl border border-slate-700">
              <div className="flex items-center gap-2.5 min-w-0">
                {fogOfWarEnabled ? <EyeOff className="w-5 h-5 text-purple-300 shrink-0" /> : <Eye className="w-5 h-5 text-slate-300 shrink-0" />}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">Sương Mù Chiến Tranh</div>
                  <div className="text-sm text-slate-200">Ẩn vùng nằm ngoài tầm nhìn quân đội</div>
                </div>
              </div>
              <button
                onClick={onToggleFogOfWar}
                className={`min-h-[44px] min-w-[64px] px-3 py-2 rounded-xl text-sm font-bold border transition-all shrink-0 ${
                  fogOfWarEnabled
                    ? 'bg-purple-600 border-purple-400 text-white shadow'
                    : 'bg-slate-800 border-slate-600 text-slate-100'
                }`}
              >
                {fogOfWarEnabled ? 'BẬT' : 'TẮT'}
              </button>
            </div>

            {/* 6. Nút Lưu và Thoát */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  onClose();
                  onSaveAndContinue();
                }}
                className="w-full min-h-[44px] py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow transition-all active:scale-95"
              >
                💾 Lưu và tiếp tục
              </button>
              <button
                onClick={() => {
                  onClose();
                  onSaveAndQuit();
                }}
                className="w-full min-h-[44px] py-2.5 bg-blue-700 hover:bg-blue-600 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow transition-all active:scale-95"
              >
                💾 Lưu và thoát về menu chính
              </button>
              <button
                onClick={() => setShowQuitConfirm(true)}
                className="w-full min-h-[44px] py-2.5 bg-red-950/80 hover:bg-red-900 border border-red-500/80 text-red-100 font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                Thoát không lưu
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
