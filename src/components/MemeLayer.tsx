import React, { useEffect, useMemo, useState } from 'react';
import { SPRITES, PALETTE, SPRITE_W, SPRITE_H } from '../utils/memeSprites';
import {
  MEME_EVENT_NAME, MemeEventDetail, isMemesEnabled, setMemesEnabled,
} from '../utils/memes';

const SHOW_MS = 3000;
const MAX_VISIBLE = 2;

/** Vẽ 1 sprite pixel bằng SVG (gộp các ô cùng màu liền nhau cho nhẹ). */
export const PixelSprite: React.FC<{ name: string; size?: number }> = ({ name, size = 52 }) => {
  const rects = useMemo(() => {
    const rows = SPRITES[name];
    if (!rows) return [];
    const items: { x: number; y: number; w: number; color: string }[] = [];
    for (let y = 0; y < rows.length; y++) {
      const line = rows[y];
      let x = 0;
      while (x < line.length) {
        const ch = line[x];
        if (ch === '.') {
          x++;
          continue;
        }
        const color = PALETTE[ch];
        let w = 1;
        while (x + w < line.length && line[x + w] === ch) {
          w++;
        }
        if (color) {
          items.push({ x, y, w, color });
        }
        x += w;
      }
    }
    return items;
  }, [name]);

  const height = Math.round((size * SPRITE_H) / SPRITE_W);

  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`}
      className="shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
      style={{ shapeRendering: 'crispEdges' }}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.color} />
      ))}
    </svg>
  );
};

interface ActiveMeme extends MemeEventDetail {
  createdAt: number;
}

export const MemeLayer: React.FC = () => {
  const [memes, setMemes] = useState<ActiveMeme[]>([]);

  useEffect(() => {
    const handleMeme = (e: Event) => {
      const custom = e as CustomEvent<MemeEventDetail>;
      if (!custom.detail) return;
      setMemes(prev => {
        const next = [...prev, { ...custom.detail, createdAt: Date.now() }];
        if (next.length > MAX_VISIBLE) {
          return next.slice(next.length - MAX_VISIBLE);
        }
        return next;
      });
    };

    window.addEventListener(MEME_EVENT_NAME, handleMeme);

    const interval = setInterval(() => {
      const now = Date.now();
      setMemes(prev => prev.filter(m => now - m.createdAt < SHOW_MS));
    }, 200);

    return () => {
      window.removeEventListener(MEME_EVENT_NAME, handleMeme);
      clearInterval(interval);
    };
  }, []);

  if (memes.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-16 z-50 pointer-events-none flex flex-col items-center gap-2.5 px-4 animate-in fade-in duration-200">
      {memes.map((m) => (
        <div
          key={m.uid}
          className="pointer-events-none flex items-center gap-3 bg-slate-900/95 border-2 rounded-2xl p-2.5 px-4 shadow-2xl backdrop-blur-md transition-all duration-300 transform scale-100 animate-in slide-in-from-top-3"
          style={{ borderColor: m.def.color }}
        >
          <PixelSprite name={m.def.sprite} size={48} />
          <div className="flex flex-col text-left">
            <span
              className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded w-fit mb-0.5"
              style={{ backgroundColor: `${m.def.color}33`, color: m.def.color }}
            >
              {m.def.tag}
            </span>
            <span className="text-sm font-bold text-white drop-shadow leading-snug">
              {m.caption}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
