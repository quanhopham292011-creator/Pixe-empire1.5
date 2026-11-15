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
        <button
          type="button"
          onClick={onOpenLog}
          className="w-full min-h-[44px] px-3 py-2 bg-slate-950/95 border border-slate-600 rounded-2xl shadow-lg backdrop-blur-md flex items-center gap-2 cursor-pointer hover:bg-slate-800 transition-all active:scale-95 text-left"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
          <span className="text-sm font-semibold text-white whitespace-normal break-words flex-1">
            {latestEvent.title}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-200 shrink-0" />
        </button>
      )}

      {pendingTradeOffer && onRespondTradeOffer && (
        <div className="p-3 bg-slate-950/95 border border-sky-400 rounded-2xl shadow-xl backdrop-blur-md space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-black text-sky-200 whitespace-normal break-words">
              📦 {pendingTradeOffer.nationName}
            </span>
            <span className="font-mono font-bold text-amber-300 shrink-0">
              {Math.ceil(pendingTradeOffer.remainingTimer)}s
            </span>
          </div>
          <p className="text-sm text-slate-100 leading-snug">
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
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onRespondTradeOffer(true)}
              className="min-h-[44px] py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Chấp nhận
            </button>
            <button
              onClick={() => onRespondTradeOffer(false)}
              className="min-h-[44px] py-2 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white border border-slate-600 font-bold rounded-xl text-sm flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" /> Từ chối
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-950/90">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-300" />
            <h3 className="font-bold text-white text-base">Nhật Ký Sự Kiện Lịch Sử</h3>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2 text-slate-100 hover:text-white hover:bg-slate-800 rounded-xl flex items-center justify-center"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 max-h-[65vh] overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-sm text-slate-200 text-center py-4">Chưa có sự kiện nào được ghi nhận.</p>
          ) : (
            events.map((evt) => {
              const isOfferActive = !!(pendingTradeOffer && evt.tradeOfferId === pendingTradeOffer.id);
              return (
                <div key={evt.id} className="p-3 rounded-xl bg-slate-950/90 border border-slate-700 text-sm space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-slate-200 text-sm mb-1 flex-wrap">
                      <span className="font-bold text-amber-300">{evt.title}</span>
                      <span className="font-mono text-slate-200">
                        {isOfferActive ? `⏳ ${Math.ceil(pendingTradeOffer!.remainingTimer)}s • ` : ''}
                        {evt.timestamp}
                      </span>
                    </div>
                    <p className="text-slate-100 leading-relaxed">{evt.description}</p>
                  </div>

                  {isOfferActive && onRespondTradeOffer && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => onRespondTradeOffer(true)}
                        className="min-h-[44px] py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1"
                      >
                        <Check className="w-4 h-4" /> Chấp nhận
                        {typeof offerGoldAmount === 'number' ? ` (${pendingTradeOffer!.mode === 'AI_SELL' ? `-${offerGoldAmount}` : `+${offerGoldAmount}`}💰)` : ''}
                      </button>
                      <button
                        onClick={() => onRespondTradeOffer(false)}
                        className="min-h-[44px] py-2 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white border border-slate-600 font-bold rounded-xl text-sm flex items-center justify-center gap-1"
                      >
                        <X className="w-4 h-4" /> Từ chối
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
