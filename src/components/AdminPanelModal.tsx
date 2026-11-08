import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db, verifyAdminOnServer, isUserAdmin, syncProfileToFirestore, ADMIN_EMAIL } from '../firebase';
import { PlayerProfile, Nation, GeneralSkillId } from '../types';
import { GENERAL_ROSTER } from '../utils/constants';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Coins,
  Users,
  Swords,
  Rocket,
  Zap,
  Gauge,
  Infinity as InfinityIcon,
  RotateCcw,
  Bot,
  Plus,
  Trash2,
  TrendingUp,
  Crown,
  Check,
  Flame,
  Star,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: FirebaseUser | null;
  playerProfile: PlayerProfile;
  onUpdateProfile: (profile: PlayerProfile) => void;
  gameDataRef: React.MutableRefObject<any>;
  gameSpeed: number;
  setGameSpeed: (s: number) => void;
  infiniteResources: boolean;
  setInfiniteResources: (val: boolean) => void;
  noCooldown: boolean;
  setNoCooldown: (val: boolean) => void;
  onResetCooldowns: () => void;
  onAddMissiles: (type: 'ATOM' | 'HYDRO' | 'MIRV', count: number) => void;
  onAddSilos: (count: number) => void;
  onAddBot: () => void;
  onRemoveBot: (botId: number) => void;
  onAdjustBotPower: (botId: number, multiplier: number) => void;
  onRefreshGameStats: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  playerProfile,
  onUpdateProfile,
  gameDataRef,
  gameSpeed,
  setGameSpeed,
  infiniteResources,
  setInfiniteResources,
  noCooldown,
  setNoCooldown,
  onResetCooldowns,
  onAddMissiles,
  onAddSilos,
  onAddBot,
  onRemoveBot,
  onAdjustBotPower,
  onRefreshGameStats,
}) => {
  const [activeTab, setActiveTab] = useState<'RESOURCES' | 'PROGRESSION' | 'MISSILES_SPEED' | 'BOTS' | 'SERVER'>('RESOURCES');
  const [serverVerified, setServerVerified] = useState<boolean | null>(null);
  const [serverStatusText, setServerStatusText] = useState<string>('Đang kiểm tra quyền Server Firestore...');

  // State inputs for Player Nation stats
  const [customGold, setCustomGold] = useState<string>('999999');
  const [customTroops, setCustomTroops] = useState<string>('100000');
  const [customPopulation, setCustomPopulation] = useState<string>('50000');
  const [customFoodYield, setCustomFoodYield] = useState<string>('100');

  // State inputs for Progression
  const [customLevel, setCustomLevel] = useState<number>(playerProfile.level);
  const [customExp, setCustomExp] = useState<number>(playerProfile.exp);
  const [customPixelCoins, setCustomPixelCoins] = useState<number>(playerProfile.pixelCoins);
  const [customSkillPoints, setCustomSkillPoints] = useState<number>(playerProfile.skillPoints || 0);

  const [notification, setNotification] = useState<string | null>(null);

  // Sync inputs from current player nation when opened
  useEffect(() => {
    if (isOpen && gameDataRef.current) {
      const p = gameDataRef.current.nations?.[1];
      if (p) {
        setCustomGold(String(p.gold || 0));
        setCustomTroops(String(p.troops || 0));
        setCustomPopulation(String(p.population || 0));
      }
      setCustomLevel(playerProfile.level);
      setCustomExp(playerProfile.exp);
      setCustomPixelCoins(playerProfile.pixelCoins);
      setCustomSkillPoints(playerProfile.skillPoints || 0);
    }
  }, [isOpen, playerProfile, gameDataRef]);

  // Kiểm tra quyền Admin thực tế bằng Firestore Security Rules trên máy chủ
  useEffect(() => {
    if (isOpen && currentUser) {
      setServerVerified(null);
      setServerStatusText('Đang gửi truy vấn ghi tới Firestore để kiểm tra rules phía server...');
      verifyAdminOnServer(currentUser)
        .then((ok) => {
          setServerVerified(ok);
          if (ok) {
            setServerStatusText('✅ Máy chủ Firestore đã xác nhận quyền Admin hợp lệ qua Security Rules!');
          } else {
            setServerStatusText('❌ Quyền Admin bị máy chủ từ chối (Firestore Rules rejected).');
          }
        })
        .catch((err) => {
          setServerVerified(false);
          setServerStatusText(`❌ Lỗi kết nối Firestore: ${err?.message || err}`);
        });
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Lớp phòng thủ: Người không phải admin tuyệt đối không được hiển thị/dùng
  if (!isUserAdmin(currentUser)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
        <div className="bg-slate-900 border border-red-500/80 rounded-2xl p-6 max-w-sm text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Truy Cập Bị Từ Chối</h3>
          <p className="text-xs text-slate-400 mb-4">
            Tính năng Admin Panel chỉ dành riêng cho quản trị viên tối cao: <br />
            <strong className="text-amber-400">{ADMIN_EMAIL}</strong>
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // 1. ÁP DỤNG THAY ĐỔI TÀI NGUYÊN (Vàng, Lương thực, Dân số, Quân số)
  const applyNationStats = () => {
    const data = gameDataRef.current;
    if (!data || !data.nations?.[1]) {
      showToast('⚠️ Không tìm thấy người chơi trong trận đấu.');
      return;
    }
    const p: Nation = data.nations[1];
    const g = parseInt(customGold, 10);
    const t = parseInt(customTroops, 10);
    const pop = parseInt(customPopulation, 10);

    if (!isNaN(g)) p.gold = Math.max(0, g);
    if (!isNaN(t)) {
      p.troops = Math.max(0, t);
      p.maxTroops = Math.max(p.maxTroops, t * 1.5);
    }
    if (!isNaN(pop)) {
      p.population = Math.max(0, pop);
      p.populationCap = Math.max(p.populationCap || 1000, pop * 1.2);
    }
    onRefreshGameStats();
    showToast(`✅ Đã cập nhật: ${g.toLocaleString()} Vàng, ${t.toLocaleString()} Quân, ${pop.toLocaleString()} Dân!`);
  };

  // 2. ÁP DỤNG THAY ĐỔI TIẾN TRÌNH & CẤP ĐỘ
  const applyProgression = async () => {
    const updated: PlayerProfile = {
      ...playerProfile,
      level: Math.min(10, Math.max(1, customLevel)),
      exp: Math.max(0, customExp),
      pixelCoins: Math.max(0, customPixelCoins),
      skillPoints: Math.max(0, customSkillPoints),
    };
    onUpdateProfile(updated);
    if (currentUser) {
      await syncProfileToFirestore(currentUser, updated);
    }
    showToast(`✅ Đã lưu Cấp ${updated.level}, ${updated.exp} EXP, ${updated.pixelCoins} Xu, ${updated.skillPoints} Điểm Kỹ Năng lên Cloud!`);
  };

  // 3. MỞ KHÓA TẤT CẢ 5 TƯỚNG & KỸ NĂNG
  const unlockAllGenerals = async () => {
    const allSkills: GeneralSkillId[] = [
      'INSPIRE_AURA',
      'IRON_BORDER_SHIELD',
      'SUPPLY_REINFORCE',
      'SHADOW_RAID',
      'MISSILE_BARRAGE',
    ];
    const updated: PlayerProfile = {
      ...playerProfile,
      level: 10,
      purchasedGenerals: allSkills,
      pixelCoins: Math.max(playerProfile.pixelCoins, 10000),
    };
    onUpdateProfile(updated);
    if (currentUser) {
      await syncProfileToFirestore(currentUser, updated);
    }
    showToast('🎉 Đã mở khóa toàn bộ 5 Tướng, Kỹ năng và thăng cấp tối đa Lv10!');
  };

  // 4. RESET CÂY KỸ NĂNG CHO TEST
  const adminResetSkillTree = async () => {
    const { economyLevel, militaryLevel, heroLevel, chosenHybrid } = playerProfile.skillTree;
    const spent = economyLevel + militaryLevel + heroLevel + (chosenHybrid ? 1 : 0);
    const updated: PlayerProfile = {
      ...playerProfile,
      skillPoints: (playerProfile.skillPoints || 0) + spent,
      skillTree: {
        economyLevel: 0,
        militaryLevel: 0,
        heroLevel: 0,
        chosenHybrid: null,
      },
    };
    setCustomSkillPoints(updated.skillPoints);
    onUpdateProfile(updated);
    if (currentUser) {
      await syncProfileToFirestore(currentUser, updated);
    }
    showToast(`🔄 [Admin] Đã reset Cây Kỹ Năng và hoàn trả ${spent} điểm kỹ năng!`);
  };

  // 5. MAX CÂY KỸ NĂNG TEST
  const adminMaxSkillTree = async () => {
    const updated: PlayerProfile = {
      ...playerProfile,
      skillTree: {
        economyLevel: 10,
        militaryLevel: 10,
        heroLevel: 10,
        chosenHybrid: playerProfile.skillTree.chosenHybrid || 'ECONOMY_MILITARY',
      },
    };
    onUpdateProfile(updated);
    if (currentUser) {
      await syncProfileToFirestore(currentUser, updated);
    }
    showToast('⚡ [Admin] Đã kích hoạt Cấp 10 toàn bộ 3 nhánh Cây Kỹ Năng!');
  };

  // 6. ĐẶT LẠI TIẾN TRÌNH VỀ BAN ĐẦU
  const resetProgression = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn đặt lại toàn bộ tiến trình game về cấp 1 ban đầu?')) {
      return;
    }
    const initial: PlayerProfile = {
      level: 1,
      exp: 0,
      pixelCoins: 0,
      purchasedGenerals: [],
      selectedGeneral: 'INSPIRE_AURA',
      skillPoints: 3,
      skillTree: {
        economyLevel: 0,
        militaryLevel: 0,
        heroLevel: 0,
        chosenHybrid: null,
      },
    };
    setCustomLevel(1);
    setCustomExp(0);
    setCustomPixelCoins(0);
    setCustomSkillPoints(3);
    onUpdateProfile(initial);
    if (currentUser) {
      await syncProfileToFirestore(currentUser, initial);
    }
    showToast('🔄 Đã đặt lại tiến trình game về ban đầu!');
  };

  // 5. ĐỒNG BỘ CẤU HÌNH ADMIN LÊN FIRESTORE (SERVER-SIDE RULES ENFORCED)
  const syncAdminConfigToServer = async () => {
    if (!currentUser) return;
    try {
      const configRef = doc(db, 'admin_configs', 'global');
      await setDoc(configRef, {
        id: 'global',
        updatedBy: currentUser.uid,
        adminEmail: currentUser.email,
        infiniteResources,
        gameSpeed,
        noCooldown,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      showToast('☁️ Cấu hình Admin đã được kiểm duyệt & lưu trên Firestore thành công!');
    } catch (err: any) {
      showToast(`❌ Lỗi quyền server: ${err.message}`);
    }
  };

  const currentBots: Nation[] = gameDataRef.current?.nations
    ? gameDataRef.current.nations.filter((n: Nation) => n && !n.isPlayer && !n.isEliminated)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border-2 border-amber-500/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header Admin Panel */}
        <div className="p-4 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-500/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/60 shadow">
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-amber-300">
                  ADMIN PANEL • QUẢN TRỊ VIÊN TỐI CAO
                </h2>
                <span className="text-[10px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full uppercase">
                  Server Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Đặc quyền quản trị server cho <strong>{currentUser?.email}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thông báo Server Status */}
        <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {serverVerified === true ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : serverVerified === false ? (
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            )}
            <span className={serverVerified ? 'text-emerald-300' : 'text-slate-300'}>
              {serverStatusText}
            </span>
          </div>
          <button
            onClick={syncAdminConfigToServer}
            className="text-[10px] px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded border border-amber-500/40"
          >
            Lưu Lên Server
          </button>
        </div>

        {/* Toast thông báo hành động */}
        {notification && (
          <div className="mx-4 mt-3 p-2.5 bg-amber-500/20 border border-amber-400 rounded-xl text-xs text-amber-200 font-bold flex items-center gap-2 animate-bounce">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Thanh Tabs chuyển đổi */}
        <div className="flex bg-slate-950/80 border-b border-slate-800 px-3 pt-2 gap-1 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('RESOURCES')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'RESOURCES'
                ? 'bg-slate-900 text-amber-400 border-t-2 border-amber-400 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Tài Nguyên Quốc Gia</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PROGRESSION')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'PROGRESSION'
                ? 'bg-slate-900 text-amber-400 border-t-2 border-amber-400 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Cấp Độ & Tướng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MISSILES_SPEED')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'MISSILES_SPEED'
                ? 'bg-slate-900 text-amber-400 border-t-2 border-amber-400 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Tên Lửa & Tốc Độ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BOTS')}
            className={`px-3 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'BOTS'
                ? 'bg-slate-900 text-amber-400 border-t-2 border-amber-400 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Bot Test & Sức Mạnh</span>
          </button>
        </div>

        {/* Nội dung Tab */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: TÀI NGUYÊN QUỐC GIA */}
          {activeTab === 'RESOURCES' && (
            <div className="space-y-4">
              {/* TOGGLE KHÔNG GIỚI HẠN TÀI NGUYÊN (GOD MODE) */}
              <div className="p-3.5 bg-gradient-to-r from-amber-950/60 to-purple-950/60 rounded-2xl border border-amber-500/50 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-amber-300 flex items-center gap-2">
                    <InfinityIcon className="w-5 h-5 text-amber-400" />
                    <span>Bật Không Giới Hạn Tài Nguyên (God Mode)</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Tự động giữ Vàng 9,999,999, Quân đội liên tục hồi tối đa và miễn phí mọi công trình.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !infiniteResources;
                    setInfiniteResources(next);
                    if (next && gameDataRef.current?.nations?.[1]) {
                      gameDataRef.current.nations[1].gold = 9999999;
                      gameDataRef.current.nations[1].troops = 500000;
                      gameDataRef.current.nations[1].maxTroops = 1000000;
                      onRefreshGameStats();
                    }
                    showToast(next ? '♾️ Đã BẬT Không giới hạn tài nguyên!' : 'Đã TẮT Không giới hạn tài nguyên.');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all shadow ${
                    infiniteResources
                      ? 'bg-emerald-600 text-white shadow-emerald-600/40 border border-emerald-400'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {infiniteResources ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                </button>
              </div>

              {/* TÙY CHỈNH TỪNG CHỈ SỐ NHẬP SỐ BẤT KỲ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* VÀNG */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Coins className="w-4 h-4" /> Vàng Quốc Gia:
                  </label>
                  <input
                    type="number"
                    value={customGold}
                    onChange={(e) => setCustomGold(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:border-amber-500 outline-none"
                    placeholder="Nhập số vàng..."
                  />
                  <div className="flex gap-1.5">
                    {['10000', '100000', '1000000', '9999999'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCustomGold(v)}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded-lg font-mono"
                      >
                        +{parseInt(v, 10) >= 1000000 ? `${parseInt(v, 10) / 1000000}M` : `${parseInt(v, 10) / 1000}k`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* QUÂN ĐỘI */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <Swords className="w-4 h-4" /> Quân Đội:
                  </label>
                  <input
                    type="number"
                    value={customTroops}
                    onChange={(e) => setCustomTroops(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:border-rose-500 outline-none"
                    placeholder="Nhập quân số..."
                  />
                  <div className="flex gap-1.5">
                    {['5000', '50000', '500000', '2000000'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCustomTroops(v)}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded-lg font-mono"
                      >
                        +{parseInt(v, 10) >= 1000000 ? `${parseInt(v, 10) / 1000000}M` : `${parseInt(v, 10) / 1000}k`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DÂN SỐ */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> Dân Số Quốc Gia:
                  </label>
                  <input
                    type="number"
                    value={customPopulation}
                    onChange={(e) => setCustomPopulation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:border-sky-500 outline-none"
                    placeholder="Nhập dân số..."
                  />
                  <div className="flex gap-1.5">
                    {['10000', '50000', '200000', '1000000'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCustomPopulation(v)}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded-lg font-mono"
                      >
                        +{parseInt(v, 10) >= 1000000 ? `${parseInt(v, 10) / 1000000}M` : `${parseInt(v, 10) / 1000}k`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* LƯƠNG THỰC / SẢN XUẤT */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Hệ Số Sản Xuất / Lương Thực:
                  </label>
                  <input
                    type="number"
                    value={customFoodYield}
                    onChange={(e) => setCustomFoodYield(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:border-emerald-500 outline-none"
                    placeholder="Hệ số tăng trưởng %..."
                  />
                  <div className="flex gap-1.5">
                    {['50', '100', '300', '1000'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCustomFoodYield(v)}
                        className="flex-1 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded-lg font-mono"
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={applyNationStats}
                className="w-full py-3 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-600 text-white font-black rounded-2xl shadow-lg shadow-amber-950/40 text-xs flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Áp Dụng Thay Đổi Tài Nguyên Ngay</span>
              </button>
            </div>
          )}

          {/* TAB 2: TIẾN TRÌNH & CẤP ĐỘ, TƯỚNG */}
          {activeTab === 'PROGRESSION' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* CẤP ĐỘ */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-amber-400">Cấp Độ (1-10):</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={customLevel}
                    onChange={(e) => setCustomLevel(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm"
                  />
                  <div className="flex gap-1">
                    {[1, 5, 10].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setCustomLevel(lvl)}
                        className="flex-1 py-1 bg-slate-800 text-[10px] rounded"
                      >
                        Lv.{lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KINH NGHIỆM */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-blue-400">EXP:</label>
                  <input
                    type="number"
                    value={customExp}
                    onChange={(e) => setCustomExp(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm"
                  />
                  <div className="flex gap-1">
                    {[100, 1000, 5000].map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setCustomExp(ex)}
                        className="flex-1 py-1 bg-slate-800 text-[10px] rounded"
                      >
                        +{ex}
                      </button>
                    ))}
                  </div>
                </div>

                {/* XU PIXEL */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-amber-300">Xu Pixel:</label>
                  <input
                    type="number"
                    value={customPixelCoins}
                    onChange={(e) => setCustomPixelCoins(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm"
                  />
                  <div className="flex gap-1">
                    {[500, 2000, 10000].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCustomPixelCoins(c)}
                        className="flex-1 py-1 bg-slate-800 text-[10px] rounded"
                      >
                        +{c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ĐIỂM KỸ NĂNG */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-amber-500/40 space-y-2">
                  <label className="text-xs font-bold text-yellow-300">Điểm Kỹ Năng:</label>
                  <input
                    type="number"
                    value={customSkillPoints}
                    onChange={(e) => setCustomSkillPoints(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 bg-slate-900 border border-amber-500/50 rounded-xl text-white font-mono font-bold text-sm"
                  />
                  <div className="flex gap-1">
                    {[3, 10, 30].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCustomSkillPoints(p)}
                        className="flex-1 py-1 bg-amber-950 text-amber-300 text-[10px] rounded font-bold"
                      >
                        +{p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={applyProgression}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Lưu Cấp Độ, EXP & Điểm Kỹ Năng Lên Cloud Firestore</span>
              </button>

              {/* TEST CÂY KỸ NĂNG */}
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-yellow-500/40 space-y-2">
                <div className="text-xs font-bold text-yellow-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Quản Lý & Kiểm Thử Cây Kỹ Năng (Skill Tree Testing)</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Kinh Tế: Cấp {playerProfile.skillTree?.economyLevel || 0}/10 • Quân Đội: Cấp {playerProfile.skillTree?.militaryLevel || 0}/10 • Anh Hùng: Cấp {playerProfile.skillTree?.heroLevel || 0}/10 • Mốc Kết Hợp: {playerProfile.skillTree?.chosenHybrid || 'Chưa chọn'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={adminResetSkillTree}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Cây Kỹ Năng (Hoàn Điểm Test)</span>
                  </button>
                  <button
                    type="button"
                    onClick={adminMaxSkillTree}
                    className="py-2.5 px-3 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow"
                  >
                    <Zap className="w-3.5 h-3.5 text-yellow-200" />
                    <span>Kích Hoạt Max 3 Nhánh (Lv10 Hết)</span>
                  </button>
                </div>
              </div>

              {/* MỞ KHÓA TẤT CẢ TƯỚNG & KỸ NĂNG */}
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/40 space-y-2.5">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-2">
                  <Crown className="w-4 h-4" />
                  <span>Mở Khóa Toàn Bộ 5 Đại Tướng & Kỹ Năng Thượng Thừa</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GENERAL_ROSTER.map((g) => {
                    const isUnlocked =
                      playerProfile.level >= 10 ||
                      (playerProfile.purchasedGenerals && playerProfile.purchasedGenerals.includes(g.skillId)) ||
                      g.unlockType === 'DEFAULT';
                    return (
                      <div
                        key={g.skillId}
                        className={`p-2 rounded-xl border text-[11px] flex items-center justify-between ${
                          isUnlocked ? 'bg-amber-950/40 border-amber-500/50 text-amber-200' : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="font-bold truncate">{g.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40">
                          {isUnlocked ? 'Đã mở' : 'Khóa'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={unlockAllGenerals}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-black rounded-xl text-xs shadow"
                >
                  🎖️ Mở Khóa Tất Cả 5 Tướng & Tặng 10,000 Xu Pixel
                </button>
              </div>

              {/* ĐẶT LẠI TIẾN TRÌNH */}
              <div className="p-3.5 bg-red-950/30 rounded-2xl border border-red-500/30 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-red-300">Đặt Lại Tiến Trình Về Ban Đầu</div>
                  <div className="text-[10px] text-slate-400">
                    Khởi tạo lại tài khoản về Cấp 1, 0 EXP, 0 Xu và Tướng mặc định.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetProgression}
                  className="px-3 py-1.5 bg-red-600/80 hover:bg-red-500 text-white font-bold rounded-xl text-xs flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Cấp 1</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: TÊN LỬA & TỐC ĐỘ, COOLDOWN */}
          {activeTab === 'MISSILES_SPEED' && (
            <div className="space-y-4">
              {/* TỐC ĐỘ GAME & COOLDOWN */}
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4" /> Tốc Độ Game (Trận Đấu):
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 5].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => {
                        setGameSpeed(spd);
                        showToast(`⚡ Tốc độ game đã chuyển sang ${spd}x`);
                      }}
                      className={`py-2.5 rounded-xl font-black text-xs border transition-all ${
                        gameSpeed === spd
                          ? 'bg-amber-600 border-amber-400 text-white shadow-lg'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Tốc độ {spd}x {spd === 1 ? '(Chuẩn)' : spd === 2 ? '(Nhanh)' : '(Siêu Tốc)'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-white">Xóa Thời Gian Chờ (Cooldown):</div>
                    <div className="text-[10px] text-slate-400">
                      Ngay lập tức xóa hồi chiêu Bệ phóng Silo, Tướng & Tà Thần về 0s.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onResetCooldowns();
                      showToast('⚡ Toàn bộ thời gian chờ đã được xóa về 0 giây!');
                    }}
                    className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-xl text-xs shadow flex items-center gap-1"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Xóa Cooldown Ngay</span>
                  </button>
                </div>

                {/* SWITCH KHÓA NO COOLDOWN */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-amber-300">Khóa Không Cooldown (Vĩnh Viễn 0s):</div>
                    <div className="text-[10px] text-slate-400">
                      Mỗi giây tự động ép toàn bộ hồi chiêu tên lửa & kỹ năng về 0s.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !noCooldown;
                      setNoCooldown(next);
                      if (next) onResetCooldowns();
                      showToast(next ? '⚡ Đã BẬT Khóa No Cooldown!' : 'Đã TẮT Khóa No Cooldown.');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                      noCooldown ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {noCooldown ? 'Đang BẬT' : 'Đang TẮT'}
                  </button>
                </div>
              </div>

              {/* TÊN LỬA VÀ MIRV */}
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-rose-500/40 space-y-3">
                <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <Rocket className="w-4 h-4" /> Bệ Phóng & Đòn Tấn Công Hạt Nhân Miễn Phí:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onAddMissiles('ATOM', 1);
                      showToast('🚀 Đã kích hoạt 1 đòn tên lửa ATOM miễn phí!');
                    }}
                    className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-left"
                  >
                    <div className="text-xs font-bold text-yellow-300">⚛️ Tên Lửa ATOM</div>
                    <div className="text-[10px] text-slate-400 mt-1">Bán kính 2.5 ô • Sát thương tiêu chuẩn</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAddMissiles('HYDRO', 1);
                      showToast('💣 Đã kích hoạt 1 đòn bom HYDRO miễn phí!');
                    }}
                    className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-left"
                  >
                    <div className="text-xs font-bold text-orange-400">💥 Bom HYDRO</div>
                    <div className="text-[10px] text-slate-400 mt-1">Bán kính 4.5 ô • Hủy diệt diện rộng</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onAddMissiles('MIRV', 1);
                      showToast('⚡ Đã kích hoạt 1 đòn siêu tên lửa MIRV (12 đầu đạn)!');
                    }}
                    className="p-3 bg-slate-900 hover:bg-slate-800 border border-rose-500/50 rounded-xl text-left"
                  >
                    <div className="text-xs font-bold text-rose-400">⚡ Siêu Tên Lửa MIRV</div>
                    <div className="text-[10px] text-slate-400 mt-1">12 đầu đạn con • Bỏ qua SAM 100%</div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onAddSilos(5);
                    showToast('🚀 Đã tự động xây thêm 5 Bệ Phóng Silo trên đất người chơi!');
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Xây Thêm 5 Bệ Phóng Silo Ngay Lập Tức</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: BOT TEST & SỨC MẠNH */}
          {activeTab === 'BOTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-amber-400" />
                    <span>Quản Lý Bot Trong Trận Đấu ({currentBots.length} Bot đang sống)</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Thêm bot mới để thử nghiệm, xóa bot hoặc buff/nerf sức mạnh bot.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onAddBot();
                    showToast('🤖 Đã thêm 1 Bot thử nghiệm mới vào bản đồ!');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Bot Mới</span>
                </button>
              </div>

              {currentBots.length === 0 ? (
                <div className="p-6 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                  Hiện không còn bot nào trên bản đồ (Bạn đã chiến thắng!). Bấm "Thêm Bot Mới" để sinh bot thử nghiệm.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {currentBots.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full shrink-0 border border-white/40"
                          style={{ backgroundColor: b.color }}
                        />
                        <div className="truncate">
                          <div className="font-bold text-white truncate flex items-center gap-1.5">
                            <span>{b.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded font-mono">
                              {b.tier || 'BOT'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>Quân: <strong className="text-rose-400 font-mono">{b.troops.toLocaleString()}</strong></span>
                            <span>Vàng: <strong className="text-amber-400 font-mono">{b.gold.toLocaleString()}</strong></span>
                            <span>Ô đất: <strong className="text-blue-400 font-mono">{b.territoryCount}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onAdjustBotPower(b.id, 0.2);
                            showToast(`Đã làm yếu bot ${b.name} (-80% quân)`);
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded font-bold"
                          title="Làm yếu bot"
                        >
                          Giảm 80%
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onAdjustBotPower(b.id, 3.0);
                            showToast(`Đã tăng sức mạnh bot ${b.name} (x3 quân)`);
                          }}
                          className="px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 text-[10px] rounded font-bold"
                          title="Tăng sức mạnh bot"
                        >
                          x3 Sức Mạnh
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onRemoveBot(b.id);
                            showToast(`Đã tiêu diệt bot ${b.name}!`);
                          }}
                          className="p-1.5 bg-red-950 hover:bg-red-900 text-red-400 rounded-lg border border-red-500/30"
                          title="Xóa / Tiêu diệt bot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Admin Panel */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400">
            Tài khoản: <strong className="text-white">{currentUser?.email}</strong> (Admin Quyền Năng)
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors"
          >
            Đóng Panel
          </button>
        </div>
      </div>
    </div>
  );
};
