import { GameDifficulty, Nation, Tile } from '../types';
import { BUILDING_INFO } from '../data/gameData';
import { getPortWaterAccess } from './seaPathfinding';
import { getDepositTiles } from './resources';
import { countActiveAlliances, reconcileNationAlliances } from '../hooks/useTradeRoutes';

const D4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export function computeNationPower(nation: Nation | undefined | null): number {
  if (!nation || nation.isEliminated) return 0;
  return (nation.troops || 0) + (nation.territoryCount || 0) * 10;
}

/**
 * Đếm số mặt trận chiến tranh THỰC TẾ (kẻ địch còn sống, ở trạng thái WAR,
 * đang tiếp giáp lãnh thổ hoặc đang có đợt quân giao tranh giữa 2 bên).
 */
export function countRealActiveWars(
  nation: Nation,
  nations: Nation[],
  adjacentEnemyIds?: Set<number>,
  waveByPair?: Map<string, number>
): {
  realActiveWars: number;
  strongestEnemyPower: number;
  fightingIds: Set<number>;
} {
  const fightingIds = new Set<number>();
  let strongestEnemyPower = 0;

  for (const other of nations) {
    if (!other || other.id <= 0 || other.id === nation.id || other.isEliminated || other.colonyCategory === 'FOREST') {
      continue;
    }
    const status = nation.diplomacy?.[other.id]?.status || 'WAR';
    if (status !== 'WAR') continue;

    const isAdjacent = adjacentEnemyIds ? adjacentEnemyIds.has(other.id) : false;
    const incoming = waveByPair ? (waveByPair.get(`${other.id}->${nation.id}`) || 0) : 0;
    const outgoing = waveByPair ? (waveByPair.get(`${nation.id}->${other.id}`) || 0) : 0;

    if (isAdjacent || incoming > 0 || outgoing > 0) {
      fightingIds.add(other.id);
      const pwr = computeNationPower(other);
      if (pwr > strongestEnemyPower) strongestEnemyPower = pwr;
    }
  }

  return {
    realActiveWars: fightingIds.size,
    strongestEnemyPower,
    fightingIds,
  };
}

export function buildLandAdjacencyMap(tiles: Tile[][]): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  if (!Array.isArray(tiles) || tiles.length === 0) return adj;
  const size = tiles.length;
  for (let y = 0; y < size; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < size; x++) {
      const t = row[x];
      if (!t || t.terrain === 'WATER' || t.owner <= 0) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + D4[k][0];
        const ny = y + D4[k][1];
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        const nb = tiles[ny]?.[nx];
        if (!nb || nb.terrain === 'WATER' || nb.owner <= 0 || nb.owner === t.owner) continue;
        let s = adj.get(t.owner);
        if (!s) {
          s = new Set<number>();
          adj.set(t.owner, s);
        }
        s.add(nb.owner);
      }
    }
  }
  return adj;
}

export interface AllianceEvalContext {
  nations: Nation[];
  tiles: Tile[][];
  attackWaves?: any[];
  waveByPair?: Map<string, number>;
  adjacentByNation?: Map<number, Set<number>>;
  adjacentEnemyIds?: Set<number>;
  difficulty?: GameDifficulty;
  superpowerId?: number;
  maxLandRatio?: number;
  coalitionThreshold?: number;
  isProposal?: boolean;
}

export interface AllianceEvalResult {
  ok: boolean;
  score: number;
  powerRatio: number;
  relation: number;
  realActiveWars: number;
  sharedStrongEnemy: boolean;
}

/**
 * Đánh giá toàn diện quyết định liên minh của AI dựa trên:
 * 1) Sức mạnh (tương quan quân đội & lãnh thổ, tránh kết minh kẻ quá yếu sát biên giới hoặc bá quyền sắp thắng)
 * 2) Quan hệ ngoại giao (từ chối khi quan hệ thù địch sâu <= -35 hoặc đang mang nhãn Kẻ phản bội)
 * 3) Tình hình chiến tranh (áp lực đa mặt trận, kẻ thù chung, đang giao tranh trực tiếp)
 */
export function evaluateAllianceDecision(
  bot: Nation,
  target: Nation,
  ctx: AllianceEvalContext
): AllianceEvalResult {
  const { nations, tiles } = ctx;
  if (
    !bot ||
    !target ||
    bot.id === target.id ||
    bot.id <= 0 ||
    target.id <= 0 ||
    bot.isEliminated ||
    target.isEliminated ||
    bot.colonyCategory === 'FOREST' ||
    target.colonyCategory === 'FOREST'
  ) {
    return { ok: false, score: -999, powerRatio: 0, relation: 0, realActiveWars: 0, sharedStrongEnemy: false };
  }

  reconcileNationAlliances(bot, nations);
  reconcileNationAlliances(target, nations);

  if (bot.diplomacy?.[target.id]?.status === 'ALLIANCE' && target.diplomacy?.[bot.id]?.status === 'ALLIANCE') {
    return { ok: false, score: -999, powerRatio: 1, relation: 80, realActiveWars: 0, sharedStrongEnemy: false };
  }

  if (countActiveAlliances(bot, nations) >= 3 || countActiveAlliances(target, nations) >= 3) {
    return { ok: false, score: -999, powerRatio: 1, relation: 0, realActiveWars: 0, sharedStrongEnemy: false };
  }

  if ((target.traitorTimer || 0) > 0) {
    return { ok: false, score: -999, powerRatio: 1, relation: -50, realActiveWars: 0, sharedStrongEnemy: false };
  }

  if (ctx.isProposal && (bot.traitorTimer || 0) > 0) {
    return { ok: false, score: -999, powerRatio: 1, relation: 0, realActiveWars: 0, sharedStrongEnemy: false };
  }

  let waveByPair = ctx.waveByPair;
  if (!waveByPair) {
    waveByPair = new Map<string, number>();
    if (Array.isArray(ctx.attackWaves)) {
      for (const w of ctx.attackWaves) {
        if (w && w.fromNation > 0 && w.toNation > 0 && w.fromNation !== w.toNation) {
          const k = `${w.fromNation}->${w.toNation}`;
          waveByPair.set(k, (waveByPair.get(k) || 0) + (w.troops || 0));
        }
      }
    }
  }

  const isFightingEachOther =
    (waveByPair.get(`${bot.id}->${target.id}`) || 0) > 0 ||
    (waveByPair.get(`${target.id}->${bot.id}`) || 0) > 0;
  if (isFightingEachOther) {
    return { ok: false, score: -999, powerRatio: 1, relation: -50, realActiveWars: 1, sharedStrongEnemy: false };
  }

  const relation = bot.diplomacy?.[target.id]?.relation ?? 0;
  const reverseRelation = target.diplomacy?.[bot.id]?.relation ?? 0;
  const effectiveRelation = Math.min(relation, reverseRelation < -35 ? reverseRelation : relation);

  // Thù địch sâu (vừa phản bội -50 hoặc giao tranh dữ dội) -> từ chối liên minh
  if (effectiveRelation <= -35) {
    return { ok: false, score: -999, powerRatio: 1, relation: effectiveRelation, realActiveWars: 0, sharedStrongEnemy: false };
  }

  const adjMap = ctx.adjacentByNation ?? buildLandAdjacencyMap(tiles);
  const botAdj = ctx.adjacentEnemyIds ?? adjMap.get(bot.id) ?? new Set<number>();
  const targetAdj = adjMap.get(target.id) ?? new Set<number>();

  const { realActiveWars, strongestEnemyPower, fightingIds } = countRealActiveWars(
    bot,
    nations,
    botAdj,
    waveByPair
  );

  const botPower = Math.max(1, computeNationPower(bot));
  const targetPower = computeNationPower(target);
  const powerRatio = targetPower / botPower;
  const troopRatio = (bot.troops || 0) / Math.max(1, bot.maxTroops || 1);
  const recentLoss = bot.autoTruceState?.recentLoss || 0;

  const isUnderPressure =
    realActiveWars >= 2 ||
    troopRatio < 0.42 ||
    recentLoss >= 2 ||
    strongestEnemyPower > botPower * 1.18;

  // Kiểm tra kẻ thù chung đáng gờm (cả hai đều đang WAR với cùng một nước mạnh)
  let sharedStrongEnemy = false;
  for (const enemyId of fightingIds) {
    if (enemyId === target.id) continue;
    const eNat = nations[enemyId];
    if (!eNat || eNat.isEliminated) continue;
    const targetDipEnemy = target.diplomacy?.[enemyId]?.status || 'WAR';
    if (targetDipEnemy === 'WAR' && (targetAdj.has(enemyId) || (waveByPair.get(`${target.id}->${enemyId}`) || 0) > 0 || (waveByPair.get(`${enemyId}->${target.id}`) || 0) > 0)) {
      if (computeNationPower(eNat) >= botPower * 0.85 || enemyId === ctx.superpowerId) {
        sharedStrongEnemy = true;
        break;
      }
    }
  }

  // Kiểm tra ngưỡng sức mạnh tối thiểu theo tính cách & tình hình chiến tranh
  let minReqRatio = 0.40;
  if (bot.personality === 'AGGRESSIVE') minReqRatio = isUnderPressure || sharedStrongEnemy ? 0.55 : 0.70;
  else if (bot.personality === 'MERCHANT') minReqRatio = 0.22;
  else if (bot.personality === 'OPPORTUNIST') minReqRatio = isUnderPressure ? 0.30 : 0.38;
  else if (bot.personality === 'DEFENSIVE' && isUnderPressure) minReqRatio = 0.32;

  if (effectiveRelation >= 25 && isUnderPressure) {
    minReqRatio = Math.min(minReqRatio, 0.25);
  }

  if (powerRatio < minReqRatio) {
    return { ok: false, score: -100, powerRatio, relation: effectiveRelation, realActiveWars, sharedStrongEnemy };
  }

  // Không kết minh với con mồi quá yếu ngay sát biên giới khi bot đang rảnh tay và hiếu chiến
  const isAdjacentToTarget = botAdj.has(target.id);
  if (
    isAdjacentToTarget &&
    botPower > targetPower * 2.2 &&
    realActiveWars <= 1 &&
    effectiveRelation < 15 &&
    bot.personality !== 'MERCHANT' &&
    !sharedStrongEnemy
  ) {
    return { ok: false, score: -80, powerRatio, relation: effectiveRelation, realActiveWars, sharedStrongEnemy };
  }

  // Tránh bắt tay với Bá quyền sắp thắng bản đồ (trừ khi quan hệ cực tốt hoặc là MERCHANT)
  const diff = ctx.difficulty || 'NORMAL';
  const coalitionThreshold =
    ctx.coalitionThreshold ?? (diff === 'EXTREME' ? 0.22 : diff === 'HARD' ? 0.28 : diff === 'NORMAL' ? 0.35 : 0.45);
  if (
    ctx.superpowerId &&
    target.id === ctx.superpowerId &&
    (ctx.maxLandRatio || 0) >= coalitionThreshold &&
    bot.personality !== 'MERCHANT' &&
    effectiveRelation < 35
  ) {
    return { ok: false, score: -70, powerRatio, relation: effectiveRelation, realActiveWars, sharedStrongEnemy };
  }

  let score = 0;
  if (bot.personality === 'MERCHANT') score += 24;
  else if (bot.personality === 'DEFENSIVE') score += 14;
  else if (bot.personality === 'OPPORTUNIST') score += 8;
  else score -= 6; // AGGRESSIVE cân nhắc kỹ hơn

  // Điểm sức mạnh
  if (powerRatio >= 1.1) score += 22;
  else if (powerRatio >= 0.75) score += 14;
  else if (powerRatio >= 0.5) score += 6;
  else score -= 10;

  // Điểm quan hệ
  score += Math.round(effectiveRelation * 0.45);
  if (bot.diplomacy?.[target.id]?.status === 'TRUCE') score += 12;

  // Điểm tình hình chiến tranh
  if (sharedStrongEnemy) score += 26;
  if (isUnderPressure) score += 20;
  if (realActiveWars === 0 && !isUnderPressure && bot.personality === 'AGGRESSIVE' && botPower > targetPower * 1.1) {
    score -= 22;
  }
  if (isAdjacentToTarget && realActiveWars <= 1 && !sharedStrongEnemy && effectiveRelation <= 0 && bot.personality === 'AGGRESSIVE') {
    score -= 18;
  }

  // Lợi ích thương mại hàng hải
  if (bot.hasPort && target.hasPort) {
    score += bot.personality === 'MERCHANT' ? 18 : 10;
  }

  const threshold = ctx.isProposal ? 18 : 10;
  return {
    ok: score >= threshold,
    score,
    powerRatio,
    relation: effectiveRelation,
    realActiveWars,
    sharedStrongEnemy,
  };
}

export interface BetrayalEvalContext {
  nations: Nation[];
  tiles: Tile[][];
  waveByPair: Map<string, number>;
  adjacentEnemyIds: Set<number>;
  difficulty: GameDifficulty;
  gameTime: number;
  totalLand: number;
  tradeRoutes?: any[];
}

/**
 * Chọn đồng minh hợp lý nhất để phản bội dựa trên:
 * - Thời gian đồng minh tối thiểu & hồi chiêu (tránh phản bội ngẫu nhiên/liên tục)
 * - Tình hình chiến tranh hiện tại (không mở thêm mặt trận khi đang kẹt nhiều cuộc chiến hoặc yếu quân)
 * - Quan hệ & lợi ích chiến lược (ưu tiên đồng minh yếu hơn có biên giới tiếp giáp, quan hệ không quá cao, ít thiệt hại thương mại)
 */
export function selectBetrayalTarget(
  bot: Nation,
  ctx: BetrayalEvalContext
): { target: Nation; score: number } | null {
  const { nations, tiles, waveByPair, adjacentEnemyIds, difficulty, gameTime, totalLand, tradeRoutes } = ctx;
  if (
    !bot ||
    bot.id <= 1 ||
    bot.isEliminated ||
    bot.colonyCategory === 'FOREST' ||
    difficulty === 'EASY' ||
    bot.personality === 'MERCHANT' ||
    (bot.traitorTimer || 0) > 0 ||
    gameTime < (bot.nextBetrayalAt || 0) ||
    gameTime <= 180
  ) {
    return null;
  }

  const troopRatio = (bot.troops || 0) / Math.max(1, bot.maxTroops || 1);
  const recentLoss = bot.autoTruceState?.recentLoss || 0;
  const { realActiveWars, strongestEnemyPower } = countRealActiveWars(bot, nations, adjacentEnemyIds, waveByPair);
  const botPower = Math.max(1, computeNationPower(bot));

  // Không phản bội nếu đang bị áp lực chiến tranh, thiếu quân hoặc đang mất đất
  if (troopRatio < 0.50 || recentLoss >= 2) return null;
  if (realActiveWars >= 2) return null;
  if (bot.personality === 'DEFENSIVE' && realActiveWars >= 1) return null;
  if (strongestEnemyPower > botPower * 1.15) return null;

  // Kiểm tra biên giới tiếp giáp theo từng quốc gia (kể cả đồng minh vì adjacentEnemyIds gồm tất cả owner khác != bot.id)
  const borderOverlapCount = new Map<number, number>();
  const size = tiles.length;
  for (let y = 0; y < size; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < size; x++) {
      const t = row[x];
      if (!t || t.owner !== bot.id || t.terrain === 'WATER') continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + D4[k][0];
        const ny = y + D4[k][1];
        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        const nb = tiles[ny]?.[nx];
        if (nb && nb.terrain !== 'WATER' && nb.owner > 0 && nb.owner !== bot.id) {
          borderOverlapCount.set(nb.owner, (borderOverlapCount.get(nb.owner) || 0) + 1);
        }
      }
    }
  }

  let bestTarget: Nation | null = null;
  let bestScore = -Infinity;

  for (const [otherIdStr, dipInfo] of Object.entries(bot.diplomacy || {})) {
    const otherId = Number(otherIdStr);
    if (!Number.isFinite(otherId) || otherId <= 0 || dipInfo?.status !== 'ALLIANCE') continue;
    const ally = nations[otherId];
    if (!ally || ally.isEliminated || ally.diplomacy?.[bot.id]?.status !== 'ALLIANCE') continue;

    // Tránh phản bội ngay sau khi vừa ký liên minh (tối thiểu 75 giây)
    const alliedSince = dipInfo.alliedSince ?? 0;
    if (alliedSince > 0 && gameTime - alliedSince < 75) continue;

    const relation = dipInfo.relation ?? 80;
    const allyPower = Math.max(1, computeNationPower(ally));
    const powerAdvantage = botPower / allyPower;
    const allyLandRatio = totalLand > 0 ? (ally.territoryCount || 0) / totalLand : 0;
    const sharedBorders = borderOverlapCount.get(otherId) || 0;
    const isAllyHegemon = allyLandRatio >= 0.34;

    // Quan hệ rất cao (được viện trợ / giao thương gắn bó) bảo vệ đồng minh trừ khi họ sắp bá chủ bản đồ
    if (relation >= 95 && !isAllyHegemon) continue;

    // Cần có lợi thế sức mạnh rõ rệt hoặc đồng minh sắp thống trị bản đồ
    const minAdv =
      bot.personality === 'AGGRESSIVE' ? 1.30 :
      bot.personality === 'OPPORTUNIST' ? 1.40 :
      1.75; // DEFENSIVE chỉ phản bội khi vượt trội hẳn hoặc ngăn bá chủ
    if (powerAdvantage < minAdv && !isAllyHegemon) continue;

    // Cần lợi ích trực tiếp: tiếp giáp đất liền để đánh chiếm ngay, hoặc vượt trội lớn để mở rộng
    if (sharedBorders === 0 && powerAdvantage < 1.8 && !isAllyHegemon) continue;

    let score = 0;
    score += Math.min(45, (powerAdvantage - 1.0) * 28);
    if (sharedBorders > 0) score += 20 + Math.min(15, sharedBorders * 2);
    else score -= 18;

    // Điểm quan hệ: quan hệ càng thấp (hoặc chưa từng viện trợ thêm) càng dễ phản bội
    score += Math.max(-25, (80 - relation) * 0.7);

    // Nếu đồng minh đang bị đánh hoặc kiệt quân -> OPPORTUNIST/AGGRESSIVE dễ thừa cơ
    const allyTroopRatio = (ally.troops || 0) / Math.max(1, ally.maxTroops || 1);
    if (allyTroopRatio < 0.35) score += 16;

    if (isAllyHegemon) score += 24;
    if (realActiveWars === 0) score += 10;

    // Trừ điểm nếu đang có tuyến thương mại biển sinh lợi với đồng minh này
    const hasActiveTrade = Array.isArray(tradeRoutes) && tradeRoutes.some(
      (r: any) =>
        (r.fromNation === bot.id && r.toNation === otherId) ||
        (r.fromNation === otherId && r.toNation === bot.id)
    );
    if (hasActiveTrade) score -= 12;

    if (bot.personality === 'AGGRESSIVE') score += 12;
    else if (bot.personality === 'OPPORTUNIST') score += 8;
    else if (bot.personality === 'DEFENSIVE') score -= 18;

    // Ngưỡng điểm tối thiểu để tránh phản bội vô lý
    if (score >= 28 && score > bestScore) {
      bestScore = score;
      bestTarget = ally;
    }
  }

  return bestTarget ? { target: bestTarget, score: bestScore } : null;
}

/**
 * Chọn vị trí xây Hải Cảng tối ưu cho AI/Quốc gia:
 * - Bắt buộc thông ra biển mở (không bao giờ xây ở ao/hồ kín)
 * - Tránh sát biên giới địch, ưu tiên gần công trình phòng thủ/thủ đô và gần mỏ dầu biển
 * - Tách khoảng cách hợp lý nếu đã có cảng khác (trừ khi thông ra vùng biển khác)
 */
export function selectBestPortTileForNation(
  tiles: Tile[][],
  nation: Nation,
  ownedTiles?: Tile[],
  existingOpenPorts?: Tile[]
): Tile | null {
  if (!Array.isArray(tiles) || tiles.length === 0 || !nation || nation.id <= 0) return null;
  const size = tiles.length;

  let pool = ownedTiles;
  const openPorts: Tile[] = existingOpenPorts ? [...existingOpenPorts] : [];

  if (!pool) {
    pool = [];
    for (let y = 0; y < size; y++) {
      const row = tiles[y];
      if (!row) continue;
      for (let x = 0; x < size; x++) {
        const t = row[x];
        if (t && t.owner === nation.id) {
          pool.push(t);
        }
      }
    }
  }

  if (!existingOpenPorts) {
    for (const t of pool) {
      if (t.building === 'PORT') {
        const acc = getPortWaterAccess(tiles, t.x, t.y);
        if (!acc.isEnclosed && acc.openCompIds.length > 0) {
          openPorts.push(t);
        }
      }
    }
  }

  const existingCompIds = new Set<number>();
  for (const op of openPorts) {
    const acc = getPortWaterAccess(tiles, op.x, op.y);
    for (const cid of acc.openCompIds) existingCompIds.add(cid);
  }

  const discoveredSeaOils = getDepositTiles(tiles).filter(
    (dt) => dt && dt.terrain === 'WATER' && dt.deposit === 'OIL' && dt.discovered && (dt.reserve || 0) > 0
  );

  let bestTile: Tile | null = null;
  let bestScore = -Infinity;

  for (const t of pool) {
    if (!t || t.owner !== nation.id || t.terrain === 'WATER') continue;
    if (!t.hasHarborAccess || t.building !== 'NONE') continue;
    if (t.x === nation.capitalX && t.y === nation.capitalY) continue;

    const access = getPortWaterAccess(tiles, t.x, t.y);
    // Tuyệt đối không chọn ô ven hồ/ao kín
    if (access.isEnclosed || access.openCompIds.length === 0 || access.adjacentWater.length === 0) {
      continue;
    }

    let score = 0;

    // 1. Mức độ thông thoáng ra biển mở (ưu tiên kề 4 hướng trực tiếp với biển mở)
    let openCardinal = 0;
    let openTotal = 0;
    for (const w of access.adjacentWater) {
      if (w.isOpen) {
        openTotal++;
        if (Math.abs(w.x - t.x) + Math.abs(w.y - t.y) === 1) openCardinal++;
      }
    }
    if (openCardinal === 0) score -= 18;
    score += openCardinal * 12 + Math.min(3, openTotal) * 5;

    // 2. Khoảng cách với các cảng mở hiện có
    if (openPorts.length > 0) {
      let minPortDist = Infinity;
      for (const ep of openPorts) {
        const d = Math.hypot(ep.x - t.x, ep.y - t.y);
        if (d < minPortDist) minPortDist = d;
      }
      const opensNewOcean = access.openCompIds.some((cid) => !existingCompIds.has(cid));
      if (opensNewOcean) score += 22;
      else if (minPortDist < 9) score -= 60;
      else if (minPortDist >= 12) score += 12;
    }

    // 3. Độ an toàn: tránh sát biên giới địch, ưu tiên gần công trình bảo vệ/thủ đô
    let directHostileAdj = 0;
    let nearHostileCount = 0;
    let nearDefenseSupport = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const ny = t.y + dy;
      if (ny < 0 || ny >= size) continue;
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = t.x + dx;
        if (nx < 0 || nx >= size) continue;
        const nb = tiles[ny]?.[nx];
        if (!nb) continue;
        if (nb.owner === nation.id) {
          if (nb.building === 'FORTRESS' || nb.building === 'SUPREME_FORTRESS' || nb.building === 'BUNKER' || nb.building === 'CITY') {
            nearDefenseSupport++;
          }
        } else if (nb.owner > 0 && nb.terrain !== 'WATER') {
          const dip = nation.diplomacy?.[nb.owner]?.status || 'WAR';
          if (dip === 'WAR') {
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist === 1) directHostileAdj++;
            else nearHostileCount++;
          }
        }
      }
    }

    score -= directHostileAdj * 42;
    score -= nearHostileCount * 10;
    score += Math.min(2, nearDefenseSupport) * 8;

    // Khoảng cách hợp lý tới thủ đô (dễ tiếp ứng, không quá biệt lập)
    const capDist = Math.hypot(t.x - nation.capitalX, t.y - nation.capitalY);
    if (capDist <= 12) score += 10;
    else if (capDist > 26) score -= 12;

    // Ưu tiên đất bằng (giữ ô Núi cho phòng thủ)
    if (t.terrain === 'LAND') score += 6;

    // Gần mỏ dầu biển đã phát hiện -> thuận lợi cho Tàu Khai Thác
    if (discoveredSeaOils.length > 0) {
      let minOilDist = Infinity;
      for (const oil of discoveredSeaOils) {
        const d = Math.hypot(oil.x - t.x, oil.y - t.y);
        if (d < minOilDist) minOilDist = d;
      }
      if (minOilDist <= 18) {
        score += Math.max(4, Math.round(20 - minOilDist));
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTile = t;
    }
  }

  return bestTile;
}

export function shouldBotBuildPort(params: {
  bot: Nation;
  tiles: Tile[][];
  ownedList: Tile[];
  openPortsCount: number;
  hasLandExpansion: boolean;
  isUnderCapitalSiege: boolean;
  gameTime: number;
  difficulty: GameDifficulty;
}): Tile | null {
  const { bot, tiles, ownedList, openPortsCount, hasLandExpansion, isUnderCapitalSiege, gameTime } = params;
  if (!bot || bot.isEliminated || bot.colonyCategory === 'FOREST') return null;

  // Tối đa 2 cảng biển mở do AI chủ động xây
  if (openPortsCount >= 2) return null;

  const isIsolated = !hasLandExpansion;
  const goldBuffer = openPortsCount === 0 ? (isIsolated ? 100 : 220) : 1800;
  if (bot.gold < BUILDING_INFO.PORT.baseCost + goldBuffer) return null;

  if (openPortsCount === 0) {
    // Đảo cô lập không còn đất mở rộng: cần xây cảng sớm để đóng tàu/đổ bộ
    if (isIsolated) {
      if (ownedList.length < 4 || gameTime < 35) return null;
    } else {
      if (isUnderCapitalSiege && bot.gold < 700) return null;
      if (ownedList.length < 10 || gameTime < 75) return null;
    }
  } else {
    // Cảng thứ 2 chỉ dành cho quốc gia lớn, rảnh rỗi và dư tài chính
    if (isUnderCapitalSiege || ownedList.length < 42 || gameTime < 220) return null;
  }

  const openPortTiles = ownedList.filter((t) => {
    if (t.building !== 'PORT') return false;
    const acc = getPortWaterAccess(tiles, t.x, t.y);
    return !acc.isEnclosed && acc.openCompIds.length > 0;
  });

  const candidate = selectBestPortTileForNation(tiles, bot, ownedList, openPortTiles);
  if (!candidate) return null;

  // Nếu là cảng thứ 2, đảm bảo đủ xa cảng thứ 1 hoặc mở ra đại dương mới
  if (openPortTiles.length > 0) {
    const first = openPortTiles[0];
    const dist = Math.hypot(candidate.x - first.x, candidate.y - first.y);
    const acc1 = getPortWaterAccess(tiles, first.x, first.y);
    const acc2 = getPortWaterAccess(tiles, candidate.x, candidate.y);
    const opensNewSea = acc2.openCompIds.some((cid) => !acc1.openCompIds.includes(cid));
    if (!opensNewSea && dist < 11) return null;
  }

  return candidate;
}
