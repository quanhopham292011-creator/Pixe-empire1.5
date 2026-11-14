import {
  Tile, Nation, MarketState, DepositType, GameEvent, GameParticle, BuildingType, MissileType, TradeOffer,
} from '../types';
import { RESOURCE_CONFIG, TECH_RESOURCE_COST, BUILDING_INFO, MISSILE_CONFIG } from '../data/gameData';
import { TILE_PIXEL_SIZE, formatGameTime } from './constants';

let resourcesEnabled = true;
export function setResourcesEnabled(v: boolean) { resourcesEnabled = v; }
export function areResourcesEnabled(): boolean { return resourcesEnabled; }

export type ExtractorType = 'OIL_RIG' | 'MINE';
export function extractorFor(dep: DepositType): ExtractorType {
  return dep === 'OIL' ? 'OIL_RIG' : 'MINE';
}
export function isExtractor(b: BuildingType | string): boolean {
  return b === 'OIL_RIG' || b === 'MINE';
}
export function depositName(dep: DepositType): string {
  return dep === 'OIL' ? 'Mỏ Dầu' : 'Mỏ Khoáng';
}

const depositCache = new WeakMap<Tile[][], Tile[]>();
export function getDepositTiles(tiles: Tile[][]): Tile[] {
  let list = depositCache.get(tiles);
  if (!list) {
    list = [];
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < tiles[y].length; x++) {
        if (tiles[y][x].deposit) list.push(tiles[y][x]);
      }
    }
    depositCache.set(tiles, list);
  }
  return list;
}
export function hasAnyDeposit(tiles: Tile[][]): boolean {
  return getDepositTiles(tiles).length > 0;
}

function pickReserve(): { reserve: number; hiddenChance: number } {
  const r = Math.random();
  if (r < 0.6) return { reserve: RESOURCE_CONFIG.RESERVE_SMALL, hiddenChance: RESOURCE_CONFIG.HIDDEN_CHANCE };
  if (r < 0.9) return { reserve: RESOURCE_CONFIG.RESERVE_MEDIUM, hiddenChance: RESOURCE_CONFIG.HIDDEN_CHANCE };
  return { reserve: RESOURCE_CONFIG.RESERVE_LARGE, hiddenChance: 0.6 };
}

function placeDeposit(t: Tile, type: DepositType, reserve: number, discovered: boolean) {
  const jitter = 0.85 + Math.random() * 0.3;
  const amount = Math.round(reserve * jitter);
  t.deposit = type;
  t.reserve = amount;
  t.reserveMax = amount;
  t.discovered = discovered;
  t.condition = 100;
  t.resOwner = t.owner;
}

export function generateDeposits(tiles: Tile[][], nations: Nation[]): void {
  const size = tiles.length;
  const land: Tile[] = [];
  const mountains: Tile[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = tiles[y][x];
      t.deposit = undefined; t.reserve = undefined; t.reserveMax = undefined;
      t.discovered = undefined; t.condition = undefined; t.resOwner = undefined;
      if (t.terrain === 'WATER') continue;
      land.push(t);
      if (t.terrain === 'MOUNTAIN') mountains.push(t);
    }
  }
  if (land.length === 0) return;

  const placed: Tile[] = [];
  const tooClose = (t: Tile) => {
    for (const p of placed) {
      if (Math.abs(p.x - t.x) < 2 && Math.abs(p.y - t.y) < 2) return true;
    }
    return false;
  };
  const pickFrom = (pool: Tile[]): Tile | null => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      if (!t.deposit && t.building === 'NONE' && !tooClose(t)) return t;
    }
    return null;
  };

  const total = size * size;
  const oilCount = Math.max(8, Math.round(total * RESOURCE_CONFIG.OIL_DENSITY));
  const mineralCount = Math.max(8, Math.round(total * RESOURCE_CONFIG.MINERAL_DENSITY));
  const flatLand = land.filter(t => t.terrain !== 'MOUNTAIN');

  for (let i = 0; i < oilCount; i++) {
    const t = pickFrom(flatLand.length ? flatLand : land);
    if (!t) continue;
    const { reserve, hiddenChance } = pickReserve();
    placeDeposit(t, 'OIL', reserve, Math.random() >= hiddenChance);
    placed.push(t);
  }
  for (let i = 0; i < mineralCount; i++) {
    const pool = (mountains.length > 0 && Math.random() < 0.65) ? mountains : land;
    const t = pickFrom(pool);
    if (!t) continue;
    const { reserve, hiddenChance } = pickReserve();
    placeDeposit(t, 'MINERAL', reserve, Math.random() >= hiddenChance);
    placed.push(t);
  }

  nations.forEach(n => {
    if (!n || n.id === 0) return;
    const wantsHome = n.isPlayer || n.tier === 'BOSS' || n.tier === 'PLAYER' || (n.name || '').includes('Phát Triển');
    if (!wantsHome) return;

    const nearby: Tile[] = [];
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const t = tiles[n.capitalY + dy]?.[n.capitalX + dx];
        if (!t || t.terrain === 'WATER' || t.building !== 'NONE') continue;
        if (dx === 0 && dy === 0) continue;
        nearby.push(t);
      }
    }
    const owned = nearby.filter(t => t.owner === n.id);
    for (const type of ['OIL', 'MINERAL'] as DepositType[]) {
      const base = owned.length >= 4 ? owned : nearby;
      const pool = base.filter(t => !t.deposit);
      if (pool.length === 0) continue;
      const t = pool[Math.floor(Math.random() * pool.length)];
      placeDeposit(t, type, RESOURCE_CONFIG.RESERVE_MEDIUM * 0.8, true);
      if (!placed.includes(t)) placed.push(t);
    }
  });

  depositCache.delete(tiles);
}

export function ensureNationResources(n: Nation, startStock: number = RESOURCE_CONFIG.START_STOCK): void {
  if (n.oil === undefined) n.oil = startStock;
  if (n.minerals === undefined) n.minerals = startStock;
  if (n.oilIncome === undefined) n.oilIncome = 0;
  if (n.mineralIncome === undefined) n.mineralIncome = 0;
}
export function initNationResources(nations: Nation[]): void {
  nations.forEach(n => { if (n && n.id !== 0) ensureNationResources(n); });
}

export function createMarket(): MarketState {
  return {
    oilPrice: RESOURCE_CONFIG.MARKET_OIL_BASE,
    mineralPrice: RESOURCE_CONFIG.MARKET_MINERAL_BASE,
    oilHistory: [RESOURCE_CONFIG.MARKET_OIL_BASE],
    mineralHistory: [RESOURCE_CONFIG.MARKET_MINERAL_BASE],
    timer: 0,
  };
}

function clampPrice(price: number, base: number): number {
  return Math.min(base * RESOURCE_CONFIG.MARKET_MAX_MULT, Math.max(base * RESOURCE_CONFIG.MARKET_MIN_MULT, price));
}

export function tickMarket(m: MarketState): void {
  m.timer += 1;
  if (m.timer < RESOURCE_CONFIG.MARKET_TICK_SECONDS) return;
  m.timer = 0;
  const drift = (price: number, base: number) => {
    const pull = (base - price) * 0.08;
    const noise = price * (Math.random() - 0.5) * 0.08;
    return clampPrice(price + pull + noise, base);
  };
  m.oilPrice = drift(m.oilPrice, RESOURCE_CONFIG.MARKET_OIL_BASE);
  m.mineralPrice = drift(m.mineralPrice, RESOURCE_CONFIG.MARKET_MINERAL_BASE);
  m.oilHistory.push(m.oilPrice);
  m.mineralHistory.push(m.mineralPrice);
  if (m.oilHistory.length > 30) m.oilHistory.shift();
  if (m.mineralHistory.length > 30) m.mineralHistory.shift();
}

export function getBuyPrice(m: MarketState, res: DepositType): number {
  return res === 'OIL' ? m.oilPrice : m.mineralPrice;
}
export function getSellPrice(m: MarketState, res: DepositType): number {
  return getBuyPrice(m, res) * RESOURCE_CONFIG.MARKET_SELL_RATIO;
}

export function marketTrade(
  nation: Nation,
  m: MarketState,
  res: DepositType,
  mode: 'BUY' | 'SELL',
  qty: number
): { ok: boolean; message: string } {
  ensureNationResources(nation);
  qty = Math.floor(qty);
  if (qty <= 0) return { ok: false, message: 'Số lượng không hợp lệ.' };
  if (qty > RESOURCE_CONFIG.MARKET_MAX_TRADE) qty = RESOURCE_CONFIG.MARKET_MAX_TRADE;
  const key = res === 'OIL' ? 'oil' : 'minerals';
  const base = res === 'OIL' ? RESOURCE_CONFIG.MARKET_OIL_BASE : RESOURCE_CONFIG.MARKET_MINERAL_BASE;
  const label = res === 'OIL' ? 'Dầu' : 'Khoáng sản';
  const price = getBuyPrice(m, res);

  if (mode === 'BUY') {
    const room = RESOURCE_CONFIG.STORAGE_CAP - (nation[key] || 0);
    if (room <= 0) return { ok: false, message: `Kho ${label} đã đầy.` };
    qty = Math.min(qty, Math.floor(room));
    const cost = Math.ceil(price * qty);
    if (nation.gold < cost) return { ok: false, message: `Thiếu ${cost - Math.floor(nation.gold)} Vàng.` };
    nation.gold -= cost;
    nation[key] = (nation[key] || 0) + qty;
    const next = clampPrice(price * (1 + RESOURCE_CONFIG.MARKET_PRICE_IMPACT * qty), base);
    if (res === 'OIL') m.oilPrice = next; else m.mineralPrice = next;
    return { ok: true, message: `Đã mua ${qty} ${label} với giá ${cost} Vàng.` };
  }

  if ((nation[key] || 0) < qty) return { ok: false, message: `Không đủ ${label} để bán.` };
  const gain = Math.floor(price * RESOURCE_CONFIG.MARKET_SELL_RATIO * qty);
  nation[key] = (nation[key] || 0) - qty;
  nation.gold += gain;
  const next = clampPrice(price * (1 - RESOURCE_CONFIG.MARKET_PRICE_IMPACT * qty), base);
  if (res === 'OIL') m.oilPrice = next; else m.mineralPrice = next;
  return { ok: true, message: `Đã bán ${qty} ${label}, nhận ${gain} Vàng.` };
}

export function getBuildingMineralCost(type: BuildingType | string, existingCount: number): number {
  if (!resourcesEnabled) return 0;
  const base = RESOURCE_CONFIG.BUILDING_MINERAL_COST[type];
  if (!base) return 0;
  return Math.ceil(base * Math.pow(1.1, existingCount));
}

export function getMissileResourceCost(type: MissileType): { oil: number; minerals: number } {
  if (!resourcesEnabled) return { oil: 0, minerals: 0 };
  const cfg = MISSILE_CONFIG[type];
  return { oil: cfg.oilCost, minerals: cfg.mineralCost };
}
export function canAffordMissileResources(nation: Nation, type: MissileType): boolean {
  const c = getMissileResourceCost(type);
  return (nation.oil || 0) >= c.oil && (nation.minerals || 0) >= c.minerals;
}
export function payMissileResources(nation: Nation, type: MissileType): void {
  const c = getMissileResourceCost(type);
  nation.oil = (nation.oil || 0) - c.oil;
  nation.minerals = (nation.minerals || 0) - c.minerals;
}

export function getTechResourceCost(techId: string): { oil: number; minerals: number } {
  if (!resourcesEnabled) return { oil: 0, minerals: 0 };
  return TECH_RESOURCE_COST[techId] || { oil: 0, minerals: 0 };
}

export function getExtractorBuildCost(tile: Tile): { gold: number; minerals: number; isUpgrade: boolean } {
  const type = extractorFor(tile.deposit || 'OIL');
  const base = BUILDING_INFO[type].baseCost;
  const isUpgrade = tile.building === type;
  const lvl = isUpgrade ? (tile.buildingLevel || 1) : 0;
  const mult = isUpgrade ? lvl * 1.5 : 1;
  return {
    gold: Math.floor(base * mult),
    minerals: resourcesEnabled ? Math.ceil(RESOURCE_CONFIG.EXTRACTOR_MINERAL_COST * (isUpgrade ? lvl : 1)) : 0,
    isUpgrade,
  };
}

export function buildOrUpgradeExtractor(tile: Tile, nation: Nation): { ok: boolean; message: string } {
  ensureNationResources(nation);
  if (!tile.deposit) return { ok: false, message: 'Ô này không có mỏ.' };
  if (tile.owner !== nation.id) return { ok: false, message: 'Bạn phải sở hữu ô này.' };
  if (!tile.discovered) return { ok: false, message: 'Mỏ chưa được phát hiện.' };
  if ((tile.reserve || 0) <= 0) return { ok: false, message: 'Mỏ đã cạn kiệt.' };
  const type = extractorFor(tile.deposit);
  if (tile.building !== 'NONE' && tile.building !== type) {
    return { ok: false, message: 'Ô đang có công trình khác. Hãy phá/thay thế trước.' };
  }
  const cost = getExtractorBuildCost(tile);
  if (cost.isUpgrade && (tile.buildingLevel || 1) >= RESOURCE_CONFIG.MAX_EXTRACTOR_LEVEL) {
    return { ok: false, message: 'Đã đạt cấp tối đa.' };
  }
  if (nation.gold < cost.gold) return { ok: false, message: `Thiếu ${cost.gold - Math.floor(nation.gold)} Vàng.` };
  if ((nation.minerals || 0) < cost.minerals) {
    return { ok: false, message: `Thiếu ${cost.minerals - Math.floor(nation.minerals || 0)} Khoáng sản.` };
  }
  nation.gold -= cost.gold;
  nation.minerals = (nation.minerals || 0) - cost.minerals;
  if (cost.isUpgrade) {
    tile.buildingLevel = (tile.buildingLevel || 1) + 1;
  } else {
    tile.building = type;
    tile.buildingLevel = 1;
    tile.condition = 100;
  }
  return { ok: true, message: cost.isUpgrade ? `Đã nâng ${BUILDING_INFO[type].name} lên cấp ${tile.buildingLevel}.` : `Đã xây ${BUILDING_INFO[type].name}.` };
}

export function getRepairCost(tile: Tile): { gold: number; minerals: number } {
  const missing = Math.max(0, 100 - (tile.condition ?? 100));
  return {
    gold: Math.ceil(missing * RESOURCE_CONFIG.REPAIR_GOLD_PER_POINT),
    minerals: resourcesEnabled ? Math.ceil(missing * RESOURCE_CONFIG.REPAIR_MINERAL_PER_POINT) : 0,
  };
}

export function repairExtractor(tile: Tile, nation: Nation): { ok: boolean; message: string } {
  ensureNationResources(nation);
  if (!isExtractor(tile.building) || tile.owner !== nation.id) return { ok: false, message: 'Không thể sửa công trình này.' };
  if ((tile.condition ?? 100) >= 100) return { ok: false, message: 'Công trình đang ở tình trạng tốt.' };
  const cost = getRepairCost(tile);
  if (nation.gold < cost.gold) return { ok: false, message: `Thiếu ${cost.gold - Math.floor(nation.gold)} Vàng.` };
  if ((nation.minerals || 0) < cost.minerals) {
    return { ok: false, message: `Thiếu ${cost.minerals - Math.floor(nation.minerals || 0)} Khoáng sản.` };
  }
  nation.gold -= cost.gold;
  nation.minerals = (nation.minerals || 0) - cost.minerals;
  tile.condition = 100;
  return { ok: true, message: 'Đã sửa chữa xong.' };
}

export function getExtractionRate(tile: Tile, nation: Nation, difficulty: string = 'NORMAL'): number {
  if (!tile.deposit) return 0;
  const lvl = tile.buildingLevel || 1;
  const base = tile.deposit === 'OIL' ? RESOURCE_CONFIG.OIL_RATE : RESOURCE_CONFIG.MINERAL_RATE;
  const techMult = 1 + (nation.techLevels?.economy || 0) * RESOURCE_CONFIG.ECONOMY_TECH_BONUS;
  const cond = (tile.condition ?? 100) / 100;
  const diffMult = nation.isPlayer ? 1 : (difficulty === 'EXTREME' ? 1.25 : difficulty === 'HARD' ? 1.1 : difficulty === 'EASY' ? 0.8 : 1);
  return base * (1 + (lvl - 1) * RESOURCE_CONFIG.LEVEL_BONUS) * techMult * cond * diffMult;
}

export interface ResourceTickData {
  tiles: Tile[][];
  nations: Nation[];
  events: GameEvent[];
  particles: GameParticle[];
  gameTimeSeconds: number;
  market?: MarketState;
  pendingTradeOffer?: TradeOffer | null;
  nextTradeOfferTimer?: number;
}

function pushEvent(data: ResourceTickData, title: string, description: string, nationId: number, type: GameEvent['type'] = 'HARVEST') {
  data.events.unshift({
    id: Math.random().toString(),
    title,
    description,
    type,
    targetNationId: nationId,
    timestamp: formatGameTime(data.gameTimeSeconds),
  });
}

function floatText(data: ResourceTickData, t: Tile, text: string, color: string) {
  data.particles.push({
    x: t.x * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
    y: t.y * TILE_PIXEL_SIZE + TILE_PIXEL_SIZE / 2,
    color, size: 0, life: 50, maxLife: 50, vx: 0, vy: -0.6,
    type: 'FLOAT_TEXT', text,
  });
}

export function tickResources(data: ResourceTickData, difficulty: string): boolean {
  const { nations, tiles } = data;
  nations.forEach(n => { if (n && n.id !== 0) ensureNationResources(n); });
  if (!resourcesEnabled) return false;

  if (!data.market) data.market = createMarket();
  tickMarket(data.market);

  nations.forEach(n => { if (n) { n.oilIncome = 0; n.mineralIncome = 0; } });

  let needRedraw = false;
  const deposits = getDepositTiles(tiles);
  const botTurn = data.gameTimeSeconds % 5 === 0;

  for (const t of deposits) {
    const dep = t.deposit as DepositType;
    const type = extractorFor(dep);

    if (t.resOwner === undefined) t.resOwner = t.owner;

    // Đổi chủ ô đất có mỏ khai thác: công trình khai thác bị hư hại theo CAPTURE_CONDITION
    if (t.owner !== t.resOwner) {
      if (t.resOwner > 0 && t.owner > 0 && isExtractor(t.building)) {
        t.condition = Math.min(t.condition ?? 100, RESOURCE_CONFIG.CAPTURE_CONDITION);
        needRedraw = true;
        if (t.owner === 1) {
          pushEvent(data, `🛢️ Chiếm ${depositName(dep)}`, `Đã chiếm ${BUILDING_INFO[t.building as ExtractorType].name} tại (${t.x}, ${t.y}). Độ bền còn ${t.condition}%, hãy sửa chữa để khai thác tối đa!`, 1, 'HARVEST');
          floatText(data, t, `🔧 Độ bền ${t.condition}%`, '#fbbf24');
        }
      }
      t.resOwner = t.owner;
    }

    // Khám phá mỏ ẩn khi thuộc quyền sở hữu của một quốc gia
    if (!t.discovered && t.owner > 0) {
      if (Math.random() < RESOURCE_CONFIG.DISCOVER_CHANCE_PER_SEC) {
        t.discovered = true;
        needRedraw = true;
        if (t.owner === 1) {
          const label = depositName(dep);
          pushEvent(data, `🔍 Phát hiện ${label}!`, `Tìm thấy ${label} (${Math.round(t.reserve || 0)} trữ lượng) tại (${t.x}, ${t.y})!`, 1, 'HARVEST');
          floatText(data, t, `🔍 ${label}!`, dep === 'OIL' ? '#38bdf8' : '#a78bfa');
        }
      }
    }

    if (!t.discovered || (t.reserve || 0) <= 0) continue;

    // Khai thác tài nguyên nếu đã xây đúng loại công trình khai thác
    if (t.owner > 0 && nations[t.owner] && !nations[t.owner].isEliminated && t.building === type && !(t.inactiveTimer && t.inactiveTimer > 0)) {
      const ownerNation = nations[t.owner];
      const rate = getExtractionRate(t, ownerNation, difficulty);
      const got = Math.min(rate, t.reserve || 0);
      if (got > 0) {
        t.reserve = Math.max(0, (t.reserve || 0) - got);
        if (dep === 'OIL') {
          ownerNation.oil = Math.min(RESOURCE_CONFIG.STORAGE_CAP, (ownerNation.oil || 0) + got);
          ownerNation.oilIncome = (ownerNation.oilIncome || 0) + got;
        } else {
          ownerNation.minerals = Math.min(RESOURCE_CONFIG.STORAGE_CAP, (ownerNation.minerals || 0) + got);
          ownerNation.mineralIncome = (ownerNation.mineralIncome || 0) + got;
        }
        if (t.reserve <= 0) {
          t.reserve = 0;
          needRedraw = true;
          if (t.owner === 1) {
            pushEvent(data, `⚠️ ${depositName(dep)} cạn kiệt`, `Mỏ tại (${t.x}, ${t.y}) đã khai thác hết trữ lượng.`, 1, 'HARVEST');
          }
        }
      }
    }

    // Bot AI tự động sửa / xây / nâng cấp mỏ
    if (botTurn && t.owner > 1) {
      const bot = nations[t.owner];
      if (bot && !bot.isEliminated && bot.colonyCategory !== 'FOREST') {
        if (t.building === type && (t.condition ?? 100) < 60) {
          const r = repairExtractor(t, bot);
          if (r.ok) needRedraw = true;
        } else if (t.building === 'NONE' || (t.building === type && (t.buildingLevel || 1) < RESOURCE_CONFIG.MAX_EXTRACTOR_LEVEL && bot.gold >= 900)) {
          const cost = getExtractorBuildCost(t);
          if (bot.gold >= cost.gold * 1.35 && (bot.minerals || 0) >= cost.minerals) {
            const b = buildOrUpgradeExtractor(t, bot);
            if (b.ok) needRedraw = true;
          }
        }
      }
    }
  }

  // Đếm ngược thời gian chờ giao thương & xử lý lời chào hàng của AI
  for (const n of nations) {
    if (n && n.tradeCooldown && n.tradeCooldown > 0) {
      n.tradeCooldown = Math.max(0, n.tradeCooldown - 1);
    }
  }
  tickAITradeOffers(data);

  return needRedraw;
}

export function formatResource(val?: number): string {
  const v = Math.floor(val || 0);
  if (v >= 100000) return `${Math.floor(v / 1000)}k`;
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

// ============================================================================
// GIAO THƯƠNG GIỮA NGƯỜI CHƠI VÀ CÁC QUỐC GIA AI (DẦU & KHOÁNG SẢN)
// ============================================================================

export const AI_TRADE_MAX_QTY = 200;
export const AI_TRADE_COOLDOWN_SECONDS = 20;
export const AI_TRADE_OFFER_DURATION = 20;

export function countNationDeposits(tiles: Tile[][], nationId: number): { oil: number; mineral: number } {
  const deposits = getDepositTiles(tiles);
  let oil = 0;
  let mineral = 0;
  for (const t of deposits) {
    if (t.owner === nationId && t.discovered && (t.reserve || 0) > 0) {
      if (t.deposit === 'OIL') oil++;
      else if (t.deposit === 'MINERAL') mineral++;
    }
  }
  return { oil, mineral };
}

export function getBotTradeReserve(bot: Nation, res: DepositType, tiles: Tile[][]): number {
  const dep = countNationDeposits(tiles, bot.id);
  const hasMine = res === 'OIL' ? dep.oil > 0 : dep.mineral > 0;
  if (bot.personality === 'MERCHANT') {
    return res === 'OIL' ? 20 : 25;
  }
  if (!hasMine) {
    return res === 'OIL' ? 80 : 90;
  }
  return res === 'OIL' ? 50 : 60;
}

export function getBotDesiredStock(bot: Nation, res: DepositType, tiles: Tile[][]): number {
  const dep = countNationDeposits(tiles, bot.id);
  const hasMine = res === 'OIL' ? dep.oil > 0 : dep.mineral > 0;
  if (!hasMine && bot.personality !== 'MERCHANT') {
    return res === 'OIL' ? 220 : 260;
  }
  if (bot.personality === 'MERCHANT') {
    return res === 'OIL' ? 180 : 200;
  }
  return res === 'OIL' ? 120 : 150;
}

export function getBotSellableSurplus(bot: Nation, res: DepositType, tiles: Tile[][]): number {
  const stock = res === 'OIL' ? (bot.oil || 0) : (bot.minerals || 0);
  const reserve = getBotTradeReserve(bot, res, tiles);
  return Math.max(0, Math.floor(stock - reserve));
}

export function getBotBuyDemand(bot: Nation, res: DepositType, tiles: Tile[][]): number {
  const stock = res === 'OIL' ? (bot.oil || 0) : (bot.minerals || 0);
  const desired = getBotDesiredStock(bot, res, tiles);
  return Math.max(0, Math.floor(desired - stock));
}

export function getAITradePrices(
  player: Nation,
  bot: Nation,
  market: MarketState,
  res: DepositType
): { aiSellPrice: number; aiBuyPrice: number; status: string } {
  const mBuy = getBuyPrice(market, res);
  const mSell = getSellPrice(market, res);
  const dip = player.diplomacy?.[bot.id] || bot.diplomacy?.[player.id] || { status: 'WAR', relation: 0, truceTimer: 0 };
  const relNorm = Math.max(0, Math.min(1, (dip.relation || 0) / 100));
  const isAlly = dip.status === 'ALLIANCE';
  const isMerchant = bot.personality === 'MERCHANT';

  // Giá AI bán cho người chơi (người chơi mua): [0.80 .. 0.96] * giá mua thị trường
  let sellMult = 0.95 - (isAlly ? 0.08 : 0) - relNorm * 0.05 - (isMerchant ? 0.03 : 0);
  sellMult = Math.max(0.80, Math.min(0.96, sellMult));

  // Giá AI mua của người chơi (người chơi bán): [0.60 .. 0.78] * giá mua thị trường
  let buyMult = 0.62 + (isAlly ? 0.08 : 0) + relNorm * 0.05 + (isMerchant ? 0.03 : 0);
  buyMult = Math.max(0.60, Math.min(0.78, buyMult));

  // Đảm bảo tuyệt đối không có chênh lệch kiếm lời với thị trường hoặc giữa các AI
  const aiSellPrice = Math.max(mSell * 1.08, Math.min(mBuy * 0.98, mBuy * sellMult));
  const aiBuyPrice = Math.min(mBuy * 0.92, Math.max(mSell * 1.02, Math.min(aiSellPrice * 0.95, mBuy * buyMult)));

  return { aiSellPrice, aiBuyPrice, status: dip.status };
}

export interface AITradeCheck {
  ok: boolean;
  reason: string;
  qty: number;
  goldAmount: number;
}

export function canTradeWithAI(
  player: Nation,
  bot: Nation,
  market: MarketState,
  tiles: Tile[][],
  res: DepositType,
  mode: 'BUY' | 'SELL',
  rawQty: number
): AITradeCheck {
  const qty = Math.min(AI_TRADE_MAX_QTY, Math.max(1, Math.floor(rawQty)));
  if (!resourcesEnabled) return { ok: false, reason: 'Đang tắt', qty, goldAmount: 0 };
  if (!player || !bot || bot.isEliminated || bot.id <= 1 || bot.colonyCategory === 'FOREST') {
    return { ok: false, reason: 'Không khả dụng', qty, goldAmount: 0 };
  }

  const { aiSellPrice, aiBuyPrice, status } = getAITradePrices(player, bot, market, res);
  if (status === 'WAR') {
    return { ok: false, reason: 'Đang chiến tranh', qty, goldAmount: 0 };
  }
  if ((bot.tradeCooldown || 0) > 0) {
    return { ok: false, reason: `Chờ ${Math.ceil(bot.tradeCooldown!)}s`, qty, goldAmount: 0 };
  }

  const key = res === 'OIL' ? 'oil' : 'minerals';

  if (mode === 'BUY') {
    const cost = Math.max(1, Math.ceil(aiSellPrice * qty));
    const surplus = getBotSellableSurplus(bot, res, tiles);
    if (surplus <= 0) return { ok: false, reason: 'Họ hết hàng', qty, goldAmount: cost };
    if (surplus < qty) return { ok: false, reason: `Chỉ dư ${surplus}`, qty, goldAmount: cost };
    const room = Math.floor(RESOURCE_CONFIG.STORAGE_CAP - (player[key] || 0));
    if (room < qty) return { ok: false, reason: 'Kho bạn đầy', qty, goldAmount: cost };
    if (player.gold < cost) return { ok: false, reason: 'Bạn thiếu vàng', qty, goldAmount: cost };
    return { ok: true, reason: '', qty, goldAmount: cost };
  }

  const gain = Math.max(0, Math.floor(aiBuyPrice * qty));
  const playerStock = Math.floor(player[key] || 0);
  if (playerStock < qty) return { ok: false, reason: 'Bạn thiếu hàng', qty, goldAmount: gain };
  const demand = getBotBuyDemand(bot, res, tiles);
  if (demand <= 0) return { ok: false, reason: 'Họ đủ hàng', qty, goldAmount: gain };
  if (demand < qty) return { ok: false, reason: `Chỉ mua ${demand}`, qty, goldAmount: gain };
  if (bot.gold < gain) return { ok: false, reason: 'Họ thiếu vàng', qty, goldAmount: gain };
  return { ok: true, reason: '', qty, goldAmount: gain };
}

export function tradeWithAI(
  player: Nation,
  bot: Nation,
  market: MarketState,
  tiles: Tile[][],
  res: DepositType,
  mode: 'BUY' | 'SELL',
  rawQty: number
): { ok: boolean; message: string; goldAmount: number; qty: number } {
  ensureNationResources(player);
  ensureNationResources(bot);

  const check = canTradeWithAI(player, bot, market, tiles, res, mode, rawQty);
  if (!check.ok) {
    return { ok: false, message: check.reason, goldAmount: check.goldAmount, qty: check.qty };
  }

  const { qty, goldAmount } = check;
  const key = res === 'OIL' ? 'oil' : 'minerals';
  const label = res === 'OIL' ? 'Dầu' : 'Khoáng';

  if (mode === 'BUY') {
    player.gold = Math.max(0, player.gold - goldAmount);
    bot.gold += goldAmount;
    bot[key] = Math.max(0, (bot[key] || 0) - qty);
    player[key] = Math.min(RESOURCE_CONFIG.STORAGE_CAP, (player[key] || 0) + qty);
  } else {
    player[key] = Math.max(0, (player[key] || 0) - qty);
    bot[key] = Math.min(RESOURCE_CONFIG.STORAGE_CAP, (bot[key] || 0) + qty);
    bot.gold = Math.max(0, bot.gold - goldAmount);
    player.gold += goldAmount;
  }

  bot.tradeCooldown = AI_TRADE_COOLDOWN_SECONDS;

  // Tăng nhẹ quan hệ giữa hai nước
  const relBoost = Math.max(1, Math.min(5, Math.round(qty / 40)));
  if (!player.diplomacy) player.diplomacy = {};
  if (!bot.diplomacy) bot.diplomacy = {};
  if (player.diplomacy[bot.id]) {
    player.diplomacy[bot.id].relation = Math.min(100, (player.diplomacy[bot.id].relation || 0) + relBoost);
  }
  if (bot.diplomacy[player.id]) {
    bot.diplomacy[player.id].relation = Math.min(100, (bot.diplomacy[player.id].relation || 0) + relBoost);
  }

  // Đẩy giá thị trường chung một chút (nhẹ hơn 35% so với giao dịch trực tiếp trên Thị trường)
  const base = res === 'OIL' ? RESOURCE_CONFIG.MARKET_OIL_BASE : RESOURCE_CONFIG.MARKET_MINERAL_BASE;
  const curPrice = getBuyPrice(market, res);
  const dir = mode === 'BUY' ? 1 : -1;
  const next = clampPrice(curPrice * (1 + dir * RESOURCE_CONFIG.MARKET_PRICE_IMPACT * 0.35 * qty), base);
  if (res === 'OIL') market.oilPrice = next; else market.mineralPrice = next;

  const msg = mode === 'BUY'
    ? `Đã mua ${qty} ${label} từ ${bot.name} (-${goldAmount}💰, +${relBoost} quan hệ)`
    : `Đã bán ${qty} ${label} cho ${bot.name} (+${goldAmount}💰, +${relBoost} quan hệ)`;

  return { ok: true, message: msg, goldAmount, qty };
}

function randomOfferCooldown(): number {
  return 90 + Math.floor(Math.random() * 31); // 90 đến 120 giây
}

export function tickAITradeOffers(data: ResourceTickData): void {
  const { nations, tiles } = data;
  const player = nations[1];
  if (!player || player.isEliminated || !resourcesEnabled) {
    data.pendingTradeOffer = null;
    return;
  }
  const market = data.market;
  if (!market) return;

  // Cập nhật lời chào đang chờ (hết hạn sau 20s hoặc hủy nếu chuyển sang chiến tranh)
  if (data.pendingTradeOffer) {
    const offer = data.pendingTradeOffer;
    const bot = nations[offer.nationId];
    const dipStatus = player.diplomacy?.[offer.nationId]?.status || 'WAR';
    if (!bot || bot.isEliminated || dipStatus === 'WAR') {
      data.pendingTradeOffer = null;
      data.nextTradeOfferTimer = randomOfferCooldown();
      return;
    }
    offer.remainingTimer -= 1;
    if (offer.remainingTimer <= 0) {
      data.pendingTradeOffer = null;
      data.nextTradeOfferTimer = randomOfferCooldown();
    }
    return;
  }

  if (data.nextTradeOfferTimer === undefined) {
    data.nextTradeOfferTimer = randomOfferCooldown();
  }
  data.nextTradeOfferTimer -= 1;
  if (data.nextTradeOfferTimer > 0) return;

  data.nextTradeOfferTimer = randomOfferCooldown();

  // Chọn 1 lời chào mua/bán nhỏ từ các nước không đang chiến tranh (ưu tiên MERCHANT)
  const candidates: {
    bot: Nation;
    mode: 'AI_SELL' | 'AI_BUY';
    resource: DepositType;
    qty: number;
    weight: number;
  }[] = [];

  for (const bot of nations) {
    if (!bot || bot.id <= 1 || bot.isEliminated || bot.colonyCategory === 'FOREST') continue;
    if ((bot.tradeCooldown || 0) > 0) continue;
    const dip = player.diplomacy?.[bot.id]?.status || 'WAR';
    if (dip === 'WAR') continue;

    const w = bot.personality === 'MERCHANT' ? 3 : 1;
    for (const res of ['OIL', 'MINERAL'] as DepositType[]) {
      const surplus = getBotSellableSurplus(bot, res, tiles);
      if (surplus >= 10) {
        const qty = surplus >= 50 ? 50 : Math.floor(surplus / 10) * 10;
        const chk = canTradeWithAI(player, bot, market, tiles, res, 'BUY', qty);
        if (chk.ok) {
          candidates.push({ bot, mode: 'AI_SELL', resource: res, qty, weight: w });
        }
      }

      const demand = getBotBuyDemand(bot, res, tiles);
      if (demand >= 10) {
        const qty = demand >= 50 ? 50 : Math.floor(demand / 10) * 10;
        const chk = canTradeWithAI(player, bot, market, tiles, res, 'SELL', qty);
        if (chk.ok) {
          candidates.push({ bot, mode: 'AI_BUY', resource: res, qty, weight: w });
        }
      }
    }
  }

  if (candidates.length === 0) return;

  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * totalWeight;
  let picked = candidates[0];
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) {
      picked = c;
      break;
    }
  }

  const offerId = `offer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const eventId = Math.random().toString();
  const prices = getAITradePrices(player, picked.bot, market, picked.resource);
  const goldAmt = picked.mode === 'AI_SELL'
    ? Math.max(1, Math.ceil(prices.aiSellPrice * picked.qty))
    : Math.max(0, Math.floor(prices.aiBuyPrice * picked.qty));
  const resLabel = picked.resource === 'OIL' ? '🛢️ Dầu' : '⛏️ Khoáng';

  data.pendingTradeOffer = {
    id: offerId,
    nationId: picked.bot.id,
    nationName: picked.bot.name,
    mode: picked.mode,
    resource: picked.resource,
    qty: picked.qty,
    remainingTimer: AI_TRADE_OFFER_DURATION,
    eventId,
  };

  data.events.unshift({
    id: eventId,
    title: picked.mode === 'AI_SELL' ? '📦 Lời Chào Bán Tài Nguyên' : '📦 Lời Chào Mua Tài Nguyên',
    description: picked.mode === 'AI_SELL'
      ? `${picked.bot.name} chào bán ${picked.qty} ${resLabel} với giá ${goldAmt} Vàng (hết hạn sau ${AI_TRADE_OFFER_DURATION}s).`
      : `${picked.bot.name} muốn mua ${picked.qty} ${resLabel} của bạn với giá ${goldAmt} Vàng (hết hạn sau ${AI_TRADE_OFFER_DURATION}s).`,
    type: 'DIPLOMACY',
    targetNationId: picked.bot.id,
    timestamp: formatGameTime(data.gameTimeSeconds),
    tradeOfferId: offerId,
  });
  if (data.events.length > 50) data.events.length = 50;
}
