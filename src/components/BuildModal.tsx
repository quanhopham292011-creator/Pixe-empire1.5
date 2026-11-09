import React, { useState } from 'react';
import { BuildingType, Tile, Nation } from '../types';
import { BUILDING_INFO, formatPopulation } from '../utils/constants';
import { X, Layers } from 'lucide-react';
import { BuildingSvgIcon } from './BuildingSvgIcon';

interface BuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTile: Tile | null;
  playerNation: Nation;
  existingBuildingCounts: Record<BuildingType, number>;
  onBuild: (type: BuildingType, count: number) => void;
}

type BatchOption = 1 | 2 | 5 | 10 | 20 | 50 | 100 | 'MAX';

export const BuildModal: React.FC<BuildModalProps> = ({
  isOpen,
  onClose,
  selectedTile,
  playerNation,
  existingBuildingCounts,
  onBuild,
}) => {
  const [selectedBatch, setSelectedBatch] = useState<BatchOption>(1);

  if (!isOpen || !selectedTile) return null;

  const batchOptions: BatchOption[] = [1, 2, 5, 10, 20, 50, 100, 'MAX'];

  const calculateBatchCost = (type: Exclude<BuildingType, 'NONE'>, goal: BatchOption) => {
    const base = BUILDING_INFO[type].baseCost;
    const currentCount = existingBuildingCounts[type] || 0;
    let discount = 1.0;
    if (playerNation.techLevels?.economy >= 2) discount *= 0.92;
    if (playerNation.techLevels?.economy >= 3 && playerNation.techChoices?.economy === 'B') discount *= 0.80;
    const gold = playerNation.gold || 0;

    let totalCost = 0;
    let actualCount = 0;
    const limit = goal === 'MAX' ? 9999 : goal;

    for (let i = 0; i < limit; i++) {
      const singleCost = Math.floor(base * Math.pow(1.15, currentCount + i) * discount);
      if (goal !== 'MAX') {
        totalCost += singleCost;
        actualCount++;
      } else {
        if (totalCost + singleCost <= gold) {
          totalCost += singleCost;
          actualCount++;
        } else {
          break;
        }
      }
    }

    if (goal === 'MAX' && actualCount === 0) {
      actualCount = 1;
      totalCost = Math.floor(base * Math.pow(1.15, currentCount) * discount);
    }

    return { totalCost, actualCount };
  };

  const buildingTypes: Array<Exclude<BuildingType, 'NONE'>> = ['CITY', 'BARRACKS', 'FORTRESS', 'PORT', 'ARTILLERY', 'LASER', 'MISSILE_SILO', 'AIR_DEFENSE'];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-2 sm:p-4"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200 text-slate-100">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-white text-base tracking-wide flex items-center gap-2">
                🏗️ TRUNG TÂM XÂY DỰNG
              </h3>
              <span className="text-xs bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                💰 {formatPopulation(playerNation.gold)} Vàng
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Vị trí: ({selectedTile.x}, {selectedTile.y}) · {selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng' : 'Núi'} {selectedTile.hasHarborAccess ? '· Giáp biển' : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl active:bg-slate-800 bg-slate-900 border border-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BATCH SELECTOR */}
        <div className="px-4 py-2.5 bg-slate-900/50 border-b border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span className="flex items-center gap-1 text-amber-400">
              <Layers className="w-3.5 h-3.5" /> Mốc số lượng xây gộp:
            </span>
            <span className="text-slate-400 font-mono text-[10px]">
              {selectedBatch === 'MAX' ? 'Tối đa theo số Vàng' : `x${selectedBatch} Công trình`}
            </span>
          </div>

          <div className="grid grid-cols-8 gap-1">
            {batchOptions.map((opt) => (
              <button
                key={String(opt)}
                onClick={() => setSelectedBatch(opt)}
                className={`py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 flex items-center justify-center ${
                  selectedBatch === opt
                    ? 'bg-amber-500 border-amber-300 text-slate-950 font-black shadow'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {opt === 'MAX' ? 'MAX' : `x${opt}`}
              </button>
            ))}
          </div>
        </div>

        {/* RADIAL / GRID OPENFRONT STYLE BUILDING SELECTION */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[62vh] overflow-y-auto">
          {buildingTypes.map((type) => {
            const info = BUILDING_INFO[type];
            const { totalCost, actualCount } = calculateBatchCost(type, selectedBatch);
            const canAfford = playerNation.gold >= totalCost;
            const isPort = type === 'PORT';
            const portValid = isPort ? selectedTile.hasHarborAccess : true;
            const isCurrentBuilding = selectedTile.building === type;
            const isDisabled = !canAfford || (isPort && !portValid);

            return (
              <button
                key={type}
                disabled={isDisabled}
                onClick={() => {
                  onBuild(type, actualCount);
                  onClose();
                }}
                className={`group relative p-3 rounded-2xl border flex flex-col items-center text-center transition-all active:scale-95 ${
                  isCurrentBuilding
                    ? 'bg-blue-950/40 border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : isDisabled
                    ? 'bg-slate-900/40 border-slate-800/80 opacity-40 grayscale cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-700/80 hover:border-slate-600 shadow-md'
                }`}
              >
                {/* ICON TRẮNG LỚN PHONG CÁCH OPENFRONT */}
                <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-700/80 flex items-center justify-center text-white mb-2 shadow-inner group-hover:scale-105 transition-transform">
                  <BuildingSvgIcon type={type} className="w-7 h-7 text-white" />
                </div>

                {/* TÊN CÔNG TRÌNH */}
                <span className="font-bold text-white text-xs tracking-tight line-clamp-1 mb-0.5">
                  {info.name}
                </span>

                {/* TRẠNG THÁI / CẤP ĐỘ */}
                {isCurrentBuilding ? (
                  <span className="text-[9px] bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40 px-2 py-0.5 rounded-full mb-1">
                    Cấp {selectedTile.buildingLevel || 1} (Xây Chồng)
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 line-clamp-1 mb-1">
                    {info.desc}
                  </span>
                )}

                {/* GIÁ TIỀN NHỎ BÊN DƯỚI */}
                <div className="mt-auto pt-2 border-t border-slate-800/80 w-full flex items-center justify-between text-[11px]">
                  <span className={`font-mono font-bold ${canAfford ? 'text-amber-400' : 'text-slate-500'}`}>
                    {formatPopulation(totalCost)} 💰
                  </span>
                  <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
                    {isCurrentBuilding ? `+${actualCount}` : `x${actualCount}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
