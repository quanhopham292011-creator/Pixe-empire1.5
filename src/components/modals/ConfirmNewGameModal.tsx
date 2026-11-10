import React from 'react';
import { RotateCcw } from 'lucide-react';
import { GameDifficulty, GameMode, MapDimension } from '../../types';

interface ConfirmNewGameModalProps {
  isVisible: boolean;
  onClose: () => void;
  deleteSavedGame: () => void;
  startNewGame: (diff: GameDifficulty, size: MapDimension, name: string, mode: GameMode) => void;
  difficulty: GameDifficulty;
  mapSize: MapDimension;
  playerName: string;
  gameMode: GameMode;
}

export const ConfirmNewGameModal: React.FC<ConfirmNewGameModalProps> = ({
  isVisible,
  onClose,
  deleteSavedGame,
  startNewGame,
  difficulty,
  mapSize,
  playerName,
  gameMode,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-3xl p-6 text-center shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-3">
          <RotateCcw className="w-6 h-6 text-rose-400" />
        </div>
        <h3 className="text-lg font-black text-white mb-2">Bắt Đầu Ván Mới?</h3>
        <p className="text-xs text-slate-300 mb-5 leading-relaxed">
          Ván chơi đã lưu trước đây của bạn sẽ bị xóa vĩnh viễn để bắt đầu trận đấu mới từ đầu.
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              deleteSavedGame();
              onClose();
              startNewGame(difficulty, mapSize, playerName, gameMode);
            }}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg min-h-[46px]"
          >
            <RotateCcw className="w-4 h-4" />
            Xóa Ván Cũ & Bắt Đầu Chơi Mới
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold rounded-2xl text-xs border border-slate-700 min-h-[44px]"
          >
            Hủy Bỏ (Giữ Lại Ván Cũ)
          </button>
        </div>
      </div>
    </div>
  );
};
