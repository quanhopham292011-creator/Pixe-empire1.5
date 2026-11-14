import React from 'react';
import { GameEvent, TradeOffer } from '../types';
import { Bell, ChevronRight, X, Check } from 'lucide-react';

interface EventTickerProps {
  events: GameEvent[];
  onOpenLog: () => void;
  pendingTradeOffer?: TradeOffer | null;
  offerGoldAmount?: number;
  onRespondTradeOffer?: (accept: boolean) => void;
}

export const EventTicker: React.FC<EventTickerProps> = ({
  events,
  onOpenLog,
  pendingTradeOffer,
  offerGoldAmount,
  onRespondTradeOffer,
}) => {
  const latestEvent = events[0];
  if (!latestEvent && !pendingTradeOffer) return null;

  return (
    <div className="space-y-1.5">
      {latestEvent && (
        <div
          onClick={onOpenLog}
          className="max-w-xs sm:max-w-sm px-3 py-1.5 bg-slate-900/90 border border-slate-700/80 rounded-full shadow-lg backdrop-blur-md flex items-center gap-2 cursor-pointer hover:bg-slate-800 transition-all active:scale-95"
        >
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
          <span className="text-[11px] font-medium text-slate-200 truncate flex-1">
            {latestEvent.title}: {latestEvent.description}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </div>
      )}

      {pendingTradeOffer && onRespondTradeOffer && (
        <div className="p-2.5 bg-slate-900/95 border border-sky-500/60 rounded-2xl shadow-xl backdrop-blur-md space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-black text-sky-300 truncate">
              📦 {pendingTradeOffer.nationName}
            </span>
            <span className="font-mono font-bold text-amber-300 shrink-0">
              {Math.ceil(pendingTradeOffer.remainingTimer)}s
            </span>
          </div>
          <p className="text-[11px] text-slate-200 leading-snug">
            {pendingTradeOffer.mode === 'AI_SELL' ? 'Chào bán' : 'Muốn mua'}{' '}
            <strong className="text-white">
              {pendingTradeOffer.qty} {pendingTradeOffer.resource === 'OIL' ? '🛢️ Dầu' : '⛏️ Khoáng'}
            </strong>
            {typeof offerGoldAmount === 'number' && (
              <span className="text-amber-300 font-mono">
                {' '}({pendingTradeOffer.mode === 'AI_SELL' ? `-${offerGoldAmount}` : `+${offerGoldAmount}`} 💰)
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onRespondTradeOffer(true)}
              className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 min-h-[34px]"
            >
              <Check className="w-3.5 h-3.5" /> Chấp nhận
            </button>
            <button
              onClick={() => onRespondTradeOffer(false)}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 min-h-[34px]"
            >
              <X className="w-3.5 h-3.5" /> Từ chối
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface EventLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: GameEvent[];
  pendingTradeOffer?: TradeOffer | null;
  offerGoldAmount?: number;
  onRespondTradeOffer?: (accept: boolean) => void;
}

export const EventLogModal: React.FC<EventLogModalProps> = ({
  isOpen,
  onClose,
  events,
  pendingTradeOffer,
  offerGoldAmount,
  onRespondTradeOffer,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-white text-base">Nhật Ký Sự Kiện Lịch Sử</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 max-h-[65vh] overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">Chưa có sự kiện nào được ghi nhận.</p>
          ) : (
            events.map((evt) => {
              const isOfferActive = !!(pendingTradeOffer && evt.tradeOfferId === pendingTradeOffer.id);
              return (
                <div key={evt.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                      <span className="font-semibold text-amber-400">{evt.title}</span>
                      <span className="font-mono">
                        {isOfferActive ? `⏳ ${Math.ceil(pendingTradeOffer!.remainingTimer)}s • ` : ''}
                        {evt.timestamp}
                      </span>
                    </div>
                    <p className="text-slate-300">{evt.description}</p>
                  </div>

                  {isOfferActive && onRespondTradeOffer && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => onRespondTradeOffer(true)}
                        className="min-h-[38px] py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Chấp nhận
                        {typeof offerGoldAmount === 'number' ? ` (${pendingTradeOffer!.mode === 'AI_SELL' ? `-${offerGoldAmount}` : `+${offerGoldAmount}`}💰)` : ''}
                      </button>
                      <button
                        onClick={() => onRespondTradeOffer(false)}
                        className="min-h-[38px] py-1.5 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 border border-slate-700 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Từ chối
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
