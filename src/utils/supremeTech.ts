import {
  FighterPlane,
  MissileType,
  Nation,
  ResearchingTech,
  SupremeTechBranch,
  SupremeTechLevels,
  Tile,
} from '../types';
import {
  MISSILE_CONFIG,
  SUPREME_TECH_CONFIG,
  SupremeTechItem,
} from '../data/gameData';

export function createEmptySupremeTechLevels(): SupremeTechLevels {
  return { economy: 0, military: 0, defense: 0 };
}

export function ensureNationSupremeTech(nation?: Nation | null): void {
  if (!nation) return;
  if (typeof nation.supremeTechUnlocked !== 'boolean') {
    nation.supremeTechUnlocked = false;
  }
  const lv = nation.supremeTechLevels;
  if (!lv || typeof lv !== 'object') {
    nation.supremeTechLevels = createEmptySupremeTechLevels();
  } else {
    lv.economy = Math.max(0, Math.min(SUPREME_TECH_CONFIG.MAX_LEVEL, Math.floor(lv.economy || 0)));
    lv.military = Math.max(0, Math.min(SUPREME_TECH_CONFIG.MAX_LEVEL, Math.floor(lv.military || 0)));
    lv.defense = Math.max(0, Math.min(SUPREME_TECH_CONFIG.MAX_LEVEL, Math.floor(lv.defense || 0)));
  }
}

export function findSupremeTechById(techId?: string | null): SupremeTechItem | undefined {
  if (!techId) return undefined;
  return SUPREME_TECH_CONFIG.TECHS.find((t) => t.id === techId);
}

export function isSupremeTechId(techId?: string | null): boolean {
  return Boolean(findSupremeTechById(techId));
}

export function getSupremeBranchLevel(
  nation: Nation | null | undefined,
  branch: SupremeTechBranch
): number {
  if (!nation?.supremeTechLevels) return 0;
  return Math.max(
    0,
    Math.min(SUPREME_TECH_CONFIG.MAX_LEVEL, Math.floor(nation.supremeTechLevels[branch] || 0))
  );
}

export function canStartSupremeResearch(
  nation: Nation | null | undefined,
  techId: string,
  currentResearching: ResearchingTech | null | undefined
): { ok: boolean; reason?: string; tech?: SupremeTechItem } {
  const tech = findSupremeTechById(techId);
  if (!tech) return { ok: false, reason: 'Công nghệ không tồn tại.' };
  if (!nation) return { ok: false, reason: 'Không tìm thấy quốc gia.' };
  if (!nation.supremeTechUnlocked) {
    return { ok: false, reason: 'Cần xây Đại Học Viện' };
  }
  const curLvl = getSupremeBranchLevel(nation, tech.branchKey);
  if (curLvl >= tech.level) {
    return { ok: false, reason: 'Đã xong', tech };
  }
  if (curLvl < tech.level - 1) {
    return { ok: false, reason: 'Cần học xong cấp trước', tech };
  }
  if (currentResearching) {
    if (currentResearching.techId === tech.id) {
      return { ok: false, reason: 'Đang học', tech };
    }
    return { ok: false, reason: 'Đang bận nghiên cứu khác', tech };
  }
  const gold = Math.floor(nation.gold || 0);
  const oil = Math.floor(nation.oil || 0);
  const minerals = Math.floor(nation.minerals || 0);
  if (gold < tech.cost) return { ok: false, reason: 'Thiếu Vàng', tech };
  if (oil < tech.oilCost) return { ok: false, reason: 'Thiếu Dầu', tech };
  if (minerals < tech.mineralCost) return { ok: false, reason: 'Thiếu Khoáng sản', tech };
  return { ok: true, tech };
}

export function startSupremeResearchForNation(
  nation: Nation,
  techId: string,
  currentResearching?: ResearchingTech | null
): { ok: boolean; reason?: string; researching?: ResearchingTech; tech?: SupremeTechItem } {
  ensureNationSupremeTech(nation);
  const check = canStartSupremeResearch(nation, techId, currentResearching);
  if (!check.ok || !check.tech) {
    return { ok: false, reason: check.reason, tech: check.tech };
  }
  const tech = check.tech;
  nation.gold -= tech.cost;
  nation.oil = Math.max(0, (nation.oil || 0) - tech.oilCost);
  nation.minerals = Math.max(0, (nation.minerals || 0) - tech.mineralCost);
  return {
    ok: true,
    tech,
    researching: {
      techId: tech.id,
      remainingTime: tech.researchTime,
      totalTime: tech.researchTime,
    },
  };
}

export function applySupremeResearchCompletion(
  nation: Nation | null | undefined,
  techId: string
): SupremeTechItem | null {
  const tech = findSupremeTechById(techId);
  if (!nation || !tech) return null;
  ensureNationSupremeTech(nation);
  nation.supremeTechUnlocked = true;
  nation.supremeTechLevels![tech.branchKey] = Math.max(
    nation.supremeTechLevels![tech.branchKey] || 0,
    tech.level
  );
  return tech;
}

// ==================== 9 CƠ CHẾ / TÍNH NĂNG CÔNG NGHỆ TỐI THƯỢNG ====================

/** Kinh tế 1 - Khai Thác Tối Ưu: +25% sản lượng Dầu & Khoáng sản */
export function getSupremeResourceProdMult(nation?: Nation | null): number {
  return getSupremeBranchLevel(nation, 'economy') >= 1
    ? 1 + SUPREME_TECH_CONFIG.EFFECTS.ECONOMY_1_RESOURCE_PROD_BONUS
    : 1.0;
}

/** Kinh tế 1 - Khai Thác Tối Ưu: +5% thu nhập Vàng (chỉ +5%, không cộng dồn) */
export function getSupremeGoldIncomeMult(nation?: Nation | null): number {
  return getSupremeBranchLevel(nation, 'economy') >= 1
    ? 1 + SUPREME_TECH_CONFIG.EFFECTS.ECONOMY_1_GOLD_INCOME_BONUS
    : 1.0;
}

/** Kinh tế 2 & 3 - Mỏ / Giàn Dầu Cao Cấp: giới hạn 2 (cấp 2) hoặc 4 (cấp 3) */
export const ADVANCED_EXTRACTOR_MINERAL_COST = SUPREME_TECH_CONFIG.EFFECTS.ADVANCED_EXTRACTOR_MINERAL_COST;

export function getMaxAdvancedExtractors(nation?: Nation | null): number {
  const ecoLvl = getSupremeBranchLevel(nation, 'economy');
  if (ecoLvl >= 3) return SUPREME_TECH_CONFIG.EFFECTS.ECONOMY_3_ADVANCED_EXTRACTOR_LIMIT;
  if (ecoLvl >= 2) return SUPREME_TECH_CONFIG.EFFECTS.ECONOMY_2_ADVANCED_EXTRACTOR_LIMIT;
  return 0;
}

export function countAdvancedExtractors(tiles: Tile[][], nationId: number): number {
  if (!tiles || nationId <= 0) return 0;
  let count = 0;
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const t = row[x];
      if (t && t.owner === nationId && (t.building === 'OIL_RIG' || t.building === 'MINE') && t.isAdvancedExtractor) {
        count++;
      }
    }
  }
  return count;
}

export function canUpgradeAdvancedExtractor(
  tile: Tile | null | undefined,
  nation: Nation | null | undefined,
  tiles: Tile[][]
): { ok: boolean; reason?: string; current: number; max: number; mineralCost: number } {
  const max = getMaxAdvancedExtractors(nation);
  const current = nation ? countAdvancedExtractors(tiles, nation.id) : 0;
  const mineralCost = ADVANCED_EXTRACTOR_MINERAL_COST;
  if (!nation || !tile) return { ok: false, reason: 'Không hợp lệ.', current, max, mineralCost };
  if (tile.owner !== nation.id) return { ok: false, reason: 'Phải thuộc sở hữu của bạn.', current, max, mineralCost };
  if (tile.building !== 'OIL_RIG' && tile.building !== 'MINE') {
    return { ok: false, reason: 'Chỉ nâng cấp được Giàn Dầu hoặc Mỏ Khoáng.', current, max, mineralCost };
  }
  if (tile.inactiveTimer && tile.inactiveTimer > 0) {
    return { ok: false, reason: 'Công trình chưa hoạt động.', current, max, mineralCost };
  }
  if (tile.isAdvancedExtractor) {
    return { ok: false, reason: 'Đã là bản Cao Cấp.', current, max, mineralCost };
  }
  if (max <= 0) {
    return { ok: false, reason: 'Cần Kinh Tế Tối Thượng Cấp 2.', current, max, mineralCost };
  }
  if (current >= max) {
    return { ok: false, reason: `Đã đạt giới hạn ${current}/${max}.`, current, max, mineralCost };
  }
  if ((nation.minerals || 0) < mineralCost) {
    return { ok: false, reason: `Thiếu ${Math.ceil(mineralCost - (nation.minerals || 0))} Khoáng sản.`, current, max, mineralCost };
  }
  return { ok: true, current, max, mineralCost };
}

export function upgradeAdvancedExtractor(
  tile: Tile,
  nation: Nation,
  tiles: Tile[][]
): { ok: boolean; message: string } {
  const check = canUpgradeAdvancedExtractor(tile, nation, tiles);
  if (!check.ok) return { ok: false, message: check.reason || 'Không thể nâng cấp.' };
  nation.minerals = Math.max(0, (nation.minerals || 0) - check.mineralCost);
  tile.isAdvancedExtractor = true;
  return {
    ok: true,
    message: `⭐ Đã nâng cấp lên bản Cao Cấp (x1.5 sản lượng, ${check.current + 1}/${check.max})!`,
  };
}

/** Quân sự 1 - Nâng cấp tên lửa Hydro (để lại Vùng Cháy) */
export function hasUpgradedHydro(nation?: Nation | null): boolean {
  return getSupremeBranchLevel(nation, 'military') >= 1;
}

export const SUPREME_MISSILE_PRICE_MULT = SUPREME_TECH_CONFIG.EFFECTS.SUPREME_MISSILE_PRICE_MULT;

export function getMissileEffectiveCost(
  missileType: MissileType,
  nation?: Nation | null
): { cost: number; oilCost: number; mineralCost: number } {
  const base = MISSILE_CONFIG[missileType];
  if (!base) return { cost: 0, oilCost: 0, mineralCost: 0 };
  let mult = 1.0;
  if (missileType === 'HYDRO' && hasUpgradedHydro(nation)) {
    mult = SUPREME_MISSILE_PRICE_MULT;
  } else if (missileType === 'ATOM' && hasUpgradedAtom(nation)) {
    mult = SUPREME_MISSILE_PRICE_MULT;
  }
  return {
    cost: Math.round(base.cost * mult),
    oilCost: Math.round(base.oilCost * mult),
    mineralCost: Math.round((base.mineralCost || 0) * mult),
  };
}

export const BURN_ZONE_DURATION_SECONDS = SUPREME_TECH_CONFIG.EFFECTS.MILITARY_1_BURN_ZONE_SECONDS;

/** Quân sự 2 - Nâng cấp Bom Nguyên Tử (ATOM) sẵn có */
export function hasUpgradedAtom(nation?: Nation | null): boolean {
  return getSupremeBranchLevel(nation, 'military') >= 2;
}

export function getAtomEffectiveStats(nation?: Nation | null): {
  isUpgraded: boolean;
  radius: number;
  troopLoss: number;
  superBuildingDmg: number;
  radiationDuration: number;
} {
  if (hasUpgradedAtom(nation)) {
    return {
      isUpgraded: true,
      radius: SUPREME_TECH_CONFIG.EFFECTS.MILITARY_2_ATOM_RADIUS,
      troopLoss: SUPREME_TECH_CONFIG.EFFECTS.MILITARY_2_ATOM_TROOP_LOSS,
      superBuildingDmg: SUPREME_TECH_CONFIG.EFFECTS.MILITARY_2_ATOM_SUPER_DAMAGE,
      radiationDuration: SUPREME_TECH_CONFIG.EFFECTS.MILITARY_2_RADIATION_SECONDS,
    };
  }
  return {
    isUpgraded: false,
    radius: MISSILE_CONFIG.ATOM.radius,
    troopLoss: 350,
    superBuildingDmg: 125,
    radiationDuration: 0,
  };
}

/** Quân sự 3 - Máy Bay Chiến Đấu */
export const MAX_FIGHTERS_PER_NATION = SUPREME_TECH_CONFIG.EFFECTS.MILITARY_3_MAX_FIGHTERS;

export const FIGHTER_PLANE_CONFIG = {
  goldCost: SUPREME_TECH_CONFIG.EFFECTS.MILITARY_3_FIGHTER_GOLD_COST,
  oilCost: SUPREME_TECH_CONFIG.EFFECTS.MILITARY_3_FIGHTER_OIL_COST,
  speed: 0.16,
  aoeRadius: 2.4,
  tileTroopDamage: 220,
  waveDamageRatio: 0.35,
  minWaveDamage: 25,
  superBuildingDamage: 35,
  scorchSeconds: 10,
};

export function canLaunchFighterPlane(nation?: Nation | null): boolean {
  return getSupremeBranchLevel(nation, 'military') >= 3;
}

export function countActiveFighterPlanes(planes: FighterPlane[] | undefined, nationId: number): number {
  if (!Array.isArray(planes) || nationId <= 0) return 0;
  let count = 0;
  for (let i = 0; i < planes.length; i++) {
    if (planes[i] && planes[i].nationId === nationId) count++;
  }
  return count;
}

/** Phòng thủ 1 - Phòng Thủ Biên Giới (+25% phòng thủ trên ô biên giới) */
export function getSupremeBorderDefenseMult(nation?: Nation | null, tile?: Tile | null): number {
  if (!tile || !tile.isBorder) return 1.0;
  return getSupremeBranchLevel(nation, 'defense') >= 1
    ? 1 + SUPREME_TECH_CONFIG.EFFECTS.DEFENSE_1_BORDER_DEFENSE_BONUS
    : 1.0;
}

/** Phòng thủ 2 - Pháo Đài Tối Thượng Nâng Cấp (bán kính 8 -> 11, giảm sát thương 80% -> 90%, không cộng dồn) */
export function getSupremeFortressStats(nation?: Nation | null): {
  radius: number;
  activeReduction: number;
  damagedReduction: number;
} {
  if (getSupremeBranchLevel(nation, 'defense') >= 2) {
    return {
      radius: SUPREME_TECH_CONFIG.EFFECTS.DEFENSE_2_FORTRESS_RADIUS,
      activeReduction: SUPREME_TECH_CONFIG.EFFECTS.DEFENSE_2_FORTRESS_REDUCTION_ACTIVE,
      damagedReduction: SUPREME_TECH_CONFIG.EFFECTS.DEFENSE_2_FORTRESS_REDUCTION_DAMAGED,
    };
  }
  return {
    radius: 8,
    activeReduction: 0.80,
    damagedReduction: 0.30,
  };
}

/** Phòng thủ 3 - Lô Cốt / Chiến Hào (BUNKER) */
export const MAX_BUNKERS_PER_NATION = SUPREME_TECH_CONFIG.EFFECTS.DEFENSE_3_MAX_BUNKERS;
export const INITIAL_AUTO_BUNKERS = SUPREME_TECH_CONFIG.EFFECTS.DEFENSE_3_AUTO_BUNKERS;

export function canBuildBunker(nation?: Nation | null): boolean {
  return getSupremeBranchLevel(nation, 'defense') >= 3;
}

export function countNationBunkers(tiles: Tile[][], nationId: number): number {
  if (!tiles || nationId <= 0) return 0;
  let count = 0;
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const t = row[x];
      if (t && t.owner === nationId && t.building === 'BUNKER') {
        count += t.buildingLevel || 1;
      }
    }
  }
  return count;
}

export function deployInitialBorderBunkers(
  tiles: Tile[][],
  nation: Nation,
  targetCount: number = INITIAL_AUTO_BUNKERS
): Tile[] {
  const placed: Tile[] = [];
  if (!tiles || !nation || nation.id <= 0) return placed;
  const existing = countNationBunkers(tiles, nation.id);
  const canPlace = Math.max(0, Math.min(targetCount, MAX_BUNKERS_PER_NATION - existing));
  if (canPlace <= 0) return placed;

  const candidates: Tile[] = [];
  for (let y = 0; y < tiles.length; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const t = row[x];
      if (
        t &&
        t.owner === nation.id &&
        t.isBorder &&
        t.building === 'NONE' &&
        !(t.x === nation.capitalX && t.y === nation.capitalY)
      ) {
        candidates.push(t);
      }
    }
  }

  // Chọn các ô biên giới phân bố đều quanh biên giới
  if (candidates.length === 0) return placed;
  const step = Math.max(1, Math.floor(candidates.length / canPlace));
  const used = new Set<Tile>();
  for (let i = 0; i < candidates.length && placed.length < canPlace; i += step) {
    const t = candidates[i];
    if (!used.has(t)) {
      t.building = 'BUNKER';
      t.buildingLevel = 1;
      t.isAdvancedExtractor = false;
      used.add(t);
      placed.push(t);
    }
  }
  for (let i = 0; i < candidates.length && placed.length < canPlace; i++) {
    const t = candidates[i];
    if (!used.has(t)) {
      t.building = 'BUNKER';
      t.buildingLevel = 1;
      t.isAdvancedExtractor = false;
      used.add(t);
      placed.push(t);
    }
  }
  return placed;
}
