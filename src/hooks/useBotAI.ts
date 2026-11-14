import React, { useCallback } from 'react';
import { Nation, Tile, BuildingType, GameDifficulty, GeneralBehavior } from '../types';
import { RoomState } from '../multiplayer/types';
import { BUILDING_INFO, formatGameTime } from '../utils/constants';
import { GENERAL_CONSTANTS, canDeployGeneral } from '../utils/generalCombat';
import { getStyleAIWeights } from '../utils/generalEvolution';
import { countActiveAlliances, reconcileNationAlliances } from './useTradeRoutes';

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

    // TỐI ƯU: gom ô đất theo từng nước chỉ 1 lần mỗi nhịp
    const ownedByNation: Tile[][] = [];
    for (let y = 0; y < size; y++) {
      const row = tiles[y];
      for (let x = 0; x < size; x++) {
        const t = row[x];
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

      // 2a. Nâng cấp công nghệ theo tính cách quốc gia & độ khó
      const techMod = difficulty === 'EXTREME' ? 2 : difficulty === 'HARD' ? 3 : difficulty === 'NORMAL' ? 6 : 12;
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

        const currentLvl = bot.techLevels[preferredTech] || 1;
        const upgradeCost = currentLvl * 90;
        if (currentLvl < maxBotTech && bot.gold >= upgradeCost) {
          bot.gold -= upgradeCost;
          bot.techLevels[preferredTech] = currentLvl + 1;
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
                    if (neighborTile.owner === 1) {
                      threat += (difficulty === 'EXTREME' ? 65 : difficulty === 'HARD' ? 45 : difficulty === 'NORMAL' ? 25 : 12);
                      enemySrc = neighborTile;
                    } else if (neighborTile.owner > 1 && dip === 'WAR') {
                      threat += 20;
                      if (!enemySrc) enemySrc = neighborTile;
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

      // --- 6. AI XÂY DỰNG CÂN ĐỐI (Kinh tế, Quân sự, Phòng thủ) ---
      const buildProb = difficulty === 'EXTREME' ? (isBoss ? 0.95 : 0.90) : difficulty === 'HARD' ? (isBoss ? 0.85 : 0.72) : difficulty === 'NORMAL' ? (isBoss ? 0.55 : 0.45) : (isBoss ? 0.32 : 0.22);
      const maxBuildLvl = difficulty === 'EXTREME' ? 5 : difficulty === 'HARD' ? 4 : difficulty === 'NORMAL' ? 3 : 2;
      if (bot.gold >= 80 && Math.random() < buildProb) {
        let botCities = 0;
        let botBarracks = 0;
        ownedList.forEach(t => {
          if (t.building === 'CITY') botCities += (t.buildingLevel || 1);
          if (t.building === 'BARRACKS') botBarracks += (t.buildingLevel || 1);
        });

        const targetForBuilding = borderThreats.find(b => b.isCapital || b.strategicScore >= 40 || b.tile.building === 'NONE');
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
