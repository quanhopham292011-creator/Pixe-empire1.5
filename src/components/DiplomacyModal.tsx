import React from 'react';
import { Nation } from '../types';
import { formatPopulation } from '../utils/constants';
import { Handshake, Swords, Shield, X, Users, Castle, Navigation } from 'lucide-react';

interface DiplomacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  nations: Nation[];
  totalLandCount: number;
  onProposeTruce: (botId: number) => void;
  onProposeAlliance: (botId: number) => void;
  onDeclareWar: (botId: number) => void;
  onFocusNation?: (nationId: number) => void;
  onSendGoldAid?: (botId: number) => void;
  onSendTroopAid?: (botId: number) => void;
  onRequestAid?: (botId: number) => void;
}

export const DiplomacyModal: React.FC<DiplomacyModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  nations,
  totalLandCount,
  onProposeTruce,
  onProposeAlliance,
  onDeclareWar,
  onFocusNation,
  onSendGoldAid,
  onSendTroopAid,
  onRequestAid,
}) => {
  if (!isOpen) return null;

  const sortedNations = [...nations.filter(n => n.id > 0)].sort(
    (a, b) => b.territoryCount - a.territoryCount
  );

  const getPersonalityLabel = (personality: string) => {
    switch (personality) {
      case 'AGGRESSIVE': return { text: 'Hiếu Chiến', color: 'text-red-400 border-red-500/30' };
      case 'DEFENSIVE': return { text: 'Phòng Thủ', color: 'text-blue-400 border-blue-500/30' };
      case 'MERCHANT': return { text: 'Thương Nhân', color: 'text-amber-400 border-amber-500/30' };
      case 'OPPORTUNIST': return { text: 'Cơ Hội', color: 'text-purple-400 border-purple-500/30' };
      default: return { text: 'Cân Bằng', color: 'text-slate-400 border-slate-500/30' };
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <span>🏛️</span> Hội Nghị Ngoại Giao
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
          {sortedNations.map((nation, index) => {
            const isSelf = nation.id === playerNation.id;
            const dip = playerNation.diplomacy[nation.id] || { status: 'WAR', relation: 0, truceTimer: 0 };
            const percent = totalLandCount > 0 ? Math.round((nation.territoryCount / totalLandCount) * 100) : 0;
            const pers = getPersonalityLabel(nation.personality);

            return (
              <div
                key={nation.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSelf ? 'bg-blue-950/40 border-blue-500/50' : 'bg-slate-800/60 border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white">{nation.name}</span>
                  <div className="flex items-center gap-1.5">
                    {!isSelf && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${pers.color}`}>
                        {pers.text}
                      </span>
                    )}
                  </div>
                </div>

                {!isSelf && !nation.isEliminated && (
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    {dip.status === 'WAR' ? (
                      <>
                        <button
                          onClick={() => onProposeTruce(nation.id)}
                          className="px-2.5 py-1.5 bg-blue-950/80 hover:bg-blue-900 active:scale-95 text-blue-200 border border-blue-500/50 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
                        >
                          <Shield className="w-3.5 h-3.5 text-blue-400" /> Đình Chiến
                        </button>
                        <button
                          onClick={() => onProposeAlliance(nation.id)}
                          className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-md"
                          title="Gửi lời mời liên minh"
                        >
                          <Handshake className="w-3.5 h-3.5" /> Kết Minh
                        </button>
                      </>
                    ) : dip.status === 'ALLIANCE' ? (
                      <button
                        onClick={() => onDeclareWar(nation.id)}
                        className="px-2.5 py-1.5 bg-red-800/80 hover:bg-red-700 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                        title="Huỷ liên minh và tuyên chiến"
                      >
                        <Swords className="w-3.5 h-3.5" /> Phản Bội
                      </button>
                    ) : (
                      <button
                        onClick={() => onDeclareWar(nation.id)}
                        className="px-2.5 py-1.5 bg-red-800/80 hover:bg-red-700 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <Swords className="w-3.5 h-3.5" /> Tuyên Chiến
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
