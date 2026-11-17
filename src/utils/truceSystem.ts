import { Nation } from '../types';
import { collectPortList, syncBalancedTradeRoutes } from '../hooks/useTradeRoutes';

export const TRUCE_DURATION = 45;
export const TRUCE_WAR_COOLDOWN = 180; // Chờ thêm 180s chiến tranh sau khi hết đình chiến mới được xét lại
export const TRUCE_GLOBAL_COOLDOWN = 45; // Hồi chung giữa 2 lần kích hoạt đình chiến của cùng 1 quốc gia
export const TRUCE_INCOMING_AI_COOLDOWN = 20; // Ngăn nhiều AI cùng lúc spam đình chiến dồn dập vào 1 mục tiêu
export const TRUCE_MAX_PER_PAIR = 2; // Giới hạn tối đa số lần đình chiến giữa 1 cặp quốc gia
export const TRUCE_MAX_TOTAL_AI = 4; // Giới hạn tổng số lần AI tự động đình chiến trong 1 trận

export type TruceBlockReason =
  | 'INVALID'
  | 'NOT_WAR'
  | 'LIMIT'
  | 'TOTAL_LIMIT'
  | 'PAIR_COOLDOWN'
  | 'GLOBAL_COOLDOWN'
  | 'INCOMING_COOLDOWN';

export interface TruceAvailability {
  ok: boolean;
  reason?: TruceBlockReason;
  usedCount: number;
  maxAllowed: number;
  cooldownRemaining: number;
}

export function ensureTruceState(nation: Nation) {
  if (!nation.autoTruceState) {
    nation.autoTruceState = {
      dangerTicks: {},
      cooldownUntil: {},
      truceCounts: {},
      prevTerritory: nation.territoryCount || 0,
      recentLoss: 0,
      globalCooldownUntil: 0,
      totalTrucesUsed: 0,
      lastIncomingTruceAt: -999,
    };
  }
  const st = nation.autoTruceState;
  if (!st.dangerTicks) st.dangerTicks = {};
  if (!st.cooldownUntil) st.cooldownUntil = {};
  if (!st.truceCounts) st.truceCounts = {};
  if (typeof st.globalCooldownUntil !== 'number') st.globalCooldownUntil = 0;
  if (typeof st.totalTrucesUsed !== 'number') st.totalTrucesUsed = 0;
  if (typeof st.lastIncomingTruceAt !== 'number') st.lastIncomingTruceAt = -999;
  return st;
}

export function getTruceAvailability(
  initiator: Nation | undefined,
  target: Nation | undefined,
  gameTime: number,
  opts?: {
    maxPerPair?: number;
    maxTotal?: number;
    checkIncomingAiCooldown?: boolean;
  }
): TruceAvailability {
  const maxAllowed = opts?.maxPerPair ?? TRUCE_MAX_PER_PAIR;
  if (!initiator || !target || initiator.isEliminated || target.isEliminated || initiator.id === target.id) {
    return { ok: false, reason: 'INVALID', usedCount: 0, maxAllowed, cooldownRemaining: 0 };
  }

  const initSt = ensureTruceState(initiator);
  const tgtSt = ensureTruceState(target);
  const usedCount = Math.max(initSt.truceCounts[target.id] || 0, tgtSt.truceCounts[initiator.id] || 0);

  const initStatus = initiator.diplomacy?.[target.id]?.status || 'WAR';
  const tgtStatus = target.diplomacy?.[initiator.id]?.status || 'WAR';
  if (initStatus !== 'WAR' || tgtStatus !== 'WAR') {
    return { ok: false, reason: 'NOT_WAR', usedCount, maxAllowed, cooldownRemaining: 0 };
  }

  if (typeof opts?.maxTotal === 'number' && (initSt.totalTrucesUsed || 0) >= opts.maxTotal) {
    return { ok: false, reason: 'TOTAL_LIMIT', usedCount, maxAllowed, cooldownRemaining: 0 };
  }

  if (usedCount >= maxAllowed) {
    return { ok: false, reason: 'LIMIT', usedCount, maxAllowed, cooldownRemaining: 0 };
  }

  const pairCooldownUntil = Math.max(initSt.cooldownUntil[target.id] || 0, tgtSt.cooldownUntil[initiator.id] || 0);
  const pairRemaining = Math.max(0, Math.ceil(pairCooldownUntil - gameTime));
  if (pairRemaining > 0) {
    return { ok: false, reason: 'PAIR_COOLDOWN', usedCount, maxAllowed, cooldownRemaining: pairRemaining };
  }

  const globalCooldownUntil = initSt.globalCooldownUntil || 0;
  const globalRemaining = Math.max(0, Math.ceil(globalCooldownUntil - gameTime));
  if (globalRemaining > 0) {
    return { ok: false, reason: 'GLOBAL_COOLDOWN', usedCount, maxAllowed, cooldownRemaining: globalRemaining };
  }

  if (opts?.checkIncomingAiCooldown) {
    const incomingUntil = (tgtSt.lastIncomingTruceAt ?? -999) + TRUCE_INCOMING_AI_COOLDOWN;
    const incomingRemaining = Math.max(0, Math.ceil(incomingUntil - gameTime));
    if (incomingRemaining > 0) {
      return { ok: false, reason: 'INCOMING_COOLDOWN', usedCount, maxAllowed, cooldownRemaining: incomingRemaining };
    }
  }

  return { ok: true, usedCount, maxAllowed, cooldownRemaining: 0 };
}

export function applyTruceAgreement(
  initiator: Nation,
  target: Nation,
  data: any,
  gameTime: number,
  isAiAuto: boolean = false
): void {
  if (!initiator.diplomacy) initiator.diplomacy = {};
  if (!target.diplomacy) target.diplomacy = {};

  initiator.diplomacy[target.id] = { status: 'TRUCE', relation: 30, truceTimer: TRUCE_DURATION };
  target.diplomacy[initiator.id] = { status: 'TRUCE', relation: 30, truceTimer: TRUCE_DURATION };

  if (Array.isArray(target.allianceInvites)) {
    target.allianceInvites = target.allianceInvites.filter(inv => inv.senderNationId !== initiator.id);
  }
  if (Array.isArray(initiator.allianceInvites)) {
    initiator.allianceInvites = initiator.allianceInvites.filter(inv => inv.senderNationId !== target.id);
  }

  if (Array.isArray(data.attackWaves)) {
    data.attackWaves = data.attackWaves.filter(
      (w: any) => !((w.fromNation === initiator.id && w.toNation === target.id) || (w.fromNation === target.id && w.toNation === initiator.id))
    );
  }

  if (data.tiles && data.nations) {
    syncBalancedTradeRoutes(data, collectPortList(data.tiles, data.nations));
  }

  const initSt = ensureTruceState(initiator);
  const tgtSt = ensureTruceState(target);
  const nextPairCooldown = gameTime + TRUCE_DURATION + TRUCE_WAR_COOLDOWN;
  const nextPairCount = Math.max(initSt.truceCounts[target.id] || 0, tgtSt.truceCounts[initiator.id] || 0) + 1;

  initSt.cooldownUntil[target.id] = Math.max(initSt.cooldownUntil[target.id] || 0, nextPairCooldown);
  tgtSt.cooldownUntil[initiator.id] = Math.max(tgtSt.cooldownUntil[initiator.id] || 0, nextPairCooldown);

  initSt.truceCounts[target.id] = nextPairCount;
  tgtSt.truceCounts[initiator.id] = nextPairCount;

  initSt.globalCooldownUntil = Math.max(initSt.globalCooldownUntil || 0, gameTime + TRUCE_GLOBAL_COOLDOWN);
  initSt.totalTrucesUsed = (initSt.totalTrucesUsed || 0) + 1;
  if (isAiAuto) {
    tgtSt.lastIncomingTruceAt = gameTime;
  }

  initSt.dangerTicks[target.id] = 0;
  tgtSt.dangerTicks[initiator.id] = 0;
}

export function recordTruceBrokenCooldown(nationA: Nation, nationB: Nation, gameTime: number): void {
  const stA = ensureTruceState(nationA);
  const stB = ensureTruceState(nationB);
  const minCooldown = gameTime + TRUCE_WAR_COOLDOWN;
  stA.cooldownUntil[nationB.id] = Math.max(stA.cooldownUntil[nationB.id] || 0, minCooldown);
  stB.cooldownUntil[nationA.id] = Math.max(stB.cooldownUntil[nationA.id] || 0, minCooldown);
}
