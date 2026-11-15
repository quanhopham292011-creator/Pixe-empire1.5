import { DarkTitan, Nation } from '../types';
import { DARK_TITAN_CONFIG, TILE_PIXEL_SIZE, formatPopulation, formatGameTime } from './constants';
import { soundManager } from './audio';
import { recordGeneralContribution } from './generalEvolution';
import { awardGeneralExp } from './generalCombat';

export function damageDarkTitan(
  titan: DarkTitan,
  damage: number,
  attackerNation: Nation | undefined,
  data: any
): void {
  if (!titan || !titan.isActive || damage <= 0) return;

  const currentHp = titan.hp ?? DARK_TITAN_CONFIG.MAX_HP;
  titan.hp = Math.max(0, currentHp - damage);

  data.particles = data.particles || [];
  data.particles.push({
    x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
    y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
    color: '#f43f5e',
    size: 0,
    life: 25,
    maxLife: 25,
    vx: (Math.random() - 0.5) * 0.5,
    vy: -0.8,
    type: 'FLOAT_TEXT',
    text: `💥 -${damage} HP`
  });

  if (titan.hp <= 0 && titan.isActive) {
    titan.isActive = false;
    soundManager.playGeneralHorn();

    if (attackerNation) {
      if (attackerNation.general) {
        recordGeneralContribution(attackerNation.general, 'TACTICAL_CAPTURE', 3);
        awardGeneralExp(attackerNation.general, attackerNation, 150, 'Đánh gục Tà Thần Cổ Đại');
      }
      attackerNation.gold += DARK_TITAN_CONFIG.BOUNTY_GOLD;
      attackerNation.titanBuffTimer = Math.max(
        attackerNation.titanBuffTimer || 0,
        DARK_TITAN_CONFIG.BUFF_DURATION_SECONDS
      );
      const buffPct = Math.round((DARK_TITAN_CONFIG.BUFF_MULTIPLIER - 1) * 100);

      data.events = data.events || [];
      data.events.unshift({
        id: Math.random().toString(),
        title: '⚔️ TRẢM TÀ THẦN THÀNH CÔNG',
        description: `👑 Quân đội ${attackerNation.name} đã ĐÁNH GỤC TÀ THẦN CỔ ĐẠI! Nhận +${formatPopulation(DARK_TITAN_CONFIG.BOUNTY_GOLD)} Vàng & Buff Sức Mạnh +${buffPct}% toàn diện trong 3 phút!`,
        type: 'HARVEST',
        targetNationId: attackerNation.id,
        timestamp: formatGameTime(data.gameTimeSeconds || 0),
      });

      if (data.events.length > 50) data.events.length = 50;
    }
  }
}
