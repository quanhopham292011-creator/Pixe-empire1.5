import React from 'react';
import { Nation } from '../types';
import { MatchLeaderboard } from './MatchLeaderboard';
import { Trophy, X } from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  nations: Record<number, Nation> | undefined;
  myNationId: number;
  totalLand: number;
  onFocusNation: (nationId: number) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  nations,
  myNationId,
  totalLand,
  onFocusNation,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-3 sm:p-4 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-black text-white tracking-wide">BẢNG XẾP HẠNG QUỐC GIA</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hướng dẫn ngắn */}
        <div className="text-[11px] text-slate-400 mb-2 font-medium">
          💡 Chạm vào bất kỳ quốc gia nào để chuyển camera đến lãnh thổ của họ.
        </div>

        {/* Nội dung bảng xếp hạng */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <MatchLeaderboard
            nations={nations}
            myNationId={myNationId}
            totalLand={totalLand}
            onSelectNation={onFocusNation}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};
