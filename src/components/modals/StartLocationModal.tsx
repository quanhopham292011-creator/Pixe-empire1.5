import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GameDifficulty, MapDimension, GameMode, PlayerProfile } from '../../types';
import { generateWorldMap } from '../../utils/mapGenerator';
import { validateSpawnLocation, findRandomValidSpawn, SpawnValidation } from '../../utils/startLocationUtils';
import { X, Shuffle, Map, Check, AlertCircle, CheckCircle2, Shield, Trees, Mountain, Anchor, Compass } from 'lucide-react';

interface StartLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmStart: (
    diff: GameDifficulty,
    size: MapDimension,
    name: string,
    mode: GameMode,
    customPos: { x: number; y: number },
    seed: number
  ) => void;
  difficulty: GameDifficulty;
  mapSize: MapDimension;
  playerName: string;
  gameMode: GameMode;
  playerProfile: PlayerProfile;
  soundManager?: { playClick: () => void };
}

export const StartLocationModal: React.FC<StartLocationModalProps> = ({
  isOpen,
  onClose,
  onConfirmStart,
  difficulty,
  mapSize,
  playerName,
  gameMode,
  soundManager,
}) => {
  const [seed, setSeed] = useState<number>(() => Math.random() * 1000);
  const [selectedPos, setSelectedPos] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sinh bản đồ cho màn hình xem trước
  const { tiles, nations } = useMemo(() => {
    return generateWorldMap(mapSize, difficulty, playerName, seed);
  }, [mapSize, difficulty, playerName, seed]);

  // Danh sách các điểm khởi đầu của các quốc gia khác (index >= 1)
  const otherSpawns = useMemo(() => {
    if (!nations || nations.length <= 1) return [];
    return nations.filter(n => n.id > 1).map(n => ({ x: n.capitalX, y: n.capitalY }));
  }, [nations]);

  // Khởi tạo vị trí được chọn mặc định khi mở modal hoặc đổi seed/bản đồ
  useEffect(() => {
    if (isOpen && tiles && tiles.length > 0) {
      if (nations && nations[1]) {
        setSelectedPos({ x: nations[1].capitalX, y: nations[1].capitalY });
      } else {
        const rand = findRandomValidSpawn(tiles, otherSpawns);
        setSelectedPos(rand);
      }
    }
  }, [isOpen, seed, mapSize, tiles, nations, otherSpawns]);

  // Kiểm tra tính hợp lệ của vị trí được chọn
  const validation: SpawnValidation = useMemo(() => {
    if (!tiles || tiles.length === 0 || !selectedPos) {
      return {
        isValid: false,
        reason: 'Chưa chọn vị trí',
        terrainType: 'WATER',
        hasHarborAccess: false,
        defenseBonus: 1.0,
        nearbyForests: 0,
        nearbyMountains: 0,
        nearestEnemyDist: 0,
        initialLandCount: 0,
      };
    }
    return validateSpawnLocation(tiles, selectedPos.x, selectedPos.y, otherSpawns);
  }, [tiles, selectedPos, otherSpawns]);

  // Vẽ bản đồ xem trước trên Canvas
  const renderPreviewCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tiles || tiles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = tiles.length;
    const clientW = canvas.clientWidth || 340;
    const clientH = canvas.clientHeight || 340;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = clientW * dpr;
    canvas.height = clientH * dpr;
    ctx.scale(dpr, dpr);

    const tileSize = clientW / size;

    // 1. Vẽ địa hình ô đất / biển
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = tiles[y][x];
        let color = '#1e3a8a'; // Biển (WATER)
        if (t.terrain === 'LAND') color = '#15803d'; // Đất liền
        else if (t.terrain === 'FOREST') color = '#047857'; // Rừng
        else if (t.terrain === 'MOUNTAIN') color = '#78716c'; // Núi

        ctx.fillStyle = color;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize + 0.5, tileSize + 0.5);
      }
    }

    // 2. Vẽ thủ đô các quốc gia khác (Enemy / Minor nations)
    otherSpawns.forEach((s, idx) => {
      const isBoss = idx === 0; // Boss AI (Châu Âu)
      const cx = (s.x + 0.5) * tileSize;
      const cy = (s.y + 0.5) * tileSize;

      ctx.fillStyle = isBoss ? '#ef4444' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(cx, cy, isBoss ? Math.max(3, tileSize * 0.8) : Math.max(2, tileSize * 0.5), 0, Math.PI * 2);
      ctx.fill();

      if (isBoss) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // 3. Vẽ phạm vi lãnh thổ ban đầu dự kiến của Người chơi tại selectedPos
    if (selectedPos) {
      const sx = selectedPos.x;
      const sy = selectedPos.y;
      const initRadius = 2.2;

      // Tô màu mờ cho các ô thuộc phạm vi lãnh thổ ban đầu
      ctx.fillStyle = validation.isValid ? 'rgba(59, 130, 246, 0.45)' : 'rgba(239, 68, 68, 0.4)';
      for (let dy = -Math.ceil(initRadius); dy <= Math.ceil(initRadius); dy++) {
        for (let dx = -Math.ceil(initRadius); dx <= Math.ceil(initRadius); dx++) {
          const nx = sx + dx;
          const ny = sy + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            const t = tiles[ny][nx];
            if (t.terrain !== 'WATER' && Math.hypot(dx, dy) <= initRadius) {
              ctx.fillRect(nx * tileSize, ny * tileSize, tileSize, tileSize);
            }
          }
        }
      }

      // Vẽ vòng tròn viền thể hiện bán kính kiểm soát ban đầu
      const centerX = (sx + 0.5) * tileSize;
      const centerY = (sy + 0.5) * tileSize;
      const radiusPx = initRadius * tileSize;

      ctx.strokeStyle = validation.isValid ? '#60a5fa' : '#f87171';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vẽ biểu tượng Cờ Thủ Đô / Ngôi sao tại tâm vị trí khởi đầu
      ctx.fillStyle = validation.isValid ? '#fbbf24' : '#ef4444';
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(5, tileSize * 1.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Vòng hào quang xung quanh vị trí chọn
      ctx.strokeStyle = validation.isValid ? 'rgba(251, 191, 36, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.max(9, tileSize * 2), 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [tiles, otherSpawns, selectedPos, validation]);

  useEffect(() => {
    if (isOpen) {
      renderPreviewCanvas();
    }
  }, [isOpen, renderPreviewCanvas]);

  // Xử lý sự kiện Chạm / Click tương tác chọn ô trên Canvas
  const handleCanvasInteraction = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !tiles || tiles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const xRatio = (clientX - rect.left) / rect.width;
    const yRatio = (clientY - rect.top) / rect.height;

    if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) return;

    const tileX = Math.max(1, Math.min(mapSize - 2, Math.floor(xRatio * mapSize)));
    const tileY = Math.max(1, Math.min(mapSize - 2, Math.floor(yRatio * mapSize)));

    if (soundManager) soundManager.playClick();
    setSelectedPos({ x: tileX, y: tileY });
  };

  const handleRandomPosition = () => {
    if (!tiles || tiles.length === 0) return;
    if (soundManager) soundManager.playClick();
    const rand = findRandomValidSpawn(tiles, otherSpawns);
    setSelectedPos(rand);
  };

  const handleNewMapSeed = () => {
    if (soundManager) soundManager.playClick();
    setSeed(Math.random() * 1000);
  };

  const handleConfirm = () => {
    if (!selectedPos || !validation.isValid) return;
    if (soundManager) soundManager.playClick();
    onConfirmStart(difficulty, mapSize, playerName, gameMode, selectedPos, seed);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base tracking-wide flex items-center gap-1.5">
                TỰ CHỌN VỊ TRÍ KHỞI ĐẦU
              </h3>
              <p className="text-[11px] text-slate-400">
                Chạm bản đồ để chọn Thủ đô & Lãnh thổ ban đầu
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white rounded-xl active:bg-slate-800 bg-slate-900 border border-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MAP CANVAS DISPLAY */}
        <div className="p-3 bg-slate-900/50 flex flex-col items-center justify-center shrink-0 border-b border-slate-800">
          <div className="relative w-full max-w-[340px] aspect-square rounded-2xl overflow-hidden border-2 border-slate-700/80 shadow-2xl bg-blue-950 cursor-crosshair touch-none">
            <canvas
              ref={canvasRef}
              className="w-full h-full block"
              onClick={(e) => handleCanvasInteraction(e.clientX, e.clientY)}
              onTouchStart={(e) => {
                if (e.touches.length > 0) {
                  handleCanvasInteraction(e.touches[0].clientX, e.touches[0].clientY);
                }
              }}
            />

            {/* OVERLAY LEGEND BADGES */}
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-slate-950/80 backdrop-blur px-2 py-1 rounded-lg text-[10px] text-slate-300 font-bold border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Vị trí chọn</span>
            </div>

            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur px-2 py-1 rounded-lg text-[10px] text-slate-300 font-bold border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Thủ đô khác</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center font-medium">
            💡 Mẹo: Chạm vào vùng đất xanh để đặt Thủ đô. Vòng viền đứt nét là bán kính kiểm soát ban đầu.
          </p>
        </div>

        {/* DETAILS & VALIDATION PANEL */}
        <div className="p-3 sm:p-4 space-y-2.5 overflow-y-auto flex-1 bg-slate-950">
          {/* STATUS BADGE */}
          <div className={`p-2.5 rounded-2xl border flex items-start gap-2.5 transition-colors ${
            validation.isValid 
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' 
              : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
          }`}>
            {validation.isValid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-extrabold text-xs tracking-wide">
                  {validation.isValid ? '🟢 VỊ TRÍ HỢP LỆ' : '🔴 KHÔNG THỂ KHỞI ĐẦU TẠI ĐÂY'}
                </span>
                {selectedPos && (
                  <span className="font-mono text-[11px] px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded-md text-amber-300 font-bold">
                    ({selectedPos.x}, {selectedPos.y})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                {validation.isValid
                  ? `Lãnh thổ ban đầu gồm ${validation.initialLandCount} ô đất. ${validation.hasHarborAccess ? 'Vùng ven biển thuận lợi xây Hải Cảng 🌊.' : 'Nội địa an toàn 🏞️.'}`
                  : validation.reason}
              </p>
            </div>
          </div>

          {/* GEOGRAPHY & RESOURCE BADGES */}
          {validation.isValid && (
            <div className="grid grid-cols-3 gap-1.5">
              <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Phòng thủ</div>
                  <div className="text-[11px] font-black text-blue-300">{validation.defenseBonus}x</div>
                </div>
              </div>

              <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-1.5">
                <Trees className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Rừng lân cận</div>
                  <div className="text-[11px] font-black text-emerald-300">{validation.nearbyForests} ô</div>
                </div>
              </div>

              <div className="p-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-1.5">
                <Anchor className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase">Thù địch gần nhất</div>
                  <div className="text-[11px] font-black text-amber-300">{validation.nearestEnemyDist.toFixed(1)} ô</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleRandomPosition}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 text-xs active:scale-95"
            >
              <Shuffle className="w-4 h-4 text-amber-400" />
              <span>Đổi Vị Trí</span>
            </button>

            <button
              onClick={handleNewMapSeed}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 text-xs active:scale-95"
            >
              <Map className="w-4 h-4 text-blue-400" />
              <span>Đổi Bản Đồ</span>
            </button>
          </div>

          <button
            disabled={!validation.isValid}
            onClick={handleConfirm}
            className={`w-full py-3.5 px-4 font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-sm active:scale-98 ${
              validation.isValid
                ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white shadow-emerald-600/30'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
            }`}
          >
            <Check className="w-5 h-5" />
            <span>Xác Nhận & Khởi Đầu Game</span>
          </button>
        </div>
      </div>
    </div>
  );
};
