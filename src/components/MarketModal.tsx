import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, Store } from 'lucide-react';
import { DepositType, MarketState, Nation } from '../types';
import { RESOURCE_CONFIG } from '../data/gameData';
import {
  areResourcesEnabled,
  createMarket,
  ensureNationResources,
  formatResource,
  getBuyPrice,
  getSellPrice,
  marketTrade,
} from '../utils/resources';

interface MarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameDataRef: React.MutableRefObject<any>;
}

const QUANTITIES = [10, 50, 100, 500];

const PriceSparkline: React.FC<{ history: number[]; color: string }> = ({ history, color }) => {
  if (!history || history.length < 2) return null;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = Math.max(0.1, max - min);
  const w = 140;
  const h = 32;
  const points = history
    .map((val, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = h - 4 - ((val - min) / range) * (h - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export const MarketModal: React.FC<MarketModalProps> = ({
  isOpen,
  onClose,
  gameDataRef,
}) => {
  const [selectedQty, setSelectedQty] = useState<number>(50);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [, setTick] = useState(0);

  if (!isOpen) return null;

  const data = gameDataRef.current;
  const player: Nation | undefined = data?.nations?.[1];
  if (!player) return null;

  ensureNationResources(player);
  if (!data.market) data.market = createMarket();
  const market: MarketState = data.market;
  const enabled = areResourcesEnabled();

  const handleTrade = (res: DepositType, mode: 'BUY' | 'SELL') => {
    const result = marketTrade(player, market, res, mode, selectedQty);
    setFeedback({ ok: result.ok, text: result.message });
    setTick(t => t + 1);
  };

  const renderCard = (res: DepositType) => {
    const isOil = res === 'OIL';
    const label = isOil ? 'Dầu Mỏ' : 'Khoáng Sản';
    const emoji = isOil ? '🛢️' : '⛏️';
    const stock = Math.floor(isOil ? (player.oil || 0) : (player.minerals || 0));
    const income = isOil ? (player.oilIncome || 0) : (player.mineralIncome || 0);
    const buyPrice = getBuyPrice(market, res);
    const sellPrice = getSellPrice(market, res, player);
    const history = isOil ? market.oilHistory : market.mineralHistory;
    const prevPrice = history.length >= 2 ? history[history.length - 2] : buyPrice;
    const isUp = buyPrice >= prevPrice;
    const buyCost = Math.ceil(buyPrice * selectedQty);
    const sellGain = Math.floor(sellPrice * selectedQty);
    const strokeColor = isOil ? '#38bdf8' : '#a78bfa';

    return (
      <div
        key={res}
        className={`p-3.5 rounded-2xl border ${
          isOil
            ? 'bg-sky-950/45 border-sky-400/70'
            : 'bg-violet-950/45 border-violet-400/70'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div>
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-lg">{emoji}</span>
              <h4 className="font-black text-white text-base">{label}</h4>
              <span
                className={`text-sm font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                  isUp ? 'bg-emerald-500/25 text-emerald-200' : 'bg-rose-500/25 text-rose-200'
                }`}
              >
                {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {buyPrice.toFixed(1)}💰
              </span>
            </div>
            <div className="text-sm font-mono mt-1 text-slate-100">
              Kho: <strong className="text-white">{formatResource(stock)}</strong>/{RESOURCE_CONFIG.STORAGE_CAP}
              {income > 0 && (
                <span className="text-emerald-300 ml-1.5">(+{income.toFixed(1)}/s)</span>
              )}
            </div>
          </div>

          <div className="shrink-0 bg-slate-950/85 px-2 py-1 rounded-xl border border-slate-700">
            <PriceSparkline history={history} color={strokeColor} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={!enabled || player.gold < buyCost || stock >= RESOURCE_CONFIG.STORAGE_CAP}
            onClick={() => handleTrade(res, 'BUY')}
            className={`min-h-[48px] py-2 px-3 rounded-xl font-bold text-sm transition-all active:scale-95 border ${
              enabled && player.gold >= buyCost && stock < RESOURCE_CONFIG.STORAGE_CAP
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white shadow'
                : 'bg-slate-800 border-slate-600 text-slate-300 opacity-65 cursor-not-allowed'
            }`}
          >
            <div>Mua +{selectedQty}</div>
            <div className="text-sm font-mono">-{buyCost} 💰</div>
          </button>

          <button
            disabled={!enabled || stock < selectedQty}
            onClick={() => handleTrade(res, 'SELL')}
            className={`min-h-[48px] py-2 px-3 rounded-xl font-bold text-sm transition-all active:scale-95 border ${
              enabled && stock >= selectedQty
                ? 'bg-amber-400 hover:bg-amber-300 border-amber-200 text-slate-950 font-extrabold shadow'
                : 'bg-slate-800 border-slate-600 text-slate-300 opacity-65 cursor-not-allowed'
            }`}
          >
            <div>Bán -{selectedQty}</div>
            <div className="text-sm font-mono">+{sellGain} 💰</div>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-slate-900 border border-sky-400/60 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-left">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/95 border-b border-slate-700 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-500/25 border border-sky-400 text-sky-300 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-white tracking-wide">
                CHỢ TÀI NGUYÊN
              </h3>
              <p className="text-sm text-amber-300 font-mono font-bold break-words">
                💰 Vàng: {Math.floor(player.gold).toLocaleString()} • Giá đổi mỗi {RESOURCE_CONFIG.MARKET_TICK_SECONDS}s
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2 text-slate-100 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl flex items-center justify-center shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 overflow-y-auto space-y-3">
          {!enabled && (
            <div className="p-3 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white">
              Hệ thống Dầu & Khoáng sản đang tắt trong chế độ nhiều người chơi.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-700">
            <span className="text-sm text-slate-100 font-bold pl-1">Số lượng:</span>
            <div className="flex items-center gap-1.5">
              {QUANTITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setSelectedQty(q)}
                  className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl text-sm font-mono font-bold border transition-all active:scale-95 ${
                    selectedQty === q
                      ? 'bg-sky-400 border-sky-200 text-slate-950 font-black'
                      : 'bg-slate-800 border-slate-600 text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {feedback && (
            <div
              className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                feedback.ok
                  ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-400 text-rose-200'
              }`}
            >
              {feedback.text}
            </div>
          )}

          {renderCard('OIL')}
          {renderCard('MINERAL')}
        </div>
      </div>
    </div>
  );
};
