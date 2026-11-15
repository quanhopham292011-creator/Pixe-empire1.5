import React, { useState } from 'react';
import { TechBranch, TechNode, Nation, ResearchingTech, SupremeTechBranch } from '../types';
import { TECH_TREE, SUPREME_TECH_CONFIG, SupremeTechItem } from '../utils/constants';
import { areResourcesEnabled, getTechResourceCost, formatResource } from '../utils/resources';
import {
  canStartSupremeResearch,
  findSupremeTechById,
  getSupremeBranchLevel,
} from '../utils/supremeTech';
import { Coins, Swords, Shield, Sparkles, X, Clock, CheckCircle2, Lock } from 'lucide-react';

interface TechModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  researching: ResearchingTech | null;
  onStartResearch: (tech: TechNode | SupremeTechItem) => void;
  academySpeedMult?: number;
}

type ModalTab = TechBranch | 'SUPREME';

const BRANCHES: { id: ModalTab; label: string; Icon: React.ElementType; color: string }[] = [
  { id: 'ECONOMY', label: 'Kinh Tế', Icon: Coins, color: 'text-amber-400' },
  { id: 'MILITARY', label: 'Quân Sự', Icon: Swords, color: 'text-red-400' },
  { id: 'DEFENSE', label: 'Phòng Thủ', Icon: Shield, color: 'text-blue-400' },
  { id: 'SUPREME', label: 'Tối Thượng', Icon: Sparkles, color: 'text-cyan-300' },
];

const SUPREME_COLUMNS: {
  key: SupremeTechBranch;
  label: string;
  Icon: React.ElementType;
  color: string;
  border: string;
}[] = [
  { key: 'economy', label: 'Kinh tế', Icon: Coins, color: 'text-amber-300', border: 'border-amber-500/30' },
  { key: 'military', label: 'Quân sự', Icon: Swords, color: 'text-rose-300', border: 'border-rose-500/30' },
  { key: 'defense', label: 'Phòng thủ', Icon: Shield, color: 'text-sky-300', border: 'border-sky-500/30' },
];

// Rút gọn số: 15000 -> 15k
const short = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : `${n}`);

type RowState = 'done' | 'learning' | 'locked' | 'ready';

interface TechRowProps {
  badge: string;
  name: string;
  description: string;
  state: RowState;
  dim?: boolean;
  showCost: boolean;
  gold?: number;
  goldOk?: boolean;
  oil?: number;
  oilOk?: boolean;
  minerals?: number;
  mineralOk?: boolean;
  time?: string;
  learningSec?: number;
  btnLabel?: string;
  btnEnabled?: boolean;
  onClick?: () => void;
  note?: string;
  infoOpen: boolean;
  onToggleInfo: () => void;
}

// Một hàng công nghệ gọn: [cấp] [tên + giá] [!] [nút]
const TechRow: React.FC<TechRowProps> = (p) => {
  const bg =
    p.state === 'done'
      ? 'bg-emerald-950/50 border-emerald-400/60'
      : p.state === 'learning'
      ? 'bg-blue-950/60 border-blue-400'
      : p.state === 'locked'
      ? 'bg-slate-900/70 border-slate-700'
      : 'bg-slate-800/90 border-slate-600';

  return (
    <div className={`rounded-xl border p-2.5 ${bg} ${p.dim || p.state === 'locked' ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 min-w-[30px] h-[30px] px-1.5 rounded-full bg-slate-950 border border-slate-500 text-sm font-bold text-white flex items-center justify-center">
          {p.badge}
        </span>

        <div className="min-w-0 flex-1">
          <div className="font-bold text-white text-sm leading-snug break-words">{p.name}</div>
          {p.showCost && (
            <div className="flex items-center flex-wrap gap-x-2 text-sm font-mono mt-0.5">
              <span className={p.goldOk ? 'text-amber-200' : 'text-red-300 font-bold'}>💰{short(p.gold || 0)}</span>
              {(p.oil || 0) > 0 && (
                <span className={p.oilOk ? 'text-sky-200' : 'text-red-300 font-bold'}>🛢️{short(p.oil || 0)}</span>
              )}
              {(p.minerals || 0) > 0 && (
                <span className={p.mineralOk ? 'text-violet-200' : 'text-red-300 font-bold'}>⛏️{short(p.minerals || 0)}</span>
              )}
              {p.time && <span className="text-slate-100">⏱️{p.time}</span>}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={p.onToggleInfo}
          aria-label="Xem thông tin"
          className={`min-w-[44px] min-h-[44px] rounded-xl border text-sm font-black flex items-center justify-center shrink-0 active:scale-90 transition-all ${
            p.infoOpen
              ? 'bg-amber-400 text-slate-950 border-amber-200'
              : 'bg-slate-900 text-amber-200 border-slate-500'
          }`}
        >
          !
        </button>

        <div className="shrink-0 min-w-[84px] flex items-center justify-center">
          {p.state === 'done' && <CheckCircle2 className="w-6 h-6 text-emerald-300" />}
          {p.state === 'locked' && <Lock className="w-5 h-5 text-slate-300" />}
          {p.state === 'learning' && (
            <span className="text-sm font-mono font-bold text-blue-100 animate-pulse">⏳ {p.learningSec}s</span>
          )}
          {p.state === 'ready' && (
            <button
              disabled={!p.btnEnabled}
              onClick={p.onClick}
              className={`w-full min-h-[44px] rounded-xl font-black text-sm px-2.5 transition-all active:scale-95 ${
                p.btnEnabled
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                  : 'bg-slate-800 text-slate-300 border border-slate-600 cursor-not-allowed opacity-75'
              }`}
            >
              {p.btnLabel}
            </button>
          )}
        </div>
      </div>

      {p.infoOpen && (
        <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-600 text-sm text-slate-100 leading-relaxed">
          {p.description}
          {p.note && <div className="mt-1 text-amber-200 font-bold">{p.note}</div>}
        </div>
      )}
    </div>
  );
};

export const TechModal: React.FC<TechModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  researching,
  onStartResearch,
  academySpeedMult = 1,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('ECONOMY');
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleInfo = (id: string) => setOpenInfo((prev) => (prev === id ? null : id));

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
  const oilStock = Math.floor(playerNation.oil || 0);
  const mineralStock = Math.floor(playerNation.minerals || 0);
  const resOn = areResourcesEnabled();
  const hasResFor = (techId: string) => {
    const rc = getTechResourceCost(techId);
    return oilStock >= rc.oil && mineralStock >= rc.minerals;
  };
  const timeText = (t: number) => {
    const reduced = Math.max(1, Math.round(t * 0.9));
    return academySpeedMult > 1 ? `${Math.ceil(reduced / academySpeedMult)}s` : `${reduced}s`;
  };

  const isSupremeTab = activeTab === 'SUPREME';
  const activeBranch: TechBranch = isSupremeTab ? 'ECONOMY' : activeTab;
  const branchTechs = TECH_TREE.filter((t) => t.branch === activeBranch);
  const currentLevel = getBranchLevel(activeBranch);
  const selectedChoice = getBranchChoice(activeBranch);
  const linearTechs = branchTechs.filter((t) => t.level < 3).sort((a, b) => a.level - b.level);
  const level3Techs = branchTechs.filter((t) => t.level === 3);
  const progressPercent =
    researching && researching.totalTime > 0
      ? Math.min(100, Math.max(0, ((researching.totalTime - researching.remainingTime) / researching.totalTime) * 100))
      : 0;
  const researchingTech = researching
    ? TECH_TREE.find((t) => t.id === researching.techId) || findSupremeTechById(researching.techId)
    : null;

  const supremeTotalDone =
    getSupremeBranchLevel(playerNation, 'economy') +
    getSupremeBranchLevel(playerNation, 'military') +
    getSupremeBranchLevel(playerNation, 'defense');

  // Hàng công nghệ thường (cấp 1-2 hoặc cấp 3 chọn A/B)
  const renderNormalRow = (tech: TechNode, kind: 'linear' | 'choice') => {
    const actualCost = getActualCost(tech.cost);
    const rc = getTechResourceCost(tech.id);
    const resOk = hasResFor(tech.id);
    const isResearchingThis = researching?.techId === tech.id;

    let state: RowState;
    let dim = false;
    let canResearch: boolean;
    let btnLabel: string;

    if (kind === 'linear') {
      const isCompleted = currentLevel >= tech.level;
      const isLocked = currentLevel < tech.level - 1;
      state = isCompleted ? 'done' : isResearchingThis ? 'learning' : isLocked ? 'locked' : 'ready';
      canResearch = currentLevel === tech.level - 1 && !researching && gold >= actualCost && resOk;
      btnLabel = researching ? 'Đang bận' : gold < actualCost ? 'Thiếu vàng' : !resOk ? 'Thiếu dầu/khoáng' : 'Học';
    } else {
      const isChosen = currentLevel === 3 && selectedChoice === tech.choice;
      const isLockedChoice = currentLevel === 3 && !!selectedChoice && selectedChoice !== tech.choice;
      const isLevelLocked = currentLevel < 2;
      state = isChosen ? 'done' : isResearchingThis ? 'learning' : isLockedChoice || isLevelLocked ? 'locked' : 'ready';
      dim = isLockedChoice;
      canResearch = currentLevel === 2 && !researching && gold >= actualCost && resOk;
      btnLabel = researching ? 'Đang bận' : gold < actualCost ? 'Thiếu vàng' : !resOk ? 'Thiếu dầu/khoáng' : 'Chọn & Học';
    }

    return (
      <TechRow
        key={tech.id}
        badge={kind === 'linear' ? String(tech.level) : `3${tech.choice}`}
        name={tech.name}
        description={tech.description}
        state={state}
        dim={dim}
        showCost={state === 'ready'}
        gold={actualCost}
        goldOk={gold >= actualCost}
        oil={rc.oil}
        oilOk={oilStock >= rc.oil}
        minerals={rc.minerals}
        mineralOk={mineralStock >= rc.minerals}
        time={timeText(tech.researchTime)}
        learningSec={researching ? Math.ceil(researching.remainingTime) : 0}
        btnLabel={btnLabel}
        btnEnabled={canResearch}
        onClick={() => onStartResearch(tech)}
        infoOpen={openInfo === tech.id}
        onToggleInfo={() => toggleInfo(tech.id)}
      />
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Tiêu đề + tài nguyên */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-950/95">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">Công Nghệ</h3>
              {academySpeedMult > 1 && (
                <span className="px-2 py-0.5 rounded bg-cyan-500/25 border border-cyan-400 text-sm font-bold text-cyan-200">
                  ⚡ x{academySpeedMult}
                </span>
              )}
            </div>
            <p className="text-sm text-amber-200 font-mono break-words">
              💰 {gold.toLocaleString()}
              {(resOn || isSupremeTab) && (
                <span className="ml-2 text-sky-200">
                  🛢️ {formatResource(oilStock)} <span className="text-violet-200">⛏️ {formatResource(mineralStock)}</span>
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2 text-slate-100 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Đang nghiên cứu */}
        {researching && (
          <div className="px-4 py-2 bg-blue-950/60 border-b border-blue-700">
            <div className="flex items-center justify-between text-sm mb-1 gap-2">
              <div className="flex items-center gap-2 text-blue-100 min-w-0">
                <Clock className="w-4 h-4 text-blue-300 shrink-0" />
                <span className="break-words">{researchingTech?.name || '...'}</span>
              </div>
              <span className="font-mono font-bold text-white shrink-0">
                {Math.ceil(researching.remainingTime / Math.max(1, academySpeedMult))}s
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}

        {/* 4 tab nhánh */}
        <div className="grid grid-cols-4 gap-1.5 p-2 bg-slate-950 border-b border-slate-700">
          {BRANCHES.map(({ id, label, Icon, color }) => {
            const isSup = id === 'SUPREME';
            const isActive = id === activeTab;
            const subText = isSup
              ? playerNation.supremeTechUnlocked ? `${supremeTotalDone}/9` : '🔒'
              : `${getBranchLevel(id as TechBranch)}/3`;
            return (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setOpenInfo(null); }}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border transition-all min-h-[54px] active:scale-95 ${
                  isActive
                    ? isSup ? 'bg-cyan-950 border-cyan-400' : 'bg-slate-800 border-slate-400'
                    : 'bg-slate-900 border-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${color}`} />
                <span className={`text-sm font-bold leading-tight text-center ${isActive ? 'text-white' : 'text-slate-200'}`}>
                  {label}
                </span>
                <span className="text-sm font-mono text-slate-200">{subText}</span>
              </button>
            );
          })}
        </div>

        {/* Nội dung */}
        <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
          {isSupremeTab ? (
            !playerNation.supremeTechUnlocked ? (
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-700 text-center flex flex-col items-center gap-2">
                <Lock className="w-6 h-6 text-slate-200" />
                <h4 className="text-base font-black text-white">Đang khóa</h4>
                <p className="text-sm text-slate-200">Cần xây Đại Học Viện</p>
              </div>
            ) : (
              SUPREME_COLUMNS.map(({ key, label, Icon, color, border }) => {
                const colLvl = getSupremeBranchLevel(playerNation, key);
                const colTechs = SUPREME_TECH_CONFIG.TECHS
                  .filter((t) => t.branchKey === key)
                  .sort((a, b) => a.level - b.level);

                return (
                  <div key={key} className={`rounded-xl bg-slate-950/80 border ${border} p-2.5 space-y-2`}>
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className={`text-sm font-black ${color}`}>{label}</span>
                      </div>
                      <span className="text-sm font-mono text-slate-200">{colLvl}/3</span>
                    </div>

                    {colTechs.map((tech) => {
                      const isDone = colLvl >= tech.level;
                      const isLearning = researching?.techId === tech.id;
                      const isLocked = colLvl < tech.level - 1;
                      const check = canStartSupremeResearch(playerNation, tech.id, researching);
                      const state: RowState = isDone ? 'done' : isLearning ? 'learning' : isLocked ? 'locked' : 'ready';

                      return (
                        <TechRow
                          key={tech.id}
                          badge={String(tech.level)}
                          name={tech.name}
                          description={tech.description}
                          state={state}
                          showCost={state === 'ready'}
                          gold={tech.cost}
                          goldOk={gold >= tech.cost}
                          oil={tech.oilCost}
                          oilOk={oilStock >= tech.oilCost}
                          minerals={tech.mineralCost}
                          mineralOk={mineralStock >= tech.mineralCost}
                          time={timeText(tech.researchTime)}
                          learningSec={researching ? Math.ceil(researching.remainingTime / Math.max(1, academySpeedMult)) : 0}
                          btnLabel={check.ok ? 'Học' : 'Chưa đủ'}
                          btnEnabled={check.ok}
                          note={!check.ok && state === 'ready' ? check.reason : undefined}
                          onClick={() => onStartResearch(tech)}
                          infoOpen={openInfo === tech.id}
                          onToggleInfo={() => toggleInfo(tech.id)}
                        />
                      );
                    })}
                  </div>
                );
              })
            )
          ) : (
            <>
              {linearTechs.map((tech) => renderNormalRow(tech, 'linear'))}

              <div className="pt-1">
                <div className="flex items-center justify-between text-sm font-bold text-slate-100 mb-1.5 px-1">
                  <span>Cấp 3 · Chọn 1 trong 2</span>
                  {currentLevel === 3 && (
                    <span className="text-emerald-300 font-mono">Đã chọn {selectedChoice}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {level3Techs.map((tech) => renderNormalRow(tech, 'choice'))}
                </div>
                {currentLevel < 2 && (
                  <p className="text-sm text-slate-200 mt-1.5 px-1">Cần học xong cấp 2 trước.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
