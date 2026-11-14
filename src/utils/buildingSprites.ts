export function getNationColor(nation: any): string {
  if (!nation) return '#1e293b';
  return nation.color || '#64748b';
}

const DARK = '#0f172a';

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = DARK; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
}
function poly(ctx: CanvasRenderingContext2D, pts: number[][], fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = DARK; ctx.lineWidth = 1; ctx.stroke();
}
function thickLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, w: number) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = DARK; ctx.lineWidth = w + 2;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

export function drawBuildingSprite(ctx: CanvasRenderingContext2D, type: string, cx: number, cy: number, nationColor: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  roundRectPath(ctx, -10, -10, 20, 20, 4);
  ctx.fillStyle = nationColor; ctx.fill();
  ctx.strokeStyle = DARK; ctx.lineWidth = 1.6; ctx.stroke();

  if (type === 'CITY') {
    box(ctx, -8, -1, 5, 9, '#e2e8f0');
    box(ctx, -3, -8, 6, 16, '#cbd5e1');
    box(ctx, 3, 2, 5, 6, '#e2e8f0');
    ctx.fillStyle = '#facc15';
    for (const wy of [-6, -2, 2, 5]) { ctx.fillRect(-2, wy, 1.6, 1.6); ctx.fillRect(0.6, wy, 1.6, 1.6); }
    ctx.fillRect(-7, 1, 1.5, 1.5); ctx.fillRect(-7, 4.5, 1.5, 1.5); ctx.fillRect(4.5, 4, 1.5, 1.5);
  } else if (type === 'BARRACKS') {
    poly(ctx, [[-8, 8], [0, -5], [8, 8]], '#d6c28b');
    poly(ctx, [[-2.2, 8], [0, 2], [2.2, 8]], '#3f2d1a');
    thickLine(ctx, 0, -5, 0, -9, '#e2e8f0', 1);
    poly(ctx, [[0, -9], [5, -7.5], [0, -6]], '#ef4444');
  } else if (type === 'PORT') {
    roundRectPath(ctx, -8, -8, 16, 16, 2);
    ctx.fillStyle = '#0ea5e9'; ctx.fill();
    ctx.strokeStyle = DARK; ctx.lineWidth = 1; ctx.stroke();
    const anchor = (color: string, w: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, -5, 1.8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -3.2); ctx.lineTo(0, 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(3, -1); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 2, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    };
    anchor(DARK, 3.4); anchor('#ffffff', 1.8);
  } else if (type === 'MISSILE_SILO') {
    box(ctx, -8, 5, 16, 4, '#475569');
    poly(ctx, [[-2.5, 2], [-6, 7], [-2.5, 6]], '#ef4444');
    poly(ctx, [[2.5, 2], [6, 7], [2.5, 6]], '#ef4444');
    box(ctx, -2.5, -5, 5, 12, '#e2e8f0');
    poly(ctx, [[-2.5, -5], [0, -10], [2.5, -5]], '#ef4444');
    ctx.fillStyle = '#334155'; ctx.fillRect(-2.5, -1, 5, 1.6);
  } else if (type === 'AIR_DEFENSE') {
    thickLine(ctx, -1.5, 2, 4, -8, '#e2e8f0', 2.2);
    thickLine(ctx, 1.5, 2, 7, -8, '#e2e8f0', 2.2);
    box(ctx, -7, 5, 14, 4, '#475569');
    ctx.beginPath(); ctx.arc(0, 3.5, 3.4, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = '#64748b'; ctx.fill();
    ctx.strokeStyle = DARK; ctx.lineWidth = 1; ctx.stroke();
  } else if (type === 'FORTRESS') {
    box(ctx, -8, -3, 16, 11, '#94a3b8');
    box(ctx, -8, -6, 5, 14, '#a8b4c6');
    box(ctx, 3, -6, 5, 14, '#a8b4c6');
    ctx.fillStyle = '#a8b4c6';
    for (const mx of [-8, -5.2, 3, 5.8]) {
      ctx.fillRect(mx, -8.5, 2.2, 2.5);
      ctx.strokeStyle = DARK; ctx.lineWidth = 1; ctx.strokeRect(mx, -8.5, 2.2, 2.5);
    }
    ctx.beginPath();
    ctx.moveTo(-2.2, 8); ctx.lineTo(-2.2, 3.5);
    ctx.arc(0, 3.5, 2.2, Math.PI, 0);
    ctx.lineTo(2.2, 8); ctx.closePath();
    ctx.fillStyle = '#1e293b'; ctx.fill();
  } else if (type === 'OIL_RIG') {
    box(ctx, -8, 6, 16, 3, '#475569');
    poly(ctx, [[0, -9], [-5, 6], [5, 6]], '#1e293b');
    thickLine(ctx, -3, 0, 3, 0, '#a78bfa', 1.3);
    thickLine(ctx, -4, 3, 4, 3, '#a78bfa', 1.3);
    ctx.beginPath(); ctx.arc(0, -9, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24'; ctx.fill();
  } else if (type === 'MINE') {
    poly(ctx, [[-8, 8], [-8, 1], [0, -7], [8, 1], [8, 8]], '#78716c');
    poly(ctx, [[-3, 8], [-3, 2], [3, 2], [3, 8]], '#1c1917');
    poly(ctx, [[0, -3], [2.5, -0.5], [0, 1.5], [-2.5, -0.5]], '#38bdf8');
  } else if (type === 'LASER') {
    poly(ctx, [[-7, 9], [-3.5, 3], [3.5, 3], [7, 9]], '#475569');
    thickLine(ctx, 0, -2, 0, -9, '#f9a8d4', 1.6);
    thickLine(ctx, -2, -1, -6, -6, '#f9a8d4', 1.2);
    thickLine(ctx, 2, -1, 6, -6, '#f9a8d4', 1.2);
    ctx.beginPath(); ctx.arc(0, 0.5, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ec4899'; ctx.fill();
    ctx.strokeStyle = DARK; ctx.lineWidth = 1; ctx.stroke();
  } else if (type === 'SUPREME_FORTRESS') {
    poly(ctx, [[-9, -5], [0, -9], [9, -5], [8, 3], [0, 9], [-8, 3]], '#38bdf8');
    poly(ctx, [[-6, -3], [0, -6], [6, -3], [5, 2], [0, 6], [-5, 2]], '#0f172a');
    thickLine(ctx, 0, -4, 0, 4, '#facc15', 1.8);
    thickLine(ctx, -3, -1, 3, -1, '#facc15', 1.8);
  } else if (type === 'GRAND_ACADEMY') {
    box(ctx, -8, 4, 16, 4, '#cbd5e1');
    box(ctx, -6, -2, 12, 6, '#e2e8f0');
    poly(ctx, [[-9, -2], [0, -9], [9, -2]], '#60a5fa');
    ctx.beginPath(); ctx.arc(0, 1, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15'; ctx.fill();
    ctx.strokeStyle = DARK; ctx.lineWidth = 1; ctx.stroke();
  } else if (type === 'BUNKER') {
    box(ctx, -8, 2, 16, 6, '#57534e');
    poly(ctx, [[-7, 2], [-5, -4], [5, -4], [7, 2]], '#a8a29e');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-5, -2, 10, 2.2);
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(-7, 5, 14, 1.5);
  } else if (type === 'GRAND_ARSENAL') {
    box(ctx, -8, 1, 16, 7, '#64748b');
    poly(ctx, [[-8, 1], [-4, -4], [-4, 1], [0, -4], [0, 1], [4, -4], [4, 1], [8, 1]], '#94a3b8');
    box(ctx, 4, -8, 2.6, 5, '#475569');
    box(ctx, -6, -7, 2.6, 4, '#475569');
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(-3, 3.5, 6, 2.2);
  }
  ctx.restore();
}
