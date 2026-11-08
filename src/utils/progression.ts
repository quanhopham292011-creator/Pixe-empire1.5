/**
 * Quản lý Hệ thống Cấp độ (Level), Điểm kinh nghiệm (EXP), Tiền xu Pixel và Chọn Tướng
 */

import { GameDifficulty, GameMode, PlayerProfile, VictoryReward, GeneralSkillId } from '../types';
import { GENERAL_ROSTER } from './constants';

export const MAX_PLAYER_LEVEL = 10;

/**
 * Tính lượng EXP cần để lên cấp tiếp theo:
 * Lv 1 -> Lv 2: 20 exp
 * Lv 2 -> Lv 3: 40 exp
 * Lv 3 -> Lv 4: 80 exp
 * Lv 4 -> Lv 5: 160 exp
 * Lv 5 -> Lv 6: 320 exp
 * Lv 6 -> Lv 7: 640 exp
 * Lv 7 -> Lv 8: 1280 exp
 * Lv 8 -> Lv 9: 2560 exp
 * Lv 9 -> Lv 10: 5120 exp
 * Lv 10: MAX (0 exp cần thêm)
 */
export function getRequiredExpForNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_PLAYER_LEVEL) return 0;
  return 20 * Math.pow(2, currentLevel - 1);
}

const STORAGE_KEY = 'pixel_empire_profile_v1';

export function isGeneralUnlocked(profile: PlayerProfile, skillId: GeneralSkillId): boolean {
  const item = GENERAL_ROSTER.find(r => r.skillId === skillId);
  if (!item) return false;
  if (item.unlockType === 'DEFAULT') return true;
  if (item.unlockType === 'LEVEL') {
    return profile.level >= (item.unlockLevel || 1);
  }
  if (item.unlockType === 'PURCHASE') {
    return Array.isArray(profile.purchasedGenerals) && profile.purchasedGenerals.includes(skillId);
  }
  return false;
}

export function loadPlayerProfile(): PlayerProfile {
  let profile: PlayerProfile = {
    level: 1,
    exp: 0,
    pixelCoins: 0,
    purchasedGenerals: [],
    selectedGeneral: 'INSPIRE_AURA',
    skillPoints: 3, // Khởi đầu Level 1 nhận ngay 3 điểm kỹ năng
    skillTree: {
      economyLevel: 0,
      militaryLevel: 0,
      heroLevel: 0,
      chosenHybrid: null,
    },
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.level === 'number') {
        const lvl = Math.min(MAX_PLAYER_LEVEL, Math.max(1, Math.floor(parsed.level)));
        const purchased = Array.isArray(parsed.purchasedGenerals) ? parsed.purchasedGenerals : [];
        const selected = (parsed.selectedGeneral as GeneralSkillId) || 'INSPIRE_AURA';

        const tree = parsed.skillTree || {};
        const economyLevel = Math.min(10, Math.max(0, Math.floor(Number(tree.economyLevel) || 0)));
        const militaryLevel = Math.min(10, Math.max(0, Math.floor(Number(tree.militaryLevel) || 0)));
        const heroLevel = Math.min(10, Math.max(0, Math.floor(Number(tree.heroLevel) || 0)));
        const chosenHybrid = (tree.chosenHybrid as any) || null;

        const totalSpent = economyLevel + militaryLevel + heroLevel + (chosenHybrid ? 1 : 0);
        let pts = typeof parsed.skillPoints === 'number'
          ? Math.max(0, Math.floor(parsed.skillPoints))
          : Math.max(0, lvl * 3 - totalSpent);

        profile = {
          level: lvl,
          exp: lvl >= MAX_PLAYER_LEVEL ? 0 : Math.max(0, Math.floor(parsed.exp || 0)),
          pixelCoins: Math.max(0, Math.floor(parsed.pixelCoins || 0)),
          purchasedGenerals: purchased,
          selectedGeneral: selected,
          skillPoints: pts,
          skillTree: {
            economyLevel,
            militaryLevel,
            heroLevel,
            chosenHybrid,
          },
        };
      }
    }
  } catch {}

  // Nếu Tướng đang chọn chưa được mở khóa thì quay về Hắc Phong
  if (!isGeneralUnlocked(profile, profile.selectedGeneral)) {
    profile.selectedGeneral = 'INSPIRE_AURA';
  }

  return profile;
}

export function savePlayerProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

export function purchaseGeneral(
  profile: PlayerProfile,
  skillId: GeneralSkillId
): { success: boolean; message?: string; updatedProfile: PlayerProfile } {
  const item = GENERAL_ROSTER.find(r => r.skillId === skillId);
  if (!item) return { success: false, message: 'Không tìm thấy Tướng!', updatedProfile: profile };

  if (isGeneralUnlocked(profile, skillId)) {
    return { success: false, message: 'Tướng đã được mở khóa!', updatedProfile: profile };
  }

  const price = item.price || 0;
  if (profile.pixelCoins < price) {
    const diff = price - profile.pixelCoins;
    return { success: false, message: `Thiếu ${diff} Xu`, updatedProfile: profile };
  }

  const updatedProfile: PlayerProfile = {
    ...profile,
    pixelCoins: profile.pixelCoins - price,
    purchasedGenerals: [...(profile.purchasedGenerals || []), skillId],
    selectedGeneral: skillId,
  };

  savePlayerProfile(updatedProfile);
  return { success: true, updatedProfile };
}

export function selectGeneral(
  profile: PlayerProfile,
  skillId: GeneralSkillId
): { success: boolean; updatedProfile: PlayerProfile } {
  if (!isGeneralUnlocked(profile, skillId)) {
    return { success: false, updatedProfile: profile };
  }

  const updatedProfile: PlayerProfile = {
    ...profile,
    selectedGeneral: skillId,
  };

  savePlayerProfile(updatedProfile);
  return { success: true, updatedProfile };
}

/**
 * Nâng cấp một nấc kỹ năng trong nhánh (Kinh Tế, Quân Đội, hoặc Anh Hùng)
 */
export function upgradeSkillBranchNode(
  profile: PlayerProfile,
  branch: 'ECONOMY' | 'MILITARY' | 'HERO',
  currentGold: number,
  nodeCost: { gold: number; coins: number }
): { success: boolean; message: string; updatedProfile: PlayerProfile; goldDeducted: number } {
  const currentLvl =
    branch === 'ECONOMY'
      ? profile.skillTree.economyLevel
      : branch === 'MILITARY'
      ? profile.skillTree.militaryLevel
      : profile.skillTree.heroLevel;

  if (currentLvl >= 10) {
    return { success: false, message: 'Nhánh này đã đạt cấp tối đa (Cấp 10)!', updatedProfile: profile, goldDeducted: 0 };
  }

  if (profile.skillPoints < 1) {
    return { success: false, message: 'Bạn không đủ Điểm Kỹ Năng (cần 1 điểm)! Hãy lên cấp để nhận thêm.', updatedProfile: profile, goldDeducted: 0 };
  }

  if (profile.pixelCoins < nodeCost.coins) {
    return { success: false, message: `Bạn còn thiếu ${nodeCost.coins - profile.pixelCoins} Xu Pixel!`, updatedProfile: profile, goldDeducted: 0 };
  }

  if (currentGold < nodeCost.gold) {
    return { success: false, message: `Ngân khố thiếu ${nodeCost.gold - currentGold} Vàng!`, updatedProfile: profile, goldDeducted: 0 };
  }

  const nextTree = { ...profile.skillTree };
  if (branch === 'ECONOMY') nextTree.economyLevel += 1;
  else if (branch === 'MILITARY') nextTree.militaryLevel += 1;
  else nextTree.heroLevel += 1;

  const updatedProfile: PlayerProfile = {
    ...profile,
    skillPoints: profile.skillPoints - 1,
    pixelCoins: profile.pixelCoins - nodeCost.coins,
    skillTree: nextTree,
  };

  savePlayerProfile(updatedProfile);
  return {
    success: true,
    message: `Nâng cấp thành công lên Cấp ${currentLvl + 1}!`,
    updatedProfile,
    goldDeducted: nodeCost.gold,
  };
}

/**
 * Mở khóa Mốc Kết Hợp (Hybrid Mastery) - CHỈ ĐƯỢC CHỌN 1 TRONG 3!
 */
export function upgradeHybridMastery(
  profile: PlayerProfile,
  hybridId: 'ECONOMY_MILITARY' | 'ECONOMY_HERO' | 'MILITARY_HERO',
  currentGold: number,
  cost: { skillPointCost: number; goldCost: number; coinCost: number }
): { success: boolean; message: string; updatedProfile: PlayerProfile; goldDeducted: number } {
  if (profile.skillTree.chosenHybrid) {
    return {
      success: false,
      message: 'Bạn đã chọn một mốc kết hợp rồi! Các mốc khác đã bị khóa vĩnh viễn (hãy Reset nếu muốn đổi).',
      updatedProfile: profile,
      goldDeducted: 0,
    };
  }

  const { economyLevel, militaryLevel, heroLevel } = profile.skillTree;
  let reqMet = false;
  if (hybridId === 'ECONOMY_MILITARY' && economyLevel >= 5 && militaryLevel >= 5) reqMet = true;
  if (hybridId === 'ECONOMY_HERO' && economyLevel >= 5 && heroLevel >= 5) reqMet = true;
  if (hybridId === 'MILITARY_HERO' && militaryLevel >= 5 && heroLevel >= 5) reqMet = true;

  if (!reqMet) {
    return {
      success: false,
      message: 'Chưa đủ điều kiện: Cả 2 nhánh liên quan phải đạt từ Cấp 5 trở lên!',
      updatedProfile: profile,
      goldDeducted: 0,
    };
  }

  if (profile.skillPoints < cost.skillPointCost) {
    return { success: false, message: 'Bạn không đủ Điểm Kỹ Năng!', updatedProfile: profile, goldDeducted: 0 };
  }

  if (profile.pixelCoins < cost.coinCost) {
    return { success: false, message: `Bạn còn thiếu ${cost.coinCost - profile.pixelCoins} Xu Pixel!`, updatedProfile: profile, goldDeducted: 0 };
  }

  if (currentGold < cost.goldCost) {
    return { success: false, message: `Ngân khố thiếu ${cost.goldCost - currentGold} Vàng!`, updatedProfile: profile, goldDeducted: 0 };
  }

  const updatedProfile: PlayerProfile = {
    ...profile,
    skillPoints: profile.skillPoints - cost.skillPointCost,
    pixelCoins: profile.pixelCoins - cost.coinCost,
    skillTree: {
      ...profile.skillTree,
      chosenHybrid: hybridId,
    },
  };

  savePlayerProfile(updatedProfile);
  return {
    success: true,
    message: 'Kích hoạt Mốc Kết Hợp thành công!',
    updatedProfile,
    goldDeducted: cost.goldCost,
  };
}

/**
 * Tẩy điểm (Reset) Cây Kỹ Năng: Hoàn lại toàn bộ điểm kỹ năng, tốn một ít xu Pixel
 */
export function resetSkillTreeProfile(
  profile: PlayerProfile,
  resetCostCoins: number
): { success: boolean; message: string; updatedProfile: PlayerProfile } {
  if (profile.pixelCoins < resetCostCoins) {
    return {
      success: false,
      message: `Bạn cần ${resetCostCoins} Xu Pixel để tẩy điểm (Hiện có: ${profile.pixelCoins} Xu).`,
      updatedProfile: profile,
    };
  }

  const { economyLevel, militaryLevel, heroLevel, chosenHybrid } = profile.skillTree;
  const spentPoints = economyLevel + militaryLevel + heroLevel + (chosenHybrid ? 1 : 0);

  if (spentPoints === 0 && !chosenHybrid) {
    return { success: false, message: 'Cây kỹ năng chưa nâng cấp điểm nào!', updatedProfile: profile };
  }

  const updatedProfile: PlayerProfile = {
    ...profile,
    pixelCoins: profile.pixelCoins - resetCostCoins,
    skillPoints: profile.skillPoints + spentPoints,
    skillTree: {
      economyLevel: 0,
      militaryLevel: 0,
      heroLevel: 0,
      chosenHybrid: null,
    },
  };

  savePlayerProfile(updatedProfile);
  return {
    success: true,
    message: `Đã hoàn lại ${spentPoints} Điểm Kỹ Năng! Bạn có thể nâng cấp lại từ đầu.`,
    updatedProfile,
  };
}

/**
 * Tính toán và trao phần thưởng khi Chiến Thắng (VICTORY):
 * - Điểm EXP: Dễ = 10, Trung bình = 20, Khó = 40
 * - Tiền xu Pixel: Dễ = 10, Trung bình = 25, Khó = 50
 * - Thắng trong chế độ tạo phòng (Multiplayer): Giảm 1 nửa
 * - Chế độ Sáng Tạo (Creative): Không được gì (0 EXP, 0 Xu)
 * - Mỗi khi lên Level: Nhận ngay +3 Điểm Kỹ Năng!
 */
export function calculateVictoryReward(
  difficulty: GameDifficulty,
  mode: GameMode,
  isMultiplayer: boolean,
  currentProfile: PlayerProfile
): { reward: VictoryReward; updatedProfile: PlayerProfile } {
  if (mode === 'CREATIVE') {
    return {
      reward: {
        expGained: 0,
        coinsGained: 0,
        leveledUp: false,
        oldLevel: currentProfile.level,
        newLevel: currentProfile.level,
        oldExp: currentProfile.exp,
        newExp: currentProfile.exp,
        reqExp: getRequiredExpForNextLevel(currentProfile.level),
        isMultiplayer,
        isCreative: true,
      },
      updatedProfile: { ...currentProfile }
    };
  }

  let baseExp = 10;
  let baseCoins = 10;

  if (difficulty === 'EASY') {
    baseExp = 10;
    baseCoins = 10;
  } else if (difficulty === 'NORMAL') {
    baseExp = 20;
    baseCoins = 25;
  } else if (difficulty === 'HARD') {
    baseExp = 40;
    baseCoins = 50;
  }

  let expGained = baseExp;
  let coinsGained = baseCoins;

  if (isMultiplayer) {
    expGained = Math.floor(baseExp / 2);
    coinsGained = Math.floor(baseCoins / 2);
  }

  // Thưởng thêm Xu Pixel nếu có mốc kết hợp Kinh Tế + Anh Hùng
  if (currentProfile.skillTree?.chosenHybrid === 'ECONOMY_HERO') {
    coinsGained = Math.floor(coinsGained * 1.5);
  }

  const oldLevel = currentProfile.level;
  const oldExp = currentProfile.exp;
  let newLevel = oldLevel;
  let newExp = oldExp + expGained;
  let leveledUp = false;
  let pointsGained = 0;

  while (newLevel < MAX_PLAYER_LEVEL) {
    const req = getRequiredExpForNextLevel(newLevel);
    if (newExp >= req) {
      newExp -= req;
      newLevel += 1;
      leveledUp = true;
      pointsGained += 3; // Mỗi level lên nhận 3 điểm kỹ năng
    } else {
      break;
    }
  }

  if (newLevel >= MAX_PLAYER_LEVEL) {
    newExp = 0;
  }

  const newCoins = currentProfile.pixelCoins + coinsGained;

  const updatedProfile: PlayerProfile = {
    ...currentProfile,
    level: newLevel,
    exp: newExp,
    pixelCoins: newCoins,
    skillPoints: (currentProfile.skillPoints || 0) + pointsGained,
  };

  savePlayerProfile(updatedProfile);

  return {
    reward: {
      expGained,
      coinsGained,
      leveledUp,
      oldLevel,
      newLevel,
      oldExp,
      newExp,
      reqExp: getRequiredExpForNextLevel(newLevel),
      isMultiplayer,
      isCreative: false,
    },
    updatedProfile,
  };
}
