import { 
  createDefaultGeneral, 
  calculateGeneralStats,
  canDeployGeneral,
  appointReserveGeneral,
  migrateGeneralData
} from './src/utils/generalCombat';
import { Nation } from './src/types';

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

console.log('--- BẮT ĐẦU KIỂM THỬ PIXEL EMPIRE 1.7 (GENERAL MANAGEMENT) ---');

// TEST 1: Bổ nhiệm: ACTIVE cũ thành RESERVE, tướng mới thành ACTIVE, còn đúng 1 ACTIVE
console.log('\n[Test 1] Bổ nhiệm tướng dự bị thành ACTIVE, ACTIVE cũ thành RESERVE:');
{
  const n = createMockNation(1, 'Đại Việt', 10, 10);
  const activeGen = createDefaultGeneral('g_active', 1, 'Trần Hưng Đạo', 'INSPIRE_AURA', 10, 10);
  activeGen.role = 'ACTIVE';
  n.general = activeGen;

  const reserveGen = createDefaultGeneral('g_res1', 1, 'Lê Lợi', 'MISSILE_BARRAGE', 10, 10);
  reserveGen.role = 'RESERVE';
  n.reserveGenerals = [reserveGen];

  const ok = appointReserveGeneral(n, 'g_res1');
  assert(ok === true, 'Bổ nhiệm thành công trả về true');
  assert(n.general?.id === 'g_res1', 'Tướng g_res1 trở thành ACTIVE mới');
  assert(n.general?.role === 'ACTIVE', 'Vai trò của tướng mới là ACTIVE');
  assert(n.reserveGenerals?.length === 1, 'Danh sách dự bị vẫn giữ đúng 1 tướng');
  assert(n.reserveGenerals?.[0].id === 'g_active', 'Tướng ACTIVE cũ (g_active) chuyển vào reserveGenerals');
  assert(n.reserveGenerals?.[0].role === 'RESERVE', 'Vai trò tướng cũ chuyển thành RESERVE');

  // Đếm tổng số tướng ACTIVE
  const activeCount = (n.general?.role === 'ACTIVE' ? 1 : 0) + (n.reserveGenerals?.filter(g => g.role === 'ACTIVE').length || 0);
  assert(activeCount === 1, 'Còn đúng duy nhất 1 tướng ACTIVE trong quốc gia');
}

// TEST 2: Không bổ nhiệm được khi có tướng MARCHING (trả false)
console.log('\n[Test 2] Khóa bổ nhiệm khi tướng ACTIVE hoặc tướng dự bị đang MARCHING:');
{
  const n = createMockNation(1, 'Đại Việt', 10, 10);
  const activeGen = createDefaultGeneral('g_active', 1, 'Quang Trung', 'SHADOW_RAID', 10, 10);
  activeGen.role = 'ACTIVE';
  activeGen.status = 'MARCHING'; // Tướng ACTIVE đang hành quân
  n.general = activeGen;

  const resGen = createDefaultGeneral('g_res', 1, 'Ngô Quyền', 'IRON_BORDER_SHIELD', 10, 10);
  resGen.role = 'RESERVE';
  n.reserveGenerals = [resGen];

  const ok1 = appointReserveGeneral(n, 'g_res');
  assert(ok1 === false, 'Trả về false khi tướng ACTIVE đang MARCHING');
  assert(n.general?.id === 'g_active', 'Tướng ACTIVE không bị thay thế');

  // Thử trường hợp tướng dự bị đang MARCHING
  activeGen.status = 'IDLE';
  resGen.status = 'MARCHING';
  const ok2 = appointReserveGeneral(n, 'g_res');
  assert(ok2 === false, 'Trả về false khi tướng dự bị đang MARCHING');
  assert(n.general?.id === 'g_active', 'Tướng ACTIVE vẫn giữ nguyên');
}

// TEST 3: Bổ nhiệm không đổi HP, EXP, Level, Loyalty, Evolution, history
console.log('\n[Test 3] Bổ nhiệm bảo toàn nguyên vẹn HP, EXP, Level, Loyalty, Evolution và tọa độ:');
{
  const n = createMockNation(1, 'Đại Việt', 15, 20);
  const activeGen = createDefaultGeneral('g_act', 1, 'Tướng A', 'INSPIRE_AURA', 15, 20);
  activeGen.hp = 850;
  activeGen.exp = 120;
  activeGen.level = 7;
  activeGen.loyalty = 92;
  activeGen.style = 'GUARDIAN';
  n.general = activeGen;

  const resGen = createDefaultGeneral('g_res', 1, 'Tướng B', 'SUPPLY_REINFORCE', 15, 20);
  resGen.role = 'RESERVE';
  resGen.hp = 650;
  resGen.exp = 340;
  resGen.level = 11;
  resGen.loyalty = 78;
  resGen.style = 'STRATEGIST';
  resGen.evolutionStats = { damageDealt: 100, damageAbsorbed: 50, wavesLed: 5, tacticalCaptures: 3 };
  n.reserveGenerals = [resGen];

  const ok = appointReserveGeneral(n, 'g_res');
  assert(ok === true, 'Bổ nhiệm thành công');

  const appointed = n.general!;
  assert(appointed.id === 'g_res', 'Tướng mới được bổ nhiệm');
  assert(appointed.hp === 650, 'HP giữ nguyên 650 (không hồi/thay đổi HP)');
  assert(appointed.exp === 340, 'EXP giữ nguyên 340');
  assert(appointed.level === 11, 'Level giữ nguyên 11');
  assert(appointed.loyalty === 78, 'Loyalty giữ nguyên 78');
  assert(appointed.style === 'STRATEGIST', 'Style giữ nguyên STRATEGIST');
  assert(appointed.evolutionStats?.wavesLed === 5, 'evolutionStats giữ nguyên');
  assert(appointed.x === 15 && appointed.y === 20, 'Tọa độ giữ nguyên');
  assert(appointed.nationId === 1, 'nationId giữ nguyên');
  assert(Boolean(appointed.history?.[0]?.includes('[Bổ Nhiệm]')), 'Có bản ghi lịch sử bổ nhiệm');

  const demoted = n.reserveGenerals[0];
  assert(demoted.id === 'g_act', 'Tướng cũ chuyển vào reserve');
  assert(demoted.hp === 850, 'Tướng cũ giữ nguyên HP 850');
  assert(demoted.exp === 120, 'Tướng cũ giữ nguyên EXP 120');
  assert(demoted.level === 7, 'Tướng cũ giữ nguyên Level 7');
  assert(demoted.loyalty === 92, 'Tướng cũ giữ nguyên Loyalty 92');
  assert(Boolean(demoted.history?.[0]?.includes('[Bãi Nhiệm]')), 'Có bản ghi lịch sử bãi nhiệm');
}

// TEST 4: Chống trùng: không có tướng nào xuất hiện 2 lần
console.log('\n[Test 4] Chống trùng lặp tuyệt đối khi bổ nhiệm:');
{
  const n = createMockNation(1, 'Đại Việt', 10, 10);
  const genA = createDefaultGeneral('g_a', 1, 'Tướng A', 'INSPIRE_AURA', 10, 10);
  const genB = createDefaultGeneral('g_b', 1, 'Tướng B', 'MISSILE_BARRAGE', 10, 10);
  genB.role = 'RESERVE';
  const genC = createDefaultGeneral('g_c', 1, 'Tướng C', 'SHADOW_RAID', 10, 10);
  genC.role = 'RESERVE';

  n.general = genA;
  n.reserveGenerals = [genB, genC];

  appointReserveGeneral(n, 'g_b');
  appointReserveGeneral(n, 'g_c');
  appointReserveGeneral(n, 'g_a');

  const allGenerals = [n.general!, ...(n.reserveGenerals || [])];
  const allIds = allGenerals.map(g => g.id);
  const uniqueIds = new Set(allIds);

  assert(allGenerals.length === 3, 'Tổng số tướng giữ nguyên là 3');
  assert(allIds.length === uniqueIds.size, 'Không có tướng nào bị nhân bản (mỗi ID xuất hiện đúng 1 lần)');
  assert(n.general?.id === 'g_a', 'Tướng ACTIVE hiện tại là g_a');
  assert(!n.reserveGenerals?.some(g => g.id === n.general?.id), 'Tướng ACTIVE không nằm trong reserveGenerals');
}

// TEST 5: Loyalty 50 (BAT_MAN): attack giảm đúng 10%. Loyalty 20: không deploy được
console.log('\n[Test 5] Ảnh hưởng của Loyalty: BAT_MAN giảm 10% attack, NGUY_CO_PHAN_BOI không deploy được:');
{
  const n = createMockNation(1, 'Đại Việt', 10, 10);
  const gen = createDefaultGeneral('g_stat', 1, 'Tướng Test', 'INSPIRE_AURA', 10, 10);
  n.techLevels = { economy: 0, military: 0, defense: 0 };
  n.general = gen;

  // 1. Loyalty = 100 (TRUNG_THANH): Không giảm attack (90)
  gen.loyalty = 100;
  calculateGeneralStats(gen, n, null);
  assert(gen.attack === 90, 'Loyalty 100: attack nguyên bản là 90');
  assert(canDeployGeneral(gen) === true, 'Loyalty 100: có thể deploy');

  // 2. Loyalty = 50 (BAT_MAN, 30..69): Attack giảm đúng 10% (90 * 0.9 = 81)
  gen.loyalty = 50;
  calculateGeneralStats(gen, n, null);
  assert(gen.attack === 81, 'Loyalty 50 (BAT_MAN): attack giảm đúng 10% (90 -> 81)');
  assert(canDeployGeneral(gen) === true, 'Loyalty 50: vẫn có thể deploy');

  // 3. Loyalty = 20 (NGUY_CO_PHAN_BOI, < 30): Attack giảm 20% (90 * 0.8 = 72) và không deploy được
  gen.loyalty = 20;
  calculateGeneralStats(gen, n, null);
  assert(gen.attack === 72, 'Loyalty 20 (NGUY_CO_PHAN_BOI): attack giảm đúng 20% (90 -> 72)');
  assert(canDeployGeneral(gen) === false, 'Loyalty 20: canDeployGeneral trả về false (không được deploy)');

  // 4. Tướng RESERVE không bị ảnh hưởng bởi loyalty
  const resGen = createDefaultGeneral('g_res_stat', 1, 'Tướng Dự Bị', 'INSPIRE_AURA', 10, 10);
  resGen.role = 'RESERVE';
  resGen.loyalty = 50;
  calculateGeneralStats(resGen, n, null);
  assert(resGen.attack === 90, 'Tướng RESERVE: attack không bị giảm bởi loyalty (vẫn là 90)');
}

// TEST 6: Loyalty không đổi theo thời gian (không random)
console.log('\n[Test 6] Loyalty ổn định, không tự biến thiên ngẫu nhiên theo thời gian:');
{
  const n = createMockNation(1, 'Đại Việt', 10, 10);
  const gen = createDefaultGeneral('g_stable', 1, 'Tướng Ổn Định', 'INSPIRE_AURA', 10, 10);
  gen.loyalty = 75;
  n.general = gen;

  // Gọi lặp lại calculateGeneralStats 10 lần mô phỏng các chu kỳ game tick
  for (let i = 0; i < 10; i++) {
    calculateGeneralStats(gen, n, null);
  }
  assert(gen.loyalty === 75, 'Sau 10 lần tính chỉ số, loyalty vẫn giữ nguyên 75, không bị thay đổi ngẫu nhiên');
}

// TEST 7: Save/Load giữ nguyên dữ liệu; file cũ vẫn đọc được
console.log('\n[Test 7] Save/Load và migrate dữ liệu cũ an toàn:');
{
  // File lưu cũ thiếu loyalty và reserveGenerals
  const legacyData = {
    id: 'old_legacy_1',
    name: 'Tướng Đời Đầu',
    level: 3,
    hp: 900,
    // Thiếu hoàn toàn loyalty, role, style, evolutionStats
  };

  const migrated = migrateGeneralData(legacyData, 1, 10, 10);
  assert(migrated.loyalty === 100, 'File cũ thiếu loyalty tự gán mặc định 100');
  assert(migrated.role === 'ACTIVE', 'File cũ gán mặc định vai trò ACTIVE');
  assert(migrated.evolutionStats !== undefined, 'Tự bổ sung evolutionStats mặc định');
  assert(migrated.history?.length! > 0, 'Tự bổ sung history khởi tạo');

  // File lưu mới có đủ reserveGenerals và loyalty
  const newSaveData = {
    id: 'g_new',
    name: 'Tướng Hiện Đại',
    role: 'RESERVE',
    loyalty: 42,
    style: 'WARRIOR',
    evolutionStats: { damageDealt: 1200, damageAbsorbed: 400, wavesLed: 6, tacticalCaptures: 2 },
  };
  const migratedNew = migrateGeneralData(newSaveData, 1, 10, 10);
  assert(migratedNew.role === 'RESERVE', 'Giữ nguyên vai trò RESERVE');
  assert(migratedNew.loyalty === 42, 'Giữ nguyên loyalty 42');
  assert(migratedNew.style === 'WARRIOR', 'Giữ nguyên style WARRIOR');
  assert(migratedNew.evolutionStats?.damageDealt === 1200, 'Giữ nguyên evolutionStats');
}

console.log('\n🎉 TẤT CẢ 7 TEST CASES PIXEL EMPIRE 1.7 ĐỀU ĐÃ VƯỢT QUA HOÀN HẢO!');
