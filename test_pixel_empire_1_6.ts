import { 
  createDefaultGeneral, 
  changeGeneralLoyalty, 
  getLoyaltyState, 
  transferGeneral, 
  migrateGeneralData, 
  awardGeneralExp, 
  applyGeneralDamage 
} from './src/utils/generalCombat';
import { recordGeneralContribution, tryEvolveGeneral } from './src/utils/generalEvolution';
import { Nation, General } from './src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

function createMockNation(id: number, name: string, capX: number, capY: number): Nation {
  return {
    id,
    name,
    color: '#3b82f6',
    isPlayer: id === 1,
    personality: 'DEFENSIVE',
    gold: 500,
    goldIncome: 10,
    troops: 200,
    maxTroops: 500,
    population: 1000,
    territoryCount: 15,
    isEliminated: false,
    capitalX: capX,
    capitalY: capY,
    hasPort: false,
    techLevels: { economy: 1, military: 1, defense: 1 },
    diplomacy: {},
    allianceInvites: [],
    lastRejectedInviteTimer: {},
    traitorTimer: 0,
    reserveGenerals: [],
  };
}

console.log('--- BẮT ĐẦU KIỂM THỬ PIXEL EMPIRE 1.6 (LOYALTY & TRANSFER) ---');

// TEST 1: Loyalty kẹp chuẩn 0..100 (thử +200 và -200)
console.log('\n[Test 1] Kiểm tra kẹp giới hạn Loyalty trong khoảng 0..100:');
{
  const gen = createDefaultGeneral('g1', 1, 'Kim Ưng', 'INSPIRE_AURA', 10, 10);
  assert(gen.loyalty === 100, 'Loyalty ban đầu mặc định là 100');

  const overLoyalty = changeGeneralLoyalty(gen, 200);
  assert(overLoyalty === 100 && gen.loyalty === 100, 'Tăng +200 loyalty vẫn được kẹp tối đa 100');

  const underLoyalty = changeGeneralLoyalty(gen, -200);
  assert(underLoyalty === 0 && gen.loyalty === 0, 'Giảm -200 loyalty kẹp tối thiểu là 0');

  const midLoyalty = changeGeneralLoyalty(gen, 55);
  assert(midLoyalty === 55 && gen.loyalty === 55, 'Tăng +55 từ 0 lên đúng 55');

  assert(getLoyaltyState(gen) === 'BAT_MAN', '55 loyalty phân loại đúng là BAT_MAN (30..69)');
  gen.loyalty = 85;
  assert(getLoyaltyState(gen) === 'TRUNG_THANH', '85 loyalty phân loại đúng là TRUNG_THANH (>= 70)');
  gen.loyalty = 20;
  assert(getLoyaltyState(gen) === 'NGUY_CO_PHAN_BOI', '20 loyalty phân loại đúng là NGUY_CO_PHAN_BOI (< 30)');
}

// TEST 2: Các sự kiện thay đổi loyalty đúng số (+1, +5, -5, -2)
console.log('\n[Test 2] Kiểm tra các sự kiện thay đổi Loyalty (+1, +5, -5, -2):');
{
  const n1 = createMockNation(1, 'Đại Việt', 10, 10);
  const gen = createDefaultGeneral('g1', 1, 'Trần Hưng Đạo', 'INSPIRE_AURA', 10, 10);
  n1.general = gen;
  gen.loyalty = 50;

  // 1. Chiếm ô (+1)
  const afterCapture = changeGeneralLoyalty(gen, 1, 'Chiếm ô thành công');
  assert(afterCapture === 51 && gen.loyalty === 51, 'Chiếm ô thành công: +1 loyalty (50 -> 51)');

  // 2. Lên cấp (+5 via awardGeneralExp)
  gen.exp = 0;
  gen.level = 1;
  const expRes = awardGeneralExp(gen, n1, 200, 'Thử nghiệm');
  assert(expRes.leveledUp === true, 'Đủ EXP thăng cấp');
  assert(gen.loyalty === 56, 'Thăng cấp tướng: +5 loyalty (51 -> 56)');

  // 3. Rút lui bảo toàn tính mạng (-2 via applyGeneralDamage, hp <= 20%)
  // Đưa HP xuống 250/1000, nhận sát thương khiến còn <= 200 HP
  gen.hp = 250;
  n1.troops = 0; // Hết quân để tướng nhận sát thương trực tiếp
  // rawDamage sao cho sau giáp mất ~60 HP -> hp còn ~190 (<= 20% maxHp)
  const resRetreat = applyGeneralDamage(gen, n1, 80);
  assert(resRetreat.retreated === true && resRetreat.injured === false, 'Tướng rút lui thành công khi HP <= 20%');
  assert(gen.loyalty === 54, 'Tướng rút lui: -2 loyalty (56 -> 54)');

  // 4. Trọng thương (-5 via applyGeneralDamage, HP = 0)
  const resInjured = applyGeneralDamage(gen, n1, 500);
  assert(resInjured.injured === true && gen.hp === 0, 'Tướng bị thương nặng (HP = 0)');
  assert(gen.loyalty === 49, 'Tướng trọng thương HP = 0: -5 loyalty (54 -> 49)');
}

// TEST 3: transferGeneral giữ nguyên id, chỉ số, style, level, exp, loyalty; cập nhật đúng nationId, vị trí, status, behavior
console.log('\n[Test 3] transferGeneral bảo toàn chỉ số và cập nhật vị trí/trạng thái:');
{
  const n1 = createMockNation(1, 'Quốc Gia A', 5, 5);
  const n2 = createMockNation(2, 'Quốc Gia B', 25, 30);
  const gen = createDefaultGeneral('gen_hero', 1, 'Võ Thánh', 'SHADOW_RAID', 5, 5);
  gen.level = 12;
  gen.exp = 45;
  gen.loyalty = 82;
  gen.style = 'WARRIOR';
  gen.hp = 950;
  gen.maxHp = 1200;
  gen.armor = 0.35;
  gen.attack = 105;
  gen.status = 'MARCHING';
  gen.behavior = 'ATTACK';
  n1.general = gen;

  const success = transferGeneral(gen, n1, n2);
  assert(success === true, 'Chuyển tướng thành công');
  assert(n1.general === undefined, 'Tướng đã rời khỏi quốc gia cũ');
  assert(n2.general?.id === 'gen_hero', 'Tướng được gán làm ACTIVE của quốc gia mới');
  assert(gen.nationId === 2, 'nationId cập nhật sang 2');
  assert(gen.x === n2.capitalX && gen.y === n2.capitalY, 'Vị trí đặt tại thủ đô mới (25, 30)');
  assert((gen.status as string) === 'IDLE', 'status reset về IDLE');
  assert((gen.behavior as string) === 'DEFEND', 'behavior reset về DEFEND');
  assert(gen.role === 'ACTIVE', 'role là ACTIVE do n2 chưa có tướng');

  // Kiểm tra tính toàn vẹn của chỉ số
  assert(gen.id === 'gen_hero', 'Giữ nguyên ID');
  assert(gen.name === 'Võ Thánh', 'Giữ nguyên Name');
  assert(gen.level === 12, 'Giữ nguyên Level 12');
  assert(gen.exp === 45, 'Giữ nguyên EXP 45');
  assert(gen.loyalty === 82, 'Giữ nguyên Loyalty 82');
  assert(gen.style === 'WARRIOR', 'Giữ nguyên Style WARRIOR');
  assert(gen.hp === 950 && gen.maxHp === 1200, 'Giữ nguyên HP/MaxHP');
  assert(gen.armor === 0.35 && gen.attack === 105, 'Giữ nguyên Armor/Attack');
  assert(Boolean(gen.history?.[0]?.includes('[Chuyển Quân]')), 'Có dòng lịch sử chuyển quân');
}

// TEST 4: transferGeneral vào nước đã có tướng ACTIVE thì vào reserveGenerals và role = 'RESERVE'
console.log('\n[Test 4] transferGeneral sang quốc gia đã có tướng ACTIVE -> chuyển thành RESERVE:');
{
  const n1 = createMockNation(1, 'Nước 1', 0, 0);
  const n2 = createMockNation(2, 'Nước 2', 50, 50);

  const existingGen = createDefaultGeneral('g_active', 2, 'Đương Nhiệm', 'IRON_BORDER_SHIELD', 50, 50);
  n2.general = existingGen;

  const newcomer = createDefaultGeneral('g_transfer', 1, 'Tân Binh', 'MISSILE_BARRAGE', 0, 0);
  n1.general = newcomer;

  const success = transferGeneral(newcomer, n1, n2);
  assert(success === true, 'Chuyển tướng thành công');
  assert(n2.general?.id === 'g_active', 'Tướng ACTIVE đương nhiệm vẫn giữ vị trí');
  assert(n2.reserveGenerals?.length === 1, 'Tướng mới được đẩy vào reserveGenerals');
  assert(n2.reserveGenerals?.[0].id === 'g_transfer', 'Tướng trong reserve là g_transfer');
  assert(newcomer.role === 'RESERVE', 'Vai trò chuyển thành RESERVE');
  assert(newcomer.nationId === 2, 'nationId chuyển thành 2');
}

// TEST 5: transferGeneral chống trùng lặp: gọi lại lần 2 trả về false, không nhân đôi
console.log('\n[Test 5] transferGeneral chống trùng lặp (Anti-duplication):');
{
  const n1 = createMockNation(1, 'Nước A', 10, 10);
  const n2 = createMockNation(2, 'Nước B', 20, 20);
  const gen = createDefaultGeneral('g_single', 1, 'Độc Bản', 'INSPIRE_AURA', 10, 10);
  n1.general = gen;

  const firstCall = transferGeneral(gen, n1, n2);
  assert(firstCall === true, 'Chuyển lần 1 thành công');

  const secondCall = transferGeneral(gen, n1, n2);
  assert(secondCall === false, 'Gọi lại lần 2 trả về false do tướng đã ở n2');

  const sameNation = transferGeneral(gen, n2, n2);
  assert(sameNation === false, 'Chuyển cùng quốc gia trả về false');

  const totalInstances = (n2.general?.id === 'g_single' ? 1 : 0) + (n2.reserveGenerals?.filter(g => g.id === 'g_single').length || 0);
  assert(totalInstances === 1, 'Tướng chỉ tồn tại ở đúng 1 nơi duy nhất');
}

// TEST 6: Tướng RESERVE không nhận EXP, không tiến hóa, không đổi loyalty
console.log('\n[Test 6] Ràng buộc tướng RESERVE: Không EXP, không tiến hóa, không đổi loyalty:');
{
  const n = createMockNation(3, 'Nước Thử Nghiệm', 10, 10);
  const reserveGen = createDefaultGeneral('g_res', 3, 'Tướng Dự Bị', 'SUPPLY_REINFORCE', 10, 10);
  reserveGen.role = 'RESERVE';
  reserveGen.loyalty = 80;
  reserveGen.level = 10;
  reserveGen.exp = 0;

  // 1. Không đổi loyalty
  const loyaltyRes = changeGeneralLoyalty(reserveGen, 10, 'Test reserve');
  assert(loyaltyRes === 80 && reserveGen.loyalty === 80, 'Tướng RESERVE không thay đổi loyalty (+10 bị từ chối)');
  changeGeneralLoyalty(reserveGen, -20, 'Test penalty');
  assert(reserveGen.loyalty === 80, 'Tướng RESERVE không bị giảm loyalty (-20 bị từ chối)');

  // 2. Không nhận EXP
  const expRes = awardGeneralExp(reserveGen, n, 500, 'Test combat');
  assert(expRes.expGained === 0 && reserveGen.exp === 0, 'Tướng RESERVE không nhận EXP');

  // 3. Không tiến hóa
  const recorded = recordGeneralContribution(reserveGen, 'TACTICAL_CAPTURE', 10);
  assert(recorded === false, 'Tướng RESERVE không ghi nhận điểm tiến hóa');
  const evo = tryEvolveGeneral(reserveGen);
  assert(evo === undefined && reserveGen.style === undefined, 'Tướng RESERVE không thể tiến hóa');
}

// TEST 7: migrateGeneralData đọc dữ liệu cũ thiếu loyalty trả về 100, giữ nguyên reserveGenerals
console.log('\n[Test 7] migrateGeneralData tương thích dữ liệu cũ:');
{
  const legacyGenRaw = {
    id: 'old_gen',
    name: 'Tướng Cũ',
    level: 5,
    hp: 1000,
    // Không có loyalty, không có style
  };

  const migratedActive = migrateGeneralData(legacyGenRaw, 1, 15, 20);
  assert(migratedActive.loyalty === 100, 'Dữ liệu cũ thiếu loyalty được gán mặc định 100');
  assert(migratedActive.role === 'ACTIVE', 'Mặc định gán role ACTIVE nếu không có');

  const legacyReserveRaw = {
    id: 'old_reserve_gen',
    name: 'Tướng Dự Bị Cũ',
    role: 'RESERVE',
    loyalty: 65,
  };
  const migratedReserve = migrateGeneralData(legacyReserveRaw, 1, 15, 20);
  assert(migratedReserve.role === 'RESERVE', 'Giữ nguyên vai trò RESERVE khi migrate');
  assert(migratedReserve.loyalty === 65, 'Giữ nguyên loyalty 65 khi migrate');
}

console.log('\n🎉 TẤT CẢ 7 TEST CASES ĐỀU ĐÃ VƯỢT QUA HOÀN HẢO!');
