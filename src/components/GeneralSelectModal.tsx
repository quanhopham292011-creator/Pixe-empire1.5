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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-2xl rounded-2xl border-2 border-[#d9a93a] bg-[#141a3a] p-4 sm:p-6 shadow-2xl text-[#fff3d1] flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#d9a93a]/40 pb-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-wide text-[#ffd45a] flex items-center gap-2">
              <span>🎖️</span> BẢNG CHỌN TƯỚNG
            </h2>
            <p className="text-sm text-[#c9d2ff] mt-1">
              Chọn Tướng đồng hành cùng quốc gia của bạn trên chiến trường Pixel!
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[48px] min-w-[48px] rounded-xl bg-gradient-to-r from-[#27306b] to-[#1a2147] border-2 border-[#d9a93a] px-4 py-2.5 text-base font-bold text-[#ffe9a8] hover:border-[#fff2a8] transition-all shadow shrink-0 active:translate-y-0.5"
          >
            ✕ Đóng
          </button>
        </div>

        {/* Currency & Level Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 bg-[#0b0f26] rounded-xl px-4 py-3 mb-4 border border-[#d9a93a]/50">
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-[#ffd45a]">👑 Cấp độ:</span>
            <span className="bg-[#2b2f7a] border border-[#d9a93a]/60 px-3 py-1 rounded-full text-[#ffe9a8]">
              Lv.{playerProfile.level}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-[#ffd45a]">🪙 Xu Pixel:</span>
            <span className="bg-[#2b2f7a] border border-[#d9a93a]/60 px-3 py-1 rounded-full text-[#ffd45a]">
              {playerProfile.pixelCoins} Xu
            </span>
          </div>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="mb-4 rounded-xl bg-red-950/90 border border-red-400 p-3 text-sm text-red-200 flex items-center justify-between gap-2 shadow-lg">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="min-h-[48px] px-3.5 text-sm underline font-bold text-red-300 hover:text-white shrink-0"
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
                className={`relative flex flex-col sm:flex-row items-center gap-4 rounded-xl p-4 transition-all border-2 ${
                  isSelected
                    ? 'bg-[#2b2f7a]/90 border-[#ffd45a] shadow-xl shadow-amber-950/40'
                    : isUnlocked
                    ? 'bg-[#0b0f26] border-[#d9a93a]/50 hover:border-[#d9a93a]'
                    : 'bg-[#0b0f26]/80 border-slate-700 opacity-90'
                }`}
              >
                {/* General Pixel Avatar */}
                <div className="flex-shrink-0 flex items-center justify-center bg-[#141a3a] p-4 rounded-xl border border-[#d9a93a]/60 shadow-inner relative">
                  <GeneralModel skillId={item.skillId} size={84} />
                  {!isUnlocked && (
                    <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center backdrop-blur-[1px]">
                      <span className="text-2xl">🔒</span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 text-center sm:text-left space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="text-lg font-black text-white">{item.name}</h3>
                    {isSelected && (
                      <span className="bg-emerald-500/25 text-emerald-300 border border-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                        ✓ Đang chọn
                      </span>
                    )}
                    {!isUnlocked && (
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                        {item.price ? `🪙 ${item.price} Xu` : item.unlockLevel ? `👑 Lv.${item.unlockLevel}` : '🔒 Khóa'}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-[#7df3e4] flex items-center justify-center sm:justify-start gap-1 flex-wrap">
                    <span>⚡ Kỹ năng:</span>
                    <span>{item.skillName}</span>
                    <span className="text-slate-300 font-normal">
                      (Hồi: {item.cooldown}s{item.duration > 0 ? ` | Tác dụng: ${item.duration}s` : ''})
                    </span>
                  </div>
                  <p className="text-sm text-[#c9d2ff] leading-relaxed">{item.description}</p>
                  <div className="flex items-center justify-center sm:justify-start flex-wrap gap-1.5 pt-0.5 text-xs font-mono font-bold">
                    <span className="bg-red-950/80 text-red-200 px-2 py-0.5 rounded border border-red-400/50">
                      ❤️ 1000 HP
                    </span>
                    <span className="bg-blue-950/80 text-blue-200 px-2 py-0.5 rounded border border-blue-400/50">
                      🛡️ 20% Giáp
                    </span>
                    <span className="bg-amber-950/80 text-amber-200 px-2 py-0.5 rounded border border-amber-400/50">
                      ⚔️ 90 Sát Thương
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                  {isSelected ? (
                    <button
                      disabled
                      className="w-full sm:w-36 min-h-[48px] py-3 px-4 rounded-xl bg-amber-600/30 border border-amber-400 text-amber-200 font-bold text-sm cursor-default"
                    >
                      ✓ Đang chọn
                    </button>
                  ) : isUnlocked ? (
                    <button
                      onClick={() => handleSelect(item.skillId)}
                      className="w-full sm:w-36 min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-[#ffe27a] to-[#e8a22c] hover:from-[#fff] hover:to-[#facc15] text-[#2a1700] border-2 border-[#7a4a00] font-bold text-sm shadow-md transition-all active:translate-y-0.5"
                    >
                      Chọn Tướng
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase(item)}
                      className="w-full sm:w-36 min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-[#7041e0] to-[#5a2bc2] hover:from-[#8b5cf6] hover:to-[#6d28d9] text-white border-2 border-[#d2b8ff] font-bold text-sm shadow-md transition-all active:translate-y-0.5"
                    >
                      Mở Khóa {item.price ? `(${item.price} Xu)` : item.unlockLevel ? `(Lv.${item.unlockLevel})` : ''}
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
