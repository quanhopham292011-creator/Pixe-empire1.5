export * from '../data/gameData';

export const TILE_PIXEL_SIZE = 24; // Kích thước ô chuẩn 24px

export function formatPopulation(num: number): string {
  if (num <= 0) return '0';
  if (num < 1000) return `${num}`;
  if (num < 1_000_000) {
    const k = (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1).replace(/\.0$/, '');
    return `${k}k`;
  }
  const m = (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1).replace(/\.0$/, '');
  return `${m}m`;
}

export function formatGameTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Hệ số sức mạnh kỹ năng: Boss = 1.25, Người chơi và Bot thường = 1.0
 */
export function getSkillPower(nation?: { tier?: string } | null): number {
  if (nation && nation.tier === 'BOSS') {
    return 1.25;
  }
  return 1.0;
}
