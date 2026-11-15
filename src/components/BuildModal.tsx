import React, { useState } from 'react';
import { BuildingType, Tile, Nation } from '../types';
import { BUILDING_INFO, formatPopulation } from '../utils/constants';
import { RESOURCE_CONFIG } from '../data/gameData';
import { areResourcesEnabled, getBuildingMineralCost, getExtractorBuildCost, extractorFor, isExtractor } from '../utils/resources';
import {
  SUPER_BUILDING_TYPES,
  SUPER_BUILDING_CONFIG,
  hasUnlockedSuperBuildings,
  canBuildSuperBuilding,
  countSuperBuildingsFromCounts,
  isSuperBuilding,
} from '../utils/superBuildings';
import { canBuildBunker, MAX_BUNKERS_PER_NATION } from '../utils/supremeTech';
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
  OIL_RIG: 'Giàn Dầu',
  MINE: 'Mỏ Khoáng',
  BUNKER: 'Lô Cốt',
  SUPREME_FORTRESS: 'Pháo Đài Tối Thượng',
  GRAND_ACADEMY: 'Đại Học Viện',
  GRAND_ARSENAL: 'Đại Công Xưởng',
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
  const minerals = playerNation.minerals || 0;
  const resOn = areResourcesEnabled();
  const fmtM = (v: number) => `${Math.ceil(v)}`;

  const calculateBatchCost = (type: BuildableType, goal: BatchOption) => {
    if (isExtractor(type)) {
      const c = getExtractorBuildCost(selectedTile, playerNation);
      return { totalCost: c.gold, totalMinerals: c.minerals, actualCount: 1 };
    }

    const base = BUILDING_INFO[type].baseCost;
    const currentCount = existingBuildingCounts[type] || 0;
    let discount = 1.0;
    if (playerNation.techLevels?.economy >= 2) discount *= 0.92;
    if (playerNation.techLevels?.economy >= 3 && playerNation.techChoices?.economy === 'B') discount *= 0.80;

    let totalCost = 0;
    let totalMinerals = 0;
    let actualCount = 0;
    const rawLimit = goal === 'MAX' ? 9999 : goal;
    const limit = type === 'BUNKER'
      ? Math.min(rawLimit, Math.max(0, MAX_BUNKERS_PER_NATION - currentCount))
      : rawLimit;

    for (let i = 0; i < limit; i++) {
      const singleCost = Math.floor(base * Math.pow(1.15, currentCount + i) * discount);
      const singleMin = getBuildingMineralCost(type, currentCount + i);
      if (goal !== 'MAX') {
        totalCost += singleCost;
        totalMinerals += singleMin;
        actualCount++;
      } else if (totalCost + singleCost <= gold && totalMinerals + singleMin <= minerals) {
        totalCost += singleCost;
        totalMinerals += singleMin;
        actualCount++;
      } else {
        break;
      }
    }

    if (goal === 'MAX' && actualCount === 0) {
      actualCount = 1;
      totalCost = Math.floor(base * Math.pow(1.15, currentCount) * discount);
      totalMinerals = getBuildingMineralCost(type, currentCount);
    }

    return { totalCost, totalMinerals, actualCount };
  };

  // Chỉ hiện công trình xây được: Hải Cảng chỉ hiện khi ô giáp biển; Giàn Dầu/Mỏ Khoáng khi ô có mỏ đã phát hiện
  const hasExtractorSpot = resOn && !!selectedTile.deposit && !!selectedTile.discovered && (selectedTile.reserve || 0) > 0;
  const extractorType: BuildableType | null = hasExtractorSpot ? extractorFor(selectedTile.deposit!) : null;
  const bunkerUnlocked = canBuildBunker(playerNation);
  const baseTypes = ALL_TYPES.filter((t) => t !== 'PORT' || selectedTile.hasHarborAccess);
  const withBunker: BuildableType[] = bunkerUnlocked ? [...baseTypes, 'BUNKER'] : baseTypes;
  const buildingTypes: BuildableType[] = extractorType ? [extractorType, ...withBunker] : withBunker;
  const n = buildingTypes.length;
  const RADIUS = 37;

  const existing: BuildableType | null =
    selectedTile.building && selectedTile.building !== 'NONE' ? (selectedTile.building as BuildableType) : null;
  const superUnlocked = hasUnlockedSuperBuildings(playerNation);
  const ownedSuperTotal = countSuperBuildingsFromCounts(existingBuildingCounts);
  const onSuperTile = isSuperBuilding(selectedTile.building);

  const terrainLabel =
    selectedTile.terrain === 'LAND' ? 'Đồng bằng' : selectedTile.terrain === 'FOREST' ? 'Rừng' : 'Núi';

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-black/75 backdrop-blur-[2px] p-3"
      style={{
        paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="m-auto flex flex-col items-center gap-3 text-white" style={{ width: 'min(94vw, 410px)' }}>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-100">
            Ô ({selectedTile.x}, {selectedTile.y}) · {terrainLabel}
            {selectedTile.hasHarborAccess ? ' · Giáp biển' : ''}
          </p>
          {existing && (
            <p className="text-sm text-amber-200 mt-1">
              Ô này đang có {BUILDING_INFO[existing].name} (Cấp {selectedTile.buildingLevel || 1}). Xây loại khác sẽ
              THAY THẾ nó.
            </p>
          )}
        </div>

        <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
          <div className="pointer-events-none absolute inset-[13%] rounded-full bg-slate-950/85 border border-slate-600" />

          <button
            onClick={onClose}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 min-w-[44px] min-h-[44px] rounded-full bg-slate-900 border-2 border-slate-500 flex flex-col items-center justify-center active:scale-95 transition-transform"
            aria-label="Đóng"
          >
            <X className="w-6 h-6 text-white" />
            <span className="text-sm font-mono font-bold text-amber-200 mt-0.5">💰 {formatPopulation(gold)}</span>
            {resOn && (
              <span className="text-sm font-mono font-bold text-violet-200">⛏️ {Math.floor(minerals)}</span>
            )}
          </button>

          {buildingTypes.map((type, i) => {
            const angle = ((-90 + (i * 360) / n) * Math.PI) / 180;
            const left = 50 + RADIUS * Math.cos(angle);
            const top = 50 + RADIUS * Math.sin(angle);

            const { totalCost, totalMinerals, actualCount } = calculateBatchCost(type, selectedBatch);
            const atMaxExtractor = isExtractor(type) && selectedTile.building === type && (selectedTile.buildingLevel || 1) >= RESOURCE_CONFIG.MAX_EXTRACTOR_LEVEL;
            const bunkerCount = existingBuildingCounts.BUNKER || 0;
            const atMaxBunker = type === 'BUNKER' && bunkerCount >= MAX_BUNKERS_PER_NATION;
            const canAfford = gold >= totalCost && minerals >= totalMinerals && !atMaxExtractor && !atMaxBunker && actualCount > 0;
            const isCurrent = selectedTile.building === type;

            let badge: string | null = null;
            if (atMaxExtractor) badge = 'MAX';
            else if (type === 'BUNKER') badge = atMaxBunker ? `${bunkerCount}/${MAX_BUNKERS_PER_NATION}` : `${bunkerCount}/${MAX_BUNKERS_PER_NATION}${actualCount > 1 ? ` +${actualCount}` : ''}`;
            else if (isCurrent) badge = `Lv${selectedTile.buildingLevel || 1}+${actualCount}`;
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
                className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex flex-col items-center gap-1 transition-transform active:scale-95 ${
                  canAfford ? '' : 'opacity-50 grayscale'
                }`}
              >
                <span
                  className={`relative w-14 h-14 rounded-full bg-slate-900 border-2 flex items-center justify-center shadow-lg ${
                    isCurrent ? 'border-blue-400' : 'border-slate-500'
                  }`}
                >
                  <BuildingSvgIcon
                    type={type}
                    className="w-7 h-7 text-white [&_*]:stroke-current [&_*]:fill-none"
                  />
                  {badge && (
                    <span className="absolute -top-1.5 -right-3 whitespace-nowrap rounded-full bg-amber-400 px-1.5 py-0.5 text-sm font-black leading-none text-slate-950">
                      {badge}
                    </span>
                  )}
                </span>

                <span className="text-sm font-bold leading-none text-white whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                  {SHORT_NAME[type]}
                </span>

                <span
                  className={`text-sm font-mono font-bold leading-none whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
                    gold >= totalCost ? 'text-amber-200' : 'text-red-300'
                  }`}
                >
                  {formatPopulation(totalCost)} 💰
                </span>
                {totalMinerals > 0 && (
                  <span
                    className={`text-sm font-mono font-bold leading-none whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
                      minerals >= totalMinerals ? 'text-violet-200' : 'text-red-300'
                    }`}
                  >
                    {fmtM(totalMinerals)} ⛏️
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {superUnlocked && (
          <div className="w-full rounded-2xl bg-slate-950/95 border border-amber-400/60 p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-sm font-bold uppercase tracking-wider text-amber-200">
                Siêu Công Trình
              </span>
              <span className="text-sm font-mono text-slate-100">
                {ownedSuperTotal}/{SUPER_BUILDING_CONFIG.MAX_TOTAL_PER_NATION}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SUPER_BUILDING_TYPES.map((sType) => {
                const cost = BUILDING_INFO[sType].baseCost;
                const alreadyOwned = (existingBuildingCounts[sType] || 0) >= SUPER_BUILDING_CONFIG.MAX_PER_TYPE;
                const check = canBuildSuperBuilding(playerNation, sType, existingBuildingCounts);
                const enabled = check.ok && !onSuperTile;
                const badge = alreadyOwned
                  ? 'ĐÃ CÓ'
                  : ownedSuperTotal >= SUPER_BUILDING_CONFIG.MAX_TOTAL_PER_NATION
                  ? 'TỐI ĐA'
                  : `${SUPER_BUILDING_CONFIG.BUILD_TIME_SECONDS}s`;

                return (
                  <button
                    key={sType}
                    disabled={!enabled}
                    onClick={() => {
                      onBuild(sType, 1);
                      onClose();
                    }}
                    title={BUILDING_INFO[sType].desc}
                    className={`min-h-[44px] flex flex-col items-center gap-1 rounded-xl p-1.5 transition-transform active:scale-95 ${
                      enabled ? 'hover:bg-slate-900' : 'opacity-50 grayscale cursor-not-allowed'
                    }`}
                  >
                    <span className="relative w-14 h-14 rounded-full bg-slate-900 border-2 border-amber-400 flex items-center justify-center shadow-lg">
                      <BuildingSvgIcon
                        type={sType}
                        className="w-7 h-7 text-white [&_*]:stroke-current [&_*]:fill-none"
                      />
                      <span
                        className={`absolute -top-1.5 -right-2 whitespace-nowrap rounded-full px-1.5 py-0.5 text-sm font-black leading-none ${
                          alreadyOwned
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {badge}
                      </span>
                    </span>
                    <span className="text-sm font-bold leading-tight text-white text-center">
                      {SHORT_NAME[sType]}
                    </span>
                    <span
                      className={`text-sm font-mono font-bold leading-none whitespace-nowrap ${
                        gold >= cost ? 'text-amber-200' : 'text-red-300'
                      }`}
                    >
                      {formatPopulation(cost)} 💰
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="w-full rounded-2xl bg-slate-950/95 border border-slate-700 p-2.5">
          <p className="text-sm text-center text-slate-100 mb-2">
            Số lượng mỗi lần chạm: {selectedBatch === 'MAX' ? 'tối đa theo số Vàng' : `x${selectedBatch}`}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {BATCH_OPTIONS.map((opt) => (
              <button
                key={String(opt)}
                onClick={() => setSelectedBatch(opt)}
                className={`min-h-[44px] h-11 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                  selectedBatch === opt
                    ? 'bg-amber-400 border-amber-200 text-slate-950 font-black'
                    : 'bg-slate-900 border-slate-600 text-white'
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
