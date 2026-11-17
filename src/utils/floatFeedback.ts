let lastShownAt = 0;
export const FLOAT_FEEDBACK_COOLDOWN_MS = 2000;

// Chỉ hiện 1 dòng phản hồi mỗi 2 giây. Dòng đến trong lúc đang hồi sẽ bị bỏ qua.
export function pushFeedbackText(
  particles: any[],
  p: { x: number; y: number; color: string; text: string },
  life: number = 55
): boolean {
  const now = performance.now();
  if (now - lastShownAt < FLOAT_FEEDBACK_COOLDOWN_MS) return false;
  lastShownAt = now;
  particles.push({
    x: p.x, y: p.y, color: p.color, size: 0,
    life, maxLife: life, vx: 0, vy: -0.7,
    type: 'FLOAT_TEXT', text: p.text,
  });
  return true;
}
