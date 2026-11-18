import React, { useState, useEffect, useRef } from 'react';
import { Rocket, Flame, Sparkles, X, CheckCircle2, Clock, Plus, Plane, Anchor, Crosshair } from 'lucide-react';
import {
  Nation,
  Tile,
  MissileType,
  AirUnitType,
  AirUnit,
  NavalShip,
  NavalShipState,
  PortBuildQueueItem,
  NavalAimingState,
} from '../types';
import { MISSILE_CONFIG, MISSILE_SETTINGS, formatPopulation, AIR_SYSTEM_CONFIG, AIR_UNIT_SPECS } from '../utils/constants';
import { NAVAL_CONFIG } from '../data/gameData';
import { areResourcesEnabled, canAffordMissileResources, getMissileResourceCost, formatResource, getDepositTiles } from '../utils/resources';
import { getAtomEffectiveStats, getMissileEffectiveCost, hasUpgradedHydro } from '../utils/supremeTech';
import {
  canUseAirType1,
  canUseAirType23,
  hasAnyAirUnlocked,
  getNationAirSummary,
  getAirProduceCost,
  canProduceAirUnit,
  getGrandArsenalCountdownState,
  getSavedBomberRoute,
  getBomberRecoveryRemainingSeconds,
} from '../utils/aircraftSystem';
import { getPortWaterAccess } from '../utils/seaPathfinding';
import {
  countPortShipsAndQueue,
  enqueueNavalShip,
  cancelNavalQueueItem,
  assignExtractorDeposit,
  hasSeaOilExtractionRight,
  isDepositClaimedByOtherExtractor,
  isShipNearOwnedCoast,
  loadTroopsOnWarship,
  unloadTroopsAtCoast,
  issueWarshipOrder,
  startWarshipSeaRepair,
  createOrJoinFleet,
  leaveFleet,
  disbandFleet,
  issueFleetOrder,
  getSeaControlOwner,
} from '../utils/navalSystem';
import { getNationColor } from '../utils/buildingSprites';

const getNavalStateLabel = (state: NavalShipState): string => {
  switch (state) {
    case 'EXTRACTING':
      return 'Đang hút dầu';
    case 'MOVING':
      return 'Đang di chuyển';
    case 'PATROL':
      return 'Đang tuần tra';
    case 'ESCORT':
      return 'Đang hộ tống';
    case 'ATTACKING':
      return 'Đang tấn công';
    case 'RETREATING':
      return 'Đang rút về cảng';
    case 'REPAIRING':
      return 'Đang sửa chữa';
    case 'TRANSPORTING':
      return 'Đang chở quân';
    case 'LANDING':
      return 'Đang đổ bộ';
    default:
      return 'Chờ lệnh';
  }
};

interface MissileModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerNation: Nation;
  silos: Tile[];
  onSelectMissile: (type: MissileType) => void;
  onOpenBuildModal: () => void;
  airUnits?: AirUnit[];
  airAimingMode?: 'FIGHTER' | 'SQUADRON' | 'BOMBER_START' | 'BOMBER_END' | null;
  onToggleAirAiming?: (type: AirUnitType) => void;
  onProduceAirUnit?: (type: AirUnitType) => void;
  onReplayBomberRoute?: () => void;
  hasArsenalReady?: boolean;
  gameDataRef?: React.MutableRefObject<any>;
  fogOfWarEnabled?: boolean;
  fogGridRef?: React.MutableRefObject<Uint8Array | null>;
  showSeaControl?: boolean;
  onToggleSeaControl?: () => void;
  onStartNavalAiming?: (aim: NavalAimingState) => void;
  onFocusMap?: (mapX: number, mapY: number) => void;
  onNotify?: (msg: string) => void;
  requestedTab?: 'PLANES' | 'MISSILES' | 'NAVAL' | null;
  onClearRequestedTab?: () => void;
}

const InfoButton: React.FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Xem thông tin"
    className={`min-w-[44px] min-h-[44px] rounded-xl border text-sm font-black flex items-center justify-center shrink-0 active:scale-90 transition-all ${
      active
        ? 'bg-amber-400 text-slate-950 border-amber-200'
        : 'bg-slate-800 text-amber-200 border-slate-500'
    }`}
  >
    !
  </button>
);

const SeaOverviewMiniCanvas: React.FC<{
  data: any;
  playerNationId: number;
  fogOfWarEnabled?: boolean;
  fogGrid?: Uint8Array | null;
  showSeaControl?: boolean;
  onFocusMap?: (mapX: number, mapY: number) => void;
}> = ({ data, playerNationId, fogOfWarEnabled, fogGrid, showSeaControl, onFocusMap }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tiles: Tile[][] = data?.tiles || [];
  const size = tiles.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const step = w / size;
    const nations: Nation[] = data?.nations || [];
    const seaGrid = data?.seaControlGrid;

    ctx.clearRect(0, 0, w, h);

    for (let y = 0; y < size; y++) {
      const row = tiles[y];
      if (!row) continue;
      for (let x = 0; x < size; x++) {
        const t = row[x];
        if (!t) continue;
        const vis = !fogOfWarEnabled || !fogGrid || fogGrid.length !== size * size || fogGrid[y * size + x] === 1;
        if (!vis) {
          ctx.fillStyle = '#090d16';
          ctx.fillRect(x * step, y * step, Math.ceil(step), Math.ceil(step));
          continue;
        }
        if (t.terrain === 'WATER') {
          ctx.fillStyle = '#0c4a6e';
          ctx.fillRect(x * step, y * step, Math.ceil(step), Math.ceil(step));
          if (showSeaControl && seaGrid) {
            const zOwner = getSeaControlOwner(seaGrid, x, y);
            if (zOwner > 0 && nations[zOwner]) {
              ctx.save();
              ctx.globalAlpha = 0.28;
              ctx.fillStyle = getNationColor(nations[zOwner]);
              ctx.fillRect(x * step, y * step, Math.ceil(step), Math.ceil(step));
              ctx.restore();
            }
          }
        } else if (t.owner > 0 && nations[t.owner]) {
          ctx.fillStyle = getNationColor(nations[t.owner]);
          ctx.fillRect(x * step, y * step, Math.ceil(step), Math.ceil(step));
        } else {
          ctx.fillStyle = t.terrain === 'MOUNTAIN' ? '#475569' : t.terrain === 'FOREST' ? '#166534' : '#334155';
          ctx.fillRect(x * step, y * step, Math.ceil(step), Math.ceil(step));
        }

        if (t.owner === playerNationId && t.building === 'PORT') {
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(x * step - 1, y * step - 1, Math.max(3, step + 2), Math.max(3, step + 2));
        }
      }
    }

    // Mỏ Dầu Biển đã phát hiện
    const deposits = getDepositTiles(tiles);
    for (const dt of deposits) {
      if (!dt || dt.terrain !== 'WATER' || dt.deposit !== 'OIL' || !dt.discovered) continue;
      const vis = !fogOfWarEnabled || !fogGrid || fogGrid.length !== size * size || fogGrid[dt.y * size + dt.x] === 1;
      if (!vis) continue;
      ctx.fillStyle = (dt.reserve || 0) > 0 ? '#38bdf8' : '#64748b';
      ctx.beginPath();
      ctx.arc((dt.x + 0.5) * step, (dt.y + 0.5) * step, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tàu Hải Quân (Warship + Extractor) - KHÔNG vẽ tàu thương
    const ships: NavalShip[] = data?.navalShips || [];
    for (const s of ships) {
      if (!s || s.hp <= 0) continue;
      const tx = Math.max(0, Math.min(size - 1, Math.round(s.x)));
      const ty = Math.max(0, Math.min(size - 1, Math.round(s.y)));
      const vis = s.nationId === playerNationId || !fogOfWarEnabled || !fogGrid || fogGrid.length !== size * size || fogGrid[ty * size + tx] === 1;
      if (!vis) continue;
      ctx.fillStyle = s.nationId === playerNationId
        ? (s.type === 'WARSHIP' ? '#facc15' : '#22d3ee')
        : s.nationId === 0
          ? '#cbd5e1'
          : '#f43f5e';
      ctx.beginPath();
      ctx.arc((s.x + 0.5) * step, (s.y + 0.5) * step, s.type === 'WARSHIP' ? 2.6 : 2.0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  if (size === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={130}
      onClick={(e) => {
        if (!onFocusMap) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const rx = Math.max(0, Math.min(size - 1, Math.floor(((e.clientX - rect.left) / rect.width) * size)));
        const ry = Math.max(0, Math.min(size - 1, Math.floor(((e.clientY - rect.top) / rect.height) * size)));
        onFocusMap(rx, ry);
      }}
      className="w-full h-[126px] rounded-xl border border-sky-500/50 bg-slate-950 cursor-pointer block"
      title="Chạm lên bản đồ biển để di chuyển camera nhanh"
    />
  );
};

export const MissileModal: React.FC<MissileModalProps> = ({
  isOpen,
  onClose,
  playerNation,
  silos,
  onSelectMissile,
  onOpenBuildModal,
  airUnits = [],
  airAimingMode,
  onToggleAirAiming,
  onProduceAirUnit,
  onReplayBomberRoute,
  hasArsenalReady = false,
  gameDataRef,
  fogOfWarEnabled = true,
  fogGridRef,
  showSeaControl = true,
  onToggleSeaControl,
  onStartNavalAiming,
  onFocusMap,
  onNotify,
  requestedTab,
  onClearRequestedTab,
}) => {
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const arsenalCountdown = getGrandArsenalCountdownState(playerNation, hasArsenalReady);
  const airUnlocked = hasAnyAirUnlocked(playerNation) || arsenalCountdown.show;
  const [activeTab, setActiveTab] = useState<'PLANES' | 'MISSILES' | 'NAVAL'>(airUnlocked ? 'PLANES' : 'MISSILES');
  const [selectedPortKey, setSelectedPortKey] = useState<string>('');
  const [selectedForFleet, setSelectedForFleet] = useState<string[]>([]);
  const [, setLocalTick] = useState(0);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      if (requestedTab) {
        setActiveTab(requestedTab);
        onClearRequestedTab?.();
      } else {
        const countdown = getGrandArsenalCountdownState(playerNation, hasArsenalReady);
        const unlocked = hasAnyAirUnlocked(playerNation) || countdown.show;
        setActiveTab(unlocked ? 'PLANES' : 'MISSILES');
      }
      setSelectedForFleet([]);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, requestedTab, onClearRequestedTab, playerNation, hasArsenalReady]);

  if (!isOpen) return null;

  const data = gameDataRef?.current;
  const tiles: Tile[][] = data?.tiles || [];
  const playerNavalShips: NavalShip[] = (data?.navalShips || []).filter(
    (s: NavalShip) => s && s.hp > 0 && s.nationId === playerNation.id
  );
  const playerWarships = playerNavalShips.filter((s) => s.type === 'WARSHIP');
  const playerExtractors = playerNavalShips.filter((s) => s.type === 'EXTRACTOR');
  const playerBuildQueues: PortBuildQueueItem[] = (data?.portBuildQueues || []).filter(
    (q: PortBuildQueueItem) => q && q.nationId === playerNation.id
  );

  // Thu thập cảng thuộc người chơi
  const ownedPorts: { x: number; y: number; isEnclosed: boolean; inactive: boolean }[] = [];
  if (tiles.length > 0) {
    for (let y = 0; y < tiles.length; y++) {
      const row = tiles[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        const t = row[x];
        if (t && t.owner === playerNation.id && t.building === 'PORT') {
          const access = getPortWaterAccess(tiles, x, y);
          ownedPorts.push({
            x,
            y,
            isEnclosed: access.isEnclosed || access.openCompIds.length === 0,
            inactive: Boolean(t.inactiveTimer && t.inactiveTimer > 0),
          });
        }
      }
    }
  }
  const openPorts = ownedPorts.filter((p) => !p.isEnclosed && !p.inactive);
  const activePort =
    openPorts.find((p) => `${p.x}_${p.y}` === selectedPortKey) || openPorts[0] || null;

  // Mỏ Dầu Biển đã phát hiện & còn trữ lượng
  const discoveredSeaOils = getDepositTiles(tiles).filter(
    (dt) => dt && dt.terrain === 'WATER' && dt.deposit === 'OIL' && dt.discovered && (dt.reserve || 0) > 0
  );

  const totalSilos = silos.length;
  const readySilos = silos.filter((s) => (s.missileCooldown || 0) <= 0);
  const cooldownSilos = silos.filter((s) => (s.missileCooldown || 0) > 0);
  const minCooldown = cooldownSilos.length > 0
    ? Math.min(...cooldownSilos.map((s) => s.missileCooldown || 0))
    : 0;

  const missiles = (['ATOM', 'HYDRO', 'MIRV'] as MissileType[]).map((key) => MISSILE_CONFIG[key]);
  const atomStats = getAtomEffectiveStats(playerNation);
  const upgradedHydro = hasUpgradedHydro(playerNation);
  const airSummary = getNationAirSummary(airUnits, playerNation.id);

  const toggle = (id: string) => setOpenInfo((prev) => (prev === id ? null : id));
  const bump = () => setLocalTick((v) => v + 1);

  // Gom nhóm các hạm đội hiện có
  const fleetMap = new Map<string, NavalShip[]>();
  for (const w of playerWarships) {
    if (!w.fleetId) continue;
    const arr = fleetMap.get(w.fleetId) || [];
    arr.push(w);
    fleetMap.set(w.fleetId, arr);
  }
  const fleets = Array.from(fleetMap.entries());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-rose-400/60 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-left">
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/95 border-b border-slate-700 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-500/25 border border-rose-400 text-rose-300 flex items-center justify-center shrink-0">
              {activeTab === 'NAVAL' ? <Anchor className="w-5 h-5 text-sky-300" /> : <Rocket className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-white tracking-wide">TẤN CÔNG &amp; QUÂN SỰ</h3>
              <p className="text-sm text-amber-300 font-mono font-bold break-words">
                💰 {formatPopulation(playerNation.gold)}
                {areResourcesEnabled() && (
                  <span className="ml-2 text-sky-200">
                    🛢️ {formatResource(playerNation.oil)}{' '}
                    <span className="text-violet-200">⛏️ {formatResource(playerNation.minerals)}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <InfoButton active={openInfo === 'tip'} onClick={() => toggle('tip')} />
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] p-2 text-slate-100 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl flex items-center justify-center"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TABS: Máy bay, Tên lửa & Tàu thuyền */}
        <div className="flex border-b border-slate-700 bg-slate-950">
          {airUnlocked && (
            <button
              onClick={() => setActiveTab('PLANES')}
              className={`flex-1 min-h-[48px] py-2 px-2 text-xs sm:text-sm font-black flex items-center justify-center gap-1 transition-all ${
                activeTab === 'PLANES'
                  ? 'bg-sky-600/30 text-sky-200 border-b-2 border-sky-400'
                  : 'text-slate-200 hover:text-white bg-slate-950'
              }`}
            >
              <Plane className="w-4 h-4 text-sky-300 shrink-0" />
              <span className="whitespace-nowrap">Máy Bay</span>
              <span className="px-1.5 py-0.5 rounded-full bg-sky-500/30 text-xs text-amber-200 font-mono">
                {airSummary.fighterReady + airSummary.squadronReady + airSummary.bomberReady}
              </span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('MISSILES')}
            className={`flex-1 min-h-[48px] py-2 px-2 text-xs sm:text-sm font-black flex items-center justify-center gap-1 transition-all ${
              activeTab === 'MISSILES'
                ? 'bg-rose-600/30 text-rose-200 border-b-2 border-rose-400'
                : 'text-slate-200 hover:text-white bg-slate-950'
            }`}
          >
            <Rocket className="w-4 h-4 text-rose-300 shrink-0" />
            <span className="whitespace-nowrap">Tên Lửa</span>
            <span className="px-1.5 py-0.5 rounded-full bg-rose-500/30 text-xs text-emerald-200 font-mono">
              {readySilos.length}/{totalSilos}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('NAVAL')}
            className={`flex-1 min-h-[48px] py-2 px-2 text-xs sm:text-sm font-black flex items-center justify-center gap-1 transition-all ${
              activeTab === 'NAVAL'
                ? 'bg-cyan-600/30 text-cyan-200 border-b-2 border-cyan-400'
                : 'text-slate-200 hover:text-white bg-slate-950'
            }`}
          >
            <Anchor className="w-4 h-4 text-cyan-300 shrink-0" />
            <span className="whitespace-nowrap">Tàu Thuyền</span>
            <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/30 text-xs text-cyan-100 font-mono">
              {playerNavalShips.length}
            </span>
          </button>
        </div>

        {/* Mẹo (chỉ hiện khi bấm "!" ở header) */}
        {openInfo === 'tip' && (
          <div className="px-4 py-2.5 bg-amber-950/70 border-b border-amber-400/50 text-sm text-amber-100 leading-snug">
            {activeTab === 'PLANES'
              ? 'Sản xuất và xuất kích máy bay chiến đấu, tiểu đội hoặc ném bom tấn công mục tiêu đối phương.'
              : activeTab === 'NAVAL'
                ? 'Đóng Tàu Khai Thác & Tàu Chiến tại Hải Cảng thông ra biển lớn. Ghép hạm đội tối đa 6 tàu, kiểm soát mỏ dầu biển và đổ bộ đường biển.'
                : 'Bấm "Khai hỏa", rồi chạm vào đất kẻ thù trên bản đồ. Bệ phóng gần nhất sẽ tự bắn.'}
          </div>
        )}

        {/* NỘI DUNG TAB MÁY BAY */}
        {activeTab === 'PLANES' && (
          <div className="p-3 overflow-y-auto space-y-3 flex-1">
            <div className="bg-sky-950/75 p-3 rounded-2xl border border-sky-400/60 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-sky-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span>⚡ Lượt xuất kích: <strong className="text-amber-300">{playerNation.airSorties ?? AIR_SYSTEM_CONFIG.MAX_SORTIES}/{AIR_SYSTEM_CONFIG.MAX_SORTIES}</strong></span>
                  {(playerNation.airSorties ?? AIR_SYSTEM_CONFIG.MAX_SORTIES) < AIR_SYSTEM_CONFIG.MAX_SORTIES && (
                    <span className="text-sm font-mono text-slate-200">
                      (Hồi sau {Math.max(1, AIR_SYSTEM_CONFIG.SORTIE_RECHARGE_SECONDS - Math.floor(playerNation.airSortieRegenTimer || 0))}s)
                    </span>
                  )}
                </div>
                <span className="text-slate-100 font-mono text-sm">
                  Sở hữu: {airSummary.ownedPlanes}/{AIR_SYSTEM_CONFIG.MAX_OWNED_PER_NATION} • Bay: {airSummary.flyingGlobal}/{AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL}
                </span>
              </div>

              {arsenalCountdown.show && (
                arsenalCountdown.destroyed ? (
                  <div className="px-3 py-2 rounded-xl bg-rose-950/80 border border-rose-400 text-sm text-rose-200 font-bold">
                    💥 Đại Công Xưởng: Bị phá, cần xây lại
                  </div>
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-amber-950/80 border border-amber-400 text-sm text-amber-200 font-bold font-mono">
                    ⏳ Mở khóa Loại 2 &amp; 3 sau: {arsenalCountdown.remainingSeconds} giây
                  </div>
                )
              )}

              {!canUseAirType1(playerNation) && !canUseAirType23(playerNation) && (
                <div className="text-sm text-slate-100 px-1 pt-0.5 leading-snug">
                  {arsenalCountdown.destroyed
                    ? 'Hãy xây lại Đại Công Xưởng và bảo vệ đủ 60 giây để mở khóa Máy Bay Tiểu Đội (Loại 2) & Ném Bom (Loại 3).'
                    : 'Đang chờ Đại Công Xưởng hoàn tất thời gian kích hoạt để mở khóa Máy Bay Tiểu Đội (Loại 2) & Ném Bom (Loại 3).'}
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                {(['FIGHTER', 'SQUADRON', 'BOMBER'] as AirUnitType[]).map((uType) => {
                  const unlocked = uType === 'FIGHTER' ? canUseAirType1(playerNation) : canUseAirType23(playerNation);
                  if (!unlocked) return null;
                  const spec = AIR_UNIT_SPECS[uType];
                  const resOn = areResourcesEnabled();
                  const cost = getAirProduceCost(uType, resOn);
                  const canProd = canProduceAirUnit(playerNation, airUnits, uType, resOn);
                  const readyCount = uType === 'FIGHTER' ? airSummary.fighterReady : uType === 'SQUADRON' ? airSummary.squadronReady : airSummary.bomberReady;
                  const recCount = uType === 'FIGHTER' ? airSummary.fighterRecovering : uType === 'SQUADRON' ? airSummary.squadronRecovering : airSummary.bomberRecovering;
                  const isAimingThis =
                    (uType === 'FIGHTER' && airAimingMode === 'FIGHTER') ||
                    (uType === 'SQUADRON' && airAimingMode === 'SQUADRON') ||
                    (uType === 'BOMBER' && (airAimingMode === 'BOMBER_START' || airAimingMode === 'BOMBER_END'));
                  const savedBomberRoute = uType === 'BOMBER' ? getSavedBomberRoute(airUnits, playerNation) : null;
                  const bomberRecoverySec =
                    uType === 'BOMBER' && readyCount <= 0
                      ? getBomberRecoveryRemainingSeconds(airUnits, playerNation)
                      : 0;
                  const hasOwnedBomber =
                    uType === 'BOMBER' &&
                    airSummary.bomberReady + airSummary.bomberRecovering + airSummary.bomberFlying > 0;
                  const canReplayBomber = Boolean(
                    uType === 'BOMBER' &&
                      savedBomberRoute &&
                      readyCount > 0 &&
                      (playerNation.airSorties ?? 0) > 0 &&
                      airSummary.flyingGlobal + 1 <= AIR_SYSTEM_CONFIG.MAX_FLYING_GLOBAL
                  );

                  return (
                    <div key={uType} className="p-3 bg-slate-950/95 border border-slate-600 rounded-2xl space-y-2">
                      <div className="flex flex-col gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 font-bold text-white text-sm">
                            <span>{spec.name}</span>
                            <span className="text-emerald-300 font-mono">[{readyCount} sẵn sàng]</span>
                            {recCount > 0 && <span className="text-amber-300 text-sm">⏳{recCount} hồi phục</span>}
                          </div>
                          <div className="text-sm text-amber-300 font-mono font-bold mt-1 flex flex-wrap items-center gap-x-2">
                            <span>💰 {formatPopulation(cost.goldCost)}</span>
                            {cost.oilCost > 0 && <span className="text-sky-200">🛢️ {cost.oilCost} Dầu</span>}
                            <span className="text-slate-200">Biên chế {cost.troopCost}q</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {onProduceAirUnit && (
                            <button
                              onClick={() => onProduceAirUnit(uType)}
                              disabled={!canProd.ok}
                              title={canProd.reason}
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                                canProd.ok
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow'
                                  : 'bg-slate-800 text-slate-300 border-slate-600 cursor-not-allowed opacity-70'
                              }`}
                            >
                              Mua {Math.round(cost.goldCost / 1000)}k💰{cost.oilCost > 0 ? ` ${cost.oilCost}🛢️` : ''}
                            </button>
                          )}
                          {uType === 'BOMBER' && onReplayBomberRoute && (
                            <button
                              onClick={() => { onClose(); onReplayBomberRoute(); }}
                              disabled={!canReplayBomber}
                              title={
                                !savedBomberRoute
                                  ? 'Chưa có tuyến bay cũ'
                                  : readyCount <= 0
                                  ? 'Chưa có máy bay sẵn sàng'
                                  : (playerNation.airSorties ?? 0) <= 0
                                  ? 'Hết lượt xuất kích'
                                  : 'Bay lại tuyến cũ (1 lượt xuất kích, 0 Dầu)'
                              }
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-black border transition-all active:scale-95 ${
                                canReplayBomber
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow'
                                  : 'bg-slate-800 text-slate-300 border-slate-600 cursor-not-allowed opacity-70'
                              }`}
                            >
                              Bay lại tuyến cũ
                            </button>
                          )}
                          {onToggleAirAiming && (
                            <button
                              onClick={() => { onClose(); onToggleAirAiming(uType); }}
                              disabled={!isAimingThis && (readyCount <= 0 || (playerNation.airSorties ?? 0) <= 0)}
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-black border transition-all active:scale-95 ${
                                isAimingThis
                                  ? 'bg-amber-400 text-slate-950 border-amber-200 animate-pulse'
                                  : readyCount > 0 && (playerNation.airSorties ?? 0) > 0
                                  ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 shadow'
                                  : 'bg-slate-800 text-slate-300 border-slate-600 cursor-not-allowed opacity-70'
                              }`}
                            >
                              {isAimingThis ? '🎯 Hủy mục tiêu' : '✈️ Xuất kích'}
                            </button>
                          )}
                        </div>
                      </div>
                      {uType === 'BOMBER' && (
                        readyCount > 0 ? (
                          <div className="text-sm text-sky-200">
                            Chạm Xuất kích, rồi chạm 2 điểm để vẽ tuyến
                          </div>
                        ) : hasOwnedBomber ? (
                          <div className="text-sm text-amber-200 font-mono">
                            Đang về căn cứ, hồi còn {bomberRecoverySec} giây
                          </div>
                        ) : null
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* NỘI DUNG TAB TÊN LỬA */}
        {activeTab === 'MISSILES' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2 bg-slate-950/90 border-b border-slate-700 flex flex-wrap items-center justify-between text-sm font-bold gap-2 shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-slate-100">Bệ: <strong className="text-white font-mono">{totalSilos}</strong></span>
                <span className="flex items-center gap-1 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <strong className="font-mono">{readySilos.length}</strong>
                </span>
                {cooldownSilos.length > 0 && (
                  <span className="flex items-center gap-1 text-rose-300">
                    <Clock className="w-4 h-4" />
                    <strong className="font-mono">{cooldownSilos.length}</strong> ({minCooldown}s)
                  </span>
                )}
              </div>
              <button
                onClick={() => { onClose(); onOpenBuildModal(); }}
                className="min-h-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-200 font-bold text-sm rounded-xl border border-slate-600 flex items-center gap-1 active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" /> Xây bệ ({formatPopulation(MISSILE_SETTINGS.SILO_BUILD_COST)})
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-2.5 flex-1">
              {totalSilos === 0 && (
                <div className="p-3 bg-rose-950/70 border border-rose-400 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-rose-100">Chưa có bệ phóng tên lửa</span>
                  <button
                    onClick={() => { onClose(); onOpenBuildModal(); }}
                    className="min-h-[44px] px-3.5 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl text-sm flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Xây ngay
                  </button>
                </div>
              )}

              {missiles.map((m) => {
                const effCost = getMissileEffectiveCost(m.id, playerNation);
                const resCost = getMissileResourceCost(m.id, playerNation);
                const goldCost = effCost.cost;
                const isUpgradedAtom = m.id === 'ATOM' && atomStats.isUpgraded;
                const isUpgradedHydro = m.id === 'HYDRO' && upgradedHydro;
                const effectiveRadius = Number((isUpgradedAtom ? atomStats.radius : m.radius).toFixed(1));
                const hasEnoughRes = canAffordMissileResources(playerNation, m.id);
                const hasEnoughGold = playerNation.gold >= goldCost;
                const canAfford = hasEnoughGold && hasEnoughRes;
                const hasReadySilo = readySilos.length > 0;
                const canLaunch = canAfford && hasReadySilo;

                let iconEl = <Rocket className="w-5 h-5 text-amber-300" />;
                if (m.id === 'HYDRO') iconEl = <Flame className="w-5 h-5 text-orange-300" />;
                if (m.id === 'MIRV') iconEl = <Sparkles className="w-5 h-5 text-pink-300" />;

                const infoText = isUpgradedAtom
                  ? 'Đã nâng cấp: sức công phá ~x10 (bán kính 6.0 ô) và để lại Vùng Phóng Xạ 50 giây, làm suy kiệt quân, vàng và tài nguyên địch.'
                  : isUpgradedHydro
                  ? 'Đã nâng cấp: xóa sổ căn cứ và để lại Vùng Cháy thiêu đốt quân địch trong 15 giây.'
                  : m.description;

                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl border ${
                      m.id === 'MIRV'
                        ? 'bg-gradient-to-r from-pink-950/60 via-slate-900 to-purple-950/60 border-pink-400/70'
                        : m.id === 'HYDRO'
                        ? 'bg-gradient-to-r from-orange-950/60 via-slate-900 to-amber-950/60 border-orange-400/70'
                        : isUpgradedAtom
                        ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-amber-950/60 border-emerald-400/70'
                        : 'bg-slate-900 border-amber-400/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-xl bg-slate-950 border border-slate-700 shrink-0">{iconEl}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-black text-white text-base">{m.name}</h4>
                            {(isUpgradedAtom || isUpgradedHydro) && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400 text-sm font-black text-emerald-200">
                                ⚡ Nâng cấp
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-mono font-bold text-amber-300 flex flex-wrap items-center gap-x-2">
                            <span>💰 {formatPopulation(goldCost)}</span>
                            {areResourcesEnabled() && (resCost.oil > 0 || resCost.minerals > 0) && (
                              <span className="text-sky-200">
                                🛢️ {resCost.oil} <span className="text-violet-200">⛏️ {resCost.minerals}</span>
                              </span>
                            )}
                            <span className="text-slate-100">• ⭕ {effectiveRadius}</span>
                          </div>
                        </div>
                      </div>
                      <InfoButton active={openInfo === m.id} onClick={() => toggle(m.id)} />
                    </div>

                    {openInfo === m.id && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-950/95 border border-slate-600 text-sm text-slate-100 leading-relaxed space-y-1">
                        <p>{infoText}</p>
                        <p className={m.id === 'MIRV' ? 'text-emerald-200 font-bold' : 'text-amber-200 font-bold'}>
                          {m.id === 'MIRV'
                            ? '✅ Không thể bị phòng không (SAM) chặn.'
                            : '🛡️ SAM địch có 75% cơ hội đánh chặn.'}
                        </p>
                      </div>
                    )}

                    <button
                      disabled={!canLaunch}
                      onClick={() => { onClose(); onSelectMissile(m.id); }}
                      className={`mt-2.5 w-full min-h-[46px] py-2.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        canLaunch
                          ? m.id === 'MIRV'
                            ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white'
                            : m.id === 'HYDRO'
                            ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white'
                            : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 border border-slate-600 cursor-not-allowed opacity-70'
                      }`}
                    >
                      <Rocket className="w-4 h-4" />
                      {!hasReadySilo
                        ? 'Đang hồi chiêu'
                        : !hasEnoughGold
                        ? `Thiếu ${formatPopulation(goldCost - playerNation.gold)} Vàng`
                        : !hasEnoughRes
                        ? 'Thiếu Dầu / Khoáng sản'
                        : 'Khai hỏa'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* NỘI DUNG TAB TÀU THUYỀN (CHỈ HẢI QUÂN: TÀU KHAI THÁC & TÀU CHIẾN, KHÔNG HIỆN TÀU THƯƠNG) */}
        {activeTab === 'NAVAL' && (
          <div className="p-3 overflow-y-auto space-y-3 flex-1">
            {/* 1. Bản đồ biển thu nhỏ + Bật/tắt Vùng kiểm soát biển */}
            <div className="bg-slate-950/90 border border-sky-500/40 rounded-2xl p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-sky-200 uppercase tracking-wide">
                  🗺️ Tổng quan Biển &amp; Hạm đội
                </span>
                {onToggleSeaControl && (
                  <button
                    type="button"
                    onClick={onToggleSeaControl}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border ${
                      showSeaControl
                        ? 'bg-sky-700 border-sky-400 text-white'
                        : 'bg-slate-800 border-slate-600 text-slate-300'
                    }`}
                  >
                    🌊 Vùng biển: {showSeaControl ? 'Bật' : 'Tắt'}
                  </button>
                )}
              </div>
              <SeaOverviewMiniCanvas
                data={data}
                playerNationId={playerNation.id}
                fogOfWarEnabled={fogOfWarEnabled}
                fogGrid={fogGridRef?.current || null}
                showSeaControl={showSeaControl}
                onFocusMap={(mx, my) => {
                  onFocusMap?.(mx, my);
                }}
              />
            </div>

            {/* 2. Đóng tàu tại Hải Cảng */}
            <div className="bg-slate-950/90 border border-slate-700 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black text-white">⚓ Đóng tàu tại Hải Cảng</div>
                <InfoButton active={openInfo === 'build_ship'} onClick={() => toggle('build_ship')} />
              </div>
              {openInfo === 'build_ship' && (
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-600 text-xs text-slate-200 space-y-1">
                  <div>🛢️ <b>Tàu Khai Thác</b>: tự tìm &amp; hút Mỏ Dầu Biển ngoài khơi (tối đa 2/cảng, 16/quốc gia).</div>
                  <div>⚓ <b>Tàu Chiến</b>: kiểm soát biển bán kính 8 ô, đánh tàu địch, hộ tống, chở quân đổ bộ &amp; chiếm tàu vô chủ (tối đa 3/cảng, 12/quốc gia). Hủy đóng tàu hoàn 50%.</div>
                </div>
              )}

              {openPorts.length === 0 ? (
                <div className="p-2.5 bg-amber-950/60 border border-amber-500/50 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-100">
                  <span>
                    {ownedPorts.length > 0
                      ? 'Hải Cảng hiện tại nằm ở hồ kín hoặc vừa chiếm, chưa thông ra biển mở.'
                      : 'Chưa có Hải Cảng ven biển mở. Hãy xây Hải Cảng để đóng tàu!'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBuildModal();
                    }}
                    className="min-h-[40px] px-3 py-1.5 bg-amber-400 text-slate-950 font-black rounded-xl shrink-0"
                  >
                    Xây Cảng
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {openPorts.map((p, idx) => {
                      const key = `${p.x}_${p.y}`;
                      const isSel = activePort && activePort.x === p.x && activePort.y === p.y;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedPortKey(key)}
                          className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border ${
                            isSel
                              ? 'bg-amber-400 text-slate-950 border-amber-200 font-black'
                              : 'bg-slate-800 text-slate-200 border-slate-600'
                          }`}
                        >
                          ⚓ Cảng #{idx + 1} ({p.x},{p.y})
                        </button>
                      );
                    })}
                  </div>

                  {activePort && (() => {
                    const counts = countPortShipsAndQueue(data, activePort.x, activePort.y, playerNation.id);
                    const extCfg = NAVAL_CONFIG.EXTRACTOR;
                    const warCfg = NAVAL_CONFIG.WARSHIP;
                    const canExt =
                      counts.extractorsActive + counts.extractorsQueued < extCfg.MAX_PER_PORT &&
                      counts.totalNationExtractors < extCfg.MAX_PER_NATION &&
                      counts.totalGlobalShips < NAVAL_CONFIG.MAX_GLOBAL_NAVAL_SHIPS &&
                      playerNation.gold >= extCfg.GOLD_COST &&
                      (playerNation.oil || 0) >= extCfg.OIL_COST &&
                      (playerNation.minerals || 0) >= extCfg.MINERAL_COST;
                    const canWar =
                      counts.warshipsActive + counts.warshipsQueued < warCfg.MAX_PER_PORT &&
                      counts.totalNationWarships < warCfg.MAX_PER_NATION &&
                      counts.totalGlobalShips < NAVAL_CONFIG.MAX_GLOBAL_NAVAL_SHIPS &&
                      playerNation.gold >= warCfg.GOLD_COST &&
                      (playerNation.oil || 0) >= warCfg.OIL_COST &&
                      (playerNation.minerals || 0) >= warCfg.MINERAL_COST;

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={!canExt}
                          onClick={() => {
                            const res = enqueueNavalShip(data, playerNation, activePort.x, activePort.y, 'EXTRACTOR');
                            onNotify?.(res.reason);
                            bump();
                          }}
                          className={`min-h-[52px] p-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                            canExt
                              ? 'bg-sky-900/80 hover:bg-sky-800 border-sky-400 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-black">
                            <span>🛢️ Đóng Tàu Khai Thác</span>
                            <span className="font-mono">
                              {counts.extractorsActive + counts.extractorsQueued}/{extCfg.MAX_PER_PORT}
                            </span>
                          </div>
                          <div className="text-xs font-mono text-amber-200 mt-1">
                            💰{extCfg.GOLD_COST} • 🛢️{extCfg.OIL_COST} • ⛏️{extCfg.MINERAL_COST} • ⏱️{extCfg.BUILD_TIME_SECONDS}s
                          </div>
                        </button>

                        <button
                          type="button"
                          disabled={!canWar}
                          onClick={() => {
                            const res = enqueueNavalShip(data, playerNation, activePort.x, activePort.y, 'WARSHIP');
                            onNotify?.(res.reason);
                            bump();
                          }}
                          className={`min-h-[52px] p-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                            canWar
                              ? 'bg-amber-900/80 hover:bg-amber-800 border-amber-400 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 cursor-not-allowed opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-black">
                            <span>⚓ Đóng Tàu Chiến</span>
                            <span className="font-mono">
                              {counts.warshipsActive + counts.warshipsQueued}/{warCfg.MAX_PER_PORT}
                            </span>
                          </div>
                          <div className="text-xs font-mono text-amber-200 mt-1">
                            💰{warCfg.GOLD_COST} • 🛢️{warCfg.OIL_COST} • ⛏️{warCfg.MINERAL_COST} • ⏱️{warCfg.BUILD_TIME_SECONDS}s
                          </div>
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Hàng đợi đang đóng */}
              {playerBuildQueues.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-slate-800">
                  <div className="text-xs font-bold text-slate-300">⏳ Đang đóng ({playerBuildQueues.length}):</div>
                  {playerBuildQueues.map((q) => {
                    const pct = Math.max(0, Math.min(100, ((q.totalTime - q.remainingTime) / Math.max(1, q.totalTime)) * 100));
                    return (
                      <div key={q.id} className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between font-bold text-white">
                            <span>{q.shipType === 'EXTRACTOR' ? '🛢️ Tàu Khai Thác' : '⚓ Tàu Chiến'} ({q.portX},{q.portY})</span>
                            <span className="font-mono text-cyan-300">{Math.ceil(q.remainingTime)}s</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-cyan-400 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const res = cancelNavalQueueItem(data, playerNation, q.id);
                            onNotify?.(res.reason);
                            bump();
                          }}
                          className="min-h-[40px] px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 border border-rose-400/70 text-rose-100 font-bold rounded-lg shrink-0"
                        >
                          Hủy (50%)
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Hạm đội (Tàu Chiến <= 6/hạm đội) */}
            <div className="bg-slate-950/90 border border-slate-700 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-black text-white">
                  ⚓ Tàu Chiến ({playerWarships.length}/{NAVAL_CONFIG.WARSHIP.MAX_PER_NATION})
                </div>
                {selectedForFleet.length >= 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = createOrJoinFleet(data, playerNation.id, selectedForFleet);
                      onNotify?.(res.reason);
                      setSelectedForFleet([]);
                      bump();
                    }}
                    className="min-h-[40px] px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs rounded-xl border border-cyan-300"
                  >
                    + Lập Hạm Đội ({selectedForFleet.length}/{NAVAL_CONFIG.FLEET.MAX_SHIPS})
                  </button>
                )}
              </div>

              {fleets.length > 0 && (
                <div className="space-y-2">
                  {fleets.map(([fid, members], fIdx) => (
                    <div key={fid} className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-cyan-200">
                          🛡️ Hạm đội #{fIdx + 1} ({members.length}/{NAVAL_CONFIG.FLEET.MAX_SHIPS} tàu • +2 tầm nhìn)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            disbandFleet(data, playerNation.id, fid);
                            bump();
                          }}
                          className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg font-bold shrink-0"
                        >
                          Giải tán
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartNavalAiming?.({ mode: 'FLEET_MOVE', fleetId: fid });
                          }}
                          className="min-h-[40px] px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white font-bold rounded-lg"
                        >
                          📍 Di chuyển hạm đội
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onStartNavalAiming?.({ mode: 'FLEET_PATROL', fleetId: fid });
                          }}
                          className="min-h-[40px] px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold rounded-lg"
                        >
                          🛡️ Tuần tra
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const res = issueFleetOrder(data, playerNation.id, fid, 'RETREAT');
                            onNotify?.(res.reason);
                            bump();
                          }}
                          className="min-h-[40px] px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-lg"
                        >
                          ⚓ Về cảng
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {playerWarships.length === 0 ? (
                <div className="text-xs text-slate-400">Chưa có Tàu Chiến nào đang hoạt động.</div>
              ) : (
                <div className="space-y-2.5">
                  {playerWarships.map((w, idx) => {
                    const nearCoast = isShipNearOwnedCoast(tiles, playerNation.id, w.x, w.y, 2.8);
                    const isChecked = selectedForFleet.includes(w.id);
                    const fleetIndex = w.fleetId ? fleets.findIndex(([id]) => id === w.fleetId) + 1 : 0;
                    const hpPct = Math.round((w.hp / Math.max(1, w.maxHp)) * 100);
                    const stateText = getNavalStateLabel(w.state);
                    return (
                      <div key={w.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {!w.fleetId && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    if (selectedForFleet.length < NAVAL_CONFIG.FLEET.MAX_SHIPS) {
                                      setSelectedForFleet((prev) => [...prev, w.id]);
                                    }
                                  } else {
                                    setSelectedForFleet((prev) => prev.filter((id) => id !== w.id));
                                  }
                                }}
                                className="w-5 h-5 accent-cyan-400 shrink-0"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => onFocusMap?.(w.x, w.y)}
                              className="min-h-[40px] font-black text-white hover:text-cyan-200 text-left truncate flex items-center gap-1.5"
                              title="Bấm để xem vị trí tàu trên bản đồ"
                            >
                              <Crosshair className="w-4 h-4 text-cyan-300 shrink-0" />
                              <span>Tàu Chiến #{idx + 1}</span>
                              <span className="text-slate-400 font-mono font-normal">({Math.round(w.x)},{Math.round(w.y)})</span>
                            </button>
                            {fleetIndex > 0 && (
                              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 font-bold shrink-0">
                                HĐ#{fleetIndex}
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-emerald-300 shrink-0">
                            ❤️ {Math.round(w.hp)}/{w.maxHp} ({hpPct}%)
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300">
                          <span className="truncate">Trạng thái: <strong className="text-amber-200">{stateText}</strong></span>
                          <span>👥 Quân: <strong className="text-sky-200 font-mono">{w.carriedTroops || 0}/{w.maxTroopCapacity || 0}</strong></span>
                          <span>Quy mô: <strong className="text-cyan-200">{w.scaleTier === 3 ? 'Lớn' : w.scaleTier === 2 ? 'Vừa' : 'Nhỏ'}</strong></span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onStartNavalAiming?.({ mode: 'MOVE', shipId: w.id });
                            }}
                            className="min-h-[40px] px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white font-bold rounded-lg"
                          >
                            📍 Di chuyển
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onStartNavalAiming?.({ mode: 'PATROL', shipId: w.id });
                            }}
                            className="min-h-[40px] px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white font-bold rounded-lg"
                          >
                            🛡️ Tuần tra
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onStartNavalAiming?.({ mode: 'ATTACK', shipId: w.id });
                            }}
                            className="min-h-[40px] px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-lg"
                          >
                            ⚔️ Tấn công
                          </button>

                          {nearCoast && (w.carriedTroops || 0) > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const res = unloadTroopsAtCoast(data, w);
                                onNotify?.(res.reason);
                                bump();
                              }}
                              className="min-h-[40px] px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg"
                            >
                              ↩️ Trả quân
                            </button>
                          )}

                          {w.hp < w.maxHp && !w.isRepairing && (
                            <button
                              type="button"
                              onClick={() => {
                                const res = startWarshipSeaRepair(w);
                                onNotify?.(res.reason);
                                bump();
                              }}
                              className="min-h-[40px] px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-lg"
                            >
                              🔧 Sửa (2💰/HP)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const res = issueWarshipOrder(data, w, 'RETREAT');
                              onNotify?.(res.reason);
                              bump();
                            }}
                            className="min-h-[40px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold rounded-lg"
                          >
                            ⚓ Về cảng
                          </button>

                          {/* Hộ tống tàu khai thác / đồng đội */}
                          {playerNavalShips.length > 1 && (
                            <select
                              value={w.order === 'ESCORT' && w.escortShipId ? w.escortShipId : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                  issueWarshipOrder(data, w, 'AUTO');
                                } else {
                                  const res = issueWarshipOrder(data, w, 'ESCORT', { escortShipId: val });
                                  onNotify?.(res.reason);
                                }
                                bump();
                              }}
                              className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-xs font-bold"
                            >
                              <option value="">🤝 Hộ tống...</option>
                              {playerNavalShips
                                .filter((other) => other.id !== w.id)
                                .map((other, oIdx) => (
                                  <option key={other.id} value={other.id}>
                                    {other.type === 'EXTRACTOR' ? `🛢️ Khai Thác #${oIdx + 1}` : `⚓ Tàu Chiến #${oIdx + 1}`} ({Math.round(other.x)},{Math.round(other.y)})
                                  </option>
                                ))}
                            </select>
                          )}

                          {w.fleetId && (
                            <button
                              type="button"
                              onClick={() => {
                                leaveFleet(data, w.id);
                                bump();
                              }}
                              className="min-h-[40px] px-3 py-1.5 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg font-bold"
                            >
                              Rời HĐ
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Tàu Khai Thác (chỉ định Mỏ Dầu Biển) */}
            <div className="bg-slate-950/90 border border-slate-700 rounded-2xl p-3 space-y-2.5">
              <div className="text-sm font-black text-white">
                🛢️ Tàu Khai Thác ({playerExtractors.length}/{NAVAL_CONFIG.EXTRACTOR.MAX_PER_NATION})
              </div>
              {playerExtractors.length === 0 ? (
                <div className="text-xs text-slate-400">Chưa có Tàu Khai Thác nào.</div>
              ) : (
                <div className="space-y-2.5">
                  {playerExtractors.map((ex, idx) => (
                    <div key={ex.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onFocusMap?.(ex.x, ex.y)}
                          className="min-h-[40px] font-black text-sky-200 hover:text-white flex items-center gap-1.5 text-left"
                        >
                          <Crosshair className="w-4 h-4 shrink-0" />
                          <span>Tàu Khai Thác #{idx + 1}</span>
                          <span className="text-slate-400 font-mono font-normal">({Math.round(ex.x)},{Math.round(ex.y)})</span>
                        </button>
                        <span className="font-mono text-emerald-300 font-bold shrink-0">
                          ❤️ {Math.round(ex.hp)}/{ex.maxHp}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300">
                        <span>
                          Trạng thái: <strong className="text-amber-200">{getNavalStateLabel(ex.state)}</strong>
                          {typeof ex.assignedDepositX === 'number' && typeof ex.assignedDepositY === 'number'
                            ? ` • Mỏ (${ex.assignedDepositX},${ex.assignedDepositY})`
                            : ''}
                        </span>
                        <span className="font-mono text-sky-300 font-bold">Đã hút: {Math.round(ex.extractedTotal || 0)}🛢️</span>
                      </div>
                      {discoveredSeaOils.length > 0 && (
                        <select
                          value={
                            typeof ex.assignedDepositX === 'number' && typeof ex.assignedDepositY === 'number'
                              ? `${ex.assignedDepositX}_${ex.assignedDepositY}`
                              : ''
                          }
                          onChange={(e) => {
                            const [dxStr, dyStr] = e.target.value.split('_');
                            const dx = Number(dxStr);
                            const dy = Number(dyStr);
                            if (Number.isFinite(dx) && Number.isFinite(dy)) {
                              const res = assignExtractorDeposit(data, ex, dx, dy);
                              onNotify?.(res.reason);
                              bump();
                            }
                          }}
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-xs font-bold"
                        >
                          <option value="">Chọn Mỏ Dầu Biển chỉ định...</option>
                          {discoveredSeaOils.map((dep) => {
                            const key = `${dep.x}_${dep.y}`;
                            const claimed = isDepositClaimedByOtherExtractor(data, dep.x, dep.y, ex.id);
                            const allowed = hasSeaOilExtractionRight(data, playerNation.id, dep.x, dep.y);
                            return (
                              <option key={key} value={key} disabled={claimed || !allowed}>
                                Mỏ ({dep.x},{dep.y}) • {formatResource(dep.reserve)}🛢️
                                {claimed ? ' [Đã có tàu]' : !allowed ? ' [Địch kiểm soát]' : ''}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
