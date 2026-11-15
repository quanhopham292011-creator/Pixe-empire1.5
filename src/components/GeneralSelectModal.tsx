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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border-2 border-amber-400/50 bg-slate-950 p-4 sm:p-6 shadow-2xl text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-wide text-amber-300 flex items-center gap-2">
              <span>🎖️</span> BẢNG CHỌN TƯỚNG
            </h2>
            <p className="text-sm text-slate-200 mt-1">
              Chọn Tướng đồng hành cùng quốc gia của bạn trên chiến trường Pixel!
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 border border-slate-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors shrink-0"
          >
            ✕ Đóng
          </button>
        </div>

        {/* Currency & Level Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-900 rounded-xl px-4 py-2.5 mb-4 border border-slate-700">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-amber-300">👑 Cấp độ:</span>
            <span className="font-bold bg-amber-500/25 border border-amber-400/50 px-2.5 py-0.5 rounded-full text-amber-200">
              Lv.{playerProfile.level}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-yellow-300">🪙 Xu Pixel:</span>
            <span className="font-bold text-yellow-200 bg-yellow-500/25 border border-yellow-400/50 px-2.5 py-0.5 rounded-full">
              {playerProfile.pixelCoins} Xu
            </span>
          </div>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="mb-4 rounded-xl bg-red-950 border border-red-400/70 p-3 text-sm text-red-100 flex items-center justify-between gap-2">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="min-h-[44px] px-3 text-sm underline font-bold text-red-200 hover:text-white shrink-0"
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
                    ? 'bg-amber-950/60 border-amber-400 shadow-lg shadow-amber-950/50'
                    : isUnlocked
                    ? 'bg-slate-900 border-slate-600 hover:border-slate-500'
                    : 'bg-slate-900/90 border-slate-700 opacity-90'
                }`}
              >
                {/* General Pixel Avatar */}
                <div className="flex-shrink-0 flex items-center justify-center bg-slate-950 p-3 rounded-xl border border-slate-700">
                  <GeneralModel skillId={item.skillId} size={72} />
                </div>

                {/* Details */}
                <div className="flex-1 text-center sm:text-left space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-lg font-bold text-white">{item.name}</h3>
                    {isSelected && (
                      <span className="bg-emerald-500/25 text-emerald-200 border border-emerald-400/60 text-sm px-2.5 py-0.5 rounded-full font-semibold">
                        ✓ Đang chọn
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-amber-200 flex items-center justify-center sm:justify-start gap-1 flex-wrap">
                    <span>⚡ Skill:</span>
                    <span>{item.skillName}</span>
                    <span className="text-slate-200 font-normal">
                      (Hồi: {item.cooldown}s{item.duration > 0 ? ` | Tác dụng: ${item.duration}s` : ''})
                    </span>
                  </div>
                  <p className="text-sm text-slate-100 leading-relaxed">{item.description}</p>
                  <div className="flex items-center justify-center sm:justify-start flex-wrap gap-1.5 pt-0.5 text-sm font-mono">
                    <span className="bg-red-950 text-red-200 px-2 py-0.5 rounded border border-red-400/50">
                      ❤️ 1000 HP
                    </span>
                    <span className="bg-blue-950 text-blue-200 px-2 py-0.5 rounded border border-blue-400/50">
                      🛡️ 20% Giáp
                    </span>
                    <span className="bg-amber-950 text-amber-200 px-2 py-0.5 rounded border border-amber-400/50">
                      ⚔️ 90 Sát Thương
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                  {isSelected ? (
                    <button
                      disabled
                      className="w-full sm:w-36 min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-600/35 border border-amber-400 text-amber-200 font-semibold text-sm cursor-default"
                    >
                      ✓ Đã chọn
                    </button>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => handleSelect(item.skillId)}
                      className="w-full sm:w-36 min-h-[44px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-md hover:shadow-amber-500/20 transition-all active:scale-95"
                    >
                      Chọn Tướng
                    </button>
                  ) : item.unlockType === 'LEVEL' ? (
                    <div className="w-full sm:w-40 min-h-[44px] flex items-center justify-center py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-600 text-slate-200 text-sm font-semibold text-center">
                      🔒 Khóa (Cần Lv.{item.unlockLevel})
                    </div>
                  ) : (
                    <button
                      onClick={() => handlePurchase(item)}
                      className="w-full sm:w-40 min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
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
