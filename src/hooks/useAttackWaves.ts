import React, { useCallback } from 'react';
import { AttackWave } from '../types';
import { soundManager } from '../utils/audio';
import { 
  TILE_PIXEL_SIZE, DARK_TITAN_CONFIG, formatPopulation, formatGameTime, getSkillPower 
} from '../utils/constants';
import { recordGeneralContribution } from '../utils/generalEvolution';
import { awardGeneralExp } from '../utils/generalCombat';
import { applyCasualties } from '../utils/casualties';

export interface UseAttackWavesParams {
  gameDataRef: React.MutableRefObject<any>;
  gameSpeed: number;
  unlockedAchievementsRef: React.MutableRefObject<Set<string>>;
  cameraRef: React.MutableRefObject<{ x: number; y: number; zoom: number }>;
}

export function useAttackWaves({
  gameDataRef,
  gameSpeed,
  unlockedAchievementsRef,
  cameraRef,
}: UseAttackWavesParams) {
  const updateAttackWaves = useCallback((resolveAttackCapture: (wave: AttackWave) => void, overrideSpeed?: number) => {
    const data = gameDataRef.current;
    if (!data || !data.attackWaves || data.attackWaves.length === 0) return;

    const currentSpeed = overrideSpeed !== undefined ? overrideSpeed : gameSpeed;
    const finishedWaves: number[] = [];

    data.attackWaves.forEach((wave: AttackWave, idx: number) => {
      const isBlizzard = data.activeSeasonEvent?.type === 'BLIZZARD';
      const waveSpeedMult = isBlizzard ? 0 : (currentSpeed * 0.14);

      // Kỹ năng "Hào Quang Khích Lệ" & Công nghệ Quân sự cấp 1 (+10% tốc độ di chuyển quân)
      let generalSpeedMult = 1.0;
      const waveAttacker = data.nations?.[wave.fromNation];
      if (waveAttacker?.techLevels?.military >= 1) {
        generalSpeedMult *= 1.10;
      }
      if (waveAttacker?.general?.skillId === 'INSPIRE_AURA' && (waveAttacker.general.skillActiveTimer || 0) > 0) {
        const power = getSkillPower(waveAttacker);
        generalSpeedMult += 0.50 * power;
      }

      wave.progress += wave.speed * waveSpeedMult * generalSpeedMult;

      // Kiểm tra va chạm chiến đấu với Tà Thần
      const wavePxX = wave.sourceX + (wave.targetX - wave.sourceX) * wave.progress;
      const wavePxY = wave.sourceY + (wave.targetY - wave.sourceY) * wave.progress;

      if (data.darkTitans && data.darkTitans.length > 0) {
        data.darkTitans.forEach((titan: any) => {
          if (!titan.isActive) return;
          const distToTitan = Math.hypot(wavePxX - titan.x, wavePxY - titan.y);

          if (distToTitan <= 1.2 && wave.troops > 0) {
            const attackerNation = data.nations?.[wave.fromNation];
            const titanBuff = (attackerNation?.titanBuffTimer && attackerNation.titanBuffTimer > 0) ? DARK_TITAN_CONFIG.BUFF_MULTIPLIER : 1.0;
            const damageToTitan = Math.floor(wave.troops * 2.2 * titanBuff);

            titan.hp = Math.max(0, (titan.hp ?? DARK_TITAN_CONFIG.MAX_HP) - damageToTitan);

            data.particles.push({
              x: titan.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              y: titan.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
              color: '#f43f5e',
              size: 0, life: 25, maxLife: 25, vx: (Math.random() - 0.5) * 0.5, vy: -0.8,
              type: 'FLOAT_TEXT',
              text: `💥 -${damageToTitan} HP`
            });

            wave.troops = Math.max(0, wave.troops - 10);
            applyCasualties(attackerNation, 10);

            // PIXEL EMPIRE 1.4: Tướng dẫn đầu đợt quân tấn công Tà Thần nhận EXP
            if (wave.hasGeneral && attackerNation?.general) {
              recordGeneralContribution(attackerNation.general, 'DAMAGE_DEALT', attackerNation.general.attack);
              awardGeneralExp(attackerNation.general, attackerNation, 25, 'Gây sát thương lên Tà Thần Cổ Đại');
            }

            // Kiểm tra ĐÁNH GỤC TÀ THẦN
            if (titan.hp <= 0) {
              titan.isActive = false;
              soundManager.playGeneralHorn();

              if (attackerNation) {
                if (wave.hasGeneral && attackerNation.general) {
                  recordGeneralContribution(attackerNation.general, 'TACTICAL_CAPTURE', 3);
                  awardGeneralExp(attackerNation.general, attackerNation, 150, 'Đánh gục Tà Thần Cổ Đại');
                }
                attackerNation.gold += DARK_TITAN_CONFIG.BOUNTY_GOLD;
                // Làm mới thời gian Buff (không cộng dồn vô hạn thời gian hay chỉ số)
                attackerNation.titanBuffTimer = Math.max(
                  attackerNation.titanBuffTimer || 0,
                  DARK_TITAN_CONFIG.BUFF_DURATION_SECONDS
                );
                const buffPct = Math.round((DARK_TITAN_CONFIG.BUFF_MULTIPLIER - 1) * 100);

                data.events.unshift({
                  id: Math.random().toString(),
                  title: '⚔️ TRẢM TÀ THẦN THÀNH CÔNG',
                  description: `👑 Quân đội ${attackerNation.name} đã ĐÁNH GỤC TÀ THẦN CỔ ĐẠI! Nhận +${formatPopulation(DARK_TITAN_CONFIG.BOUNTY_GOLD)} Vàng & Buff Sức Mạnh +${buffPct}% toàn diện trong 3 phút!`,
                  type: 'HARVEST',
                  targetNationId: attackerNation.id,
                  timestamp: formatGameTime(data.gameTimeSeconds),
                });

                if (data.events.length > 50) data.events.length = 50;

                if (attackerNation.isPlayer && !unlockedAchievementsRef.current.has('KILL_TITAN')) {
                  unlockedAchievementsRef.current.add('KILL_TITAN');
                  soundManager.playAchievement();
                  data.particles.push({
                    x: (cameraRef.current.x * -1) / cameraRef.current.zoom + 120,
                    y: (cameraRef.current.y * -1) / cameraRef.current.zoom + 120,
                    color: '#fbbf24', size: 0, life: 60, maxLife: 60, vx: 0, vy: -0.9,
                    type: 'FLOAT_TEXT',
                    text: '🏆 THÀNH TỰU: Diệt Tà Thần Cổ Đại!',
                  });
                }
              }
            }
          }
        });
      }

      if (wave.progress >= 1.0) {
        finishedWaves.push(idx);
        resolveAttackCapture(wave);
      }
    });

    if (finishedWaves.length > 0) {
      const finishedSet = new Set(finishedWaves);
      data.attackWaves = data.attackWaves.filter((_: any, idx: number) => !finishedSet.has(idx));
    }
  }, [gameDataRef, gameSpeed, unlockedAchievementsRef, cameraRef]);

  return { updateAttackWaves };
}
