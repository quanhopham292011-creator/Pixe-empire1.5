import { General, GeneralStyle, GeneralEvolutionStats } from '../types';

export const EVOLUTION_CONSTANTS = {
  MIN_LEVEL: 10,
  MIN_TOTAL_SCORE: 60,
  MIN_LEAD_RATIO: 1.25,
  MAX_EVENT_AMOUNT: 400,
  MAX_COUNTER: 1_000_000,
  DIVISOR_DAMAGE_DEALT: 100,
  DIVISOR_DAMAGE_ABSORBED: 80,
  MULT_WAVES_LED: 1,
  MULT_TACTICAL_CAPTURES: 2,
} as const;

export const GENERAL_STYLE_INFO: Record<GeneralStyle, { name: string; icon: string; desc: string }> = {
  WARRIOR: { name: 'Chiến Binh', icon: '⚔️', desc: 'Hiếu chiến, ưu tiên tấn công' },
  GUARDIAN: { name: 'Hộ Vệ', icon: '🛡️', desc: 'Kiên cố, ưu tiên bảo vệ quân' },
  COMMANDER: { name: 'Thống Soái', icon: '📯', desc: 'Hay dẫn quân ra trận' },
  STRATEGIST: { name: 'Quân Sư', icon: '🧠', desc: 'Chọn mục tiêu chiến lược' },
};

export type EvolutionEvent = 'DAMAGE_DEALT' | 'DAMAGE_ABSORBED' | 'WAVE_LED' | 'TACTICAL_CAPTURE';

export function createEmptyEvolutionStats(): GeneralEvolutionStats {
  return { damageDealt: 0, damageAbsorbed: 0, wavesLed: 0, tacticalCaptures: 0 };
}

export function sanitizeEvolutionStats(raw: any): GeneralEvolutionStats {
  const clean = (v: any) =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(EVOLUTION_CONSTANTS.MAX_COUNTER, v) : 0;
  return {
    damageDealt: clean(raw?.damageDealt),
    damageAbsorbed: clean(raw?.damageAbsorbed),
    wavesLed: clean(raw?.wavesLed),
    tacticalCaptures: clean(raw?.tacticalCaptures),
  };
}

export function sanitizeStyle(raw: any): GeneralStyle | undefined {
  return raw === 'WARRIOR' || raw === 'GUARDIAN' || raw === 'COMMANDER' || raw === 'STRATEGIST' ? raw : undefined;
}

export function getStyleScores(stats?: GeneralEvolutionStats): Record<GeneralStyle, number> {
  const s = sanitizeEvolutionStats(stats);
  return {
    WARRIOR: s.damageDealt / EVOLUTION_CONSTANTS.DIVISOR_DAMAGE_DEALT,
    GUARDIAN: s.damageAbsorbed / EVOLUTION_CONSTANTS.DIVISOR_DAMAGE_ABSORBED,
    COMMANDER: s.wavesLed * EVOLUTION_CONSTANTS.MULT_WAVES_LED,
    STRATEGIST: s.tacticalCaptures * EVOLUTION_CONSTANTS.MULT_TACTICAL_CAPTURES,
  };
}

export function recordGeneralContribution(
  general: General | undefined | null,
  event: EvolutionEvent,
  amount: number = 1
): boolean {
  if (!general || general.role !== 'ACTIVE' || general.style) return false;
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const a = Math.min(EVOLUTION_CONSTANTS.MAX_EVENT_AMOUNT, amount);
  const stats = (general.evolutionStats = sanitizeEvolutionStats(general.evolutionStats));
  const cap = EVOLUTION_CONSTANTS.MAX_COUNTER;
  switch (event) {
    case 'DAMAGE_DEALT': stats.damageDealt = Math.min(cap, stats.damageDealt + a); break;
    case 'DAMAGE_ABSORBED': stats.damageAbsorbed = Math.min(cap, stats.damageAbsorbed + a); break;
    case 'WAVE_LED': stats.wavesLed = Math.min(cap, stats.wavesLed + a); break;
    case 'TACTICAL_CAPTURE': stats.tacticalCaptures = Math.min(cap, stats.tacticalCaptures + a); break;
  }
  return true;
}

export function tryEvolveGeneral(general: General | undefined | null): GeneralStyle | undefined {
  if (!general || general.style) return undefined;
  if (general.role !== 'ACTIVE') return undefined;
  if ((general.level || 1) < EVOLUTION_CONSTANTS.MIN_LEVEL) return undefined;
  const scores = getStyleScores(general.evolutionStats);
  const entries = (Object.entries(scores) as [GeneralStyle, number][]).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total < EVOLUTION_CONSTANTS.MIN_TOTAL_SCORE) return undefined;
  const [topStyle, topScore] = entries[0];
  const secondScore = entries[1][1];
  if (topScore < secondScore * EVOLUTION_CONSTANTS.MIN_LEAD_RATIO) return undefined;
  general.style = topStyle;
  general.history = general.history || [];
  general.history.unshift(`[Tiến Hóa] Trở thành ${GENERAL_STYLE_INFO[topStyle].name} ${GENERAL_STYLE_INFO[topStyle].icon}`);
  if (general.history.length > 30) general.history.pop();
  return topStyle;
}

export interface StyleAIWeights {
  attackHpMin: number;
  attackTroopMin: number;
  protectTroopBelow: number;
  emergencyThreat: number;
  joinAttackMinTroops: number;
  joinAttackMinPriority: number;
  joinDefendMinPriority: number;
  joinProtectMinTroops: number;
}

export const DEFAULT_AI_WEIGHTS: StyleAIWeights = {
  attackHpMin: 0.70,
  attackTroopMin: 0.45,
  protectTroopBelow: 0.30,
  emergencyThreat: 45,
  joinAttackMinTroops: 10,
  joinAttackMinPriority: 35,
  joinDefendMinPriority: 80,
  joinProtectMinTroops: 15,
};

export function getStyleAIWeights(general?: General | null): StyleAIWeights {
  const w = { ...DEFAULT_AI_WEIGHTS };
  switch (general?.style) {
    case 'WARRIOR':
      w.attackHpMin -= 0.10; w.attackTroopMin -= 0.05; w.joinAttackMinTroops -= 3; w.joinAttackMinPriority -= 10;
      break;
    case 'GUARDIAN':
      w.attackHpMin += 0.05; w.protectTroopBelow += 0.10; w.emergencyThreat -= 10; w.joinProtectMinTroops -= 5;
      break;
    case 'COMMANDER':
      w.joinAttackMinTroops -= 2; w.joinDefendMinPriority -= 15; w.joinProtectMinTroops -= 3;
      break;
    case 'STRATEGIST':
      w.attackTroopMin -= 0.05; w.joinAttackMinPriority += 15; w.joinDefendMinPriority -= 10;
      break;
    default:
      break;
  }
  return w;
}
