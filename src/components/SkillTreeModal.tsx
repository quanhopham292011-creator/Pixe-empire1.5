import React, { useState } from 'react';
import { PlayerProfile } from '../types';
import {
  ECONOMY_BRANCH,
  MILITARY_BRANCH,
  HERO_BRANCH,
  HYBRID_NODES,
  RESET_SKILL_TREE_COIN_COST,
  SkillNodeInfo,
  HybridNodeInfo,
} from '../utils/skillTreeConfig';
import {
  upgradeSkillBranchNode,
  upgradeHybridMastery,
  resetSkillTreeProfile,
} from '../utils/progression';
import {
  X,
  Star,
  Coins,
  Gem,
  Lock,
  Check,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';

interface SkillTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerProfile: PlayerProfile;
  currentGold?: number;
  onDeductGold?: (amount: number) => void;
  onUpdateProfile: (profile: PlayerProfile) => void;
}

type TabType = 'ECONOMY' | 'MILITARY' | 'HERO';

/* =========================================================================
   PIXEL ART SVG ICONS (Crisp 16x16 / 20x20 2D pixel sprites)
   ========================================================================= */

const PixelIconCoin: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    style={{ shapeRendering: 'crispEdges' }}
    className="shrink-0 inline-block"
  >
    <rect x="5" y="1" width="6" height="1" fill="#78350f" />
    <rect x="3" y="2" width="2" height="1" fill="#78350f" />
    <rect x="11" y="2" width="2" height="1" fill="#78350f" />
    <rect x="2" y="3" width="1" height="2" fill="#78350f" />
    <rect x="13" y="3" width="1" height="2" fill="#78350f" />
    <rect x="1" y="5" width="1" height="6" fill="#78350f" />
    <rect x="14" y="5" width="1" height="6" fill="#78350f" />
    <rect x="2" y="11" width="1" height="2" fill="#78350f" />
    <rect x="13" y="11" width="1" height="2" fill="#78350f" />
    <rect x="3" y="13" width="2" height="1" fill="#78350f" />
    <rect x="11" y="13" width="2" height="1" fill="#78350f" />
    <rect x="5" y="14" width="6" height="1" fill="#78350f" />
    {/* Body Gold */}
    <rect x="5" y="2" width="6" height="1" fill="#fde047" />
    <rect x="3" y="3" width="10" height="2" fill="#facc15" />
    <rect x="2" y="5" width="12" height="6" fill="#eab308" />
    <rect x="3" y="11" width="10" height="2" fill="#ca8a04" />
    <rect x="5" y="13" width="6" height="1" fill="#a16207" />
    {/* Inner symbol */}
    <rect x="7" y="5" width="2" height="6" fill="#fef08a" />
    <rect x="6" y="6" width="4" height="1" fill="#fef08a" />
    <rect x="6" y="9" width="4" height="1" fill="#fef08a" />
  </svg>
);

const PixelIconGem: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    style={{ shapeRendering: 'crispEdges' }}
    className="shrink-0 inline-block"
  >
    <rect x="5" y="2" width="6" height="1" fill="#083344" />
    <rect x="3" y="3" width="2" height="1" fill="#083344" />
    <rect x="11" y="3" width="2" height="1" fill="#083344" />
    <rect x="2" y="4" width="1" height="2" fill="#083344" />
    <rect x="13" y="4" width="1" height="2" fill="#083344" />
    <rect x="1" y="6" width="1" height="2" fill="#083344" />
    <rect x="14" y="6" width="1" height="2" fill="#083344" />
    <rect x="2" y="8" width="2" height="2" fill="#083344" />
    <rect x="12" y="8" width="2" height="2" fill="#083344" />
    <rect x="4" y="10" width="2" height="2" fill="#083344" />
    <rect x="10" y="10" width="2" height="2" fill="#083344" />
    <rect x="6" y="12" width="1" height="2" fill="#083344" />
    <rect x="9" y="12" width="1" height="2" fill="#083344" />
    <rect x="7" y="14" width="2" height="1" fill="#083344" />
    {/* Inner Cyan Facets */}
    <rect x="5" y="3" width="6" height="3" fill="#67e8f9" />
    <rect x="3" y="4" width="2" height="2" fill="#a5f3fc" />
    <rect x="11" y="4" width="2" height="2" fill="#22d3ee" />
    <rect x="2" y="6" width="12" height="2" fill="#06b6d4" />
    <rect x="4" y="8" width="8" height="2" fill="#0891b2" />
    <rect x="6" y="10" width="4" height="2" fill="#0e7490" />
    <rect x="7" y="12" width="2" height="2" fill="#155e75" />
    {/* Highlight shine */}
    <rect x="5" y="4" width="2" height="2" fill="#ffffff" />
  </svg>
);

const PixelIconStar: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    style={{ shapeRendering: 'crispEdges' }}
    className="shrink-0 inline-block"
  >
    <rect x="7" y="1" width="2" height="3" fill="#713f12" />
    <rect x="6" y="4" width="4" height="2" fill="#713f12" />
    <rect x="1" y="5" width="14" height="2" fill="#713f12" />
    <rect x="3" y="7" width="10" height="2" fill="#713f12" />
    <rect x="4" y="9" width="8" height="2" fill="#713f12" />
    <rect x="2" y="11" width="4" height="3" fill="#713f12" />
    <rect x="10" y="11" width="4" height="3" fill="#713f12" />
    {/* Fill */}
    <rect x="7" y="2" width="2" height="3" fill="#fef08a" />
    <rect x="6" y="5" width="4" height="2" fill="#facc15" />
    <rect x="2" y="6" width="12" height="1" fill="#fde047" />
    <rect x="4" y="7" width="8" height="2" fill="#eab308" />
    <rect x="5" y="9" width="6" height="2" fill="#ca8a04" />
    <rect x="3" y="11" width="3" height="2" fill="#eab308" />
    <rect x="10" y="11" width="3" height="2" fill="#ca8a04" />
  </svg>
);

/* Pixel icons for nodes based on level and branch */
const PixelNodeIcon: React.FC<{
  branch: 'ECONOMY' | 'MILITARY' | 'HERO';
  level: number;
  isSpecialMilestone?: boolean;
  status: 'unlocked' | 'available' | 'locked';
}> = ({ branch, level, isSpecialMilestone, status }) => {
  const isSpecial = isSpecialMilestone || level === 5 || level === 10;
  const isUnlocked = status === 'unlocked';
  const isAvailable = status === 'available';

  // Base background & border color per branch
  let borderCol = '#334155';
  let bgCol = '#0f172a';

  if (isUnlocked) {
    if (branch === 'ECONOMY') {
      borderCol = '#eab308';
      bgCol = '#713f12';
    } else if (branch === 'MILITARY') {
      borderCol = '#38bdf8';
      bgCol = '#0c4a6e';
    } else {
      borderCol = '#f43f5e';
      bgCol = '#881337';
    }
  } else if (isAvailable) {
    borderCol = '#f59e0b';
    bgCol = '#1e293b';
  }

  // Draw 20x20 pixel sprites
  return (
    <div
      className="relative shrink-0 flex items-center justify-center"
      style={{
        width: isSpecial ? '38px' : '34px',
        height: isSpecial ? '38px' : '34px',
        backgroundColor: bgCol,
        border: `2px solid ${borderCol}`,
        boxShadow: isSpecial && isUnlocked
          ? `inset 0 0 0 1px ${borderCol}, 0 2px 0 0 #000000`
          : '0 2px 0 0 #000000',
        imageRendering: 'pixelated',
      }}
    >
      {/* 2D Pixel SVG Graphics */}
      <svg
        width={isSpecial ? 24 : 20}
        height={isSpecial ? 24 : 20}
        viewBox="0 0 16 16"
        style={{ shapeRendering: 'crispEdges' }}
      >
        {branch === 'ECONOMY' && (
          <>
            {level === 10 ? (
              // Vương miện vàng tối thượng Cấp 10
              <>
                <rect x="2" y="11" width="12" height="2" fill="#ca8a04" />
                <rect x="3" y="11" width="10" height="1" fill="#facc15" />
                <rect x="2" y="6" width="2" height="5" fill="#facc15" />
                <rect x="7" y="4" width="2" height="7" fill="#fef08a" />
                <rect x="12" y="6" width="2" height="5" fill="#eab308" />
                <rect x="4" y="9" width="3" height="2" fill="#eab308" />
                <rect x="9" y="9" width="3" height="2" fill="#ca8a04" />
                {/* Gems on crown */}
                <rect x="2" y="5" width="2" height="1" fill="#ef4444" />
                <rect x="7" y="3" width="2" height="1" fill="#38bdf8" />
                <rect x="12" y="5" width="2" height="1" fill="#ef4444" />
              </>
            ) : level === 5 ? (
              // Rương kho báu vàng Cấp 5
              <>
                <rect x="3" y="4" width="10" height="2" fill="#ca8a04" />
                <rect x="2" y="6" width="12" height="2" fill="#a16207" />
                <rect x="3" y="8" width="10" height="5" fill="#eab308" />
                <rect x="7" y="7" width="2" height="3" fill="#fef08a" />
                <rect x="2" y="7" width="1" height="6" fill="#713f12" />
                <rect x="13" y="7" width="1" height="6" fill="#713f12" />
                <rect x="3" y="13" width="10" height="1" fill="#713f12" />
              </>
            ) : level % 2 === 1 ? (
              // Túi vàng / Thỏi vàng pixel
              <>
                <rect x="6" y="3" width="4" height="2" fill="#ca8a04" />
                <rect x="5" y="5" width="6" height="1" fill="#854d0e" />
                <rect x="4" y="6" width="8" height="6" fill="#facc15" />
                <rect x="5" y="7" width="6" height="4" fill="#fde047" />
                <rect x="7" y="8" width="2" height="2" fill="#ca8a04" />
                <rect x="4" y="12" width="8" height="1" fill="#a16207" />
              </>
            ) : (
              // Đô thị / Tòa thị chính pixel
              <>
                <rect x="3" y="5" width="10" height="9" fill="#eab308" />
                <rect x="5" y="2" width="6" height="3" fill="#ca8a04" />
                <rect x="7" y="1" width="2" height="1" fill="#facc15" />
                <rect x="5" y="7" width="2" height="2" fill="#713f12" />
                <rect x="9" y="7" width="2" height="2" fill="#713f12" />
                <rect x="7" y="11" width="2" height="3" fill="#713f12" />
              </>
            )}
          </>
        )}

        {branch === 'MILITARY' && (
          <>
            {level === 10 ? (
              // Khiên Hoàng Gia Bất Bại Cấp 10
              <>
                <rect x="3" y="2" width="10" height="3" fill="#0284c7" />
                <rect x="2" y="4" width="12" height="6" fill="#38bdf8" />
                <rect x="3" y="10" width="10" height="2" fill="#0369a1" />
                <rect x="5" y="12" width="6" height="2" fill="#075985" />
                <rect x="7" y="14" width="2" height="1" fill="#0c4a6e" />
                {/* Thanh kiếm vàng khắc chìm */}
                <rect x="7" y="4" width="2" height="7" fill="#facc15" />
                <rect x="5" y="6" width="6" height="1" fill="#facc15" />
              </>
            ) : level === 5 ? (
              // Kiếm đao chém xuyên phá Cấp 5
              <>
                <rect x="11" y="2" width="2" height="2" fill="#f8fafc" />
                <rect x="9" y="4" width="3" height="3" fill="#cbd5e1" />
                <rect x="7" y="6" width="3" height="3" fill="#94a3b8" />
                <rect x="5" y="8" width="3" height="3" fill="#64748b" />
                <rect x="3" y="10" width="4" height="2" fill="#38bdf8" />
                <rect x="2" y="12" width="2" height="2" fill="#0284c7" />
              </>
            ) : level % 2 === 1 ? (
              // Doanh trại / Khiên bộ binh
              <>
                <rect x="4" y="3" width="8" height="2" fill="#38bdf8" />
                <rect x="3" y="5" width="10" height="5" fill="#0284c7" />
                <rect x="4" y="10" width="8" height="3" fill="#0369a1" />
                <rect x="6" y="13" width="4" height="1" fill="#075985" />
                <rect x="7" y="6" width="2" height="4" fill="#e0f2fe" />
              </>
            ) : (
              // Mũ thiết giáp / Nỏ tiễn
              <>
                <rect x="5" y="3" width="6" height="3" fill="#94a3b8" />
                <rect x="3" y="6" width="10" height="5" fill="#64748b" />
                <rect x="5" y="7" width="2" height="2" fill="#0f172a" />
                <rect x="9" y="7" width="2" height="2" fill="#0f172a" />
                <rect x="4" y="11" width="8" height="2" fill="#334155" />
              </>
            )}
          </>
        )}

        {branch === 'HERO' && (
          <>
            {level === 10 ? (
              // Lửa thần bất tử Cấp 10
              <>
                <rect x="7" y="1" width="2" height="2" fill="#fde047" />
                <rect x="5" y="3" width="6" height="3" fill="#fb923c" />
                <rect x="4" y="6" width="8" height="3" fill="#f43f5e" />
                <rect x="3" y="9" width="10" height="3" fill="#e11d48" />
                <rect x="5" y="12" width="6" height="2" fill="#9f1239" />
                <rect x="7" y="14" width="2" height="1" fill="#4c0519" />
                <rect x="6" y="6" width="4" height="4" fill="#fef08a" />
              </>
            ) : level === 5 ? (
              // Mũ Tướng Lông Vũ Cấp 5
              <>
                <rect x="7" y="1" width="2" height="3" fill="#f8fafc" />
                <rect x="5" y="3" width="6" height="2" fill="#f43f5e" />
                <rect x="4" y="5" width="8" height="5" fill="#be123c" />
                <rect x="6" y="6" width="1" height="2" fill="#1e293b" />
                <rect x="9" y="6" width="1" height="2" fill="#1e293b" />
                <rect x="5" y="10" width="6" height="2" fill="#facc15" />
              </>
            ) : level % 2 === 1 ? (
              // Huy hiệu danh tướng
              <>
                <rect x="6" y="2" width="4" height="2" fill="#facc15" />
                <rect x="4" y="4" width="8" height="6" fill="#f43f5e" />
                <rect x="5" y="5" width="6" height="4" fill="#fb7185" />
                <rect x="7" y="6" width="2" height="2" fill="#fef08a" />
                <rect x="5" y="10" width="6" height="3" fill="#be123c" />
                <rect x="7" y="13" width="2" height="1" fill="#881337" />
              </>
            ) : (
              // Kèn lệnh / Trượng chỉ huy
              <>
                <rect x="11" y="3" width="3" height="4" fill="#fbbf24" />
                <rect x="8" y="5" width="3" height="2" fill="#f59e0b" />
                <rect x="4" y="6" width="4" height="2" fill="#d97706" />
                <rect x="2" y="7" width="2" height="2" fill="#b45309" />
                <rect x="5" y="8" width="2" height="4" fill="#f43f5e" />
              </>
            )}
          </>
        )}
      </svg>
      {/* Corner badge for level */}
      <span
        className="absolute -bottom-1 -right-1 font-mono font-bold leading-none px-0.5 text-[8px]"
        style={{
          backgroundColor: '#020617',
          color: isUnlocked ? '#f8fafc' : isAvailable ? '#fbbf24' : '#64748b',
          border: '1px solid #1e293b',
        }}
      >
        {level}
      </span>
    </div>
  );
};

/* =========================================================================
   SKILL TREE MODAL COMPONENT (Pixel Art Fantasy Style)
   ========================================================================= */

export const SkillTreeModal: React.FC<SkillTreeModalProps> = ({
  isOpen,
  onClose,
  playerProfile,
  currentGold,
  onDeductGold,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ECONOMY');
  const [selectedNode, setSelectedNode] = useState<{
    type: 'BRANCH';
    branch: 'ECONOMY' | 'MILITARY' | 'HERO';
    node: SkillNodeInfo;
  } | {
    type: 'HYBRID';
    node: HybridNodeInfo;
  } | null>(null);

  const [confirmHybrid, setConfirmHybrid] = useState<HybridNodeInfo | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const { economyLevel, militaryLevel, heroLevel, chosenHybrid } = playerProfile.skillTree;

  // Lấy dữ liệu nhánh hiện tại
  const currentBranchData =
    activeTab === 'ECONOMY'
      ? ECONOMY_BRANCH
      : activeTab === 'MILITARY'
      ? MILITARY_BRANCH
      : HERO_BRANCH;

  const currentLevel =
    activeTab === 'ECONOMY'
      ? economyLevel
      : activeTab === 'MILITARY'
      ? militaryLevel
      : heroLevel;

  // Nâng cấp kỹ năng nhánh
  const handleUpgradeBranch = (branch: 'ECONOMY' | 'MILITARY' | 'HERO', node: SkillNodeInfo) => {
    const curLvl =
      branch === 'ECONOMY' ? economyLevel : branch === 'MILITARY' ? militaryLevel : heroLevel;

    if (node.level !== curLvl + 1) {
      showToast('⚠️ Bạn phải nâng các cấp trước theo thứ tự!');
      return;
    }

    const res = upgradeSkillBranchNode(playerProfile, branch, {
      coins: node.coinCost,
    });

    if (res.success) {
      onUpdateProfile(res.updatedProfile);
      showToast(`🎉 ${res.message}`);
      // Tự động chuyển selected node sang nấc tiếp theo
      const branchList =
        branch === 'ECONOMY'
          ? ECONOMY_BRANCH
          : branch === 'MILITARY'
          ? MILITARY_BRANCH
          : HERO_BRANCH;
      const nextNode = branchList.find((n) => n.level === curLvl + 2);
      if (nextNode) {
        setSelectedNode({ type: 'BRANCH', branch, node: nextNode });
      } else {
        setSelectedNode({ type: 'BRANCH', branch, node });
      }
    } else {
      showToast(`❌ ${res.message}`);
    }
  };

  // Nâng cấp mốc kết hợp
  const handleUpgradeHybrid = (hybrid: HybridNodeInfo) => {
    const res = upgradeHybridMastery(playerProfile, hybrid.id, {
      skillPointCost: hybrid.skillPointCost,
      coinCost: hybrid.coinCost,
    });

    if (res.success) {
      onUpdateProfile(res.updatedProfile);
      showToast(`🌟 ${res.message}`);
      setConfirmHybrid(null);
    } else {
      showToast(`❌ ${res.message}`);
    }
  };

  // Tẩy điểm (Reset)
  const handleReset = () => {
    const res = resetSkillTreeProfile(playerProfile, RESET_SKILL_TREE_COIN_COST);
    if (res.success) {
      onUpdateProfile(res.updatedProfile);
      showToast(`🔄 ${res.message}`);
      setConfirmReset(false);
      setSelectedNode(null);
    } else {
      showToast(`❌ ${res.message}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3 bg-black/85 select-none overflow-hidden"
      style={{
        imageRendering: 'pixelated',
      }}
    >
      {/* KHUNG CỬA SỔ PIXEL PHONG CÁCH FANTASY 2D */}
      <div
        className="w-full max-w-2xl h-[98vh] max-h-[820px] flex flex-col bg-[#0b0f19] text-[#e2e8f0] relative"
        style={{
          border: '4px solid #334155',
          boxShadow: 'inset 0 0 0 2px #0f172a, 0 8px 0 0 #000000',
        }}
      >
        {/* 1. THANH TIÊU ĐỀ TRÊN CÙNG (PIXEL ART HEADER) */}
        <div
          className="shrink-0 flex items-center justify-between px-3 py-2 bg-[#161f30] border-b-2 border-[#1e293b]"
          style={{
            boxShadow: 'inset 0 1px 0 0 #334155',
          }}
        >
          {/* Logo & Tên cửa sổ */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 flex items-center justify-center bg-[#090d16] border border-[#3b82f6] shrink-0"
              style={{ boxShadow: 'inset 0 0 0 1px #1d4ed8' }}
            >
              <PixelIconStar size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs sm:text-sm font-black text-[#f8fafc] tracking-wider uppercase">
                  CÂY KỸ NĂNG ĐẾ CHẾ
                </span>
                <span
                  className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-[#020617] text-[#93c5fd] border border-[#1e3a8a]"
                >
                  Lv.{playerProfile.level}
                </span>
              </div>
              <div className="text-[10px] text-[#94a3b8] font-mono truncate">
                3 Nhánh: Kinh Tế • Quân Đội • Anh Hùng
              </div>
            </div>
          </div>

          {/* Cụm Tài nguyên & Đóng */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Điểm Kỹ Năng */}
            <div
              className="flex items-center gap-1 px-2 py-1 bg-[#1e1b12] border border-[#ca8a04]"
              title="Điểm kỹ năng khả dụng"
            >
              <PixelIconStar size={14} />
              <span className="font-mono text-xs font-black text-[#fef08a]">
                {playerProfile.skillPoints}
              </span>
              <span className="text-[9px] font-mono text-[#facc15] hidden xs:inline">Điểm</span>
            </div>

            {/* Xu Pixel */}
            <div
              className="flex items-center gap-1 px-2 py-1 bg-[#0f172a] border border-[#475569]"
              title="Xu Pixel"
            >
              <PixelIconGem size={14} />
              <span className="font-mono text-xs font-bold text-[#67e8f9]">
                {playerProfile.pixelCoins}
              </span>
            </div>

            {/* Nút Reset Tẩy Điểm */}
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1 px-2 py-1 bg-[#3f0f1b] hover:bg-[#5b1527] active:translate-y-0.5 border border-[#be123c] text-[#fecdd3] text-[10px] font-mono font-bold transition-transform"
              title="Tẩy điểm cây kỹ năng (15 Xu Pixel)"
            >
              <RotateCcw className="w-3 h-3 text-[#fb7185]" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Nút Đóng */}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center bg-[#1e293b] hover:bg-[#334155] active:translate-y-0.5 border border-[#475569] text-[#cbd5e1] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TOAST THÔNG BÁO */}
        {toastMessage && (
          <div
            className="absolute top-12 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 bg-[#090d16] border-2 border-[#f59e0b] text-[#fef08a] font-mono text-xs font-bold shadow-lg flex items-center gap-2"
            style={{ boxShadow: '0 4px 0 0 #000000' }}
          >
            <Zap className="w-3.5 h-3.5 text-[#facc15]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 2. THANH CHUYỂN 3 TAB (KINH TẾ - QUÂN ĐỘI - ANH HÙNG) */}
        <div className="shrink-0 grid grid-cols-3 gap-1 p-1.5 bg-[#080c14] border-b-2 border-[#1e293b]">
          {/* TAB KINH TẾ (MÀU VÀNG) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('ECONOMY');
              setSelectedNode(null);
            }}
            className={`py-2 px-1 text-center font-mono transition-transform border ${
              activeTab === 'ECONOMY'
                ? 'bg-[#291b07] border-[#eab308] text-[#fef08a] font-black shadow-sm'
                : 'bg-[#0f172a] border-[#1e293b] text-[#94a3b8] hover:text-[#cbd5e1]'
            }`}
            style={{
              boxShadow: activeTab === 'ECONOMY' ? 'inset 0 -2px 0 0 #ca8a04' : undefined,
            }}
          >
            <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs uppercase">
              <span className="text-sm">🪙</span>
              <span>Kinh Tế</span>
            </div>
            <div className="text-[10px] text-[#ca8a04] font-bold">
              Cấp {economyLevel}/10
            </div>
          </button>

          {/* TAB QUÂN ĐỘI (MÀU XANH DƯƠNG) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('MILITARY');
              setSelectedNode(null);
            }}
            className={`py-2 px-1 text-center font-mono transition-transform border ${
              activeTab === 'MILITARY'
                ? 'bg-[#08203e] border-[#38bdf8] text-[#e0f2fe] font-black shadow-sm'
                : 'bg-[#0f172a] border-[#1e293b] text-[#94a3b8] hover:text-[#cbd5e1]'
            }`}
            style={{
              boxShadow: activeTab === 'MILITARY' ? 'inset 0 -2px 0 0 #0284c7' : undefined,
            }}
          >
            <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs uppercase">
              <span className="text-sm">🛡️</span>
              <span>Quân Đội</span>
            </div>
            <div className="text-[10px] text-[#38bdf8] font-bold">
              Cấp {militaryLevel}/10
            </div>
          </button>

          {/* TAB ANH HÙNG (MÀU ĐỎ) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('HERO');
              setSelectedNode(null);
            }}
            className={`py-2 px-1 text-center font-mono transition-transform border ${
              activeTab === 'HERO'
                ? 'bg-[#3b0b18] border-[#f43f5e] text-[#ffe4e6] font-black shadow-sm'
                : 'bg-[#0f172a] border-[#1e293b] text-[#94a3b8] hover:text-[#cbd5e1]'
            }`}
            style={{
              boxShadow: activeTab === 'HERO' ? 'inset 0 -2px 0 0 #be123c' : undefined,
            }}
          >
            <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs uppercase">
              <span className="text-sm">⚔️</span>
              <span>Anh Hùng</span>
            </div>
            <div className="text-[10px] text-[#f43f5e] font-bold">
              Cấp {heroLevel}/10
            </div>
          </button>
        </div>

        {/* 3. THÂN CHÍNH: DANH SÁCH CÂY DỌC 10 CẤP & KHU VỰC KẾT HỢP */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-3 min-h-0 space-y-3 bg-[#0a0e17]">
          {/* BANNER MỐC KẾT HỢP (HIỂN THỊ LIÊN QUAN ĐẾN TAB HIỆN TẠI) */}
          <div className="p-2 bg-[#0d1424] border-2 border-[#1e293b]">
            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#1e293b]">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">✨</span>
                <span className="font-mono text-[11px] font-bold text-[#facc15] uppercase">
                  MỐC KẾT HỢP ĐỘC BẢN
                </span>
                <span className="text-[9px] font-mono text-[#94a3b8] hidden sm:inline">
                  (Chọn 1 duy nhất khi 2 nhánh ≥ Cấp 5)
                </span>
              </div>
              {chosenHybrid && (
                <span className="text-[9px] font-mono bg-[#064e3b] text-[#6ee7b7] border border-[#059669] px-1.5 py-0.2 font-bold">
                  ĐÃ CHỌN 1/1
                </span>
              )}
            </div>

            {/* Danh sách 3 mốc kết hợp dạng thẻ pixel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {HYBRID_NODES.map((h) => {
                const isSelected = chosenHybrid === h.id;
                const isLockedOther = chosenHybrid !== null && !isSelected;
                const isEligible =
                  h.id === 'ECONOMY_MILITARY'
                    ? economyLevel >= 5 && militaryLevel >= 5
                    : h.id === 'ECONOMY_HERO'
                    ? economyLevel >= 5 && heroLevel >= 5
                    : militaryLevel >= 5 && heroLevel >= 5;

                const isRelatedToCurrentTab =
                  h.branch1 === activeTab || h.branch2 === activeTab;

                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => {
                      setSelectedNode({ type: 'HYBRID', node: h });
                    }}
                    disabled={isLockedOther}
                    className={`p-2 text-left font-mono border transition-all relative ${
                      isSelected
                        ? 'bg-[#1e1b4b] border-[#a855f7] text-[#f5d0fe]'
                        : isLockedOther
                        ? 'bg-[#090d16] border-[#1e293b] text-[#475569] opacity-40 cursor-not-allowed'
                        : isEligible
                        ? 'bg-[#18181b] border-[#eab308] text-[#fef08a] hover:bg-[#27272a]'
                        : 'bg-[#090d16] border-[#1e293b] text-[#94a3b8] hover:border-[#334155]'
                    } ${isRelatedToCurrentTab ? 'ring-1 ring-[#38bdf8]/40' : ''}`}
                    style={{
                      boxShadow: isSelected ? '0 2px 0 0 #581c87' : '0 2px 0 0 #000000',
                    }}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[9px] font-black uppercase text-[#facc15] truncate">
                        {h.title}
                      </span>
                      {isSelected ? (
                        <span className="text-[8px] bg-[#065f46] text-[#34d399] px-1 font-bold">
                          ĐÃ BẬT
                        </span>
                      ) : isLockedOther ? (
                        <span className="text-[8px] bg-[#1e293b] text-[#64748b] px-1">
                          KHÓA
                        </span>
                      ) : isEligible ? (
                        <span className="text-[8px] bg-[#78350f] text-[#fde047] px-1 font-bold">
                          MỞ ĐƯỢC
                        </span>
                      ) : (
                        <span className="text-[8px] text-[#64748b]">Cần Lv5</span>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-white truncate leading-tight">
                      {h.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TIÊU ĐỀ NHÁNH KỸ NĂNG DỌC */}
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[11px] font-bold text-[#cbd5e1] uppercase">
              TIẾN TRÌNH KỸ NĂNG (CẤP 1 → 10)
            </span>
            <span className="font-mono text-[10px] text-[#94a3b8]">
              Cần mở tuần tự từng cấp
            </span>
          </div>

          {/* DANH SÁCH DỌC 10 NÚT CÓ DÂY KẾT NỐI RÕ RÀNG */}
          <div className="flex flex-col space-y-0">
            {currentBranchData.map((node, index) => {
              const isUnlocked = currentLevel >= node.level;
              const isAvailable = currentLevel === node.level - 1;
              const isLocked = currentLevel < node.level - 1;
              const isSelected =
                selectedNode?.type === 'BRANCH' &&
                selectedNode.branch === activeTab &&
                selectedNode.node.level === node.level;

              const isSpecial = node.isSpecialMilestone || node.level === 5 || node.level === 10;

              return (
                <div key={node.level} className="flex flex-col items-center">
                  {/* ĐƯỜNG NỐI PIXEL GIỮA CÁC CẤP (Ngoại trừ cấp đầu tiên) */}
                  {index > 0 && (
                    <div
                      className="w-1.5 h-3 my-0.5 transition-colors"
                      style={{
                        backgroundColor: currentLevel >= node.level ? '#eab308' : '#1e293b',
                        boxShadow: '0 0 0 1px #090d16',
                      }}
                    />
                  )}

                  {/* THẺ NÚT KỸ NĂNG */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNode({ type: 'BRANCH', branch: activeTab, node });
                    }}
                    className={`w-full p-2 font-mono text-left transition-all relative flex items-center justify-between gap-2 border ${
                      isSelected
                        ? 'ring-2 ring-[#fde047] z-10'
                        : ''
                    } ${
                      isUnlocked
                        ? activeTab === 'ECONOMY'
                          ? 'bg-[#1c1917] border-[#ca8a04] text-[#fef08a]'
                          : activeTab === 'MILITARY'
                          ? 'bg-[#0f172a] border-[#0284c7] text-[#e0f2fe]'
                          : 'bg-[#1f0f16] border-[#be123c] text-[#ffe4e6]'
                        : isAvailable
                        ? 'bg-[#18181b] border-[#f59e0b] text-[#ffffff] hover:bg-[#27272a]'
                        : 'bg-[#090d16] border-[#1e293b] text-[#64748b] opacity-60'
                    }`}
                    style={{
                      boxShadow: isSpecial
                        ? 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 2px 0 0 #000000'
                        : '0 2px 0 0 #000000',
                    }}
                  >
                    {/* Icon Pixel + Tên + Mô tả */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <PixelNodeIcon
                        branch={activeTab}
                        level={node.level}
                        isSpecialMilestone={node.isSpecialMilestone}
                        status={isUnlocked ? 'unlocked' : isAvailable ? 'available' : 'locked'}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-white">
                            Cấp {node.level}: {node.name}
                          </span>
                          {node.level === 5 && (
                            <span className="text-[9px] font-mono px-1 bg-[#854d0e] text-[#fef08a] border border-[#ca8a04]">
                              ⭐ MỐC CẤP 5
                            </span>
                          )}
                          {node.level === 10 && (
                            <span className="text-[9px] font-mono px-1 bg-[#991b1b] text-[#fef08a] border border-[#ef4444]">
                              👑 TỐI THƯỢNG
                            </span>
                          )}
                        </div>

                        {/* Mô tả ngắn - chữ rõ ràng, không bị cắt */}
                        <div className="text-[11px] text-[#cbd5e1] leading-tight mt-0.5 break-words">
                          {node.shortDesc}
                        </div>
                      </div>
                    </div>

                    {/* Trạng thái mở khóa & giá */}
                    <div className="shrink-0 text-right flex flex-col items-end">
                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#4ade80] bg-[#052e16] px-1.5 py-0.5 border border-[#166534]">
                          <Check className="w-3 h-3" /> ĐÃ MỞ
                        </span>
                      ) : isAvailable ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#fde047] bg-[#78350f] px-1.5 py-0.5 border border-[#ca8a04]">
                            NÂNG ĐƯỢC
                          </span>
                          <span className="text-[9px] text-[#cbd5e1] font-mono">
                            1⭐ • {node.coinCost}💎
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#64748b] bg-[#020617] px-1.5 py-0.5 border border-[#1e293b]">
                          <Lock className="w-2.5 h-2.5" /> KHÓA
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. KHUNG MÔ TẢ NHỎ GỌN (BOTTOM DRAWER / PANEL) */}
        {selectedNode && (
          <div
            className="shrink-0 bg-[#090d16] border-t-4 border-[#334155] p-2.5 sm:p-3 relative"
            style={{
              boxShadow: '0 -4px 0 0 #000000',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {selectedNode.type === 'BRANCH' ? (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-[#1e293b] text-[#f8fafc] border border-[#475569]">
                        {selectedNode.branch === 'ECONOMY'
                          ? 'Kinh Tế'
                          : selectedNode.branch === 'MILITARY'
                          ? 'Quân Đội'
                          : 'Anh Hùng'}{' '}
                        • Cấp {selectedNode.node.level}/10
                      </span>
                      {selectedNode.node.isSpecialMilestone && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-[#854d0e] text-[#fef08a] border border-[#ca8a04]">
                          ⭐ Mốc Đặc Quyền
                        </span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-[#ffffff] font-mono">
                      {selectedNode.node.name}
                    </div>
                    <p className="text-[11px] text-[#cbd5e1] leading-relaxed mt-1 font-mono break-words">
                      {selectedNode.node.fullDesc}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-[#581c87] text-[#f5d0fe] border border-[#a855f7]">
                        Mốc Kết Hợp
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#facc15]">
                        {selectedNode.node.title}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-[#ffffff] font-mono">
                      {selectedNode.node.name}
                    </div>
                    <p className="text-[11px] text-[#cbd5e1] leading-relaxed mt-1 font-mono break-words">
                      {selectedNode.node.fullDesc}
                    </p>
                  </>
                )}
              </div>

              {/* Nút đóng drawer nhỏ */}
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="w-6 h-6 flex items-center justify-center bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[#cbd5e1]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Chi phí & Nút hành động */}
            <div className="mt-2.5 pt-2 border-t border-[#1e293b] flex items-center justify-between gap-2 flex-wrap">
              {selectedNode.type === 'BRANCH' ? (() => {
                const curLvl =
                  selectedNode.branch === 'ECONOMY'
                    ? economyLevel
                    : selectedNode.branch === 'MILITARY'
                    ? militaryLevel
                    : heroLevel;
                const isUnlocked = curLvl >= selectedNode.node.level;
                const isAvailable = curLvl === selectedNode.node.level - 1;

                if (isUnlocked) {
                  return (
                    <div className="text-xs font-mono font-bold text-[#4ade80] flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> KỸ NĂNG ĐÃ ĐƯỢC KÍCH HOẠT
                    </div>
                  );
                }

                if (!isAvailable) {
                  return (
                    <div className="text-xs font-mono text-[#94a3b8] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Cần mở khóa Cấp {selectedNode.node.level - 1} trước
                    </div>
                  );
                }

                const canAfford =
                  playerProfile.skillPoints >= 1 &&
                  playerProfile.pixelCoins >= selectedNode.node.coinCost;

                return (
                  <>
                    <div className="flex items-center gap-2 text-xs font-mono text-[#cbd5e1]">
                      <span>Chi phí:</span>
                      <span className={playerProfile.skillPoints >= 1 ? 'text-[#fef08a]' : 'text-[#f87171]'}>
                        1⭐
                      </span>
                      <span>•</span>
                      <span className={playerProfile.pixelCoins >= selectedNode.node.coinCost ? 'text-[#67e8f9]' : 'text-[#f87171]'}>
                        {selectedNode.node.coinCost}💎
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUpgradeBranch(selectedNode.branch, selectedNode.node)}
                      disabled={!canAfford}
                      className={`px-3 py-1.5 font-mono text-xs font-bold transition-transform ${
                        canAfford
                          ? 'bg-[#b45309] hover:bg-[#d97706] active:translate-y-0.5 text-[#fef08a] border-2 border-[#facc15]'
                          : 'bg-[#1e293b] text-[#64748b] border border-[#334155] cursor-not-allowed'
                      }`}
                      style={{
                        boxShadow: canAfford ? '0 2px 0 0 #78350f' : undefined,
                      }}
                    >
                      {canAfford ? 'NÂNG CẤP KỸ NĂNG' : 'CHƯA ĐỦ ĐIỀU KIỆN'}
                    </button>
                  </>
                );
              })() : (() => {
                const isSelected = chosenHybrid === selectedNode.node.id;
                const isLockedOther = chosenHybrid !== null && !isSelected;
                const isEligible =
                  selectedNode.node.id === 'ECONOMY_MILITARY'
                    ? economyLevel >= 5 && militaryLevel >= 5
                    : selectedNode.node.id === 'ECONOMY_HERO'
                    ? economyLevel >= 5 && heroLevel >= 5
                    : militaryLevel >= 5 && heroLevel >= 5;

                if (isSelected) {
                  return (
                    <div className="text-xs font-mono font-bold text-[#c084fc] flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> MỐC ĐANG KÍCH HOẠT
                    </div>
                  );
                }

                if (isLockedOther) {
                  return (
                    <div className="text-xs font-mono text-[#64748b]">
                      ĐÃ KHÓA (Bạn đã kích hoạt mốc kết hợp khác)
                    </div>
                  );
                }

                if (!isEligible) {
                  return (
                    <div className="text-xs font-mono text-[#94a3b8]">
                      Yêu cầu cả 2 nhánh tương ứng đạt tối thiểu Cấp 5
                    </div>
                  );
                }

                const canAfford =
                  playerProfile.skillPoints >= selectedNode.node.skillPointCost &&
                  playerProfile.pixelCoins >= selectedNode.node.coinCost;

                return (
                  <>
                    <div className="flex items-center gap-2 text-xs font-mono text-[#cbd5e1]">
                      <span>Chi phí:</span>
                      <span className={playerProfile.skillPoints >= selectedNode.node.skillPointCost ? 'text-[#fef08a]' : 'text-[#f87171]'}>
                        {selectedNode.node.skillPointCost}⭐
                      </span>
                      <span>•</span>
                      <span className={playerProfile.pixelCoins >= selectedNode.node.coinCost ? 'text-[#67e8f9]' : 'text-[#f87171]'}>
                        {selectedNode.node.coinCost}💎
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmHybrid(selectedNode.node)}
                      disabled={!canAfford}
                      className={`px-3 py-1.5 font-mono text-xs font-bold transition-transform ${
                        canAfford
                          ? 'bg-[#7e22ce] hover:bg-[#9333ea] active:translate-y-0.5 text-[#f5d0fe] border-2 border-[#c084fc]'
                          : 'bg-[#1e293b] text-[#64748b] border border-[#334155] cursor-not-allowed'
                      }`}
                      style={{
                        boxShadow: canAfford ? '0 2px 0 0 #581c87' : undefined,
                      }}
                    >
                      {canAfford ? 'CHỌN MỐC KẾT HỢP' : 'CHƯA ĐỦ ĐIỀU KIỆN'}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* 5. MODAL XÁC NHẬN CHỌN MỐC KẾT HỢP DUY NHẤT */}
        {confirmHybrid && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85">
            <div
              className="max-w-md w-full bg-[#0b0f19] text-[#e2e8f0] p-4 font-mono space-y-3"
              style={{
                border: '3px solid #eab308',
                boxShadow: '0 6px 0 0 #000000',
              }}
            >
              <div className="flex items-center gap-2 text-[#facc15] font-black text-sm">
                <Sparkles className="w-5 h-5" />
                <span>XÁC NHẬN MỐC KẾT HỢP</span>
              </div>
              <div className="text-xs font-bold text-white">
                {confirmHybrid.name} ({confirmHybrid.title})
              </div>
              <div className="p-2 bg-[#1c1917] border border-[#ca8a04] text-[11px] text-[#fef08a] leading-relaxed">
                ⚠️ <strong>CẢNH BÁO DUY NHẤT:</strong> Bạn chỉ được chọn{' '}
                <strong>1 trong 3 mốc kết hợp</strong>. Sau khi chọn, 2 mốc còn lại sẽ bị khóa
                cho đến khi bạn thực hiện Tẩy Điểm (Reset).
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmHybrid(null)}
                  className="flex-1 py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-xs font-bold text-[#cbd5e1]"
                >
                  HỦY BỎ
                </button>
                <button
                  type="button"
                  onClick={() => handleUpgradeHybrid(confirmHybrid)}
                  className="flex-1 py-1.5 bg-[#ca8a04] hover:bg-[#eab308] border border-[#fef08a] text-xs font-black text-[#0f172a]"
                >
                  XÁC NHẬN CHỌN
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. MODAL XÁC NHẬN TẨY ĐIỂM (RESET) */}
        {confirmReset && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85">
            <div
              className="max-w-md w-full bg-[#0b0f19] text-[#e2e8f0] p-4 font-mono space-y-3"
              style={{
                border: '3px solid #ef4444',
                boxShadow: '0 6px 0 0 #000000',
              }}
            >
              <div className="flex items-center gap-2 text-[#f87171] font-black text-sm">
                <RotateCcw className="w-5 h-5" />
                <span>TẨY ĐIỂM CÂY KỸ NĂNG</span>
              </div>
              <div className="p-2 bg-[#2d0f17] border border-[#be123c] text-[11px] text-[#fecdd3] leading-relaxed space-y-1">
                <div>• Hoàn lại toàn bộ Điểm Kỹ Năng đã nâng ở cả 3 nhánh.</div>
                <div>• Mở khóa lại mốc kết hợp để bạn tự do chọn lại.</div>
                <div>
                  • Chi phí:{' '}
                  <strong className="text-[#67e8f9]">
                    {RESET_SKILL_TREE_COIN_COST} Xu Pixel
                  </strong>{' '}
                  (Vàng đã tiêu không hoàn lại).
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-xs font-bold text-[#cbd5e1]"
                >
                  HỦY BỎ
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-1.5 bg-[#be123c] hover:bg-[#e11d48] border border-[#fecdd3] text-xs font-black text-white"
                >
                  XÁC NHẬN TẨY ĐIỂM
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
