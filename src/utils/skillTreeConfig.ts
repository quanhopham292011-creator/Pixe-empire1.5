/**
 * Cấu hình Cây Kỹ Năng (Skill Tree) - 3 Nhánh: Kinh Tế, Quân Đội, Anh Hùng
 * và 3 Mốc Kết Hợp (Hybrid Mastery)
 */

import { HybridMasteryId, PlayerSkillTree } from '../types';

export interface SkillNodeInfo {
  level: number;
  name: string;
  shortDesc: string;
  fullDesc: string;
  goldCost: number;
  coinCost: number;
  isSpecialMilestone?: boolean;
}

export interface HybridNodeInfo {
  id: HybridMasteryId;
  name: string;
  branch1: 'ECONOMY' | 'MILITARY' | 'HERO';
  branch2: 'ECONOMY' | 'MILITARY' | 'HERO';
  title: string;
  shortDesc: string;
  fullDesc: string;
  skillPointCost: number;
  goldCost: number;
  coinCost: number;
  color: string;
}

export const RESET_SKILL_TREE_COIN_COST = 15;

// CHI PHÍ NÂNG CẤP THEO TỪNG CẤP ĐỘ (1 ĐIỂM KỸ NĂNG + XU PIXEL)
export const NODE_COSTS: Record<number, { gold: number; coins: number }> = {
  1: { gold: 0, coins: 3 },
  2: { gold: 0, coins: 6 },
  3: { gold: 0, coins: 9 },
  4: { gold: 0, coins: 15 },
  5: { gold: 0, coins: 24 }, // Mốc đặc biệt 1
  6: { gold: 0, coins: 33 },
  7: { gold: 0, coins: 45 },
  8: { gold: 0, coins: 60 },
  9: { gold: 0, coins: 80 },
  10: { gold: 0, coins: 110 }, // Mốc đặc biệt 2
};

// 1. NHÁNH KINH TẾ (MÀU VÀNG)
export const ECONOMY_BRANCH: SkillNodeInfo[] = [
  {
    level: 1,
    name: 'Thuế Nông Nghiệp',
    shortDesc: '+1% sản lượng vàng/giây',
    fullDesc: 'Tối ưu hóa nguồn thu thuế từ đồng ruộng và trang trại. Tăng 1% tổng sản lượng vàng mỗi giây.',
    goldCost: NODE_COSTS[1].gold,
    coinCost: NODE_COSTS[1].coins,
  },
  {
    level: 2,
    name: 'Giao Thương Địa Phương',
    shortDesc: '+1% sản lượng vàng & +3% trần dân số',
    fullDesc: 'Kết nối các chợ phiên vùng quê, tăng thêm 1% sản lượng vàng và nới rộng 3% trần dân số.',
    goldCost: NODE_COSTS[2].gold,
    coinCost: NODE_COSTS[2].coins,
  },
  {
    level: 3,
    name: 'Thương Cảng Nhộn Nhịp',
    shortDesc: '+1% sản lượng vàng & +4.5% trần dân số',
    fullDesc: 'Mở rộng giao thương đường thủy, tăng thêm 1% sản lượng vàng và nới rộng 4.5% trần dân số.',
    goldCost: NODE_COSTS[3].gold,
    coinCost: NODE_COSTS[3].coins,
  },
  {
    level: 4,
    name: 'Thủy Lợi & Đê Điều',
    shortDesc: '+13% giới hạn trần dân số tối đa',
    fullDesc: 'Quy hoạch đê điều ngăn lũ, thúc đẩy đô thị phát triển bền vững, nâng trần dân số thêm 13%.',
    goldCost: NODE_COSTS[4].gold,
    coinCost: NODE_COSTS[4].coins,
  },
  {
    level: 5,
    name: '⭐ Con Đường Tơ Lụa',
    shortDesc: 'MỐC ĐẶC BIỆT: +5% Vàng, Tàu buôn x1.3 vàng, Giảm 20% giá Thành Thị',
    fullDesc: 'Mở ra tuyến thương mại huyết mạch: Tăng thêm 5% thu nhập vàng, Tàu buôn biển mang về thêm vàng (×1.3), và giảm 20% chi phí xây dựng Thành Thị.',
    goldCost: NODE_COSTS[5].gold,
    coinCost: NODE_COSTS[5].coins,
    isSpecialMilestone: true,
  },
  {
    level: 6,
    name: 'Khai Khoáng Kim Loại',
    shortDesc: '+1% vàng & giảm 15% thời gian/phí công nghệ',
    fullDesc: 'Phát triển luyện kim sâu, tăng thêm 1% vàng mỗi giây và giảm 15% thời gian nghiên cứu cây công nghệ.',
    goldCost: NODE_COSTS[6].gold,
    coinCost: NODE_COSTS[6].coins,
  },
  {
    level: 7,
    name: 'Ngân Khố Hoàng Gia',
    shortDesc: '+1% vàng & tăng 20% tốc độ sinh sôi dân số',
    fullDesc: 'Quản lý tài chính tập trung, tăng thêm 1% vàng và gia tăng 20% tốc độ tăng trưởng dân số toàn quốc.',
    goldCost: NODE_COSTS[7].gold,
    coinCost: NODE_COSTS[7].coins,
  },
  {
    level: 8,
    name: 'Độc Quyền Ngoại Thương',
    shortDesc: '+1% vàng & tăng sản lượng tỉnh giáp biển',
    fullDesc: 'Nắm giữ các tuyến hải lộ chiến lược, tăng thêm 1% sản lượng vàng toàn quốc.',
    goldCost: NODE_COSTS[8].gold,
    coinCost: NODE_COSTS[8].coins,
  },
  {
    level: 9,
    name: 'Đô Thị Hóa Thần Tốc',
    shortDesc: '+1% vàng & +13.5% trần dân số',
    fullDesc: 'Xây dựng các siêu đô thị phồn hoa, tăng thêm 1% vàng và nới rộng thêm trần dân số.',
    goldCost: NODE_COSTS[9].gold,
    coinCost: NODE_COSTS[9].coins,
  },
  {
    level: 10,
    name: '👑 Kho Vàng Bất Tận',
    shortDesc: 'MỐC TỐI THƯỢNG: +8% Vàng, Thưởng vàng khi chiếm đất, Trần dân số +8%',
    fullDesc: 'Kinh tế đạt cảnh giới vương quyền: Tăng thêm 8% sản lượng vàng toàn quốc (tổng +23%), mỗi khi chiếm đất địch được thưởng vàng dồi dào, trần dân số tăng thêm 8% (tổng +30%).',
    goldCost: NODE_COSTS[10].gold,
    coinCost: NODE_COSTS[10].coins,
    isSpecialMilestone: true,
  },
];

// 2. NHÁNH QUÂN ĐỘI (MÀU XANH DƯƠNG)
export const MILITARY_BRANCH: SkillNodeInfo[] = [
  {
    level: 1,
    name: 'Tinh Binh Rèn Luyện',
    shortDesc: '+3% giới hạn quân đội tối đa',
    fullDesc: 'Thực hiện huấn luyện quân thường trực, nâng trần quân số tối đa thêm 3%.',
    goldCost: NODE_COSTS[1].gold,
    coinCost: NODE_COSTS[1].coins,
  },
  {
    level: 2,
    name: 'Doanh Trại Cải Tiến',
    shortDesc: '+3% quân tối đa & +6% tốc độ hồi quân',
    fullDesc: 'Nâng cấp lò rèn và doanh trại, tăng 3% quân tối đa và 6% tốc độ tuyển quân mỗi giây.',
    goldCost: NODE_COSTS[2].gold,
    coinCost: NODE_COSTS[2].coins,
  },
  {
    level: 3,
    name: 'Giáo Dài Phòng Ngự',
    shortDesc: '+3% quân tối đa & +10% phòng thủ biên giới',
    fullDesc: 'Trang bị giáo dài và khiên chắn, tăng 3% quân tối đa và 10% khả năng chống đỡ đòn đánh lấn.',
    goldCost: NODE_COSTS[3].gold,
    coinCost: NODE_COSTS[3].coins,
  },
  {
    level: 4,
    name: 'Hành Quân Cơ Động',
    shortDesc: '+3% quân tối đa & +10% tốc độ di chuyển',
    fullDesc: 'Cải tiến quân nhu gọn nhẹ, tăng 3% quân tối đa và giúp đợt lính hành quân chiếm đất nhanh hơn 10%.',
    goldCost: NODE_COSTS[4].gold,
    coinCost: NODE_COSTS[4].coins,
  },
  {
    level: 5,
    name: '⭐ Chiến Thuật Bão Lửa',
    shortDesc: 'MỐC ĐẶC BIỆT: +25% Tốc độ đánh, Giảm 25% hao tổn lính, Silo -20% hồi chiêu',
    fullDesc: 'Phát động chiến dịch thần tốc: Các đợt tiến công di chuyển nhanh hơn 25%, giảm 25% quân số hao hụt khi công phá phòng tuyến địch, Bệ phóng Silo giảm 20% thời gian hồi chiêu.',
    goldCost: NODE_COSTS[5].gold,
    coinCost: NODE_COSTS[5].coins,
    isSpecialMilestone: true,
  },
  {
    level: 6,
    name: 'Thiết Giáp Tiên Phong',
    shortDesc: '+3% quân tối đa & tăng độ bền Pháo đài',
    fullDesc: 'Rèn giáp sắt kiên cố, nâng sức chứa quân đội tối đa thêm 3% và gia tăng phòng ngự công trình.',
    goldCost: NODE_COSTS[6].gold,
    coinCost: NODE_COSTS[6].coins,
  },
  {
    level: 7,
    name: 'Hậu Cần Dã Chiến',
    shortDesc: '+3% quân tối đa & +15% tốc độ tuyển quân',
    fullDesc: 'Tổ chức tiếp tế liên tục, tăng 3% quân tối đa và gia tăng 15% tốc độ hồi phục quân đội.',
    goldCost: NODE_COSTS[7].gold,
    coinCost: NODE_COSTS[7].coins,
  },
  {
    level: 8,
    name: 'Công Nghệ Đạn Đạo',
    shortDesc: '+3% quân tối đa & Giảm 25% hồi chiêu Silo',
    fullDesc: 'Cải tiến hệ thống dẫn đường, tăng 3% quân tối đa và giảm 25% thời gian hồi bệ phóng tên lửa.',
    goldCost: NODE_COSTS[8].gold,
    coinCost: NODE_COSTS[8].coins,
  },
  {
    level: 9,
    name: 'Xung Kích Lan Tròn',
    shortDesc: '+3% quân tối đa & +1 nhịp càn quét liên tiếp',
    fullDesc: 'Đội quân tràn qua biên giới không ngừng nghỉ, tăng 3% quân tối đa và thêm +1 nhịp burst càn quét liên tiếp.',
    goldCost: NODE_COSTS[9].gold,
    coinCost: NODE_COSTS[9].coins,
  },
  {
    level: 10,
    name: '🛡️ Bất Bại Thiết Triều',
    shortDesc: 'MỐC TỐI THƯỢNG: +40% Quân tối đa, +30% Tốc độ hồi quân, +2 nhịp càn quét',
    fullDesc: 'Đế quốc quân sự đỉnh cao: Quân đội tối đa tăng thêm 40% (tổng +70%), tốc độ hồi quân tăng 30%, bệ phóng tên lửa giảm 35% hồi chiêu, các đợt tấn công thêm +2 nhịp nổ càn quét.',
    goldCost: NODE_COSTS[10].gold,
    coinCost: NODE_COSTS[10].coins,
    isSpecialMilestone: true,
  },
];

// 3. NHÁNH ANH HÙNG (MÀU ĐỎ)
export const HERO_BRANCH: SkillNodeInfo[] = [
  {
    level: 1,
    name: 'Uy Lực Tướng Quân',
    shortDesc: '+1.5% hiệu suất sức mạnh Tướng ra trận',
    fullDesc: 'Rèn luyện khả năng chỉ huy, tăng 1.5% hiệu suất chiến đấu của Tướng khi tham chiến biên cương.',
    goldCost: NODE_COSTS[1].gold,
    coinCost: NODE_COSTS[1].coins,
  },
  {
    level: 2,
    name: 'Khí Phách Bền Bỉ',
    shortDesc: '+1.5% sức mạnh Tướng & Giảm 15% thời gian hồi sinh',
    fullDesc: 'Tăng 1.5% sức mạnh Tướng và giúp Tướng hồi phục sau chấn thương nhanh hơn 15%.',
    goldCost: NODE_COSTS[2].gold,
    coinCost: NODE_COSTS[2].coins,
  },
  {
    level: 3,
    name: 'Binh Pháp Tốc Chiến',
    shortDesc: '+1.5% sức mạnh Tướng & +15% tốc độ di chuyển',
    fullDesc: 'Tăng 1.5% sức mạnh Tướng và di chuyển linh hoạt nhanh hơn 15% khi tuần tra biên giới.',
    goldCost: NODE_COSTS[3].gold,
    coinCost: NODE_COSTS[3].coins,
  },
  {
    level: 4,
    name: 'Sĩ Khí Xung Trận',
    shortDesc: '+1.5% sức mạnh Tướng & +10% uy lực dẫn quân',
    fullDesc: 'Tăng 1.5% sức mạnh Tướng và đợt lính có Tướng đi cùng được tăng thêm 10% uy lực.',
    goldCost: NODE_COSTS[4].gold,
    coinCost: NODE_COSTS[4].coins,
  },
  {
    level: 5,
    name: '⭐ Bản Lĩnh Danh Tướng',
    shortDesc: 'MỐC ĐẶC BIỆT: Hồi chiêu kỹ năng -25%, Thời gian hiệu lực +30%, Giảm 30% tử trận',
    fullDesc: 'Khẳng định tài năng thống soái: Thời gian hồi chiêu kỹ năng chủ động giảm 25%, hiệu lực kéo dài thêm 30%, và lính theo Tướng giảm 30% tỉ lệ thương vong.',
    goldCost: NODE_COSTS[5].gold,
    coinCost: NODE_COSTS[5].coins,
    isSpecialMilestone: true,
  },
  {
    level: 6,
    name: 'Chiến Lược Thần Sầu',
    shortDesc: '+1.5% sức mạnh Tướng & +15% hiệu quả kỹ năng',
    fullDesc: 'Tăng 1.5% sức mạnh Tướng và tăng 15% sức công phá hoặc phạm vi kỹ năng của Tướng.',
    goldCost: NODE_COSTS[6].gold,
    coinCost: NODE_COSTS[6].coins,
  },
  {
    level: 7,
    name: 'Đột Kích Phá Trận',
    shortDesc: '+1.5% sức mạnh Tướng & +20% càn quét',
    fullDesc: 'Tăng 1.5% sức mạnh Tướng và tăng thêm 20% sức mạnh khi xung phong.',
    goldCost: NODE_COSTS[7].gold,
    coinCost: NODE_COSTS[7].coins,
  },
  {
    level: 8,
    name: 'Hộ Mệnh Kim Cương',
    shortDesc: '+1.5% sức mạnh Tướng & Giảm 50% thương vong Tướng',
    fullDesc: 'Tăng 1.5% sức mạnh Tướng và bộ giáp hộ mệnh bảo vệ Tướng khỏi những tình huống hiểm nghèo.',
    goldCost: NODE_COSTS[8].gold,
    coinCost: NODE_COSTS[8].coins,
  },
  {
    level: 9,
    name: 'Uy Trấn Thiên Hạ',
    shortDesc: '+1.5% sức mạnh Tướng & Giảm 35% hồi chiêu kỹ năng',
    fullDesc: 'Tăng 1.5% sức mạnh Tướng và kỹ năng Tướng hồi nhanh hơn 35%.',
    goldCost: NODE_COSTS[9].gold,
    coinCost: NODE_COSTS[9].coins,
  },
  {
    level: 10,
    name: '⚡ Huyền Thoại Bất Tử',
    shortDesc: 'MỐC TỐI THƯỢNG: Kỹ năng Tướng hồi -50%, Sức mạnh dẫn quân +15%, Hồi sinh tức thì 3s',
    fullDesc: 'Vị tướng trở thành huyền thoại bất diệt: Kỹ năng hồi siêu tốc (-50% cooldown), sức mạnh dẫn quân tăng thêm +15% (tổng +60%), và nếu tử trận sẽ hồi sinh ngay lập tức chỉ trong 3 giây!',
    goldCost: NODE_COSTS[10].gold,
    coinCost: NODE_COSTS[10].coins,
    isSpecialMilestone: true,
  },
];

// 4. BA MỐC KẾT HỢP (HYBRID MASTERY) - CHỈ ĐƯỢC CHỌN 1 TRONG 3!
export const HYBRID_NODES: HybridNodeInfo[] = [
  {
    id: 'ECONOMY_MILITARY',
    name: 'Cỗ Máy Chiến Tranh Công Nghiệp',
    branch1: 'ECONOMY',
    branch2: 'MILITARY',
    title: 'Kinh Tế + Quân Đội',
    shortDesc: 'Giảm 40% giá xây công trình, Thành Thị +6 quân/s, Doanh trại +2 vàng/s, +5% Vàng',
    fullDesc: 'Biến toàn bộ nền kinh tế thành cỗ máy phục vụ chiến tranh: Giảm 40% chi phí xây dựng mọi công trình (Thành Phố, Doanh Trại, Silo); Mỗi Thành Phố sản sinh thêm +6 quân/giây; Mỗi Doanh Trại đóng góp thêm +2 vàng/giây; Tăng thêm +5% sản lượng vàng toàn quốc.',
    skillPointCost: 1,
    goldCost: 0,
    coinCost: 75,
    color: '#eab308', // Vàng phối Xanh
  },
  {
    id: 'ECONOMY_HERO',
    name: 'Đại Đế Phú Hào & Chiêu Hiền',
    branch1: 'ECONOMY',
    branch2: 'HERO',
    title: 'Kinh Tế + Anh Hùng',
    shortDesc: 'Tướng xuất chiêu thưởng +2% Kho Vàng (max 500), Giảm 40% hồi chiêu, Thắng nhận +50% Xu Pixel, +5% Vàng',
    fullDesc: 'Sức mạnh của đồng tiền kết hợp cùng mưu lược danh tướng: Mỗi khi Tướng kích hoạt kỹ năng, ngân khố ngay lập tức được thưởng lượng vàng bằng +2% số vàng hiện có (tối thiểu 100, tối đa 500); Tướng giảm thêm 40% thời gian hồi chiêu; Phần thưởng Xu Pixel sau mỗi trận thắng tăng 50%; Tăng thêm +5% sản lượng vàng toàn quốc.',
    skillPointCost: 1,
    goldCost: 0,
    coinCost: 75,
    color: '#f59e0b', // Vàng phối Đỏ
  },
  {
    id: 'MILITARY_HERO',
    name: 'Chiến Thần Xuất Chinh Vô Địch',
    branch1: 'MILITARY',
    branch2: 'HERO',
    title: 'Quân Đội + Anh Hùng',
    shortDesc: 'Tướng dẫn quân tăng thêm +20% sức mạnh, Đi nhanh +40%, Hoàn trả 50% quân sau trận, +1 nhịp càn quét',
    fullDesc: 'Lối chơi công phá thần tốc: Khi Tướng dẫn dắt đợt hành quân, sức mạnh đợt tấn công tăng thêm +20%; Tốc độ di chuyển sóng công kích nhanh hơn 40%; Hoàn trả ngay 50% quân số tiêu hao sau khi chiếm xong cứ điểm đối phương; Tăng thêm +1 nhịp burst càn quét liên tiếp.',
    skillPointCost: 1,
    goldCost: 0,
    coinCost: 75,
    color: '#ef4444', // Xanh phối Đỏ
  },
];

/**
 * Tính toán toàn bộ chỉ số thưởng từ Cây Kỹ Năng để áp dụng vào trận đấu
 */
export function getSkillTreeBonuses(tree: PlayerSkillTree | undefined) {
  if (!tree) {
    return {
      goldMult: 1,
      popCapMult: 1,
      popGrowthMult: 1,
      buildCostDiscount: 0,
      troopsMaxMult: 1,
      troopsRegenMult: 1,
      marchSpeedMult: 1,
      burstCaptureBonus: 0,
      generalCombatBonus: 0.30,
      generalCooldownMult: 1,
      generalReviveTimeMult: 1,
      siloCooldownMult: 1,
      shipGoldMult: 1,
      isEconomyMilitaryHybrid: false,
      isEconomyHeroHybrid: false,
      isMilitaryHeroHybrid: false,
    };
  }

  const { economyLevel, militaryLevel, heroLevel, chosenHybrid } = tree;

  // 1. Kinh Tế
  let goldMult = 1 + economyLevel * 0.01;
  if (economyLevel >= 5) goldMult += 0.05;
  if (economyLevel >= 10) goldMult += 0.08;

  let popCapMult = 1 + economyLevel * 0.015;
  if (economyLevel >= 4) popCapMult += 0.07;
  if (economyLevel >= 10) popCapMult += 0.08;

  let popGrowthMult = 1 + (economyLevel >= 7 ? 0.20 : 0);

  let buildCostDiscount = economyLevel >= 5 ? 0.20 : 0;
  let shipGoldMult = economyLevel >= 5 ? 1.3 : 1.0;

  // 2. Quân Đội
  let troopsMaxMult = 1 + militaryLevel * 0.03;
  if (militaryLevel >= 10) troopsMaxMult += 0.40;

  let troopsRegenMult = 1 + militaryLevel * 0.03;
  if (militaryLevel >= 10) troopsRegenMult += 0.30;

  let marchSpeedMult = 1 + militaryLevel * 0.03;
  if (militaryLevel >= 5) marchSpeedMult += 0.20;

  let burstCaptureBonus = 0;
  if (militaryLevel >= 9) burstCaptureBonus += 1;
  if (militaryLevel >= 10) burstCaptureBonus += 2;

  let siloCooldownMult = 1;
  if (militaryLevel >= 5) siloCooldownMult *= 0.80;
  if (militaryLevel >= 8) siloCooldownMult *= 0.75;
  if (militaryLevel >= 10) siloCooldownMult *= 0.65;

  // 3. Anh Hùng
  let generalCombatBonus = 0.30 + heroLevel * 0.015;
  if (heroLevel >= 10) generalCombatBonus += 0.15;

  let generalCooldownMult = 1 - heroLevel * 0.03;
  if (heroLevel >= 5) generalCooldownMult -= 0.15;
  if (heroLevel >= 9) generalCooldownMult -= 0.15;
  if (heroLevel >= 10) generalCooldownMult -= 0.15;
  generalCooldownMult = Math.max(0.35, generalCooldownMult);

  let generalReviveTimeMult = 1;
  if (heroLevel >= 2) generalReviveTimeMult *= 0.85;
  if (heroLevel >= 10) generalReviveTimeMult = 0.2; // Hồi sinh trong 3s

  // 4. Mốc Kết Hợp (Hybrid Mastery)
  const isEconomyMilitaryHybrid = chosenHybrid === 'ECONOMY_MILITARY';
  const isEconomyHeroHybrid = chosenHybrid === 'ECONOMY_HERO';
  const isMilitaryHeroHybrid = chosenHybrid === 'MILITARY_HERO';

  if (isEconomyMilitaryHybrid) {
    buildCostDiscount = Math.min(0.60, buildCostDiscount + 0.40);
    troopsRegenMult += 0.20;
    goldMult += 0.05;
    siloCooldownMult *= 0.70;
  }

  if (isEconomyHeroHybrid) {
    generalCooldownMult = Math.max(0.30, generalCooldownMult - 0.20);
    goldMult += 0.05;
  }

  if (isMilitaryHeroHybrid) {
    generalCombatBonus += 0.20;
    marchSpeedMult += 0.40;
    burstCaptureBonus += 1;
  }

  return {
    goldMult,
    popCapMult,
    popGrowthMult,
    buildCostDiscount,
    troopsMaxMult,
    troopsRegenMult,
    marchSpeedMult,
    burstCaptureBonus,
    generalCombatBonus,
    generalCooldownMult,
    generalReviveTimeMult,
    siloCooldownMult,
    shipGoldMult,
    isEconomyMilitaryHybrid,
    isEconomyHeroHybrid,
    isMilitaryHeroHybrid,
  };
}
