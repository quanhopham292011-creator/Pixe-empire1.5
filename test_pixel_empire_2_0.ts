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

console.log('--- BẮT ĐẦU KIỂM THỬ PIXEL EMPIRE 2.0 (FINAL STABILIZATION) ---');

// TEST 1: Tính nguyên tử khi bắt tướng: Khi không đủ điều kiện (ví dụ tướng địch MARCHING),
// attacker (dù chưa có ACTIVE) KHÔNG ĐƯỢC bị thay đổi dữ liệu (không tự bổ nhiệm/tạo tướng giả)
console.log('\n[Test 1] Tính nguyên tử khi bắt tướng: Điều kiện thất bại -> Giữ nguyên trạng 100% dữ liệu hai bên:');
{
  const attacker = createMockNation(1, 'Đại Việt', 10, 10);
  attacker.general = undefined; // Chưa có active
  const res1 = createDefaultGeneral('atk_res1', 1, 'Dự Bị 1', 'INSPIRE_AURA', 10, 10);
  res1.level = 4;
  res1.role = 'RESERVE';
  attacker.reserveGenerals = [res1];

  const defender = createMockNation(2, 'Nguyên Mông', 30, 30);
  const defGen = createDefaultGeneral('thoat_hoan', 2, 'Thoát Hoan', 'IRON_BORDER_SHIELD', 30, 30);
  defGen.level = 5;
  defGen.status = 'MARCHING'; // Đang hành quân -> không đủ điều kiện bắt
  defender.general = defGen;

  const result = captureGeneralOnCapitalFall(attacker, defender);
  assert(result.captured === false, 'Bắt tướng bị từ chối do tướng đang MARCHING');

  // Kiểm tra attacker hoàn toàn không bị biến đổi
  assert(attacker.general === undefined, 'Attacker vẫn không có tướng ACTIVE (không bị biến đổi dở dang)');
  assert(attacker.reserveGenerals?.length === 1, 'Attacker vẫn giữ nguyên đúng 1 dự bị ban đầu');
  assert(attacker.reserveGenerals?.[0].id === 'atk_res1', 'Dự bị atk_res1 giữ nguyên vị trí và vai trò');
  assert(attacker.reserveGenerals?.[0].role === 'RESERVE', 'Vai trò dự bị giữ nguyên');

  // Defender cũng nguyên vẹn
  assert(defender.general?.id === 'thoat_hoan', 'Tướng defender vẫn là Thoát Hoan');
  assert(defender.capitalCaptured !== true, 'capitalCaptured không bị đánh dấu true');
}

// TEST 2: transferGeneral thất bại khi toNation đã đầy 3 RESERVE:
// Không làm mất tướng của fromNation, không thay đổi bất kỳ chỉ số nào
console.log('\n[Test 2] transferGeneral từ chối khi toNation đầy 3 dự bị -> Dữ liệu giữ nguyên vẹn:');
{
  const fromNation = createMockNation(1, 'Nước Giao', 10, 10);
  const hero = createDefaultGeneral('hero_x', 1, 'Dũng Tướng', 'SHADOW_RAID', 10, 10);
  hero.level = 6;
  hero.loyalty = 88;
  fromNation.general = hero;

  const toNation = createMockNation(2, 'Nước Nhận', 40, 40);
  toNation.general = createDefaultGeneral('to_active', 2, 'Chủ Tướng Nhận', 'INSPIRE_AURA', 40, 40);
  toNation.reserveGenerals = [
    createDefaultGeneral('r1', 2, 'DB 1', 'INSPIRE_AURA', 40, 40),
    createDefaultGeneral('r2', 2, 'DB 2', 'INSPIRE_AURA', 40, 40),
    createDefaultGeneral('r3', 2, 'DB 3', 'INSPIRE_AURA', 40, 40),
  ];

  const ok = transferGeneral(hero, fromNation, toNation);
  assert(ok === false, 'transferGeneral trả về false khi toNation đã đủ 3 dự bị');

  // fromNation giữ nguyên vẹn
  assert(fromNation.general?.id === 'hero_x', 'fromNation vẫn giữ nguyên tướng');
  assert(fromNation.general?.nationId === 1, 'nationId của tướng vẫn là 1');
  assert(fromNation.general?.loyalty === 88, 'loyalty giữ nguyên 88');

  // toNation giữ nguyên vẹn 3 dự bị (không bị slice xóa bớt)
  assert(toNation.reserveGenerals.length === 3, 'toNation vẫn giữ nguyên 3 dự bị');
  assert(!toNation.reserveGenerals.some(g => g.id === 'hero_x'), 'Tướng hero_x không bị đẩy vào toNation');
}

// TEST 3: Không dùng slice() để âm thầm xóa tướng:
// Khi danh sách dự bị vượt quá 3 (do dữ liệu cũ hoặc tình huống đặc thù),
// thao tác bắt tướng hoặc chuyển tướng phải TỪ CHỐI và GIỮ NGUYÊN toàn bộ tướng
console.log('\n[Test 3] Không dùng slice() âm thầm xóa tướng: từ chối và bảo toàn toàn bộ danh sách tướng:');
{
  const attacker = createMockNation(1, 'Phe A', 5, 5);
  attacker.general = createDefaultGeneral('atk_lead', 1, 'Chủ Tướng A', 'INSPIRE_AURA', 5, 5);
  attacker.reserveGenerals = [
    createDefaultGeneral('extra1', 1, 'Tướng 1', 'INSPIRE_AURA', 5, 5),
    createDefaultGeneral('extra2', 1, 'Tướng 2', 'INSPIRE_AURA', 5, 5),
    createDefaultGeneral('extra3', 1, 'Tướng 3', 'INSPIRE_AURA', 5, 5),
    createDefaultGeneral('extra4', 1, 'Tướng 4', 'INSPIRE_AURA', 5, 5), // 4 tướng dự bị
  ];

  const defender = createMockNation(2, 'Phe B', 50, 50);
  defender.general = createDefaultGeneral('def_lead', 2, 'Chủ Tướng B', 'IRON_BORDER_SHIELD', 50, 50);
  defender.general.level = 4;

  const result = captureGeneralOnCapitalFall(attacker, defender);
  assert(result.captured === false, 'Bắt tướng bị từ chối');

  // Kiểm tra KHÔNG BỊ SLICE: attacker vẫn có đủ 4 tướng dự bị nguyên vẹn!
  assert(attacker.reserveGenerals.length === 4, 'Attacker vẫn giữ đủ 4 tướng dự bị, không hề bị slice() xóa mất');
  assert(attacker.reserveGenerals.some(g => g.id === 'extra4'), 'Tướng extra4 vẫn còn nguyên');
  assert(defender.general?.id === 'def_lead', 'Defender vẫn giữ nguyên chủ tướng');
}

// TEST 4: transferGeneral khi tướng không thuộc fromNation -> Từ chối nguyên tử
console.log('\n[Test 4] transferGeneral bảo vệ: Tướng không thuộc fromNation -> Từ chối, không thay đổi:');
{
  const n1 = createMockNation(1, 'Nước 1', 0, 0);
  const n2 = createMockNation(2, 'Nước 2', 10, 10);
  n2.reserveGenerals = [];

  const foreignGen = createDefaultGeneral('alien', 99, 'Tướng Lạ', 'INSPIRE_AURA', 0, 0);

  const res = transferGeneral(foreignGen, n1, n2);
  assert(res === false, 'transferGeneral từ chối khi tướng không thuộc n1');
  assert((n2.reserveGenerals?.length || 0) === 0, 'n2 không nhận tướng');
  assert(foreignGen.nationId === 99, 'nationId của tướng lạ giữ nguyên 99');
}

// TEST 5: Chống trùng ID và tối đa 1 ACTIVE trong mọi kịch bản
console.log('\n[Test 5] Chống trùng ID và quy tắc mỗi nước tối đa 1 ACTIVE:');
{
  const n = createMockNation(1, 'Đại Việt', 10, 10);
  const active = createDefaultGeneral('g_act', 1, 'Chủ Soái', 'INSPIRE_AURA', 10, 10);
  active.role = 'ACTIVE';
  n.general = active;

  const resA = createDefaultGeneral('g_res_a', 1, 'Phó Tướng A', 'SHADOW_RAID', 10, 10);
  resA.role = 'RESERVE';
  const resB = createDefaultGeneral('g_res_b', 1, 'Phó Tướng B', 'IRON_BORDER_SHIELD', 10, 10);
  resB.role = 'RESERVE';
  n.reserveGenerals = [resA, resB];

  // Bổ nhiệm resA
  const ok = appointReserveGeneral(n, 'g_res_a');
  assert(ok === true, 'Bổ nhiệm thành công');

  assert(n.general?.id === 'g_res_a', 'g_res_a lên làm ACTIVE');
  assert(n.general?.role === 'ACTIVE', 'Vai trò là ACTIVE');
  assert(n.reserveGenerals.length === 2, 'Tổng số dự bị vẫn là 2');
  assert(n.reserveGenerals.some(g => g.id === 'g_act' && g.role === 'RESERVE'), 'g_act chuyển thành RESERVE');
  assert(!n.reserveGenerals.some(g => g.id === 'g_res_a'), 'g_res_a không nằm trong dự bị');

  // Thử bổ nhiệm chính tướng đang ACTIVE -> phải trả về false
  const okSelf = appointReserveGeneral(n, 'g_res_a');
  assert(okSelf === false, 'Không thể bổ nhiệm tướng đang là ACTIVE');
}

// TEST 6: Save/Load an toàn & làm sạch dữ liệu cũ trùng lặp (Anti-duplication on Load)
console.log('\n[Test 6] Khôi phục dữ liệu từ bản lưu: Làm sạch trùng lặp, đảm bảo đúng 1 ACTIVE:');
{
  // Giả lập dữ liệu lưu cũ bị lỗi: reserveGenerals chứa tướng trùng ID với active và trùng nhau
  const corruptedNationData = {
    id: 1,
    capitalX: 10,
    capitalY: 10,
    general: { id: 'lead_1', name: 'Chủ Soái', role: 'RESERVE', level: 5 }, // role lưu sai thành RESERVE
    reserveGenerals: [
      { id: 'lead_1', name: 'Chủ Soái (bản sao)', role: 'ACTIVE', level: 5 }, // trùng ID với active!
      { id: 'sub_1', name: 'Phó Tướng 1', role: 'RESERVE', level: 3 },
      { id: 'sub_1', name: 'Phó Tướng 1 (trùng lặp)', role: 'RESERVE', level: 3 }, // trùng ID trong reserve!
    ]
  };

  // Logic khôi phục như trong useSaveGame.ts
  const nation: Nation = createMockNation(1, 'Đại Việt', 10, 10);
  if (corruptedNationData.general) {
    nation.general = migrateGeneralData(corruptedNationData.general, nation.id, nation.capitalX, nation.capitalY);
    nation.general.role = 'ACTIVE';
  }

  const seenIds = new Set<string>();
  if (nation.general?.id) seenIds.add(nation.general.id);
  const validReserves: General[] = [];
  for (const rg of corruptedNationData.reserveGenerals) {
    if (!rg) continue;
    const migrated = migrateGeneralData(rg, nation.id, nation.capitalX, nation.capitalY);
    if (seenIds.has(migrated.id)) continue; // Loại bỏ trùng ID
    seenIds.add(migrated.id);
    migrated.role = 'RESERVE';
    validReserves.push(migrated);
  }
  nation.reserveGenerals = validReserves;

  assert(nation.general?.id === 'lead_1', 'Chủ soái là lead_1');
  assert(nation.general?.role === 'ACTIVE', 'Chủ soái luôn có vai trò ACTIVE');
  assert(nation.reserveGenerals.length === 1, 'Chỉ có đúng 1 tướng dự bị hợp lệ (loại bỏ bản sao lead_1 và sub_1 trùng)');
  assert(nation.reserveGenerals[0].id === 'sub_1', 'Dự bị duy nhất là sub_1');
  assert(nation.reserveGenerals[0].role === 'RESERVE', 'Vai trò dự bị là RESERVE');
}

// TEST 7: Tương thích dữ liệu cũ cực hạn (Extreme Legacy Data Compatibility)
console.log('\n[Test 7] migrateGeneralData với dữ liệu cũ rỗng hoặc thiếu trường:');
{
  const emptyRaw = {};
  const migrated = migrateGeneralData(emptyRaw, 2, 20, 20);
  assert(migrated.id === 'gen_2', 'Tự tạo ID mặc định gen_2');
  assert(migrated.name === 'Đại Tướng', 'Tên mặc định');
  assert(migrated.role === 'ACTIVE', 'Vai trò mặc định ACTIVE');
  assert(migrated.level === 1, 'Level mặc định 1');
  assert(migrated.exp === 0, 'EXP mặc định 0');
  assert(migrated.loyalty === 100, 'Loyalty mặc định 100');
  assert(migrated.hp === 1000, 'HP mặc định 1000');
  assert(migrated.maxHp === 1000, 'MaxHP mặc định 1000');
  assert(migrated.armor === 0.20, 'Armor mặc định 0.20');
  assert(migrated.attack === 90, 'Attack mặc định 90');
  assert(migrated.x === 20 && migrated.y === 20, 'Tọa độ nhận fallbackX/fallbackY');
  assert(Array.isArray(migrated.history) && migrated.history.length > 0, 'Có lịch sử khởi tạo');
}

console.log('\n🎉 TẤT CẢ 7 TEST CASES PIXEL EMPIRE 2.0 ĐỀU ĐÃ VƯỢT QUA HOÀN HẢO!');
