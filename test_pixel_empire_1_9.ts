import { 
  createDefaultGeneral, 
  calculateGeneralStats,
  captureGeneralOnCapitalFall,
  appointReserveGeneral,
  transferGeneral,
  migrateGeneralData,
  MAX_RESERVE_GENERALS
} from './src/utils/generalCombat';
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
    color: id === 1 ? '#3b82f6' : '#ef4444',
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

console.log('--- BẮT ĐẦU KIỂM THỬ PIXEL EMPIRE 1.9 (FIX GENERAL CAPTURE) ---');

// TEST 1: Attacker KHÔNG CÓ ACTIVE, KHÔNG CÓ DỰ BỊ -> Bắt tướng thành công:
// - Attacker nhận tướng thay thế Lv1 làm ACTIVE (không mất chỉ huy).
// - Tướng bị bắt nằm trong RESERVE của attacker.
console.log('\n[Test 1] Attacker không có ACTIVE & 0 dự bị: tự tạo tướng Lv1 ACTIVE, tướng bị bắt vào RESERVE:');
{
  const attacker = createMockNation(1, 'Đại Việt', 10, 10);
  attacker.general = undefined; // Attacker hoàn toàn không có chỉ huy
  attacker.reserveGenerals = [];

  const defender = createMockNation(2, 'Nguyên Mông', 30, 30);
  const defGen = createDefaultGeneral('thoat_hoan', 2, 'Thoát Hoan', 'IRON_BORDER_SHIELD', 30, 30);
  defGen.level = 4;
  defender.general = defGen;

  const result = captureGeneralOnCapitalFall(attacker, defender);
  assert(result.captured === true, 'Bắt tướng thành công trả về captured: true');
  assert(result.capturedName === 'Thoát Hoan', 'Tên tướng bị bắt là Thoát Hoan');

  // Attacker không bị mất chỉ huy: có tướng thay thế Lv1 ACTIVE
  const atkGen = attacker.general as General | undefined;
  assert(Boolean(atkGen), 'Attacker có tướng chỉ huy mới');
  assert(atkGen?.role === 'ACTIVE', 'Tướng chỉ huy của attacker có role ACTIVE');
  assert(atkGen?.level === 1, 'Tướng thay thế của attacker có cấp độ Lv1');
  assert(atkGen?.id !== 'thoat_hoan', 'Tướng chỉ huy của attacker không phải tướng bị bắt');

  // Tướng bị bắt nằm trong RESERVE của attacker
  const capturedInAttacker = attacker.reserveGenerals?.find(g => g.id === 'thoat_hoan');
  assert(Boolean(capturedInAttacker), 'Tướng Thoát Hoan nằm trong attacker.reserveGenerals');
  assert(capturedInAttacker?.role === 'RESERVE', 'Vai trò của Thoát Hoan là RESERVE');
  assert(capturedInAttacker?.nationId === 1, 'nationId của Thoát Hoan là 1');
  assert((attacker.reserveGenerals?.length || 0) === 1, 'Attacker có đúng 1 tướng dự bị');
}

// TEST 2: Attacker KHÔNG CÓ ACTIVE, CÓ DỰ BỊ:
// - Ưu tiên bổ nhiệm tướng dự bị có Level cao nhất lên ACTIVE.
// - Tướng bị bắt vẫn nằm trong RESERVE của attacker.
console.log('\n[Test 2] Attacker không có ACTIVE & có 2 dự bị (Lv2, Lv5): bổ nhiệm Lv5 lên ACTIVE, tướng bị bắt vào RESERVE:');
{
  const attacker = createMockNation(1, 'Đại Việt', 10, 10);
  attacker.general = undefined; // Không có active

  const resLow = createDefaultGeneral('atk_res_low', 1, 'Tướng Dự Bị Trẻ', 'INSPIRE_AURA', 10, 10);
  resLow.level = 2;
  resLow.role = 'RESERVE';

  const resHigh = createDefaultGeneral('atk_res_high', 1, 'Tướng Dự Bị Lão Thành', 'SUPPLY_REINFORCE', 10, 10);
  resHigh.level = 5;
  resHigh.role = 'RESERVE';

  attacker.reserveGenerals = [resLow, resHigh];

  const defender = createMockNation(2, 'Chiêm Thành', 25, 25);
  const defGen = createDefaultGeneral('che_bong_nga', 2, 'Chế Bồng Nga', 'SHADOW_RAID', 25, 25);
  defGen.level = 6;
  defender.general = defGen;

  const result = captureGeneralOnCapitalFall(attacker, defender);
  assert(result.captured === true, 'Bắt tướng thành công');

  // Tướng dự bị có Level cao nhất (Lv5) được bổ nhiệm lên ACTIVE
  const atkGen = attacker.general as General | undefined;
  assert(atkGen?.id === 'atk_res_high', 'Tướng dự bị Lv5 (atk_res_high) được bổ nhiệm làm ACTIVE');
  assert(atkGen?.role === 'ACTIVE', 'Vai trò là ACTIVE');

  // Tướng bị bắt nằm trong RESERVE
  const capturedGen = attacker.reserveGenerals?.find(g => g.id === 'che_bong_nga');
  assert(Boolean(capturedGen), 'Chế Bồng Nga nằm trong attacker.reserveGenerals');
  assert(capturedGen?.role === 'RESERVE', 'Chế Bồng Nga có role RESERVE');

  // Kiểm tra danh sách dự bị: atk_res_low và che_bong_nga (tổng 2)
  assert((attacker.reserveGenerals?.length || 0) === 2, 'Attacker có 2 dự bị sau khi bắt');
  assert(!attacker.reserveGenerals?.some(g => g.id === 'atk_res_high'), 'Tướng ACTIVE không nằm trong dự bị');
}

// TEST 3: Giới hạn 3 RESERVE: Attacker KHÔNG CÓ ACTIVE nhưng CÓ ĐỦ 3 DỰ BỊ:
// - Bổ nhiệm 1 dự bị lên ACTIVE -> còn 2 dự bị -> bắt tướng đối phương thành công vào slot thứ 3!
// - Tổng cộng: 1 ACTIVE và đúng 3 RESERVE (không vượt trần 3).
console.log('\n[Test 3] Attacker không có ACTIVE & đã có 3 dự bị: bổ nhiệm 1 lên ACTIVE -> còn 2 -> nhận tướng bị bắt vào slot 3 (đúng 3 RESERVE):');
{
  const attacker = createMockNation(1, 'Đại Việt', 10, 10);
  attacker.general = undefined;

  const r1 = createDefaultGeneral('r1', 1, 'Dự Bị 1', 'INSPIRE_AURA', 10, 10); r1.level = 2; r1.role = 'RESERVE';
  const r2 = createDefaultGeneral('r2', 1, 'Dự Bị 2', 'INSPIRE_AURA', 10, 10); r2.level = 4; r2.role = 'RESERVE';
  const r3 = createDefaultGeneral('r3', 1, 'Dự Bị 3', 'INSPIRE_AURA', 10, 10); r3.level = 3; r3.role = 'RESERVE';
  attacker.reserveGenerals = [r1, r2, r3];

  const defender = createMockNation(2, 'Phe B', 30, 30);
  defender.general = createDefaultGeneral('g_def_3', 2, 'Tướng Địch', 'MISSILE_BARRAGE', 30, 30);
  defender.general.level = 3;

  const result = captureGeneralOnCapitalFall(attacker, defender);
  assert(result.captured === true, 'Bắt tướng thành công');
  const atkGen = attacker.general as General | undefined;
  assert(atkGen?.id === 'r2', 'Dự bị cấp cao nhất r2 (Lv4) lên làm ACTIVE');
  assert(attacker.reserveGenerals?.length === MAX_RESERVE_GENERALS, 'Số dự bị của attacker đạt đúng tối đa 3');
  assert(attacker.reserveGenerals?.some(g => g.id === 'g_def_3'), 'Tướng bị bắt nằm trong danh sách dự bị');
  assert(!attacker.reserveGenerals?.some(g => g.id === 'r2'), 'Tướng ACTIVE (r2) không bị lặp lại trong dự bị');
}

// TEST 4: Giới hạn 3 RESERVE: Attacker ĐÃ CÓ ACTIVE VÀ ĐỦ 3 DỰ BỊ:
// - Từ chối bắt tướng (captured: false) để không vượt trần 3 RESERVE.
// - Không bên nào mất tướng, không ai bị nhân bản hay thay đổi vị trí.
console.log('\n[Test 4] Attacker đã có ACTIVE và đủ 3 dự bị: từ chối bắt (captured: false), bảo toàn nguyên trạng:');
{
  const attacker = createMockNation(1, 'Đại Việt', 10, 10);
  attacker.general = createDefaultGeneral('main_lead', 1, 'Chủ Tướng', 'INSPIRE_AURA', 10, 10);
  attacker.reserveGenerals = [
    createDefaultGeneral('f1', 1, 'DB 1', 'INSPIRE_AURA', 10, 10),
    createDefaultGeneral('f2', 1, 'DB 2', 'INSPIRE_AURA', 10, 10),
    createDefaultGeneral('f3', 1, 'DB 3', 'INSPIRE_AURA', 10, 10),
  ];

  const defender = createMockNation(2, 'Phe Địch', 40, 40);
  const defLead = createDefaultGeneral('target_lead', 2, 'Tướng Địch Lv5', 'IRON_BORDER_SHIELD', 40, 40);
  defLead.level = 5;
  defender.general = defLead;

  const result = captureGeneralOnCapitalFall(attacker, defender);
  assert(result.captured === false, 'Từ chối bắt khi attacker đã đầy 3 dự bị');
  assert(defender.general?.id === 'target_lead', 'Tướng địch vẫn thuộc về defender');
  assert(attacker.reserveGenerals.length === 3, 'Số dự bị của attacker giữ nguyên 3');
}

// TEST 5: Thủ đô thất thủ chỉ xử lý một lần (kể cả khi defender có tướng dự bị cấp cao):
// - Lần 1: Thất thủ bắt tướng cũ, defender đưa tướng dự bị Lv5 lên ACTIVE.
// - Lần 2: Gọi tiếp captureGeneralOnCapitalFall trong cùng đợt thất thủ -> TRẢ VỀ FALSE, không bắt tiếp tướng Lv5 mới nhậm chức!
console.log('\n[Test 5] Thủ đô thất thủ chỉ xử lý một lần (không bắt liên tiếp tướng mới nhậm chức):');
{
  const attacker = createMockNation(1, 'Phe A', 5, 5);
  attacker.general = createDefaultGeneral('lead_a', 1, 'Tướng A', 'INSPIRE_AURA', 5, 5);

  const defender = createMockNation(2, 'Phe B', 50, 50);
  defender.general = createDefaultGeneral('lead_b', 2, 'Chủ Soái B', 'SHADOW_RAID', 50, 50);
  defender.general.level = 4;

  const powerfulReserve = createDefaultGeneral('strong_res', 2, 'Thượng Tướng B', 'IRON_BORDER_SHIELD', 50, 50);
  powerfulReserve.level = 7;
  powerfulReserve.role = 'RESERVE';
  defender.reserveGenerals = [powerfulReserve];

  // Lần 1: Bắt chủ soái B (lead_b)
  const res1 = captureGeneralOnCapitalFall(attacker, defender);
  assert(res1.captured === true, 'Lần 1: Bắt thành công lead_b');
  assert(defender.capitalCaptured === true, 'defender.capitalCaptured được đánh dấu true');
  assert(defender.general?.id === 'strong_res', 'Thượng Tướng B (Lv7) lên làm ACTIVE thay thế');

  // Lần 2: Thử gọi lại lần nữa (cùng 1 đợt thất thủ)
  const res2 = captureGeneralOnCapitalFall(attacker, defender);
  assert(res2.captured === false, 'Lần 2: Bị từ chối vì thủ đô thất thủ chỉ xử lý một lần');
  assert(defender.general?.id === 'strong_res', 'Thượng Tướng B không bị bắt liên tiếp');
  assert(attacker.reserveGenerals?.length === 1, 'Attacker chỉ có 1 tướng bị bắt');
}

// TEST 6: Defender luôn có ACTIVE thay thế (với dự bị: chọn level cao nhất; không dự bị: tạo mới Lv1):
console.log('\n[Test 6] Defender luôn đảm bảo có ACTIVE thay thế:');
{
  // 6a. Defender có dự bị
  const atk = createMockNation(1, 'A', 0, 0);
  atk.general = createDefaultGeneral('ga', 1, 'GA', 'INSPIRE_AURA', 0, 0);

  const defA = createMockNation(2, 'B', 10, 10);
  defA.general = createDefaultGeneral('gb', 2, 'GB', 'INSPIRE_AURA', 10, 10);
  defA.general.level = 3;
  const defRes = createDefaultGeneral('gb_res', 2, 'GB Res', 'INSPIRE_AURA', 10, 10);
  defRes.level = 4;
  defRes.role = 'RESERVE';
  defA.reserveGenerals = [defRes];

  captureGeneralOnCapitalFall(atk, defA);
  assert(defA.general?.id === 'gb_res', 'Defender có dự bị: gb_res được thăng lên ACTIVE');
  assert(defA.general?.role === 'ACTIVE', 'Role là ACTIVE');

  // 6b. Defender không có dự bị
  const defB = createMockNation(3, 'C', 20, 20);
  defB.general = createDefaultGeneral('gc', 3, 'GC', 'INSPIRE_AURA', 20, 20);
  defB.general.level = 5;
  defB.reserveGenerals = [];

  captureGeneralOnCapitalFall(atk, defB);
  assert(Boolean(defB.general), 'Defender không có dự bị: được tạo mới tướng chỉ huy');
  assert(defB.general?.role === 'ACTIVE', 'Tướng mới có role ACTIVE');
  assert(defB.general?.level === 1, 'Tướng mới sinh ra ở cấp độ Lv1');
}

// TEST 7: Giữ đúng HP, EXP, Level, Loyalty (<= 40) và Evolution; không hồi máu:
console.log('\n[Test 7] Bảo toàn nguyên vẹn HP, EXP, Level, Loyalty, Evolution (không hồi máu):');
{
  const atk = createMockNation(1, 'A', 0, 0);
  atk.general = createDefaultGeneral('ga', 1, 'GA', 'INSPIRE_AURA', 0, 0);

  const def = createMockNation(2, 'B', 10, 10);
  const injuredGen = createDefaultGeneral('hero_inj', 2, 'Hùng Tướng', 'SHADOW_RAID', 10, 10);
  injuredGen.level = 8;
  injuredGen.exp = 420;
  injuredGen.hp = 350;
  injuredGen.maxHp = 1200;
  injuredGen.armor = 0.45;
  injuredGen.attack = 105;
  injuredGen.loyalty = 95;
  injuredGen.style = 'GUARDIAN';
  injuredGen.evolutionStats = { damageDealt: 3000, damageAbsorbed: 5000, wavesLed: 20, tacticalCaptures: 6 };
  def.general = injuredGen;

  const capRes = captureGeneralOnCapitalFall(atk, def);
  assert(capRes.captured === true, 'Bắt tướng thành công');

  const cap = atk.reserveGenerals?.find(g => g.id === 'hero_inj')!;
  assert(cap.level === 8, 'Giữ nguyên Level 8');
  assert(cap.exp === 420, 'Giữ nguyên EXP 420');
  assert(cap.hp === 350, 'Giữ nguyên HP 350 (không hồi máu)');
  assert(cap.maxHp === 1200, 'Giữ nguyên maxHp 1200');
  assert(cap.armor === 0.45, 'Giữ nguyên armor');
  assert(cap.attack === 105, 'Giữ nguyên attack');
  assert(cap.style === 'GUARDIAN', 'Giữ nguyên style GUARDIAN');
  assert(cap.evolutionStats?.damageAbsorbed === 5000, 'Giữ nguyên evolutionStats');
  assert(cap.loyalty === 40, 'Loyalty giảm từ 95 xuống trần 40');
  assert(Boolean(cap.history?.[0]?.includes('[Bị Bắt]')), 'Có lịch sử bị bắt ghi nhận');
}

// TEST 8: Tính toàn vẹn & chống nhân bản/mất tướng:
// Không tướng nào xuất hiện ở 2 nơi, mỗi nước đúng 1 ACTIVE, reserve <= 3
console.log('\n[Test 8] Toàn vẹn & chống trùng lặp tuyệt đối:');
{
  const atk = createMockNation(1, 'A', 0, 0);
  atk.general = undefined; // Sẽ tự tạo active
  const def = createMockNation(2, 'B', 10, 10);
  def.general = createDefaultGeneral('b_lead', 2, 'B Lead', 'INSPIRE_AURA', 10, 10);
  def.general.level = 3;

  captureGeneralOnCapitalFall(atk, def);

  const atkGen = atk.general as General | undefined;
  assert(atkGen?.role === 'ACTIVE', 'Attacker có 1 ACTIVE');
  assert(def.general?.role === 'ACTIVE', 'Defender có 1 ACTIVE');

  const allGen = [
    atkGen!,
    ...(atk.reserveGenerals || []),
    def.general!,
    ...(def.reserveGenerals || [])
  ];
  const ids = allGen.map(g => g.id);
  const setIds = new Set(ids);
  assert(ids.length === setIds.size, 'Tất cả các tướng có ID độc nhất vô nhị, không trùng lặp');
  assert((atk.reserveGenerals || []).length <= MAX_RESERVE_GENERALS, 'Attacker reserve <= 3');
  assert((def.reserveGenerals || []).length <= MAX_RESERVE_GENERALS, 'Defender reserve <= 3');
}

// TEST 9: Save/Load migration giữ đúng toàn bộ danh sách tướng và reserve
console.log('\n[Test 9] Save/Load migration giữ trọn vẹn thông tin tướng:');
{
  const rawGen = {
    id: 'gen_saved_1',
    name: 'Tướng Lưu',
    role: 'RESERVE',
    level: 5,
    exp: 200,
    hp: 600,
    maxHp: 1000,
    loyalty: 38,
    style: 'COMMANDER',
    evolutionStats: { damageDealt: 100, damageAbsorbed: 200, wavesLed: 5, tacticalCaptures: 1 }
  };
  const migrated = migrateGeneralData(rawGen, 1, 10, 10);
  assert(migrated.id === 'gen_saved_1', 'Giữ nguyên ID');
  assert(migrated.role === 'RESERVE', 'Giữ vai trò RESERVE');
  assert(migrated.level === 5, 'Giữ level 5');
  assert(migrated.loyalty === 38, 'Giữ loyalty 38');
  assert(migrated.style === 'COMMANDER', 'Giữ style COMMANDER');
  assert(migrated.hp === 600, 'Giữ HP 600');
}

console.log('\n🎉 TẤT CẢ 9 TEST CASES PIXEL EMPIRE 1.9 ĐỀU ĐÃ VƯỢT QUA HOÀN HẢO!');
