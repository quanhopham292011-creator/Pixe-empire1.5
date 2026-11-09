import { General, Nation, PlayerProfile, GeneralSkillId } from '../types';

/**
 * PIXEL EMPIRE – GENERAL SYSTEM 1.1
 * Cấu hình chỉ số chuẩn & Giới hạn cân bằng cho Đại Tướng
 */
export const GENERAL_CONSTANTS = {
  // Chỉ số cơ bản
  BASE_HP: 1000,
  BASE_ARMOR: 0.20, // 20%
  BASE_ATTACK: 90,

  // Giới hạn cân bằng (Caps)
  MAX_HP_BONUS_RATIO: 0.25, // HP tăng tối đa 25% (maxHp <= 1250)
  MAX_ATTACK_BONUS_RATIO: 0.20, // Sát thương tăng tối đa 20% (attack <= 108)
  MAX_ARMOR_BONUS: 0.15, // Giáp nhận thêm tối đa 15 điểm phần trăm (+15%)
  MAX_TOTAL_ARMOR: 0.60, // Tổng giáp tuyệt đối không vượt 60%

  // Ngưỡng sinh tồn & Hồi phục
  RETREAT_HP_RATIO: 0.20, // Rút lui khi HP <= 20% (200 HP)
  DEPLOY_MIN_HP_RATIO: 0.60, // Cần ít nhất 60% HP mới được triển khai lại (600 HP)
  RECOVERY_RATE_PER_SECOND: 0.03, // Hồi 3% HP tối đa mỗi giây ở vùng an toàn
} as const;

/**
 * Khởi tạo dữ liệu Đại Tướng mặc định chuẩn v1.1
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
    hp: GENERAL_CONSTANTS.BASE_HP,
    maxHp: GENERAL_CONSTANTS.BASE_HP,
    baseHp: GENERAL_CONSTANTS.BASE_HP,
    armor: GENERAL_CONSTANTS.BASE_ARMOR,
    baseArmor: GENERAL_CONSTANTS.BASE_ARMOR,
    attack: GENERAL_CONSTANTS.BASE_ATTACK,
    baseAttack: GENERAL_CONSTANTS.BASE_ATTACK,
    x: spawnX,
    y: spawnY,
    combatPowerBonus: 0.30,
    reviveTimer: 0,
    isDeployedToFront: false,
    skillId,
    skillCooldown: 0,
    skillActiveTimer: 0,
    level: 1,
    exp: 0,
    loyalty: 100,
    history: [],
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

  // Tính bonus từ Skill Tree & Cấp độ người chơi (nếu là quốc gia người chơi)
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

  // Tính bonus từ Công nghệ của Quốc gia (cho cả Người chơi và AI / Boss)
  if (nation.techLevels) {
    // Công nghệ Phòng Thủ: Tăng giáp và HP
    const defLvl = nation.techLevels.defense || 0;
    armorBonus += defLvl * 0.03; // Cấp 1: +3%, Cấp 2: +6%, Cấp 3: +9%
    hpBonusRatio += defLvl * 0.03;

    // Công nghệ Quân Sự: Tăng Sát thương
    const milLvl = nation.techLevels.military || 0;
    attackBonusRatio += milLvl * 0.04; // Cấp 1: +4%, Cấp 2: +8%, Cấp 3: +12%
  }

  // Nếu là Boss: Có một chút tăng cường chỉ số cơ bản
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

  // Khởi tạo hoặc giới hạn HP hiện tại
  if (general.hp === undefined || general.hp === null) {
    general.hp = general.maxHp;
  } else {
    general.hp = Math.min(general.maxHp, Math.max(0, general.hp));
  }

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
 * Xử lý Đại Tướng nhận sát thương trong giao tranh.
 * Công thức: damageTaken = round(rawDamage * (1 - armor))
 * - Khi HP <= 20%: Đại Tướng rút lui về thủ đô, ngừng đợt tiến công.
 * - Khi HP == 0: Đại Tướng chuyển sang INJURED, đưa về thủ đô, không bị xóa.
 */
export function applyGeneralDamage(
  general: General,
  nation: Nation,
  rawDamage: number
): { damageTaken: number; retreated: boolean; injured: boolean } {
  // Đảm bảo giáp nằm trong giới hạn [0, MAX_TOTAL_ARMOR]
  const effectiveArmor = Math.min(GENERAL_CONSTANTS.MAX_TOTAL_ARMOR, Math.max(0, general.armor || GENERAL_CONSTANTS.BASE_ARMOR));
  const damageTaken = Math.max(1, Math.round(rawDamage * (1 - effectiveArmor)));

  general.hp = Math.max(0, general.hp - damageTaken);

  // Trường hợp HP về 0: Bị thương nặng (INJURED)
  if (general.hp === 0) {
    general.status = 'INJURED';
    general.healthState = 'INJURED';
    general.x = nation.capitalX;
    general.y = nation.capitalY;
    general.marchingWaveId = undefined;
    return { damageTaken, retreated: true, injured: true };
  }

  // Trường hợp HP <= 20%: Ưu tiên rút lui bảo toàn tính mạng
  if (general.hp <= general.maxHp * GENERAL_CONSTANTS.RETREAT_HP_RATIO) {
    general.status = 'IDLE';
    general.healthState = 'RECOVERING';
    general.x = nation.capitalX;
    general.y = nation.capitalY;
    general.marchingWaveId = undefined;
    return { damageTaken, retreated: true, injured: false };
  }

  // Cập nhật healthState nếu dưới ngưỡng triển khai (60%)
  if (general.hp < general.maxHp * GENERAL_CONSTANTS.DEPLOY_MIN_HP_RATIO) {
    general.healthState = 'RECOVERING';
  }

  return { damageTaken, retreated: false, injured: false };
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
    role: 'ACTIVE', // Mặc định chỉ 1 tướng ACTIVE cho quốc gia
    healthState,
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
    combatPowerBonus: typeof raw?.combatPowerBonus === 'number' ? raw.combatPowerBonus : 0.30,
    reviveTimer: typeof raw?.reviveTimer === 'number' ? raw.reviveTimer : 0,
    isDeployedToFront: Boolean(raw?.isDeployedToFront),
    skillId: raw?.skillId || 'INSPIRE_AURA',
    skillCooldown: typeof raw?.skillCooldown === 'number' ? raw.skillCooldown : 0,
    skillActiveTimer: typeof raw?.skillActiveTimer === 'number' ? raw.skillActiveTimer : 0,
    marchingWaveId: raw?.marchingWaveId,
    level: raw?.level || 1,
    exp: raw?.exp || 0,
    loyalty: raw?.loyalty || 100,
    history: Array.isArray(raw?.history) ? raw.history : [],
  };
}
