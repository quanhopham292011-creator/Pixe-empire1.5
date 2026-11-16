/**
 * Định nghĩa kiểu dữ liệu cho game Pixel Empire
 */

export type TerrainType = 'LAND' | 'WATER' | 'MOUNTAIN' | 'FOREST';
export type BuildingType = 'NONE' | 'CITY' | 'BARRACKS' | 'FORTRESS' | 'BUNKER' | 'PORT' | 'MISSILE_SILO' | 'AIR_DEFENSE' | 'LASER' | 'OIL_RIG' | 'MINE' | 'SUPREME_FORTRESS' | 'GRAND_ACADEMY' | 'GRAND_ARSENAL';
export type SuperBuildingType = 'SUPREME_FORTRESS' | 'GRAND_ACADEMY' | 'GRAND_ARSENAL';
export type SuperBuildingState = 'BUILDING' | 'ACTIVE' | 'DAMAGED' | 'REPAIRING';

export type NationPersonality = 'AGGRESSIVE' | 'DEFENSIVE' | 'MERCHANT' | 'OPPORTUNIST';
export type DiplomacyStatus = 'WAR' | 'TRUCE' | 'ALLIANCE';

export type TechBranch = 'ECONOMY' | 'MILITARY' | 'DEFENSE';
export type SupremeTechBranch = 'economy' | 'military' | 'defense';

export interface SupremeTechLevels {
  economy: number;
  military: number;
  defense: number;
}

export interface TechNode {
  id: string;
  branch: TechBranch;
  level: number;
  choice?: 'A' | 'B';
  name: string;
  description: string;
  cost: number;
  researchTime: number;
  isSupreme?: boolean;
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
  inactiveTimer?: number; // giây còn lại trước khi công trình vừa chiếm hoạt động
  deposit?: DepositType;
  reserve?: number;
  reserveMax?: number;
  discovered?: boolean;
  seaOilRegenTimer?: number;
  condition?: number;
  resOwner?: number;
  superState?: SuperBuildingState;
  superBuildTimeLeft?: number;
  superBuildTotal?: number;
  superHp?: number;
  superMaxHp?: number;
  isAdvancedExtractor?: boolean;
  burnZoneTimer?: number;
  burnZoneOwner?: number;
  radiationTimer?: number;
  radiationOwner?: number;
  buildingHp?: number; // Máu công trình thường (mặc định 100 khi bị không kích)
}

export type DepositType = 'OIL' | 'MINERAL';

export interface MarketState {
  oilPrice: number;
  mineralPrice: number;
  oilHistory: number[];
  mineralHistory: number[];
  timer: number;
}

export type SettlementTier = 'TIER_1_FOREST' | 'TIER_2_TRIBE' | 'TIER_3_ETHNIC' | 'PLAYER' | 'BOSS';
export type ColonyCategory = 'FOREST' | 'TRIBE' | 'ETHNIC';
export type GeneralStatus = 'IDLE' | 'MARCHING' | 'INJURED' | 'RECOVERING' | 'FALLEN';
export type GeneralSkillId = 'INSPIRE_AURA' | 'MISSILE_BARRAGE' | 'IRON_BORDER_SHIELD' | 'SUPPLY_REINFORCE' | 'SHADOW_RAID';
export type GeneralHealthState = 'HEALTHY' | 'INJURED' | 'RECOVERING';
export type GeneralRole = 'ACTIVE' | 'RESERVE' | 'CAPTIVE';
export type GeneralBehavior = 'ATTACK' | 'DEFEND' | 'PROTECT' | 'RETREAT' | 'RECOVER';
export type GeneralStyle = 'WARRIOR' | 'GUARDIAN' | 'COMMANDER' | 'STRATEGIST';
export type GeneralLoyaltyState = 'TRUNG_THANH' | 'BAT_MAN' | 'NGUY_CO_PHAN_BOI';

export interface GeneralEvolutionStats {
  damageDealt: number; // Sát thương gây ra (thiên về WARRIOR)
  damageAbsorbed: number; // Sát thương gánh đỡ cho quân (thiên về GUARDIAN)
  wavesLed: number; // Đợt quân chỉ huy thành công & kích hoạt skill (thiên về COMMANDER)
  tacticalCaptures: number; // Chiếm giữ mục tiêu chiến lược / diệt Tà Thần (thiên về STRATEGIST)
}

export interface General {
  id: string;
  nationId: number;
  name: string;
  status: GeneralStatus;
  role: GeneralRole; // 'ACTIVE' | 'RESERVE' | 'CAPTIVE'
  healthState: GeneralHealthState; // 'HEALTHY' | 'INJURED' | 'RECOVERING'
  behavior?: GeneralBehavior; // Pixel Empire 1.3: Adaptive General AI (ATTACK, DEFEND, PROTECT, RETREAT, RECOVER)
  style?: GeneralStyle; // Pixel Empire 1.5: Tiến hóa phong cách vĩnh viễn
  evolutionStats?: GeneralEvolutionStats; // Bộ đếm đóng góp thực tế

  // Hệ thống Chỉ số Chiến đấu & Sinh tồn v1.1
  hp: number; // HP hiện tại (mặc định 1000)
  maxHp: number; // HP tối đa (mặc định 1000, tăng từ level/tech tối đa +25% = 1250)
  baseHp: number; // HP cơ bản (1000)
  armor: number; // Giáp hiện tại (tỉ lệ giảm sát thương 0.20 = 20%, tối đa 60%)
  baseArmor: number; // Giáp cơ bản (0.20 = 20%)
  attack: number; // Sát thương hiện tại (mặc định 90, tăng tối đa +20% = 108)
  baseAttack: number; // Sát thương cơ bản (90)

  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  combatPowerBonus: number; // General System 1.2: Mặc định 0.10 (+10% sức mạnh khi chỉ huy đợt quân wave.hasGeneral)
  reviveTimer: number;
  isDeployedToFront: boolean;
  skillId: GeneralSkillId;
  skillCooldown: number; // giây hồi còn lại
  skillActiveTimer: number; // giây hiệu ứng còn lại
  marchingWaveId?: string;

  // Chuẩn bị tương thích kiến trúc v1.2 (Dự bị, EXP, Loyalty)
  level?: number;
  exp?: number;
  loyalty?: number;
  history?: string[];
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
  oil?: number;
  minerals?: number;
  oilIncome?: number;
  mineralIncome?: number;
  troops: number;
  maxTroops: number;
  population: number; // Dân số quốc gia (mô phỏng dữ liệu nền)
  popRemainder?: number; // Phần dẻ tích lũy tăng trưởng dân số nhỏ hơn 1
  populationCap?: number; // Trần dân số tối đa dựa trên lãnh thổ & Thành Thị
  territoryCount: number;
  isEliminated: boolean;
  capitalX: number;
  capitalY: number;
  capitalCaptured?: boolean; // Thủ đô đã thất thủ (chỉ xử lý bắt tướng 1 lần)
  hasPort: boolean;
  general?: General; // Mỗi quốc gia có tối đa 1 Đại Tướng ACTIVE
  reserveGenerals?: General[]; // Danh sách Đại Tướng dự bị (chuẩn bị v1.2)
  titanBuffTimer?: number; // Đếm ngược Buff Tà Thần (+30% Sức mạnh, Vàng, Dân số trong 180s)
  techLevels: {
    economy: number;
    military: number;
    defense: number;
  };
  techChoices?: {
    economy?: 'A' | 'B';
    military?: 'A' | 'B';
    defense?: 'A' | 'B';
  };
  supremeTechUnlocked?: boolean;
  supremeTechLevels?: SupremeTechLevels;
  supremeResearching?: ResearchingTech | null;
  airSorties?: number; // Số lượt xuất kích Không Quân hiện có (tối đa 5)
  airSortieRegenTimer?: number; // Đếm giây hồi 1 lượt (mỗi 25s)
  grandArsenalTimer?: number; // Số giây Đại Công Xưởng tồn tại (đạt 60s mở Loại 2 & 3)
  grandArsenalDestroyed?: boolean; // Đại Công Xưởng bị phá trước khi mở khóa Loại 2 & 3
  airAdvancedUnlocked?: boolean; // Đã mở khóa vĩnh viễn Loại 2 & 3 (kể cả khi Đại Công Xưởng bị phá)
  lastBomberRoute?: { startX: number; startY: number; endX: number; endY: number }; // Tuyến bay gần nhất của Ném Bom (L3)
  lastSamBuildTime?: number; // Thời điểm xây Phòng Không gần nhất (hồi chiêu 10s)
  diplomacy: {
    [targetId: number]: {
      status: DiplomacyStatus;
      relation: number;
      truceTimer: number;
    };
  };
  allianceInvites: { senderNationId: number; expiryTimer: number }[];
  lastRejectedInviteTimer: { [nationId: number]: number };
  traitorTimer: number; // 2 phút (120s)
  tradeCooldown?: number; // giây chờ giữa 2 lần giao thương với người chơi
  autoTruceState?: {
    dangerTicks: Record<number, number>;
    cooldownUntil: Record<number, number>;
    truceCounts: Record<number, number>;
    prevTerritory: number;
    recentLoss: number;
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
  hasGeneral?: boolean; // Tướng dẫn dắt đợt tiến công (bonus tối đa +10% sức mạnh)
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
  isGeneralBarrage?: boolean;
}

export type AirUnitType = 'FIGHTER' | 'SQUADRON' | 'BOMBER';

export type AirUnitState =
  | 'HANGAR'
  | 'RECOVERING'
  | 'EN_ROUTE'
  | 'COMBAT'
  | 'PATROL'
  | 'RETURNING';

export interface AirUnit {
  id: string;
  nationId: number;
  type: AirUnitType;
  state: AirUnitState;
  squadronId?: string;
  memberIndex?: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  angle?: number;
  hp: number;
  maxHp: number;
  troopCost: number;
  salvosLeft: number;
  maxSalvos: number;
  attackCooldown?: number;
  targetX?: number;
  targetY?: number;
  priorityTargetX?: number;
  priorityTargetY?: number;
  priorityTargetKind?: 'TILE' | 'TITAN' | 'SHIP' | 'WAVE';
  priorityTargetId?: string;
  bomberStartX?: number;
  bomberStartY?: number;
  bomberEndX?: number;
  bomberEndY?: number;
  bomberStartedRun?: boolean;
  bomberDroppedTerminal?: boolean;
  bomberNextDropDist?: number;
  baseX?: number;
  baseY?: number;
  recoveryTimer?: number;
  patrolAnchorX?: number;
  patrolAnchorY?: number;
  patrolAngle?: number;
  sortieActiveSeconds?: number;
  _rx?: number;
  _ry?: number;
}

export interface FighterPlane {
  id: string;
  nationId: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  hp?: number;
  maxHp?: number;
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
  seaDistanceTiles?: number;
  waypoints?: { x: number; y: number }[];
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
  fromCargoGold?: number;
  toCargoGold?: number;
  lastPayoutAt?: number;
  isIntercontinental: boolean;
  hp?: number;
  maxHp?: number;
  waypoints?: { x: number; y: number }[];
  reverseDir?: boolean;
  isEnclosedLocal?: boolean;
  scaleTier?: 1 | 2 | 3;
  ownerNationId?: number;
  derelict?: boolean;
}

export type NavalShipType = 'EXTRACTOR' | 'WARSHIP';

export type NavalShipState =
  | 'IDLE'
  | 'MOVING'
  | 'EXTRACTING'
  | 'PATROL'
  | 'ESCORT'
  | 'ATTACKING'
  | 'RETREATING'
  | 'REPAIRING'
  | 'TRANSPORTING'
  | 'LANDING';

export type WarshipOrder = 'AUTO' | 'MOVE' | 'ATTACK' | 'PATROL' | 'ESCORT' | 'LANDING' | 'RETREAT';

export interface NavalShip {
  id: string;
  type: NavalShipType;
  nationId: number; // 0 = vô chủ / tàu bỏ hoang
  prevNationId?: number;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  speed: number;
  state: NavalShipState;
  scaleTier: 1 | 2 | 3;

  homePortX?: number;
  homePortY?: number;

  waypoints?: { x: number; y: number }[];
  waypointIdx?: number;
  targetX?: number;
  targetY?: number;
  repathCooldown?: number;

  // Tàu Khai Thác
  assignedDepositX?: number;
  assignedDepositY?: number;
  oilCapacity?: number;
  extractedTotal?: number;

  // Tàu Chiến
  dps?: number;
  range?: number;
  vision?: number;
  order?: WarshipOrder;
  patrolX?: number;
  patrolY?: number;
  escortShipId?: string;
  targetShipId?: string;
  attackCooldown?: number;
  isRepairing?: boolean;

  // Chở quân & đổ bộ
  carriedTroops?: number;
  maxTroopCapacity?: number;
  landingTargetX?: number;
  landingTargetY?: number;
  landingCoastX?: number;
  landingCoastY?: number;

  // Hạm đội & chiếm tàu bỏ hoang
  fleetId?: string;
  captureTargetShipId?: string;
  captureProgress?: number;
  derelictTimer?: number;
}

export interface PortBuildQueueItem {
  id: string;
  nationId: number;
  portX: number;
  portY: number;
  shipType: NavalShipType;
  remainingTime: number;
  totalTime: number;
  paidGold: number;
  paidOil: number;
  paidMinerals: number;
}

export interface SeaControlGrid {
  cellSize: number;
  cols: number;
  rows: number;
  owners: number[];
  strengths: number[];
  updatedAtSec: number;
}

export interface InspectedShipRef {
  kind: 'NAVAL' | 'TRADE';
  id: string;
}

export interface NavalAimingState {
  mode: 'MOVE' | 'PATROL' | 'ATTACK' | 'LANDING' | 'FLEET_MOVE' | 'FLEET_PATROL' | 'FLEET_LANDING';
  shipId?: string;
  fleetId?: string;
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
  tradeOfferId?: string;
}

export interface TradeOffer {
  id: string;
  nationId: number;
  nationName: string;
  mode: 'AI_SELL' | 'AI_BUY';
  resource: DepositType;
  qty: number;
  remainingTimer: number;
  eventId: string;
}

export type GameMode = 'STANDARD' | 'CREATIVE';
export type GameDifficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME';
export type MapDimension = 64 | 96 | 128 | 192;

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
  tier?: number;
  dmgScale?: number;
  cdScale?: number;
  moveBonus?: number;
  ultBonus?: number;
  postUltPauseTimer?: number;
}

export interface PendingTitanSpawn {
  id: string;
  x: number;
  y: number;
  remainingSeconds: number;
  totalSeconds: number;
  tier: number;
  hp: number;
  dmgScale: number;
  cdScale: number;
  moveBonus: number;
  ultBonus: number;
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

