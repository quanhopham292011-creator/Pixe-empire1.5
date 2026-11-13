import { 
  createDefaultGeneral, 
  calculateGeneralStats,
  captureGeneralOnCapitalFall,
  processGeneralRecoveryTick,
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

console.log('--- BẮT ĐẦU KIỂM THỬ PIXEL EMPIRE 1.8 (BẮT TƯỚNG KHI THẤT THỦ THỦ ĐÔ) ---');

// TEST 1: Bắt được tướng ở thủ đô, Lv2 trở lên: tướng thành RESERVE của attacker, nationId = attacker.id
console.log('\n[Test 1] Bắt tướng ở thủ đô (Lv >= 2) -> Tướng thành RESERVE của attacker, nationId = attacker.id:');
{
  const attacker = createMockNation(1, 'Đại Việt', 10, 10);
  attacker.general = createDefaultGeneral('atk_gen', 1, 'Trần Hưng Đạo', 'INSPIRE_AURA', 10, 10);

  const defender = createMockNation(2, 'Nguyên Mông', 30, 30);
  const defGen = createDefaultGeneral('def_gen', 2, 'Thoát Hoan', 'IRON_BORDER_SHIELD', 30, 30);
  defGen.level = 4;
  defender.general = defGen;

  const result = captureGeneralOnCapitalFall(attacker, defender);
  assert(result.captured === true, 'Bắt tướng thành công trả về captured: true');
  assert(result.capturedName === 'Thoát Hoan', 'Tên tướng bị bắt là Thoát Hoan');

  // Kiểm tra tướng trong reserveGenerals của attacker
  const capturedInAttacker = attacker.reserveGenerals?.find(g => g.id === 'def_gen');
  assert(Boolean(capturedInAttacker), 'Tướng bị bắt xuất hiện trong attacker.reserveGenerals');
  assert(capturedInAttacker?.role === 'RESERVE', 'Vai trò của tướng bị bắt là RESERVE');
  assert(capturedInAttacker?.nationId === 1, 'nationId của tướng bị bắt chuyển thành attacker.id (1)');
}

// TEST 2: Giữ nguyên id, Level, EXP, style, evolutionStats, HP, skillId; loyalty <= 40; history có dòng "[Bị Bắt]"
console.log('\n[Test 2] Bảo toàn nguyên vẹn chỉ số, loyalty <= 40, history ghi nhận [Bị Bắt]:');
{
  const attacker = createMockNation(1, 'Đại Việt', 10, 10);
  attacker.general = createDefaultGeneral('atk_gen', 1, 'Trần Hưng Đạo', 'INSPIRE_AURA', 10, 10);

  const defender = createMockNation(2, 'Chiêm Thành', 25, 25);
  const defGen = createDefaultGeneral('che_bong_nga', 2, 'Chế Bồng Nga', 'SHADOW_RAID', 25, 25);
  defGen.level = 6;
  defGen.exp = 280;
  defGen.hp = 730;
  defGen.maxHp = 1100;
  defGen.loyalty = 85;
  defGen.style = 'WARRIOR';
  defGen.evolutionStats = { damageDealt: 1500, damageAbsorbed: 600, wavesLed: 8, tacticalCaptures: 4 };
  defender.general = defGen;

  const result = captureGeneralOnCapitalFall(attacker, defender);
  assert(result.captured === true, 'Bắt tướng thành công');

  const captured = attacker.reserveGenerals?.find(g => g.id === 'che_bong_nga')!;
  assert(captured.id === 'che_bong_nga', 'Giữ nguyên ID');
  assert(captured.level === 6, 'Giữ nguyên Level 6');
  assert(captured.exp === 280, 'Giữ nguyên EXP 280');
  assert(captured.hp === 730 && captured.maxHp === 1100, 'Giữ nguyên HP (730/1100) không hồi máu');
  assert(captured.skillId === 'SHADOW_RAID', 'Giữ nguyên skillId');
  assert(captured.style === 'WARRIOR', 'Giữ nguyên style WARRIOR');
  assert(captured.evolutionStats?.damageDealt === 1500, 'Giữ nguyên evolutionStats');
  assert((captured.loyalty ?? 100) <= 40 && captured.loyalty === 40, 'Loyalty giảm xuống tối đa 40 (từ 85 -> 40)');
  assert(Boolean(captured.history?.[0]?.includes('[Bị Bắt]')), 'History đầu tiên có chứa [Bị Bắt]');
}

// TEST 3: Không bắt được khi tướng MARCHING, Lv1, hoặc attacker đã đủ 3 dự bị. Trả về captured: false, dữ liệu không đổi
console.log('\n[Test 3] Điều kiện từ chối bắt tướng (MARCHING, Lv1, hoặc đủ 3 dự bị):');
{
  const attacker = createMockNation(1, 'Phe A', 5, 5);
  attacker.general = createDefaultGeneral('g_a', 1, 'Tướng A', 'INSPIRE_AURA', 5, 5);

  const defender = createMockNation(2, 'Phe B', 15, 15);
  const defGen = createDefaultGeneral('g_b', 2, 'Tướng B', 'MISSILE_BARRAGE', 15, 15);
  defender.general = defGen;

  // 1. Tướng defender là Lv1 -> không bị bắt
  defGen.level = 1;
  const resLv1 = captureGeneralOnCapitalFall(attacker, defender);
  assert(resLv1.captured === false, 'Tướng Lv1: captured = false');
  assert(defender.general?.id === 'g_b', 'Tướng Lv1 vẫn ở lại phe B');

  // 2. Tướng defender đang MARCHING -> không bị bắt
  defGen.level = 3;
  defGen.status = 'MARCHING';
  const resMarching = captureGeneralOnCapitalFall(attacker, defender);
  assert(resMarching.captured === false, 'Tướng MARCHING: captured = false');
  assert(defender.general?.id === 'g_b', 'Tướng MARCHING vẫn thuộc phe B');

  // 3. Attacker đã đủ 3 tướng dự bị (MAX_RESERVE_GENERALS = 3) -> không bắt được thêm
  defGen.status = 'IDLE';
  attacker.reserveGenerals = [
    createDefaultGeneral('res1', 1, 'Dự Bị 1', 'INSPIRE_AURA', 5, 5),
    createDefaultGeneral('res2', 1, 'Dự Bị 2', 'INSPIRE_AURA', 5, 5),
    createDefaultGeneral('res3', 1, 'Dự Bị 3', 'INSPIRE_AURA', 5, 5),
  ];
  assert(attacker.reserveGenerals.length === MAX_RESERVE_GENERALS, 'Attacker đã đủ 3 tướng dự bị');
  const resFull = captureGeneralOnCapitalFall(attacker, defender);
  assert(resFull.captured === false, 'Attacker đầy 3 dự bị: captured = false');
  assert(defender.general?.id === 'g_b', 'Tướng phe B không bị bắt khi đối phương đầy chỗ');
}

// TEST 4: Defender có reserve: tướng level cao nhất lên ACTIVE. Defender không có reserve: nhận tướng mới Lv1 với ID duy nhất
console.log('\n[Test 4] Defender tự động thay thế tướng chỉ huy sau khi mất tướng:');
{
  // Kịch bản 4a: Defender có tướng dự bị
  const atk = createMockNation(1, 'Phe Tấn Công', 0, 0);
  atk.general = createDefaultGeneral('g1', 1, 'Tướng 1', 'INSPIRE_AURA', 0, 0);

  const defWithReserve = createMockNation(2, 'Phe Phòng Thủ Có Dự Bị', 20, 20);
  defWithReserve.general = createDefaultGeneral('def_lead', 2, 'Chủ Tướng', 'IRON_BORDER_SHIELD', 20, 20);
  defWithReserve.general.level = 3;

  const lowReserve = createDefaultGeneral('res_low', 2, 'Tướng Trẻ', 'INSPIRE_AURA', 20, 20);
  lowReserve.level = 2;
  lowReserve.role = 'RESERVE';

  const highReserve = createDefaultGeneral('res_high', 2, 'Lão Tướng', 'SUPPLY_REINFORCE', 20, 20);
  highReserve.level = 5;
  highReserve.role = 'RESERVE';

  defWithReserve.reserveGenerals = [lowReserve, highReserve];

  const resA = captureGeneralOnCapitalFall(atk, defWithReserve);
  assert(resA.captured === true, 'Bắt thành công chủ tướng cũ');
  assert(defWithReserve.general?.id === 'res_high', 'Tướng dự bị có Level cao nhất (Lv5 res_high) được bổ nhiệm lên ACTIVE');
  assert(defWithReserve.general?.role === 'ACTIVE', 'Vai trò được chuyển thành ACTIVE');
  assert(defWithReserve.reserveGenerals.length === 1 && defWithReserve.reserveGenerals[0].id === 'res_low', 'Tướng dự bị còn lại là res_low');

  // Kịch bản 4b: Defender không có tướng dự bị
  const defNoReserve = createMockNation(3, 'Phe Phòng Thủ Không Dự Bị', 40, 40);
  defNoReserve.general = createDefaultGeneral('solo_lead', 3, 'Chủ Soái Độc Nhất', 'SHADOW_RAID', 40, 40);
  defNoReserve.general.level = 4;
  defNoReserve.reserveGenerals = [];

  const resB = captureGeneralOnCapitalFall(atk, defNoReserve);
  assert(resB.captured === true, 'Bắt thành công chủ soái');
  assert(Boolean(defNoReserve.general), 'Defender được tạo 1 tướng mới');
  assert(defNoReserve.general?.level === 1, 'Tướng mới sinh có cấp độ Lv1');
  assert(defNoReserve.general?.role === 'ACTIVE', 'Tướng mới sinh có role ACTIVE');
  assert(defNoReserve.general?.id !== 'solo_lead', 'Tướng mới có ID hoàn toàn mới');
  assert(defNoReserve.general?.id.startsWith('gen_3_'), 'ID tướng mới bắt đầu bằng gen_3_');
}

// TEST 5: Sau mọi trường hợp: mỗi nước đúng 1 ACTIVE, không tướng nào xuất hiện 2 lần, không mất tướng
console.log('\n[Test 5] Bảo toàn tính toàn vẹn: Mỗi nước 1 ACTIVE, không trùng lặp ID:');
{
  const atk = createMockNation(1, 'Phe A', 10, 10);
  atk.general = createDefaultGeneral('g_atk', 1, 'Tướng A', 'INSPIRE_AURA', 10, 10);

  const def = createMockNation(2, 'Phe B', 30, 30);
  def.general = createDefaultGeneral('g_def', 2, 'Tướng B', 'MISSILE_BARRAGE', 30, 30);
  def.general.level = 3;

  captureGeneralOnCapitalFall(atk, def);

  assert(atk.general?.role === 'ACTIVE', 'Attacker có tướng ACTIVE');
  assert(def.general?.role === 'ACTIVE', 'Defender có tướng ACTIVE');

  const allGenerals = [
    atk.general!,
    ...(atk.reserveGenerals || []),
    def.general!,
    ...(def.reserveGenerals || [])
  ];
  const allIds = allGenerals.map(g => g.id);
  const idSet = new Set(allIds);

  assert(allIds.length === idSet.size, 'Không có ID tướng nào bị trùng lặp giữa hai phe');
  assert(!(atk.reserveGenerals || []).some(g => g.id === atk.general?.id), 'Tướng ACTIVE của attacker không nằm trong reserve');
  assert(!(def.reserveGenerals || []).some(g => g.id === def.general?.id), 'Tướng ACTIVE của defender không nằm trong reserve');
}

// TEST 6: Gọi hàm 2 lần liên tiếp không bắt trùng (tướng Lv1 mới sinh không bị bắt lại)
console.log('\n[Test 6] Gọi 2 lần liên tiếp không bắt trùng tướng Lv1 mới sinh:');
{
  const atk = createMockNation(1, 'Phe A', 10, 10);
  atk.general = createDefaultGeneral('g_atk', 1, 'Tướng A', 'INSPIRE_AURA', 10, 10);

  const def = createMockNation(2, 'Phe B', 30, 30);
  def.general = createDefaultGeneral('g_def', 2, 'Tướng B', 'MISSILE_BARRAGE', 30, 30);
  def.general.level = 4;
  def.reserveGenerals = [];

  // Lần 1: Bắt tướng Lv4
  const first = captureGeneralOnCapitalFall(atk, def);
  assert(first.captured === true, 'Lần 1 bắt thành công tướng Lv4');
  assert(def.general?.level === 1, 'Tướng mới thay thế của defender là Lv1');

  // Lần 2: Thử bắt lại ngay lập tức
  const second = captureGeneralOnCapitalFall(atk, def);
  assert(second.captured === false, 'Lần 2: tướng Lv1 mới sinh không bị bắt lại (captured = false)');
  assert((atk.reserveGenerals || []).length === 1, 'Attacker chỉ có đúng 1 tướng bị bắt từ lần 1');
}

// TEST 7: Tướng dự bị hồi HP trong vùng an toàn
console.log('\n[Test 7] Tướng dự bị hồi phục HP khi ở vùng an toàn:');
{
  const n = createMockNation(1, 'Đại Việt', 10, 10);
  const reserveGen = createDefaultGeneral('res_heal', 1, 'Tướng Bị Thương', 'INSPIRE_AURA', 10, 10);
  reserveGen.role = 'RESERVE';
  reserveGen.maxHp = 1000;
  reserveGen.hp = 200; // Đang bị thương nặng

  // Gọi processGeneralRecoveryTick với isSafeZone = true
  const tickResult = processGeneralRecoveryTick(reserveGen, n, true);
  assert(tickResult.recovered > 0, 'Tướng dự bị được hồi phục HP');
  assert(reserveGen.hp === 230, 'HP tăng từ 200 lên 230 (+3% maxHp = 30 HP)');

  // Gọi thêm 10 lần nữa
  for (let i = 0; i < 10; i++) {
    processGeneralRecoveryTick(reserveGen, n, true);
  }
  assert(reserveGen.hp === 530, 'Sau 10 lần nữa HP đạt đúng 530');
}

// TEST 8: Save/Load giữ đủ reserveGenerals hai bên
console.log('\n[Test 8] Save/Load và migrate dữ liệu bảo toàn reserveGenerals hai bên:');
{
  const rawAttacker = {
    id: 1,
    general: { id: 'a_active', name: 'Tướng Chủ A', role: 'ACTIVE', level: 5, loyalty: 90 },
    reserveGenerals: [
      { id: 'captured_gen', name: 'Tướng Bị Bắt', role: 'RESERVE', level: 4, loyalty: 35, style: 'WARRIOR' }
    ]
  };

  const rawDefender = {
    id: 2,
    general: { id: 'd_active', name: 'Tướng Mới B', role: 'ACTIVE', level: 1, loyalty: 100 },
    reserveGenerals: [
      { id: 'd_reserve', name: 'Tướng Dự Bị B', role: 'RESERVE', level: 3, loyalty: 80 }
    ]
  };

  const migratedAttackerActive = migrateGeneralData(rawAttacker.general, 1, 10, 10);
  const migratedAttackerReserve = rawAttacker.reserveGenerals.map(rg => migrateGeneralData(rg, 1, 10, 10));

  const migratedDefenderActive = migrateGeneralData(rawDefender.general, 2, 30, 30);
  const migratedDefenderReserve = rawDefender.reserveGenerals.map(rg => migrateGeneralData(rg, 2, 30, 30));

  assert(migratedAttackerReserve.length === 1, 'Attacker giữ đủ 1 tướng dự bị');
  assert(migratedAttackerReserve[0].id === 'captured_gen', 'Giữ nguyên ID tướng bị bắt');
  assert(migratedAttackerReserve[0].role === 'RESERVE', 'Giữ nguyên vai trò RESERVE');
  assert(migratedAttackerReserve[0].loyalty === 35, 'Giữ nguyên loyalty 35');
  assert(migratedAttackerReserve[0].style === 'WARRIOR', 'Giữ nguyên style WARRIOR');

  assert(migratedDefenderReserve.length === 1, 'Defender giữ đủ 1 tướng dự bị');
  assert(migratedDefenderReserve[0].id === 'd_reserve', 'Giữ nguyên ID tướng dự bị của defender');
  assert(migratedDefenderActive.level === 1, 'Defender giữ nguyên tướng ACTIVE Lv1');
}

console.log('\n🎉 TẤT CẢ 8 TEST CASES PIXEL EMPIRE 1.8 ĐỀU ĐÃ VƯỢT QUA HOÀN HẢO!');
