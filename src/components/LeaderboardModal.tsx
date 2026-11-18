import React, { useState } from 'react';
import { DepositType, MarketState, Nation, Tile } from '../types';
import { MatchLeaderboard } from './MatchLeaderboard';
import { DiplomacyPanel } from './DiplomacyModal';
import { Trophy, Handshake, X } from 'lucide-react';
import { countActiveAlliances } from '../hooks/useTradeRoutes';
import { GAMEPLAY_RULES } from '../data/gameData';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  nations: Record<number, Nation> | Nation[] | undefined;
  myNationId: number;
  totalLand: number;
  onFocusNation: (nationId: number) => void;
  playerNation?: Nation;
  tiles?: Tile[][];
  market?: MarketState;
  onTradeWithAI?: (
    botId: number,
    resource: DepositType,
    mode: 'BUY' | 'SELL',
    qty: number
  ) => { ok: boolean; message: string };
  onProposeTruce?: (botId: number) => void;
  onProposeAlliance?: (botId: number) => void;
  onDeclareWar?: (botId: number) => void;
  gameTimeSeconds?: number;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  nations,
  myNationId,
  totalLand,
  onFocusNation,
  playerNation,
  tiles,
  market,
  onTradeWithAI,
  onProposeTruce,
  onProposeAlliance,
  onDeclareWar,
  gameTimeSeconds = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'RANKING' | 'ALLIANCE'>('RANKING');

  if (!isOpen) return null;

  const nationsArray: Nation[] = Array.isArray(nations)
    ? nations
    : Object.values(nations || {});
  const hasAllianceSection = Boolean(
    playerNation &&
      nationsArray.some((n) => n && n.id > 0) &&
      onProposeTruce &&
      onProposeAlliance &&
      onDeclareWar
  );
  const allyCount =
    playerNation && hasAllianceSection
      ? countActiveAlliances(playerNation, nationsArray)
      : 0;
  const resolvedTab = hasAllianceSection ? activeTab : 'RANKING';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-950 border-2 border-slate-600 rounded-3xl max-w-lg w-full p-3 sm:p-4 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
          <div className="flex items-center gap-2">
            {resolvedTab === 'ALLIANCE' ? (
              <Handshake className="w-5 h-5 text-emerald-300" />
            ) : (
              <Trophy className="w-5 h-5 text-amber-300" />
            )}
            <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
              {resolvedTab === 'ALLIANCE' ? 'LIÊN MINH & NGOẠI GIAO' : 'BẢNG XẾP HẠNG QUỐC GIA'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Xếp Hạng & Liên Minh */}
        {hasAllianceSection && (
          <div className="grid grid-cols-2 gap-1.5 mb-2.5 bg-slate-900 p-1 rounded-2xl border border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('RANKING')}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all ${
                resolvedTab === 'RANKING'
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-400/70'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Xếp Hạng</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ALLIANCE')}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all ${
                resolvedTab === 'ALLIANCE'
                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/70'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Handshake className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>Liên Minh ({allyCount}/{GAMEPLAY_RULES.MAX_ALLIANCES})</span>
            </button>
          </div>
        )}

        {resolvedTab === 'RANKING' ? (
          <>
            <div className="text-sm text-slate-200 mb-2 font-medium">
              💡 Đồng minh được ưu tiên lên đầu. Chạm quốc gia để xem lãnh thổ.
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <MatchLeaderboard
                nations={nations as Record<number, Nation> | undefined}
                myNationId={myNationId}
                totalLand={totalLand}
                onSelectNation={onFocusNation}
                onClose={onClose}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto no-scrollbar pr-0.5">
            {playerNation && onProposeTruce && onProposeAlliance && onDeclareWar && (
              <DiplomacyPanel
                embedded
                playerNation={playerNation}
                nations={nationsArray}
                totalLandCount={totalLand}
                tiles={tiles}
                market={market}
                onTradeWithAI={onTradeWithAI}
                onProposeTruce={onProposeTruce}
                onProposeAlliance={onProposeAlliance}
                onDeclareWar={onDeclareWar}
                gameTimeSeconds={gameTimeSeconds}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
