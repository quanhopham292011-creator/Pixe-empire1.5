import React, { useCallback } from 'react';
import { Nation, Tile, BuildingType, GameDifficulty, GeneralBehavior, NavalShip } from '../types';
import { RoomState } from '../multiplayer/types';
import { BUILDING_INFO, formatGameTime } from '../utils/constants';
import { hasBuildingNearby } from '../utils/buildingSpacing';
import { GENERAL_CONSTANTS, canDeployGeneral } from '../utils/generalCombat';
import { getStyleAIWeights } from '../utils/generalEvolution';
import { countActiveAlliances, reconcileNationAlliances } from './useTradeRoutes';
import { getPortWaterAccess, getTradeShipPosition } from '../utils/seaPathfinding';
import {
  SUPER_BUILDING_CONFIG,
  isSuperBuilding,
  hasUnlockedSuperBuildings,
  createEmptyBuildingCounts,
  canBuildSuperBuilding,
  initSuperBuildingOnTile,
  getSuperBuildingState,
  startSuperRepair,
  getAcademyResearchSpeedMult,
} from '../utils/superBuildings';
import { NAVAL_CONFIG, SUPREME_TECH_CONFIG } from '../data/gameData';
import { areResourcesEnabled, getDepositTiles, isExtractor } from '../utils/resources';
import {
  assignExtractorDeposit,
  canQueueNavalShip,
  countPortShipsAndQueue,
  createOrJoinFleet,
  enqueueNavalShip,
  ensureNavalData,
  findLandingApproach,
  findNearestFreeSeaOilDeposit,
  getFleetMembers,
  hasSeaOilExtractionRight,
  isDepositClaimedByOtherExtractor,
  isEnemyNavalShip,
  isShipNearOwnedCoast,
  issueWarshipOrder,
  loadTroopsOnWarship,
  orderAmphibiousLanding,
  unloadTroopsAtCoast,
} from '../utils/navalSystem';
import {
  applySupremeResearchCompletion,
  canBuildBunker,
  countAdvancedExtractors,
  countNationBunkers,
  deployInitialBorderBunkers,
  getMaxAdvancedExtractors,
  getSupremeBranchLevel,
  MAX_BUNKERS_PER_NATION,
  startSupremeResearchForNation,
  upgradeAdvancedExtractor,
} from '../utils/supremeTech';
import {
  AirBaseLocation,
  canProduceAirUnit,
  canUseAirType1,
  canUseAirType23,
  getNationAirSummary,
  hasAnyAirUnlocked,
  isEnemyTradeShipForNation,
  isValidAirBaseTile,
  launchAirUnit,
  produceAirUnit,
} from '../utils/aircraftSystem';
import { AIR_SYSTEM_CONFIG } from '../data/gameData';

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

const AUTO_TRUCE_DURATION = 45;
const AUTO_TRUCE_WAR_COOLDOWN = 180; // Chờ thêm 180s chiến tranh sau khi hết đình chiến mới được xét lại
const AUTO_TRUCE_MIN_GOLD = 80;

export interface AutoTruceContext {
  bot: Nation;
  nations: Nation[];
  data: any;
  difficulty: GameDifficulty;
  gameTime: number;
  playerLandPct: number;
  waveByPair: Map<string, number>;
  capitalAttackByPair: Map<string, number>;
  adjacentEnemyIds: Set<number>;
  capitalAdjacentEnemyIds: Set<number>;
}

/**
 * Đánh giá và kích hoạt đình chiến tự động có điều kiện:
 * - So sánh tương quan sức mạnh 2 bên (quân đội, lãnh thổ) + tình trạng chiến trường thực tế
 * - Yêu cầu tình trạng nguy hiểm nghiêm trọng duy trì đủ lâu
 * - Chặn spam đình chiến khi đối thủ vượt trội rõ rệt hoặc đang trong hồi chiêu
 * - Đồng bộ trạng thái ngoại giao 2 chiều và dọn đợt quân giữa 2 bên
 */
export function processBotAutoTruce(ctx: AutoTruceContext): boolean {
  const {
    bot,
    nations,
    data,
    difficulty,
    gameTime,
    playerLandPct,
    waveByPair,
    capitalAttackByPair,
    adjacentEnemyIds,
    capitalAdjacentEnemyIds,
  } = ctx;

  if (!bot || bot.isEliminated || bot.id <= 1 || bot.colonyCategory === 'FOREST') return false;
  if (!bot.diplomacy) bot.diplomacy = {};

  if (!bot.autoTruceState) {
    bot.autoTruceState = {
      dangerTicks: {},
      cooldownUntil: {},
      truceCounts: {},
      prevTerritory: bot.territoryCount || 0,
      recentLoss: 0,
    };
  }
  const truceState = bot.autoTruceState;
  if (!truceState.dangerTicks) truceState.dangerTicks = {};
  if (!truceState.cooldownUntil) truceState.cooldownUntil = {};
  if (!truceState.truceCounts) truceState.truceCounts = {};

  const currentTer = bot.territoryCount || 0;
  const prevTer = typeof truceState.prevTerritory === 'number' ? truceState.prevTerritory : currentTer;
  if (currentTer < prevTer) {
    truceState.recentLoss = Math.min(25, (truceState.recentLoss || 0) + (prevTer - currentTer));
  } else {
    truceState.recentLoss = Math.max(0, (truceState.recentLoss || 0) - 0.25);
  }
  truceState.prevTerritory = currentTer;

  // Thu thập toàn bộ đối thủ đang tiếp giáp hoặc đang tấn công
  const candidateIds = new Set<number>(adjacentEnemyIds);
  nations.forEach((other: Nation) => {
    if (!other || other.id <= 0 || other.id === bot.id || other.isEliminated || other.colonyCategory === 'FOREST') return;
    if ((waveByPair.get(`${other.id}->${bot.id}`) || 0) > 0 || (truceState.dangerTicks[other.id] || 0) > 0) {
      candidateIds.add(other.id);
    }
  });

  const isBoss = bot.tier === 'BOSS';
  const botTroops = bot.troops || 0;
  const botMaxTroops = Math.max(1, bot.maxTroops || 1);
  const troopRatio = botTroops / botMaxTroops;
  const botTerritory = Math.max(1, currentTer);
  const botPower = botTroops + botTerritory * 10;
  const recentLoss = truceState.recentLoss || 0;

  const requiredDangerSeconds =
    difficulty === 'EXTREME' || difficulty === 'HARD' || isBoss
      ? 15
      : difficulty === 'NORMAL'
        ? 12
        : 10;

  const eligibleEnemies: { enemyId: number; enemyNat: Nation; score: number }[] = [];

  candidateIds.forEach((enemyId) => {
    const enemyNat = nations[enemyId];
    if (!enemyNat || enemyNat.isEliminated || enemyNat.id <= 0 || enemyNat.colonyCategory === 'FOREST') {
      delete truceState.dangerTicks[enemyId];
      return;
    }

    if (!enemyNat.diplomacy) enemyNat.diplomacy = {};
    const botDip = bot.diplomacy[enemyId] || { status: 'WAR', relation: 0, truceTimer: 0 };
    const enemyDip = enemyNat.diplomacy[bot.id] || { status: 'WAR', relation: 0, truceTimer: 0 };

    // Đồng bộ trạng thái 2 chiều nếu phát hiện lệch pha (vd: tuyên chiến hoặc hết hạn đình chiến 1 phía)
    if (botDip.status !== enemyDip.status) {
      if (botDip.status === 'WAR' || enemyDip.status === 'WAR') {
        bot.diplomacy[enemyId] = { status: 'WAR', relation: Math.min(botDip.relation || 0, enemyDip.relation || 0), truceTimer: 0 };
        enemyNat.diplomacy[bot.id] = { status: 'WAR', relation: Math.min(botDip.relation || 0, enemyDip.relation || 0), truceTimer: 0 };
      } else if (botDip.status === 'TRUCE' && (botDip.truceTimer || 0) <= 0 && enemyDip.status === 'TRUCE' && (enemyDip.truceTimer || 0) <= 0) {
        bot.diplomacy[enemyId] = { status: 'WAR', relation: 0, truceTimer: 0 };
        enemyNat.diplomacy[bot.id] = { status: 'WAR', relation: 0, truceTimer: 0 };
      }
    }

    const syncedBotStatus = bot.diplomacy[enemyId]?.status || 'WAR';
    const syncedEnemyStatus = enemyNat.diplomacy[bot.id]?.status || 'WAR';
    if (syncedBotStatus !== 'WAR' || syncedEnemyStatus !== 'WAR') {
      truceState.dangerTicks[enemyId] = 0;
      return;
    }

    const enemyTroops = enemyNat.troops || 0;
    const enemyTerritory = Math.max(1, enemyNat.territoryCount || 0);
    const enemyPower = enemyTroops + enemyTerritory * 10;
    const powerRatio = enemyPower / Math.max(1, botPower);

    const incomingTroops = waveByPair.get(`${enemyId}->${bot.id}`) || 0;
    const capitalIncomingTroops = capitalAttackByPair.get(`${enemyId}->${bot.id}`) || 0;
    const outgoingTroops = waveByPair.get(`${bot.id}->${enemyId}`) || 0;
    const capitalAdjacent = capitalAdjacentEnemyIds.has(enemyId);

    // 1. Chặn đình chiến liên tục hoặc khi đối thủ / người chơi vượt trội rõ rệt
    const cooldownUntil = truceState.cooldownUntil[enemyId] || 0;
    const usedCount = truceState.truceCounts[enemyId] || 0;
    const maxAllowedTruces = powerRatio >= 2.0 ? 1 : 2;
    const isOverwhelmingEnemy =
      powerRatio >= 2.6 ||
      (enemyTerritory >= botTerritory * 2.5 && enemyTroops >= botTroops * 2.0) ||
      (enemyId === 1 && playerLandPct >= 0.35) ||
      (botTerritory <= 3 && enemyTerritory >= 12);

    if (isOverwhelmingEnemy || gameTime < cooldownUntil || usedCount >= maxAllowedTruces) {
      truceState.dangerTicks[enemyId] = 0;
      return;
    }

    // 2. Đánh giá tương quan sức mạnh hai bên (quân đội & lãnh thổ)
    const enemySignificantlyStronger =
      powerRatio >= 1.35 &&
      enemyTroops > botTroops * 1.25 &&
      enemyTerritory >= Math.floor(botTerritory * 0.8);

    // 3. Đánh giá tình trạng chiến trường thực tế (tránh xin hòa khi mới giáp biên hoặc vừa tự xuất quân)
    const activeFrontPressure =
      incomingTroops >= Math.max(12, botTroops * 0.35) ||
      capitalIncomingTroops > 0 ||
      (capitalAdjacent && recentLoss >= 2) ||
      recentLoss >= 3;

    const notCounterAttacking = outgoingTroops <= incomingTroops + botTroops * 0.25;

    // 4. Ngưỡng nguy cơ thất bại nghiêm trọng (không kích hoạt chỉ vì troopRatio < 0.20 hay đe dọa thủ đô nhất thời)
    const severeDefeatRisk =
      (troopRatio < 0.16 && activeFrontPressure) ||
      (capitalIncomingTroops >= Math.max(20, botTroops * 0.5) && troopRatio < 0.30) ||
      (recentLoss >= 3 && troopRatio < 0.32 && (incomingTroops > 0 || capitalAdjacent));

    const inCriticalDanger =
      enemySignificantlyStronger &&
      activeFrontPressure &&
      notCounterAttacking &&
      severeDefeatRisk &&
      bot.gold >= AUTO_TRUCE_MIN_GOLD;

    if (inCriticalDanger) {
      truceState.dangerTicks[enemyId] = (truceState.dangerTicks[enemyId] || 0) + 1;
    } else {
      truceState.dangerTicks[enemyId] = Math.max(0, (truceState.dangerTicks[enemyId] || 0) - 2);
    }

    if ((truceState.dangerTicks[enemyId] || 0) >= requiredDangerSeconds) {
      eligibleEnemies.push({
        enemyId,
        enemyNat,
        score: incomingTroops + capitalIncomingTroops * 2 + powerRatio * 20,
      });
    }
  });

  if (eligibleEnemies.length === 0 || bot.gold < AUTO_TRUCE_MIN_GOLD) return false;

  eligibleEnemies.sort((a, b) => b.score - a.score);
  const chosen = eligibleEnemies[0];
  const { enemyId, enemyNat } = chosen;

  const tribute = Math.floor(bot.gold * 0.4);
  if (tribute <= 0) return false;

  bot.gold -= tribute;
  enemyNat.gold = (enemyNat.gold || 0) + tribute;

  // Cập nhật đồng bộ 2 chiều
  bot.diplomacy[enemyId] = { status: 'TRUCE', relation: 30, truceTimer: AUTO_TRUCE_DURATION };
  if (!enemyNat.diplomacy) enemyNat.diplomacy = {};
  enemyNat.diplomacy[bot.id] = { status: 'TRUCE', relation: 30, truceTimer: AUTO_TRUCE_DURATION };

  // Xóa các đợt quân đang di chuyển giữa 2 nước để không đánh chồng lên trạng thái đình chiến
  if (Array.isArray(data.attackWaves)) {
    data.attackWaves = data.attackWaves.filter(
      (w: any) => !((w.fromNation === bot.id && w.toNation === enemyId) || (w.fromNation === enemyId && w.toNation === bot.id))
    );
  }

  truceState.cooldownUntil[enemyId] = gameTime + AUTO_TRUCE_DURATION + AUTO_TRUCE_WAR_COOLDOWN;
  truceState.truceCounts[enemyId] = (truceState.truceCounts[enemyId] || 0) + 1;
  truceState.dangerTicks[enemyId] = 0;
  if (enemyNat.autoTruceState?.dangerTicks) {
    enemyNat.autoTruceState.dangerTicks[bot.id] = 0;
  }

  if (enemyId === 1) {
    if (!Array.isArray(data.events)) data.events = [];
    data.events.unshift({
      id: Math.random().toString(),
      title: '🕊️ Đề Nghị Đình Chiến & Cống Nộp',
      description: `🏳️ Quốc gia ${bot.name} chịu tổn thất nặng nề, dâng cống nộp +${tribute} Vàng để ký Hiệp Ước Đình Chiến ${AUTO_TRUCE_DURATION}s!`,
      type: 'DIPLOMACY',
      targetNationId: bot.id,
      timestamp: formatGameTime(gameTime),
    });
    if (data.events.length > 50) data.events.length = 50;
  }

  return true;
}

export interface UseBotAIParams {
  gameDataRef: React.MutableRefObject<any>;
  difficulty: GameDifficulty;
  isMultiplayerRef: React.MutableRefObject<boolean>;
  myNationIdRef: React.MutableRefObject<number>;
  totalLandCountRef: React.MutableRefObject<number>;
  offscreenTerritoryDirtyRef: React.MutableRefObject<boolean>;
  fogBaseDirtyRef: React.MutableRefObject<boolean>;
  dirtyTerritoryTilesRef: React.MutableRefObject<{ x: number; y: number }[]>;
  activateGeneralSkill: (nationId: number) => boolean;
}

export function useBotAI({
  gameDataRef,
  difficulty,
  isMultiplayerRef,
  myNationIdRef,
  totalLandCountRef,
  offscreenTerritoryDirtyRef,
  fogBaseDirtyRef,
  dirtyTerritoryTilesRef,
  activateGeneralSkill,
}: UseBotAIParams) {
  // Bot tự động quyết định kích hoạt kỹ năng của Tướng
  const botUseGeneralSkill = useCallback((bot: Nation) => {
    if (!bot.general || bot.isEliminated || bot.general.status === 'RECOVERING') return;
    if (bot.general.skillCooldown && bot.general.skillCooldown > 0) return;

    const data = gameDataRef.current;
    if (!data) return;
    const gen = bot.general;
    let conditionMet = false;

    switch (gen.skillId) {
      case 'INSPIRE_AURA': {
        const hasMarchingWave = (data.attackWaves || []).some((w: any) => w.fromNation === bot.id);
        if (hasMarchingWave) conditionMet = true;
        break;
      }
      case 'MISSILE_BARRAGE': {
        const hasWar = Object.values(bot.diplomacy).some((d: any) => d.status === 'WAR');
        if (hasWar && bot.gold >= 150) conditionMet = true;
        break;
      }
      case 'IRON_BORDER_SHIELD': {
        const incomingToBorder = (data.attackWaves || []).some((w: any) => {
          if (w.fromNation === bot.id) return false;
          const tgt = data.tiles[w.targetY]?.[w.targetX];
          return tgt && tgt.owner === bot.id && tgt.isBorder;
        });
        if (incomingToBorder) conditionMet = true;
        break;
      }
      case 'SUPPLY_REINFORCE': {
        if (bot.troops < bot.maxTroops * 0.5) conditionMet = true;
        break;
      }
      case 'SHADOW_RAID': {
        const hasMarchingWave = (data.attackWaves || []).some((w: any) => w.fromNation === bot.id);
        if (hasMarchingWave) conditionMet = true;
        break;
      }
    }

    const skillUseProb = difficulty === 'EXTREME' ? 0.48 : difficulty === 'HARD' ? 0.38 : difficulty === 'NORMAL' ? 0.28 : 0.15;
    if (conditionMet && Math.random() < skillUseProb) {
      activateGeneralSkill(bot.id);
    }
  }, [gameDataRef, activateGeneralSkill, difficulty]);

  // Vòng lặp phát triển, xây dựng, ngoại giao, điều tướng và ra lệnh tấn công của bot
  const updateBotAI = useCallback((
    launchAttackWave: (
      from: number, 
      to: number, 
      source: Tile, 
      target: Tile, 
      troops: number, 
      customQueue?: { x: number; y: number }[], 
      withGeneral?: boolean
    ) => void,
    multiplayerRoom?: RoomState | null
  ) => {
    const data = gameDataRef.current;
    if (!data || !data.tiles || !data.nations) return;

    const canBotsAct = data.gameTimeSeconds >= 4 && (!isMultiplayerRef.current || myNationIdRef.current === 1);
    if (!canBotsAct) return;

    const { tiles, nations } = data;
    const size = tiles.length;
    const totalLand = totalLandCountRef.current || 1;
    const playerLandPct = totalLand > 0 ? ((nations[1]?.territoryCount || 0) / totalLand) : 0;

    // Tra cứu O(1) đợt tấn công theo ô và theo cặp quốc gia
    const incomingWaveTargetMap = new Map<number, number>();
    const waveByPair = new Map<string, number>();
    const capitalAttackByPair = new Map<string, number>();
    if (data.attackWaves && data.attackWaves.length > 0) {
      for (let wi = 0; wi < data.attackWaves.length; wi++) {
        const w = data.attackWaves[wi];
        const k = w.targetY * size + w.targetX;
        incomingWaveTargetMap.set(k, (incomingWaveTargetMap.get(k) || 0) + w.troops);

        if (w.fromNation > 0 && w.toNation > 0 && w.fromNation !== w.toNation) {
          const pairKey = `${w.fromNation}->${w.toNation}`;
          waveByPair.set(pairKey, (waveByPair.get(pairKey) || 0) + w.troops);
          const defNat = nations[w.toNation];
          if (defNat && Math.hypot(w.targetX - defNat.capitalX, w.targetY - defNat.capitalY) <= 2.5) {
            capitalAttackByPair.set(pairKey, (capitalAttackByPair.get(pairKey) || 0) + w.troops);
          }
        }
      }
    }

    const humanNationIds = new Set<number>();
    if (isMultiplayerRef.current && multiplayerRoom) {
      multiplayerRoom.players.forEach((p: any) => {
        if (p.connected) humanNationIds.add(p.nationId);
      });
    } else {
      humanNationIds.add(myNationIdRef.current);
    }

    // TỐI ƯU: gom ô đất theo từng nước & danh sách Siêu Công Trình chỉ 1 lần mỗi nhịp
    const ownedByNation: Tile[][] = [];
    const mapSuperTiles: Tile[] = [];
    for (let y = 0; y < size; y++) {
      const row = tiles[y];
      for (let x = 0; x < size; x++) {
        const t = row[x];
        if (isSuperBuilding(t.building) && t.owner > 0) {
          mapSuperTiles.push(t);
        }
        if (t.owner > 1) {
          let list = ownedByNation[t.owner];
          if (!list) {
            list = [];
            ownedByNation[t.owner] = list;
          }
          list.push(t);
        }
      }
    }

    const waveBudgetBase = size >= 192 ? 160 : size >= 128 ? 120 : 80;
    const gameTime = data.gameTimeSeconds || 0;

    // Thu thập nhanh danh sách Tàu Hải Quân & Tàu vô chủ 1 lần mỗi giây
    const navalShipsByNation = new Map<number, NavalShip[]>();
    const derelictNavalShips: NavalShip[] = [];
    if (Array.isArray(data.navalShips)) {
      for (let ni = 0; ni < data.navalShips.length; ni++) {
        const ns: NavalShip = data.navalShips[ni];
        if (!ns || ns.hp <= 0) continue;
        if (ns.nationId === 0) {
          derelictNavalShips.push(ns);
        } else if (ns.nationId > 0) {
          let list = navalShipsByNation.get(ns.nationId);
          if (!list) {
            list = [];
            navalShipsByNation.set(ns.nationId, list);
          }
          list.push(ns);
        }
      }
    }

    // Phân tích quốc gia kiểm soát nhiều lãnh thổ nhất (Bá quyền / Superpower Hegemon)
    let superpowerId = 0;
    let maxLandRatio = 0;
    nations.forEach((n: Nation) => {
      if (n && !n.isEliminated && n.id > 0) {
        const ratio = totalLand > 0 ? n.territoryCount / totalLand : 0;
        if (ratio > maxLandRatio) {
          maxLandRatio = ratio;
          superpowerId = n.id;
        }
      }
    });

    nations.forEach((bot: Nation) => {
      if (bot.id <= 1 || bot.isEliminated || humanNationIds.has(bot.id)) return;
      if (bot.colonyCategory === 'FOREST') return;

      // 1. Dùng kỹ năng Tướng
      botUseGeneralSkill(bot);

      const ownedList = ownedByNation[bot.id] || [];

      // --- 2. TỰ ĐỘNG PHÁT TRIỂN KINH TẾ, DÂN SỐ & CÔNG NGHỆ (Dynamic Economy & Tech) ---
      const isBoss = bot.tier === 'BOSS';

      // 2a. Nâng cấp công nghệ theo tính cách quốc gia & độ khó (Đại Học Viện tăng tốc nghiên cứu cho Bot)
      const baseTechMod = difficulty === 'EXTREME' ? 2 : difficulty === 'HARD' ? 3 : difficulty === 'NORMAL' ? 6 : 12;
      const botAcademySpeed = getAcademyResearchSpeedMult(tiles, bot.id);
      const techMod = Math.max(1, Math.round(baseTechMod / botAcademySpeed));
      const maxBotTech = difficulty === 'EXTREME' ? 5 : difficulty === 'HARD' ? 4 : difficulty === 'NORMAL' ? 3 : 2;
      const techMinGold = difficulty === 'EXTREME' ? 90 : difficulty === 'HARD' ? 100 : difficulty === 'NORMAL' ? 120 : 160;
      if (bot.gold >= techMinGold && (bot.id + gameTime) % techMod === 0) {
        if (!bot.techLevels) bot.techLevels = { economy: 1, military: 1, defense: 1 };

        let preferredTech: 'economy' | 'military' | 'defense' = 'economy';
        if (bot.personality === 'AGGRESSIVE') {
          preferredTech = bot.techLevels.military <= bot.techLevels.defense ? 'military' : 'defense';
        } else if (bot.personality === 'DEFENSIVE') {
          preferredTech = bot.techLevels.defense <= bot.techLevels.economy ? 'defense' : 'economy';
        } else if (bot.personality === 'MERCHANT') {
          preferredTech = bot.techLevels.economy <= bot.techLevels.military ? 'economy' : 'military';
        } else { // OPPORTUNIST
          preferredTech = Math.random() < 0.5 ? 'military' : 'economy';
        }

        if ((bot.techLevels[preferredTech] || 1) >= maxBotTech) {
          const fallbackBranch = (['economy', 'military', 'defense'] as const).find(
            br => (bot.techLevels[br] || 1) < maxBotTech
          );
          if (fallbackBranch) preferredTech = fallbackBranch;
        }

        const currentLvl = bot.techLevels[preferredTech] || 1;
        const upgradeCost = currentLvl * 90;
        if (currentLvl < maxBotTech && bot.gold >= upgradeCost) {
          bot.gold -= upgradeCost;
          bot.techLevels[preferredTech] = currentLvl + 1;
        }
      }

      // 2a2. Bot & Boss nghiên cứu Công Nghệ Tối Thượng (chỉ khi đã mở khóa supremeTechUnlocked, trả đủ vàng/dầu/khoáng như người chơi)
      if (bot.supremeTechUnlocked) {
        if (bot.supremeResearching) {
          bot.supremeResearching.remainingTime -= botAcademySpeed;
          if (bot.supremeResearching.remainingTime <= 0) {
            const completedTechId = bot.supremeResearching.techId;
            applySupremeResearchCompletion(bot, completedTechId);
            if (completedTechId === 'sup_def_3') {
              const placed = deployInitialBorderBunkers(tiles, bot);
              if (placed.length > 0) {
                offscreenTerritoryDirtyRef.current = true;
              }
            }
            bot.supremeResearching = null;
          }
        } else if ((bot.id + gameTime) % 4 === 0) {
          const prefBranches: ('economy' | 'military' | 'defense')[] =
            bot.personality === 'AGGRESSIVE'
              ? ['military', 'economy', 'defense']
              : bot.personality === 'DEFENSIVE'
              ? ['defense', 'economy', 'military']
              : ['economy', 'military', 'defense'];
          for (const brKey of prefBranches) {
            const curSupLvl = getSupremeBranchLevel(bot, brKey);
            if (curSupLvl >= SUPREME_TECH_CONFIG.MAX_LEVEL) continue;
            const nextSup = SUPREME_TECH_CONFIG.TECHS.find(
              (t) => t.branchKey === brKey && t.level === curSupLvl + 1
            );
            if (nextSup) {
              const res = startSupremeResearchForNation(bot, nextSup.id, bot.supremeResearching);
              if (res.ok && res.researching) {
                bot.supremeResearching = res.researching;
                break;
              }
            }
          }
        }
      }

      // 2b. Chiêu mộ quân đội khẩn cấp khi nguy cấp (phân hóa theo độ khó & vai trò Boss)
      const troopRatio = bot.maxTroops > 0 ? bot.troops / bot.maxTroops : 1;
      const recruitRatioThresh = difficulty === 'EXTREME' ? 0.50 : difficulty === 'HARD' ? 0.45 : difficulty === 'NORMAL' ? 0.35 : (isBoss ? 0.25 : 0);
      const recruitMinGold = difficulty === 'EXTREME' ? 40 : difficulty === 'HARD' ? 45 : difficulty === 'NORMAL' ? 60 : 100;
      const recruitCap = difficulty === 'EXTREME' ? 25 : difficulty === 'HARD' ? 22 : difficulty === 'NORMAL' ? 15 : 10;
      if (recruitRatioThresh > 0 && troopRatio < recruitRatioThresh && bot.gold >= recruitMinGold) {
        const recruitCount = Math.min(recruitCap, Math.floor(bot.gold / 3));
        if (recruitCount > 0) {
          bot.troops = Math.min(bot.maxTroops, bot.troops + recruitCount);
          bot.gold -= recruitCount * 3;
        }
      }

      // --- 3. ĐÁNH GIÁ MỨC ĐỘ ĐE DỌA & GIÁ TRỊ CHIẾN LƯỢC ---
      const borderThreats: { 
        tile: Tile; 
        threatScore: number; 
        strategicScore: number; 
        enemySource: Tile | null; 
        isCapital: boolean;
        hasKeyBuilding: boolean;
      }[] = [];
      const neutralTargets: { source: Tile; target: Tile; isPlayer: boolean; priority: number }[] = [];

      const adjacentEnemyIds = new Set<number>();
      const capitalAdjacentEnemyIds = new Set<number>();

      for (let oi = 0; oi < ownedList.length; oi++) {
        const t = ownedList[oi];
        const x = t.x;
        const y = t.y;
        if (t.owner === bot.id) {
          const isCapital = (t.x === bot.capitalX && t.y === bot.capitalY);
          const hasKeyBuilding = t.building !== 'NONE';
          const buildingLvl = t.buildingLevel || 1;

          let threat = 0;
          let enemySrc: Tile | null = null;

          for (let ni = 0; ni < 4; ni++) {
            const nx = x + DX[ni];
            const ny = y + DY[ni];
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              const neighborTile = tiles[ny][nx];
              if (neighborTile.terrain !== 'WATER') {
                if (neighborTile.owner === 0) {
                  if (neutralTargets.length < 30) {
                    neutralTargets.push({ source: t, target: neighborTile, isPlayer: false, priority: 10 });
                  }
                } else if (neighborTile.owner !== bot.id) {
                  if (neighborTile.owner > 0) {
                    adjacentEnemyIds.add(neighborTile.owner);
                    if (isCapital) capitalAdjacentEnemyIds.add(neighborTile.owner);
                  }
                  const dip = bot.diplomacy[neighborTile.owner]?.status;
                  if (dip !== 'ALLIANCE' && dip !== 'TRUCE') {
                    const isEnemySuper = isSuperBuilding(neighborTile.building);
                    if (neighborTile.owner === 1) {
                      threat += (difficulty === 'EXTREME' ? 65 : difficulty === 'HARD' ? 45 : difficulty === 'NORMAL' ? 25 : 12);
                      if (isEnemySuper) threat += 160;
                      if (!enemySrc || isEnemySuper) enemySrc = neighborTile;
                    } else if (neighborTile.owner > 1 && dip === 'WAR') {
                      threat += 20 + (isEnemySuper ? 160 : 0);
                      if (!enemySrc || isEnemySuper) enemySrc = neighborTile;
                    }
                  }
                }
              }
            }
          }

          const incomingTroops = incomingWaveTargetMap.get(y * size + x);
          if (incomingTroops !== undefined && incomingTroops > 0) {
            threat += 65 + incomingTroops;
          }

          let strategicValue = 0;
          if (isCapital) strategicValue += 130;
          if (isSuperBuilding(t.building)) strategicValue += 150;
          if (t.building === 'FORTRESS') strategicValue += 50 * buildingLvl;
          if (t.building === 'CITY') strategicValue += 35 * buildingLvl;
          if (t.building === 'PORT' || t.building === 'BARRACKS') strategicValue += 30 * buildingLvl;
          if (t.building === 'MISSILE_SILO' || t.building === 'AIR_DEFENSE') strategicValue += 45 * buildingLvl;

          if (bot.personality === 'DEFENSIVE') strategicValue *= 1.4;

          const totalStrategicThreat = threat * 1.5 + strategicValue;

          if (threat > 0 || isCapital || (bot.personality === 'DEFENSIVE' && hasKeyBuilding)) {
            borderThreats.push({ 
              tile: t, 
              threatScore: threat, 
              strategicScore: totalStrategicThreat,
              enemySource: enemySrc,
              isCapital,
              hasKeyBuilding
            });
          }
        }
      }

      borderThreats.sort((a, b) => b.strategicScore - a.strategicScore);

      // --- 4. NGOẠI GIAO TỰ CHỦ, LIÊN MINH CHỐNG BÁ QUYỀN & ĐÌNH CHIẾN ---
      // 4b. Đình chiến khẩn cấp theo dõi liên tục mỗi giây (chỉ kích hoạt khi nguy kịch kéo dài)
      processBotAutoTruce({
        bot,
        nations,
        data,
        difficulty,
        gameTime,
        playerLandPct,
        waveByPair,
        capitalAttackByPair,
        adjacentEnemyIds,
        capitalAdjacentEnemyIds,
      });

      if ((bot.id + gameTime) % 4 === 0) {
        if (!bot.diplomacy) bot.diplomacy = {};
        if (!bot.allianceInvites) bot.allianceInvites = [];

        // 4a. Khối liên minh chống Bá quyền (Anti-Superpower Coalition)
        const coalitionThreshold = difficulty === 'EXTREME' ? 0.22 : difficulty === 'HARD' ? 0.28 : difficulty === 'NORMAL' ? 0.35 : 0.45;
        const coalitionChance = difficulty === 'EXTREME' ? 0.55 : difficulty === 'HARD' ? 0.40 : difficulty === 'NORMAL' ? 0.25 : 0.15;
        if (maxLandRatio >= coalitionThreshold && superpowerId > 0 && superpowerId !== bot.id) {
          const superDip = bot.diplomacy[superpowerId];
          if (!superDip || superDip.status === 'WAR') {
            nations.forEach((other: Nation) => {
              if (other && !other.isEliminated && other.id !== bot.id && other.id !== superpowerId && other.id > 0) {
                const dipWithOther = bot.diplomacy[other.id];
                if (!dipWithOther || dipWithOther.status !== 'WAR') {
                  reconcileNationAlliances(bot, nations);
                  const currentAllies = countActiveAlliances(bot, nations);
                  if (currentAllies < 3 && Math.random() < coalitionChance) {
                    if (!other.allianceInvites) other.allianceInvites = [];
                    const alreadyInvited = other.allianceInvites.some(inv => inv.senderNationId === bot.id);
                    if (!alreadyInvited) {
                      other.allianceInvites.push({ senderNationId: bot.id, expiryTimer: 20 });
                    }
                  }
                }
              }
            });
          }
        }
      }

      // --- 5. ADAPTIVE GENERAL AI (ĐẠI TƯỚNG AI CHIẾN THUẬT) ---
      if (bot.general && !bot.isEliminated) {
        const gen = bot.general;
        const hpRatio = gen.maxHp > 0 ? gen.hp / gen.maxHp : 1;

        const capitalThreat = borderThreats.find(b => b.isCapital && b.threatScore > 0);
        const severeThreat = borderThreats.find(b => b.threatScore >= 35 || (b.isCapital && b.threatScore > 0));

        const activeMarchingWave = gen.status === 'MARCHING' && gen.marchingWaveId
          ? data.attackWaves?.find((w: any) => w.id === gen.marchingWaveId)
          : null;

        const aiW = getStyleAIWeights(gen);
        let newBehavior: GeneralBehavior = gen.behavior || 'DEFEND';

        if (gen.status === 'INJURED' || gen.healthState === 'INJURED') {
          newBehavior = 'RECOVER';
          if (gen.status === 'MARCHING') {
            gen.status = 'INJURED';
            gen.marchingWaveId = undefined;
            gen.x = bot.capitalX;
            gen.y = bot.capitalY;
          }
        } else if (hpRatio <= GENERAL_CONSTANTS.RETREAT_HP_RATIO) {
          newBehavior = 'RETREAT';
          if (gen.status === 'MARCHING') {
            gen.status = 'IDLE';
            gen.healthState = 'RECOVERING';
            gen.marchingWaveId = undefined;
            gen.x = bot.capitalX;
            gen.y = bot.capitalY;
          }
        } else if (hpRatio < GENERAL_CONSTANTS.DEPLOY_MIN_HP_RATIO) {
          if (gen.status === 'MARCHING') {
            if (!activeMarchingWave || activeMarchingWave.troops < 5 || (severeThreat && !capitalThreat)) {
              newBehavior = 'RETREAT';
              gen.status = 'IDLE';
              gen.healthState = 'RECOVERING';
              gen.marchingWaveId = undefined;
              gen.x = bot.capitalX;
              gen.y = bot.capitalY;
            } else {
              newBehavior = 'PROTECT';
            }
          } else {
            newBehavior = 'RECOVER';
          }
        } else if (capitalThreat || (severeThreat && severeThreat.threatScore >= aiW.emergencyThreat)) {
          newBehavior = 'DEFEND';
          if (activeMarchingWave && capitalThreat && capitalThreat.threatScore >= 50) {
            const distFromCapital = Math.hypot(gen.x - bot.capitalX, gen.y - bot.capitalY);
            if (distFromCapital > 3) {
              activeMarchingWave.hasGeneral = false;
              gen.status = 'IDLE';
              gen.marchingWaveId = undefined;
              gen.x = bot.capitalX;
              gen.y = bot.capitalY;
            }
          }
        } else if (troopRatio < aiW.protectTroopBelow || bot.troops < 10) {
          newBehavior = 'PROTECT';
        } else if (activeMarchingWave && activeMarchingWave.troops >= 5) {
          newBehavior = gen.behavior === 'ATTACK' ? 'ATTACK' : 'DEFEND';
        } else if (hpRatio >= aiW.attackHpMin && troopRatio >= aiW.attackTroopMin && !severeThreat) {
          newBehavior = 'ATTACK';
        } else {
          newBehavior = 'DEFEND';
        }

        gen.behavior = newBehavior;
      }

      // --- 6. AI XÂY DỰNG CÂN ĐỐI & SIÊU CÔNG TRÌNH (chỉ mở khi đủ cả 3 nhánh công nghệ cấp 3) ---
      // 6a. Tự động sửa Siêu Công Trình bị hư hại
      for (let oi = 0; oi < ownedList.length; oi++) {
        const stTile = ownedList[oi];
        if (isSuperBuilding(stTile.building) && getSuperBuildingState(stTile) === 'DAMAGED') {
          const rep = startSuperRepair(stTile, bot);
          if (rep.ok) {
            offscreenTerritoryDirtyRef.current = true;
            break;
          }
        }
      }

      // 6a2. AI xây 1 Cảng ở ô ven biển để có thể đổ bộ
      if (!bot.hasPort && gameTime >= 120 && ownedList.length >= 12 && (bot.id + gameTime) % 7 === 0 &&
          bot.gold >= BUILDING_INFO.PORT.baseCost + 300) {
        const portSpot = ownedList.find(t =>
          t.terrain !== 'WATER' && t.hasHarborAccess && t.building === 'NONE' &&
          !(t.x === bot.capitalX && t.y === bot.capitalY)
        );
        if (portSpot) {
          bot.gold -= BUILDING_INFO.PORT.baseCost;
          portSpot.building = 'PORT';
          portSpot.buildingLevel = 1;
          bot.hasPort = true;
          offscreenTerritoryDirtyRef.current = true;
          fogBaseDirtyRef.current = true;
          dirtyTerritoryTilesRef.current.push({ x: portSpot.x, y: portSpot.y });
        }
      }

      // 6b. Xây Siêu Công Trình nếu đã mở khóa đủ 3 nhánh công nghệ cấp 3 và đủ vàng
      if (hasUnlockedSuperBuildings(bot) && bot.gold >= 25000 && (bot.id + gameTime) % 3 === 0) {
        const botCounts = createEmptyBuildingCounts();
        let superTotal = 0;
        let superSite: Tile | null = null;
        for (let oi = 0; oi < ownedList.length; oi++) {
          const ot = ownedList[oi];
          if (ot.building !== 'NONE') {
            botCounts[ot.building] = (botCounts[ot.building] || 0) + (ot.buildingLevel || 1);
            if (isSuperBuilding(ot.building)) superTotal++;
          } else if (!superSite && !(ot.x === bot.capitalX && ot.y === bot.capitalY)) {
            superSite = ot;
          }
        }
        if (superTotal < SUPER_BUILDING_CONFIG.MAX_TOTAL_PER_NATION && superSite) {
          const needAcademy =
            !bot.supremeTechUnlocked ||
            (bot.techLevels?.economy || 0) < maxBotTech ||
            (bot.techLevels?.military || 0) < maxBotTech ||
            (bot.techLevels?.defense || 0) < maxBotTech;
          const prefOrder: ('SUPREME_FORTRESS' | 'GRAND_ACADEMY' | 'GRAND_ARSENAL')[] =
            bot.personality === 'DEFENSIVE'
              ? ['SUPREME_FORTRESS', 'GRAND_ACADEMY', 'GRAND_ARSENAL']
              : bot.personality === 'AGGRESSIVE'
              ? ['GRAND_ARSENAL', 'GRAND_ACADEMY', 'SUPREME_FORTRESS']
              : needAcademy
              ? ['GRAND_ACADEMY', 'GRAND_ARSENAL', 'SUPREME_FORTRESS']
              : ['SUPREME_FORTRESS', 'GRAND_ARSENAL', 'GRAND_ACADEMY'];
          for (const sType of prefOrder) {
            if (sType === 'GRAND_ACADEMY' && !needAcademy) continue;
            if (canBuildSuperBuilding(bot, sType, botCounts).ok) {
              bot.gold -= BUILDING_INFO[sType].baseCost;
              initSuperBuildingOnTile(superSite, sType);
              offscreenTerritoryDirtyRef.current = true;
              fogBaseDirtyRef.current = true;
              dirtyTerritoryTilesRef.current.push({ x: superSite.x, y: superSite.y });
              break;
            }
          }
        }
      }

      // 6c. Bot nâng cấp Mỏ / Giàn Dầu Cao Cấp (tối đa 2 hoặc 4)
      const botMaxAdv = getMaxAdvancedExtractors(bot);
      if (botMaxAdv > 0 && (bot.minerals || 0) >= 120 && (bot.id + gameTime) % 5 === 0) {
        if (countAdvancedExtractors(tiles, bot.id) < botMaxAdv) {
          const advTarget = ownedList.find(
            (ot) => isExtractor(ot.building) && !ot.isAdvancedExtractor && !(ot.inactiveTimer && ot.inactiveTimer > 0)
          );
          if (advTarget && upgradeAdvancedExtractor(advTarget, bot, tiles).ok) {
            offscreenTerritoryDirtyRef.current = true;
          }
        }
      }

      // 6d. Bot xây thêm Lô Cốt (tối đa 10) trên biên giới khi mở Phòng Thủ Tối Thượng 3
      if (canBuildBunker(bot) && bot.gold >= BUILDING_INFO.BUNKER.baseCost && (bot.id + gameTime) % 6 === 0) {
        if (countNationBunkers(tiles, bot.id) < MAX_BUNKERS_PER_NATION) {
          const emptyBorder = borderThreats.find(
            (b) => b.tile.building === 'NONE' && !(b.tile.x === bot.capitalX && b.tile.y === bot.capitalY)
          );
          if (emptyBorder) {
            bot.gold -= BUILDING_INFO.BUNKER.baseCost;
            emptyBorder.tile.building = 'BUNKER';
            emptyBorder.tile.buildingLevel = 1;
            offscreenTerritoryDirtyRef.current = true;
            dirtyTerritoryTilesRef.current.push({ x: emptyBorder.tile.x, y: emptyBorder.tile.y });
          }
        }
      }

      // 6e. Bot sản xuất & xuất kích Không Quân mới (Loại 1: Chiến Đấu, Loại 2: Tiểu Đội, Loại 3: Ném Bom)
      if (hasAnyAirUnlocked(bot) && (bot.id + gameTime) % 5 === 0) {
        data.airUnits = data.airUnits || [];
        const resOn = areResourcesEnabled();
        const botBases: AirBaseLocation[] = [];
        for (let oi = 0; oi < ownedList.length; oi++) {
          const ot = ownedList[oi];
          if (isValidAirBaseTile(ot, bot.id)) botBases.push({ x: ot.x, y: ot.y });
        }
        const baseMap = new Map<number, AirBaseLocation[]>([[bot.id, botBases]]);
        const summary = getNationAirSummary(data.airUnits, bot.id);

        // Sản xuất máy bay khi đủ Vàng, Dầu và Quân số (tránh spam vô hạn)
        if (bot.gold >= 3800) {
          const prodOrder: ('SQUADRON' | 'BOMBER' | 'FIGHTER')[] =
            canUseAirType23(bot) && canUseAirType1(bot)
              ? summary.fighterReady + summary.fighterFlying < 1
                ? ['FIGHTER', 'SQUADRON', 'BOMBER']
                : bot.personality === 'AGGRESSIVE' || isBoss
                  ? ['BOMBER', 'SQUADRON', 'FIGHTER']
                  : ['SQUADRON', 'FIGHTER', 'BOMBER']
              : canUseAirType23(bot)
                ? summary.squadronReady + summary.squadronFlying < 1
                  ? ['SQUADRON', 'BOMBER']
                  : ['BOMBER', 'SQUADRON']
                : ['FIGHTER'];

          for (const uType of prodOrder) {
            if (canProduceAirUnit(bot, data.airUnits, uType, resOn).ok) {
              produceAirUnit(bot, data.airUnits, uType, baseMap, resOn);
              break;
            }
          }
        }

        // Xuất kích nếu có lượt xuất kích (>= 1), máy bay sẵn sàng và bầu trời chưa đầy 12 chiếc
        if ((bot.airSorties || 0) >= 1 && summary.flyingGlobal < AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL) {
          const enemyThreat = borderThreats.find((b) => b.enemySource && b.enemySource.owner > 0);
          const airTileTgt = enemyThreat?.enemySource;
          const activeTitans =
            Array.isArray(data.darkTitans) && data.darkTitans.length > 0
              ? data.darkTitans
              : data.darkTitan && data.darkTitan.isActive
                ? [data.darkTitan]
                : [];
          const titanTgt = activeTitans.find((tt: any) => tt && tt.isActive);
          const shipTgt = (data.tradeShips || []).find((s: any) => isEnemyTradeShipForNation(bot, s));

          let tgtX: number | undefined;
          let tgtY: number | undefined;
          let tgtKind: 'TILE' | 'TITAN' | 'SHIP' = 'TILE';
          let tgtId: string | undefined;

          if (airTileTgt) {
            tgtX = airTileTgt.x;
            tgtY = airTileTgt.y;
            tgtKind = 'TILE';
          } else if (titanTgt) {
            tgtX = Math.round(titanTgt.x);
            tgtY = Math.round(titanTgt.y);
            tgtKind = 'TITAN';
            tgtId = titanTgt.id;
          } else if (shipTgt) {
            const routeMap = new Map<string, any>();
            if (Array.isArray(data.tradeRoutes)) {
              data.tradeRoutes.forEach((r: any) => {
                if (r?.id) routeMap.set(r.id, r);
              });
            }
            const shipPos = getTradeShipPosition(shipTgt, routeMap);
            tgtX = Math.round(shipPos.x);
            tgtY = Math.round(shipPos.y);
            tgtKind = 'SHIP';
            tgtId = shipTgt.id;
          }

          if (typeof tgtX === 'number' && typeof tgtY === 'number') {
            if (summary.squadronReady > 0 && summary.flyingGlobal + 3 <= AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL) {
              launchAirUnit(bot, data.airUnits, 'SQUADRON', baseMap, {
                targetX: tgtX,
                targetY: tgtY,
                targetKind: tgtKind,
                targetId: tgtId,
              });
            } else if (summary.bomberReady > 0 && summary.flyingGlobal + 1 <= AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL) {
              const ang = Math.atan2(tgtY - bot.capitalY, tgtX - bot.capitalX);
              const bsx = Math.max(0, Math.min(size - 1, Math.round(tgtX - Math.cos(ang) * 5)));
              const bsy = Math.max(0, Math.min(size - 1, Math.round(tgtY - Math.sin(ang) * 5)));
              const bex = Math.max(0, Math.min(size - 1, Math.round(tgtX + Math.cos(ang) * 5)));
              const bey = Math.max(0, Math.min(size - 1, Math.round(tgtY + Math.sin(ang) * 5)));
              launchAirUnit(bot, data.airUnits, 'BOMBER', baseMap, {
                bomberStartX: bsx,
                bomberStartY: bsy,
                bomberEndX: bex,
                bomberEndY: bey,
              });
            } else if (summary.fighterReady > 0 && summary.flyingGlobal + 1 <= AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL) {
              launchAirUnit(bot, data.airUnits, 'FIGHTER', baseMap, {
                targetX: tgtX,
                targetY: tgtY,
                targetKind: tgtKind,
                targetId: tgtId,
              });
            }
          }
        }
      }

      const buildProb = difficulty === 'EXTREME' ? (isBoss ? 0.95 : 0.90) : difficulty === 'HARD' ? (isBoss ? 0.85 : 0.72) : difficulty === 'NORMAL' ? (isBoss ? 0.55 : 0.45) : (isBoss ? 0.32 : 0.22);
      const maxBuildLvl = difficulty === 'EXTREME' ? 5 : difficulty === 'HARD' ? 4 : difficulty === 'NORMAL' ? 3 : 2;
      if (bot.gold >= 80 && Math.random() < buildProb) {
        let botCities = 0;
        let botBarracks = 0;
        ownedList.forEach(t => {
          if (t.building === 'CITY') botCities += (t.buildingLevel || 1);
          if (t.building === 'BARRACKS') botBarracks += (t.buildingLevel || 1);
        });

        // AI xây Bệ Tên Lửa khi đủ vàng, số lượng theo độ khó
        const siloMaxByDiff = difficulty === 'EXTREME' ? 4 : difficulty === 'HARD' ? 3 : difficulty === 'NORMAL' ? 2 : 1;
        const siloMinGold = difficulty === 'EASY' ? 6000 : difficulty === 'NORMAL' ? 4500 : 3500;
        let botSilos = 0;
        ownedList.forEach(t => { if (t.building === 'MISSILE_SILO') botSilos++; });
        if (botSilos < siloMaxByDiff && bot.gold >= siloMinGold + BUILDING_INFO.MISSILE_SILO.baseCost) {
          const siloSpot = ownedList.find(t => t.terrain === 'LAND' && t.building === 'NONE' && !(t.x === bot.capitalX && t.y === bot.capitalY) && !hasBuildingNearby(tiles, t.x, t.y));
          if (siloSpot) {
            bot.gold -= BUILDING_INFO.MISSILE_SILO.baseCost;
            siloSpot.building = 'MISSILE_SILO';
            siloSpot.buildingLevel = 1;
            offscreenTerritoryDirtyRef.current = true;
            fogBaseDirtyRef.current = true;
            dirtyTerritoryTilesRef.current.push({ x: siloSpot.x, y: siloSpot.y });
          }
        }

        // AI & Boss xây Phòng Không (SAM) có giới hạn và ưu tiên công trình quan trọng
        const samMax = difficulty === 'EXTREME' ? 10 : difficulty === 'HARD' ? 8 : difficulty === 'NORMAL' ? 6 : 4;
        let botSams = 0;
        ownedList.forEach(t => { if (t.building === 'AIR_DEFENSE') botSams++; });

        const currentTime = data.gameTimeSeconds || 0;
        const lastSamTime = bot.lastSamBuildTime || 0;
        const canBuildSamTime = currentTime - lastSamTime >= 10;

        const opponentHasAir = (data.airUnits || []).some((u: any) => u.owner !== bot.id && !u.isEliminated);
        const opponentHasMissileSilo = nations.some((n: Nation) => n.id !== bot.id && !n.isEliminated && ownedByNation[n.id]?.some((t: Tile) => t.building === 'MISSILE_SILO'));
        const opponentHasActiveThreats = opponentHasAir || opponentHasMissileSilo;

        if (
          opponentHasActiveThreats &&
          botSams < samMax &&
          canBuildSamTime &&
          bot.gold >= BUILDING_INFO.AIR_DEFENSE.baseCost
        ) {
          // Ưu tiên đặt gần các công trình quan trọng: Thủ đô, Siêu công trình, Bệ phóng tên lửa, Thành Thị, Doanh Trại
          const anchors: { x: number; y: number }[] = [];
          if (tiles[bot.capitalY] && tiles[bot.capitalY][bot.capitalX]) {
            anchors.push({ x: bot.capitalX, y: bot.capitalY });
          }
          ownedList.forEach(t => {
            if (isSuperBuilding(t.building) || t.building === 'MISSILE_SILO') {
              anchors.push({ x: t.x, y: t.y });
            }
          });
          ownedList.forEach(t => {
            if (t.building === 'CITY' || t.building === 'BARRACKS' || t.building === 'FORTRESS') {
              anchors.push({ x: t.x, y: t.y });
            }
          });

          let samSpot = undefined as (typeof ownedList)[number] | undefined;
          for (const a of anchors) {
            samSpot = ownedList.find(t =>
              t.terrain === 'LAND' &&
              t.building === 'NONE' &&
              Math.hypot(t.x - a.x, t.y - a.y) <= 5 &&
              !hasBuildingNearby(tiles, t.x, t.y)
            );
            if (samSpot) break;
          }
          if (!samSpot) {
            samSpot = ownedList.find(t => t.terrain === 'LAND' && t.building === 'NONE' && !hasBuildingNearby(tiles, t.x, t.y));
          }
          if (samSpot) {
            bot.gold -= BUILDING_INFO.AIR_DEFENSE.baseCost;
            samSpot.building = 'AIR_DEFENSE';
            samSpot.buildingLevel = 1;
            samSpot.inactiveTimer = 3;
            bot.lastSamBuildTime = currentTime;
            offscreenTerritoryDirtyRef.current = true;
            fogBaseDirtyRef.current = true;
            dirtyTerritoryTilesRef.current.push({ x: samSpot.x, y: samSpot.y });
          }
        }

        const targetForBuilding = borderThreats.find(b =>
          (b.isCapital || b.strategicScore >= 40 || b.tile.building === 'NONE') &&
          (b.tile.building !== 'NONE' || !hasBuildingNearby(tiles, b.tile.x, b.tile.y))
        );
        if (targetForBuilding) {
          const tileToBuild = targetForBuilding.tile;
          if (tileToBuild.building === 'NONE') {
            let buildType: BuildingType = 'FORTRESS';
            const territorySize = ownedList.length;
            if (botCities * 12 < territorySize && bot.gold >= BUILDING_INFO.CITY.baseCost) {
              buildType = 'CITY';
            } else if (botBarracks < 2 && bot.gold >= BUILDING_INFO.BARRACKS.baseCost) {
              buildType = 'BARRACKS';
            } else if (targetForBuilding.threatScore > 20 && bot.gold >= BUILDING_INFO.FORTRESS.baseCost) {
              buildType = 'FORTRESS';
            } else {
              buildType = bot.personality === 'MERCHANT' ? 'CITY' : bot.personality === 'AGGRESSIVE' ? 'BARRACKS' : 'FORTRESS';
            }

            const bCost = BUILDING_INFO[buildType as Exclude<BuildingType, 'NONE'>].baseCost;
            if (bot.gold >= bCost) {
              bot.gold -= bCost;
              tileToBuild.building = buildType;
              tileToBuild.buildingLevel = 1;
              offscreenTerritoryDirtyRef.current = true;
              fogBaseDirtyRef.current = true;
              dirtyTerritoryTilesRef.current.push({ x: tileToBuild.x, y: tileToBuild.y });
            }
          } else if (['FORTRESS', 'BARRACKS', 'CITY', 'AIR_DEFENSE'].includes(tileToBuild.building)) {
            const upgradeCost = Math.floor(BUILDING_INFO[tileToBuild.building].baseCost * 0.8);
            if (bot.gold >= upgradeCost && (tileToBuild.buildingLevel || 1) < maxBuildLvl) {
              bot.gold -= upgradeCost;
              tileToBuild.buildingLevel = (tileToBuild.buildingLevel || 1) + 1;
              offscreenTerritoryDirtyRef.current = true;
              fogBaseDirtyRef.current = true;
              dirtyTerritoryTilesRef.current.push({ x: tileToBuild.x, y: tileToBuild.y });
            }
          }
        }
      }

      // --- 7. TẤN CÔNG CÓ CHỦ ĐÍCH, TẬP TRUNG LỰC LƯỢNG & PHÒNG THỦ KHI BỊ TẤN CÔNG ---
      const minTroopsReq = difficulty === 'EXTREME' ? 6 : difficulty === 'HARD' ? 8 : difficulty === 'NORMAL' ? (bot.colonyCategory === 'TRIBE' ? 15 : 11) : (bot.colonyCategory === 'TRIBE' ? 20 : 15);
      const attackProb = difficulty === 'EXTREME' ? 0.95 : difficulty === 'HARD' ? 0.85 : difficulty === 'NORMAL' ? (bot.personality === 'DEFENSIVE' ? 0.45 : 0.65) : (isBoss ? 0.55 : (bot.personality === 'DEFENSIVE' ? 0.25 : 0.40));

      let isUnderAttack = false;
      ownedList.forEach(t => {
        const incoming = incomingWaveTargetMap.get(t.y * size + t.x);
        if (incoming && incoming > 0) {
          isUnderAttack = true;
        }
      });

      if (bot.troops >= minTroopsReq && (Math.random() < attackProb || isUnderAttack)) {
        const validTargets: { source: Tile; target: Tile; isPlayer: boolean; priority: number }[] = [];

        const enemySuperTargets = mapSuperTiles.filter(st => {
          if (st.owner <= 0 || st.owner === bot.id) return false;
          const dip = bot.diplomacy?.[st.owner]?.status;
          return dip !== 'ALLIANCE' && dip !== 'TRUCE';
        });

        borderThreats.forEach(bt => {
          if (bt.enemySource) {
            const isPlayerTarget = bt.enemySource.owner === 1;
            const gameTime = gameDataRef.current?.gameTimeSeconds || 0;
            if ((difficulty === 'EASY' || difficulty === 'NORMAL') && gameTime < 120 && isPlayerTarget) {
              return;
            }

            // Ưu tiên chọn mục tiêu yếu nhất (phòng thủ thấp, dễ chiếm) kết hợp giá trị chiến lược
            const enemyTileDefense = bt.enemySource.defenseBonus || 1.0;
            const weaknessScore = Math.max(1, 10 - Math.floor(enemyTileDefense * 3));
            let priority = bt.strategicScore + weaknessScore * 6;
            if (bt.isCapital) priority += 120;
            if (bt.enemySource.owner === 1) priority += (difficulty === 'EXTREME' ? 90 : difficulty === 'HARD' ? 60 : difficulty === 'NORMAL' ? 30 : 15);
            if (isSuperBuilding(bt.enemySource.building)) priority += 280;

            for (let si = 0; si < enemySuperTargets.length; si++) {
              const st = enemySuperTargets[si];
              if (st.owner === bt.enemySource.owner) {
                const dist = Math.hypot(st.x - bt.enemySource.x, st.y - bt.enemySource.y);
                if (dist <= 12) {
                  priority += Math.max(20, 140 - dist * 10);
                }
              }
            }

            validTargets.push({
              source: bt.tile,
              target: bt.enemySource,
              isPlayer: bt.enemySource.owner === 1,
              priority: priority,
            });
          }
        });

        if (validTargets.length > 0) {
          validTargets.sort((a, b) => b.priority - a.priority);
          const selected = validTargets[0];

          if (selected) {
            // Khi bị tấn công, tăng lượng quân phòng thủ dự trữ để bảo vệ thành
            const defenseReserve = isUnderAttack ? 0.45 : (selected.priority >= 100 ? 0.35 : 0.15);
            const availableTroops = Math.max(5, Math.floor(bot.troops * (1 - defenseReserve)));
            
            // Tập trung quân vào 1 hướng quyết định (mũi nhọn chủ lực) thay vì rải đều
            const concentrationPct = difficulty === 'EXTREME' ? 0.88 : difficulty === 'HARD' ? 0.80 : difficulty === 'NORMAL' ? 0.70 : 0.55;
            const troopsToSend = Math.max(5, Math.floor(availableTroops * concentrationPct));

            if (troopsToSend >= 5) {
              let shouldGeneralJoin = false;
              if (bot.general && canDeployGeneral(bot.general) && (bot.general.status === 'IDLE' || isUnderAttack)) {
                shouldGeneralJoin = true;
              }

              launchAttackWave(
                bot.id, 
                selected.target.owner, 
                selected.source, 
                selected.target, 
                troopsToSend,
                undefined,
                shouldGeneralJoin
              );
            }
          }
        }
      }

      // --- 8. MỞ RỘNG LÃNH THỔ TÍCH CỰC ---
      if (neutralTargets.length > 0 && (data.attackWaves?.length || 0) < waveBudgetBase) {
        const expandProb = difficulty === 'EXTREME' ? 0.98 : difficulty === 'HARD' ? 0.92 : difficulty === 'NORMAL' ? 0.78 : 0.45;
        if (Math.random() < expandProb) {
          const maxWaves = difficulty === 'EXTREME' ? 4 : difficulty === 'HARD' ? 3 : difficulty === 'NORMAL' ? 2 : 1;
          const expandPct = difficulty === 'EXTREME' ? 0.28 : difficulty === 'HARD' ? 0.24 : difficulty === 'NORMAL' ? 0.20 : 0.16;
          const keepTroops = bot.maxTroops * 0.15;
          let launched = 0;
          for (let tries = 0; tries < maxWaves * 3 && launched < maxWaves; tries++) {
            if (bot.troops < 8 || bot.troops - keepTroops < 5) break;
            const pick = neutralTargets[Math.floor(Math.random() * neutralTargets.length)];
            if (!pick || pick.target.owner !== 0) continue;
            const send = Math.max(5, Math.floor((bot.troops - keepTroops) * expandPct));
            if (send > bot.troops) break;
            launchAttackWave(bot.id, 0, pick.source, pick.target, send, undefined, false);
            launched++;
          }
        }
      }

      // 8b. Đổ bộ qua biển: chiếm đảo / vùng xa biển bằng Cảng
      if (bot.hasPort && (bot.id + gameTime) % 6 === 0 && (data.attackWaves?.length || 0) < waveBudgetBase) {
        const seaProb = difficulty === 'EXTREME' ? 0.8 : difficulty === 'HARD' ? 0.6 : difficulty === 'NORMAL' ? 0.4 : 0.25;
        const seaKeep = bot.maxTroops * 0.2;
        if (Math.random() < seaProb && bot.troops - seaKeep >= 12) {
          let seaTarget: Tile | null = null;
          for (let k = 0; k < 60 && !seaTarget; k++) {
            const rx = Math.floor(Math.random() * size);
            const ry = Math.floor(Math.random() * size);
            const ct = tiles[ry][rx];
            if (ct.owner !== 0 || ct.terrain === 'WATER' || !ct.hasHarborAccess) continue;
            let nearOwn = false;
            for (let ni = 0; ni < 4; ni++) {
              const nt = tiles[ry + DY[ni]]?.[rx + DX[ni]];
              if (nt && nt.owner === bot.id) { nearOwn = true; break; }
            }
            if (!nearOwn) seaTarget = ct;
          }
          if (seaTarget) {
            let seaSource: Tile | null = null;
            let seaBest = Infinity;
            for (let oi = 0; oi < ownedList.length; oi++) {
              const ot = ownedList[oi];
              if (ot.terrain === 'WATER' || !ot.hasHarborAccess) continue;
              const d = Math.hypot(ot.x - seaTarget.x, ot.y - seaTarget.y);
              if (d < seaBest) { seaBest = d; seaSource = ot; }
            }
            if (seaSource) {
              const seaSend = Math.max(8, Math.floor((bot.troops - seaKeep) * 0.18));
              if (seaSend <= bot.troops) {
                launchAttackWave(bot.id, 0, seaSource, seaTarget, seaSend, undefined, false);
              }
            }
          }
        }
      }

      // --- 9. AI & BOSS HẢI QUÂN (Đóng tàu đúng luật, khai thác dầu biển, hạm đội, hộ tống, đổ bộ) ---
      const navalTickInterval = difficulty === 'EXTREME' ? 3 : difficulty === 'HARD' ? 4 : difficulty === 'NORMAL' ? 5 : 7;
      if (gameTime >= 25 && (bot.id + gameTime) % navalTickInterval === 0) {
        ensureNavalData(data);
        const myNavalShips = navalShipsByNation.get(bot.id) || [];
        const openPorts: { tile: Tile; waterX: number; waterY: number }[] = [];
        for (let oi = 0; oi < ownedList.length; oi++) {
          const ot = ownedList[oi];
          if (ot.building !== 'PORT' || (ot.inactiveTimer && ot.inactiveTimer > 0)) continue;
          const access = getPortWaterAccess(tiles, ot.x, ot.y);
          if (!access.isEnclosed && access.openCompIds.length > 0 && access.adjacentWater.length > 0) {
            const wSpot = access.adjacentWater.find(w => w.isOpen) || access.adjacentWater[0];
            openPorts.push({ tile: ot, waterX: wSpot.x, waterY: wSpot.y });
          }
        }

        if (openPorts.length > 0 || myNavalShips.length > 0) {
          const myWarships = myNavalShips.filter(s => s.type === 'WARSHIP');
          const myExtractors = myNavalShips.filter(s => s.type === 'EXTRACTOR');
          const discoveredSeaOils = areResourcesEnabled()
            ? getDepositTiles(tiles).filter(
                dt => dt && dt.terrain === 'WATER' && dt.deposit === 'OIL' && dt.discovered && (dt.reserve || 0) > 0
              )
            : [];

          // 9a. Đóng Tàu Khai Thác & Tàu Chiến trong giới hạn và đủ tài nguyên
          if (openPorts.length > 0 && (data.navalShips.length + data.portBuildQueues.length) < NAVAL_CONFIG.MAX_GLOBAL_NAVAL_SHIPS) {
            const firstPort = openPorts[0].tile;
            const nationCounts = countPortShipsAndQueue(data, firstPort.x, firstPort.y, bot.id);
            const desiredExtractors = Math.min(
              NAVAL_CONFIG.EXTRACTOR.MAX_PER_NATION,
              openPorts.length * NAVAL_CONFIG.EXTRACTOR.MAX_PER_PORT,
              difficulty === 'EASY' ? (isBoss ? 2 : 1) : difficulty === 'NORMAL' ? (isBoss ? 3 : 2) : difficulty === 'HARD' ? (isBoss ? 4 : 3) : (isBoss ? 5 : 4)
            );
            const goldBufferExtractor = difficulty === 'EASY' ? 900 : 450;

            let queuedShipThisTick = false;
            if (
              nationCounts.totalNationExtractors < desiredExtractors &&
              bot.gold >= NAVAL_CONFIG.EXTRACTOR.GOLD_COST + goldBufferExtractor &&
              discoveredSeaOils.some(dep => !isDepositClaimedByOtherExtractor(data, dep.x, dep.y) && hasSeaOilExtractionRight(data, bot.id, dep.x, dep.y))
            ) {
              for (const op of openPorts) {
                if (canQueueNavalShip(data, bot, op.tile.x, op.tile.y, 'EXTRACTOR').ok) {
                  const res = enqueueNavalShip(data, bot, op.tile.x, op.tile.y, 'EXTRACTOR');
                  if (res.ok) {
                    queuedShipThisTick = true;
                    break;
                  }
                }
              }
            }

            if (!queuedShipThisTick) {
              const hasNavalEnemy = nations.some((other: Nation) => {
                if (!other || other.id <= 0 || other.id === bot.id || other.isEliminated) return false;
                const dip = bot.diplomacy?.[other.id]?.status || 'WAR';
                if (dip !== 'WAR') return false;
                return (navalShipsByNation.get(other.id)?.length || 0) > 0 || other.hasPort;
              });
              const desiredWarships = Math.min(
                NAVAL_CONFIG.WARSHIP.MAX_PER_NATION,
                openPorts.length * NAVAL_CONFIG.WARSHIP.MAX_PER_PORT,
                difficulty === 'EASY'
                  ? (isBoss ? 2 : 1)
                  : difficulty === 'NORMAL'
                  ? (isBoss ? 4 : 2)
                  : difficulty === 'HARD'
                  ? (isBoss ? 6 : 4)
                  : (isBoss ? 8 : 5)
              );
              const goldBufferWarship = isBoss ? 1100 : difficulty === 'EXTREME' ? 900 : difficulty === 'HARD' ? 1300 : difficulty === 'NORMAL' ? 1700 : 2400;

              if (
                nationCounts.totalNationWarships < desiredWarships &&
                (hasNavalEnemy || myExtractors.length > 0 || discoveredSeaOils.length > 0) &&
                bot.gold >= NAVAL_CONFIG.WARSHIP.GOLD_COST + goldBufferWarship
              ) {
                for (const op of openPorts) {
                  if (canQueueNavalShip(data, bot, op.tile.x, op.tile.y, 'WARSHIP').ok) {
                    enqueueNavalShip(data, bot, op.tile.x, op.tile.y, 'WARSHIP');
                    break;
                  }
                }
              }
            }
          }

          // 9b. Tự gán lại Tàu Khai Thác đang rỗi tới mỏ dầu biển gần nhất còn mở
          for (let ei = 0; ei < myExtractors.length; ei++) {
            const ext = myExtractors[ei];
            if (ext.state === 'IDLE' || typeof ext.assignedDepositX !== 'number') {
              const dep = findNearestFreeSeaOilDeposit(data, ext);
              if (dep) assignExtractorDeposit(data, ext, dep.x, dep.y);
            }
          }

          // 9c. Lập Hạm Đội cho HARD / EXTREME / BOSS khi có >= 2 Tàu Chiến khỏe
          if ((difficulty === 'HARD' || difficulty === 'EXTREME' || isBoss) && myWarships.length >= 2) {
            const activeFleetIds = new Set<string>();
            for (const w of myWarships) {
              if (w.fleetId) activeFleetIds.add(w.fleetId);
            }
            let targetFleetId: string | undefined;
            for (const fid of activeFleetIds) {
              if (getFleetMembers(data, fid).length < NAVAL_CONFIG.FLEET.MAX_SHIPS) {
                targetFleetId = fid;
                break;
              }
            }
            const ungroupedIds = myWarships
              .filter(w => !w.fleetId && !w.isRepairing && w.state !== 'REPAIRING' && w.state !== 'RETREATING')
              .map(w => w.id);
            if (ungroupedIds.length >= (targetFleetId ? 1 : 2)) {
              createOrJoinFleet(data, bot.id, ungroupedIds, targetFleetId);
            }
          }

          // 9d. Chiến thuật Tàu Chiến: Đánh chặn tàu địch, chiếm tàu vô chủ, hộ tống khai thác, tuần tra mỏ dầu & đổ bộ thông minh
          const activeWarships = myWarships.filter(
            w => !w.isRepairing && w.state !== 'REPAIRING' && w.state !== 'RETREATING' && w.order !== 'LANDING'
          );

          // Kiểm tra có tàu địch đang đe dọa vùng biển / tàu khai thác gần nhà không
          let urgentEnemyShip: NavalShip | null = null;
          let urgentDist = Infinity;
          for (let wi = 0; wi < activeWarships.length && !urgentEnemyShip; wi++) {
            const w = activeWarships[wi];
            for (const [otherId, otherShips] of navalShipsByNation.entries()) {
              if (otherId === bot.id) continue;
              for (let osi = 0; osi < otherShips.length; osi++) {
                const es = otherShips[osi];
                if (!isEnemyNavalShip(bot, es)) continue;
                const d = Math.hypot(es.x - w.x, es.y - w.y);
                if (d <= 20 && d < urgentDist) {
                  urgentDist = d;
                  urgentEnemyShip = es;
                }
              }
            }
          }

          // Hộ tống Tàu Khai Thác nếu bot có >= 2 Tàu Chiến và không ở mức Dễ thường
          const escortedIds = new Set<string>();
          for (const w of myWarships) {
            if (w.order === 'ESCORT' && w.escortShipId) escortedIds.add(w.escortShipId);
          }

          let dispatchedLanding = false;
          for (let wi = 0; wi < activeWarships.length; wi++) {
            const w = activeWarships[wi];

            // 1) Đánh chặn tàu địch áp sát (trừ tàu đang hộ tống ổn định trừ khi mức Khó/Cực Khó/Boss)
            if (urgentEnemyShip && w.order !== 'ATTACK' && (w.order !== 'ESCORT' || difficulty === 'HARD' || difficulty === 'EXTREME' || isBoss)) {
              if (Math.hypot(urgentEnemyShip.x - w.x, urgentEnemyShip.y - w.y) <= 18) {
                issueWarshipOrder(data, w, 'ATTACK', {
                  targetShipId: urgentEnemyShip.id,
                  x: urgentEnemyShip.x,
                  y: urgentEnemyShip.y,
                });
                continue;
              }
            }

            // 2) Chiếm tàu vô chủ gần đó (nhanh tay ở NORMAL+)
            if (derelictNavalShips.length > 0 && w.order === 'AUTO' && difficulty !== 'EASY') {
              let bestDer: NavalShip | null = null;
              let bestDerD = 18;
              for (const ds of derelictNavalShips) {
                const d = Math.hypot(ds.x - w.x, ds.y - w.y);
                if (d < bestDerD) {
                  bestDerD = d;
                  bestDer = ds;
                }
              }
              if (bestDer) {
                issueWarshipOrder(data, w, 'MOVE', { x: bestDer.x, y: bestDer.y });
                continue;
              }
            }

            // 3) Phân 1 tàu rảnh hộ tống Tàu Khai Thác (khi bot có >= 2 tàu chiến)
            if (
              (difficulty !== 'EASY' || isBoss) &&
              myWarships.length >= 2 &&
              myExtractors.length > 0 &&
              (w.order === 'AUTO' || w.order === 'PATROL') &&
              !w.carriedTroops
            ) {
              const unprotectedExt = myExtractors.find(ext => !escortedIds.has(ext.id));
              if (unprotectedExt) {
                escortedIds.add(unprotectedExt.id);
                issueWarshipOrder(data, w, 'ESCORT', { escortShipId: unprotectedExt.id });
                continue;
              }
            }

            // 4) Đổ bộ đường biển có đánh giá lực lượng phòng thủ & tránh kẹt quân trên tàu ở cảng
            const hasPreloadedTroops = (w.carriedTroops || 0) > 0;
            const landingCooldownOk = !((w as any)._landingRetryAt && gameTime < (w as any)._landingRetryAt);
            const canBotLanding =
              !dispatchedLanding &&
              landingCooldownOk &&
              (difficulty !== 'EASY' || isBoss) &&
              w.hp >= w.maxHp * 0.75 &&
              w.order !== 'ESCORT' &&
              w.order !== 'ATTACK' &&
              (hasPreloadedTroops || bot.troops >= Math.max(45, bot.maxTroops * 0.35)) &&
              (data.attackWaves?.length || 0) < waveBudgetBase;

            if (canBotLanding && (hasPreloadedTroops || difficulty === 'EXTREME' || difficulty === 'HARD' || isBoss || Math.random() < 0.45)) {
              const wantLoad = Math.min(w.maxTroopCapacity || 25, Math.floor(bot.troops * 0.25));
              const minAssault = difficulty === 'HARD' || difficulty === 'EXTREME' || isBoss ? 25 : 18;
              const nearOwnShore = isShipNearOwnedCoast(tiles, bot.id, w.x, w.y, 2.8);

              if (hasPreloadedTroops || (wantLoad >= minAssault && nearOwnShore)) {
                // Gom tối đa 6 ô mục tiêu tiềm năng trước, sắp điểm rồi mới kiểm tra đường biển (chống lag)
                const coastCandidates: { tile: Tile; score: number }[] = [];
                const considerCandidate = (ct: Tile | undefined) => {
                  if (!ct || ct.terrain === 'WATER' || !ct.hasHarborAccess || ct.owner === bot.id) return;
                  if (ct.owner > 0) {
                    const dip = bot.diplomacy?.[ct.owner]?.status || 'WAR';
                    if (dip === 'ALLIANCE' || dip === 'TRUCE') return;
                    if (ct.owner === 1 && (difficulty === 'EASY' || difficulty === 'NORMAL') && gameTime < 120) return;
                    const defender = nations[ct.owner];
                    const forceCheck = Math.max(w.carriedTroops || 0, wantLoad);
                    const defPower = (ct.defenseBonus || 1) * 18 + (ct.building === 'FORTRESS' ? 35 : ct.building === 'BUNKER' ? 28 : 0);
                    if (forceCheck < defPower && defender && !defender.isEliminated && defender.troops > bot.troops * 1.15) {
                      return;
                    }
                  }
                  const distPenalty = Math.hypot(ct.x - w.x, ct.y - w.y) * 0.6;
                  const valueScore =
                    (ct.owner === 1 ? 35 : ct.owner > 0 ? 22 : 10) +
                    (ct.building === 'PORT' ? 28 : ct.building === 'CITY' || ct.building === 'OIL_RIG' ? 20 : 0) -
                    distPenalty;
                  coastCandidates.push({ tile: ct, score: valueScore });
                };

                for (let btIdx = 0; btIdx < Math.min(6, borderThreats.length); btIdx++) {
                  considerCandidate(borderThreats[btIdx]?.enemySource || undefined);
                }
                for (let tries = 0; tries < 28 && coastCandidates.length < 8; tries++) {
                  const rx = Math.floor(Math.random() * size);
                  const ry = Math.floor(Math.random() * size);
                  considerCandidate(tiles[ry]?.[rx]);
                }

                coastCandidates.sort((a, b) => b.score - a.score);
                let landedOk = false;
                for (let ci = 0; ci < Math.min(4, coastCandidates.length); ci++) {
                  const ct = coastCandidates[ci].tile;
                  const approach = findLandingApproach(tiles, w.x, w.y, ct.x, ct.y, bot);
                  if (!approach) continue;
                  if ((w.carriedTroops || 0) <= 0) {
                    loadTroopsOnWarship(data, w, wantLoad);
                  }
                  if ((w.carriedTroops || 0) > 0) {
                    const landRes = orderAmphibiousLanding(data, w, approach.landTileX, approach.landTileY, false);
                    if (landRes.ok) {
                      dispatchedLanding = true;
                      landedOk = true;
                      break;
                    }
                  }
                }

                if (landedOk) continue;

                // Nếu thất bại hoặc chưa có bãi đổ bộ hợp lệ: đặt thời gian chờ đổi mục tiêu, không đứng kẹt ở cảng với quân
                (w as any)._landingRetryAt = gameTime + 10;
                if ((w.carriedTroops || 0) > 0 && nearOwnShore) {
                  unloadTroopsAtCoast(data, w);
                } else if (w.state === 'IDLE' || w.state === 'TRANSPORTING') {
                  w.order = 'AUTO';
                  w.state = 'PATROL';
                }
              } else if ((w.carriedTroops || 0) === 0 && w.order === 'AUTO' && openPorts.length > 0) {
                // Kéo tàu về gần cảng nhà nếu chưa có quân trên khoang và chưa nhận lệnh khác
                const hp = openPorts[0];
                if (Math.hypot(hp.waterX - w.x, hp.waterY - w.y) > 8) {
                  issueWarshipOrder(data, w, 'PATROL', { x: hp.waterX, y: hp.waterY });
                  continue;
                }
              }
            }

            // 5) Tuần tra giữ Vùng Kiểm Soát Biển quanh Mỏ Dầu Biển
            if (w.order === 'AUTO' && discoveredSeaOils.length > 0 && (difficulty === 'HARD' || difficulty === 'EXTREME' || isBoss)) {
              const targetOil = discoveredSeaOils[wi % discoveredSeaOils.length];
              if (targetOil && Math.hypot((w.patrolX ?? w.x) - targetOil.x, (w.patrolY ?? w.y) - targetOil.y) > 9) {
                issueWarshipOrder(data, w, 'PATROL', { x: targetOil.x, y: targetOil.y });
              }
            }
          }
        }
      }
    });
  }, [
    gameDataRef,
    difficulty,
    isMultiplayerRef,
    myNationIdRef,
    totalLandCountRef,
    offscreenTerritoryDirtyRef,
    fogBaseDirtyRef,
    dirtyTerritoryTilesRef,
    botUseGeneralSkill,
  ]);

  return { botUseGeneralSkill, updateBotAI };
}
