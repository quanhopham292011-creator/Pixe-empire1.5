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
              <span>🏛️</span> Hội Nghị Ngoại Giao & Quan Hệ Quốc Tế
            </h3>
            <p className="text-xs text-slate-400">Điều phối liên minh, đình chiến chiến thuật và giao thương biển</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BẢNG GIẢI THÍCH CHIẾN LƯỢC NGOẠI GIAO */}
        <div className="mx-4 mt-3 p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1 text-[11px]">
          <div className="flex items-start gap-1.5 text-emerald-300">
            <span className="text-xs shrink-0">🤝</span>
            <span><strong>Liên Minh Sắt Son:</strong> Tuyệt đối không bị đồng minh tấn công sau lưng, kích hoạt Giao Thương Hải Cảng sinh lợi nhuận vàng khổng lồ.</span>
          </div>
          <div className="flex items-start gap-1.5 text-blue-300">
            <span className="text-xs shrink-0">🕊️</span>
            <span><strong>Hiệp Ước Đình Chiến (45s):</strong> Đóng băng giao tranh tạm thời trong 45 giây để bạn dồn toàn lực mở rộng lãnh thổ hướng khác.</span>
          </div>
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
                  isSelf
                    ? 'bg-blue-950/40 border-blue-500/50 shadow-sm'
                    : nation.isEliminated
                    ? 'bg-slate-950/40 border-slate-800/40 opacity-50'
                    : 'bg-slate-800/60 border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => {
                      if (onFocusNation) {
                        onFocusNation(nation.id);
                        onClose();
                      }
                    }}
                    className={`flex items-center gap-2 text-left group hover:opacity-90 transition-opacity ${
                      isSelf ? 'px-1.5 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20' : ''
                    }`}
                    title={isSelf ? "Bấm để di chuyển camera về vương quốc của bạn" : "Bấm để di chuyển camera tới quốc gia này"}
                  >
                    <span className="font-mono text-xs font-bold text-slate-400 w-5">#{index + 1}</span>
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: nation.color }} />
                    <span className="font-bold text-sm text-white flex items-center gap-1 group-hover:text-amber-400 transition-colors">
                      {isSelf && <Castle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      {nation.name}
                      {isSelf && <span className="text-[10px] text-amber-300 font-semibold ml-1">(Bạn • Xem)</span>}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {onFocusNation && !isSelf && !nation.isEliminated && (
                      <button
                        onClick={() => {
                          onFocusNation(nation.id);
                          onClose();
                        }}
                        title="Di chuyển camera tới quốc gia này"
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-700/80 flex items-center gap-1 active:scale-95"
                      >
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        <span>Xem</span>
                      </button>
                    )}

                    {!isSelf && !nation.isEliminated && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${pers.color}`}>
                        {pers.text}
                      </span>
                    )}
                    {nation.isEliminated && (
                      <span className="text-[10px] text-red-400 italic">Đã bị diệt vong</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs text-slate-300 pb-2 border-b border-slate-800/60">
                  <span>🌍 {percent}% Đất ({nation.territoryCount} ô)</span>
                  <span>👥 {formatPopulation(nation.population || 0)} Dân</span>
                  <span>⚔️ {formatPopulation(nation.troops)} Quân</span>
                  <span>💰 {formatPopulation(nation.gold)} Vàng</span>
                </div>

                {isSelf && onFocusNation && (
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Vương quốc của bạn</span>
                    <button
                      onClick={() => {
                        onFocusNation(nation.id);
                        onClose();
                      }}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-lg text-xs border border-amber-500/40 flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                    >
                      <Castle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Về Vương Quốc Của Tôi</span>
                    </button>
                  </div>
                )}

                {!isSelf && !nation.isEliminated && (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs">
                        {dip.status === 'ALLIANCE' ? (
                          <div className="flex flex-col">
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Handshake className="w-3.5 h-3.5 text-emerald-400" /> Liên Minh Sắt Son
                            </span>
                            <span className="text-[10px] text-emerald-300/80">
                              🛡️ Tuyệt đối an toàn sau lưng • ⛵ Giao thương biển
                            </span>
                          </div>
                        ) : dip.status === 'TRUCE' ? (
                          <div className="flex flex-col">
                            <span className="text-blue-400 font-bold flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5 text-blue-400" /> Đình Chiến ({Math.ceil(dip.truceTimer)}s)
                            </span>
                            <span className="text-[10px] text-blue-300/80">
                              🕊️ Đóng băng giao tranh để mở rộng hướng khác
                            </span>
                          </div>
                        ) : (
                          <span className="text-red-400 font-semibold flex items-center gap-1">
                            <Swords className="w-3.5 h-3.5" /> Đang Chiến Tranh
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {dip.status === 'WAR' ? (
                          <>
                            <button
                              onClick={() => onProposeTruce(nation.id)}
                              className="px-2.5 py-1.5 bg-blue-950/80 hover:bg-blue-900 active:scale-95 text-blue-200 border border-blue-500/50 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
                              title="Đóng băng giao tranh trong 45 giây"
                            >
                              <Shield className="w-3.5 h-3.5 text-blue-400" /> Đình Chiến (45s)
                            </button>
                            <button
                              onClick={() => onProposeAlliance(nation.id)}
                              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-900/40"
                              title="Liên minh sắt son, an toàn không bị tấn công sau lưng và kích hoạt giao thương biển"
                            >
                              <Handshake className="w-3.5 h-3.5" /> Liên Minh Sắt Son
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onDeclareWar(nation.id)}
                            className="px-2.5 py-1.5 bg-red-800/80 hover:bg-red-700 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <Swords className="w-3.5 h-3.5" /> Tuyên Chiến
                          </button>
                        )}
                      </div>
                    </div>

                    {/* HÀNG CÔNG CỤ VIỆN TRỢ TÀI CHÍNH / TẶNG QUÂN DÀNH CHO ĐỒNG MINH */}
                    {dip.status === 'ALLIANCE' && (
                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-800/60">
                        {onSendGoldAid && (
                          <button
                            onClick={() => onSendGoldAid(nation.id)}
                            className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[11px] font-bold flex items-center gap-1 active:scale-95"
                            title="Tặng 100 Vàng cho nước đồng minh"
                          >
                            💸 Tặng 100 Vàng
                          </button>
                        )}
                        {onSendTroopAid && (
                          <button
                            onClick={() => onSendTroopAid(nation.id)}
                            className="px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded text-[11px] font-bold flex items-center gap-1 active:scale-95"
                            title="Chuyển 50 Quân viện trợ đồng minh"
                          >
                            🪖 Tặng 50 Quân
                          </button>
                        )}
                        {onRequestAid && (
                          <button
                            onClick={() => onRequestAid(nation.id)}
                            className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-bold flex items-center gap-1 active:scale-95"
                            title="Xin viện trợ tài chính / quân đội từ đồng minh"
                          >
                            🤝 Xin Viện Trợ
                          </button>
                        )}
                      </div>
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
