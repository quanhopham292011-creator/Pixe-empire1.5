import { Nation } from '../types';

export const POP_LOSS_RATIO = 0.3;
export const MIN_POPULATION = 10;

export function applyCasualties(nation: Nation | undefined, deaths: number): void {
  if (!nation || deaths <= 0) return;
  const loss = Math.round(deaths * POP_LOSS_RATIO);
  nation.population = Math.max(MIN_POPULATION, (nation.population || 0) - loss);
}
