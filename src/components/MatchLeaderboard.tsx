import React from 'react';
import { Nation } from '../types';
import { Trophy, Crown, Medal } from 'lucide-react';
import { formatPopulation } from '../utils/constants';

export interface MatchLeaderboardProps {
  nations: Record<number, Nation> | undefined;
  myNationId: number;
  totalLand: number;
  isVictory?: boolean;
  onSelectNation?: (nationId: number) => void;
  onClose?: () => void;
}

export const MatchLeaderboard: React.FC<MatchLeaderboardProps> = ({
  nations,
  myNationId,
  totalLand,
  isVictory = false,
  onSelectNation,
  onClose,
}) => {
  const nationsList = Object.values(nations || {}).filter(
    (n): n is Nation => !!n && typeof n.id === 'number' && n.id > 0
  );

  // Sắp xếp các quốc gia theo số ô lãnh thổ giảm dần, phụ theo quân
  const sortedNations = [...nationsList].sort((a, b) => {
    const diff = (b.territoryCount || 0) - (a.territoryCount || 0);
    if (diff !== 0) return diff;
    return (b.troops || 0) - (a.troops || 0);
  });

  const safeTotalLand = Math.max(1, totalLand);
  const myRankIndex = sortedNations.findIndex(n => n.id === myNationId);
  const myNation = sortedNations[myRankIndex];

  return (
    <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3 sm:p-4 text-left shadow-inner">
      {/* TIÊU ĐỀ BẢNG XẾP HẠNG */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Trophy className={`w-4 h-4 ${isVictory ? 'text-amber-400' : 'text-blue-400'}`} />
          <span className="text-xs sm:text-sm font-black text-slate-100 tracking-wide uppercase">
            Bảng Xếp Hạng Lãnh Thổ & Sức Mạnh
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          Tổng {formatPopulation(safeTotalLand)} ô đất
        </span>
      </div>

      {/* THẺ TÓM TẮT THỨ HẠNG CỦA NGƯỜI CHƠI */}
      {myNation && (
        <div
          className={`mb-2.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between ${
            myRankIndex === 0
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {myRankIndex === 0 ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <Medal className="w-3.5 h-3.5 text-blue-400" />}
            Thứ hạng của bạn:
          </span>
          <span className="font-mono font-black">
            #{myRankIndex + 1} / {sortedNations.length} ({myNation.territoryCount || 0} ô - {Math.round(((myNation.territoryCount || 0) / safeTotalLand) * 100)}%)
          </span>
        </div>
      )}

      {/* DANH SÁCH CHI TIẾT CÁC QUỐC GIA (CUỘN ĐƯỢC TRÊN ĐIỆN THOẠI) */}
      <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 touch-pan-y no-scrollbar">
        {sortedNations.map((nation, idx) => {
          const isMe = nation.id === myNationId;
          const territory = nation.territoryCount || 0;
          const percent = Math.min(100, Math.round((territory / safeTotalLand) * 100));
          const isEliminated = nation.isEliminated || territory === 0;

          // Kiểm tra quan hệ đồng minh và kẻ phản bội
          const myDipStatus = myNation?.diplomacy?.[nation.id]?.status || 'WAR';
          const isAlly = !isMe && myDipStatus === 'ALLIANCE';
          const isTraitor = (nation.traitorTimer || 0) > 0;

          // Huy hiệu thứ hạng
          let rankBadge = (
            <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
              #{idx + 1}
            </span>
          );

          if (idx === 0) {
            rankBadge = (
              <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black flex items-center justify-center shrink-0">
                🥇
              </span>
            );
          } else if (idx === 1) {
            rankBadge = (
              <span className="w-5 h-5 rounded-md bg-slate-300/20 text-slate-200 border border-slate-300/40 text-[10px] font-black flex items-center justify-center shrink-0">
                🥈
              </span>
            );
          } else if (idx === 2) {
            rankBadge = (
              <span className="w-5 h-5 rounded-md bg-amber-700/20 text-amber-500 border border-amber-700/40 text-[10px] font-black flex items-center justify-center shrink-0">
                🥉
              </span>
            );
          }

          return (
            <div
              key={nation.id}
              onClick={() => {
                if (onSelectNation) {
                  onSelectNation(nation.id);
                  onClose?.();
                }
              }}
              className={`p-2 rounded-xl transition-all ${
                onSelectNation ? 'cursor-pointer hover:bg-slate-800/90 active:scale-[0.99]' : ''
              } ${
                isMe
                  ? 'bg-amber-500/10 border border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                  : isAlly
                  ? 'bg-emerald-950/40 border border-emerald-500/40'
                  : 'bg-slate-900/60 border border-slate-800/80'
              } ${isEliminated && !isMe ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                {/* HẠNG, TÊN QUỐC GIA & CÁC NHÃN TRẠNG THÁI */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                  {rankBadge}
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs"
                    style={{ backgroundColor: nation.color || '#94a3b8' }}
                  />
                  <span className={`text-xs truncate font-bold ${isMe ? 'text-amber-300' : isAlly ? 'text-emerald-300' : 'text-slate-200'}`}>
                    {nation.name}
                  </span>
                  {isMe && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 py-0.2 rounded font-black flex-shrink-0">
                      BẠN
                    </span>
                  )}
                  {isAlly && (
                    <span className="text-xs shrink-0" title="Đồng minh sắt son">
                      🤝
                    </span>
                  )}
                  {isTraitor && (
                    <span className="text-[9px] bg-red-950/90 text-red-300 border border-red-600/60 px-1 py-0.2 rounded font-bold shrink-0 animate-pulse">
                      ⚠️ Kẻ phản bội
                    </span>
                  )}
                  {isEliminated && (
                    <span className="text-[9px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1 py-0.2 rounded font-semibold flex-shrink-0">
                      Thất thủ
                    </span>
                  )}
                </div>

                {/* THỐNG KÊ: LÃNH THỔ, QUÂN & VÀNG */}
                <div className="flex items-center gap-2 flex-shrink-0 text-right text-[11px] font-mono">
                  {/* Số quân */}
                  <span className="text-blue-300 font-bold" title="Số quân hiện tại">
                    🪖 {formatPopulation(nation.troops || 0)}
                  </span>

                  {/* Vàng: Chỉ hiện vàng của mình và đồng minh, nước khác hiện ? */}
                  <span className="text-amber-300 font-bold min-w-[42px] text-right" title="Kho vàng">
                    🪙 {isMe || isAlly ? formatPopulation(nation.gold || 0) : '?'}
                  </span>

                  {/* SỐ Ô LÃNH THỔ & TỶ LỆ % */}
                  <span className="text-slate-100 font-bold min-w-[50px] text-right">
                    {formatPopulation(territory)} <span className="text-[9px] text-amber-400 font-extrabold">({percent}%)</span>
                  </span>
                </div>
              </div>

              {/* THANH TIẾN ĐỘ THỂ HIỆN % LÃNH THỔ TRÊN BẢN ĐỒ */}
              <div className="w-full bg-slate-950/80 rounded-full h-1.5 overflow-hidden mt-1.5 border border-slate-800/80">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(2, percent)}%`,
                    backgroundColor: nation.color || '#3b82f6',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
