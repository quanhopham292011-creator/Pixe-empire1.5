/**
 * Định nghĩa kiểu dữ liệu cho game Pixel Empire
 */

export type TerrainType = 'LAND' | 'WATER' | 'MOUNTAIN' | 'FOREST';
export type BuildingType = 'NONE' | 'CITY' | 'BARRACKS' | 'FORTRESS' | 'PORT' | 'ARTILLERY' | 'MISSILE_SILO' | 'AIR_DEFENSE' | 'LASER';

export type NationPersonality = 'AGGRESSIVE' | 'DEFENSIVE' | 'MERCHANT' | 'OPPORTUNIST';
export type DiplomacyStatus = 'WAR' | 'TRUCE' | 'ALLIANCE';

export type TechBranch = 'ECONOMY' | 'MILITARY' | 'DEFENSE';

export interface TechNode {
  id: string;
  branch: TechBranch;
  level: number;
  name: string;
  description: string;
  cost: number;
  researchTime: number;
}

export interface ResearchingTech {
  techId: string;
  remainingTime: number;
  totalTime: number;
}

export interface Tile {
  x: number;
  y: number;
  terrain: TerrainType;
  owner: number; // 0: Trung lập, 1: Người chơi, 2-6: Bot
  building: BuildingType;
  buildingLevel?: number; // Cấp độ xây chồng công trình (Lv.1, Lv.2, Lv.3...)
  defenseBonus: number;
  isBorder: boolean;
  hasHarborAccess: boolean;
  scorchedTimer?: number; // Đất cháy / nhiễm phóng xạ sau đại chiến (giây)
  missileCooldown?: number; // Đếm ngược hồi chiêu phóng tên lửa (giây)
}

export type SettlementTier = 'TIER_1_FOREST' | 'TIER_2_TRIBE' | 'TIER_3_ETHNIC' | 'PLAYER' | 'BOSS';
export type ColonyCategory = 'FOREST' | 'TRIBE' | 'ETHNIC';
export type GeneralStatus = 'IDLE' | 'MARCHING' | 'INJURED' | 'RECOVERING' | 'FALLEN';
export type GeneralSkillId = 'INSPIRE_AURA' | 'MISSILE_BARRAGE' | 'IRON_BORDER_SHIELD' | 'SUPPLY_REINFORCE' | 'SHADOW_RAID';

export interface General {
  id: string;
  nationId: number;
  name: string;
  status: GeneralStatus;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  combatPowerBonus: number; // 0.30 -> chiếm 30% sức mạnh quân đội / +30% hiệu suất
  reviveTimer: number;
  isDeployedToFront: boolean;
  skillId: GeneralSkillId;
  skillCooldown: number; // giây hồi còn lại
  skillActiveTimer: number; // giây hiệu ứng còn lại
  marchingWaveId?: string;
}

export interface Nation {
  id: number;
  name: string;
  color: string;
  isPlayer: boolean;
  tier?: SettlementTier;
  colonyCategory?: ColonyCategory;
  colonyEvolveTimer?: number; // Dành cho Dân tộc tiến hóa thành Quốc gia
  personality: NationPersonality;
  gold: number;
  goldIncome: number;
  troops: number;
  maxTroops: number;
  population: number; // Dân số quốc gia (mô phỏng dữ liệu nền)
  popRemainder?: number; // Phần dẻ tích lũy tăng trưởng dân số nhỏ hơn 1
  populationCap?: number; // Trần dân số tối đa dựa trên lãnh thổ & Thành Thị
  territoryCount: number;
  isEliminated: boolean;
  capitalX: number;
  capitalY: number;
  hasPort: boolean;
  general?: General; // Mỗi quốc gia có 1 tướng đại diện
  titanBuffTimer?: number; // Đếm ngược Buff Tà Thần (+30% Sức mạnh, Vàng, Dân số trong 180s)
  techLevels: {
    economy: number;
    military: number;
    defense: number;
  };
  diplomacy: {
    [targetId: number]: {
      status: DiplomacyStatus;
      relation: number;
      truceTimer: number;
    };
  };
}

export interface AttackWave {
  id: string;
  fromNation: number;
  toNation: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  troops: number;
  progress: number;
  speed: number;
  hasGeneral?: boolean; // Tướng dẫn dắt đợt tiến công (+30% sức mạnh)
  targetsQueue?: { x: number; y: number }[]; // Danh sách ô sẽ tràn qua
  focusX?: number;
  focusY?: number;
}

export type MissileType = 'ATOM' | 'HYDRO' | 'MIRV';

export interface FlyingMissile {
  id: string;
  type: MissileType;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  progress: number; // 0 đến 1
  speed: number;
  fromNation: number;
  isMirvSub?: boolean;
}

export interface SeaTradeRoute {
  id: string;
  fromNation: number;
  toNation: number;
  fromPortX: number;
  fromPortY: number;
  toPortX: number;
  toPortY: number;
  distanceTiles: number;
  isIntercontinental: boolean;
}

export interface SeaTradeShip {
  id: string;
  routeId: string;
  fromNation: number;
  toNation: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  progress: number; // 0 đến 1
  speed: number;
  cargoGold: number;
  isIntercontinental: boolean;
}

export interface GameParticle {
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  type: 'SPARK' | 'DUST' | 'AURA' | 'FLOAT_TEXT' | 'LASER_BEAM';
  text?: string;
  targetX?: number;
  targetY?: number;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: 'HARVEST' | 'CROP_FAILURE' | 'PLAGUE' | 'REBELLION' | 'DIPLOMACY';
  targetNationId: number;
  timestamp: string;
}

export type GameMode = 'STANDARD' | 'CREATIVE';
export type GameDifficulty = 'EASY' | 'NORMAL' | 'HARD';
export type MapDimension = 64 | 96 | 128;

export type QuestStep = 1 | 2 | 3 | 4 | 5 | 6;

export type WeatherType = 'CLEAR' | 'CLOUDY' | 'RAIN';

export interface WeatherCloudPuff {
  dx: number;
  dy: number;
  w: number;
  h: number;
  alpha: number;
}

export interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  opacity: number;
  type: 'CLOUD' | 'RAIN_DROP';
  puffs?: WeatherCloudPuff[];
}

export interface DarkTitan {
  id?: string;
  isActive: boolean;
  spawnTimestamp: number;
  remainingTime: number; // Thời gian còn lại (giây)
  x: number;
  y: number;
  hp: number; // Máu hiện tại
  maxHp: number; // Máu tối đa
  moveTimer: number;
  hasWarnedDespawn?: boolean;
  cd?: { q: number; w: number; e: number; r: number };
  ultCharge?: number;
  ultX?: number;
  ultY?: number;
  slowTimer?: number;
  rage?: boolean;
}

export interface CoalitionData {
  active: boolean;
  remainingTimer: number; // Thời gian còn lại của Liên Minh (giây)
  cooldownTimer: number; // Thời gian chờ trước khi liên minh mới có thể tái lập
  memberNationIds: number[]; // ID các nước tham gia Liên Minh
  targetSector: { x: number; y: number } | null; // Mục tiêu trọng điểm được liên minh chỉ định đồng loạt tiến công
  lastCoordinationTimer: number;
}

export type HybridMasteryId = 'ECONOMY_MILITARY' | 'ECONOMY_HERO' | 'MILITARY_HERO';

export interface PlayerSkillTree {
  economyLevel: number; // 0 đến 10
  militaryLevel: number; // 0 đến 10
  heroLevel: number; // 0 đến 10
  chosenHybrid: HybridMasteryId | null; // Chỉ được chọn 1 trong 3 mốc kết hợp
}

export interface PlayerProfile {
  level: number;
  exp: number;
  pixelCoins: number;
  purchasedGenerals: GeneralSkillId[];
  selectedGeneral: GeneralSkillId;
  skillPoints: number; // Điểm kỹ năng hiện có
  skillTree: PlayerSkillTree;
}

export interface VictoryReward {
  expGained: number;
  coinsGained: number;
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  oldExp: number;
  newExp: number;
  reqExp: number;
  isMultiplayer: boolean;
  isCreative: boolean;
}

