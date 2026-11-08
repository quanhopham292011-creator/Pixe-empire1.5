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

// CHI PHÍ NÂNG CẤP THEO TỪNG CẤP ĐỘ (1 ĐIỂM KỸ NĂNG + VÀNG + XU PIXEL)
export const NODE_COSTS: Record<number, { gold: number; coins: number }> = {
  1: { gold: 500, coins: 2 },
  2: { gold: 1000, coins: 4 },
  3: { gold: 1800, coins: 6 },
  4: { gold: 2800, coins: 10 },
  5: { gold: 4500, coins: 16 }, // Mốc đặc biệt 1
  6: { gold: 7000, coins: 22 },
  7: { gold: 10500, coins: 30 },
  8: { gold: 15000, coins: 40 },
  9: { gold: 22000, coins: 55 },
  10: { gold: 35000, coins: 75 }, // Mốc đặc biệt 2
};

// 1. NHÁNH KINH TẾ (MÀU VÀNG)
export const ECONOMY_BRANCH: SkillNodeInfo[] = [
  {
    level: 1,
    name: 'Thuế Nông Nghiệp',
    shortDesc: '+4% sản lượng vàng/giây',
    fullDesc: 'Tối ưu hóa nguồn thu thuế từ đồng ruộng và trang trại. Tăng 4% tổng sản lượng vàng mỗi giây.',
    goldCost: NODE_COSTS[1].gold,
    coinCost: NODE_COSTS[1].coins,
  },
  {
    level: 2,
    name: 'Giao Thương Địa Phương',
    shortDesc: '+5% sản lượng vàng & +10% trần dân số',
    fullDesc: 'Kết nối các chợ phiên vùng quê, tăng thêm 5% sản lượng vàng và nới rộng 10% trần dân số.',
    goldCost: NODE_COSTS[2].gold,
    coinCost: NODE_COSTS[2].coins,
  },
  {
    level: 3,
    name: 'Thương Cảng Nhộn Nhịp',
    shortDesc: '+10% vàng từ Thành Thị & Cảng biển',
    fullDesc: 'Mở rộng giao thương đường thủy, tăng 10% lượng vàng sản sinh từ tất cả Thành Thị và Cảng Biển.',
    goldCost: NODE_COSTS[3].gold,
    coinCost: NODE_COSTS[3].coins,
  },
  {
    level: 4,
    name: 'Thủy Lợi & Đê Điều',
    shortDesc: '+15% giới hạn trần dân số tối đa',
    fullDesc: 'Quy hoạch đê điều ngăn lũ, thúc đẩy đô thị phát triển bền vững, nâng trần dân số thêm 15%.',
    goldCost: NODE_COSTS[4].gold,
    coinCost: NODE_COSTS[4].coins,
  },
  {
    level: 5,
    name: '⭐ Con Đường Tơ Lụa',
    shortDesc: 'MỐC ĐẶC BIỆT: +25% Vàng, Tàu buôn x2 vàng, Giảm 20% giá Thành Thị',
    fullDesc: 'Mở ra tuyến thương mại huyết mạch: Tăng 25% thu nhập vàng, Tàu buôn biển mang về gấp đôi vàng (+100%), và giảm 20% chi phí xây dựng Thành Thị.',
    goldCost: NODE_COSTS[5].gold,
    coinCost: NODE_COSTS[5].coins,
    isSpecialMilestone: true,
  },
  {
    level: 6,
    name: 'Khai Khoáng Kim Loại',
    shortDesc: '+8% vàng & giảm 15% thời gian/phí công nghệ',
    fullDesc: 'Phát triển luyện kim sâu, tăng thêm 8% vàng mỗi giây và giảm 15% thời gian nghiên cứu cây công nghệ.',
    goldCost: NODE_COSTS[6].gold,
    coinCost: NODE_COSTS[6].coins,
  },
  {
    level: 7,
    name: 'Ngân Khố Hoàng Gia',
    shortDesc: '+12% vàng & tăng 20% tốc độ sinh sôi dân số',
    fullDesc: 'Quản lý tài chính tập trung, tăng 12% vàng và gia tăng 20% tốc độ tăng trưởng dân số toàn quốc.',
    goldCost: NODE_COSTS[7].gold,
    coinCost: NODE_COSTS[7].coins,
  },
  {
    level: 8,
    name: 'Độc Quyền Ngoại Thương',
    shortDesc: '+15% vàng từ các tỉnh giáp biển',
    fullDesc: 'Nắm giữ các tuyến hải lộ chiến lược, tăng 15% sản lượng vàng tại mọi ô lãnh thổ giáp đại dương.',
    goldCost: NODE_COSTS[8].gold,
    coinCost: NODE_COSTS[8].coins,
  },
  {
    level: 9,
    name: 'Đô Thị Hóa Thần Tốc',
    shortDesc: '+20% vàng Thành Thị & +25% trần dân số',
    fullDesc: 'Xây dựng các siêu đô thị phồn hoa, tăng 20% vàng từ Thành Thị và nới rộng thêm 25% trần dân số.',
    goldCost: NODE_COSTS[9].gold,
    coinCost: NODE_COSTS[9].coins,
  },
  {
    level: 10,
    name: '👑 Kho Vàng Bất Tận',
    shortDesc: 'MỐC TỐI THƯỢNG: +40% Vàng, Thưởng vàng khi chiếm đất, Trần dân số +35%',
    fullDesc: 'Kinh tế đạt cảnh giới vương quyền: Tăng 40% sản lượng vàng toàn quốc, mỗi khi chiếm được đất địch được thưởng ngay lượng vàng dồi dào, trần dân số tăng 35%.',
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
    shortDesc: '+5% giới hạn quân đội tối đa',
    fullDesc: 'Thực hiện huấn luyện quân thường trực, nâng trần quân số tối đa thêm 5%.',
    goldCost: NODE_COSTS[1].gold,
    coinCost: NODE_COSTS[1].coins,
  },
  {
    level: 2,
    name: 'Doanh Trại Cải Tiến',
    shortDesc: '+6% tốc độ hồi quân mỗi giây',
    fullDesc: 'Nâng cấp lò rèn và doanh trại dã chiến, tăng 6% tốc độ tuyển quân mỗi giây.',
    goldCost: NODE_COSTS[2].gold,
    coinCost: NODE_COSTS[2].coins,
  },
  {
    level: 3,
    name: 'Giáo Dài Phòng Ngự',
    shortDesc: '+10% điểm phòng thủ lãnh thổ biên giới',
    fullDesc: 'Trang bị giáo dài và khiên chắn tại các tỉnh biên giới, tăng 10% khả năng chống đỡ đòn đánh lấn.',
    goldCost: NODE_COSTS[3].gold,
    coinCost: NODE_COSTS[3].coins,
  },
  {
    level: 4,
    name: 'Hành Quân Cơ Động',
    shortDesc: '+10% tốc độ di chuyển đợt tấn công',
    fullDesc: 'Cải tiến quân nhu gọn nhẹ, giúp các đợt lính hành quân chiếm đất nhanh hơn 10%.',
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
    shortDesc: '+12% quân tối đa & tăng độ bền Pháo đài',
    fullDesc: 'Rèn giáp sắt kiên cố, nâng sức chứa quân đội tối đa thêm 12% và gia tăng phòng ngự công trình.',
    goldCost: NODE_COSTS[6].gold,
    coinCost: NODE_COSTS[6].coins,
  },
  {
    level: 7,
    name: 'Hậu Cần Dã Chiến',
    shortDesc: '+15% tốc độ tuyển quân & hồi lính nhanh',
    fullDesc: 'Tổ chức tiếp tế liên tục, tăng 15% tốc độ hồi phục quân đội mỗi giây.',
    goldCost: NODE_COSTS[7].gold,
    coinCost: NODE_COSTS[7].coins,
  },
  {
    level: 8,
    name: 'Công Nghệ Đạn Đạo',
    shortDesc: 'Giảm 25% hồi chiêu Tên lửa Silo & Pháo binh',
    fullDesc: 'Cải tiến thuốc súng và hệ thống dẫn đường, giảm 25% thời gian hồi bệ phóng tên lửa và pháo kích.',
    goldCost: NODE_COSTS[8].gold,
    coinCost: NODE_COSTS[8].coins,
  },
  {
    level: 9,
    name: 'Xung Kích Lan Tròn',
    shortDesc: '+4 nhịp càn quét liên tiếp khi chiếm đất',
    fullDesc: 'Đội quân tràn qua biên giới không ngừng nghỉ, tăng thêm +4 nhịp burst càn quét liên tiếp khi đánh địch.',
    goldCost: NODE_COSTS[9].gold,
    coinCost: NODE_COSTS[9].coins,
  },
  {
    level: 10,
    name: '🛡️ Bất Bại Thiết Triều',
    shortDesc: 'MỐC TỐI THƯỢNG: +40% Quân tối đa, +35% Tốc độ hồi quân, +6 nhịp càn quét',
    fullDesc: 'Đế quốc quân sự đỉnh cao: Quân đội tối đa tăng 40%, tốc độ hồi quân tăng 35%, bệ phóng tên lửa giảm 35% hồi chiêu, các đợt tấn công lan tràn thêm +6 nhịp nổ quét bản đồ.',
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
    shortDesc: '+5% hiệu suất sức mạnh Tướng ra trận',
    fullDesc: 'Rèn luyện khả năng chỉ huy, tăng 5% hiệu suất chiến đấu của Tướng khi tham chiến biên cương.',
    goldCost: NODE_COSTS[1].gold,
    coinCost: NODE_COSTS[1].coins,
  },
  {
    level: 2,
    name: 'Khí Phách Bền Bỉ',
    shortDesc: 'Giảm 15% thời gian hồi sinh khi Tướng ngã',
    fullDesc: 'Ý chí kiên cường giúp Tướng hồi phục sau chấn thương nhanh hơn 15%.',
    goldCost: NODE_COSTS[2].gold,
    coinCost: NODE_COSTS[2].coins,
  },
  {
    level: 3,
    name: 'Binh Pháp Tốc Chiến',
    shortDesc: '+15% tốc độ di chuyển của Tướng trên bản đồ',
    fullDesc: 'Tướng di chuyển linh hoạt, tăng 15% tốc độ khi tuần tra biên giới hoặc chỉ huy tiền tuyến.',
    goldCost: NODE_COSTS[3].gold,
    coinCost: NODE_COSTS[3].coins,
  },
  {
    level: 4,
    name: 'Sĩ Khí Xung Trận',
    shortDesc: '+10% sức mạnh đợt tấn công có Tướng đi kèm',
    fullDesc: 'Binh lính được truyền lửa dũng cảm, đợt lính có Tướng đi cùng được tăng thêm 10% uy lực.',
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
    shortDesc: 'Tăng 15% hiệu quả kỹ năng chủ động',
    fullDesc: 'Tận dụng địa hình và mưu lược, tăng 15% sức công phá hoặc phạm vi kỹ năng của Tướng.',
    goldCost: NODE_COSTS[6].gold,
    coinCost: NODE_COSTS[6].coins,
  },
  {
    level: 7,
    name: 'Đột Kích Phá Trận',
    shortDesc: '+20% sức mạnh càn quét khi Tướng dẫn quân',
    fullDesc: 'Tướng trực tiếp dẫn quân phá vỡ phòng tuyến địch, tăng thêm 20% sức mạnh khi xung phong.',
    goldCost: NODE_COSTS[7].gold,
    coinCost: NODE_COSTS[7].coins,
  },
  {
    level: 8,
    name: 'Hộ Mệnh Kim Cương',
    shortDesc: 'Giảm 50% tỉ lệ Tướng bị thương vong ngoài mặt trận',
    fullDesc: 'Bộ giáp hộ mệnh bảo vệ Tướng khỏi những tình huống hiểm nghèo trên sa trường.',
    goldCost: NODE_COSTS[8].gold,
    coinCost: NODE_COSTS[8].coins,
  },
  {
    level: 9,
    name: 'Uy Trấn Thiên Hạ',
    shortDesc: 'Giảm 35% hồi chiêu kỹ năng của Tướng',
    fullDesc: 'Khí phách áp đảo khiến quân thù khiếp sợ, kỹ năng Tướng hồi nhanh hơn 35%.',
    goldCost: NODE_COSTS[9].gold,
    coinCost: NODE_COSTS[9].coins,
  },
  {
    level: 10,
    name: '⚡ Huyền Thoại Bất Tử',
    shortDesc: 'MỐC TỐI THƯỢNG: Kỹ năng Tướng hồi -50%, Sức mạnh dẫn quân +70%, Hồi sinh tức thì 3s',
    fullDesc: 'Vị tướng trở thành huyền thoại bất diệt: Kỹ năng hồi siêu tốc (-50% cooldown), sức mạnh dẫn quân tăng vọt thành +70%, và nếu tử trận sẽ hồi sinh ngay lập tức chỉ trong 3 giây!',
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
    shortDesc: 'Giảm 40% giá xây công trình, Thành Thị thêm +6 quân/s, Doanh trại thêm +20 vàng/s',
    fullDesc: 'Biến toàn bộ nền kinh tế thành cỗ máy phục vụ chiến tranh: Giảm 40% chi phí xây dựng mọi công trình (Thành Phố, Doanh Trại, Silo); Mỗi Thành Phố sản sinh thêm +6 quân/giây; Mỗi Doanh Trại đóng góp thêm +20 vàng/giây; Giảm 30% giá mua tên lửa hạt nhân.',
    skillPointCost: 1,
    goldCost: 15000,
    coinCost: 50,
    color: '#eab308', // Vàng phối Xanh
  },
  {
    id: 'ECONOMY_HERO',
    name: 'Đại Đế Phú Hào & Chiêu Hiền',
    branch1: 'ECONOMY',
    branch2: 'HERO',
    title: 'Kinh Tế + Anh Hùng',
    shortDesc: 'Tướng xuất chiêu thưởng 15% Kho Vàng, Giảm 40% hồi chiêu, Thắng nhận +50% Xu Pixel',
    fullDesc: 'Sức mạnh của đồng tiền kết hợp cùng mưu lược danh tướng: Mỗi khi Tướng kích hoạt kỹ năng, ngân khố ngay lập tức được thưởng lượng vàng bằng 15% số vàng hiện có; Tướng giảm thêm 40% thời gian hồi chiêu; Phần thưởng Xu Pixel sau mỗi trận thắng tăng 50%.',
    skillPointCost: 1,
    goldCost: 15000,
    coinCost: 50,
    color: '#f59e0b', // Vàng phối Đỏ
  },
  {
    id: 'MILITARY_HERO',
    name: 'Chiến Thần Xuất Chinh Vô Địch',
    branch1: 'MILITARY',
    branch2: 'HERO',
    title: 'Quân Đội + Anh Hùng',
    shortDesc: 'Tướng dẫn quân tăng gấp đôi sức mạnh (+60%), Đi nhanh +40%, Hoàn trả 50% quân sau trận',
    fullDesc: 'Lối chơi công phá thần tốc: Khi Tướng dẫn dắt đợt hành quân, sức mạnh đợt tấn công tăng lên gấp đôi (+60% thay vì +30%); Tốc độ di chuyển sóng công kích nhanh hơn 40%; Hoàn trả ngay 50% quân số tiêu hao sau khi chiếm xong cứ điểm đối phương.',
    skillPointCost: 1,
    goldCost: 15000,
    coinCost: 50,
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
  let goldMult = 1 + economyLevel * 0.04;
  if (economyLevel >= 5) goldMult += 0.20;
  if (economyLevel >= 10) goldMult += 0.35;

  let popCapMult = 1 + economyLevel * 0.03;
  if (economyLevel >= 4) popCapMult += 0.12;
  if (economyLevel >= 10) popCapMult += 0.25;

  let popGrowthMult = 1 + (economyLevel >= 7 ? 0.20 : 0);

  let buildCostDiscount = economyLevel >= 5 ? 0.20 : 0;
  let shipGoldMult = economyLevel >= 5 ? 2.0 : 1.0;

  // 2. Quân Đội
  let troopsMaxMult = 1 + militaryLevel * 0.04;
  if (militaryLevel >= 10) troopsMaxMult += 0.35;

  let troopsRegenMult = 1 + militaryLevel * 0.03;
  if (militaryLevel >= 10) troopsRegenMult += 0.30;

  let marchSpeedMult = 1 + militaryLevel * 0.03;
  if (militaryLevel >= 5) marchSpeedMult += 0.20;

  let burstCaptureBonus = 0;
  if (militaryLevel >= 9) burstCaptureBonus += 4;
  if (militaryLevel >= 10) burstCaptureBonus += 6;

  let siloCooldownMult = 1;
  if (militaryLevel >= 5) siloCooldownMult *= 0.80;
  if (militaryLevel >= 8) siloCooldownMult *= 0.75;
  if (militaryLevel >= 10) siloCooldownMult *= 0.65;

  // 3. Anh Hùng
  let generalCombatBonus = 0.30 + heroLevel * 0.03;
  if (heroLevel >= 10) generalCombatBonus += 0.35;

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
    goldMult += 0.15;
    siloCooldownMult *= 0.70;
  }

  if (isEconomyHeroHybrid) {
    generalCooldownMult = Math.max(0.30, generalCooldownMult - 0.20);
    goldMult += 0.15;
  }

  if (isMilitaryHeroHybrid) {
    generalCombatBonus += 0.30; // +60% tổng
    marchSpeedMult += 0.40;
    burstCaptureBonus += 4;
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
