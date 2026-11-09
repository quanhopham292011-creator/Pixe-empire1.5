import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { PlayerProfile, MapDimension, GameDifficulty } from '../types';
import { MAX_PLAYER_LEVEL } from '../utils/progression';
import { GeneralModel } from './GeneralModel';
import { UserAccountBadge } from './UserAccountBadge';
import { 
  Crown, Star, Coins, Edit3, Settings, Users, TreePine, Cpu, Shield, Swords, Wand2, Play, RotateCcw, ChevronRight, Sliders, X, Sparkles, Check
} from 'lucide-react';

interface TitleMenuProps {
  currentUser: FirebaseUser | null;
  playerProfile: PlayerProfile;
  playerName: string;
  setPlayerName: (name: string) => void;
  mapSize: MapDimension;
  setMapSize: (size: MapDimension) => void;
  gameMode: 'STANDARD' | 'CREATIVE';
  setGameMode: (mode: 'STANDARD' | 'CREATIVE') => void;
  difficulty: GameDifficulty;
  setDifficulty: (diff: GameDifficulty) => void;
  savedGameInfo: any;
  loadGame: () => void;
  startNewGame: (diff: GameDifficulty, size: MapDimension, name: string, mode: 'STANDARD' | 'CREATIVE') => void;
  setShowConfirmNewGame: (show: boolean) => void;
  setIsAuthModalOpen: (open: boolean) => void;
  setIsAdminPanelOpen: (open: boolean) => void;
  setIsGeneralSelectOpen: (open: boolean) => void;
  setIsSkillTreeOpen: (open: boolean) => void;
  setIsTechOpen: (open: boolean) => void;
  setIsMultiplayerModalOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  isUserAdmin: (user: FirebaseUser | null) => boolean;
  fbSignOut: (auth: any) => Promise<void>;
  auth: any;
  soundManager: { playClick: () => void };
}

export const TitleMenu: React.FC<TitleMenuProps> = ({
  currentUser,
  playerProfile,
  playerName,
  setPlayerName,
  mapSize,
  setMapSize,
  gameMode,
  setGameMode,
  difficulty,
  setDifficulty,
  savedGameInfo,
  loadGame,
  startNewGame,
  setShowConfirmNewGame,
  setIsAuthModalOpen,
  setIsAdminPanelOpen,
  setIsGeneralSelectOpen,
  setIsSkillTreeOpen,
  setIsTechOpen,
  setIsMultiplayerModalOpen,
  setIsSettingsOpen,
  isUserAdmin,
  fbSignOut,
  auth,
  soundManager,
}) => {
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false);

  const menuGridItems = [
    {
      id: 'generals',
      label: 'Tướng',
      icon: <div className="w-8 h-8 flex items-center justify-center scale-75"><GeneralModel skillId={playerProfile.selectedGeneral} size={36} /></div>,
      onClick: () => { soundManager.playClick(); setIsGeneralSelectOpen(true); },
    },
    {
      id: 'skills',
      label: 'Kỹ Năng',
      icon: <TreePine className="w-6 h-6 text-emerald-400" />,
      badge: playerProfile.skillPoints > 0 ? playerProfile.skillPoints : undefined,
      onClick: () => { soundManager.playClick(); setIsSkillTreeOpen(true); },
    },
    {
      id: 'tech',
      label: 'Công Nghệ',
      icon: <Cpu className="w-6 h-6 text-cyan-400" />,
      onClick: () => { soundManager.playClick(); setIsTechOpen(true); },
    },
    {
      id: 'multiplayer',
      label: 'Nhiều Người',
      icon: <Users className="w-6 h-6 text-blue-400" />,
      onClick: () => { soundManager.playClick(); setIsMultiplayerModalOpen(true); },
    },
    {
      id: 'settings',
      label: 'Cài Đặt',
      icon: <Settings className="w-6 h-6 text-amber-400" />,
      onClick: () => { soundManager.playClick(); setIsSettingsOpen(true); },
    },
  ];

  return (
    <div 
      className="flex flex-col items-center flex-1 p-3 sm:p-4 text-center bg-gradient-to-b from-slate-900 via-slate-950 to-black min-h-0 overflow-y-auto overscroll-contain"
      style={{ 
        paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))', 
        paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        touchAction: 'pan-y',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      <div className="max-w-md w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-md my-auto space-y-4">
        
        {/* 1. HÀNG THÔNG TIN THU GỌN: Tên đế quốc, cấp độ, xu */}
        <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-2xl p-3 shadow-inner gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-black text-xs shrink-0 shadow">
              Lv.{playerProfile.level}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="relative flex items-center">
                <input
                  type="text"
                  maxLength={24}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Tên quốc gia..."
                  className="w-full bg-transparent text-white font-bold text-xs sm:text-sm focus:bg-slate-900 px-1.5 py-0.5 rounded outline-none border-b border-transparent focus:border-amber-500 transition-colors truncate"
                />
              </div>
              <div className="text-[10px] text-slate-400 px-1.5 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Đế Quốc Của Tôi</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/15 border border-amber-500/40 rounded-xl shadow-inner">
              <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-black text-amber-300 font-mono">
                {playerProfile.pixelCoins}
              </span>
            </div>
          </div>
        </div>

        {/* TÀI KHOẢN & NÚT ADMIN NẾU CÓ */}
        <div className="space-y-2">
          <UserAccountBadge
            currentUser={currentUser}
            playerProfile={playerProfile}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
            onSignOut={async () => {
              await fbSignOut(auth);
            }}
          />

          {isUserAdmin(currentUser) && (
            <button
              type="button"
              onClick={() => setIsAdminPanelOpen(true)}
              className="w-full py-2 px-3 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-600 text-white font-black rounded-xl border border-amber-400/80 shadow-lg flex items-center justify-between text-xs active:scale-98 transition-all min-h-[44px]"
            >
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>BẢNG ĐIỀU KHIỂN ADMIN</span>
              </div>
              <span className="text-[10px] bg-black/40 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold">
                ⚡ Mở Panel
              </span>
            </button>
          )}
        </div>

        {/* 2. NÚT LỚN "KHỞI ĐẦU CHINH PHỤC" Ở GIỮA, LUÔN NHÌN THẤY */}
        <div className="space-y-2.5 pt-1">
          {savedGameInfo ? (
            <>
              <button
                type="button"
                onClick={loadGame}
                className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-between min-h-[52px] active:scale-98 border border-emerald-400/40"
              >
                <div className="flex items-center gap-3 text-left min-w-0">
                  <RotateCcw className="w-5 h-5 text-emerald-200 shrink-0 animate-spin-slow" />
                  <div className="min-w-0">
                    <div className="text-sm font-black leading-tight flex items-center gap-2">
                      Tiếp Tục Ván Cũ
                      <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        {savedGameInfo.mode}
                      </span>
                    </div>
                    <div className="text-[11px] text-emerald-100/90 font-normal mt-0.5 truncate">
                      {savedGameInfo.playerName} • Lưu: {savedGameInfo.timestamp} ({savedGameInfo.gameTimeStr})
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-200 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmNewGame(true)}
                className="w-full py-3 px-4 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 text-xs active:scale-98 shadow min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" />
                Chơi Mới (Xóa ván cũ)
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => startNewGame(difficulty, mapSize, playerName, gameMode)}
              className={`w-full py-4 px-4 text-white font-extrabold rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2.5 text-base min-h-[56px] active:scale-98 ${
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

          {/* 3. NÚT NHỎ "TÙY CHỈNH VÁN" MỞ BOTTOM SHEET */}
          <button
            type="button"
            onClick={() => { soundManager.playClick(); setIsSettingsSheetOpen(true); }}
            className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-bold rounded-xl border border-slate-700/80 transition-all flex items-center justify-center gap-2 text-xs min-h-[44px] active:scale-98 shadow-sm"
          >
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>⚙️ Tùy chỉnh ván (Bản đồ: {mapSize}x{mapSize} • {gameMode === 'CREATIVE' ? 'Sáng Tạo' : difficulty})</span>
          </button>
        </div>

        {/* 4. LƯỚI ICON VUÔNG 3 CỘT Ở DƯỚI */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="grid grid-cols-3 gap-2.5">
            {menuGridItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="relative flex flex-col items-center justify-center p-3 bg-slate-950/80 hover:bg-slate-800/90 active:scale-95 border border-slate-800 hover:border-amber-500/50 rounded-2xl transition-all shadow-md min-h-[72px] group"
              >
                {item.badge !== undefined && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full shadow animate-pulse">
                    {item.badge}
                  </span>
                )}
                <div className="mb-1.5 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300 transition-colors">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* BOTTOM SHEET: TÙY CHỈNH VÁN CHƠI */}
      {isSettingsSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-md bg-slate-900 border-t border-slate-700 rounded-t-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-left animate-slide-up max-h-[90vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Tùy Chỉnh Ván Chơi</h3>
              </div>
              <button
                onClick={() => { soundManager.playClick(); setIsSettingsSheetOpen(false); }}
                className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Kích thước thế giới */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Kích thước thế giới:</label>
              <div className="grid grid-cols-3 gap-2">
                {[64, 96, 128].map(sz => (
                  <button
                    key={sz}
                    onClick={() => setMapSize(sz as MapDimension)}
                    className={`py-3 rounded-xl text-xs font-bold border transition-all min-h-[44px] ${
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

            {/* Chế độ chơi */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Chọn chế độ chơi:</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setGameMode('STANDARD')}
                  className={`py-3 px-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                    gameMode === 'STANDARD'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Swords className="w-4 h-4" />
                  <span>Chiến Thuật Chuẩn</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGameMode('CREATIVE')}
                  className={`py-3 px-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                    gameMode === 'CREATIVE'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Wand2 className="w-4 h-4 text-amber-300 animate-spin-slow" />
                  <span>🎨 Sáng Tạo (Sandbox)</span>
                </button>
              </div>
            </div>

            {/* Độ khó */}
            {gameMode === 'CREATIVE' ? (
              <div className="bg-gradient-to-r from-purple-950/60 to-pink-950/60 border border-purple-500/60 p-3 rounded-2xl space-y-1 shadow-inner">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Đặc Quyền Chế Độ Sáng Tạo:</span>
                </div>
                <ul className="text-[11px] text-purple-200/90 list-disc list-inside space-y-0.5">
                  <li>Khởi đầu với 999,999 Vàng & 50,000 Quân đội.</li>
                  <li>Tự do tăng giảm Vàng & Quân tùy thích.</li>
                  <li>Spam thời tiết & triệu hồi Tà Thần Cổ Đại.</li>
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
                      className={`py-3 rounded-xl text-xs font-bold border transition-all min-h-[44px] ${
                        difficulty === diff
                          ? 'bg-amber-600 border-amber-400 text-white shadow-md'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400'
                      }`}
                    >
                      {diff === 'EASY' ? 'Dễ' : diff === 'NORMAL' ? 'Vừa' : 'Khó'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => { soundManager.playClick(); setIsSettingsSheetOpen(false); }}
              className="w-full py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl text-sm min-h-[48px] shadow-lg shadow-amber-950/50"
            >
              Áp Dụng & Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
