import { TechNode, BuildingType, MissileType, GeneralSkillId, SupremeTechBranch, TechBranch } from '../types';

export const TECH_TREE: TechNode[] = [
  // KINH TẾ
  {
    id: 'eco_1',
    branch: 'ECONOMY',
    level: 1,
    name: 'Khai Khẩn Điền Trang',
    description: 'Tăng 8% sản lượng vàng từ đất đai và thành thị.',
    cost: 285,
    researchTime: 14,
  },
  {
    id: 'eco_2',
    branch: 'ECONOMY',
    level: 2,
    name: 'Phường Buôn Phồn Hoa',
    description: 'Tăng 15% thu nhập vàng và giảm 8% chi phí xây dựng.',
    cost: 855,
    researchTime: 27,
  },
  {
    id: 'eco_3a',
    branch: 'ECONOMY',
    level: 3,
    choice: 'A',
    name: 'Thương Nhân',
    description: 'Tổng +25% thu nhập vàng, cộng 3 vàng mỗi ô chiếm (tối đa 30 vàng/s).',
    cost: 2375,
    researchTime: 45,
  },
  {
    id: 'eco_3b',
    branch: 'ECONOMY',
    level: 3,
    choice: 'B',
    name: 'Thợ Xây',
    description: 'Thu nhập vàng +15%, giảm thêm 20% giá xây mọi công trình, Thành Thị +15% vàng.',
    cost: 2375,
    researchTime: 45,
  },

  // QUÂN SỰ
  {
    id: 'mil_1',
    branch: 'MILITARY',
    level: 1,
    name: 'Hành Quân Thần Tốc',
    description: 'Tăng 10% tốc độ hành quân của quân đội.',
    cost: 285,
    researchTime: 14,
  },
  {
    id: 'mil_2',
    branch: 'MILITARY',
    level: 2,
    name: 'Kỵ Binh Giáp Nặng',
    description: 'Giảm 8% quân tốn khi chiếm ô, tăng +30 quân tối đa.',
    cost: 855,
    researchTime: 27,
  },
  {
    id: 'mil_3a',
    branch: 'MILITARY',
    level: 3,
    choice: 'A',
    name: 'Phá Núi',
    description: 'Giảm 20% sức phòng thủ ở ô Núi của địch, giảm thêm 5% quân tốn khi chiếm ô.',
    cost: 2375,
    researchTime: 45,
  },
  {
    id: 'mil_3b',
    branch: 'MILITARY',
    level: 3,
    choice: 'B',
    name: 'Hậu Cần',
    description: 'Tăng 10% tốc độ hồi quân mỗi giây, tăng +60 quân tối đa.',
    cost: 2375,
    researchTime: 45,
  },

  // PHÒNG THỦ
  {
    id: 'def_1',
    branch: 'DEFENSE',
    level: 1,
    name: 'Hào Sâu Cọc Nhọn',
    description: 'Tăng 10% sức phòng thủ cho toàn bộ biên giới.',
    cost: 285,
    researchTime: 14,
  },
  {
    id: 'def_2',
    branch: 'DEFENSE',
    level: 2,
    name: 'Tường Đá Hoa Cương',
    description: 'Tăng 18% sức phòng thủ cho toàn bộ biên giới.',
    cost: 855,
    researchTime: 27,
  },
  {
    id: 'def_3a',
    branch: 'DEFENSE',
    level: 3,
    choice: 'A',
    name: 'Trường Thành',
    description: 'Tăng 25% sức phòng thủ biên giới khi kẻ địch tiến công.',
    cost: 2375,
    researchTime: 45,
  },
  {
    id: 'def_3b',
    branch: 'DEFENSE',
    level: 3,
    choice: 'B',
    name: 'Lá Chắn Trời',
    description: 'Phòng Không (SAM) đánh hạ tên lửa Atom/Hydro 90%, tầm bảo vệ 6 ô, phòng thủ biên giới +18%.',
    cost: 2375,
    researchTime: 45,
  },
];

export const REAL_NATION_NAMES: string[] = [
  "Việt Nam", "Nhật Bản", "Hàn Quốc", "Trung Quốc", "Hoa Kỳ", "Anh Quốc", "Pháp", "Đức", "Ý", "Tây Ban Nha",
  "Bồ Đào Nha", "Nga", "Brazil", "Argentina", "Úc", "Ấn Độ", "Thái Lan", "Singapore", "Indonesia", "Malaysia",
  "Thụy Sĩ", "Hà Lan", "Bỉ", "Thụy Điển", "Na Uy", "Đan Mạch", "Phần Lan", "Ai Cập", "Nam Phi", "Canada",
  "Mexico", "Colombia", "Chile", "Peru", "Hy Lạp", "Thổ Nhĩ Kỳ", "Ả Rập Xê Út", "UAE", "Qatar", "Iran",
  "Iraq", "Israel", "Áo", "Ba Lan", "Hung-ga-ri", "Tiệp Khắc", "Romania", "Bulgaria", "Serbia", "Croatia",
  "Slovenia", "Slovakia", "Ukraine", "Belarus", "Kazakhstan", "Uzbekistan", "Mông Cổ", "Nepal", "Sri Lanka", "Bangladesh",
  "Myanmar", "Lào", "Campuchia", "Philippines", "Brunei", "New Zealand", "Fiji", "Cuba", "Jamaica", "Panama",
  "Costa Rica", "Uruguay", "Paraguay", "Bolivia", "Ecuador", "Venezuela", "Kenya", "Nigeria", "Ghana", "Ethiopia",
  "Ma-rốc", "Algeria", "Tunisia", "Zimbabwe", "Senegal", "Bờ Biển Ngà", "Cameroon", "Tanzania", "Madagascar", "Mozambique",
  "Angola", "Zambia", "Uganda", "Rwanda", "Jordan", "Liban", "Oman", "Kuwait", "Bahrain", "Armenia",
  "Georgia", "Azerbaijan", "Ireland", "Iceland", "Luxembourg", "Monaco", "Liechtenstein", "Malta", "Síp", "Estonia",
  "Latvia", "Lithuania", "Moldova", "Albania", "Bắc Macedonia", "Montenegro", "Bosnia", "Kosovo", "San Marino", "Vatican",
  "Andorra", "Micronesia", "Palau", "Samoa", "Tonga", "Vanuatu", "Quần đảo Solomon", "Tuvalu", "Kiribati", "Quần đảo Marshall",
  "Nauru", "Papua New Guinea", "Đông Timor", "Maldives", "Bhutan", "Kyrgyzstan", "Tajikistan", "Turkmenistan", "Seychelles", "Mauritius",
  "Cape Verde", "Sao Tome & Principe", "Comoros", "Djibouti", "Eritrea", "Somalia", "Sudan", "Nam Sudan", "Chad", "Niger",
  "Mali", "Mauritania", "Gambia", "Guinea", "Guinea-Bissau", "Sierra Leone", "Liberia", "Burkina Faso", "Togo", "Benin",
  "Cộng hòa Trung Phi", "Xích Đạo Guinea", "Gabon", "Cộng hòa Congo", "Cộng hòa Dân chủ Congo", "Burundi", "Malawi", "Eswatini", "Lesotho", "Namibia",
  "Botswana", "Suriname", "Guyana", "Bahamas", "Barbados", "Trinidad & Tobago", "Dominica", "Saint Lucia", "Grenada", "Saint Vincent",
  "Antigua & Barbuda", "Saint Kitts & Nevis", "Belize", "Guatemala", "El Salvador", "Honduras", "Nicaragua", "Dominicana", "Haiti", "Bermuda"
];

export const FOREST_COLONY_NAMES: string[] = [
  "Rừng U Minh", "Rừng Cúc Phương", "Rừng Nam Cát Tiên", "Rừng Bạch Mã", "Rừng Phong Nha",
  "Rừng Pù Mát", "Rừng Ba Bể", "Rừng Yok Đôn", "Rừng Bidoup", "Rừng Chư Yang Sin",
  "Rừng Ngọc Linh", "Rừng Tà Đùng", "Rừng Tràm Trà Sư", "Rừng Cần Giờ", "Rừng Hoàng Liên",
  "Rừng Pù Luông", "Đại Ngàn Trường Sơn", "Đại Ngàn Tây Nguyên", "Rừng Già Kon Hà Nừng", "Rừng Xuân Sơn",
  "Rừng Tam Đảo", "Rừng Yên Tử", "Rừng Kẻ Gỗ", "Rừng Vũ Quang", "Rừng Tà Năng",
  "Rừng Amazonia", "Rừng Taiga Phương Bắc", "Rừng Đen Schwarzwald", "Rừng Sherwood", "Rừng Brocéliande",
  "Rừng Ardennes", "Rừng Białowieża", "Rừng Đỏ Sequoia", "Rừng Boreal Yukon", "Rừng Mưa Borneo",
  "Rừng Xanh Lưu Vực", "Rừng Valdivia", "Rừng Sundarbans", "Rừng Daintree", "Rừng Tongass",
  "Rừng Yakushima", "Rừng Aokigahara", "Rừng Hoia Baciu", "Thung Lũng Sương Mù", "Thung Lũng Xanh",
  "Đầm Lầy Cổ Đại", "Cao Nguyên Đá Xám", "Đồi Thông Vi Vu", "Khu Rừng Cấm", "Rừng Già Ngàn Năm",
  "Cánh Rừng Bạch Dương", "Rừng Tuyết Tùng", "Suối Nguồn Rừng Sâu", "Rừng Rậm Nhiệt Đới", "Rừng Sồi Cổ Thụ",
];

export const BUILDING_INFO: Record<Exclude<BuildingType, 'NONE'>, {
  name: string;
  desc: string;
  baseCost: number;
  icon: string;
}> = {
  CITY: {
    name: 'Thành Thị',
    desc: 'Tăng thu nhập vàng và tăng trần dân số.',
    baseCost: 120,
    icon: 'Building2',
  },
  BARRACKS: {
    name: 'Doanh Trại',
    desc: 'Tăng tốc độ sinh quân và tăng giới hạn quân tối đa. Hỗ trợ xây chồng nâng cấp!',
    baseCost: 140,
    icon: 'Swords',
  },
  FORTRESS: {
    name: 'Pháo Đài',
    desc: 'Tăng độ khó chiếm ô trong bán kính 4 ô.',
    baseCost: 90,
    icon: 'Shield',
  },
  BUNKER: {
    name: 'Lô Cốt / Chiến Hào',
    desc: 'Phòng tuyến biên giới chống bộ binh, tăng thủ ô và bắn tỉa quân địch xung quanh (tối đa 10).',
    baseCost: 50,
    icon: 'Shield',
  },
  PORT: {
    name: 'Hải Cảng',
    desc: 'Xây ven biển để quân đội vượt biển đổ bộ. Hỗ trợ xây chồng tăng thu nhập!',
    baseCost: 160,
    icon: 'Anchor',
  },
  MISSILE_SILO: {
    name: 'Bệ Tên Lửa (Silo)',
    desc: 'Bệ phóng tên lửa hạt nhân chiến lược (Atom, Nhiệt Hạch, Hydro, MIRV). Chi phí: 1.000 vàng.',
    baseCost: 1_000,
    icon: 'Rocket',
  },
  AIR_DEFENSE: {
    name: 'Phòng Không (SAM)',
    desc: 'Hệ thống tên lửa đất đối không: 75% cơ hội bắn hạ tên lửa Atom và Hydro của kẻ thù trong tầm bảo vệ!',
    baseCost: 4_000,
    icon: 'ShieldAlert',
  },
  OIL_RIG: {
    name: 'Giàn Khoan Dầu',
    desc: 'Xây trên ô có mỏ dầu để khai thác Dầu.',
    baseCost: 220,
    icon: 'Droplets',
  },
  MINE: {
    name: 'Mỏ Khoáng Sản',
    desc: 'Xây trên ô có mỏ khoáng để khai thác Khoáng sản.',
    baseCost: 200,
    icon: 'Pickaxe',
  },
  LASER: {
    name: 'Tháp Laser Pink',
    desc: 'Tự động quét & bắn tia laser hồng công nghệ cao xung quanh phạm vi mỗi 10s!',
    baseCost: 220,
    icon: 'Zap',
  },
  SUPREME_FORTRESS: {
    name: 'Pháo Đài Tối Thượng',
    desc: 'Giảm 80% sát thương tên lửa nhận vào trong bán kính 8 ô (xây 41s, tối đa 1).',
    baseCost: 22_500,
    icon: 'Shield',
  },
  GRAND_ACADEMY: {
    name: 'Đại Học Viện',
    desc: 'Tốc độ nghiên cứu công nghệ nhanh gấp đôi khi hoạt động (xây 41s, tối đa 1).',
    baseCost: 27_000,
    icon: 'GraduationCap',
  },
  GRAND_ARSENAL: {
    name: 'Đại Công Xưởng',
    desc: 'Tăng 40% hồi quân & +25% giới hạn quân; tồn tại đủ 60 giây kết hợp Quân Sự Tối Thượng 3 để mở Máy bay Tiểu đội (Loại 2) & Ném bom (Loại 3).',
    baseCost: 27_000,
    icon: 'Factory',
  },
};

export interface MissileConfigItem {
  id: MissileType;
  name: string;
  cost: number;
  radius: number; // Bán kính nổ (ô)
  mirvCount?: number; // Số đầu đạn con phân tán
  mirvSpreadRadius?: number; // Bán kính phân tán đầu đạn con
  oilCost: number;
  mineralCost: number;
  description: string;
  color: string;
}

export const MISSILE_CONFIG: Record<MissileType, MissileConfigItem> = {
  ATOM: {
    id: 'ATOM',
    name: 'Atom (Nguyên Tử)',
    cost: 3_500, // 3.500 vàng
    oilCost: 40,
    mineralCost: 30,
    radius: 2.1,
    description: 'Bán kính nổ nhỏ, phá hủy công trình và quét sạch quân phòng thủ (nâng cấp mạnh tại Quân Sự Tối Thượng 2).',
    color: '#eab308',
  },
  HYDRO: {
    id: 'HYDRO',
    name: 'Hydro (Nhiệt Hạch)',
    cost: 7_000, // 7.000 vàng
    oilCost: 90,
    mineralCost: 70,
    radius: 5.4,
    description: 'Bán kính nổ khổng lồ, xóa sổ hoàn toàn căn cứ và quét sạch lãnh thổ đối phương! Nâng cấp bởi Quân Sự Tối Thượng 1: để lại Vùng Cháy.',
    color: '#f97316',
  },
  MIRV: {
    id: 'MIRV',
    name: 'MIRV (Đa Đầu Đạn)',
    cost: 50_000, // 50.000 vàng
    oilCost: 250,
    mineralCost: 180,
    radius: 2.7,
    mirvCount: 12,
    mirvSpreadRadius: 9.0,
    description: 'Rải 12 đầu đạn hạt nhân lên lãnh thổ đối phương. Không thể bị hệ thống phòng không SAM đánh chặn!',
    color: '#ec4899',
  },
};

export const MISSILE_SETTINGS = {
  SILO_BUILD_COST: 1_000, // Chi phí xây bệ phóng: 1.000 vàng
  COOLDOWN_SECONDS: 30, // Bệ phóng hồi chiêu khoảng 30 giây (hiện màu đỏ)
  DEFAULT_FLIGHT_DURATION_SECONDS: 12, // Thời gian tên lửa bay mặc định là 12 giây tới đích
  SAM_INTERCEPT_CHANCE: 0.75, // 75% cơ hội bắn hạ Atom và Hydro
  SAM_INTERCEPT_RANGE: 5.0, // Tầm bảo vệ của trạm phòng không SAM (5 ô)
};

export const DARK_TITAN_CONFIG = {
  SPAWN_TIME_SECONDS: 900,
  SPAWN_WARNING_SECONDS: 10,
  DURATION_SECONDS: 300,
  WARNING_BEFORE_DESPAWN: 30,
  MOVE_INTERVAL_SECONDS: 3,
  DAMAGE_TROOPS: 185,
  Q_DAMAGE_TROOPS: 138,
  E_DAMAGE_TROOPS: 92,
  W_WAVE_LOSS_RATIO: 0.135,
  ULT_TROOP_LOSS_RATIO: 0.40,
  ULT_MAX_TROOP_LOSS_RATIO: 0.65,
  POST_ULT_PAUSE_SECONDS: 4,
  MAX_HP: 5000,
  BOUNTY_GOLD: 5600,
  BUFF_DURATION_SECONDS: 180,
  BUFF_MULTIPLIER: 1.20,
  Q_COOLDOWN: 6.7,
  W_COOLDOWN: 12.2,
  E_COOLDOWN: 15.6,
  ULT_COOLDOWN: 27,
  ULT_CHARGE_SECONDS: 3,
  RAGE_HP_RATIO: 0.5,
  ULT_RADIUS: 9,
  RESPAWN_COOLDOWN_SECONDS: 180,
  POWER_REF: 6000,
  TIME_REF_SECONDS: 2400,
  HP_GROW: { EASY: 1.8, NORMAL: 3.4, HARD: 5.0, EXTREME: 6.5 } as Record<string, number>,
  DMG_GROW: { EASY: 0.45, NORMAL: 0.7, HARD: 0.95, EXTREME: 1.25 } as Record<string, number>,
  TIER_NAMES: ['Sơ Khai', 'Hắc Ám', 'Hủy Diệt'],
};

export interface GeneralRosterItem {
  name: string;
  skillId: GeneralSkillId;
  skillName: string;
  description: string;
  duration: number; // giây hiệu ứng
  cooldown: number; // giây hồi chiêu
  emoji: string;
  unlockType: 'DEFAULT' | 'LEVEL' | 'PURCHASE';
  unlockLevel?: number;
  price?: number;
}

export const GENERAL_ROSTER: GeneralRosterItem[] = [
  {
    name: 'Đại Tướng Hắc Phong',
    skillId: 'INSPIRE_AURA',
    skillName: 'Hào Quang Khích Lệ',
    description: 'Mọi đợt quân đang hành quân tăng tốc độ +50% trong 10 giây.',
    duration: 10,
    cooldown: 60,
    emoji: '📯',
    unlockType: 'DEFAULT',
  },
  {
    name: 'Đại Tướng Thiết Bích',
    skillId: 'IRON_BORDER_SHIELD',
    skillName: 'Khiên Sắt Biên Giới',
    description: 'Tất cả ô biên giới của quốc gia nhận +40% phòng thủ trong 12 giây.',
    duration: 12,
    cooldown: 75,
    emoji: '🛡️',
    unlockType: 'LEVEL',
    unlockLevel: 5,
  },
  {
    name: 'Đại Tướng Kim Ưng',
    skillId: 'SUPPLY_REINFORCE',
    skillName: 'Mật Lệnh Tiếp Tế',
    description: 'Ngay lập tức bổ sung 20% max quân và +10% vàng hiện có.',
    duration: 0,
    cooldown: 80,
    emoji: '🦅',
    unlockType: 'PURCHASE',
    price: 200,
  },
  {
    name: 'Đại Tướng Dạ Ảnh',
    skillId: 'SHADOW_RAID',
    skillName: 'Đột Kích Bóng Đêm',
    description: 'Trong 8 giây, mọi đợt quân chiếm ô tốn ít hơn 50% quân và bỏ qua phòng thủ địch.',
    duration: 8,
    cooldown: 70,
    emoji: '🌙',
    unlockType: 'PURCHASE',
    price: 300,
  },
  {
    name: 'Đại Tướng Hỏa Long',
    skillId: 'MISSILE_BARRAGE',
    skillName: 'Mưa Tên Lửa Chiến Thuật',
    description: 'Bắn 5 quả tên lửa nhỏ quét sạch quân và dọn đường biên giới địch (Tốn 150 vàng).',
    duration: 0,
    cooldown: 90,
    emoji: '🚀',
    unlockType: 'LEVEL',
    unlockLevel: 10,
  },
];

export const RESOURCE_CONFIG = {
  OIL_DENSITY: 0.004,
  MINERAL_DENSITY: 0.0075,
  SEA_OIL_RATIO_OF_LAND: 0.95,
  SEA_OIL_RESERVE_SMALL: 1800,
  SEA_OIL_RESERVE_MEDIUM: 4500,
  SEA_OIL_RESERVE_LARGE: 10000,
  SEA_OIL_REGEN_SECONDS: 180,
  HIDDEN_CHANCE: 0.4,
  DISCOVER_CHANCE_PER_SEC: 0.015,
  RESERVE_SMALL: 1200,
  RESERVE_MEDIUM: 3000,
  RESERVE_LARGE: 7000,
  OIL_RATE: 1.2,
  MINERAL_RATE: 1.5,
  LEVEL_BONUS: 0.5,
  MAX_EXTRACTOR_LEVEL: 3,
  ECONOMY_TECH_BONUS: 0.08,
  STORAGE_CAP: 9999,
  EXTRACTOR_MINERAL_COST: 15,
  BUILDING_MINERAL_COST: { FORTRESS: 10, LASER: 15, MISSILE_SILO: 80, AIR_DEFENSE: 60 } as Record<string, number>,
  CAPTURE_CONDITION: 35,
  REPAIR_GOLD_PER_POINT: 2,
  REPAIR_MINERAL_PER_POINT: 0.3,
  START_STOCK: 60,
  MARKET_OIL_BASE: 6,
  MARKET_MINERAL_BASE: 5,
  MARKET_SELL_RATIO: 0.55,
  MARKET_MIN_MULT: 0.5,
  MARKET_MAX_MULT: 2.5,
  MARKET_PRICE_IMPACT: 0.0006,
  MARKET_TICK_SECONDS: 10,
  MARKET_MAX_TRADE: 500,
};

export const TECH_RESOURCE_COST: Record<string, { oil: number; minerals: number }> = {
  eco_1: { oil: 0, minerals: 0 },
  eco_2: { oil: 0, minerals: 38 },
  eco_3a: { oil: 0, minerals: 114 },
  eco_3b: { oil: 0, minerals: 114 },
  mil_1: { oil: 0, minerals: 0 },
  mil_2: { oil: 29, minerals: 38 },
  mil_3a: { oil: 76, minerals: 114 },
  mil_3b: { oil: 76, minerals: 114 },
  def_1: { oil: 0, minerals: 0 },
  def_2: { oil: 0, minerals: 38 },
  def_3a: { oil: 0, minerals: 114 },
  def_3b: { oil: 19, minerals: 114 },
};

export interface SupremeTechItem {
  id: string;
  branch: TechBranch;
  branchKey: SupremeTechBranch;
  level: 1 | 2 | 3;
  name: string;
  description: string;
  cost: number;
  oilCost: number;
  mineralCost: number;
  researchTime: number;
  isSupreme: true;
}

const SUPREME_LEVEL_COSTS = {
  1: { gold: 14_250, oil: 1_425, minerals: 1_425, researchTime: 54 },
  2: { gold: 23_750, oil: 2_850, minerals: 2_850, researchTime: 68 },
  3: { gold: 38_000, oil: 4_750, minerals: 4_750, researchTime: 81 },
} as const;

export const SUPREME_TECH_EFFECTS = {
  ECONOMY_1_RESOURCE_PROD_BONUS: 0.25, // +25% sản lượng Dầu & Khoáng sản
  ECONOMY_1_GOLD_INCOME_BONUS: 0.05, // +5% thu nhập Vàng
  ECONOMY_2_ADVANCED_EXTRACTOR_LIMIT: 2, // Tối đa 2 Mỏ/Giàn Dầu Cao Cấp
  ECONOMY_3_ADVANCED_EXTRACTOR_LIMIT: 4, // Thêm 2 -> tổng tối đa 4
  ADVANCED_EXTRACTOR_MULT: 1.5, // Sản lượng x1.5
  ADVANCED_EXTRACTOR_MINERAL_COST: 120, // Chi phí nâng cấp bằng Khoáng sản
  MILITARY_1_BURN_ZONE_SECONDS: 15, // Vùng Cháy 15s (10-20s)
  MILITARY_2_ATOM_RADIUS: 6.0, // Bom Atom nâng cấp: bán kính lớn hơn (~x8-10 diện tích & x10 sát thương)
  MILITARY_2_ATOM_TROOP_LOSS: 3500, // x10 sát thương quân (350 -> 3500)
  MILITARY_2_ATOM_SUPER_DAMAGE: 420,
  MILITARY_2_RADIATION_SECONDS: 50, // Vùng Phóng Xạ 50s (40-60s)
  MILITARY_2_RADIATION_RES_PENALTY: 0.75, // Giảm mạnh sản lượng Dầu & Khoáng (-75%)
  MILITARY_2_RADIATION_GOLD_PENALTY: 0.35, // Giảm mạnh thu nhập Vàng trong vùng phóng xạ (-35%)
  MILITARY_2_RADIATION_REGEN_PENALTY: 0.35, // Chậm hồi quân trong vùng phóng xạ (-35%)
  MILITARY_3_MAX_FIGHTERS: 6, // Tối đa 6 máy bay chiến đấu hoạt động cùng lúc
  MILITARY_3_FIGHTER_GOLD_COST: 500,
  MILITARY_3_FIGHTER_OIL_COST: 32,
  DEFENSE_1_BORDER_DEFENSE_BONUS: 0.25, // +25% phòng thủ ô biên giới
  DEFENSE_2_FORTRESS_RADIUS: 11, // Pháo Đài Tối Thượng: 8 -> 11 ô
  DEFENSE_2_FORTRESS_REDUCTION_ACTIVE: 0.90, // 80% -> 90% (thay thế, không cộng dồn)
  DEFENSE_2_FORTRESS_REDUCTION_DAMAGED: 0.40, // 30% -> 40% khi hư hại
  DEFENSE_3_AUTO_BUNKERS: 4, // Tự xây 4 lô cốt dọc biên giới (3-5)
  DEFENSE_3_MAX_BUNKERS: 10, // Tối đa 10 lô cốt / nước
  DEFENSE_3_BUNKER_WAVE_DAMAGE: 18, // Sát thương bắn tỉa chống bộ binh của Lô Cốt
  SUPREME_MISSILE_PRICE_MULT: 2.0, // Hệ số nhân giá tên lửa sau khi nâng cấp (HYDRO cấp 1, ATOM cấp 2)
};

export const SUPREME_TECH_CONFIG = {
  MAX_LEVEL: 3,
  COSTS_BY_LEVEL: SUPREME_LEVEL_COSTS,
  EFFECTS: SUPREME_TECH_EFFECTS,
  BRANCHES: [
    { key: 'economy' as SupremeTechBranch, branch: 'ECONOMY' as TechBranch, label: 'Kinh Tế' },
    { key: 'military' as SupremeTechBranch, branch: 'MILITARY' as TechBranch, label: 'Quân Sự' },
    { key: 'defense' as SupremeTechBranch, branch: 'DEFENSE' as TechBranch, label: 'Phòng Thủ' },
  ],
  TECHS: [
    // KINH TẾ TỐI THƯỢNG
    {
      id: 'sup_eco_1',
      branch: 'ECONOMY',
      branchKey: 'economy',
      level: 1,
      name: 'Khai Thác Tối Ưu',
      description: 'Sản lượng khai thác Dầu & Khoáng sản +25%, thu nhập Vàng +5%.',
      cost: SUPREME_LEVEL_COSTS[1].gold,
      oilCost: SUPREME_LEVEL_COSTS[1].oil,
      mineralCost: SUPREME_LEVEL_COSTS[1].minerals,
      researchTime: SUPREME_LEVEL_COSTS[1].researchTime,
      isSupreme: true,
    },
    {
      id: 'sup_eco_2',
      branch: 'ECONOMY',
      branchKey: 'economy',
      level: 2,
      name: 'Mỏ / Giàn Dầu Cao Cấp',
      description: 'Nâng cấp tối đa 2 Mỏ Khoáng hoặc Giàn Dầu lên bản Cao Cấp (sản lượng x1.5), tốn Khoáng sản.',
      cost: SUPREME_LEVEL_COSTS[2].gold,
      oilCost: SUPREME_LEVEL_COSTS[2].oil,
      mineralCost: SUPREME_LEVEL_COSTS[2].minerals,
      researchTime: SUPREME_LEVEL_COSTS[2].researchTime,
      isSupreme: true,
    },
    {
      id: 'sup_eco_3',
      branch: 'ECONOMY',
      branchKey: 'economy',
      level: 3,
      name: 'Mở Rộng Cao Cấp',
      description: 'Cho phép nâng cấp thêm 2 Mỏ Khoáng hoặc Giàn Dầu Cao Cấp (tổng tối đa 4 công trình).',
      cost: SUPREME_LEVEL_COSTS[3].gold,
      oilCost: SUPREME_LEVEL_COSTS[3].oil,
      mineralCost: SUPREME_LEVEL_COSTS[3].minerals,
      researchTime: SUPREME_LEVEL_COSTS[3].researchTime,
      isSupreme: true,
    },

    // QUÂN SỰ TỐI THƯỢNG
    {
      id: 'sup_mil_1',
      branch: 'MILITARY',
      branchKey: 'military',
      level: 1,
      name: 'Nâng cấp tên lửa Hydro',
      description: 'Nâng cấp tên lửa Hydro: khi nổ để lại Vùng Cháy thiêu đốt quân địch trong 15 giây.',
      cost: SUPREME_LEVEL_COSTS[1].gold,
      oilCost: SUPREME_LEVEL_COSTS[1].oil,
      mineralCost: SUPREME_LEVEL_COSTS[1].minerals,
      researchTime: SUPREME_LEVEL_COSTS[1].researchTime,
      isSupreme: true,
    },
    {
      id: 'sup_mil_2',
      branch: 'MILITARY',
      branchKey: 'military',
      level: 2,
      name: 'Bom Nguyên Tử Nâng Cấp',
      description: 'Nâng cấp tên lửa Atom sẵn có: sức công phá ~x10 và để lại Vùng Phóng Xạ 50s (đốt quân, giảm mạnh dầu/khoáng/vàng & chậm hồi quân).',
      cost: SUPREME_LEVEL_COSTS[2].gold,
      oilCost: SUPREME_LEVEL_COSTS[2].oil,
      mineralCost: SUPREME_LEVEL_COSTS[2].minerals,
      researchTime: SUPREME_LEVEL_COSTS[2].researchTime,
      isSupreme: true,
    },
    {
      id: 'sup_mil_3',
      branch: 'MILITARY',
      branchKey: 'military',
      level: 3,
      name: 'Không Quân Chiến Đấu',
      description: 'Mở khóa Máy Bay Chiến Đấu (Loại 1): tự quét & đánh ưu tiên, đánh chặn máy bay địch, hồi phục tại Cảng / Siêu Công Trình.',
      cost: SUPREME_LEVEL_COSTS[3].gold,
      oilCost: SUPREME_LEVEL_COSTS[3].oil,
      mineralCost: SUPREME_LEVEL_COSTS[3].minerals,
      researchTime: SUPREME_LEVEL_COSTS[3].researchTime,
      isSupreme: true,
    },

    // PHÒNG THỦ TỐI THƯỢNG
    {
      id: 'sup_def_1',
      branch: 'DEFENSE',
      branchKey: 'defense',
      level: 1,
      name: 'Phòng Thủ Biên Giới',
      description: 'Các ô biên giới của quốc gia nhận +25% chỉ số phòng thủ.',
      cost: SUPREME_LEVEL_COSTS[1].gold,
      oilCost: SUPREME_LEVEL_COSTS[1].oil,
      mineralCost: SUPREME_LEVEL_COSTS[1].minerals,
      researchTime: SUPREME_LEVEL_COSTS[1].researchTime,
      isSupreme: true,
    },
    {
      id: 'sup_def_2',
      branch: 'DEFENSE',
      branchKey: 'defense',
      level: 2,
      name: 'Pháo Đài Tối Thượng Nâng Cấp',
      description: 'Tăng tầm bảo vệ Pháo Đài Tối Thượng lên 11 ô và giảm sát thương tên lửa lên 90% (thay thế mức cũ, không cộng dồn).',
      cost: SUPREME_LEVEL_COSTS[2].gold,
      oilCost: SUPREME_LEVEL_COSTS[2].oil,
      mineralCost: SUPREME_LEVEL_COSTS[2].minerals,
      researchTime: SUPREME_LEVEL_COSTS[2].researchTime,
      isSupreme: true,
    },
    {
      id: 'sup_def_3',
      branch: 'DEFENSE',
      branchKey: 'defense',
      level: 3,
      name: 'Lô Cốt / Chiến Hào',
      description: 'Tự động xây 4 Lô Cốt biên giới và mở khóa xây thêm tối đa 10 Lô Cốt chống bộ binh, tăng phòng thủ ô.',
      cost: SUPREME_LEVEL_COSTS[3].gold,
      oilCost: SUPREME_LEVEL_COSTS[3].oil,
      mineralCost: SUPREME_LEVEL_COSTS[3].minerals,
      researchTime: SUPREME_LEVEL_COSTS[3].researchTime,
      isSupreme: true,
    },
  ] as SupremeTechItem[],
} as const;

export const AIR_SYSTEM_CONFIG = {
  MAX_SORTIES: 5,
  SORTIE_RECHARGE_SECONDS: 25,
  MAX_FLYING_GLOBAL: 12,
  MAX_OWNED_PER_NATION: 12,
  GRAND_ARSENAL_UNLOCK_SECONDS: 60,
  BASE_RECOVERY_SECONDS: 20,
  RETREAT_HP_RATIO: 0.30,
  TROOP_COMMIT_MAX_RATIO: 0.60,
  SHIP_BASE_HP: 300,
  NORMAL_BUILDING_BASE_HP: 100,
  SAM_BASE_DAMAGE: 155,
  SAM_TECH3B_DAMAGE: 210,
  SAM_HIT_CHANCE_BASE: 0.65,
  SAM_HIT_CHANCE_3B: 0.80,
  BOMBER_MAX_CORRIDOR_TILES: 22,
  BOMBER_SMALL_BOMB_SPACING: 3.0,
  BOMBER_TITAN_DAMAGE_MULT: 0.50,
  MAX_PATROL_SECONDS: 45,
} as const;

export const AIR_UNIT_SPECS = {
  FIGHTER: {
    name: 'Chiến Đấu (L1)',
    goldCost: 3_000,
    oilCost: 150,
    troopCost: 50,
    troopCostPerPlane: 50,
    planesPerUnit: 1,
    hp: 300,
    speed: 8.5,
    scanRadius: 14,
    attackRange: 2.2,
    airAttackRange: 4.0,
    attackCooldown: 1.0,
    salvosPerSortie: 5,
    aoeRadius: 2.0,
    troopDamage: 160,
    waveDamageRatio: 0.28,
    minWaveDamage: 20,
    normalBuildingDamage: 45,
    superBuildingDamage: 22,
    shipDamage: 120,
    titanDamage: 150,
    airToAirDamage: 75,
    scorchSeconds: 6,
  },
  SQUADRON: {
    name: 'Tiểu Đội 3x (L2)',
    goldCost: 8_000,
    oilCost: 340,
    troopCost: 150,
    troopCostPerPlane: 50,
    planesPerUnit: 3,
    hp: 260,
    speed: 8.0,
    scanRadius: 14,
    attackRange: 2.2,
    airAttackRange: 3.8,
    attackCooldown: 1.0,
    salvosPerSortie: 4,
    aoeRadius: 2.0,
    troopDamage: 115,
    waveDamageRatio: 0.20,
    minWaveDamage: 15,
    normalBuildingDamage: 30,
    superBuildingDamage: 16,
    shipDamage: 100,
    titanDamage: 105,
    airToAirDamage: 50,
    scorchSeconds: 5,
  },
  BOMBER: {
    name: 'Ném Bom (L3)',
    goldCost: 12_000,
    oilCost: 900,
    troopCost: 120,
    troopCostPerPlane: 120,
    planesPerUnit: 1,
    hp: 420,
    speed: 4.8,
    scanRadius: 0,
    attackRange: 1.5,
    airAttackRange: 0,
    attackCooldown: 0.6,
    salvosPerSortie: 1,
    smallBomb: {
      aoeRadius: 2.0,
      troopDamage: 180,
      waveDamageRatio: 0.30,
      minWaveDamage: 25,
      normalBuildingDamage: 45,
      superBuildingDamage: 25,
      shipDamage: 150,
      titanDamage: 220,
      scorchSeconds: 8,
    },
    terminalBomb: {
      aoeRadius: 4.2,
      troopDamage: 950,
      waveDamageRatio: 0.75,
      minWaveDamage: 120,
      normalBuildingDamage: 100,
      superBuildingDamage: 75,
      shipDamage: 300,
      titanDamage: 1_200,
      scorchSeconds: 15,
    },
  },
} as const;

export const NAVAL_CONFIG = {
  TRADE_SPEED_TILES_PER_SEC: 2.8,
  EXTRACTOR: {
    NAME: 'Tàu Khai Thác',
    GOLD_COST: 315,
    OIL_COST: 27,
    MINERAL_COST: 22,
    BUILD_TIME_SECONDS: 18,
    CANCEL_REFUND_RATIO: 0.5,
    MAX_PER_PORT: 2,
    MAX_PER_NATION: 16,
    BASE_HP: 220,
    SPEED_TILES_PER_SEC: 2.2, // chậm hơn tàu thương (2.8)
    OIL_RATE_PER_SEC: 1.5,
    BASE_OIL_CAPACITY: 60,
    VISION: 5,
  },
  WARSHIP: {
    NAME: 'Tàu Chiến',
    GOLD_COST: 810,
    OIL_COST: 72,
    MINERAL_COST: 54,
    BUILD_TIME_SECONDS: 36,
    CANCEL_REFUND_RATIO: 0.5,
    MAX_PER_PORT: 3,
    MAX_PER_NATION: 12,
    BASE_HP: 600,
    DPS: 30,
    RANGE_TILES: 4,
    VISION_TILES: 9,
    SPEED_TILES_PER_SEC: 3.36, // nhanh hơn tàu thương ~20% (2.8 * 1.2)
    RETREAT_HP_RATIO: 0.3,
    REPAIR_PORT_PCT_PER_SEC: 0.03, // 3% HP/s tại cảng
    REPAIR_SEA_PCT_PER_SEC: 0.005, // 0.5% HP/s trên biển
    REPAIR_SEA_GOLD_PER_HP: 2,     // 2 Vàng/HP khi sửa trên biển
    TROOP_CARRY_RATIO: 0.1,        // 10% quân hiện có (scale theo Part 8)
    DERELICT_CAPTURE_SECONDS: 8,   // 8 giây chiếm tàu vô chủ
    DERELICT_CAPTURE_RANGE: 2.2,
  },
  SEA_CONTROL: {
    CELL_SIZE: 4,
    RADIUS_TILES: 8,
    UPDATE_INTERVAL_SEC: 2,
  },
  FLEET: {
    MAX_SHIPS: 6,
    VISION_BONUS: 2,
  },
  MAX_GLOBAL_NAVAL_SHIPS: 96, // chống lag toàn bản đồ
} as const;

export const GAMEPLAY_RULES = {
  VICTORY_LAND_PERCENT: 70,
  MIN_TERRITORY_FOR_TECH: 15,
  BASE_TILE_TROOP_COST: 5,
  MOUNTAIN_TILE_TROOP_COST: 12,
  SCORCHED_EXTRA_TROOP_COST: 5,
  ROOKIE_BUFF_DURATION_SECONDS: 180,
  ROOKIE_BUFF_MAX_DISCOUNT: 0.30,
  BUILDING_COST_GROWTH: 1.15,
  FORTRESS_RADIUS: 4,
  FORTRESS_BASE_COST: 18,
  FORTRESS_LEVEL_STEP: 8,
  BUNKER_BASE_COST: 14,
  BUNKER_LEVEL_STEP: 4,
  MAX_ALLIANCES: 5,
  TRAITOR_TIMER_SECONDS: 120,
  ALLY_AID_RATIO: 0.30,
} as const;


