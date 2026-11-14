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
      ? 'bg-emerald-950/25 border-emerald-500/40'
      : p.state === 'learning'
      ? 'bg-blue-950/35 border-blue-400/60'
      : p.state === 'locked'
      ? 'bg-slate-900/40 border-slate-800/60'
      : 'bg-slate-800/60 border-slate-700/70';

  return (
    <div className={`rounded-xl border p-2 ${bg} ${p.dim || p.state === 'locked' ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 min-w-[26px] h-[26px] px-1 rounded-full bg-slate-900 border border-slate-600 text-[11px] font-bold text-slate-200 flex items-center justify-center">
          {p.badge}
        </span>

        <div className="min-w-0 flex-1">
          <div className="font-bold text-white text-[13px] truncate">{p.name}</div>
          {p.showCost && (
            <div className="flex items-center flex-wrap gap-x-2 text-[10px] font-mono mt-0.5">
              <span className={p.goldOk ? 'text-amber-300' : 'text-red-400 font-bold'}>💰{short(p.gold || 0)}</span>
              {(p.oil || 0) > 0 && (
                <span className={p.oilOk ? 'text-sky-300' : 'text-red-400 font-bold'}>🛢️{short(p.oil || 0)}</span>
              )}
              {(p.minerals || 0) > 0 && (
                <span className={p.mineralOk ? 'text-violet-300' : 'text-red-400 font-bold'}>⛏️{short(p.minerals || 0)}</span>
              )}
              {p.time && <span className="text-slate-400">⏱️{p.time}</span>}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={p.onToggleInfo}
          aria-label="Xem thông tin"
          className={`w-6 h-6 rounded-full border text-[12px] font-black flex items-center justify-center shrink-0 active:scale-90 transition-all ${
            p.infoOpen
              ? 'bg-amber-400 text-slate-900 border-amber-300'
              : 'bg-slate-800 text-amber-300 border-slate-600'
          }`}
        >
          !
        </button>

        <div className="shrink-0 w-[76px] flex items-center justify-center">
          {p.state === 'done' && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
          {p.state === 'locked' && <Lock className="w-5 h-5 text-slate-500" />}
          {p.state === 'learning' && (
            <span className="text-[11px] font-mono font-bold text-blue-200 animate-pulse">⏳ {p.learningSec}s</span>
          )}
          {p.state === 'ready' && (
            <button
              disabled={!p.btnEnabled}
              onClick={p.onClick}
              className={`w-full min-h-[38px] rounded-lg font-black text-[11px] px-1 transition-all active:scale-95 ${
                p.btnEnabled
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                  : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
              }`}
            >
              {p.btnLabel}
            </button>
          )}
        </div>
      </div>

      {p.infoOpen && (
        <div className="mt-2 p-2 rounded-lg bg-slate-950/80 border border-slate-700 text-[11px] text-slate-300 leading-relaxed">
          {p.description}
          {p.note && <div className="mt-1 text-amber-300 font-bold">{p.note}</div>}
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
  const timeText = (t: number) => (academySpeedMult > 1 ? `${Math.ceil(t / academySpeedMult)}s` : `${t}s`);

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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Tiêu đề + tài nguyên */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-950/50">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">Công Nghệ</h3>
              {academySpeedMult > 1 && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-[10px] font-bold text-cyan-300">
                  ⚡ x{academySpeedMult}
                </span>
              )}
            </div>
            <p className="text-[11px] text-amber-300 font-mono truncate">
              💰 {gold.toLocaleString()}
              {(resOn || isSupremeTab) && (
                <span className="ml-2 text-sky-300">
                  🛢️ {formatResource(oilStock)} <span className="text-violet-300">⛏️ {formatResource(mineralStock)}</span>
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg active:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Đang nghiên cứu */}
        {researching && (
          <div className="px-4 py-2 bg-blue-950/40 border-b border-blue-900/40">
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-2 text-blue-300 min-w-0">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">{researchingTech?.name || '...'}</span>
              </div>
              <span className="font-mono font-bold text-blue-200 shrink-0">
                {Math.ceil(researching.remainingTime / Math.max(1, academySpeedMult))}s
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}

        {/* 4 tab nhánh */}
        <div className="grid grid-cols-4 gap-1.5 p-2 bg-slate-950/40 border-b border-slate-800">
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
                className={`flex flex-col items-center py-1.5 px-1 rounded-xl border transition-all min-h-[48px] active:scale-95 ${
                  isActive
                    ? isSup ? 'bg-cyan-950/60 border-cyan-500/60' : 'bg-slate-800 border-slate-600'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${color}`} />
                <span className={`text-[11px] font-bold truncate max-w-full ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {label}
                </span>
                <span className="text-[10px] font-mono text-slate-500">{subText}</span>
              </button>
            );
          })}
        </div>

        {/* Nội dung */}
        <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
          {isSupremeTab ? (
            !playerNation.supremeTechUnlocked ? (
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center opacity-80 flex flex-col items-center gap-2">
                <Lock className="w-6 h-6 text-slate-400" />
                <h4 className="text-sm font-black text-slate-200">Đang khóa</h4>
                <p className="text-xs text-slate-400">Cần xây Đại Học Viện</p>
              </div>
            ) : (
              SUPREME_COLUMNS.map(({ key, label, Icon, color, border }) => {
                const colLvl = getSupremeBranchLevel(playerNation, key);
                const colTechs = SUPREME_TECH_CONFIG.TECHS
                  .filter((t) => t.branchKey === key)
                  .sort((a, b) => a.level - b.level);

                return (
                  <div key={key} className={`rounded-xl bg-slate-950/50 border ${border} p-2 space-y-1.5`}>
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className={`text-xs font-black ${color}`}>{label}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{colLvl}/3</span>
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
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1.5 px-1">
                  <span>Cấp 3 · Chọn 1 trong 2</span>
                  {currentLevel === 3 && (
                    <span className="text-emerald-400 font-mono">Đã chọn {selectedChoice}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {level3Techs.map((tech) => renderNormalRow(tech, 'choice'))}
                </div>
                {currentLevel < 2 && (
                  <p className="text-[11px] text-slate-500 mt-1.5 px-1">Cần học xong cấp 2 trước.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
