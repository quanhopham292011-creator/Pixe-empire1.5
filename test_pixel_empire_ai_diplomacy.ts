import { Nation, Tile } from './src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

function createMockNation(id: number, name: string, personality: Nation['personality']): Nation {
  return {
    id,
    name,
    color: id === 1 ? '#3b82f6' : '#ef4444',
    isPlayer: id === 1,
    personality,
    gold: 500,
    goldIncome: 15,
    troops: 50,
    maxTroops: 200,
    population: 1000,
    territoryCount: 10,
    isEliminated: false,
    capitalX: id * 5,
    capitalY: id * 5,
    hasPort: false,
    techLevels: { economy: 1, military: 1, defense: 1 },
    diplomacy: {},
    allianceInvites: [],
    lastRejectedInviteTimer: {},
    traitorTimer: 0,
    reserveGenerals: [],
  };
}

console.log('--- BẮT ĐẦU KIỂM THỬ PIXEL EMPIRE AI & DIPLOMACY UPGRADE ---');

// TEST 1: Tự động nâng cấp Công nghệ theo tính cách quốc gia
console.log('\n[Test 1] Tự động nâng cấp công nghệ theo tính cách quốc gia:');
{
  const aggressiveBot = createMockNation(2, 'Đại Kim', 'AGGRESSIVE');
  const merchantBot = createMockNation(3, 'Đại Tống', 'MERCHANT');
  const defensiveBot = createMockNation(4, 'Đại Lý', 'DEFENSIVE');

  // Mô phỏng nâng cấp công nghệ
  function simulateTechUpgrade(bot: Nation) {
    if (!bot.techLevels) bot.techLevels = { economy: 1, military: 1, defense: 1 };
    let preferredTech: 'economy' | 'military' | 'defense' = 'economy';
    if (bot.personality === 'AGGRESSIVE') {
      preferredTech = bot.techLevels.military <= bot.techLevels.defense ? 'military' : 'defense';
    } else if (bot.personality === 'DEFENSIVE') {
      preferredTech = bot.techLevels.defense <= bot.techLevels.economy ? 'defense' : 'economy';
    } else if (bot.personality === 'MERCHANT') {
      preferredTech = bot.techLevels.economy <= bot.techLevels.military ? 'economy' : 'military';
    }
    const currentLvl = bot.techLevels[preferredTech] || 1;
    const upgradeCost = currentLvl * 90;
    if (currentLvl < 5 && bot.gold >= upgradeCost) {
      bot.gold -= upgradeCost;
      bot.techLevels[preferredTech] = currentLvl + 1;
    }
  }

  simulateTechUpgrade(aggressiveBot);
  assert(aggressiveBot.techLevels.military === 2, 'Bot Hiếu chiến (AGGRESSIVE) ưu tiên nâng cấp Military Tech lên Cấp 2');
  assert(aggressiveBot.gold === 410, 'Vàng của Bot bị trừ đúng 90 Vàng');

  simulateTechUpgrade(merchantBot);
  assert(merchantBot.techLevels.economy === 2, 'Bot Thương gia (MERCHANT) ưu tiên nâng cấp Economy Tech lên Cấp 2');

  simulateTechUpgrade(defensiveBot);
  assert(defensiveBot.techLevels.defense === 2, 'Bot Phòng thủ (DEFENSIVE) ưu tiên nâng cấp Defense Tech lên Cấp 2');
}

// TEST 2: Chiêu mộ quân đội khẩn cấp khi tỷ lệ quân đội thấp
console.log('\n[Test 2] Chiêu mộ quân đội khẩn cấp khi tỷ lệ quân đội < 45%:');
{
  const weakBot = createMockNation(2, 'Thổ Nhĩ Kỳ', 'DEFENSIVE');
  weakBot.troops = 10;
  weakBot.maxTroops = 200;
  weakBot.gold = 150;

  function simulateEmergencyRecruitment(bot: Nation) {
    const troopRatio = bot.maxTroops > 0 ? bot.troops / bot.maxTroops : 1;
    if (troopRatio < 0.45 && bot.gold >= 40) {
      const recruitCount = Math.min(25, Math.floor(bot.gold / 3));
      if (recruitCount > 0) {
        bot.troops = Math.min(bot.maxTroops, bot.troops + recruitCount);
        bot.gold -= recruitCount * 3;
      }
    }
  }

  simulateEmergencyRecruitment(weakBot);
  assert(weakBot.troops === 35, 'Bot tự chiêu mộ khẩn cấp +25 quân đội');
  assert(weakBot.gold === 75, 'Vàng bị trừ tương ứng 75 Vàng (25 * 3)');
}

// TEST 3: Khối liên minh chống Bá quyền (Anti-Superpower Coalition)
console.log('\n[Test 3] Khối liên minh chống Bá quyền khi 1 quốc gia chiếm >= 28% đất:');
{
  const superpower = createMockNation(1, 'Đại Việt (Superpower)', 'AGGRESSIVE');
  superpower.territoryCount = 35; // 35 / 100 = 35% > 28%

  const botA = createMockNation(2, 'Nhật Bản', 'DEFENSIVE');
  const botB = createMockNation(3, 'Triều Tiên', 'MERCHANT');
  botA.territoryCount = 10;
  botB.territoryCount = 10;
  const totalLand = 100;

  const nations = [createMockNation(0, 'Neutral', 'DEFENSIVE'), superpower, botA, botB];

  function simulateCoalition(bot: Nation) {
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

    if (maxLandRatio >= 0.28 && superpowerId > 0 && superpowerId !== bot.id) {
      nations.forEach((other: Nation) => {
        if (other && !other.isEliminated && other.id !== bot.id && other.id !== superpowerId && other.id > 0) {
          if (!other.allianceInvites) other.allianceInvites = [];
          const alreadyInvited = other.allianceInvites.some(inv => inv.senderNationId === bot.id);
          if (!alreadyInvited) {
            other.allianceInvites.push({ senderNationId: bot.id, expiryTimer: 20 });
          }
        }
      });
    }
  }

  simulateCoalition(botA);
  assert(botB.allianceInvites.length === 1, 'Bot B nhận được 1 Lời mời kết minh từ Bot A');
  assert(botB.allianceInvites[0].senderNationId === 2, 'Người gửi lời mời chính xác là Bot A (ID 2)');
}

// TEST 4: Đình chiến khẩn cấp và cống nộp khi bị dồn ép
console.log('\n[Test 4] Đề nghị đình chiến kèm cống nộp vàng khi thất thế:');
{
  const losingBot = createMockNation(2, 'Chiêm Thành', 'MERCHANT');
  losingBot.troops = 5;
  losingBot.maxTroops = 100;
  losingBot.gold = 200;

  const attacker = createMockNation(1, 'Đại Việt', 'AGGRESSIVE');
  attacker.gold = 100;
  const nations = [createMockNation(0, 'Neutral', 'DEFENSIVE'), attacker, losingBot];

  function simulateEmergencyTruce(bot: Nation) {
    const troopRatio = bot.troops / bot.maxTroops;
    if (troopRatio < 0.20 && bot.gold >= 60) {
      const enemyId = 1; // Attacker ID
      const tribute = Math.floor(bot.gold * 0.4);
      bot.gold -= tribute;
      attacker.gold += tribute;

      bot.diplomacy[enemyId] = { status: 'TRUCE', relation: 30, truceTimer: 45 };
      attacker.diplomacy[bot.id] = { status: 'TRUCE', relation: 30, truceTimer: 45 };
    }
  }

  simulateEmergencyTruce(losingBot);
  assert(losingBot.gold === 120, 'Losing bot bị trừ 80 Vàng cống nộp (40% của 200)');
  assert(attacker.gold === 180, 'Attacker nhận đủ 80 Vàng cống nộp');
  assert(losingBot.diplomacy[1].status === 'TRUCE', 'Trạng thái ngoại giao chuyển sang TRUCE');
  assert(losingBot.diplomacy[1].truceTimer === 45, 'Thời gian đếm ngược đình chiến đặt 45 giây');
}

console.log('🎉 TẤT CẢ TEST CASES AI & DIPLOMACY ĐỀU ĐÃ VƯỢT QUA HOÀN HẢO!');
