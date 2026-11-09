import React, { useState } from 'react';
import { TechBranch, TechNode, Nation, ResearchingTech } from '../types';
import { TECH_TREE } from '../utils/constants';
import { Coins, Swords, Shield, X, Clock, CheckCircle2, Lock, ChevronRight } from 'lucide-react';

interface TechModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  researching: ResearchingTech | null;
  onStartResearch: (tech: TechNode) => void;
}

const BRANCHES: { id: TechBranch; label: string; Icon: React.ElementType; color: string }[] = [
  { id: 'ECONOMY', label: 'Kinh Tế', Icon: Coins, color: 'text-amber-400' },
  { id: 'MILITARY', label: 'Quân Sự', Icon: Swords, color: 'text-red-400' },
  { id: 'DEFENSE', label: 'Phòng Thủ', Icon: Shield, color: 'text-blue-400' },
];

export const TechModal: React.FC<TechModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  researching,
  onStartResearch,
}) => {
  const [activeBranch, setActiveBranch] = useState<TechBranch>('ECONOMY');

  if (!isOpen) return null;

  const getBranchLevel = (branch: TechBranch) => {
    switch (branch) {
      case 'ECONOMY': return playerNation.techLevels?.economy || 0;
      case 'MILITARY': return playerNation.techLevels?.military || 0;
      case 'DEFENSE': return playerNation.techLevels?.defense || 0;
    }
  };

  const getBranchChoice = (branch: TechBranch): 'A' | 'B' | undefined => {
    const key = branch === 'ECONOMY' ? 'economy' : branch === 'MILITARY' ? 'military' : 'defense';
    const choice = playerNation.techChoices?.[key];
    const level = getBranchLevel(branch);
    if (level === 3 && !choice) return 'A'; // Tương thích save cũ ở cấp 3
    return choice;
  };

  const territoryCount = playerNation.territoryCount || 0;
  const getActualCost = (baseCost: number) => Math.round(baseCost * (1 + territoryCount / 150));
  const gold = Math.floor(playerNation.gold || 0);

  const branchTechs = TECH_TREE.filter(t => t.branch === activeBranch);
  const currentLevel = getBranchLevel(activeBranch);
  const selectedChoice = getBranchChoice(activeBranch);
  const linearTechs = branchTechs.filter(t => t.level < 3).sort((a, b) => a.level - b.level);
  const level3Techs = branchTechs.filter(t => t.level === 3);
  const progressPercent = researching && researching.totalTime > 0
    ? Math.min(100, Math.max(0, ((researching.totalTime - researching.remainingTime) / researching.totalTime) * 100))
    : 0;
  const researchingTech = researching ? TECH_TREE.find(t => t.id === researching.techId) : null;

  const renderCostLine = (tech: TechNode) => {
    const cost = getActualCost(tech.cost);
    const enough = gold >= cost;
    return (
      <div className="flex items-center gap-3 text-[11px] font-mono mt-1.5">
        <span className={enough ? 'text-amber-300' : 'text-red-400'}>💰 {cost}</span>
        <span className="text-slate-400">⏱️ {tech.researchTime}s</span>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Tiêu đề + vàng */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
          <div className="min-w-0">
            <h3 className="font-bold text-white text-base">Công Nghệ</h3>
            <p className="text-xs text-amber-300 font-mono">💰 {gold.toLocaleString()} Vàng</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Đang nghiên cứu */}
        {researching && (
          <div className="px-4 py-2.5 bg-blue-950/40 border-b border-blue-900/40">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div className="flex items-center gap-2 text-blue-300 min-w-0">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">Đang học: {researchingTech?.name || '...'}</span>
              </div>
              <span className="font-mono font-bold text-blue-200 shrink-0">{Math.ceil(researching.remainingTime)}s</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}

        {/* 3 tab nhánh */}
        <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-950/40 border-b border-slate-800">
          {BRANCHES.map(({ id, label, Icon, color }) => {
            const lvl = getBranchLevel(id);
            const isActive = id === activeBranch;
            return (
              <button
                key={id}
                onClick={() => setActiveBranch(id)}
                className={`flex flex-col items-center py-2 rounded-xl border transition-all min-h-[52px] active:scale-95 ${
                  isActive ? 'bg-slate-800 border-slate-600' : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${color}`} />
                <span className={`text-xs font-bold mt-0.5 ${isActive ? 'text-white' : 'text-slate-400'}`}>{label}</span>
                <span className="text-[10px] text-slate-500 font-mono">{lvl}/3</span>
              </button>
            );
          })}
        </div>

        <div className="p-3 space-y-2.5 max-h-[58vh] overflow-y-auto">
          {/* Cấp 1 và 2 */}
          {linearTechs.map((tech) => {
            const isCompleted = currentLevel >= tech.level;
            const isResearchingThis = researching?.techId === tech.id;
            const actualCost = getActualCost(tech.cost);
            const isLocked = currentLevel < tech.level - 1;
            const canResearch = currentLevel === tech.level - 1 && !researching && gold >= actualCost;

            return (
              <div
                key={tech.id}
                className={`p-3 rounded-xl border ${
                  isCompleted
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : isResearchingThis
                    ? 'bg-blue-950/30 border-blue-500/50'
                    : isLocked
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                    : 'bg-slate-800/60 border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200 flex items-center justify-center">
                      {tech.level}
                    </span>
                    <span className="font-bold text-white text-sm truncate">{tech.name}</span>
                  </div>
                  {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                  {isLocked && <Lock className="w-4 h-4 text-slate-500 shrink-0" />}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mt-1.5">{tech.description}</p>
                {!isCompleted && renderCostLine(tech)}
                {!isCompleted && !isLocked && (
                  isResearchingThis ? (
                    <div className="mt-2 text-center text-xs font-bold text-blue-300 py-2 rounded-lg bg-blue-950/40 border border-blue-500/40 animate-pulse">
                      Đang nghiên cứu {Math.ceil(researching!.remainingTime)}s
                    </div>
                  ) : (
                    <button
                      disabled={!canResearch}
                      onClick={() => onStartResearch(tech)}
                      className={`mt-2 w-full py-2.5 rounded-lg font-bold text-sm transition-all active:scale-95 ${
                        canResearch
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      }`}
                    >
                      {researching ? 'Đang bận nghiên cứu' : gold < actualCost ? 'Chưa đủ vàng' : 'Học'}
                    </button>
                  )
                )}
              </div>
            );
          })}

          {/* Cấp 3: chọn 1 trong 2 */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1.5 px-1">
              <span className="flex items-center gap-1"><ChevronRight className="w-3.5 h-3.5" /> Cấp 3: Chọn 1 trong 2</span>
              {currentLevel === 3 && (
                <span className="text-emerald-400 font-mono text-[11px]">Đã chọn {selectedChoice}</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {level3Techs.map((tech) => {
                const actualCost = getActualCost(tech.cost);
                const isChosen = currentLevel === 3 && selectedChoice === tech.choice;
                const isLockedChoice = currentLevel === 3 && !!selectedChoice && selectedChoice !== tech.choice;
                const isResearchingThis = researching?.techId === tech.id;
                const isLevelLocked = currentLevel < 2;
                const canResearch = currentLevel === 2 && !researching && gold >= actualCost;

                return (
                  <div
                    key={tech.id}
                    className={`p-3 rounded-xl border ${
                      isChosen
                        ? 'bg-emerald-950/30 border-emerald-500/50'
                        : isLockedChoice
                        ? 'bg-slate-950/30 border-slate-800/40 opacity-50'
                        : isResearchingThis
                        ? 'bg-blue-950/30 border-blue-500/50'
                        : isLevelLocked
                        ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                        : 'bg-slate-800/60 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 px-1.5 h-6 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200 flex items-center justify-center">
                          3{tech.choice}
                        </span>
                        <span className="font-bold text-white text-sm truncate">{tech.name}</span>
                      </div>
                      {isChosen && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                      {(isLockedChoice || isLevelLocked) && <Lock className="w-4 h-4 text-slate-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1.5">{tech.description}</p>
                    {!isChosen && !isLockedChoice && renderCostLine(tech)}
                    {isResearchingThis ? (
                      <div className="mt-2 text-center text-xs font-bold text-blue-300 py-2 rounded-lg bg-blue-950/40 border border-blue-500/40 animate-pulse">
                        Đang nghiên cứu {Math.ceil(researching!.remainingTime)}s
                      </div>
                    ) : !isChosen && !isLockedChoice && !isLevelLocked ? (
                      <button
                        disabled={!canResearch}
                        onClick={() => onStartResearch(tech)}
                        className={`mt-2 w-full py-2.5 rounded-lg font-bold text-sm transition-all active:scale-95 ${
                          canResearch
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                        }`}
                      >
                        {researching ? 'Đang bận nghiên cứu' : gold < actualCost ? 'Chưa đủ vàng' : 'Chọn & Học'}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {currentLevel < 2 && (
              <p className="text-[11px] text-slate-500 mt-1.5 px-1">Cần học xong cấp 2 trước.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
