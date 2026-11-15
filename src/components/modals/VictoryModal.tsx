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
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in">
        <div className="bg-slate-950 border-2 border-amber-400/80 rounded-3xl p-5 sm:p-7 max-w-md w-full text-center shadow-2xl shadow-amber-500/20 max-h-[92vh] overflow-y-auto">
          <Award className="w-14 h-14 text-amber-300 mx-auto mb-2 animate-bounce" />
          <h2 className="text-2xl sm:text-3xl font-black text-amber-200 mb-1 tracking-tight">🎉 ĐẠI THỐNG NHẤT!</h2>
          <p className="text-sm text-slate-100 mb-2 leading-relaxed">
            Chúc mừng! Bạn đã chinh phục thành công <strong className="text-amber-300 font-mono text-base">{hudStats.landPercent}%</strong> bản đồ và xưng bá thiên hạ!
          </p>

          {/* PHẦN THƯỞNG CHIẾN THẮNG: EXP, CẤP ĐỘ VÀ TIỀN XU PIXEL */}
          {victoryReward && (
            <div className="mb-3 p-3.5 bg-gradient-to-br from-amber-950/80 via-slate-900 to-amber-950/80 border border-amber-400/70 rounded-2xl text-left shadow-lg">
              <div className="flex items-center justify-between flex-wrap gap-1.5 mb-2">
                <span className="text-sm font-black text-amber-200 flex items-center gap-1.5 uppercase tracking-wide">
                  <Sparkles className="w-4 h-4 text-amber-300 animate-spin-slow" />
                  Phần Thưởng Chiến Thắng
                </span>
                {victoryReward.isCreative ? (
                  <span className="text-sm text-purple-200 bg-purple-950 px-2 py-0.5 rounded border border-purple-400/60">
                    Chế Độ Sáng Tạo
                  </span>
                ) : victoryReward.isMultiplayer ? (
                  <span className="text-sm text-indigo-200 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-400/60">
                    Tạo Phòng (-50%)
                  </span>
                ) : (
                  <span className="text-sm text-emerald-200 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-400/60">
                    Độ Khó: {difficulty === 'EASY' ? 'Dễ' : difficulty === 'NORMAL' ? 'Vừa' : 'Khó'}
                  </span>
                )}
              </div>

              {victoryReward.isCreative ? (
                <p className="text-sm text-slate-200 italic">
                  ⚠️ Chế độ Sáng Tạo (Sandbox) không nhận được EXP và Tiền xu Pixel.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="bg-slate-950 border border-amber-400/50 p-2.5 rounded-xl flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/25 flex items-center justify-center text-amber-300 shrink-0">
                        <Star className="w-4 h-4 fill-amber-300" />
                      </div>
                      <div>
                        <div className="text-sm text-slate-200">Kinh Nghiệm</div>
                        <div className="text-sm font-black text-amber-200">+{victoryReward.expGained} EXP</div>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-amber-400/50 p-2.5 rounded-xl flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/25 flex items-center justify-center text-amber-300 shrink-0">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm text-slate-200">Tiền Xu Pixel</div>
                        <div className="text-sm font-black text-amber-200 font-mono">+{victoryReward.coinsGained} Xu 🪙</div>
                      </div>
                    </div>
                  </div>

                  {/* THÔNG BÁO LÊN CẤP ĐẶC BIỆT */}
                  {victoryReward.leveledUp && (
                    <div className="mb-2 p-2.5 bg-gradient-to-r from-amber-500/35 via-yellow-500/45 to-amber-500/35 border border-amber-300 rounded-xl text-center animate-bounce shadow">
                      <div className="text-sm font-black text-amber-100 flex items-center justify-center gap-1.5">
                        <Crown className="w-4 h-4 text-amber-200" />
                        <span>🎉 CHÚC MỪNG BẠN ĐÃ LÊN CẤP {victoryReward.newLevel}!</span>
                      </div>
                    </div>
                  )}

                  {/* THANH EXP MỚI */}
                  <div>
                    <div className="flex justify-between flex-wrap gap-1 text-sm mb-1 text-slate-100 font-medium">
                      <span>Cấp độ: <strong className="text-amber-200 font-bold">Lv.{playerProfile.level}</strong></span>
                      <span>
                        {playerProfile.level >= MAX_PLAYER_LEVEL 
                          ? '⭐ ĐẠT CẤP TỐI ĐA (MAX)' 
                          : `${playerProfile.exp} / ${getRequiredExpForNextLevel(playerProfile.level)} EXP`}
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-600">
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

          <div className="flex flex-col gap-2 mt-3">
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
                className="w-full py-3 bg-slate-900 text-slate-100 hover:text-white rounded-xl text-sm font-bold border border-slate-600 min-h-[44px]"
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
