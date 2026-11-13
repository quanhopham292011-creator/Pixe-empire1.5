import { TechNode, BuildingType, MissileType, GeneralSkillId } from '../types';

export const TECH_TREE: TechNode[] = [
  // KINH TẾ
  {
    id: 'eco_1',
    branch: 'ECONOMY',
    level: 1,
    name: 'Khai Khẩn Điền Trang',
    description: 'Tăng 8% sản lượng vàng từ đất đai và thành thị.',
    cost: 300,
    researchTime: 15,
  },
  {
    id: 'eco_2',
    branch: 'ECONOMY',
    level: 2,
    name: 'Phường Buôn Phồn Hoa',
    description: 'Tăng 15% thu nhập vàng và giảm 8% chi phí xây dựng.',
    cost: 900,
    researchTime: 30,
  },
  {
    id: 'eco_3a',
    branch: 'ECONOMY',
    level: 3,
    choice: 'A',
    name: 'Thương Nhân',
    description: 'Tổng +25% thu nhập vàng, cộng 3 vàng mỗi ô chiếm (tối đa 30 vàng/s).',
    cost: 2500,
    researchTime: 50,
  },
  {
    id: 'eco_3b',
    branch: 'ECONOMY',
    level: 3,
    choice: 'B',
    name: 'Thợ Xây',
    description: 'Thu nhập vàng +15%, giảm thêm 20% giá xây mọi công trình, Thành Thị +15% vàng.',
    cost: 2500,
    researchTime: 50,
  },

  // QUÂN SỰ
  {
    id: 'mil_1',
    branch: 'MILITARY',
    level: 1,
    name: 'Hành Quân Thần Tốc',
    description: 'Tăng 10% tốc độ hành quân của quân đội.',
    cost: 300,
    researchTime: 15,
  },
  {
    id: 'mil_2',
    branch: 'MILITARY',
    level: 2,
    name: 'Kỵ Binh Giáp Nặng',
    description: 'Giảm 8% quân tốn khi chiếm ô, tăng +30 quân tối đa.',
    cost: 900,
    researchTime: 30,
  },
  {
    id: 'mil_3a',
    branch: 'MILITARY',
    level: 3,
    choice: 'A',
    name: 'Phá Núi',
    description: 'Giảm 20% sức phòng thủ ở ô Núi của địch, giảm thêm 5% quân tốn khi chiếm ô.',
    cost: 2500,
    researchTime: 50,
  },
  {
    id: 'mil_3b',
    branch: 'MILITARY',
    level: 3,
    choice: 'B',
    name: 'Hậu Cần',
    description: 'Tăng 10% tốc độ hồi quân mỗi giây, tăng +60 quân tối đa.',
    cost: 2500,
    researchTime: 50,
  },

  // PHÒNG THỦ
  {
    id: 'def_1',
    branch: 'DEFENSE',
    level: 1,
    name: 'Hào Sâu Cọc Nhọn',
    description: 'Tăng 10% sức phòng thủ cho toàn bộ biên giới.',
    cost: 300,
    researchTime: 15,
  },
  {
    id: 'def_2',
    branch: 'DEFENSE',
    level: 2,
    name: 'Tường Đá Hoa Cương',
    description: 'Tăng 18% sức phòng thủ cho toàn bộ biên giới.',
    cost: 900,
    researchTime: 30,
  },
  {
    id: 'def_3a',
    branch: 'DEFENSE',
    level: 3,
    choice: 'A',
    name: 'Trường Thành',
    description: 'Tăng 25% sức phòng thủ biên giới khi kẻ địch tiến công.',
    cost: 2500,
    researchTime: 50,
  },
  {
    id: 'def_3b',
    branch: 'DEFENSE',
    level: 3,
    choice: 'B',
    name: 'Lá Chắn Trời',
    description: 'Phòng Không (SAM) đánh hạ tên lửa Atom/Hydro 90%, tầm bảo vệ 6 ô, phòng thủ biên giới +18%.',
    cost: 2500,
    researchTime: 50,
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
  PORT: {
    name: 'Hải Cảng',
    desc: 'Xây ven biển để quân đội vượt biển đổ bộ. Hỗ trợ xây chồng tăng thu nhập!',
    baseCost: 160,
    icon: 'Anchor',
  },
  MISSILE_SILO: {
    name: 'Bệ Tên Lửa (Silo)',
    desc: 'Bệ phóng tên lửa hạt nhân chiến lược (Atom, Hydro, MIRV). Chi phí: 1.000 vàng.',
    baseCost: 1_000,
    icon: 'Rocket',
  },
  AIR_DEFENSE: {
    name: 'Phòng Không (SAM)',
    desc: 'Hệ thống tên lửa đất đối không: 75% cơ hội bắn hạ tên lửa Atom và Hydro của kẻ thù trong tầm bảo vệ!',
    baseCost: 6_000,
    icon: 'ShieldAlert',
  },
  LASER: {
    name: 'Tháp Laser Pink',
    desc: 'Tự động quét & bắn tia laser hồng công nghệ cao xung quanh phạm vi mỗi 10s!',
    baseCost: 220,
    icon: 'Zap',
  },
};

export interface MissileConfigItem {
  id: MissileType;
  name: string;
  cost: number;
  radius: number; // Bán kính nổ (ô)
  mirvCount?: number; // Số đầu đạn con phân tán
  mirvSpreadRadius?: number; // Bán kính phân tán đầu đạn con
  description: string;
  color: string;
}

export const MISSILE_CONFIG: Record<MissileType, MissileConfigItem> = {
  ATOM: {
    id: 'ATOM',
    name: 'Atom (Nguyên Tử)',
    cost: 3_500, // 3.500 vàng
    radius: 2.1,
    description: 'Bán kính nổ nhỏ, phá hủy toàn bộ công trình và quét sạch quân phòng thủ trong phạm vi.',
    color: '#eab308',
  },
  HYDRO: {
    id: 'HYDRO',
    name: 'Hydro (Nhiệt Hạch)',
    cost: 7_000, // 7.000 vàng
    radius: 5.4,
    description: 'Bán kính nổ khổng lồ, xóa sổ hoàn toàn căn cứ và quét sạch lãnh thổ đối phương thành đất trống!',
    color: '#f97316',
  },
  MIRV: {
    id: 'MIRV',
    name: 'MIRV (Đa Đầu Đạn)',
    cost: 50_000, // 50.000 vàng
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
  DURATION_SECONDS: 300,
  WARNING_BEFORE_DESPAWN: 30,
  MOVE_INTERVAL_SECONDS: 3,
  DAMAGE_TROOPS: 200,
  MAX_HP: 5000,
  BOUNTY_GOLD: 5000,
  BUFF_DURATION_SECONDS: 180,
  Q_COOLDOWN: 6,
  W_COOLDOWN: 11,
  E_COOLDOWN: 14,
  ULT_COOLDOWN: 24,
  ULT_CHARGE_SECONDS: 3,
  RAGE_HP_RATIO: 0.5,
  ULT_RADIUS: 9,
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
