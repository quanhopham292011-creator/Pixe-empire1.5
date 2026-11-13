// Hệ thống meme nhỏ: hiện sticker mèo pixel + câu thoại ngắn khi có tương tác ngoại giao / boss.
// Muốn đổi câu thoại cho kịp trend: chỉ cần sửa mảng `captions` bên dưới.
import { SPRITES } from './memeSprites';

export type MemeId =
  | 'ALLY_EQUAL' | 'ALLY_STRONGER' | 'ALLY_WEAKER'
  | 'TRUCE' | 'BETRAY'
  | 'WAR_EVEN' | 'WAR_STRONGER' | 'WAR_WEAKER'
  | 'GOLD_AID' | 'TROOP_AID' | 'AID_THANKS' | 'AID_FAIL'
  | 'COALITION'
  | 'TITAN_SPAWN' | 'TITAN_GONE' | 'TITAN_RAGE'
  | 'BOSS_INCOMING' | 'ATTACK_BOSS'
  | 'ELIMINATED';

export interface MemeDef {
  sprite: keyof typeof SPRITES;
  tag: string;          // nhãn nhỏ phía trên câu thoại
  captions: string[];   // chọn ngẫu nhiên 1 câu
  color: string;        // màu viền sticker
  cooldownMs?: number;  // chống spam cùng 1 meme
}

export const MEME_DEFS: Record<MemeId, MemeDef> = {
  ALLY_EQUAL: {
    sprite: 'SHAKE', tag: 'NGANG CƠ', color: '#34d399', cooldownMs: 4000,
    captions: ['Bắt tay nào bro 🤝', 'Ngang cơ nhau, kết thân đi 🤝', 'Deal chứ? Đưa tay đây 🤝'],
  },
  ALLY_STRONGER: {
    sprite: 'BEG', tag: 'NƯỚC MẠNH HƠN', color: '#60a5fa', cooldownMs: 4000,
    captions: ['Đại ca ơi, nhận em làm đồng minh 🥺', 'Cho em ôm đùi xíu thôi mà 🥺', 'Anh mạnh quá, em xin theo 🥺'],
  },
  ALLY_WEAKER: {
    sprite: 'PROTECT', tag: 'NƯỚC YẾU HƠN', color: '#fbbf24', cooldownMs: 4000,
    captions: ['Yên tâm, có anh bảo kê 😎', 'Theo anh, anh lo hết 😎', 'Em nhỏ cứ tựa vào anh 😎'],
  },
  TRUCE: {
    sprite: 'TEA', tag: 'ĐÌNH CHIẾN', color: '#38bdf8', cooldownMs: 4000,
    captions: ['Bình tĩnh, uống miếng trà đã ☕', 'Đình chiến rồi, chill thôi ☕', 'Drama tạm nghỉ, ăn bắp rang đi ☕'],
  },
  BETRAY: {
    sprite: 'BETRAY', tag: 'PHẢN BỘI', color: '#f87171', cooldownMs: 4000,
    captions: ['Trust me bro 🔪', 'Đồng minh là để… đâm sau lưng 🔪', 'Xin lỗi, business thôi 🔪'],
  },
  WAR_EVEN: {
    sprite: 'LOCKIN', tag: 'TUYÊN CHIẾN', color: '#ef4444', cooldownMs: 4000,
    captions: ['Lock in. Chiến thôi 🔥', 'Hết đường nói chuyện, vào việc 🔥'],
  },
  WAR_STRONGER: {
    sprite: 'COOKED', tag: 'ĐÁNH NƯỚC MẠNH', color: '#fb923c', cooldownMs: 4000,
    captions: ['Toang rồi, cooked 💀', 'Chọc nước mạnh hơn? Cooked thật sự 🔥', 'Tự tin quá, giờ tính sao? 💀'],
  },
  WAR_WEAKER: {
    sprite: 'SMUG', tag: 'ĐÁNH NƯỚC YẾU', color: '#a78bfa', cooldownMs: 4000,
    captions: ['Skill issue 🤷', 'Chọn đúng đối thủ rồi đó 😏', 'Nhẹ nhàng thôi, đừng khóc nha 😏'],
  },
  GOLD_AID: {
    sprite: 'GOLD', tag: 'VIỆN TRỢ', color: '#fbbf24', cooldownMs: 3000,
    captions: ['Ting ting! +1000 aura 💸', 'Ví nhẹ đi, aura nặng thêm 💸', 'Chi mạnh tay, ra dáng đại gia 💸'],
  },
  TROOP_AID: {
    sprite: 'SALUTE', tag: 'TIẾP VIỆN', color: '#38bdf8', cooldownMs: 3000,
    captions: ['Quân tiếp tế đã tới 🪖', 'Ráng lên đồng đội ơi 🪖', 'Anh em có nhau, không bỏ ai lại 🪖'],
  },
  AID_THANKS: {
    sprite: 'THANKS', tag: 'NHẬN VIỆN TRỢ', color: '#34d399', cooldownMs: 3000,
    captions: ['Cảm ơn sếp, sếp là nhất 🥺', 'Quá chill, đồng minh xịn quá 🥺'],
  },
  AID_FAIL: {
    sprite: 'HUH', tag: 'KHÔNG ĐƯỢC', color: '#94a3b8', cooldownMs: 3000,
    captions: ['Hả? Hết tiền rồi à? 🐱', 'Nghèo quá, hỏi chi nữa 🐱'],
  },
  COALITION: {
    sprite: 'COOKED', tag: 'CẢ THẾ GIỚI CHỐNG LẠI', color: '#ef4444', cooldownMs: 20000,
    captions: ['Cả server vs mình… cooked thật rồi 💀', 'Mạnh quá nên bị cả thế giới gank 💀'],
  },
  TITAN_SPAWN: {
    sprite: 'SCREAM', tag: 'BOSS XUẤT HIỆN', color: '#a855f7', cooldownMs: 15000,
    captions: ['Tà Thần xuất hiện! CHẠY ĐI 😱', 'Final boss tới rồi, ai cứu em 😱'],
  },
  TITAN_GONE: {
    sprite: 'PHEW', tag: 'BOSS BIẾN MẤT', color: '#34d399', cooldownMs: 15000,
    captions: ['Phù… sống sót rồi 😮', 'Tưởng toang, hóa ra qua màn 😮'],
  },
  TITAN_RAGE: {
    sprite: 'COOKED', tag: 'BOSS CUỒNG NỘ', color: '#f97316', cooldownMs: 15000,
    captions: ['Boss nổi điên rồi, cooked 🔥', 'Dưới 50% máu là hết đùa nha 🔥'],
  },
  BOSS_INCOMING: {
    sprite: 'PLAYDEAD', tag: 'BOSS ĐANG TỚI', color: '#ef4444', cooldownMs: 40000,
    captions: ['Boss tới rồi, giả chết đi 💀', 'Im lặng… nó chưa thấy mình 💀'],
  },
  ATTACK_BOSS: {
    sprite: 'LOCKIN', tag: 'ĐÁNH BOSS', color: '#f59e0b', cooldownMs: 25000,
    captions: ['Dám đấm boss? Máu liều thật 🥊', 'Lock in, boss nào cũng ngã 🥊'],
  },
  ELIMINATED: {
    sprite: 'SMUG', tag: 'OUT TRÌNH', color: '#a78bfa', cooldownMs: 15000,
    captions: ['Một nước đã rời bàn chơi 👋', 'Bye bye, hẹn gặp ván sau 👋'],
  },
};

export interface MemeEventDetail {
  uid: number;
  id: MemeId;
  caption: string;
  def: MemeDef;
}

const MEME_EVENT = 'pixel-meme';
const STORAGE_KEY = 'pixelMemesEnabled';
const lastShown: Partial<Record<MemeId, number>> = {};
let lastAnyShown = 0;
let uidCounter = 1;

export function isMemesEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== '0'; } catch { return true; }
}

export function setMemesEnabled(enabled: boolean): void {
  try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch { /* bỏ qua */ }
}

/** Tỉ lệ sức mạnh của nước kia so với mình (theo số ô đất). >1 nghĩa là nước kia mạnh hơn. */
export function strengthRatio(me: { territoryCount?: number }, other: { territoryCount?: number }): number {
  return Math.max(1, other.territoryCount || 1) / Math.max(1, me.territoryCount || 1);
}

/** Chọn meme liên minh theo chênh lệch sức mạnh. */
export function allianceMemeFor(me: any, other: any): MemeId {
  const r = strengthRatio(me, other);
  if (r > 1.4 || other?.tier === 'BOSS') return 'ALLY_STRONGER';
  if (r < 0.7) return 'ALLY_WEAKER';
  return 'ALLY_EQUAL';
}

/** Chọn meme tuyên chiến. */
export function warMemeFor(me: any, other: any, wasAlly: boolean): MemeId {
  if (wasAlly) return 'BETRAY';
  const r = strengthRatio(me, other);
  if (r > 1.4 || other?.tier === 'BOSS') return 'WAR_STRONGER';
  if (r < 0.7) return 'WAR_WEAKER';
  return 'WAR_EVEN';
}

export function showMeme(id: MemeId, captionOverride?: string): void {
  if (typeof window === 'undefined' || !isMemesEnabled()) return;
  const def = MEME_DEFS[id];
  if (!def) return;
  const now = Date.now();
  if (now - (lastShown[id] ?? 0) < (def.cooldownMs ?? 5000)) return;
  if (now - lastAnyShown < 900) return; // tránh nhiều sticker dồn cùng lúc
  lastShown[id] = now;
  lastAnyShown = now;
  const caption = captionOverride ?? def.captions[Math.floor(Math.random() * def.captions.length)];
  const detail: MemeEventDetail = { uid: uidCounter++, id, caption, def };
  window.dispatchEvent(new CustomEvent<MemeEventDetail>(MEME_EVENT, { detail }));
}

export const MEME_EVENT_NAME = MEME_EVENT;
