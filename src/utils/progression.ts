/**
 * Quản lý Hệ thống Cấp độ (Level), Điểm kinh nghiệm (EXP) và Tiền xu Pixel
 */

import { GameDifficulty, GameMode, PlayerProfile, VictoryReward } from '../types';

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

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.level === 'number') {
        const lvl = Math.min(MAX_PLAYER_LEVEL, Math.max(1, Math.floor(parsed.level)));
        return {
          level: lvl,
          exp: lvl >= MAX_PLAYER_LEVEL ? 0 : Math.max(0, Math.floor(parsed.exp || 0)),
          pixelCoins: Math.max(0, Math.floor(parsed.pixelCoins || 0)),
        };
      }
    }
  } catch {}
  return { level: 1, exp: 0, pixelCoins: 0 };
}

export function savePlayerProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {}
}

/**
 * Tính toán và trao phần thưởng khi Chiến Thắng (VICTORY):
 * - Điểm EXP: Dễ = 10, Trung bình = 20, Khó = 40
 * - Tiền xu Pixel: Dễ = 10, Trung bình = 25, Khó = 50
 * - Thắng trong chế độ tạo phòng (Multiplayer): Giảm 1 nửa
 * - Chế độ Sáng Tạo (Creative): Không được gì (0 EXP, 0 Xu)
 */
export function calculateVictoryReward(
  difficulty: GameDifficulty,
  mode: GameMode,
  isMultiplayer: boolean,
  currentProfile: PlayerProfile
): { reward: VictoryReward; updatedProfile: PlayerProfile } {
  // Chế độ Sáng Tạo: Không nhận được gì
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

  // Base EXP & Tiền xu Pixel theo độ khó
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

  // Thắng trong chế độ tạo phòng (Multiplayer): Giảm 1 nửa
  let expGained = baseExp;
  let coinsGained = baseCoins;

  if (isMultiplayer) {
    expGained = Math.floor(baseExp / 2);
    coinsGained = Math.floor(baseCoins / 2);
  }

  const oldLevel = currentProfile.level;
  const oldExp = currentProfile.exp;
  let newLevel = oldLevel;
  let newExp = oldExp + expGained;
  let leveledUp = false;

  // Xử lý lên cấp
  while (newLevel < MAX_PLAYER_LEVEL) {
    const req = getRequiredExpForNextLevel(newLevel);
    if (newExp >= req) {
      newExp -= req;
      newLevel += 1;
      leveledUp = true;
    } else {
      break;
    }
  }

  if (newLevel >= MAX_PLAYER_LEVEL) {
    newExp = 0; // Đạt MAX cấp
  }

  const newCoins = currentProfile.pixelCoins + coinsGained;

  const updatedProfile: PlayerProfile = {
    level: newLevel,
    exp: newExp,
    pixelCoins: newCoins,
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
