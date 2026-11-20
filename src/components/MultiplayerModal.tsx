import React, { useState, useEffect } from 'react';
import { RoomState, RoomSettings } from '../multiplayer/types';
import { multiplayerClient } from '../multiplayer/multiplayerClient';
import { 
  Users, Copy, Check, Play, Crown, ArrowLeft, X, Sparkles, 
  Shield, Globe, Swords, AlertCircle, Share2
} from 'lucide-react';
import { MapDimension, GameDifficulty } from '../types';

interface MultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlayerName: string;
  onStartMultiplayerGame: (room: RoomState, myPlayerId: string) => void;
  initialRoomCode?: string | null;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
  onClose,
  defaultPlayerName,
  onStartMultiplayerGame,
  initialRoomCode,
}) => {
  const [tab, setTab] = useState<'SELECT' | 'CREATE' | 'JOIN' | 'LOBBY'>('SELECT');
  const [playerName, setPlayerName] = useState<string>(defaultPlayerName || 'Đại Đế');
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (initialRoomCode) {
      setRoomCodeInput(initialRoomCode.toUpperCase());
      setTab('JOIN');
    }
  }, [initialRoomCode]);

  useEffect(() => {
    // Đăng ký sự kiện từ WebSocket
    multiplayerClient.onRoomCreated = ({ room, myPlayerId }) => {
      setCurrentRoom(room);
      setMyPlayerId(myPlayerId);
      setTab('LOBBY');
      setIsLoading(false);
      setErrorMessage(null);
    };

    multiplayerClient.onRoomJoined = ({ room, myPlayerId }) => {
      setCurrentRoom(room);
      setMyPlayerId(myPlayerId);
      setTab('LOBBY');
      setIsLoading(false);
      setErrorMessage(null);
    };

    multiplayerClient.onRoomUpdated = (room) => {
      setCurrentRoom(room);
    };

    multiplayerClient.onGameStarted = (room) => {
      if (myPlayerId) {
        onStartMultiplayerGame(room, myPlayerId);
      }
    };

    multiplayerClient.onError = (msg) => {
      setErrorMessage(msg);
      setIsLoading(false);
      if (msg.includes('Không tìm thấy phòng')) {
        setRoomCodeInput('');
        try {
          if (window.location.search.includes('room=')) {
            history.replaceState(null, '', window.location.pathname);
          }
        } catch {}
      }
    };

    return () => {
      multiplayerClient.onRoomCreated = null;
      multiplayerClient.onRoomJoined = null;
      multiplayerClient.onRoomUpdated = null;
      multiplayerClient.onGameStarted = null;
      multiplayerClient.onError = null;
    };
  }, [myPlayerId, onStartMultiplayerGame]);

  if (!isOpen) return null;

  const isHost = currentRoom?.hostId === myPlayerId;
  const inviteLink = currentRoom ? `${window.location.origin}/?room=${currentRoom.code}` : '';

  const handleCopyCode = async () => {
    if (!currentRoom) return;
    try {
      await navigator.clipboard.writeText(currentRoom.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
      alert(`Mã phòng: ${currentRoom.code}`);
    }
  };

  const handleCopyLink = async () => {
    if (!currentRoom) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Vào phòng Pixel Empire',
          text: `Cùng chơi Pixel Empire với mình nhé! Mã phòng: ${currentRoom.code}`,
          url: inviteLink,
        });
        return;
      }
      await navigator.clipboard.writeText(inviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setErrorMessage('Vui lòng nhập tên của bạn!');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    await multiplayerClient.createRoom(playerName.trim());
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      setErrorMessage('Vui lòng nhập tên của bạn!');
      return;
    }
    if (!roomCodeInput.trim() || roomCodeInput.trim().length < 4) {
      setErrorMessage('Vui lòng nhập mã phòng hợp lệ (6 ký tự)!');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    await multiplayerClient.joinRoom(roomCodeInput.trim().toUpperCase(), playerName.trim());
  };

  const handleLeaveRoom = () => {
    multiplayerClient.leaveRoom();
    setCurrentRoom(null);
    setTab('SELECT');
    setErrorMessage(null);
  };

  const handleUpdateSettings = (changes: Partial<RoomSettings>) => {
    if (!isHost) return;
    multiplayerClient.updateSettings(changes);
  };

  const handleStartGame = () => {
    if (!isHost) return;
    multiplayerClient.startGame();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      style={{
        paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))'
      }}
    >
      <div className="relative w-full max-w-lg bg-slate-950 border-2 border-slate-600 rounded-3xl p-5 sm:p-7 shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Nút đóng */}
        <button
          onClick={() => {
            if (tab === 'LOBBY') {
              handleLeaveRoom();
            }
            onClose();
          }}
          className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-200 hover:text-white rounded-full bg-slate-800 border border-slate-600"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Modal */}
        <div className="flex items-center gap-3 mb-5 pr-12">
          <div className="p-3 bg-blue-600/25 border border-blue-400/60 rounded-2xl text-blue-300 shrink-0">
            <Users className="w-6 h-6 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center flex-wrap gap-2">
              Phòng Chơi Với Bạn Bè
              <span className="text-sm bg-blue-500/25 text-blue-200 font-bold px-2.5 py-0.5 rounded-full border border-blue-400/50">
                Online
              </span>
            </h2>
            <p className="text-sm text-slate-200">Tạo phòng riêng hoặc nhập mã để chiến cùng bạn bè</p>
          </div>
        </div>

        {/* Thông báo lỗi nếu có */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950 border border-rose-400/70 rounded-2xl flex items-center gap-2 text-rose-100 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. MÀN HÌNH CHỌN: TẠO PHÒNG HOẶC VÀO PHÒNG */}
        {tab === 'SELECT' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-amber-300 block mb-1.5">
                Tên hiển thị của bạn trong trận:
              </label>
              <input
                type="text"
                maxLength={20}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full min-h-[44px] px-4 py-3 bg-slate-900 border border-slate-600 rounded-2xl text-white font-bold text-sm focus:border-blue-400 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTab('CREATE')}
                className="py-4 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 flex flex-col items-center justify-center gap-2 min-h-[96px] border border-blue-400/50 transition-all"
              >
                <Crown className="w-7 h-7 text-amber-300" />
                <span className="text-base">Tạo Phòng Mới</span>
                <span className="text-sm font-normal text-blue-100">Làm chủ phòng & mời bạn</span>
              </button>

              <button
                type="button"
                onClick={() => setTab('JOIN')}
                className="py-4 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black rounded-2xl shadow-lg flex flex-col items-center justify-center gap-2 min-h-[96px] border border-slate-600 transition-all"
              >
                <Globe className="w-7 h-7 text-emerald-300" />
                <span className="text-base">Vào Phòng Đã Có</span>
                <span className="text-sm font-normal text-slate-200">Nhập mã hoặc mở link mời</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. MÀN HÌNH TẠO PHÒNG */}
        {tab === 'CREATE' && (
          <div className="space-y-4">
            <button
              onClick={() => setTab('SELECT')}
              className="min-h-[44px] px-3 text-sm text-slate-200 hover:text-white flex items-center gap-1.5 mb-2 font-bold bg-slate-900 border border-slate-700 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại
            </button>

            <div>
              <label className="text-sm font-bold text-amber-300 block mb-1.5">
                Tên chủ phòng:
              </label>
              <input
                type="text"
                maxLength={20}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full min-h-[44px] px-4 py-3 bg-slate-900 border border-slate-600 rounded-2xl text-white font-bold text-sm focus:border-blue-400 outline-none"
              />
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleCreateRoom}
              className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-95 text-white font-black rounded-2xl shadow-xl text-base min-h-[50px] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Đang kết nối tạo phòng...</span>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300" />
                  <span>Xác Nhận Tạo Phòng Ngay</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 3. MÀN HÌNH VÀO PHÒNG */}
        {tab === 'JOIN' && (
          <div className="space-y-4">
            <button
              onClick={() => setTab('SELECT')}
              className="min-h-[44px] px-3 text-sm text-slate-200 hover:text-white flex items-center gap-1.5 mb-2 font-bold bg-slate-900 border border-slate-700 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại
            </button>

            <div>
              <label className="text-sm font-bold text-amber-300 block mb-1.5">
                Tên hiển thị của bạn:
              </label>
              <input
                type="text"
                maxLength={20}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nhập tên của bạn..."
                className="w-full min-h-[44px] px-4 py-3 bg-slate-900 border border-slate-600 rounded-2xl text-white font-bold text-sm focus:border-blue-400 outline-none mb-3"
              />

              <label className="text-sm font-bold text-slate-100 block mb-1.5">
                Mã phòng (6 ký tự):
              </label>
              <input
                type="text"
                maxLength={6}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="Ví dụ: AB7K9X"
                className="w-full min-h-[48px] px-4 py-3 bg-slate-900 border border-slate-600 rounded-2xl text-amber-300 font-mono font-black text-center tracking-widest text-lg focus:border-emerald-400 outline-none uppercase"
              />
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleJoinRoom}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black rounded-2xl shadow-xl text-base min-h-[50px] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Đang kiểm tra phòng...</span>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>Vào Phòng Chờ</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* 4. PHÒNG CHỜ (LOBBY) */}
        {tab === 'LOBBY' && currentRoom && (
          <div className="space-y-5">
            {/* Thanh hiển thị Mã phòng & Nút Copy */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-sm text-slate-200 uppercase font-bold tracking-wider block">
                  Mã phòng bí mật:
                </span>
                <span className="text-2xl font-black text-amber-300 font-mono tracking-widest">
                  {currentRoom.code}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex-1 sm:flex-none min-h-[44px] py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-sm font-bold text-white rounded-xl border border-slate-600 flex items-center justify-center gap-1.5"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-amber-300" />}
                  {copiedCode ? 'Đã chép mã' : 'Chép mã'}
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 sm:flex-none min-h-[44px] py-2.5 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-sm font-bold text-white rounded-xl shadow flex items-center justify-center gap-1.5"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-200" /> : <Share2 className="w-4 h-4 text-blue-100" />}
                  {copiedLink ? 'Đã gửi/chép' : 'Gửi link bạn bè'}
                </button>
              </div>
            </div>

            {/* Danh sách người chơi trong phòng */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-100">
                  Người chơi đã vào ({currentRoom.players.length}/{currentRoom.settings.maxPlayers}):
                </span>
                <span className="text-sm text-emerald-300 font-mono">Thời gian thực</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentRoom.players.map((p) => {
                  const isMe = p.id === myPlayerId;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700 rounded-2xl"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-4 h-4 rounded-full border border-white/60 shrink-0 shadow"
                          style={{ backgroundColor: p.color }}
                        />
                        <div>
                          <div className="text-sm font-black text-white flex items-center gap-1.5 flex-wrap">
                            <span>{p.name}</span>
                            {isMe && (
                              <span className="text-sm bg-blue-500/35 text-blue-200 px-1.5 py-0.5 rounded font-bold">
                                Bạn
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-200 font-medium">
                            Quốc gia #{p.nationId}
                          </div>
                        </div>
                      </div>

                      {p.isHost && (
                        <div className="flex items-center gap-1 text-amber-300 text-sm font-bold bg-amber-400/15 px-2 py-1 rounded-lg border border-amber-400/40">
                          <Crown className="w-4 h-4 fill-current" />
                          <span>Chủ phòng</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Các slot còn trống */}
                {Array.from({ length: currentRoom.settings.maxPlayers - currentRoom.players.length }).map((_, idx) => (
                  <div
                    key={'empty_' + idx}
                    className="flex items-center justify-center p-3 bg-slate-900/50 border border-dashed border-slate-600 rounded-2xl text-slate-300 text-sm font-bold"
                  >
                    + Đang chờ bạn bè vào...
                  </div>
                ))}
              </div>
            </div>

            {/* Cài đặt trận đấu (Chỉ chủ phòng chỉnh được) */}
            <div className="p-4 bg-slate-900 border border-slate-700 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Cài đặt trận đấu:</span>
                {!isHost && (
                  <span className="text-sm text-slate-300 italic">Do chủ phòng thiết lập</span>
                )}
              </div>

              {/* Kích thước bản đồ */}
              <div>
                <span className="text-sm text-slate-200 block mb-1">Bản đồ thế giới:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[64, 96, 128].map((size) => (
                    <button
                      key={size}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleUpdateSettings({ mapSize: size as MapDimension })}
                      className={`min-h-[44px] py-2 px-1 rounded-xl text-sm font-bold border transition-all ${
                        currentRoom.settings.mapSize === size
                          ? 'bg-blue-600 border-blue-400 text-white shadow'
                          : 'bg-slate-950 border-slate-700 text-slate-200'
                      }`}
                    >
                      {size}x{size} {size === 96 ? '(Chuẩn)' : size === 64 ? '(Nhỏ)' : '(Lớn)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Độ khó bot AI lấp đầy */}
              <div>
                <span className="text-sm text-slate-200 block mb-1">Độ khó của Bot AI:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['EASY', 'NORMAL', 'HARD'] as GameDifficulty[]).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleUpdateSettings({ difficulty: diff })}
                      className={`min-h-[44px] py-2 rounded-xl text-sm font-bold border transition-all ${
                        currentRoom.settings.difficulty === diff
                          ? 'bg-amber-600 border-amber-400 text-white shadow'
                          : 'bg-slate-950 border-slate-700 text-slate-200'
                      }`}
                    >
                      {diff === 'EASY' ? 'Dễ' : diff === 'NORMAL' ? 'Vừa' : 'Khó'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Nút hành động */}
            <div className="flex flex-col gap-2 pt-2">
              {isHost ? (
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 text-base min-h-[50px] flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Bắt Đầu Trận Đấu Ngay</span>
                </button>
              ) : (
                <div className="text-center py-3 bg-slate-900 border border-slate-700 rounded-2xl text-sm text-amber-200 font-bold flex items-center justify-center gap-2 animate-pulse">
                  <Shield className="w-4 h-4 text-amber-300" />
                  <span>Đang chờ chủ phòng bấm bắt đầu trận...</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleLeaveRoom}
                className="w-full min-h-[44px] py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold rounded-xl text-sm border border-slate-600"
              >
                Rời Phòng Chờ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
