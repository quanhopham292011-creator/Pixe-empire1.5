import React, { useCallback } from 'react';
import { Nation, Tile, BuildingType, GameDifficulty, GeneralBehavior } from '../types';
import { RoomState } from '../multiplayer/types';
import { BUILDING_INFO, formatGameTime } from '../utils/constants';
import { GENERAL_CONSTANTS, canDeployGeneral } from '../utils/generalCombat';
import { getStyleAIWeights } from '../utils/generalEvolution';

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

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

    // Tra cứu O(1) đợt tấn công
    const incomingWaveTargetMap = new Map<number, number>();
    if (data.attackWaves && data.attackWaves.length > 0) {
      for (let wi = 0; wi < data.attackWaves.length; wi++) {
        const w = data.attackWaves[wi];
        const k = w.targetY * size + w.targetX;
        incomingWaveTargetMap.set(k, (incomingWaveTargetMap.get(k) || 0) + w.troops);
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
                  const currentAllies = Object.values(bot.diplomacy).filter(d => d.status === 'ALLIANCE').length;
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

        // 4b. Đình chiến khẩn cấp khi thất thế nghiêm trọng
        const severeThreat = borderThreats.find(b => b.isCapital && b.threatScore > 50);
        if ((troopRatio < 0.20 || severeThreat) && bot.gold >= 60) {
          borderThreats.forEach(bt => {
            if (bt.enemySource && bt.enemySource.owner > 0) {
              const enemyId = bt.enemySource.owner;
              const enemyDip = bot.diplomacy[enemyId];
              if (!enemyDip || enemyDip.status === 'WAR') {
                const tribute = Math.floor(bot.gold * 0.4);
                bot.gold -= tribute;
                const enemyNat = nations[enemyId];
                if (enemyNat) enemyNat.gold = (enemyNat.gold || 0) + tribute;

                bot.diplomacy[enemyId] = { status: 'TRUCE', relation: 30, truceTimer: 45 };
                if (enemyNat) {
                  if (!enemyNat.diplomacy) enemyNat.diplomacy = {};
                  enemyNat.diplomacy[bot.id] = { status: 'TRUCE', relation: 30, truceTimer: 45 };
                }

                if (enemyId === 1) {
                  data.events.unshift({
                    id: Math.random().toString(),
                    title: '🕊️ Đề Nghị Đình Chiến & Cống Nộp',
                    description: `🏳️ Quốc gia ${bot.name} chịu tổn thất nặng nề, dâng cống nộp +${tribute} Vàng để ký Hiệp Ước Đình Chiến 45s!`,
                    type: 'DIPLOMACY',
                    targetNationId: bot.id,
                    timestamp: formatGameTime(gameTime),
                  });
                  if (data.events.length > 50) data.events.length = 50;
                }
              }
            }
          });
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

      // --- 6. AI TẬP TRUNG XÂY DỰNG & NÂNG CẤP CÔNG TRÌNH THEO PHONG CÁCH & ĐỘ KHÓ ---
      const buildProb = difficulty === 'EXTREME' ? (isBoss ? 0.95 : 0.90) : difficulty === 'HARD' ? (isBoss ? 0.85 : 0.72) : difficulty === 'NORMAL' ? (isBoss ? 0.55 : 0.45) : (isBoss ? 0.32 : 0.22);
      const maxBuildLvl = difficulty === 'EXTREME' ? 5 : difficulty === 'HARD' ? 4 : difficulty === 'NORMAL' ? 3 : 2;
      if (bot.gold >= 80 && Math.random() < buildProb) {
        const targetForDefense = borderThreats.find(b => b.isCapital || b.strategicScore >= 45 || b.tile.building === 'NONE');
        if (targetForDefense) {
          const tileToBuild = targetForDefense.tile;
          if (tileToBuild.building === 'NONE') {
            let buildType: BuildingType = 'FORTRESS';
            if (bot.personality === 'MERCHANT') {
              buildType = Math.random() < 0.6 ? 'CITY' : (tileToBuild.hasHarborAccess ? 'PORT' : 'FORTRESS');
            } else if (bot.personality === 'AGGRESSIVE') {
              buildType = Math.random() < 0.6 ? 'BARRACKS' : (Math.random() < 0.5 ? 'MISSILE_SILO' : 'FORTRESS');
            } else if (bot.personality === 'DEFENSIVE') {
              buildType = Math.random() < 0.5 ? 'FORTRESS' : (Math.random() < 0.5 ? 'AIR_DEFENSE' : 'LASER');
            } else {
              buildType = Math.random() < 0.5 ? 'FORTRESS' : 'CITY';
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
          } else if (tileToBuild.building === 'FORTRESS' || tileToBuild.building === 'BARRACKS' || tileToBuild.building === 'CITY') {
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

      // --- 7. PHẢN CÔNG VÀ ĐIỀU QUÂN CHÍNH YẾU (Có đợt tấn công Gọng Kìm) ---
      const minTroopsReq = difficulty === 'EXTREME' ? 6 : difficulty === 'HARD' ? 8 : difficulty === 'NORMAL' ? (bot.colonyCategory === 'TRIBE' ? 15 : 11) : (bot.colonyCategory === 'TRIBE' ? 20 : 15);
      const attackProb = difficulty === 'EXTREME' ? 0.95 : difficulty === 'HARD' ? 0.85 : difficulty === 'NORMAL' ? (bot.personality === 'DEFENSIVE' ? 0.45 : 0.65) : (isBoss ? 0.55 : (bot.personality === 'DEFENSIVE' ? 0.25 : 0.40));

      if (bot.troops >= minTroopsReq && Math.random() < attackProb) {
        const validTargets: { source: Tile; target: Tile; isPlayer: boolean; priority: number }[] = [];

        borderThreats.forEach(bt => {
          if (bt.enemySource) {
            let priority = bt.strategicScore;
            if (bt.isCapital) priority += 100;
            if (bt.enemySource.owner === 1) priority += (difficulty === 'EXTREME' ? 75 : difficulty === 'HARD' ? 50 : difficulty === 'NORMAL' ? 25 : 10);

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
            const defenseReserve = selected.priority >= 100 ? 0.40 : 0.20;
            const availableTroops = Math.max(5, Math.floor(bot.troops * (1 - defenseReserve)));
            const pct = difficulty === 'EXTREME' ? (playerLandPct >= 0.10 ? 0.80 : 0.68) : difficulty === 'HARD' ? (playerLandPct >= 0.15 ? 0.65 : 0.52) : difficulty === 'NORMAL' ? 0.42 : (isBoss ? 0.38 : 0.30);
            const troopsToSend = Math.max(5, Math.floor(availableTroops * pct));

            if (troopsToSend >= 5) {
              let shouldGeneralJoin = false;
              if (bot.general && canDeployGeneral(bot.general) && bot.general.status === 'IDLE') {
                const behavior = bot.general.behavior;
                const joinW = getStyleAIWeights(bot.general);
                if (behavior === 'ATTACK') {
                  shouldGeneralJoin = troopsToSend >= joinW.joinAttackMinTroops || selected.priority >= joinW.joinAttackMinPriority;
                } else if (behavior === 'DEFEND') {
                  shouldGeneralJoin = selected.priority >= joinW.joinDefendMinPriority || (selected.source.x === bot.capitalX && selected.source.y === bot.capitalY);
                } else if (behavior === 'PROTECT') {
                  shouldGeneralJoin = troopsToSend >= joinW.joinProtectMinTroops && selected.priority >= 60;
                }
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

              // Tấn công gọng kìm (Pincer Attack): chỉ áp dụng từ mức Thường trở lên
              const pincerChance = difficulty === 'EXTREME' ? 0.45 : difficulty === 'HARD' ? 0.35 : difficulty === 'NORMAL' ? 0.20 : 0;
              if (pincerChance > 0 && bot.troops > troopsToSend + 15 && validTargets.length > 1 && Math.random() < pincerChance) {
                const secondTarget = validTargets[1];
                if (secondTarget && secondTarget.source !== selected.source) {
                  const secondaryTroops = Math.max(5, Math.floor((bot.troops - troopsToSend) * 0.4));
                  launchAttackWave(
                    bot.id,
                    secondTarget.target.owner,
                    secondTarget.source,
                    secondTarget.target,
                    secondaryTroops,
                    undefined,
                    false
                  );
                }
              }
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
