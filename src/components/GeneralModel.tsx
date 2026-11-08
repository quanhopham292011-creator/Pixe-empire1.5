import React from 'react';
import { GeneralSkillId } from '../types';

interface GeneralModelProps {
  skillId: GeneralSkillId;
  size?: number;
  className?: string;
}

export const GeneralModel: React.FC<GeneralModelProps> = ({
  skillId,
  size = 40,
  className = '',
}) => {
  // Render pixel SVG character based on skillId (16x16 grid)
  const renderPixelCharacter = () => {
    switch (skillId) {
      case 'INSPIRE_AURA':
        // Hắc Phong: Giáp xanh dương, mũ có lông vũ trắng, tay cầm kèn lệnh vàng
        return (
          <>
            {/* Lông vũ trắng trên mũ */}
            <rect x="7" y="0" width="2" height="3" fill="#ffffff" />
            <rect x="6" y="1" width="1" height="2" fill="#e2e8f0" />
            {/* Mũ bảo hộ xanh thẫm */}
            <rect x="5" y="2" width="6" height="2" fill="#1e3a8a" />
            {/* Khuôn mặt */}
            <rect x="6" y="4" width="4" height="2" fill="#fde68a" />
            {/* Mắt */}
            <rect x="6" y="4" width="1" height="1" fill="#1e293b" />
            <rect x="9" y="4" width="1" height="1" fill="#1e293b" />
            {/* Áo giáp xanh dương */}
            <rect x="4" y="6" width="8" height="5" fill="#2563eb" />
            <rect x="5" y="7" width="6" height="3" fill="#3b82f6" />
            {/* Cầu vai vàng */}
            <rect x="3" y="6" width="2" height="2" fill="#f59e0b" />
            <rect x="11" y="6" width="2" height="2" fill="#f59e0b" />
            {/* Cánh tay trái & Phải */}
            <rect x="3" y="8" width="2" height="3" fill="#1d4ed8" />
            <rect x="11" y="8" width="2" height="3" fill="#1d4ed8" />
            {/* Tay cầm Kèn Lệnh Vàng ở tay phải */}
            <rect x="12" y="7" width="3" height="2" fill="#fbbf24" />
            <rect x="14" y="6" width="2" height="4" fill="#f59e0b" />
            {/* Thắt lưng */}
            <rect x="5" y="11" width="6" height="1" fill="#78350f" />
            <rect x="7" y="11" width="2" height="1" fill="#fbbf24" />
            {/* Chân & Ống giáp */}
            <rect x="5" y="12" width="2" height="3" fill="#1e40af" />
            <rect x="9" y="12" width="2" height="3" fill="#1e40af" />
            {/* Giày chiến */}
            <rect x="4" y="15" width="3" height="1" fill="#0f172a" />
            <rect x="9" y="15" width="3" height="1" fill="#0f172a" />
          </>
        );

      case 'IRON_BORDER_SHIELD':
        // Thiết Bích: Giáp xám thép, cầm khiên tròn lớn, mũ sắt
        return (
          <>
            {/* Mũ sắt xám */}
            <rect x="5" y="1" width="6" height="3" fill="#64748b" />
            <rect x="6" y="2" width="4" height="1" fill="#94a3b8" />
            {/* Khuôn mặt mặt nạ xám thép */}
            <rect x="6" y="4" width="4" height="2" fill="#fde68a" />
            <rect x="5" y="4" width="6" height="1" fill="#475569" />
            {/* Mắt */}
            <rect x="6" y="4" width="1" height="1" fill="#0f172a" />
            <rect x="9" y="4" width="1" height="1" fill="#0f172a" />
            {/* Áo giáp thép */}
            <rect x="4" y="6" width="8" height="5" fill="#475569" />
            <rect x="5" y="7" width="6" height="3" fill="#64748b" />
            {/* Cầm Khiên Tròn Lớn ở phía trước trái */}
            <rect x="1" y="6" width="5" height="7" fill="#94a3b8" />
            <rect x="2" y="7" width="3" height="5" fill="#cbd5e1" />
            <rect x="3" y="8" width="1" height="3" fill="#f59e0b" />
            {/* Cánh tay phải */}
            <rect x="11" y="7" width="2" height="4" fill="#334155" />
            {/* Thắt lưng */}
            <rect x="5" y="11" width="6" height="1" fill="#1e293b" />
            {/* Chân & Giày thép */}
            <rect x="5" y="12" width="2" height="3" fill="#334155" />
            <rect x="9" y="12" width="2" height="3" fill="#334155" />
            <rect x="4" y="15" width="3" height="1" fill="#0f172a" />
            <rect x="9" y="15" width="3" height="1" fill="#0f172a" />
          </>
        );

      case 'SUPPLY_REINFORCE':
        // Kim Ưng: Áo choàng nâu vàng, mũ có cánh chim ưng, vai móng vuốt vàng
        return (
          <>
            {/* Cánh chim ưng trên mũ */}
            <rect x="3" y="1" width="2" height="2" fill="#fbbf24" />
            <rect x="11" y="1" width="2" height="2" fill="#fbbf24" />
            {/* Mũ đại ưng */}
            <rect x="5" y="1" width="6" height="3" fill="#92400e" />
            <rect x="7" y="0" width="2" height="2" fill="#f59e0b" />
            {/* Mặt */}
            <rect x="6" y="4" width="4" height="2" fill="#fde68a" />
            <rect x="6" y="4" width="1" height="1" fill="#451a03" />
            <rect x="9" y="4" width="1" height="1" fill="#451a03" />
            {/* Vai móng vuốt vàng */}
            <rect x="3" y="5" width="3" height="2" fill="#f59e0b" />
            <rect x="10" y="5" width="3" height="2" fill="#f59e0b" />
            {/* Áo choàng & giáp nâu vàng */}
            <rect x="4" y="6" width="8" height="5" fill="#b45309" />
            <rect x="5" y="7" width="6" height="3" fill="#d97706" />
            {/* Áo choàng ngoài nhọn */}
            <rect x="2" y="7" width="2" height="6" fill="#78350f" />
            <rect x="12" y="7" width="2" height="6" fill="#78350f" />
            {/* Thắt lưng hoàng kim */}
            <rect x="5" y="11" width="6" height="1" fill="#f59e0b" />
            {/* Chân */}
            <rect x="5" y="12" width="2" height="3" fill="#78350f" />
            <rect x="9" y="12" width="2" height="3" fill="#78350f" />
            <rect x="4" y="15" width="3" height="1" fill="#451a03" />
            <rect x="9" y="15" width="3" height="1" fill="#451a03" />
          </>
        );

      case 'SHADOW_RAID':
        // Dạ Ảnh: Áo choàng tím đen, che nửa mặt, cầm 2 dao găm nhỏ
        return (
          <>
            {/* Mũ trùm đầu tím đen */}
            <rect x="5" y="1" width="6" height="3" fill="#3b0764" />
            <rect x="6" y="2" width="4" height="1" fill="#581c87" />
            {/* Mắt tím phát sáng & Khăn che mặt */}
            <rect x="6" y="4" width="4" height="1" fill="#fde68a" />
            <rect x="6" y="4" width="1" height="1" fill="#a855f7" />
            <rect x="9" y="4" width="1" height="1" fill="#a855f7" />
            <rect x="5" y="5" width="6" height="2" fill="#2e1065" />
            {/* Thân & Giáp dạ ảnh */}
            <rect x="4" y="6" width="8" height="5" fill="#18181b" />
            <rect x="5" y="7" width="6" height="3" fill="#3f3f46" />
            {/* Áo choàng đen xòe 2 bên */}
            <rect x="2" y="6" width="2" height="7" fill="#2e1065" />
            <rect x="12" y="6" width="2" height="7" fill="#2e1065" />
            {/* 2 Dao găm phát sáng bên tay */}
            <rect x="2" y="8" width="1" height="4" fill="#38bdf8" />
            <rect x="13" y="8" width="1" height="4" fill="#38bdf8" />
            {/* Thắt lưng */}
            <rect x="5" y="11" width="6" height="1" fill="#a855f7" />
            {/* Chân */}
            <rect x="5" y="12" width="2" height="3" fill="#18181b" />
            <rect x="9" y="12" width="2" height="3" fill="#18181b" />
            <rect x="4" y="15" width="3" height="1" fill="#09090b" />
            <rect x="9" y="15" width="3" height="1" fill="#09090b" />
          </>
        );

      case 'MISSILE_BARRAGE':
        // Hỏa Long: Giáp đỏ cam, mũ có 2 sừng rồng, vai đeo 2 tên lửa nhỏ
        return (
          <>
            {/* Sừng rồng đỏ cam */}
            <rect x="4" y="0" width="1" height="3" fill="#ea580c" />
            <rect x="11" y="0" width="1" height="3" fill="#ea580c" />
            <rect x="5" y="1" width="1" height="2" fill="#f97316" />
            <rect x="10" y="1" width="1" height="2" fill="#f97316" />
            {/* Mũ rồng đỏ */}
            <rect x="5" y="2" width="6" height="2" fill="#b91c1c" />
            {/* Mặt */}
            <rect x="6" y="4" width="4" height="2" fill="#fde68a" />
            <rect x="6" y="4" width="1" height="1" fill="#7f1d1d" />
            <rect x="9" y="4" width="1" height="1" fill="#7f1d1d" />
            {/* 2 Tên lửa nhỏ đeo bên vai */}
            <rect x="2" y="5" width="2" height="4" fill="#ef4444" />
            <rect x="2" y="4" width="2" height="1" fill="#f97316" />
            <rect x="12" y="5" width="2" height="4" fill="#ef4444" />
            <rect x="12" y="4" width="2" height="1" fill="#f97316" />
            {/* Giáp đỏ cam */}
            <rect x="4" y="6" width="8" height="5" fill="#dc2626" />
            <rect x="5" y="7" width="6" height="3" fill="#ea580c" />
            {/* Thắt lưng lửa */}
            <rect x="5" y="11" width="6" height="1" fill="#f97316" />
            {/* Chân */}
            <rect x="5" y="12" width="2" height="3" fill="#991b1b" />
            <rect x="9" y="12" width="2" height="3" fill="#991b1b" />
            <rect x="4" y="15" width="3" height="1" fill="#450a0a" />
            <rect x="9" y="15" width="3" height="1" fill="#450a0a" />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={`shrink-0 drop-shadow-md ${className}`}
      style={{ shapeRendering: 'crispEdges' }}
    >
      {renderPixelCharacter()}
    </svg>
  );
};
