import { General, Nation, PlayerProfile, GeneralSkillId, AttackWave, GeneralBehavior, GeneralStyle, GeneralLoyaltyState, GeneralRole } from '../types';
import { applyCasualties } from './casualties';
import { createEmptyEvolutionStats, sanitizeEvolutionStats, sanitizeStyle, tryEvolveGeneral } from './generalEvolution';
import { GENERAL_ROSTER } from './constants';

export const MAX_RESERVE_GENERALS = 3;

/**
 * PIXEL EMPIRE – GENERAL SYSTEM 1.1 & 1.3
 * Cấu hình chỉ số chuẩn & Giới hạn cân bằng cho Đại Tướng
 */
export const GENERAL_CONSTANTS = {
  // Chỉ số cơ bản
  BASE_HP: 1000,
  BASE_ARMOR: 0.20, // 20%
  BASE_ATTACK: 90,
  DEFAULT_COMBAT_POWER_BONUS: 0.10, // General System 1.2: Đổi giá trị mặc định từ 0.30 xuống 0.10

  // Giới hạn cân bằng (Caps)
  MAX_HP_BONUS_RATIO: 0.25, // HP tăng tối đa 25% (maxHp <= 1250)
  MAX_ATTACK_BONUS_RATIO: 0.20, // Sát thương tăng tối đa 20% (attack <= 108)
  MAX_ARMOR_BONUS: 0.15, // Giáp nhận thêm tối đa 15 điểm phần trăm (+15%)
  MAX_TOTAL_ARMOR: 0.60, // Tổng giáp tuyệt đối không vượt 60%
  MAX_COMBAT_POWER_BONUS: 0.10, // General System 1.2: Bonus tối đa +10%

  // Cấp độ tối đa (Pixel Empire 1.4)
  MAX_LEVEL: 30,

  // Ngưỡng sinh tồn & Hồi phục
  RETREAT_HP_RATIO: 0.20, // Rút lui khi HP <= 20% (200 HP)
  DEPLOY_MIN_HP_RATIO: 0.60, // Cần ít nhất 60% HP mới được triển khai lại (600 HP)
  RECOVERY_RATE_PER_SECOND: 0.03, // Hồi 3% HP tối đa mỗi giây ở vùng an toàn
} as const;

/**
 * Khởi tạo dữ liệu Đại Tướng mặc định chuẩn v1.4
 */
export function createDefaultGeneral(
  id: string,
  nationId: number,
  name: string,
  skillId: GeneralSkillId,
  spawnX: number,
  spawnY: number
): General {
  return {
    id,
    nationId,
    name,
    status: 'IDLE',
    role: 'ACTIVE',
    healthState: 'HEALTHY',
    behavior: 'DEFEND', // Pixel Empire 1.3: Mặc định sẵn sàng bảo vệ lãnh thổ
    hp: GENERAL_CONSTANTS.BASE_HP,
    maxHp: GENERAL_CONSTANTS.BASE_HP,
    baseHp: GENERAL_CONSTANTS.BASE_HP,
    armor: GENERAL_CONSTANTS.BASE_ARMOR,
    baseArmor: GENERAL_CONSTANTS.BASE_ARMOR,
    attack: GENERAL_CONSTANTS.BASE_ATTACK,
    baseAttack: GENERAL_CONSTANTS.BASE_ATTACK,
    x: spawnX,
    y: spawnY,
    combatPowerBonus: GENERAL_CONSTANTS.DEFAULT_COMBAT_POWER_BONUS,
    reviveTimer: 0,
    isDeployedToFront: false,
    skillId,
    skillCooldown: 0,
    skillActiveTimer: 0,
    level: 1,
    exp: 0,
    loyalty: 100,
    evolutionStats: createEmptyEvolutionStats(),
    history: ['[Khởi Tạo] Nhận nhiệm vụ Thống Soái Quân Đội'],
  };
}

/**
 * Tính toán các chỉ số của Đại Tướng dựa trên cấp độ, Skill Tree và Công nghệ.
 * Đảm bảo:
 * 1. Không vượt quá giới hạn cân bằng (HP <= +25%, Attack <= +20%, thêm giáp <= +15%, tổng giáp <= 60%).
 * 2. Tính toán nhất quán (idempotent), không bị cộng dồn nhiều lần khi tải lại game.
 */
export function calculateGeneralStats(
  general: General,
  nation: Nation,
  playerProfile?: PlayerProfile | null
): void {
  const baseHp = general.baseHp || GENERAL_CONSTANTS.BASE_HP;
  const baseAttack = general.baseAttack || GENERAL_CONSTANTS.BASE_ATTACK;
  const baseArmor = general.baseArmor || GENERAL_CONSTANTS.BASE_ARMOR;

  let hpBonusRatio = 0;
  let attackBonusRatio = 0;
  let armorBonus = 0;

  // 1. Bonus từ Cấp độ riêng của Đại Tướng (Level 1 - 30, chuẩn PIXEL EMPIRE 1.4)
  const genLevel = Math.max(1, Math.min(GENERAL_CONSTANTS.MAX_LEVEL, general.level || 1));
  const levelGains = genLevel - 1;
  // Mỗi cấp tăng: +0.5% HP (tối đa +14.5%), +0.4% Attack (tối đa +11.6%), +0.2% Armor (tối đa +5.8%)
  hpBonusRatio += levelGains * 0.005;
  attackBonusRatio += levelGains * 0.004;
  armorBonus += levelGains * 0.002;

  // 2. Tính bonus từ Skill Tree & Cấp độ người chơi (nếu là quốc gia người chơi)
  if (nation.isPlayer && playerProfile) {
    const heroLevel = playerProfile.skillTree?.heroLevel || 0;
    // Mỗi cấp Hero tăng +1.5% HP và +1% Attack
    hpBonusRatio += heroLevel * 0.015;
    attackBonusRatio += heroLevel * 0.01;

    // Bonus từ Cấp độ tổng (Lv.1 - Lv.10)
    const level = playerProfile.level || 1;
    if (level >= 5) {
      hpBonusRatio += 0.05;
      armorBonus += 0.03;
    }
    if (level >= 10) {
      attackBonusRatio += 0.05;
      armorBonus += 0.04;
    }
  }

  // 3. Tính bonus từ Công nghệ của Quốc gia (cho cả Người chơi và AI / Boss)
  if (nation.techLevels) {
    // Công nghệ Phòng Thủ: Tăng giáp và HP
    const defLvl = nation.techLevels.defense || 0;
    armorBonus += defLvl * 0.03; // Cấp 1: +3%, Cấp 2: +6%, Cấp 3: +9%
    hpBonusRatio += defLvl * 0.03;

    // Công nghệ Quân Sự: Tăng Sát thương
    const milLvl = nation.techLevels.military || 0;
    attackBonusRatio += milLvl * 0.04; // Cấp 1: +4%, Cấp 2: +8%, Cấp 3: +12%
  }

  // 4. Nếu là Boss: Có một chút tăng cường chỉ số cơ bản
  if (nation.tier === 'BOSS') {
    hpBonusRatio += 0.10;
    attackBonusRatio += 0.10;
    armorBonus += 0.05;
  }

  // Áp dụng giới hạn cân bằng (Caps) nghiêm ngặt
  const finalHpBonusRatio = Math.min(GENERAL_CONSTANTS.MAX_HP_BONUS_RATIO, Math.max(0, hpBonusRatio));
  const finalAttackBonusRatio = Math.min(GENERAL_CONSTANTS.MAX_ATTACK_BONUS_RATIO, Math.max(0, attackBonusRatio));
  const finalArmorBonus = Math.min(GENERAL_CONSTANTS.MAX_ARMOR_BONUS, Math.max(0, armorBonus));

  // Tính các chỉ số chính thức
  general.baseHp = baseHp;
  general.baseAttack = baseAttack;
  general.baseArmor = baseArmor;

  general.maxHp = Math.round(baseHp * (1 + finalHpBonusRatio)); // Tối đa 1250
  general.attack = Math.round(baseAttack * (1 + finalAttackBonusRatio)); // Tối đa 108
  general.armor = Math.min(GENERAL_CONSTANTS.MAX_TOTAL_ARMOR, Number((baseArmor + finalArmorBonus).toFixed(3))); // Tối đa 60%

  // Pixel Empire 1.7: Ảnh hưởng của Loyalty lên chỉ số chiến đấu của tướng ACTIVE (RESERVE không bị ảnh hưởng)
  if (general.role === 'ACTIVE') {
    const loyalty = typeof general.loyalty === 'number' && Number.isFinite(general.loyalty) ? general.loyalty : 100;
    if (loyalty < 30) {
      // NGUY_CO_PHAN_BOI: Sát thương giảm 20%
      general.attack = Math.round(general.attack * 0.80);
    } else if (loyalty < 70) {
      // BAT_MAN: Sát thương giảm 10%
      general.attack = Math.round(general.attack * 0.90);
    }
  }

  // Khởi tạo hoặc giới hạn HP hiện tại
  if (general.hp === undefined || general.hp === null) {
    general.hp = general.maxHp;
  } else {
    general.hp = Math.min(general.maxHp, Math.max(0, general.hp));
  }

  // General System 1.2: combatPowerBonus tối đa +10% (0.10)
  general.combatPowerBonus = Math.min(
    GENERAL_CONSTANTS.MAX_COMBAT_POWER_BONUS,
    Math.max(0, typeof general.combatPowerBonus === 'number' ? general.combatPowerBonus : GENERAL_CONSTANTS.DEFAULT_COMBAT_POWER_BONUS)
  );

  // Cập nhật trạng thái sức khỏe
  if (general.hp === 0) {
    general.healthState = 'INJURED';
    if (general.status !== 'INJURED') general.status = 'INJURED';
  } else if (general.hp < general.maxHp * GENERAL_CONSTANTS.DEPLOY_MIN_HP_RATIO) {
    general.healthState = 'RECOVERING';
  } else {
    general.healthState = 'HEALTHY';
  }
}

/**
 * Tính lượng EXP cần để lên cấp tiếp theo (Level 1 -> 30).
 * Đường cong EXP tăng dần theo hàm lũy thừa mũ 1.6, vừa vặn nhịp độ game.
 */
export function getExpNeededForNextLevel(level: number): number {
  if (level >= GENERAL_CONSTANTS.MAX_LEVEL) return Infinity;
  const safeLevel = Math.max(1, Math.min(GENERAL_CONSTANTS.MAX_LEVEL - 1, level));
  return Math.round(80 + Math.pow(safeLevel, 1.6) * 35);
}

/**
 * Thưởng EXP cho Đại Tướng dựa trên đóng góp thực tế trong chiến trận.
 * - Chỉ thưởng cho Đại Tướng ACTIVE, không thưởng cho tướng dự bị (RESERVE) hay bị bắt (CAPTIVE).
 * - Cấp độ tối đa Lv.30.
 * - Tự động lên cấp khi đủ EXP và cập nhật chỉ số chuẩn theo GENERAL_CONSTANTS.
 * - Lưu lại sự kiện chiến tích vào general.history.
 */
export function awardGeneralExp(
  general: General,
  nation: Nation,
  expEarned: number,
  reason?: string,
  playerProfile?: PlayerProfile | null
): { leveledUp: boolean; oldLevel: number; newLevel: number; expGained: number; evolvedStyle?: GeneralStyle } {
  // Đại Tướng dự bị hoặc bị bắt không nhận EXP chiến đấu
  if (!general || general.role !== 'ACTIVE' || expEarned <= 0) {
    return {
      leveledUp: false,
      oldLevel: general?.level || 1,
      newLevel: general?.level || 1,
      expGained: 0,
      evolvedStyle: undefined,
    };
  }

  let currentLevel = Math.max(1, Math.min(GENERAL_CONSTANTS.MAX_LEVEL, general.level || 1));
  const oldLevel = currentLevel;

  // Nếu đã đạt cấp tối đa Level 30
  if (currentLevel >= GENERAL_CONSTANTS.MAX_LEVEL) {
    general.level = GENERAL_CONSTANTS.MAX_LEVEL;
    general.exp = 0;
    return {
      leveledUp: false,
      oldLevel: GENERAL_CONSTANTS.MAX_LEVEL,
      newLevel: GENERAL_CONSTANTS.MAX_LEVEL,
      expGained: 0,
      evolvedStyle: tryEvolveGeneral(general),
    };
  }

  general.exp = (general.exp || 0) + expEarned;
  let leveledUp = false;

  while (currentLevel < GENERAL_CONSTANTS.MAX_LEVEL) {
    const needed = getExpNeededForNextLevel(currentLevel);
    if (general.exp >= needed) {
      general.exp -= needed;
      currentLevel += 1;
      leveledUp = true;

      // Ghi nhận chiến tích vào history
      general.history = general.history || [];
      general.history.unshift(`[Cấp Độ] Thăng cấp lên Lv.${currentLevel}${reason ? ` (${reason})` : ''}`);
      if (general.history.length > 30) general.history.pop();
    } else {
      break;
    }
  }

  general.level = currentLevel;
  if (currentLevel >= GENERAL_CONSTANTS.MAX_LEVEL) {
    general.exp = 0;
  }

  if (leveledUp) {
    // Pixel Empire 1.6: Thăng cấp tăng 5 điểm lòng trung thành
    changeGeneralLoyalty(general, 5, 'Thăng cấp tướng');

    // Tái tính toán chỉ số dựa trên cấp mới (nhất quán, không cộng dồn sai)
    calculateGeneralStats(general, nation, playerProfile);

    // Thưởng hồi phục một phần sinh lực khi lên cấp (20% maxHp)
    const hpGain = Math.round(general.maxHp * 0.20);
    general.hp = Math.min(general.maxHp, general.hp + hpGain);
    if (general.healthState === 'INJURED' && general.hp > 0) {
      general.healthState = 'RECOVERING';
    }
  }

  return {
    leveledUp,
    oldLevel,
    newLevel: currentLevel,
    expGained: expEarned,
    evolvedStyle: tryEvolveGeneral(general),
  };
}

/**
 * PIXEL EMPIRE 1.6: Phân loại trạng thái lòng trung thành của Đại Tướng.
 * - >= 70: 'TRUNG_THANH'
 * - 30..69: 'BAT_MAN'
 * - < 30: 'NGUY_CO_PHAN_BOI'
 */
export function getLoyaltyState(general?: General | null): GeneralLoyaltyState {
  const loyalty = typeof general?.loyalty === 'number' && Number.isFinite(general.loyalty) ? general.loyalty : 100;
  if (loyalty >= 70) return 'TRUNG_THANH';
  if (loyalty >= 30) return 'BAT_MAN';
  return 'NGUY_CO_PHAN_BOI';
}

/**
 * PIXEL EMPIRE 1.6: Thay đổi lòng trung thành của Đại Tướng.
 * - Kẹp giá trị trong khoảng 0–100. Dữ liệu cũ thiếu loyalty thì mặc định 100.
 * - Tướng RESERVE và CAPTIVE: KHÔNG tăng/giảm loyalty (bảo vệ ngay đầu hàm).
 * - Chỉ gọi ở các sự kiện cố định, không gọi theo thời gian.
 */
export function changeGeneralLoyalty(
  general: General | undefined | null,
  delta: number,
  _reason?: string
): number {
  if (!general || general.role !== 'ACTIVE') {
    return typeof general?.loyalty === 'number' && Number.isFinite(general.loyalty) ? general.loyalty : 100;
  }
  if (!Number.isFinite(delta) || delta === 0) {
    return typeof general.loyalty === 'number' && Number.isFinite(general.loyalty) ? general.loyalty : 100;
  }

  const currentLoyalty = typeof general.loyalty === 'number' && Number.isFinite(general.loyalty) ? general.loyalty : 100;
  const nextLoyalty = Math.max(0, Math.min(100, Math.round(currentLoyalty + delta)));
  general.loyalty = nextLoyalty;

  return nextLoyalty;
}

/**
 * PIXEL EMPIRE – GENERAL SYSTEM 1.2 & 1.3
 * Chia sẻ sát thương giữa Quân Đội và Đại Tướng:
 * Khi tướng sắp nhận sát thương (rawDamage), chia theo sức mạnh quân còn lại của nước đó (troops / maxTroops):
 * - Trên 60%: tướng nhận 20%, quân nhận 80%
 * - 30% đến 60%: tướng nhận 35%, quân nhận 65%
 * - Dưới 30%: tướng nhận 60%, quân nhận 40%
 * - Hết quân: tướng nhận 100%
 * Tổng phần chia phải bằng đúng rawDamage, không tính hai lần.
 * Phân biệt quân dự trữ nation.troops và quân đang hành quân AttackWave.troops.
 */
export function calculateDamageShare(
  nation: Nation,
  rawDamage: number,
  wave?: AttackWave
): { generalRawDamage: number; troopDamage: number; generalRatio: number; troopRatio: number } {
  if (rawDamage <= 0) {
    return { generalRawDamage: 0, troopDamage: 0, generalRatio: 0, troopRatio: 0 };
  }

  // Tổng quân lực thực tế đang bảo vệ quốc gia / tháp tùng tướng
  const activeTroops = wave ? (wave.troops + (nation.troops || 0)) : (nation.troops || 0);

  // Hết quân (activeTroops <= 0): tướng nhận 100%, quân nhận 0%
  if (activeTroops <= 0) {
    return { generalRawDamage: rawDamage, troopDamage: 0, generalRatio: 1.0, troopRatio: 0 };
  }

  const troopPowerRatio = nation.maxTroops > 0 ? activeTroops / nation.maxTroops : 0;

  let generalRatio = 0.60;
  let troopRatio = 0.40;

  if (troopPowerRatio > 0.60) {
    // Trên 60%: tướng nhận 20%, quân nhận 80%
    generalRatio = 0.20;
    troopRatio = 0.80;
  } else if (troopPowerRatio >= 0.30) {
    // 30% đến 60%: tướng nhận 35%, quân nhận 65%
    generalRatio = 0.35;
    troopRatio = 0.65;
  } else {
    // Dưới 30%: tướng nhận 60%, quân nhận 40%
    generalRatio = 0.60;
    troopRatio = 0.40;
  }

  const generalRawDamage = Math.round(rawDamage * generalRatio);
  const troopDamage = rawDamage - generalRawDamage; // Tổng phần chia bằng đúng rawDamage, không tính hai lần

  return { generalRawDamage, troopDamage, generalRatio, troopRatio };
}

/**
 * Xử lý Đại Tướng nhận sát thương trong giao tranh theo GENERAL SYSTEM 1.2 & 1.3.
 * - Sát thương rawDamage được chia sẻ giữa quân đội và tướng qua calculateDamageShare.
 * - Sửa đúng nguồn quân bị tổn thất: nếu có wave hộ tống, trừ từ wave.troops trước để tránh trừ quân hai lần.
 * - Phần của tướng: giảm theo giáp đúng 1 lần, rồi trừ HP (không để âm).
 * - Khi HP <= 20%: Đại Tướng rút lui về thủ đô, ngừng đợt tiến công (behavior = 'RETREAT').
 * - Khi HP == 0: Đại Tướng chuyển sang INJURED, đưa về thủ đô, không bị xóa (behavior = 'RECOVER').
 */
export function applyGeneralDamage(
  general: General,
  nation: Nation,
  rawDamage: number,
  wave?: AttackWave
): { damageTaken: number; troopDamage: number; retreated: boolean; injured: boolean } {
  if (rawDamage <= 0) {
    return { damageTaken: 0, troopDamage: 0, retreated: false, injured: false };
  }

  // 1. Chia sẻ sát thương giữa Quân Đội và Đại Tướng (General System 1.2 & 1.3)
  const { generalRawDamage, troopDamage } = calculateDamageShare(nation, rawDamage, wave);

  // 2. Sửa đúng nguồn quân bị tổn thất, tránh trừ quân hai lần
  if (troopDamage > 0) {
    if (wave && wave.troops > 0) {
      // Đang dẫn đợt quân: trừ trước vào đợt quân tháp tùng wave.troops
      const deductedFromWave = Math.min(wave.troops, troopDamage);
      wave.troops -= deductedFromWave;
      applyCasualties(nation, deductedFromWave);
      const leftoverTroopDamage = troopDamage - deductedFromWave;
      if (leftoverTroopDamage > 0) {
        nation.troops = Math.max(0, (nation.troops || 0) - leftoverTroopDamage);
        applyCasualties(nation, leftoverTroopDamage);
      }
    } else {
      // Đồn trú tại thủ đô / phòng thủ lãnh thổ: trừ vào quân dự trữ quốc gia (không âm)
      nation.troops = Math.max(0, (nation.troops || 0) - troopDamage);
      applyCasualties(nation, troopDamage);
    }
  }

  // 3. Phần của tướng: giảm theo giáp đúng 1 lần, rồi trừ HP (không âm)
  const effectiveArmor = Math.min(GENERAL_CONSTANTS.MAX_TOTAL_ARMOR, Math.max(0, general.armor || GENERAL_CONSTANTS.BASE_ARMOR));
  const damageTaken = generalRawDamage > 0 ? Math.max(1, Math.round(generalRawDamage * (1 - effectiveArmor))) : 0;

  general.hp = Math.max(0, general.hp - damageTaken);

  // Trường hợp HP về 0: Bị thương nặng (INJURED)
  if (general.hp === 0) {
    changeGeneralLoyalty(general, -5, 'Trọng thương HP = 0');
    general.status = 'INJURED';
    general.healthState = 'INJURED';
    general.behavior = 'RECOVER';
    general.x = nation.capitalX;
    general.y = nation.capitalY;
    general.marchingWaveId = undefined;
    return { damageTaken, troopDamage, retreated: true, injured: true };
  }

  // Trường hợp HP <= 20%: Ưu tiên rút lui bảo toàn tính mạng
  if (general.hp <= general.maxHp * GENERAL_CONSTANTS.RETREAT_HP_RATIO) {
    changeGeneralLoyalty(general, -2, 'Rút lui bảo toàn tính mạng');
    general.status = 'IDLE';
    general.healthState = 'RECOVERING';
    general.behavior = 'RETREAT';
    general.x = nation.capitalX;
    general.y = nation.capitalY;
    general.marchingWaveId = undefined;
    return { damageTaken, troopDamage, retreated: true, injured: false };
  }

  // Cập nhật healthState nếu dưới ngưỡng triển khai (60%)
  if (general.hp < general.maxHp * GENERAL_CONSTANTS.DEPLOY_MIN_HP_RATIO) {
    general.healthState = 'RECOVERING';
    if (general.behavior !== 'RETREAT') {
      general.behavior = 'RECOVER';
    }
  }

  return { damageTaken, troopDamage, retreated: false, injured: false };
}

/**
 * Xử lý chu kỳ hồi phục của Đại Tướng (gọi mỗi giây):
 * - Hồi 3% HP tối đa mỗi giây khi ở vùng an toàn.
 * - Không hồi khi đang chiến đấu (MARCHING) hoặc ở vùng nguy hiểm.
 * - Đạt >= 60% HP mới chuyển sang HEALTHY và sẵn sàng triển khai lại.
 */
export function processGeneralRecoveryTick(
  general: General,
  nation: Nation,
  isSafeZone: boolean
): { recovered: number; stateChanged: boolean } {
  // Không hồi phục nếu đang hành quân chiến đấu hoặc không ở vùng an toàn hoặc quốc gia đã bị loại
  if (!isSafeZone || general.status === 'MARCHING' || nation.isEliminated) {
    return { recovered: 0, stateChanged: false };
  }

  // Đã đầy máu
  if (general.hp >= general.maxHp) {
    general.hp = general.maxHp;
    if (general.healthState !== 'HEALTHY') {
      general.healthState = 'HEALTHY';
      if (general.status === 'INJURED' || general.status === 'RECOVERING') {
        general.status = 'IDLE';
      }
      return { recovered: 0, stateChanged: true };
    }
    return { recovered: 0, stateChanged: false };
  }

  // Hồi 3% HP tối đa mỗi giây
  const recoveryAmount = Math.max(1, Math.round(general.maxHp * GENERAL_CONSTANTS.RECOVERY_RATE_PER_SECOND));
  general.hp = Math.min(general.maxHp, general.hp + recoveryAmount);

  let stateChanged = false;

  // Khi đạt từ 60% HP trở lên: Chuyển sang HEALTHY và cho phép xuất trận lại
  if (general.hp >= general.maxHp * GENERAL_CONSTANTS.DEPLOY_MIN_HP_RATIO) {
    if (general.healthState !== 'HEALTHY') {
      general.healthState = 'HEALTHY';
      stateChanged = true;
    }
    if (general.status === 'INJURED' || general.status === 'RECOVERING') {
      general.status = 'IDLE';
      stateChanged = true;
    }
  } else {
    // Dưới 60% vẫn duy trì RECOVERING (hoặc INJURED nếu chưa hồi phục đủ)
    if (general.healthState === 'HEALTHY') {
      general.healthState = 'RECOVERING';
      stateChanged = true;
    }
  }

  return { recovered: recoveryAmount, stateChanged };
}

/**
 * Kiểm tra Đại Tướng có đủ điều kiện để triển khai xuất trận hay không.
 * Điều kiện:
 * 1. Tướng có vai trò ACTIVE.
 * 2. Tướng không ở trạng thái INJURED.
 * 3. HP hiện tại phải đạt ít nhất 60% HP tối đa.
 * 4. healthState là HEALTHY và status là IDLE (hoặc MARCHING nếu đang dẫn wave).
 */
export function canDeployGeneral(general?: General | null): boolean {
  if (!general) return false;
  if (general.role && general.role !== 'ACTIVE') return false;
  if (general.status === 'INJURED') return false;
  if (general.behavior === 'RECOVER' || general.behavior === 'RETREAT') return false;

  // Pixel Empire 1.7: Loyalty NGUY_CO_PHAN_BOI (< 30) không được triển khai cùng đợt quân
  const loyalty = typeof general.loyalty === 'number' && Number.isFinite(general.loyalty) ? general.loyalty : 100;
  if (loyalty < 30) return false;

  const minHp = general.maxHp * GENERAL_CONSTANTS.DEPLOY_MIN_HP_RATIO;
  if (general.hp < minHp) return false;

  return general.healthState === 'HEALTHY' && (general.status === 'IDLE' || general.status === 'MARCHING');
}

/**
 * Chuyển đổi dữ liệu tướng cũ từ bản lưu an toàn (Migration)
 */
export function migrateGeneralData(
  raw: any,
  nationId: number,
  fallbackX: number,
  fallbackY: number
): General {
  const baseHp = typeof raw?.baseHp === 'number' && raw.baseHp > 0 ? raw.baseHp : GENERAL_CONSTANTS.BASE_HP;
  const maxHp = typeof raw?.maxHp === 'number' && raw.maxHp > 0 ? raw.maxHp : baseHp;
  const hp = typeof raw?.hp === 'number' ? Math.min(maxHp, Math.max(0, raw.hp)) : maxHp;
  const baseArmor = typeof raw?.baseArmor === 'number' ? raw.baseArmor : GENERAL_CONSTANTS.BASE_ARMOR;
  const armor = typeof raw?.armor === 'number' ? Math.min(GENERAL_CONSTANTS.MAX_TOTAL_ARMOR, raw.armor) : baseArmor;
  const baseAttack = typeof raw?.baseAttack === 'number' && raw.baseAttack > 0 ? raw.baseAttack : GENERAL_CONSTANTS.BASE_ATTACK;
  const attack = typeof raw?.attack === 'number' && raw.attack > 0 ? raw.attack : baseAttack;

  // Xác định healthState phù hợp với HP
  let healthState: 'HEALTHY' | 'INJURED' | 'RECOVERING' = 'HEALTHY';
  if (hp === 0 || raw?.status === 'INJURED') {
    healthState = 'INJURED';
  } else if (hp < maxHp * GENERAL_CONSTANTS.DEPLOY_MIN_HP_RATIO || raw?.status === 'RECOVERING') {
    healthState = 'RECOVERING';
  }

  let status = raw?.status || 'IDLE';
  if (hp === 0) {
    status = 'INJURED';
  }

  return {
    id: raw?.id || `gen_${nationId}`,
    nationId,
    name: raw?.name || 'Đại Tướng',
    status,
    role: (raw?.role === 'RESERVE' || raw?.role === 'CAPTIVE') ? (raw.role as GeneralRole) : 'ACTIVE',
    healthState,
    behavior: (raw?.behavior as GeneralBehavior) || (healthState === 'HEALTHY' ? 'DEFEND' : 'RECOVER'),
    hp,
    maxHp,
    baseHp,
    armor,
    baseArmor,
    attack,
    baseAttack,
    x: typeof raw?.x === 'number' ? raw.x : fallbackX,
    y: typeof raw?.y === 'number' ? raw.y : fallbackY,
    targetX: raw?.targetX,
    targetY: raw?.targetY,
    combatPowerBonus: typeof raw?.combatPowerBonus === 'number'
      ? Math.min(GENERAL_CONSTANTS.MAX_COMBAT_POWER_BONUS, raw.combatPowerBonus)
      : GENERAL_CONSTANTS.DEFAULT_COMBAT_POWER_BONUS,
    reviveTimer: typeof raw?.reviveTimer === 'number' ? raw.reviveTimer : 0,
    isDeployedToFront: Boolean(raw?.isDeployedToFront),
    skillId: raw?.skillId || 'INSPIRE_AURA',
    skillCooldown: typeof raw?.skillCooldown === 'number' ? raw.skillCooldown : 0,
    skillActiveTimer: typeof raw?.skillActiveTimer === 'number' ? raw.skillActiveTimer : 0,
    marchingWaveId: raw?.marchingWaveId,
    level: typeof raw?.level === 'number' ? Math.max(1, Math.min(GENERAL_CONSTANTS.MAX_LEVEL, raw.level)) : 1,
    exp: typeof raw?.exp === 'number' && raw.exp >= 0 ? raw.exp : 0,
    loyalty: typeof raw?.loyalty === 'number' && Number.isFinite(raw.loyalty) ? Math.max(0, Math.min(100, Math.round(raw.loyalty))) : 100,
    style: sanitizeStyle(raw?.style),
    evolutionStats: sanitizeEvolutionStats(raw?.evolutionStats),
    history: Array.isArray(raw?.history) && raw.history.length > 0 ? raw.history.slice(0, 30) : ['[Khởi Tạo] Nhận nhiệm vụ Thống Soái Quân Đội'],
  };
}

/**
 * PIXEL EMPIRE 1.6: Chuyển Đại Tướng giữa các quốc gia.
 * - Chuyển tướng, KHÔNG copy/clone; tướng chỉ tồn tại ở ĐÚNG 1 nơi.
 * - Giữ nguyên: id, name, loyalty, level, exp, style, evolutionStats, hp, maxHp, armor, attack, skillId, history.
 * - Cập nhật: nationId = toNation.id, status = 'IDLE', marchingWaveId = undefined, x = toNation.capitalX, y = toNation.capitalY, behavior = 'DEFEND'.
 * - Nếu toNation ĐÃ CÓ tướng ACTIVE: tướng chuyển sang trở thành RESERVE và đẩy vào toNation.reserveGenerals.
 * - Nếu toNation CHƯA CÓ tướng ACTIVE: tướng trở thành ACTIVE và gán vào toNation.general.
 * - Xóa tướng khỏi fromNation (nếu là fromNation.general thì = undefined; nếu trong reserveGenerals thì lọc bỏ).
 * - Ghi 1 dòng history: "[Chuyển Quân] Chuyển từ <fromNation.name> sang <toNation.name>".
 * - Tránh trùng lặp: nếu tướng đã thuộc toNation rồi hoặc fromNation.id === toNation.id thì trả về false.
 */
export function transferGeneral(
  general: General,
  fromNation: Nation,
  toNation: Nation
): boolean {
  if (!general || !fromNation || !toNation) return false;
  if (fromNation.id === toNation.id || general.nationId === toNation.id) return false;

  // Khởi tạo mảng reserve nếu chưa có
  if (!Array.isArray(toNation.reserveGenerals)) {
    toNation.reserveGenerals = [];
  }
  if (!Array.isArray(fromNation.reserveGenerals)) {
    fromNation.reserveGenerals = [];
  }

  // Tránh trùng lặp: nếu tướng đã thuộc toNation rồi
  const toHasGeneral = toNation.general?.id === general.id;
  const toHasInReserve = toNation.reserveGenerals.some(g => g.id === general.id);
  if (toHasGeneral || toHasInReserve) {
    return false;
  }

  // Kiểm tra tướng có thực sự thuộc fromNation không (ACTIVE hoặc trong reserve)
  const fromHasActive = fromNation.general?.id === general.id;
  const fromHasReserve = fromNation.reserveGenerals.some(g => g.id === general.id);
  if (!fromHasActive && !fromHasReserve) {
    return false;
  }

  // Nếu toNation đã có ACTIVE và danh sách reserve đã đạt tối đa (3):
  // Phải từ chối thao tác, giữ nguyên dữ liệu, KHÔNG dùng slice()!
  if (toNation.general && toNation.general.role === 'ACTIVE' && toNation.reserveGenerals.length >= MAX_RESERVE_GENERALS) {
    return false;
  }

  // ĐÃ KIỂM TRA ĐỦ ĐIỀU KIỆN TRƯỚC -> THỰC HIỆN NGUYÊN TỬ:

  // 1. Xóa tướng khỏi fromNation
  if (fromNation.general?.id === general.id) {
    fromNation.general = undefined;
  }
  fromNation.reserveGenerals = fromNation.reserveGenerals.filter(g => g.id !== general.id);

  // 2. Cập nhật các trường bắt buộc của tướng được chuyển
  general.nationId = toNation.id;
  general.status = 'IDLE';
  general.marchingWaveId = undefined;
  general.x = toNation.capitalX;
  general.y = toNation.capitalY;
  general.behavior = 'DEFEND';

  // 3. Phân bổ vào toNation:
  // Nếu toNation ĐÃ CÓ tướng ACTIVE: tướng chuyển sang trở thành RESERVE và đẩy vào toNation.reserveGenerals.
  // Nếu toNation CHƯA CÓ tướng ACTIVE: tướng trở thành ACTIVE và gán vào toNation.general.
  if (toNation.general && toNation.general.role === 'ACTIVE') {
    general.role = 'RESERVE';
    toNation.reserveGenerals.push(general);
  } else {
    general.role = 'ACTIVE';
    toNation.general = general;
  }

  // 4. Ghi 1 dòng history
  general.history = general.history || [];
  general.history.unshift(`[Chuyển Quân] Chuyển từ ${fromNation.name} sang ${toNation.name}`);
  if (general.history.length > 30) {
    general.history.pop();
  }

  // 5. Chống trùng lặp tuyệt đối (KHÔNG DÙNG SLICE XÓA TƯỚNG)
  toNation.reserveGenerals = toNation.reserveGenerals.filter(
    (g, idx, arr) => (!toNation.general || g.id !== toNation.general.id) && arr.findIndex(x => x.id === g.id) === idx
  );

  return true;
}

/**
 * PIXEL EMPIRE 1.7: Bổ nhiệm tướng RESERVE thành ACTIVE của quốc gia.
 * - Đưa tướng RESERVE thành ACTIVE, tướng ACTIVE cũ thành RESERVE (đưa vào reserveGenerals).
 * - Không bổ nhiệm nếu tướng ACTIVE hiện tại hoặc tướng dự bị đang MARCHING (trả về false).
 * - Không hồi HP, không reset EXP/Level/Loyalty/Evolution/history.
 * - Không đổi x, y, nationId (tướng không di chuyển khi đổi vị trí).
 * - Chống trùng: mỗi tướng chỉ ở đúng 1 chỗ (nation.general hoặc reserveGenerals). Mỗi quốc gia tối đa 1 ACTIVE.
 */
export function appointReserveGeneral(
  nation: Nation,
  reserveGeneralId: string
): boolean {
  if (!nation || !reserveGeneralId) {
    console.warn('[appointReserveGeneral] Tham số quốc gia hoặc reserveGeneralId không hợp lệ.');
    return false;
  }

  nation.reserveGenerals = nation.reserveGenerals || [];

  // Tìm tướng dự bị trong danh sách reserve
  const reserveIdx = nation.reserveGenerals.findIndex(g => g.id === reserveGeneralId);
  if (reserveIdx === -1) {
    console.warn(`[appointReserveGeneral] Không tìm thấy tướng dự bị có ID: ${reserveGeneralId}`);
    return false;
  }

  const reserveGen = nation.reserveGenerals[reserveIdx];
  const currentActive = nation.general;

  // Không được bổ nhiệm nếu tướng ACTIVE hiện tại hoặc tướng dự bị đang MARCHING
  if (reserveGen.status === 'MARCHING' || reserveGen.marchingWaveId) {
    console.warn(`[appointReserveGeneral] Tướng dự bị (${reserveGen.name}) đang hành quân, không thể bổ nhiệm!`);
    return false;
  }

  if (currentActive && (currentActive.status === 'MARCHING' || currentActive.marchingWaveId)) {
    console.warn(`[appointReserveGeneral] Tướng ACTIVE hiện tại (${currentActive.name}) đang hành quân, không thể thay thế!`);
    return false;
  }

  // 1. Tách tướng dự bị ra khỏi danh sách reserveGenerals
  nation.reserveGenerals.splice(reserveIdx, 1);

  // 2. Chuyển tướng ACTIVE cũ thành RESERVE và đưa vào reserveGenerals (nếu có)
  if (currentActive) {
    currentActive.role = 'RESERVE';
    currentActive.history = currentActive.history || [];
    currentActive.history.unshift(`[Bãi Nhiệm] Chuyển vị trí sang lực lượng dự bị`);
    if (currentActive.history.length > 30) currentActive.history.pop();
    nation.reserveGenerals.push(currentActive);
  }

  // 3. Tướng dự bị trở thành ACTIVE chính thức của quốc gia
  // Không hồi HP, không reset EXP/Level/Loyalty/Evolution/history. Không đổi x, y, nationId.
  reserveGen.role = 'ACTIVE';
  reserveGen.history = reserveGen.history || [];
  reserveGen.history.unshift(`[Bổ Nhiệm] Được bổ nhiệm làm Thống Soái chính thức`);
  if (reserveGen.history.length > 30) reserveGen.history.pop();

  nation.general = reserveGen;

  // 4. Chống trùng lặp tuyệt đối (KHÔNG DÙNG SLICE XÓA TƯỚNG)
  nation.reserveGenerals = nation.reserveGenerals.filter(
    (g, idx, arr) => (!nation.general || g.id !== nation.general.id) && arr.findIndex(x => x.id === g.id) === idx
  );

  return true;
}

/**
 * PIXEL EMPIRE 2.0: Bắt Đại Tướng khi thất thủ Thủ đô (Xử lý nguyên tử & không dùng slice).
 * - Chỉ bắt khi:
 *   • defender.capitalCaptured KHÔNG phải true (thủ đô thất thủ chỉ xử lý một lần).
 *   • defender.general tồn tại, role ACTIVE, status KHÔNG phải MARCHING (và không có marchingWaveId).
 *   • defender.general.level >= 2 (Lv1 chưa có danh tiếng).
 *   • attacker.id !== defender.id.
 *   • Giới hạn 3 RESERVE:
 *     - Nếu attacker đã có ACTIVE: attacker.reserveGenerals < MAX_RESERVE_GENERALS (3).
 *     - Nếu attacker chưa có ACTIVE:
 *       + Ưu tiên bổ nhiệm 1 tướng dự bị lên ACTIVE -> giải phóng 1 vị trí trong reserve.
 *       + Nếu không có dự bị, tạo tướng thay thế Lv1.
 *       + Tướng bị bắt vẫn phải nằm trong RESERVE của attacker.
 * - Giữ đúng HP, EXP, Level, Loyalty (<= 40) và Evolution. Không hồi máu.
 * - Defender luôn có ACTIVE thay thế (ưu tiên tướng dự bị level cao nhất, hoặc tạo mới Lv1).
 * - Đảm bảo không bên nào mất chỉ huy, không vượt 3 RESERVE, không mất hoặc nhân bản tướng.
 * - Xử lý nguyên tử: kiểm tra đủ điều kiện trước, chỉ thay đổi dữ liệu khi toàn bộ giao dịch thành công.
 */
export function captureGeneralOnCapitalFall(
  attacker: Nation,
  defender: Nation
): { captured: boolean; capturedName?: string; replacementName?: string } {
  if (!attacker || !defender) return { captured: false };
  if (attacker.id === defender.id) return { captured: false };

  // 1. Thủ đô thất thủ chỉ xử lý một lần
  if (defender.capitalCaptured) {
    return { captured: false };
  }

  const targetGen = defender.general;
  if (!targetGen) return { captured: false };
  if (targetGen.role !== 'ACTIVE') return { captured: false };
  if (targetGen.status === 'MARCHING' || targetGen.marchingWaveId) return { captured: false };

  const genLevel = targetGen.level || 1;
  if (genLevel < 2) return { captured: false };

  if (targetGen.nationId !== defender.id) return { captured: false };

  attacker.reserveGenerals = attacker.reserveGenerals || [];
  defender.reserveGenerals = defender.reserveGenerals || [];

  // Tránh trùng lặp: targetGen đã có mặt ở attacker
  if (attacker.general?.id === targetGen.id || attacker.reserveGenerals.some(g => g.id === targetGen.id)) {
    return { captured: false };
  }

  const attackerHasActive = Boolean(attacker.general && attacker.general.role === 'ACTIVE');

  // Kiểm tra giới hạn 3 RESERVE của attacker trước khi xử lý (KHÔNG DÙNG SLICE):
  // - Nếu attacker đã có ACTIVE: cần reserveGenerals.length < MAX_RESERVE_GENERALS (3)
  // - Nếu attacker chưa có ACTIVE:
  //   + Có dự bị: sẽ bổ nhiệm 1 tướng dự bị lên ACTIVE (length - 1), sau đó nhận targetGen vào dự bị -> (length - 1) + 1 = length.
  //     Nếu length > MAX_RESERVE_GENERALS thì không đủ chỗ -> từ chối!
  //   + Không có dự bị (hoặc tất cả dự bị đang MARCHING): sẽ tạo mới tướng Lv1 ACTIVE, dự bị hiện tại giữ nguyên length.
  //     Sau đó nhận targetGen -> length + 1. Cần length < MAX_RESERVE_GENERALS -> nếu length >= MAX_RESERVE_GENERALS thì từ chối!
  const eligibleAttackerReserves = attacker.reserveGenerals.filter(
    g => g.status !== 'MARCHING' && !g.marchingWaveId
  );

  if (attackerHasActive) {
    if (attacker.reserveGenerals.length >= MAX_RESERVE_GENERALS) {
      return { captured: false };
    }
  } else {
    if (eligibleAttackerReserves.length > 0) {
      if (attacker.reserveGenerals.length > MAX_RESERVE_GENERALS) {
        return { captured: false };
      }
    } else {
      if (attacker.reserveGenerals.length >= MAX_RESERVE_GENERALS) {
        return { captured: false };
      }
    }
  }

  // TẤT CẢ ĐIỀU KIỆN ĐÃ ĐẠT -> BẮT ĐẦU GIAO DỊCH NGUYÊN TỬ:

  // Bước 1: Xử lý chỉ huy cho attacker nếu attacker chưa có ACTIVE
  if (!attackerHasActive) {
    if (attacker.general) {
      const oldGen = attacker.general;
      attacker.general = undefined;
      oldGen.role = 'RESERVE';
      if (!attacker.reserveGenerals.some(g => g.id === oldGen.id)) {
        attacker.reserveGenerals.push(oldGen);
      }
    }

    let appointed = false;
    if (eligibleAttackerReserves.length > 0) {
      eligibleAttackerReserves.sort((a, b) => (b.level || 1) - (a.level || 1));
      for (const cand of eligibleAttackerReserves) {
        appointed = appointReserveGeneral(attacker, cand.id);
        if (appointed) break;
      }
    }

    const currentAtkGen = attacker.general as General | undefined;
    if (!appointed || !currentAtkGen || currentAtkGen.role !== 'ACTIVE') {
      const rosterItem = GENERAL_ROSTER[Math.floor(Math.random() * GENERAL_ROSTER.length)] || GENERAL_ROSTER[0];
      const uniqueId = `gen_${attacker.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const newGen = createDefaultGeneral(
        uniqueId,
        attacker.id,
        rosterItem.name,
        rosterItem.skillId,
        attacker.capitalX,
        attacker.capitalY
      );
      newGen.role = 'ACTIVE';
      newGen.level = 1;
      newGen.exp = 0;
      attacker.general = newGen;
    }
  }

  const capturedName = targetGen.name;

  // Bước 2: Chuyển tướng sang attacker thông qua transferGeneral
  const transferOk = transferGeneral(targetGen, defender, attacker);
  if (!transferOk) {
    return { captured: false };
  }

  // Bước 3: Đảm bảo tướng bị bắt luôn là RESERVE trong attacker.reserveGenerals
  targetGen.role = 'RESERVE';
  if (attacker.general?.id === targetGen.id) {
    attacker.general = undefined;
    if (!attacker.reserveGenerals.some(g => g.id === targetGen.id)) {
      attacker.reserveGenerals.push(targetGen);
    }
    const otherRes = attacker.reserveGenerals.filter(
      g => g.id !== targetGen.id && g.status !== 'MARCHING' && !g.marchingWaveId
    );
    if (otherRes.length > 0) {
      otherRes.sort((a, b) => (b.level || 1) - (a.level || 1));
      appointReserveGeneral(attacker, otherRes[0].id);
    }
    const finalAtkGen = attacker.general as General | undefined;
    if (!finalAtkGen || finalAtkGen.role !== 'ACTIVE') {
      const rosterItem = GENERAL_ROSTER[Math.floor(Math.random() * GENERAL_ROSTER.length)] || GENERAL_ROSTER[0];
      const uniqueId = `gen_${attacker.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const newGen = createDefaultGeneral(
        uniqueId,
        attacker.id,
        rosterItem.name,
        rosterItem.skillId,
        attacker.capitalX,
        attacker.capitalY
      );
      newGen.role = 'ACTIVE';
      newGen.level = 1;
      newGen.exp = 0;
      attacker.general = newGen;
    }
  } else {
    if (!attacker.reserveGenerals.some(g => g.id === targetGen.id)) {
      attacker.reserveGenerals.push(targetGen);
    }
  }

  // Bước 4: Đặt loyalty của tướng bị bắt = Math.min(loyalty hiện tại, 40)
  const curLoyalty = typeof targetGen.loyalty === 'number' && Number.isFinite(targetGen.loyalty) ? targetGen.loyalty : 100;
  targetGen.loyalty = Math.min(curLoyalty, 40);

  // Bước 5: Thêm history: "[Bị Bắt] Bị bắt khi <defender.name> thất thủ Thủ đô"
  targetGen.history = targetGen.history || [];
  targetGen.history.unshift(`[Bị Bắt] Bị bắt khi ${defender.name} thất thủ Thủ đô`);
  if (targetGen.history.length > 30) {
    targetGen.history.pop();
  }

  // Bước 6: Bên bị mất tướng (defender) tự có người thay thế
  let replacementName: string | undefined = undefined;
  if (defender.reserveGenerals.length > 0) {
    const eligibleDefenderReserves = defender.reserveGenerals.filter(
      g => g.status !== 'MARCHING' && !g.marchingWaveId
    );
    if (eligibleDefenderReserves.length > 0) {
      const sorted = [...eligibleDefenderReserves].sort((a, b) => (b.level || 1) - (a.level || 1));
      const bestReserve = sorted[0];
      const appointOk = appointReserveGeneral(defender, bestReserve.id);
      if (appointOk) {
        replacementName = defender.general?.name;
      }
    }
  }

  if (!defender.general || defender.general.role !== 'ACTIVE') {
    const rosterItem = GENERAL_ROSTER[Math.floor(Math.random() * GENERAL_ROSTER.length)] || GENERAL_ROSTER[0];
    const uniqueId = `gen_${defender.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const newGen = createDefaultGeneral(
      uniqueId,
      defender.id,
      rosterItem.name,
      rosterItem.skillId,
      defender.capitalX,
      defender.capitalY
    );
    newGen.role = 'ACTIVE';
    newGen.level = 1;
    newGen.exp = 0;
    defender.general = newGen;
    replacementName = newGen.name;
  }

  // Bước 7: Chống trùng lặp tuyệt đối cho cả hai bên (KHÔNG DÙNG SLICE)
  for (const nat of [attacker, defender]) {
    nat.reserveGenerals = (nat.reserveGenerals || []).filter(
      (g, idx, arr) => (!nat.general || g.id !== nat.general.id) && arr.findIndex(x => x.id === g.id) === idx
    );
  }

  // Bước 8: Đánh dấu thủ đô đã thất thủ (chỉ xử lý bắt tướng một lần)
  defender.capitalCaptured = true;

  return {
    captured: true,
    capturedName,
    replacementName,
  };
}
