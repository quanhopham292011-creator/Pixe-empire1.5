import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { PlayerProfile, MapDimension, GameDifficulty } from '../types';
import { GeneralModel } from './GeneralModel';
import { 
  Crown, Coins, Settings, Users, TreePine, Swords, Wand2, Play, RotateCcw, ChevronRight, Sliders, X, Sparkles, LogIn, LogOut
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
  setIsTechOpen: _unusedTechOpen,
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
      sublabel: 'Đại Tướng',
      icon: (
        <div className="w-8 h-8 flex items-center justify-center shrink-0">
          <GeneralModel skillId={playerProfile.selectedGeneral} size={32} />
        </div>
      ),
      onClick: () => { soundManager.playClick(); setIsGeneralSelectOpen(true); },
    },
    {
      id: 'skills',
      label: 'Kỹ Năng',
      sublabel: 'Cây bổ trợ',
      icon: <TreePine className="w-6 h-6 text-emerald-400 shrink-0" />,
      badge: playerProfile.skillPoints > 0 ? playerProfile.skillPoints : undefined,
      onClick: () => { soundManager.playClick(); setIsSkillTreeOpen(true); },
    },
    {
      id: 'multiplayer',
      label: 'Nhiều Người',
      sublabel: 'Phòng trực tuyến',
      icon: <Users className="w-6 h-6 text-blue-400 shrink-0" />,
      onClick: () => { soundManager.playClick(); setIsMultiplayerModalOpen(true); },
    },
    {
      id: 'settings',
      label: 'Cài Đặt',
      sublabel: 'Âm thanh & hiển thị',
      icon: <Settings className="w-6 h-6 text-amber-400 shrink-0" />,
      onClick: () => { soundManager.playClick(); setIsSettingsOpen(true); },
    },
  ];

  const difficultyLabel = 
    difficulty === 'EASY' ? 'Dễ' : 
    difficulty === 'NORMAL' ? 'Vừa' : 
    difficulty === 'HARD' ? 'Khó' : 'Cực Khó';

  return (
    <div 
      className="pixel-canvas-bg flex flex-col items-center flex-1 p-3 sm:p-4 text-center min-h-0 overflow-y-auto overscroll-contain"
      style={{ 
        paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))', 
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        touchAction: 'pan-y',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      <div className="max-w-md w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl backdrop-blur-md my-auto space-y-3.5">
        
        {/* 1. TÊN GAME: PIXEL EMPIRE */}
        <div className="text-center pt-0.5 pb-0.5 select-none">
          <h1 
            className="text-2xl sm:text-3xl font-black tracking-wider text-amber-400 uppercase font-mono"
            style={{
              textShadow: '0 2px 0 #78350f, 0 4px 10px rgba(245, 158, 11, 0.35)',
              letterSpacing: '0.08em'
            }}
          >
            PIXEL EMPIRE
          </h1>
          <p className="text-[11px] sm:text-xs font-semibold text-slate-300 tracking-wider uppercase mt-0.5 flex items-center justify-center gap-1.5">
            <span className="text-amber-500">⚔️</span>
            <span>Chinh phục thế giới</span>
            <span className="text-amber-500">🛡️</span>
          </p>
        </div>

        {/* 2. HÀNG THÔNG TIN NGƯỜI CHƠI (Lv, Tên, Xu) */}
        <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-inner gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                  className="w-full bg-transparent text-white font-bold text-xs sm:text-sm focus:bg-slate-900 px-1 py-0.5 rounded outline-none border-b border-transparent focus:border-amber-500 transition-colors truncate"
                />
              </div>
              <div className="text-[11px] text-slate-300 px-1 flex items-center gap-1 mt-0.5">
                <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">Đế Quốc Của Tôi</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/15 border border-amber-500/40 rounded-xl shadow-inner min-h-[38px]">
              <Coins className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-black text-amber-300 font-mono">
                {playerProfile.pixelCoins}
              </span>
            </div>
          </div>
        </div>

        {/* 3. NÚT CHƠI CHÍNH (NỔI BẬT NHẤT TRÊN MÀN HÌNH ĐẦU TIÊN) */}
        <div className="space-y-2 pt-0.5">
          {savedGameInfo ? (
            <>
              {/* Nút chính: Tiếp tục ván cũ */}
              <button
                type="button"
                onClick={loadGame}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-500/20 border border-emerald-400/40 transition-all flex items-center justify-between min-h-[58px] active:scale-98"
              >
                <div className="flex items-center gap-3 text-left min-w-0">
                  <RotateCcw className="w-5 h-5 text-emerald-200 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-black leading-tight flex items-center gap-2">
                      <span>Tiếp Tục Ván Cũ</span>
                      <span className="text-[11px] font-bold bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30">
                        {savedGameInfo.mode}
                      </span>
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-200 font-normal mt-0.5 truncate">
                      {savedGameInfo.playerName} • Lưu: {savedGameInfo.timestamp} ({savedGameInfo.gameTimeStr})
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-200 shrink-0" />
              </button>

              {/* Nút nhỏ: Chơi mới (Xóa ván cũ) với viền đỏ nhạt */}
              <button
                type="button"
                onClick={() => setShowConfirmNewGame(true)}
                className="w-full py-2.5 px-3 bg-slate-900/80 hover:bg-red-950/30 text-red-300 font-semibold rounded-xl border border-red-500/30 hover:border-red-500/50 transition-all flex items-center justify-center gap-2 text-xs min-h-[44px] active:scale-98 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>Chơi Mới (Xóa ván cũ)</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => startNewGame(difficulty, mapSize, playerName, gameMode)}
              className={`w-full py-4 px-4 text-white font-extrabold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2.5 text-base min-h-[58px] active:scale-98 ${
                gameMode === 'CREATIVE'
                  ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/25 border border-purple-400/40'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25 border border-blue-400/40'
              }`}
            >
              {gameMode === 'CREATIVE' ? (
                <Wand2 className="w-5 h-5 text-amber-300" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
              <span className="tracking-wide">
                {gameMode === 'CREATIVE' ? 'Bắt Đầu Chế Độ Sáng Tạo' : 'Khởi Đầu Chinh Phục'}
              </span>
            </button>
          )}
        </div>

        {/* 4. NÚT TÙY CHỈNH VÁN (BÊN TRÁI: CHỮ, BÊN PHẢI: CHIP THÔNG SỐ) */}
        <button
          type="button"
          onClick={() => { soundManager.playClick(); setIsSettingsSheetOpen(true); }}
          className="w-full py-2.5 px-3.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-bold rounded-xl border border-slate-700/80 transition-all flex items-center justify-between min-h-[46px] active:scale-98 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-200">Tùy chỉnh ván</span>
          </div>
          <span className="text-[11px] font-mono font-bold bg-slate-900/90 text-amber-300 border border-slate-700 px-2 py-0.5 rounded-lg shrink-0">
            {mapSize}x{mapSize} • {gameMode === 'CREATIVE' ? 'Sáng Tạo' : difficultyLabel}
          </span>
        </button>

        {/* 5. LƯỚI 4 NÚT CHỨC NĂNG (2 CỘT x 2 HÀNG, ICON TRÁI - CHỮ PHẢI) */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {menuGridItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="relative flex items-center gap-3 px-3.5 h-[64px] min-h-[58px] bg-slate-950/80 hover:bg-slate-800/90 active:scale-98 border border-slate-800 hover:border-amber-500/50 rounded-2xl transition-all shadow-md group text-left"
              >
                {item.badge !== undefined && (
                  <span className="absolute top-2 right-2.5 px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[11px] font-black rounded-full shadow leading-none">
                    {item.badge}
                  </span>
                )}
                <div className="shrink-0 group-hover:scale-105 transition-transform">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors block truncate">
                    {item.label}
                  </span>
                  <span className="text-[11px] text-slate-300 block truncate">
                    {item.sublabel}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 6. TÀI KHOẢN & ADMIN (XUỐNG CUỐI, THU NHỎ THÀNH 1 DÒNG GỌN) */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          {currentUser ? (
            <div className="flex items-center justify-between w-full gap-2">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 min-h-[44px] px-2.5 py-1.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 text-slate-200 transition-colors min-w-0 text-left"
              >
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 truncate">
                  <div className="text-[11px] font-bold text-white truncate max-w-[120px] sm:max-w-[150px]">
                    {currentUser.displayName || currentUser.email?.split('@')[0]}
                  </div>
                  <div className="text-[11px] text-emerald-400 font-medium">Đã đồng bộ</div>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                {isUserAdmin(currentUser) && (
                  <button
                    type="button"
                    onClick={() => setIsAdminPanelOpen(true)}
                    className="min-h-[44px] px-2.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded-xl border border-amber-400/60 flex items-center gap-1.5 text-xs shadow transition-all active:scale-95"
                    title="Mở Bảng Điều Khiển Admin"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-300" />
                    <span>Admin</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => { await fbSignOut(auth); }}
                  className="min-h-[44px] min-w-[44px] p-2 text-slate-300 hover:text-red-400 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-center transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full gap-2">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="flex-1 min-h-[44px] py-2 px-3 bg-slate-950/60 hover:bg-slate-800/80 text-slate-200 hover:text-white font-semibold rounded-xl border border-slate-800 text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-400" />
                <span>Đăng Nhập / Đồng Bộ Cloud</span>
              </button>
              {isUserAdmin(currentUser) && (
                <button
                  type="button"
                  onClick={() => setIsAdminPanelOpen(true)}
                  className="min-h-[44px] px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl border border-amber-400/60 text-xs flex items-center gap-1.5"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-300" />
                  <span>Admin</span>
                </button>
              )}
            </div>
          )}
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
                className="p-2 text-slate-300 hover:text-white rounded-full bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Kích thước thế giới */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Kích thước thế giới:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[64, 96, 128, 192].map(sz => (
                  <button
                    key={sz}
                    onClick={() => setMapSize(sz as MapDimension)}
                    className={`py-3 rounded-xl text-xs font-bold border transition-all min-h-[44px] ${
                      mapSize === sz
                        ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300'
                    }`}
                  >
                    {sz}x{sz} {sz === 96 ? '(Chuẩn)' : sz === 64 ? '(Nhỏ)' : sz === 128 ? '(Lớn)' : '(Trái Đất)'}
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
                      : 'text-slate-300 hover:text-white'
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
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Wand2 className="w-4 h-4 text-amber-300" />
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
                <ul className="text-[11px] sm:text-xs text-purple-200/90 list-disc list-inside space-y-0.5">
                  <li>Khởi đầu với 999,999 Vàng & 50,000 Quân đội.</li>
                  <li>Tự do tăng giảm Vàng & Quân tùy thích.</li>
                  <li>Spam thời tiết & triệu hồi Tà Thần Cổ Đại.</li>
                </ul>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Độ khó thử thách:</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['EASY', 'NORMAL', 'HARD', 'EXTREME'] as GameDifficulty[]).map(diff => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficulty(diff)}
                      className={`py-3 rounded-xl text-xs font-bold border transition-all min-h-[44px] ${
                        difficulty === diff
                          ? 'bg-amber-600 border-amber-400 text-white shadow-md'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300'
                      }`}
                    >
                      {diff === 'EASY' ? 'Dễ' : diff === 'NORMAL' ? 'Vừa' : diff === 'HARD' ? 'Khó' : 'Cực Khó'}
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
