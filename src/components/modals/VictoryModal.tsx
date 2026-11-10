import React from 'react';
import { Award, Sparkles, Star, Coins, Crown } from 'lucide-react';
import { VictoryReward, GameDifficulty, GameMode, MapDimension, PlayerProfile } from '../../types';
import { MatchLeaderboard } from '../MatchLeaderboard';
import { VictoryConfettiCanvas } from '../VictoryConfettiCanvas';
import { MAX_PLAYER_LEVEL, getRequiredExpForNextLevel } from '../../utils/progression';
import { multiplayerClient } from '../../multiplayer/multiplayerClient';

interface VictoryModalProps {
  isVisible: boolean;
  victoryReward: VictoryReward | null;
  hudStats: { landPercent: number };
  difficulty: GameDifficulty;
  gameMode: GameMode;
  mapSize: MapDimension;
  playerName: string;
  playerProfile: PlayerProfile;
  gameDataRef: React.MutableRefObject<any>;
  totalLandCountRef: React.MutableRefObject<number>;
  myNationIdRef: React.MutableRefObject<number>;
  isMultiplayer: boolean;
  setIsMultiplayer: (val: boolean) => void;
  setGameState: (state: 'TITLE' | 'PLAYING' | 'VICTORY' | 'DEFEAT') => void;
  setIsMultiplayerModalOpen: (val: boolean) => void;
  startNewGame: (diff: GameDifficulty, size: MapDimension, name: string, mode: GameMode) => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  isVisible,
  victoryReward,
  hudStats,
  difficulty,
  gameMode,
  mapSize,
  playerName,
  playerProfile,
  gameDataRef,
  totalLandCountRef,
  myNationIdRef,
  isMultiplayer,
  setIsMultiplayer,
  setGameState,
  setIsMultiplayerModalOpen,
  startNewGame,
}) => {
  if (!isVisible) return null;

  return (
    <>
      <VictoryConfettiCanvas />
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in">
        <div className="bg-slate-900/95 border border-amber-500/50 rounded-3xl p-5 sm:p-7 max-w-md w-full text-center shadow-2xl shadow-amber-500/20 max-h-[92vh] overflow-y-auto">
          <Award className="w-14 h-14 text-amber-400 mx-auto mb-2 animate-bounce" />
          <h2 className="text-2xl sm:text-3xl font-black text-amber-300 mb-1 tracking-tight">🎉 ĐẠI THỐNG NHẤT!</h2>
          <p className="text-xs text-slate-300 mb-2 leading-relaxed">
            Chúc mừng! Bạn đã chinh phục thành công <strong className="text-amber-400 font-mono text-sm">{hudStats.landPercent}%</strong> bản đồ và xưng bá thiên hạ!
          </p>

          {/* PHẦN THƯỞNG CHIẾN THẮNG: EXP, CẤP ĐỘ VÀ TIỀN XU PIXEL */}
          {victoryReward && (
            <div className="mb-3 p-3.5 bg-gradient-to-br from-amber-950/70 via-slate-900/90 to-amber-950/70 border border-amber-500/60 rounded-2xl text-left shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                  Phần Thưởng Chiến Thắng
                </span>
                {victoryReward.isCreative ? (
                  <span className="text-[10px] text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/40">
                    Chế Độ Sáng Tạo
                  </span>
                ) : victoryReward.isMultiplayer ? (
                  <span className="text-[10px] text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/40">
                    Tạo Phòng (-50%)
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                    Độ Khó: {difficulty === 'EASY' ? 'Dễ' : difficulty === 'NORMAL' ? 'Vừa' : 'Khó'}
                  </span>
                )}
              </div>

              {victoryReward.isCreative ? (
                <p className="text-[11px] text-slate-400 italic">
                  ⚠️ Chế độ Sáng Tạo (Sandbox) không nhận được EXP và Tiền xu Pixel.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="bg-slate-950/80 border border-amber-500/30 p-2 rounded-xl flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <Star className="w-4 h-4 fill-amber-400" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Kinh Nghiệm</div>
                        <div className="text-xs font-black text-amber-300">+{victoryReward.expGained} EXP</div>
                      </div>
                    </div>

                    <div className="bg-slate-950/80 border border-amber-500/30 p-2 rounded-xl flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Tiền Xu Pixel</div>
                        <div className="text-xs font-black text-amber-300 font-mono">+{victoryReward.coinsGained} Xu 🪙</div>
                      </div>
                    </div>
                  </div>

                  {/* THÔNG BÁO LÊN CẤP ĐẶC BIỆT */}
                  {victoryReward.leveledUp && (
                    <div className="mb-2 p-2 bg-gradient-to-r from-amber-500/30 via-yellow-500/40 to-amber-500/30 border border-amber-400 rounded-xl text-center animate-bounce shadow">
                      <div className="text-xs font-black text-amber-200 flex items-center justify-center gap-1.5">
                        <Crown className="w-4 h-4 text-amber-300" />
                        <span>🎉 CHÚC MỪNG BẠN ĐÃ LÊN CẤP {victoryReward.newLevel}!</span>
                      </div>
                    </div>
                  )}

                  {/* THANH EXP MỚI */}
                  <div>
                    <div className="flex justify-between text-[10px] mb-1 text-slate-300 font-medium">
                      <span>Cấp độ hiện tại: <strong className="text-amber-300 font-bold">Lv.{playerProfile.level}</strong></span>
                      <span>
                        {playerProfile.level >= MAX_PLAYER_LEVEL 
                          ? '⭐ ĐẠT CẤP TỐI ĐA (MAX)' 
                          : `${playerProfile.exp} / ${getRequiredExpForNextLevel(playerProfile.level)} EXP`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-700/60">
                      <div 
                        className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500 shadow-sm shadow-amber-400/50"
                        style={{ 
                          width: playerProfile.level >= MAX_PLAYER_LEVEL 
                            ? '100%' 
                            : `${Math.min(100, Math.floor((playerProfile.exp / (getRequiredExpForNextLevel(playerProfile.level) || 1)) * 100))}%` 
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* BẢNG XẾP HẠNG LÃNH THỔ CÁC QUỐC GIA */}
          <MatchLeaderboard
            nations={gameDataRef.current.nations}
            myNationId={myNationIdRef.current || 1}
            totalLand={totalLandCountRef.current || 1}
            isVictory={true}
          />

          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={() => {
                if (isMultiplayer) {
                  setGameState('TITLE');
                  setIsMultiplayerModalOpen(true);
                } else {
                  startNewGame(difficulty, mapSize, playerName, gameMode);
                }
              }}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-black rounded-2xl shadow-xl text-sm min-h-[48px] active:scale-95 transition-all"
            >
              {isMultiplayer ? 'Quay Lại Phòng Chờ' : 'Chơi Ván Mới Chinh Phục'}
            </button>
            {isMultiplayer && (
              <button
                onClick={() => {
                  setIsMultiplayer(false);
                  multiplayerClient.leaveRoom();
                  setGameState('TITLE');
                }}
                className="w-full py-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 min-h-[44px]"
              >
                Thoát Về Màn Hình Chính
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
