import React, { useState } from 'react';
import { PlayerProfile, GeneralSkillId } from '../types';
import { GENERAL_ROSTER, GeneralRosterItem } from '../utils/constants';
import { isGeneralUnlocked, purchaseGeneral, selectGeneral } from '../utils/progression';
import { GeneralModel } from './GeneralModel';

interface GeneralSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerProfile: PlayerProfile;
  onUpdateProfile: (updatedProfile: PlayerProfile) => void;
}

export const GeneralSelectModal: React.FC<GeneralSelectModalProps> = ({
  isOpen,
  onClose,
  playerProfile,
  onUpdateProfile,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelect = (skillId: GeneralSkillId) => {
    const result = selectGeneral(playerProfile, skillId);
    if (result.success) {
      onUpdateProfile(result.updatedProfile);
      setErrorMessage(null);
    }
  };

  const handlePurchase = (item: GeneralRosterItem) => {
    const result = purchaseGeneral(playerProfile, item.skillId);
    if (result.success) {
      onUpdateProfile(result.updatedProfile);
      setErrorMessage(null);
    } else if (result.message) {
      setErrorMessage(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-amber-500/30 bg-gray-900/95 p-6 shadow-2xl text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-wide text-amber-400 flex items-center gap-2">
              <span>🎖️</span> BẢNG CHỌN TƯỚNG
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Chọn Tướng đồng hành cùng quốc gia của bạn trên chiến trường Pixel!
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-semibold text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            ✕ Đóng
          </button>
        </div>

        {/* Currency & Level Bar */}
        <div className="flex items-center justify-between bg-gray-800/60 rounded-xl px-4 py-2.5 mb-4 border border-gray-700/50">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-amber-400">👑 Cấp độ:</span>
            <span className="font-bold text-white bg-amber-500/20 px-2.5 py-0.5 rounded-full text-amber-300">
              Lv.{playerProfile.level}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-yellow-400">🪙 Xu Pixel:</span>
            <span className="font-bold text-yellow-300 bg-yellow-500/20 px-2.5 py-0.5 rounded-full">
              {playerProfile.pixelCoins} Xu
            </span>
          </div>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/40 p-3 text-sm text-red-300 flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs underline text-red-400 hover:text-red-200"
            >
              Tắt
            </button>
          </div>
        )}

        {/* General Roster List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {GENERAL_ROSTER.map((item) => {
            const isUnlocked = isGeneralUnlocked(playerProfile, item.skillId);
            const isSelected = playerProfile.selectedGeneral === item.skillId;

            return (
              <div
                key={item.skillId}
                className={`relative flex flex-col sm:flex-row items-center gap-4 rounded-xl p-4 transition-all border ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-950/50'
                    : isUnlocked
                    ? 'bg-gray-800/40 border-gray-700/60 hover:border-gray-600'
                    : 'bg-gray-900/60 border-gray-800 opacity-80'
                }`}
              >
                {/* General Pixel Avatar */}
                <div className="flex-shrink-0 flex items-center justify-center bg-gray-950/70 p-3 rounded-xl border border-gray-800">
                  <GeneralModel skillId={item.skillId} size={72} />
                </div>

                {/* Details */}
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-lg font-bold text-white">{item.name}</h3>
                    {isSelected && (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-semibold">
                        ✓ Đang chọn
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-amber-300 flex items-center justify-center sm:justify-start gap-1">
                    <span>⚡ Skill:</span>
                    <span>{item.skillName}</span>
                    <span className="text-gray-400 font-normal">
                      (Hồi: {item.cooldown}s{item.duration > 0 ? ` | Tác dụng: ${item.duration}s` : ''})
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{item.description}</p>
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                  {isSelected ? (
                    <button
                      disabled
                      className="w-full sm:w-32 py-2.5 px-4 rounded-xl bg-amber-600/30 border border-amber-500/50 text-amber-300 font-semibold text-sm cursor-default"
                    >
                      ✓ Đã chọn
                    </button>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => handleSelect(item.skillId)}
                      className="w-full sm:w-32 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-sm shadow-md hover:shadow-amber-500/20 transition-all active:scale-95"
                    >
                      Chọn Tướng
                    </button>
                  ) : item.unlockType === 'LEVEL' ? (
                    <div className="w-full sm:w-36 py-2.5 px-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 text-xs font-semibold text-center">
                      🔒 Khóa (Cần Lv.{item.unlockLevel})
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePurchase(item)}
                      className="w-full sm:w-36 py-2.5 px-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-gray-950 font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <span>🪙</span> Mua ({item.price} Xu)
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
