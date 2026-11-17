import React, { useState } from 'react';
import { Nation, Tile, MarketState, DepositType } from '../types';
import {
  areResourcesEnabled,
  canTradeWithAI,
  getAITradePrices,
  createMarket,
} from '../utils/resources';
import { Handshake, Swords, Shield, X, ArrowLeftRight, Lock, ChevronLeft } from 'lucide-react';
import { getTruceAvailability } from '../utils/truceSystem';

interface DiplomacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  nations: Nation[];
  totalLandCount: number;
  tiles?: Tile[][];
  market?: MarketState;
  onTradeWithAI?: (
    botId: number,
    resource: DepositType,
    mode: 'BUY' | 'SELL',
    qty: number
  ) => { ok: boolean; message: string };
  onProposeTruce: (botId: number) => void;
  onProposeAlliance: (botId: number) => void;
  onDeclareWar: (botId: number) => void;
  onFocusNation?: (nationId: number) => void;
  onSendGoldAid?: (botId: number) => void;
  onSendTroopAid?: (botId: number) => void;
  onRequestAid?: (botId: number) => void;
  gameTimeSeconds?: number;
}

const TRADE_QUANTITIES = [10, 50, 100, 200] as const;

export const DiplomacyModal: React.FC<DiplomacyModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  nations,
  totalLandCount,
  tiles = [],
  market,
  onTradeWithAI,
  onProposeTruce,
  onProposeAlliance,
  onDeclareWar,
  gameTimeSeconds = 0,
}) => {
  const [tradeBotId, setTradeBotId] = useState<number | null>(null);
  const [tradeQty, setTradeQty] = useState<number>(50);
  const [tradeFeedback, setTradeFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isOpen) return null;

  const resEnabled = areResourcesEnabled();
  const activeMarket = market || createMarket();
  const tradeBot = tradeBotId !== null ? nations.find(n => n.id === tradeBotId) : null;

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

  const handleCloseModal = () => {
    setTradeBotId(null);
    setTradeFeedback(null);
    onClose();
  };

  const handleExecuteTrade = (res: DepositType, mode: 'BUY' | 'SELL') => {
    if (!tradeBot || !onTradeWithAI) return;
    const result = onTradeWithAI(tradeBot.id, res, mode, tradeQty);
    setTradeFeedback({ ok: result.ok, text: result.message });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-950/95">
          <div className="flex items-center gap-2 min-w-0">
            {tradeBot ? (
              <button
                onClick={() => {
                  setTradeBotId(null);
                  setTradeFeedback(null);
                }}
                className="min-w-[44px] min-h-[44px] p-2 -ml-1 text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl flex items-center justify-center active:scale-95"
                title="Quay lại"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : null}
            <h3 className="font-bold text-white text-base flex items-center gap-2 min-w-0">
              <span>{tradeBot ? '📦' : '🏛️'}</span>
              <span className="break-words">
                {tradeBot ? `Giao thương: ${tradeBot.name}` : 'Hội Nghị Ngoại Giao'}
              </span>
            </h3>
          </div>
          <button
            onClick={handleCloseModal}
            className="min-w-[44px] min-h-[44px] p-2 text-slate-100 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BẢNG GIAO THƯƠNG VỚI 1 QUỐC GIA AI */}
        {tradeBot && !tradeBot.isEliminated && resEnabled ? (
          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {/* Kho của nước AI & Thời gian chờ */}
            <div className="p-3 rounded-xl bg-slate-950/95 border border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between text-sm font-bold gap-2 flex-wrap">
                <span className="text-slate-100">Kho của {tradeBot.name}:</span>
                {(tradeBot.tradeCooldown || 0) > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400 text-amber-200 font-mono text-sm">
                    ⏳ Chờ {Math.ceil(tradeBot.tradeCooldown!)}s
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm font-mono font-bold">
                <span className="text-sky-200">🛢️ {Math.round(tradeBot.oil || 0)}</span>
                <span className="text-violet-200">⛏️ {Math.round(tradeBot.minerals || 0)}</span>
                <span className="text-amber-200">💰 {Math.round(tradeBot.gold || 0)}</span>
              </div>
              <div className="text-sm font-mono text-slate-200 pt-1.5 border-t border-slate-700">
                Bạn có: 💰 {Math.floor(playerNation.gold || 0)} • 🛢️ {Math.round(playerNation.oil || 0)} • ⛏️ {Math.round(playerNation.minerals || 0)}
              </div>
            </div>

            {/* 4 nút chọn số lượng to cho điện thoại */}
            <div className="grid grid-cols-4 gap-2">
              {TRADE_QUANTITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setTradeQty(q)}
                  className={`min-h-[44px] rounded-xl font-mono font-black text-sm border transition-all active:scale-95 ${
                    tradeQty === q
                      ? 'bg-sky-400 border-sky-200 text-slate-950 shadow'
                      : 'bg-slate-800 border-slate-600 text-white'
                  }`}
                >
                  x{q}
                </button>
              ))}
            </div>

            {tradeFeedback && (
              <div
                className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                  tradeFeedback.ok
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-400 text-rose-200'
                }`}
              >
                {tradeFeedback.text}
              </div>
            )}

            {/* 2 loại tài nguyên: Dầu & Khoáng */}
            {(['OIL', 'MINERAL'] as DepositType[]).map((res) => {
              const isOil = res === 'OIL';
              const prices = getAITradePrices(playerNation, tradeBot, activeMarket, res);
              const buyCheck = canTradeWithAI(playerNation, tradeBot, activeMarket, tiles, res, 'BUY', tradeQty);
              const sellCheck = canTradeWithAI(playerNation, tradeBot, activeMarket, tiles, res, 'SELL', tradeQty);

              return (
                <div
                  key={res}
                  className={`p-3 rounded-xl border space-y-2.5 ${
                    isOil ? 'bg-sky-950/40 border-sky-400/60' : 'bg-violet-950/40 border-violet-400/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between text-sm gap-2">
                    <span className="font-black text-white text-base">
                      {isOil ? '🛢️ Dầu' : '⛏️ Khoáng'}
                    </span>
                    <span className="font-mono text-sm text-slate-100">
                      Bán: <strong className="text-amber-200">{prices.aiSellPrice.toFixed(1)}</strong> • Mua: <strong className="text-emerald-200">{prices.aiBuyPrice.toFixed(1)}</strong> 💰
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={!buyCheck.ok}
                      onClick={() => handleExecuteTrade(res, 'BUY')}
                      className={`min-h-[54px] px-2.5 py-2 rounded-xl font-bold text-sm border transition-all flex flex-col items-center justify-center ${
                        buyCheck.ok
                          ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white active:scale-95 shadow'
                          : 'bg-slate-800 border-slate-600 text-slate-300 opacity-65 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-black">Mua của họ</span>
                      <span className="text-sm font-mono mt-0.5">
                        {buyCheck.ok ? `-${buyCheck.goldAmount} 💰` : buyCheck.reason}
                      </span>
                    </button>

                    <button
                      disabled={!sellCheck.ok}
                      onClick={() => handleExecuteTrade(res, 'SELL')}
                      className={`min-h-[54px] px-2.5 py-2 rounded-xl font-bold text-sm border transition-all flex flex-col items-center justify-center ${
                        sellCheck.ok
                          ? 'bg-amber-400 hover:bg-amber-300 border-amber-200 text-slate-950 active:scale-95 shadow'
                          : 'bg-slate-800 border-slate-600 text-slate-300 opacity-65 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-black">Bán cho họ</span>
                      <span className="text-sm font-mono mt-0.5">
                        {sellCheck.ok ? `+${sellCheck.goldAmount} 💰` : sellCheck.reason}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
            {sortedNations.map((nation) => {
              const isSelf = nation.id === playerNation.id;
              const dip = playerNation.diplomacy[nation.id] || { status: 'WAR', relation: 0, truceTimer: 0 };
              const _percent = totalLandCount > 0 ? Math.round((nation.territoryCount / totalLandCount) * 100) : 0;
              void _percent;
              const pers = getPersonalityLabel(nation.personality);
              const isWar = dip.status === 'WAR';

              return (
                <div
                  key={nation.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isSelf ? 'bg-blue-950/60 border-blue-400' : 'bg-slate-800/90 border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <span className="font-bold text-white text-base">{nation.name}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(nation.traitorTimer || 0) > 0 && (
                        <span
                          className="text-xs px-2 py-0.5 rounded border bg-red-950 text-red-200 border-red-500 font-bold"
                          title="Hình phạt phản bội: -20% phòng thủ"
                        >
                          ⚠️ Phản bội (-20% thủ · {Math.ceil(nation.traitorTimer)}s)
                        </span>
                      )}
                      {!isSelf && (
                        <span className={`text-sm px-2 py-0.5 rounded border ${pers.color}`}>
                          {pers.text}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isSelf && !nation.isEliminated && (
                    <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                      {resEnabled && nation.colonyCategory !== 'FOREST' && (
                        <button
                          disabled={isWar}
                          onClick={() => {
                            setTradeBotId(nation.id);
                            setTradeFeedback(null);
                          }}
                          title={isWar ? 'Đang chiến tranh' : 'Giao thương Dầu & Khoáng sản'}
                          className={`min-h-[44px] px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 border transition-all ${
                            isWar
                              ? 'bg-slate-900 border-slate-600 text-slate-300 opacity-65 cursor-not-allowed'
                              : 'bg-sky-700 hover:bg-sky-600 active:scale-95 border-sky-400 text-white shadow'
                          }`}
                        >
                          {isWar ? <Lock className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
                          <span>Giao thương</span>
                        </button>
                      )}

                      {dip.status === 'WAR' ? (
                        <>
                          {(() => {
                            const truceCheck = getTruceAvailability(playerNation, nation, gameTimeSeconds);
                            const remUses = Math.max(0, truceCheck.maxAllowed - truceCheck.usedCount);
                            const truceLabel = truceCheck.ok
                              ? `Đình Chiến (${remUses}/${truceCheck.maxAllowed})`
                              : truceCheck.reason === 'LIMIT'
                                ? `Hết Đình Chiến (${truceCheck.usedCount}/${truceCheck.maxAllowed})`
                                : `Hồi ${truceCheck.cooldownRemaining}s`;
                            return (
                              <button
                                onClick={() => onProposeTruce(nation.id)}
                                title={
                                  truceCheck.ok
                                    ? `Ký Đình Chiến 45s (còn ${remUses}/${truceCheck.maxAllowed} lần với nước này)`
                                    : truceCheck.reason === 'LIMIT'
                                      ? `Đã đạt giới hạn Đình Chiến (${truceCheck.usedCount}/${truceCheck.maxAllowed})`
                                      : `Đang hồi chiêu Đình Chiến (${truceCheck.cooldownRemaining}s)`
                                }
                                className={`min-h-[44px] px-3 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-sm border transition-all ${
                                  truceCheck.ok
                                    ? 'bg-blue-950 hover:bg-blue-900 active:scale-95 text-blue-100 border-blue-400'
                                    : 'bg-slate-900 text-slate-300 border-slate-600 opacity-75'
                                }`}
                              >
                                <Shield className={`w-4 h-4 ${truceCheck.ok ? 'text-blue-300' : 'text-slate-400'}`} /> {truceLabel}
                              </button>
                            );
                          })()}
                          <button
                            onClick={() => onProposeAlliance(nation.id)}
                            className="min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-md"
                            title="Gửi lời mời liên minh"
                          >
                            <Handshake className="w-4 h-4" /> Kết Minh
                          </button>
                        </>
                      ) : dip.status === 'ALLIANCE' ? (
                        <button
                          onClick={() => onDeclareWar(nation.id)}
                          className="min-h-[44px] px-3 py-2 bg-red-800 hover:bg-red-700 active:scale-95 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5"
                          title="Huỷ liên minh và tuyên chiến"
                        >
                          <Swords className="w-4 h-4" /> Phản Bội
                        </button>
                      ) : (
                        <button
                          onClick={() => onDeclareWar(nation.id)}
                          className="min-h-[44px] px-3 py-2 bg-red-800 hover:bg-red-700 active:scale-95 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5"
                        >
                          <Swords className="w-4 h-4" /> Tuyên Chiến
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
