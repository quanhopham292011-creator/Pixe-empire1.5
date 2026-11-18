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

  const myNation = nationsList.find(n => n.id === myNationId);

  // Sắp xếp hạng thực tế theo lãnh thổ (để hiển thị huy hiệu # và Thứ hạng của bạn chính xác)
  const territorySorted = [...nationsList].sort((a, b) => {
    const diff = (b.territoryCount || 0) - (a.territoryCount || 0);
    if (diff !== 0) return diff;
    return (b.troops || 0) - (a.troops || 0);
  });

  const territoryRankMap = new Map<number, number>();
  territorySorted.forEach((n, idx) => territoryRankMap.set(n.id, idx));

  const isAlliedWithMe = (n: Nation) =>
    n.id !== myNationId &&
    myNation?.diplomacy?.[n.id]?.status === 'ALLIANCE';

  // Ưu tiên các quốc gia đã liên minh lên đầu danh sách, sau đó xếp theo lãnh thổ & quân
  const sortedNations = [...territorySorted].sort((a, b) => {
    const aAlly = isAlliedWithMe(a);
    const bAlly = isAlliedWithMe(b);
    if (aAlly !== bAlly) return aAlly ? -1 : 1;
    const diff = (b.territoryCount || 0) - (a.territoryCount || 0);
    if (diff !== 0) return diff;
    return (b.troops || 0) - (a.troops || 0);
  });

  const safeTotalLand = Math.max(1, totalLand);
  const myRankIndex = territoryRankMap.get(myNationId) ?? -1;

  return (
    <div className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 sm:p-4 text-left shadow-inner">
      {/* TIÊU ĐỀ BẢNG XẾP HẠNG */}
      <div className="flex items-center justify-between flex-wrap gap-1 pb-2 mb-2 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Trophy className={`w-4 h-4 ${isVictory ? 'text-amber-300' : 'text-blue-300'}`} />
          <span className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
            Bảng Xếp Hạng Lãnh Thổ & Sức Mạnh
          </span>
        </div>
        <span className="text-sm text-slate-200 font-mono">
          Tổng {formatPopulation(safeTotalLand)} ô đất
        </span>
      </div>

      {/* THẺ TÓM TẮT THỨ HẠNG CỦA NGƯỜI CHƠI */}
      {myNation && myRankIndex >= 0 && (
        <div
          className={`mb-2.5 px-3 py-2 rounded-xl border text-sm font-bold flex items-center justify-between flex-wrap gap-1 ${
            myRankIndex === 0
              ? 'bg-amber-950/70 border-amber-400/70 text-amber-200'
              : 'bg-blue-950/70 border-blue-400/70 text-blue-200'
          }`}
        >
          <span className="flex items-center gap-1.5">
            {myRankIndex === 0 ? <Crown className="w-4 h-4 text-amber-300" /> : <Medal className="w-4 h-4 text-blue-300" />}
            Thứ hạng của bạn:
          </span>
          <span className="font-mono font-black text-white">
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
          const trueRankIdx = territoryRankMap.get(nation.id) ?? idx;

          // Huy hiệu thứ hạng thực tế theo lãnh thổ
          let rankBadge = (
            <span className="min-w-[28px] h-7 px-1 rounded-md bg-slate-800 text-slate-200 text-sm font-mono font-bold flex items-center justify-center shrink-0">
              #{trueRankIdx + 1}
            </span>
          );

          if (trueRankIdx === 0) {
            rankBadge = (
              <span className="min-w-[28px] h-7 px-1 rounded-md bg-amber-500/25 text-amber-300 border border-amber-400/60 text-sm font-black flex items-center justify-center shrink-0">
                🥇
              </span>
            );
          } else if (trueRankIdx === 1) {
            rankBadge = (
              <span className="min-w-[28px] h-7 px-1 rounded-md bg-slate-300/25 text-slate-100 border border-slate-300/60 text-sm font-black flex items-center justify-center shrink-0">
                🥈
              </span>
            );
          } else if (trueRankIdx === 2) {
            rankBadge = (
              <span className="min-w-[28px] h-7 px-1 rounded-md bg-amber-700/30 text-amber-300 border border-amber-500/60 text-sm font-black flex items-center justify-center shrink-0">
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
              className={`p-2.5 min-h-[44px] rounded-xl transition-all ${
                onSelectNation ? 'cursor-pointer hover:bg-slate-800 active:scale-[0.99]' : ''
              } ${
                isMe
                  ? 'bg-amber-950/50 border border-amber-400/80 shadow-md ring-1 ring-amber-400/40'
                  : isAlly
                  ? 'bg-emerald-950/60 border border-emerald-400/60'
                  : 'bg-slate-900 border border-slate-700'
              } ${isEliminated && !isMe ? 'opacity-65' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* HẠNG, TÊN QUỐC GIA & CÁC NHÃN TRẠNG THÁI */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                  {rankBadge}
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-xs border border-white/40"
                    style={{ backgroundColor: nation.color || '#94a3b8' }}
                  />
                  <span className={`text-sm font-bold break-words ${isMe ? 'text-amber-200' : isAlly ? 'text-emerald-200' : 'text-white'}`}>
                    {nation.name}
                  </span>
                  {isMe && (
                    <span className="text-sm bg-amber-500/25 text-amber-200 border border-amber-400/50 px-1.5 py-0.5 rounded font-black flex-shrink-0">
                      BẠN
                    </span>
                  )}
                  {isAlly && (
                    <span className="text-sm shrink-0" title="Đồng minh sắt son">
                      🤝
                    </span>
                  )}
                  {isTraitor && (
                    <span
                      className="text-sm bg-red-950 text-red-200 border border-red-500 px-1.5 py-0.5 rounded font-bold shrink-0 animate-pulse"
                      title={`Hình phạt phản bội: -20% phòng thủ (còn ${Math.ceil(nation.traitorTimer || 0)}s)`}
                    >
                      ⚠️ Phản bội (-20% thủ)
                    </span>
                  )}
                  {isEliminated && (
                    <span className="text-sm bg-rose-950 text-rose-200 border border-rose-500/60 px-1.5 py-0.5 rounded font-semibold flex-shrink-0">
                      Thất thủ
                    </span>
                  )}
                </div>

                {/* THỐNG KÊ: LÃNH THỔ, QUÂN & VÀNG */}
                <div className="flex items-center gap-2 flex-shrink-0 text-right text-sm font-mono">
                  {/* Số quân */}
                  <span className="text-blue-200 font-bold" title="Số quân hiện tại">
                    🪖 {formatPopulation(nation.troops || 0)}
                  </span>

                  {/* Vàng: Chỉ hiện vàng của mình và đồng minh, nước khác hiện ? */}
                  <span className="text-amber-200 font-bold min-w-[44px] text-right" title="Kho vàng">
                    🪙 {isMe || isAlly ? formatPopulation(nation.gold || 0) : '?'}
                  </span>

                  {/* SỐ Ô LÃNH THỔ & TỶ LỆ % */}
                  <span className="text-white font-bold min-w-[54px] text-right">
                    {formatPopulation(territory)} <span className="text-sm text-amber-300 font-extrabold">({percent}%)</span>
                  </span>
                </div>
              </div>

              {/* THANH TIẾN ĐỘ THỂ HIỆN % LÃNH THỔ TRÊN BẢN ĐỒ */}
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden mt-2 border border-slate-700">
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
