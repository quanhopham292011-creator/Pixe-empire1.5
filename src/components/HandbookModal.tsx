import React, { useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  AIR_SYSTEM_CONFIG,
  AIR_UNIT_SPECS,
  BUILDING_INFO,
  DARK_TITAN_CONFIG,
  GAMEPLAY_RULES,
  GENERAL_ROSTER,
  MISSILE_CONFIG,
  MISSILE_SETTINGS,
  NAVAL_CONFIG,
  RESOURCE_CONFIG,
  SUPREME_TECH_CONFIG,
  SUPREME_TECH_EFFECTS,
  TECH_TREE,
} from '../data/gameData';
import { formatPopulation, getSkillPower } from '../utils/constants';
import { GENERAL_CONSTANTS, MAX_RESERVE_GENERALS } from '../utils/generalCombat';
import { MAX_PLAYER_LEVEL } from '../utils/progression';
import {
  ECONOMY_BRANCH,
  HYBRID_NODES,
  NODE_COSTS,
  RESET_SKILL_TREE_COIN_COST,
} from '../utils/skillTreeConfig';
import { SUPER_BUILDING_CONFIG } from '../utils/superBuildings';
import { TRUCE_DURATION, TRUCE_MAX_PER_PAIR, TRUCE_WAR_COOLDOWN } from '../utils/truceSystem';

interface HandbookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HandbookChapter {
  id: string;
  num: number;
  icon: string;
  title: string;
  summary: string;
  lines: string[];
}

function buildHandbookChapters(): HandbookChapter[] {
  const fmt = (n: number) => formatPopulation(n);
  const bMin = RESOURCE_CONFIG.BUILDING_MINERAL_COST;

  const tech1 = TECH_TREE.find(t => t.id === 'eco_1');
  const tech2 = TECH_TREE.find(t => t.id === 'eco_2');
  const tech3 = TECH_TREE.find(t => t.id === 'eco_3a');
  const sup1 = SUPREME_TECH_CONFIG.COSTS_BY_LEVEL[1];
  const sup2 = SUPREME_TECH_CONFIG.COSTS_BY_LEVEL[2];
  const sup3 = SUPREME_TECH_CONFIG.COSTS_BY_LEVEL[3];

  const genLevelUnlock = GENERAL_ROSTER.filter(g => g.unlockType === 'LEVEL')
    .map(g => `${g.name} (Lv.${g.unlockLevel})`)
    .join(', ');
  const genBuyUnlock = GENERAL_ROSTER.filter(g => g.unlockType === 'PURCHASE')
    .map(g => `${g.name} (${g.price} Xu)`)
    .join(', ');

  const rookieMinutes = Math.round(GAMEPLAY_RULES.ROOKIE_BUFF_DURATION_SECONDS / 60);
  const rookieDiscountPct = Math.round(GAMEPLAY_RULES.ROOKIE_BUFF_MAX_DISCOUNT * 100);
  const costGrowthPct = Math.round((GAMEPLAY_RULES.BUILDING_COST_GROWTH - 1) * 100);

  const bossEasy = getSkillPower({ tier: 'BOSS' }, 'EASY');
  const bossNormal = getSkillPower({ tier: 'BOSS' }, 'NORMAL');
  const bossHard = getSkillPower({ tier: 'BOSS' }, 'HARD');
  const bossExtreme = getSkillPower({ tier: 'BOSS' }, 'EXTREME');
  const titanSpawnMin = Math.round(DARK_TITAN_CONFIG.SPAWN_TIME_SECONDS / 60);
  const titanDurMin = Math.round(DARK_TITAN_CONFIG.DURATION_SECONDS / 60);
  const titanBuffPct = Math.round((DARK_TITAN_CONFIG.BUFF_MULTIPLIER - 1) * 100);

  return [
    {
      id: 'basics',
      num: 1,
      icon: '⚔️',
      title: 'Cách chơi cơ bản',
      summary: 'Chiếm đất, vàng, quân & buff tân thủ',
      lines: [
        `• Thắng khi chiếm đạt ${GAMEPLAY_RULES.VICTORY_LAND_PERCENT}% đất liền bản đồ hoặc tiêu diệt hết đối thủ.`,
        '• Chạm ô đất gần biên giới rồi bấm "Mở Rộng" / "Tấn Công", hoặc chạm đúp để đánh nhanh.',
        `• Kéo thanh % ở dưới để chọn lượng quân xuất kích; nút "🤖 Tự Động" giúp tự mở rộng biên giới.`,
        `• Chiếm ô đồng bằng/rừng tốn cơ bản ${GAMEPLAY_RULES.BASE_TILE_TROOP_COST} quân, Núi tốn ${GAMEPLAY_RULES.MOUNTAIN_TILE_TROOP_COST} quân, vùng cháy thêm +${GAMEPLAY_RULES.SCORCHED_EXTRA_TROOP_COST} quân.`,
        `• Buff tân thủ (${rookieMinutes} phút đầu / ${GAMEPLAY_RULES.ROOKIE_BUFF_DURATION_SECONDS}s): giảm tới ${rookieDiscountPct}% tổn thất quân khi chiếm đất hoang và giảm dần về 0%.`,
        '• Vàng dùng xây công trình & học công nghệ; Dân số càng cao thì thu nhập vàng và trần quân càng lớn.',
      ],
    },
    {
      id: 'buildings',
      num: 2,
      icon: '🏛️',
      title: 'Công trình',
      summary: 'Kinh tế, quân sự & phòng thủ',
      lines: [
        `• ${BUILDING_INFO.CITY.name} (${fmt(BUILDING_INFO.CITY.baseCost)}💰): tăng thu nhập vàng & trần dân số. ${BUILDING_INFO.BARRACKS.name} (${fmt(BUILDING_INFO.BARRACKS.baseCost)}💰): tăng hồi quân & trần quân.`,
        `• ${BUILDING_INFO.FORTRESS.name} (${fmt(BUILDING_INFO.FORTRESS.baseCost)}💰, ${bMin.FORTRESS}⛏️): tăng phòng thủ vùng bán kính ${GAMEPLAY_RULES.FORTRESS_RADIUS} ô.`,
        `• ${BUILDING_INFO.PORT.name} (${fmt(BUILDING_INFO.PORT.baseCost)}💰): xây ven biển để tạo tàu buôn, đóng tàu hải quân & đưa quân qua biển.`,
        `• ${BUILDING_INFO.LASER.name} (${fmt(BUILDING_INFO.LASER.baseCost)}💰, ${bMin.LASER}⛏️): tự bắn tia laser hạ quân địch xung quanh mỗi 10s.`,
        `• ${BUILDING_INFO.MISSILE_SILO.name} (${fmt(BUILDING_INFO.MISSILE_SILO.baseCost)}💰, ${bMin.MISSILE_SILO}⛏️): phóng tên lửa. ${BUILDING_INFO.AIR_DEFENSE.name} (${fmt(BUILDING_INFO.AIR_DEFENSE.baseCost)}💰, ${bMin.AIR_DEFENSE}⛏️): chặn tên lửa & máy bay.`,
        `• ${BUILDING_INFO.BUNKER.name} (${fmt(BUILDING_INFO.BUNKER.baseCost)}💰): mở ở Phòng Thủ Tối Thượng 3, tối đa ${SUPREME_TECH_EFFECTS.DEFENSE_3_MAX_BUNKERS} cái.`,
        `• Giá xây công trình cùng loại tăng +${costGrowthPct}% mỗi cái; Thành Thị, Doanh Trại, Hải Cảng xây chồng để lên cấp.`,
      ],
    },
    {
      id: 'generals',
      num: 3,
      icon: '🎖️',
      title: 'Tướng',
      summary: 'Chỉ số, kỹ năng & hồi phục',
      lines: [
        `• Chỉ số nền: ${GENERAL_CONSTANTS.BASE_HP} HP, Giáp ${Math.round(GENERAL_CONSTANTS.BASE_ARMOR * 100)}% (trần ${Math.round(GENERAL_CONSTANTS.MAX_TOTAL_ARMOR * 100)}%), Sát thương ${GENERAL_CONSTANTS.BASE_ATTACK}, cấp tối đa Lv.${GENERAL_CONSTANTS.MAX_LEVEL}.`,
        `• Có ${GENERAL_ROSTER.length} Đại Tướng: mặc định có ${GENERAL_ROSTER[0].name}; mở theo cấp (${genLevelUnlock}) hoặc mua (${genBuyUnlock}).`,
        '• Bấm nút chiêu thức ở thanh Tướng bên dưới để dùng kỹ năng chủ động (chỉ huy hành quân, khiên, tiếp tế, đột kích, tên lửa).',
        `• Khi HP tụt xuống ≤ ${Math.round(GENERAL_CONSTANTS.RETREAT_HP_RATIO * 100)}%, Tướng tự rút về thủ đô dưỡng thương.`,
        `• Tướng hồi ${Math.round(GENERAL_CONSTANTS.RECOVERY_RATE_PER_SECOND * 100)}% HP/s ở vùng an toàn và cần đạt ≥ ${Math.round(GENERAL_CONSTANTS.DEPLOY_MIN_HP_RATIO * 100)}% HP mới xuất trận lại.`,
        `• Có thể giữ tối đa ${MAX_RESERVE_GENERALS} tướng dự bị và bổ nhiệm thay thế; chú ý giữ độ Trung Thành để tránh phản bội.`,
      ],
    },
    {
      id: 'skilltree',
      num: 4,
      icon: '🌳',
      title: 'Cây kỹ năng',
      summary: '3 nhánh bổ trợ & mốc kết hợp',
      lines: [
        `• Nâng ở sảnh chính bằng Điểm Kỹ Năng (tối đa Lv.${MAX_PLAYER_LEVEL}, mỗi cấp nhận 3 điểm) kết hợp Xu Pixel.`,
        `• Gồm 3 nhánh, mỗi nhánh ${ECONOMY_BRANCH.length} bậc: Kinh Tế (vàng, dân số, tàu buôn), Quân Đội (trần quân, hồi quân, giảm hồi Silo), Anh Hùng (sức Tướng, hồi chiêu).`,
        `• Phí Xu mỗi bậc tăng dần từ ${NODE_COSTS[1].coins} Xu (bậc 1) đến ${NODE_COSTS[10].coins} Xu (bậc 10).`,
        '• Bậc 5 và bậc 10 là mốc đặc biệt cộng thưởng lớn (giảm giá xây, thêm nhịp càn quét, Tướng hồi sinh nhanh 3s).',
        `• Có ${HYBRID_NODES.length} Mốc Kết Hợp (${HYBRID_NODES[0].coinCost} Xu + 1 điểm), chỉ được chọn duy nhất 1 mốc.`,
        `• Có thể tẩy/đặt lại toàn bộ Cây Kỹ Năng bất cứ lúc nào với giá ${RESET_SKILL_TREE_COIN_COST} Xu Pixel.`,
      ],
    },
    {
      id: 'tech',
      num: 5,
      icon: '🔬',
      title: 'Công nghệ và Công nghệ Tối Thượng',
      summary: '3 nhánh thường & 3 cấp Tối Thượng',
      lines: [
        `• Mục Công Nghệ mở khóa khi lãnh thổ đạt từ ${GAMEPLAY_RULES.MIN_TERRITORY_FOR_TECH} ô trở lên.`,
        `• Công nghệ thường gồm 3 nhánh (Kinh Tế, Quân Sự, Phòng Thủ) × 3 cấp: Cấp 1 (${fmt(tech1?.cost || 0)}💰, ${tech1?.researchTime}s), Cấp 2 (${fmt(tech2?.cost || 0)}💰, ${tech2?.researchTime}s), Cấp 3 (${fmt(tech3?.cost || 0)}💰, ${tech3?.researchTime}s).`,
        '• Từ cấp 2 trở lên cần thêm Dầu/Khoáng sản; cấp 3 mỗi nhánh được chọn 1 trong 2 hướng chuyên sâu (A hoặc B).',
        `• Học xong cấp 3 cả 3 nhánh thường sẽ mở Công nghệ Tối Thượng: Cấp 1 (${fmt(sup1.gold)}💰, ${sup1.researchTime}s), Cấp 2 (${fmt(sup2.gold)}💰, ${sup2.researchTime}s), Cấp 3 (${fmt(sup3.gold)}💰, ${sup3.researchTime}s).`,
        `• Quân Sự Tối Thượng nâng Hydro (Vùng Cháy ${SUPREME_TECH_EFFECTS.MILITARY_1_BURN_ZONE_SECONDS}s), Atom (Phóng Xạ ${SUPREME_TECH_EFFECTS.MILITARY_2_RADIATION_SECONDS}s) & mở Máy Bay L1 ở cấp 3.`,
        `• Kinh Tế Tối Thượng mở Mỏ/Giàn Dầu Cao Cấp (${SUPREME_TECH_EFFECTS.ECONOMY_2_ADVANCED_EXTRACTOR_LIMIT}→${SUPREME_TECH_EFFECTS.ECONOMY_3_ADVANCED_EXTRACTOR_LIMIT} cái); Phòng Thủ mở nâng Pháo Đài Tối Thượng (${SUPREME_TECH_EFFECTS.DEFENSE_2_FORTRESS_RADIUS} ô) & Lô Cốt.`,
      ],
    },
    {
      id: 'resources',
      num: 6,
      icon: '🛢️',
      title: 'Dầu, Khoáng sản và Thị trường',
      summary: 'Khai thác mỏ & mua bán tài nguyên',
      lines: [
        `• Đầu trận (chơi đơn) có sẵn ${RESOURCE_CONFIG.START_STOCK} Dầu & ${RESOURCE_CONFIG.START_STOCK} Khoáng; kho chứa tối đa ${fmt(RESOURCE_CONFIG.STORAGE_CAP)} mỗi loại.`,
        `• ${BUILDING_INFO.OIL_RIG.name} (${fmt(BUILDING_INFO.OIL_RIG.baseCost)}💰) hút ${RESOURCE_CONFIG.OIL_RATE} Dầu/s; ${BUILDING_INFO.MINE.name} (${fmt(BUILDING_INFO.MINE.baseCost)}💰) đào ${RESOURCE_CONFIG.MINERAL_RATE} Khoáng/s, tối đa cấp ${RESOURCE_CONFIG.MAX_EXTRACTOR_LEVEL}.`,
        `• Khoảng ${Math.round(RESOURCE_CONFIG.HIDDEN_CHANCE * 100)}% mỏ bị ẩn ban đầu và tự phát hiện dần; độ bền giảm khi khai thác, sửa tốn ${RESOURCE_CONFIG.REPAIR_GOLD_PER_POINT}💰 + ${RESOURCE_CONFIG.REPAIR_MINERAL_PER_POINT}⛏️ mỗi điểm.`,
        `• Bản Cao Cấp (mở ở Kinh Tế Tối Thượng 2–3) tốn ${SUPREME_TECH_EFFECTS.ADVANCED_EXTRACTOR_MINERAL_COST}⛏️ để tăng sản lượng ×${SUPREME_TECH_EFFECTS.ADVANCED_EXTRACTOR_MULT}.`,
        `• Chợ Tài Nguyên (chạm thanh 🛢️ ⛏️ trên cùng) đổi giá mỗi ${RESOURCE_CONFIG.MARKET_TICK_SECONDS}s; giá gốc Dầu ${RESOURCE_CONFIG.MARKET_OIL_BASE}💰, Khoáng ${RESOURCE_CONFIG.MARKET_MINERAL_BASE}💰 (bán thu ${Math.round(RESOURCE_CONFIG.MARKET_SELL_RATIO * 100)}%).`,
        `• Tối đa ${RESOURCE_CONFIG.MARKET_MAX_TRADE} đơn vị/lần ở Chợ, hoặc giao thương trực tiếp với AI trong Ngoại Giao.`,
      ],
    },
    {
      id: 'diplomacy',
      num: 7,
      icon: '🤝',
      title: 'Ngoại giao',
      summary: 'Chiến tranh, đình chiến & đồng minh',
      lines: [
        '• Có 3 quan hệ: Chiến Tranh (⚔️), Đình Chiến (🕊️) và Đồng Minh (🤝).',
        `• Đình Chiến kéo dài ${TRUCE_DURATION}s để tạm ngưng giao tranh; mỗi cặp tối đa ${TRUCE_MAX_PER_PAIR} lần, hồi ${TRUCE_WAR_COOLDOWN}s sau khi kết thúc.`,
        `• Kết Minh giúp lập tuyến tàu buôn kiếm vàng, gửi viện trợ ${Math.round(GAMEPLAY_RULES.ALLY_AID_RATIO * 100)}% Vàng hoặc Quân, và không thể đánh nhau.`,
        `• Mỗi quốc gia chỉ kết minh tối đa ${GAMEPLAY_RULES.MAX_ALLIANCES} nước cùng lúc.`,
        `• Hủy Đồng Minh giữa chừng sẽ bị gắn nhãn Kẻ Phản Bội trong ${GAMEPLAY_RULES.TRAITOR_TIMER_SECONDS}s (AI từ chối kết minh và tăng thiệt hại khi bị đánh).`,
        '• Trong bảng Ngoại Giao cũng xem được tương quan lãnh thổ và mở giao thương tài nguyên với từng AI.',
      ],
    },
    {
      id: 'naval',
      num: 8,
      icon: '⚓',
      title: 'Hải quân',
      summary: 'Tàu khai thác, tàu chiến & đổ bộ',
      lines: [
        `• Cần có ${BUILDING_INFO.PORT.name} thông ra biển lớn; mở mục Tàu Thuyền bên trong nút Tấn Công.`,
        `• ${NAVAL_CONFIG.EXTRACTOR.NAME} (${NAVAL_CONFIG.EXTRACTOR.GOLD_COST}💰, ${NAVAL_CONFIG.EXTRACTOR.OIL_COST}🛢️, ${NAVAL_CONFIG.EXTRACTOR.MINERAL_COST}⛏️, đóng ${NAVAL_CONFIG.EXTRACTOR.BUILD_TIME_SECONDS}s): hút mỏ dầu biển, tối đa ${NAVAL_CONFIG.EXTRACTOR.MAX_PER_PORT}/cảng (${NAVAL_CONFIG.EXTRACTOR.MAX_PER_NATION}/nước).`,
        `• ${NAVAL_CONFIG.WARSHIP.NAME} (${NAVAL_CONFIG.WARSHIP.GOLD_COST}💰, ${NAVAL_CONFIG.WARSHIP.OIL_COST}🛢️, ${NAVAL_CONFIG.WARSHIP.MINERAL_COST}⛏️, đóng ${NAVAL_CONFIG.WARSHIP.BUILD_TIME_SECONDS}s): ${NAVAL_CONFIG.WARSHIP.BASE_HP} HP, ${NAVAL_CONFIG.WARSHIP.DPS} DPS, tầm bắn ${NAVAL_CONFIG.WARSHIP.RANGE_TILES} ô, tối đa ${NAVAL_CONFIG.WARSHIP.MAX_PER_PORT}/cảng (${NAVAL_CONFIG.WARSHIP.MAX_PER_NATION}/nước).`,
        `• Tàu Chiến mang được ${Math.round(NAVAL_CONFIG.WARSHIP.TROOP_CARRY_RATIO * 100)}% quân hiện có và tự động đưa quân đổ bộ khi bạn chạm đánh đất bên kia biển.`,
        `• Ghép tối đa ${NAVAL_CONFIG.FLEET.MAX_SHIPS} Tàu Chiến thành 1 Hạm Đội (+${NAVAL_CONFIG.FLEET.VISION_BONUS} tầm nhìn); áp sát tàu vô chủ trong ${NAVAL_CONFIG.WARSHIP.DERELICT_CAPTURE_SECONDS}s để chiếm giữ.`,
        `• Hư hại tự hồi ${Math.round(NAVAL_CONFIG.WARSHIP.REPAIR_PORT_PCT_PER_SEC * 100)}% HP/s tại cảng hoặc sửa ngoài biển với giá ${NAVAL_CONFIG.WARSHIP.REPAIR_SEA_GOLD_PER_HP}💰/HP.`,
      ],
    },
    {
      id: 'airAndMissile',
      num: 9,
      icon: '🚀',
      title: 'Tên lửa và Máy bay',
      summary: 'Vũ khí tầm xa & điều kiện mở khóa',
      lines: [
        `• Tên lửa phóng từ ${BUILDING_INFO.MISSILE_SILO.name} (hồi chiêu ${MISSILE_SETTINGS.COOLDOWN_SECONDS}s, bay ${MISSILE_SETTINGS.DEFAULT_FLIGHT_DURATION_SECONDS}s): ${MISSILE_CONFIG.ATOM.name} (${fmt(MISSILE_CONFIG.ATOM.cost)}💰, ${MISSILE_CONFIG.ATOM.oilCost}🛢️, ${MISSILE_CONFIG.ATOM.mineralCost}⛏️), ${MISSILE_CONFIG.HYDRO.name} (${fmt(MISSILE_CONFIG.HYDRO.cost)}💰), ${MISSILE_CONFIG.MIRV.name} (${fmt(MISSILE_CONFIG.MIRV.cost)}💰, rải ${MISSILE_CONFIG.MIRV.mirvCount} đầu đạn không thể bị SAM chặn).`,
        `• ${BUILDING_INFO.AIR_DEFENSE.name} (SAM) chặn ${Math.round(MISSILE_SETTINGS.SAM_INTERCEPT_CHANCE * 100)}% Atom/Hydro trong ${MISSILE_SETTINGS.SAM_INTERCEPT_RANGE} ô (lên 90% & 6 ô khi có Phòng Thủ 3B).`,
        `• Không quân dùng lượt xuất kích (tối đa ${AIR_SYSTEM_CONFIG.MAX_SORTIES}, hồi 1/${AIR_SYSTEM_CONFIG.SORTIE_RECHARGE_SECONDS}s); mỗi nước sở hữu tối đa ${AIR_SYSTEM_CONFIG.MAX_OWNED_PER_NATION} chiếc, tối đa ${AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL} chiếc bay cùng lúc.`,
        `• Mở khóa Loại 1 (${AIR_UNIT_SPECS.FIGHTER.name} — ${fmt(AIR_UNIT_SPECS.FIGHTER.goldCost)}💰, ${AIR_UNIT_SPECS.FIGHTER.oilCost}🛢️, ${AIR_UNIT_SPECS.FIGHTER.troopCost} quân): cần Quân Sự Tối Thượng cấp 3.`,
        `• Mở khóa Loại 2 (${AIR_UNIT_SPECS.SQUADRON.name} — ${fmt(AIR_UNIT_SPECS.SQUADRON.goldCost)}💰) & Loại 3 (${AIR_UNIT_SPECS.BOMBER.name} — ${fmt(AIR_UNIT_SPECS.BOMBER.goldCost)}💰): cần ĐỒNG THỜI Đại Công Xưởng tồn tại đủ ${AIR_SYSTEM_CONFIG.GRAND_ARSENAL_UNLOCK_SECONDS}s VÀ Quân Sự Tối Thượng cấp 3.`,
        '• Ném Bom (L3) cần chọn 2 điểm đầu/cuối để rải bom dọc đường bay.',
      ],
    },
    {
      id: 'superBuildings',
      num: 10,
      icon: '🏰',
      title: 'Siêu công trình',
      summary: '3 công trình tối thượng & giới hạn',
      lines: [
        `• Mở khóa khi học xong cấp 3 cả 3 nhánh công nghệ thường; xây mất ${SUPER_BUILDING_CONFIG.BUILD_TIME_SECONDS}s, tối đa ${SUPER_BUILDING_CONFIG.MAX_PER_TYPE}/loại và ${SUPER_BUILDING_CONFIG.MAX_TOTAL_PER_NATION} công trình mỗi nước.`,
        `• ${BUILDING_INFO.SUPREME_FORTRESS.name} (${fmt(BUILDING_INFO.SUPREME_FORTRESS.baseCost)}💰): giảm ${Math.round(SUPER_BUILDING_CONFIG.FORTRESS_MISSILE_REDUCTION_ACTIVE * 100)}% sát thương tên lửa trong ${SUPER_BUILDING_CONFIG.FORTRESS_RADIUS} ô (lên ${Math.round(SUPREME_TECH_EFFECTS.DEFENSE_2_FORTRESS_REDUCTION_ACTIVE * 100)}% & ${SUPREME_TECH_EFFECTS.DEFENSE_2_FORTRESS_RADIUS} ô ở Phòng Thủ Tối Thượng 2).`,
        `• ${BUILDING_INFO.GRAND_ACADEMY.name} (${fmt(BUILDING_INFO.GRAND_ACADEMY.baseCost)}💰): nhân tốc độ nghiên cứu công nghệ lên ×${SUPER_BUILDING_CONFIG.ACADEMY_SPEED_ACTIVE} khi đang hoạt động.`,
        `• ${BUILDING_INFO.GRAND_ARSENAL.name} (${fmt(BUILDING_INFO.GRAND_ARSENAL.baseCost)}💰): +${Math.round(SUPER_BUILDING_CONFIG.ARSENAL_REGEN_BONUS_ACTIVE * 100)}% hồi quân, +${Math.round(SUPER_BUILDING_CONFIG.ARSENAL_MAX_TROOP_BONUS_ACTIVE * 100)}% trần quân và chạy đồng hồ ${AIR_SYSTEM_CONFIG.GRAND_ARSENAL_UNLOCK_SECONDS}s mở Máy Bay L2/L3.`,
        `• Khi HP dưới ${SUPER_BUILDING_CONFIG.DAMAGED_THRESHOLD}%, hiệu ứng giảm mạnh sang trạng thái Hư Hại và cần bấm Sửa; về 0 HP sẽ bị phá hủy.`,
        '• Nếu bị chiếm, phe mới chỉ tiếp quản được khi chưa đạt giới hạn tối đa, ngược lại công trình sẽ sụp đổ.',
      ],
    },
    {
      id: 'bossTitan',
      num: 11,
      icon: '👹',
      title: 'Boss và Tà Thần',
      summary: 'Quốc gia Boss & Tà Thần Cổ Đại',
      lines: [
        `• Boss là AI mạnh nhất trận, khởi đầu nhiều đất/vàng/quân hơn và được nhân sức mạnh kỹ năng theo độ khó (Dễ ×${bossEasy}, Vừa ×${bossNormal}, Khó ×${bossHard}, Cực Khó ×${bossExtreme}).`,
        `• Tà Thần Cổ Đại xuất hiện từ phút ${titanSpawnMin} (${DARK_TITAN_CONFIG.SPAWN_TIME_SECONDS}s, báo trước ${DARK_TITAN_CONFIG.SPAWN_WARNING_SECONDS}s) và tồn tại tối đa ${titanDurMin} phút.`,
        `• Tà Thần có HP nền ${fmt(DARK_TITAN_CONFIG.MAX_HP)} (tăng theo độ khó và thời gian trận), di chuyển mỗi ${DARK_TITAN_CONFIG.MOVE_INTERVAL_SECONDS}s và gây sát thương liên tục.`,
        `• Tà Thần có 3 chiêu Q/W/E và Chiêu Cuối phạm vi ${DARK_TITAN_CONFIG.ULT_RADIUS} ô (hồi ${DARK_TITAN_CONFIG.ULT_COOLDOWN}s, gồng ${DARK_TITAN_CONFIG.ULT_CHARGE_SECONDS}s); dưới ${Math.round(DARK_TITAN_CONFIG.RAGE_HP_RATIO * 100)}% HP sẽ Cuồng Nộ.`,
        `• Dùng quân, tên lửa, máy bay hoặc tàu chiến để hạ Tà Thần: thưởng +${fmt(DARK_TITAN_CONFIG.BOUNTY_GOLD)}💰 và Buff +${titanBuffPct}% sức mạnh trong ${Math.round(DARK_TITAN_CONFIG.BUFF_DURATION_SECONDS / 60)} phút.`,
        `• Sau khi Tà Thần biến mất hoặc bị hạ, sau ${DARK_TITAN_CONFIG.RESPAWN_COOLDOWN_SECONDS}s có thể hồi sinh đợt mới.`,
      ],
    },
  ];
}

export const HandbookModal: React.FC<HandbookModalProps> = ({ isOpen, onClose }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const chapters = buildHandbookChapters();
  const activeChapter = selectedId ? chapters.find(c => c.id === selectedId) || null : null;
  const activeIdx = activeChapter ? chapters.findIndex(c => c.id === activeChapter.id) : -1;

  const handleClose = () => {
    setSelectedId(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-amber-400/60 rounded-3xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col text-left">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/95 border-b border-slate-700 gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {activeChapter ? (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="min-w-[40px] min-h-[40px] p-2 -ml-1 text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl flex items-center justify-center active:scale-95 shrink-0"
                aria-label="Quay lại"
                title="Quay lại mục lục"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/70 text-amber-300 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-black text-white truncate">
                {activeChapter
                  ? `${activeChapter.num}. ${activeChapter.title}`
                  : '📖 Sổ Tay Đế Chế'}
              </h3>
              <p className="text-xs text-slate-300 truncate">
                {activeChapter ? activeChapter.summary : 'Chọn mục để xem hướng dẫn & chỉ số thật'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="min-w-[40px] min-h-[40px] p-2 text-slate-100 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl flex items-center justify-center shrink-0"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {!activeChapter ? (
          <div className="p-3 overflow-y-auto space-y-2 flex-1">
            {chapters.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedId(ch.id)}
                className="w-full flex items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-slate-950/90 hover:bg-slate-800/90 active:scale-[0.99] border border-slate-700 hover:border-amber-400/70 rounded-2xl text-left transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-lg shrink-0">
                    {ch.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white truncate">
                      {ch.num}. {ch.title}
                    </div>
                    <div className="text-xs text-slate-300 truncate">{ch.summary}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 overflow-y-auto space-y-3 flex-1">
            <div className="bg-slate-950/90 border border-slate-700 rounded-2xl p-3.5 space-y-2">
              {activeChapter.lines.map((line, i) => (
                <p key={i} className="text-sm text-slate-100 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="min-h-[42px] px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl border border-slate-600 flex items-center gap-1.5 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Mục lục</span>
              </button>

              <div className="flex items-center gap-1.5">
                {activeIdx > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedId(chapters[activeIdx - 1].id)}
                    className="min-h-[42px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-xl border border-slate-600 active:scale-95"
                  >
                    ← Mục {chapters[activeIdx - 1].num}
                  </button>
                )}
                {activeIdx >= 0 && activeIdx < chapters.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedId(chapters[activeIdx + 1].id)}
                    className="min-h-[42px] px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm rounded-xl border border-amber-400 active:scale-95"
                  >
                    Mục {chapters[activeIdx + 1].num} →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
