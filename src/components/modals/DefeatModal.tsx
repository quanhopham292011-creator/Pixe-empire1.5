import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { GameDifficulty, GameMode, MapDimension } from '../../types';
import { MatchLeaderboard } from '../MatchLeaderboard';
import { multiplayerClient } from '../../multiplayer/multiplayerClient';

interface DefeatModalProps {
  isVisible: boolean;
  isMultiplayer: boolean;
  difficulty: GameDifficulty;
  mapSize: MapDimension;
  playerName: string;
  gameMode: GameMode;
  gameDataRef: React.MutableRefObject<any>;
  totalLandCountRef: React.MutableRefObject<number>;
  myNationIdRef: React.MutableRefObject<number>;
  setGameState: (state: 'TITLE' | 'PLAYING' | 'VICTORY' | 'DEFEAT') => void;
  setIsMultiplayer: (val: boolean) => void;
  setIsMultiplayerModalOpen: (val: boolean) => void;
  startNewGame: (diff: GameDifficulty, size: MapDimension, name: string, mode: GameMode) => void;
}

export const DefeatModal: React.FC<DefeatModalProps> = ({
  isVisible,
  isMultiplayer,
  difficulty,
  mapSize,
  playerName,
  gameMode,
  gameDataRef,
  totalLandCountRef,
  myNationIdRef,
  setGameState,
  setIsMultiplayer,
  setIsMultiplayerModalOpen,
  startNewGame,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-md w-full text-center shadow-2xl max-h-[92vh] overflow-y-auto">
        <AlertTriangle className="w-14 h-14 text-red-500 mx-auto mb-2 animate-pulse" />
        <h2 className="text-2xl font-black text-white mb-1">ĐẾ CHẾ SỤP ĐỔ!</h2>
        <p className="text-xs text-slate-300 mb-2">Lãnh thổ của bạn đã hoàn toàn thất thủ.</p>

        {/* BẢNG XẾP HẠNG LÃNH THỔ CÁC QUỐC GIA */}
        <MatchLeaderboard
          nations={gameDataRef.current.nations}
          myNationId={myNationIdRef.current || 1}
          totalLand={totalLandCountRef.current || 1}
          isVictory={false}
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
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg text-sm min-h-[48px] active:scale-95"
          >
            {isMultiplayer ? 'Quay Lại Phòng Chờ' : 'Thử Lại Ngay'}
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
  );
};
