import React from 'react';
import { BuildingType } from '../types';

export const BuildingSvgIcon: React.FC<{ type: BuildingType | 'DARK_TITAN'; className?: string }> = ({ type, className = "w-6 h-6" }) => {
  switch (type) {
    case 'CITY':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M3 21h18M5 21V7l8-4v18M13 21V9l6-2v14M9 11h2M9 15h2" />
        </svg>
      );
    case 'BARRACKS':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M2 20h20M4 20V10l6-4v14M10 20v-6h4v6M14 14l6-3v9M7 8h2M7 11h2M16 9h2" />
        </svg>
      );
    case 'PORT':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="5" r="3" />
          <path d="M12 8v13M5 12h2a5 5 0 0 0 10 0h2" />
        </svg>
      );
    case 'MISSILE_SILO':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 2s4 4 4 10v7H8v-7c0-6 4-10 4-10zM12 12v6M9 19h6M8 7h8" />
        </svg>
      );
    case 'AIR_DEFENSE':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M2 20h20M7 20v-5l5-7 5 7v5M12 15V8M9 5h6" />
        </svg>
      );
    case 'FORTRESS':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'ARTILLERY':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="7" cy="17" r="4" />
          <path d="M7 17l11-9M14 6h4v4" />
        </svg>
      );
    case 'LASER':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 2v6M12 8L8 12h8l-4-4z" stroke="#ec4899" fill="#f472b6" fillOpacity="0.25" />
          <circle cx="12" cy="14" r="3.5" fill="#ec4899" stroke="#ffffff" strokeWidth="2" />
          <path d="M4 20h16M7 20l2-4h6l2 4" stroke="#f472b6" strokeWidth="2.5" />
          <path d="M4 4l3 3M20 4l-3 3" stroke="#f472b6" strokeWidth="2.2" />
        </svg>
      );
    case 'DARK_TITAN':
      return (
        <svg viewBox="0 0 24 24" fill="#090d16" stroke="#dc2626" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
          {/* Cấu hình SVG Tà Thần Cổ Đại: Đỏ Đen, Nét Dày, Lớn, Rõ Nét Khi Thu Nhỏ */}
          <path d="M3 3l4 6M21 3l-4 6" stroke="#ef4444" strokeWidth="3.2" />
          <path d="M12 2L5 8v6l7 8 7-8V8L12 2z" fill="#000000" stroke="#dc2626" strokeWidth="2.8" />
          <path d="M8 11h2.5M13.5 11H16" stroke="#ef4444" strokeWidth="3" />
          <circle cx="9.25" cy="11" r="1" fill="#ef4444" />
          <circle cx="14.75" cy="11" r="1" fill="#ef4444" />
          <path d="M9 16l3 2 3-2" stroke="#dc2626" strokeWidth="2.5" />
          <path d="M12 5v3" stroke="#ef4444" strokeWidth="2" />
        </svg>
      );
    default:
      return null;
  }
};

