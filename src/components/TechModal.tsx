import React from 'react';
import { TechBranch, TechNode, Nation, ResearchingTech } from '../types';
import { TECH_TREE } from '../utils/constants';
import { Coins, Swords, Shield, X, Clock, CheckCircle2, Lock } from 'lucide-react';

interface TechModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  researching: ResearchingTech | null;
  onStartResearch: (tech: TechNode) => void;
}

export const TechModal: React.FC<TechModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  researching,
  onStartResearch,
}) => {
  if (!isOpen) return null;

  const branches: { id: TechBranch; label: string; icon: React.ReactNode }[] = [
    { id: 'ECONOMY', label: 'Kinh Tế', icon: <Coins className="w-4 h-4 text-amber-400" /> },
    { id: 'MILITARY', label: 'Quân Sự', icon: <Swords className="w-4 h-4 text-red-400" /> },
    { id: 'DEFENSE', label: 'Phòng Thủ', icon: <Shield className="w-4 h-4 text-blue-400" /> },
  ];

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
    if (level === 3 && !choice) return 'A'; // Backward compatibility for old saves at level 3
    return choice;
  };

  const territoryCount = playerNation.territoryCount || 0;
  const getActualCost = (baseCost: number) => Math.round(baseCost * (1 + territoryCount / 150));

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
          <div>
            <h3 className="font-bold text-white text-base">Viện Hàn Lâm Công Nghệ</h3>
            <p className="text-xs text-slate-400">Nghiên cứu công nghệ gia tăng sức mạnh lâu dài</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {researching && (
          <div className="px-4 py-2.5 bg-blue-950/40 border-b border-blue-900/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-blue-300">
              <Clock className="w-4 h-4 animate-spin text-blue-400" />
              <span>Đang nghiên cứu...</span>
            </div>
            <span className="font-mono font-bold text-blue-200">
              {Math.ceil(researching.remainingTime)}s
            </span>
          </div>
        )}

        <div className="p-4 space-y-4 max-h-[72vh] overflow-y-auto">
          {branches.map(({ id: branchId, label, icon }) => {
            const currentLevel = getBranchLevel(branchId);
            const selectedChoice = getBranchChoice(branchId);
            const branchTechs = TECH_TREE.filter(t => t.branch === branchId);

            const linearTechs = branchTechs.filter(t => t.level < 3);
            const level3Techs = branchTechs.filter(t => t.level === 3);

            return (
              <div key={branchId} className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-3 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/50">
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="font-bold text-sm text-white">{label}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    Cấp {currentLevel}/3
                  </span>
                </div>

                {/* Cấp 1 & Cấp 2 */}
                <div className="grid grid-cols-1 gap-2 pt-1">
                  {linearTechs.map((tech) => {
                    const isCompleted = currentLevel >= tech.level;
                    const isResearchingThis = researching?.techId === tech.id;
                    const actualCost = getActualCost(tech.cost);
                    const canResearch = currentLevel === tech.level - 1 && !researching && playerNation.gold >= actualCost;
                    const isLocked = currentLevel < tech.level - 1;

                    return (
                      <div
                        key={tech.id}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                          isCompleted
                            ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-300'
                            : isResearchingThis
                            ? 'bg-blue-950/30 border-blue-500/50 text-white'
                            : isLocked
                            ? 'bg-slate-900/40 border-slate-800/50 text-slate-500'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 font-bold text-white">
                            <span>{tech.name}</span>
                            <span className="text-[10px] text-slate-400">Cấp {tech.level}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{tech.description}</p>
                          {!isCompleted && (
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1 font-mono">
                              <span>💰 {actualCost} Vàng</span>
                              <span>⏱️ {tech.researchTime}s</span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0">
                          {isCompleted ? (
                            <div className="flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Xong</span>
                            </div>
                          ) : isResearchingThis ? (
                            <div className="flex items-center gap-1 text-blue-400 font-semibold text-xs animate-pulse">
                              <Clock className="w-4 h-4" />
                              <span>{Math.ceil(researching.remainingTime)}s</span>
                            </div>
                          ) : (
                            <button
                              disabled={!canResearch}
                              onClick={() => onStartResearch(tech)}
                              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 ${
                                canResearch
                                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                              }`}
                            >
                              Học
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cấp 3: Ngã Rẽ (Chọn 1 trong 2) */}
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Cấp 3: Ngã Rẽ Chuyên Tinh (Chọn 1 trong 2)</span>
                    {currentLevel === 3 && (
                      <span className="text-emerald-400 font-mono text-[10px]">Đã chọn ngã rẽ {selectedChoice}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {level3Techs.map((tech) => {
                      const actualCost = getActualCost(tech.cost);
                      const isChosen = currentLevel === 3 && selectedChoice === tech.choice;
                      const isLockedChoice = currentLevel === 3 && selectedChoice && selectedChoice !== tech.choice;
                      const isResearchingThis = researching?.techId === tech.id;
                      const canResearch = currentLevel === 2 && !researching && playerNation.gold >= actualCost;
                      const isLevelLocked = currentLevel < 2;

                      return (
                        <div
                          key={tech.id}
                          className={`p-3 rounded-lg border text-xs flex flex-col justify-between gap-2.5 transition-all ${
                            isChosen
                              ? 'bg-emerald-950/30 border-emerald-500/50 text-slate-200'
                              : isLockedChoice
                              ? 'bg-slate-950/30 border-slate-800/40 text-slate-500 opacity-50'
                              : isResearchingThis
                              ? 'bg-blue-950/30 border-blue-500/50 text-white'
                              : isLevelLocked
                              ? 'bg-slate-900/30 border-slate-800/40 text-slate-500'
                              : 'bg-slate-800/60 border-slate-700/60 text-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-bold text-white text-xs">{tech.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                3{tech.choice}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{tech.description}</p>
                            {!isChosen && !isLockedChoice && (
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-2 font-mono">
                                <span>💰 {actualCost} Vàng</span>
                                <span>⏱️ {tech.researchTime}s</span>
                              </div>
                            )}
                          </div>

                          <div className="pt-1">
                            {isChosen ? (
                              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs justify-center py-1 bg-emerald-950/40 rounded border border-emerald-500/30">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Đã chọn</span>
                              </div>
                            ) : isLockedChoice ? (
                              <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-xs justify-center py-1 bg-slate-900/60 rounded border border-slate-800">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Đã khóa</span>
                              </div>
                            ) : isResearchingThis ? (
                              <div className="flex items-center gap-1.5 text-blue-400 font-semibold text-xs justify-center py-1 bg-blue-950/40 rounded border border-blue-500/40 animate-pulse">
                                <Clock className="w-4 h-4" />
                                <span>{Math.ceil(researching.remainingTime)}s</span>
                              </div>
                            ) : (
                              <button
                                disabled={!canResearch}
                                onClick={() => onStartResearch(tech)}
                                className={`w-full py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 ${
                                  canResearch
                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                                }`}
                              >
                                {currentLevel === 2 ? 'Chọn & Học' : 'Học'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
