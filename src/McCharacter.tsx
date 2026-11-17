import React from 'react';
import { GeneralSkillId } from './types';
import { GENERAL_ROSTER } from './utils/constants';
import { GeneralModel } from './components/GeneralModel';

interface McCharacterProps {
  name?: string;
  selectedGeneral?: GeneralSkillId;
  onClick?: () => void;
}

export default function McCharacter({ name, selectedGeneral = 'INSPIRE_AURA', onClick }: McCharacterProps) {
  const rosterItem = GENERAL_ROSTER.find(g => g.skillId === selectedGeneral) || GENERAL_ROSTER[0];

  return (
    <div className="mc-char">
      {/* 1. Nhãn tên quốc gia / người chơi phía trên khung */}
      {name && <div className="tag">{name}</div>}

      {/* 2. Khung nhân vật: Avatar tướng ở giữa, tên tướng & kỹ năng ở đáy */}
      <div
        onClick={onClick}
        className="mc-char-frame cursor-pointer hover:border-[#fff2a8] transition-all active:scale-[0.98]"
        title="Bấm để đổi Tướng"
      >
        <div className="mc-char-avatar">
          <GeneralModel skillId={selectedGeneral} size={84} />
        </div>
        <div className="w-full text-center mt-1.5 md:mt-2 px-1 overflow-hidden">
          <div
            className="text-[#ffe9a8] font-bold text-[18px] md:text-[22px] leading-tight truncate"
            style={{ textShadow: '1px 1px 2px #000, 0 0 4px rgba(0,0,0,0.8)' }}
            title={rosterItem.name}
          >
            {rosterItem.name}
          </div>
          <div
            className="text-[#7df3e4] font-medium text-[15px] md:text-[18px] leading-tight truncate mt-0.5 md:mt-1"
            style={{ textShadow: '1px 1px 2px #000, 0 0 4px rgba(0,0,0,0.8)' }}
            title={rosterItem.skillName}
          >
            ⚡ {rosterItem.skillName}
          </div>
        </div>
      </div>

      {/* 3. Nút Tướng nhỏ gọn NGAY DƯỚI khung nhân vật */}
      <button
        type="button"
        onClick={onClick}
        className="mc-btn-general"
        title="Bảng chọn Tướng"
      >
        <span className="w-[22px] h-[22px] md:w-[28px] md:h-[28px] flex items-center justify-center shrink-0 overflow-hidden">
          <GeneralModel skillId={selectedGeneral} size={28} />
        </span>
        <span className="text-[18px] md:text-[24px] font-bold leading-none select-none">Tướng</span>
      </button>

      {/* Bóng dưới chân */}
      <div className="shadow" />
    </div>
  );
}
