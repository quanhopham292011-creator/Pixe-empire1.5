import React, { useState } from 'react';
import { BuildingType, Tile, Nation } from '../types';
import { BUILDING_INFO, formatPopulation } from '../utils/constants';
import { X } from 'lucide-react';
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
type BuildableType = Exclude<BuildingType, 'NONE'>;

const BATCH_OPTIONS: BatchOption[] = [1, 2, 5, 10, 20, 50, 100, 'MAX'];

const SHORT_NAME: Record<BuildableType, string> = {
  CITY: 'Thành Thị',
  BARRACKS: 'Doanh Trại',
  FORTRESS: 'Pháo Đài',
  PORT: 'Hải Cảng',
  MISSILE_SILO: 'Bệ Tên Lửa',
  AIR_DEFENSE: 'Phòng Không',
  LASER: 'Tháp Laser',
};

const ALL_TYPES: BuildableType[] = ['CITY', 'BARRACKS', 'FORTRESS', 'PORT', 'LASER', 'MISSILE_SILO', 'AIR_DEFENSE'];

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

  const gold = playerNation.gold || 0;

  const calculateBatchCost = (type: BuildableType, goal: BatchOption) => {
    const base = BUILDING_INFO[type].baseCost;
    const currentCount = existingBuildingCounts[type] || 0;
    let discount = 1.0;
    if (playerNation.techLevels?.economy >= 2) discount *= 0.92;
    if (playerNation.techLevels?.economy >= 3 && playerNation.techChoices?.economy === 'B') discount *= 0.80;

    let totalCost = 0;
    let actualCount = 0;
    const limit = goal === 'MAX' ? 9999 : goal;

    for (let i = 0; i < limit; i++) {
      const singleCost = Math.floor(base * Math.pow(1.15, currentCount + i) * discount);
      if (goal !== 'MAX') {
        totalCost += singleCost;
        actualCount++;
      } else if (totalCost + singleCost <= gold) {
        totalCost += singleCost;
        actualCount++;
      } else {
        break;
      }
    }

    if (goal === 'MAX' && actualCount === 0) {
      actualCount = 1;
      totalCost = Math.floor(base * Math.pow(1.15, currentCount) * discount);
    }

    return { totalCost, actualCount };
  };

  // Chỉ hiện công trình xây được: Hải Cảng chỉ hiện khi ô giáp biển
  const buildingTypes = ALL_TYPES.filter((t) => t !== 'PORT' || selectedTile.hasHarborAccess);
  const n = buildingTypes.length;
  const RADIUS = 37;

  const existing: BuildableType | null =
    selectedTile.building && selectedTile.building !== 'NONE' ? (selectedTile.building as BuildableType) : null;

  const terrainLabel =
    selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng' : 'Núi';

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-black/60 backdrop-blur-[2px] p-3"
      style={{
        paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="m-auto flex flex-col items-center gap-3 text-slate-100" style={{ width: 'min(94vw, 380px)' }}>
        <div className="text-center">
          <p className="text-xs font-bold text-slate-200">
            Ô ({selectedTile.x}, {selectedTile.y}) · {terrainLabel}
            {selectedTile.hasHarborAccess ? ' · Giáp biển' : ''}
          </p>
          {existing && (
            <p className="text-[11px] text-amber-300 mt-1">
              Ô này đang có {BUILDING_INFO[existing].name} (Cấp {selectedTile.buildingLevel || 1}). Xây loại khác sẽ
              THAY THẾ nó.
            </p>
          )}
        </div>

        <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
          <div className="pointer-events-none absolute inset-[13%] rounded-full bg-slate-950/75 border border-slate-700/60" />

          <button
            onClick={onClose}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-slate-900 border-2 border-slate-700 flex flex-col items-center justify-center active:scale-95 transition-transform"
            aria-label="Đóng"
          >
            <X className="w-6 h-6 text-slate-300" />
            <span className="text-[12px] font-mono font-bold text-amber-300 mt-0.5">💰 {formatPopulation(gold)}</span>
          </button>

          {buildingTypes.map((type, i) => {
            const angle = ((-90 + (i * 360) / n) * Math.PI) / 180;
            const left = 50 + RADIUS * Math.cos(angle);
            const top = 50 + RADIUS * Math.sin(angle);

            const { totalCost, actualCount } = calculateBatchCost(type, selectedBatch);
            const canAfford = gold >= totalCost;
            const isCurrent = selectedTile.building === type;

            let badge: string | null = null;
            if (isCurrent) badge = `Lv${selectedTile.buildingLevel || 1}+${actualCount}`;
            else if (actualCount > 1) badge = `x${actualCount}`;

            return (
              <button
                key={type}
                disabled={!canAfford}
                onClick={() => {
                  onBuild(type, actualCount);
                  onClose();
                }}
                style={{ left: `${left}%`, top: `${top}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-transform active:scale-95 ${
                  canAfford ? '' : 'opacity-40 grayscale'
                }`}
              >
                <span
                  className={`relative w-16 h-16 rounded-full bg-slate-900 border-2 flex items-center justify-center shadow-lg ${
                    isCurrent ? 'border-blue-400' : 'border-slate-600'
                  }`}
                >
                  <BuildingSvgIcon
                    type={type}
                    className="w-8 h-8 text-white [&_*]:stroke-current [&_*]:fill-none"
                  />
                  {badge && (
                    <span className="absolute -top-1 -right-3 whitespace-nowrap rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-slate-950">
                      {badge}
                    </span>
                  )}
                </span>

                <span className="text-[11px] font-bold leading-none text-white whitespace-nowrap">
                  {SHORT_NAME[type]}
                </span>

                <span
                  className={`text-[12px] font-mono font-bold leading-none whitespace-nowrap ${
                    canAfford ? 'text-amber-300' : 'text-slate-400'
                  }`}
                >
                  {formatPopulation(totalCost)} 💰
                </span>
              </button>
            );
          })}
        </div>

        <div className="w-full rounded-2xl bg-slate-950/80 border border-slate-800 p-2">
          <p className="text-[11px] text-center text-slate-400 mb-1.5">
            Số lượng mỗi lần chạm: {selectedBatch === 'MAX' ? 'tối đa theo số Vàng' : `x${selectedBatch}`}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {BATCH_OPTIONS.map((opt) => (
              <button
                key={String(opt)}
                onClick={() => setSelectedBatch(opt)}
                className={`h-11 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                  selectedBatch === opt
                    ? 'bg-amber-500 border-amber-300 text-slate-950 font-black'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                {opt === 'MAX' ? 'MAX' : `x${opt}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
